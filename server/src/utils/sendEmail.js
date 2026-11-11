/**
 * CareerConnect — Secure Email Dispatcher Utility
 * Supports production SMTP and safe development logging.
 */

export const sendEmail = async ({ to, subject, html, text }) => {
  const hasSmtp = Boolean(
    process.env.SMTP_HOST &&
    process.env.SMTP_HOST.trim() &&
    process.env.SMTP_PORT &&
    process.env.SMTP_USER &&
    process.env.SMTP_USER.trim() &&
    process.env.SMTP_PASS &&
    process.env.SMTP_PASS.trim()
  );

  if (hasSmtp) {
    try {
      const nodemailer = await import('nodemailer');
      const transporter = nodemailer.default.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT),
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      const info = await transporter.sendMail({
        from: process.env.EMAIL_FROM || 'noreply@careerconnect.com',
        to,
        subject,
        text,
        html,
      });

      console.log(`[Email Service] Email sent successfully to ${to} (MessageId: ${info.messageId})`);
      return { success: true, messageId: info.messageId };
    } catch (err) {
      console.error(`[Email Service Error] Failed to send email to ${to}:`, err.message);
      // In production, we log the error but don't crash
      return { success: false, error: err.message };
    }
  }

  // Safe development logging mode (when SMTP is not configured)
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[Email Service Dev Mode] Email to: ${to} | Subject: ${subject}`);
  }

  return { success: true, simulated: true };
};

export const sendVerificationEmail = async ({ email, name, token, origin }) => {
  const clientUrl = origin || process.env.CLIENT_URL || 'http://localhost:5173';
  const verifyUrl = `${clientUrl}/auth?mode=verify&token=${token}`;

  const subject = 'CareerConnect — Please Verify Your Email Address';
  const text = `Hello ${name},\n\nPlease verify your CareerConnect account by clicking the link below:\n${verifyUrl}\n\nThis verification link will expire in 24 hours.\n\nBest regards,\nThe CareerConnect Team`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; rounded: 8px;">
      <h2 style="color: #0f172a;">Welcome to CareerConnect, ${name}!</h2>
      <p style="color: #475569; font-size: 16px;">Please confirm your email address to activate your account and access all platform features.</p>
      <div style="margin: 24px 0;">
        <a href="${verifyUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Verify Email Address</a>
      </div>
      <p style="color: #64748b; font-size: 14px;">Or copy and paste this link into your browser:</p>
      <p style="color: #2563eb; font-size: 13px; word-break: break-all;">${verifyUrl}</p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="color: #94a3b8; font-size: 12px;">This link will expire in 24 hours. If you did not create a CareerConnect account, please ignore this email.</p>
    </div>
  `;

  return await sendEmail({ to: email, subject, text, html });
};

export const sendPasswordResetEmail = async ({ email, name, token, origin }) => {
  const clientUrl = origin || process.env.CLIENT_URL || 'http://localhost:5173';
  const resetUrl = `${clientUrl}/reset-password?token=${token}`;

  const subject = 'CareerConnect — Password Reset Request';
  const text = `Hello ${name || 'User'},\n\nA password reset was requested for your account. Please click the link below to set a new password:\n${resetUrl}\n\nThis link will expire in 10 minutes.\n\nIf you did not request this, please ignore this email.\n\nBest regards,\nThe CareerConnect Team`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; rounded: 8px;">
      <h2 style="color: #0f172a;">Password Reset Request</h2>
      <p style="color: #475569; font-size: 16px;">We received a request to reset your CareerConnect password.</p>
      <div style="margin: 24px 0;">
        <a href="${resetUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Reset Password</a>
      </div>
      <p style="color: #64748b; font-size: 14px;">Or copy and paste this link into your browser:</p>
      <p style="color: #2563eb; font-size: 13px; word-break: break-all;">${resetUrl}</p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="color: #94a3b8; font-size: 12px;">This link will expire in 10 minutes. If you did not request a password reset, no action is needed.</p>
    </div>
  `;

  return await sendEmail({ to: email, subject, text, html });
};
