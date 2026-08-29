import { NextRequest } from 'next/server';
import { forecastingGet } from '../../forecastingClient';

// GET /api/forecasting/tables/:table?filter_column=&filter_value=&selected_columns=
//   → GET {FORECASTING_API_BASE_URL}/tables/{table}?...
export async function GET(req: NextRequest, { params }: { params: Promise<{ table: string }> }) {
  const { table } = await params;
  const qs = new URLSearchParams();
  const sp = req.nextUrl.searchParams;
  for (const key of ['filter_column', 'filter_value', 'selected_columns']) {
    const v = sp.get(key);
    if (v !== null) qs.set(key, v);
  }
  return forecastingGet(`/tables/${encodeURIComponent(table)}`, qs);
}
