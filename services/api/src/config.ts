import dotenv from 'dotenv';
import path from 'path';

// Load .env from infra directory
dotenv.config({ path: path.resolve(__dirname, '../../../infra/.env') });

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  supabase: {
    url: process.env.SUPABASE_URL || '',
    anonKey: process.env.SUPABASE_ANON_KEY || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },

  ai: {
    serviceUrl: process.env.AI_SERVICE_URL || 'http://localhost:8001',
  },
} as const;

// Validate required config
export function validateConfig() {
  const required = [
    ['SUPABASE_URL', config.supabase.url],
    ['SUPABASE_ANON_KEY', config.supabase.anonKey],
    ['SUPABASE_SERVICE_ROLE_KEY', config.supabase.serviceRoleKey],
  ] as const;

  const missing = required.filter(([, value]) => !value);

  if (missing.length > 0) {
    console.warn(
      `⚠️  Missing environment variables: ${missing.map(([name]) => name).join(', ')}`
    );
    console.warn('   Copy infra/.env.example to infra/.env and fill in your values.');
  }
}
