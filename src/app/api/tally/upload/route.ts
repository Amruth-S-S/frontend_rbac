import { NextRequest, NextResponse } from 'next/server';
import { ensureLongFetchTimeouts } from '../undiciTimeout';

const TALLY_BASE = process.env.NEXT_PUBLIC_TALLY_API_BASE_URL || '';
ensureLongFetchTimeouts();

// Large XML uploads can take a while — same reasoning as the extract routes.
export const maxDuration = 2400;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const res = await fetch(`${TALLY_BASE}/upload_gcs`, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: formData,
      signal: AbortSignal.timeout(40 * 60 * 1000), // 40 minutes — large files take a while
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    const isTimeout = err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError');
    const message = isTimeout
      ? 'Upload is taking longer than 40 minutes and timed out. The file may be very large — try again.'
      : `Upload failed: ${err instanceof Error ? err.message : String(err)}`;
    console.error('[upload]', err);
    return NextResponse.json({ error: message }, { status: isTimeout ? 504 : 500 });
  }
}
