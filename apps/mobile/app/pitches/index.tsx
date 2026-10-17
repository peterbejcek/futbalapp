import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ui } from '@/theme';
import {
  addDays,
  dayLabel,
  fetchOccupancy,
  fetchPitches,
  freeWindows,
  hhmm,
  minToHhmm,
  slotRange,
  SURFACE_LABELS,
  todayYmd,
  type Occupancy,
  type Pitch,
} from '@/pitches';

export default function PitchesScreen() {
  const [pitches, setPitches] = useState<Pitch[]>([]);
  const [pitchId, setPitchId] = useState('');
  const [day, setDay] = useState(todayYmd());
  const [week, setWeek] = useState(false);
  const [items, setItems] = useState<Occupancy[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchPitches()
      .then((p) => {
        setPitches(p);
        if (p[0]) setPitchId((cur) => cur || p[0].id);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Zoznam ihrísk sa nenačítal'));
  }, []);

  const days = useMemo(() => (week ? Array.from({ length: 7 }, (_, i) => addDays(day, i)) : [day]), [day, week]);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    fetchOccupancy(days[0], days[days.length - 1])
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : 'Obsadenosť sa nenačítala'))
      .finally(() => setLoading(false));
  }, [days]);

  useEffect(load, [load]);

  const mine = useMemo(() => items.filter((o) => o.pitchId === pitchId), [items, pitchId]);
  const pitch = pitches.find((p) => p.id === pitchId);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
      <View style={styles.wrap}>
        {pitches.map((p) => (
          <Pressable key={p.id} style={[styles.chip, pitchId === p.id && styles.chipActive]} onPress={() => setPitchId(p.id)}>
            <Text style={[styles.chipText, pitchId === p.id && styles.chipTextActive]}>{p.name}</Text>
          </Pressable>
        ))}
      </View>
      {pitch && <Text style={styles.muted}>{SURFACE_LABELS[pitch.surface] ?? pitch.surface}</Text>}

      <View style={[styles.wrap, { marginTop: 14 }]}>
        <Pressable style={styles.chip} onPress={() => setDay(addDays(day, week ? -7 : -1))}>
          <Text style={styles.chipText}>‹ {week ? 'Týždeň' : 'Deň'}</Text>
        </Pressable>
        <Pressable style={styles.chip} onPress={() => setDay(todayYmd())}>
          <Text style={styles.chipText}>Dnes</Text>
        </Pressable>
        <Pressable style={styles.chip} onPress={() => setDay(addDays(day, week ? 7 : 1))}>
          <Text style={styles.chipText}>{week ? 'Týždeň' : 'Deň'} ›</Text>
        </Pressable>
        <Pressable style={[styles.chip, week && styles.chipActive]} onPress={() => setWeek(!week)}>
          <Text style={[styles.chipText, week && styles.chipTextActive]}>Týždeň (7 dní)</Text>
        </Pressable>
      </View>

      {loading && <ActivityIndicator color={ui.lime} style={{ marginTop: 16 }} />}
      {!!error && <Text style={styles.error}>{error}</Text>}

      {days.map((d) => {
        const list = mine
          .filter((o) => o.startAt.slice(0, 10) === d)
          .sort((a, b) => a.startAt.localeCompare(b.startAt));
        const free = freeWindows(list);
        return (
          <View key={d} style={styles.card}>
            <Text style={styles.dayTitle}>{dayLabel(d)}</Text>
            {list.length === 0 && <Text style={styles.free}>Celý deň voľné</Text>}
            {list.map((o) => {
              const r = slotRange(o);
              return (
                <View key={o.id} style={styles.slot}>
                  <Text style={styles.time}>
                    {hhmm(o.startAt)}–{o.endAt ? hhmm(o.endAt) : minToHhmm(r.e) + '*'}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.slotTitle}>{o.teamName ?? o.title}</Text>
                    {o.teamName && o.title !== o.teamName ? <Text style={styles.muted}>{o.title}</Text> : null}
                  </View>
                </View>
              );
            })}
            {list.length > 0 && (
              <Text style={styles.free}>
                Voľné: {free.length ? free.map((w) => `${minToHhmm(w.s)}–${minToHhmm(w.e)}`).join(', ') : 'nič (08:00–22:00)'}
              </Text>
            )}
          </View>
        );
      })}
      {list0(mine) && <Text style={styles.muted}>* koniec nezadaný, počíta sa 90 min</Text>}
    </ScrollView>
  );
}

function list0(l: Occupancy[]) {
  return l.some((o) => !o.endAt);
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: ui.bg },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1, borderColor: ui.line, borderRadius: 20, paddingVertical: 8, paddingHorizontal: 14, backgroundColor: ui.panel },
  chipActive: { backgroundColor: ui.blue, borderColor: ui.blue },
  chipText: { color: ui.ink, fontWeight: '600', fontSize: 13 },
  chipTextActive: { color: ui.onAccent },
  muted: { color: ui.muted, fontSize: 12, marginTop: 4 },
  error: { color: ui.red, marginTop: 12 },
  card: { backgroundColor: ui.panel, borderWidth: 1, borderColor: ui.line, borderRadius: 10, padding: 12, marginTop: 12 },
  dayTitle: { color: ui.lime, fontWeight: '700', fontSize: 14, marginBottom: 6 },
  slot: { flexDirection: 'row', gap: 10, paddingVertical: 6, borderTopWidth: 1, borderTopColor: ui.line },
  time: { color: ui.ink, fontWeight: '700', width: 96 },
  slotTitle: { color: ui.ink, fontSize: 14 },
  free: { color: ui.ok, fontSize: 12, marginTop: 6 },
});
