import { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../../lib/api';
import { supabase } from '../../../lib/supabase';
import { VideoPlayer, VideoPlayerRef } from '../../../components/video/VideoPlayer';
import { HighlightTimeline } from '../../../components/highlights/HighlightTimeline';
import { HighlightScrubber } from '../../../components/highlights/HighlightScrubber';
import { HighlightTagger } from '../../../components/highlights/HighlightTagger';
import { HighlightCard } from '../../../components/highlights/HighlightCard';
import { ReelBuilder } from '../../../components/reels/ReelBuilder';
import { ReelPreview } from '../../../components/reels/ReelPreview';
import type { Video, Highlight } from '@highlight-reel/shared';
import { STORAGE_BUCKETS } from '@highlight-reel/shared';

export default function VideoDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const playerRef = useRef<VideoPlayerRef>(null);
  const [video, setVideo] = useState<Video | null>(null);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [loading, setLoading] = useState(true);
  const [showReelBuilder, setShowReelBuilder] = useState(false);
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [currentPositionMs, setCurrentPositionMs] = useState(0);
  const [videoDurationMs, setVideoDurationMs] = useState(0);
  const [editingHighlight, setEditingHighlight] = useState<Highlight | null>(null);
  const [showTagger, setShowTagger] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    loadVideo();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [id]);

  const loadVideo = async () => {
    try {
      const { video: data } = await api.get<{
        video: Video & { highlights: Highlight[] };
      }>(`/api/videos/${id}`);
      setVideo(data);
      setHighlights(data.highlights || []);

      // Load video playback URL
      if (data.storage_path && data.storage_bucket) {
        try {
          const { data: urlData } = await supabase.storage
            .from(data.storage_bucket)
            .createSignedUrl(data.storage_path, 3600);
          if (urlData?.signedUrl) {
            setVideoUri(urlData.signedUrl);
          }
        } catch {
          // Video URL generation failed — player will show placeholder
        }
      }

      // Auto-poll if processing
      if (
        (data.status === 'processing' || data.status === 'uploaded') &&
        !pollRef.current
      ) {
        pollRef.current = setInterval(async () => {
          try {
            const { video: updated } = await api.get<{
              video: Video & { highlights: Highlight[] };
            }>(`/api/videos/${id}`);
            setVideo(updated);
            setHighlights(updated.highlights || []);
            if (
              updated.status !== 'processing' &&
              updated.status !== 'uploaded'
            ) {
              if (pollRef.current) {
                clearInterval(pollRef.current);
                pollRef.current = null;
              }
            }
          } catch {}
        }, 5000);
      }
    } catch (error) {
      console.error('Failed to load video:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateHighlight = async (highlightId: string, is_accepted: boolean) => {
    try {
      await api.patch(`/api/highlights/${highlightId}`, { is_accepted });
      setHighlights((prev) =>
        prev.map((h) => (h.id === highlightId ? { ...h, is_accepted } : h))
      );
    } catch (error) {
      console.error('Failed to update highlight:', error);
    }
  };

  const acceptAll = async () => {
    const pending = highlights.filter((h) => h.is_accepted === null);
    try {
      await api.post('/api/highlights/batch-update', {
        updates: pending.map((h) => ({ id: h.id, is_accepted: true })),
      });
      setHighlights((prev) =>
        prev.map((h) =>
          h.is_accepted === null ? { ...h, is_accepted: true } : h
        )
      );
    } catch (error) {
      console.error('Failed to accept all:', error);
    }
  };

  const seekTo = useCallback(async (positionMs: number) => {
    await playerRef.current?.seekTo(positionMs);
    await playerRef.current?.play();
  }, []);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#e94560" />
      </View>
    );
  }

  if (!video) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Video not found</Text>
      </View>
    );
  }

  const acceptedCount = highlights.filter((h) => h.is_accepted).length;
  const pendingCount = highlights.filter((h) => h.is_accepted === null).length;
  const isProcessing =
    video.status === 'processing' || video.status === 'uploaded';

  return (
    <ScrollView style={styles.container}>
      <Stack.Screen
        options={{
          title: video.title || 'Video Details',
          headerStyle: { backgroundColor: '#1a1a2e' },
          headerTintColor: '#fff',
        }}
      />

      {/* Video Player */}
      <VideoPlayer
        ref={playerRef}
        uri={videoUri}
        onPositionChange={setCurrentPositionMs}
        onDurationChange={setVideoDurationMs}
      />

      {/* Processing Banner */}
      {isProcessing && (
        <View style={styles.processingBanner}>
          <ActivityIndicator size="small" color="#fff" />
          <Text style={styles.processingText}>
            {video.status === 'uploaded'
              ? 'Queued for processing...'
              : 'AI is analyzing your video...'}
          </Text>
        </View>
      )}

      {video.status === 'failed' && (
        <View style={styles.errorBanner}>
          <Ionicons name="warning" size={18} color="#fff" />
          <Text style={styles.errorBannerText}>
            Processing failed: {video.processing_error || 'Unknown error'}
          </Text>
        </View>
      )}

      {/* Highlight Timeline */}
      {highlights.length > 0 && videoDurationMs > 0 && (
        <HighlightTimeline
          highlights={highlights}
          durationMs={videoDurationMs}
          currentPositionMs={currentPositionMs}
          onSeek={seekTo}
        />
      )}

      {/* Scrubber (when editing a highlight) */}
      {editingHighlight && videoDurationMs > 0 && (
        <HighlightScrubber
          highlight={editingHighlight}
          videoDurationMs={videoDurationMs}
          onUpdate={(updated) => {
            setHighlights((prev) =>
              prev.map((h) => (h.id === updated.id ? updated : h))
            );
          }}
          onSeek={seekTo}
          onClose={() => setEditingHighlight(null)}
        />
      )}

      {/* Manual Tagger */}
      {showTagger && (
        <HighlightTagger
          videoId={video.id}
          currentPositionMs={currentPositionMs}
          videoDurationMs={videoDurationMs}
          onHighlightCreated={(h) => {
            setHighlights((prev) => [...prev, h]);
          }}
          onClose={() => setShowTagger(false)}
        />
      )}

      {/* Video Info */}
      <View style={styles.section}>
        <Text style={styles.videoTitle}>{video.title || 'Untitled'}</Text>
        <View style={styles.metaRow}>
          {video.sport && (
            <View style={styles.tag}>
              <Text style={styles.tagText}>{video.sport}</Text>
            </View>
          )}
          {video.duration_seconds && (
            <Text style={styles.metaText}>
              {Math.floor(video.duration_seconds / 60)}:
              {String(Math.floor(video.duration_seconds % 60)).padStart(2, '0')}
            </Text>
          )}
          {video.width && video.height && (
            <Text style={styles.metaText}>
              {video.width}x{video.height}
            </Text>
          )}
        </View>
      </View>

      {/* Highlights Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Highlights</Text>
          <Text style={styles.sectionCount}>
            {acceptedCount} accepted / {highlights.length} total
          </Text>
        </View>

        {/* Action bar */}
        <View style={styles.actionBar}>
          {highlights.length > 0 && pendingCount > 0 && (
            <TouchableOpacity style={styles.acceptAllBtn} onPress={acceptAll}>
              <Ionicons name="checkmark-done" size={16} color="#10b981" />
              <Text style={styles.acceptAllText}>Accept All</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.tagBtn}
            onPress={() => {
              setShowTagger(!showTagger);
              setEditingHighlight(null);
            }}
          >
            <Ionicons name="bookmark-outline" size={16} color="#f59e0b" />
            <Text style={styles.tagBtnText}>
              {showTagger ? 'Close Tagger' : 'Tag Manually'}
            </Text>
          </TouchableOpacity>
        </View>

        {highlights.length === 0 ? (
          <View style={styles.emptyHighlights}>
            <Ionicons name="sparkles-outline" size={32} color="#4a4a6a" />
            <Text style={styles.emptyText}>
              {video.status === 'analyzed'
                ? 'No highlights detected. Use "Tag Manually" to add your own!'
                : isProcessing
                ? 'AI is analyzing your video...'
                : 'Upload and process your video to detect highlights.'}
            </Text>
          </View>
        ) : (
          highlights.map((highlight) => (
            <HighlightCard
              key={highlight.id}
              highlight={highlight}
              onAccept={() => updateHighlight(highlight.id, true)}
              onReject={() => updateHighlight(highlight.id, false)}
              onPlay={() => seekTo(highlight.start_time_ms)}
              onEdit={() => {
                setEditingHighlight(
                  editingHighlight?.id === highlight.id ? null : highlight
                );
                setShowTagger(false);
              }}
            />
          ))
        )}

        {pendingCount > 0 && (
          <Text style={styles.pendingNote}>
            {pendingCount} highlight{pendingCount > 1 ? 's' : ''} pending review
          </Text>
        )}
      </View>

      {/* Create Reel Button */}
      {acceptedCount > 0 && !showReelBuilder && (
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.reelButton}
            onPress={() => setShowReelBuilder(true)}
          >
            <Ionicons name="film" size={22} color="#fff" />
            <Text style={styles.reelButtonText}>
              Build Reel ({acceptedCount} clip{acceptedCount > 1 ? 's' : ''})
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Reel Builder */}
      {showReelBuilder && video && (
        <>
          <ReelPreview
            clips={highlights
              .filter((h) => h.is_accepted === true)
              .map((h, i) => ({
                highlight: h,
                position: i,
                transition_type: 'crossfade' as const,
              }))}
            onSeek={seekTo}
          />
          <ReelBuilder
            video={video}
            highlights={highlights}
            onSeek={seekTo}
            onClose={() => setShowReelBuilder(false)}
          />
        </>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f23',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f0f23',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 16,
  },
  processingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#8b5cf6',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  processingText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#ef4444',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  errorBannerText: {
    color: '#fff',
    fontSize: 13,
    flex: 1,
  },
  section: {
    padding: 20,
  },
  videoTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  metaText: {
    fontSize: 13,
    color: '#8888aa',
  },
  tag: {
    backgroundColor: '#2a2a4a',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  tagText: {
    color: '#8888aa',
    fontSize: 13,
    textTransform: 'capitalize',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  sectionCount: {
    fontSize: 13,
    color: '#8888aa',
  },
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginBottom: 12,
  },
  acceptAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#10b981',
  },
  acceptAllText: {
    color: '#10b981',
    fontSize: 12,
    fontWeight: '600',
  },
  tagBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  tagBtnText: {
    color: '#f59e0b',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyHighlights: {
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    color: '#8888aa',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 12,
  },
  pendingNote: {
    color: '#f59e0b',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
  },
  reelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#e94560',
    borderRadius: 14,
    paddingVertical: 16,
  },
  reelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
