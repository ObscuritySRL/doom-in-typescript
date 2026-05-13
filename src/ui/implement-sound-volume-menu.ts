/**
 * Vanilla DOOM 1.9 sound volume menu contract.
 *
 * From Chocolate Doom 2.2.1 m_menu.c SoundMenu:
 *
 *   enum
 *   {
 *       sfx_vol,
 *       sfx_empty1,
 *       music_vol,
 *       sfx_empty2,
 *       sound_end
 *   } sound_e;
 *
 *   menuitem_t SoundMenu[] =
 *   {
 *       { 2, "M_SFXVOL", M_SfxVol,   's' },
 *       {-1, "",          0,          0  },
 *       { 2, "M_MUSVOL", M_MusicVol, 'm' },
 *       {-1, "",          0,          0  }
 *   };
 *
 * Notes for parity:
 *   - Two slider entries: SFX volume and music volume; each is followed by a
 *     trailing separator slot (status byte -1) to leave space for the slider draw.
 *   - Both sliders use status byte 2 (sizable).
 *   - The hotkey for SFX volume is 's', for music volume is 'm'.
 *   - Volume range is 0..15 (16 levels). M_DrawSound from m_menu.c renders the
 *     slider bar with `16` total slots, each 8 pixels wide.
 *   - The internal volume variables snd_SfxVolume and snd_MusicVolume both
 *     range over [0, 15].
 *   - Clicking left/right at index 0 (SFX) calls M_SfxVol with arrow direction;
 *     clicking left/right at index 2 (music) calls M_MusicVol.
 */

export type VanillaSoundVolumeKind = 'slider' | 'separator';

export interface VanillaSoundVolumeMenuItem {
  readonly kind: VanillaSoundVolumeKind;
  readonly lumpName: string;
  readonly routine: string | null;
  readonly hotkey: string | null;
  readonly statusByte: number;
}

const SFX_SLIDER: VanillaSoundVolumeMenuItem = Object.freeze({ kind: 'slider', lumpName: 'M_SFXVOL', routine: 'M_SfxVol', hotkey: 's', statusByte: 2 });
const MUSIC_SLIDER: VanillaSoundVolumeMenuItem = Object.freeze({ kind: 'slider', lumpName: 'M_MUSVOL', routine: 'M_MusicVol', hotkey: 'm', statusByte: 2 });
const SEPARATOR: VanillaSoundVolumeMenuItem = Object.freeze({ kind: 'separator', lumpName: '', routine: null, hotkey: null, statusByte: -1 });

export const VANILLA_SOUND_VOLUME_MENU_TREE: readonly VanillaSoundVolumeMenuItem[] = Object.freeze([SFX_SLIDER, SEPARATOR, MUSIC_SLIDER, SEPARATOR]);

export const VANILLA_SOUND_VOLUME_ENTRY_COUNT = 4;
export const VANILLA_SOUND_VOLUME_MIN = 0;
export const VANILLA_SOUND_VOLUME_MAX = 15;
export const VANILLA_SOUND_VOLUME_SLOT_COUNT = 16;

export interface ClampVolumeInput {
  readonly desiredVolume: number;
}

export function clampVanillaSoundVolume(input: ClampVolumeInput): number {
  if (input.desiredVolume < VANILLA_SOUND_VOLUME_MIN) {
    return VANILLA_SOUND_VOLUME_MIN;
  }
  if (input.desiredVolume > VANILLA_SOUND_VOLUME_MAX) {
    return VANILLA_SOUND_VOLUME_MAX;
  }
  return input.desiredVolume | 0;
}

export function getVanillaSoundVolumeMenuTree(): readonly VanillaSoundVolumeMenuItem[] {
  return VANILLA_SOUND_VOLUME_MENU_TREE;
}
