const nodemailer = require('nodemailer');

let transporter;

const createTransporter = async () => {
  if (transporter) return transporter;

  if (!process.env.SMTP_HOST) {
    console.log('No SMTP_HOST found in .env. Creating an ethereal test account for development...');
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    return transporter;
  }

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT || 587,
    secure: process.env.SMTP_PORT == 465, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  
  return transporter;
};

/**
 * Send an email with the given options.
 * @param {Object} options - Mail options
 * @param {string} options.to - Recipient email address
 * @param {string} options.subject - Email subject
 * @param {string} options.text - Email body in plain text
 * @param {string} options.html - Email body in HTML (optional)
 * @returns {Promise<void>}
 */
exports.sendEmail = async (options) => {
  const mailTransporter = await createTransporter();
  
  const fromAddress = process.env.SMTP_USER 
    ? `"MCQPro Admin" <${process.env.SMTP_USER}>` 
    : '"MCQPro Admin" <admin@mcqpro.com>';
  
  const mailOptions = {
    from: fromAddress,
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Message sent: %s', info.messageId);
    console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
  } catch (error) {
    console.error('Error sending email:', error);
    throw new Error('Could not send email.');
  }
};
