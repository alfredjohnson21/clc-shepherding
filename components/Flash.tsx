/** Shows the ?ok= / ?err= message that admin actions redirect back with. */
export default function Flash({ ok, err }: { ok?: string; err?: string }) {
  if (err) return <p className="error" role="alert">{err}</p>;
  if (ok) return <p className="success" role="status">{ok}</p>;
  return null;
}
