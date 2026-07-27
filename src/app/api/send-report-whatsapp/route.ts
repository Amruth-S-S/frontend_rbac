import { NextRequest, NextResponse } from 'next/server';
import { putMedia } from '../whatsapp-media/store';

// Allow requests from any domain (localhost, matga.com, etc.) — mirrors send-report-email.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

// Accepts "+919876543210", "919876543210", "+91 98765 43210", "9876543210", etc.
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
  return digits.length >= 8 ? digits : null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phoneNumber, message, reportType, tableOption, pptBase64 } = body;

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
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const whatsappFrom = process.env.TWILIO_WHATSAPP_FROM; // e.g. "whatsapp:+14155238886"

    if (!accountSid || !authToken || !whatsappFrom) {
      console.error('[send-report-whatsapp] TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN or TWILIO_WHATSAPP_FROM is not set.');
      return NextResponse.json(
        { success: false, message: 'WhatsApp service is not configured on this server. Please contact support.' },
        { status: 503, headers: corsHeaders }
      );
    }

    // --- Stash the PPT so Twilio can fetch it by URL, then build the message text ---
    const pptBuffer = Buffer.from(pptBase64, 'base64');
    const mediaId = putMedia(
      pptBuffer,
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'Data_Analysis_Report.pptx'
    );
    const mediaUrl = `${req.nextUrl.origin}/api/whatsapp-media/${mediaId}`;

    const isComplete = reportType === 'complete';
    const reportLabel = isComplete ? 'Complete Report (Charts + Data)' : 'Charts Only';
    const tableLabel = tableOption === 'all' ? 'All rows included' : 'First 20 rows only';
    const bodyLines = [
      '📊 *Data Analysis Report*',
      '',
      `Report Type: ${reportLabel}`,
      ...(isComplete ? [`Table Data: ${tableLabel}`] : []),
      ...(message ? ['', message] : []),
    ];

    // --- Send via Twilio's WhatsApp API ---
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const form = new URLSearchParams({
      To: `whatsapp:${normalizedTo}`,
      From: whatsappFrom,
      Body: bodyLines.join('\n'),
      MediaUrl: mediaUrl,
    });

    const twilioRes = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
      },
      body: form.toString(),
    });

    const twilioData = await twilioRes.json();

    if (!twilioRes.ok) {
      console.error('[send-report-whatsapp] Twilio error:', twilioData);
      let displayMsg = twilioData.message || `Twilio error ${twilioRes.status}`;
      if (twilioData.code === 21211) displayMsg = 'That WhatsApp number looks invalid. Double-check the country code and digits.';
      else if (twilioData.code === 21608 || twilioData.code === 63007) displayMsg = 'This number has not joined the WhatsApp sandbox yet, or the sender number is misconfigured.';
      else if (twilioData.code === 21610) displayMsg = 'This recipient has opted out of WhatsApp messages from this number.';
      return NextResponse.json(
        { success: false, message: displayMsg, error: twilioData },
        { status: 502, headers: corsHeaders }
      );
    }

    return NextResponse.json(
      { success: true, message: 'WhatsApp message sent successfully', sid: twilioData.sid },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('[send-report-whatsapp] Error:', error);
    const rawMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, message: rawMsg, error: rawMsg },
      { status: 500, headers: corsHeaders }
    );
  }
}
