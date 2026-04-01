/**
 * ReelPreview — shows a sequential preview of selected clips
 * by playing each highlight in order with visual transitions.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ReelClipItem } from './ClipOrderList';

interface ReelPreviewProps {
  clips: ReelClipItem[];
  onSeek: (positionMs: number) => void;
}

export function ReelPreview({ clips, onSeek }: ReelPreviewProps) {
  const [currentClipIndex, setCurrentClipIndex] = useState(0);

  const playClip = useCallback(
    (index: number) => {
      if (index < 0 || index >= clips.length) return;
      setCurrentClipIndex(index);
      onSeek(clips[index].highlight.start_time_ms);
    },
    [clips, onSeek]
  );

  const playAll = useCallback(() => {
    playClip(0);
  }, [playClip]);

  if (clips.length === 0) return null;

  const current = clips[currentClipIndex];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Preview</Text>
        <TouchableOpacity style={styles.playAllBtn} onPress={playAll}>
          <Ionicons name="play" size={14} color="#e94560" />
          <Text style={styles.playAllText}>Play All</Text>
        </TouchableOpacity>
      </View>

      {/* Clip indicator dots */}
      <View style={styles.dotsRow}>
        {clips.map((clip, i) => (
          <TouchableOpacity
            key={clip.highlight.id}
            style={[styles.dot, i === currentClipIndex && styles.dotActive]}
            onPress={() => playClip(i)}
          >
            <Text
              style={[
                styles.dotText,
                i === currentClipIndex && styles.dotTextActive,
              ]}
            >
              {i + 1}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Current clip info */}
      <View style={styles.currentClip}>
        <Text style={styles.clipLabel}>
          {current.highlight.label || current.highlight.ai_type || 'Clip'}
        </Text>
        <Text style={styles.clipTime}>
          {formatTime(current.highlight.start_time_ms)} -{' '}
          {formatTime(current.highlight.end_time_ms)}
        </Text>
      </View>

      {/* Nav */}
      <View style={styles.nav}>
        <TouchableOpacity
          style={[styles.navBtn, currentClipIndex === 0 && styles.navBtnDisabled]}
          onPress={() => playClip(currentClipIndex - 1)}
          disabled={currentClipIndex === 0}
        >
          <Ionicons name="play-back" size={18} color="#fff" />
          <Text style={styles.navText}>Prev</Text>
        </TouchableOpacity>

        <Text style={styles.navCounter}>
          {currentClipIndex + 1} / {clips.length}
        </Text>

        <TouchableOpacity
          style={[
            styles.navBtn,
            currentClipIndex === clips.length - 1 && styles.navBtnDisabled,
          ]}
          onPress={() => playClip(currentClipIndex + 1)}
          disabled={currentClipIndex === clips.length - 1}
        >
          <Text style={styles.navText}>Next</Text>
          <Ionicons name="play-forward" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
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
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 20,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  playAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e94560',
  },
  playAllText: {
    color: '#e94560',
    fontSize: 12,
    fontWeight: '600',
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2a2a4a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dotActive: {
    backgroundColor: '#e94560',
  },
  dotText: {
    color: '#666',
    fontSize: 12,
    fontWeight: '700',
  },
  dotTextActive: {
    color: '#fff',
  },
  currentClip: {
    alignItems: 'center',
    marginBottom: 12,
  },
  clipLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  clipTime: {
    color: '#8888aa',
    fontSize: 12,
    marginTop: 2,
  },
  nav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#2a2a4a',
  },
  navBtnDisabled: {
    opacity: 0.3,
  },
  navText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  navCounter: {
    color: '#8888aa',
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
});
