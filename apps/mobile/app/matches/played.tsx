import { useCallback, useEffect, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { formatEventDateSk } from '@fkknv/shared';
import { API_URL, api } from '@/api';
import { colors } from '@/theme';
import { JerseySwatch } from '@/JerseySwatch';

interface PlayedMatch {
  id: string;
  opponent: string;
  isHome: boolean;
  scoreUs: number | null;
  scoreThem: number | null;
  jerseyColor: 'DARK' | 'LIGHT' | null;
  videoUrl: string | null;
  event: { title: string; startAt: string; team: { name: string } | null };
  photos: Array<{ id: string }>;
}

const photoUrl = (id: string) => `${API_URL}/matches/photos/${id}`;

export default function PlayedMatchesScreen() {
  const [matches, setMatches] = useState<PlayedMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // lightbox: zoznam URL fotiek + počiatočný index
  const [lightbox, setLightbox] = useState<{ photos: string[]; index: number } | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api<PlayedMatch[]>('/matches/played');
      setMatches(data);
    } catch {
      // ponecháme posledný stav
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={{ color: colors.gray }}>Načítavam…</Text>
      </View>
    );
  }

  return (
    <>
      <FlatList
        style={styles.container}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        data={matches}
        keyExtractor={(m) => m.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={<Text style={styles.empty}>Zatiaľ žiadne odohrané zápasy.</Text>}
        renderItem={({ item }) => {
          const ourScore = item.scoreUs ?? 0;
          const oppScore = item.scoreThem ?? 0;
          const homeScore = item.isHome ? ourScore : oppScore;
          const awayScore = item.isHome ? oppScore : ourScore;
          const our = item.event.team?.name ?? 'FK KNV';
          const homeName = item.isHome ? our : item.opponent;
          const awayName = item.isHome ? item.opponent : our;
          const photoUrls = item.photos.map((p) => photoUrl(p.id));
          return (
            <View style={styles.card}>
              <View style={styles.headerRow}>
                <Text style={styles.date}>{formatEventDateSk(item.event.startAt)}</Text>
                {item.jerseyColor && <JerseySwatch color={item.jerseyColor} size={13} />}
              </View>
              <Text style={styles.teams}>
                {homeName} <Text style={styles.score}>{homeScore} : {awayScore}</Text> {awayName}
              </Text>

              {item.videoUrl ? (
                <Pressable onPress={() => Linking.openURL(item.videoUrl!)}>
                  <Text style={styles.videoLink}>▶ Pozrieť video</Text>
                </Pressable>
              ) : null}

              {photoUrls.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbRow}>
                  {item.photos.map((p, i) => (
                    <Pressable key={p.id} onPress={() => setLightbox({ photos: photoUrls, index: i })}>
                      <Image source={{ uri: photoUrl(p.id) }} style={styles.thumb} />
                    </Pressable>
                  ))}
                </ScrollView>
              )}
            </View>
          );
        }}
      />

      {/* Lightbox: fotky na celú obrazovku, listovanie prstom */}
      <Modal visible={!!lightbox} transparent animationType="fade" onRequestClose={() => setLightbox(null)}>
        <View style={styles.lightboxBg}>
          <Pressable style={styles.closeBtn} onPress={() => setLightbox(null)} hitSlop={12}>
            <Text style={styles.closeText}>✕</Text>
          </Pressable>
          {lightbox && (
            <FlatList
              data={lightbox.photos}
              keyExtractor={(u) => u}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              initialScrollIndex={lightbox.index}
              getItemLayout={(_, index) => ({ length: SCREEN_W, offset: SCREEN_W * index, index })}
              renderItem={({ item }) => (
                <View style={styles.slide}>
                  <Image source={{ uri: item }} style={styles.fullImage} resizeMode="contain" />
                </View>
              )}
            />
          )}
        </View>
      </Modal>
    </>
  );
}

const SCREEN_W = Dimensions.get('window').width;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.club50 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.club50 },
  empty: { color: colors.gray, textAlign: 'center', marginTop: 40 },
  card: {
    backgroundColor: colors.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.club100,
    padding: 14,
    marginBottom: 12,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  date: { color: colors.gray, fontSize: 12, fontWeight: '600' },
  teams: { color: colors.club900, fontSize: 15, fontWeight: '600', marginTop: 4 },
  score: { color: colors.club700, fontWeight: '800' },
  videoLink: { color: colors.club600, fontWeight: '700', marginTop: 8 },
  thumbRow: { marginTop: 10 },
  thumb: { width: 76, height: 76, borderRadius: 6, marginRight: 6, backgroundColor: colors.club100 },
  lightboxBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center' },
  closeBtn: { position: 'absolute', top: 44, right: 20, zIndex: 2, padding: 8 },
  closeText: { color: colors.white, fontSize: 26, fontWeight: '700' },
  slide: { width: SCREEN_W, alignItems: 'center', justifyContent: 'center' },
  fullImage: { width: SCREEN_W, height: '100%' },
});
