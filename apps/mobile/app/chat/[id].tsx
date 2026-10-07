import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { io, type Socket } from 'socket.io-client';
import { API_URL, api, getToken } from '@/api';
import { colors } from '@/theme';

interface Attachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
}
interface Message {
  id: string;
  channelId?: string;
  body: string;
  createdAt: string;
  sender: { id: string; firstName: string; lastName: string };
  attachment?: Attachment | null;
  replyTo?: { id: string; body: string; sender: { firstName: string; lastName: string }; attachment?: { filename: string } | null } | null;
}

function quoteText(r: { body: string; attachment?: { filename: string } | null }) {
  return r.body || (r.attachment ? `📎 ${r.attachment.filename}` : '');
}

interface PickedFile {
  uri: string;
  name: string;
  type: string;
}

function apiOrigin(): string {
  // origin bez cesty (napr. https://api.fkknv.sk); bez závislosti na URL API
  const m = API_URL.match(/^(https?:\/\/[^/]+)/);
  return m ? m[1]! : API_URL;
}

/** Lokálny čas „HH:MM" bez Intl (toLocaleTimeString s options padá na Android Hermes). */
function fmtTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [meId, setMeId] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const listRef = useRef<FlatList<Message>>(null);

  const load = useCallback(async () => {
    try {
      setMessages(await api<Message[]>(`/chat/channels/${id}/messages`));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Načítanie zlyhalo');
    }
  }, [id]);

  useEffect(() => {
    api<{ id: string }>('/auth/me')
      .then((me) => setMeId(me.id))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    void load();
    // realtime cez WebSocket namiesto pollingu
    let socket: Socket | null = null;
    let cancelled = false;
    void getToken().then((token) => {
      if (cancelled) return;
      socket = io(`${apiOrigin()}/chat`, { auth: { token }, transports: ['websocket'] });
      socket.emit('join', { channelId: id });
      socket.on('message', (message: Message) => {
        // striktne len správy tohto kanála (server posiela channelId vždy)
        if (message.channelId !== id) return;
        setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
        listRef.current?.scrollToEnd({ animated: true });
      });
      socket.on('messageDeleted', (p: { channelId: string; messageId: string }) => {
        if (p.channelId !== id) return;
        setMessages((prev) => prev.filter((m) => m.id !== p.messageId));
      });
    });
    return () => {
      cancelled = true;
      socket?.disconnect();
    };
  }, [load, id]);

  async function send() {
    const body = text.trim();
    if (!body) return;
    const replyToId = replyTo?.id;
    setText('');
    setReplyTo(null);
    try {
      const message = await api<Message>(`/chat/channels/${id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body, replyToId }),
      });
      // WS broadcast mohol tú istú správu doručiť skôr — nepridávaj ju druhýkrát
      setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
      listRef.current?.scrollToEnd({ animated: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Odoslanie zlyhalo');
      setText(body); // vráť text, nech sa nestratí
      if (replyToId) setReplyTo((cur) => cur ?? messages.find((m) => m.id === replyToId) ?? null);
    }
  }

  async function uploadFile(file: PickedFile) {
    try {
      const form = new FormData();
      // React Native FormData súbor
      form.append('file', { uri: file.uri, name: file.name, type: file.type } as unknown as Blob);
      const caption = text.trim();
      if (caption) form.append('body', caption);
      if (replyTo) form.append('replyToId', replyTo.id);
      setText('');
      setReplyTo(null);
      const token = await getToken();
      const res = await fetch(`${API_URL}/chat/channels/${id}/attachment`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(b.message ?? 'Nahranie zlyhalo');
      }
      const message = (await res.json()) as Message;
      setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
      listRef.current?.scrollToEnd({ animated: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nahranie zlyhalo');
    }
  }

  function confirmDelete(messageId: string) {
    Alert.alert('Vymazať správu', 'Naozaj chcete vymazať túto správu?', [
      { text: 'Zrušiť', style: 'cancel' },
      {
        text: 'Vymazať',
        style: 'destructive',
        onPress: async () => {
          try {
            await api(`/chat/messages/${messageId}`, { method: 'DELETE' });
            setMessages((prev) => prev.filter((m) => m.id !== messageId));
            setReplyTo((cur) => (cur?.id === messageId ? null : cur));
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Vymazanie zlyhalo');
          }
        },
      },
    ]);
  }

  function chooseAttachment() {
    Alert.alert('Priložiť', 'Vyberte typ prílohy', [
      { text: 'Fotka', onPress: pickImage },
      { text: 'Dokument', onPress: pickDocument },
      { text: 'Zrušiť', style: 'cancel' },
    ]);
  }

  async function pickImage() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Prístup zamietnutý', 'Povoľte prístup k fotkám v nastaveniach.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    await uploadFile({
      uri: a.uri,
      name: a.fileName ?? `fotka-${Date.now()}.jpg`,
      type: a.mimeType ?? 'image/jpeg',
    });
  }

  async function pickDocument() {
    const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    await uploadFile({ uri: a.uri, name: a.name ?? 'dokument', type: a.mimeType ?? 'application/octet-stream' });
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      {error && <Text style={styles.error}>{error}</Text>}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={<Text style={styles.empty}>Zatiaľ žiadne správy — napíšte prvú!</Text>}
        renderItem={({ item }) => (
          <View style={styles.message}>
            <Text style={styles.sender}>
              {item.sender.firstName} {item.sender.lastName}
              <Text style={styles.time}>
                {'  '}
                {fmtTime(item.createdAt)}
              </Text>
            </Text>
            {item.replyTo ? (
              <View style={styles.quote}>
                <Text style={styles.quoteName}>
                  {item.replyTo.sender.firstName} {item.replyTo.sender.lastName}
                </Text>
                <Text style={styles.quoteText} numberOfLines={2}>
                  {quoteText(item.replyTo)}
                </Text>
              </View>
            ) : null}
            {item.body ? <Text style={styles.body}>{item.body}</Text> : null}
            {item.attachment ? <MessageAttachment att={item.attachment} /> : null}
            <View style={styles.actions}>
              <Pressable onPress={() => setReplyTo(item)} hitSlop={8}>
                <Text style={styles.actionText}>Odpovedať</Text>
              </Pressable>
              {meId === item.sender.id ? (
                <Pressable onPress={() => confirmDelete(item.id)} hitSlop={8}>
                  <Text style={[styles.actionText, { color: colors.danger }]}>Vymazať</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        )}
      />
      {replyTo ? (
        <View style={styles.replyBar}>
          <View style={{ flex: 1 }}>
            <Text style={styles.quoteName}>
              Odpoveď pre {replyTo.sender.firstName} {replyTo.sender.lastName}
            </Text>
            <Text style={styles.quoteText} numberOfLines={1}>
              {quoteText(replyTo)}
            </Text>
          </View>
          <Pressable onPress={() => setReplyTo(null)} hitSlop={8}>
            <Text style={styles.actionText}>✕</Text>
          </Pressable>
        </View>
      ) : null}
      <View style={[styles.inputRow, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable style={styles.attachBtn} onPress={chooseAttachment}>
          <Text style={styles.attachText}>📎</Text>
        </Pressable>
        <TextInput
          style={styles.input}
          placeholder="Napíšte správu…"
          value={text}
          onChangeText={setText}
          multiline
        />
        <Pressable style={styles.sendBtn} onPress={send}>
          <Text style={styles.sendText}>➤</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function MessageAttachment({ att }: { att: Attachment }) {
  const url = `${API_URL}/chat/attachments/${att.id}`;
  if (att.mimeType.startsWith('image/')) {
    return (
      <Pressable onPress={() => Linking.openURL(url)}>
        <Image source={{ uri: url }} style={styles.attachImage} resizeMode="cover" />
      </Pressable>
    );
  }
  return (
    <Pressable style={styles.docChip} onPress={() => Linking.openURL(url)}>
      <Text style={styles.docText}>📎 {att.filename}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.club50 },
  error: { color: colors.danger, padding: 8, textAlign: 'center' },
  empty: { color: colors.gray, textAlign: 'center', marginTop: 32 },
  message: {
    backgroundColor: colors.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.club100,
    padding: 10,
    marginBottom: 8,
  },
  sender: { fontWeight: '700', color: colors.club800, fontSize: 13 },
  time: { fontWeight: '400', color: colors.gray, fontSize: 11 },
  body: { color: colors.club900, marginTop: 2, fontSize: 15 },
  quote: {
    borderLeftWidth: 3,
    borderLeftColor: colors.club600,
    backgroundColor: colors.club50,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 4,
    borderRadius: 4,
  },
  quoteName: { fontWeight: '700', color: colors.club800, fontSize: 12 },
  quoteText: { color: colors.gray, fontSize: 13 },
  actions: { flexDirection: 'row', gap: 16, marginTop: 6 },
  actionText: { color: colors.club600, fontSize: 12, fontWeight: '600' },
  replyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.club50,
    borderTopWidth: 1,
    borderTopColor: colors.club100,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    padding: 12,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.club100,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.club100,
    borderRadius: 8,
    padding: 10,
    maxHeight: 100,
    fontSize: 15,
  },
  sendBtn: {
    backgroundColor: colors.club600,
    borderRadius: 8,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendText: { color: colors.white, fontSize: 18 },
  attachBtn: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.club100,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  attachText: { fontSize: 20 },
  attachImage: { width: 200, height: 200, borderRadius: 8, marginTop: 6, backgroundColor: colors.club50 },
  docChip: {
    marginTop: 6,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.club100,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.club50,
  },
  docText: { color: colors.club700, fontSize: 14 },
});
