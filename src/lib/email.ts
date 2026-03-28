/**
 * Email service — sends reports via Gmail SMTP using Nodemailer.
 *
 * This is the canonical reference implementation.
 * The actual execution happens in the send-report Supabase Edge Function
 * (Deno runtime, using npm:nodemailer).
 *
 * Environment variables (set as Supabase secrets):
 *   GMAIL_USER — Gmail address
 *   GMAIL_APP_PASSWORD — Gmail App Password (not regular password)
 */

// This module is for reference only — the frontend calls
// supabase.functions.invoke("send-report") which runs server-side.

export interface SendReportParams {
  to: string[];
  subject: string;
  htmlBody: string;
  pdfBuffer: ArrayBuffer;
  pdfFilename: string;
}

export interface SendReportResult {
  success: boolean;
  error?: string;
}

/**
 * Nodemailer transporter config (used in the edge function):
 *
 * const transporter = nodemailer.createTransport({
 *   host: "smtp.gmail.com",
 *   port: 587,
 *   secure: false,
 *   auth: {
 *     user: GMAIL_USER,
 *     pass: GMAIL_APP_PASSWORD,
 *   },
 * });
 *
 * await transporter.sendMail({
 *   from: GMAIL_USER,
 *   to: params.to,
 *   subject: params.subject,
 *   html: params.htmlBody,
 *   attachments: [{
 *     filename: params.pdfFilename,
 *     content: Buffer.from(params.pdfBuffer),
 *   }],
 * });
 */
