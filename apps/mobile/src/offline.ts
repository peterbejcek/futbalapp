import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';

/**
 * Offline fronta pre zápisy pri ihrisku (slabý signál):
 * akcie sa najprv uložia lokálne a potom sa skúsia odoslať.
 * Zápisy sú na serveri idempotentné (clientId / upsert), takže
 * opakované odoslanie po výpadku nič neduplikuje.
 */

export type QueuedAction =
  | { kind: 'attendance'; eventId: string; memberId: string; status: string }
  | { kind: 'matchEvent'; matchId: string; payload: Record<string, unknown> };

const QUEUE_KEY = 'fkknv_offline_queue';

async function readQueue(): Promise<QueuedAction[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  return raw ? (JSON.parse(raw) as QueuedAction[]) : [];
}

async function writeQueue(queue: QueuedAction[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

async function send(action: QueuedAction): Promise<void> {
  if (action.kind === 'attendance') {
    await api(`/events/${action.eventId}/attendance`, {
      method: 'POST',
      body: JSON.stringify({ memberId: action.memberId, status: action.status }),
    });
  } else {
    await api(`/matches/${action.matchId}/events`, {
      method: 'POST',
      body: JSON.stringify(action.payload),
    });
  }
}

/** Zaradí akciu do fronty a hneď skúsi celú frontu odoslať. */
export async function enqueue(action: QueuedAction): Promise<{ pending: number }> {
  const queue = await readQueue();
  queue.push(action);
  await writeQueue(queue);
  return flush();
}

/** Odošle čakajúce akcie v poradí; pri prvom zlyhaní skončí (zachová poradie). */
export async function flush(): Promise<{ pending: number }> {
  let queue = await readQueue();
  while (queue.length > 0) {
    try {
      await send(queue[0]!);
      queue = queue.slice(1);
      await writeQueue(queue);
    } catch {
      break; // offline alebo chyba servera — skúsime neskôr
    }
  }
  return { pending: queue.length };
}

export async function pendingCount(): Promise<number> {
  return (await readQueue()).length;
}
