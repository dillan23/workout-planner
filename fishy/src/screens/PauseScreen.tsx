import { StyleSheet, Text, View } from 'react-native';

import { PrimaryButton, SecondaryButton } from '../ui/Controls';
import { theme } from '../ui/theme';

export function PauseScreen({ onResume, onMenu }: { onResume: () => void; onMenu: () => void }) {
  return (
    <View style={styles.root}>
      <Text style={styles.title}>Paused</Text>
      <PrimaryButton label="Resume" onPress={onResume} />
      <SecondaryButton label="Menu" onPress={onMenu} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    backgroundColor: theme.surface,
  },
  title: {
    color: theme.ink,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
});
