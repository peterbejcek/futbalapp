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

interface RegCard {
  id: string;
  firstName: string;
  lastName: string;
  registrationValidUntil: string;
  team: string | null;
  daysLeft: number;
  expired: boolean;
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
  const [cards, setCards] = useState<RegCard[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [me, setMe] = useState<Me | null>(null);

  const load = useCallback(async () => {
    await flush(); // dopošli offline zápisy z ihriska
    try {
      const from = new Date().toISOString();
      const list = await api<EventItem[]>(`/events?from=${from}`);
      setEvents(list.slice(0, 20));
      api<RegCard[]>('/members/registration-cards').then(setCards).catch(() => {});
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
        ListHeaderComponent={
          <>
            {cards.length > 0 && (
              <View style={styles.cardsBlock}>
                <Text style={styles.heading}>
                  {canManage(me) ? 'Platnosť registračných preukazov' : 'Registračný preukaz'}
                </Text>
                {cards.slice(0, canManage(me) ? 15 : cards.length).map((c) => (
                  <View key={c.id} style={styles.regRow}>
                    <Text style={styles.regName}>
                      {c.lastName} {c.firstName}
                      {c.team ? <Text style={styles.regTeam}> · {c.team}</Text> : null}
                    </Text>
                    <Text
                      style={[
                        styles.regBadge,
                        c.expired ? styles.regExpired : c.daysLeft <= 30 ? styles.regSoon : styles.regOk,
                      ]}
                    >
                      {c.expired
                        ? `po platnosti (${new Date(c.registrationValidUntil).toLocaleDateString('sk-SK')})`
                        : `do ${new Date(c.registrationValidUntil).toLocaleDateString('sk-SK')}`}
                    </Text>
                  </View>
                ))}
              </View>
            )}
            <Text style={styles.heading}>Najbližšie udalosti</Text>
          </>
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
  cardsBlock: { marginBottom: 8 },
  regRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.club100,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 6,
  },
  regName: { color: colors.club900, fontWeight: '600', fontSize: 14, flexShrink: 1 },
  regTeam: { color: colors.gray, fontWeight: '400', fontSize: 12 },
  regBadge: { fontSize: 12, fontWeight: '600', borderRadius: 6, paddingVertical: 2, paddingHorizontal: 8, overflow: 'hidden' },
  regExpired: { backgroundColor: '#fee2e2', color: '#b91c1c' },
  regSoon: { backgroundColor: '#fef3c7', color: '#b45309' },
  regOk: { backgroundColor: '#f3f4f6', color: '#4b5563' },
  logout: { padding: 14, alignItems: 'center' },
  logoutText: { color: colors.club600, fontWeight: '600' },
});
