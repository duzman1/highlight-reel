import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../lib/api';

interface Stats {
  totalVideos: number;
  totalHighlights: number;
  totalReels: number;
  recentVideos: any[];
}

export default function HomeScreen() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats>({
    totalVideos: 0,
    totalHighlights: 0,
    totalReels: 0,
    recentVideos: [],
  });
  const [refreshing, setRefreshing] = useState(false);

  const loadStats = async () => {
    try {
      const { videos } = await api.get<{ videos: any[] }>('/api/videos');
      setStats({
        totalVideos: videos.length,
        totalHighlights: 0, // Will populate when highlights exist
        totalReels: 0,
        recentVideos: videos.slice(0, 3),
      });
    } catch {
      // Silently handle - user may not have any data yet
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadStats();
    setRefreshing(false);
  };

  const displayName =
    user?.user_metadata?.display_name || user?.email || 'there';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.greeting}>
        <Text style={styles.greetingText}>Welcome back,</Text>
        <Text style={styles.nameText}>{displayName}!</Text>
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <TouchableOpacity
          style={styles.primaryAction}
          onPress={() => router.push('/(tabs)/videos')}
        >
          <Ionicons name="cloud-upload" size={28} color="#fff" />
          <Text style={styles.primaryActionText}>Upload Video</Text>
          <Text style={styles.primaryActionSub}>
            Record or select a game video
          </Text>
        </TouchableOpacity>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.totalVideos}</Text>
          <Text style={styles.statLabel}>Videos</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.totalHighlights}</Text>
          <Text style={styles.statLabel}>Highlights</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.totalReels}</Text>
          <Text style={styles.statLabel}>Reels</Text>
        </View>
      </View>

      {/* Getting Started Guide */}
      {stats.totalVideos === 0 && (
        <View style={styles.guide}>
          <Text style={styles.guideTitle}>Getting Started</Text>

          <View style={styles.step}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>1</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Add Your Player</Text>
              <Text style={styles.stepDesc}>
                Add your child's name, sport, and team
              </Text>
            </View>
          </View>

          <View style={styles.step}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>2</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Upload a Game Video</Text>
              <Text style={styles.stepDesc}>
                Select a video from your camera roll
              </Text>
            </View>
          </View>

          <View style={styles.step}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>3</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Review Highlights</Text>
              <Text style={styles.stepDesc}>
                AI detects the best moments — you pick your favorites
              </Text>
            </View>
          </View>

          <View style={styles.step}>
            <View style={[styles.stepNumber, { backgroundColor: '#e94560' }]}>
              <Text style={styles.stepNumberText}>4</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Generate Your Reel</Text>
              <Text style={styles.stepDesc}>
                Compile highlights into an awesome reel to share
              </Text>
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f23',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  greeting: {
    marginBottom: 28,
  },
  greetingText: {
    fontSize: 16,
    color: '#8888aa',
  },
  nameText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    marginTop: 4,
  },
  quickActions: {
    marginBottom: 24,
  },
  primaryAction: {
    backgroundColor: '#e94560',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  primaryActionText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 8,
  },
  primaryActionSub: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 28,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#e94560',
  },
  statLabel: {
    fontSize: 12,
    color: '#8888aa',
    marginTop: 4,
  },
  guide: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  guideTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 20,
  },
  step: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2a2a4a',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stepNumberText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 2,
  },
  stepDesc: {
    fontSize: 13,
    color: '#8888aa',
  },
});
