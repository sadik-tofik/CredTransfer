import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
  tls: {
    rejectUnauthorized: false,
  },
});

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'CredTransfer';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const UNIVERSITY = process.env.NEXT_PUBLIC_UNIVERSITY_NAME || 'Jimma University';

function getEmailWrapper(content: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${APP_NAME}</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background: white; }
    .header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%); color: white; padding: 30px 40px; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; letter-spacing: 2px; }
    .header p { margin: 5px 0 0; opacity: 0.8; font-size: 14px; }
    .content { padding: 40px; }
    .footer { background: #f8f9fa; padding: 20px 40px; text-align: center; font-size: 12px; color: #666; }
    .btn { display: inline-block; background: #0f3460; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
    .info-box { background: #f0f7ff; border-left: 4px solid #0f3460; padding: 15px 20px; margin: 20px 0; border-radius: 4px; }
    .success-badge { background: #d4edda; color: #155724; padding: 8px 16px; border-radius: 20px; display: inline-block; font-weight: bold; }
    .code { font-family: monospace; background: #f8f9fa; border: 1px solid #dee2e6; padding: 10px 15px; border-radius: 4px; font-size: 16px; letter-spacing: 3px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${APP_NAME}</h1>
      <p>${UNIVERSITY}</p>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} ${UNIVERSITY} - ${APP_NAME}</p>
      <p>This is an automated message. Please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>`;
}

export async function sendVerificationEmail(email: string, name: string, token: string): Promise<void> {
  const verifyUrl = `${APP_URL}/api/auth/verify-email?token=${token}`;
  const content = `
    <h2>Welcome to ${APP_NAME}!</h2>
    <p>Dear ${name},</p>
    <p>Thank you for registering with the ${UNIVERSITY} ${APP_NAME} system.
    Please verify your email address to complete your registration.</p>
    <div style="text-align: center;">
      <a href="${verifyUrl}" class="btn">Verify Email Address</a>
    </div>
    <div class="info-box">
      <strong>Note:</strong> This link will expire in 24 hours.
      If you did not create this account, please ignore this email.
    </div>`;

  await transporter.sendMail({
    from: process.env.EMAIL_FROM || `${APP_NAME} <noreply@ju.edu.et>`,
    to: email,
    subject: `Verify your ${APP_NAME} account`,
    html: getEmailWrapper(content),
  });
}

export async function sendPasswordResetEmail(email: string, name: string, token: string): Promise<void> {
  const resetUrl = `${APP_URL}/reset-password?token=${token}`;
  const content = `
    <h2>Password Reset Request</h2>
    <p>Dear ${name},</p>
    <p>We received a request to reset your ${APP_NAME} password.
    Click the button below to set a new password.</p>
    <div style="text-align: center;">
      <a href="${resetUrl}" class="btn">Reset Password</a>
    </div>
    <div class="info-box">
      <strong>Important:</strong> This link will expire in 1 hour.
      If you did not request a password reset, please ignore this email and your password will remain unchanged.
    </div>`;

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: email,
    subject: `Reset your ${APP_NAME} password`,
    html: getEmailWrapper(content),
  });
}

export async function sendPaymentConfirmationEmail(
  email: string,
  name: string,
  reference: string,
  amount: number
): Promise<void> {
  const content = `
    <h2>Payment Confirmed</h2>
    <p>Dear ${name},</p>
    <p>Your payment has been successfully processed for the document transfer service.</p>
    <div class="info-box">
      <p><strong>Payment Reference:</strong> <span class="code">${reference}</span></p>
      <p><strong>Amount:</strong> ${amount.toFixed(2)} ETB</p>
      <p><strong>Status:</strong> <span class="success-badge">✓ CONFIRMED</span></p>
    </div>
    <p>You can now view your transfer details and download your QR code from your dashboard.</p>
    <div style="text-align: center;">
      <a href="${APP_URL}/graduate/transfers" class="btn">View Transfer Details</a>
    </div>`;

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: email,
    subject: `Payment Confirmed - ${APP_NAME}`,
    html: getEmailWrapper(content),
  });
}

export async function sendTransferShareEmail(
  recipientEmail: string,
  recipientInstitution: string,
  graduateName: string,
  documentType: string,
  hashCode: string,
  qrCodeUrl: string  // kept for signature compatibility; we use Google Charts below
): Promise<void> {
  const verifyUrl = `${APP_URL}/verify?code=${hashCode}`;
  // Google Charts generates a plain HTTPS QR image — email clients block data: URLs
  const qrImageUrl = `https://chart.googleapis.com/chart?chs=180x180&cht=qr&chl=${encodeURIComponent(verifyUrl)}&choe=UTF-8`;
  const docLabel  = documentType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  const expiryDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-ET', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  const content = `
    <h2 style="color:#1a1a2e; font-size:22px; margin-bottom:8px;">Academic Credential Verification Request</h2>
    <p style="color:#555; font-size:15px;">Dear Admissions Office — <strong>${recipientInstitution}</strong>,</p>
    <p style="color:#555; font-size:15px; line-height:1.6;">
      <strong>${graduateName}</strong> has authorized the secure transfer of their academic credential
      to your institution through the <strong>${UNIVERSITY} ${APP_NAME}</strong> system.
      This transfer has been reviewed and approved by the ${UNIVERSITY} Registrar's Office.
    </p>

    <div style="background:#f0f7ff; border-left:4px solid #0f3460; padding:20px 24px; margin:24px 0; border-radius:4px;">
      <table style="width:100%; border-collapse:collapse;">
        <tr>
          <td style="color:#888; font-size:13px; padding:4px 0; width:140px;">Graduate Name</td>
          <td style="color:#1a1a2e; font-size:14px; font-weight:600; padding:4px 0;">${graduateName}</td>
        </tr>
        <tr>
          <td style="color:#888; font-size:13px; padding:4px 0;">Document Type</td>
          <td style="color:#1a1a2e; font-size:14px; font-weight:600; padding:4px 0;">${docLabel}</td>
        </tr>
        <tr>
          <td style="color:#888; font-size:13px; padding:4px 0;">Issuing Institution</td>
          <td style="color:#1a1a2e; font-size:14px; font-weight:600; padding:4px 0;">${UNIVERSITY}</td>
        </tr>
        <tr>
          <td style="color:#888; font-size:13px; padding:4px 0;">Valid Until</td>
          <td style="color:#1a1a2e; font-size:14px; font-weight:600; padding:4px 0;">${expiryDate}</td>
        </tr>
      </table>
    </div>

    <p style="color:#333; font-size:14px; font-weight:600; margin-bottom:8px;">Verification Code:</p>
    <div style="text-align:center; margin:16px 0;">
      <span style="font-family:monospace; font-size:28px; font-weight:700; letter-spacing:6px;
                   background:#f8f9fa; border:2px solid #dee2e6; padding:12px 24px;
                   border-radius:8px; color:#0f3460; display:inline-block;">
        ${hashCode}
      </span>
    </div>

    <div style="text-align:center; margin:24px 0;">
      <p style="color:#555; font-size:13px; margin-bottom:12px;">Or scan this QR code to verify instantly:</p>
      <div style="display:inline-block; padding:12px; background:white; border:2px solid #dee2e6; border-radius:8px;">
        <img src="${qrImageUrl}" alt="Verification QR Code" width="180" height="180" style="display:block;" />
      </div>
    </div>

    <div style="text-align:center; margin:28px 0;">
      <a href="${verifyUrl}"
         style="display:inline-block; background:#0f3460; color:white; padding:14px 36px;
                text-decoration:none; border-radius:8px; font-weight:700; font-size:15px;
                letter-spacing:0.5px;">
        Verify &amp; Download Document
      </a>
    </div>

    <div style="background:#fff3cd; border-left:4px solid #ffc107; padding:14px 18px; margin:20px 0; border-radius:4px;">
      <strong style="color:#856404;">How to verify:</strong>
      <ol style="color:#856404; margin:8px 0 0 0; padding-left:18px; font-size:13px; line-height:1.8;">
        <li>Click the button above, or visit <a href="${APP_URL}/verify" style="color:#0f3460;">the verification page</a></li>
        <li>Enter the verification code shown above, or scan the QR code</li>
        <li>View the graduate's details and download the verified document</li>
      </ol>
    </div>

    <div style="background:#d4edda; border-left:4px solid #28a745; padding:14px 18px; border-radius:4px;">
      <strong style="color:#155724;">⛓️ Blockchain-Secured:</strong>
      <span style="color:#155724; font-size:13px;">
        This document's authenticity is cryptographically verified on the
        <strong>zkSync Era</strong> blockchain (Layer-2 on Ethereum).
        The verification link confirms the document was officially issued by ${UNIVERSITY}
        and has not been altered in any way.
      </span>
    </div>`;

  await transporter.sendMail({
    from: `${UNIVERSITY} CredTransfer <${process.env.EMAIL_FROM || process.env.SMTP_USER}>`,
    to: recipientEmail,
    subject: `[CredTransfer] Academic Document — ${graduateName} | ${docLabel}`,
    html: getEmailWrapper(content),
  });
}

// Send notification to graduate when their transfer is approved
export async function sendTransferApprovedEmail(
  graduateEmail: string,
  graduateName: string,
  recipientInstitution: string,
  documentType: string,
  hashCode: string,
  qrCodeUrl: string
): Promise<void> {
  const verifyUrl = `${APP_URL}/verify?code=${hashCode}`;
  const docLabel  = documentType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  const content = `
    <h2>Your Transfer Request Has Been Approved ✅</h2>
    <p>Dear ${graduateName},</p>
    <p>
      The ${UNIVERSITY} Registrar's Office has reviewed and <strong>approved</strong> your
      document transfer request to <strong>${recipientInstitution}</strong>.
    </p>
    <div class="info-box">
      <p><strong>Document:</strong> ${docLabel}</p>
      <p><strong>Sent To:</strong> ${recipientInstitution}</p>
      <p><strong>Your Verification Code:</strong></p>
      <p style="text-align:center"><span class="code">${hashCode}</span></p>
    </div>
    <p>
      The receiving institution has been notified by email with the verification QR code
      and a direct link to download your document.
    </p>
    <p>You can also share this verification link directly:</p>
    <div style="text-align:center; margin:20px 0;">
      <a href="${verifyUrl}" class="btn">View Verification Page</a>
    </div>
    <div class="info-box">
      <strong>Keep your verification code safe.</strong>
      You can use it at any time to check the status of your document
      or share it with additional institutions.
    </div>`;

  await transporter.sendMail({
    from: `${UNIVERSITY} CredTransfer <${process.env.EMAIL_FROM || process.env.SMTP_USER}>`,
    to: graduateEmail,
    subject: `Transfer Approved — Your ${docLabel} has been sent to ${recipientInstitution}`,
    html: getEmailWrapper(content),
  });
}

export async function sendDocumentUploadNotification(
  email: string,
  name: string,
  documentType: string
): Promise<void> {
  const content = `
    <h2>Document Upload Notification</h2>
    <p>Dear ${name},</p>
    <p>Your academic document has been successfully uploaded and its hash registered on the <strong>zkSync Era</strong> blockchain by the ${UNIVERSITY} Registrar's Office.</p>
    <div class="info-box">
      <p><strong>Document Type:</strong> ${documentType.replace('_', ' ').toUpperCase()}</p>
      <p><strong>Status:</strong> <span class="success-badge">✓ VERIFIED ON BLOCKCHAIN</span></p>
    </div>
    <p>You can now share this document with institutions using the graduate portal.</p>
    <div style="text-align: center;">
      <a href="${APP_URL}/graduate/documents" class="btn">View My Documents</a>
    </div>`;

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: email,
    subject: `Document Uploaded - ${APP_NAME}`,
    html: getEmailWrapper(content),
  });
}
