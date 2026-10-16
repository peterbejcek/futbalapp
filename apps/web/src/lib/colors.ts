import { categoryColor as sharedCategory, eventTypeColor as sharedType } from '@fkknv/shared';

type Pair = { bg: string; text: string };

/** Tmavá varianta zdieľaných pastelových farieb: pastel sa použije ako farba textu, pozadie je jeho jemný tón na paneli. */
const dark = (p: Pair): Pair => ({ bg: `color-mix(in srgb, ${p.bg} 16%, #111b23)`, text: p.bg });

export const categoryColor = (code: string | null | undefined): Pair => dark(sharedCategory(code));
export const eventTypeColor = (type: string | null | undefined): Pair => dark(sharedType(type));
