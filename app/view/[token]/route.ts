import { redirect } from 'next/navigation';
import { checkViewToken, getRole, setSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/** The Head Pastor's private link: no password — opens the dashboard in view-only mode. */
export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!(await checkViewToken(token))) {
    return new Response('This link is no longer valid. Please ask the church admin for the current link.', {
      status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }
  // Don't downgrade a super admin who happens to open Papa's link on their own phone.
  if ((await getRole()) !== 'super') await setSession({ kind: 'viewer', t: token });
  redirect('/admin');
}
