import nodemailer from "nodemailer";

export interface SendEmailOptions {
  to: string;
  subject: string;
  body: string;
  html?: string;
  workflowName?: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  simulated?: boolean;
  error?: string;
  note?: string;
}

/**
 * Send an email using SMTP credentials from environment variables,
 * or log in simulation mode if SMTP credentials are not yet configured.
 */
export async function sendWorkflowEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  const host = process.env.SMTP_HOST?.trim();
  const port = Number(process.env.SMTP_PORT?.trim() || "587");
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  const from = process.env.SMTP_FROM?.trim() || process.env.SUPPORT_EMAIL || "Tech AI monkey <noreply@tech-ai.tech>";
  const secure = process.env.SMTP_SECURE === "true" || port === 465;

  const htmlContent =
    options.html ||
    `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #09090b; color: #f4f4f5; border-radius: 12px; border: 1px solid #27272a;">
      <div style="border-bottom: 1px solid #27272a; padding-bottom: 16px; margin-bottom: 20px;">
        <h2 style="margin: 0; color: #3b82f6; font-size: 20px;">Tech AI monkey</h2>
        <p style="margin: 4px 0 0 0; color: #a1a1aa; font-size: 13px;">Automatisert workflow: ${options.workflowName || "Rutinekjøring"}</p>
      </div>
      <div style="font-size: 15px; line-height: 1.6; color: #e4e4e7; white-space: pre-wrap;">
${options.body}
      </div>
      <div style="margin-top: 32px; border-top: 1px solid #27272a; padding-top: 16px; font-size: 12px; color: #71717a;">
        Generert automatisk av din Tech AI-agent · <a href="https://tech-ai.tech/dashboard/workflows" style="color: #3b82f6; text-decoration: none;">Administrer workflows</a>
      </div>
    </div>
  `;

  // If SMTP host and credentials are not provided, operate in simulated mode
  if (!host || !user) {
    console.log(`[Workflow Email SIMULATED] To: ${options.to} | Subject: ${options.subject}`);
    console.log(`[Body]:\n${options.body.slice(0, 300)}...`);
    return {
      success: true,
      simulated: true,
      messageId: `simulated-${Date.now()}`,
      note: "E-post klargjort (Simulert: For ekte sending, legg til SMTP_HOST, SMTP_USER og SMTP_PASS i web/.env.local).",
    };
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
    });

    const info = await transporter.sendMail({
      from,
      to: options.to,
      subject: options.subject,
      text: options.body,
      html: htmlContent,
    });

    return {
      success: true,
      messageId: info.messageId,
      simulated: false,
    };
  } catch (err: any) {
    console.error("[Workflow Email Error]:", err);
    return {
      success: false,
      error: err.message || "Kunne ikke sende e-post via SMTP.",
    };
  }
}
