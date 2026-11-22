import 'server-only';
import { cookies } from 'next/headers';
import { query } from './db';
import type { Tree } from './tree';
import type { ProfileDetails } from './types';

/**
 * Self-service profile updates (from the church QR code).
 *
 * update: phone found → access_pending → (admin approves) editing → review_pending → (admin approves) applied
 * join:   phone not found → editing → review_pending → (admin approves, picks the group) applied
 * Either can end in `rejected`. The phone that started a request keeps a random token in a cookie,
 * so only that phone can see the profile once the admin lets it through.
 */
export type RequestStatus = 'access_pending' | 'editing' | 'review_pending' | 'applied' | 'rejected';
export type Proposed = { name: string; phone: string; details: ProfileDetails };
export type ProfileRequest = {
  id: number; token: string; kind: 'update' | 'join'; phone: string; person_id: number | null;
  status: RequestStatus; proposed: Proposed | null; created_at: string; updated_at: string; decided_at: string | null;
};

export const COOKIE = 'clc_profile_request';
export const PENDING: RequestStatus[] = ['access_pending', 'review_pending'];

/** "+233 24 551 5752" / "0245515752" → "0245515752". Returns '' if it isn't a Ghana-style mobile number. */
export function normPhone(raw: string) {
  let d = raw.replace(/\D/g, '');
  if (d.startsWith('233') && d.length === 12) d = '0' + d.slice(3);
  if (d.length === 9 && !d.startsWith('0')) d = '0' + d;
  return /^0\d{9}$/.test(d) ? d : '';
}

/** Everyone whose phone field contains this number (a phone field may hold more than one number). */
export function findByPhone(tree: Tree, phone: string) {
  const n = normPhone(phone);
  if (!n) return [];
  return tree.people.filter((p) => (p.phone.match(/[+\d][\d\s-]{7,}/g) ?? []).some((x) => normPhone(x) === n));
}

const parse = (r: ProfileRequest): ProfileRequest => ({ ...r, proposed: typeof r.proposed === 'string' ? JSON.parse(r.proposed) : r.proposed });

export async function myRequest(): Promise<ProfileRequest | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const [r] = await query<ProfileRequest>('SELECT * FROM profile_requests WHERE token = $1', [token]);
  return r ? parse(r) : null;
}

export async function loadRequests(statuses: RequestStatus[], limit = 200) {
  const rows = await query<ProfileRequest>('SELECT * FROM profile_requests WHERE status = ANY($1) ORDER BY updated_at DESC LIMIT $2', [statuses, limit]);
  return rows.map(parse);
}

export async function pendingCount() {
  const [r] = await query<{ n: number }>('SELECT count(*)::int AS n FROM profile_requests WHERE status = ANY($1)', [PENDING]);
  return Number(r?.n ?? 0);
}
