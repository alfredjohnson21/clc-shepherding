'use client';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { submitReport } from '@/app/actions';
import { DAYS, GOAL, PERFORMANCE, SCALE, type Highlight, type ReportData } from '@/lib/types';

type Member = { id: number; name: string; role: string };
type Defaults = { groupName: string; signature: string; meetingTime: string; mainGoal: string };

const emptyHL = (): Highlight => ({ ids: [], note: '' });

function initial(d: Defaults, today: string): ReportData {
  return {
    groupName: d.groupName, meetingDate: today, meetingTime: d.meetingTime,
    presentIds: [], absentIds: [], visitors: 0, totalPresent: 0, totalAbsent: 0,
    performance: '', atmosphere: '', mainGoal: d.mainGoal, goalAchieved: '', goalSummary: '',
    participation: -1, vulnerability: -1,
    stoodOut: emptyHL(), lessInteractive: emptyHL(), deepQuestion: emptyHL(), neededExplanation: emptyHL(),
    pastoralCare: '', visits: [], challenge: { ids: [], note: '' },
    nextAgenda: '', improve: '', otherInfo: '', signature: d.signature,
  };
}

export default function ReportForm({ shepherdId, group, today, defaults }: { shepherdId: number; group: Member[]; today: string; defaults: Defaults }) {
  const DRAFT_KEY = `clc-report-draft-${shepherdId}`;
  const blank = useMemo(() => JSON.stringify(initial(defaults, today)), [defaults, today]);
  const router = useRouter();
  const [f, setF] = useState<ReportData>(() => initial(defaults, today));
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const [restored, setRestored] = useState(false);

  // Keep an unsent draft on this device so a dropped connection doesn't lose work.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw && raw !== blank) { setF({ ...initial(defaults, today), ...JSON.parse(raw) }); setRestored(true); }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    try {
      const json = JSON.stringify(f);
      if (json === blank) localStorage.removeItem(DRAFT_KEY); else localStorage.setItem(DRAFT_KEY, json);
    } catch {}
  }, [f, blank, DRAFT_KEY]);

  const set = <K extends keyof ReportData>(k: K, v: ReportData[K]) => setF((p) => ({ ...p, [k]: v }));
  const present = new Set(f.presentIds);
  const marked = (id: number) => (present.has(id) ? 'present' : f.absentIds.includes(id) ? 'absent' : '');
  const mark = (id: number, state: 'present' | 'absent') =>
    setF((p) => {
      const isSame = (state === 'present' ? p.presentIds : p.absentIds).includes(id);
      const presentIds = p.presentIds.filter((x) => x !== id);
      const absentIds = p.absentIds.filter((x) => x !== id);
      if (!isSame) (state === 'present' ? presentIds : absentIds).push(id);
      return { ...p, presentIds, absentIds };
    });
  const unmarked = group.filter((m) => !marked(m.id));
  const totalPresent = f.presentIds.length + (f.visitors || 0);
  const totalAbsent = f.absentIds.length;
  const presentFirst = useMemo(
    () => [...group].sort((a, b) => Number(present.has(b.id)) - Number(present.has(a.id))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [group, f.presentIds],
  );

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const missing: string[] = [];
    if (!f.meetingDate) missing.push('date of meeting');
    if (!f.performance) missing.push('how the meeting went');
    if (!f.goalAchieved) missing.push('whether the goal was achieved');
    if (f.participation < 0) missing.push('participation score');
    if (f.vulnerability < 0) missing.push('vulnerability score');
    if (!f.signature.trim()) missing.push('your signature');
    if (missing.length) { setError(`Please fill in: ${missing.join(', ')}.`); return; }
    if (unmarked.length && !confirm(`${unmarked.length} member(s) are not marked present or absent. They will not be counted. Submit anyway?`)) return;
    start(async () => {
      const res = await submitReport({ ...f, totalPresent, totalAbsent });
      if (res.error) { setError(res.error); return; }
      try { localStorage.removeItem(DRAFT_KEY); } catch {}
      router.push('/report/done');
    });
  }

  return (
    <form onSubmit={onSubmit} className="report-form" noValidate>
      {restored && (
        <p className="notice">
          We restored your unsent draft.{' '}
          <button type="button" className="link-btn" onClick={() => { setF(initial(defaults, today)); setRestored(false); }}>Start fresh</button>
        </p>
      )}

      <section className="card">
        <div className="grid2">
          <label className="field span2"><span>Group name</span>
            <input value={f.groupName} onChange={(e) => set('groupName', e.target.value)} /></label>
          <label className="field"><span>Date of meeting</span>
            <input type="date" value={f.meetingDate} max={today} onChange={(e) => set('meetingDate', e.target.value)} required /></label>
          <label className="field"><span>Time of meeting</span>
            <input type="time" value={f.meetingTime} onChange={(e) => set('meetingTime', e.target.value)} /></label>
        </div>
      </section>

      <Section n={1} title="Attendance">
        <div className="att-toolbar">
          <div className="att-totals">
            <span><b>{totalPresent}</b> present</span>
            <span><b>{totalAbsent}</b> absent</span>
            {unmarked.length > 0 && <span className="muted">{unmarked.length} not marked</span>}
          </div>
          <div className="row gap-s">
            <button type="button" className="btn small" onClick={() => setF((p) => ({ ...p, presentIds: group.map((m) => m.id), absentIds: [] }))}>All present</button>
            <button type="button" className="btn small ghost" onClick={() => setF((p) => ({ ...p, presentIds: p.presentIds, absentIds: group.filter((m) => !p.presentIds.includes(m.id)).map((m) => m.id) }))}>Rest absent</button>
          </div>
        </div>
        <ul className="att-list">
          {group.map((m) => {
            const s = marked(m.id);
            return (
              <li key={m.id} className={`att-row ${s}`}>
                <span className="att-name">{m.name}{m.role && <small> · {m.role}</small>}</span>
                <span className="seg" role="group" aria-label={`Attendance for ${m.name}`}>
                  <button type="button" aria-pressed={s === 'present'} className={s === 'present' ? 'on ok' : ''} onClick={() => mark(m.id, 'present')}>Present</button>
                  <button type="button" aria-pressed={s === 'absent'} className={s === 'absent' ? 'on bad' : ''} onClick={() => mark(m.id, 'absent')}>Absent</button>
                </span>
              </li>
            );
          })}
        </ul>
        <label className="field inline mt-s"><span>Visitors / others present (not in your list)</span>
          <input type="number" min={0} inputMode="numeric" value={f.visitors || ''} placeholder="0" onChange={(e) => set('visitors', Math.max(0, Number(e.target.value) || 0))} /></label>
      </Section>

      <Section n={2} title="General meeting performance">
        <p className="q">How did the meeting go?</p>
        <Choices name="performance" options={PERFORMANCE} value={f.performance} onChange={(v) => set('performance', v)} />
        <label className="field mt-s"><span>Brief summary of atmosphere</span>
          <textarea rows={3} value={f.atmosphere} onChange={(e) => set('atmosphere', e.target.value)} /></label>
      </Section>

      <Section n={3} title="Objective & alignment">
        <label className="field"><span>Main goal of the meeting</span>
          <textarea rows={2} value={f.mainGoal} onChange={(e) => set('mainGoal', e.target.value)} /></label>
        <p className="q mt-s">Was this goal achieved?</p>
        <Choices name="goal" options={GOAL} value={f.goalAchieved} onChange={(v) => set('goalAchieved', v)} />
        <label className="field mt-s"><span>Brief summary</span>
          <textarea rows={3} value={f.goalSummary} onChange={(e) => set('goalSummary', e.target.value)} /></label>
      </Section>

      <Section n={4} title="Engagement & interaction">
        <Scale label="What was the general participation like?" value={f.participation} onChange={(v) => set('participation', v)} />
        <Scale label="Were members open?" value={f.vulnerability} onChange={(v) => set('vulnerability', v)} />
        <details className="scale-key">
          <summary>Scale key</summary>
          <ul>{SCALE.map((s) => <li key={s.value}><b>{s.value}</b> {s.hint}</li>)}</ul>
        </details>
      </Section>

      <Section n={5} title="Discussion highlights">
        <PeoplePick label="Who stood out in the discussions?" people={presentFirst} value={f.stoodOut} onChange={(v) => set('stoodOut', v)} />
        <PeoplePick label="Who was less interactive?" people={presentFirst} value={f.lessInteractive} onChange={(v) => set('lessInteractive', v)} />
        <PeoplePick label="Who asked a deep question?" people={presentFirst} value={f.deepQuestion} onChange={(v) => set('deepQuestion', v)} notePlaceholder="What was the question? (optional)" />
        <PeoplePick label="Who needed lots of explanation?" people={presentFirst} value={f.neededExplanation} onChange={(v) => set('neededExplanation', v)} />
      </Section>

      <Section n={6} title="Post-meeting agenda">
        <label className="field"><span>Who will be doing online Pastoral Care with you this week?</span>
          <input value={f.pastoralCare} onChange={(e) => set('pastoralCare', e.target.value)} /></label>

        <div className="field mt-s">
          <span>Who needs to be visited this week, and when?</span>
          {f.visits.map((v, i) => (
            <div className="visit-row" key={i}>
              <select value={v.id ?? (v.name ? 'other' : '')} onChange={(e) => {
                const val = e.target.value;
                const visits = [...f.visits];
                visits[i] = { ...v, id: val && val !== 'other' ? Number(val) : null, name: val === 'other' ? v.name || ' ' : '' };
                set('visits', visits);
              }}>
                <option value="">Choose person…</option>
                {group.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                <option value="other">Someone else…</option>
              </select>
              {v.id === null && v.name !== '' && (
                <input placeholder="Name" value={v.name.trim()} onChange={(e) => { const visits = [...f.visits]; visits[i] = { ...v, name: e.target.value || ' ' }; set('visits', visits); }} />
              )}
              <select value={v.day} onChange={(e) => { const visits = [...f.visits]; visits[i] = { ...v, day: e.target.value }; set('visits', visits); }}>
                <option value="">Day…</option>
                {DAYS.map((d) => <option key={d}>{d}</option>)}
              </select>
              <input placeholder="Reason (optional)" value={v.note} onChange={(e) => { const visits = [...f.visits]; visits[i] = { ...v, note: e.target.value }; set('visits', visits); }} />
              <button type="button" className="icon-btn" aria-label="Remove visit" onClick={() => set('visits', f.visits.filter((_, j) => j !== i))}>×</button>
            </div>
          ))}
          <button type="button" className="btn small ghost" onClick={() => set('visits', [...f.visits, { id: null, name: '', day: '', note: '' }])}>+ Add a visit</button>
        </div>

        <div className="papa mt">
          <PeoplePick
            label="Who has a pressing challenge this week that needs to be communicated to Papa?"
            people={group}
            value={f.challenge}
            onChange={(v) => set('challenge', v)}
            notePlaceholder="Describe the challenge for Papa"
            noteRows={3}
          />
        </div>

        <label className="field mt-s"><span>What will you improve on in next week&rsquo;s discussion?</span>
          <textarea rows={2} value={f.improve} onChange={(e) => set('improve', e.target.value)} /></label>
      </Section>

      <Section n={7} title="Any other information">
        <textarea rows={3} value={f.otherInfo} onChange={(e) => set('otherInfo', e.target.value)} aria-label="Any other information" />
      </Section>

      <section className="card sign">
        <label className="field"><span>Shepherd&rsquo;s signature (type your full name)</span>
          <input className="signature" value={f.signature} onChange={(e) => set('signature', e.target.value)} /></label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn primary wide" disabled={pending}>{pending ? 'Submitting…' : 'Submit report'}</button>
      </section>
    </form>
  );
}

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="card">
      <h2 className="section-title"><span className="num">{n}</span>{title}</h2>
      {children}
    </section>
  );
}

function Choices({ name, options, value, onChange }: { name: string; options: readonly { value: string; label: string; hint: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="choices" role="radiogroup">
      {options.map((o) => (
        <label key={o.value} className={`choice ${value === o.value ? 'on' : ''} c-${o.value}`}>
          <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} />
          <b>{o.label}</b>
          <small>{o.hint}</small>
        </label>
      ))}
    </div>
  );
}

function Scale({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="scale">
      <p className="q">{label}</p>
      <div className="scale-btns" role="radiogroup" aria-label={label}>
        {[0, 1, 2, 3].map((n) => (
          <button type="button" key={n} role="radio" aria-checked={value === n} className={value === n ? 'on' : ''} onClick={() => onChange(n)}>
            {n}
          </button>
        ))}
      </div>
      <p className="muted small scale-hint">{value >= 0 ? SCALE.find((s) => s.value === value)?.hint : ' '}</p>
    </div>
  );
}

function PeoplePick({ label, people, value, onChange, notePlaceholder = 'Add a note (optional)', noteRows = 1 }: {
  label: string; people: Member[]; value: Highlight; onChange: (v: Highlight) => void; notePlaceholder?: string; noteRows?: number;
}) {
  const toggle = (id: number) => onChange({ ...value, ids: value.ids.includes(id) ? value.ids.filter((x) => x !== id) : [...value.ids, id] });
  return (
    <div className="pick">
      <p className="q">{label}</p>
      <div className="chips">
        {people.map((p) => (
          <button type="button" key={p.id} aria-pressed={value.ids.includes(p.id)} className={`chip ${value.ids.includes(p.id) ? 'on' : ''}`} onClick={() => toggle(p.id)}>
            {p.name}
          </button>
        ))}
      </div>
      {noteRows > 1 ? (
        <textarea rows={noteRows} placeholder={notePlaceholder} value={value.note} onChange={(e) => onChange({ ...value, note: e.target.value })} />
      ) : (
        <input placeholder={notePlaceholder} value={value.note} onChange={(e) => onChange({ ...value, note: e.target.value })} />
      )}
    </div>
  );
}
