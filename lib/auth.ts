import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { query } from './db';
import type { Person } from './tree';

const COOKIE = 'clc_session';
const secret = () => {
  const s = process.env.SESSION_SECRET;
  if (!s && process.env.VERCEL) throw new Error('SESSION_SECRET is not set');
  return s || 'dev-secret-change-me';
};
const sign = (v: string) => createHmac('sha256', secret()).update(v).digest('base64url');

/**
 * shepherd — a group leader filling in the weekly form.
 * viewer   — the Head Pastor, via his private link; can only look at the dashboard and reports.
 *            `t` is the link he used, so resetting the link signs out old copies.
 * super    — super admin (password); can change people, passwords and reports.
 */
export type Session = { kind: 'shepherd'; id: number } | { kind: 'viewer'; t: string } | { kind: 'super' };
export type Role = 'viewer' | 'super';

/**
 * A leader's password: a custom one set by the super admin, else the first 5 digits of their
 * phone number (church's choice, 2026-11-11), else a 6-digit code derived from SESSION_SECRET.
 */
export function accessCode(p: Pick<Person, 'id' | 'phone' | 'password'>): string {
  if (p.password) return p.password;
  const phone = (p.phone.match(/\d[\d\s]{8,}/)?.[0] ?? '').replace(/\s/g, '');
  if (phone.length >= 9) return phone.slice(0, 5);
  const h = createHmac('sha256', secret()).update(`code:${p.id}`).digest();
  return String(h.readUInt32BE(0) % 1_000_000).padStart(6, '0');
}

const same = (a: string, b: string) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

export function checkSuperPassword(pw: string) {
  const expected = process.env.ADMIN_PASSWORD || (process.env.VERCEL ? '' : 'admin');
  return !!expected && same(pw, expected);
}

/** The secret part of the Head Pastor's view-only link (/view/<token>). Created on first use. */
export async function viewToken(): Promise<string> {
  const [row] = await query<{ value: string }>("SELECT value FROM settings WHERE key = 'view_token'");
  if (row) return row.value;
  await query("INSERT INTO settings (key, value) VALUES ('view_token', $1) ON CONFLICT (key) DO NOTHING", [randomBytes(12).toString('base64url')]);
  const [again] = await query<{ value: string }>("SELECT value FROM settings WHERE key = 'view_token'");
  return again.value;
}
export async function resetViewToken() {
  const t = randomBytes(12).toString('base64url');
  await query("INSERT INTO settings (key, value) VALUES ('view_token', $1) ON CONFLICT (key) DO UPDATE SET value = $1", [t]);
  return t;
}
export async function checkViewToken(t: string) { return same(t, await viewToken()); }

export async function setSession(s: Session) {
  const v = Buffer.from(JSON.stringify(s)).toString('base64url');
  (await cookies()).set(COOKIE, `${v}.${sign(v)}`, {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/',
    maxAge: 60 * 60 * 24 * (s.kind === 'viewer' ? 365 : 30),
  });
}
export async function clearSession() { (await cookies()).delete(COOKIE); }

export async function getSession(): Promise<Session | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const [v, sig] = raw.split('.');
  if (!v || !sig) return null;
  if (!same(sig, sign(v))) return null;
  try { return JSON.parse(Buffer.from(v, 'base64url').toString()); } catch { return null; }
}

/** The dashboard role for this visitor, or null (an old Head Pastor link counts as signed out). */
export async function getRole(): Promise<Role | null> {
  const s = await getSession();
  if (s?.kind === 'super') return 'super';
  if (s?.kind === 'viewer' && (await checkViewToken(s.t))) return 'viewer';
  return null;
}

export async function requireShepherd() {
  const s = await getSession();
  if (s?.kind !== 'shepherd') redirect('/');
  return s.id;
}
/** Dashboard pages: Head Pastor (view only) or super admin. */
export async function requireDashboard(): Promise<Role> {
  const r = await getRole();
  if (!r) redirect('/admin/login');
  return r;
}
/** Pages and actions that change things, or show passwords. */
export async function requireSuper() {
  const r = await getRole();
  if (r === 'viewer') redirect('/admin');
  if (r !== 'super') redirect('/admin/login');
}
