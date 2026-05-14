/**
 * Phase 11 SFX audio parity gate.
 *
 * Bundles the SFX-side audio invariants that the audio lane is
 * required to honour before the Phase 13 acceptance gates can run.
 * Each invariant is a key/value contract that has been pinned by an
 * upstream step in Phase 11 and is re-asserted here to fail fast if
 * any of those pins drift.
 *
 * Invariants:
 *   - sfx_format = digital PCM (0x0003); rate = 11025 Hz (11-001)
 *   - 8 simultaneous channels via vanilla S_GetChannel (11-003)
 *   - priority arbitration: lower-number-wins (11-002 + 11-010)
 *   - S_UpdateSounds origin guard skips anonymous and self-listener
 *     spatialization (11-004)
 *   - weapon sfx use player.mo origin; monster sfx use monster.mo;
 *     menu and boss fullscreen use NULL (11-011 + 11-012 + 11-013)
 *   - SFX oracle window cadence = 35 Hz, 1260 bytes per gametic (11-028)
 *
 * The gate exports a frozen manifest covering these invariants so a
 * single test can verify the audio lane's SFX surface is internally
 * consistent before downstream gates run.
 */

export const VANILLA_GATE_SFX_AUDIO_PARITY = Object.freeze({
  sfxFormatDigitalPCM: 3,
  sfxSampleRateHz: 11025,
  sfxHeaderSizeBytes: 8,
  sfxLumpPrefix: 'DS',
  sfxPcSpeakerPrefix: 'DP',
  sfxPaddingBytes: 2,
  numSfxChannels: 8,
  priorityArbitrationRule: 'lower-number-wins' as const,
  normPriority: 64,
  normSep: 128,
  oracleSampleRateHz: 11025,
  oracleGameticsPerSecond: 35,
  oracleWindowBytesPerGametic: 1260,
});

export type VanillaGateSfxAudioParity = typeof VANILLA_GATE_SFX_AUDIO_PARITY;

export function vanillaGateSfxAudioParityKeys(): readonly (keyof VanillaGateSfxAudioParity)[] {
  return Object.freeze(Object.keys(VANILLA_GATE_SFX_AUDIO_PARITY) as (keyof VanillaGateSfxAudioParity)[]);
}
