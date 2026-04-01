/**
 * HighlightTagger — allows parents to manually mark highlights
 * while watching a video.
 *
 * Flow:
 * 1. Tap "Mark Start" → records current playback position
 * 2. Tap "Mark End" → records end position
 * 3. Pick a label
 * 4. Save as a manual highlight
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../lib/api';
import type { Highlight } from '@highlight-reel/shared';
import { HIGHLIGHT_DEFAULTS } from '@highlight-reel/shared';

interface HighlightTaggerProps {
  videoId: string;
  currentPositionMs: number;
  videoDurationMs: number;
  onHighlightCreated: (highlight: Highlight) => void;
  onClose: () => void;
}

const QUICK_LABELS = [
  'Goal',
  'Great Save',
  'Nice Pass',
  'Big Hit',
  'Fast Break',
  'Great Play',
  'Celebration',
  'Other',
];

export function HighlightTagger({
  videoId,
  currentPositionMs,
  videoDurationMs,
  onHighlightCreated,
  onClose,
}: HighlightTaggerProps) {
  const [startMs, setStartMs] = useState<number | null>(null);
  const [endMs, setEndMs] = useState<number | null>(null);
  const [label, setLabel] = useState('');
  const [customLabel, setCustomLabel] = useState('');
  const [saving, setSaving] = useState(false);

  const markStart = () => {
    setStartMs(currentPositionMs);
    // Auto-set end if not set, or reset if start moves past end
    if (endMs !== null && currentPositionMs >= endMs) {
      setEndMs(null);
    }
  };

  const markEnd = () => {
    if (startMs === null) {
      Alert.alert('Mark Start First', 'Tap "Mark Start" before marking the end.');
      return;
    }
    if (currentPositionMs <= startMs) {
      Alert.alert('Invalid End', 'End time must be after start time.');
      return;
    }
    setEndMs(currentPositionMs);
  };

  const save = async () => {
    if (startMs === null || endMs === null) {
      Alert.alert('Incomplete', 'Please mark both start and end times.');
      return;
    }

    const duration = endMs - startMs;
    if (duration < HIGHLIGHT_DEFAULTS.MIN_DURATION_MS) {
      Alert.alert(
        'Too Short',
        `Highlight must be at least ${HIGHLIGHT_DEFAULTS.MIN_DURATION_MS / 1000} seconds.`
      );
      return;
    }

    const finalLabel = label === 'Other' ? customLabel || 'Highlight' : label || 'Highlight';

    setSaving(true);
    try {
      const { highlight } = await api.post<{ highlight: Highlight }>(
        '/api/highlights',
        {
          video_id: videoId,
          start_time_ms: startMs,
          end_time_ms: endMs,
          label: finalLabel,
        }
      );
      onHighlightCreated(highlight);
      Alert.alert('Saved!', `"${finalLabel}" highlight added.`);
      // Reset
      setStartMs(null);
      setEndMs(null);
      setLabel('');
      setCustomLabel('');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save highlight');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Tag a Highlight</Text>
        <TouchableOpacity onPress={onClose}>
          <Ionicons name="close" size={22} color="#8888aa" />
        </TouchableOpacity>
      </View>

      {/* Mark buttons */}
      <View style={styles.markRow}>
        <TouchableOpacity
          style={[styles.markBtn, startMs !== null && styles.markBtnActive]}
          onPress={markStart}
        >
          <Ionicons name="flag" size={18} color={startMs !== null ? '#fff' : '#10b981'} />
          <Text
            style={[
              styles.markBtnText,
              startMs !== null && styles.markBtnTextActive,
            ]}
          >
            {startMs !== null ? formatTime(startMs) : 'Mark Start'}
          </Text>
        </TouchableOpacity>

        <View style={styles.markDivider}>
          <Ionicons name="arrow-forward" size={18} color="#4a4a6a" />
        </View>

        <TouchableOpacity
          style={[styles.markBtn, endMs !== null && styles.markBtnActive]}
          onPress={markEnd}
        >
          <Ionicons name="flag" size={18} color={endMs !== null ? '#fff' : '#ef4444'} />
          <Text
            style={[
              styles.markBtnText,
              endMs !== null && styles.markBtnTextActive,
            ]}
          >
            {endMs !== null ? formatTime(endMs) : 'Mark End'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Duration indicator */}
      {startMs !== null && endMs !== null && (
        <Text style={styles.duration}>
          Duration: {((endMs - startMs) / 1000).toFixed(1)}s
        </Text>
      )}

      {/* Label picker */}
      <Text style={styles.labelTitle}>Label</Text>
      <View style={styles.labelGrid}>
        {QUICK_LABELS.map((l) => (
          <TouchableOpacity
            key={l}
            style={[styles.labelChip, label === l && styles.labelChipActive]}
            onPress={() => setLabel(l === label ? '' : l)}
          >
            <Text
              style={[
                styles.labelChipText,
                label === l && styles.labelChipTextActive,
              ]}
            >
              {l}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {label === 'Other' && (
        <TextInput
          style={styles.customInput}
          value={customLabel}
          onChangeText={setCustomLabel}
          placeholder="Enter custom label..."
          placeholderTextColor="#666"
          maxLength={50}
        />
      )}

      {/* Save */}
      <TouchableOpacity
        style={[
          styles.saveBtn,
          (startMs === null || endMs === null || saving) && styles.saveBtnDisabled,
        ]}
        onPress={save}
        disabled={startMs === null || endMs === null || saving}
      >
        <Ionicons name="bookmark" size={18} color="#fff" />
        <Text style={styles.saveBtnText}>
          {saving ? 'Saving...' : 'Save Highlight'}
        </Text>
      </TouchableOpacity>
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
    borderColor: '#10b981',
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
  markRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  markBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2a2a4a',
    backgroundColor: '#0f0f23',
  },
  markBtnActive: {
    backgroundColor: '#2a2a4a',
    borderColor: '#10b981',
  },
  markBtnText: {
    color: '#8888aa',
    fontSize: 14,
    fontWeight: '600',
  },
  markBtnTextActive: {
    color: '#fff',
    fontVariant: ['tabular-nums'],
  },
  markDivider: {
    paddingHorizontal: 4,
  },
  duration: {
    color: '#8888aa',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 16,
  },
  labelTitle: {
    color: '#8888aa',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  labelGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  labelChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#0f0f23',
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  labelChipActive: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  labelChipText: {
    color: '#8888aa',
    fontSize: 13,
  },
  labelChipTextActive: {
    color: '#fff',
  },
  customInput: {
    backgroundColor: '#0f0f23',
    borderWidth: 1,
    borderColor: '#2a2a4a',
    borderRadius: 10,
    padding: 12,
    color: '#fff',
    fontSize: 14,
    marginBottom: 12,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#10b981',
    borderRadius: 10,
    paddingVertical: 14,
  },
  saveBtnDisabled: {
    opacity: 0.4,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
});
