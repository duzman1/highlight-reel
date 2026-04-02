import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { api } from '../../../lib/api';
import { SPORTS } from '@highlight-reel/shared';
import type { Player } from '@highlight-reel/shared';

export default function PlayersScreen() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [newPlayer, setNewPlayer] = useState({
    name: '',
    sport: '',
    team_name: '',
    jersey_number: '',
  });

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadPlayers = useCallback(async () => {
    try {
      setError(null);
      const { players: data } = await api.get<{ players: Player[] }>(
        '/api/users/me/players'
      );
      setPlayers(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load players');
    }
  }, []);

  useEffect(() => {
    loadPlayers();
  }, [loadPlayers]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPlayers();
    setRefreshing(false);
  };

  const addPlayer = async () => {
    if (!newPlayer.name.trim()) {
      Alert.alert('Error', 'Please enter the player name');
      return;
    }

    setSaving(true);
    try {
      await api.post('/api/users/me/players', {
        name: newPlayer.name.trim(),
        sport: newPlayer.sport || null,
        team_name: newPlayer.team_name || null,
        jersey_number: newPlayer.jersey_number || null,
      });
      setShowModal(false);
      setNewPlayer({ name: '', sport: '', team_name: '', jersey_number: '' });
      await loadPlayers();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setSaving(false);
    }
  };

  const deletePlayer = (player: Player) => {
    Alert.alert(
      'Delete Player',
      `Are you sure you want to remove ${player.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/api/users/me/players/${player.id}`);
              await loadPlayers();
            } catch (error: any) {
              Alert.alert('Error', error.message);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'My Players',
          headerStyle: { backgroundColor: '#1a1a2e' },
          headerTintColor: '#fff',
        }}
      />

      <FlatList
        data={players}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListHeaderComponent={
          error ? (
            <TouchableOpacity style={styles.errorBanner} onPress={loadPlayers}>
              <Ionicons name="warning-outline" size={18} color="#ef4444" />
              <Text style={styles.errorText}>{error}</Text>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          ) : null
        }
        ListEmptyComponent={
          error ? null : (
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={64} color="#2a2a4a" />
              <Text style={styles.emptyTitle}>No Players Yet</Text>
              <Text style={styles.emptyText}>
                Add your child to start organizing their game videos
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <View style={styles.playerCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {item.name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.playerInfo}>
              <Text style={styles.playerName}>{item.name}</Text>
              <View style={styles.playerMeta}>
                {item.sport && (
                  <Text style={styles.metaText}>{item.sport}</Text>
                )}
                {item.team_name && (
                  <Text style={styles.metaText}> | {item.team_name}</Text>
                )}
                {item.jersey_number && (
                  <Text style={styles.metaText}> | #{item.jersey_number}</Text>
                )}
              </View>
            </View>
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={() => deletePlayer(item)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="trash-outline" size={18} color="#ef4444" />
            </TouchableOpacity>
          </View>
        )}
      />

      {/* Add Player FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowModal(true)}
      >
        <Ionicons name="person-add" size={24} color="#fff" />
      </TouchableOpacity>

      {/* Add Player Modal */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Player</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color="#8888aa" />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Name *</Text>
            <TextInput
              style={styles.input}
              value={newPlayer.name}
              onChangeText={(text) =>
                setNewPlayer((p) => ({ ...p, name: text }))
              }
              placeholder="Player name"
              placeholderTextColor="#666"
            />

            <Text style={styles.label}>Sport</Text>
            <View style={styles.sportGrid}>
              {SPORTS.map((sport) => (
                <TouchableOpacity
                  key={sport.value}
                  style={[
                    styles.sportChip,
                    newPlayer.sport === sport.value && styles.sportChipActive,
                  ]}
                  onPress={() =>
                    setNewPlayer((p) => ({
                      ...p,
                      sport:
                        p.sport === sport.value ? '' : sport.value,
                    }))
                  }
                >
                  <Text
                    style={[
                      styles.sportChipText,
                      newPlayer.sport === sport.value &&
                        styles.sportChipTextActive,
                    ]}
                  >
                    {sport.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Team Name</Text>
            <TextInput
              style={styles.input}
              value={newPlayer.team_name}
              onChangeText={(text) =>
                setNewPlayer((p) => ({ ...p, team_name: text }))
              }
              placeholder="e.g., Lightning FC"
              placeholderTextColor="#666"
            />

            <Text style={styles.label}>Jersey Number</Text>
            <TextInput
              style={styles.input}
              value={newPlayer.jersey_number}
              onChangeText={(text) =>
                setNewPlayer((p) => ({ ...p, jersey_number: text }))
              }
              placeholder="e.g., 10"
              placeholderTextColor="#666"
              keyboardType="number-pad"
            />

            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={addPlayer}
              disabled={saving}
            >
              <Text style={styles.saveButtonText}>
                {saving ? 'Adding...' : 'Add Player'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    paddingBottom: 100,
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
  playerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e94560',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  playerInfo: {
    flex: 1,
    marginLeft: 14,
  },
  playerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  playerMeta: {
    flexDirection: 'row',
    marginTop: 4,
  },
  metaText: {
    fontSize: 13,
    color: '#8888aa',
    textTransform: 'capitalize',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#e94560',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#e94560',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ccccdd',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#0f0f23',
    borderWidth: 1,
    borderColor: '#2a2a4a',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#ffffff',
    marginBottom: 16,
  },
  sportGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  sportChip: {
    backgroundColor: '#0f0f23',
    borderWidth: 1,
    borderColor: '#2a2a4a',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  sportChipActive: {
    backgroundColor: '#e94560',
    borderColor: '#e94560',
  },
  sportChipText: {
    color: '#8888aa',
    fontSize: 13,
  },
  sportChipTextActive: {
    color: '#ffffff',
  },
  saveButton: {
    backgroundColor: '#e94560',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  deleteBtn: {
    padding: 8,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderWidth: 1,
    borderColor: '#ef4444',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  errorText: {
    flex: 1,
    color: '#ef4444',
    fontSize: 13,
  },
  retryText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '600',
  },
});
