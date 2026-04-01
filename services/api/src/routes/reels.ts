import { FastifyInstance } from 'fastify';
import { requireAuth, supabaseAdmin } from '../middleware/auth';
import { enqueueReelGeneration } from '../services/queue.service';
import { storageService } from '../services/storage.service';
import { STORAGE_BUCKETS } from '@highlight-reel/shared';

export async function reelRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', requireAuth);

  // GET /api/reels - List user's reels
  fastify.get('/', async (request) => {
    const supabase = (request as any).supabase;

    const { data, error } = await supabase
      .from('reels')
      .select('*, players(name, sport)')
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return { reels: data };
  });

  // GET /api/reels/:id - Get a single reel with its clips
  fastify.get<{ Params: { id: string } }>('/:id', async (request) => {
    const supabase = (request as any).supabase;
    const { id } = request.params;

    const { data: reel, error } = await supabase
      .from('reels')
      .select('*, reel_clips(*, highlights(*))')
      .eq('id', id)
      .single();

    if (error) throw new Error(error.message);
    if (!reel) {
      throw Object.assign(new Error('Reel not found'), { statusCode: 404 });
    }

    // Generate download URL if reel is ready
    let download_url = null;
    if (reel.status === 'ready' && reel.storage_path) {
      try {
        download_url = await storageService.createDownloadUrl(
          STORAGE_BUCKETS.REELS,
          reel.storage_path,
          3600
        );
      } catch {
        // Non-fatal
      }
    }

    return { reel: { ...reel, download_url } };
  });

  // POST /api/reels - Create a reel and start generation
  fastify.post('/', async (request, reply) => {
    const user = (request as any).user;
    const supabase = (request as any).supabase;
    const { title, description, player_id, clips } = request.body as {
      title: string;
      description?: string;
      player_id?: string;
      clips: {
        highlight_id: string;
        position: number;
        transition_type?: string;
      }[];
    };

    if (!title || !clips?.length) {
      throw Object.assign(
        new Error('Title and at least one clip are required'),
        { statusCode: 400 }
      );
    }

    // Create the reel record
    const { data: reel, error: reelError } = await supabase
      .from('reels')
      .insert({
        user_id: user.id,
        title,
        description,
        player_id,
        status: 'pending',
      })
      .select()
      .single();

    if (reelError) throw new Error(reelError.message);

    // Create reel_clips records
    const clipRows = clips.map((c) => ({
      reel_id: reel.id,
      highlight_id: c.highlight_id,
      position: c.position,
      transition_type: c.transition_type || 'cut',
    }));

    const { error: clipsError } = await supabase
      .from('reel_clips')
      .insert(clipRows);

    if (clipsError) throw new Error(clipsError.message);

    // Fetch highlight + video details for each clip to pass to the worker
    const { data: highlightDetails, error: highlightError } = await supabaseAdmin
      .from('highlights')
      .select('id, start_time_ms, end_time_ms, videos(storage_path, storage_bucket)')
      .in(
        'id',
        clips.map((c) => c.highlight_id)
      );

    if (highlightError) throw new Error(highlightError.message);

    // Build clip data for the worker
    const workerClips = clips.map((c) => {
      const detail = highlightDetails?.find((h: any) => h.id === c.highlight_id);
      const video = (detail as any)?.videos;
      return {
        highlightId: c.highlight_id,
        videoStoragePath: video?.storage_path || '',
        videoStorageBucket: video?.storage_bucket || STORAGE_BUCKETS.PROCESSED_VIDEOS,
        startTimeMs: detail?.start_time_ms || 0,
        endTimeMs: detail?.end_time_ms || 0,
        position: c.position,
        transitionType: c.transition_type || 'cut',
      };
    });

    // Enqueue reel generation job
    try {
      await enqueueReelGeneration({
        reelId: reel.id,
        userId: user.id,
        clips: workerClips,
        title,
      });
    } catch (queueError: any) {
      console.warn('Failed to enqueue reel generation:', queueError.message);
    }

    return reply.status(201).send({ reel });
  });

  // DELETE /api/reels/:id - Delete a reel
  fastify.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const supabase = (request as any).supabase;
    const { id } = request.params;

    // Get storage path before deleting
    const { data: reel } = await supabase
      .from('reels')
      .select('storage_path, thumbnail_path')
      .eq('id', id)
      .single();

    if (reel) {
      const pathsToDelete = [reel.storage_path, reel.thumbnail_path].filter(
        Boolean
      );
      if (pathsToDelete.length > 0) {
        await storageService
          .deleteFiles(STORAGE_BUCKETS.REELS, pathsToDelete)
          .catch(() => {});
      }
    }

    const { error } = await supabase.from('reels').delete().eq('id', id);
    if (error) throw new Error(error.message);

    return reply.status(204).send();
  });
}
