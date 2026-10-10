import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import {
  FITNESS_DISCIPLINES,
  enduranceMinutesFor,
  fitnessDisciplineLabel,
  type FitnessDisciplineKey,
} from '@fkknv/shared';
import { api } from '@/api';
import { canManage, coachTeams, fetchMe, isStaff, type Me } from '@/auth';
import { colors } from '@/theme';
import { todayIso, type FitnessTest } from '@/fitness';

interface Team {
  id: string;
  name: string;
  teamCategory?: { code: string };
}
interface Player {
  id: string;
  firstName: string;
  lastName: string;
}
type Values = Record<FitnessDisciplineKey, string>;
interface Row {
  testId: string | null;
  values: Values;
  saved: Values;
  busy: boolean;
  error: string | null;
}

const emptyValues = (): Values => Object.fromEntries(FITNESS_DISCIPLINES.map((d) => [d.key, ''])) as Values;
const toNum = (s: string) => (s.trim() === '' ? null : Number(s.replace(',', '.')));
const collator = new Intl.Collator('sk');

/** Hromadné zadanie previerky: dátum + družstvo → riadok na hráča, Uložiť / Upraviť pri každom hráčovi. */
export default function NewFitnessTestScreen() {
  const params = useLocalSearchParams<{ team?: string; date?: string }>();
  const fixedTeam = !!params.team;
  const [me, setMe] = useState<Me | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamId, setTeamId] = useState(params.team ?? '');
  const [date, setDate] = useState(params.date ?? todayIso());
  const [players, setPlayers] = useState<Player[]>([]);
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMe().then(setMe).catch(() => {});
    api<Team[]>('/seasons/teams').then(setTeams).catch(() => {});
  }, []);

  const available = me && canManage(me) ? (isStaff(me) ? teams : teams.filter((t) => coachTeams(me).some((c) => c.id === t.id))) : [];
  const teamName = teams.find((t) => t.id === teamId)?.name;
  // dĺžka vytrvalostného behu podľa vekovej kategórie družstva (U13 = 6 min, U15 = 12 min)
  const minutes = enduranceMinutesFor(teams.find((t) => t.id === teamId)?.teamCategory?.code);

  const load = useCallback(async () => {
    if (!teamId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setPlayers([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [members, tests] = await Promise.all([
        api<Player[]>(`/members?team=${teamId}&hideInactive=true&role=PLAYER`),
        api<FitnessTest[]>('/fitness-tests'),
      ]);
      const sorted = [...members].sort((a, b) =>
        collator.compare(`${a.lastName} ${a.firstName}`, `${b.lastName} ${b.firstName}`),
      );
      const existing = new Map(tests.filter((t) => t.testedAt === date).map((t) => [t.memberId, t]));
      const next: Record<string, Row> = {};
      for (const p of sorted) {
        const t = existing.get(p.id);
        const values: Values = emptyValues();
        if (t) for (const d of FITNESS_DISCIPLINES) values[d.key] = t[d.key]?.toString() ?? '';
        next[p.id] = { testId: t?.id ?? null, values, saved: { ...values }, busy: false, error: null };
      }
      setPlayers(sorted);
      setRows(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Načítanie zlyhalo');
    } finally {
      setLoading(false);
    }
  }, [teamId, date]);
  useEffect(() => {
    void load();
  }, [load]);

  function patchRow(id: string, patch: Partial<Row>) {
    setRows((r) => ({ ...r, [id]: { ...r[id]!, ...patch } }));
  }
  function setValue(id: string, key: FitnessDisciplineKey, v: string) {
    setRows((r) => ({ ...r, [id]: { ...r[id]!, values: { ...r[id]!.values, [key]: v }, error: null } }));
  }

  async function save(playerId: string) {
    const row = rows[playerId]!;
    const body: Record<string, unknown> = { testedAt: date };
    for (const d of FITNESS_DISCIPLINES) body[d.key] = toNum(row.values[d.key]);
    if (FITNESS_DISCIPLINES.every((d) => body[d.key] == null)) {
      patchRow(playerId, { error: 'Zadajte aspoň jednu hodnotu' });
      return;
    }
    patchRow(playerId, { busy: true, error: null });
    try {
      if (row.testId) {
        await api(`/fitness-tests/${row.testId}`, { method: 'PATCH', body: JSON.stringify(body) });
        patchRow(playerId, { busy: false, saved: { ...row.values } });
      } else {
        const created = await api<{ id: string }>('/fitness-tests', {
          method: 'POST',
          body: JSON.stringify({ ...body, memberId: playerId, teamId }),
        });
        patchRow(playerId, { busy: false, testId: created.id, saved: { ...row.values } });
      }
    } catch (e) {
      patchRow(playerId, { busy: false, error: e instanceof Error ? e.message : 'Uloženie zlyhalo' });
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
      <Text style={styles.label}>Dátum (RRRR-MM-DD)</Text>
      <TextInput value={date} onChangeText={setDate} style={styles.input} autoCapitalize="none" />

      <Text style={styles.label}>Družstvo</Text>
      {fixedTeam ? (
        <Text style={styles.fixedTeam}>{teamName ?? '…'}</Text>
      ) : (
        <View style={styles.chipRow}>
          {available.map((t) => (
            <Pressable key={t.id} onPress={() => setTeamId(t.id)} style={[styles.chip, teamId === t.id && styles.chipActive]}>
              <Text style={[styles.chipText, teamId === t.id && styles.chipTextActive]}>{t.name}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {error && <Text style={styles.error}>{error}</Text>}
      {!teamId ? (
        <Text style={styles.empty}>Vyberte družstvo.</Text>
      ) : loading ? (
        <ActivityIndicator style={{ marginTop: 24 }} />
      ) : players.length === 0 ? (
        <Text style={styles.empty}>Družstvo nemá žiadnych hráčov.</Text>
      ) : (
        players.map((p) => {
          const row = rows[p.id];
          if (!row) return null;
          const dirty = FITNESS_DISCIPLINES.some((d) => row.values[d.key] !== row.saved[d.key]);
          return (
            <View key={p.id} style={styles.card}>
              <Text style={styles.name}>
                {p.lastName} {p.firstName}
              </Text>
              <View style={styles.grid}>
                {FITNESS_DISCIPLINES.map((d) => (
                  <View key={d.key} style={styles.cell}>
                    <Text style={styles.cellLabel}>
                      {fitnessDisciplineLabel(d, minutes)} ({d.unit})
                    </Text>
                    <TextInput
                      value={row.values[d.key]}
                      onChangeText={(v) => setValue(p.id, d.key, v)}
                      keyboardType="decimal-pad"
                      style={styles.cellInput}
                    />
                  </View>
                ))}
              </View>
              <View style={styles.footer}>
                {row.testId && !dirty ? <Text style={styles.ok}>✓ uložené</Text> : <View />}
                <Pressable
                  onPress={() => save(p.id)}
                  disabled={row.busy || (!!row.testId && !dirty)}
                  style={[styles.btn, (row.busy || (!!row.testId && !dirty)) && { opacity: 0.4 }]}
                >
                  <Text style={styles.btnText}>{row.busy ? '…' : row.testId ? 'Upraviť' : 'Uložiť'}</Text>
                </Pressable>
              </View>
              {row.error && <Text style={styles.error}>{row.error}</Text>}
            </View>
          );
        })
      )}
      <Text style={styles.hint}>Časy v sekundách (napr. 2,35), skok v cm. Tlačidlo pri hráčovi uloží jeho previerku.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.club50 },
  label: { fontSize: 12, color: colors.gray, marginBottom: 4, marginTop: 8 },
  input: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.club100, borderRadius: 8, padding: 10, fontSize: 15 },
  fixedTeam: { fontSize: 16, fontWeight: '700', color: colors.club900 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1, borderColor: colors.club100, backgroundColor: colors.white, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  chipActive: { backgroundColor: colors.club600, borderColor: colors.club600 },
  chipText: { color: colors.club700, fontSize: 13 },
  chipTextActive: { color: colors.white, fontWeight: '600' },
  card: { backgroundColor: colors.white, borderRadius: 8, borderWidth: 1, borderColor: colors.club100, padding: 12, marginTop: 10 },
  name: { fontSize: 16, fontWeight: '700', color: colors.club900, marginBottom: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: { width: '47%' },
  cellLabel: { fontSize: 11, color: colors.gray, marginBottom: 2 },
  cellInput: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6, fontSize: 14 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  ok: { color: '#16a34a', fontSize: 12 },
  btn: { backgroundColor: colors.club600, borderRadius: 6, paddingHorizontal: 18, paddingVertical: 8 },
  btnText: { color: colors.white, fontWeight: '700', fontSize: 14 },
  error: { color: colors.danger, fontSize: 12, marginTop: 6 },
  empty: { color: colors.gray, textAlign: 'center', marginTop: 24 },
  hint: { color: colors.gray, fontSize: 12, textAlign: 'center', marginTop: 16 },
});
