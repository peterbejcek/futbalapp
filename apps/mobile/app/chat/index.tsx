import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '@/api';
import { colors } from '@/theme';

interface Channel {
  id: string;
  type: string;
  name: string;
  categoryCode: string | null;
  lastMessage: { body: string; createdAt: string } | null;
}

export default function ChannelsScreen() {
  const router = useRouter();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Channel[]>('/chat/channels')
      .then(setChannels)
      .catch((e) => setError(e instanceof Error ? e.message : 'Načítanie zlyhalo'));
  }, []);

  return (
    <View style={styles.container}>
      {error && <Text style={styles.error}>{error}</Text>}
      <FlatList
        data={channels}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={!error ? <Text style={styles.empty}>Žiadne kanály.</Text> : null}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => router.push(`/chat/${item.id}`)}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{item.categoryCode ?? '📣'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.preview} numberOfLines={1}>
                {item.lastMessage?.body ?? 'Zatiaľ žiadne správy'}
              </Text>
            </View>
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.club100,
    padding: 12,
    marginBottom: 8,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.club100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontWeight: '800', color: colors.club800, fontSize: 12 },
  name: { fontWeight: '700', color: colors.club900 },
  preview: { color: colors.gray, fontSize: 13, marginTop: 2 },
});
