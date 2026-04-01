import { useEffect, useState } from 'react';
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
import type { Video, Highlight } from '@highlight-reel/shared';

export default function VideoDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [video, setVideo] = useState<Video | null>(null);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadVideo();
  }, [id]);

  const loadVideo = async () => {
    try {
      const { video: data } = await api.get<{
        video: Video & { highlights: Highlight[] };
      }>(`/api/videos/${id}`);
      setVideo(data);
      setHighlights(data.highlights || []);
    } catch (error) {
      console.error('Failed to load video:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateHighlight = async (
    highlightId: string,
    is_accepted: boolean
  ) => {
    try {
      await api.patch(`/api/highlights/${highlightId}`, { is_accepted });
      setHighlights((prev) =>
        prev.map((h) => (h.id === highlightId ? { ...h, is_accepted } : h))
      );
    } catch (error) {
      console.error('Failed to update highlight:', error);
    }
  };

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

  return (
    <ScrollView style={styles.container}>
      <Stack.Screen
        options={{
          title: video.title || 'Video Details',
          headerStyle: { backgroundColor: '#1a1a2e' },
          headerTintColor: '#fff',
        }}
      />

      {/* Video Player Placeholder */}
      <View style={styles.playerPlaceholder}>
        <Ionicons name="play-circle" size={64} color="#e94560" />
        <Text style={styles.playerText}>Video Player</Text>
        <Text style={styles.playerSubtext}>
          (Video playback will be connected in Phase 4)
        </Text>
      </View>

      {/* Video Info */}
      <View style={styles.section}>
        <Text style={styles.videoTitle}>{video.title || 'Untitled'}</Text>
        {video.sport && (
          <View style={styles.tag}>
            <Text style={styles.tagText}>{video.sport}</Text>
          </View>
        )}
      </View>

      {/* Highlights Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Highlights</Text>
          <Text style={styles.sectionCount}>
            {acceptedCount} accepted / {highlights.length} total
          </Text>
        </View>

        {highlights.length === 0 ? (
          <View style={styles.emptyHighlights}>
            <Ionicons name="sparkles-outline" size={32} color="#4a4a6a" />
            <Text style={styles.emptyText}>
              {video.status === 'analyzed'
                ? 'No highlights detected. Try adding them manually.'
                : video.status === 'processing'
                ? 'AI is analyzing your video...'
                : 'Upload and process your video to detect highlights.'}
            </Text>
          </View>
        ) : (
          highlights.map((highlight) => (
            <View key={highlight.id} style={styles.highlightCard}>
              <View style={styles.highlightInfo}>
                <Text style={styles.highlightLabel}>
                  {highlight.label || highlight.ai_type || 'Highlight'}
                </Text>
                <Text style={styles.highlightTime}>
                  {formatTime(highlight.start_time_ms)} -{' '}
                  {formatTime(highlight.end_time_ms)}
                </Text>
                {highlight.ai_score !== null && (
                  <Text style={styles.scoreText}>
                    Confidence: {Math.round(highlight.ai_score * 100)}%
                  </Text>
                )}
              </View>
              <View style={styles.highlightActions}>
                <TouchableOpacity
                  style={[
                    styles.actionBtn,
                    highlight.is_accepted === true && styles.acceptedBtn,
                  ]}
                  onPress={() => updateHighlight(highlight.id, true)}
                >
                  <Ionicons
                    name="checkmark"
                    size={20}
                    color={highlight.is_accepted === true ? '#fff' : '#10b981'}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.actionBtn,
                    highlight.is_accepted === false && styles.rejectedBtn,
                  ]}
                  onPress={() => updateHighlight(highlight.id, false)}
                >
                  <Ionicons
                    name="close"
                    size={20}
                    color={
                      highlight.is_accepted === false ? '#fff' : '#ef4444'
                    }
                  />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}

        {pendingCount > 0 && (
          <Text style={styles.pendingNote}>
            {pendingCount} highlight{pendingCount > 1 ? 's' : ''} pending review
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
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
  playerPlaceholder: {
    height: 220,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playerText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
  },
  playerSubtext: {
    color: '#666',
    fontSize: 12,
    marginTop: 4,
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
  tag: {
    alignSelf: 'flex-start',
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
    marginBottom: 16,
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
  highlightCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  highlightInfo: {
    flex: 1,
  },
  highlightLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
    textTransform: 'capitalize',
    marginBottom: 2,
  },
  highlightTime: {
    fontSize: 13,
    color: '#8888aa',
  },
  scoreText: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  highlightActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#2a2a4a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptedBtn: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  rejectedBtn: {
    backgroundColor: '#ef4444',
    borderColor: '#ef4444',
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
});
