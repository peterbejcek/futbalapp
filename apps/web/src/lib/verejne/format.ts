const TZ = 'Europe/Bratislava';
export const fmtDay = (iso: string) => new Intl.DateTimeFormat('sk-SK', { day: 'numeric', timeZone: TZ }).format(new Date(iso));
export const fmtMonthShort = (iso: string) => new Intl.DateTimeFormat('sk-SK', { month: 'short', year: 'numeric', timeZone: TZ }).format(new Date(iso)).toUpperCase();
export const fmtTime = (iso: string) => new Intl.DateTimeFormat('sk-SK', { hour: '2-digit', minute: '2-digit', timeZone: TZ }).format(new Date(iso));
export const fmtDate = (iso: string) => new Intl.DateTimeFormat('sk-SK', { day: 'numeric', month: 'long', year: 'numeric', timeZone: TZ }).format(new Date(iso));
export const isMatchType = (t: string) => t === 'MATCH' || t === 'TOURNAMENT';
