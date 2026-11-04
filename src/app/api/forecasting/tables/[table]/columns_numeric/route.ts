import { NextRequest } from 'next/server';
import { forecastingGet } from '../../../forecastingClient';

// GET /api/forecasting/tables/:table/columns_numeric → GET {FORECASTING_API_BASE_URL}/tables/{table}/columns_numeric
// Used for the Target column picker — only numeric columns are valid forecast targets.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ table: string }> }) {
  const { table } = await params;
  return forecastingGet(`/tables/${encodeURIComponent(table)}/columns_numeric`);
}
