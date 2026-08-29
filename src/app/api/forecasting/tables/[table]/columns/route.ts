import { NextRequest } from 'next/server';
import { forecastingGet } from '../../../forecastingClient';

// GET /api/forecasting/tables/:table/columns → GET {FORECASTING_API_BASE_URL}/tables/{table}/columns
export async function GET(_req: NextRequest, { params }: { params: Promise<{ table: string }> }) {
  const { table } = await params;
  return forecastingGet(`/tables/${encodeURIComponent(table)}/columns`);
}
