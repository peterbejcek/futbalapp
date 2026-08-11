'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SURFACE_CODES, SURFACE_LABELS_SK } from '@fkknv/shared';
import { api } from '@/lib/api';
import { Button, ErrorText, Modal, inputCls, labelCls } from '@/components/ui';

function pad(n: number) {
  return String(n).padStart(2, '0');
}

/**
 * Akcie pre admina/vedúceho nad udalosťou v kalendári:
 *  - Presunúť (na iný termín)
 *  - Zrušiť (len zápas) — stav CANCELLED, ostane v prehľade ako „Zrušený"
 *  - Odstrániť — natrvalo zmaže udalosť (kaskádovo aj zápas, nomináciu, dochádzku).
 * Pri opakovanom tréningu možno odstrániť len tento termín alebo aj všetky budúce.
 */
export function EventAdminActions({
  eventId,
  startAt,
  endAt,
  kind,
  title,
  location,
  surface,
  matchId,
  matchState,
  recurrenceGroupId,
  onChanged,
}: {
  eventId: string;
  startAt: string;
  endAt?: string | null;
  kind: 'match' | 'training';
  title?: string;
  location?: string | null;
  surface?: string | null;
  matchId?: string;
  matchState?: string;
  recurrenceGroupId?: string | null;
  onChanged: () => void;
}) {
  const router = useRouter();
  const d = new Date(startAt);
  const [date, setDate] = useState(`${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`);
  const [time, setTime] = useState(`${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`);
  const [titleVal, setTitleVal] = useState(title ?? '');
  const [locationVal, setLocationVal] = useState(location ?? '');
  const [surfaceVal, setSurfaceVal] = useState(surface ?? '');
  const [moveOpen, setMoveOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const label = kind === 'match' ? 'zápas' : 'tréning';
  const canReschedule = kind === 'training' || matchState === 'PLANNED';
  const canCancel = kind === 'match' && matchState === 'PLANNED';

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const startMs = Date.parse(`${date}T${time}:00Z`);
      const body: Record<string, unknown> = {
        startAt: new Date(startMs).toISOString(),
        location: locationVal || undefined,
        surface: surfaceVal || undefined,
      };
      if (titleVal.trim()) body.title = titleVal.trim();
      if (endAt) {
        const dur = Date.parse(endAt) - Date.parse(startAt);
        if (dur > 0) body.endAt = new Date(startMs + dur).toISOString();
      }
      await api(`/events/${eventId}`, { method: 'PATCH', body: JSON.stringify(body) });
      setMoveOpen(false);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Úprava zlyhala');
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

  async function deleteEvent(scope: 'one' | 'future') {
    setBusy(true);
    setError(null);
    try {
      await api(`/events/${eventId}?scope=${scope}`, { method: 'DELETE' });
      router.push('/portal/udalosti');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Odstránenie zlyhalo');
      setBusy(false);
    }
  }

  return (
    <>
      {canReschedule && (
        <Button variant="ghost" onClick={() => setMoveOpen(true)}>
          Upraviť
        </Button>
      )}
      {canCancel && (
        <Button variant="ghost" onClick={() => setCancelOpen(true)}>
          Zrušiť
        </Button>
      )}
      <Button variant="danger" onClick={() => setDeleteOpen(true)}>
        Odstrániť
      </Button>

      {/* Upraviť (termín, miesto, povrch, názov) */}
      <Modal open={moveOpen} onClose={() => setMoveOpen(false)} title={`Upraviť ${label}`}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Dátum</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Čas</label>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={inputCls} />
            </div>
          </div>
          {title !== undefined && (
            <div>
              <label className={labelCls}>Názov</label>
              <input value={titleVal} onChange={(e) => setTitleVal(e.target.value)} className={inputCls} />
            </div>
          )}
          <div>
            <label className={labelCls}>Miesto</label>
            <input value={locationVal} onChange={(e) => setLocationVal(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Povrch</label>
            <select value={surfaceVal} onChange={(e) => setSurfaceVal(e.target.value)} className={inputCls}>
              <option value="">—</option>
              {SURFACE_CODES.map((s) => (
                <option key={s} value={s}>
                  {s} — {SURFACE_LABELS_SK[s]}
                </option>
              ))}
            </select>
          </div>
          <ErrorText>{error}</ErrorText>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setMoveOpen(false)}>
              Späť
            </Button>
            <Button onClick={save} disabled={busy || !date || !time}>
              {busy ? 'Ukladám…' : 'Uložiť'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Zrušiť (len zápas) — CANCELLED, ostane v prehľade */}
      <Modal open={cancelOpen} onClose={() => setCancelOpen(false)} title="Zrušiť zápas">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Zápas sa označí ako <strong>zrušený</strong> (napr. zväzom či klubom) a ostane v prehľade so stavom
            „Zrušený". Ak ide o chybný zápis, použite radšej <strong>Odstrániť</strong>.
          </p>
          <ErrorText>{error}</ErrorText>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setCancelOpen(false)}>
              Späť
            </Button>
            <Button variant="danger" onClick={cancelMatch} disabled={busy}>
              {busy ? 'Rušim…' : 'Označiť ako zrušený'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Odstrániť natrvalo */}
      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title={`Odstrániť ${label}`}>
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            {kind === 'match'
              ? 'Natrvalo odstrániť tento zápas vrátane nominácie a zápisu? Túto akciu nie je možné vrátiť.'
              : recurrenceGroupId
                ? 'Tento tréning je súčasťou opakovanej série. Odstrániť len tento termín, alebo aj všetky budúce? Vrátane dochádzky, nedá sa vrátiť.'
                : 'Natrvalo odstrániť tento tréning vrátane dochádzky? Túto akciu nie je možné vrátiť.'}
          </p>
          <ErrorText>{error}</ErrorText>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
              Späť
            </Button>
            {kind === 'training' && recurrenceGroupId ? (
              <>
                <Button variant="danger" onClick={() => deleteEvent('one')} disabled={busy}>
                  Len tento termín
                </Button>
                <Button variant="danger" onClick={() => deleteEvent('future')} disabled={busy}>
                  Tento aj budúce
                </Button>
              </>
            ) : (
              <Button variant="danger" onClick={() => deleteEvent('one')} disabled={busy}>
                {busy ? 'Odstraňujem…' : 'Odstrániť natrvalo'}
              </Button>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}
