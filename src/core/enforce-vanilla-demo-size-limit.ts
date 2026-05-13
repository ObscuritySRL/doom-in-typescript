/**
 * Vanilla Chocolate Doom 2.2.1 demo size limit enforcement.
 *
 * chocolate-doom.cfg vanilla_demo_limit=1 reactivates the 128 KiB vanilla
 * demo buffer ceiling (g_game.c::G_RecordDemo allocates 0x20000 bytes by
 * default in vanilla DOOM 1.9). When the buffer is exhausted, vanilla writes
 * the 0x80 terminator and finalizes the demo regardless of whether the
 * recording session ended naturally; this is a hard cap, not an error.
 */

export const VANILLA_DEMO_BYTE_LIMIT = 0x20000;
export const VANILLA_DEMO_LIMIT_FLAG_VALUE_ENFORCED = 1;
export const VANILLA_DEMO_LIMIT_FLAG_VALUE_RELAXED = 0;

export type DemoSizeOutcome = 'within-limit' | 'truncated-at-limit' | 'over-limit-but-relaxed';

export interface DemoSizeInput {
  readonly recordedBytes: number;
  readonly vanillaDemoLimitFlag: number;
}

export function evaluateDemoSize(input: DemoSizeInput): DemoSizeOutcome {
  if (input.vanillaDemoLimitFlag === VANILLA_DEMO_LIMIT_FLAG_VALUE_RELAXED) {
    return input.recordedBytes > VANILLA_DEMO_BYTE_LIMIT ? 'over-limit-but-relaxed' : 'within-limit';
  }
  return input.recordedBytes >= VANILLA_DEMO_BYTE_LIMIT ? 'truncated-at-limit' : 'within-limit';
}
