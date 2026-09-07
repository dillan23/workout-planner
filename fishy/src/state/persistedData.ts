/**
 * The shapes the game persists, and how to read them back safely.
 *
 * Deliberately free of any storage import, so it is pure data handling that can
 * be tested against the junk that actually turns up on a device: a half-written
 * file, a key from an older build, a field of the wrong type. Every one of
 * those has to read as a sane default rather than a crash on launch.
 */

export interface PersistedSettings {
  readonly joystick: boolean;
  readonly sound: boolean;
  readonly haptics: boolean;
}

export const DEFAULT_SETTINGS: PersistedSettings = {
  joystick: false,
  sound: true,
  haptics: true,
};

export interface HighScore {
  readonly score: number;
  readonly eaten: number;
}

export const NO_HIGH_SCORE: HighScore = { score: 0, eaten: 0 };

export function parseHighScore(raw: string | null): HighScore {
  try {
    if (!raw) {
      return NO_HIGH_SCORE;
    }
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) {
      return NO_HIGH_SCORE;
    }
    const { score, eaten } = parsed as Partial<HighScore>;
    return {
      score: typeof score === 'number' && Number.isFinite(score) && score >= 0 ? score : 0,
      eaten: typeof eaten === 'number' && Number.isFinite(eaten) && eaten >= 0 ? eaten : 0,
    };
  } catch {
    return NO_HIGH_SCORE;
  }
}

export function parseSettings(raw: string | null): PersistedSettings {
  try {
    if (!raw) {
      return DEFAULT_SETTINGS;
    }
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) {
      return DEFAULT_SETTINGS;
    }
    const stored = parsed as Partial<PersistedSettings>;
    // Each key falls back on its own, so one bad field does not discard the
    // rest of a person's preferences.
    return {
      joystick: typeof stored.joystick === 'boolean' ? stored.joystick : DEFAULT_SETTINGS.joystick,
      sound: typeof stored.sound === 'boolean' ? stored.sound : DEFAULT_SETTINGS.sound,
      haptics: typeof stored.haptics === 'boolean' ? stored.haptics : DEFAULT_SETTINGS.haptics,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}
