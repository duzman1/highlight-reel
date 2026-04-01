import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, router } from 'expo-router';

export default function ReelsScreen() {
  const [reels, setReels] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    // TODO: Load reels from API (Phase 5)
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'My Reels',
          headerStyle: { backgroundColor: '#1a1a2e' },
          headerTintColor: '#fff',
        }}
      />

      <FlatList
        data={reels}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="film-outline" size={64} color="#2a2a4a" />
            <Text style={styles.emptyTitle}>No Reels Yet</Text>
            <Text style={styles.emptyText}>
              Upload a video and review highlights to create your first reel
            </Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => router.push('/(tabs)/videos')}
            >
              <Text style={styles.emptyButtonText}>Go to Videos</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.reelCard}>
            <View style={styles.reelThumb}>
              <Ionicons name="film" size={28} color="#4a4a6a" />
            </View>
            <View style={styles.reelInfo}>
              <Text style={styles.reelTitle}>{item.title}</Text>
              <Text style={styles.reelMeta}>{item.status}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f23',
  },
  list: {
    padding: 16,
    paddingBottom: 40,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#8888aa',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  emptyButton: {
    marginTop: 24,
    backgroundColor: '#e94560',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  emptyButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  reelCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  reelThumb: {
    width: 80,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#2a2a4a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reelInfo: {
    flex: 1,
    marginLeft: 12,
  },
  reelTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  reelMeta: {
    fontSize: 12,
    color: '#8888aa',
    marginTop: 4,
  },
});
