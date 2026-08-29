import { NextResponse } from 'next/server';

const BASE = process.env.FORECASTING_API_BASE_URL || '';
const API_KEY = process.env.FORECASTING_API_KEY || '';

/**
 * Proxies a GET request to the Sales Forecasting API (forecasting-api.vercel.app).
 * The API has no CORS support and requires an X-API-Key header, so every call has
 * to go through these server-side routes rather than straight from the browser.
 */
export async function forecastingGet(path: string, searchParams?: URLSearchParams) {
  try {
    const qs = searchParams && searchParams.toString() ? `?${searchParams.toString()}` : '';
    const res = await fetch(`${BASE}${path}${qs}`, {
      headers: { Accept: 'application/json', 'X-API-Key': API_KEY },
      cache: 'no-store',
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json({ detail: 'Failed to reach the forecasting API.' }, { status: 502 });
  }
}
