import type { ReactNode } from 'react';

import { LearnerAccessGuard } from '@/components/learner-access-guard';

export default function LearnerLayout({ children }: { children: ReactNode }) {
  return <LearnerAccessGuard>{children}</LearnerAccessGuard>;
}
