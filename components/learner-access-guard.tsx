'use client';

import { useEffect, useState, type ReactNode } from 'react';

import { AccessCodeModal } from '@/components/access-code-modal';

export function LearnerAccessGuard({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState({
    enabled: false,
    authenticated: false,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;
    fetch('/api/learner-access/status')
      .then((response) => response.json())
      .then((body) => {
        if (!cancelled) {
          setStatus({
            enabled: body.enabled === true,
            authenticated: body.authenticated === true,
            loading: false,
          });
        }
      })
      .catch(() => {
        if (!cancelled) setStatus({ enabled: true, authenticated: false, loading: false });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const needsAuth = !status.loading && status.enabled && !status.authenticated;
  const canRender = !status.loading && (!status.enabled || status.authenticated);

  return (
    <>
      {needsAuth ? (
        <AccessCodeModal
          open
          endpoint="/api/learner-access/verify"
          title="Student access"
          subtitle="Enter the code supplied by your teacher"
          errorMessage="That student access code is not valid."
          onSuccess={() => setStatus((current) => ({ ...current, authenticated: true }))}
        />
      ) : null}
      {canRender ? children : null}
    </>
  );
}
