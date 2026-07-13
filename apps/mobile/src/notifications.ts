import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { api } from './api';

/**
 * Registrácia zariadenia na push notifikácie (nové správy, nominácie,
 * upomienky). Volá sa po prihlásení; na simulátore/webe ticho preskočí.
 */
export async function registerForPushNotifications(): Promise<void> {
  try {
    if (!Device.isDevice) return; // push funguje len na fyzickom zariadení

    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (existing !== 'granted') {
      ({ status } = await Notifications.requestPermissionsAsync());
    }
    if (status !== 'granted') return;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'FKKNV',
        importance: Notifications.AndroidImportance.HIGH,
        lightColor: '#1b4a25',
      });
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    const { data: token } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );

    await api('/notifications/token', {
      method: 'POST',
      body: JSON.stringify({ token, platform: Platform.OS === 'ios' ? 'ios' : 'android' }),
    });
  } catch {
    // push nie je kritický — appka funguje aj bez neho
  }
}
