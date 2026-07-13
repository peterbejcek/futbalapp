import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { api } from '@/api';
import { enqueue, flush } from '@/offline';
import { colors } from '@/theme';

interface AttendanceRow {
  id: string;
  status: string;
  member: { id: string; firstName: string; lastName: string };
}

interface EventDetail {
  id: string;
  title: string;
  startAt: string;
  attendances: AttendanceRow[];
}

/** Poradie cyklovania stavov jedným ťuknutím. */
const CYCLE = ['PRESENT', 'ABSENT', 'EXCUSED', 'INJURED'] as const;

const statusLabels: Record<string, string> = {
  PRESENT: 'Prítomný',
  ABSENT: 'Neprítomný',
  EXCUSED: 'Ospravedlnený',
  INJURED: 'Zranený',
  UNKNOWN: '—',
};

const statusColors: Record<string, string> = {
  PRESENT: colors.club600,
  ABSENT: colors.danger,
  EXCUSED: '#b45309',
  INJURED: '#7c3aed',
  UNKNOWN: colors.gray,
};

export default function AttendanceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [pending, setPending] = useState(0);

  const load = useCallback(async () => {
    const { pending: p } = await flush();
    setPending(p);
    try {
      setEvent(await api<EventDetail>(`/events/${id}/attendance`));
    } catch {
      // offline — ostaneme pri poslednom lokálnom stave
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function cycleStatus(row: AttendanceRow) {
    const current = CYCLE.indexOf(row.status as (typeof CYCLE)[number]);
    const next = CYCLE[(current + 1) % CYCLE.length]!;
    // optimistická zmena v UI, zápis ide cez offline frontu
    setEvent((prev) =>
      prev
        ? {
            ...prev,
            attendances: prev.attendances.map((a) => (a.id === row.id ? { ...a, status: next } : a)),
          }
        : prev,
    );
    const { pending: p } = await enqueue({
      kind: 'attendance',
      eventId: id,
      memberId: row.member.id,
      status: next,
    });
    setPending(p);
  }

  return (
    <View style={styles.container}>
      {event && (
        <Text style={styles.heading}>
          {event.title} · {new Date(event.startAt).toLocaleDateString('sk-SK')}
        </Text>
      )}
      {pending > 0 && (
        <Text style={styles.offline}>Offline — {pending} zmien čaká na odoslanie. Odošlú sa automaticky.</Text>
      )}
      <FlatList
        data={event?.attendances ?? []}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text style={styles.empty}>Žiadni priradení hráči.</Text>}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => cycleStatus(item)}>
            <Text style={styles.name}>
              {item.member.lastName} {item.member.firstName}
            </Text>
            <Text style={[styles.status, { color: statusColors[item.status] ?? colors.gray }]}>
              {statusLabels[item.status] ?? item.status}
            </Text>
          </Pressable>
        )}
      />
      <Text style={styles.hint}>Ťuknutím na hráča prepínate stav dochádzky.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.club50, padding: 16 },
  heading: { fontSize: 16, fontWeight: '700', color: colors.club900, marginBottom: 12 },
  offline: { backgroundColor: '#fef3c7', color: '#92400e', padding: 8, borderRadius: 6, marginBottom: 8, fontSize: 13 },
  empty: { color: colors.gray, textAlign: 'center', marginTop: 32 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.club100,
    padding: 14,
    marginBottom: 8,
  },
  name: { fontSize: 16, fontWeight: '600', color: colors.club900 },
  status: { fontSize: 14, fontWeight: '700' },
  hint: { color: colors.gray, fontSize: 12, textAlign: 'center', paddingVertical: 8 },
});
