import { NextRequest } from 'next/server';
import { forecastingGet } from '../forecastingClient';

// GET /api/forecasting/get_algorithms → GET {FORECASTING_API_BASE_URL}/get_algorithms
export async function GET(_req: NextRequest) {
  return forecastingGet('/get_algorithms');
}
