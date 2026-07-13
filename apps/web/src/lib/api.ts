export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('fkknv_token');
}

export function setToken(token: string | null) {
  if (token) window.localStorage.setItem('fkknv_token', token);
  else window.localStorage.removeItem('fkknv_token');
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (response.status === 401 && typeof window !== 'undefined') {
    setToken(null);
    window.location.href = '/prihlasenie';
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message ?? `Chyba servera (${response.status})`);
  }
  return response.json() as Promise<T>;
}
