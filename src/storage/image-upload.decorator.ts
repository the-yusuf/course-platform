import { applyDecorators, Type, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes } from '@nestjs/swagger';
import { MAX_IMAGE_SIZE } from './storage.constants.js';

/**
 * Accepts a single image under `fieldName` as multipart/form-data, optionally
 * alongside the text fields of `body` (validated by the global ValidationPipe).
 * No `dest`/`storage` is set, so multer keeps the file in memory
 * (`file.buffer`), which the magic-number check in `parseImagePipe` needs.
 */
export const ImageUpload = (fieldName: string, body?: Type<unknown>) =>
  applyDecorators(
    UseInterceptors(
      FileInterceptor(fieldName, {
        limits: { fileSize: MAX_IMAGE_SIZE, files: 1, fields: body ? 20 : 0 },
      }),
    ),
    ApiConsumes('multipart/form-data'),
    ApiBody(
      body
        ? { type: body }
        : {
            schema: {
              type: 'object',
              required: [fieldName],
              properties: { [fieldName]: { type: 'string', format: 'binary' } },
            },
          },
    ),
  );
