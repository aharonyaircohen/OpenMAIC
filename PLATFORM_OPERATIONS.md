# Platform operations

This guide covers the normal administrator workflow for the deployed learning
platform. Deployment and database setup are documented in
[PLATFORM_DEPLOYMENT.md](PLATFORM_DEPLOYMENT.md).

## Addresses and roles

- Administrator studio: <https://learn.thedigitalreality.app/>
- Student portal: <https://learn.thedigitalreality.app/learn>

Administrators use the shared administrator code. Students use the separate
student code. Never give the administrator code to a student.

## Configure a model provider

Course generation requires a working model provider.

For a stable shared deployment, configure provider credentials as Vercel server
environment variables. This keeps the same provider available to every
administrator browser. See `.env.example` for supported providers and variable
names.

An administrator may also configure a provider through the studio interface.
Browser-entered provider settings are tied to that administrator's stored
settings and should not be treated as a central platform configuration.

After changing provider variables:

1. Redeploy the Vercel project.
2. Sign in as administrator.
3. Open provider settings.
4. Select the intended provider and a specific model.
5. Run the provider/model verification action before generating a course.

OpenRouter may expose a large model catalog. Select and verify one specific
model rather than leaving model choice ambiguous.

## Create a course

1. Sign in to the administrator studio.
2. Confirm that the intended provider and model pass verification.
3. Create a course or import source material.
4. Generate or edit its lessons, media, and quizzes.
5. Review every lesson as a student would see it.
6. Confirm that generation is complete.
7. Use **Publish to students** on the course card.
8. Open the student portal in a private browser session and verify the course.

Only administrators can create, edit, publish, unpublish, delete, import, or
export courses.

## Publish and unpublish

A course appears in the student portal only when both conditions are true:

- generation is marked complete; and
- the administrator has published it.

Publishing does not copy the course. It changes the course's visibility in
`stage_meta`, so later administrator edits affect the same course.

To remove a course from the portal without deleting it, use **Unpublish**. Always
check `/learn` after changing visibility.

## Migrate an existing browser-only course

Older OpenMAIC courses may exist only in IndexedDB in the browser where they
were created. Connecting Neon does not discover those courses automatically.

To migrate one safely:

1. Use the same browser profile that contains the original course.
2. Open <https://learn.thedigitalreality.app/>.
3. Enter the administrator code.
4. Open the existing course and wait for it to load completely.
5. Return to the course list and reopen it once to confirm it survived a reload.
6. Review its lessons, media, and quizzes.
7. Publish it.
8. Open `/learn` in a private session and verify playback.

Migration is lazy and happens one course at a time when a browser-only course is
first accessed while server persistence is enabled. Do not clear that browser's
site data until every required course has been migrated and verified.

If the course is missing, stop. Do not create another course with the same name
until the original browser profile and IndexedDB data have been checked.

## Student workflow

1. Give the student the `/learn` URL and the student code only.
2. The student enters the code and chooses a published course.
3. Playback and supported learner interactions are saved automatically.
4. The student can sign out from the learner portal.

There are no individual student accounts yet. The shared code grants cohort
access, and some identity/progress state is tied to the browser device. Do not
promise account-based enrolment, teacher dashboards, grades per named student,
or reliable cross-device resume until those features are implemented.

## Audio and Hebrew

Text-to-speech is optional. A course must remain usable without it.

- Browser-native voices depend on the student's operating system and browser.
- A voice that does not support Hebrew may pronounce Hebrew as English.
- Administrators should select and test a Hebrew-capable voice for Hebrew
  courses.
- If no acceptable Hebrew voice is available, leave narration disabled rather
  than publishing misleading audio.

Always test narration on the deployed course and on the type of device students
will use.

## Change access codes

To rotate a code:

1. Generate a long random replacement.
2. Change `ACCESS_CODE` or `LEARNER_ACCESS_CODE` in Vercel Production settings.
3. Redeploy.
4. Test the new code in a private session.
5. Confirm that the old code no longer works.
6. Distribute the new code through an appropriate private channel.

Changing a code invalidates cookies signed with the previous value.

## Change the persistence token

`PERSISTENCE_DEV_TOKEN` and `NEXT_PUBLIC_PERSISTENCE_TOKEN` must always contain
the same value.

1. Generate a replacement token.
2. update both Vercel variables together.
3. Redeploy because the `NEXT_PUBLIC_` value is a build-time setting.
4. Verify administrator course loading and the student portal.

This token is visible in the browser bundle and is not a substitute for user
authentication.

## Routine checks

After every deployment:

- Check administrator login.
- Check student login in a separate session.
- Open at least one published course.
- Test one lesson, media item, and quiz when available.
- Confirm students cannot access an administrator API.
- Review Vercel function errors.
- Review Neon connection and storage health.

Periodically:

- Unpublish obsolete courses.
- Rotate shared access codes when group membership changes.
- Review model-provider usage and spending.
- Confirm that a recent Neon backup or branch can be used for recovery.
- Remove unused preview deployments and stale environment variables.

## Troubleshooting

### The student portal is empty

Check that the course exists in PostgreSQL, generation is complete, and the
course is published. A browser-only course must be migrated first.

### The administrator sees an empty course list

Do not create replacements immediately. Check whether the old courses remain in
another browser profile's IndexedDB. Also check that
`NEXT_PUBLIC_PERSISTENCE=1`, `DATABASE_URL` exists, and the two persistence
tokens match.

### Persistence is unavailable

Check Vercel logs for `PERSISTENCE_NOT_CONFIGURED`,
`PERSISTENCE_DEV_TOKEN_MISSING`, or `PERSISTENCE_INIT_FAILED`. Then verify the
Vercel environment, Neon connection, and a fresh production deployment.

### Students receive `403`

A student cookie cannot call administrator APIs. Confirm that the student is
using `/learn`, not `/`, and that the requested course is published.

### A provider or model fails

Verify the exact model, API key, endpoint, account balance, and provider limits.
Then use the built-in verification action. Database connectivity does not prove
that a model provider is correctly configured.

### A deployment works locally but not on Vercel

Compare Vercel Production variables with `.env.local`, paying special attention
to build-time `NEXT_PUBLIC_` variables. Redeploy after changing them, then run
the deployed verification checklist in `PLATFORM_DEPLOYMENT.md`.
