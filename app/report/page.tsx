import Link from 'next/link';
import Header from '@/components/Header';
import ReportForm from '@/components/ReportForm';
import { requireShepherd } from '@/lib/auth';
import { query } from '@/lib/db';
import { getTree, titled } from '@/lib/tree';
import { fmtDate, today } from '@/lib/week';
import type { ReportRow } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function ReportPage() {
  const id = await requireShepherd();
  const tree = await getTree();
  const me = tree.person(id)!;
  const group = tree.groupOf(id).map((p) => ({ id: p.id, name: p.name, role: p.role }));
  const past = await query<ReportRow>('SELECT id, meeting_date, created_at, data FROM reports WHERE shepherd_id = $1 ORDER BY meeting_date DESC, id DESC LIMIT 6', [id]);
  const last = past[0]?.data;
  return (
    <>
      <Header title="Shepherding Assessment" who={titled(me)} />
      <main className="page narrow">
        <div className="page-head">
          <p className="eyebrow">Weekly group meeting report</p>
          <h1>Shepherding Assessment</h1>
          <p className="muted">Shepherd: <b>{titled(me)}</b> · {group.length} people in your group</p>
        </div>
        <ReportForm
          shepherdId={id}
          group={group}
          today={today()}
          defaults={{ groupName: last?.groupName ?? `${me.name}'s group`, signature: me.name, meetingTime: last?.meetingTime ?? '', mainGoal: '' }}
        />
        {past.length > 0 && (
          <section className="card mt">
            <h2 className="h3">Your recent reports</h2>
            <ul className="plain-list">
              {past.map((r) => (
                <li key={r.id}>
                  <span>{fmtDate(r.meeting_date)}</span>
                  <span className="muted">{r.data.totalPresent} present · {r.data.performance}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
        <p className="muted center small mt"><Link href="/">Home</Link></p>
      </main>
    </>
  );
}
