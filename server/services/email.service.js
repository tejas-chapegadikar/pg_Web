const nodemailer = require('nodemailer');

const createTransport = () => {
  if (
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS
  ) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  // Fallback for development/testing: log to console
  return {
    sendMail: async (mailOptions) => {
      console.log('--- EMAIL OUTBOX (MOCK) ---');
      console.log(`To: ${mailOptions.to}`);
      console.log(`Subject: ${mailOptions.subject}`);
      console.log(`Body (Text):\n${mailOptions.text}`);
      console.log(`Body (HTML):\n${mailOptions.html}`);
      console.log('---------------------------');
      return { messageId: 'mock-id-' + Date.now() };
    },
  };
};

const sendEmail = async (options) => {
  const transporter = createTransport();

  const mailOptions = {
    from: process.env.EMAIL_FROM || 'Anei Ghar <no-reply@aneighar.com>',
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    return info;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
};

/**
 * Send an email to the owner notifying them of a new inquiry.
 */
exports.sendInquiryNotification = async ({
  ownerEmail,
  ownerName,
  studentName,
  studentPhone,
  pgTitle,
  message,
  visitDate,
}) => {
  const subject = `New Inquiry for your PG: ${pgTitle}`;
  // Stored as a calendar day at UTC midnight, so format in UTC to keep the same day
  const visitLabel = visitDate
    ? new Date(visitDate).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
    : null;
  const text = `Hi ${ownerName || 'Owner'},\n\nYou have received a new inquiry for your listing "${pgTitle}" on Anei Ghar.\n\nDetails:\n- Student Name: ${studentName}\n- Contact Number: ${studentPhone}\n- Message: "${message}"\n${visitLabel ? `- Preferred visit: ${visitLabel}\n` : ''}\nPlease log in to your dashboard to view and manage your inquiries.\n\nBest,\nThe Anei Ghar Team`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
      <h2 style="color: #6d28d9;">New Inquiry Received!</h2>
      <p>Hi ${ownerName || 'Owner'},</p>
      <p>You have received a new inquiry for your PG listing <strong>"${pgTitle}"</strong> on Anei Ghar.</p>
      <div style="background-color: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #333;">Inquiry Details</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 5px 0; color: #666; width: 120px;"><strong>Student:</strong></td>
            <td style="padding: 5px 0; color: #333;">${studentName}</td>
          </tr>
          <tr>
            <td style="padding: 5px 0; color: #666;"><strong>Phone:</strong></td>
            <td style="padding: 5px 0; color: #333;"><a href="tel:${studentPhone}">${studentPhone}</a></td>
          </tr>
          <tr>
            <td style="padding: 5px 0; color: #666; vertical-align: top;"><strong>Message:</strong></td>
            <td style="padding: 5px 0; color: #333; font-style: italic;">"${message}"</td>
          </tr>${visitLabel ? `
          <tr>
            <td style="padding: 5px 0; color: #666;"><strong>Visit:</strong></td>
            <td style="padding: 5px 0; color: #333;">${visitLabel}</td>
          </tr>` : ''}
        </table>
      </div>
      <p>Please log in to your dashboard to manage this inquiry and update its status.</p>
      <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/dashboard" style="display: inline-block; background-color: #6d28d9; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold; margin-top: 10px;">Go to Dashboard</a>
      <hr style="border: none; border-top: 1px solid #eee; margin-top: 30px;" />
      <p style="font-size: 12px; color: #999; text-align: center;">This is an automated notification from Anei Ghar.</p>
    </div>
  `;

  return sendEmail({ to: ownerEmail, subject, text, html });
};

/**
 * Send a password reset email.
 */
exports.sendPasswordResetEmail = async ({ to, name, resetUrl }) => {
  const subject = 'Reset your Anei Ghar Password';
  const text = `Hi ${name || 'User'},\n\nYou requested a password reset. Please click on the link below (or copy and paste it into your browser) to reset your password:\n\n${resetUrl}\n\nThis link is valid for 1 hour.\n\nIf you did not request this, please ignore this email and your password will remain unchanged.\n\nBest,\nThe Anei Ghar Team`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
      <h2 style="color: #6d28d9;">Reset Your Password</h2>
      <p>Hi ${name || 'User'},</p>
      <p>We received a request to reset your password for your Anei Ghar account. Click the button below to choose a new password:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${resetUrl}" style="display: inline-block; background-color: #6d28d9; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Reset Password</a>
      </div>
      <p>Or copy and paste this link into your browser:</p>
      <p style="word-break: break-all; color: #6d28d9;"><a href="${resetUrl}">${resetUrl}</a></p>
      <p style="font-size: 13px; color: #666;">This link is valid for <strong>1 hour</strong>.</p>
      <p style="font-size: 13px; color: #666;">If you did not request a password reset, no further action is required; your account is safe.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin-top: 30px;" />
      <p style="font-size: 12px; color: #999; text-align: center;">This is an automated email from Anei Ghar.</p>
    </div>
  `;

  return sendEmail({ to, subject, text, html });
};
