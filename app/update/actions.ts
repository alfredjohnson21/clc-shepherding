'use server';
import { randomBytes } from 'crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { query } from '@/lib/db';
import { readDetails } from '@/lib/profileForm';
import { COOKIE, findByPhone, myRequest, normPhone, PENDING } from '@/lib/selfserve';
import { getTree } from '@/lib/tree';

const back = (msg: string) => redirect(`/update?err=${encodeURIComponent(msg)}`);

/** Step 1: the member types their phone number. */
export async function startRequest(f: FormData) {
  const phone = normPhone(String(f.get('phone') ?? ''));
  if (!phone) return back('Please enter your phone number, e.g. 0241234567.');

  const current = await myRequest();
  if (current && current.phone === phone && ['access_pending', 'editing', 'review_pending'].includes(current.status)) redirect('/update');

  // Keep the admin's list manageable if the link is abused.
  const [{ n }] = await query<{ n: number }>('SELECT count(*)::int AS n FROM profile_requests WHERE status = ANY($1)', [PENDING]);
  if (Number(n) >= 300) return back('Too many requests are waiting right now. Please try again later or see the church admin.');

  const matches = findByPhone(await getTree(), phone);
  const token = randomBytes(24).toString('base64url');
  await query(
    'INSERT INTO profile_requests (token, kind, phone, person_id, status) VALUES ($1, $2, $3, $4, $5)',
    [token, matches.length ? 'update' : 'join', phone, matches.length === 1 ? matches[0].id : null, matches.length ? 'access_pending' : 'editing'],
  );
  (await cookies()).set(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 60 });
  revalidatePath('/admin', 'layout');
  redirect('/update');
}

/** Step 3: once approved, the member sends their updated details for the admin to check. */
export async function submitProfile(f: FormData) {
  const r = await myRequest();
  if (!r || r.status !== 'editing') redirect('/update');
  const name = String(f.get('name') ?? '').trim().replace(/\s+/g, ' ').slice(0, 120);
  if (!name) return back('Please enter your full name.');
  const rawPhone = String(f.get('phone') ?? '').trim();
  const phone = rawPhone ? normPhone(rawPhone) : '';
  if (rawPhone && !phone) return back('Please check your phone number, e.g. 0241234567.');
  const d = readDetails(f);
  if ('error' in d) return back(d.error);
  await query(
    "UPDATE profile_requests SET proposed = $2::jsonb, status = 'review_pending', updated_at = now() WHERE id = $1",
    [r.id, JSON.stringify({ name, phone: phone || r.phone, details: d.details })],
  );
  revalidatePath('/admin', 'layout');
  redirect('/update');
}

/** Forget this phone's request (an unfinished one is withdrawn) and start again. */
export async function startOver() {
  const r = await myRequest();
  if (r && ['access_pending', 'editing', 'review_pending'].includes(r.status)) await query('DELETE FROM profile_requests WHERE id = $1', [r.id]);
  (await cookies()).delete(COOKIE);
  revalidatePath('/admin', 'layout');
  redirect('/update');
}
