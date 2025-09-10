// services/emailService.js - Enhanced with profile update templates
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

  // Send profile update verification email
  async sendProfileUpdateEmail(admin, token, type) {
    const subject = `${process.env.CHURCH_NAME} - Profile Update Verification`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Profile Update Verification</title>
        <style>
          body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            background-color: #f5f5f5;
            margin: 0;
            padding: 0;
          }
          .container { 
            max-width: 600px; 
            margin: 20px auto; 
            background: white;
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          }
          .header { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            color: white; 
            padding: 30px 20px; 
            text-align: center; 
          }
          .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 600;
          }
          .content { 
            padding: 30px 20px; 
            background: #fff; 
          }
          .token-box {
            background: #f8fafc;
            border: 2px dashed #cbd5e0;
            border-radius: 8px;
            padding: 20px;
            text-align: center;
            margin: 20px 0;
          }
          .token {
            font-family: 'Courier New', monospace;
            font-size: 24px;
            font-weight: bold;
            color: #2d3748;
            letter-spacing: 2px;
            padding: 10px;
            background: white;
            border-radius: 6px;
            border: 1px solid #e2e8f0;
            display: inline-block;
            margin: 10px 0;
          }
          .warning {
            background: #fed7d7;
            border: 1px solid #f56565;
            border-radius: 6px;
            padding: 15px;
            margin: 20px 0;
            color: #742a2a;
          }
          .footer { 
            padding: 20px; 
            text-align: center; 
            color: #666; 
            background: #f7fafc;
            border-top: 1px solid #e2e8f0;
          }
          .button {
            display: inline-block;
            background: #4299e1;
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            margin: 10px 0;
          }
          .steps {
            background: #edf2f7;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
          }
          .step {
            display: flex;
            align-items: flex-start;
            margin: 10px 0;
          }
          .step-number {
            background: #4299e1;
            color: white;
            border-radius: 50%;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 12px;
            margin-right: 12px;
            flex-shrink: 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 Profile Update Verification</h1>
          </div>
          <div class="content">
            <p>Hello <strong>${admin.name}</strong>,</p>
            
            <p>You have requested to ${type === 'email' ? 'change your email address' : 'update your profile information'} on your ${process.env.CHURCH_NAME} admin account. For security purposes, please verify this action using the token below:</p>
            
            <div class="token-box">
              <p><strong>Your Verification Token:</strong></p>
              <div class="token">${token}</div>
              <p><small>This token will expire in <strong>15 minutes</strong></small></p>
            </div>
            
            <div class="steps">
              <p><strong>How to use this token:</strong></p>
              <div class="step">
                <div class="step-number">1</div>
                <div>Return to the admin dashboard where you initiated the ${type === 'email' ? 'email change' : 'profile update'}</div>
              </div>
              <div class="step">
                <div class="step-number">2</div>
                <div>Enter the verification token above in the verification modal</div>
              </div>
              <div class="step">
                <div class="step-number">3</div>
                <div>Complete your ${type === 'email' ? 'email change' : 'profile update'}</div>
              </div>
            </div>
            
            <div class="warning">
              <p><strong>⚠️ Security Notice:</strong></p>
              <ul style="margin: 10px 0; padding-left: 20px;">
                <li>This token is valid for 15 minutes only</li>
                <li>Do not share this token with anyone</li>
                <li>If you did not request this change, please contact support immediately</li>
                <li>This email was sent from a secure system</li>
              </ul>
            </div>
            
            <p>If you did not request this ${type === 'email' ? 'email change' : 'profile update'}, please ignore this email or contact our support team immediately.</p>
            
            <p>Best regards,<br>
            <strong>The ${process.env.CHURCH_NAME} Admin Team</strong></p>
          </div>
          <div class="footer">
            <p><strong>${process.env.CHURCH_NAME}</strong></p>
            <p>${process.env.CHURCH_ADDRESS}</p>
            <p>Phone: ${process.env.CHURCH_PHONE} | Email: ${process.env.CHURCH_EMAIL}</p>
            <p><small>This is an automated message. Please do not reply to this email.</small></p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      Profile Update Verification - ${process.env.CHURCH_NAME}
      
      Hello ${admin.name},
      
      You have requested to ${type === 'email' ? 'change your email address' : 'update your profile information'} on your ${process.env.CHURCH_NAME} admin account.
      
      Your Verification Token: ${token}
      
      This token will expire in 15 minutes.
      
      How to use this token:
      1. Return to the admin dashboard where you initiated the ${type === 'email' ? 'email change' : 'profile update'}
      2. Enter the verification token above in the verification modal
      3. Complete your ${type === 'email' ? 'email change' : 'profile update'}
      
      Security Notice:
      - This token is valid for 15 minutes only
      - Do not share this token with anyone
      - If you did not request this change, please contact support immediately
      
      If you did not request this ${type === 'email' ? 'email change' : 'profile update'}, please ignore this email or contact our support team immediately.
      
      Best regards,
      The ${process.env.CHURCH_NAME} Admin Team
      
      ${process.env.CHURCH_NAME}
      ${process.env.CHURCH_ADDRESS}
      Phone: ${process.env.CHURCH_PHONE} | Email: ${process.env.CHURCH_EMAIL}
    `;

    return await this.sendEmail({
      to: admin.email,
      subject,
      html,
      text
    });
  }

  // Send password change verification email
  async sendPasswordChangeEmail(admin, token) {
    const subject = `${process.env.CHURCH_NAME} - Password Change Verification`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Change Verification</title>
        <style>
          body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            background-color: #f5f5f5;
            margin: 0;
            padding: 0;
          }
          .container { 
            max-width: 600px; 
            margin: 20px auto; 
            background: white;
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          }
          .header { 
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); 
            color: white; 
            padding: 30px 20px; 
            text-align: center; 
          }
          .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 600;
          }
          .content { 
            padding: 30px 20px; 
            background: #fff; 
          }
          .token-box {
            background: #f7fafc;
            border: 2px dashed #e53e3e;
            border-radius: 8px;
            padding: 20px;
            text-align: center;
            margin: 20px 0;
          }
          .token {
            font-family: 'Courier New', monospace;
            font-size: 24px;
            font-weight: bold;
            color: #2d3748;
            letter-spacing: 2px;
            padding: 10px;
            background: white;
            border-radius: 6px;
            border: 1px solid #e2e8f0;
            display: inline-block;
            margin: 10px 0;
          }
          .critical-warning {
            background: #fed7d7;
            border: 2px solid #e53e3e;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
            color: #742a2a;
          }
          .footer { 
            padding: 20px; 
            text-align: center; 
            color: #666; 
            background: #f7fafc;
            border-top: 1px solid #e2e8f0;
          }
          .steps {
            background: #edf2f7;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
          }
          .step {
            display: flex;
            align-items: flex-start;
            margin: 10px 0;
          }
          .step-number {
            background: #e53e3e;
            color: white;
            border-radius: 50%;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 12px;
            margin-right: 12px;
            flex-shrink: 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔒 Password Change Verification</h1>
          </div>
          <div class="content">
            <p>Hello <strong>${admin.name}</strong>,</p>
            
            <p>You have requested to change your password for your ${process.env.CHURCH_NAME} admin account. This is a critical security action that requires verification.</p>
            
            <div class="token-box">
              <p><strong>Your Password Change Verification Token:</strong></p>
              <div class="token">${token}</div>
              <p><small>This token will expire in <strong>15 minutes</strong></small></p>
            </div>
            
            <div class="steps">
              <p><strong>How to complete your password change:</strong></p>
              <div class="step">
                <div class="step-number">1</div>
                <div>Return to the admin dashboard password change section</div>
              </div>
              <div class="step">
                <div class="step-number">2</div>
                <div>Enter the verification token above when prompted</div>
              </div>
              <div class="step">
                <div class="step-number">3</div>
                <div>Enter your new password and confirm the change</div>
              </div>
              <div class="step">
                <div class="step-number">4</div>
                <div>You will be logged out and need to log in again with your new password</div>
              </div>
            </div>
            
            <div class="critical-warning">
              <p><strong>🚨 CRITICAL SECURITY NOTICE:</strong></p>
              <ul style="margin: 10px 0; padding-left: 20px;">
                <li><strong>This token is valid for 15 minutes only</strong></li>
                <li><strong>NEVER share this token with anyone</strong></li>
                <li><strong>All your active sessions will be terminated after password change</strong></li>
                <li><strong>If you did not request this password change, CONTACT SUPPORT IMMEDIATELY</strong></li>
                <li><strong>This may indicate unauthorized access to your account</strong></li>
              </ul>
            </div>
            
            <p><strong>Account Details:</strong></p>
            <ul>
              <li>Email: ${admin.email}</li>
              <li>Request Time: ${new Date().toLocaleString()}</li>
              <li>Account Type: ${admin.role === 'super_admin' ? 'Super Administrator' : 'Administrator'}</li>
            </ul>
            
            <p>If you did not request this password change, please:</p>
            <ol>
              <li>Do NOT use the token above</li>
              <li>Change your password immediately through the forgot password option</li>
              <li>Contact our support team at ${process.env.CHURCH_EMAIL}</li>
              <li>Review your account for any unauthorized changes</li>
            </ol>
            
            <p>Best regards,<br>
            <strong>The ${process.env.CHURCH_NAME} Security Team</strong></p>
          </div>
          <div class="footer">
            <p><strong>${process.env.CHURCH_NAME}</strong></p>
            <p>${process.env.CHURCH_ADDRESS}</p>
            <p>Phone: ${process.env.CHURCH_PHONE} | Email: ${process.env.CHURCH_EMAIL}</p>
            <p><small>This is an automated security message. Please do not reply to this email.</small></p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      Password Change Verification - ${process.env.CHURCH_NAME}
      
      Hello ${admin.name},
      
      You have requested to change your password for your ${process.env.CHURCH_NAME} admin account.
      
      Your Password Change Verification Token: ${token}
      
      This token will expire in 15 minutes.
      
      How to complete your password change:
      1. Return to the admin dashboard password change section
      2. Enter the verification token above when prompted
      3. Enter your new password and confirm the change
      4. You will be logged out and need to log in again with your new password
      
      CRITICAL SECURITY NOTICE:
      - This token is valid for 15 minutes only
      - NEVER share this token with anyone
      - All your active sessions will be terminated after password change
      - If you did not request this password change, CONTACT SUPPORT IMMEDIATELY
      - This may indicate unauthorized access to your account
      
      Account Details:
      - Email: ${admin.email}
      - Request Time: ${new Date().toLocaleString()}
      - Account Type: ${admin.role === 'super_admin' ? 'Super Administrator' : 'Administrator'}
      
      If you did not request this password change:
      1. Do NOT use the token above
      2. Change your password immediately through the forgot password option
      3. Contact our support team at ${process.env.CHURCH_EMAIL}
      4. Review your account for any unauthorized changes
      
      Best regards,
      The ${process.env.CHURCH_NAME} Security Team
      
      ${process.env.CHURCH_NAME}
      ${process.env.CHURCH_ADDRESS}
      Phone: ${process.env.CHURCH_PHONE} | Email: ${process.env.CHURCH_EMAIL}
    `;

    return await this.sendEmail({
      to: admin.email,
      subject,
      html,
      text
    });
  }

  // Send password reset email
  async sendPasswordResetEmail(admin, resetToken) {
    const resetUrl = `${process.env.ADMIN_URL}/reset-password?token=${resetToken}`;
    const subject = `${process.env.CHURCH_NAME} - Password Reset Request`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset</title>
        <style>
          body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            background-color: #f5f5f5;
            margin: 0;
            padding: 0;
          }
          .container { 
            max-width: 600px; 
            margin: 20px auto; 
            background: white;
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          }
          .header { 
            background: linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%); 
            color: white; 
            padding: 30px 20px; 
            text-align: center; 
          }
          .content { padding: 30px 20px; }
          .button {
            display: inline-block;
            background: #4f46e5;
            color: white;
            padding: 15px 30px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            margin: 20px 0;
            text-align: center;
          }
          .footer { 
            padding: 20px; 
            text-align: center; 
            color: #666; 
            background: #f7fafc;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔑 Password Reset</h1>
          </div>
          <div class="content">
            <p>Hello <strong>${admin.name}</strong>,</p>
            
            <p>You have requested to reset your password for your ${process.env.CHURCH_NAME} admin account.</p>
            
            <p>Click the button below to reset your password:</p>
            
            <div style="text-align: center;">
              <a href="${resetUrl}" class="button">Reset My Password</a>
            </div>
            
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; background: #f7fafc; padding: 10px; border-radius: 4px;">${resetUrl}</p>
            
            <p><strong>This link will expire in 1 hour for security reasons.</strong></p>
            
            <p>If you did not request this password reset, please ignore this email. Your password will remain unchanged.</p>
            
            <p>Best regards,<br>
            The ${process.env.CHURCH_NAME} Team</p>
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
      to: admin.email,
      subject,
      html
    });
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
            </ul>
            
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