import { NextResponse } from 'next/server';

const KPI_BASE = process.env.KPI_PIPELINE_BASE_URL || 'https://obeyable-celina-provisorily.ngrok-free.dev';

export async function GET() {
  try {
    const res = await fetch(`${KPI_BASE}/api/tables/`, {
      headers: { 'ngrok-skip-browser-warning': 'true' },
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to list tables' }, { status: 500 });
  }
}
