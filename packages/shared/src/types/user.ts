export interface Profile {
  id: string;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Player {
  id: string;
  user_id: string;
  name: string;
  sport: string | null;
  team_name: string | null;
  jersey_number: string | null;
  birth_year: number | null;
  avatar_url: string | null;
  created_at: string;
}

export type Sport =
  | 'soccer'
  | 'basketball'
  | 'baseball'
  | 'football'
  | 'hockey'
  | 'lacrosse'
  | 'volleyball'
  | 'tennis'
  | 'swimming'
  | 'track'
  | 'other';
