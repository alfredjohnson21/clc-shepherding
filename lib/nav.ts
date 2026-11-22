import type { Role } from './auth';

export function navFor(role: Role) {
  const nav = [
    { href: '/admin', label: 'Dashboard' },
    { href: '/admin/members', label: 'Members' },
    { href: '/admin/reports', label: 'All reports' },
  ];
  if (role === 'super') nav.push({ href: '/admin/requests', label: 'Requests' }, { href: '/admin/people', label: 'People' }, { href: '/admin/codes', label: 'Sign-in links' });
  return nav;
}

export const dashTitle = (role: Role) => (role === 'super' ? 'Super admin' : "Head Pastor's Dashboard");
export const dashWho = (role: Role) => (role === 'super' ? 'Super admin' : 'Rev. Mubarak Kwota · view only');
