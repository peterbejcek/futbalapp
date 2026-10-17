import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { api, getToken } from '@/api';
import {
  clearSavedLogin,
  getRememberPref,
  isCredentialsRejected,
  loadSavedLogin,
  loginWithPassword,
  saveLogin,
  setRememberPref,
} from '@/auth';
import { authenticateBiometric, getBiometricInfo, type BiometricInfo } from '@/biometric';
import { KeyboardScreen } from '@/KeyboardScreen';
import { ui } from '@/theme';

const logo = require('../assets/logo.png');

/** Kontakt na klubovú podporu (zhodný so stránkou fkknv.sk/podpora). */
const SUPPORT_EMAIL = 'support@fkknv.sk';
const SUPPORT_PHONE = '+421 944 566 226';

/** „odtlačkom“ → „Prihlásiť odtlačkom“, „Face ID“ → „Prihlásiť cez Face ID“. */
function bioButtonText(label: string): string {
  return /^[A-Z]/.test(label) ? `Prihlásiť cez ${label}` : `Prihlásiť ${label}`;
}

function askYesNo(title: string, message: string): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: 'Nie', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Áno, uložiť', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [bio, setBio] = useState<BiometricInfo>({ available: false, label: 'odtlačkom / Face ID' });
  const [hasSaved, setHasSaved] = useState(false);
  const [remember, setRemember] = useState(true);
  const autoTried = useRef(false);

  const onBiometricLogin = useCallback(async () => {
    setError(null);
    const ok = await authenticateBiometric();
    if (!ok) return; // zrušené / neúspešné overenie — používateľ môže zadať heslo
    const saved = await loadSavedLogin();
    if (!saved) {
      setHasSaved(false);
      setError('Uložené prihlásenie sa nenašlo. Prihláste sa e-mailom a heslom.');
      return;
    }
    setLoading(true);
    try {
      await loginWithPassword(saved.email, saved.password);
      router.replace('/dashboard');
    } catch (e) {
      if (isCredentialsRejected(e)) {
        await clearSavedLogin();
        setHasSaved(false);
        setEmail(saved.email);
        setPassword('');
        setError('Uložené heslo už neplatí (asi bolo zmenené). Uložené prihlásenie sme vymazali — prihláste sa novým heslom.');
      } else {
        setError(e instanceof Error ? e.message : 'Prihlásenie zlyhalo. Skontrolujte pripojenie.');
      }
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const token = await getToken();
      if (token) {
        router.replace('/dashboard');
        return;
      }
      const [info, saved, pref] = await Promise.all([getBiometricInfo(), loadSavedLogin(), getRememberPref()]);
      if (!alive) return;
      setBio(info);
      setHasSaved(!!saved);
      setRemember(pref);
      if (saved) setEmail(saved.email);
      setChecking(false);
      // Automatický pokus o biometrické prihlásenie po otvorení obrazovky (len raz).
      if (info.available && saved && !autoTried.current) {
        autoTried.current = true;
        void onBiometricLogin();
      }
    })();
    return () => {
      alive = false;
    };
  }, [router, onBiometricLogin]);

  async function offerSaveLogin(loginEmail: string, loginPassword: string) {
    if (!bio.available || !remember) return;
    const saved = await loadSavedLogin();
    if (saved && saved.email.toLowerCase() === loginEmail.trim().toLowerCase()) {
      // Už povolené pre tento účet — len aktualizuj heslo (napr. po zmene).
      await saveLogin(loginEmail, loginPassword);
      return;
    }
    const yes = await askYesNo(
      'Uložiť prihlásenie?',
      `Uložiť prihlásenie a nabudúce sa prihlasovať ${bio.label}? Heslo sa uloží len zašifrovane v tomto zariadení.`,
    );
    if (yes) {
      await saveLogin(loginEmail, loginPassword);
    } else {
      await setRememberPref(false);
    }
  }

  async function onLogin() {
    setError(null);
    setLoading(true);
    try {
      await loginWithPassword(email, password);
      await offerSaveLogin(email, password).catch(() => undefined);
      router.replace('/dashboard');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Prihlásenie zlyhalo');
    } finally {
      setLoading(false);
    }
  }

  async function onToggleRemember(on: boolean) {
    setRemember(on);
    await setRememberPref(on);
    if (!on && hasSaved) {
      await clearSavedLogin();
      setHasSaved(false);
    }
  }

  function onForgetSaved() {
    Alert.alert('Zabudnúť uložené prihlásenie', 'Vymazať uložený e-mail a heslo z tohto zariadenia?', [
      { text: 'Zrušiť', style: 'cancel' },
      {
        text: 'Vymazať',
        style: 'destructive',
        onPress: async () => {
          await clearSavedLogin();
          setHasSaved(false);
          setPassword('');
        },
      },
    ]);
  }

  async function onForgot() {
    if (!email) {
      setError('Zadajte e-mail a znova klepnite na „Zabudli ste heslo?".');
      return;
    }
    setError(null);
    try {
      await api('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email: email.trim() }) });
      Alert.alert('Obnovenie hesla', `Ak je e-mail ${email} v systéme, poslali sme naň odkaz na nové heslo. Skontrolujte aj spam.`);
    } catch {
      Alert.alert('Obnovenie hesla', 'Ak je e-mail v systéme, poslali sme naň odkaz.');
    }
  }

  if (checking) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={ui.blue} size="large" />
      </View>
    );
  }

  return (
    <KeyboardScreen style={styles.flex} contentContainerStyle={styles.container}>
      <Image source={logo} style={styles.logo} resizeMode="contain" />
      <Text style={styles.title}>Prihlásenie do portálu</Text>

      {hasSaved && bio.available && (
        <Pressable
          style={({ pressed }) => [styles.bioButton, pressed && styles.pressed]}
          onPress={onBiometricLogin}
          disabled={loading}
        >
          <Text style={styles.bioButtonText}>{bioButtonText(bio.label)}</Text>
        </Pressable>
      )}

      <Text style={styles.label}>E-mail</Text>
      <TextInput
        style={styles.input}
        placeholder="napr. meno@email.sk"
        placeholderTextColor={ui.placeholder}
        cursorColor={ui.blue}
        selectionColor={ui.blue}
        underlineColorAndroid="transparent"
        keyboardAppearance="dark"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="username"
        keyboardType="email-address"
        returnKeyType="next"
        value={email}
        onChangeText={setEmail}
      />
      <Text style={styles.label}>Heslo</Text>
      <TextInput
        style={styles.input}
        placeholder="Heslo"
        placeholderTextColor={ui.placeholder}
        cursorColor={ui.blue}
        selectionColor={ui.blue}
        underlineColorAndroid="transparent"
        keyboardAppearance="dark"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="password"
        textContentType="password"
        secureTextEntry
        returnKeyType="go"
        onSubmitEditing={onLogin}
        value={password}
        onChangeText={setPassword}
      />

      {bio.available && (
        <View style={styles.switchRow}>
          <Text style={styles.switchText}>Zapamätať si heslo / používať biometriu</Text>
          <Switch
            value={remember}
            onValueChange={onToggleRemember}
            trackColor={{ false: ui.line, true: ui.blue }}
            thumbColor={ui.ink}
            ios_backgroundColor={ui.line}
          />
        </View>
      )}

      {error && <Text style={styles.error}>{error}</Text>}
      <Pressable
        style={({ pressed }) => [styles.button, (pressed || loading) && styles.pressed]}
        onPress={onLogin}
        disabled={loading}
      >
        <Text style={styles.buttonText}>{loading ? 'Prihlasujem…' : 'Prihlásiť sa'}</Text>
      </Pressable>
      <Pressable style={styles.linkBtn} onPress={onForgot}>
        <Text style={styles.linkText}>Zabudli ste heslo?</Text>
      </Pressable>
      {hasSaved && (
        <Pressable style={styles.linkBtn} onPress={onForgetSaved}>
          <Text style={styles.linkMuted}>Zabudnúť uložené prihlásenie</Text>
        </Pressable>
      )}

      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>Nemáte prihlasovacie údaje?</Text>
        <Text style={styles.infoText}>
          Prístup do aplikácie vytvára vedenie klubu svojim členom. Aplikácia neumožňuje vytvorenie konta — prihlášku
          nového hráča podáva rodič na klubovej stránke fkknv.sk a po jej schválení mu prihlasovacie údaje prídu e-mailom.
        </Text>
        <Text style={styles.infoText}>
          S prihlásením pomôže klubová podpora: {SUPPORT_EMAIL}, {SUPPORT_PHONE}
        </Text>
      </View>
    </KeyboardScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: ui.bg },
  container: { flexGrow: 1, padding: 24, justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: ui.bg },
  logo: { width: 110, height: 176, alignSelf: 'center', marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '700', color: ui.ink, marginBottom: 24, textAlign: 'center' },
  label: { color: ui.muted, fontSize: 13, fontWeight: '600', marginBottom: 6 },
  input: {
    backgroundColor: ui.panel,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: ui.line,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
    fontSize: 16,
    color: ui.ink,
    minHeight: 48,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 14,
  },
  switchText: { color: ui.ink, fontSize: 14, flex: 1, flexShrink: 1 },
  error: { color: ui.red, marginBottom: 12, textAlign: 'center', width: '100%', flexShrink: 1 },
  button: { backgroundColor: ui.blue, borderRadius: 8, padding: 16, alignItems: 'center' },
  pressed: { opacity: 0.75 },
  buttonText: { color: ui.onAccent, fontWeight: '700', fontSize: 16 },
  bioButton: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: ui.lime,
    padding: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  bioButtonText: { color: ui.lime, fontWeight: '700', fontSize: 16, textAlign: 'center' },
  linkBtn: { marginTop: 12, alignItems: 'center', paddingVertical: 4 },
  linkText: { color: ui.blueHi, fontSize: 14 },
  linkMuted: { color: ui.muted, fontSize: 14, textDecorationLine: 'underline' },
  infoBox: {
    marginTop: 20,
    padding: 14,
    borderRadius: 8,
    backgroundColor: ui.panel,
    borderWidth: 1,
    borderColor: ui.line,
    gap: 6,
    width: '100%',
    alignSelf: 'stretch',
  },
  infoTitle: { color: ui.ink, fontWeight: '700', fontSize: 14, flexShrink: 1 },
  infoText: { color: ui.muted, fontSize: 13, lineHeight: 19, flexShrink: 1, width: '100%' },
});
