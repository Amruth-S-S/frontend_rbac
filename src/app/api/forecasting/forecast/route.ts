import { NextRequest } from 'next/server';
import { forecastingGet } from '../forecastingClient';

// GET /api/forecasting/forecast?frequency=weekly|monthly&count=N
//   → GET {FORECASTING_API_BASE_URL}/forecast?...  (operates on the table last loaded via /tables/:table)
export async function GET(req: NextRequest) {
  const qs = new URLSearchParams();
  const sp = req.nextUrl.searchParams;
  for (const key of ['frequency', 'count']) {
    const v = sp.get(key);
    if (v !== null) qs.set(key, v);
  }
  return forecastingGet('/forecast', qs);
}
