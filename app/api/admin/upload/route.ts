import { NextResponse } from 'next/server';
import { saveImage, UploadError } from '@/lib/images';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'invalid form data' }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'no file provided' }, { status: 400 });
  }

  try {
    const url = await saveImage(file);
    return NextResponse.json({ url });
  } catch (err) {
    if (err instanceof UploadError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error('upload failed', err);
    return NextResponse.json({ error: 'upload failed' }, { status: 500 });
  }
}
