import { NextRequest, NextResponse } from 'next/server';

const KPI_BASE = process.env.KPI_PIPELINE_BASE_URL || 'https://obeyable-celina-provisorily.ngrok-free.dev';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const db_id = searchParams.get('db_id');
  try {
    const res = await fetch(`${KPI_BASE}/api/saved-kpi/?db_id=${db_id}`, {
      headers: { 'ngrok-skip-browser-warning': 'true' },
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch saved KPI' }, { status: 500 });
  }
}
