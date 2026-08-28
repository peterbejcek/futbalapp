import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { api, getToken, setToken } from '@/api';
import { colors } from '@/theme';

const logo = require('../assets/logo.png');

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    getToken().then((token) => {
      if (token) router.replace('/dashboard');
      else setChecking(false);
    });
  }, [router]);

  async function onLogin() {
    setError(null);
    setLoading(true);
    try {
      const result = await api<{ accessToken: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      await setToken(result.accessToken);
      router.replace('/dashboard');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Prihlásenie zlyhalo');
    } finally {
      setLoading(false);
    }
  }

  async function onForgot() {
    if (!email) {
      setError('Zadajte e-mail a znova klepnite na „Zabudli ste heslo?".');
      return;
    }
    setError(null);
    try {
      await api('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });
      setError(null);
      Alert.alert('Obnovenie hesla', `Ak je e-mail ${email} v systéme, poslali sme naň odkaz na nové heslo. Skontrolujte aj spam.`);
    } catch {
      Alert.alert('Obnovenie hesla', 'Ak je e-mail v systéme, poslali sme naň odkaz.');
    }
  }

  if (checking) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.club600} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Image source={logo} style={styles.logo} resizeMode="contain" />
      <Text style={styles.title}>Prihlásenie do portálu</Text>
      <TextInput
        style={styles.input}
        placeholder="E-mail"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Heslo"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      {error && <Text style={styles.error}>{error}</Text>}
      <Pressable style={styles.button} onPress={onLogin} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? 'Prihlasujem…' : 'Prihlásiť sa'}</Text>
      </Pressable>
      <Pressable style={styles.forgotBtn} onPress={onForgot}>
        <Text style={styles.forgotText}>Zabudli ste heslo?</Text>
      </Pressable>
      <Pressable
        style={styles.registerBtn}
        onPress={() => Linking.openURL('https://fkknv.sk/registracia')}
      >
        <Text style={styles.registerText}>Registrácia do klubu</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.club50, padding: 24, justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  logo: { width: 110, height: 176, alignSelf: 'center', marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '700', color: colors.club900, marginBottom: 24, textAlign: 'center' },
  input: {
    backgroundColor: colors.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.club100,
    padding: 14,
    marginBottom: 12,
    fontSize: 16,
  },
  error: { color: colors.danger, marginBottom: 12, textAlign: 'center' },
  button: { backgroundColor: colors.club600, borderRadius: 8, padding: 16, alignItems: 'center' },
  buttonText: { color: colors.white, fontWeight: '700', fontSize: 16 },
  forgotBtn: { marginTop: 12, alignItems: 'center' },
  forgotText: { color: colors.club600, fontSize: 14 },
  registerBtn: { marginTop: 10, padding: 12, alignItems: 'center' },
  registerText: { color: colors.club700, fontWeight: '600', fontSize: 15, textDecorationLine: 'underline' },
});
