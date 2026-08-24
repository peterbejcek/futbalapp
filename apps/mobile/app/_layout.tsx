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
        <Stack.Screen name="index" options={{ title: 'FK KNV' }} />
        <Stack.Screen name="dashboard" options={{ title: 'Prehľad' }} />
        <Stack.Screen name="event/new" options={{ title: 'Nová udalosť' }} />
        <Stack.Screen name="event/[id]/attendance" options={{ title: 'Dochádzka' }} />
        <Stack.Screen name="statistics" options={{ title: 'Štatistiky' }} />
        <Stack.Screen name="tasks/index" options={{ title: 'Úlohy' }} />
        <Stack.Screen name="match/[id]/index" options={{ title: 'Zápas' }} />
        <Stack.Screen name="match/[id]/nomination" options={{ title: 'Nominácia' }} />
        <Stack.Screen name="chat/index" options={{ title: 'Kanály' }} />
        <Stack.Screen name="chat/[id]" options={{ title: 'Chat' }} />
      </Stack>
    </>
  );
}
