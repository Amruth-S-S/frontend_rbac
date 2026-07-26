import { NextRequest, NextResponse } from 'next/server';

const TALLY_BASE = process.env.NEXT_PUBLIC_TALLY_API_BASE_URL || '';

export async function GET(req: NextRequest) {
  try {
    const prefix = req.nextUrl.searchParams.get('prefix') || '';
    const url = prefix ? `${TALLY_BASE}/files?prefix=${encodeURIComponent(prefix)}` : `${TALLY_BASE}/files`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to list files' }, { status: 500 });
  }
}
