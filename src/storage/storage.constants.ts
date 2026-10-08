export const UPLOADS_URL_PREFIX = '/uploads';

export const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB

// Rejects "decompression bombs": tiny files that decode into huge bitmaps
export const MAX_IMAGE_PIXELS = 50_000_000;

// SVG is deliberately excluded: it can carry scripts (stored XSS)
export const IMAGE_MIME_TYPES = /^image\/(jpeg|png|webp)$/;

export const IMAGE_PRESETS = {
  avatar: { width: 512, height: 512 },
  course: { width: 1280, height: 720 },
} as const;

export type ImagePreset = (typeof IMAGE_PRESETS)[keyof typeof IMAGE_PRESETS];

export type StorageFolder = 'users' | 'courses';
