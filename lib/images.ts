import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';
import { UPLOADS_DIR } from './config';

const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
]);

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15 MB

export class UploadError extends Error {}

/**
 * Validate, resize (max 800px, EXIF-rotated), and store an uploaded image as
 * webp under UPLOADS_DIR. Returns the public URL path ("/uploads/<file>").
 */
export async function saveImage(file: File): Promise<string> {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new UploadError(`Unsupported image type: ${file.type || 'unknown'}`);
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new UploadError('Image is too large (max 15 MB).');
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const name = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.webp`;

  await fs.mkdir(UPLOADS_DIR, { recursive: true });
  await sharp(buf)
    .rotate() // honor EXIF orientation
    .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(path.join(UPLOADS_DIR, name));

  return `/uploads/${name}`;
}
