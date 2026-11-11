import 'server-only';
import { query } from './db';
import type { Tree } from './tree';
import { addDays } from './week';
import type { ReportData, ReportRow } from './types';

const TREND_WEEKS = 8;

/** Latest report per shepherd per week, for the selected week and the weeks before it. */
export async function loadWeeks(ws: string) {
  const from = addDays(ws, -7 * (TREND_WEEKS - 1));
  const rows = await query<ReportRow>(
    'SELECT id, shepherd_id, meeting_date, week_start, data, created_at FROM reports WHERE week_start >= $1 AND week_start <= $2 ORDER BY id',
    [from, ws],
  );
  const latest = new Map<string, ReportRow>(); // key: week|shepherd
  for (const r of rows) {
    if (typeof r.data === 'string') r.data = JSON.parse(r.data);
    latest.set(`${r.week_start}|${r.shepherd_id}`, r);
  }
  const weeks = Array.from({ length: TREND_WEEKS }, (_, i) => addDays(from, 7 * i));
  const byWeek = new Map<string, ReportRow[]>(weeks.map((w) => [w, []]));
  for (const r of latest.values()) byWeek.get(r.week_start)?.push(r);
  return { weeks, byWeek };
}

export function summarize(reports: ReportRow[]) {
  const n = reports.length;
  const present = sum(reports.map((r) => r.data.totalPresent));
  const absent = sum(reports.map((r) => r.data.totalAbsent));
  const perf = { excellent: 0, good: 0, fair: 0, difficult: 0 } as Record<string, number>;
  const goal = { yes: 0, partial: 0, no: 0 } as Record<string, number>;
  for (const r of reports) { perf[r.data.performance]++; goal[r.data.goalAchieved]++; }
  return {
    n, present, absent,
    attendance: present + absent ? present / (present + absent) : null,
    participation: n ? sum(reports.map((r) => r.data.participation)) / n : null,
    vulnerability: n ? sum(reports.map((r) => r.data.vulnerability)) / n : null,
    perf, goal,
  };
}

export function byBranch(tree: Tree, reports: ReportRow[]) {
  const shepherds = tree.shepherds;
  return tree.branches.map((b) => {
    const team = shepherds.filter((s) => s.branchId === b.id);
    const rs = reports.filter((r) => tree.person(r.shepherd_id)?.branchId === b.id);
    return { head: b, expected: team.length, submittedIds: new Set(rs.map((r) => r.shepherd_id)), ...summarize(rs) };
  });
}

/** Members marked absent in their shepherd's most recent N consecutive reports (N >= 2). */
export function absenceStreaks(tree: Tree, weeks: string[], byWeek: Map<string, ReportRow[]>) {
  const out: { memberId: number; shepherdId: number; streak: number }[] = [];
  const ordered = [...weeks].reverse();
  for (const s of tree.shepherds) {
    const reports = ordered.map((w) => byWeek.get(w)!.find((r) => r.shepherd_id === s.id)).filter(Boolean) as ReportRow[];
    if (reports.length < 2) continue;
    for (const m of tree.groupOf(s.id)) {
      let streak = 0;
      for (const r of reports) {
        if (r.data.absentIds.includes(m.id)) streak++;
        else break;
      }
      if (streak >= 2) out.push({ memberId: m.id, shepherdId: s.id, streak });
    }
  }
  return out.sort((a, b) => b.streak - a.streak);
}

export function sum(xs: number[]) { return xs.reduce((a, b) => a + (Number(b) || 0), 0); }

export function hasChallenge(d: ReportData) { return d.challenge.ids.length > 0 || d.challenge.note.trim() !== ''; }
