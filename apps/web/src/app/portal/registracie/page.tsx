'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Button, Card, ErrorText } from '@/components/ui';

interface RegRequest {
  id: string;
  applicantType: string;
  childFirstName: string | null;
  childLastName: string | null;
  childBirthDate: string | null;
  healthNotes: string | null;
  parentFirstName: string | null;
  parentLastName: string | null;
  parentEmail: string | null;
  parentPhone: string | null;
  parentRelation: string | null;
  parentChildrenNote: string | null;
  consentPhotos: boolean;
  note: string | null;
  createdAt: string;
}

interface ApprovedResult {
  player: {
    firstName: string;
    lastName: string;
    account: { email: string; tempPassword: string | null } | null;
  } | null;
  parent: { email: string; tempPassword: string | null; accountCreated: boolean } | null;
}

const RELATION_LABELS: Record<string, string> = {
  MOTHER: 'matka',
  FATHER: 'otec',
  GUARDIAN: 'zástupca',
  RELATIVE: 'príbuzný',
};

export default function RegistrationsPage() {
  const [requests, setRequests] = useState<RegRequest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [approved, setApproved] = useState<ApprovedResult | null>(null);

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
      if (action === 'approve') {
        const res = await api<ApprovedResult>(`/registration/${id}/approve`, { method: 'POST' });
        if (res.player?.account?.tempPassword || res.parent?.tempPassword) setApproved(res);
      } else {
        await api(`/registration/${id}/reject`, { method: 'POST' });
      }
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
      {approved && (
        <Card className="border-club-300 bg-club-50">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2 text-sm text-gray-700">
              <p>
                Schválené{approved.player ? <>: <strong>{approved.player.firstName} {approved.player.lastName}</strong></> : ' konto rodiča'}.
                Odovzdajte dočasné heslá — po prihlásení sa dajú zmeniť:
              </p>
              {approved.player?.account?.tempPassword && (
                <p>
                  Hráč <strong>{approved.player.account.email}</strong>:{' '}
                  <code className="font-bold tracking-wider text-club-800">{approved.player.account.tempPassword}</code>
                </p>
              )}
              {approved.parent?.tempPassword && (
                <p>
                  Rodič <strong>{approved.parent.email}</strong>:{' '}
                  <code className="font-bold tracking-wider text-club-800">{approved.parent.tempPassword}</code>
                </p>
              )}
            </div>
            <button onClick={() => setApproved(null)} className="text-sm text-club-600 hover:underline">
              Zavrieť
            </button>
          </div>
        </Card>
      )}
      {requests.length === 0 && !error && (
        <Card className="text-sm text-gray-500">Žiadne čakajúce prihlášky. 🎉</Card>
      )}
      <div className="space-y-3">
        {requests.map((r) => (
          <Card key={r.id}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-1 text-sm">
                <p className="text-base font-semibold text-club-900">
                  {r.applicantType === 'PARENT' ? (
                    <>
                      {r.parentFirstName} {r.parentLastName}{' '}
                      <span className="rounded bg-club-100 px-1.5 py-0.5 text-xs font-normal text-club-700">konto rodiča</span>
                    </>
                  ) : (
                    <>
                      {r.childFirstName} {r.childLastName}{' '}
                      {r.childBirthDate && (
                        <span className="font-normal text-gray-500">
                          ({new Date(r.childBirthDate).toLocaleDateString('sk-SK')})
                        </span>
                      )}
                      {r.applicantType === 'ADULT' && (
                        <span className="ml-1 rounded bg-club-100 px-1.5 py-0.5 text-xs font-normal text-club-700">dospelý hráč</span>
                      )}
                    </>
                  )}
                </p>
                {r.parentFirstName && (
                  <p className="text-gray-600">
                    Rodič: {r.parentFirstName} {r.parentLastName}
                    {r.parentRelation ? ` · ${RELATION_LABELS[r.parentRelation] ?? r.parentRelation}` : ''}
                  </p>
                )}
                {(r.parentEmail || r.parentPhone) && (
                  <p className="text-gray-600">
                    {[r.parentEmail, r.parentPhone].filter(Boolean).join(' · ')}
                  </p>
                )}
                {r.parentChildrenNote && <p className="text-gray-600">Deti (členovia): {r.parentChildrenNote}</p>}
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
