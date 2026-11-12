import Link from 'next/link';
import { notFound } from 'next/navigation';
import Header from '@/components/Header';
import PrintButton from '@/components/PrintButton';
import { requireDashboard } from '@/lib/auth';
import DeleteReport from '@/components/DeleteReport';
import { query } from '@/lib/db';
import { dashTitle, dashWho, navFor } from '@/lib/nav';
import { getTree, titled, type Tree } from '@/lib/tree';
import { fmtDate } from '@/lib/week';
import { GOAL, PERFORMANCE, SCALE, type Highlight, type ReportRow } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function ReportView({ params }: { params: Promise<{ id: string }> }) {
  const role = await requireDashboard();
  const tree = await getTree();
  const { nameOf, person } = tree;
  const { id } = await params;
  const [r] = await query<ReportRow>('SELECT * FROM reports WHERE id = $1', [Number(id) || 0]);
  if (!r) notFound();
  const d = typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
  const sh = person(r.shepherd_id)!;
  const perf = PERFORMANCE.find((p) => p.value === d.performance);
  const goal = GOAL.find((g) => g.value === d.goalAchieved);
  return (
    <>
      <Header title={dashTitle(role)} who={dashWho(role)} nav={navFor(role)} />
      <main className="page narrow report-view">
        <div className="row between no-print">
          <Link href={`/admin?week=${r.week_start}`}>← Back to the week</Link>
          <div className="row gap-s"><PrintButton />{role === 'super' && <DeleteReport id={r.id} />}</div>
        </div>
        <div className="page-head">
          <p className="eyebrow">Shepherding Assessment · Weekly group meeting report</p>
          <h1>{d.groupName || `${sh.name}'s group`}</h1>
          <p className="muted">
            {titled(sh)}{sh.phone && <> · <a href={`tel:${sh.phone}`}>{sh.phone}</a></>} · {nameOf(sh.branchId!)}&rsquo;s branch
          </p>
          <p className="muted">Met {fmtDate(d.meetingDate, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}{d.meetingTime && ` at ${d.meetingTime}`}</p>
        </div>

        <Block title="Attendance">
          <p className="big-stat"><b>{d.totalPresent}</b> present · <b>{d.totalAbsent}</b> absent{d.visitors ? ` · includes ${d.visitors} visitor${d.visitors > 1 ? 's' : ''}` : ''}</p>
          <Names t={tree} label="Present" ids={d.presentIds} />
          <Names t={tree} label="Absent" ids={d.absentIds} tone="bad" />
        </Block>

        <Block title="General meeting performance">
          {perf && <p><span className={`tag t-${perf.value}`}>{perf.label}</span> <span className="muted small">{perf.hint}</span></p>}
          <Text label="Atmosphere" v={d.atmosphere} />
        </Block>

        <Block title="Objective & alignment">
          <Text label="Main goal" v={d.mainGoal} />
          {goal && <p><b>Goal achieved:</b> {goal.label} <span className="muted small">— {goal.hint}</span></p>}
          <Text label="Summary" v={d.goalSummary} />
        </Block>

        <Block title="Engagement & interaction">
          <Score label="General participation" v={d.participation} />
          <Score label="Vulnerable and open" v={d.vulnerability} />
        </Block>

        <Block title="Discussion highlights">
          <HL t={tree} label="Stood out in the discussions" h={d.stoodOut} />
          <HL t={tree} label="Less interactive" h={d.lessInteractive} />
          <HL t={tree} label="Asked a deep question" h={d.deepQuestion} />
          <HL t={tree} label="Needed lots of explanation" h={d.neededExplanation} />
        </Block>

        <Block title="Post-meeting agenda">
          <Text label="Online Pastoral Care this week with" v={d.pastoralCare} />
          <div className="kv">
            <p className="kv-label">Visits this week</p>
            {d.visits.length === 0 ? <p className="muted">None</p> : (
              <ul className="plain-list">
                {d.visits.map((v: ReportRow['data']['visits'][number], i: number) => (
                  <li key={i}><span>{v.id ? nameOf(v.id) : v.name}{v.note && <small className="muted"> — {v.note}</small>}</span><span>{v.day || '—'}</span></li>
                ))}
              </ul>
            )}
          </div>
          <div className={`kv ${d.challenge.ids.length || d.challenge.note ? 'papa' : ''}`}>
            <p className="kv-label">Pressing challenge for Papa</p>
            {d.challenge.ids.length === 0 && !d.challenge.note ? <p className="muted">None reported</p> : (
              <>
                <p>{d.challenge.ids.map((i: number) => { const m = person(i); return <span key={i} className="pill">{nameOf(i)}{m?.phone && <a className="tel" href={`tel:${m.phone}`}> {m.phone}</a>}</span>; })}</p>
                {d.challenge.note && <p className="prewrap">{d.challenge.note}</p>}
              </>
            )}
          </div>
          <Text label="Will improve on" v={d.improve} />
        </Block>

        <Block title="Any other information">
          {d.otherInfo ? <p className="prewrap">{d.otherInfo}</p> : <p className="muted">—</p>}
        </Block>

        <div className="signoff">
          <div><p className="sig">{d.signature}</p><p className="muted small">Shepherd&rsquo;s signature</p></div>
          <div><p>{fmtDate(new Date(r.created_at).toISOString().slice(0, 10))}</p><p className="muted small">Submitted</p></div>
        </div>
      </main>
    </>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="card"><h2 className="section-title">{title}</h2>{children}</section>;
}
function Text({ label, v }: { label: string; v: string }) {
  return <div className="kv"><p className="kv-label">{label}</p>{v ? <p className="prewrap">{v}</p> : <p className="muted">—</p>}</div>;
}
function Names({ t, label, ids, tone }: { t: Tree; label: string; ids: number[]; tone?: string }) {
  if (!ids.length) return null;
  return <div className="kv"><p className="kv-label">{label} ({ids.length})</p><p>{ids.map((i) => <span key={i} className={`pill ${tone ?? ''}`}>{t.nameOf(i)}</span>)}</p></div>;
}
function HL({ t, label, h }: { t: Tree; label: string; h: Highlight }) {
  return (
    <div className="kv">
      <p className="kv-label">{label}</p>
      {h.ids.length === 0 && !h.note ? <p className="muted">—</p> : <p>{h.ids.map((i) => <span key={i} className="pill">{t.nameOf(i)}</span>)}{h.note && <span className="note"> {h.note}</span>}</p>}
    </div>
  );
}
function Score({ label, v }: { label: string; v: number }) {
  return (
    <div className="score-row">
      <span>{label}</span>
      <span className="dots">{[0, 1, 2, 3].map((n) => <i key={n} className={n <= v && v > 0 && n > 0 ? 'on' : ''} />)}<b>{v}</b><small className="muted"> / 3</small></span>
      <small className="muted">{SCALE.find((s) => s.value === v)?.hint}</small>
    </div>
  );
}
