import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  DEFAULT_HALF_LENGTH_MIN,
  MATCH_TIMER_PHASE_LABELS_SK,
  computeMatchClock,
  type MatchTimerAction,
  type MatchTimerPhase,
  type MatchTimerState,
} from '@fkknv/shared';
import { ui } from '@/theme';

/** Polia časomiery v detaile zápasu (staršie API ich nemusí posielať). */
export interface MatchTimerFields {
  halfLengthMin?: number;
  timerPhase?: MatchTimerPhase;
  firstHalfStartedAt?: string | null;
  firstHalfEndedAt?: string | null;
  secondHalfStartedAt?: string | null;
  secondHalfEndedAt?: string | null;
  serverNow?: string;
}

/** Stav časomiery zo zápasu (chýbajúce polia → pred výkopom). */
export function timerOf(m: MatchTimerFields): MatchTimerState {
  return {
    timerPhase: m.timerPhase ?? 'NOT_STARTED',
    halfLengthMin: m.halfLengthMin ?? DEFAULT_HALF_LENGTH_MIN,
    firstHalfStartedAt: m.firstHalfStartedAt ?? null,
    firstHalfEndedAt: m.firstHalfEndedAt ?? null,
    secondHalfStartedAt: m.secondHalfStartedAt ?? null,
    secondHalfEndedAt: m.secondHalfEndedAt ?? null,
  };
}

/** Výrazná časomiera zápasu + ovládanie (výkop, prestávka, 2. polčas, koniec, späť). */
export function MatchTimerCard({
  timer,
  matchState,
  now,
  manage,
  busy,
  onAction,
}: {
  timer: MatchTimerFields;
  matchState: string;
  now: number;
  manage: boolean;
  busy: boolean;
  onAction: (a: MatchTimerAction) => void;
}) {
  const t = timerOf(timer);
  const c = computeMatchClock(t, now);
  const phase = t.timerPhase;
  const half = t.halfLengthMin;
  if (!manage && phase === 'NOT_STARTED') return null;

  const confirm = (title: string, msg: string, action: MatchTimerAction, destructive = false) =>
    Alert.alert(title, msg, [
      { text: 'Zrušiť', style: 'cancel' },
      { text: 'Áno', style: destructive ? 'destructive' : 'default', onPress: () => onAction(action) },
    ]);

  return (
    <View style={styles.card}>
      <View style={styles.headRow}>
        <Text style={styles.headText}>ČASOMIERA</Text>
        <Text style={[styles.headText, c.running && { color: ui.lime }]}>
          {c.running ? '● ' : ''}
          {MATCH_TIMER_PHASE_LABELS_SK[phase].toUpperCase()}
        </Text>
      </View>

      <View style={styles.clockRow}>
        <Text style={[styles.clock, !c.running && { color: ui.muted }]} adjustsFontSizeToFit numberOfLines={1}>
          {c.clock}
        </Text>
        {c.stoppageClock ? (
          <Text style={styles.stoppage} numberOfLines={1}>
            {c.stoppageClock}
          </Text>
        ) : null}
      </View>

      <Text style={styles.sub}>
        {phase === 'NOT_STARTED' ? (
          `Polčas ${half} min · spustite výkopom`
        ) : (
          <>
            Minúta zápisu: <Text style={styles.subStrong}>{c.label}</Text> · polčas {half} min
          </>
        )}
      </Text>

      {manage && matchState !== 'CANCELLED' && (
        <View style={styles.btnRow}>
          {phase === 'NOT_STARTED' && (
            <TimerBtn label="▶ Výkop" onPress={() => onAction('START_FIRST')} disabled={busy} />
          )}
          {phase === 'FIRST_HALF' && <TimerBtn label="❚❚ Prestávka" onPress={() => onAction('END_FIRST')} disabled={busy} />}
          {phase === 'HALF_TIME' && (
            <TimerBtn label="▶ Druhý polčas" onPress={() => onAction('START_SECOND')} disabled={busy} />
          )}
          {(phase === 'FIRST_HALF' || phase === 'HALF_TIME' || phase === 'SECOND_HALF') && (
            <TimerBtn
              label="■ Koniec zápasu"
              variant="danger"
              disabled={busy}
              onPress={() =>
                phase === 'SECOND_HALF'
                  ? onAction('END_SECOND')
                  : confirm('Koniec zápasu', 'Ukončiť zápas už teraz (bez dohrania 2. polčasu)?', 'END_SECOND', true)
              }
            />
          )}
          {phase !== 'NOT_STARTED' && (
            <>
              <TimerBtn label="↶ Späť" variant="ghost" onPress={() => onAction('UNDO')} disabled={busy} />
              <TimerBtn
                label="Vynulovať"
                variant="ghost"
                disabled={busy}
                onPress={() => confirm('Vynulovať časomieru?', 'Zapísané udalosti ostanú.', 'RESET', true)}
              />
            </>
          )}
        </View>
      )}
    </View>
  );
}

function TimerBtn({
  label,
  onPress,
  disabled,
  variant = 'primary',
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'danger' | 'ghost';
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        variant === 'primary' && styles.btnPrimary,
        variant === 'danger' && styles.btnDanger,
        variant === 'ghost' && styles.btnGhost,
        (pressed || disabled) && { opacity: 0.6 },
      ]}
    >
      <Text style={[styles.btnText, variant === 'ghost' && { color: ui.ink, fontSize: 14 }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: ui.panel,
    borderWidth: 1,
    borderColor: ui.line,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    alignItems: 'center',
  },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignSelf: 'stretch' },
  headText: { color: ui.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  clockRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 10, marginVertical: 6 },
  clock: {
    color: ui.ink,
    fontSize: 76,
    lineHeight: 84,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  stoppage: { color: ui.warn, fontSize: 40, fontWeight: '800', fontVariant: ['tabular-nums'] },
  sub: { color: ui.muted, fontSize: 13, textAlign: 'center' },
  subStrong: { color: ui.lime, fontWeight: '800' },
  btnRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 12 },
  btn: { borderRadius: 10, paddingHorizontal: 18, paddingVertical: 12, alignItems: 'center' },
  btnPrimary: { backgroundColor: ui.blue },
  btnDanger: { backgroundColor: ui.red },
  btnGhost: { backgroundColor: ui.panel2, borderWidth: 1, borderColor: ui.line, paddingHorizontal: 14 },
  btnText: { color: ui.onAccent, fontWeight: '800', fontSize: 16 },
});
