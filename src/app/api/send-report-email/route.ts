import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

// Allow requests from any domain (localhost, matga.com, etc.)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

/**
 * Build a Gmail transporter.
 * Tries port 587 (STARTTLS) first — works on most servers.
 * If the hosting provider blocks 587, falls back to port 465 (SSL).
 */
function createTransporter() {
  const user = process.env.EMAIL_USER!;
  const pass = process.env.EMAIL_PASSWORD!;

  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,          // false = STARTTLS upgrade on connect
    auth: { user, pass },
    tls: {
      rejectUnauthorized: false, // accept self-signed certs (common on VPS/shared hosting)
    },
    connectionTimeout: 10_000,  // 10 s — avoids hanging forever on blocked ports
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { recipientEmail, subject, message, reportType, tableOption, pptBase64 } = body;

    // --- Validation ---
    if (!recipientEmail || typeof recipientEmail !== 'string') {
      return NextResponse.json(
        { success: false, message: 'Missing or invalid recipientEmail' },
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
    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASSWORD;

    if (!emailUser || !emailPass) {
      console.error('[send-report-email] EMAIL_USER or EMAIL_PASSWORD is not set in environment variables.');
      console.error('For production: ensure .env.production (or server env vars) contains EMAIL_USER and EMAIL_PASSWORD.');
      return NextResponse.json(
        { success: false, message: 'Email service is not configured on this server. Please contact support.' },
        { status: 503, headers: corsHeaders }
      );
    }

    // --- Create transporter & verify connection ---
    const transporter = createTransporter();

    // Verify SMTP connection before trying to send (gives a clear error if port is blocked)
    try {
      await transporter.verify();
    } catch (verifyErr) {
      const msg = verifyErr instanceof Error ? verifyErr.message : String(verifyErr);
      console.error('[send-report-email] SMTP verify failed:', msg);

      // Port 587 may be blocked — try 465 as fallback
      if (msg.includes('ECONNREFUSED') || msg.includes('ETIMEDOUT') || msg.includes('ENOTFOUND')) {
        console.log('[send-report-email] Retrying with port 465 (SSL)...');
        const fallbackTransporter = nodemailer.createTransport({
          host: 'smtp.gmail.com',
          port: 465,
          secure: true,
          auth: { user: emailUser, pass: emailPass },
          tls: { rejectUnauthorized: false },
          connectionTimeout: 10_000,
          greetingTimeout: 10_000,
          socketTimeout: 15_000,
        });
        await fallbackTransporter.verify(); // throws if this also fails
        // Use fallback from here
        const pptBuffer = Buffer.from(pptBase64, 'base64');
        await fallbackTransporter.sendMail(buildMailOptions(emailUser, recipientEmail, subject, message, reportType, tableOption, pptBuffer));
        return NextResponse.json({ success: true, message: 'Email sent successfully' }, { headers: corsHeaders });
      }

      throw verifyErr; // rethrow for the catch block below
    }

    // --- Build & send ---
    const pptBuffer = Buffer.from(pptBase64, 'base64');
    await transporter.sendMail(buildMailOptions(emailUser, recipientEmail, subject, message, reportType, tableOption, pptBuffer));

    return NextResponse.json(
      { success: true, message: 'Email sent successfully' },
      { headers: corsHeaders }
    );

  } catch (error) {
    console.error('[send-report-email] Error:', error);
    const rawMsg = error instanceof Error ? error.message : String(error);

    let displayMsg = rawMsg;
    if (rawMsg.includes('Invalid login') || rawMsg.includes('Username and Password not accepted')) {
      displayMsg = 'Gmail authentication failed. Make sure EMAIL_PASSWORD is a Gmail App Password (not your regular password). Go to myaccount.google.com/apppasswords to generate one.';
    } else if (rawMsg.includes('ECONNREFUSED') || rawMsg.includes('ETIMEDOUT') || rawMsg.includes('ENOTFOUND')) {
      displayMsg = 'Cannot connect to Gmail SMTP (ports 587 and 465 are blocked by your hosting provider). Contact your host to allow outbound SMTP, or use a transactional email service like SendGrid or Resend.';
    } else if (rawMsg.includes('OverQuota') || rawMsg.includes('out of storage')) {
      displayMsg = "The recipient's inbox is full. Please try a different email address.";
    } else if (rawMsg.includes('Invalid address')) {
      displayMsg = 'The recipient email address is invalid. Please check and try again.';
    }

    return NextResponse.json(
      { success: false, message: displayMsg, error: rawMsg },
      { status: 500, headers: corsHeaders }
    );
  }
}

function buildMailOptions(
  from: string,
  to: string,
  subject: string,
  message: string,
  reportType: string,
  tableOption: string,
  pptBuffer: Buffer,
) {
  const isComplete = reportType === 'complete';
  const reportLabel = isComplete ? 'Complete Report (Charts + Data)' : 'Charts Only';
  const tableLabel = tableOption === 'all' ? 'All rows included' : 'First 20 rows only';

  return {
    from: `"Analytics Team" <${from}>`,
    to,
    subject: subject || 'Your Data Analysis Report',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #2f3542;">
        <div style="background: #2B579A; padding: 24px; border-radius: 8px 8px 0 0;">
          <h2 style="color: #ffffff; margin: 0; font-size: 22px;">📊 Data Analysis Report</h2>
        </div>
        <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
          <p>Dear Recipient,</p>
          <p>Please find your data analysis report attached to this email.</p>
          <div style="background-color: #f3f4f6; padding: 16px; border-radius: 6px; margin: 16px 0;">
            <p style="margin: 0 0 8px 0;"><strong>Report Type:</strong> ${reportLabel}</p>
            ${isComplete ? `<p style="margin: 0;"><strong>Table Data:</strong> ${tableLabel}</p>` : ''}
          </div>
          ${message
            ? `<div style="margin: 16px 0; padding: 16px; background-color: #eff6ff; border-left: 4px solid #3b82f6; border-radius: 4px;">
                <p style="margin: 0;">${message}</p>
              </div>`
            : ''}
          <p style="color: #6b7280; font-size: 13px;"><strong>Generated on:</strong> ${new Date().toLocaleString()}</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;" />
          <p style="margin: 0;">Best regards,<br /><strong>Your Analytics Team</strong></p>
        </div>
      </div>
    `,
    attachments: [
      {
        filename: 'Data_Analysis_Report.pptx',
        content: pptBuffer,
        contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      },
    ],
  };
}
