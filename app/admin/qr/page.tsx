import { headers } from 'next/headers';
import Link from 'next/link';
import QRCode from 'qrcode';
import Header from '@/components/Header';
import PrintButton from '@/components/PrintButton';
import { requireSuper } from '@/lib/auth';
import { dashTitle, dashWho, navFor } from '@/lib/nav';

export const dynamic = 'force-dynamic';

export default async function QrPoster() {
  await requireSuper();
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'clc-shepherding.vercel.app';
  const base = `${h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')}://${host}`;
  const url = `${base}/update`;
  const svg = await QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#0f172a', light: '#ffffff' } });

  return (
    <>
      <div className="no-print"><Header title={dashTitle('super')} who={dashWho('super')} nav={navFor('super')} /></div>
      <main className="page narrow">
        <div className="row between no-print">
          <Link href="/admin/requests">← Profile requests</Link>
          <PrintButton label="Print poster" />
        </div>
        <section className="card qr-poster">
          <img src="/clc-logo.png" alt="" width={110} height={74} />
          <p className="eyebrow">Christ&rsquo;s Love Church</p>
          <h1>Update your church profile</h1>
          <p className="muted">Scan with your phone camera, then enter your phone number.</p>
          <div className="qr" role="img" aria-label={`QR code for ${url}`} dangerouslySetInnerHTML={{ __html: svg }} />
          <p className="qr-url">{url}</p>
        </section>
        <p className="muted small center no-print">Print this and place it where members can scan it, or share the link above in the church WhatsApp group.</p>
      </main>
    </>
  );
}
