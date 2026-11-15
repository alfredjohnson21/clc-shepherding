import { CARE_STATUS, type CareStatus } from '@/lib/types';

export default function StatusBadge({ status, manual, big }: { status: CareStatus; manual?: boolean; big?: boolean }) {
  const s = CARE_STATUS.find((c) => c.value === status)!;
  return (
    <span className={`status st-${status}${big ? ' big' : ''}`} title={s.hint}>
      {s.label}{manual && <small> · set by admin</small>}
    </span>
  );
}
