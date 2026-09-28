import { View } from 'react-native';
import { colors } from './theme';

/**
 * Malý štvorček vo farbe dresu — tmavý (tmavomodrý) alebo svetlý (biely).
 * Bez závislosti na react-native-svg (v projekte nie je).
 */
export function JerseySwatch({ color, size = 14 }: { color: 'DARK' | 'LIGHT'; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 3,
        backgroundColor: color === 'DARK' ? colors.club900 : colors.white,
        borderWidth: 1,
        borderColor: color === 'DARK' ? colors.club900 : colors.gray,
      }}
    />
  );
}
