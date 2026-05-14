import { describe, expect, test } from 'bun:test';

import { VANILLA_GATE_SFX_AUDIO_PARITY, vanillaGateSfxAudioParityKeys } from '../../../src/audio/gate-sfx-audio-parity.ts';

describe('phase 11 sfx audio parity gate', () => {
  test('gate manifest pins 13 SFX invariants', () => {
    expect(vanillaGateSfxAudioParityKeys()).toHaveLength(13);
  });

  test('digital PCM format = 3', () => {
    expect(VANILLA_GATE_SFX_AUDIO_PARITY.sfxFormatDigitalPCM).toBe(3);
  });

  test('SFX sample rate = 11025 Hz', () => {
    expect(VANILLA_GATE_SFX_AUDIO_PARITY.sfxSampleRateHz).toBe(11025);
  });

  test('SFX header size = 8 bytes', () => {
    expect(VANILLA_GATE_SFX_AUDIO_PARITY.sfxHeaderSizeBytes).toBe(8);
  });

  test('SFX lump prefix = DS (digital) and DP (PC speaker)', () => {
    expect(VANILLA_GATE_SFX_AUDIO_PARITY.sfxLumpPrefix).toBe('DS');
    expect(VANILLA_GATE_SFX_AUDIO_PARITY.sfxPcSpeakerPrefix).toBe('DP');
  });

  test('SFX padding bytes = 2', () => {
    expect(VANILLA_GATE_SFX_AUDIO_PARITY.sfxPaddingBytes).toBe(2);
  });

  test('8 simultaneous SFX channels', () => {
    expect(VANILLA_GATE_SFX_AUDIO_PARITY.numSfxChannels).toBe(8);
  });

  test('priority arbitration = lower-number-wins; NORM_PRIORITY = 64', () => {
    expect(VANILLA_GATE_SFX_AUDIO_PARITY.priorityArbitrationRule).toBe('lower-number-wins');
    expect(VANILLA_GATE_SFX_AUDIO_PARITY.normPriority).toBe(64);
  });

  test('NORM_SEP centre pan = 128', () => {
    expect(VANILLA_GATE_SFX_AUDIO_PARITY.normSep).toBe(128);
  });

  test('oracle window cadence = 35 Hz, 1260 bytes per gametic', () => {
    expect(VANILLA_GATE_SFX_AUDIO_PARITY.oracleSampleRateHz).toBe(11025);
    expect(VANILLA_GATE_SFX_AUDIO_PARITY.oracleGameticsPerSecond).toBe(35);
    expect(VANILLA_GATE_SFX_AUDIO_PARITY.oracleWindowBytesPerGametic).toBe(1260);
  });

  test('oracle window math: 11025 Hz / 35 Hz * 4 bytes/pair = 1260 bytes', () => {
    const oracleBytes = (VANILLA_GATE_SFX_AUDIO_PARITY.oracleSampleRateHz / VANILLA_GATE_SFX_AUDIO_PARITY.oracleGameticsPerSecond) * 4;
    expect(oracleBytes).toBe(VANILLA_GATE_SFX_AUDIO_PARITY.oracleWindowBytesPerGametic);
  });

  test('manifest is frozen (no runtime mutation possible)', () => {
    expect(Object.isFrozen(VANILLA_GATE_SFX_AUDIO_PARITY)).toBe(true);
  });
});
