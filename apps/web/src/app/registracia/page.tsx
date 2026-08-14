'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { parseRodneCislo, pscToMesto } from '@fkknv/shared';

/** Kto sa registruje: rodič (zákonný zástupca) alebo dospelý hráč. */
type Role = 'PARENT' | 'ADULT';
/** Rodič: registruje nové dieťa, alebo deti už sú členmi klubu. */
type ParentMode = 'REGISTER' | 'EXISTING';

const input = 'mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-club-500 focus:outline-none';
const label = 'block text-sm font-medium text-gray-700';

interface PlayerState {
  firstName: string;
  lastName: string;
  birthNumber: string;
  registrationNumber: string;
  healthNotes: string;
  originCountry: string;
  street: string;
  houseNumber: string;
  zip: string;
  city: string;
  photo: string | null; // data URL
  wantLogin: boolean; // vlastné prihlásenie
  email: string;
}

function emptyPlayer(): PlayerState {
  return {
    firstName: '',
    lastName: '',
    birthNumber: '',
    registrationNumber: '',
    healthNotes: '',
    originCountry: 'Slovensko',
    street: '',
    houseNumber: '',
    zip: '',
    city: '',
    photo: null,
    wantLogin: false,
    email: '',
  };
}

/** Údaje hráča pre payload (adresa, fotka, rodné číslo). */
function playerPayload(p: PlayerState, forceEmail: boolean) {
  return {
    firstName: p.firstName,
    lastName: p.lastName,
    birthNumber: p.birthNumber,
    registrationNumber: p.registrationNumber || undefined,
    photoBase64: p.photo || undefined,
    healthNotes: p.healthNotes || undefined,
    originCountry: p.originCountry || undefined,
    address: { street: p.street, houseNumber: p.houseNumber, zip: p.zip, city: p.city },
    email: forceEmail || p.wantLogin ? p.email : undefined,
  };
}

/** Formulár údajov jedného hráča (dieťa alebo dospelý). */
function PlayerFields({
  value,
  onChange,
  adult,
  onError,
}: {
  value: PlayerState;
  onChange: (patch: Partial<PlayerState>) => void;
  adult: boolean;
  onError: (msg: string) => void;
}) {
  const rc = parseRodneCislo(value.birthNumber);
  const derivedBirthDate = rc ? rc.birthDate.toISOString().slice(0, 10) : '';

  function onPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      onError('Fotka je príliš veľká (max 4 MB).');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onChange({ photo: typeof reader.result === 'string' ? reader.result : null });
    reader.readAsDataURL(file);
  }

  function onZipChange(zip: string) {
    const guessed = pscToMesto(zip);
    onChange({ zip, ...(guessed && !value.city ? { city: guessed } : {}) });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label}>Meno</label>
          <input value={value.firstName} onChange={(e) => onChange({ firstName: e.target.value })} required minLength={2} className={input} />
        </div>
        <div>
          <label className={label}>Priezvisko</label>
          <input value={value.lastName} onChange={(e) => onChange({ lastName: e.target.value })} required minLength={2} className={input} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label}>Rodné číslo</label>
          <input
            value={value.birthNumber}
            onChange={(e) => onChange({ birthNumber: e.target.value })}
            required
            inputMode="numeric"
            placeholder="RRMMDD/XXXX"
            className={input}
          />
          {value.birthNumber.replace(/\D/g, '').length >= 9 && !rc && (
            <p className="mt-1 text-xs text-red-600">Neplatné rodné číslo.</p>
          )}
        </div>
        <div>
          <label className={label}>Dátum narodenia</label>
          <input type="date" value={derivedBirthDate} readOnly disabled className={`${input} bg-gray-50`} />
          <p className="mt-1 text-xs text-gray-500">Odvodí sa z rodného čísla (zaradenie do kategórie).</p>
        </div>
      </div>
      <div>
        <label className={label}>Registračné číslo (nepovinné)</label>
        <input
          value={value.registrationNumber}
          onChange={(e) => onChange({ registrationNumber: e.target.value })}
          className={input}
          placeholder="ak už bolo pridelené"
        />
      </div>
      <div>
        <label className={label}>Fotka hráča (nepovinné)</label>
        <div className="mt-1 flex items-center gap-3">
          {value.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value.photo} alt="Náhľad fotky" className="h-16 w-16 rounded-md object-cover" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-md bg-gray-100 text-xs text-gray-400">foto</div>
          )}
          <input type="file" accept="image/*" onChange={onPhotoChange} className="text-sm" />
        </div>
      </div>
      <div>
        <label className={label}>Zdravotné obmedzenia (nepovinné)</label>
        <textarea value={value.healthNotes} onChange={(e) => onChange({ healthNotes: e.target.value })} rows={2} className={input} />
      </div>
      <div>
        <label className={label}>Krajina pôvodu</label>
        <input value={value.originCountry} onChange={(e) => onChange({ originCountry: e.target.value })} className={input} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <label className={label}>Ulica</label>
          <input value={value.street} onChange={(e) => onChange({ street: e.target.value })} required minLength={2} className={input} />
        </div>
        <div>
          <label className={label}>Súpisné / orientačné č.</label>
          <input value={value.houseNumber} onChange={(e) => onChange({ houseNumber: e.target.value })} required className={input} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className={label}>PSČ</label>
          <input value={value.zip} onChange={(e) => onZipChange(e.target.value)} required inputMode="numeric" placeholder="040 14" className={input} />
        </div>
        <div className="sm:col-span-2">
          <label className={label}>Mesto / obec</label>
          <input value={value.city} onChange={(e) => onChange({ city: e.target.value })} required minLength={2} className={input} />
        </div>
      </div>

      {adult ? (
        <div>
          <label className={label}>Váš e-mail (prihlásenie)</label>
          <input value={value.email} onChange={(e) => onChange({ email: e.target.value })} type="email" required className={input} />
        </div>
      ) : (
        <div className="rounded-md bg-club-50 p-3">
          <label className="flex items-start gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={value.wantLogin} onChange={(e) => onChange({ wantLogin: e.target.checked })} className="mt-1" />
            <span>
              Vytvoriť aj vlastné prihlásenie pre dieťa
              <span className="block text-xs text-gray-500">pre starších hráčov, ktorí chcú vlastný prístup</span>
            </span>
          </label>
          {value.wantLogin && (
            <div className="mt-2">
              <label className={label}>E-mail dieťaťa</label>
              <input value={value.email} onChange={(e) => onChange({ email: e.target.value })} type="email" required className={input} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function RegistrationPage() {
  const [role, setRole] = useState<Role>('PARENT');
  const [parentMode, setParentMode] = useState<ParentMode>('REGISTER');

  // rodič
  const [parentFirstName, setParentFirstName] = useState('');
  const [parentLastName, setParentLastName] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [relation, setRelation] = useState('MOTHER');
  const [existingChildrenNote, setExistingChildrenNote] = useState('');

  // deti / dospelý hráč
  const [children, setChildren] = useState<PlayerState[]>([emptyPlayer()]);
  const [adult, setAdult] = useState<PlayerState>(emptyPlayer());

  const [gdpr, setGdpr] = useState(false);
  const [photos, setPhotos] = useState(false);
  const [note, setNote] = useState('');

  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [captcha, setCaptcha] = useState<{ token: string; svg: string } | null>(null);
  const [captchaAnswer, setCaptchaAnswer] = useState('');

  const reloadCaptcha = useCallback(() => {
    setCaptchaAnswer('');
    api<{ token: string; svg: string }>('/captcha')
      .then(setCaptcha)
      .catch(() => setCaptcha(null));
  }, []);
  useEffect(() => {
    reloadCaptcha();
  }, [reloadCaptcha]);

  function setChildCount(n: number) {
    const count = Math.max(1, Math.min(10, n || 1));
    setChildren((prev) => {
      const next = prev.slice(0, count);
      while (next.length < count) next.push(emptyPlayer());
      return next;
    });
  }
  function patchChild(i: number, patch: Partial<PlayerState>) {
    setChildren((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }

  // typ prihlášky pre backend
  const applicantType = role === 'ADULT' ? 'ADULT' : parentMode === 'REGISTER' ? 'CHILD' : 'PARENT';

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    // validácia rodných čísiel
    if (applicantType === 'ADULT' && !parseRodneCislo(adult.birthNumber)) {
      setError('Neplatné rodné číslo hráča.');
      return;
    }
    if (applicantType === 'CHILD' && children.some((c) => !parseRodneCislo(c.birthNumber))) {
      setError('Skontrolujte rodné čísla detí.');
      return;
    }

    setLoading(true);
    try {
      await api('/registration', {
        method: 'POST',
        body: JSON.stringify({
          applicantType,
          parent:
            role === 'PARENT'
              ? {
                  firstName: parentFirstName,
                  lastName: parentLastName,
                  email: parentEmail,
                  phone: parentPhone,
                  relation,
                }
              : undefined,
          children: applicantType === 'CHILD' ? children.map((c) => playerPayload(c, false)) : undefined,
          player: applicantType === 'ADULT' ? playerPayload(adult, true) : undefined,
          existingChildrenNote: applicantType === 'PARENT' ? existingChildrenNote : undefined,
          consents: { gdpr, photos },
          note: note || undefined,
          captcha: { token: captcha?.token, answer: captchaAnswer },
        }),
      });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Odoslanie zlyhalo');
      reloadCaptcha();
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-club-50 px-6">
        <div className="max-w-md rounded-lg border border-club-100 bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-bold text-club-800">Prihláška odoslaná ✓</h1>
          <p className="mt-3 text-gray-600">Ďakujeme! Klub prihlášku skontroluje a ozveme sa vám s ďalšími krokmi.</p>
          <Link href="/" className="mt-6 inline-block text-club-600 hover:underline">
            ← Späť na úvod
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-club-50 px-6 py-12">
      <div className="mx-auto max-w-2xl rounded-lg border border-club-100 bg-white p-8 shadow-sm">
        <Link href="/" className="text-sm text-club-600 hover:underline">
          ← fkknv.sk
        </Link>
        <h1 className="mt-4 text-2xl font-bold text-club-900">Registrácia do klubu</h1>
        <p className="mt-1 text-sm text-gray-500">Vytvorenie konta rodiča alebo dospelého hráča.</p>

        {/* Kto sa registruje */}
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setRole('PARENT')}
            className={`rounded-md border px-4 py-3 text-left text-sm ${
              role === 'PARENT' ? 'border-club-600 bg-club-50 font-semibold text-club-800' : 'border-gray-300 text-gray-600'
            }`}
          >
            Som rodič (zákonný zástupca)
            <span className="block text-xs font-normal text-gray-500">registrujem dieťa alebo si vytváram konto</span>
          </button>
          <button
            type="button"
            onClick={() => setRole('ADULT')}
            className={`rounded-md border px-4 py-3 text-left text-sm ${
              role === 'ADULT' ? 'border-club-600 bg-club-50 font-semibold text-club-800' : 'border-gray-300 text-gray-600'
            }`}
          >
            Som hráč nad 18 rokov
            <span className="block text-xs font-normal text-gray-500">registrujem sa sám za seba</span>
          </button>
        </div>

        <form onSubmit={onSubmit} className="mt-6 space-y-6">
          {role === 'PARENT' ? (
            <>
              {/* Údaje rodiča */}
              <fieldset className="space-y-4">
                <legend className="font-semibold text-club-800">Rodič / zákonný zástupca</legend>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={label}>Meno</label>
                    <input value={parentFirstName} onChange={(e) => setParentFirstName(e.target.value)} required minLength={2} className={input} />
                  </div>
                  <div>
                    <label className={label}>Priezvisko</label>
                    <input value={parentLastName} onChange={(e) => setParentLastName(e.target.value)} required minLength={2} className={input} />
                  </div>
                  <div>
                    <label className={label}>E-mail</label>
                    <input value={parentEmail} onChange={(e) => setParentEmail(e.target.value)} type="email" required className={input} />
                  </div>
                  <div>
                    <label className={label}>Telefón</label>
                    <input value={parentPhone} onChange={(e) => setParentPhone(e.target.value)} type="tel" required minLength={9} className={input} />
                  </div>
                </div>
                <div>
                  <label className={label}>Vzťah k hráčom (deťom)</label>
                  <select value={relation} onChange={(e) => setRelation(e.target.value)} required className={input}>
                    <option value="MOTHER">Matka</option>
                    <option value="FATHER">Otec</option>
                    <option value="GUARDIAN">Zákonný zástupca</option>
                    <option value="RELATIVE">Iný príbuzný</option>
                  </select>
                </div>
              </fieldset>

              {/* GDPR súhlas rodiča */}
              <label className="flex items-start gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={gdpr} onChange={(e) => setGdpr(e.target.checked)} required className="mt-1" />
                <span>
                  Súhlasím so spracovaním osobných údajov na účely členstva a registrácie hráča podľa{' '}
                  <Link href="/dokumenty/ochrana-osobnych-udajov" target="_blank" className="text-club-600 underline">
                    Zásad ochrany osobných údajov (GDPR)
                  </Link>{' '}
                  (povinné).
                </span>
              </label>

              {/* Registrovať dieťa, alebo deti už sú členmi */}
              <fieldset className="space-y-2">
                <legend className="font-semibold text-club-800">Deti</legend>
                <label className="flex items-start gap-2 text-sm text-gray-700">
                  <input type="radio" name="parentMode" checked={parentMode === 'REGISTER'} onChange={() => setParentMode('REGISTER')} className="mt-1" />
                  <span>Chcem registrovať dieťa (ak ešte nie je členom klubu)</span>
                </label>
                <label className="flex items-start gap-2 text-sm text-gray-700">
                  <input type="radio" name="parentMode" checked={parentMode === 'EXISTING'} onChange={() => setParentMode('EXISTING')} className="mt-1" />
                  <span>Moje dieťa(deti) už sú členmi klubu</span>
                </label>
              </fieldset>

              {parentMode === 'EXISTING' && (
                <div>
                  <label className={label}>Mená detí, ktoré sú členmi klubu</label>
                  <textarea
                    value={existingChildrenNote}
                    onChange={(e) => setExistingChildrenNote(e.target.value)}
                    rows={3}
                    required
                    placeholder="Napíšte mená a priezviská detí (každé na nový riadok)"
                    className={input}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Priradenie dieťaťa ku kontu urobí vedenie klubu alebo tréner družstva.
                  </p>
                </div>
              )}

              {parentMode === 'REGISTER' && (
                <fieldset className="space-y-4">
                  <legend className="font-semibold text-club-800">Registrácia dieťaťa</legend>
                  <div className="w-40">
                    <label className={label}>Počet detí</label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={children.length}
                      onChange={(e) => setChildCount(Number(e.target.value))}
                      className={input}
                    />
                  </div>
                  {children.map((child, i) => (
                    <div key={i} className="rounded-md border border-club-100 p-4">
                      <p className="mb-3 font-medium text-club-800">Dieťa {i + 1}</p>
                      <PlayerFields value={child} onChange={(patch) => patchChild(i, patch)} adult={false} onError={setError} />
                    </div>
                  ))}
                </fieldset>
              )}
            </>
          ) : (
            <>
              {/* Dospelý hráč */}
              <fieldset className="space-y-4">
                <legend className="font-semibold text-club-800">Hráč (vy)</legend>
                <PlayerFields value={adult} onChange={(patch) => setAdult((p) => ({ ...p, ...patch }))} adult onError={setError} />
              </fieldset>

              <label className="flex items-start gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={gdpr} onChange={(e) => setGdpr(e.target.checked)} required className="mt-1" />
                <span>
                  Súhlasím so spracovaním osobných údajov na účely členstva a registrácie hráča podľa{' '}
                  <Link href="/dokumenty/ochrana-osobnych-udajov" target="_blank" className="text-club-600 underline">
                    Zásad ochrany osobných údajov (GDPR)
                  </Link>{' '}
                  (povinné).
                </span>
              </label>
            </>
          )}

          {/* Fotosúhlas (spoločný) — netýka sa PARENT bez dieťaťa */}
          {!(role === 'PARENT' && parentMode === 'EXISTING') && (
            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={photos} onChange={(e) => setPhotos(e.target.checked)} className="mt-1" />
              <span>Súhlasím so zverejňovaním fotografií z tréningov a zápasov (nepovinné).</span>
            </label>
          )}

          <div>
            <label className={label}>Poznámka pre klub (nepovinné)</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className={input} />
          </div>

          {/* CAPTCHA */}
          <div>
            <label className={label}>Opíšte kód z obrázka</label>
            <div className="mt-1 flex items-center gap-3">
              <span
                className="inline-flex h-12 w-[150px] items-center justify-center overflow-hidden rounded-md border border-gray-300 bg-slate-100"
                aria-hidden
                dangerouslySetInnerHTML={{ __html: captcha?.svg ?? '' }}
              />
              <button
                type="button"
                onClick={reloadCaptcha}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
                title="Nový kód"
              >
                ↻
              </button>
              <input
                value={captchaAnswer}
                onChange={(e) => setCaptchaAnswer(e.target.value)}
                required
                autoComplete="off"
                className={`${input} flex-1`}
                placeholder="Kód z obrázka"
                aria-label="Kód z obrázka"
              />
            </div>
            <p className="mt-1 text-xs text-gray-500">Ochrana proti automatickému spamu.</p>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading || !captcha || !captchaAnswer || !gdpr}
            className="w-full rounded-md bg-club-600 px-4 py-3 font-semibold text-white hover:bg-club-700 disabled:opacity-50"
          >
            {loading ? 'Odosielam…' : 'Odoslať prihlášku'}
          </button>
        </form>
      </div>
    </main>
  );
}
