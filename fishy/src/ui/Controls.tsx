import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from './theme';

export function PrimaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
    >
      <Text style={styles.primaryLabel}>{label}</Text>
    </Pressable>
  );
}

export function SecondaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
    >
      <Text style={styles.secondaryLabel}>{label}</Text>
    </Pressable>
  );
}

/** A small round button for the corners: pause, settings, back. */
export function IconButton({
  glyph,
  label,
  onPress,
}: {
  glyph: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={12}
      style={({ pressed }) => [styles.icon, pressed && styles.pressed]}
    >
      <Text style={styles.iconGlyph}>{glyph}</Text>
    </Pressable>
  );
}

export function SettingRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        {hint ? <Text style={styles.rowHint}>{hint}</Text> : null}
      </View>
      {children}
    </View>
  );
}

export function Switch({
  value,
  onChange,
  label,
}: {
  value: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <Pressable
      onPress={() => onChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      hitSlop={8}
      style={[styles.track, value && styles.trackOn]}
    >
      <View style={[styles.thumb, value && styles.thumbOn]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  primary: {
    backgroundColor: theme.accent,
    paddingVertical: 15,
    paddingHorizontal: 46,
    borderRadius: 999,
    minWidth: 200,
    alignItems: 'center',
  },
  primaryLabel: {
    color: theme.accentInk,
    fontSize: 19,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  secondary: {
    paddingVertical: 13,
    paddingHorizontal: 30,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.line,
    minWidth: 140,
    alignItems: 'center',
  },
  secondaryLabel: { color: theme.ink, fontSize: 16, fontWeight: '600' },
  icon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.line,
  },
  iconGlyph: { color: theme.ink, fontSize: 17, lineHeight: 20 },
  pressed: { opacity: 0.7 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.line,
    gap: 16,
  },
  rowText: { flex: 1 },
  rowLabel: { color: theme.ink, fontSize: 16, fontWeight: '600' },
  rowHint: { color: theme.inkDim, fontSize: 13, marginTop: 3, lineHeight: 17 },
  track: {
    width: 52,
    height: 31,
    borderRadius: 999,
    padding: 3,
    backgroundColor: 'rgba(234, 244, 251, 0.18)',
    justifyContent: 'center',
  },
  trackOn: { backgroundColor: theme.accent },
  thumb: {
    width: 25,
    height: 25,
    borderRadius: 999,
    backgroundColor: theme.ink,
  },
  thumbOn: { alignSelf: 'flex-end', backgroundColor: theme.accentInk },
});
