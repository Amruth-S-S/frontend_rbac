import { NextRequest } from 'next/server';
import { forecastingGet } from '../forecastingClient';

// GET /api/forecasting/model-diagnostics?frequency=weekly|monthly&test_size=&n_windows=
//   → GET {FORECASTING_API_BASE_URL}/model-diagnostics?...
export async function GET(req: NextRequest) {
  const qs = new URLSearchParams();
  const sp = req.nextUrl.searchParams;
  for (const key of ['frequency', 'test_size', 'n_windows']) {
    const v = sp.get(key);
    if (v !== null) qs.set(key, v);
  }
  return forecastingGet('/model-diagnostics', qs);
}
