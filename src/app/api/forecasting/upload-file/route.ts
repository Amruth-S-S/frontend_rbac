import { NextRequest, NextResponse } from 'next/server';
import { forecastingPostForm } from '../forecastingClient';

// POST /api/forecasting/upload-file?table_name=... (multipart body: file)
//   → POST {FORECASTING_API_BASE_URL}/upload-file/?table_name=...
export async function POST(req: NextRequest) {
  const tableName = req.nextUrl.searchParams.get('table_name')?.trim();
  if (!tableName) {
    return NextResponse.json({ detail: 'table_name is required.' }, { status: 400 });
  }

  let incomingForm: FormData;
  try {
    incomingForm = await req.formData();
  } catch {
    return NextResponse.json({ detail: 'Expected multipart/form-data with a file.' }, { status: 400 });
  }

  const file = incomingForm.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ detail: 'A file is required.' }, { status: 400 });
  }

  const outgoingForm = new FormData();
  outgoingForm.set('file', file, file.name);

  const qs = new URLSearchParams({ table_name: tableName });
  return forecastingPostForm('/upload-file/', outgoingForm, qs);
}
