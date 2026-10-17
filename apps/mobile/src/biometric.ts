import { Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';

export interface BiometricInfo {
  /** Zariadenie má senzor a používateľ má zapísaný odtlačok/tvár. */
  available: boolean;
  /** Text do tlačidla, napr. „odtlačkom“, „Face ID“, „odtlačkom / Face ID“. */
  label: string;
}

/** Zistí, či je biometria dostupná a ako ju pomenovať v UI. Nikdy nevyhodí chybu. */
export async function getBiometricInfo(): Promise<BiometricInfo> {
  try {
    const [hasHw, enrolled] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
    ]);
    if (!hasHw || !enrolled) return { available: false, label: 'odtlačkom / Face ID' };
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    const T = LocalAuthentication.AuthenticationType;
    const finger = types.includes(T.FINGERPRINT);
    const face = types.includes(T.FACIAL_RECOGNITION);
    const faceLabel = Platform.OS === 'ios' ? 'Face ID' : 'tvárou';
    let label = 'odtlačkom / Face ID';
    if (finger && face) label = `odtlačkom / ${faceLabel}`;
    else if (face) label = faceLabel;
    else if (finger) label = Platform.OS === 'ios' ? 'Touch ID' : 'odtlačkom';
    else if (types.includes(T.IRIS)) label = 'dúhovkou';
    return { available: true, label };
  } catch {
    return { available: false, label: 'odtlačkom / Face ID' };
  }
}

/** Spustí systémové biometrické overenie. Vráti true pri úspechu. */
export async function authenticateBiometric(): Promise<boolean> {
  try {
    const res = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Prihlásenie do portálu FK KNV',
      cancelLabel: 'Zrušiť',
      fallbackLabel: 'Použiť kód zariadenia',
      disableDeviceFallback: false,
    });
    return res.success;
  } catch {
    return false;
  }
}
