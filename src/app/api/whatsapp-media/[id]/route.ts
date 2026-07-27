import { NextRequest, NextResponse } from 'next/server';
import { getMedia } from '../store';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const media = getMedia(params.id);
  if (!media) {
    return NextResponse.json({ message: 'Media not found or expired' }, { status: 404 });
  }

  return new NextResponse(media.buffer, {
    status: 200,
    headers: {
      'Content-Type': media.contentType,
      'Content-Disposition': `attachment; filename="${media.filename}"`,
      'Content-Length': String(media.buffer.length),
      'Cache-Control': 'no-store',
    },
  });
}
