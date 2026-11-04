import { NextRequest } from 'next/server';
import { forecastingPost } from '../forecastingClient';

// POST /api/forecasting/save_actual_forecast?save_mode=all|single&table_name=&model_name=
//   → POST {FORECASTING_API_BASE_URL}/save_actual_forecast?...
export async function POST(req: NextRequest) {
  const qs = new URLSearchParams();
  const sp = req.nextUrl.searchParams;
  for (const key of ['save_mode', 'table_name', 'model_name']) {
    const v = sp.get(key);
    if (v !== null && v !== '') qs.set(key, v);
  }
  return forecastingPost('/save_actual_forecast', qs);
}
