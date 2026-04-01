export type VideoStatus =
  | 'uploading'
  | 'uploaded'
  | 'processing'
  | 'analyzed'
  | 'failed';

export interface Video {
  id: string;
  user_id: string;
  player_id: string | null;
  title: string | null;
  description: string | null;
  sport: string | null;
  storage_path: string;
  storage_bucket: string;
  thumbnail_path: string | null;
  duration_seconds: number | null;
  file_size_bytes: number | null;
  mime_type: string | null;
  width: number | null;
  height: number | null;
  status: VideoStatus;
  processing_error: string | null;
  recorded_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface VideoUploadRequest {
  title?: string;
  sport?: string;
  player_id?: string;
  file_name: string;
  file_size: number;
  mime_type: string;
}

export interface VideoUploadResponse {
  video_id: string;
  upload_url: string;
  storage_path: string;
}
