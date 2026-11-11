'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function NavLinks({ nav }: { nav: { href: string; label: string }[] }) {
  const path = usePathname();
  // Most specific match wins, so "/admin/reports/12" highlights "All reports", not "Dashboard".
  const active = nav
    .filter((n) => path === n.href || path.startsWith(n.href + '/'))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
  return (
    <div className="navlinks">
      {nav.map((n) => (
        <Link key={n.href} href={n.href} className={n.href === active ? 'on' : undefined} aria-current={n.href === active ? 'page' : undefined}>
          {n.label}
        </Link>
      ))}
    </div>
  );
}
