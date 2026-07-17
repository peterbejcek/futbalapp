import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { api, setToken } from '@/api';
import { flush } from '@/offline';
import { registerForPushNotifications } from '@/notifications';
import { canManage, fetchMe, type Me } from '@/auth';
import { colors } from '@/theme';

interface EventItem {
  id: string;
  type: string;
  title: string;
  startAt: string;
  location: string | null;
  team: { name: string } | null;
  match: { id: string } | null;
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
  const [me, setMe] = useState<Me | null>(null);

  const load = useCallback(async () => {
    await flush(); // dopošli offline zápisy z ihriska
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
    void registerForPushNotifications();
    fetchMe().then(setMe).catch(() => {});
  }, [load]);

  function openEvent(item: EventItem) {
    if (item.match) router.push(`/match/${item.match.id}`);
    else if (item.type === 'TRAINING') router.push(`/event/${item.id}/attendance`);
  }

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <Pressable style={[styles.topBtn, { backgroundColor: colors.club800 }]} onPress={() => router.push('/chat')}>
          <Text style={styles.topBtnText}>💬 Kanály</Text>
        </Pressable>
        {canManage(me) && (
          <>
            <Pressable style={[styles.topBtn, { backgroundColor: colors.club600 }]} onPress={() => router.push('/event/new')}>
              <Text style={styles.topBtnText}>＋ Udalosť</Text>
            </Pressable>
            <Pressable style={[styles.topBtn, { backgroundColor: colors.club600 }]} onPress={() => router.push('/members')}>
              <Text style={styles.topBtnText}>👥 Členovia</Text>
            </Pressable>
          </>
        )}
      </View>

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
          <Pressable style={styles.card} onPress={() => openEvent(item)}>
            <Text style={styles.badge}>
              {typeLabels[item.type] ?? item.type}
              {item.team ? ` · ${item.team.name}` : ''}
            </Text>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardMeta}>
              {new Date(item.startAt).toLocaleString('sk-SK')}
              {item.location ? ` · ${item.location}` : ''}
            </Text>
            <Text style={styles.cardAction}>
              {item.match ? 'Otvoriť zápas →' : item.type === 'TRAINING' ? 'Dochádzka →' : ''}
            </Text>
          </Pressable>
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
  topRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  topBtn: { flex: 1, borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  topBtnText: { color: colors.white, fontWeight: '700', fontSize: 13 },
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
  cardAction: { color: colors.club600, fontSize: 13, fontWeight: '600', marginTop: 6 },
  logout: { padding: 14, alignItems: 'center' },
  logoutText: { color: colors.club600, fontWeight: '600' },
});
