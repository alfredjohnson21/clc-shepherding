// Fills the LOCAL dev database (./.data/pglite) with 6 weeks of sample reports so the dashboard can be previewed.
// Usage: node scripts/seed-demo.mjs   (never run against production)
import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
const tree = JSON.parse(fs.readFileSync(new URL('../data/tree.json', import.meta.url)));
fs.mkdirSync('./.data', { recursive: true });
const db = new PGlite('./.data/pglite');
await db.exec(`CREATE TABLE IF NOT EXISTS reports (id SERIAL PRIMARY KEY, shepherd_id INTEGER NOT NULL, meeting_date TEXT NOT NULL, week_start TEXT NOT NULL, data JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());`);
await db.exec('DELETE FROM reports');
const shepherds = tree.filter((p) => p.level >= 1 && tree.some((c) => c.reportsToId === p.id));
let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const pick = (a) => a[Math.floor(rnd() * a.length)];
const iso = (d) => d.toISOString().slice(0, 10);
const now = new Date(); const dow = (now.getUTCDay() + 6) % 7;
const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - dow));
const chronic = new Set(tree.filter((p) => p.level >= 2 && rnd() < 0.06).map((p) => p.id));
for (let w = 5; w >= 0; w--) {
  const ws = new Date(monday); ws.setUTCDate(ws.getUTCDate() - 7 * w);
  for (const s of shepherds) {
    if (rnd() < (w === 0 ? 0.35 : 0.2)) continue;
    const md = new Date(ws); md.setUTCDate(md.getUTCDate() + Math.floor(rnd() * (w === 0 ? Math.max(1, dow + 1) : 7)));
    const group = tree.filter((p) => p.reportsToId === s.id);
    const present = [], absent = [];
    for (const m of group) (chronic.has(m.id) || rnd() < 0.18 ? absent : present).push(m.id);
    const perf = pick(['excellent', 'good', 'good', 'good', 'fair', 'difficult']);
    const ch = rnd() < 0.15 && group.length ? { ids: [pick(group).id], note: pick(['Lost their job this week and is struggling to pay rent.', 'Mother is in hospital — family requests prayer and a visit.', 'Going through a difficult season in their marriage; asked to speak with Papa.']) } : { ids: [], note: '' };
    const data = { groupName: `${s.name.split(' ')[0]}'s group`, meetingDate: iso(md), meetingTime: '18:30', presentIds: present, absentIds: absent, visitors: rnd() < 0.2 ? 1 : 0,
      totalPresent: present.length, totalAbsent: absent.length, performance: perf, atmosphere: 'Warm and attentive; good worship before discussion.',
      mainGoal: pick(['Understanding grace (Ephesians 2)', 'Prayer life and consistency', 'Serving one another in love']), goalAchieved: pick(['yes', 'yes', 'partial', 'no']), goalSummary: 'Members connected the teaching to daily life.',
      participation: Math.floor(rnd() * 4), vulnerability: Math.floor(rnd() * 4),
      stoodOut: { ids: present.slice(0, 1), note: '' }, lessInteractive: { ids: present.slice(-1), note: '' }, deepQuestion: { ids: present.slice(1, 2), note: 'Asked how to forgive someone who keeps hurting you.' }, neededExplanation: { ids: [], note: '' },
      pastoralCare: 'Deaconess on the team', visits: absent.slice(0, 1).map((id) => ({ id, name: '', day: pick(['Tuesday', 'Thursday', 'Saturday']), note: 'Missed meeting' })),
      challenge: ch, nextAgenda: 'Continue the series', improve: 'Start on time', otherInfo: '', signature: s.name };
    data.totalPresent += data.visitors;
    await db.query('INSERT INTO reports (shepherd_id, meeting_date, week_start, data) VALUES ($1,$2,$3,$4)', [s.id, iso(md), iso(ws), JSON.stringify(data)]);
  }
}
console.log((await db.query('SELECT count(*) FROM reports')).rows);
await db.close();
