import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createHmac, timingSafeEqual } from 'crypto';
import { person } from './tree';

const COOKIE = 'clc_session';
const secret = () => {
  const s = process.env.SESSION_SECRET;
  if (!s && process.env.VERCEL) throw new Error('SESSION_SECRET is not set');
  return s || 'dev-secret-change-me';
};
const sign = (v: string) => createHmac('sha256', secret()).update(v).digest('base64url');

export type Session = { kind: 'shepherd'; id: number } | { kind: 'admin' };

/**
 * Each shepherd's password: the first 5 digits of their phone number (church's choice, 2026-11-11).
 * Leaders with no phone on file keep a 6-digit code derived from SESSION_SECRET.
 */
export function accessCode(id: number): string {
  const phone = (person(id)?.phone.match(/\d[\d\s]{8,}/)?.[0] ?? '').replace(/\s/g, '');
  if (phone.length >= 9) return phone.slice(0, 5);
  const h = createHmac('sha256', secret()).update(`code:${id}`).digest();
  return String(h.readUInt32BE(0) % 1_000_000).padStart(6, '0');
}

export function checkAdminPassword(pw: string) {
  const expected = process.env.ADMIN_PASSWORD || (process.env.VERCEL ? '' : 'admin');
  if (!expected) return false;
  const a = Buffer.from(pw), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function setSession(s: Session) {
  const v = Buffer.from(JSON.stringify(s)).toString('base64url');
  (await cookies()).set(COOKIE, `${v}.${sign(v)}`, {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 30,
  });
}
export async function clearSession() { (await cookies()).delete(COOKIE); }

export async function getSession(): Promise<Session | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const [v, sig] = raw.split('.');
  if (!v || !sig) return null;
  const good = sign(v);
  if (sig.length !== good.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return null;
  try { return JSON.parse(Buffer.from(v, 'base64url').toString()); } catch { return null; }
}

export async function requireShepherd() {
  const s = await getSession();
  if (s?.kind !== 'shepherd') redirect('/');
  return s.id;
}
export async function requireAdmin() {
  const s = await getSession();
  if (s?.kind !== 'admin') redirect('/admin/login');
}
