import { NextRequest } from 'next/server';
import { forecastingGet } from '../../../../../forecastingClient';

// GET /api/forecasting/tables/:table/columns/:column/values
//   → GET {FORECASTING_API_BASE_URL}/tables/{table}/columns/{column}/values
export async function GET(_req: NextRequest, { params }: { params: Promise<{ table: string; column: string }> }) {
  const { table, column } = await params;
  return forecastingGet(`/tables/${encodeURIComponent(table)}/columns/${encodeURIComponent(column)}/values`);
}
