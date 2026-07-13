import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { api, setToken } from '@/api';
import { colors } from '@/theme';

interface EventItem {
  id: string;
  type: string;
  title: string;
  startAt: string;
  location: string | null;
  teamCategory: { code: string } | null;
}

const typeLabels: Record<string, string> = {
  TRAINING: 'Tréning',
  MATCH: 'Zápas',
  TOURNAMENT: 'Turnaj',
  CLUB_EVENT: 'Podujatie',
};

export default function DashboardScreen() {
  const router = useRouter();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const from = new Date().toISOString();
      const list = await api<EventItem[]>(`/events?from=${from}`);
      setEvents(list.slice(0, 20));
    } catch {
      // token expiroval → späť na login
      await setToken(null);
      router.replace('/');
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Najbližšie udalosti</Text>
      <FlatList
        data={events}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
        ListEmptyComponent={<Text style={styles.empty}>Žiadne naplánované udalosti.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.badge}>
              {typeLabels[item.type] ?? item.type}
              {item.teamCategory ? ` · ${item.teamCategory.code}` : ''}
            </Text>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardMeta}>
              {new Date(item.startAt).toLocaleString('sk-SK')}
              {item.location ? ` · ${item.location}` : ''}
            </Text>
          </View>
        )}
      />
      <Pressable
        style={styles.logout}
        onPress={async () => {
          await setToken(null);
          router.replace('/');
        }}
      >
        <Text style={styles.logoutText}>Odhlásiť sa</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.club50, padding: 16 },
  heading: { fontSize: 18, fontWeight: '700', color: colors.club900, marginBottom: 12 },
  empty: { color: colors.gray, textAlign: 'center', marginTop: 32 },
  card: {
    backgroundColor: colors.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.club100,
    padding: 14,
    marginBottom: 10,
  },
  badge: { color: colors.club600, fontSize: 12, fontWeight: '600', marginBottom: 4 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: colors.club900 },
  cardMeta: { color: colors.gray, fontSize: 13, marginTop: 4 },
  logout: { padding: 14, alignItems: 'center' },
  logoutText: { color: colors.club600, fontWeight: '600' },
});
