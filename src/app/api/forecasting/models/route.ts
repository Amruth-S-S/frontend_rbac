import { NextRequest } from 'next/server';
import { forecastingGet } from '../forecastingClient';

// GET /api/forecasting/models → GET {FORECASTING_API_BASE_URL}/models
export async function GET(_req: NextRequest) {
  return forecastingGet('/models');
}
