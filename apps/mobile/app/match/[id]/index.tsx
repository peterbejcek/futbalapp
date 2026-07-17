import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link, useLocalSearchParams } from 'expo-router';
import * as Crypto from 'expo-crypto';
import { MATCH_EVENT_LABELS_SK, type MatchEventType } from '@fkknv/shared';
import { api } from '@/api';
import { enqueue, flush } from '@/offline';
import { colors } from '@/theme';

interface Nomination {
  id: string;
  member: { id: string; firstName: string; lastName: string };
}

interface MatchEventRow {
  id: string;
  minute: number;
  type: string;
  member: { lastName: string } | null;
}

interface MatchDetail {
  id: string;
  opponent: string;
  isHome: boolean;
  scoreUs: number | null;
  scoreThem: number | null;
  state: string;
  event: { title: string; startAt: string; team: { name: string } | null };
  nominations: Nomination[];
  events: MatchEventRow[];
}

const eventLabels: Record<string, string> = MATCH_EVENT_LABELS_SK;

// akcie viazané na hráča vs tímové
const PLAYER_ACTIONS: MatchEventType[] = ['GOAL', 'ASSIST', 'PENALTY_SCORED', 'PENALTY_MISSED', 'YELLOW', 'RED', 'FOUL', 'SHOT'];
const TEAM_ACTIONS: MatchEventType[] = ['GOAL_CONCEDED', 'CORNER'];

export default function MatchLiveScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [match, setMatch] = useState<MatchDetail | null>(null);
  const [selected, setSelected] = useState<Nomination | null>(null);
  const [minute, setMinute] = useState(0);
  const [pending, setPending] = useState(0);

  const load = useCallback(async () => {
    const { pending: p } = await flush();
    setPending(p);
    try {
      const detail = await api<MatchDetail>(`/matches/${id}`);
      setMatch(detail);
      // odhad aktuálnej minúty z času výkopu (tréner môže doladiť tlačidlami)
      if (detail.state === 'LIVE') {
        const elapsed = Math.floor((Date.now() - new Date(detail.event.startAt).getTime()) / 60000);
        setMinute(Math.max(0, Math.min(elapsed, 120)));
      }
    } catch {
      // offline — pracujeme s poslednym stavom
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function setState(state: string) {
    try {
      await api(`/matches/${id}/state`, { method: 'POST', body: JSON.stringify({ state }) });
      await load();
    } catch (e) {
      Alert.alert('Chyba', e instanceof Error ? e.message : 'Zmena stavu zlyhala');
    }
  }

  async function record(type: string, needsPlayer: boolean) {
    if (needsPlayer && !selected) {
      Alert.alert('Vyberte hráča', 'Najprv ťuknite na hráča v nominácii.');
      return;
    }
    const payload = {
      clientId: Crypto.randomUUID(),
      minute,
      type,
      memberId: needsPlayer ? selected!.member.id : undefined,
    };
    // optimisticky do logu, zápis cez offline frontu
    setMatch((prev) =>
      prev
        ? {
            ...prev,
            scoreUs: type === 'GOAL' ? (prev.scoreUs ?? 0) + 1 : prev.scoreUs,
            scoreThem: type === 'GOAL_CONCEDED' ? (prev.scoreThem ?? 0) + 1 : prev.scoreThem,
            events: [
              ...prev.events,
              {
                id: payload.clientId,
                minute,
                type,
                member: needsPlayer ? { lastName: selected!.member.lastName } : null,
              },
            ],
          }
        : prev,
    );
    const { pending: p } = await enqueue({ kind: 'matchEvent', matchId: id, payload });
    setPending(p);
    setSelected(null);
  }

  if (!match) {
    return (
      <View style={styles.center}>
        <Text style={{ color: colors.gray }}>Načítavam zápas…</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 32 }}>
      <Text style={styles.title}>{match.event.title}</Text>
      <Text style={styles.score}>
        {match.scoreUs ?? 0} : {match.scoreThem ?? 0}
      </Text>
      <Text style={styles.stateText}>
        {match.state === 'LIVE' ? '● NAŽIVO' : match.state === 'FINISHED' ? 'Ukončený' : 'Plánovaný'}
      </Text>
      {pending > 0 && (
        <Text style={styles.offline}>Offline — {pending} udalostí čaká na odoslanie.</Text>
      )}

      <View style={styles.buttonRow}>
        {match.state === 'PLANNED' && (
          <Pressable style={styles.primaryBtn} onPress={() => setState('LIVE')}>
            <Text style={styles.primaryBtnText}>Začať zápas</Text>
          </Pressable>
        )}
        {match.state === 'LIVE' && (
          <Pressable style={[styles.primaryBtn, { backgroundColor: colors.danger }]} onPress={() => setState('FINISHED')}>
            <Text style={styles.primaryBtnText}>Ukončiť zápas</Text>
          </Pressable>
        )}
        <Link href={`/match/${id}/nomination`} asChild>
          <Pressable style={styles.secondaryBtn}>
            <Text style={styles.secondaryBtnText}>Nominácia</Text>
          </Pressable>
        </Link>
      </View>

      {match.state === 'LIVE' && (
        <>
          <View style={styles.minuteRow}>
            <Pressable style={styles.minuteBtn} onPress={() => setMinute((m) => Math.max(0, m - 1))}>
              <Text style={styles.minuteBtnText}>−</Text>
            </Pressable>
            <Text style={styles.minuteText}>{minute}. min</Text>
            <Pressable style={styles.minuteBtn} onPress={() => setMinute((m) => m + 1)}>
              <Text style={styles.minuteBtnText}>+</Text>
            </Pressable>
          </View>

          {selected && (
            <Text style={styles.selectedHint}>
              Vybraný: {selected.member.lastName} — ťuknite na akciu hráča
            </Text>
          )}
          <View style={styles.actionsGrid}>
            {PLAYER_ACTIONS.map((t) => (
              <Pressable key={t} style={styles.actionBtn} onPress={() => record(t, true)}>
                <Text style={styles.actionText}>{eventLabels[t]}</Text>
              </Pressable>
            ))}
            {TEAM_ACTIONS.map((t) => (
              <Pressable key={t} style={[styles.actionBtn, styles.teamActionBtn]} onPress={() => record(t, false)}>
                <Text style={styles.actionText}>{eventLabels[t]}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.sectionTitle}>Nominácia — ťuknutím vyberte hráča</Text>
          <FlatList
            data={match.nominations}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <Pressable
                style={[styles.playerRow, selected?.id === item.id && styles.playerRowSelected]}
                onPress={() => setSelected(selected?.id === item.id ? null : item)}
              >
                <Text style={styles.playerName}>
                  {item.member.lastName} {item.member.firstName}
                </Text>
                {selected?.id === item.id && <Text style={styles.check}>✓</Text>}
              </Pressable>
            )}
          />
        </>
      )}

      <Text style={styles.sectionTitle}>Priebeh zápasu</Text>
      {match.events.length === 0 && <Text style={styles.empty}>Zatiaľ žiadne udalosti.</Text>}
      {match.events.map((e) => (
        <View key={e.id} style={styles.logRow}>
          <Text style={styles.logMinute}>{e.minute}'</Text>
          <Text style={styles.logText}>
            {eventLabels[e.type] ?? e.type}
            {e.member ? ` — ${e.member.lastName}` : ''}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.club50, padding: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: '600', color: colors.club900, textAlign: 'center' },
  score: { fontSize: 48, fontWeight: '800', color: colors.club800, textAlign: 'center', marginVertical: 4 },
  stateText: { textAlign: 'center', color: colors.club600, fontWeight: '700', marginBottom: 12 },
  offline: { backgroundColor: '#fef3c7', color: '#92400e', padding: 8, borderRadius: 6, marginBottom: 8, fontSize: 13 },
  buttonRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  primaryBtn: { flex: 1, backgroundColor: colors.club600, borderRadius: 8, padding: 14, alignItems: 'center' },
  primaryBtnText: { color: colors.white, fontWeight: '700' },
  secondaryBtn: {
    flex: 1,
    borderColor: colors.club600,
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  secondaryBtnText: { color: colors.club600, fontWeight: '700' },
  minuteRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 12 },
  minuteBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.club100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  minuteBtnText: { fontSize: 24, color: colors.club800, fontWeight: '700' },
  minuteText: { fontSize: 20, fontWeight: '700', color: colors.club900, minWidth: 80, textAlign: 'center' },
  selectedHint: { textAlign: 'center', color: colors.club700, marginBottom: 8, fontSize: 13 },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  actionBtn: {
    flexBasis: '48%',
    flexGrow: 1,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.club100,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  teamActionBtn: { backgroundColor: colors.club50 },
  actionText: { fontWeight: '700', color: colors.club900, fontSize: 13 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.club800, marginTop: 8, marginBottom: 8 },
  playerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.club100,
    padding: 12,
    marginBottom: 6,
  },
  playerRowSelected: { borderColor: colors.club600, backgroundColor: colors.club100 },
  playerName: { fontWeight: '600', color: colors.club900 },
  check: { color: colors.club600, fontWeight: '800' },
  logRow: { flexDirection: 'row', gap: 12, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.club100 },
  logMinute: { width: 36, fontWeight: '700', color: colors.club600 },
  logText: { color: colors.club900 },
  empty: { color: colors.gray, fontSize: 13 },
});
