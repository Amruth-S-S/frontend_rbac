import { NextRequest } from 'next/server';
import { forecastingGet } from '../forecastingClient';

// GET /api/forecasting/tables → GET {FORECASTING_API_BASE_URL}/tables
export async function GET(_req: NextRequest) {
  return forecastingGet('/tables');
}
