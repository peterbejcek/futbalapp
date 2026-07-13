import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { colors } from '@/theme';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.club800 },
          headerTintColor: colors.white,
        }}
      >
        <Stack.Screen name="index" options={{ title: 'FK Košická Nová Ves' }} />
        <Stack.Screen name="dashboard" options={{ title: 'Prehľad' }} />
      </Stack>
    </>
  );
}
