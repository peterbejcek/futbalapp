import { useEffect, useMemo, useState } from 'react';
import { SectionList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '@/api';
import { colors } from '@/theme';

interface Channel {
  id: string;
  kind: string;
  name: string;
  teamName: string | null;
  categoryCode: string | null;
  lastMessage: { body: string; createdAt: string } | null;
}

const KIND_LABELS: Record<string, string> = {
  TEAM_ANNOUNCEMENTS: '📢 Oznamy',
  TEAM_TRAINING: '🏃 Tréningy',
  TEAM_GENERAL: '💬 Všeobecné',
  CLUB_ANNOUNCEMENT: '📣 Oznamy klubu',
  COACHES: '👔 Tréneri a vedenie',
  BOARD: '🗂 Vedenie',
};

export default function ChannelsScreen() {
  const router = useRouter();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Channel[]>('/chat/channels')
      .then(setChannels)
      .catch((e) => setError(e instanceof Error ? e.message : 'Načítanie zlyhalo'));
  }, []);

  const sections = useMemo(() => {
    const map = new Map<string, { title: string; data: Channel[] }>();
    for (const c of channels) {
      const key = c.teamName ?? (c.kind === 'CLUB_ANNOUNCEMENT' ? 'Celý klub' : 'Ostatné');
      if (!map.has(key)) map.set(key, { title: key, data: [] });
      map.get(key)!.data.push(c);
    }
    return [...map.values()];
  }, [channels]);

  return (
    <View style={styles.container}>
      {error && <Text style={styles.error}>{error}</Text>}
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
        ListEmptyComponent={!error ? <Text style={styles.empty}>Žiadne kanály.</Text> : null}
        renderSectionHeader={({ section }) => <Text style={styles.sectionHeader}>{section.title}</Text>}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => router.push(`/chat/${item.id}`)}>
            <Text style={styles.kind}>{KIND_LABELS[item.kind] ?? item.name}</Text>
            <Text style={styles.preview} numberOfLines={1}>
              {item.lastMessage?.body ?? 'Zatiaľ žiadne správy'}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.club50, padding: 16 },
  error: { color: colors.danger, marginBottom: 8 },
  empty: { color: colors.gray, textAlign: 'center', marginTop: 32 },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.club700,
    textTransform: 'uppercase',
    marginTop: 14,
    marginBottom: 6,
  },
  row: {
    backgroundColor: colors.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.club100,
    padding: 12,
    marginBottom: 6,
  },
  kind: { fontWeight: '700', color: colors.club900 },
  preview: { color: colors.gray, fontSize: 13, marginTop: 2 },
});
