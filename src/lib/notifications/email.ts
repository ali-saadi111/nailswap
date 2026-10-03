import "server-only";
import { Resend } from "resend";
import { env } from "@/lib/env";

export function emailConfigured() {
  return Boolean(env().RESEND_API_KEY);
}

let client: Resend | null = null;
function resend() {
  if (!client) client = new Resend(env().RESEND_API_KEY);
  return client;
}

export interface EmailAttachment {
  filename: string;
  content: Buffer;
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: EmailAttachment[];
  replyTo?: string;
}): Promise<{ id: string }> {
  const { data, error } = await resend().emails.send({
    from: env().EMAIL_FROM,
    to: [opts.to],
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
    replyTo: opts.replyTo,
    attachments: opts.attachments?.map((a) => ({ filename: a.filename, content: a.content })),
  });
  if (error || !data) throw new Error(error?.message ?? "Email send failed");
  return { id: data.id };
}

/** Minimal, inline-styled transactional email shell (renders well in Gmail/Outlook, RTL aware). */
export function emailLayout(opts: {
  title: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
  footer?: string;
  dir?: "ltr" | "rtl";
  accent?: string;
}) {
  const accent = opts.accent ?? "#8B5E3C";
  const dir = opts.dir ?? "ltr";
  return `<!doctype html><html dir="${dir}"><body style="margin:0;background:#faf8f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1a1714">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:560px;background:#fff;border-radius:16px;border:1px solid #e8e2da" cellspacing="0" cellpadding="0">
<tr><td style="padding:28px 28px 8px;font-size:20px;font-weight:600">${opts.title}</td></tr>
<tr><td style="padding:0 28px 20px;font-size:15px;line-height:1.6;color:#3d3833">${opts.body}</td></tr>
${opts.ctaUrl ? `<tr><td style="padding:0 28px 28px"><a href="${opts.ctaUrl}" style="display:inline-block;background:${accent};color:#fff;text-decoration:none;padding:12px 20px;border-radius:12px;font-weight:600">${opts.ctaLabel ?? "Open"}</a></td></tr>` : ""}
<tr><td style="padding:16px 28px;border-top:1px solid #e8e2da;font-size:12px;color:#9a928a">${opts.footer ?? "NailSwap · nailswap.app"}</td></tr>
</table></td></tr></table></body></html>`;
}
