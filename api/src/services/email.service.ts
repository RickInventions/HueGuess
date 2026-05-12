import fetch from 'node-fetch';

const EMAIL_PROXY_URL = process.env.EMAIL_PROXY_URL;
const EMAIL_PROXY_KEY = process.env.EMAIL_PROXY_KEY;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

export class EmailService {
  static generateVerificationCode(): string {
    return Math.floor(100000 + Math.random()  * 900000).toString();
  }

  static generateToken(): string {
    return crypto.randomUUID();
  }

  static async sendVerificationEmail(
    toEmail: string, 
    verificationToken: string,
    verificationCode: string,
    username: string
  ) {
    const verifyLink = `${FRONTEND_URL}/verify?token=${verificationToken}&email=${encodeURIComponent(toEmail)}`;
    
    const subject = 'Verify Your HueGuess Account';
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            max-width: 600px; 
            margin: 0 auto; 
            padding: 20px; 
          }
          .header { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white; 
            padding: 30px; 
            text-align: center; 
            border-radius: 8px 8px 0 0; 
          }
          .content { 
            background: #f8f9fa; 
            padding: 30px; 
            border-radius: 0 0 8px 8px; 
          }
          .verify-button {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 14px 32px;
            text-decoration: none;
            border-radius: 8px;
            margin: 25px 0;
            font-weight: bold;
          }
          .code-box {
            background: white;
            border: 1px solid #ddd;
            padding: 15px;
            text-align: center;
            margin: 20px 0;
            border-radius: 8px;
            font-family: monospace;
            font-size: 24px;
            letter-spacing: 4px;
          }
          .footer { 
            text-align: center; 
            margin-top: 30px; 
            padding-top: 20px; 
            border-top: 1px solid #ddd; 
            color: #666; 
            font-size: 12px; 
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 style="margin: 0;">🎨 HueGuess</h1>
          <p style="margin: 5px 0 0 0; opacity: 0.9;">Test your color perception</p>
        </div>
        <div class="content">
          <p>Hello <strong>${username}</strong>,</p>
          <p>Welcome to HueGuess! Click the button below to verify your email address and start playing:</p>
          
          <div style="text-align: center;">
            <a href="${verifyLink}" class="verify-button">✨ Verify Email Address ✨</a>
          </div>
          
          <p>Or copy and paste this link into your browser:</p>
          <p style="background: #e9ecef; padding: 12px; border-radius: 4px; word-break: break-all; font-size: 12px;">
            ${verifyLink}
          </p>
          
          <p><strong>Alternative verification method:</strong> If the button doesn't work, enter this 6-digit code on the verification page:</p>
          
          <div class="code-box">
            <strong>${verificationCode}</strong>
          </div>
          
          <p><em>Why verify?</em> Email verification is required for Competitive Mode, Leaderboards, and Achievements to ensure fair play.</p>
          
          <p>This link and code will expire in <strong>24 hours</strong>.</p>
          
          <p>If you didn't create an account with HueGuess, you can safely ignore this email.</p>
          
          <div class="footer">
            <p>🎨 HueGuess — Master the color spectrum</p>
            <p>This is an automated message, please do not reply</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const textContent = `
      HueGuess Account Verification
      
      Hello ${username},
      
      Welcome to HueGuess! Verify your email address using the link below:
      
      🔗 Verification Link: ${verifyLink}
      
      Or use this 6-digit code: ${verificationCode}
      
      This link and code expire in 24 hours.
      
      Why verify? Email verification is required for Competitive Mode, Leaderboards, and Achievements.
      
      If you didn't create an account with HueGuess, please ignore this email.
      
      ---
      HueGuess — Master the color spectrum
    `;

    return await this.sendEmailViaProxy(toEmail, subject, htmlContent, textContent);
  }

  static async sendPasswordResetEmail(
    toEmail: string,
    resetToken: string,
    username: string
  ) {
    const resetLink = `${FRONTEND_URL}/reset-password?token=${resetToken}&email=${encodeURIComponent(toEmail)}`;
    
    const subject = 'Reset Your HueGuess Password';
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
          .reset-button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; margin: 25px 0; font-weight: bold; }
          .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="header"><h1 style="margin: 0;">🎨 HueGuess</h1><p style="margin: 5px 0 0 0;">Password Reset</p></div>
        <div class="content">
          <p>Hello <strong>${username}</strong>,</p>
          <p>We received a request to reset your password. Click the button below to create a new password:</p>
          <div style="text-align: center;"><a href="${resetLink}" class="reset-button">🔐 Reset Password</a></div>
          <p>This link will expire in <strong>1 hour</strong>.</p>
          <p>If you didn't request this, please ignore this email.</p>
          <div class="footer"><p>HueGuess — Master the color spectrum</p></div>
        </div>
      </body>
      </html>
    `;

    const textContent = `
      HueGuess Password Reset
      
      Hello ${username},
      
      Reset your password using this link: ${resetLink}
      
      This link expires in 1 hour.
      
      If you didn't request this, please ignore this email.
    `;

    return await this.sendEmailViaProxy(toEmail, subject, htmlContent, textContent);
  }

  private static async sendEmailViaProxy(
    toEmail: string,
    subject: string,
    htmlContent: string,
    textContent: string
  ) {
    try {
      const payload = {
        to: toEmail,
        subject,
        html: htmlContent,
        text: textContent,
        fromName: 'HueGuess',
        fromEmail: process.env.ADMIN_EMAIL || 'noreply@hueguess.com',
        smtpHost: process.env.SMTP_HOST,
        smtpPort: parseInt(process.env.SMTP_PORT || '587'),
        smtpUser: process.env.ADMIN_EMAIL,
        smtpPass: process.env.SMTP_PASS,
      };

      const response = await fetch(EMAIL_PROXY_URL!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': EMAIL_PROXY_KEY!,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Email proxy error: ${response.status} ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Email sending error:', error);
      throw new Error(`Failed to send email: ${(error as Error).message}`);
    }
  }
}