import type { PublicEventState } from '@fkknv/shared';
import { STATE_LABEL } from '@/lib/verejne/format';

/** Odznak stavu udalosti (Zrušený / Prebieha / Odohraný); pre naplánované nič. */
export default function StateBadge({ state }: { state: PublicEventState }) {
  const label = STATE_LABEL[state];
  if (!label) return null;
  return <span className={`state-badge ${state.toLowerCase()}`}>{label}</span>;
}
