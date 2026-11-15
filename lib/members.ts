import 'server-only';
import { query } from './db';
import { loadWeeks } from './stats';
import type { Tree } from './tree';
import type { CareNote, CareStatus, ProfileDetails, ReportRow } from './types';
import { today, weekStart } from './week';

/** How many weeks of reports a profile looks back over. */
export const PROFILE_WEEKS = 26;

export type CellState = 'present' | 'absent' | 'unmarked' | 'no_report';
export type WeekCell = { week: string; state: CellState; reportId?: number; date?: string };
export type MentionKind = 'stoodOut' | 'deepQuestion' | 'lessInteractive' | 'neededExplanation' | 'visit' | 'challenge' | 'care';
export type Mention = { kind: MentionKind; week: string; date: string; reportId: number; shepherdId: number; note: string; day?: string };

export const MENTION_LABEL: Record<MentionKind, string> = {
  stoodOut: 'Stood out in the discussion',
  deepQuestion: 'Asked a deep question',
  lessInteractive: 'Was less interactive',
  neededExplanation: 'Needed lots of explanation',
  visit: 'Visit planned',
  challenge: 'Challenge raised for Papa',
  care: 'Online pastoral care',
};
export const POSITIVE: MentionKind[] = ['stoodOut', 'deepQuestion'];
export const CONCERN: MentionKind[] = ['lessInteractive', 'neededExplanation'];

export type MemberStats = {
  cells: WeekCell[]; // oldest → newest
  mentions: Mention[]; // newest first
  att4: number | null;
  att12: number | null;
  marked12: number;
  presentCount: number;
  absentCount: number;
  streak: number;
  lastPresent: string | null;
  /** Mentions per kind over the last 12 weeks. */
  counts12: Record<MentionKind, number>;
  /** Positive minus concern mentions per meeting attended, last 4 weeks vs. the 8 before. */
  trend: 'up' | 'down' | 'flat' | null;
  lastCare: string | null;
};

const emptyCounts = (): Record<MentionKind, number> =>
  ({ stoodOut: 0, deepQuestion: 0, lessInteractive: 0, neededExplanation: 0, visit: 0, challenge: 0, care: 0 });

const rate = (cells: WeekCell[]) => {
  const p = cells.filter((c) => c.state === 'present').length;
  const a = cells.filter((c) => c.state === 'absent').length;
  return { r: p + a ? p / (p + a) : null, n: p + a };
};

/** Everyone the profiles cover: all active people below the Reverend. */
export function profilePeople(tree: Tree) {
  return tree.people.filter((p) => p.level >= 1);
}

/** Builds each member's history from the latest report per leader per week. */
export function memberStats(tree: Tree, weeks: string[], byWeek: Map<string, ReportRow[]>, ids: number[]) {
  const wanted = new Set(ids);
  const marks = new Map<number, Map<string, { state: 'present' | 'absent'; r: ReportRow }>>();
  const mentions = new Map<number, Mention[]>();
  const reported = new Map<string, Set<number>>(); // week → shepherd ids that reported
  const mention = (id: number, kind: MentionKind, r: ReportRow, note: string, day?: string) => {
    if (!wanted.has(id)) return;
    if (!mentions.has(id)) mentions.set(id, []);
    mentions.get(id)!.push({ kind, week: r.week_start, date: r.meeting_date, reportId: r.id, shepherdId: r.shepherd_id, note, day });
  };

  for (const w of weeks) {
    reported.set(w, new Set());
    for (const r of byWeek.get(w) ?? []) {
      const d = r.data;
      reported.get(w)!.add(r.shepherd_id);
      for (const [list, state] of [[d.presentIds, 'present'], [d.absentIds, 'absent']] as const) {
        for (const id of list ?? []) {
          if (!wanted.has(id)) continue;
          if (!marks.has(id)) marks.set(id, new Map());
          const prev = marks.get(id)!.get(w);
          if (!prev || state === 'present') marks.get(id)!.set(w, { state, r });
        }
      }
      for (const k of ['stoodOut', 'deepQuestion', 'lessInteractive', 'neededExplanation'] as const) {
        for (const id of d[k]?.ids ?? []) mention(id, k, r, d[k].note);
      }
      for (const v of d.visits ?? []) if (v.id) mention(v.id, 'visit', r, v.note, v.day);
      for (const id of d.challenge?.ids ?? []) mention(id, 'challenge', r, d.challenge.note);
      for (const id of d.pastoralCareIds ?? []) mention(id, 'care', r, d.pastoralCare);
    }
  }

  const out = new Map<number, MemberStats>();
  const last12 = new Set(weeks.slice(-12));
  const last4 = new Set(weeks.slice(-4));
  for (const id of ids) {
    const leader = tree.person(id)?.reportsToId ?? null;
    const m = marks.get(id);
    const cells: WeekCell[] = weeks.map((w) => {
      const x = m?.get(w);
      if (x) return { week: w, state: x.state, reportId: x.r.id, date: x.r.meeting_date };
      if (leader != null && reported.get(w)?.has(leader)) {
        const r = byWeek.get(w)!.find((rr) => rr.shepherd_id === leader)!;
        return { week: w, state: 'unmarked', reportId: r.id, date: r.meeting_date };
      }
      return { week: w, state: 'no_report' };
    });
    const ms = (mentions.get(id) ?? []).sort((a, b) => b.date.localeCompare(a.date) || b.reportId - a.reportId);

    let streak = 0;
    for (let i = cells.length - 1; i >= 0; i--) {
      const s = cells[i].state;
      if (s === 'absent') streak++;
      else if (s === 'present') break;
    }
    const counts12 = emptyCounts();
    for (const x of ms) if (last12.has(x.week)) counts12[x.kind]++;

    const score = (set: (w: string) => boolean) => {
      const attended = cells.filter((c) => set(c.week) && c.state === 'present').length;
      if (!attended) return null;
      const net = ms.filter((x) => set(x.week)).reduce((a, x) => a + (POSITIVE.includes(x.kind) ? 1 : CONCERN.includes(x.kind) ? -1 : 0), 0);
      return net / attended;
    };
    const recent = score((w) => last4.has(w));
    const prior = score((w) => last12.has(w) && !last4.has(w));
    const trend = recent === null || prior === null ? null : recent - prior > 0.15 ? 'up' : prior - recent > 0.15 ? 'down' : 'flat';

    const r12 = rate(cells.filter((c) => last12.has(c.week)));
    const lastP = [...cells].reverse().find((c) => c.state === 'present');
    out.set(id, {
      cells, mentions: ms, streak, counts12, trend,
      att4: rate(cells.filter((c) => last4.has(c.week))).r,
      att12: r12.r, marked12: r12.n,
      presentCount: cells.filter((c) => c.state === 'present').length,
      absentCount: cells.filter((c) => c.state === 'absent').length,
      lastPresent: lastP?.date ?? null,
      lastCare: ms.find((x) => x.kind === 'care' || x.kind === 'visit')?.date ?? null,
    });
  }
  return out;
}

/** The automatic care status, with the reasons behind it. */
export function autoStatus(s: MemberStats): { status: CareStatus; reasons: string[] } {
  const weeks = s.cells.map((c) => c.week);
  const lastN = (n: number) => new Set(weeks.slice(-n));
  const urgent: string[] = [], care: string[] = [];
  const recentChallenge = s.mentions.find((x) => x.kind === 'challenge' && lastN(2).has(x.week));
  if (recentChallenge) urgent.push('A challenge was raised for Papa in the last two weeks');
  if (s.streak >= 3) urgent.push(`Absent ${s.streak} meetings in a row`);
  if (urgent.length) return { status: 'urgent', reasons: urgent };

  if (s.streak === 2) care.push('Absent the last two meetings');
  if (s.att12 !== null && s.marked12 >= 3 && s.att12 < 0.5) care.push(`Attended only ${Math.round(s.att12 * 100)}% of meetings in 12 weeks`);
  const quietWeeks = new Set(s.mentions.filter((x) => x.kind === 'lessInteractive' && lastN(4).has(x.week)).map((x) => x.week)).size;
  if (quietWeeks >= 2) care.push(`Less interactive in ${quietWeeks} of the last 4 weeks`);
  if (care.length) return { status: 'needs_care', reasons: care };

  if (!s.presentCount && !s.absentCount) return { status: 'new', reasons: ['Not marked present or absent in any report in the last 26 weeks'] };

  const positive8 = s.mentions.filter((x) => (x.kind === 'stoodOut' || x.kind === 'deepQuestion') && lastN(8).has(x.week)).length;
  const challenge4 = s.mentions.some((x) => x.kind === 'challenge' && lastN(4).has(x.week));
  if (s.att12 !== null && s.att12 >= 0.85 && positive8 > 0 && !challenge4) {
    return { status: 'thriving', reasons: [`Attended ${Math.round(s.att12 * 100)}% of meetings`, `Stood out or asked deep questions ${positive8}× in 8 weeks`] };
  }
  const reasons = [s.att12 !== null ? `Attended ${Math.round(s.att12 * 100)}% of meetings in 12 weeks` : 'Attending'];
  if (s.trend === 'down') reasons.push('Engagement is lower than before');
  return { status: 'stable', reasons };
}

export type Profile = { details: ProfileDetails; care_status: string; status_note: string; updated_at?: string };
const blankProfile = (): Profile => ({ details: {}, care_status: '', status_note: '' });

type ProfileRow = Profile & { person_id: number };
const parse = (r: ProfileRow): Profile => ({
  details: typeof r.details === 'string' ? JSON.parse(r.details) : r.details ?? {},
  care_status: r.care_status, status_note: r.status_note, updated_at: r.updated_at,
});

export async function loadProfiles() {
  const rows = await query<ProfileRow>('SELECT person_id, details, care_status, status_note, updated_at FROM member_profiles');
  return new Map(rows.map((r) => [r.person_id, parse(r)]));
}
export async function loadProfile(id: number): Promise<Profile> {
  const [r] = await query<ProfileRow>('SELECT person_id, details, care_status, status_note, updated_at FROM member_profiles WHERE person_id = $1', [id]);
  return r ? parse(r) : blankProfile();
}
export async function loadNotes(id: number) {
  return query<CareNote>('SELECT id, person_id, note_date, kind, note FROM care_notes WHERE person_id = $1 ORDER BY note_date DESC, id DESC', [id]);
}
/** Most recent admin note date per person. */
export async function lastNoteDates() {
  const rows = await query<{ person_id: number; d: string }>('SELECT person_id, max(note_date) AS d FROM care_notes GROUP BY person_id');
  return new Map(rows.map((r) => [r.person_id, r.d]));
}

/** The status shown: the admin's choice if set, else the automatic one. */
export function effectiveStatus(p: Profile | undefined, auto: { status: CareStatus }) {
  const manual = p?.care_status && p.care_status !== 'new' ? (p.care_status as CareStatus) : null;
  return { status: manual ?? auto.status, manual: !!manual };
}

/** Loads the last 26 weeks of reports and computes stats for the given people. */
export async function loadMemberStats(tree: Tree, ids: number[]) {
  const { weeks, byWeek } = await loadWeeks(weekStart(today()), PROFILE_WEEKS);
  return { weeks, stats: memberStats(tree, weeks, byWeek, ids) };
}
