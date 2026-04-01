import { FastifyInstance } from 'fastify';
import { requireAuth } from '../middleware/auth';

export async function userRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', requireAuth);

  // GET /api/users/me - Get current user's profile
  fastify.get('/me', async (request) => {
    const user = (request as any).user;
    const supabase = (request as any).supabase;

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) throw new Error(error.message);
    return { profile };
  });

  // PATCH /api/users/me - Update current user's profile
  fastify.patch('/me', async (request) => {
    const user = (request as any).user;
    const supabase = (request as any).supabase;
    const { display_name, avatar_url } = request.body as {
      display_name?: string;
      avatar_url?: string;
    };

    const updates: Record<string, any> = {};
    if (display_name) updates.display_name = display_name;
    if (avatar_url !== undefined) updates.avatar_url = avatar_url;

    const { data: profile, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return { profile };
  });

  // GET /api/users/me/players - Get current user's players
  fastify.get('/me/players', async (request) => {
    const supabase = (request as any).supabase;

    const { data: players, error } = await supabase
      .from('players')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return { players };
  });

  // POST /api/users/me/players - Add a player
  fastify.post('/me/players', async (request, reply) => {
    const user = (request as any).user;
    const supabase = (request as any).supabase;
    const { name, sport, team_name, jersey_number, birth_year } =
      request.body as any;

    const { data: player, error } = await supabase
      .from('players')
      .insert({
        user_id: user.id,
        name,
        sport,
        team_name,
        jersey_number,
        birth_year,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return reply.status(201).send({ player });
  });

  // PATCH /api/users/me/players/:id - Update a player
  fastify.patch<{ Params: { id: string } }>(
    '/me/players/:id',
    async (request) => {
      const supabase = (request as any).supabase;
      const { id } = request.params;
      const updates = request.body as any;

      const { data: player, error } = await supabase
        .from('players')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return { player };
    }
  );

  // DELETE /api/users/me/players/:id - Delete a player
  fastify.delete<{ Params: { id: string } }>(
    '/me/players/:id',
    async (request, reply) => {
      const supabase = (request as any).supabase;
      const { id } = request.params;

      const { error } = await supabase.from('players').delete().eq('id', id);
      if (error) throw new Error(error.message);

      return reply.status(204).send();
    }
  );
}
