import { NextRequest, NextResponse } from 'next/server';

const TALLY_BASE = process.env.NEXT_PUBLIC_TALLY_API_BASE_URL || '';

// The backend starts extraction in the background and responds immediately
// with { job_id, status: "running", ... } — poll /api/tally/jobs/[jobId]
// for the result instead of waiting on this request.
export async function GET(req: NextRequest) {
  try {
    const source = req.nextUrl.searchParams.get('source') || '';
    const fileName = req.nextUrl.searchParams.get('file_name') || '';
    const params = new URLSearchParams({ source, file_name: fileName });
    const res = await fetch(`${TALLY_BASE}/extract/bills?${params.toString()}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(30 * 1000),
    });
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: { 'Content-Type': res.headers.get('content-type') || 'application/json' },
    });
  } catch (err) {
    const isTimeout = err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError');
    const message = isTimeout
      ? 'Bills extraction did not start in time — the extraction service may be unavailable.'
      : `Bills extraction failed: ${err instanceof Error ? err.message : String(err)}`;
    console.error('[extract/bills]', err);
    return NextResponse.json({ error: message }, { status: isTimeout ? 504 : 500 });
  }
}
