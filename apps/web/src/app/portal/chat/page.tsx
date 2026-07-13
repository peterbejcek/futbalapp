'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';

interface Channel {
  id: string;
  type: string;
  name: string;
  categoryCode: string | null;
  lastMessage: { body: string; createdAt: string } | null;
}

interface Message {
  id: string;
  body: string;
  createdAt: string;
  sender: { id: string; firstName: string; lastName: string };
}

const POLL_MS = 5000;

export default function ChatPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api<Channel[]>('/chat/channels')
      .then((list) => {
        setChannels(list);
        if (list.length > 0) setActiveId((current) => current ?? list[0]!.id);
      })
      .catch((e) => setError(e.message));
  }, []);

  const loadMessages = useCallback(async () => {
    if (!activeId) return;
    try {
      setMessages(await api<Message[]>(`/chat/channels/${activeId}/messages`));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Načítanie zlyhalo');
    }
  }, [activeId]);

  useEffect(() => {
    void loadMessages();
    const timer = setInterval(loadMessages, POLL_MS);
    return () => clearInterval(timer);
  }, [loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || !activeId) return;
    setText('');
    try {
      const message = await api<Message>(`/chat/channels/${activeId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body }),
      });
      setMessages((prev) => [...prev, message]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Odoslanie zlyhalo');
      setText(body);
    }
  }

  const active = channels.find((c) => c.id === activeId);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-club-900">Komunikácia</h1>
      {error && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <aside className="rounded-lg border border-club-100 bg-white">
          <h2 className="border-b border-club-100 px-4 py-3 text-sm font-semibold text-club-800">Kanály</h2>
          <ul>
            {channels.map((channel) => (
              <li key={channel.id}>
                <button
                  onClick={() => setActiveId(channel.id)}
                  className={`w-full px-4 py-3 text-left text-sm hover:bg-club-50 ${
                    channel.id === activeId ? 'bg-club-50 font-semibold text-club-800' : 'text-gray-700'
                  }`}
                >
                  <span className="mr-2 rounded bg-club-100 px-1.5 py-0.5 text-xs font-bold text-club-800">
                    {channel.categoryCode ?? '📣'}
                  </span>
                  {channel.name}
                  {channel.lastMessage && (
                    <span className="mt-1 block truncate text-xs font-normal text-gray-400">
                      {channel.lastMessage.body}
                    </span>
                  )}
                </button>
              </li>
            ))}
            {channels.length === 0 && <li className="px-4 py-6 text-sm text-gray-500">Žiadne kanály.</li>}
          </ul>
        </aside>

        <section className="flex h-[600px] flex-col rounded-lg border border-club-100 bg-white">
          <h2 className="border-b border-club-100 px-4 py-3 text-sm font-semibold text-club-800">
            {active?.name ?? 'Vyberte kanál'}
          </h2>
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((message) => (
              <div key={message.id} className="rounded-lg border border-club-100 bg-club-50 p-3">
                <p className="text-xs font-semibold text-club-800">
                  {message.sender.firstName} {message.sender.lastName}
                  <span className="ml-2 font-normal text-gray-400">
                    {new Date(message.createdAt).toLocaleString('sk-SK', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </span>
                </p>
                <p className="mt-1 text-sm text-gray-800">{message.body}</p>
              </div>
            ))}
            {messages.length === 0 && (
              <p className="pt-8 text-center text-sm text-gray-500">Zatiaľ žiadne správy — napíšte prvú!</p>
            )}
            <div ref={bottomRef} />
          </div>
          <form onSubmit={send} className="flex gap-2 border-t border-club-100 p-3">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Napíšte správu…"
              className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-club-500 focus:outline-none"
            />
            <button
              type="submit"
              className="rounded-md bg-club-600 px-5 py-2 text-sm font-semibold text-white hover:bg-club-700"
            >
              Odoslať
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
