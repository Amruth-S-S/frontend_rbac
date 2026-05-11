import { NextRequest, NextResponse } from 'next/server';

const KPI_BASE = process.env.KPI_PIPELINE_BASE_URL || 'https://obeyable-celina-provisorily.ngrok-free.dev';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const job_id = searchParams.get('job_id');
  try {
    const res = await fetch(`${KPI_BASE}/api/kpis/?job_id=${job_id}`, {
      headers: { 'ngrok-skip-browser-warning': 'true' },
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch KPIs' }, { status: 500 });
  }
}
