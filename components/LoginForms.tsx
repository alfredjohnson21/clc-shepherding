'use client';
import { useActionState, useId, useMemo, useRef, useState } from 'react';
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
        <NamePicker options={options ?? []} />
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

const fold = (t: string) => t.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** Type part of your name (any word, in any order) and pick it from the matches. */
function NamePicker({ options }: { options: { id: number; label: string }[] }) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [chosen, setChosen] = useState<{ id: number; label: string } | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const matches = useMemo(() => {
    const words = fold(text).split(/\s+/).filter(Boolean);
    if (!words.length) return options;
    return options.filter((o) => {
      const l = fold(o.label);
      return words.every((w) => l.includes(w));
    });
  }, [text, options]);

  const choose = (o: { id: number; label: string }) => {
    setChosen(o); setText(o.label); setOpen(false);
    // Move on to the code field.
    (inputRef.current?.form?.elements.namedItem('code') as HTMLInputElement | null)?.focus();
  };

  return (
    <div className="field name-picker">
      <label htmlFor={`${listId}-input`}><span>Your name</span></label>
      <input type="hidden" name="id" value={chosen?.id ?? ''} />
      <input
        ref={inputRef}
        id={`${listId}-input`}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && matches[active] ? `${listId}-${matches[active].id}` : undefined}
        autoComplete="off"
        placeholder="Start typing your name…"
        value={text}
        required
        onChange={(e) => { setText(e.target.value); setChosen(null); setOpen(true); setActive(0); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, matches.length - 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
          else if (e.key === 'Enter' && open && !chosen) { e.preventDefault(); if (matches[active]) choose(matches[active]); }
          else if (e.key === 'Escape') setOpen(false);
        }}
      />
      {open && !chosen && (
        <ul id={listId} role="listbox" className="name-list">
          {matches.length === 0 ? <li className="none">No name matches &ldquo;{text}&rdquo;</li> : matches.map((o, i) => (
            <li key={o.id} id={`${listId}-${o.id}`} role="option" aria-selected={i === active} className={i === active ? 'on' : ''}
              onMouseDown={(e) => { e.preventDefault(); choose(o); }} onMouseEnter={() => setActive(i)}>
              {o.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
