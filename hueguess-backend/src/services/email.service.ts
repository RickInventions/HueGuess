import fetch from 'node-fetch';

const EMAIL_PROXY_URL = process.env.EMAIL_PROXY_URL!;
const EMAIL_PROXY_KEY = process.env.EMAIL_PROXY_KEY!;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

export class EmailService {
  static generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

static async sendVerificationEmail(
  toEmail: string,
  verificationCode: string,
  username: string
): Promise<void> {
  const subject = 'Verify Your HueGuess Account';
  const verificationLink = `${FRONTEND_URL}/verify?code=${verificationCode}&email=${encodeURIComponent(toEmail)}`;

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
        .color-icon {
          font-size: 48px;
          margin-bottom: 15px;
        }
        .content { 
          background: #f8f9fa; 
          padding: 30px; 
          border-radius: 0 0 8px 8px; 
        }
        .cta-button {
          display: inline-block;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 14px 36px;
          text-decoration: none;
          border-radius: 18px;
          margin: 24px 0;
          font-size: 16px;
          font-weight: 600;
        }
        .divider {
          border-top: 1px solid #ddd;
          margin: 24px 0;
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
        <div class="color-icon">🎨</div>
        <h1 style="margin: 0; font-weight: 300;">HueGuess</h1>
        <p style="margin: 5px 0 0 0; opacity: 0.8;">Can you remember the color?</p>
      </div>
      <div class="content">
        <p>Hello <strong>${username}</strong>,</p>
        <p>Welcome to HueGuess! Click the button below to verify your email and unlock Competitive Mode — including leaderboards, ranked tiers, and multiplayer challenges.</p>
        
        <p style="text-align: center;">
          <a href="${verificationLink}" class="cta-button">
            Verify Email Address
          </a>
        </p>
        
        <div class="divider"></div>
        
        <p style="font-size: 14px; color: #666;">
          Or copy this link into your browser:<br>
          <a href="${verificationLink}" style="color: #667eea; word-break: break-all;">${verificationLink}</a>
        </p>
        
        <p style="font-size: 13px; color: #999;">This link expires in 15 minutes.</p>
        
        <p><em>Why verify?</em> A verified account ensures fair leaderboard rankings and prevents duplicate accounts in Competitive Mode.</p>
        
        <p>If you didn't create an account with HueGuess, you can safely ignore this email.</p>
        
        <div class="footer">
          <p>🎨 HueGuess — Train your color memory</p>
          <p>This is an automated message, please do not reply</p>
        </div>
      </div>
    </body>
    </html>
  `;

    const textContent = `
      HueGuess Account Verification
      
      Hello ${username},
      
      Welcome to HueGuess! To access Competitive Mode and climb the leaderboards, please verify your email address using this 6-digit code:
      
      Verification Code: ${verificationCode}
      (Expires in 15 minutes)
      
      Enter this code on the verification page to activate your competitive account.
      
      Verification Link: ${FRONTEND_URL}/verify?code=${verificationCode}&email=${encodeURIComponent(toEmail)}
      
      Why verify? Email verification is required for Competitive Mode to ensure fair leaderboard rankings and prevent duplicate accounts.
      
      If you didn't create an account with HueGuess, you can safely ignore this email.
      
      ---
      HueGuess — Train your color memory
      This is an automated message, please do not reply
    `;

    await EmailService.sendViaProxy(toEmail, subject, htmlContent, textContent);
  }

  private static async sendViaProxy(
    toEmail: string,
    subject: string,
    htmlContent: string,
    textContent: string | null = null
  ): Promise<void> {
    try {
      const payload = {
        to: toEmail,
        subject,
        html: htmlContent,
        text: textContent || EmailService.htmlToText(htmlContent),
        fromName: 'HueGuess',
        fromEmail: process.env.ADMIN_EMAIL || 'noreply@hueguess.com',
        smtpHost: process.env.SMTP_HOST,
        smtpPort: parseInt(process.env.SMTP_PORT || '587'),
        smtpUser: process.env.ADMIN_EMAIL,
        smtpPass: process.env.SMTP_PASS,
      };

      const response = await fetch(EMAIL_PROXY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': EMAIL_PROXY_KEY,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Email proxy error: ${response.status} ${errorText}`);
      }

      await response.json();
    } catch (error) {
      console.error('Email sending error:', error);
      throw new Error(`Failed to send email: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private static htmlToText(html: string): string {
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<p\s*\/?>/gi, '\n\n')
      .replace(/<[^>]+>/g, '')
      .replace(/\n\s*\n/g, '\n\n')
      .trim();
  }
}