import { z } from 'zod';
import { HIGHLIGHT_DEFAULTS } from '../constants';

export const createHighlightSchema = z
  .object({
    video_id: z.string().uuid(),
    start_time_ms: z.number().int().min(0),
    end_time_ms: z.number().int().min(0),
    label: z.string().max(100).optional(),
  })
  .refine((data) => data.end_time_ms > data.start_time_ms, {
    message: 'End time must be after start time',
  })
  .refine(
    (data) =>
      data.end_time_ms - data.start_time_ms >= HIGHLIGHT_DEFAULTS.MIN_DURATION_MS,
    { message: `Highlight must be at least ${HIGHLIGHT_DEFAULTS.MIN_DURATION_MS / 1000} seconds` }
  );

export const updateHighlightSchema = z.object({
  start_time_ms: z.number().int().min(0).optional(),
  end_time_ms: z.number().int().min(0).optional(),
  label: z.string().max(100).optional(),
  is_accepted: z.boolean().optional(),
});
