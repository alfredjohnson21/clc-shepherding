import tree from '@/data/tree.json';

export type Category = 'head' | 'executive' | 'admin' | 'pastor' | 'leader' | 'member';
export type Person = {
  id: number; name: string; role: string; phone: string; category: Category;
  level: number; reportsToId: number | null; branchId: number | null; shadow: boolean;
};

export const people = tree as Person[];
const byId = new Map(people.map((p) => [p.id, p]));

export const CATEGORY_LABEL: Record<Category, string> = {
  head: 'Reverend', executive: 'Executive Council', admin: 'Admin Council',
  pastor: 'Other Pastor', leader: 'Other Leader', member: 'Member',
};

export const person = (id: number) => byId.get(id);
export const nameOf = (id: number) => byId.get(id)?.name ?? `#${id}`;
export const groupOf = (id: number) => people.filter((p) => p.reportsToId === id);

/** Everyone (below the Reverend) who has people reporting to them — they submit weekly reports. */
export const shepherds = people
  .filter((p) => p.level >= 1 && people.some((c) => c.reportsToId === p.id))
  .sort((a, b) => a.name.localeCompare(b.name));

/** The 11 branch heads (Executive Council). */
export const branches = people.filter((p) => p.level === 1);

export function titled(p: Person) {
  return p.role ? `${p.role} ${p.name}` : p.name;
}

/** Short sign-in username, e.g. "Alfred Johnson Nii Ansah" → "alfred.johnson". Unique across shepherds. */
export function usernameOf(p: Person) {
  const words = p.name.normalize('NFKD').replace(/[^a-zA-Z\s-]/g, '').toLowerCase().split(/[\s-]+/).filter(Boolean);
  return words.slice(0, 2).join('.');
}
const byUsername = new Map(shepherds.map((p) => [usernameOf(p), p]));
export const shepherdByUsername = (u: string) => byUsername.get(u.trim().toLowerCase());
