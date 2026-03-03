// server/src/utils/emailService.ts
import nodemailer from 'nodemailer';
import { env } from '../config/env';

function createTransporter() {
  if (!env.SMTP_USER || !env.SMTP_PASS) {
    throw new Error('SMTP_USER and SMTP_PASS must be set to send emails.');
  }

  return nodemailer.createTransport({
    host: env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(env.SMTP_PORT) || 587,
    secure: Number(env.SMTP_PORT) === 465, // true for 465, false for 587
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });
}

/**
 * Send a password-reset email with a clickable link.
 */
export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  const transporter = createTransporter();

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: 'Outfit', Arial, sans-serif; background: #0f0f10; color: #e4e4e7; margin: 0; padding: 0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background: #0f0f10; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background: #1a1a1d; border-radius: 16px; border: 1px solid #2e2e35; overflow: hidden;">
          <tr>
            <td style="padding: 32px 40px 24px; border-bottom: 1px solid #2e2e35;">
              <span style="font-size: 20px; font-weight: 700; color: #e8b844;">VibeHired</span>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 40px;">
              <h2 style="margin: 0 0 12px; font-size: 22px; font-weight: 600; color: #f4f4f5;">Reset your password</h2>
              <p style="margin: 0 0 24px; font-size: 15px; color: #a1a1aa; line-height: 1.6;">
                We received a request to reset the password for your VibeHired account associated with this email address.
                Click the button below to choose a new password. This link expires in <strong style="color:#e4e4e7;">1 hour</strong>.
              </p>
              <a href="${resetUrl}"
                 style="display: inline-block; padding: 12px 28px; background: #e8b844; color: #0f0f10; border-radius: 8px; font-weight: 600; font-size: 15px; text-decoration: none;">
                Reset Password
              </a>
              <p style="margin: 28px 0 0; font-size: 13px; color: #71717a; line-height: 1.6;">
                If the button doesn't work, copy and paste this link into your browser:<br/>
                <a href="${resetUrl}" style="color: #e8b844; word-break: break-all;">${resetUrl}</a>
              </p>
              <p style="margin: 20px 0 0; font-size: 13px; color: #71717a;">
                If you didn't request a password reset, you can safely ignore this email.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 40px; border-top: 1px solid #2e2e35; font-size: 12px; color: #52525b;">
              &copy; ${new Date().getFullYear()} VibeHired. All rights reserved.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  await transporter.sendMail({
    from: `"VibeHired" <${env.SMTP_USER}>`,
    to,
    subject: 'Reset your VibeHired password',
    html,
    text: `Reset your VibeHired password\n\nClick the link below (expires in 1 hour):\n${resetUrl}\n\nIf you didn't request this, ignore this email.`,
  });
}

/**
 * Send an email verification email with a clickable link.
 */
export async function sendVerificationEmail(to: string, verificationUrl: string): Promise<void> {
  const transporter = createTransporter();

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: 'Outfit', Arial, sans-serif; background: #0f0f10; color: #e4e4e7; margin: 0; padding: 0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background: #0f0f10; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background: #1a1a1d; border-radius: 16px; border: 1px solid #2e2e35; overflow: hidden;">
          <tr>
            <td style="padding: 32px 40px 24px; border-bottom: 1px solid #2e2e35;">
              <span style="font-size: 20px; font-weight: 700; color: #e8b844;">VibeHired</span>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 40px;">
              <h2 style="margin: 0 0 12px; font-size: 22px; font-weight: 600; color: #f4f4f5;">Verify your email</h2>
              <p style="margin: 0 0 24px; font-size: 15px; color: #a1a1aa; line-height: 1.6;">
                Welcome to VibeHired! To unlock all AI-powered features, please verify your email address by clicking the button below.
                This link expires in <strong style="color:#e4e4e7;">24 hours</strong>.
              </p>
              <a href="${verificationUrl}"
                 style="display: inline-block; padding: 12px 28px; background: #e8b844; color: #0f0f10; border-radius: 8px; font-weight: 600; font-size: 15px; text-decoration: none;">
                Verify Email
              </a>
              <p style="margin: 28px 0 0; font-size: 13px; color: #71717a; line-height: 1.6;">
                If the button doesn't work, copy and paste this link into your browser:<br/>
                <a href="${verificationUrl}" style="color: #e8b844; word-break: break-all;">${verificationUrl}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 40px; border-top: 1px solid #2e2e35; font-size: 12px; color: #52525b;">
              &copy; ${new Date().getFullYear()} VibeHired. All rights reserved.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  await transporter.sendMail({
    from: `"VibeHired" <${env.SMTP_USER}>`,
    to,
    subject: 'Verify your VibeHired email',
    html,
    text: `Verify your VibeHired email\n\nClick the link below (expires in 24 hours):\n${verificationUrl}\n\nWelcome to the future of job hunting!`,
  });
}
