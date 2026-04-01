export type HighlightSource = 'ai' | 'manual';

export type HighlightType =
  | 'motion'
  | 'audio_spike'
  | 'scene_change'
  | 'combined';

export interface Highlight {
  id: string;
  video_id: string;
  user_id: string;
  start_time_ms: number;
  end_time_ms: number;
  duration_ms: number;
  label: string | null;
  source: HighlightSource;
  ai_score: number | null;
  ai_type: HighlightType | null;
  is_accepted: boolean | null;
  thumbnail_path: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateHighlightRequest {
  video_id: string;
  start_time_ms: number;
  end_time_ms: number;
  label?: string;
}

export interface UpdateHighlightRequest {
  start_time_ms?: number;
  end_time_ms?: number;
  label?: string;
  is_accepted?: boolean;
}
