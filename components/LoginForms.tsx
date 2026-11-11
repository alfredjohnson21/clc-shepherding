'use client';
import { useActionState } from 'react';
import { adminLogin, shepherdLogin } from '@/app/actions';

export function ShepherdLogin({ options, fixed }: {
  options?: { id: number; label: string }[];
  /** Personal link: the shepherd is already known, so only the password is asked for. */
  fixed?: { id: number; username: string };
}) {
  const [state, action, pending] = useActionState(shepherdLogin, null);
  return (
    <form action={action} className="stack">
      {fixed ? (
        <label className="field">
          <span>Username</span>
          <input type="hidden" name="id" value={fixed.id} />
          <input name="username" value={fixed.username} readOnly autoComplete="username" className="readonly" />
        </label>
      ) : (
        <label className="field">
          <span>Your name</span>
          <select name="id" required defaultValue="">
            <option value="" disabled>Choose your name…</option>
            {options?.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </label>
      )}
      <label className="field">
        <span>{fixed ? 'Password' : 'Access code'}</span>
        <input name="code" type={fixed ? 'password' : 'text'} inputMode="numeric" autoComplete={fixed ? 'current-password' : 'one-time-code'}
          placeholder={fixed ? "Your password" : "Your code"} maxLength={6} required autoFocus={!!fixed} />
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
        <span>Super admin password</span>
        <input type="password" name="password" autoComplete="current-password" required autoFocus />
      </label>
      {state?.error && <p className="error" role="alert">{state.error}</p>}
      <button className="btn primary" disabled={pending}>{pending ? 'Signing in…' : 'Sign in'}</button>
    </form>
  );
}
