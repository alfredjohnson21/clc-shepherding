import Link from 'next/link';
import Header from '@/components/Header';
import { requireDashboard } from '@/lib/auth';
import { absenceStreaks, byBranch, hasChallenge, loadWeeks, summarize } from '@/lib/stats';
import { CATEGORIES, CATEGORY_LABEL, getTree, titled, type Person } from '@/lib/tree';

/** Branch head first, then Executive Council, Admin Council, other pastors, other leaders, members. */
const byRank = (a: Person, b: Person) =>
  (a.level === 1 ? 0 : 1) - (b.level === 1 ? 0 : 1) ||
  CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category) ||
  a.name.localeCompare(b.name);
import { addDays, fmtDate, today, weekLabel, weekStart } from '@/lib/week';
import { PERFORMANCE } from '@/lib/types';
import { dashTitle, dashWho, navFor } from '@/lib/nav';

export const dynamic = 'force-dynamic';

const pct = (x: number | null) => (x === null ? '—' : `${Math.round(x * 100)}%`);
const dec = (x: number | null) => (x === null ? '—' : x.toFixed(1));
const PERF_LABEL: Record<string, string> = Object.fromEntries(PERFORMANCE.map((p) => [p.value, p.label]));
const GOAL_LABEL: Record<string, string> = { yes: 'Achieved', partial: 'Partially', no: 'Not achieved' };


export default async function Dashboard({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const role = await requireDashboard();
  const tree = await getTree();
  const { nameOf, person, shepherds } = tree;
  const sp = await searchParams;
  const current = weekStart(today());
  const ws = sp.week && /^\d{4}-\d{2}-\d{2}$/.test(sp.week) ? weekStart(sp.week) : current;
  const { weeks, byWeek } = await loadWeeks(ws);
  const reports = byWeek.get(ws)!.sort((a, b) => nameOf(a.shepherd_id).localeCompare(nameOf(b.shepherd_id)));
  const s = summarize(reports);
  const branchRows = byBranch(tree, reports);
  const submitted = new Set(reports.map((r) => r.shepherd_id));
  const missing = shepherds.filter((p) => !submitted.has(p.id));
  const challenges = reports.filter((r) => hasChallenge(r.data));
  const streaks = absenceStreaks(tree, weeks, byWeek);
  const visits = reports.flatMap((r) => r.data.visits.map((v) => ({ ...v, shepherdId: r.shepherd_id, reportId: r.id })));
  const trend = weeks.map((w) => ({ w, ...summarize(byWeek.get(w)!) }));

  return (
    <>
      <Header title={dashTitle(role)} who={dashWho(role)} nav={navFor(role)} />
      <main className="page wide">
        <div className="dash-head">
          <div>
            <p className="eyebrow">Shepherding overview</p>
            <h1>Week of {weekLabel(ws)}</h1>
          </div>
          <div className="week-nav">
            <Link className="btn small ghost" href={`/admin?week=${addDays(ws, -7)}`}>← Previous</Link>
            {ws !== current && <Link className="btn small ghost" href="/admin">This week</Link>}
            {ws < current && <Link className="btn small ghost" href={`/admin?week=${addDays(ws, 7)}`}>Next →</Link>}
          </div>
        </div>

        <section className="kpis">
          <Kpi label="Reports received" value={`${s.n}`} sub={`of ${shepherds.length} shepherds`} meter={s.n / shepherds.length} />
          <Kpi label="Attendance" value={pct(s.attendance)} sub={`${s.present} present · ${s.absent} absent`} meter={s.attendance ?? 0} />
          <Kpi label="Participation" value={dec(s.participation)} sub="average, out of 3" meter={(s.participation ?? 0) / 3} />
          <Kpi label="Openness" value={dec(s.vulnerability)} sub="vulnerable & open, out of 3" meter={(s.vulnerability ?? 0) / 3} />
        </section>

        <section className="card attention">
          <h2 className="h2">For Papa&rsquo;s attention <span className="count">{challenges.length}</span></h2>
          {challenges.length === 0 ? (
            <p className="muted">No pressing challenges were reported this week.</p>
          ) : (
            <ul className="challenge-list">
              {challenges.map((r) => {
                const sh = person(r.shepherd_id)!;
                return (
                  <li key={r.id}>
                    <div className="challenge-who">
                      {r.data.challenge.ids.map((id) => {
                        const m = person(id);
                        return <span key={id} className="pill">{nameOf(id)}{m?.phone && <a href={`tel:${m.phone}`} className="tel"> {m.phone}</a>}</span>;
                      })}
                    </div>
                    {r.data.challenge.note && <p className="challenge-note">{r.data.challenge.note}</p>}
                    <p className="muted small">
                      Reported by {titled(sh)} · {nameOf(sh.branchId!)}&rsquo;s branch · <Link href={`/admin/reports/${r.id}`}>Open report</Link>
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <div className="cols">
          <section className="card">
            <h2 className="h2">Who has reported <span className="count">{missing.length} not yet</span></h2>
            {missing.length === 0 && <p className="muted">Every shepherd has reported this week.</p>}
            <div className="missing">
              {branchRows.filter((b) => shepherds.some((m) => m.branchId === b.head.id)).map((b) => (
                <div key={b.head.id}>
                  <p className="branch-label">{titled(b.head)}</p>
                  <ul className="plain-list">
                    {shepherds.filter((m) => m.branchId === b.head.id).sort(byRank).map((m) => {
                      const sent = reports.find((r) => r.shepherd_id === m.id);
                      return (
                        <li key={m.id}>
                          <span>{m.name} <small className="muted">{CATEGORY_LABEL[m.category]}</small></span>
                          {sent ? <Link href={`/admin/reports/${sent.id}`} className="sent">✓ Sent</Link>
                            : m.phone ? <a href={`tel:${m.phone}`} className="tel">{m.phone}</a> : <span className="muted small">no phone</span>}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          <section className="card">
            <h2 className="h2">Absent two weeks or more <span className="count">{streaks.length}</span></h2>
            {streaks.length === 0 ? <p className="muted">No member has been marked absent in consecutive reports.</p> : (
              <ul className="plain-list">
                {streaks.map((x) => {
                  const m = person(x.memberId)!;
                  return (
                    <li key={x.memberId}>
                      <span>{m.name} <small className="muted">under {nameOf(x.shepherdId)}</small></span>
                      <span className="row gap-s">
                        <span className={`streak s${Math.min(x.streak, 4)}`}>{x.streak} weeks</span>
                        {m.phone && <a href={`tel:${m.phone}`} className="tel">{m.phone}</a>}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}

            <h2 className="h2 mt">Visits planned <span className="count">{visits.length}</span></h2>
            {visits.length === 0 ? <p className="muted">No visits planned in this week&rsquo;s reports.</p> : (
              <ul className="plain-list">
                {visits.map((v, i) => (
                  <li key={i}>
                    <span>{v.id ? nameOf(v.id) : v.name}{v.note && <small className="muted"> — {v.note}</small>}</span>
                    <span className="muted small">{v.day || 'Day not set'} · {nameOf(v.shepherdId)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="cols">
          <section className="card">
            <h2 className="h2">How meetings went</h2>
            <Dist parts={[
              { key: 'excellent', label: 'Excellent', n: s.perf.excellent },
              { key: 'good', label: 'Good', n: s.perf.good },
              { key: 'fair', label: 'Fair', n: s.perf.fair },
              { key: 'difficult', label: 'Difficult', n: s.perf.difficult },
            ]} />
            <h3 className="h3 mt">Was the meeting&rsquo;s goal achieved?</h3>
            <Dist parts={[
              { key: 'excellent', label: 'Yes, fully', n: s.goal.yes },
              { key: 'fair', label: 'Partially', n: s.goal.partial },
              { key: 'difficult', label: 'No', n: s.goal.no },
            ]} />
          </section>
          <section className="card">
            <h2 className="h2">Last 8 weeks</h2>
            <Trend data={trend.map((t) => ({ w: t.w, n: t.n, att: t.attendance }))} total={shepherds.length} selected={ws} />
          </section>
        </div>

        <section className="card">
          <h2 className="h2">By branch</h2>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Branch (Executive Council)</th><th>Reports</th><th>Attendance</th><th>Participation</th><th>Openness</th><th>Meetings</th></tr>
              </thead>
              <tbody>
                {branchRows.map((b) => (
                  <tr key={b.head.id}>
                    <td><b>{b.head.name}</b><br /><small className="muted">{b.head.role}</small></td>
                    <td>{b.expected === 0 ? <span className="muted">no groups</span> : <span className={b.n === b.expected ? 'good-text' : ''}>{b.n} / {b.expected}</span>}</td>
                    <td>{pct(b.attendance)}</td>
                    <td>{dec(b.participation)}</td>
                    <td>{dec(b.vulnerability)}</td>
                    <td><MiniDist perf={b.perf} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card">
          <h2 className="h2">This week&rsquo;s reports <span className="count">{reports.length}</span></h2>
          {reports.length === 0 ? <p className="muted">No reports yet for this week.</p> : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Shepherd</th><th>Meeting</th><th>Present</th><th>Went</th><th>Goal</th><th>Scores</th><th></th></tr></thead>
                <tbody>
                  {reports.map((r) => (
                    <tr key={r.id}>
                      <td><b>{nameOf(r.shepherd_id)}</b><br /><small className="muted">{r.data.groupName}</small></td>
                      <td>{fmtDate(r.meeting_date, { weekday: 'short', day: 'numeric', month: 'short' })}{r.data.meetingTime && <small className="muted"> {r.data.meetingTime}</small>}</td>
                      <td>{r.data.totalPresent} <small className="muted">/ {r.data.totalPresent + r.data.totalAbsent}</small></td>
                      <td><span className={`tag t-${r.data.performance}`}>{PERF_LABEL[r.data.performance]}</span></td>
                      <td>{GOAL_LABEL[r.data.goalAchieved]}</td>
                      <td>{r.data.participation} · {r.data.vulnerability}</td>
                      <td><Link href={`/admin/reports/${r.id}`}>View</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <p className="muted small center">Showing the latest report from each shepherd for meetings held {weekLabel(ws)}.</p>
      </main>
    </>
  );
}

function Kpi({ label, value, sub, meter }: { label: string; value: string; sub: string; meter: number }) {
  return (
    <div className="kpi card">
      <p className="kpi-label">{label}</p>
      <p className="kpi-value">{value}</p>
      <div className="meter"><span style={{ width: `${Math.max(0, Math.min(1, meter)) * 100}%` }} /></div>
      <p className="muted small">{sub}</p>
    </div>
  );
}

function Dist({ parts }: { parts: { key: string; label: string; n: number }[] }) {
  const total = parts.reduce((a, p) => a + p.n, 0);
  return (
    <div className="dist">
      <div className="dist-bar">
        {total === 0 ? <span className="empty" style={{ width: '100%' }} /> :
          parts.filter((p) => p.n).map((p) => <span key={p.label} className={`seg-${p.key}`} style={{ width: `${(p.n / total) * 100}%` }} title={`${p.label}: ${p.n}`} />)}
      </div>
      <ul className="legend">
        {parts.map((p) => <li key={p.label}><i className={`seg-${p.key}`} />{p.label} <b>{p.n}</b></li>)}
      </ul>
    </div>
  );
}

function MiniDist({ perf }: { perf: Record<string, number> }) {
  const total = Object.values(perf).reduce((a, b) => a + b, 0);
  if (!total) return <span className="muted">—</span>;
  return (
    <div className="dist-bar mini" title={Object.entries(perf).map(([k, v]) => `${PERF_LABEL[k]}: ${v}`).join(', ')}>
      {(['excellent', 'good', 'fair', 'difficult'] as const).filter((k) => perf[k]).map((k) => <span key={k} className={`seg-${k}`} style={{ width: `${(perf[k] / total) * 100}%` }} />)}
    </div>
  );
}

function Trend({ data, total, selected }: { data: { w: string; n: number; att: number | null }[]; total: number; selected: string }) {
  const W = 560, H = 190, pad = { l: 8, r: 8, t: 14, b: 34 };
  const bw = (W - pad.l - pad.r) / data.length;
  const ih = H - pad.t - pad.b;
  const pts = data.map((d, i) => (d.att === null ? null : [pad.l + bw * i + bw / 2, pad.t + ih * (1 - d.att)] as const));
  const line = pts.filter(Boolean).map((p, i) => `${i ? 'L' : 'M'}${p![0]},${p![1]}`).join(' ');
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="trend" role="img" aria-label="Reports received and attendance rate over the last 8 weeks">
        {data.map((d, i) => {
          const h = (d.n / total) * ih;
          const x = pad.l + bw * i + bw * 0.18;
          return (
            <g key={d.w}>
              <a href={`/admin?week=${d.w}`}>
                <rect x={x} y={pad.t + ih - h} width={bw * 0.64} height={Math.max(h, 1)} rx={3} className={d.w === selected ? 'bar sel' : 'bar'} />
                <text x={x + bw * 0.32} y={pad.t + ih - h - 4} textAnchor="middle" className="bar-val">{d.n || ''}</text>
                <text x={pad.l + bw * i + bw / 2} y={H - 14} textAnchor="middle" className="axis">{fmtDate(d.w, { day: 'numeric', month: 'short' })}</text>
              </a>
            </g>
          );
        })}
        <path d={line} className="att-line" />
        {pts.map((p, i) => p && <circle key={i} cx={p[0]} cy={p[1]} r={3.5} className="att-dot"><title>{`Attendance ${pct(data[i].att)}`}</title></circle>)}
      </svg>
      <ul className="legend">
        <li><i className="bar-key" />Reports received</li>
        <li><i className="line-key" />Attendance rate</li>
      </ul>
    </div>
  );
}
