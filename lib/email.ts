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
  qrCodeUrl: string
): Promise<void> {
  const verifyUrl = `${APP_URL}/verify?code=${hashCode}`;
  const content = `
    <h2>Academic Document Verification</h2>
    <p>Dear ${recipientInstitution},</p>
    <p>${graduateName} has shared an academic document with you through the ${UNIVERSITY} ${APP_NAME} system.</p>
    <div class="info-box">
      <p><strong>Document Type:</strong> ${documentType.replace('_', ' ').toUpperCase()}</p>
      <p><strong>Graduate Name:</strong> ${graduateName}</p>
      <p><strong>Verification Code:</strong></p>
      <p style="text-align:center"><span class="code">${hashCode}</span></p>
    </div>
    <p>To verify this document, you can:</p>
    <ol>
      <li>Visit <a href="${verifyUrl}">${APP_URL}/verify</a> and enter the code above</li>
      <li>Or scan the QR code below</li>
    </ol>
    ${qrCodeUrl ? `<div style="text-align:center"><img src="${qrCodeUrl}" alt="Verification QR Code" style="max-width:200px"/></div>` : ''}
    <div style="text-align: center;">
      <a href="${verifyUrl}" class="btn">Verify Document Now</a>
    </div>
    <div class="info-box">
      <strong>Note:</strong> This document is secured by blockchain technology.
      The verification confirms the document was issued by ${UNIVERSITY} and has not been tampered with.
    </div>`;

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: recipientEmail,
    subject: `Academic Document from ${graduateName} - ${APP_NAME}`,
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
    <p>Your academic document has been successfully uploaded and registered on the blockchain by the ${UNIVERSITY} Registrar's Office.</p>
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
