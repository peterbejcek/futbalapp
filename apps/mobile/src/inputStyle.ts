import type { TextInputProps, TextStyle } from 'react-native';
import { ui } from '@/theme';

/** Spoločné props pre TextInput na tmavom podklade (explicitná farba písma — Android dark mode inak dá biele na bielom). */
export const inputProps: Pick<TextInputProps, 'placeholderTextColor' | 'selectionColor' | 'cursorColor' | 'keyboardAppearance'> = {
  placeholderTextColor: ui.placeholder,
  selectionColor: ui.blue,
  cursorColor: ui.blue,
  keyboardAppearance: 'dark',
};

/** Základný štýl vstupu: panel, okraj, svetlé písmo. */
export const inputStyle: TextStyle = {
  color: ui.ink,
  backgroundColor: ui.panel,
  borderWidth: 1,
  borderColor: ui.line,
  borderRadius: 8,
  padding: 10,
  fontSize: 15,
};
