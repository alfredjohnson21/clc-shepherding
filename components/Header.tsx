import Link from 'next/link';
import { logout } from '@/app/actions';

export default function Header({ title, who, nav }: { title: string; who?: string; nav?: { href: string; label: string }[] }) {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link href="/" className="brand">
          <span className="brand-mark" aria-hidden>✝</span>
          <span><b>Christ&rsquo;s Love Church</b><small>{title}</small></span>
        </Link>
        <nav className="topnav">
          {nav?.map((n) => <Link key={n.href} href={n.href}>{n.label}</Link>)}
          {who && (
            <form action={logout}>
              <span className="who">{who}</span>
              <button className="link-btn">Sign out</button>
            </form>
          )}
        </nav>
      </div>
    </header>
  );
}
