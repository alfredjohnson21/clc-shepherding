import Link from 'next/link';
import { notFound } from 'next/navigation';
import { addCareNote, deleteCareNote, setCareStatus } from '@/app/admin/actions';
import ConfirmButton from '@/components/ConfirmButton';
import Flash from '@/components/Flash';
import Header from '@/components/Header';
import StatusBadge from '@/components/StatusBadge';
import { requireDashboard } from '@/lib/auth';
import { MENTION_LABEL, autoStatus, effectiveStatus, loadMemberStats, loadNotes, loadProfile, type MentionKind, type WeekCell } from '@/lib/members';
import { dashTitle, dashWho, navFor } from '@/lib/nav';
import { CATEGORY_LABEL, getTree, titled } from '@/lib/tree';
import { CARE_STATUS, MILESTONES, NOTE_KINDS, PERSONAL_FIELDS } from '@/lib/types';
import { addDays, fmtDate, today, weekStart } from '@/lib/week';

export const dynamic = 'force-dynamic';

const pct = (x: number | null) => (x === null ? '—' : `${Math.round(x * 100)}%`);
const CELL_LABEL: Record<WeekCell['state'], string> = { present: 'Present', absent: 'Absent', unmarked: 'Not marked', no_report: 'No report' };
const TONE: Partial<Record<MentionKind, string>> = { stoodOut: 'good', deepQuestion: 'good', lessInteractive: 'warn', neededExplanation: 'warn', challenge: 'bad', visit: 'care', care: 'care' };

type Item = { date: string; title: string; note?: string; tone: string; href?: string; by?: string; noteId?: number };

export default async function MemberProfile({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; err?: string }> }) {
  const role = await requireDashboard();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const tree = await getTree();
  const p = tree.person(Number(id));
  if (!p || p.level < 1) notFound();
  const [{ stats }, profile, notes] = await Promise.all([loadMemberStats(tree, [p.id]), loadProfile(p.id), loadNotes(p.id)]);
  const s = stats.get(p.id)!;
  const auto = autoStatus(s);
  const eff = effectiveStatus(profile, auto);
  const d = profile.details;
  const boss = p.reportsToId != null ? tree.person(p.reportsToId) : null;
  const group = tree.groupOf(p.id);
  const first = p.name.split(' ')[0];
  const isSuper = role === 'super';

  const twelveAgo = addDays(weekStart(today()), -7 * 11);
  const notes12 = notes.filter((n) => n.note_date >= twelveAgo).length;
  const positive = s.counts12.stoodOut + s.counts12.deepQuestion;
  const concern = s.counts12.lessInteractive + s.counts12.neededExplanation;
  const careContacts = s.counts12.visit + s.counts12.care + notes12;
  const doneMilestones = MILESTONES.filter((m) => d[m.key]);
  const challenges = s.mentions.filter((m) => m.kind === 'challenge');

  const items: Item[] = [
    ...s.mentions.map((m) => ({
      date: m.date, tone: TONE[m.kind] ?? '', href: `/admin/reports/${m.reportId}`,
      title: MENTION_LABEL[m.kind] + (m.kind === 'visit' && m.day ? ` (${m.day})` : ''),
      note: m.note, by: `${tree.nameOf(m.shepherdId)}’s report`,
    })),
    ...notes.map((n) => ({ date: n.note_date, tone: 'note', title: n.kind, note: n.note, by: 'Admin note', noteId: n.id })),
    ...MILESTONES.filter((m) => d[m.key]).map((m) => ({ date: d[m.key]!, tone: 'milestone', title: m.label, by: 'Milestone' })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <>
      <Header title={dashTitle(role)} who={dashWho(role)} nav={navFor(role)} />
      <main className="page wide">
        <Link href="/admin/members">← Members</Link>
        <div className="profile-head">
          <div className="page-head">
            <p className="eyebrow">{p.active ? 'Member profile' : 'Removed member'}</p>
            <h1>{titled(p)}</h1>
            <p className="muted">
              {CATEGORY_LABEL[p.category]}
              {p.phone && <> · <a href={`tel:${p.phone}`}>{p.phone}</a></>}
              {boss && <> · in {titled(boss)}&rsquo;s group</>}
              {p.branchId && p.branchId !== p.id && p.branchId !== boss?.id && <> · {tree.nameOf(p.branchId)}&rsquo;s branch</>}
            </p>
            {group.length > 0 && <p className="muted small">Leads {group.length}: {group.map((m, i) => <span key={m.id}>{i > 0 && ', '}<Link href={`/admin/members/${m.id}`}>{m.name}</Link></span>)}</p>}
          </div>
          {isSuper && <div className="row gap-s"><Link className="btn small" href={`/admin/members/${p.id}/edit`}>Edit details</Link><Link className="btn small ghost" href={`/admin/people/${p.id}`}>Person settings</Link></div>}
        </div>
        <Flash ok={sp.ok} err={sp.err} />

        <section className={`card care-card c-${eff.status}`}>
          <div className="row between">
            <div>
              <p className="kv-label">Care status</p>
              <StatusBadge status={eff.status} manual={eff.manual} big />
            </div>
          </div>
          {eff.manual && profile.status_note && <p className="mt-s prewrap">{profile.status_note}</p>}
          <ul className="reasons">
            {eff.manual && <li className="muted">Set by the admin. From the reports alone it would be <b>{CARE_STATUS.find((c) => c.value === auto.status)!.label}</b>:</li>}
            {auto.reasons.map((r) => <li key={r}>{r}</li>)}
          </ul>
          {isSuper && (
            <details className="mt-s">
              <summary className="link-btn">Change care status</summary>
              <form action={setCareStatus} className="status-form">
                <input type="hidden" name="id" value={p.id} />
                <select name="status" defaultValue={profile.care_status} aria-label="Care status">
                  <option value="">Automatic (from reports)</option>
                  {CARE_STATUS.filter((c) => c.value !== 'new').map((c) => <option key={c.value} value={c.value}>{c.label}: {c.hint}</option>)}
                </select>
                <input name="statusNote" defaultValue={profile.status_note} placeholder="Why? (optional)" maxLength={500} />
                <button className="btn small primary">Save status</button>
              </form>
            </details>
          )}
        </section>

        <section className="kpis">
          <Kpi label="Attendance" value={pct(s.att12)} sub={`last 12 weeks · ${pct(s.att4)} last 4`} meter={s.att12 ?? 0} />
          <Kpi label="Missed in a row" value={String(s.streak)} sub={s.lastPresent ? `last present ${fmtDate(s.lastPresent, { day: 'numeric', month: 'short' })}` : 'not marked present recently'} meter={Math.min(s.streak, 4) / 4} tone={s.streak >= 3 ? 'bad' : s.streak === 2 ? 'warn' : ''} />
          <Kpi label="Engagement" value={`${positive}`} sub={`stood out / deep questions in 12 weeks${concern ? ` · ${concern} concerns` : ''}`} meter={positive + concern ? positive / (positive + concern) : 0} trend={s.trend} />
          <Kpi label="Care contacts" value={`${careContacts}`} sub={`visits, online care and notes in 12 weeks`} meter={Math.min(careContacts, 6) / 6} />
        </section>

        <section className="card">
          <h2 className="h2">Attendance, last 26 weeks</h2>
          <div className="strip" role="list">
            {s.cells.map((c) => {
              const label = `Week of ${fmtDate(c.week, { day: 'numeric', month: 'short' })}: ${CELL_LABEL[c.state]}`;
              return c.reportId
                ? <Link key={c.week} role="listitem" href={`/admin/reports/${c.reportId}`} className={`cell ${c.state}`} title={label} aria-label={label} />
                : <span key={c.week} role="listitem" className={`cell ${c.state}`} title={label} aria-label={label} />;
            })}
          </div>
          <div className="strip-axis muted small"><span>{fmtDate(s.cells[0].week, { day: 'numeric', month: 'short' })}</span><span>This week</span></div>
          <ul className="legend">
            <li><i className="cell present" />Present <b>{s.presentCount}</b></li>
            <li><i className="cell absent" />Absent <b>{s.absentCount}</b></li>
            <li><i className="cell unmarked" />Not marked</li>
            <li><i className="cell no_report" />No report from leader</li>
          </ul>
        </section>

        <div className="cols">
          <section className="card">
            <h2 className="h2">In the meetings <span className="muted small">last 12 weeks</span></h2>
            <ul className="plain-list">
              {(['stoodOut', 'deepQuestion', 'lessInteractive', 'neededExplanation'] as const).map((k) => (
                <li key={k}><span><i className={`dot ${TONE[k]}`} />{MENTION_LABEL[k]}</span><b>{s.counts12[k]}</b></li>
              ))}
            </ul>
            <h2 className="h2 mt">Pastoral care</h2>
            <ul className="plain-list">
              <li><span>Visits planned by leader</span><b>{s.counts12.visit}</b></li>
              <li><span>Online pastoral care</span><b>{s.counts12.care}</b></li>
              <li><span>Admin notes</span><b>{notes12}</b></li>
              <li><span>Challenges raised for Papa <small className="muted">(26 weeks)</small></span><b className={challenges.length ? 'bad-text' : ''}>{challenges.length}</b></li>
            </ul>
            {challenges.length > 0 && (
              <div className="kv papa mt-s">
                <p className="kv-label">Most recent challenge · {fmtDate(challenges[0].date)}</p>
                <p className="prewrap">{challenges[0].note || 'No details given.'}</p>
                <p className="small mt-s"><Link href={`/admin/reports/${challenges[0].reportId}`}>Open report</Link></p>
              </div>
            )}
          </section>

          <section className="card">
            <h2 className="h2">Spiritual journey <span className="count">{doneMilestones.length} of {MILESTONES.length}</span></h2>
            <div className="meter"><span style={{ width: `${(doneMilestones.length / MILESTONES.length) * 100}%` }} /></div>
            <ul className="milestones">
              {MILESTONES.map((m) => (
                <li key={m.key} className={d[m.key] ? 'done' : ''}>
                  <span className="tick" aria-hidden>{d[m.key] ? '✓' : ''}</span>
                  <span>{m.label}</span>
                  <span className="muted small">{d[m.key] ? fmtDate(d[m.key]!) : 'Not yet'}</span>
                </li>
              ))}
            </ul>
            <h2 className="h2 mt">Personal details</h2>
            <dl className="details">
              {PERSONAL_FIELDS.map((f) => (
                <div key={f.key}><dt>{f.label}</dt><dd>{d[f.key] ? ('date' in f ? fmtDate(d[f.key]!, { day: 'numeric', month: 'long' }) : d[f.key]) : <span className="muted">—</span>}</dd></div>
              ))}
            </dl>
            {isSuper && doneMilestones.length + PERSONAL_FIELDS.filter((f) => d[f.key]).length === 0 && (
              <p className="mt-s"><Link className="btn small" href={`/admin/members/${p.id}/edit`}>Add {first}&rsquo;s details</Link></p>
            )}
          </section>
        </div>

        <section className="card">
          <h2 className="h2">Timeline <span className="count">{items.length}</span></h2>
          {isSuper && (
            <form action={addCareNote} className="note-form">
              <input type="hidden" name="id" value={p.id} />
              <input type="date" name="date" defaultValue={today()} required aria-label="Date" />
              <select name="kind" required defaultValue="" aria-label="Kind of note">
                <option value="" disabled>Kind of note…</option>
                {NOTE_KINDS.map((k) => <option key={k}>{k}</option>)}
              </select>
              <textarea name="note" rows={2} required maxLength={2000} placeholder={`Add a pastoral note about ${first} (call, counselling, prayer request…)`} />
              <button className="btn small primary">Add note</button>
            </form>
          )}
          {items.length === 0 ? <p className="muted mt-s">Nothing recorded yet.</p> : (
            <ol className="timeline">
              {items.map((it, i) => (
                <li key={i} className={`tl-${it.tone}`}>
                  <span className="tl-date">{fmtDate(it.date, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  <div className="tl-body">
                    <p><b>{it.title}</b> <small className="muted">· {it.href ? <Link href={it.href}>{it.by}</Link> : it.by}</small></p>
                    {it.note && <p className="prewrap note">{it.note}</p>}
                  </div>
                  {isSuper && it.noteId && (
                    <form action={deleteCareNote}>
                      <input type="hidden" name="noteId" value={it.noteId} />
                      <ConfirmButton label="Delete" confirm="Delete this note? This cannot be undone." className="link-btn danger-text" />
                    </form>
                  )}
                </li>
              ))}
            </ol>
          )}
        </section>
      </main>
    </>
  );
}

function Kpi({ label, value, sub, meter, tone = '', trend }: { label: string; value: string; sub: string; meter: number; tone?: string; trend?: 'up' | 'down' | 'flat' | null }) {
  return (
    <div className={`kpi card ${tone}`}>
      <p className="kpi-label">{label}{trend && trend !== 'flat' && <span className={`trend-${trend}`}>{trend === 'up' ? ' ▲ rising' : ' ▼ falling'}</span>}</p>
      <p className="kpi-value">{value}</p>
      <div className="meter"><span style={{ width: `${Math.max(0, Math.min(1, meter)) * 100}%` }} /></div>
      <p className="muted small">{sub}</p>
    </div>
  );
}
