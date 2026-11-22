import Link from 'next/link';
import { logout } from '@/app/actions';
import { pendingCount } from '@/lib/selfserve';
import NavLinks from './NavLinks';

export default async function Header({ title, who, nav }: { title: string; who?: string; nav?: { href: string; label: string }[] }) {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link href="/" className="brand">
          <img src="/clc-logo.png" alt="" className="logo-sm" width={46} height={31} />
          <span><b>Christ&rsquo;s Love Church</b><small>{title}</small></span>
        </Link>
        <nav className="topnav">
          {nav && <NavLinks nav={nav} badges={nav.some((n) => n.href === '/admin/requests') ? { '/admin/requests': await pendingCount() } : undefined} />}
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
