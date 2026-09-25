import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

import { ACCESS_TOKEN_MAX_AGE_SECONDS } from '@/lib/server/access-token-shared';
import { ATTEMPT_LIMIT_MAX_FAILURES } from '@/lib/server/attempt-limiter';

const mocks = vi.hoisted(() => ({
  cookieSet: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: () => undefined,
    set: mocks.cookieSet,
  }),
}));

const LEARNER_CODE = 'student-code-that-is-long-enough';

function request(code: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost/api/learner-access/verify', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify({ code }),
  });
}

async function loadPost() {
  vi.resetModules();
  return (await import('@/app/api/learner-access/verify/route')).POST;
}

describe('POST /api/learner-access/verify', () => {
  beforeEach(() => {
    mocks.cookieSet.mockReset();
    process.env.LEARNER_ACCESS_CODE = LEARNER_CODE;
    delete process.env.TRUST_PROXY_HEADERS;
  });

  afterEach(() => {
    delete process.env.LEARNER_ACCESS_CODE;
    delete process.env.TRUST_PROXY_HEADERS;
  });

  it('sets a separate learner cookie for the shared token lifetime', async () => {
    const POST = await loadPost();
    const response = await POST(request(LEARNER_CODE));

    expect(response.status).toBe(200);
    expect(mocks.cookieSet).toHaveBeenCalledOnce();
    const [name, , options] = mocks.cookieSet.mock.calls[0];
    expect(name).toBe('openmaic_learner_access');
    expect(options.maxAge).toBe(ACCESS_TOKEN_MAX_AGE_SECONDS);
  });

  it('rejects a wrong learner code without setting a cookie', async () => {
    const POST = await loadPost();
    const response = await POST(request('wrong-code'));

    expect(response.status).toBe(401);
    expect(mocks.cookieSet).not.toHaveBeenCalled();
  });

  it('rate limits repeated failures when proxy identities are trusted', async () => {
    process.env.TRUST_PROXY_HEADERS = 'true';
    const POST = await loadPost();
    const headers = { 'x-forwarded-for': '10.0.0.21' };

    for (let i = 0; i < ATTEMPT_LIMIT_MAX_FAILURES; i += 1) {
      expect((await POST(request('wrong-code', headers))).status).toBe(401);
    }

    const response = await POST(request('wrong-code', headers));
    expect(response.status).toBe(429);
    expect(Number(response.headers.get('retry-after'))).toBeGreaterThanOrEqual(1);
  });
});
