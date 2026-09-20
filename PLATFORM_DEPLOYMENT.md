# Platform deployment

This document describes the deployed OpenMAIC learning platform maintained in
this repository. It covers the Vercel application, Neon PostgreSQL, access
control, required environment variables, deployment, and verification.

For normal course operations, see [PLATFORM_OPERATIONS.md](PLATFORM_OPERATIONS.md).

## Current deployment

| Item | Value |
| --- | --- |
| Production site | <https://learn.thedigitalreality.app> |
| Administrator studio | <https://learn.thedigitalreality.app/> |
| Student portal | <https://learn.thedigitalreality.app/learn> |
| Vercel project | `openmaic-test` |
| Neon integration | `neon-bole-mountain` |
| Database engine | Neon PostgreSQL |
| Deployment configuration | `vercel.json` |
| Last full production verification | 2026-09-20 |

The access codes, database URL, provider keys, and persistence token are secrets.
They must exist only in Vercel, Neon, or an ignored local environment file. Do
not place their values in Git, documentation, screenshots, issues, or chat logs.

## What is deployed

The platform has two user experiences:

- Administrators enter the main studio at `/`. They can configure providers,
  create and edit courses, generate content, and publish or unpublish courses.
- Students enter the simplified portal at `/learn`. They can only see courses
  that are both complete and published.

The current login system uses two shared codes:

- `ACCESS_CODE` protects the administrator studio and administrator APIs.
- `LEARNER_ACCESS_CODE` protects the student portal and learner-safe APIs.

A successful login creates a signed, HTTP-only cookie valid for seven days.
Changing the corresponding access code invalidates existing cookies.

This is cohort access, not individual user registration. The platform does not
currently provide named accounts, password recovery, enrolment records, or
per-user administrator permissions.

## Data architecture

The production application runs on Vercel. Durable course data and supported
runtime data are stored in Neon PostgreSQL through the embedded persistence API
at `/api/persistence`.

The database schema is created automatically on the first persistence request.
It currently includes document, scene, metadata, runtime, material, folder, and
asset tables. Important tables include:

- `document_stages`: course documents.
- `document_scenes`: course lessons/scenes.
- `stage_meta`: ownership, generation state, and publish state.
- `runtime_sessions` and `runtime_records`: learner runtime state.
- `asset_entries`, `asset_blobs`, and reference tables: generated media.
- `owner_material` and `document_folders`: administrator materials and folders.

Some device identity and interface state remains browser-scoped. There are no
individual student accounts, so clearing browser data or switching devices may
lose the browser's learner identity and locally scoped progress.

## Required environment variables

Configure these values in Vercel. Use long random values for all codes and
tokens.

| Variable | Scope | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Server | Pooled Neon PostgreSQL connection. Added by the Neon integration. |
| `NEXT_PUBLIC_PERSISTENCE` | Build and browser | Set to `1` to use server-backed persistence. |
| `PERSISTENCE_DEV_TOKEN` | Server | Shared persistence binding token. |
| `NEXT_PUBLIC_PERSISTENCE_TOKEN` | Build and browser | Must exactly match `PERSISTENCE_DEV_TOKEN`. |
| `ACCESS_CODE` | Server | Shared administrator access code. |
| `LEARNER_ACCESS_CODE` | Server | Shared student access code. Leave unset only if the student portal should be public. |

At least one model provider must also be configured before administrators can
generate course content. Provider variables are listed in `.env.example`.

`NEXT_PUBLIC_PERSISTENCE` and `NEXT_PUBLIC_PERSISTENCE_TOKEN` are compiled into
the browser bundle. Any change to either variable requires a new deployment.
The public persistence token is not an authentication secret and must not be
treated as user isolation.

For production, set all required values in Vercel's **Production** environment.
Set them in **Preview** only if preview deployments should be functional, and in
**Development** when using `vercel dev` or pulling the development environment.
The current project has the platform variables in Production and Development;
Preview is not configured and should not be treated as a working platform.

## Create or reconnect Neon

The existing resource is already connected. These steps are for rebuilding the
integration or creating another environment.

1. Link the local checkout to the Vercel project:

   ```bash
   vercel link
   ```

2. Add the Neon integration:

   ```bash
   vercel integration add neon
   ```

3. Connect the new Neon resource to the `openmaic-test` project.
4. Confirm that Vercel added `DATABASE_URL` to the intended environments.
5. Add the remaining variables from the table above.
6. Redeploy. The schema will initialize on the first database-backed request.

For local work, pull environment values into an ignored file:

```bash
vercel env pull .env.local
```

Never commit `.env.local`. This repository ignores all `.env*.local` files.

## Deploy

Install and verify locally:

```bash
pnpm install
pnpm test
pnpm lint
pnpm exec tsc --noEmit
pnpm build
```

Deploy the current checkout to production:

```bash
vercel --prod
```

The production deployment should receive all three aliases:

- `learn.thedigitalreality.app`
- `openmaic-test-fawn.vercel.app`
- the Vercel project alias

Inspect the result:

```bash
vercel inspect https://learn.thedigitalreality.app
```

## Production verification

Run these checks after every persistence, access-control, learner, or deployment
change.

1. Open `/` in a private browser session. Confirm that the administrator code
   prompt appears and that the administrator code opens the studio.
2. Open `/learn` in a separate private session. Confirm that the student code
   opens the learner portal.
3. Confirm that only published, completed courses appear for students.
4. Confirm that a student session receives `403` from an administrator API.
5. Confirm that a missing course returns `404` from the persistence API rather
   than `PERSISTENCE_NOT_CONFIGURED` or `PERSISTENCE_INIT_FAILED`.
6. Confirm the expected PostgreSQL tables exist in Neon.

Example API checks use temporary cookie files and environment variables so codes
do not appear in shell history:

```bash
read -s "ADMIN_CODE?Admin code: "
echo
read -s "STUDENT_CODE?Student code: "
echo

curl -sS -c /tmp/openmaic-admin.cookies \
  -H 'content-type: application/json' \
  --data "{\"code\":\"$ADMIN_CODE\"}" \
  https://learn.thedigitalreality.app/api/access-code/verify

curl -sS -c /tmp/openmaic-student.cookies \
  -H 'content-type: application/json' \
  --data "{\"code\":\"$STUDENT_CODE\"}" \
  https://learn.thedigitalreality.app/api/learner-access/verify

curl -sS -b /tmp/openmaic-student.cookies \
  https://learn.thedigitalreality.app/api/learner/courses
```

Do not report a deployment as complete if the local tests pass but the deployed
checks fail.

## Security boundaries

- Administrator and student codes are shared credentials. Share each code only
  with its intended group.
- Students are restricted to `/learn`, published course reads, quiz grading,
  media proxying, and learner runtime writes. Administrator APIs return `403`.
- Publishing makes a completed course visible to every authenticated student.
  It does not enrol selected students.
- The current persistence token is bundled into browser JavaScript. It is a
  deployment binding, not real user authentication.
- Do not enable `PERSISTENCE_ALLOW_INSECURE_DEV_AUTH` for this public deployment.
- Individual accounts and trustworthy cross-device progress require a future
  authentication system that derives identity on the server.

## Recovery and rollback

- Use Vercel's deployment history to promote the last known-good application
  deployment when a release fails.
- Application rollback does not roll back PostgreSQL data.
- Before a risky data migration, create a Neon branch or backup using the Neon
  console and confirm that it can be restored.
- Never delete the Neon project while any production course depends on it.
- After restoring data, repeat the complete production verification checklist.
