import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {
  MAX_IMAGE_PIXELS,
  UPLOADS_URL_PREFIX,
  type ImagePreset,
  type StorageFolder,
} from './storage.constants.js';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  readonly rootDir: string;
  private readonly baseUrl: string;

  constructor(config: ConfigService) {
    this.rootDir = path.resolve(config.get<string>('UPLOAD_DIR') ?? 'uploads');
    // Where clients fetch files from: this API, nginx, or later a CDN
    this.baseUrl = (
      config.get<string>('UPLOADS_BASE_URL') ??
      `http://localhost:${config.get<string>('PORT') ?? 3000}${UPLOADS_URL_PREFIX}`
    ).replace(/\/+$/, '');
  }

  async onModuleInit() {
    await mkdir(this.rootDir, { recursive: true });
    this.logger.log(`Storing uploads in ${this.rootDir}`);
  }

  /**
   * Re-encodes the image (fixes orientation, resizes, strips metadata) and
   * saves it as WebP. Returns the storage key to persist in the database.
   */
  async saveImage(
    file: Express.Multer.File,
    folder: StorageFolder,
    preset: ImagePreset,
  ): Promise<string> {
    let output: Buffer;
    try {
      output = await sharp(file.buffer, { limitInputPixels: MAX_IMAGE_PIXELS })
        .rotate()
        .resize(preset.width, preset.height, {
          fit: 'cover',
          withoutEnlargement: true,
        })
        .webp({ quality: 80 })
        .toBuffer();
    } catch {
      throw new BadRequestException('Invalid or corrupted image');
    }

    const key = `${folder}/${randomUUID()}.webp`;
    const filePath = path.join(this.rootDir, key);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, output, { flag: 'wx' });
    return key;
  }

  /**
   * Saves `file`, hands its key to `persist` (the DB write), then removes
   * `previousKey`. If `persist` throws or finds no row, the new file is
   * removed so no orphan is left behind. Pass `null` for new records.
   */
  async replaceImage<T>(
    file: Express.Multer.File,
    folder: StorageFolder,
    preset: ImagePreset,
    previousKey: string | null,
    persist: (key: string) => Promise<T | undefined>,
  ): Promise<T | undefined> {
    const key = await this.saveImage(file, folder, preset);
    let result: T | undefined;
    try {
      result = await persist(key);
    } catch (err) {
      await this.delete(key);
      throw err;
    }
    await this.delete(result === undefined ? key : previousKey);
    return result;
  }

  /** Best-effort removal: never throws, so it is safe after a DB commit. */
  async delete(key: string | null | undefined) {
    if (!key) return;

    const filePath = path.resolve(this.rootDir, key);
    if (!filePath.startsWith(this.rootDir + path.sep)) {
      this.logger.warn(`Refusing to delete outside upload dir: ${key}`);
      return;
    }

    try {
      await unlink(filePath);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.logger.error(`Failed to delete ${key}`, err as Error);
      }
    }
  }

  url(key: string | null): string | null {
    return key ? `${this.baseUrl}/${key}` : null;
  }
}
