import { FastifyInstance } from 'fastify';
import {
  createHighlightSchema,
  updateHighlightSchema,
} from '@highlight-reel/shared';
import { requireAuth } from '../middleware/auth';

export async function highlightRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', requireAuth);

  // GET /api/highlights?video_id=xxx - Get highlights for a video
  fastify.get<{ Querystring: { video_id: string } }>('/', async (request) => {
    const supabase = (request as any).supabase;
    const { video_id } = request.query;

    if (!video_id) {
      throw Object.assign(new Error('video_id query parameter is required'), {
        statusCode: 400,
      });
    }

    const { data, error } = await supabase
      .from('highlights')
      .select('*')
      .eq('video_id', video_id)
      .order('start_time_ms', { ascending: true });

    if (error) throw new Error(error.message);
    return { highlights: data };
  });

  // POST /api/highlights - Create a manual highlight
  fastify.post('/', async (request, reply) => {
    const user = (request as any).user;
    const supabase = (request as any).supabase;
    const body = createHighlightSchema.parse(request.body);

    const { data, error } = await supabase
      .from('highlights')
      .insert({
        video_id: body.video_id,
        user_id: user.id,
        start_time_ms: body.start_time_ms,
        end_time_ms: body.end_time_ms,
        label: body.label,
        source: 'manual',
        is_accepted: true, // Manual highlights are auto-accepted
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return reply.status(201).send({ highlight: data });
  });

  // PATCH /api/highlights/:id - Update a highlight (accept/reject, adjust times)
  fastify.patch<{ Params: { id: string } }>('/:id', async (request) => {
    const supabase = (request as any).supabase;
    const { id } = request.params;
    const body = updateHighlightSchema.parse(request.body);

    const { data, error } = await supabase
      .from('highlights')
      .update(body)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return { highlight: data };
  });

  // DELETE /api/highlights/:id - Delete a highlight
  fastify.delete<{ Params: { id: string } }>(
    '/:id',
    async (request, reply) => {
      const supabase = (request as any).supabase;
      const { id } = request.params;

      const { error } = await supabase
        .from('highlights')
        .delete()
        .eq('id', id);

      if (error) throw new Error(error.message);
      return reply.status(204).send();
    }
  );

  // POST /api/highlights/batch-update - Accept/reject multiple highlights
  fastify.post('/batch-update', async (request) => {
    const supabase = (request as any).supabase;
    const { updates } = request.body as {
      updates: { id: string; is_accepted: boolean }[];
    };

    const results = await Promise.all(
      updates.map(({ id, is_accepted }) =>
        supabase
          .from('highlights')
          .update({ is_accepted })
          .eq('id', id)
          .select()
          .single()
      )
    );

    const highlights = results
      .filter((r) => !r.error)
      .map((r) => r.data);

    return { highlights };
  });
}
