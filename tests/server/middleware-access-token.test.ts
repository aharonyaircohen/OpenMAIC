import { createHmac } from 'crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';

import { middleware } from '@/middleware';
import { ACCESS_TOKEN_MAX_AGE_MS } from '@/lib/server/access-token-shared';

const CODE = 'demo-code-that-is-long-enough';
const LEARNER_CODE = 'student-code-that-is-long-enough';

/** Sign `timestamp` exactly the way the app mints access tokens. */
function tokenFor(timestamp: number, code = CODE): string {
  const raw = String(timestamp);
  const signature = createHmac('sha256', code).update(raw).digest('hex');
  return `${raw}.${signature}`;
}

/** An API request carrying (or not) the access cookie. */
function apiRequest(cookieValue?: string): NextRequest {
  const headers = new Headers();
  if (cookieValue !== undefined) {
    headers.set('cookie', `openmaic_access=${cookieValue}`);
  }
  return new NextRequest('http://localhost/api/foo', { method: 'GET', headers });
}

describe('middleware access-token gate', () => {
  beforeEach(() => {
    process.env.ACCESS_CODE = CODE;
    process.env.LEARNER_ACCESS_CODE = LEARNER_CODE;
  });

  afterEach(() => {
    delete process.env.ACCESS_CODE;
    delete process.env.LEARNER_ACCESS_CODE;
  });

  it('rejects a correctly signed cookie older than the max age', async () => {
    const stale = tokenFor(Date.now() - ACCESS_TOKEN_MAX_AGE_MS - 1000);

    const response = await middleware(apiRequest(stale));

    expect(response.status).toBe(401);
  });

  it('lets a fresh, correctly signed cookie through', async () => {
    const fresh = tokenFor(Date.now());

    const response = await middleware(apiRequest(fresh));

    expect(response.status).not.toBe(401);
  });

  it('rejects an uppercase-hex signature', async () => {
    const [timestamp, signature] = tokenFor(Date.now()).split('.');

    const response = await middleware(apiRequest(`${timestamp}.${signature.toUpperCase()}`));

    expect(response.status).toBe(401);
  });

  it('rejects a missing cookie', async () => {
    const response = await middleware(apiRequest());
    expect(response.status).toBe(401);
  });

  it('allows a learner token to read learner-safe course APIs', async () => {
    const headers = new Headers({
      cookie: `openmaic_learner_access=${tokenFor(Date.now(), LEARNER_CODE)}`,
    });
    const request = new NextRequest('http://localhost/api/stage-meta/course-1', {
      method: 'GET',
      headers,
    });

    const response = await middleware(request);
    expect(response.status).not.toBe(401);
    expect(response.status).not.toBe(403);
  });

  it('refuses learner access to administrator course APIs', async () => {
    const headers = new Headers({
      cookie: `openmaic_learner_access=${tokenFor(Date.now(), LEARNER_CODE)}`,
    });
    const request = new NextRequest('http://localhost/api/stages/course-1', {
      method: 'GET',
      headers,
    });

    const response = await middleware(request);
    expect(response.status).toBe(403);
  });

  it('refuses learner access to course-generation APIs', async () => {
    const headers = new Headers({
      cookie: `openmaic_learner_access=${tokenFor(Date.now(), LEARNER_CODE)}`,
    });
    const request = new NextRequest('http://localhost/api/generate-classroom', {
      method: 'POST',
      headers,
    });

    const response = await middleware(request);
    expect(response.status).toBe(403);
  });

  it('allows the learner page to render its login guard without a cookie', async () => {
    const response = await middleware(new NextRequest('http://localhost/learn'));
    expect(response.status).not.toBe(401);
    expect(response.status).not.toBe(403);
  });
});
