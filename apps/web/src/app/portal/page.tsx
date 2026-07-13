'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface Category {
  id: string;
  code: string;
  name: string;
}

interface EventItem {
  id: string;
  type: string;
  title: string;
  startAt: string;
  location: string | null;
  teamCategory: { code: string } | null;
}

const typeLabels: Record<string, string> = {
  TRAINING: 'Tréning',
  MATCH: 'Zápas',
  TOURNAMENT: 'Turnaj',
  CLUB_EVENT: 'Podujatie',
};

export default function DashboardPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);

  useEffect(() => {
    api<Category[]>('/seasons/categories').then(setCategories).catch(() => {});
    const from = new Date().toISOString();
    api<EventItem[]>(`/events?from=${from}`).then((list) => setEvents(list.slice(0, 8))).catch(() => {});
  }, []);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-club-900">Prehľad klubu</h1>

      <section>
        <h2 className="mb-3 font-semibold text-club-800">Najbližšie udalosti</h2>
        {events.length === 0 ? (
          <p className="rounded-lg border border-club-100 bg-white p-6 text-sm text-gray-500">
            Zatiaľ žiadne naplánované udalosti.
          </p>
        ) : (
          <ul className="divide-y divide-club-100 rounded-lg border border-club-100 bg-white">
            {events.map((event) => (
              <li key={event.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <span className="mr-2 rounded bg-club-100 px-2 py-0.5 text-xs font-medium text-club-800">
                    {typeLabels[event.type] ?? event.type}
                    {event.teamCategory ? ` · ${event.teamCategory.code}` : ''}
                  </span>
                  <span className="font-medium">{event.title}</span>
                  {event.location && <span className="ml-2 text-sm text-gray-500">{event.location}</span>}
                </div>
                <time className="text-sm text-gray-600">
                  {new Date(event.startAt).toLocaleString('sk-SK', { dateStyle: 'short', timeStyle: 'short' })}
                </time>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-semibold text-club-800">Kategórie</h2>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {categories.map((category) => (
            <a
              key={category.id}
              href={`/portal/clenovia?category=${category.code}`}
              className="rounded-lg border border-club-100 bg-white p-4 text-center hover:border-club-300"
            >
              <div className="text-lg font-bold text-club-700">{category.code}</div>
              <div className="text-xs text-gray-500">{category.name}</div>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
