/**
 * Vanilla DOOM 1.9 sound-setting persistence contract.
 *
 * The vanilla `default.cfg` namespace exposes 9 sound-related
 * variables. From Chocolate Doom 2.2.1 m_misc.c doom_defaults_list and
 * the m_menu.c / i_sound.c DOS globals:
 *
 *   sfx_volume        int  default 8   (m_menu.c — slider 0..15)
 *   music_volume      int  default 8   (m_menu.c — slider 0..15)
 *   snd_channels      int  default 8   (s_sound.c — max simultaneous SFX)
 *   snd_musicdevice   int  default 3   (i_sound.c — snddevice_t enum)
 *   snd_sfxdevice     int  default 3   (i_sound.c — snddevice_t enum)
 *   snd_sbport        int  default 0   (i_sound.c — SB I/O port, 0 = autodetect)
 *   snd_sbirq         int  default 0   (i_sound.c — SB IRQ, 0 = autodetect)
 *   snd_sbdma         int  default 0   (i_sound.c — SB DMA, 0 = autodetect)
 *   snd_mport         int  default 0   (i_sound.c — MIDI port, 0 = autodetect)
 *
 * `snddevice_t` enum (doomdef.h):
 *   0 = NONE, 1 = PCSPEAKER, 2 = ADLIB, 3 = SB (SoundBlaster),
 *   4 = PAS, 5 = GUS, 6 = WAVEBLASTER, 7 = SOUNDCANVAS,
 *   8 = GENMIDI, 9 = AWE32. Default 3 = SoundBlaster for both
 *   `snd_musicdevice` and `snd_sfxdevice`.
 *
 * Persistence format matches M_SaveDefaults: column-30 padded name,
 * single space, decimal value, single LF terminator. Even the
 * autodetect-zero hardware ports serialize as plain `0`, NOT `0x0`
 * — only `chocolate-doom.cfg`'s `opl_io_port` uses hex formatting,
 * and that variable is outside the vanilla namespace.
 */

import { formatVanillaConfigLine } from './persist-vanilla-key-bindings.ts';

export const VANILLA_SOUND_SETTING_NAMES: readonly string[] = Object.freeze(['sfx_volume', 'music_volume', 'snd_channels', 'snd_musicdevice', 'snd_sfxdevice', 'snd_sbport', 'snd_sbirq', 'snd_sbdma', 'snd_mport']);

export const VANILLA_SOUND_DEVICE_NONE = 0;
export const VANILLA_SOUND_DEVICE_PCSPEAKER = 1;
export const VANILLA_SOUND_DEVICE_ADLIB = 2;
export const VANILLA_SOUND_DEVICE_SOUNDBLASTER = 3;
export const VANILLA_SOUND_DEVICE_PAS = 4;
export const VANILLA_SOUND_DEVICE_GUS = 5;
export const VANILLA_SOUND_DEVICE_WAVEBLASTER = 6;
export const VANILLA_SOUND_DEVICE_SOUNDCANVAS = 7;
export const VANILLA_SOUND_DEVICE_GENMIDI = 8;
export const VANILLA_SOUND_DEVICE_AWE32 = 9;

export const VANILLA_SOUND_VOLUME_MIN = 0;
export const VANILLA_SOUND_VOLUME_MAX = 15;

export const VANILLA_SOUND_SETTING_DEFAULTS: ReadonlyMap<string, number> = Object.freeze(
  new Map<string, number>([
    ['sfx_volume', 8],
    ['music_volume', 8],
    ['snd_channels', 8],
    ['snd_musicdevice', VANILLA_SOUND_DEVICE_SOUNDBLASTER],
    ['snd_sfxdevice', VANILLA_SOUND_DEVICE_SOUNDBLASTER],
    ['snd_sbport', 0],
    ['snd_sbirq', 0],
    ['snd_sbdma', 0],
    ['snd_mport', 0],
  ]),
);

export interface VanillaSoundSettings {
  readonly sfx_volume: number;
  readonly music_volume: number;
  readonly snd_channels: number;
  readonly snd_musicdevice: number;
  readonly snd_sfxdevice: number;
  readonly snd_sbport: number;
  readonly snd_sbirq: number;
  readonly snd_sbdma: number;
  readonly snd_mport: number;
}

export function createDefaultVanillaSoundSettings(): VanillaSoundSettings {
  return Object.freeze({
    sfx_volume: 8,
    music_volume: 8,
    snd_channels: 8,
    snd_musicdevice: VANILLA_SOUND_DEVICE_SOUNDBLASTER,
    snd_sfxdevice: VANILLA_SOUND_DEVICE_SOUNDBLASTER,
    snd_sbport: 0,
    snd_sbirq: 0,
    snd_sbdma: 0,
    snd_mport: 0,
  });
}

export function serializeVanillaSoundSettings(values: VanillaSoundSettings): string {
  return (
    formatVanillaConfigLine('sfx_volume', values.sfx_volume) +
    formatVanillaConfigLine('music_volume', values.music_volume) +
    formatVanillaConfigLine('snd_channels', values.snd_channels) +
    formatVanillaConfigLine('snd_musicdevice', values.snd_musicdevice) +
    formatVanillaConfigLine('snd_sfxdevice', values.snd_sfxdevice) +
    formatVanillaConfigLine('snd_sbport', values.snd_sbport) +
    formatVanillaConfigLine('snd_sbirq', values.snd_sbirq) +
    formatVanillaConfigLine('snd_sbdma', values.snd_sbdma) +
    formatVanillaConfigLine('snd_mport', values.snd_mport)
  );
}
