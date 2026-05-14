/**
 * Vanilla DOOM 1.9 volume controls contract.
 *
 * From Chocolate Doom 2.2.1 s_sound.c and the sound options menu in
 * m_menu.c:
 *
 *   Two independent volume sliders are exposed through the Sound
 *   Volume menu and persisted via the snd_SfxVolume and snd_MusicVolume
 *   default.cfg variables:
 *
 *     snd_SfxVolume   — range 0..15 (4-bit) controlling all sfx voices.
 *     snd_MusicVolume — range 0..15 (4-bit) controlling the music driver.
 *
 *   The menu displays each slider as a 16-step bar (0..15) and the
 *   keyboard ±-arrow input increments / decrements by 1 with sfx_stnmov
 *   playing on every nudge.  Values clamp at the [0, 15] boundary; the
 *   slider does not wrap.
 *
 *   Volume application is done at S_StartSoundAtVolume / S_UpdateSounds
 *   time — the persisted snd_SfxVolume scales the channel's effective
 *   volume.  Music volume is pushed to the driver via I_SetMusicVolume
 *   on every change (in m_menu.c the slider handler calls
 *   I_SetMusicVolume(snd_MusicVolume * 8) — vanilla DMX scales the
 *   external 0..15 range up to its internal 0..127 register space).
 *
 *   Mute semantics: 0 means SILENT, not "default".  Vanilla's
 *   S_AdjustSoundParams returns audible=false when snd_SfxVolume == 0
 *   AND the sfx is non-link, so all sfx channels stop immediately.
 *   Music volume 0 mutes the OPL output by writing zeros to the
 *   per-operator KSL/Total Level registers without halting the
 *   sequencer.
 */

export const VANILLA_SND_SFX_VOLUME_MIN = 0;
export const VANILLA_SND_SFX_VOLUME_MAX = 15;
export const VANILLA_SND_MUSIC_VOLUME_MIN = 0;
export const VANILLA_SND_MUSIC_VOLUME_MAX = 15;

export const VANILLA_SOUND_VOLUME_MENU_STEP_COUNT = 16;
export const VANILLA_MUSIC_VOLUME_DMX_SCALE_FACTOR = 8;
export const VANILLA_MUSIC_VOLUME_DMX_MAX = 127;

export function clampVanillaSoundVolume(value: number): number {
  if (!Number.isInteger(value)) {
    throw new RangeError(`sound volume must be integer, got ${value}`);
  }
  if (value < VANILLA_SND_SFX_VOLUME_MIN) {
    return VANILLA_SND_SFX_VOLUME_MIN;
  }
  if (value > VANILLA_SND_SFX_VOLUME_MAX) {
    return VANILLA_SND_SFX_VOLUME_MAX;
  }
  return value;
}

export function vanillaMusicVolumeToDmxRegisterValue(externalVolume: number): number {
  const clamped = clampVanillaSoundVolume(externalVolume);
  return clamped * VANILLA_MUSIC_VOLUME_DMX_SCALE_FACTOR;
}
