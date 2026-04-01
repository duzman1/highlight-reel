/**
 * HighlightCard — individual highlight in the list with
 * play preview, accept/reject, and edit actions.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Highlight } from '@highlight-reel/shared';

interface HighlightCardProps {
  highlight: Highlight;
  onAccept: () => void;
  onReject: () => void;
  onPlay: () => void;
  onEdit: () => void;
}

export function HighlightCard({
  highlight,
  onAccept,
  onReject,
  onPlay,
  onEdit,
}: HighlightCardProps) {
  const durationSec = ((highlight.end_time_ms - highlight.start_time_ms) / 1000).toFixed(1);

  return (
    <View
      style={[
        styles.card,
        highlight.is_accepted === true && styles.cardAccepted,
        highlight.is_accepted === false && styles.cardRejected,
      ]}
    >
      {/* Play button */}
      <TouchableOpacity style={styles.playBtn} onPress={onPlay}>
        <Ionicons name="play" size={16} color="#e94560" />
      </TouchableOpacity>

      {/* Info */}
      <View style={styles.info}>
        <View style={styles.topRow}>
          <Text style={styles.label}>
            {highlight.label || highlight.ai_type || 'Highlight'}
          </Text>
          {highlight.source === 'ai' && (
            <View style={styles.aiBadge}>
              <Text style={styles.aiBadgeText}>AI</Text>
            </View>
          )}
          {highlight.source === 'manual' && (
            <View style={styles.manualBadge}>
              <Text style={styles.manualBadgeText}>Manual</Text>
            </View>
          )}
        </View>
        <Text style={styles.time}>
          {formatTime(highlight.start_time_ms)} - {formatTime(highlight.end_time_ms)}
          {'  '}({durationSec}s)
        </Text>
        {highlight.ai_score !== null && (
          <View style={styles.scoreRow}>
            <View style={styles.scoreBar}>
              <View
                style={[
                  styles.scoreFill,
                  { width: `${Math.round(highlight.ai_score * 100)}%` },
                ]}
              />
            </View>
            <Text style={styles.scoreText}>
              {Math.round(highlight.ai_score * 100)}%
            </Text>
          </View>
        )}
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.editBtn} onPress={onEdit}>
          <Ionicons name="create-outline" size={18} color="#8888aa" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.actionBtn,
            highlight.is_accepted === true && styles.acceptedBtn,
          ]}
          onPress={onAccept}
        >
          <Ionicons
            name="checkmark"
            size={18}
            color={highlight.is_accepted === true ? '#fff' : '#10b981'}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.actionBtn,
            highlight.is_accepted === false && styles.rejectedBtn,
          ]}
          onPress={onReject}
        >
          <Ionicons
            name="close"
            size={18}
            color={highlight.is_accepted === false ? '#fff' : '#ef4444'}
          />
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
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  cardAccepted: {
    borderColor: 'rgba(16,185,129,0.3)',
  },
  cardRejected: {
    opacity: 0.5,
  },
  playBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(233,69,96,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  info: {
    flex: 1,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    textTransform: 'capitalize',
  },
  aiBadge: {
    backgroundColor: 'rgba(139,92,246,0.2)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  aiBadgeText: {
    color: '#8b5cf6',
    fontSize: 10,
    fontWeight: '700',
  },
  manualBadge: {
    backgroundColor: 'rgba(16,185,129,0.2)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  manualBadgeText: {
    color: '#10b981',
    fontSize: 10,
    fontWeight: '700',
  },
  time: {
    fontSize: 12,
    color: '#8888aa',
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  scoreBar: {
    flex: 1,
    maxWidth: 60,
    height: 4,
    backgroundColor: '#2a2a4a',
    borderRadius: 2,
    overflow: 'hidden',
  },
  scoreFill: {
    height: '100%',
    backgroundColor: '#8b5cf6',
    borderRadius: 2,
  },
  scoreText: {
    color: '#666',
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
  actions: {
    flexDirection: 'row',
    gap: 6,
    marginLeft: 6,
  },
  editBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2a2a4a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptedBtn: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  rejectedBtn: {
    backgroundColor: '#ef4444',
    borderColor: '#ef4444',
  },
});
