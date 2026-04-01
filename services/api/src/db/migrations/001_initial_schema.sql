-- HighlightReel Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- PROFILES (extends Supabase auth.users)
-- ============================================
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Auto-create profile when a user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, display_name)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- PLAYERS (the kids)
-- ============================================
CREATE TABLE players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sport TEXT,
    team_name TEXT,
    jersey_number TEXT,
    birth_year INT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_players_user_id ON players(user_id);

-- ============================================
-- VIDEOS
-- ============================================
CREATE TABLE videos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    player_id UUID REFERENCES players(id) ON DELETE SET NULL,
    title TEXT,
    description TEXT,
    sport TEXT,
    storage_path TEXT NOT NULL,
    storage_bucket TEXT NOT NULL,
    thumbnail_path TEXT,
    duration_seconds NUMERIC,
    file_size_bytes BIGINT,
    mime_type TEXT,
    width INT,
    height INT,
    status TEXT NOT NULL DEFAULT 'uploading'
        CHECK (status IN ('uploading', 'uploaded', 'processing', 'analyzed', 'failed')),
    processing_error TEXT,
    recorded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_videos_user_id ON videos(user_id);
CREATE INDEX idx_videos_player_id ON videos(player_id);
CREATE INDEX idx_videos_status ON videos(status);

-- ============================================
-- HIGHLIGHTS
-- ============================================
CREATE TABLE highlights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    start_time_ms INT NOT NULL,
    end_time_ms INT NOT NULL,
    duration_ms INT GENERATED ALWAYS AS (end_time_ms - start_time_ms) STORED,
    label TEXT,
    source TEXT NOT NULL DEFAULT 'ai' CHECK (source IN ('ai', 'manual')),
    ai_score NUMERIC,
    ai_type TEXT,
    is_accepted BOOLEAN DEFAULT NULL,
    thumbnail_path TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_highlights_video_id ON highlights(video_id);
CREATE INDEX idx_highlights_user_id ON highlights(user_id);

-- ============================================
-- REELS
-- ============================================
CREATE TABLE reels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    player_id UUID REFERENCES players(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    storage_path TEXT,
    thumbnail_path TEXT,
    duration_seconds NUMERIC,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'ready', 'failed')),
    processing_error TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_reels_user_id ON reels(user_id);

-- ============================================
-- REEL CLIPS
-- ============================================
CREATE TABLE reel_clips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reel_id UUID NOT NULL REFERENCES reels(id) ON DELETE CASCADE,
    highlight_id UUID NOT NULL REFERENCES highlights(id) ON DELETE CASCADE,
    position INT NOT NULL,
    transition_type TEXT DEFAULT 'cut' CHECK (transition_type IN ('cut', 'crossfade', 'fade_to_black')),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_reel_clips_reel_id ON reel_clips(reel_id);

-- ============================================
-- PROCESSING JOBS
-- ============================================
CREATE TABLE processing_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL CHECK (type IN ('video_analysis', 'reel_generation')),
    reference_id UUID NOT NULL,
    user_id UUID NOT NULL REFERENCES profiles(id),
    status TEXT NOT NULL DEFAULT 'queued'
        CHECK (status IN ('queued', 'running', 'completed', 'failed')),
    progress INT DEFAULT 0,
    error TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_processing_jobs_reference ON processing_jobs(reference_id);
CREATE INDEX idx_processing_jobs_status ON processing_jobs(status);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE highlights ENABLE ROW LEVEL SECURITY;
ALTER TABLE reels ENABLE ROW LEVEL SECURITY;
ALTER TABLE reel_clips ENABLE ROW LEVEL SECURITY;
ALTER TABLE processing_jobs ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read/update their own profile
CREATE POLICY "Users can view own profile"
    ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE USING (auth.uid() = id);

-- Players: users can CRUD their own players
CREATE POLICY "Users can view own players"
    ON players FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own players"
    ON players FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own players"
    ON players FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own players"
    ON players FOR DELETE USING (auth.uid() = user_id);

-- Videos: users can CRUD their own videos
CREATE POLICY "Users can view own videos"
    ON videos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own videos"
    ON videos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own videos"
    ON videos FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own videos"
    ON videos FOR DELETE USING (auth.uid() = user_id);

-- Highlights: users can CRUD their own highlights
CREATE POLICY "Users can view own highlights"
    ON highlights FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own highlights"
    ON highlights FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own highlights"
    ON highlights FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own highlights"
    ON highlights FOR DELETE USING (auth.uid() = user_id);

-- Reels: users can CRUD their own reels
CREATE POLICY "Users can view own reels"
    ON reels FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own reels"
    ON reels FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own reels"
    ON reels FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own reels"
    ON reels FOR DELETE USING (auth.uid() = user_id);

-- Reel clips: users can manage clips on their own reels
CREATE POLICY "Users can view own reel clips"
    ON reel_clips FOR SELECT
    USING (EXISTS (SELECT 1 FROM reels WHERE reels.id = reel_clips.reel_id AND reels.user_id = auth.uid()));
CREATE POLICY "Users can create own reel clips"
    ON reel_clips FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM reels WHERE reels.id = reel_clips.reel_id AND reels.user_id = auth.uid()));
CREATE POLICY "Users can delete own reel clips"
    ON reel_clips FOR DELETE
    USING (EXISTS (SELECT 1 FROM reels WHERE reels.id = reel_clips.reel_id AND reels.user_id = auth.uid()));

-- Processing jobs: users can view their own jobs
CREATE POLICY "Users can view own jobs"
    ON processing_jobs FOR SELECT USING (auth.uid() = user_id);

-- ============================================
-- STORAGE BUCKETS (run in Supabase dashboard or via API)
-- ============================================
-- INSERT INTO storage.buckets (id, name, public) VALUES ('raw-videos', 'raw-videos', false);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('processed-videos', 'processed-videos', false);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('reels', 'reels', false);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('thumbnails', 'thumbnails', true);

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON videos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON highlights
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON reels
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
