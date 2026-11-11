import type { Metadata, Viewport } from 'next';
import { Fraunces, Inter, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';

const serif = Fraunces({ subsets: ['latin'], variable: '--font-serif', weight: ['500'], style: ['italic'] });
const sans = Inter({ subsets: ['latin'], variable: '--font-sans' });
const display = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-display', weight: ['600', '700', '800'] });

export const metadata: Metadata = {
  title: "CLC Shepherding — Christ's Love Church",
  description: 'Weekly shepherding assessment reports for the council of Christ’s Love Church.',
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#ffffff' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable} ${display.variable}`}>
      <body>{children}</body>
    </html>
  );
}
