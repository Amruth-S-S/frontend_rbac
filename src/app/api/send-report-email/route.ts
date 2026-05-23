import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

// CORS headers — allow requests from any domain (localhost, matga.com, germany.gubsiness.ai, etc.)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
};

// Handle OPTIONS preflight requests (required for cross-origin POST with JSON body)
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { recipientEmail, subject, message, reportType, tableOption, pptBase64 } = body;

    // --- Input validation ---
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

    // --- Check env vars ---
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      console.error('EMAIL_USER or EMAIL_PASSWORD environment variables are not set');
      return NextResponse.json(
        { success: false, message: 'Email service is not configured on this server. Please contact support.' },
        { status: 503, headers: corsHeaders }
      );
    }

    // --- Create Gmail transporter ---
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD, // Use a Gmail App Password, not your regular password
      },
    });

    // --- Build PPT attachment from base64 ---
    const pptBuffer = Buffer.from(pptBase64, 'base64');

    // --- Build email ---
    const isComplete = reportType === 'complete';
    const reportLabel = isComplete ? 'Complete Report (Charts + Data)' : 'Charts Only';
    const tableLabel = tableOption === 'all' ? 'All rows included' : 'First 20 rows only';

    const mailOptions = {
      from: `"Analytics Team" <${process.env.EMAIL_USER}>`,
      to: recipientEmail,
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
              : ''
            }

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

    // --- Send ---
    await transporter.sendMail(mailOptions);

    return NextResponse.json(
      { success: true, message: 'Email sent successfully' },
      { headers: corsHeaders }
    );

  } catch (error) {
    console.error('Error sending email:', error);

    const rawMsg = error instanceof Error ? error.message : String(error);

    // User-friendly error messages for common Gmail failures
    let displayMsg = rawMsg;
    if (rawMsg.includes('Invalid login') || rawMsg.includes('Username and Password not accepted')) {
      displayMsg = 'Gmail authentication failed. Make sure EMAIL_PASSWORD is a valid Gmail App Password (not your regular password). Enable 2FA and generate an App Password at myaccount.google.com/apppasswords.';
    } else if (rawMsg.includes('ECONNREFUSED') || rawMsg.includes('ETIMEDOUT')) {
      displayMsg = 'Cannot connect to Gmail SMTP. Check your server network/firewall settings.';
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
