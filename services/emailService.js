// ...existing code...
const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    // Verify transporter configuration
    this.verifyConnection();
  }

  async verifyConnection() {
    try {
      await this.transporter.verify();
      logger.info('Email transporter verified successfully');
    } catch (error) {
      logger.error('Email transporter verification failed:', error);
    }
  }

  async sendEmail({ to, subject, html, text }) {
    try {
      const mailOptions = {
        from: process.env.EMAIL_FROM,
        to,
        subject,
        html,
        text
      };

      const result = await this.transporter.sendMail(mailOptions);
      logger.info(`Email sent successfully to ${to}:`, result.messageId);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      logger.error('Email sending failed:', error);
      return { success: false, error: error.message };
    }
  }

  // Send welcome email to new members
  async sendWelcomeEmail(member) {
    const subject = `Welcome to ${process.env.CHURCH_NAME}!`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to ${process.env.CHURCH_NAME}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4F46E5; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .footer { padding: 20px; text-align: center; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to ${process.env.CHURCH_NAME}!</h1>
          </div>
          <div class="content">
            <h2>Dear ${member.name},</h2>
            <p>We are thrilled to welcome you to our church family! Your membership means a lot to us, and we're excited to have you join our community of faith.</p>
            
            <h3>Your Membership Details:</h3>
            <ul>
              <li><strong>Name:</strong> ${member.name}</li>
              <li><strong>Membership Date:</strong> ${new Date(member.membershipDate).toLocaleDateString()}</li>
              <li><strong>Department:</strong> ${member.department || 'To be assigned'}</li>
            </ul>
            
            <h3>What's Next?</h3>
            <p>We encourage you to:</p>
            <ul>
              <li>Attend our weekly services</li>
              <li>Join a connect group</li>
              <li>Get involved in ministry opportunities</li>
              <li>Connect with other members</li>
            </ul>
            
            <p>If you have any questions or need assistance, please don't hesitate to contact us at ${process.env.CHURCH_EMAIL} or ${process.env.CHURCH_PHONE}.</p>
            
            <p>God bless you!</p>
            <p>The ${process.env.CHURCH_NAME} Team</p>
          </div>
          <div class="footer">
            <p>${process.env.CHURCH_ADDRESS}</p>
            <p>Phone: ${process.env.CHURCH_PHONE} | Email: ${process.env.CHURCH_EMAIL}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      Welcome to ${process.env.CHURCH_NAME}!
      
      Dear ${member.name},
      
      We are thrilled to welcome you to our church family! Your membership means a lot to us.
      
      Your Membership Details:
      - Name: ${member.name}
      - Membership Date: ${new Date(member.membershipDate).toLocaleDateString()}
      - Department: ${member.department || 'To be assigned'}
      
      We encourage you to attend our weekly services, join a connect group, and get involved in ministry opportunities.
      
      Contact us: ${process.env.CHURCH_EMAIL} | ${process.env.CHURCH_PHONE}
      
      God bless you!
      The ${process.env.CHURCH_NAME} Team
    `;

    return await this.sendEmail({
      to: member.email,
      subject,
      html,
      text
    });
  }

  // Send birthday celebration email
  async sendBirthdayEmail(celebration) {
    const subject = `🎉 Happy Birthday ${celebration.name}!`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Happy Birthday!</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
          .content { padding: 20px; background: #fff; }
          .birthday-message { background: #f0f9ff; padding: 20px; border-radius: 10px; margin: 20px 0; }
          .footer { padding: 20px; text-align: center; color: #666; background: #f9f9f9; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎂 Happy Birthday! 🎂</h1>
            <h2>${celebration.name}</h2>
          </div>
          <div class="content">
            <div class="birthday-message">
              <p><strong>🎉 Today is a special day! 🎉</strong></p>
              <p>The entire ${process.env.CHURCH_NAME} family joins together to celebrate you on your special day!</p>
              
              ${celebration.message ? `<p><em>"${celebration.message}"</em></p>` : ''}
              
              <p>We thank God for your life, your contributions to our church community, and for the blessing you are to all of us.</p>
              
              <p>May this new year of your life be filled with God's abundant blessings, joy, peace, and everything your heart desires according to His will.</p>
            </div>
            
            <p>We pray that:</p>
            <ul>
              <li>🙏 God grants you many more years of good health and happiness</li>
              <li>✨ Your dreams and aspirations come to pass</li>
              <li>💝 You continue to be a blessing to others</li>
              <li>🌟 This new age brings you closer to your divine purpose</li>
            </ul>
            
            <p>Celebrate well and know that you are loved and appreciated!</p>
            
            <p>Happy Birthday once again!</p>
            <p><strong>With love and prayers,<br>The ${process.env.CHURCH_NAME} Family</strong></p>
          </div>
          <div class="footer">
            <p>${process.env.CHURCH_ADDRESS}</p>
            <p>Phone: ${process.env.CHURCH_PHONE} | Email: ${process.env.CHURCH_EMAIL}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail({
      to: celebration.member?.email || celebration.email,
      subject,
      html
    });
  }

  // Send celebration approval notification
  async sendCelebrationApprovalEmail(celebration) {
    const subject = `Your ${celebration.type} celebration has been approved!`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Celebration Approved</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #10B981; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .footer { padding: 20px; text-align: center; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Celebration Approved!</h1>
          </div>
          <div class="content">
            <p>Dear ${celebration.name},</p>
            
            <p>Great news! Your ${celebration.type.toLowerCase()} celebration request has been approved and will be announced to our church family.</p>
            
            <p><strong>Celebration Details:</strong></p>
            <ul>
              <li><strong>Type:</strong> ${celebration.type}</li>
              <li><strong>Date:</strong> ${celebration.month}/${celebration.date}</li>
              ${celebration.message ? `<li><strong>Your Message:</strong> ${celebration.message}</li>` : ''}
            </p>
            
            <p>We're excited to celebrate with you and give thanks to God for this special occasion in your life!</p>
            
            <p>God bless you!</p>
            <p>The ${process.env.CHURCH_NAME} Team</p>
          </div>
          <div class="footer">
            <p>${process.env.CHURCH_ADDRESS}</p>
            <p>Phone: ${process.env.CHURCH_PHONE} | Email: ${process.env.CHURCH_EMAIL}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail({
      to: celebration.member?.email || celebration.email,
      subject,
      html
    });
  }

  // Send event reminder email
  async sendEventReminderEmail(event, member) {
    const subject = `Reminder: ${event.title} - Tomorrow!`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Event Reminder</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #7C3AED; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .event-details { background: #fff; padding: 15px; border-radius: 5px; margin: 15px 0; }
          .footer { padding: 20px; text-align: center; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📅 Event Reminder</h1>
          </div>
          <div class="content">
            <p>Dear ${member.name},</p>
            
            <p>This is a friendly reminder about an upcoming event at ${process.env.CHURCH_NAME}:</p>
            
            <div class="event-details">
              <h3>${event.title}</h3>
              <p><strong>📅 Date:</strong> ${new Date(event.date).toLocaleDateString()}</p>
              <p><strong>🕒 Time:</strong> ${event.time}${event.endTime ? ` - ${event.endTime}` : ''}</p>
              <p><strong>📍 Location:</strong> ${event.location}</p>
              <p><strong>📋 Category:</strong> ${event.category}</p>
              
              <p><strong>Description:</strong></p>
              <p>${event.description}</p>
              
              ${event.maxAttendees ? `<p><strong>👥 Max Attendees:</strong> ${event.maxAttendees}</p>` : ''}
              ${event.registrationRequired ? '<p><strong>⚠️ Registration Required</strong></p>' : ''}
            </div>
            
            <p>We look forward to seeing you there!</p>
            
            <p>For any questions, please contact us at ${process.env.CHURCH_EMAIL} or ${process.env.CHURCH_PHONE}.</p>
            
            <p>God bless you!</p>
            <p>The ${process.env.CHURCH_NAME} Team</p>
          </div>
          <div class="footer">
            <p>${process.env.CHURCH_ADDRESS}</p>
            <p>Phone: ${process.env.CHURCH_PHONE} | Email: ${process.env.CHURCH_EMAIL}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail({
      to: member.email,
      subject,
      html
    });
  }
}

module.exports = new EmailService();