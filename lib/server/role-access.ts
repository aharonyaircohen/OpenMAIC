import { cookies } from 'next/headers';

import { verifyAccessToken } from '@/lib/server/access-token';

export const ADMIN_ACCESS_COOKIE = 'openmaic_access';
export const LEARNER_ACCESS_COOKIE = 'openmaic_learner_access';

export type ApplicationRole = 'admin' | 'learner' | 'anonymous';

export async function getApplicationRole(): Promise<ApplicationRole> {
  const cookieStore = await cookies();
  const adminCode = process.env.ACCESS_CODE;
  const adminToken = cookieStore.get(ADMIN_ACCESS_COOKIE)?.value;

  if (adminCode && adminToken && verifyAccessToken(adminToken, adminCode)) {
    return 'admin';
  }

  const learnerCode = process.env.LEARNER_ACCESS_CODE;
  const learnerToken = cookieStore.get(LEARNER_ACCESS_COOKIE)?.value;
  if (learnerCode && learnerToken && verifyAccessToken(learnerToken, learnerCode)) {
    return 'learner';
  }

  return 'anonymous';
}

export async function isAdministrator(): Promise<boolean> {
  return (await getApplicationRole()) === 'admin';
}
