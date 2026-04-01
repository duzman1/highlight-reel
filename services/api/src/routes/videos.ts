import { FastifyInstance } from 'fastify';
import { videoUploadSchema, videoUpdateSchema } from '@highlight-reel/shared';
import { requireAuth, supabaseAdmin } from '../middleware/auth';
import { STORAGE_BUCKETS } from '@highlight-reel/shared';
import { randomUUID } from 'crypto';

export async function videoRoutes(fastify: FastifyInstance) {
  // All video routes require auth
  fastify.addHook('onRequest', requireAuth);

  // GET /api/videos - List user's videos
  fastify.get('/', async (request) => {
    const user = (request as any).user;
    const supabase = (request as any).supabase;

    const { data, error } = await supabase
      .from('videos')
      .select('*, players(name, sport)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return { videos: data };
  });

  // GET /api/videos/:id - Get single video with highlights
  fastify.get<{ Params: { id: string } }>('/:id', async (request) => {
    const supabase = (request as any).supabase;
    const { id } = request.params;

    const { data: video, error } = await supabase
      .from('videos')
      .select('*, players(name, sport), highlights(*)')
      .eq('id', id)
      .single();

    if (error) throw new Error(error.message);
    if (!video) {
      throw Object.assign(new Error('Video not found'), { statusCode: 404 });
    }

    return { video };
  });

  // POST /api/videos/upload-url - Get a pre-signed upload URL
  fastify.post('/upload-url', async (request, reply) => {
    const user = (request as any).user;
    const body = videoUploadSchema.parse(request.body);

    const videoId = randomUUID();
    const ext = body.file_name.split('.').pop() || 'mp4';
    const storagePath = `${user.id}/${videoId}.${ext}`;

    // Create video record in DB
    const { error: dbError } = await supabaseAdmin
      .from('videos')
      .insert({
        id: videoId,
        user_id: user.id,
        title: body.title || body.file_name,
        sport: body.sport,
        player_id: body.player_id,
        storage_path: storagePath,
        storage_bucket: STORAGE_BUCKETS.RAW_VIDEOS,
        file_size_bytes: body.file_size,
        mime_type: body.mime_type,
        status: 'uploading',
      });

    if (dbError) throw new Error(dbError.message);

    // Generate a pre-signed upload URL
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from(STORAGE_BUCKETS.RAW_VIDEOS)
      .createSignedUploadUrl(storagePath);

    if (uploadError) throw new Error(uploadError.message);

    return reply.status(201).send({
      video_id: videoId,
      upload_url: uploadData.signedUrl,
      storage_path: storagePath,
    });
  });

  // PATCH /api/videos/:id/status - Update video status (called after upload completes)
  fastify.patch<{ Params: { id: string } }>(
    '/:id/status',
    async (request) => {
      const user = (request as any).user;
      const { id } = request.params;
      const { status } = request.body as { status: string };

      if (status !== 'uploaded') {
        throw Object.assign(new Error('Can only set status to "uploaded"'), {
          statusCode: 400,
        });
      }

      const { data, error } = await supabaseAdmin
        .from('videos')
        .update({ status: 'uploaded' })
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw new Error(error.message);

      // TODO: Enqueue video processing job in BullMQ (Phase 3)

      return { video: data };
    }
  );

  // PATCH /api/videos/:id - Update video metadata
  fastify.patch<{ Params: { id: string } }>('/:id', async (request) => {
    const supabase = (request as any).supabase;
    const { id } = request.params;
    const body = videoUpdateSchema.parse(request.body);

    const { data, error } = await supabase
      .from('videos')
      .update(body)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return { video: data };
  });

  // DELETE /api/videos/:id - Delete a video
  fastify.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const user = (request as any).user;
    const supabase = (request as any).supabase;
    const { id } = request.params;

    // Get storage path before deleting
    const { data: video } = await supabase
      .from('videos')
      .select('storage_path, storage_bucket')
      .eq('id', id)
      .single();

    if (video) {
      // Delete from storage
      await supabaseAdmin.storage
        .from(video.storage_bucket)
        .remove([video.storage_path]);
    }

    // Delete from DB (cascades to highlights)
    const { error } = await supabase.from('videos').delete().eq('id', id);
    if (error) throw new Error(error.message);

    return reply.status(204).send();
  });
}
