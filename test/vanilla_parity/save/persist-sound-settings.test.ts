import { describe, expect, test } from 'bun:test';

import {
  createDefaultVanillaSoundSettings,
  serializeVanillaSoundSettings,
  VANILLA_SOUND_DEVICE_ADLIB,
  VANILLA_SOUND_DEVICE_GUS,
  VANILLA_SOUND_DEVICE_NONE,
  VANILLA_SOUND_DEVICE_PCSPEAKER,
  VANILLA_SOUND_DEVICE_SOUNDBLASTER,
  VANILLA_SOUND_SETTING_DEFAULTS,
  VANILLA_SOUND_SETTING_NAMES,
  VANILLA_SOUND_VOLUME_MAX,
  VANILLA_SOUND_VOLUME_MIN,
} from '../../../src/config/persist-sound-settings.ts';

describe('vanilla DOOM 1.9 sound-setting persistence contract', () => {
  test('pins the nine vanilla sound variable names in canonical order', () => {
    expect(VANILLA_SOUND_SETTING_NAMES).toEqual(['sfx_volume', 'music_volume', 'snd_channels', 'snd_musicdevice', 'snd_sfxdevice', 'snd_sbport', 'snd_sbirq', 'snd_sbdma', 'snd_mport']);
  });

  test('pins the snddevice_t enum constants from doomdef.h', () => {
    expect(VANILLA_SOUND_DEVICE_NONE).toBe(0);
    expect(VANILLA_SOUND_DEVICE_PCSPEAKER).toBe(1);
    expect(VANILLA_SOUND_DEVICE_ADLIB).toBe(2);
    expect(VANILLA_SOUND_DEVICE_SOUNDBLASTER).toBe(3);
    expect(VANILLA_SOUND_DEVICE_GUS).toBe(5);
  });

  test('pins the 0..15 volume slider range from m_menu.c', () => {
    expect(VANILLA_SOUND_VOLUME_MIN).toBe(0);
    expect(VANILLA_SOUND_VOLUME_MAX).toBe(15);
  });

  test('hardcoded defaults match Chocolate Doom 2.2.1 m_menu.c / i_sound.c initializers', () => {
    expect(VANILLA_SOUND_SETTING_DEFAULTS.get('sfx_volume')).toBe(8);
    expect(VANILLA_SOUND_SETTING_DEFAULTS.get('music_volume')).toBe(8);
    expect(VANILLA_SOUND_SETTING_DEFAULTS.get('snd_channels')).toBe(8);
    expect(VANILLA_SOUND_SETTING_DEFAULTS.get('snd_musicdevice')).toBe(VANILLA_SOUND_DEVICE_SOUNDBLASTER);
    expect(VANILLA_SOUND_SETTING_DEFAULTS.get('snd_sfxdevice')).toBe(VANILLA_SOUND_DEVICE_SOUNDBLASTER);
    expect(VANILLA_SOUND_SETTING_DEFAULTS.get('snd_sbport')).toBe(0);
    expect(VANILLA_SOUND_SETTING_DEFAULTS.get('snd_sbirq')).toBe(0);
    expect(VANILLA_SOUND_SETTING_DEFAULTS.get('snd_sbdma')).toBe(0);
    expect(VANILLA_SOUND_SETTING_DEFAULTS.get('snd_mport')).toBe(0);
  });

  test('createDefaultVanillaSoundSettings returns a frozen DOS-default config', () => {
    const s = createDefaultVanillaSoundSettings();
    expect(Object.isFrozen(s)).toBe(true);
    expect(s.sfx_volume).toBe(8);
    expect(s.music_volume).toBe(8);
    expect(s.snd_musicdevice).toBe(3);
    expect(s.snd_sfxdevice).toBe(3);
  });

  test('serializes defaults with column-30 padding, LF terminator, and decimal zero for autodetect hardware', () => {
    const text = serializeVanillaSoundSettings(createDefaultVanillaSoundSettings());
    const lines = text.split('\n');
    expect(lines[lines.length - 1]).toBe('');
    expect(lines.length).toBe(10);
    expect(lines[0]).toBe('sfx_volume                     8');
    expect(lines[1]).toBe('music_volume                   8');
    expect(lines[2]).toBe('snd_channels                   8');
    expect(lines[3]).toBe('snd_musicdevice                3');
    expect(lines[4]).toBe('snd_sfxdevice                  3');
    expect(lines[5]).toBe('snd_sbport                     0');
    expect(lines[6]).toBe('snd_sbirq                      0');
    expect(lines[7]).toBe('snd_sbdma                      0');
    expect(lines[8]).toBe('snd_mport                      0');
    expect(text.includes('\r')).toBe(false);
    expect(text.includes('0x')).toBe(false);
  });

  test('serializes user-customized SoundBlaster Pro / GUS configuration in decimal', () => {
    const text = serializeVanillaSoundSettings({
      sfx_volume: 15,
      music_volume: 12,
      snd_channels: 16,
      snd_musicdevice: VANILLA_SOUND_DEVICE_GUS,
      snd_sfxdevice: VANILLA_SOUND_DEVICE_SOUNDBLASTER,
      snd_sbport: 544,
      snd_sbirq: 5,
      snd_sbdma: 1,
      snd_mport: 0,
    });
    expect(text.includes('sfx_volume                     15')).toBe(true);
    expect(text.includes('snd_musicdevice                5')).toBe(true);
    expect(text.includes('snd_sbport                     544')).toBe(true);
    expect(text.includes('0x')).toBe(false);
  });
});
