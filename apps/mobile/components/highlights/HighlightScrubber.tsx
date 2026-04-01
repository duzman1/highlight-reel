/**
 * HighlightScrubber — allows the user to adjust the start/end
 * times of a highlight by dragging handles on a mini-timeline.
 *
 * Shows a preview of the clip range and saves adjusted times
 * back to the API.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  PanResponder,
  Dimensions,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../lib/api';
import type { Highlight } from '@highlight-reel/shared';
import { HIGHLIGHT_DEFAULTS } from '@highlight-reel/shared';

interface HighlightScrubberProps {
  highlight: Highlight;
  videoDurationMs: number;
  onUpdate: (updated: Highlight) => void;
  onSeek: (positionMs: number) => void;
  onClose: () => void;
}

export function HighlightScrubber({
  highlight,
  videoDurationMs,
  onUpdate,
  onSeek,
  onClose,
}: HighlightScrubberProps) {
  const [startMs, setStartMs] = useState(highlight.start_time_ms);
  const [endMs, setEndMs] = useState(highlight.end_time_ms);
  const [saving, setSaving] = useState(false);

  const screenWidth = Dimensions.get('window').width - 80; // Padding

  const msToX = (ms: number) => (ms / videoDurationMs) * screenWidth;
  const xToMs = (x: number) =>
    Math.round(Math.max(0, Math.min(videoDurationMs, (x / screenWidth) * videoDurationMs)));

  const startPanResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderMove: (_, gestureState) => {
      const newStartMs = xToMs(msToX(highlight.start_time_ms) + gestureState.dx);
      // Ensure min gap
      if (endMs - newStartMs >= HIGHLIGHT_DEFAULTS.MIN_DURATION_MS) {
        setStartMs(newStartMs);
      }
    },
    onPanResponderRelease: () => {
      onSeek(startMs);
    },
  });

  const endPanResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderMove: (_, gestureState) => {
      const newEndMs = xToMs(msToX(highlight.end_time_ms) + gestureState.dx);
      if (newEndMs - startMs >= HIGHLIGHT_DEFAULTS.MIN_DURATION_MS) {
        setEndMs(newEndMs);
      }
    },
    onPanResponderRelease: () => {
      onSeek(endMs - 1000); // Seek near the end
    },
  });

  const nudge = (target: 'start' | 'end', deltaMs: number) => {
    if (target === 'start') {
      const newStart = Math.max(0, startMs + deltaMs);
      if (endMs - newStart >= HIGHLIGHT_DEFAULTS.MIN_DURATION_MS) {
        setStartMs(newStart);
        onSeek(newStart);
      }
    } else {
      const newEnd = Math.min(videoDurationMs, endMs + deltaMs);
      if (newEnd - startMs >= HIGHLIGHT_DEFAULTS.MIN_DURATION_MS) {
        setEndMs(newEnd);
        onSeek(newEnd - 1000);
      }
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const { highlight: updated } = await api.patch<{ highlight: Highlight }>(
        `/api/highlights/${highlight.id}`,
        { start_time_ms: startMs, end_time_ms: endMs }
      );
      onUpdate({ ...highlight, start_time_ms: startMs, end_time_ms: endMs });
      Alert.alert('Saved', 'Highlight times updated.');
      onClose();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const hasChanges =
    startMs !== highlight.start_time_ms || endMs !== highlight.end_time_ms;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Adjust Clip Timing</Text>
        <TouchableOpacity onPress={onClose}>
          <Ionicons name="close" size={22} color="#8888aa" />
        </TouchableOpacity>
      </View>

      {/* Mini timeline with handles */}
      <View style={styles.scrubberContainer}>
        <View style={styles.track}>
          {/* Selected range */}
          <View
            style={[
              styles.range,
              {
                left: msToX(startMs),
                width: msToX(endMs) - msToX(startMs),
              },
            ]}
          />

          {/* Start handle */}
          <View
            {...startPanResponder.panHandlers}
            style={[styles.handle, styles.handleStart, { left: msToX(startMs) - 12 }]}
          >
            <View style={styles.handleBar} />
          </View>

          {/* End handle */}
          <View
            {...endPanResponder.panHandlers}
            style={[styles.handle, styles.handleEnd, { left: msToX(endMs) - 12 }]}
          >
            <View style={styles.handleBar} />
          </View>
        </View>
      </View>

      {/* Time readouts + nudge buttons */}
      <View style={styles.timeRow}>
        <View style={styles.timeBlock}>
          <Text style={styles.timeLabel}>START</Text>
          <View style={styles.nudgeRow}>
            <TouchableOpacity
              style={styles.nudgeBtn}
              onPress={() => nudge('start', -1000)}
            >
              <Ionicons name="remove" size={16} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.timeValue}>{formatTime(startMs)}</Text>
            <TouchableOpacity
              style={styles.nudgeBtn}
              onPress={() => nudge('start', 1000)}
            >
              <Ionicons name="add" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.durationBlock}>
          <Text style={styles.durationText}>
            {((endMs - startMs) / 1000).toFixed(1)}s
          </Text>
        </View>

        <View style={styles.timeBlock}>
          <Text style={styles.timeLabel}>END</Text>
          <View style={styles.nudgeRow}>
            <TouchableOpacity
              style={styles.nudgeBtn}
              onPress={() => nudge('end', -1000)}
            >
              <Ionicons name="remove" size={16} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.timeValue}>{formatTime(endMs)}</Text>
            <TouchableOpacity
              style={styles.nudgeBtn}
              onPress={() => nudge('end', 1000)}
            >
              <Ionicons name="add" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Preview + Save */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.previewBtn}
          onPress={() => onSeek(startMs)}
        >
          <Ionicons name="play" size={18} color="#e94560" />
          <Text style={styles.previewText}>Preview</Text>
        </TouchableOpacity>

        {hasChanges && (
          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={save}
            disabled={saving}
          >
            <Text style={styles.saveBtnText}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Text>
          </TouchableOpacity>
        )}
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
    borderColor: '#e94560',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  scrubberContainer: {
    height: 40,
    justifyContent: 'center',
    marginBottom: 12,
  },
  track: {
    height: 8,
    backgroundColor: '#2a2a4a',
    borderRadius: 4,
    position: 'relative',
  },
  range: {
    position: 'absolute',
    height: 8,
    backgroundColor: 'rgba(233,69,96,0.4)',
    borderRadius: 4,
    top: 0,
  },
  handle: {
    position: 'absolute',
    width: 24,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    top: -12,
  },
  handleStart: {},
  handleEnd: {},
  handleBar: {
    width: 4,
    height: 24,
    backgroundColor: '#e94560',
    borderRadius: 2,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  timeBlock: {
    alignItems: 'center',
  },
  timeLabel: {
    color: '#666',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 4,
  },
  nudgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nudgeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2a2a4a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timeValue: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    minWidth: 44,
    textAlign: 'center',
  },
  durationBlock: {
    alignItems: 'center',
  },
  durationText: {
    color: '#8888aa',
    fontSize: 14,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e94560',
  },
  previewText: {
    color: '#e94560',
    fontSize: 14,
    fontWeight: '600',
  },
  saveBtn: {
    backgroundColor: '#e94560',
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
