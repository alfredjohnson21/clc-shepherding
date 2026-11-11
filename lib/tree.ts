import 'server-only';
import { cache } from 'react';
import seed from '@/data/tree.json';
import { query } from './db';

export type Category = 'head' | 'executive' | 'admin' | 'pastor' | 'leader' | 'member';
export const CATEGORIES: Category[] = ['head', 'executive', 'admin', 'pastor', 'leader', 'member'];

export type Person = {
  id: number; name: string; role: string; phone: string; category: Category;
  reportsToId: number | null; username: string; password: string | null; active: boolean;
  /** 0 = Reverend, 1 = Executive Council (branch head), 2+ = below. Computed from reports_to. */
  level: number;
  /** The level-1 ancestor (branch head) — computed. */
  branchId: number | null;
};

export const CATEGORY_LABEL: Record<Category, string> = {
  head: 'Reverend', executive: 'Executive Council', admin: 'Admin Council',
  pastor: 'Other Pastor', leader: 'Other Leader', member: 'Member',
};

export function titled(p: Pick<Person, 'role' | 'name'>) {
  return p.role ? `${p.role} ${p.name}` : p.name;
}

/** "Alfred Johnson Nii Ansah" → "alfred.johnson" */
export function slugOf(name: string) {
  const words = name.normalize('NFKD').replace(/[^a-zA-Z\s-]/g, '').toLowerCase().split(/[\s-]+/).filter(Boolean);
  return words.slice(0, 2).join('.') || 'member';
}

type Row = {
  id: number; name: string; role: string; phone: string; category: Category;
  reports_to_id: number | null; username: string; password: string | null; active: boolean;
};

export class Tree {
  readonly all: Person[];
  /** Active people only. */
  readonly people: Person[];
  private byId: Map<number, Person>;

  constructor(rows: Row[]) {
    const raw = new Map(rows.map((r) => [r.id, r]));
    const depth = (id: number): { level: number; branchId: number | null } => {
      const chain: number[] = [];
      let cur: Row | undefined = raw.get(id);
      while (cur && cur.reports_to_id != null && !chain.includes(cur.id) && chain.length < 50) {
        chain.push(cur.id);
        cur = raw.get(cur.reports_to_id);
      }
      chain.push(cur?.id ?? id);
      // chain = [self, parent, ..., root]
      const level = chain.length - 1;
      const branchId = level >= 1 ? chain[chain.length - 2] : null;
      return { level, branchId };
    };
    this.all = rows.map((r) => ({
      id: r.id, name: r.name, role: r.role, phone: r.phone, category: r.category,
      reportsToId: r.reports_to_id, username: r.username, password: r.password, active: r.active,
      ...depth(r.id),
    }));
    this.byId = new Map(this.all.map((p) => [p.id, p]));
    this.people = this.all.filter((p) => p.active);
  }

  person = (id: number) => this.byId.get(id);
  nameOf = (id: number) => this.byId.get(id)?.name ?? `#${id}`;
  groupOf = (id: number) => this.people.filter((p) => p.reportsToId === id);
  byUsername = (u: string) => this.people.find((p) => p.username === u.trim().toLowerCase());

  /** Everyone (below the Reverend) who has people reporting to them — they submit weekly reports. */
  get shepherds() {
    return this.people
      .filter((p) => p.level >= 1 && this.people.some((c) => c.reportsToId === p.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
  /** Branch heads (Executive Council). */
  get branches() { return this.people.filter((p) => p.level === 1); }
  isShepherd = (id: number) => this.shepherds.some((s) => s.id === id);

  /** True when `id` is `ancestor` or sits somewhere beneath them. */
  isUnder(id: number, ancestor: number) {
    let cur = this.byId.get(id);
    for (let i = 0; cur && i < 50; i++) {
      if (cur.id === ancestor) return true;
      cur = cur.reportsToId != null ? this.byId.get(cur.reportsToId) : undefined;
    }
    return false;
  }
}

/** First run: copy the Shepherd Tree PDF list (data/tree.json) into the database. */
async function ensureSeeded() {
  const [{ n }] = await query<{ n: number }>('SELECT count(*)::int AS n FROM people');
  if (Number(n) > 0) return;
  const src = seed as { id: number; name: string; role: string; phone: string; category: Category; reportsToId: number | null }[];
  const leads = (id: number) => src.some((c) => c.reportsToId === id);
  // Leaders first so they keep the plain usernames already handed out.
  const order = [...src].sort((a, b) => Number(leads(b.id)) - Number(leads(a.id)));
  const used = new Set<string>();
  const params: unknown[] = [];
  const values: string[] = [];
  for (const p of order) {
    let u = slugOf(p.name), k = 2;
    while (used.has(u)) u = `${slugOf(p.name)}${k++}`;
    used.add(u);
    const b = params.length;
    values.push(`($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, $${b + 6}, $${b + 7})`);
    params.push(p.id, p.name, p.role ?? '', p.phone ?? '', p.category, p.reportsToId, u);
  }
  await query(
    `INSERT INTO people (id, name, role, phone, category, reports_to_id, username) VALUES ${values.join(', ')} ON CONFLICT DO NOTHING`,
    params,
  );
}

export const getTree = cache(async () => {
  await ensureSeeded();
  const rows = await query<Row>('SELECT id, name, role, phone, category, reports_to_id, username, password, active FROM people ORDER BY id');
  return new Tree(rows);
});

/** A username not yet taken, based on the person's name. */
export async function freeUsername(name: string, exceptId = 0) {
  const base = slugOf(name);
  const taken = new Set((await query<{ username: string }>('SELECT username FROM people WHERE id <> $1', [exceptId])).map((r) => r.username));
  let u = base, k = 2;
  while (taken.has(u)) u = `${base}${k++}`;
  return u;
}
