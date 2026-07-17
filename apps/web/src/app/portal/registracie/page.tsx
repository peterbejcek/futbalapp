'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Button, Card, ErrorText } from '@/components/ui';

interface RegRequest {
  id: string;
  childFirstName: string;
  childLastName: string;
  childBirthDate: string;
  healthNotes: string | null;
  parentFirstName: string;
  parentLastName: string;
  parentEmail: string;
  parentPhone: string;
  parentRelation: string;
  consentPhotos: boolean;
  note: string | null;
  createdAt: string;
}

export default function RegistrationsPage() {
  const [requests, setRequests] = useState<RegRequest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRequests(await api<RegRequest[]>('/registration/pending'));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Načítanie zlyhalo');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function decide(id: string, action: 'approve' | 'reject') {
    setBusyId(id);
    try {
      await api(`/registration/${id}/${action}`, { method: 'POST' });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Akcia zlyhala');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-club-900">Registrácie na schválenie</h1>
      <ErrorText>{error}</ErrorText>
      {requests.length === 0 && !error && (
        <Card className="text-sm text-gray-500">Žiadne čakajúce prihlášky. 🎉</Card>
      )}
      <div className="space-y-3">
        {requests.map((r) => (
          <Card key={r.id}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-1 text-sm">
                <p className="text-base font-semibold text-club-900">
                  {r.childFirstName} {r.childLastName}{' '}
                  <span className="font-normal text-gray-500">
                    ({new Date(r.childBirthDate).toLocaleDateString('sk-SK')})
                  </span>
                </p>
                <p className="text-gray-600">
                  Rodič: {r.parentFirstName} {r.parentLastName} ·{' '}
                  {r.parentRelation === 'MOTHER' ? 'matka' : r.parentRelation === 'FATHER' ? 'otec' : 'zástupca'}
                </p>
                <p className="text-gray-600">
                  {r.parentEmail} · {r.parentPhone}
                </p>
                {r.healthNotes && <p className="text-gray-600">Zdravotné: {r.healthNotes}</p>}
                {r.note && <p className="text-gray-600">Poznámka: {r.note}</p>}
                <p className="text-xs text-gray-400">
                  Fotosúhlas: {r.consentPhotos ? 'áno' : 'nie'} · prijaté{' '}
                  {new Date(r.createdAt).toLocaleDateString('sk-SK')}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="danger" disabled={busyId === r.id} onClick={() => decide(r.id, 'reject')}>
                  Zamietnuť
                </Button>
                <Button disabled={busyId === r.id} onClick={() => decide(r.id, 'approve')}>
                  {busyId === r.id ? '…' : 'Schváliť'}
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
      <p className="text-sm text-gray-500">
        Po schválení sa vytvorí člen, rodičovský účet a hráč sa zaradí do družstva podľa ročníka.
      </p>
    </div>
  );
}
