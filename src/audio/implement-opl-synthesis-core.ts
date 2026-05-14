/**
 * Vanilla DOOM 1.9 OPL2 synthesis core contract.
 *
 * Chocolate Doom 2.2.1 opl_queue.c and opl/opl3.c model the YMF262 (OPL3)
 * but vanilla DOOM 1.9 ran on the Sound Blaster Pro's OPL2 (YM3812). The
 * synthesis core advances 18 channels (OPL3) or 9 channels (OPL2) of dual
 * FM operators, producing 16-bit stereo samples at the configured sample
 * rate.
 *
 * Pinned contract values:
 *   - Sample rate: 44100 Hz (vanilla DMX defaults; chocolate-doom uses
 *     OPL_SAMPLE_RATE = 22050 by default but 44100 with -opl3).
 *   - Channel count for OPL2: 9 channels (NUMOPL2CHANNELS).
 *   - Channel count for OPL3: 18 channels (NUMOPL3CHANNELS).
 *   - Each FM channel has two operators (modulator + carrier).
 *   - 4-op channels are toggled via OPL3 0x104 register bits; vanilla
 *     never uses these.
 */

export const VANILLA_OPL_SAMPLE_RATE_HZ = 44100;
export const VANILLA_NUMOPL2CHANNELS = 9;
export const VANILLA_NUMOPL3CHANNELS = 18;
export const VANILLA_OPERATORS_PER_CHANNEL = 2;
export const VANILLA_OPL_STEREO_CHANNELS = 2;
export const VANILLA_OPL_BITS_PER_SAMPLE = 16;

export type OplMode = 'opl2' | 'opl3';

export interface OplSynthesisContract {
  readonly mode: OplMode;
  readonly channelCount: number;
  readonly operatorCount: number;
  readonly sampleRateHz: number;
}

export function describeVanillaOplSynthesis(mode: OplMode): OplSynthesisContract {
  const channelCount = mode === 'opl3' ? VANILLA_NUMOPL3CHANNELS : VANILLA_NUMOPL2CHANNELS;
  return Object.freeze({
    mode,
    channelCount,
    operatorCount: channelCount * VANILLA_OPERATORS_PER_CHANNEL,
    sampleRateHz: VANILLA_OPL_SAMPLE_RATE_HZ,
  });
}
