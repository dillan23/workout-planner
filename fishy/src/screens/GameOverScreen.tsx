import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton, SecondaryButton } from '../ui/Controls';
import { theme } from '../ui/theme';
import type { HighScore } from '../state/storage';

export function GameOverScreen({
  run,
  highScore,
  isBest,
  onRetry,
  onMenu,
}: {
  run: HighScore;
  highScore: HighScore;
  isBest: boolean;
  onRetry: () => void;
  onMenu: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom + 28 }]}>
      <View style={styles.card}>
        <Text style={styles.heading}>{isBest ? 'New best' : 'Eaten'}</Text>

        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{run.eaten}</Text>
            <Text style={styles.statLabel}>fish eaten</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{run.score.toLocaleString()}</Text>
            <Text style={styles.statLabel}>score</Text>
          </View>
        </View>

        <Text style={styles.best}>
          Best {highScore.score.toLocaleString()} · {highScore.eaten} fish
        </Text>
      </View>

      <View style={styles.actions}>
        <PrimaryButton label="Retry" onPress={onRetry} />
        <SecondaryButton label="Menu" onPress={onMenu} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 26, justifyContent: 'center', gap: 34 },
  card: {
    backgroundColor: theme.panel,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: theme.line,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  heading: {
    color: theme.accent,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  stats: { flexDirection: 'row', alignItems: 'center', marginTop: 20 },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { color: theme.ink, fontSize: 40, fontWeight: '800' },
  statLabel: { color: theme.inkDim, fontSize: 13, marginTop: 2 },
  divider: { width: 1, height: 44, backgroundColor: theme.line },
  best: { color: theme.inkDim, fontSize: 14, marginTop: 20 },
  actions: { alignItems: 'center', gap: 14 },
});
