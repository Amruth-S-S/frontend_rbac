import { NextRequest, NextResponse } from 'next/server';

const TALLY_BASE = process.env.NEXT_PUBLIC_TALLY_API_BASE_URL || '';

export async function GET(req: NextRequest) {
  try {
    const source = req.nextUrl.searchParams.get('source') || '';
    const fileName = req.nextUrl.searchParams.get('file_name') || '';
    const params = new URLSearchParams({ source, file_name: fileName });
    const res = await fetch(`${TALLY_BASE}/extract/ledger?${params.toString()}`, { headers: { Accept: 'application/json' } });
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: { 'Content-Type': res.headers.get('content-type') || 'application/json' },
    });
  } catch (err) {
    return NextResponse.json({ error: 'Ledger extraction failed' }, { status: 500 });
  }
}
