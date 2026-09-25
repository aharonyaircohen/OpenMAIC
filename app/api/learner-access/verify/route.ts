import { timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

import { apiError, apiSuccess } from '@/lib/server/api-response';
import { createAccessToken } from '@/lib/server/access-token';
import { ACCESS_TOKEN_MAX_AGE_SECONDS } from '@/lib/server/access-token-shared';
import { AccessCodeAttemptLimiter } from '@/lib/server/attempt-limiter';
import { clientIdentity, isTrustedProxyIdentity } from '@/lib/server/client-identity';
import { LEARNER_ACCESS_COOKIE } from '@/lib/server/role-access';

const learnerAttemptLimiter = new AccessCodeAttemptLimiter();

function secureEqual(left: string, right: string): boolean {
  const encoder = new TextEncoder();
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  return a.byteLength === b.byteLength && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const accessCode = process.env.LEARNER_ACCESS_CODE;
  if (!accessCode) return apiSuccess({ valid: true });

  const trusted = isTrustedProxyIdentity();
  const identity = clientIdentity(request);
  const limit = learnerAttemptLimiter.consume(identity, trusted);
  if (limit.limited) {
    const response = apiError('RATE_LIMITED', 429, 'Too many student access-code attempts');
    response.headers.set('Retry-After', String(limit.retryAfterSeconds));
    return response;
  }

  let code: unknown;
  try {
    code = (await request.json())?.code;
  } catch {
    return apiError('INVALID_REQUEST', 400, 'Invalid JSON body');
  }

  if (typeof code !== 'string' || !secureEqual(code, accessCode)) {
    return apiError('INVALID_REQUEST', 401, 'Invalid student access code');
  }

  learnerAttemptLimiter.recordSuccess(identity, trusted);

  const cookieStore = await cookies();
  cookieStore.set(LEARNER_ACCESS_COOKIE, createAccessToken(accessCode), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: ACCESS_TOKEN_MAX_AGE_SECONDS,
    secure: process.env.NODE_ENV === 'production',
  });

  return apiSuccess({ valid: true });
}
