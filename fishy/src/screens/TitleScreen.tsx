import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton, PrimaryButton } from '../ui/Controls';
import { theme } from '../ui/theme';
import type { HighScore } from '../state/storage';

export function TitleScreen({
  highScore,
  onPlay,
  onSettings,
}: {
  highScore: HighScore;
  onPlay: () => void;
  onSettings: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 28 }]}>
      <View style={styles.corner}>
        <IconButton glyph="⚙" label="Settings" onPress={onSettings} />
      </View>

      <View style={styles.middle}>
        <Text style={styles.title}>FISHY</Text>
        <Text style={styles.tagline}>Eat, or be eaten.</Text>
      </View>

      <View style={styles.bottom}>
        <PrimaryButton label="Play" onPress={onPlay} />
        {highScore.score > 0 ? (
          <Text style={styles.best}>
            Best {highScore.score.toLocaleString()} · {highScore.eaten} fish
          </Text>
        ) : (
          <Text style={styles.best}>No run yet</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 26, justifyContent: 'space-between' },
  corner: { alignItems: 'flex-end' },
  middle: { alignItems: 'center' },
  title: {
    color: theme.ink,
    fontSize: 62,
    fontWeight: '800',
    letterSpacing: 10,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 12,
  },
  tagline: { color: theme.inkDim, fontSize: 15, marginTop: 6, letterSpacing: 1.4 },
  bottom: { alignItems: 'center', gap: 16 },
  best: { color: theme.inkDim, fontSize: 14 },
});
