import { useCallback, useMemo, useState } from 'react';
import { SectionList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { api } from '@/api';
import { colors } from '@/theme';

interface Channel {
  id: string;
  kind: string;
  name: string;
  teamName: string | null;
  categoryCode: string | null;
  lastMessage: { body: string; createdAt: string } | null;
  unreadCount: number;
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

  // obnov pri každom zobrazení (aj po návrate z kanála → aktualizuje neprečítané)
  useFocusEffect(
    useCallback(() => {
      api<Channel[]>('/chat/channels')
        .then(setChannels)
        .catch((e) => setError(e instanceof Error ? e.message : 'Načítanie zlyhalo'));
    }, []),
  );

  const sections = useMemo(() => {
    const map = new Map<string, { title: string; hasUnread: boolean; data: Channel[] }>();
    for (const c of channels) {
      const key = c.teamName ?? (c.kind === 'CLUB_ANNOUNCEMENT' ? 'Celý klub' : 'Ostatné');
      if (!map.has(key)) map.set(key, { title: key, hasUnread: false, data: [] });
      const g = map.get(key)!;
      g.data.push(c);
      if (c.unreadCount > 0) g.hasUnread = true;
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
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionRow}>
            <Text style={styles.sectionHeader}>{section.title}</Text>
            {section.hasUnread && <View style={styles.dot} />}
          </View>
        )}
        renderItem={({ item }) => {
          const unread = item.unreadCount > 0;
          return (
            <Pressable style={[styles.row, unread && styles.rowUnread]} onPress={() => router.push(`/chat/${item.id}`)}>
              <View style={styles.rowTop}>
                <Text style={[styles.kind, unread && styles.kindUnread]}>{KIND_LABELS[item.kind] ?? item.name}</Text>
                {unread && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{item.unreadCount}</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.preview, unread && styles.previewUnread]} numberOfLines={1}>
                {item.lastMessage?.body ?? 'Zatiaľ žiadne správy'}
              </Text>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.club50, padding: 16 },
  error: { color: colors.danger, marginBottom: 8 },
  empty: { color: colors.gray, textAlign: 'center', marginTop: 32 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14, marginBottom: 6 },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.club700,
    textTransform: 'uppercase',
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.danger },
  row: {
    backgroundColor: colors.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.club100,
    padding: 12,
    marginBottom: 6,
  },
  rowUnread: { borderColor: colors.club600, backgroundColor: '#f5f8ff' },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kind: { fontWeight: '700', color: colors.club900 },
  kindUnread: { fontWeight: '800' },
  badge: {
    minWidth: 20,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: colors.white, fontSize: 12, fontWeight: '800' },
  preview: { color: colors.gray, fontSize: 13, marginTop: 2 },
  previewUnread: { color: colors.club800 },
});
