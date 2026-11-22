import type { Metadata } from 'next';
import AutoRefresh from '@/components/AutoRefresh';
import Flash from '@/components/Flash';
import { loadProfile } from '@/lib/members';
import { myRequest } from '@/lib/selfserve';
import { getTree } from '@/lib/tree';
import { MILESTONES, PERSONAL_FIELDS, type ProfileDetails } from '@/lib/types';
import { today } from '@/lib/week';
import { startOver, startRequest, submitProfile } from './actions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Update your profile — Christ’s Love Church' };

export default async function UpdateProfile({ searchParams }: { searchParams: Promise<{ err?: string }> }) {
  const sp = await searchParams;
  const r = await myRequest();

  let body: React.ReactNode;
  if (!r) {
    body = (
      <form action={startRequest} className="stack">
        <p className="muted center">Enter the phone number the church has for you. A church admin will confirm it&rsquo;s you, then you can update your details.</p>
        <label className="field"><span>Your phone number</span>
          <input name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="e.g. 0241234567" required maxLength={20} autoFocus /></label>
        <button className="btn primary">Continue</button>
      </form>
    );
  } else if (r.status === 'access_pending') {
    body = (
      <Waiting title="Waiting for the church admin" text={`We've asked a church admin to confirm that ${r.phone} is yours. Keep this page open, or come back to it on this phone later. It will open your profile as soon as they approve.`} />
    );
  } else if (r.status === 'editing') {
    const tree = await getTree();
    const p = r.kind === 'update' && r.person_id != null ? tree.person(r.person_id) : undefined;
    const details: ProfileDetails = p ? (await loadProfile(p.id)).details : {};
    body = (
      <form action={submitProfile} className="stack">
        <p className="muted center">
          {p ? <>Welcome, <b>{p.name.split(' ')[0]}</b>. Check your details below, correct anything that has changed, and send them to the church admin.</>
            : <>We couldn&rsquo;t find <b>{r.phone}</b> in the church list. Fill in your details and a church admin will add you.</>}
        </p>
        <fieldset className="form-grid plain">
          <label className="field span2"><span>Full name</span>
            <input name="name" defaultValue={p?.name ?? ''} required maxLength={120} autoComplete="name" /></label>
          <label className="field span2"><span>Phone number</span>
            <input name="phone" type="tel" inputMode="tel" defaultValue={r.phone} required maxLength={20} /></label>
          {PERSONAL_FIELDS.map((f) => (
            <label key={f.key} className="field"><span>{f.label}</span>
              {'options' in f ? (
                <select name={f.key} defaultValue={details[f.key] ?? ''}>
                  <option value="">—</option>
                  {f.options.map((o) => <option key={o}>{o}</option>)}
                </select>
              ) : 'date' in f ? (
                <input type="date" name={f.key} defaultValue={details[f.key] ?? ''} max={today()} />
              ) : (
                <input name={f.key} defaultValue={details[f.key] ?? ''} maxLength={120} />
              )}
            </label>
          ))}
        </fieldset>
        <h2 className="h3 mt-s">Your spiritual journey</h2>
        <p className="muted small">The date of each step, if it has happened. Leave blank if not.</p>
        <fieldset className="form-grid plain">
          {MILESTONES.map((m) => (
            <label key={m.key} className="field"><span>{m.label}</span>
              <input type="date" name={m.key} defaultValue={details[m.key] ?? ''} max={today()} /></label>
          ))}
        </fieldset>
        <button className="btn primary">Send to church admin</button>
      </form>
    );
  } else if (r.status === 'review_pending') {
    body = <Waiting title="Thank you!" text="Your details have been sent. A church admin will check them before they are saved. You can close this page." />;
  } else if (r.status === 'applied') {
    body = <Done icon="✓" title={r.kind === 'join' ? 'Welcome to the church list!' : 'Your profile is up to date'} text={r.kind === 'join' ? 'A church admin has added you. Your shepherd will be in touch.' : 'A church admin has saved your changes. Thank you!'} />;
  } else {
    body = <Done icon="!" title="Request not approved" text="A church admin could not approve this request. Please speak to a church admin or your shepherd." />;
  }

  return (
    <main className="landing">
      <section className="landing-card selfserve">
        <div className="landing-head">
          <img src="/clc-logo.png" alt="Christ’s Love Church logo" className="logo-lg" width={120} height={81} />
          <p className="eyebrow">Christ&rsquo;s Love Church</p>
          <h1>Update your profile</h1>
        </div>
        <Flash err={sp.err} />
        {body}
        {r && (
          <form action={startOver} className="landing-foot">
            <button className="link-btn muted small">{r.status === 'applied' || r.status === 'rejected' ? 'Start again' : 'Not you? Start again with another number'}</button>
          </form>
        )}
      </section>
    </main>
  );
}

function Waiting({ title, text }: { title: string; text: string }) {
  return (
    <div className="center stack">
      <div className="spinner" aria-hidden />
      <h2 className="h3">{title}</h2>
      <p className="muted">{text}</p>
      <AutoRefresh seconds={8} />
    </div>
  );
}
function Done({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <div className="center stack">
      <div className={`done-icon ${icon === '✓' ? 'ok' : 'bad'}`} aria-hidden>{icon}</div>
      <h2 className="h3">{title}</h2>
      <p className="muted">{text}</p>
    </div>
  );
}
