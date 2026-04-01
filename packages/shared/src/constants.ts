export const SPORTS = [
  { value: 'soccer', label: 'Soccer' },
  { value: 'basketball', label: 'Basketball' },
  { value: 'baseball', label: 'Baseball' },
  { value: 'football', label: 'Football' },
  { value: 'hockey', label: 'Hockey' },
  { value: 'lacrosse', label: 'Lacrosse' },
  { value: 'volleyball', label: 'Volleyball' },
  { value: 'tennis', label: 'Tennis' },
  { value: 'swimming', label: 'Swimming' },
  { value: 'track', label: 'Track & Field' },
  { value: 'other', label: 'Other' },
] as const;

export const VIDEO_LIMITS = {
  MAX_FILE_SIZE_MB: 500,
  MAX_FILE_SIZE_BYTES: 500 * 1024 * 1024,
  ALLOWED_MIME_TYPES: [
    'video/mp4',
    'video/quicktime',
    'video/x-msvideo',
    'video/x-matroska',
    'video/webm',
  ],
  MAX_DURATION_MINUTES: 120,
} as const;

export const HIGHLIGHT_DEFAULTS = {
  MIN_DURATION_MS: 3000,
  MAX_DURATION_MS: 30000,
  DEFAULT_DURATION_MS: 10000,
  MAX_PER_VIDEO: 20,
} as const;

export const STORAGE_BUCKETS = {
  RAW_VIDEOS: 'raw-videos',
  PROCESSED_VIDEOS: 'processed-videos',
  REELS: 'reels',
  THUMBNAILS: 'thumbnails',
} as const;
