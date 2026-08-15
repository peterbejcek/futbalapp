import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { WEEKDAY_SHORT_SK } from '@fkknv/shared';
import { api } from '@/api';
import { coachTeams, fetchMe, isStaff, type Me } from '@/auth';
import { colors } from '@/theme';

interface Team {
  id: string;
  name: string;
  teamCategory: { code: string };
}

type Mode = 'training' | 'match';

export default function NewEventScreen() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [mode, setMode] = useState<Mode>('training');
  const [recurring, setRecurring] = useState(true);
  const [teamId, setTeamId] = useState('');
  const [title, setTitle] = useState('Tréning');
  const [location, setLocation] = useState('');
  const [weekdays, setWeekdays] = useState<number[]>([2, 5]);
  const [startTime, setStartTime] = useState('16:00');
  const [endTime, setEndTime] = useState('17:00');
  const [from, setFrom] = useState('');
  const [until, setUntil] = useState('');
  const [date, setDate] = useState('');
  const [opponent, setOpponent] = useState('');
  const [isHome, setIsHome] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchMe().then(setMe).catch(() => {});
    api<Team[]>('/seasons/teams').then(setTeams).catch(() => {});
  }, []);

  const myTeams = useMemo(() => {
    if (isStaff(me)) return teams;
    const ids = new Set(coachTeams(me).map((t) => t.id));
    return teams.filter((t) => ids.has(t.id));
  }, [teams, me]);

  useEffect(() => {
    if (myTeams[0] && !teamId) setTeamId(myTeams[0].id);
  }, [myTeams, teamId]);

  function toggleDay(d: number) {
    setWeekdays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  }

  async function submit() {
    setBusy(true);
    try {
      if (mode === 'training' && recurring) {
        await api('/events/recurring', {
          method: 'POST',
          body: JSON.stringify({ title, teamId, weekdays, startTime, endTime, from, until, location: location || undefined }),
        });
      } else if (mode === 'training') {
        await api('/events', {
          method: 'POST',
          body: JSON.stringify({ type: 'TRAINING', title, teamId, startAt: `${date}T${startTime}:00.000Z`, location: location || undefined }),
        });
      } else {
        const team = teams.find((t) => t.id === teamId);
        await api('/events', {
          method: 'POST',
          body: JSON.stringify({
            type: 'MATCH',
            title: isHome ? `${team?.name} vs ${opponent}` : `${opponent} vs ${team?.name}`,
            teamId,
            startAt: `${date}T${startTime}:00.000Z`,
            location: location || undefined,
            opponent,
            isHome,
          }),
        });
      }
      Alert.alert('Hotovo', 'Udalosť bola vytvorená.');
      router.back();
    } catch (e) {
      Alert.alert('Chyba', e instanceof Error ? e.message : 'Uloženie zlyhalo');
    } finally {
      setBusy(false);
    }
  }

  const chip = (active: boolean) => [styles.chip, active && styles.chipActive];
  const chipTxt = (active: boolean) => [styles.chipText, active && styles.chipTextActive];

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.row}>
        <Pressable style={chip(mode === 'training')} onPress={() => setMode('training')}>
          <Text style={chipTxt(mode === 'training')}>Tréning</Text>
        </Pressable>
        <Pressable style={chip(mode === 'match')} onPress={() => setMode('match')}>
          <Text style={chipTxt(mode === 'match')}>Zápas</Text>
        </Pressable>
      </View>

      <Text style={styles.label}>Družstvo</Text>
      <View style={styles.wrapRow}>
        {myTeams.map((t) => (
          <Pressable key={t.id} style={chip(teamId === t.id)} onPress={() => setTeamId(t.id)}>
            <Text style={chipTxt(teamId === t.id)}>{t.name}</Text>
          </Pressable>
        ))}
      </View>

      {mode === 'training' ? (
        <>
          <View style={[styles.row, { marginTop: 12 }]}>
            <Pressable style={chip(recurring)} onPress={() => setRecurring(true)}>
              <Text style={chipTxt(recurring)}>Opakovaný</Text>
            </Pressable>
            <Pressable style={chip(!recurring)} onPress={() => setRecurring(false)}>
              <Text style={chipTxt(!recurring)}>Jednorazový</Text>
            </Pressable>
          </View>
          <Text style={styles.label}>Názov</Text>
          <TextInput style={styles.input} value={title} onChangeText={setTitle} />
          {recurring ? (
            <>
              <Text style={styles.label}>Dni v týždni</Text>
              <View style={styles.wrapRow}>
                {WEEKDAY_SHORT_SK.map((lbl, i) => (
                  <Pressable key={i} style={chip(weekdays.includes(i))} onPress={() => toggleDay(i)}>
                    <Text style={chipTxt(weekdays.includes(i))}>{lbl}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.label}>Od (RRRR-MM-DD)</Text>
              <TextInput style={styles.input} value={from} onChangeText={setFrom} placeholder="2026-09-01" />
              <Text style={styles.label}>Do (RRRR-MM-DD)</Text>
              <TextInput style={styles.input} value={until} onChangeText={setUntil} placeholder="2026-12-20" />
            </>
          ) : (
            <>
              <Text style={styles.label}>Dátum (RRRR-MM-DD)</Text>
              <TextInput style={styles.input} value={date} onChangeText={setDate} placeholder="2026-09-05" />
            </>
          )}
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Začiatok</Text>
              <TextInput style={styles.input} value={startTime} onChangeText={setStartTime} placeholder="16:00" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Koniec</Text>
              <TextInput style={styles.input} value={endTime} onChangeText={setEndTime} placeholder="17:00" />
            </View>
          </View>
        </>
      ) : (
        <>
          <View style={styles.row}>
            <Pressable style={chip(isHome)} onPress={() => setIsHome(true)}>
              <Text style={chipTxt(isHome)}>Doma</Text>
            </Pressable>
            <Pressable style={chip(!isHome)} onPress={() => setIsHome(false)}>
              <Text style={chipTxt(!isHome)}>Vonku</Text>
            </Pressable>
          </View>
          <Text style={styles.label}>Súper</Text>
          <TextInput style={styles.input} value={opponent} onChangeText={setOpponent} />
          <Text style={styles.label}>Dátum (RRRR-MM-DD)</Text>
          <TextInput style={styles.input} value={date} onChangeText={setDate} placeholder="2026-09-12" />
          <Text style={styles.label}>Čas</Text>
          <TextInput style={styles.input} value={startTime} onChangeText={setStartTime} placeholder="10:00" />
        </>
      )}

      <Text style={styles.label}>Miesto</Text>
      <TextInput style={styles.input} value={location} onChangeText={setLocation} placeholder="Ihrisko KNV" />

      <Pressable style={[styles.submit, busy && { opacity: 0.6 }]} onPress={submit} disabled={busy || !teamId}>
        <Text style={styles.submitText}>{busy ? 'Ukladám…' : 'Vytvoriť'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.club50, padding: 16 },
  row: { flexDirection: 'row', gap: 8 },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  label: { fontSize: 13, fontWeight: '600', color: colors.club800, marginTop: 12, marginBottom: 4 },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.club100,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
  },
  chip: { borderWidth: 1, borderColor: colors.club100, borderRadius: 20, paddingVertical: 8, paddingHorizontal: 14, backgroundColor: colors.white },
  chipActive: { backgroundColor: colors.club600, borderColor: colors.club600 },
  chipText: { color: colors.club700, fontWeight: '600', fontSize: 13 },
  chipTextActive: { color: colors.white },
  submit: { backgroundColor: colors.club600, borderRadius: 8, padding: 16, alignItems: 'center', marginTop: 24 },
  submitText: { color: colors.white, fontWeight: '700', fontSize: 16 },
});
