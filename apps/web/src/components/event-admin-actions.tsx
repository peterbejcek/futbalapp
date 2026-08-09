'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Button, ErrorText, Modal, inputCls, labelCls } from '@/components/ui';

function pad(n: number) {
  return String(n).padStart(2, '0');
}

/**
 * Akcie pre admina/vedúceho nad udalosťou v kalendári: Presunúť (na iný termín)
 * a Zrušiť. Pri zápase sa Zrušiť rieši stavom CANCELLED (ostane v prehľade),
 * pri tréningu sa udalosť odstráni (pri sérii voliteľne aj budúce termíny).
 */
export function EventAdminActions({
  eventId,
  startAt,
  endAt,
  kind,
  matchId,
  recurrenceGroupId,
  onChanged,
}: {
  eventId: string;
  startAt: string;
  endAt?: string | null;
  kind: 'match' | 'training';
  matchId?: string;
  recurrenceGroupId?: string | null;
  onChanged: () => void;
}) {
  const router = useRouter();
  const d = new Date(startAt);
  const [date, setDate] = useState(`${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`);
  const [time, setTime] = useState(`${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`);
  const [moveOpen, setMoveOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const label = kind === 'match' ? 'zápas' : 'tréning';

  async function move() {
    setBusy(true);
    setError(null);
    try {
      const startMs = Date.parse(`${date}T${time}:00Z`);
      const body: { startAt: string; endAt?: string } = { startAt: new Date(startMs).toISOString() };
      if (endAt) {
        const dur = Date.parse(endAt) - Date.parse(startAt);
        if (dur > 0) body.endAt = new Date(startMs + dur).toISOString();
      }
      await api(`/events/${eventId}`, { method: 'PATCH', body: JSON.stringify(body) });
      setMoveOpen(false);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Presun zlyhal');
    } finally {
      setBusy(false);
    }
  }

  async function cancelMatch() {
    setBusy(true);
    setError(null);
    try {
      await api(`/matches/${matchId}/state`, { method: 'POST', body: JSON.stringify({ state: 'CANCELLED' }) });
      setCancelOpen(false);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Zrušenie zlyhalo');
    } finally {
      setBusy(false);
    }
  }

  async function cancelTraining(scope: 'one' | 'future') {
    setBusy(true);
    setError(null);
    try {
      await api(`/events/${eventId}?scope=${scope}`, { method: 'DELETE' });
      router.push('/portal/udalosti');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Zrušenie zlyhalo');
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant="ghost" onClick={() => setMoveOpen(true)}>
        Presunúť
      </Button>
      <Button variant="danger" onClick={() => setCancelOpen(true)}>
        Zrušiť
      </Button>

      <Modal open={moveOpen} onClose={() => setMoveOpen(false)} title={`Presunúť ${label}`}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Nový dátum</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Nový čas</label>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={inputCls} />
            </div>
          </div>
          <ErrorText>{error}</ErrorText>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setMoveOpen(false)}>
              Späť
            </Button>
            <Button onClick={move} disabled={busy || !date || !time}>
              {busy ? 'Ukladám…' : 'Presunúť'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={cancelOpen} onClose={() => setCancelOpen(false)} title={`Zrušiť ${label}`}>
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            {kind === 'match'
              ? 'Zápas sa označí ako zrušený a ostane v prehľade so stavom „Zrušený".'
              : recurrenceGroupId
                ? 'Tento tréning je súčasťou opakovanej série. Zrušiť len tento termín, alebo aj všetky budúce?'
                : 'Naozaj zrušiť tento tréning? Odstráni sa z kalendára.'}
          </p>
          <ErrorText>{error}</ErrorText>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={() => setCancelOpen(false)}>
              Späť
            </Button>
            {kind === 'match' ? (
              <Button variant="danger" onClick={cancelMatch} disabled={busy}>
                {busy ? 'Rušim…' : 'Zrušiť zápas'}
              </Button>
            ) : recurrenceGroupId ? (
              <>
                <Button variant="ghost" onClick={() => cancelTraining('one')} disabled={busy}>
                  Len tento termín
                </Button>
                <Button variant="danger" onClick={() => cancelTraining('future')} disabled={busy}>
                  Tento aj budúce
                </Button>
              </>
            ) : (
              <Button variant="danger" onClick={() => cancelTraining('one')} disabled={busy}>
                {busy ? 'Rušim…' : 'Zrušiť tréning'}
              </Button>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}
