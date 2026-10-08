import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { IMAGE_PRESETS } from './storage.constants.js';
import { StorageService } from './storage.service.js';

const asFile = (buffer: Buffer) => ({ buffer }) as Express.Multer.File;

describe('StorageService', () => {
  let dir: string;
  let storage: StorageService;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'storage-spec-'));
    storage = new StorageService(new ConfigService({ UPLOAD_DIR: dir }));
    await storage.onModuleInit();
  });

  afterEach(() => rm(dir, { recursive: true, force: true }));

  it('re-encodes an image to a resized webp and returns its key', async () => {
    const input = await sharp({
      create: { width: 2000, height: 1000, channels: 3, background: '#f00' },
    })
      .jpeg()
      .toBuffer();

    const key = await storage.saveImage(
      asFile(input),
      'users',
      IMAGE_PRESETS.avatar,
    );

    expect(key).toMatch(/^users\/[0-9a-f-]{36}\.webp$/);
    const meta = await sharp(path.join(dir, key)).metadata();
    expect(meta).toMatchObject({ format: 'webp', width: 512, height: 512 });
  });

  it('rejects bytes that are not a decodable image', async () => {
    await expect(
      storage.saveImage(
        asFile(Buffer.from('not an image')),
        'users',
        IMAGE_PRESETS.avatar,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('deletes a stored file', async () => {
    await writeFile(path.join(dir, 'a.webp'), 'x');
    await storage.delete('a.webp');
    await expect(stat(path.join(dir, 'a.webp'))).rejects.toThrow();
  });

  it('ignores keys that escape the upload directory', async () => {
    const outside = path.join(path.dirname(dir), `${path.basename(dir)}.txt`);
    await writeFile(outside, 'keep me');
    try {
      await storage.delete(`../${path.basename(outside)}`);
      await expect(stat(outside)).resolves.toBeTruthy();
    } finally {
      await rm(outside, { force: true });
    }
  });

  it('does not throw for missing or empty keys', async () => {
    await expect(storage.delete('users/missing.webp')).resolves.toBeUndefined();
    await expect(storage.delete(null)).resolves.toBeUndefined();
  });

  describe('replaceImage', () => {
    const exists = (key: string) =>
      stat(path.join(dir, key)).then(
        () => true,
        () => false,
      );
    let input: Buffer;
    let previous: string;

    beforeEach(async () => {
      input = await sharp({
        create: { width: 100, height: 100, channels: 3, background: '#0f0' },
      })
        .png()
        .toBuffer();
      previous = await storage.saveImage(
        asFile(input),
        'courses',
        IMAGE_PRESETS.course,
      );
    });

    const replace = (persist: (key: string) => Promise<unknown>) => {
      let saved = '';
      const result = storage.replaceImage(
        asFile(input),
        'courses',
        IMAGE_PRESETS.course,
        previous,
        (key) => {
          saved = key;
          return persist(key);
        },
      );
      return { result, saved: () => saved };
    };

    it('keeps the new file and removes the previous one on success', async () => {
      const { result, saved } = replace(async (key) => ({ key }));
      expect(await result).toEqual({ key: saved() });
      expect(await exists(saved())).toBe(true);
      expect(await exists(previous)).toBe(false);
    });

    it('removes the new file and keeps the previous one when persist throws', async () => {
      const { result, saved } = replace(() =>
        Promise.reject(new Error('db down')),
      );
      await expect(result).rejects.toThrow('db down');
      expect(await exists(saved())).toBe(false);
      expect(await exists(previous)).toBe(true);
    });

    it('removes the new file and keeps the previous one when no row is found', async () => {
      const { result, saved } = replace(async () => undefined);
      await expect(result).resolves.toBeUndefined();
      expect(await exists(saved())).toBe(false);
      expect(await exists(previous)).toBe(true);
    });
  });

  it('maps keys to public URLs', () => {
    expect(storage.url('users/a.webp')).toBe('/uploads/users/a.webp');
    expect(storage.url(null)).toBeNull();
  });
});
