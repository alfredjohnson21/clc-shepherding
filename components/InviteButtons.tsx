'use client';
import { useState } from 'react';

/** Copy or WhatsApp a ready-made message. Ghana numbers 0XXXXXXXXX become 233XXXXXXXXX. */
export default function InviteButtons({ text, phone, copyLabel = 'Copy invite' }: { text: string; phone: string; copyLabel?: string }) {
  const [copied, setCopied] = useState(false);
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
      <button type="button" className="btn small" onClick={copy}>{copied ? 'Copied ✓' : copyLabel}</button>
      <a className="btn small" href={wa} target="_blank" rel="noopener noreferrer">WhatsApp</a>
    </div>
  );
}
