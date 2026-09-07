import { useCallback, useEffect, useRef } from 'react';

import { createSounds, type Sounds } from './sounds';

/**
 * The game's voice.
 *
 * Created once and kept for the life of the app, because building a player
 * takes long enough to be heard as a gap on the first bite of a run. Muting
 * pauses the ambient bed and drops one-shots on the floor rather than tearing
 * the players down, so the toggle is instant in both directions.
 */
export interface GameAudio {
  readonly playBite: () => void;
  readonly playDeath: () => void;
  readonly startAmbient: () => void;
  readonly stopAmbient: () => void;
}

export function useGameAudio(enabled: boolean): GameAudio {
  const soundsRef = useRef<Sounds | null>(null);
  const enabledRef = useRef(enabled);
  const ambientWantedRef = useRef(false);
  const biteVoiceRef = useRef(0);

  useEffect(() => {
    let sounds: Sounds | null = null;
    try {
      sounds = createSounds();
      soundsRef.current = sounds;
    } catch {
      // A device that cannot open the audio session still plays the game.
      soundsRef.current = null;
    }
    return () => {
      soundsRef.current = null;
      sounds?.release();
    };
  }, []);

  useEffect(() => {
    enabledRef.current = enabled;
    const sounds = soundsRef.current;
    if (!sounds) {
      return;
    }
    if (enabled && ambientWantedRef.current) {
      sounds.ambient.play();
    } else {
      sounds.ambient.pause();
    }
  }, [enabled]);

  const playBite = useCallback(() => {
    const sounds = soundsRef.current;
    if (!sounds || !enabledRef.current) {
      return;
    }
    // Round robin, so a bite never cuts off the one before it.
    const voice = sounds.bites[biteVoiceRef.current];
    biteVoiceRef.current = (biteVoiceRef.current + 1) % sounds.bites.length;
    voice.seekTo(0).catch(() => undefined);
    voice.play();
  }, []);

  const playDeath = useCallback(() => {
    const sounds = soundsRef.current;
    if (!sounds || !enabledRef.current) {
      return;
    }
    sounds.death.seekTo(0).catch(() => undefined);
    sounds.death.play();
  }, []);

  const startAmbient = useCallback(() => {
    ambientWantedRef.current = true;
    if (enabledRef.current) {
      soundsRef.current?.ambient.play();
    }
  }, []);

  const stopAmbient = useCallback(() => {
    ambientWantedRef.current = false;
    soundsRef.current?.ambient.pause();
  }, []);

  return { playBite, playDeath, startAmbient, stopAmbient };
}
