'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Button, Card, ErrorText, Modal, inputCls, labelCls } from '@/components/ui';

interface Task {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  done: boolean;
  doneByName: string | null;
  createdByName: string | null;
  assigneeUserId: string | null;
  assigneeName: string | null;
  assigneeRole: string | null;
  createdAt: string;
}
interface Assignee {
  userId: string;
  name: string;
  roles: string[];
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Admin',
  MANAGER: 'Vedúci klubu',
  COACH: 'Tréneri',
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('sk-SK', { timeZone: 'UTC' });
}
function assigneeLabel(t: Task) {
  if (t.assigneeName) return t.assigneeName;
  if (t.assigneeRole) return ROLE_LABELS[t.assigneeRole] ?? t.assigneeRole;
  return 'Ktokoľvek';
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      setTasks(await api<Task[]>('/tasks'));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Načítanie zlyhalo');
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function toggle(t: Task) {
    setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)));
    try {
      await api(`/tasks/${t.id}/done`, { method: 'POST', body: JSON.stringify({ done: !t.done }) });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Zmena zlyhala');
      await load();
    }
  }

  async function remove(t: Task) {
    if (!confirm(`Odstrániť úlohu „${t.title}"?`)) return;
    try {
      await api(`/tasks/${t.id}`, { method: 'DELETE' });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Odstránenie zlyhalo');
    }
  }

  const open = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-club-900">Úlohy</h1>
        <Button onClick={() => setCreating(true)}>+ Nová úloha</Button>
      </div>
      <ErrorText>{error}</ErrorText>

      {open.length === 0 && <Card className="text-sm text-gray-500">Žiadne otvorené úlohy. 🎉</Card>}
      <div className="space-y-2">
        {open.map((t) => (
          <TaskRow key={t.id} task={t} onToggle={() => toggle(t)} onRemove={() => remove(t)} />
        ))}
      </div>

      {done.length > 0 && (
        <>
          <h2 className="pt-2 font-semibold text-gray-500">Splnené</h2>
          <div className="space-y-2">
            {done.map((t) => (
              <TaskRow key={t.id} task={t} onToggle={() => toggle(t)} onRemove={() => remove(t)} />
            ))}
          </div>
        </>
      )}

      {creating && (
        <TaskModal
          onClose={() => setCreating(false)}
          onDone={() => {
            setCreating(false);
            void load();
          }}
        />
      )}
    </div>
  );
}

function TaskRow({ task, onToggle, onRemove }: { task: Task; onToggle: () => void; onRemove: () => void }) {
  const overdue = !task.done && task.dueDate && new Date(task.dueDate) < new Date(new Date().toDateString());
  return (
    <Card className={task.done ? 'opacity-60' : ''}>
      <div className="flex items-start gap-3">
        <input type="checkbox" checked={task.done} onChange={onToggle} className="mt-1 h-5 w-5 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className={`font-semibold text-club-900 ${task.done ? 'line-through' : ''}`}>{task.title}</p>
          {task.description && <p className="mt-0.5 whitespace-pre-wrap text-sm text-gray-600">{task.description}</p>}
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
            <span className="rounded bg-club-50 px-2 py-0.5 text-club-700">👤 {assigneeLabel(task)}</span>
            {task.dueDate && (
              <span className={overdue ? 'font-semibold text-red-600' : ''}>
                📅 do {fmtDate(task.dueDate)}
                {overdue ? ' · po termíne' : ''}
              </span>
            )}
            {task.createdByName && <span>zadal: {task.createdByName}</span>}
            {task.done && task.doneByName && <span>splnil: {task.doneByName}</span>}
          </div>
        </div>
        <button onClick={onRemove} title="Odstrániť" className="shrink-0 text-gray-400 hover:text-red-600">
          ✕
        </button>
      </div>
    </Card>
  );
}

function TaskModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [mode, setMode] = useState<'function' | 'member'>('function');
  const [assigneeRole, setAssigneeRole] = useState('COACH');
  const [assigneeUserId, setAssigneeUserId] = useState('');
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Assignee[]>('/tasks/assignees').then(setAssignees).catch(() => {});
  }, []);

  async function submit() {
    if (!title.trim()) {
      setError('Zadajte názov úlohy');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api('/tasks', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          dueDate: dueDate || undefined,
          assigneeUserId: mode === 'member' ? assigneeUserId || undefined : undefined,
          assigneeRole: mode === 'function' ? assigneeRole : undefined,
        }),
      });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Uloženie zlyhalo');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Nová úloha">
      <div className="space-y-3">
        <div>
          <label className={labelCls}>Názov</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} placeholder="Napr. Objednať dresy" />
        </div>
        <div>
          <label className={labelCls}>Popis (nepovinné)</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Kto má splniť</label>
          <div className="mt-1 flex gap-4 text-sm text-gray-700">
            <label className="flex items-center gap-1">
              <input type="radio" checked={mode === 'function'} onChange={() => setMode('function')} />
              Funkcia
            </label>
            <label className="flex items-center gap-1">
              <input type="radio" checked={mode === 'member'} onChange={() => setMode('member')} />
              Konkrétny člen
            </label>
          </div>
          {mode === 'function' ? (
            <select value={assigneeRole} onChange={(e) => setAssigneeRole(e.target.value)} className={`${inputCls} mt-2`}>
              <option value="ADMIN">Admin</option>
              <option value="MANAGER">Vedúci klubu</option>
              <option value="COACH">Tréneri</option>
            </select>
          ) : (
            <select value={assigneeUserId} onChange={(e) => setAssigneeUserId(e.target.value)} className={`${inputCls} mt-2`}>
              <option value="">— vyberte člena —</option>
              {assignees.map((a) => (
                <option key={a.userId} value={a.userId}>
                  {a.name} ({a.roles.map((r) => ROLE_LABELS[r] ?? r).join(', ')})
                </option>
              ))}
            </select>
          )}
        </div>
        <div>
          <label className={labelCls}>Termín (nepovinné)</label>
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputCls} />
        </div>
        <ErrorText>{error}</ErrorText>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Zrušiť
          </Button>
          <Button onClick={submit} disabled={busy || !title.trim() || (mode === 'member' && !assigneeUserId)}>
            {busy ? 'Ukladám…' : 'Vytvoriť'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
