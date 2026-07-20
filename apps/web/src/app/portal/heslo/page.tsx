'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { Button, Card, ErrorText, inputCls, labelCls } from '@/components/ui';

export default function ChangePasswordPage() {
  const [currentPassword, setCurrent] = useState('');
  const [newPassword, setNew] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirm) {
      setError('Nové heslá sa nezhodujú.');
      return;
    }
    setBusy(true);
    try {
      await api('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setDone(true);
      setCurrent('');
      setNew('');
      setConfirm('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Zmena zlyhala');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-club-900">Zmena hesla</h1>
      <Card className="max-w-md">
        {done && <p className="mb-3 rounded bg-club-50 px-3 py-2 text-sm text-club-700">Heslo bolo zmenené. ✓</p>}
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className={labelCls}>Súčasné (dočasné) heslo</label>
            <input type="password" value={currentPassword} onChange={(e) => setCurrent(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Nové heslo</label>
            <input type="password" value={newPassword} onChange={(e) => setNew(e.target.value)} className={inputCls} />
            <p className="mt-1 text-xs text-gray-500">Aspoň 8 znakov.</p>
          </div>
          <div>
            <label className={labelCls}>Nové heslo znova</label>
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputCls} />
          </div>
          <ErrorText>{error}</ErrorText>
          <Button type="submit" disabled={busy || !currentPassword || newPassword.length < 8}>
            {busy ? 'Ukladám…' : 'Zmeniť heslo'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
