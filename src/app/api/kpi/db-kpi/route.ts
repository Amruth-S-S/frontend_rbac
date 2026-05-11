import { NextRequest, NextResponse } from 'next/server';

const KPI_BASE = process.env.KPI_PIPELINE_BASE_URL || 'https://obeyable-celina-provisorily.ngrok-free.dev';

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const table_name = searchParams.get('table_name');
  try {
    const res = await fetch(`${KPI_BASE}/api/db-kpi/?table_name=${table_name}`, {
      method: 'POST',
      headers: { 'ngrok-skip-browser-warning': 'true' },
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json({ error: 'DB KPI generation failed' }, { status: 500 });
  }
}
