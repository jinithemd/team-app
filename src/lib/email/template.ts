import { APP_NAME } from "../brand";
import { APP_URL } from "../data/store";

/*
 * The one email layout: subject as the heading, the text, the links as big buttons (one-tap
 * answers sit side by side), and a footer saying how to change email settings.
 * Plain inline styles so it holds up in Gmail, Outlook and phone mail apps.
 */

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function emailHtml(e: { subject: string; text: string; links: { label: string; href: string }[] }) {
  const paras = e.text
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px;font-size:16px;line-height:1.5;color:#1a1a1a">${esc(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
  const button = (l: { label: string; href: string }, primary: boolean) =>
    `<a href="${esc(l.href)}" style="display:inline-block;margin:0 8px 8px 0;padding:12px 18px;border-radius:8px;font-size:15px;font-weight:600;text-decoration:none;${
      primary ? "background:#1f3fbf;color:#ffffff" : "background:#eef1f8;color:#1f3fbf"
    }">${esc(l.label)}</a>`;
  const buttons = e.links.map((l, i) => button(l, i === 0)).join("");
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f5f6f8">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f6f8;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;padding:24px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
<tr><td>
<h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;color:#111">${esc(e.subject)}</h1>
${paras}
${buttons ? `<div style="margin:8px 0 4px">${buttons}</div>` : ""}
</td></tr></table>
<p style="margin:16px 0 0;font-size:12px;color:#6b7280;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
Sent by ${esc(APP_NAME)} for your team. <a href="${APP_URL}/account/notifications" style="color:#6b7280">Change which emails you get</a>.
</p>
</td></tr></table></body></html>`;
}

export function emailText(e: { text: string; links: { label: string; href: string }[] }) {
  return `${e.text.replace(/\r\n?/g, "\n")}\n\n${e.links.map((l) => `${l.label}: ${l.href}`).join("\n")}\n\nChange which emails you get: ${APP_URL}/account/notifications\n`;
}
