import { headers } from 'next/headers';
import Header from '@/components/Header';
import InviteButtons from '@/components/InviteButtons';
import PrintButton from '@/components/PrintButton';
import { accessCode, requireAdmin } from '@/lib/auth';
import { NAV } from '@/lib/nav';
import { branches, CATEGORY_LABEL, groupOf, shepherds, titled, usernameOf } from '@/lib/tree';

export const dynamic = 'force-dynamic';

export default async function Codes() {
  await requireAdmin();
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'clc-shepherding.vercel.app';
  const base = `${h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')}://${host}`;
  return (
    <>
      <Header title="Head Pastor's Dashboard" who="Head Pastor" nav={NAV} />
      <main className="page wide">
        <div className="row between">
          <div className="page-head"><p className="eyebrow">Confidential</p><h1>Sign-in links &amp; passwords</h1>
            <p className="muted" style={{ maxWidth: 640 }}>Send each leader their own link, username and password. The link opens their sign-in with their name already filled in, so they only type the password and go straight to the form. Use <b>Copy invite</b> or <b>WhatsApp</b> to send a ready-made message.</p></div>
          <PrintButton label="Print list" />
        </div>
        {branches.filter((b) => shepherds.some((s) => s.branchId === b.id)).map((b) => (
          <section className="card" key={b.id}>
            <h2 className="h3">{b.role} {b.name}&rsquo;s branch</h2>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Name</th><th>Position</th><th>Phone</th><th>Group</th><th>Username</th><th>Password</th><th>Personal link</th><th className="no-print">Send</th></tr></thead>
                <tbody>
                  {shepherds.filter((s) => s.branchId === b.id).sort((x, y) => x.level - y.level).map((s) => (
                    <tr key={s.id}>
                      <td><b>{s.name}</b>{s.role && <small className="muted"> · {s.role}</small>}</td>
                      <td>{CATEGORY_LABEL[s.category]}</td>
                      <td>{s.phone || <span className="muted">—</span>}</td>
                      <td>{groupOf(s.id).length}</td>
                      <td><code className="code user">{usernameOf(s)}</code></td>
                      <td><code className="code">{accessCode(s.id)}</code></td>
                      <td className="linkcell"><a href={`/s/${usernameOf(s)}`} target="_blank">{base}/s/{usernameOf(s)}</a></td>
                      <td className="no-print"><InviteButtons greeting={titled(s)} link={`${base}/s/${usernameOf(s)}`} username={usernameOf(s)} code={accessCode(s.id)} phone={s.phone} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </main>
    </>
  );
}
