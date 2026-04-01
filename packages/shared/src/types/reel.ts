export type ReelStatus = 'pending' | 'processing' | 'ready' | 'failed';

export interface Reel {
  id: string;
  user_id: string;
  player_id: string | null;
  title: string;
  description: string | null;
  storage_path: string | null;
  thumbnail_path: string | null;
  duration_seconds: number | null;
  status: ReelStatus;
  processing_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReelClip {
  id: string;
  reel_id: string;
  highlight_id: string;
  position: number;
  transition_type: 'cut' | 'crossfade' | 'fade_to_black';
  created_at: string;
}

export interface CreateReelRequest {
  title: string;
  description?: string;
  player_id?: string;
  clips: {
    highlight_id: string;
    position: number;
    transition_type?: 'cut' | 'crossfade' | 'fade_to_black';
  }[];
}
