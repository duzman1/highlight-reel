import { View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';

export default function PlayerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Player Details',
          headerStyle: { backgroundColor: '#1a1a2e' },
          headerTintColor: '#fff',
        }}
      />
      <Text style={styles.text}>Player detail screen — coming soon</Text>
      <Text style={styles.subtext}>
        View player stats, videos, and reels here
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f23',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  text: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  subtext: {
    color: '#8888aa',
    fontSize: 14,
    marginTop: 8,
  },
});
