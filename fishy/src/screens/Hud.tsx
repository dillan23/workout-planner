import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { GameLoop } from '../game/useGameLoop';
import { IconButton } from '../ui/Controls';
import { LiveNumber } from '../ui/LiveNumber';
import { theme } from '../ui/theme';

/**
 * Fish eaten and score, top centre, with the pause button out of the way in the
 * corner.
 *
 * Both counters are driven straight from shared values, so eating a fish never
 * renders anything: the numbers change on the same thread the simulation runs
 * on. The row is `pointerEvents: none` so the whole screen stays draggable
 * underneath it, which matters when the play area is the entire display.
 */
export function Hud({ game, onPause }: { game: GameLoop; onPause: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
      <View style={styles.readout} pointerEvents="none">
        <View style={styles.item}>
          <LiveNumber value={game.eaten} style={[styles.value, styles.valueEaten]} />
          <Text style={styles.label}>fish</Text>
        </View>
        <View style={styles.item}>
          <LiveNumber value={game.score} style={[styles.value, styles.valueScore]} />
          <Text style={styles.label}>score</Text>
        </View>
      </View>
      <View style={styles.corner}>
        <IconButton glyph="❚❚" label="Pause" onPress={onPause} />
      </View>
      {__DEV__ ? (
        <View style={styles.meter} pointerEvents="none">
          <LiveNumber value={game.meter.fps} style={styles.meterText} />
          <Text style={styles.meterText}>fps · worst</Text>
          <LiveNumber value={game.meter.worstMs} style={styles.meterText} />
          <Text style={styles.meterText}>ms</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 16 },
  readout: {
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 22,
    alignItems: 'flex-end',
  },
  item: { flexDirection: 'row', alignItems: 'baseline', gap: 5 },
  // Widths are explicit because a TextInput on the web takes a default
  // intrinsic width of about twenty characters, which pushed the score clean
  // off the side of the screen. Sized for the largest value each can reach.
  value: {
    color: theme.ink,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'right',
  },
  valueEaten: { width: 34 },
  valueScore: { width: 64 },
  label: { color: theme.inkDim, fontSize: 12 },
  corner: { position: 'absolute', right: 16, top: 0, paddingTop: 8 },
  // Development builds only: the instrument for the performance pass, not a
  // feature. Release builds strip the whole block.
  meter: { position: 'absolute', left: 16, top: 0, paddingTop: 12, flexDirection: 'row', gap: 4 },
  meterText: { color: theme.inkDim, fontSize: 11, minWidth: 0 },
});
