import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme';

/** Štatistiky — zatiaľ prázdny obsah (pripravuje sa). */
export default function StatisticsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>📊</Text>
      <Text style={styles.title}>Štatistiky</Text>
      <Text style={styles.subtitle}>Pripravujeme.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.club50, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emoji: { fontSize: 48, marginBottom: 12 },
  title: { fontSize: 22, fontWeight: '700', color: colors.club900, marginBottom: 6 },
  subtitle: { fontSize: 15, color: colors.gray },
});
