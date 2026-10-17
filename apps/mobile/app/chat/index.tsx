import { useCallback, useMemo, useState } from 'react';
import { SectionList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { api } from '@/api';
import { ui } from '@/theme';

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
  TEAM_EMAIL: '✉ Hromadný email',
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
  container: { flex: 1, backgroundColor: ui.bg, padding: 16 },
  error: { color: ui.red, marginBottom: 8 },
  empty: { color: ui.muted, textAlign: 'center', marginTop: 32 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14, marginBottom: 6 },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '800',
    color: ui.ink,
    textTransform: 'uppercase',
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: ui.red },
  row: {
    backgroundColor: ui.panel,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: ui.line,
    padding: 12,
    marginBottom: 6,
  },
  rowUnread: { borderColor: ui.blue, backgroundColor: ui.panel2 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kind: { fontWeight: '700', color: ui.ink },
  kindUnread: { fontWeight: '800' },
  badge: {
    minWidth: 20,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
    backgroundColor: ui.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: ui.onAccent, fontSize: 12, fontWeight: '800' },
  preview: { color: ui.muted, fontSize: 13, marginTop: 2 },
  previewUnread: { color: ui.ink },
});
