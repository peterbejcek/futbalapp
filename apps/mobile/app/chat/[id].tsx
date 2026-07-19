import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { io, type Socket } from 'socket.io-client';
import { API_URL, api, getToken } from '@/api';
import { colors } from '@/theme';

interface Message {
  id: string;
  channelId?: string;
  body: string;
  createdAt: string;
  sender: { id: string; firstName: string; lastName: string };
}

function apiOrigin(): string {
  return new URL(API_URL).origin;
}

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
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
    });
    return () => {
      cancelled = true;
      socket?.disconnect();
    };
  }, [load, id]);

  async function send() {
    const body = text.trim();
    if (!body) return;
    setText('');
    try {
      const message = await api<Message>(`/chat/channels/${id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body }),
      });
      // WS broadcast mohol tú istú správu doručiť skôr — nepridávaj ju druhýkrát
      setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
      listRef.current?.scrollToEnd({ animated: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Odoslanie zlyhalo');
      setText(body); // vráť text, nech sa nestratí
    }
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
                {new Date(item.createdAt).toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </Text>
            <Text style={styles.body}>{item.body}</Text>
          </View>
        )}
      />
      <View style={styles.inputRow}>
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
});
