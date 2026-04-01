/**
 * VideoPlayer component using expo-av.
 *
 * Provides playback controls, current position tracking,
 * and the ability to seek to specific timestamps (used when
 * tapping a highlight to preview it).
 */

import React, { useRef, useState, useCallback, useEffect, useImperativeHandle, forwardRef } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';

export interface VideoPlayerRef {
  seekTo: (positionMs: number) => Promise<void>;
  play: () => Promise<void>;
  pause: () => Promise<void>;
  getPosition: () => number;
}

interface VideoPlayerProps {
  uri: string | null;
  onPositionChange?: (positionMs: number) => void;
  onDurationChange?: (durationMs: number) => void;
  onPlaybackStateChange?: (isPlaying: boolean) => void;
}

export const VideoPlayer = forwardRef<VideoPlayerRef, VideoPlayerProps>(
  ({ uri, onPositionChange, onDurationChange, onPlaybackStateChange }, ref) => {
    const videoRef = useRef<Video>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [positionMs, setPositionMs] = useState(0);
    const [durationMs, setDurationMs] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useImperativeHandle(ref, () => ({
      seekTo: async (ms: number) => {
        await videoRef.current?.setPositionAsync(ms);
      },
      play: async () => {
        await videoRef.current?.playAsync();
      },
      pause: async () => {
        await videoRef.current?.pauseAsync();
      },
      getPosition: () => positionMs,
    }));

    const onPlaybackStatusUpdate = useCallback(
      (status: AVPlaybackStatus) => {
        if (!status.isLoaded) {
          setIsLoading(true);
          if (status.error) {
            setError(`Playback error: ${status.error}`);
          }
          return;
        }

        setIsLoading(false);
        setError(null);
        setIsPlaying(status.isPlaying);
        setPositionMs(status.positionMillis);

        if (status.durationMillis && status.durationMillis !== durationMs) {
          setDurationMs(status.durationMillis);
          onDurationChange?.(status.durationMillis);
        }

        onPositionChange?.(status.positionMillis);
        onPlaybackStateChange?.(status.isPlaying);
      },
      [durationMs, onPositionChange, onDurationChange, onPlaybackStateChange]
    );

    const togglePlayback = async () => {
      if (!videoRef.current) return;
      if (isPlaying) {
        await videoRef.current.pauseAsync();
      } else {
        await videoRef.current.playAsync();
      }
    };

    const formatTime = (ms: number): string => {
      const totalSeconds = Math.floor(ms / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    if (!uri) {
      return (
        <View style={styles.placeholder}>
          <Ionicons name="videocam-off" size={48} color="#4a4a6a" />
          <Text style={styles.placeholderText}>No video available</Text>
        </View>
      );
    }

    return (
      <View style={styles.container}>
        <Video
          ref={videoRef}
          source={{ uri }}
          style={styles.video}
          resizeMode={ResizeMode.CONTAIN}
          onPlaybackStatusUpdate={onPlaybackStatusUpdate}
          shouldPlay={false}
          isLooping={false}
          progressUpdateIntervalMillis={250}
        />

        {/* Loading overlay */}
        {isLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#e94560" />
          </View>
        )}

        {/* Error overlay */}
        {error && (
          <View style={styles.loadingOverlay}>
            <Ionicons name="alert-circle" size={32} color="#ef4444" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Play/Pause overlay */}
        <TouchableOpacity
          style={styles.playOverlay}
          onPress={togglePlayback}
          activeOpacity={0.8}
        >
          {!isPlaying && !isLoading && (
            <View style={styles.playButton}>
              <Ionicons name="play" size={32} color="#fff" />
            </View>
          )}
        </TouchableOpacity>

        {/* Progress bar + time */}
        <View style={styles.controls}>
          <Text style={styles.timeText}>{formatTime(positionMs)}</Text>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width:
                    durationMs > 0
                      ? `${(positionMs / durationMs) * 100}%`
                      : '0%',
                },
              ]}
            />
          </View>
          <Text style={styles.timeText}>{formatTime(durationMs)}</Text>
        </View>
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#000',
    position: 'relative',
  },
  video: {
    width: '100%',
    aspectRatio: 16 / 9,
  },
  placeholder: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#4a4a6a',
    fontSize: 14,
    marginTop: 8,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    bottom: 36, // Above controls
  },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(233,69,96,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 4,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    gap: 8,
  },
  timeText: {
    color: '#ccc',
    fontSize: 12,
    fontVariant: ['tabular-nums'],
    minWidth: 36,
    textAlign: 'center',
  },
  progressTrack: {
    flex: 1,
    height: 4,
    backgroundColor: '#333',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#e94560',
    borderRadius: 2,
  },
});
