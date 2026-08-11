import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
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
  stoppage?: number | null;
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

function fmtMinute(minute: number, stoppage?: number | null) {
  return stoppage ? `${minute}+${stoppage}` : `${minute}`;
}

export default function MatchLiveScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [match, setMatch] = useState<MatchDetail | null>(null);
  const [selected, setSelected] = useState<Nomination | null>(null);
  const [minute, setMinute] = useState('0');
  const [stoppage, setStoppage] = useState('');
  const [scoreUs, setScoreUs] = useState('0');
  const [scoreThem, setScoreThem] = useState('0');
  const [pending, setPending] = useState(0);

  const load = useCallback(async () => {
    const { pending: p } = await flush();
    setPending(p);
    try {
      const detail = await api<MatchDetail>(`/matches/${id}`);
      setMatch(detail);
    } catch {
      // offline — pracujeme s poslednym stavom
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  // skóre v poliach drž zosynchronizované s načítaným zápasom
  useEffect(() => {
    if (match) {
      setScoreUs(String(match.scoreUs ?? 0));
      setScoreThem(String(match.scoreThem ?? 0));
    }
  }, [match?.scoreUs, match?.scoreThem]);

  async function setState(state: string) {
    try {
      await api(`/matches/${id}/state`, { method: 'POST', body: JSON.stringify({ state }) });
      await load();
    } catch (e) {
      Alert.alert('Chyba', e instanceof Error ? e.message : 'Zmena stavu zlyhala');
    }
  }

  async function saveScore() {
    try {
      await api(`/matches/${id}/score`, {
        method: 'POST',
        body: JSON.stringify({ scoreUs: Number(scoreUs) || 0, scoreThem: Number(scoreThem) || 0 }),
      });
      await load();
      Alert.alert('Uložené', 'Výsledok bol uložený.');
    } catch (e) {
      Alert.alert('Chyba', e instanceof Error ? e.message : 'Uloženie výsledku zlyhalo');
    }
  }

  async function record(type: string, needsPlayer: boolean) {
    if (needsPlayer && !selected) {
      Alert.alert('Vyberte hráča', 'Najprv ťuknite na hráča v zozname nižšie.');
      return;
    }
    const min = Number(minute) || 0;
    const stop = Number(stoppage) > 0 ? Number(stoppage) : undefined;
    const payload = {
      clientId: Crypto.randomUUID(),
      minute: min,
      stoppage: stop,
      type,
      memberId: needsPlayer ? selected!.member.id : undefined,
    };
    // optimisticky do logu, zápis cez offline frontu
    setMatch((prev) =>
      prev
        ? {
            ...prev,
            scoreUs: type === 'GOAL' || type === 'PENALTY_SCORED' ? (prev.scoreUs ?? 0) + 1 : prev.scoreUs,
            scoreThem: type === 'GOAL_CONCEDED' ? (prev.scoreThem ?? 0) + 1 : prev.scoreThem,
            events: [
              ...prev.events,
              {
                id: payload.clientId,
                minute: min,
                stoppage: stop,
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

  const recording = match.state === 'LIVE' || match.state === 'FINISHED';

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 32 }}>
      <Text style={styles.title}>{match.event.title}</Text>
      <Text style={styles.score}>
        {match.scoreUs ?? 0} : {match.scoreThem ?? 0}
      </Text>
      <Text style={styles.stateText}>
        {match.state === 'LIVE' ? '● NAŽIVO' : match.state === 'FINISHED' ? 'Ukončený' : match.state === 'CANCELLED' ? 'Zrušený' : 'Plánovaný'}
      </Text>
      {pending > 0 && <Text style={styles.offline}>Offline — {pending} udalostí čaká na odoslanie.</Text>}

      {/* editovateľný výsledok */}
      {recording && (
        <View style={styles.scoreEditRow}>
          <View style={styles.scoreEditCol}>
            <Text style={styles.scoreEditLabel}>Domáci</Text>
            <TextInput
              style={styles.numInput}
              keyboardType="number-pad"
              value={scoreUs}
              onChangeText={setScoreUs}
            />
          </View>
          <Text style={styles.scoreColon}>:</Text>
          <View style={styles.scoreEditCol}>
            <Text style={styles.scoreEditLabel}>Hostia</Text>
            <TextInput
              style={styles.numInput}
              keyboardType="number-pad"
              value={scoreThem}
              onChangeText={setScoreThem}
            />
          </View>
          <Pressable style={styles.saveScoreBtn} onPress={saveScore}>
            <Text style={styles.saveScoreText}>Uložiť</Text>
          </Pressable>
        </View>
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
        {match.state === 'FINISHED' && (
          <Pressable style={styles.secondaryBtn} onPress={() => setState('LIVE')}>
            <Text style={styles.secondaryBtnText}>Znovu otvoriť</Text>
          </Pressable>
        )}
        <Link href={`/match/${id}/nomination`} asChild>
          <Pressable style={styles.secondaryBtn}>
            <Text style={styles.secondaryBtnText}>Nominácia</Text>
          </Pressable>
        </Link>
      </View>

      {recording && (
        <>
          {/* minúta + nadstavenie */}
          <View style={styles.minuteRow}>
            <View style={styles.minuteCol}>
              <Text style={styles.minuteLabel}>Minúta</Text>
              <TextInput
                style={styles.numInput}
                keyboardType="number-pad"
                value={minute}
                onChangeText={setMinute}
              />
            </View>
            <Text style={styles.plus}>+</Text>
            <View style={styles.minuteCol}>
              <Text style={styles.minuteLabel}>Nadstavenie</Text>
              <TextInput
                style={styles.numInput}
                keyboardType="number-pad"
                value={stoppage}
                onChangeText={setStoppage}
                placeholder="0"
              />
            </View>
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

          <Text style={styles.sectionTitle}>Hráč — ťuknutím vyberte</Text>
          <FlatList
            data={match.nominations}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            ListEmptyComponent={<Text style={styles.empty}>Najprv pridajte hráčov cez „Nominácia".</Text>}
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
          <Text style={styles.logMinute}>{fmtMinute(e.minute, e.stoppage)}'</Text>
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
  scoreEditRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 8, marginBottom: 14 },
  scoreEditCol: { alignItems: 'center' },
  scoreEditLabel: { fontSize: 11, color: colors.gray, marginBottom: 2 },
  scoreColon: { fontSize: 20, fontWeight: '800', color: colors.gray, paddingBottom: 8 },
  saveScoreBtn: {
    backgroundColor: colors.club100,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignSelf: 'flex-end',
  },
  saveScoreText: { color: colors.club800, fontWeight: '700' },
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
  minuteRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 12, marginBottom: 12 },
  minuteCol: { alignItems: 'center' },
  minuteLabel: { fontSize: 11, color: colors.gray, marginBottom: 2 },
  plus: { fontSize: 22, fontWeight: '800', color: colors.gray, paddingBottom: 8 },
  numInput: {
    width: 72,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.club100,
    borderRadius: 8,
    paddingVertical: 8,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    color: colors.club900,
  },
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
  logMinute: { width: 44, fontWeight: '700', color: colors.club600 },
  logText: { color: colors.club900 },
  empty: { color: colors.gray, fontSize: 13 },
});
