import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { api } from '@/api';
import { colors } from '@/theme';

interface MemberRow {
  id: string;
  firstName: string;
  lastName: string;
}

interface MatchDetail {
  id: string;
  event: { team: { id: string } | null };
  nominations: Array<{ member: { id: string } }>;
}

export default function NominationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [nominated, setNominated] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    const match = await api<MatchDetail>(`/matches/${id}`);
    setNominated(new Set(match.nominations.map((n) => n.member.id)));
    const teamId = match.event.team?.id;
    if (teamId) {
      setMembers(await api<MemberRow[]>(`/members?team=${teamId}&role=PLAYER`));
    }
  }, [id]);

  useEffect(() => {
    load().catch((e) => Alert.alert('Chyba', e instanceof Error ? e.message : 'Načítanie zlyhalo'));
  }, [load]);

  async function toggle(member: MemberRow) {
    const isNominated = nominated.has(member.id);
    // optimistická zmena
    setNominated((prev) => {
      const next = new Set(prev);
      if (isNominated) next.delete(member.id);
      else next.add(member.id);
      return next;
    });
    try {
      if (isNominated) {
        await api(`/matches/${id}/nominations/${member.id}`, { method: 'DELETE' });
      } else {
        await api(`/matches/${id}/nominations`, { method: 'POST', body: JSON.stringify({ memberId: member.id }) });
      }
    } catch (e) {
      await load(); // vráť skutočný stav
      Alert.alert('Chyba', e instanceof Error ? e.message : 'Zmena nominácie zlyhala');
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>
        Nominovaných: {nominated.size} / {members.length}
      </Text>
      <FlatList
        data={members}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text style={styles.empty}>Kategória nemá hráčov.</Text>}
        renderItem={({ item }) => {
          const isOn = nominated.has(item.id);
          return (
            <Pressable style={[styles.row, isOn && styles.rowOn]} onPress={() => toggle(item)}>
              <Text style={styles.name}>
                {item.lastName} {item.firstName}
              </Text>
              <Text style={[styles.mark, { color: isOn ? colors.club600 : colors.gray }]}>
                {isOn ? '✓ v nominácii' : '+'}
              </Text>
            </Pressable>
          );
        }}
      />
      <Text style={styles.hint}>Ťuknutím pridáte alebo odoberiete hráča — aj počas zápasu.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.club50, padding: 16 },
  heading: { fontSize: 16, fontWeight: '700', color: colors.club900, marginBottom: 12 },
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
  rowOn: { borderColor: colors.club600 },
  name: { fontSize: 16, fontWeight: '600', color: colors.club900 },
  mark: { fontWeight: '700' },
  hint: { color: colors.gray, fontSize: 12, textAlign: 'center', paddingVertical: 8 },
});
