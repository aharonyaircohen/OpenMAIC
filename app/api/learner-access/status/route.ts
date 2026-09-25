import { cookies } from 'next/headers';

import { apiSuccess } from '@/lib/server/api-response';
import { verifyAccessToken } from '@/lib/server/access-token';
import { LEARNER_ACCESS_COOKIE } from '@/lib/server/role-access';

export async function GET() {
  const accessCode = process.env.LEARNER_ACCESS_CODE;
  if (!accessCode) {
    return apiSuccess({ enabled: false, authenticated: true });
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(LEARNER_ACCESS_COOKIE)?.value;
  return apiSuccess({
    enabled: true,
    authenticated: !!token && verifyAccessToken(token, accessCode),
  });
}
