import { CATEGORIES, CATEGORY_LABEL, type Person, type Tree } from '@/lib/tree';

/** People in tree order (leader, then their group), for the "Reports to" dropdown. */
export function treeOrder(tree: Tree) {
  const out: Person[] = [];
  const walk = (p: Person) => {
    out.push(p);
    tree.groupOf(p.id).sort((a, b) => a.name.localeCompare(b.name)).forEach(walk);
  };
  tree.people.filter((p) => p.reportsToId === null).forEach(walk);
  // Anyone whose leader was removed still shows up at the end.
  const seen = new Set(out.map((p) => p.id));
  tree.people.filter((p) => !seen.has(p.id)).forEach((p) => out.push(p));
  return out;
}

export default function PersonForm({ tree, person, under, action, submit, children }: {
  tree: Tree; person?: Person; under?: number;
  action: (f: FormData) => Promise<void>; submit: string; children?: React.ReactNode;
}) {
  const isRoot = person && person.reportsToId === null;
  // Can't report to yourself or to anyone in your own group (that would make a loop).
  const options = treeOrder(tree).filter((p) => !person || !tree.isUnder(p.id, person.id));
  return (
    <form action={action} className="card stack">
      {person && <input type="hidden" name="id" value={person.id} />}
      <div className="form-grid">
        <label className="field span2"><span>Full name</span>
          <input name="name" defaultValue={person?.name} required maxLength={120} autoFocus={!person} /></label>
        <label className="field"><span>Title <span className="hint">e.g. Pastor, Deacon, Elder</span></span>
          <input name="role" defaultValue={person?.role} maxLength={60} /></label>
        <label className="field"><span>Phone</span>
          <input name="phone" defaultValue={person?.phone} inputMode="tel" maxLength={40} placeholder="e.g. 0241234567" /></label>
        <label className="field"><span>Position</span>
          <select name="category" defaultValue={person?.category ?? 'member'}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
          </select></label>
        <label className="field"><span>Reports to <span className="hint">their group leader</span></span>
          {isRoot ? (
            <><input value="— (top of the church)" readOnly className="readonly" /><input type="hidden" name="reportsTo" value="" /></>
          ) : (
            <select name="reportsTo" defaultValue={String(person?.reportsToId ?? under ?? '')} required>
              <option value="" disabled>Choose a leader…</option>
              {options.map((p) => <option key={p.id} value={p.id}>{'  '.repeat(p.level)}{p.name}{p.role ? ` (${p.role})` : ''}</option>)}
            </select>
          )}</label>
        {children}
      </div>
      <button className="btn primary">{submit}</button>
    </form>
  );
}
