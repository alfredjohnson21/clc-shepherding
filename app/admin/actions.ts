'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireSuper, resetViewToken } from '@/lib/auth';
import { query } from '@/lib/db';
import { CATEGORIES, freeUsername, getTree, type Category } from '@/lib/tree';
import { CARE_STATUS, MILESTONES, NOTE_KINDS, PERSONAL_FIELDS, type ProfileDetails } from '@/lib/types';

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

const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

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
  const details: ProfileDetails = {};
  for (const fld of PERSONAL_FIELDS) {
    const v = str(f, fld.key, 120);
    if (!v) continue;
    if ('date' in fld && !isDate(v)) return back(path, `Please enter a valid date for ${fld.label.toLowerCase()}.`);
    if ('options' in fld && !(fld.options as readonly string[]).includes(v)) return back(path, `Please choose a ${fld.label.toLowerCase()} from the list.`);
    details[fld.key] = v;
  }
  for (const m of MILESTONES) {
    const v = str(f, m.key, 10);
    if (!v) continue;
    if (!isDate(v)) return back(path, `Please enter a valid date for "${m.label}".`);
    details[m.key] = v;
  }
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
