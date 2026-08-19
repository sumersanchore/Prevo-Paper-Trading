import nodemailer from 'nodemailer';

export class EmailService {
  private static transporter: nodemailer.Transporter | null = null;

  private static getTransporter(): nodemailer.Transporter | null {
    if (this.transporter) return this.transporter;

    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const port = Number(process.env.SMTP_PORT) || 587;

    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: {
          user,
          pass,
        },
      });
      return this.transporter;
    }

    return null;
  }

  /**
   * Send 6-Digit OTP Verification Email with High-Visibility Bright Template & Auto-Read Support
   */
  public static async sendOtpEmail(email: string, otpCode: string, fullName?: string): Promise<boolean> {
    const transporter = this.getTransporter();
    const recipientName = fullName || 'Trader';
    const fromAddress = process.env.EMAIL_FROM || '"PREVO Trading" <no-reply@prevo.com>';

    // High-visibility bright email design with RFC auto-read compliant structure
    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${otpCode} is your PREVO verification code</title>
  <style>
    /* Client-specific resets */
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    body { height: 100% !important; margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: #F1F5F9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0F172A; }
    
    .wrapper { width: 100%; table-layout: fixed; background-color: #F1F5F9; padding: 40px 10px; }
    .main-card { max-width: 540px; margin: 0 auto; background-color: #FFFFFF; border-radius: 24px; border: 1px solid #E2E8F0; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.03); overflow: hidden; padding: 40px 36px; }
    
    .brand-row { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #F1F5F9; padding-bottom: 24px; margin-bottom: 28px; }
    .brand-logo { font-size: 24px; font-weight: 900; letter-spacing: -0.5px; color: #0F172A; text-decoration: none; }
    .brand-logo-accent { color: #008F6B; }
    .badge { background-color: #ECFDF5; color: #008F6B; border: 1px solid #A7F3D0; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 20px; }
    
    .title { font-size: 22px; font-weight: 800; color: #0F172A; margin: 0 0 10px 0; letter-spacing: -0.3px; }
    .desc { font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 28px 0; }
    
    /* Highlighted Bright OTP Box */
    .otp-container { background: #F8FAFC; border: 2px dashed #00D09C; border-radius: 18px; padding: 24px; text-align: center; margin-bottom: 28px; }
    .otp-label { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; color: #008F6B; margin-bottom: 8px; }
    .otp-number { font-family: 'SF Mono', 'Courier New', Courier, monospace; font-size: 42px; font-weight: 900; letter-spacing: 10px; color: #0F172A; line-height: 1; padding: 8px 0; margin-left: 10px; }
    .otp-subtext { font-size: 12px; color: #64748B; margin-top: 10px; font-weight: 500; }
    
    /* Margin Perk Callout */
    .perk-box { background: linear-gradient(135deg, #ECFDF5 0%, #F0FDFA 100%); border: 1px solid #A7F3D0; border-radius: 14px; padding: 16px 18px; margin-bottom: 28px; }
    .perk-title { font-size: 13px; font-weight: 800; color: #065F46; margin-bottom: 3px; }
    .perk-desc { font-size: 12px; color: #047857; line-height: 1.5; margin: 0; }
    
    /* Security & Footer */
    .security-note { font-size: 12px; color: #64748B; line-height: 1.5; border-top: 1px solid #F1F5F9; padding-top: 20px; margin-bottom: 20px; }
    .footer { font-size: 11px; color: #94A3B8; text-align: center; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="main-card">
      <!-- Header / Logo -->
      <table width="100%" border="0" cellpadding="0" cellspacing="0" style="border-bottom: 1px solid #F1F5F9; padding-bottom: 20px; margin-bottom: 24px;">
        <tr>
          <td align="left">
            <span style="font-size: 24px; font-weight: 900; color: #0F172A; letter-spacing: -0.5px;">
              PRE<span style="color: #008F6B;">VO</span>
            </span>
          </td>
          <td align="right">
            <span style="background-color: #ECFDF5; color: #008F6B; border: 1px solid #A7F3D0; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 20px; font-family: sans-serif;">
              F&amp;O Paper Trading
            </span>
          </td>
        </tr>
      </table>

      <!-- Main Heading & Message -->
      <div class="title">Your One-Time Login Code</div>
      <div class="desc">
        Hello <strong>${recipientName}</strong>,<br>
        Please enter the verification code below in your browser to sign in to the PREVO trading terminal.
      </div>

      <!-- Bright High-Contrast OTP Code Box -->
      <div class="otp-container">
        <div class="otp-label">Verification Code</div>
        <!-- Standard markup for auto-read detection -->
        <div class="otp-number" id="otp-code">${otpCode}</div>
        <div class="otp-subtext">Expires in <strong>10 minutes</strong> • Do not share with anyone</div>
      </div>

      <!-- Complimentary Capital Notice -->
      <div class="perk-box">
        <div class="perk-title">🎁 ₹10,00,000 Virtual Capital Active</div>
        <p class="perk-desc">
          Your account is pre-funded with 10 Lakhs virtual capital to practice NIFTY, BANK NIFTY &amp; SENSEX option strategies with zero financial risk.
        </p>
      </div>

      <!-- Security Notice -->
      <div class="security-note">
        If you did not request this login code, you can safely disregard this email. Your account remains completely secure.
      </div>

      <!-- Footer -->
      <div class="footer">
        © 2026 PREVO — Practice Before You Trade.<br>
        Encrypted Session • NSE/BSE Simulated Market Execution
      </div>
    </div>
  </div>
</body>
</html>
    `;

    if (!transporter) {
      console.log(`[EmailService] ⚠️ SMTP credentials not configured in .env. Logged OTP for ${email}: ${otpCode}`);
      return false;
    }

    try {
      // Subject and Text formatted for mobile OS autofill and Gmail/Apple Mail OTP one-time-code auto detection
      await transporter.sendMail({
        from: fromAddress,
        to: email,
        subject: `${otpCode} is your PREVO verification code`,
        text: `Your PREVO login verification code is ${otpCode}. It expires in 10 minutes.\n\nDo not share this code with anyone.`,
        html: htmlContent,
        headers: {
          'X-Entity-Ref-ID': `PREVO-OTP-${Date.now()}`,
        },
      });
      console.log(`[EmailService] ✉️ High-visibility OTP email successfully delivered to ${email}`);
      return true;
    } catch (err) {
      console.error(`[EmailService] ❌ Failed to send email to ${email}:`, err);
      return false;
    }
  }
}
