import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  DEFAULT_SETTINGS,
  NO_HIGH_SCORE,
  parseHighScore,
  parseSettings,
  type HighScore,
  type PersistedSettings,
} from './persistedData';

/**
 * Reading and writing what the game remembers.
 *
 * Reads are forgiving: parsing lives in `persistedData` and always yields a
 * usable value, and a storage failure falls back the same way. Writes are fire
 * and forget, because a high score that fails to save is not a reason to
 * interrupt a game over screen.
 */
const KEY_HIGH_SCORE = 'fishy.highScore.v1';
const KEY_SETTINGS = 'fishy.settings.v1';

export {
  DEFAULT_SETTINGS,
  NO_HIGH_SCORE,
  parseHighScore,
  parseSettings,
  type HighScore,
  type PersistedSettings,
};

export async function loadHighScore(): Promise<HighScore> {
  try {
    return parseHighScore(await AsyncStorage.getItem(KEY_HIGH_SCORE));
  } catch {
    return NO_HIGH_SCORE;
  }
}

export async function saveHighScore(value: HighScore): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY_HIGH_SCORE, JSON.stringify(value));
  } catch {
    // A lost high score is not worth surfacing mid-run.
  }
}

export async function loadSettings(): Promise<PersistedSettings> {
  try {
    return parseSettings(await AsyncStorage.getItem(KEY_SETTINGS));
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(value: PersistedSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY_SETTINGS, JSON.stringify(value));
  } catch {
    // Same: a setting that fails to persist still applies for this session.
  }
}
