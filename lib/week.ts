/** Weeks run Monday–Sunday. Dates are plain YYYY-MM-DD strings (Ghana is UTC+0). */
export function weekStart(date: string): string {
  const d = new Date(date + 'T00:00:00Z');
  const dow = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}
export function addDays(date: string, n: number): string {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function today(): string {
  return new Date().toISOString().slice(0, 10);
}
export function fmtDate(date: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) {
  return new Date(date + 'T00:00:00Z').toLocaleDateString('en-GB', { timeZone: 'UTC', ...opts });
}
export function weekLabel(ws: string) {
  const we = addDays(ws, 6);
  return `${fmtDate(ws, { day: 'numeric', month: 'short' })} – ${fmtDate(we)}`;
}
