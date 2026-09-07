import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton, SecondaryButton, SettingRow, Switch } from '../ui/Controls';
import { theme } from '../ui/theme';
import type { PersistedSettings } from '../state/storage';

export function SettingsScreen({
  settings,
  hasHighScore,
  onChange,
  onResetHighScore,
  onBack,
}: {
  settings: PersistedSettings;
  hasHighScore: boolean;
  onChange: <K extends keyof PersistedSettings>(key: K, value: PersistedSettings[K]) => void;
  onResetHighScore: () => void;
  onBack: () => void;
}) {
  const insets = useSafeAreaInsets();
  // Wiping a high score is the one irreversible thing in the app, so it asks.
  const [confirmingReset, setConfirmingReset] = useState(false);

  return (
    <View style={[styles.root, { paddingTop: insets.top + 12, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <IconButton glyph="←" label="Back" onPress={onBack} />
        <Text style={styles.title}>Settings</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        <SettingRow
          label="Virtual joystick"
          hint={
            settings.joystick
              ? 'A stick appears wherever your thumb lands.'
              : 'Drag anywhere and the fish swims to your finger.'
          }
        >
          <Switch
            label="Virtual joystick"
            value={settings.joystick}
            onChange={(next) => onChange('joystick', next)}
          />
        </SettingRow>

        <SettingRow label="Sound" hint="Ambient track, bites and the thud.">
          <Switch
            label="Sound"
            value={settings.sound}
            onChange={(next) => onChange('sound', next)}
          />
        </SettingRow>

        <SettingRow label="Haptics" hint="A tap on every bite, a knock on death.">
          <Switch
            label="Haptics"
            value={settings.haptics}
            onChange={(next) => onChange('haptics', next)}
          />
        </SettingRow>

        <View style={styles.danger}>
          {confirmingReset ? (
            <View style={styles.confirm}>
              <Text style={styles.confirmText}>Erase your best run for good?</Text>
              <View style={styles.confirmRow}>
                <SecondaryButton
                  label="Erase"
                  onPress={() => {
                    onResetHighScore();
                    setConfirmingReset(false);
                  }}
                />
                <SecondaryButton label="Keep" onPress={() => setConfirmingReset(false)} />
              </View>
            </View>
          ) : (
            <SecondaryButton
              label={hasHighScore ? 'Reset high score' : 'No high score yet'}
              onPress={() => hasHighScore && setConfirmingReset(true)}
            />
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.surface, paddingHorizontal: 24 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: theme.ink, fontSize: 19, fontWeight: '700', letterSpacing: 0.5 },
  headerSpacer: { width: 42 },
  list: { paddingTop: 14, paddingBottom: 40 },
  danger: { marginTop: 34, alignItems: 'center' },
  confirm: { alignItems: 'center', gap: 14 },
  confirmText: { color: theme.inkDim, fontSize: 14 },
  confirmRow: { flexDirection: 'row', gap: 12 },
});
