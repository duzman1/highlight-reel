import { z } from 'zod';
import { VIDEO_LIMITS } from '../constants';

export const videoUploadSchema = z.object({
  title: z.string().max(200).optional(),
  sport: z.string().optional(),
  player_id: z.string().uuid().optional(),
  file_name: z.string().min(1),
  file_size: z
    .number()
    .positive()
    .max(VIDEO_LIMITS.MAX_FILE_SIZE_BYTES, 'File too large (max 500MB)'),
  mime_type: z.enum(VIDEO_LIMITS.ALLOWED_MIME_TYPES as unknown as [string, ...string[]]),
});

export const videoUpdateSchema = z.object({
  title: z.string().max(200).optional(),
  description: z.string().max(2000).optional(),
  sport: z.string().optional(),
  player_id: z.string().uuid().nullable().optional(),
});
