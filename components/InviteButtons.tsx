'use client';
import { useState } from 'react';

/** Copy or WhatsApp a ready-made sign-in message (link, username, password) to one shepherd. */
export default function InviteButtons({ greeting, link, username, code, phone }: {
  greeting: string; link: string; username: string; code: string; phone: string;
}) {
  const [copied, setCopied] = useState(false);
  const text =
    `Hello ${greeting},\n\nHere is your sign-in for the CLC weekly Shepherding Assessment report:\n\n` +
    `Link: ${link}\nUsername: ${username}\nPassword: ${code}\n\n` +
    `Open the link, enter your password and fill in the form after each group meeting. Please keep your password private.`;
  // Ghana numbers: 0XXXXXXXXX → 233XXXXXXXXX. With no number WhatsApp lets you pick the contact.
  const digits = (phone.match(/\d[\d\s]{8,}/)?.[0] ?? '').replace(/\s/g, '');
  const intl = digits.startsWith('0') ? '233' + digits.slice(1) : digits;
  const wa = `https://wa.me/${intl}?text=${encodeURIComponent(text)}`;

  async function copy() {
    try { await navigator.clipboard.writeText(text); } catch {
      const t = document.createElement('textarea'); t.value = text; document.body.append(t); t.select(); document.execCommand('copy'); t.remove();
    }
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }
  return (
    <div className="invite-actions no-print">
      <button type="button" className="btn small" onClick={copy}>{copied ? 'Copied ✓' : 'Copy invite'}</button>
      <a className="btn small" href={wa} target="_blank" rel="noopener noreferrer">WhatsApp</a>
    </div>
  );
}
