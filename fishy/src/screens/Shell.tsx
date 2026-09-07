import { useCallback, useRef, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import type { SkSize } from '@shopify/react-native-skia';
import { runOnJS, useAnimatedReaction, useSharedValue } from 'react-native-reanimated';

import { P_EATEN, P_SCORE, CONTROL_DRAG, CONTROL_JOYSTICK } from '../game/state';
import { RUN_ATTRACT, RUN_DEAD, RUN_PLAYING, useGameLoop } from '../game/useGameLoop';
import { useGameAudio } from '../audio/useGameAudio';
import { useHaptics } from '../audio/useHaptics';
import { usePersistence } from '../state/usePersistence';
import { NO_HIGH_SCORE, type HighScore } from '../state/storage';
import { GameCanvas } from './GameCanvas';
import { GameOverScreen } from './GameOverScreen';
import { Hud } from './Hud';
import { PauseScreen } from './PauseScreen';
import { SettingsScreen } from './SettingsScreen';
import { TitleScreen } from './TitleScreen';

type Screen = 'title' | 'playing' | 'paused' | 'gameover' | 'settings';

/**
 * The whole app, as one canvas with screens layered over it.
 *
 * There is no navigator and nothing unmounts. The pond swims behind the title,
 * the pause overlay and the game over card alike, and starting a run is a
 * handful of buffer writes rather than a scene being built. That is what makes
 * Retry instant with no flash, and it is why the screen is a piece of React
 * state rather than a route.
 *
 * React renders here only when a person does something: a button, a toggle, or
 * a death. Never the frame loop.
 */
export function Shell() {
  const { height } = useWindowDimensions();
  const size = useSharedValue<SkSize>({ width: 0, height: 0 });
  const game = useGameLoop(size);
  const { settings, highScore, ready, setSetting, submitRun, resetHighScore } = usePersistence();
  const audio = useGameAudio(settings.sound);
  const haptics = useHaptics(settings.haptics);

  const [screen, setScreen] = useState<Screen>('title');
  const [lastRun, setLastRun] = useState<HighScore>(NO_HIGH_SCORE);
  const [wasBest, setWasBest] = useState(false);
  // Where to return to when settings closes: the title, or a paused game.
  const settingsOrigin = useRef<Screen>('title');

  const handleBite = useCallback(() => {
    audio.playBite();
    haptics.bite();
  }, [audio, haptics]);

  const handleDeath = useCallback(
    (eaten: number, score: number) => {
      audio.playDeath();
      haptics.death();
      const run: HighScore = { score: Math.round(score), eaten: Math.round(eaten) };
      setLastRun(run);
      setWasBest(submitRun(run));
      setScreen('gameover');
    },
    [audio, haptics, submitRun],
  );

  // The eaten counter only moves when a fish is eaten, so this fires exactly
  // once per bite rather than being polled on a frame.
  useAnimatedReaction(
    () => game.eaten.value,
    (count, previous) => {
      if (previous !== null && count > previous) {
        runOnJS(handleBite)();
      }
    },
    [handleBite],
  );

  // The one place the simulation is allowed to reach React. Death is a single
  // event per run, not a per-frame update.
  //
  // The run's numbers are read here, on the UI thread, and handed across as
  // arguments. Reading `game.player.value` from the JS side would return the
  // JS-side copy of the buffer, which the simulation never writes to, and the
  // game over screen would faithfully report a score of zero every time.
  useAnimatedReaction(
    () => game.runState.value,
    (state, previous) => {
      if (state === RUN_DEAD && previous !== RUN_DEAD) {
        const p = game.player.value;
        runOnJS(handleDeath)(p[P_EATEN], p[P_SCORE]);
      }
    },
    [handleDeath],
  );

  const startRun = useCallback(() => {
    game.begin();
    game.setPaused(false);
    audio.startAmbient();
    setScreen('playing');
  }, [audio, game]);

  const toMenu = useCallback(() => {
    game.runState.value = RUN_ATTRACT;
    game.setPaused(false);
    audio.stopAmbient();
    setScreen('title');
  }, [audio, game]);

  const pause = useCallback(() => {
    game.setPaused(true);
    audio.stopAmbient();
    setScreen('paused');
  }, [audio, game]);

  const resume = useCallback(() => {
    game.setPaused(false);
    audio.startAmbient();
    setScreen('playing');
  }, [audio, game]);

  const openSettings = useCallback(() => {
    settingsOrigin.current = screen === 'playing' || screen === 'paused' ? 'paused' : 'title';
    if (screen === 'playing') {
      game.setPaused(true);
    }
    setScreen('settings');
  }, [game, screen]);

  const closeSettings = useCallback(() => {
    setScreen(settingsOrigin.current);
  }, []);

  const scheme = settings.joystick ? CONTROL_JOYSTICK : CONTROL_DRAG;

  return (
    <View style={styles.root}>
      <GameCanvas game={game} size={size} screenHeight={height} scheme={scheme} />

      {screen === 'playing' ? <Hud game={game} onPause={pause} /> : null}

      {screen === 'title' && ready ? (
        <View style={styles.overlay}>
          <TitleScreen highScore={highScore} onPlay={startRun} onSettings={openSettings} />
        </View>
      ) : null}

      {screen === 'paused' ? (
        <View style={styles.overlay}>
          <PauseScreen onResume={resume} onMenu={toMenu} />
        </View>
      ) : null}

      {screen === 'gameover' ? (
        <View style={styles.overlay}>
          <GameOverScreen
            run={lastRun}
            highScore={highScore}
            isBest={wasBest}
            onRetry={startRun}
            onMenu={toMenu}
          />
        </View>
      ) : null}

      {screen === 'settings' ? (
        <View style={styles.overlay}>
          <SettingsScreen
            settings={settings}
            hasHighScore={highScore.score > 0}
            onChange={setSetting}
            onResetHighScore={resetHighScore}
            onBack={closeSettings}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
});
