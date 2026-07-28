import { NextRequest, NextResponse } from 'next/server';
import { ensureLongFetchTimeouts } from '../../undiciTimeout';

const TALLY_BASE = process.env.NEXT_PUBLIC_TALLY_API_BASE_URL || '';
ensureLongFetchTimeouts();

// Large Tally files can take 25+ minutes to process — give the upstream
// service plenty of room instead of letting Node's fetch default timeout cut
// it short, and let this route run long if the host platform respects it.
export const maxDuration = 2400;

export async function GET(req: NextRequest) {
  try {
    const source = req.nextUrl.searchParams.get('source') || '';
    const fileName = req.nextUrl.searchParams.get('file_name') || '';
    const params = new URLSearchParams({ source, file_name: fileName });
    const res = await fetch(`${TALLY_BASE}/extract/stock?${params.toString()}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(40 * 60 * 1000), // 40 minutes — large files take a while
    });
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: { 'Content-Type': res.headers.get('content-type') || 'application/json' },
    });
  } catch (err) {
    const isTimeout = err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError');
    const message = isTimeout
      ? 'Stock extraction is taking longer than 40 minutes and timed out. The file may be very large — try again or check with the extraction service.'
      : `Stock extraction failed: ${err instanceof Error ? err.message : String(err)}`;
    console.error('[extract/stock]', err);
    return NextResponse.json({ error: message }, { status: isTimeout ? 504 : 500 });
  }
}
