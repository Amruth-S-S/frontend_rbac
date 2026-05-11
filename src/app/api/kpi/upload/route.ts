import { NextRequest, NextResponse } from 'next/server';

const KPI_BASE = process.env.KPI_PIPELINE_BASE_URL || 'https://obeyable-celina-provisorily.ngrok-free.dev';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const res = await fetch(`${KPI_BASE}/api/upload/`, {
      method: 'POST',
      headers: { 'ngrok-skip-browser-warning': 'true' },
      body: formData,
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
