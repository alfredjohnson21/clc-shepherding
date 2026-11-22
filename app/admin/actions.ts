'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireSuper, resetViewToken } from '@/lib/auth';
import { query } from '@/lib/db';
import { CATEGORIES, freeUsername, getTree, type Category } from '@/lib/tree';
import { readDetails, isDate } from '@/lib/profileForm';
import { findByPhone, normPhone, type ProfileRequest } from '@/lib/selfserve';
import { CARE_STATUS, NOTE_KINDS } from '@/lib/types';

const str = (f: FormData, k: string, max = 200) => String(f.get(k) ?? '').trim().slice(0, max);
const back = (path: string, msg: string, kind: 'err' | 'ok' = 'err') =>
  redirect(`${path}${path.includes('?') ? '&' : '?'}${kind}=${encodeURIComponent(msg)}`);

/** Validates the person form shared by "add" and "edit". Returns an error message or the clean values. */
async function readPerson(f: FormData, id: number | null) {
  const tree = await getTree();
  const name = str(f, 'name', 120);
  const role = str(f, 'role', 60);
  const phone = str(f, 'phone', 40);
  const category = str(f, 'category') as Category;
  const rt = str(f, 'reportsTo');
  const reportsToId = rt === '' ? null : Number(rt);
  if (!name) return { error: 'Please enter a name.' };
  if (phone && !/^[\d\s+()/-]{7,40}$/.test(phone)) return { error: 'The phone number can only contain digits, spaces and + ( ) - /.' };
  if (!CATEGORIES.includes(category)) return { error: 'Please choose a position.' };
  const current = id != null ? tree.person(id) : undefined;
  if (reportsToId === null) {
    // Only the Reverend sits at the top of the tree.
    if (!current || current.reportsToId !== null) return { error: 'Please choose who this person reports to.' };
  } else {
    const boss = tree.person(reportsToId);
    if (!boss?.active) return { error: 'The person they report to was not found.' };
    if (id != null && tree.isUnder(reportsToId, id)) return { error: 'Someone cannot report to themselves or to a person in their own group.' };
  }
  return { name, role, phone, category, reportsToId };
}

export async function addPerson(f: FormData) {
  await requireSuper();
  const v = await readPerson(f, null);
  const from = `/admin/people/new?under=${str(f, 'reportsTo')}`;
  if ('error' in v) return back(from, v.error!);
  const username = await freeUsername(v.name);
  const [row] = await query<{ id: number }>(
    `INSERT INTO people (id, name, role, phone, category, reports_to_id, username)
     SELECT COALESCE(MAX(id), 0) + 1, $1, $2, $3, $4, $5, $6 FROM people RETURNING id`,
    [v.name, v.role, v.phone, v.category, v.reportsToId, username],
  );
  revalidatePath('/', 'layout');
  back(`/admin/people/${row.id}`, `${v.name} was added. Their username is ${username}.`, 'ok');
}

export async function savePerson(f: FormData) {
  await requireSuper();
  const id = Number(f.get('id'));
  const path = `/admin/people/${id}`;
  const tree = await getTree();
  if (!tree.person(id)) return back('/admin/people', 'That person was not found.');
  const v = await readPerson(f, id);
  if ('error' in v) return back(path, v.error!);

  const username = str(f, 'username', 40).toLowerCase();
  if (!/^[a-z0-9][a-z0-9.-]{2,39}$/.test(username)) return back(path, 'The username must be 3–40 characters: letters, numbers, dots or dashes.');
  const clash = tree.all.find((p) => p.username === username && p.id !== id);
  if (clash) return back(path, `The username "${username}" is already used by ${clash.name}.`);

  const pw = str(f, 'password', 20).replace(/\s/g, '');
  if (pw && !/^\d{4,10}$/.test(pw)) return back(path, 'A custom password must be 4–10 digits (numbers only).');

  await query(
    `UPDATE people SET name = $2, role = $3, phone = $4, category = $5, reports_to_id = $6, username = $7, password = $8, updated_at = now() WHERE id = $1`,
    [id, v.name, v.role, v.phone, v.category, v.reportsToId, username, pw || null],
  );
  revalidatePath('/', 'layout');
  back(path, 'Saved.', 'ok');
}

/** Removing keeps their past reports readable; members must be moved to someone else first. */
export async function removePerson(f: FormData) {
  await requireSuper();
  const id = Number(f.get('id'));
  const tree = await getTree();
  const p = tree.person(id);
  if (!p) return back('/admin/people', 'That person was not found.');
  if (p.reportsToId === null) return back(`/admin/people/${id}`, 'The Reverend cannot be removed.');
  const group = tree.groupOf(id);
  if (group.length) return back(`/admin/people/${id}`, `Move ${p.name}'s ${group.length} group member${group.length > 1 ? 's' : ''} to another leader first.`);
  await query('UPDATE people SET active = false, updated_at = now() WHERE id = $1', [id]);
  revalidatePath('/', 'layout');
  back('/admin/people', `${p.name} was removed. Their past reports are kept.`, 'ok');
}

export async function restorePerson(f: FormData) {
  await requireSuper();
  const id = Number(f.get('id'));
  const tree = await getTree();
  const p = tree.person(id);
  if (!p) return back('/admin/people', 'That person was not found.');
  const boss = p.reportsToId != null ? tree.person(p.reportsToId) : null;
  if (boss && !boss.active) return back(`/admin/people/${id}`, `${boss.name}, who they report to, is removed. Choose a new leader for them below, then restore.`);
  await query('UPDATE people SET active = true, updated_at = now() WHERE id = $1', [id]);
  revalidatePath('/', 'layout');
  back(`/admin/people/${id}`, `${p.name} was restored.`, 'ok');
}

export async function deleteReport(f: FormData) {
  await requireSuper();
  const id = Number(f.get('id'));
  const [r] = await query<{ week_start: string }>('DELETE FROM reports WHERE id = $1 RETURNING week_start', [id]);
  revalidatePath('/', 'layout');
  redirect(r ? `/admin?week=${r.week_start}` : '/admin');
}

export async function resetHeadPastorLink() {
  await requireSuper();
  await resetViewToken();
  back('/admin/codes', 'A new Head Pastor link was made. The old link no longer works — send him the new one.', 'ok');
}


/** Makes sure a member_profiles row exists, so the updates below have something to change. */
const ensureProfile = (id: number) => query('INSERT INTO member_profiles (person_id) VALUES ($1) ON CONFLICT (person_id) DO NOTHING', [id]);

async function profileTarget(f: FormData) {
  const id = Number(f.get('id'));
  const p = (await getTree()).person(id);
  return p && p.level >= 1 ? p : null;
}

export async function saveProfile(f: FormData) {
  await requireSuper();
  const p = await profileTarget(f);
  if (!p) return back('/admin/members', 'That member was not found.');
  const path = `/admin/members/${p.id}/edit`;
  const r = readDetails(f);
  if ('error' in r) return back(path, r.error);
  const { details } = r;
  await ensureProfile(p.id);
  await query('UPDATE member_profiles SET details = $2::jsonb, updated_at = now() WHERE person_id = $1', [p.id, JSON.stringify(details)]);
  revalidatePath('/admin/members', 'layout');
  back(`/admin/members/${p.id}`, 'Profile details saved.', 'ok');
}

export async function setCareStatus(f: FormData) {
  await requireSuper();
  const p = await profileTarget(f);
  if (!p) return back('/admin/members', 'That member was not found.');
  const status = str(f, 'status');
  if (status && !CARE_STATUS.some((c) => c.value === status && c.value !== 'new')) return back(`/admin/members/${p.id}`, 'Please choose a status.');
  const note = status ? str(f, 'statusNote', 500) : '';
  await ensureProfile(p.id);
  await query('UPDATE member_profiles SET care_status = $2, status_note = $3, updated_at = now() WHERE person_id = $1', [p.id, status, note]);
  revalidatePath('/admin/members', 'layout');
  back(`/admin/members/${p.id}`, status ? 'Care status set.' : 'Care status is automatic again.', 'ok');
}

export async function addCareNote(f: FormData) {
  await requireSuper();
  const p = await profileTarget(f);
  if (!p) return back('/admin/members', 'That member was not found.');
  const path = `/admin/members/${p.id}`;
  const date = str(f, 'date', 10);
  const kind = str(f, 'kind', 40);
  const note = str(f, 'note', 2000);
  if (!isDate(date)) return back(path, 'Please enter the date of the note.');
  if (!(NOTE_KINDS as readonly string[]).includes(kind)) return back(path, 'Please choose what kind of note this is.');
  if (!note) return back(path, 'Please write the note.');
  await query('INSERT INTO care_notes (person_id, note_date, kind, note) VALUES ($1, $2, $3, $4)', [p.id, date, kind, note]);
  revalidatePath('/admin/members', 'layout');
  back(path, 'Note added.', 'ok');
}

export async function deleteCareNote(f: FormData) {
  await requireSuper();
  const id = Number(f.get('noteId'));
  const [r] = await query<{ person_id: number }>('DELETE FROM care_notes WHERE id = $1 RETURNING person_id', [id]);
  revalidatePath('/admin/members', 'layout');
  back(r ? `/admin/members/${r.person_id}` : '/admin/members', 'Note deleted.', 'ok');
}

/* ---------- Self-service profile requests (QR code) ---------- */

async function loadReq(f: FormData) {
  const [r] = await query<ProfileRequest>('SELECT * FROM profile_requests WHERE id = $1', [Number(f.get('id'))]);
  if (r && typeof r.proposed === 'string') r.proposed = JSON.parse(r.proposed);
  return r;
}
const done = (msg: string) => { revalidatePath('/admin', 'layout'); back('/admin/requests', msg, 'ok'); };

/** Lets the phone that asked see and edit this person's profile. */
export async function grantAccess(f: FormData) {
  await requireSuper();
  const r = await loadReq(f);
  if (!r || r.status !== 'access_pending') return back('/admin/requests', 'That request was already handled.');
  const personId = Number(f.get('personId'));
  const tree = await getTree();
  if (!findByPhone(tree, r.phone).some((p) => p.id === personId)) return back('/admin/requests', 'Please choose who this phone belongs to.');
  await query("UPDATE profile_requests SET status = 'editing', person_id = $2, updated_at = now() WHERE id = $1", [r.id, personId]);
  done(`${tree.nameOf(personId)} can now update their profile on their phone.`);
}

export async function rejectRequest(f: FormData) {
  await requireSuper();
  const r = await loadReq(f);
  if (!r || !['access_pending', 'review_pending', 'editing'].includes(r.status)) return back('/admin/requests', 'That request was already handled.');
  await query("UPDATE profile_requests SET status = 'rejected', decided_at = now(), updated_at = now() WHERE id = $1", [r.id]);
  done('Request declined.');
}

/** Saves the submitted changes (update), or adds the new person to the chosen group (join). */
export async function applyRequest(f: FormData) {
  await requireSuper();
  const r = await loadReq(f);
  if (!r || r.status !== 'review_pending' || !r.proposed) return back('/admin/requests', 'That request was already handled.');
  const { name, phone, details } = r.proposed;
  const tree = await getTree();
  let personId: number;
  if (r.kind === 'update') {
    const p = r.person_id != null ? tree.person(r.person_id) : undefined;
    if (!p) return back('/admin/requests', 'That person is no longer in the system. Decline the request instead.');
    await query('UPDATE people SET name = $2, phone = $3, updated_at = now() WHERE id = $1', [p.id, name, phone || p.phone]);
    personId = p.id;
  } else {
    const boss = tree.person(Number(f.get('reportsTo')));
    if (!boss?.active) return back('/admin/requests', 'Please choose which group to add them to.');
    const username = await freeUsername(name);
    const [row] = await query<{ id: number }>(
      `INSERT INTO people (id, name, role, phone, category, reports_to_id, username)
       SELECT COALESCE(MAX(id), 0) + 1, $1, '', $2, 'member', $3, $4 FROM people RETURNING id`,
      [name, phone, boss.id, username],
    );
    personId = row.id;
  }
  await ensureProfile(personId);
  await query('UPDATE member_profiles SET details = $2::jsonb, updated_at = now() WHERE person_id = $1', [personId, JSON.stringify(details)]);
  await query("UPDATE profile_requests SET status = 'applied', person_id = $2, decided_at = now(), updated_at = now() WHERE id = $1", [r.id, personId]);
  done(r.kind === 'update' ? `${name}'s profile was updated.` : `${name} was added to ${tree.nameOf(Number(f.get('reportsTo')))}'s group.`);
}

/** Saves the numbers typed on the "Missing phone numbers" page. Empty boxes are skipped. */
export async function savePhones(f: FormData) {
  await requireSuper();
  const tree = await getTree();
  const bad: string[] = [];
  let saved = 0;
  for (const [key, value] of f.entries()) {
    const m = /^phone_(\d+)$/.exec(key);
    const raw = typeof value === 'string' ? value.trim() : '';
    if (!m || !raw) continue;
    const p = tree.person(Number(m[1]));
    if (!p?.active || p.phone.trim()) continue;
    const phone = normPhone(raw);
    if (!phone) { bad.push(p.name); continue; }
    await query('UPDATE people SET phone = $2, updated_at = now() WHERE id = $1', [p.id, phone]);
    saved++;
  }
  revalidatePath('/', 'layout');
  const msg = `${saved} phone number${saved === 1 ? '' : 's'} saved.`;
  if (bad.length) back('/admin/phones', `${msg} Please check the number${bad.length === 1 ? '' : 's'} for ${bad.join(', ')} (e.g. 0241234567).`);
  back('/admin/phones', msg, 'ok');
}
