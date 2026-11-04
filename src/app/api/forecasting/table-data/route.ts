import { NextRequest } from 'next/server';
import { forecastingGet } from '../forecastingClient';

// GET /api/forecasting/table-data?table_name=&page=&page_size=
//   → GET {FORECASTING_API_BASE_URL}/table-data/?table_name=&page=&page_size=
export async function GET(req: NextRequest) {
  const qs = new URLSearchParams();
  const sp = req.nextUrl.searchParams;
  for (const key of ['table_name', 'page', 'page_size']) {
    const v = sp.get(key);
    if (v !== null) qs.set(key, v);
  }
  return forecastingGet('/table-data/', qs);
}
