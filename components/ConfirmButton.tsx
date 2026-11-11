'use client';

/** A submit button that asks "Are you sure?" first. Place inside a <form action={...}>. */
export default function ConfirmButton({ label, confirm, className = 'btn small danger' }: { label: string; confirm: string; className?: string }) {
  return (
    <button className={className} onClick={(e) => { if (!window.confirm(confirm)) e.preventDefault(); }}>
      {label}
    </button>
  );
}
