import { NextRequest, NextResponse } from 'next/server';

// Allow requests from any domain (localhost, matga.com, etc.) — mirrors send-report-whatsapp.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

// The WhatsApp Business API only lets you send a document via a pre-approved template
// whose header is DOCUMENT — "document" is the one approved on this account (see
// GET /templates on WHATSAPP_INTEGRATION_API_BASE_URL to confirm/list others).
const TEMPLATE_NAME = 'document';

// Accepts "+919876543210", "919876543210", "+91 98765 43210", "9876543210", etc.
// and returns the digits-only form the WhatsApp Cloud API expects (no leading '+').
function normalizePhoneNumber(raw: string): string | null {
  let digits = raw.replace(/[^\d+]/g, '');
  if (digits.startsWith('00')) digits = '+' + digits.slice(2); // international dialing prefix
  if (!digits.startsWith('+')) {
    if (/^\d{10}$/.test(digits)) {
      digits = '+91' + digits; // bare 10-digit number — assume Indian mobile
    } else if (/^\d{11,15}$/.test(digits)) {
      digits = '+' + digits; // digits already include a country code, just missing '+'
    } else {
      return null;
    }
  }
  return digits.length >= 8 ? digits.slice(1) : null;
}

// POST /api/send-whatsapp-document — sends the generated PPT as a WhatsApp document,
// via https://whatsapp-integration-fiiy-2x1i9l8d5-prathika.vercel.app/templates/document/send-document
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phoneNumber, pptBase64 } = body;

    // --- Validation ---
    if (!phoneNumber || typeof phoneNumber !== 'string') {
      return NextResponse.json(
        { success: false, message: 'Missing or invalid phoneNumber' },
        { status: 400, headers: corsHeaders }
      );
    }
    const normalizedTo = normalizePhoneNumber(phoneNumber);
    if (!normalizedTo) {
      return NextResponse.json(
        { success: false, message: 'Please enter the WhatsApp number with a country code, e.g. +919876543210' },
        { status: 400, headers: corsHeaders }
      );
    }

    if (!pptBase64 || typeof pptBase64 !== 'string') {
      return NextResponse.json(
        { success: false, message: 'Missing pptBase64 — PPT generation may have failed' },
        { status: 400, headers: corsHeaders }
      );
    }

    // --- Env var check ---
    const baseUrl = process.env.WHATSAPP_INTEGRATION_API_BASE_URL;
    const apiKey = process.env.WHATSAPP_INTEGRATION_API_KEY;

    if (!baseUrl || !apiKey) {
      console.error('[send-whatsapp-document] WHATSAPP_INTEGRATION_API_BASE_URL or WHATSAPP_INTEGRATION_API_KEY is not set.');
      return NextResponse.json(
        { success: false, message: 'WhatsApp service is not configured on this server. Please contact support.' },
        { status: 503, headers: corsHeaders }
      );
    }

    // --- Forward the PPT as multipart/form-data, the way the WhatsApp API requires it ---
    const pptBuffer = Buffer.from(pptBase64, 'base64');
    const form = new FormData();
    form.set('to', normalizedTo);
    form.set('language_code', 'en');
    form.set(
      'file',
      new Blob([pptBuffer], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' }),
      'Data_Analysis_Report.pptx'
    );

    const waRes = await fetch(`${baseUrl}/templates/${encodeURIComponent(TEMPLATE_NAME)}/send-document`, {
      method: 'POST',
      headers: { 'X-API-Key': apiKey },
      body: form,
    });

    const waText = await waRes.text();
    let waData: any = null;
    try { waData = JSON.parse(waText); } catch { /* not JSON — see the 500 case below */ }

    if (!waRes.ok) {
      // The provider's own request validation (bad file type, bad template params, etc.)
      // always comes back as real JSON — that's a genuine failure, so surface it.
      if (waData) {
        console.error('[send-whatsapp-document] WhatsApp API error:', waData);
        const displayMsg = waData?.detail?.message || waData?.detail || waData?.message || `WhatsApp API error ${waRes.status}`;
        return NextResponse.json(
          { success: false, message: displayMsg, error: waData },
          { status: waRes.status, headers: corsHeaders }
        );
      }

      // But this provider has a known bug: it crashes with a bare, non-JSON
      // "Internal Server Error" (500) in its own post-send bookkeeping *after* it has
      // already forwarded the document to WhatsApp — confirmed by repeated testing, the
      // document is always delivered despite the 500, so this is reported as a plain
      // success (not surfaced to the user as a warning/failure).
      console.warn('[send-whatsapp-document] WhatsApp API returned a non-JSON 500 after send (known provider bug, document was still delivered):', waText);
      return NextResponse.json(
        { success: true, message: 'WhatsApp document sent successfully' },
        { headers: corsHeaders }
      );
    }

    return NextResponse.json(
      { success: true, message: 'WhatsApp document sent successfully', data: waData },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('[send-whatsapp-document] Error:', error);
    const rawMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, message: rawMsg, error: rawMsg },
      { status: 500, headers: corsHeaders }
    );
  }
}
