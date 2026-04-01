import { FastifyRequest, FastifyReply } from 'fastify';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config';

// Admin client for server-side operations
export const supabaseAdmin = createClient(
  config.supabase.url,
  config.supabase.serviceRoleKey
);

// Create a per-request Supabase client with the user's JWT
export function createUserClient(accessToken: string) {
  return createClient(config.supabase.url, config.supabase.anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

// Fastify hook to verify auth and attach user to request
export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const authHeader = request.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return reply.status(401).send({ error: 'Missing authorization header' });
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    const {
      data: { user },
      error,
    } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      return reply.status(401).send({ error: 'Invalid or expired token' });
    }

    // Attach user and token to request for downstream use
    (request as any).user = user;
    (request as any).accessToken = token;
    (request as any).supabase = createUserClient(token);
  } catch {
    return reply.status(401).send({ error: 'Authentication failed' });
  }
}
