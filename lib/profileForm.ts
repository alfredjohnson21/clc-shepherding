import { MILESTONES, PERSONAL_FIELDS, type ProfileDetails } from './types';

export const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
const val = (f: FormData, k: string, max: number) => String(f.get(k) ?? '').trim().slice(0, max);

/** Reads the personal-details and milestone fields of a profile form. */
export function readDetails(f: FormData): { details: ProfileDetails } | { error: string } {
  const details: ProfileDetails = {};
  for (const fld of PERSONAL_FIELDS) {
    const v = val(f, fld.key, 120);
    if (!v) continue;
    if ('date' in fld && !isDate(v)) return { error: `Please enter a valid date for ${fld.label.toLowerCase()}.` };
    if ('options' in fld && !(fld.options as readonly string[]).includes(v)) return { error: `Please choose a ${fld.label.toLowerCase()} from the list.` };
    details[fld.key] = v;
  }
  for (const m of MILESTONES) {
    const v = val(f, m.key, 10);
    if (!v) continue;
    if (!isDate(v)) return { error: `Please enter a valid date for "${m.label}".` };
    details[m.key] = v;
  }
  return { details };
}
