import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '@/api';
import { colors } from '@/theme';

interface Task {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  done: boolean;
  doneByName: string | null;
  createdByName: string | null;
  assigneeName: string | null;
  assigneeRole: string | null;
  createdAt: string;
  commentCount: number;
  canComplete: boolean;
  canDelete: boolean;
}
interface Assignee {
  userId: string;
  name: string;
  roles: string[];
}
interface Comment {
  id: string;
  body: string;
  authorName: string;
  createdAt: string;
}

const ROLE_LABELS: Record<string, string> = { ADMIN: 'Admin', MANAGER: 'Vedúci klubu', COACH: 'Tréneri' };
const ROLE_OPTIONS = ['ADMIN', 'MANAGER', 'COACH'] as const;

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('sk-SK', { timeZone: 'UTC' });
}
function assigneeLabel(t: Task) {
  if (t.assigneeName) return t.assigneeName;
  if (t.assigneeRole) return ROLE_LABELS[t.assigneeRole] ?? t.assigneeRole;
  return 'Ktokoľvek';
}

export default function TasksScreen() {
  const insets = useSafeAreaInsets();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [creating, setCreating] = useState(false);
  const [commentsFor, setCommentsFor] = useState<Task | null>(null);

  const load = useCallback(async () => {
    try {
      setTasks(await api<Task[]>('/tasks'));
    } catch (e) {
      Alert.alert('Chyba', e instanceof Error ? e.message : 'Načítanie zlyhalo');
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function toggle(t: Task) {
    if (!t.canComplete) {
      Alert.alert('Nemožné', 'Označiť úlohu za splnenú môže len jej zadávateľ.');
      return;
    }
    setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)));
    try {
      await api(`/tasks/${t.id}/done`, { method: 'POST', body: JSON.stringify({ done: !t.done }) });
      await load();
    } catch {
      await load();
    }
  }

  function remove(t: Task) {
    Alert.alert('Odstrániť úlohu', t.done ? `Odstrániť „${t.title}"?` : 'Úloha ešte nie je dokončená, naozaj odstrániť?', [
      { text: 'Zrušiť', style: 'cancel' },
      {
        text: 'Odstrániť',
        style: 'destructive',
        onPress: async () => {
          try {
            await api(`/tasks/${t.id}`, { method: 'DELETE' });
            await load();
          } catch (e) {
            Alert.alert('Chyba', e instanceof Error ? e.message : 'Odstránenie zlyhalo');
          }
        },
      },
    ]);
  }

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + 8 }]}>
      <Pressable style={styles.newBtn} onPress={() => setCreating(true)}>
        <Text style={styles.newBtnText}>＋ Nová úloha</Text>
      </Pressable>

      <FlatList
        data={tasks}
        keyExtractor={(t) => t.id}
        contentContainerStyle={{ paddingBottom: 16 }}
        ListEmptyComponent={<Text style={styles.empty}>Žiadne úlohy.</Text>}
        renderItem={({ item: t }) => {
          const overdue = !t.done && t.dueDate && new Date(t.dueDate) < new Date(new Date().toDateString());
          return (
            <View style={[styles.card, t.done && styles.cardDone]}>
              <Pressable style={[styles.checkbox, !t.canComplete && styles.checkboxDisabled]} onPress={() => toggle(t)}>
                <Text style={styles.checkboxMark}>{t.done ? '✓' : ''}</Text>
              </Pressable>
              <View style={styles.cardBody}>
                <Text style={[styles.title, t.done && styles.titleDone]}>{t.title}</Text>
                {t.description ? <Text style={styles.desc}>{t.description}</Text> : null}
                <View style={styles.metaRow}>
                  <Text style={styles.metaChip}>👤 {assigneeLabel(t)}</Text>
                  {t.dueDate ? (
                    <Text style={[styles.meta, overdue && styles.metaOverdue]}>
                      📅 do {fmtDate(t.dueDate)}
                      {overdue ? ' · po termíne' : ''}
                    </Text>
                  ) : null}
                  <Text style={styles.metaLink} onPress={() => setCommentsFor(t)}>
                    💬 Komentáre{t.commentCount > 0 ? ` (${t.commentCount})` : ''}
                  </Text>
                </View>
                {t.createdByName ? <Text style={styles.metaSmall}>zadal: {t.createdByName}</Text> : null}
              </View>
              {t.canDelete ? (
                <Pressable onPress={() => remove(t)} hitSlop={8}>
                  <Text style={styles.remove}>✕</Text>
                </Pressable>
              ) : null}
            </View>
          );
        }}
      />

      <Modal visible={creating} animationType="slide" onRequestClose={() => setCreating(false)}>
        <TaskForm onClose={() => setCreating(false)} onDone={() => { setCreating(false); void load(); }} />
      </Modal>

      <Modal visible={!!commentsFor} animationType="slide" onRequestClose={() => setCommentsFor(null)}>
        {commentsFor && (
          <CommentsPane task={commentsFor} onClose={() => { setCommentsFor(null); void load(); }} />
        )}
      </Modal>
    </View>
  );
}

function TaskForm({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [mode, setMode] = useState<'function' | 'member'>('function');
  const [assigneeRole, setAssigneeRole] = useState<string>('COACH');
  const [assigneeUserId, setAssigneeUserId] = useState('');
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<Assignee[]>('/tasks/assignees').then(setAssignees).catch(() => {});
  }, []);

  async function submit() {
    if (!title.trim()) {
      Alert.alert('Chýba názov', 'Zadajte názov úlohy.');
      return;
    }
    if (mode === 'member' && !assigneeUserId) {
      Alert.alert('Chýba člen', 'Vyberte konkrétneho člena.');
      return;
    }
    setBusy(true);
    try {
      await api('/tasks', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          dueDate: dueDate.trim() || undefined,
          assigneeUserId: mode === 'member' ? assigneeUserId : undefined,
          assigneeRole: mode === 'function' ? assigneeRole : undefined,
        }),
      });
      onDone();
    } catch (e) {
      Alert.alert('Chyba', e instanceof Error ? e.message : 'Uloženie zlyhalo');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={styles.formScroll} contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}>
      <Text style={styles.formTitle}>Nová úloha</Text>

      <Text style={styles.label}>Názov</Text>
      <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Napr. Objednať dresy" />

      <Text style={styles.label}>Popis (nepovinné)</Text>
      <TextInput
        style={[styles.input, styles.inputMultiline]}
        value={description}
        onChangeText={setDescription}
        multiline
      />

      <Text style={styles.label}>Kto má splniť</Text>
      <View style={styles.segRow}>
        <Pressable style={[styles.seg, mode === 'function' && styles.segActive]} onPress={() => setMode('function')}>
          <Text style={[styles.segText, mode === 'function' && styles.segTextActive]}>Funkcia</Text>
        </Pressable>
        <Pressable style={[styles.seg, mode === 'member' && styles.segActive]} onPress={() => setMode('member')}>
          <Text style={[styles.segText, mode === 'member' && styles.segTextActive]}>Konkrétny člen</Text>
        </Pressable>
      </View>

      {mode === 'function' ? (
        <View style={styles.chipRow}>
          {ROLE_OPTIONS.map((r) => (
            <Pressable
              key={r}
              style={[styles.chip, assigneeRole === r && styles.chipActive]}
              onPress={() => setAssigneeRole(r)}
            >
              <Text style={[styles.chipText, assigneeRole === r && styles.chipTextActive]}>{ROLE_LABELS[r]}</Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <View style={styles.memberList}>
          {assignees.length === 0 && <Text style={styles.metaSmall}>Načítavam…</Text>}
          {assignees.map((a) => (
            <Pressable
              key={a.userId}
              style={[styles.memberItem, assigneeUserId === a.userId && styles.memberItemActive]}
              onPress={() => setAssigneeUserId(a.userId)}
            >
              <Text style={[styles.memberName, assigneeUserId === a.userId && styles.chipTextActive]}>
                {a.name} <Text style={styles.memberRoles}>({a.roles.map((x) => ROLE_LABELS[x] ?? x).join(', ')})</Text>
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      <Text style={styles.label}>Termín (nepovinné) — RRRR-MM-DD</Text>
      <TextInput style={styles.input} value={dueDate} onChangeText={setDueDate} placeholder="2026-08-31" autoCapitalize="none" />

      <View style={styles.formBtns}>
        <Pressable style={[styles.formBtn, styles.formBtnGhost]} onPress={onClose}>
          <Text style={styles.formBtnGhostText}>Zrušiť</Text>
        </Pressable>
        <Pressable style={[styles.formBtn, styles.formBtnPrimary]} onPress={submit} disabled={busy}>
          <Text style={styles.formBtnPrimaryText}>{busy ? 'Ukladám…' : 'Vytvoriť'}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function CommentsPane({ task, onClose }: { task: Task; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<Comment[]>(`/tasks/${task.id}/comments`).then(setComments).catch(() => {});
  }, [task.id]);
  useEffect(() => {
    load();
  }, [load]);

  async function add() {
    const body = text.trim();
    if (!body) return;
    setBusy(true);
    try {
      await api(`/tasks/${task.id}/comments`, { method: 'POST', body: JSON.stringify({ body }) });
      setText('');
      load();
    } catch (e) {
      Alert.alert('Chyba', e instanceof Error ? e.message : 'Nepodarilo sa pridať komentár');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + 8 }]}>
      <View style={styles.commentsHeader}>
        <Text style={styles.commentsTitle} numberOfLines={1}>
          {task.title}
        </Text>
        <Pressable onPress={onClose} hitSlop={8}>
          <Text style={styles.commentsClose}>Zavrieť</Text>
        </Pressable>
      </View>
      <FlatList
        data={comments}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ paddingBottom: 12 }}
        ListEmptyComponent={<Text style={styles.empty}>Zatiaľ žiadne komentáre.</Text>}
        renderItem={({ item: c }) => (
          <View style={styles.commentItem}>
            <Text style={styles.commentAuthor}>
              {c.authorName}{' '}
              <Text style={styles.commentTime}>{new Date(c.createdAt).toLocaleString('sk-SK')}</Text>
            </Text>
            <Text style={styles.commentBody}>{c.body}</Text>
          </View>
        )}
      />
      <View style={styles.commentInputRow}>
        <TextInput
          style={styles.commentInput}
          value={text}
          onChangeText={setText}
          placeholder="Napíšte komentár…"
          multiline
        />
        <Pressable style={styles.commentSend} onPress={add} disabled={busy || !text.trim()}>
          <Text style={styles.commentSendText}>Pridať</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.club50, padding: 16 },
  newBtn: { backgroundColor: colors.club600, borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginBottom: 12 },
  newBtnText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  empty: { color: colors.gray, textAlign: 'center', marginTop: 32 },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: colors.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.club100,
    padding: 12,
    marginBottom: 10,
  },
  cardDone: { opacity: 0.6 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.club600,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxDisabled: { borderColor: colors.club100, opacity: 0.6 },
  checkboxMark: { color: colors.club600, fontWeight: '900', fontSize: 15 },
  cardBody: { flex: 1 },
  title: { fontSize: 16, fontWeight: '700', color: colors.club900 },
  titleDone: { textDecorationLine: 'line-through' },
  desc: { color: colors.club900, fontSize: 14, marginTop: 2 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 6, alignItems: 'center' },
  metaChip: { backgroundColor: colors.club50, color: colors.club700, fontSize: 12, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, overflow: 'hidden' },
  meta: { color: colors.gray, fontSize: 12 },
  metaLink: { color: colors.club600, fontSize: 12, fontWeight: '600' },
  metaOverdue: { color: colors.danger, fontWeight: '700' },
  commentsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  commentsTitle: { fontSize: 18, fontWeight: '700', color: colors.club900, flex: 1 },
  commentsClose: { color: colors.club600, fontWeight: '600' },
  commentItem: {
    backgroundColor: colors.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.club100,
    padding: 10,
    marginBottom: 8,
  },
  commentAuthor: { fontWeight: '700', color: colors.club800, fontSize: 13 },
  commentTime: { fontWeight: '400', color: colors.gray, fontSize: 11 },
  commentBody: { color: colors.club900, marginTop: 2, fontSize: 15 },
  commentInputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  commentInput: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.club100,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 120,
  },
  commentSend: { backgroundColor: colors.club600, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12 },
  commentSendText: { color: colors.white, fontWeight: '700' },
  metaSmall: { color: colors.gray, fontSize: 11, marginTop: 4 },
  remove: { color: colors.gray, fontSize: 16, paddingHorizontal: 4 },
  // form
  formScroll: { flex: 1, backgroundColor: colors.club50 },
  formTitle: { fontSize: 20, fontWeight: '700', color: colors.club900, marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '600', color: colors.club800, marginTop: 12, marginBottom: 4 },
  input: {
    backgroundColor: colors.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.club100,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  inputMultiline: { minHeight: 70, textAlignVertical: 'top' },
  segRow: { flexDirection: 'row', gap: 8 },
  seg: { flex: 1, borderWidth: 1, borderColor: colors.club100, borderRadius: 8, paddingVertical: 8, alignItems: 'center', backgroundColor: colors.white },
  segActive: { backgroundColor: colors.club600, borderColor: colors.club600 },
  segText: { color: colors.club700, fontWeight: '600' },
  segTextActive: { color: colors.white },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: { borderWidth: 1, borderColor: colors.club100, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, backgroundColor: colors.white },
  chipActive: { backgroundColor: colors.club600, borderColor: colors.club600 },
  chipText: { color: colors.club700, fontWeight: '600' },
  chipTextActive: { color: colors.white },
  memberList: { marginTop: 8, gap: 6 },
  memberItem: { borderWidth: 1, borderColor: colors.club100, borderRadius: 8, padding: 10, backgroundColor: colors.white },
  memberItemActive: { borderColor: colors.club600, backgroundColor: colors.club50 },
  memberName: { color: colors.club900, fontWeight: '600' },
  memberRoles: { color: colors.gray, fontWeight: '400', fontSize: 12 },
  formBtns: { flexDirection: 'row', gap: 8, marginTop: 20 },
  formBtn: { flex: 1, borderRadius: 8, paddingVertical: 14, alignItems: 'center' },
  formBtnGhost: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.club100 },
  formBtnGhostText: { color: colors.club700, fontWeight: '700' },
  formBtnPrimary: { backgroundColor: colors.club600 },
  formBtnPrimaryText: { color: colors.white, fontWeight: '700' },
});
