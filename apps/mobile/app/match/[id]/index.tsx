import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Image, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Link, useLocalSearchParams } from 'expo-router';
import * as Crypto from 'expo-crypto';
import * as ImagePicker from 'expo-image-picker';
import { MATCH_EVENT_LABELS_SK, formatEventTimeSk, type MatchEventType } from '@fkknv/shared';
import { API_URL, api, getToken } from '@/api';
import { canManageTeam, fetchMe, type Me } from '@/auth';
import { enqueue, flush } from '@/offline';
import { colors } from '@/theme';
import { JerseySwatch } from '@/JerseySwatch';

interface Nomination {
  id: string;
  member: { id: string; firstName: string; lastName: string };
}

interface MatchEventRow {
  id: string;
  minute: number;
  stoppage?: number | null;
  type: string;
  member: { lastName: string } | null;
}

interface MatchDetail {
  id: string;
  opponent: string;
  isHome: boolean;
  scoreUs: number | null;
  scoreThem: number | null;
  state: string;
  meetAt: string | null;
  notes: string | null;
  jerseyColor: 'DARK' | 'LIGHT' | null;
  videoUrl: string | null;
  event: { title: string; startAt: string; team: { id: string; name: string } | null };
  nominations: Nomination[];
  events: MatchEventRow[];
  photos: Array<{ id: string; mimeType: string; size: number; createdAt: string }>;
}

const eventLabels: Record<string, string> = MATCH_EVENT_LABELS_SK;

// akcie viazané na hráča vs tímové
const PLAYER_ACTIONS: MatchEventType[] = ['GOAL', 'ASSIST', 'PENALTY_SCORED', 'PENALTY_MISSED', 'YELLOW', 'RED', 'FOUL', 'SHOT'];
const TEAM_ACTIONS: MatchEventType[] = ['GOAL_CONCEDED', 'CORNER'];

function fmtMinute(minute: number, stoppage?: number | null) {
  return stoppage ? `${minute}+${stoppage}` : `${minute}`;
}

export default function MatchLiveScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [match, setMatch] = useState<MatchDetail | null>(null);
  const [selected, setSelected] = useState<Nomination | null>(null);
  const [minute, setMinute] = useState('0');
  const [stoppage, setStoppage] = useState('');
  const [scoreUs, setScoreUs] = useState('0');
  const [scoreThem, setScoreThem] = useState('0');
  const [pending, setPending] = useState(0);
  const [me, setMe] = useState<Me | null>(null);
  const [meetDraft, setMeetDraft] = useState('');
  const [notesDraft, setNotesDraft] = useState('');
  const [detailsBusy, setDetailsBusy] = useState(false);
  const [videoDraft, setVideoDraft] = useState('');
  const [videoBusy, setVideoBusy] = useState(false);
  const [veoBusy, setVeoBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);

  const load = useCallback(async () => {
    const { pending: p } = await flush();
    setPending(p);
    try {
      const detail = await api<MatchDetail>(`/matches/${id}`);
      setMatch(detail);
    } catch {
      // offline — pracujeme s poslednym stavom
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    fetchMe().then(setMe).catch(() => {});
  }, []);

  // skóre v poliach drž zosynchronizované s načítaným zápasom
  useEffect(() => {
    if (match) {
      setScoreUs(String(match.scoreUs ?? 0));
      setScoreThem(String(match.scoreThem ?? 0));
    }
  }, [match?.scoreUs, match?.scoreThem]);

  // čas zrazu (meetAt alebo hodina pred začiatkom) a poznámky z načítaného zápasu
  useEffect(() => {
    if (match) {
      setMeetDraft(formatEventTimeSk(match.meetAt ?? new Date(new Date(match.event.startAt).getTime() - 3_600_000)));
      setNotesDraft(match.notes ?? '');
      setVideoDraft(match.videoUrl ?? '');
    }
  }, [match?.meetAt, match?.notes, match?.videoUrl, match?.event.startAt]);

  async function saveDetails() {
    if (!match) return;
    setDetailsBusy(true);
    try {
      const start = new Date(match.event.startAt);
      const m = /^(\d{1,2}):(\d{2})$/.exec(meetDraft.trim());
      const meetAt = m
        ? new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate(), Number(m[1]), Number(m[2]))).toISOString()
        : null;
      await api(`/matches/${id}/details`, { method: 'POST', body: JSON.stringify({ meetAt, notes: notesDraft }) });
      await load();
      Alert.alert('Uložené', 'Zraz a poznámky boli uložené.');
    } catch (e) {
      Alert.alert('Chyba', e instanceof Error ? e.message : 'Uloženie zlyhalo');
    } finally {
      setDetailsBusy(false);
    }
  }

  async function setJersey(color: 'DARK' | 'LIGHT' | null) {
    try {
      await api(`/matches/${id}/details`, { method: 'POST', body: JSON.stringify({ jerseyColor: color }) });
      await load();
    } catch (e) {
      Alert.alert('Chyba', e instanceof Error ? e.message : 'Uloženie zlyhalo');
    }
  }

  async function saveVideo(url: string | null) {
    setVideoBusy(true);
    try {
      await api(`/matches/${id}/video`, { method: 'POST', body: JSON.stringify({ url }) });
      await load();
    } catch (e) {
      Alert.alert('Chyba', e instanceof Error ? e.message : 'Uloženie videa zlyhalo');
    } finally {
      setVideoBusy(false);
    }
  }

  async function findVeoVideo() {
    setVeoBusy(true);
    try {
      const res = await api<{ candidates: Array<{ url: string; title: string; recordedAt: string | null }> }>(
        `/matches/${id}/video/candidates`,
      );
      if (!res.candidates.length) {
        Alert.alert('Veo', 'Nenašlo sa zodpovedajúce video. Skontrolujte dátum/tímy alebo vložte odkaz ručne.');
        return;
      }
      if (res.candidates.length === 1) {
        await saveVideo(res.candidates[0].url);
        Alert.alert('Veo', 'Video bolo pridané.');
        return;
      }
      Alert.alert(
        'Vyberte video',
        'Nájdených viac videí:',
        [
          ...res.candidates.slice(0, 3).map((c) => ({
            text: c.title.slice(0, 40),
            onPress: () => saveVideo(c.url),
          })),
          { text: 'Zrušiť', style: 'cancel' as const },
        ],
      );
    } catch (e) {
      Alert.alert('Chyba', e instanceof Error ? e.message : 'Hľadanie Veo videa zlyhalo');
    } finally {
      setVeoBusy(false);
    }
  }

  async function addPhoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Prístup k fotkám', 'Povoľte prístup k fotkám v nastaveniach.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (res.canceled || !res.assets?.length) return;
    setPhotoBusy(true);
    try {
      const token = await getToken();
      for (const a of res.assets) {
        const form = new FormData();
        form.append('file', {
          uri: a.uri,
          name: a.fileName ?? `foto-${Date.now()}.jpg`,
          type: a.mimeType ?? 'image/jpeg',
        } as unknown as Blob);
        const resp = await fetch(`${API_URL}/matches/${id}/photos`, {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          body: form,
        });
        if (!resp.ok) {
          const body = (await resp.json().catch(() => ({}))) as { message?: string };
          throw new Error(body.message ?? 'Nahratie zlyhalo');
        }
      }
      await load();
    } catch (e) {
      Alert.alert('Chyba', e instanceof Error ? e.message : 'Nahratie fotky zlyhalo');
    } finally {
      setPhotoBusy(false);
    }
  }

  function confirmDeletePhoto(photoId: string) {
    Alert.alert('Zmazať fotku?', 'Fotku natrvalo odstrániť?', [
      { text: 'Zrušiť', style: 'cancel' },
      {
        text: 'Zmazať',
        style: 'destructive',
        onPress: async () => {
          try {
            await api(`/matches/${id}/photos/${photoId}`, { method: 'DELETE' });
            await load();
          } catch (e) {
            Alert.alert('Chyba', e instanceof Error ? e.message : 'Zmazanie zlyhalo');
          }
        },
      },
    ]);
  }

  async function setState(state: string) {
    try {
      await api(`/matches/${id}/state`, { method: 'POST', body: JSON.stringify({ state }) });
      await load();
    } catch (e) {
      Alert.alert('Chyba', e instanceof Error ? e.message : 'Zmena stavu zlyhala');
    }
  }

  async function saveScore() {
    try {
      await api(`/matches/${id}/score`, {
        method: 'POST',
        body: JSON.stringify({ scoreUs: Number(scoreUs) || 0, scoreThem: Number(scoreThem) || 0 }),
      });
      await load();
      Alert.alert('Uložené', 'Výsledok bol uložený.');
    } catch (e) {
      Alert.alert('Chyba', e instanceof Error ? e.message : 'Uloženie výsledku zlyhalo');
    }
  }

  async function record(type: string, needsPlayer: boolean) {
    if (needsPlayer && !selected) {
      Alert.alert('Vyberte hráča', 'Najprv ťuknite na hráča v zozname nižšie.');
      return;
    }
    const min = Number(minute) || 0;
    const stop = Number(stoppage) > 0 ? Number(stoppage) : undefined;
    const payload = {
      clientId: Crypto.randomUUID(),
      minute: min,
      stoppage: stop,
      type,
      memberId: needsPlayer ? selected!.member.id : undefined,
    };
    // optimisticky do logu, zápis cez offline frontu
    setMatch((prev) =>
      prev
        ? {
            ...prev,
            scoreUs: type === 'GOAL' || type === 'PENALTY_SCORED' ? (prev.scoreUs ?? 0) + 1 : prev.scoreUs,
            scoreThem: type === 'GOAL_CONCEDED' ? (prev.scoreThem ?? 0) + 1 : prev.scoreThem,
            events: [
              ...prev.events,
              {
                id: payload.clientId,
                minute: min,
                stoppage: stop,
                type,
                member: needsPlayer ? { lastName: selected!.member.lastName } : null,
              },
            ],
          }
        : prev,
    );
    const { pending: p } = await enqueue({ kind: 'matchEvent', matchId: id, payload });
    setPending(p);
    setSelected(null);
  }

  if (!match) {
    return (
      <View style={styles.center}>
        <Text style={{ color: colors.gray }}>Načítavam zápas…</Text>
      </View>
    );
  }

  const recording = match.state === 'LIVE' || match.state === 'FINISHED';
  // len vedenie a tréner daného družstva môžu zápas riadiť; rodič/hráč má náhľad
  const canControl = canManageTeam(me, match.event.team?.id);
  const myChildren = me?.children ?? [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 32 }}>
      <Text style={styles.title}>{match.event.title}</Text>
      <Text style={styles.score}>
        {(match.isHome ? match.scoreUs : match.scoreThem) ?? 0} : {(match.isHome ? match.scoreThem : match.scoreUs) ?? 0}
      </Text>
      <Text style={styles.stateText}>
        {match.state === 'LIVE' ? '● NAŽIVO' : match.state === 'FINISHED' ? 'Ukončený' : match.state === 'CANCELLED' ? 'Zrušený' : 'Plánovaný'}
      </Text>
      {pending > 0 && <Text style={styles.offline}>Offline — {pending} udalostí čaká na odoslanie.</Text>}

      {/* Zraz a poznámky */}
      {canManageTeam(me, match.event.team?.id) ? (
        <View style={styles.meetBox}>
          <Text style={styles.meetLabel}>Čas zrazu (HH:MM)</Text>
          <TextInput
            style={styles.meetInput}
            value={meetDraft}
            onChangeText={setMeetDraft}
            placeholder="napr. 15:30"
            keyboardType="numbers-and-punctuation"
          />
          <Text style={[styles.meetLabel, { marginTop: 8 }]}>Poznámky k zápasu</Text>
          <TextInput
            style={[styles.meetInput, styles.meetNotesInput]}
            value={notesDraft}
            onChangeText={setNotesDraft}
            placeholder="výstroj, doprava, zraz pri klubovni…"
            multiline
          />
          <Text style={[styles.meetLabel, { marginTop: 8 }]}>Dres</Text>
          <View style={styles.jerseyRow}>
            <Pressable
              style={[styles.jerseyChip, match.jerseyColor === 'DARK' && styles.jerseyChipActive]}
              onPress={() => setJersey(match.jerseyColor === 'DARK' ? null : 'DARK')}
            >
              <JerseySwatch color="DARK" />
              <Text style={styles.jerseyChipText}>Tmavý</Text>
            </Pressable>
            <Pressable
              style={[styles.jerseyChip, match.jerseyColor === 'LIGHT' && styles.jerseyChipActive]}
              onPress={() => setJersey(match.jerseyColor === 'LIGHT' ? null : 'LIGHT')}
            >
              <JerseySwatch color="LIGHT" />
              <Text style={styles.jerseyChipText}>Svetlý</Text>
            </Pressable>
          </View>
          <Pressable
            style={[styles.saveScoreBtn, detailsBusy && { opacity: 0.5 }, { alignSelf: 'flex-end', marginTop: 8 }]}
            onPress={saveDetails}
            disabled={detailsBusy}
          >
            <Text style={styles.saveScoreText}>{detailsBusy ? 'Ukladám…' : 'Uložiť zraz a poznámky'}</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.meetBox}>
          <Text style={styles.meetLine}>
            <Text style={styles.meetLabel}>Zraz: </Text>
            {formatEventTimeSk(match.meetAt ?? new Date(new Date(match.event.startAt).getTime() - 3_600_000))}
          </Text>
          {match.jerseyColor ? (
            <View style={styles.jerseyLine}>
              <Text style={styles.meetLabel}>Dres: </Text>
              <JerseySwatch color={match.jerseyColor} />
              <Text style={styles.meetNotes}>{match.jerseyColor === 'DARK' ? 'tmavý' : 'svetlý'}</Text>
            </View>
          ) : null}
          {match.notes ? (
            <Text style={styles.meetNotes}>
              <Text style={styles.meetLabel}>Poznámky: </Text>
              {match.notes}
            </Text>
          ) : null}
        </View>
      )}

      {/* Video a fotky zo zápasu — po spustení/ukončení */}
      {(match.state === 'LIVE' || match.state === 'FINISHED') && (
        <View style={styles.meetBox}>
          <Text style={styles.sectionTitle}>Video a fotky zo zápasu</Text>
          {canControl ? (
            <>
              <Text style={styles.meetLabel}>Odkaz na video (napr. Veo)</Text>
              <TextInput
                style={styles.meetInput}
                value={videoDraft}
                onChangeText={setVideoDraft}
                placeholder="https://app.veo.co/matches/…"
                autoCapitalize="none"
                keyboardType="url"
              />
              <View style={styles.videoBtnRow}>
                <Pressable
                  style={[styles.saveScoreBtn, videoBusy && { opacity: 0.5 }]}
                  onPress={() => saveVideo(videoDraft.trim() || null)}
                  disabled={videoBusy}
                >
                  <Text style={styles.saveScoreText}>{videoBusy ? 'Ukladám…' : 'Uložiť odkaz'}</Text>
                </Pressable>
                <Pressable
                  style={[styles.primaryBtnSmall, veoBusy && { opacity: 0.5 }]}
                  onPress={findVeoVideo}
                  disabled={veoBusy}
                >
                  <Text style={styles.primaryBtnText}>{veoBusy ? 'Hľadám…' : 'Nájsť video (Veo)'}</Text>
                </Pressable>
              </View>
            </>
          ) : null}

          {match.videoUrl ? (
            <Pressable onPress={() => Linking.openURL(match.videoUrl!)}>
              <Text style={styles.videoLink}>▶ Pozrieť video zo zápasu</Text>
            </Pressable>
          ) : !canControl ? (
            <Text style={styles.empty}>Video zatiaľ nie je pridané.</Text>
          ) : null}

          <View style={styles.photosHeader}>
            <Text style={styles.meetLabel}>Fotky ({match.photos.length})</Text>
            {canControl && (
              <Pressable onPress={addPhoto} disabled={photoBusy}>
                <Text style={styles.videoLink}>{photoBusy ? 'Nahrávam…' : '+ Pridať fotku'}</Text>
              </Pressable>
            )}
          </View>
          {match.photos.length ? (
            <View style={styles.photoGrid}>
              {match.photos.map((p) => (
                <Pressable
                  key={p.id}
                  onPress={() => Linking.openURL(`${API_URL}/matches/photos/${p.id}`)}
                  onLongPress={canControl ? () => confirmDeletePhoto(p.id) : undefined}
                >
                  <Image source={{ uri: `${API_URL}/matches/photos/${p.id}` }} style={styles.photoThumb} />
                </Pressable>
              ))}
            </View>
          ) : (
            <Text style={styles.empty}>Zatiaľ žiadne fotky.</Text>
          )}
          {canControl && match.photos.length > 0 && (
            <Text style={styles.photoHint}>Podržaním fotky ju zmažete.</Text>
          )}
        </View>
      )}

      {/* editovateľný výsledok */}
      {recording && canControl && (
        <View style={styles.scoreEditRow}>
          <View style={styles.scoreEditCol}>
            <Text style={styles.scoreEditLabel}>Domáci</Text>
            <TextInput
              style={styles.numInput}
              keyboardType="number-pad"
              value={match.isHome ? scoreUs : scoreThem}
              onChangeText={match.isHome ? setScoreUs : setScoreThem}
            />
          </View>
          <Text style={styles.scoreColon}>:</Text>
          <View style={styles.scoreEditCol}>
            <Text style={styles.scoreEditLabel}>Hostia</Text>
            <TextInput
              style={styles.numInput}
              keyboardType="number-pad"
              value={match.isHome ? scoreThem : scoreUs}
              onChangeText={match.isHome ? setScoreThem : setScoreUs}
            />
          </View>
          <Pressable style={styles.saveScoreBtn} onPress={saveScore}>
            <Text style={styles.saveScoreText}>Uložiť</Text>
          </Pressable>
        </View>
      )}

      {canControl && (
        <View style={styles.buttonRow}>
          {match.state === 'PLANNED' && (
            <Pressable style={styles.primaryBtn} onPress={() => setState('LIVE')}>
              <Text style={styles.primaryBtnText}>Začať zápas</Text>
            </Pressable>
          )}
          {match.state === 'LIVE' && (
            <Pressable style={[styles.primaryBtn, { backgroundColor: colors.danger }]} onPress={() => setState('FINISHED')}>
              <Text style={styles.primaryBtnText}>Ukončiť zápas</Text>
            </Pressable>
          )}
          {match.state === 'FINISHED' && (
            <Pressable style={styles.secondaryBtn} onPress={() => setState('LIVE')}>
              <Text style={styles.secondaryBtnText}>Znovu otvoriť</Text>
            </Pressable>
          )}
          <Link href={`/match/${id}/nomination`} asChild>
            <Pressable style={styles.secondaryBtn}>
              <Text style={styles.secondaryBtnText}>Nominácia</Text>
            </Pressable>
          </Link>
        </View>
      )}

      {/* Náhľad nominácie pre rodiča/hráča (bez riadenia zápasu) */}
      {!canControl && (
        <View style={styles.nomBox}>
          <Text style={styles.sectionTitle}>Nominácia</Text>
          {myChildren.length > 0 &&
            myChildren.map((c) => {
              const nominated = match.nominations.some((n) => n.member.id === c.id);
              return (
                <View key={c.id} style={styles.nomChildRow}>
                  <Text style={styles.playerName}>
                    {c.lastName} {c.firstName}
                  </Text>
                  <Text style={[styles.nomBadge, nominated ? styles.nomYes : styles.nomNo]}>
                    {nominated ? 'V nominácii ✓' : 'Nie je v nominácii'}
                  </Text>
                </View>
              );
            })}
          {match.nominations.length === 0 ? (
            <Text style={styles.empty}>Nominácia zatiaľ nebola zverejnená.</Text>
          ) : (
            match.nominations.map((n) => {
              const mine = myChildren.some((c) => c.id === n.member.id);
              return (
                <View key={n.id} style={[styles.playerRow, mine && styles.playerRowSelected]}>
                  <Text style={styles.playerName}>
                    {n.member.lastName} {n.member.firstName}
                  </Text>
                  {mine && <Text style={styles.check}>✓</Text>}
                </View>
              );
            })
          )}
        </View>
      )}

      {recording && canControl && (
        <>
          {/* minúta + nadstavenie */}
          <View style={styles.minuteRow}>
            <View style={styles.minuteCol}>
              <Text style={styles.minuteLabel}>Minúta</Text>
              <TextInput
                style={styles.numInput}
                keyboardType="number-pad"
                value={minute}
                onChangeText={setMinute}
              />
            </View>
            <Text style={styles.plus}>+</Text>
            <View style={styles.minuteCol}>
              <Text style={styles.minuteLabel}>Nadstavenie</Text>
              <TextInput
                style={styles.numInput}
                keyboardType="number-pad"
                value={stoppage}
                onChangeText={setStoppage}
                placeholder="0"
              />
            </View>
          </View>

          {selected && (
            <Text style={styles.selectedHint}>
              Vybraný: {selected.member.lastName} — ťuknite na akciu hráča
            </Text>
          )}
          <View style={styles.actionsGrid}>
            {PLAYER_ACTIONS.map((t) => (
              <Pressable key={t} style={styles.actionBtn} onPress={() => record(t, true)}>
                <Text style={styles.actionText}>{eventLabels[t]}</Text>
              </Pressable>
            ))}
            {TEAM_ACTIONS.map((t) => (
              <Pressable key={t} style={[styles.actionBtn, styles.teamActionBtn]} onPress={() => record(t, false)}>
                <Text style={styles.actionText}>{eventLabels[t]}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.sectionTitle}>Hráč — ťuknutím vyberte</Text>
          <FlatList
            data={match.nominations}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            ListEmptyComponent={<Text style={styles.empty}>Najprv pridajte hráčov cez „Nominácia".</Text>}
            renderItem={({ item }) => (
              <Pressable
                style={[styles.playerRow, selected?.id === item.id && styles.playerRowSelected]}
                onPress={() => setSelected(selected?.id === item.id ? null : item)}
              >
                <Text style={styles.playerName}>
                  {item.member.lastName} {item.member.firstName}
                </Text>
                {selected?.id === item.id && <Text style={styles.check}>✓</Text>}
              </Pressable>
            )}
          />
        </>
      )}

      <Text style={styles.sectionTitle}>Priebeh zápasu</Text>
      {match.events.length === 0 && <Text style={styles.empty}>Zatiaľ žiadne udalosti.</Text>}
      {match.events.map((e) => (
        <View key={e.id} style={styles.logRow}>
          <Text style={styles.logMinute}>{fmtMinute(e.minute, e.stoppage)}'</Text>
          <Text style={styles.logText}>
            {eventLabels[e.type] ?? e.type}
            {e.member ? ` — ${e.member.lastName}` : ''}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.club50, padding: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: '600', color: colors.club900, textAlign: 'center' },
  score: { fontSize: 48, fontWeight: '800', color: colors.club800, textAlign: 'center', marginVertical: 4 },
  stateText: { textAlign: 'center', color: colors.club600, fontWeight: '700', marginBottom: 12 },
  offline: { backgroundColor: '#fef3c7', color: '#92400e', padding: 8, borderRadius: 6, marginBottom: 8, fontSize: 13 },
  meetBox: {
    backgroundColor: colors.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.club100,
    padding: 12,
    marginBottom: 12,
    gap: 4,
  },
  meetLine: { fontSize: 15, color: colors.club900 },
  meetNotes: { fontSize: 14, color: colors.club800 },
  meetLabel: { color: colors.gray },
  meetInput: {
    borderWidth: 1,
    borderColor: colors.club100,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 15,
    marginTop: 4,
    backgroundColor: colors.club50,
  },
  meetNotesInput: { minHeight: 64, textAlignVertical: 'top' },
  jerseyRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  jerseyLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  jerseyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.club100,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  jerseyChipActive: { borderColor: colors.club600, backgroundColor: colors.club50 },
  jerseyChipText: { color: colors.club900, fontWeight: '600', fontSize: 13 },
  videoBtnRow: { flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  primaryBtnSmall: { backgroundColor: colors.club600, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  videoLink: { color: colors.club600, fontWeight: '700', marginTop: 8 },
  photosHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  photoThumb: { width: 72, height: 72, borderRadius: 6, backgroundColor: colors.club100 },
  photoHint: { color: colors.gray, fontSize: 11, marginTop: 6 },
  scoreEditRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 8, marginBottom: 14 },
  scoreEditCol: { alignItems: 'center' },
  scoreEditLabel: { fontSize: 11, color: colors.gray, marginBottom: 2 },
  scoreColon: { fontSize: 20, fontWeight: '800', color: colors.gray, paddingBottom: 8 },
  saveScoreBtn: {
    backgroundColor: colors.club100,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignSelf: 'flex-end',
  },
  saveScoreText: { color: colors.club800, fontWeight: '700' },
  buttonRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  primaryBtn: { flex: 1, backgroundColor: colors.club600, borderRadius: 8, padding: 14, alignItems: 'center' },
  primaryBtnText: { color: colors.white, fontWeight: '700' },
  secondaryBtn: {
    flex: 1,
    borderColor: colors.club600,
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  secondaryBtnText: { color: colors.club600, fontWeight: '700' },
  minuteRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 12, marginBottom: 12 },
  minuteCol: { alignItems: 'center' },
  minuteLabel: { fontSize: 11, color: colors.gray, marginBottom: 2 },
  plus: { fontSize: 22, fontWeight: '800', color: colors.gray, paddingBottom: 8 },
  numInput: {
    width: 72,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.club100,
    borderRadius: 8,
    paddingVertical: 8,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    color: colors.club900,
  },
  selectedHint: { textAlign: 'center', color: colors.club700, marginBottom: 8, fontSize: 13 },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  actionBtn: {
    flexBasis: '48%',
    flexGrow: 1,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.club100,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  teamActionBtn: { backgroundColor: colors.club50 },
  actionText: { fontWeight: '700', color: colors.club900, fontSize: 13 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.club800, marginTop: 8, marginBottom: 8 },
  playerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.club100,
    padding: 12,
    marginBottom: 6,
  },
  playerRowSelected: { borderColor: colors.club600, backgroundColor: colors.club100 },
  playerName: { fontWeight: '600', color: colors.club900 },
  check: { color: colors.club600, fontWeight: '800' },
  nomBox: { marginBottom: 8 },
  nomChildRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.club600,
    padding: 12,
    marginBottom: 8,
  },
  nomBadge: { fontSize: 12, fontWeight: '700', borderRadius: 6, paddingVertical: 3, paddingHorizontal: 8, overflow: 'hidden' },
  nomYes: { backgroundColor: '#dcfce7', color: '#166534' },
  nomNo: { backgroundColor: '#f3f4f6', color: '#6b7280' },
  logRow: { flexDirection: 'row', gap: 12, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.club100 },
  logMinute: { width: 44, fontWeight: '700', color: colors.club600 },
  logText: { color: colors.club900 },
  empty: { color: colors.gray, fontSize: 13 },
});
