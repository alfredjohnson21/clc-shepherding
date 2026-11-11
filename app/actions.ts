'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { accessCode, checkAdminPassword, clearSession, getSession, setSession } from '@/lib/auth';
import { query } from '@/lib/db';
import { groupOf, person, shepherds } from '@/lib/tree';
import { weekStart } from '@/lib/week';
import type { ReportData } from '@/lib/types';

export async function shepherdLogin(_: unknown, form: FormData) {
  const id = Number(form.get('id'));
  const code = String(form.get('code') || '').replace(/\D/g, '');
  if (!shepherds.some((s) => s.id === id)) return { error: 'Please choose your name.' };
  if (code !== accessCode(id)) return { error: 'That password is not correct. Check the message you were sent, or ask the church admin.' };
  await setSession({ kind: 'shepherd', id });
  redirect('/report');
}

export async function adminLogin(_: unknown, form: FormData) {
  if (!checkAdminPassword(String(form.get('password') || ''))) return { error: 'Incorrect password.' };
  await setSession({ kind: 'admin' });
  redirect('/admin');
}

export async function logout() {
  await clearSession();
  redirect('/');
}

const str = (v: unknown, max = 4000) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const ids = (v: unknown, allowed: Set<number>) =>
  Array.isArray(v) ? [...new Set(v.map(Number).filter((n) => allowed.has(n)))] : [];
const int = (v: unknown, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(Number(v) || 0)));

export async function submitReport(raw: ReportData): Promise<{ error?: string; id?: number }> {
  const s = await getSession();
  if (s?.kind !== 'shepherd') return { error: 'Your session has expired. Please sign in again.' };
  const me = person(s.id)!;
  const allowed = new Set(groupOf(me.id).map((p) => p.id));
  const meetingDate = str(raw.meetingDate, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(meetingDate)) return { error: 'Please enter the date of the meeting.' };
  if (!['excellent', 'good', 'fair', 'difficult'].includes(raw.performance)) return { error: 'Please say how the meeting went.' };
  if (!['yes', 'partial', 'no'].includes(raw.goalAchieved)) return { error: 'Please say whether the goal was achieved.' };
  if (!str(raw.signature)) return { error: 'Please sign the report with your name.' };

  const presentIds = ids(raw.presentIds, allowed);
  const absentIds = ids(raw.absentIds, allowed).filter((i) => !presentIds.includes(i));
  const visitors = int(raw.visitors, 0, 500);
  const hl = (h: ReportData['stoodOut']) => ({ ids: ids(h?.ids, allowed), note: str(h?.note) });
  const data: ReportData = {
    groupName: str(raw.groupName, 200),
    meetingDate,
    meetingTime: str(raw.meetingTime, 10),
    presentIds, absentIds, visitors,
    totalPresent: presentIds.length + visitors,
    totalAbsent: absentIds.length,
    performance: raw.performance,
    atmosphere: str(raw.atmosphere),
    mainGoal: str(raw.mainGoal),
    goalAchieved: raw.goalAchieved,
    goalSummary: str(raw.goalSummary),
    participation: int(raw.participation, 0, 3),
    vulnerability: int(raw.vulnerability, 0, 3),
    stoodOut: hl(raw.stoodOut), lessInteractive: hl(raw.lessInteractive),
    deepQuestion: hl(raw.deepQuestion), neededExplanation: hl(raw.neededExplanation),
    pastoralCare: str(raw.pastoralCare),
    visits: (Array.isArray(raw.visits) ? raw.visits : []).slice(0, 50)
      .map((v) => ({ id: allowed.has(Number(v?.id)) ? Number(v.id) : null, name: str(v?.name, 200), day: str(v?.day, 20), note: str(v?.note, 500) }))
      .filter((v) => v.id || v.name),
    challenge: { ids: ids(raw.challenge?.ids, allowed), note: str(raw.challenge?.note) },
    nextAgenda: str(raw.nextAgenda),
    improve: str(raw.improve),
    otherInfo: str(raw.otherInfo),
    signature: str(raw.signature, 200),
  };
  const [row] = await query<{ id: number }>(
    'INSERT INTO reports (shepherd_id, meeting_date, week_start, data) VALUES ($1, $2, $3, $4) RETURNING id',
    [me.id, meetingDate, weekStart(meetingDate), JSON.stringify(data)],
  );
  revalidatePath('/admin');
  return { id: row.id };
}
