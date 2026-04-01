import { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Share,
} from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { api } from '../../../lib/api';
import type { Reel } from '@highlight-reel/shared';

export default function ReelDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const videoRef = useRef<Video>(null);
  const [reel, setReel] = useState<(Reel & { download_url?: string }) | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    loadReel();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [id]);

  const loadReel = async () => {
    try {
      const { reel: data } = await api.get<{
        reel: Reel & { download_url?: string };
      }>(`/api/reels/${id}`);
      setReel(data);

      if (
        (data.status === 'pending' || data.status === 'processing') &&
        !pollRef.current
      ) {
        pollRef.current = setInterval(async () => {
          try {
            const { reel: updated } = await api.get<{
              reel: Reel & { download_url?: string };
            }>(`/api/reels/${id}`);
            setReel(updated);
            if (
              updated.status !== 'pending' &&
              updated.status !== 'processing'
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
      console.error('Failed to load reel:', error);
    } finally {
      setLoading(false);
    }
  };

  const downloadReel = async () => {
    if (!reel?.download_url) return;

    setDownloading(true);
    try {
      const permission = await MediaLibrary.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Required', 'Please grant access to save videos.');
        return;
      }

      const fileUri = `${FileSystem.cacheDirectory}${reel.title || 'reel'}.mp4`;
      const download = await FileSystem.downloadAsync(
        reel.download_url,
        fileUri
      );
      await MediaLibrary.saveToLibraryAsync(download.uri);
      Alert.alert('Downloaded!', 'Reel saved to your device.');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Download failed');
    } finally {
      setDownloading(false);
    }
  };

  const shareReel = async () => {
    if (!reel?.download_url) return;
    try {
      await Share.share({
        message: `Check out this highlight reel: ${reel.title}`,
        url: reel.download_url,
      });
    } catch {}
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#e94560" />
      </View>
    );
  }

  if (!reel) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Reel not found</Text>
      </View>
    );
  }

  const isReady = reel.status === 'ready' && reel.download_url;
  const isProcessing =
    reel.status === 'pending' || reel.status === 'processing';

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: reel.title || 'Reel',
          headerStyle: { backgroundColor: '#1a1a2e' },
          headerTintColor: '#fff',
        }}
      />

      {/* Video Player or Status */}
      {isReady ? (
        <Video
          ref={videoRef}
          source={{ uri: reel.download_url! }}
          style={styles.video}
          resizeMode={ResizeMode.CONTAIN}
          useNativeControls
          shouldPlay={false}
        />
      ) : (
        <View style={styles.statusContainer}>
          {isProcessing ? (
            <>
              <ActivityIndicator size="large" color="#8b5cf6" />
              <Text style={styles.statusTitle}>
                {reel.status === 'pending'
                  ? 'Queued for generation...'
                  : 'Assembling your reel...'}
              </Text>
              <Text style={styles.statusSub}>
                This may take a few minutes depending on the number of clips.
              </Text>
            </>
          ) : (
            <>
              <Ionicons name="alert-circle" size={48} color="#ef4444" />
              <Text style={styles.statusTitle}>Generation Failed</Text>
              <Text style={styles.statusSub}>
                {reel.processing_error || 'An error occurred'}
              </Text>
            </>
          )}
        </View>
      )}

      {/* Actions */}
      {isReady && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={downloadReel}
            disabled={downloading}
          >
            <Ionicons
              name={downloading ? 'hourglass' : 'download'}
              size={22}
              color="#fff"
            />
            <Text style={styles.actionText}>
              {downloading ? 'Saving...' : 'Save to Device'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtnOutline} onPress={shareReel}>
            <Ionicons name="share-outline" size={22} color="#e94560" />
            <Text style={styles.actionTextOutline}>Share</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Info */}
      <View style={styles.info}>
        <Text style={styles.title}>{reel.title}</Text>
        {reel.description && (
          <Text style={styles.description}>{reel.description}</Text>
        )}
        {reel.duration_seconds && (
          <Text style={styles.meta}>
            Duration: {Math.floor(reel.duration_seconds / 60)}:
            {String(Math.floor(reel.duration_seconds % 60)).padStart(2, '0')}
          </Text>
        )}
      </View>
    </View>
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
  video: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000',
  },
  statusContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  statusTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  statusSub: {
    color: '#8888aa',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#e94560',
    borderRadius: 12,
    paddingVertical: 14,
  },
  actionText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  actionBtnOutline: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#e94560',
    borderRadius: 12,
    paddingVertical: 14,
  },
  actionTextOutline: {
    color: '#e94560',
    fontSize: 15,
    fontWeight: '600',
  },
  info: {
    padding: 20,
  },
  title: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  description: {
    color: '#8888aa',
    fontSize: 14,
    marginBottom: 8,
  },
  meta: {
    color: '#666',
    fontSize: 13,
  },
});
