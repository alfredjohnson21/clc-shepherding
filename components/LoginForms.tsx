'use client';
import { useActionState } from 'react';
import { adminLogin, shepherdLogin } from '@/app/actions';

export function ShepherdLogin({ options }: { options: { id: number; label: string }[] }) {
  const [state, action, pending] = useActionState(shepherdLogin, null);
  return (
    <form action={action} className="stack">
      <label className="field">
        <span>Your name</span>
        <select name="id" required defaultValue="">
          <option value="" disabled>Choose your name…</option>
          {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </label>
      <label className="field">
        <span>Access code</span>
        <input name="code" inputMode="numeric" autoComplete="one-time-code" placeholder="6 digits" maxLength={6} required />
      </label>
      {state?.error && <p className="error" role="alert">{state.error}</p>}
      <button className="btn primary" disabled={pending}>{pending ? 'Signing in…' : 'Start weekly report'}</button>
    </form>
  );
}

export function AdminLogin() {
  const [state, action, pending] = useActionState(adminLogin, null);
  return (
    <form action={action} className="stack">
      <label className="field">
        <span>Dashboard password</span>
        <input type="password" name="password" autoComplete="current-password" required autoFocus />
      </label>
      {state?.error && <p className="error" role="alert">{state.error}</p>}
      <button className="btn primary" disabled={pending}>{pending ? 'Opening…' : 'Open dashboard'}</button>
    </form>
  );
}
