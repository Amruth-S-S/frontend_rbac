import { NextRequest, NextResponse } from 'next/server';

const KPI_BASE = process.env.KPI_PIPELINE_BASE_URL || 'https://obeyable-celina-provisorily.ngrok-free.dev';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const job_id = searchParams.get('job_id');
  try {
    const res = await fetch(`${KPI_BASE}/api/download/?job_id=${job_id}`, {
      headers: { 'ngrok-skip-browser-warning': 'true' },
    });
    const blob = await res.blob();
    const contentType = res.headers.get('content-type') || 'application/octet-stream';
    const contentDisposition =
      res.headers.get('content-disposition') || `attachment; filename="kpi_results_${job_id}.xlsx"`;
    return new NextResponse(blob, {
      status: res.status,
      headers: { 'Content-Type': contentType, 'Content-Disposition': contentDisposition },
    });
  } catch (err) {
    return NextResponse.json({ error: 'Download failed' }, { status: 500 });
  }
}
