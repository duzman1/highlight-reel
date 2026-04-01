/**
 * ClipOrderList — draggable, reorderable list of clips for building a reel.
 *
 * Each clip shows its label, time range, duration, and transition type.
 * Users can reorder by tapping up/down arrows and remove clips.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Highlight } from '@highlight-reel/shared';

export interface ReelClipItem {
  highlight: Highlight;
  position: number;
  transition_type: 'cut' | 'crossfade' | 'fade_to_black';
}

interface ClipOrderListProps {
  clips: ReelClipItem[];
  onReorder: (clips: ReelClipItem[]) => void;
  onRemove: (highlightId: string) => void;
  onTransitionChange: (highlightId: string, transition: ReelClipItem['transition_type']) => void;
  onPreview: (highlight: Highlight) => void;
}

const TRANSITIONS: { value: ReelClipItem['transition_type']; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'cut', label: 'Cut', icon: 'flash' },
  { value: 'crossfade', label: 'Fade', icon: 'swap-horizontal' },
  { value: 'fade_to_black', label: 'Black', icon: 'moon' },
];

export function ClipOrderList({
  clips,
  onReorder,
  onRemove,
  onTransitionChange,
  onPreview,
}: ClipOrderListProps) {
  const moveUp = (index: number) => {
    if (index === 0) return;
    const newClips = [...clips];
    [newClips[index - 1], newClips[index]] = [newClips[index], newClips[index - 1]];
    onReorder(newClips.map((c, i) => ({ ...c, position: i })));
  };

  const moveDown = (index: number) => {
    if (index === clips.length - 1) return;
    const newClips = [...clips];
    [newClips[index], newClips[index + 1]] = [newClips[index + 1], newClips[index]];
    onReorder(newClips.map((c, i) => ({ ...c, position: i })));
  };

  const totalDurationMs = clips.reduce(
    (sum, c) => sum + (c.highlight.end_time_ms - c.highlight.start_time_ms),
    0
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {clips.length} clip{clips.length !== 1 ? 's' : ''}
        </Text>
        <Text style={styles.headerDuration}>
          Total: {(totalDurationMs / 1000).toFixed(1)}s
        </Text>
      </View>

      {/* Clip list */}
      {clips.map((clip, index) => (
        <View key={clip.highlight.id}>
          {/* Transition indicator (between clips) */}
          {index > 0 && (
            <View style={styles.transitionRow}>
              <View style={styles.transitionLine} />
              <View style={styles.transitionPicker}>
                {TRANSITIONS.map((t) => (
                  <TouchableOpacity
                    key={t.value}
                    style={[
                      styles.transitionBtn,
                      clip.transition_type === t.value && styles.transitionBtnActive,
                    ]}
                    onPress={() => onTransitionChange(clip.highlight.id, t.value)}
                  >
                    <Ionicons
                      name={t.icon}
                      size={12}
                      color={clip.transition_type === t.value ? '#fff' : '#666'}
                    />
                    <Text
                      style={[
                        styles.transitionLabel,
                        clip.transition_type === t.value && styles.transitionLabelActive,
                      ]}
                    >
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.transitionLine} />
            </View>
          )}

          {/* Clip card */}
          <View style={styles.clipCard}>
            {/* Position number */}
            <View style={styles.positionBadge}>
              <Text style={styles.positionText}>{index + 1}</Text>
            </View>

            {/* Preview button */}
            <TouchableOpacity
              style={styles.previewBtn}
              onPress={() => onPreview(clip.highlight)}
            >
              <Ionicons name="play" size={14} color="#e94560" />
            </TouchableOpacity>

            {/* Clip info */}
            <View style={styles.clipInfo}>
              <Text style={styles.clipLabel} numberOfLines={1}>
                {clip.highlight.label || clip.highlight.ai_type || 'Highlight'}
              </Text>
              <Text style={styles.clipTime}>
                {formatTime(clip.highlight.start_time_ms)} -{' '}
                {formatTime(clip.highlight.end_time_ms)}
                {'  '}
                ({((clip.highlight.end_time_ms - clip.highlight.start_time_ms) / 1000).toFixed(1)}s)
              </Text>
            </View>

            {/* Reorder & remove */}
            <View style={styles.clipActions}>
              <TouchableOpacity
                style={[styles.arrowBtn, index === 0 && styles.arrowBtnDisabled]}
                onPress={() => moveUp(index)}
                disabled={index === 0}
              >
                <Ionicons
                  name="chevron-up"
                  size={18}
                  color={index === 0 ? '#2a2a4a' : '#8888aa'}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.arrowBtn,
                  index === clips.length - 1 && styles.arrowBtnDisabled,
                ]}
                onPress={() => moveDown(index)}
                disabled={index === clips.length - 1}
              >
                <Ionicons
                  name="chevron-down"
                  size={18}
                  color={index === clips.length - 1 ? '#2a2a4a' : '#8888aa'}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.removeBtn}
                onPress={() => onRemove(clip.highlight.id)}
              >
                <Ionicons name="trash-outline" size={16} color="#ef4444" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ))}

      {clips.length === 0 && (
        <View style={styles.empty}>
          <Ionicons name="film-outline" size={32} color="#2a2a4a" />
          <Text style={styles.emptyText}>No clips added yet</Text>
        </View>
      )}
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
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  headerDuration: {
    color: '#8888aa',
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  transitionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
    paddingHorizontal: 8,
  },
  transitionLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#2a2a4a',
  },
  transitionPicker: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 8,
  },
  transitionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  transitionBtnActive: {
    backgroundColor: '#e94560',
    borderColor: '#e94560',
  },
  transitionLabel: {
    color: '#666',
    fontSize: 10,
    fontWeight: '600',
  },
  transitionLabelActive: {
    color: '#fff',
  },
  clipCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  positionBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#2a2a4a',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  positionText: {
    color: '#8888aa',
    fontSize: 12,
    fontWeight: '700',
  },
  previewBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(233,69,96,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  clipInfo: {
    flex: 1,
  },
  clipLabel: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'capitalize',
    marginBottom: 1,
  },
  clipTime: {
    color: '#8888aa',
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
  clipActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginLeft: 6,
  },
  arrowBtn: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrowBtnDisabled: {
    opacity: 0.3,
  },
  removeBtn: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    color: '#4a4a6a',
    fontSize: 14,
    marginTop: 8,
  },
});
