import nodemailer from 'nodemailer';
import prisma from '../lib/prisma';


const SMTP_KEYS = [
  'smtp_host',
  'smtp_port',
  'smtp_user',
  'smtp_pass',
  'smtp_from_email',
  'smtp_from_name',
  'smtp_secure',
] as const;

type SmtpConfig = Record<typeof SMTP_KEYS[number], string>;

async function getSmtpConfig(): Promise<SmtpConfig> {
  const settings = await prisma.platformSetting.findMany({
    where: { key: { in: [...SMTP_KEYS] } },
  });

  const map = {} as SmtpConfig;
  for (const setting of settings) {
    (map as any)[setting.key] = setting.value;
  }

  return map;
}

export async function isSmtpConfigured(): Promise<boolean> {
  const config = await getSmtpConfig();
  return !!(
    config.smtp_host &&
    config.smtp_port &&
    config.smtp_user &&
    config.smtp_pass
  );
}

export async function sendVerificationEmail(
  toEmail: string,
  toName: string,
  verificationToken: string
): Promise<void> {
  const config = await getSmtpConfig();

  const transporter = nodemailer.createTransport({
    host: config.smtp_host,
    port: parseInt(config.smtp_port, 10),
    secure: config.smtp_secure === 'true',
    auth: {
      user: config.smtp_user,
      pass: config.smtp_pass,
    },
  });

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const verifyUrl = `${frontendUrl}/verify-email?token=${verificationToken}`;

  const fromName = config.smtp_from_name || 'WorkshopMu';
  const fromEmail = config.smtp_from_email || config.smtp_user;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verify Your Email</title>
    </head>
    <body style="font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 20px;">
      <div style="max-width: 480px; margin: 0 auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <div style="background: #2563eb; padding: 32px 32px 24px; text-align: center;">
          <h1 style="color: #fff; margin: 0; font-size: 24px;">WorkshopMu</h1>
        </div>
        <div style="padding: 32px;">
          <h2 style="color: #1f2937; margin-top: 0;">Verify Your Email Address</h2>
          <p style="color: #6b7280;">Hi ${toName},</p>
          <p style="color: #6b7280;">Thank you for registering. Please click the button below to verify your email address and activate your account.</p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${verifyUrl}"
               style="background: #2563eb; color: #fff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: bold; font-size: 16px; display: inline-block;">
              Verify Email Address
            </a>
          </div>
          <p style="color: #9ca3af; font-size: 13px;">This link expires in 24 hours.</p>
          <p style="color: #9ca3af; font-size: 12px;">If you did not create an account, you can safely ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
          <p style="color: #d1d5db; font-size: 11px;">
            If the button doesn't work, copy and paste this URL into your browser:<br>
            <a href="${verifyUrl}" style="color: #2563eb; word-break: break-all;">${verifyUrl}</a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  await transporter.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to: toEmail,
    subject: 'Konfirmasi email Anda - WorkshopMu',
    html,
  });
}

export async function sendTestEmail(toEmail: string): Promise<void> {
  const config = await getSmtpConfig();

  const transporter = nodemailer.createTransport({
    host: config.smtp_host,
    port: parseInt(config.smtp_port, 10),
    secure: config.smtp_secure === 'true',
    auth: {
      user: config.smtp_user,
      pass: config.smtp_pass,
    },
  });

  const fromName = config.smtp_from_name || 'WorkshopMu';
  const fromEmail = config.smtp_from_email || config.smtp_user;

  await transporter.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to: toEmail,
    subject: 'SMTP Test - WorkshopMu',
    html: `
      <div style="font-family: Arial, sans-serif; padding: 32px; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #2563eb;">SMTP Configuration Test</h2>
        <p>Your SMTP configuration is working correctly.</p>
        <p style="color: #6b7280; font-size: 13px;">Sent at: ${new Date().toISOString()}</p>
      </div>
    `,
  });
}
