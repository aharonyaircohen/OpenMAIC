import { NextRequest, NextResponse } from 'next/server';

import { isAgentRuntimeConfigured, isProWorkbenchEnabled } from '@/lib/config/feature-flags';
import { verifyAccessTokenEdge } from '@/lib/server/access-token-edge';

const LEARNER_SAFE_GET_PREFIXES = [
  '/api/learner/',
  '/api/stage-meta/',
  '/api/classroom-media/',
  '/api/persistence/',
];

const LEARNER_SAFE_POST_PATHS = new Set(['/api/quiz-grade', '/api/proxy-media']);

export function isLearnerSafeApi(request: Pick<NextRequest, 'method' | 'nextUrl'>): boolean {
  const { pathname } = request.nextUrl;
  if (request.method === 'GET') {
    return LEARNER_SAFE_GET_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  }
  if (LEARNER_SAFE_POST_PATHS.has(pathname)) return true;
  // Quiz attempts and playback cursors are learner-owned runtime state. Course
  // documents, assets and provider configuration remain read-only to learners.
  return pathname.startsWith('/api/persistence/runtime/');
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Return an actual server-side 404 when either half of the workbench is off.
  // Edge middleware cannot reliably inspect server-only deployment variables,
  // so it enforces the public gate and leaves the complete runtime/database
  // check to Node. A Node-hosted middleware uses the same gate as startup.
  const canInspectServerRuntime = process.env.NEXT_RUNTIME !== 'edge';
  const workbenchEnabled =
    isProWorkbenchEnabled() && (!canInspectServerRuntime || isAgentRuntimeConfigured());
  if (!workbenchEnabled && (pathname === '/workbench' || pathname.startsWith('/workbench/'))) {
    return new NextResponse('Not found', { status: 404 });
  }

  const accessCode = process.env.ACCESS_CODE;
  const learnerAccessCode = process.env.LEARNER_ACCESS_CODE;
  if (!accessCode && !learnerAccessCode) {
    return NextResponse.next();
  }

  // Authentication endpoints and health checks must be reachable before a
  // role cookie exists.
  if (
    pathname.startsWith('/api/access-code/') ||
    pathname.startsWith('/api/learner-access/') ||
    pathname === '/api/health'
  ) {
    return NextResponse.next();
  }

  // Administrators retain the existing full-access cookie and behavior.
  const adminCookie = request.cookies.get('openmaic_access');
  if (
    accessCode &&
    adminCookie?.value &&
    (await verifyAccessTokenEdge(adminCookie.value, accessCode))
  ) {
    return NextResponse.next();
  }

  const learnerCookie = request.cookies.get('openmaic_learner_access');
  const learnerAuthenticated =
    !!learnerAccessCode &&
    !!learnerCookie?.value &&
    (await verifyAccessTokenEdge(learnerCookie.value, learnerAccessCode));

  if (learnerAuthenticated) {
    if (pathname === '/learn' || pathname.startsWith('/learn/')) {
      return NextResponse.next();
    }
    if (pathname.startsWith('/api/') && isLearnerSafeApi(request)) {
      return NextResponse.next();
    }
  }

  // Operators may intentionally expose published courses without a cohort
  // code. The administrator studio remains protected by ACCESS_CODE.
  if (!learnerAccessCode) {
    if (pathname === '/learn' || pathname.startsWith('/learn/')) {
      return NextResponse.next();
    }
    if (pathname.startsWith('/api/') && isLearnerSafeApi(request)) {
      return NextResponse.next();
    }
  }

  // Let learner pages render their dedicated access-code dialog. No studio
  // component is mounted on these routes.
  if (pathname === '/learn' || pathname.startsWith('/learn/')) {
    return NextResponse.next();
  }

  // API requests without valid cookie → 401
  if (pathname.startsWith('/api/')) {
    return NextResponse.json(
      {
        success: false,
        errorCode: learnerAuthenticated ? 'FORBIDDEN' : 'INVALID_REQUEST',
        error: learnerAuthenticated ? 'Administrator access required' : 'Access code required',
      },
      { status: learnerAuthenticated ? 403 : 401 },
    );
  }

  // Page requests → let through, frontend shows modal
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logos/).*)'],
};
