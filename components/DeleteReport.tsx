import { deleteReport } from '@/app/admin/actions';
import ConfirmButton from './ConfirmButton';

export default function DeleteReport({ id }: { id: number }) {
  return (
    <form action={deleteReport} className="no-print">
      <input type="hidden" name="id" value={id} />
      <ConfirmButton label="Delete report" confirm="Delete this report for good? It will disappear from the dashboard. This cannot be undone." />
    </form>
  );
}
