import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

/**
 * Every sound the game makes, and the players that make them.
 *
 * The bite has a small pool of players rather than one. Seeking a single player
 * back to the start cuts off the bite already sounding, and at apex the player
 * can eat twice a second, so a pool lets one bite ring out while the next
 * starts. Three is enough to cover the fastest feeding without stacking into
 * mush.
 */
const BITE_VOICES = 3;

export const AMBIENT_VOLUME = 0.35;
export const BITE_VOLUME = 0.7;
export const DEATH_VOLUME = 0.85;

export interface Sounds {
  readonly ambient: AudioPlayer;
  readonly bites: AudioPlayer[];
  readonly death: AudioPlayer;
  readonly release: () => void;
}

export function createSounds(): Sounds {
  // Play through the silent switch: this is a game, and a muted phone should
  // not silently disable a feature the settings screen says is on.
  void setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false }).catch(
    () => undefined,
  );

  const ambient = createAudioPlayer(require('../../assets/audio/ambient-loop.wav'));
  ambient.loop = true;
  ambient.volume = AMBIENT_VOLUME;

  const bites: AudioPlayer[] = [];
  for (let i = 0; i < BITE_VOICES; i++) {
    const voice = createAudioPlayer(require('../../assets/audio/bite.wav'));
    voice.volume = BITE_VOLUME;
    bites.push(voice);
  }

  const death = createAudioPlayer(require('../../assets/audio/death.wav'));
  death.volume = DEATH_VOLUME;

  return {
    ambient,
    bites,
    death,
    release: () => {
      ambient.remove();
      death.remove();
      for (const voice of bites) {
        voice.remove();
      }
    },
  };
}
