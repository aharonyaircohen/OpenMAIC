'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { BookOpen, Loader2, LogOut, PlayCircle } from 'lucide-react';

type LearnerCourse = {
  id: string;
  name: string;
  description: string;
  publishedAt: number | null;
  sceneCount: number;
};

export default function LearnerHomePage() {
  const [courses, setCourses] = useState<LearnerCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/learner/courses', { credentials: 'include' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Unable to load courses');
        return response.json();
      })
      .then((body) => {
        if (!cancelled) setCourses(Array.isArray(body.courses) ? body.courses : []);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-6xl px-6 py-12 sm:px-8 lg:py-16">
        <header className="mb-12 flex items-start justify-between gap-6">
          <div className="max-w-2xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
              <BookOpen className="h-3.5 w-3.5" />
              Learning portal
            </div>
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Your courses</h1>
            <p className="mt-4 text-base leading-7 text-slate-300">
              Choose a course and continue at your own pace. Your progress is saved automatically.
            </p>
          </div>
          <button
            type="button"
            onClick={async () => {
              await fetch('/api/learner-access/logout', { method: 'POST' });
              window.location.reload();
            }}
            className="inline-flex shrink-0 items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-slate-300 transition hover:border-white/20 hover:bg-white/5 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </header>

        {loading ? (
          <div className="flex min-h-64 items-center justify-center text-slate-300">
            <Loader2 className="mr-3 h-5 w-5 animate-spin" /> Loading courses
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-300/20 bg-red-400/10 p-6 text-red-100">
            Courses could not be loaded. Please refresh the page or contact your teacher.
          </div>
        ) : courses.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-slate-300">
            No courses are published yet.
          </div>
        ) : (
          <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-label="Courses">
            {courses.map((course) => (
              <Link
                key={course.id}
                href={`/learn/${encodeURIComponent(course.id)}`}
                className="group flex min-h-64 flex-col rounded-3xl border border-white/10 bg-gradient-to-br from-blue-500/20 via-cyan-400/10 to-slate-900 p-6 shadow-2xl shadow-blue-950/30 transition hover:-translate-y-1 hover:border-cyan-300/40"
              >
                <div className="mb-8 flex items-center justify-between text-sm text-cyan-100">
                  <span>{course.sceneCount} lessons</span>
                  <PlayCircle className="h-7 w-7 transition group-hover:scale-110" />
                </div>
                <div className="mt-auto">
                  <h2 className="text-2xl font-semibold leading-tight">{course.name}</h2>
                  {course.description ? (
                    <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-300">
                      {course.description}
                    </p>
                  ) : null}
                  <span className="mt-6 inline-block text-sm font-semibold text-cyan-200">
                    Start course →
                  </span>
                </div>
              </Link>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
