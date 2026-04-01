import { useEffect, useState, useCallback } from 'react';
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
import { router, Stack } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { api } from '../../../lib/api';
import { supabase } from '../../../lib/supabase';
import type { Video, VideoUploadResponse } from '@highlight-reel/shared';
import { VIDEO_LIMITS } from '@highlight-reel/shared';

const STATUS_COLORS: Record<string, string> = {
  uploading: '#f59e0b',
  uploaded: '#3b82f6',
  processing: '#8b5cf6',
  analyzed: '#10b981',
  failed: '#ef4444',
};

const STATUS_LABELS: Record<string, string> = {
  uploading: 'Uploading...',
  uploaded: 'Ready to process',
  processing: 'Analyzing...',
  analyzed: 'Highlights ready',
  failed: 'Processing failed',
};

export default function VideosScreen() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);

  const loadVideos = useCallback(async () => {
    try {
      const { videos: data } = await api.get<{ videos: Video[] }>('/api/videos');
      setVideos(data);
    } catch {
      // Handle silently on initial load
    }
  }, []);

  useEffect(() => {
    loadVideos();
  }, [loadVideos]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadVideos();
    setRefreshing(false);
  };

  const pickAndUploadVideo = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Permission Required',
          'Please grant access to your photo library to upload videos.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        quality: 1,
        videoMaxDuration: VIDEO_LIMITS.MAX_DURATION_MINUTES * 60,
      });

      if (result.canceled || !result.assets[0]) return;

      const asset = result.assets[0];
      setUploading(true);

      // 1. Get pre-signed upload URL from API
      const fileName = asset.uri.split('/').pop() || 'video.mp4';
      const { video_id, upload_url } = await api.post<VideoUploadResponse>(
        '/api/videos/upload-url',
        {
          file_name: fileName,
          file_size: asset.fileSize || 0,
          mime_type: asset.mimeType || 'video/mp4',
        }
      );

      // 2. Upload the file directly to storage
      const response = await fetch(asset.uri);
      const blob = await response.blob();

      await fetch(upload_url, {
        method: 'PUT',
        body: blob,
        headers: {
          'Content-Type': asset.mimeType || 'video/mp4',
        },
      });

      // 3. Mark the video as uploaded
      await api.patch(`/api/videos/${video_id}/status`, {
        status: 'uploaded',
      });

      Alert.alert('Upload Complete', 'Your video has been uploaded successfully!');
      await loadVideos();
    } catch (error: any) {
      Alert.alert('Upload Failed', error.message || 'Something went wrong');
    } finally {
      setUploading(false);
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '--:--';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '';
    const mb = bytes / (1024 * 1024);
    return mb >= 1000
      ? `${(mb / 1024).toFixed(1)} GB`
      : `${mb.toFixed(0)} MB`;
  };

  const renderVideo = ({ item }: { item: Video }) => (
    <TouchableOpacity
      style={styles.videoCard}
      onPress={() => router.push(`/(tabs)/videos/${item.id}`)}
    >
      <View style={styles.thumbnailPlaceholder}>
        <Ionicons name="videocam" size={32} color="#4a4a6a" />
      </View>
      <View style={styles.videoInfo}>
        <Text style={styles.videoTitle} numberOfLines={1}>
          {item.title || 'Untitled Video'}
        </Text>
        <View style={styles.videoMeta}>
          <Text style={styles.metaText}>
            {formatDuration(item.duration_seconds)}
          </Text>
          {item.file_size_bytes && (
            <Text style={styles.metaText}>
              {' '} {formatFileSize(item.file_size_bytes)}
            </Text>
          )}
        </View>
        <View style={styles.statusRow}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: STATUS_COLORS[item.status] || '#666' },
            ]}
          />
          <Text style={styles.statusText}>
            {STATUS_LABELS[item.status] || item.status}
          </Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#4a4a6a" />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'My Videos',
          headerStyle: { backgroundColor: '#1a1a2e' },
          headerTintColor: '#fff',
        }}
      />

      <FlatList
        data={videos}
        renderItem={renderVideo}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="videocam-outline" size={64} color="#2a2a4a" />
            <Text style={styles.emptyTitle}>No Videos Yet</Text>
            <Text style={styles.emptyText}>
              Upload your first game video to get started
            </Text>
          </View>
        }
      />

      <TouchableOpacity
        style={[styles.fab, uploading && styles.fabDisabled]}
        onPress={pickAndUploadVideo}
        disabled={uploading}
      >
        <Ionicons
          name={uploading ? 'hourglass' : 'add'}
          size={28}
          color="#fff"
        />
      </TouchableOpacity>
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
    paddingBottom: 100,
  },
  videoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  thumbnailPlaceholder: {
    width: 80,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#2a2a4a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoInfo: {
    flex: 1,
    marginLeft: 12,
  },
  videoTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  videoMeta: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  metaText: {
    fontSize: 12,
    color: '#8888aa',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    color: '#8888aa',
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
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#e94560',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#e94560',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  fabDisabled: {
    backgroundColor: '#666',
  },
});
