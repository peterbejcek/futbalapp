import { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { api } from '@/api';
import { colors } from '@/theme';

interface MemberRow {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  status: string;
  memberships: Array<{ team: { name: string } }>;
  guardians: Array<{ user: { firstName: string; lastName: string; phone: string | null } }>;
}

export default function MembersScreen() {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setMembers(await api<MemberRow[]>('/members'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Načítanie zlyhalo');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <View style={styles.container}>
      {error && <Text style={styles.error}>{error}</Text>}
      <FlatList
        data={members}
        keyExtractor={(m) => m.id}
        ListEmptyComponent={!error ? <Text style={styles.empty}>Žiadni členovia.</Text> : null}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.name}>
              {item.lastName} {item.firstName}
            </Text>
            <Text style={styles.meta}>
              {new Date(item.birthDate).getFullYear()} · {item.memberships[0]?.team.name ?? 'bez družstva'}
              {item.status !== 'ACTIVE' ? ' · neaktívny' : ''}
            </Text>
            {item.guardians[0] && (
              <Text style={styles.meta}>
                Rodič: {item.guardians[0].user.firstName} {item.guardians[0].user.lastName}
                {item.guardians[0].user.phone ? ` · ${item.guardians[0].user.phone}` : ''}
              </Text>
            )}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.club50, padding: 16 },
  error: { color: colors.danger, marginBottom: 8 },
  empty: { color: colors.gray, textAlign: 'center', marginTop: 32 },
  card: {
    backgroundColor: colors.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.club100,
    padding: 12,
    marginBottom: 8,
  },
  name: { fontSize: 16, fontWeight: '600', color: colors.club900 },
  meta: { color: colors.gray, fontSize: 13, marginTop: 2 },
});
