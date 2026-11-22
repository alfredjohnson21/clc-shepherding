import { headers } from 'next/headers';
import Link from 'next/link';
import { resetHeadPastorLink } from '@/app/admin/actions';
import ConfirmButton from '@/components/ConfirmButton';
import Flash from '@/components/Flash';
import Header from '@/components/Header';
import InviteButtons from '@/components/InviteButtons';
import PrintButton from '@/components/PrintButton';
import { accessCode, requireSuper, viewToken } from '@/lib/auth';
import { dashTitle, dashWho, navFor } from '@/lib/nav';
import { CATEGORY_LABEL, getTree, titled } from '@/lib/tree';

export const dynamic = 'force-dynamic';

export default async function Codes({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  await requireSuper();
  const sp = await searchParams;
  const tree = await getTree();
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'clc-shepherding.vercel.app';
  const base = `${h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')}://${host}`;
  const papa = tree.people.find((p) => p.reportsToId === null);
  const viewLink = `${base}/view/${await viewToken()}`;
  const papaText =
    `Hello ${papa ? titled(papa) : 'Papa'},\n\nHere is your link to the CLC Shepherding dashboard. ` +
    `It opens straight away, no password needed:\n\n${viewLink}\n\nYou will see each week's group reports, attendance, and anything that needs your attention. Please keep this link private.`;
  const shepherds = tree.shepherds;

  return (
    <>
      <Header title={dashTitle('super')} who={dashWho('super')} nav={navFor('super')} />
      <main className="page wide">
        <div className="row between">
          <div className="page-head"><p className="eyebrow">Confidential</p><h1>Sign-in links &amp; passwords</h1>
            <p className="muted" style={{ maxWidth: 640 }}>Send each leader their own link, username and password. The link opens their sign-in with their name already filled in, so they only type the password and go straight to the form. To change a password or username, open the person on the <Link href="/admin/people">People</Link> page.</p></div>
          <PrintButton label="Print list" />
        </div>
        <Flash ok={sp.ok} err={sp.err} />

        <section className="card no-print">
          <h2 className="h2">Member self-update QR code</h2>
          <p className="muted">Members scan it, enter their phone number, and update their own profile after you approve. <Link href="/admin/qr">Open the printable QR poster</Link> · <Link href="/admin/requests">See requests</Link></p>
        </section>

        <section className="card view-link">
          <h2 className="h2">Head Pastor&rsquo;s link <span className="count">view only</span></h2>
          <p className="muted">{papa ? titled(papa) : 'The Head Pastor'} opens this link and goes straight to the dashboard. No password. He can read every report but cannot change anything or see passwords.</p>
          <p className="linkbox"><a href={viewLink} target="_blank">{viewLink}</a></p>
          <div className="row between">
            <InviteButtons text={papaText} phone={papa?.phone ?? ''} copyLabel="Copy message" />
            <form action={resetHeadPastorLink} className="no-print">
              <ConfirmButton label="Make a new link" confirm="Make a new Head Pastor link? The current link will stop working, and you'll need to send him the new one." />
            </form>
          </div>
        </section>

        {tree.branches.filter((b) => shepherds.some((s) => s.branchId === b.id)).map((b) => (
          <section className="card" key={b.id}>
            <h2 className="h3">{b.role} {b.name}&rsquo;s branch</h2>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Name</th><th>Position</th><th>Phone</th><th>Group</th><th>Username</th><th>Password</th><th>Personal link</th><th className="no-print">Send</th></tr></thead>
                <tbody>
                  {shepherds.filter((s) => s.branchId === b.id).sort((x, y) => x.level - y.level).map((s) => {
                    const link = `${base}/s/${s.username}`;
                    const code = accessCode(s);
                    const text = `Hello ${titled(s)},\n\nHere is your sign-in for the CLC weekly Shepherding Assessment report:\n\n` +
                      `Link: ${link}\nUsername: ${s.username}\nPassword: ${code}\n\n` +
                      `Open the link, enter your password and fill in the form after each group meeting. Please keep your password private.`;
                    return (
                      <tr key={s.id}>
                        <td><Link href={`/admin/people/${s.id}`}><b>{s.name}</b></Link>{s.role && <small className="muted"> · {s.role}</small>}</td>
                        <td>{CATEGORY_LABEL[s.category]}</td>
                        <td>{s.phone || <span className="muted">—</span>}</td>
                        <td>{tree.groupOf(s.id).length}</td>
                        <td><code className="code user">{s.username}</code></td>
                        <td><code className="code">{code}</code>{s.password && <small className="muted"> custom</small>}</td>
                        <td className="linkcell"><a href={`/s/${s.username}`} target="_blank">{link}</a></td>
                        <td className="no-print"><InviteButtons text={text} phone={s.phone} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </main>
    </>
  );
}
