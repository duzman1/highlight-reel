/**
 * ReelBuilder — full reel creation flow.
 *
 * Takes accepted highlights from a video, lets users:
 * 1. Select which clips to include
 * 2. Reorder clips
 * 3. Choose transitions between clips
 * 4. Set title and description
 * 5. Generate the reel
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { api } from '../../lib/api';
import { ClipOrderList, ReelClipItem } from './ClipOrderList';
import type { Highlight, Video } from '@highlight-reel/shared';

interface ReelBuilderProps {
  video: Video;
  highlights: Highlight[];
  onSeek: (positionMs: number) => void;
  onClose: () => void;
}

export function ReelBuilder({
  video,
  highlights,
  onSeek,
  onClose,
}: ReelBuilderProps) {
  const acceptedHighlights = highlights.filter((h) => h.is_accepted === true);

  const [clips, setClips] = useState<ReelClipItem[]>(
    acceptedHighlights.map((h, i) => ({
      highlight: h,
      position: i,
      transition_type: 'crossfade',
    }))
  );
  const [title, setTitle] = useState(`${video.title || 'Game'} Highlights`);
  const [description, setDescription] = useState('');
  const [generating, setGenerating] = useState(false);

  // Clips not yet in the reel
  const availableHighlights = acceptedHighlights.filter(
    (h) => !clips.find((c) => c.highlight.id === h.id)
  );

  const addClip = (highlight: Highlight) => {
    setClips((prev) => [
      ...prev,
      {
        highlight,
        position: prev.length,
        transition_type: 'crossfade',
      },
    ]);
  };

  const removeClip = (highlightId: string) => {
    setClips((prev) =>
      prev
        .filter((c) => c.highlight.id !== highlightId)
        .map((c, i) => ({ ...c, position: i }))
    );
  };

  const changeTransition = (
    highlightId: string,
    transition: ReelClipItem['transition_type']
  ) => {
    setClips((prev) =>
      prev.map((c) =>
        c.highlight.id === highlightId
          ? { ...c, transition_type: transition }
          : c
      )
    );
  };

  const generateReel = async () => {
    if (clips.length === 0) {
      Alert.alert('No Clips', 'Add at least one clip to generate a reel.');
      return;
    }

    if (!title.trim()) {
      Alert.alert('Title Required', 'Please enter a title for your reel.');
      return;
    }

    setGenerating(true);
    try {
      await api.post('/api/reels', {
        title: title.trim(),
        description: description.trim() || undefined,
        player_id: video.player_id,
        clips: clips.map((c) => ({
          highlight_id: c.highlight.id,
          position: c.position,
          transition_type: c.transition_type,
        })),
      });

      Alert.alert(
        'Reel Queued!',
        'Your highlight reel is being generated.',
        [
          {
            text: 'Go to Reels',
            onPress: () => {
              onClose();
              router.push('/(tabs)/reels');
            },
          },
          { text: 'Stay Here', style: 'cancel', onPress: onClose },
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create reel');
    } finally {
      setGenerating(false);
    }
  };

  const totalDurationSec =
    clips.reduce(
      (sum, c) =>
        sum + (c.highlight.end_time_ms - c.highlight.start_time_ms),
      0
    ) / 1000;

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Build Your Reel</Text>
        <TouchableOpacity onPress={onClose}>
          <Ionicons name="close" size={24} color="#8888aa" />
        </TouchableOpacity>
      </View>

      {/* Title & Description */}
      <View style={styles.section}>
        <Text style={styles.label}>Title</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="Reel title"
          placeholderTextColor="#666"
          maxLength={100}
        />

        <Text style={styles.label}>Description (optional)</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={description}
          onChangeText={setDescription}
          placeholder="Add a note about this reel..."
          placeholderTextColor="#666"
          multiline
          numberOfLines={3}
          maxLength={500}
        />
      </View>

      {/* Clip Order */}
      <ClipOrderList
        clips={clips}
        onReorder={setClips}
        onRemove={removeClip}
        onTransitionChange={changeTransition}
        onPreview={(h) => onSeek(h.start_time_ms)}
      />

      {/* Available clips to add */}
      {availableHighlights.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Add More Clips</Text>
          {availableHighlights.map((h) => (
            <TouchableOpacity
              key={h.id}
              style={styles.addClipCard}
              onPress={() => addClip(h)}
            >
              <Ionicons name="add-circle" size={20} color="#10b981" />
              <View style={styles.addClipInfo}>
                <Text style={styles.addClipLabel}>
                  {h.label || h.ai_type || 'Highlight'}
                </Text>
                <Text style={styles.addClipTime}>
                  {formatTime(h.start_time_ms)} - {formatTime(h.end_time_ms)}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Summary & Generate */}
      <View style={styles.section}>
        <View style={styles.summary}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryNumber}>{clips.length}</Text>
            <Text style={styles.summaryLabel}>Clips</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryNumber}>
              {totalDurationSec.toFixed(0)}s
            </Text>
            <Text style={styles.summaryLabel}>Duration</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryNumber}>
              {clips.length > 0
                ? clips.filter((c) => c.transition_type === 'crossfade').length
                : 0}
            </Text>
            <Text style={styles.summaryLabel}>Fades</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.generateBtn,
            (clips.length === 0 || generating) && styles.generateBtnDisabled,
          ]}
          onPress={generateReel}
          disabled={clips.length === 0 || generating}
        >
          <Ionicons name="sparkles" size={20} color="#fff" />
          <Text style={styles.generateBtnText}>
            {generating ? 'Generating...' : 'Generate Reel'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: 40 }} />
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 12,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  label: {
    color: '#8888aa',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#1a1a2e',
    borderWidth: 1,
    borderColor: '#2a2a4a',
    borderRadius: 10,
    padding: 12,
    color: '#fff',
    fontSize: 15,
  },
  textArea: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  sectionTitle: {
    color: '#8888aa',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  addClipCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#2a2a4a',
    borderStyle: 'dashed',
  },
  addClipInfo: {
    flex: 1,
  },
  addClipLabel: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  addClipTime: {
    color: '#8888aa',
    fontSize: 11,
  },
  summary: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryNumber: {
    color: '#e94560',
    fontSize: 20,
    fontWeight: 'bold',
  },
  summaryLabel: {
    color: '#8888aa',
    fontSize: 11,
    marginTop: 2,
  },
  summaryDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#2a2a4a',
  },
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#e94560',
    borderRadius: 14,
    paddingVertical: 16,
  },
  generateBtnDisabled: {
    opacity: 0.5,
  },
  generateBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: 'bold',
  },
});
