import { NextRequest, NextResponse } from 'next/server';

const TALLY_BASE = process.env.NEXT_PUBLIC_TALLY_API_BASE_URL || '';

// Poll this after submitting any /api/tally/extract/* job.
// Returns { status: "running" | "done" | "error", result, error }.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  try {
    const res = await fetch(`${TALLY_BASE}/jobs/${encodeURIComponent(jobId)}`, {
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
      ? 'Job status check timed out — the extraction service may be unavailable.'
      : `Job status check failed: ${err instanceof Error ? err.message : String(err)}`;
    console.error('[jobs/[jobId]]', err);
    return NextResponse.json({ error: message }, { status: isTimeout ? 504 : 500 });
  }
}
