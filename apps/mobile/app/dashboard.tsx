import { useCallback, useEffect, useState } from 'react';
import { FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
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
  match: { id: string; opponent: string; isHome: boolean; opponentLogo: string | null } | null;
}

// logo nášho klubu (FK Košická Nová Ves) z futbalnetu
const OUR_LOGO = 'https://api.sportnet.online/data/ppo/fk-kosicka-nova-ves.futbalnet.sk/logo';

type Row = { kind: 'header'; label: string; key: string } | { kind: 'event'; e: EventItem; key: string };

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

  // zvlášť zápasy (prvé) a tréningy
  const matches = events.filter((e) => e.match);
  const trainings = events.filter((e) => e.type === 'TRAINING');
  const others = events.filter((e) => !e.match && e.type !== 'TRAINING');
  const rows: Row[] = [];
  if (matches.length) {
    rows.push({ kind: 'header', label: 'Najbližšie zápasy', key: 'h-m' });
    matches.forEach((e) => rows.push({ kind: 'event', e, key: e.id }));
  }
  if (trainings.length) {
    rows.push({ kind: 'header', label: 'Najbližšie tréningy', key: 'h-t' });
    trainings.forEach((e) => rows.push({ kind: 'event', e, key: e.id }));
  }
  if (others.length) {
    rows.push({ kind: 'header', label: 'Ostatné', key: 'h-o' });
    others.forEach((e) => rows.push({ kind: 'event', e, key: e.id }));
  }

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <Pressable style={[styles.topBtn, { backgroundColor: colors.club800 }]} onPress={() => router.push('/chat')}>
          <Text style={styles.topBtnText}>💬 Kanály</Text>
        </Pressable>
        <Pressable style={[styles.topBtn, { backgroundColor: colors.club800 }]} onPress={() => router.push('/statistics')}>
          <Text style={styles.topBtnText}>📊 Štatistiky</Text>
        </Pressable>
        {canManage(me) && (
          <Pressable style={[styles.topBtn, { backgroundColor: colors.club600 }]} onPress={() => router.push('/event/new')}>
            <Text style={styles.topBtnText}>＋ Udalosť</Text>
          </Pressable>
        )}
      </View>

      <FlatList
        data={rows}
        keyExtractor={(r) => r.key}
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
          </>
        }
        ListEmptyComponent={<Text style={styles.empty}>Žiadne naplánované udalosti.</Text>}
        renderItem={({ item: row }) => {
          if (row.kind === 'header') return <Text style={styles.heading}>{row.label}</Text>;
          const item = row.e;
          return (
            <Pressable style={styles.card} onPress={() => openEvent(item)}>
              <Text style={styles.badge}>
                {typeLabels[item.type] ?? item.type}
                {item.team ? ` · ${item.team.name}` : ''}
              </Text>
              <Text style={styles.cardMeta}>
                {new Date(item.startAt).toLocaleString('sk-SK')}
                {item.location ? ` · ${item.location}` : ''}
              </Text>
              {item.match ? <MatchTeams item={item} /> : <Text style={styles.cardTitle}>{item.title}</Text>}
              <Text style={styles.cardAction}>
                {item.match ? 'Otvoriť zápas →' : item.type === 'TRAINING' ? 'Dochádzka →' : ''}
              </Text>
            </Pressable>
          );
        }}
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

/** Zápas ako mini-tabuľka: domáci hore, hostia dole (s logami). */
function MatchTeams({ item }: { item: EventItem }) {
  const m = item.match!;
  const our = { name: item.team?.name ?? 'FK KNV', logo: OUR_LOGO };
  const opp = { name: m.opponent, logo: m.opponentLogo };
  const home = m.isHome ? our : opp;
  const away = m.isHome ? opp : our;
  return (
    <View style={styles.teams}>
      <View style={styles.teamRow}>
        {home.logo ? <Image source={{ uri: home.logo }} style={styles.teamLogo} /> : <View style={styles.teamLogo} />}
        <Text style={styles.teamName}>{home.name}</Text>
      </View>
      <View style={styles.teamRow}>
        {away.logo ? <Image source={{ uri: away.logo }} style={styles.teamLogo} /> : <View style={styles.teamLogo} />}
        <Text style={styles.teamName}>{away.name}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.club50, padding: 16 },
  teams: { marginTop: 8, gap: 6 },
  teamRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  teamLogo: { width: 26, height: 26, resizeMode: 'contain' },
  teamName: { fontSize: 15, fontWeight: '600', color: colors.club900, flexShrink: 1 },
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
