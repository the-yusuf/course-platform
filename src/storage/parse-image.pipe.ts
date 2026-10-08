import { FileTypeValidator, ParseFilePipe } from '@nestjs/common';
import { IMAGE_MIME_TYPES } from './storage.constants.js';

// Checks the file's magic bytes, not the client-supplied mimetype/extension
const imagePipe = (fileIsRequired: boolean) =>
  new ParseFilePipe({
    fileIsRequired,
    validators: [
      new FileTypeValidator({
        fileType: IMAGE_MIME_TYPES,
        overrideMimeType: true,
        errorMessage: 'Only JPEG, PNG or WebP images are allowed',
      }),
    ],
  });

export const parseImagePipe = imagePipe(true);
export const parseOptionalImagePipe = imagePipe(false);
