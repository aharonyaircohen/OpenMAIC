import { cookies } from 'next/headers';

import { apiSuccess } from '@/lib/server/api-response';
import { LEARNER_ACCESS_COOKIE } from '@/lib/server/role-access';

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.set(LEARNER_ACCESS_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
    secure: process.env.NODE_ENV === 'production',
  });
  return apiSuccess({ signedOut: true });
}
