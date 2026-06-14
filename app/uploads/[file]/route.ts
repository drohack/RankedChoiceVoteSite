import fs from 'node:fs/promises';
import path from 'node:path';
import { UPLOADS_DIR } from '@/lib/config';

export const runtime = 'nodejs';

const CONTENT_TYPES: Record<string, string> = {
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ file: string }> }
) {
  const { file } = await params;
  // Prevent path traversal: only ever serve a bare filename from UPLOADS_DIR.
  const safe = path.basename(file);
  const full = path.join(UPLOADS_DIR, safe);

  try {
    const data = await fs.readFile(full);
    const type = CONTENT_TYPES[path.extname(safe).toLowerCase()] ?? 'application/octet-stream';
    return new Response(new Uint8Array(data), {
      headers: {
        'Content-Type': type,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
