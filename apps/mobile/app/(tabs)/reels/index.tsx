import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, router } from 'expo-router';
import { api } from '../../../lib/api';
import type { Reel } from '@highlight-reel/shared';

const STATUS_CONFIG: Record<
  string,
  { color: string; label: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  pending: { color: '#f59e0b', label: 'Queued', icon: 'hourglass' },
  processing: { color: '#8b5cf6', label: 'Generating...', icon: 'cog' },
  ready: { color: '#10b981', label: 'Ready', icon: 'checkmark-circle' },
  failed: { color: '#ef4444', label: 'Failed', icon: 'alert-circle' },
};

export default function ReelsScreen() {
  const [reels, setReels] = useState<Reel[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadReels = useCallback(async () => {
    try {
      setError(null);
      const { reels: data } = await api.get<{ reels: Reel[] }>('/api/reels');
      setReels(data);

      const hasProcessing = data.some(
        (r) => r.status === 'pending' || r.status === 'processing'
      );

      if (hasProcessing && !pollRef.current) {
        pollRef.current = setInterval(async () => {
          try {
            const { reels: updated } = await api.get<{ reels: Reel[] }>(
              '/api/reels'
            );
            setReels(updated);

            const stillProcessing = updated.some(
              (r) => r.status === 'pending' || r.status === 'processing'
            );
            if (!stillProcessing && pollRef.current) {
              clearInterval(pollRef.current);
              pollRef.current = null;
            }
          } catch {}
        }, 5000);
      } else if (!hasProcessing && pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load reels');
    }
  }, []);

  useEffect(() => {
    loadReels();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [loadReels]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadReels();
    setRefreshing(false);
  };

  const deleteReel = (reel: Reel) => {
    Alert.alert('Delete Reel', `Delete "${reel.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/api/reels/${reel.id}`);
            await loadReels();
          } catch (error: any) {
            Alert.alert('Error', error.message);
          }
        },
      },
    ]);
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'My Reels',
          headerStyle: { backgroundColor: '#1a1a2e' },
          headerTintColor: '#fff',
        }}
      />

      <FlatList
        data={reels}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListHeaderComponent={
          error ? (
            <TouchableOpacity style={styles.errorBanner} onPress={loadReels}>
              <Ionicons name="warning-outline" size={18} color="#ef4444" />
              <Text style={styles.errorText}>{error}</Text>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          ) : null
        }
        ListEmptyComponent={
          error ? null : (
            <View style={styles.empty}>
              <Ionicons name="film-outline" size={64} color="#2a2a4a" />
              <Text style={styles.emptyTitle}>No Reels Yet</Text>
              <Text style={styles.emptyText}>
                Upload a video, review highlights, and create your first reel
              </Text>
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={() => router.push('/(tabs)/videos')}
              >
                <Text style={styles.emptyButtonText}>Go to Videos</Text>
              </TouchableOpacity>
            </View>
          )
        }
        renderItem={({ item }) => {
          const status = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
          return (
            <TouchableOpacity
              style={styles.reelCard}
              onPress={() => router.push(`/(tabs)/reels/${item.id}`)}
            >
              <View style={styles.reelThumb}>
                <Ionicons name="film" size={28} color="#4a4a6a" />
              </View>
              <View style={styles.reelInfo}>
                <Text style={styles.reelTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <View style={styles.statusRow}>
                  <Ionicons name={status.icon} size={14} color={status.color} />
                  <Text style={[styles.statusText, { color: status.color }]}>
                    {status.label}
                  </Text>
                  {item.duration_seconds && (
                    <Text style={styles.durationText}>
                      {formatDuration(item.duration_seconds)}
                    </Text>
                  )}
                </View>
              </View>
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => deleteReel(item)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="trash-outline" size={18} color="#ef4444" />
              </TouchableOpacity>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f23',
  },
  list: {
    padding: 16,
    paddingBottom: 40,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#8888aa',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  emptyButton: {
    marginTop: 24,
    backgroundColor: '#e94560',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  emptyButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  reelCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  reelThumb: {
    width: 80,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#2a2a4a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reelInfo: {
    flex: 1,
    marginLeft: 12,
  },
  reelTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  durationText: {
    fontSize: 12,
    color: '#8888aa',
    marginLeft: 8,
  },
  deleteBtn: {
    padding: 8,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderWidth: 1,
    borderColor: '#ef4444',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  errorText: {
    flex: 1,
    color: '#ef4444',
    fontSize: 13,
  },
  retryText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '600',
  },
});
