import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { saveImage, UploadError } from './images';
import { UPLOADS_DIR } from './config';

async function pngFile(name = 'test.png', type = 'image/png'): Promise<File> {
  const buf = await sharp({
    create: { width: 64, height: 64, channels: 3, background: { r: 10, g: 200, b: 120 } },
  })
    .png()
    .toBuffer();
  return new File([buf], name, { type });
}

describe('saveImage', () => {
  it('resizes to webp and writes into the uploads dir', async () => {
    const url = await saveImage(await pngFile());
    expect(url).toMatch(/^\/uploads\/.+\.webp$/);

    const full = path.join(UPLOADS_DIR, path.basename(url));
    expect(fs.existsSync(full)).toBe(true);
    const meta = await sharp(full).metadata();
    expect(meta.format).toBe('webp');
  });

  it('rejects an unsupported file type', async () => {
    const file = new File([Buffer.from('not an image')], 'x.txt', {
      type: 'text/plain',
    });
    await expect(saveImage(file)).rejects.toBeInstanceOf(UploadError);
  });
});
