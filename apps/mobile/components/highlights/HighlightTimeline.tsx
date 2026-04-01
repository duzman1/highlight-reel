/**
 * HighlightTimeline — visual timeline bar showing the full video
 * duration with colored segments for each highlight.
 *
 * Tapping a segment jumps the video player to that timestamp.
 * The current playback position is shown as a moving indicator.
 */

import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import type { Highlight } from '@highlight-reel/shared';

interface HighlightTimelineProps {
  highlights: Highlight[];
  durationMs: number;
  currentPositionMs: number;
  onSeek: (positionMs: number) => void;
}

const HIGHLIGHT_COLORS: Record<string, string> = {
  motion: '#3b82f6',
  audio_spike: '#f59e0b',
  scene_change: '#8b5cf6',
  combined: '#e94560',
  manual: '#10b981',
};

function getHighlightColor(highlight: Highlight): string {
  if (highlight.source === 'manual') return HIGHLIGHT_COLORS.manual;
  return HIGHLIGHT_COLORS[highlight.ai_type || 'combined'] || HIGHLIGHT_COLORS.combined;
}

export function HighlightTimeline({
  highlights,
  durationMs,
  currentPositionMs,
  onSeek,
}: HighlightTimelineProps) {
  if (durationMs <= 0) return null;

  const playheadPosition = (currentPositionMs / durationMs) * 100;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Timeline</Text>

      {/* Legend */}
      <View style={styles.legend}>
        <LegendItem color={HIGHLIGHT_COLORS.motion} label="Motion" />
        <LegendItem color={HIGHLIGHT_COLORS.audio_spike} label="Audio" />
        <LegendItem color={HIGHLIGHT_COLORS.combined} label="Combined" />
        <LegendItem color={HIGHLIGHT_COLORS.manual} label="Manual" />
      </View>

      {/* Timeline bar */}
      <View style={styles.timeline}>
        {/* Background track */}
        <View style={styles.track} />

        {/* Highlight segments */}
        {highlights.map((h) => {
          const left = (h.start_time_ms / durationMs) * 100;
          const width =
            ((h.end_time_ms - h.start_time_ms) / durationMs) * 100;
          const color = getHighlightColor(h);
          const opacity = h.is_accepted === false ? 0.25 : h.is_accepted === true ? 1 : 0.6;

          return (
            <TouchableOpacity
              key={h.id}
              style={[
                styles.segment,
                {
                  left: `${left}%`,
                  width: `${Math.max(width, 1)}%`,
                  backgroundColor: color,
                  opacity,
                },
              ]}
              onPress={() => onSeek(h.start_time_ms)}
              activeOpacity={0.7}
            />
          );
        })}

        {/* Playhead */}
        <View
          style={[
            styles.playhead,
            { left: `${Math.min(playheadPosition, 100)}%` },
          ]}
        />
      </View>

      {/* Time labels */}
      <View style={styles.timeLabels}>
        <Text style={styles.timeText}>0:00</Text>
        <Text style={styles.timeText}>{formatTime(durationMs)}</Text>
      </View>
    </View>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
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
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    marginHorizontal: 20,
    marginTop: 12,
  },
  label: {
    color: '#8888aa',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  legend: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
    flexWrap: 'wrap',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    color: '#8888aa',
    fontSize: 11,
  },
  timeline: {
    height: 28,
    position: 'relative',
    justifyContent: 'center',
  },
  track: {
    height: 8,
    backgroundColor: '#2a2a4a',
    borderRadius: 4,
  },
  segment: {
    position: 'absolute',
    height: 20,
    borderRadius: 4,
    top: 4,
  },
  playhead: {
    position: 'absolute',
    width: 3,
    height: 28,
    backgroundColor: '#ffffff',
    borderRadius: 1.5,
    top: 0,
    marginLeft: -1.5,
  },
  timeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  timeText: {
    color: '#666',
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
});
