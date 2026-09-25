import { apiError, apiSuccess } from '@/lib/server/api-response';
import { getApplicationRole } from '@/lib/server/role-access';
import { getStageAccessDb } from '@/lib/server/stage-access';

interface PublishedCourseRow extends Record<string, unknown> {
  id: string;
  name: string;
  description: string | null;
  published_at: string | number | null;
  scene_count: string | number;
}

export async function GET() {
  const role = await getApplicationRole();
  if (role === 'anonymous' && process.env.LEARNER_ACCESS_CODE) {
    return apiError('INVALID_REQUEST', 401, 'Student access required');
  }

  try {
    const db = await getStageAccessDb();
    const result = await db.query<PublishedCourseRow>(`
      SELECT d.id,
             d.name,
             d.description,
             m.published_at,
             COUNT(s.id) AS scene_count
        FROM stage_meta m
        JOIN document_stages d ON d.id = m.stage_id
        LEFT JOIN document_scenes s ON s.stage_id = d.id
       WHERE m.is_public = TRUE
         AND m.generation_complete = TRUE
         AND m.deleted_at IS NULL
       GROUP BY d.id, d.name, d.description, m.published_at
       ORDER BY m.published_at DESC NULLS LAST, d.updated_at DESC
    `);

    return apiSuccess({
      courses: result.rows.map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description ?? '',
        publishedAt: row.published_at === null ? null : Number(row.published_at),
        sceneCount: Number(row.scene_count),
      })),
    });
  } catch (error) {
    console.error('[learner-courses] failed to list published courses', error);
    return apiError('INTERNAL_ERROR', 500, 'Unable to load courses');
  }
}
