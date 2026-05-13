/**
 * Vanilla DOOM 1.9 intermission and finale parity gate.
 *
 * Re-exports the canonical contracts pinned by 10-022..10-025 so a single import
 * verifies that the intermission and finale surfaces are wired together and
 * parity-consistent. Acts as a "smoke test" composite for the intermission/finale lane.
 */

export {
  VANILLA_INTERMISSION_SP_STATE_ACCELERATED,
  VANILLA_INTERMISSION_SP_STATE_ITEMS,
  VANILLA_INTERMISSION_SP_STATE_KILLS,
  VANILLA_INTERMISSION_SP_STATE_SECRET,
  VANILLA_INTERMISSION_SP_STATE_TIME,
  VANILLA_INTERMISSION_STAT_PERCENT_STEP,
  VANILLA_INTERMISSION_TIME_STEP_TICS,
  computeVanillaIntermissionPercent,
  computeVanillaIntermissionTimeSeconds,
  stepVanillaIntermissionPercent,
} from './implement-intermission-stats-counting.ts';

export {
  VANILLA_INTERMISSION_SPLAT_LUMP,
  VANILLA_INTERMISSION_YOU_ARE_HERE_BLINK_TICS,
  VANILLA_INTERMISSION_YOU_ARE_HERE_LUMPS,
  getVanillaIntermissionBackgroundLump,
  getVanillaYouAreHereLump,
} from './implement-intermission-map-graphics.ts';

export {
  VANILLA_FINALE_TEXT_LEAD_IN_TICS,
  VANILLA_FINALE_TEXT_SPEED_TICS_PER_CHAR,
  VANILLA_FINALE_TEXT_WAIT_TICS,
  computeVanillaFinaleTextStageDurationTics,
  computeVanillaFinaleVisibleCharCount,
  vanillaFinaleTextStageShouldAdvance,
} from './implement-finale-text-timing.ts';

export {
  resolveVanillaFinalePostTextScope,
  vanillaFinaleBunnyScrollIsAvailable,
  vanillaFinaleCastCallIsAvailable,
} from './implement-finale-cast-and-bunny-scroll-scope.ts';

import { VANILLA_INTERMISSION_STAT_PERCENT_STEP } from './implement-intermission-stats-counting.ts';
import { VANILLA_INTERMISSION_YOU_ARE_HERE_BLINK_TICS } from './implement-intermission-map-graphics.ts';
import { VANILLA_FINALE_TEXT_SPEED_TICS_PER_CHAR, VANILLA_FINALE_TEXT_WAIT_TICS } from './implement-finale-text-timing.ts';

export interface VanillaIntermissionAndFinaleGateInvariants {
  readonly intermissionPercentStep: 2;
  readonly intermissionYouAreHereBlinkTics: 9;
  readonly finaleTextSpeedTicsPerChar: 3;
  readonly finaleTextWaitTics: 250;
}

export const VANILLA_INTERMISSION_AND_FINALE_GATE_INVARIANTS: VanillaIntermissionAndFinaleGateInvariants = Object.freeze({
  intermissionPercentStep: 2,
  intermissionYouAreHereBlinkTics: 9,
  finaleTextSpeedTicsPerChar: 3,
  finaleTextWaitTics: 250,
});

export function assertVanillaIntermissionAndFinaleGateInvariants(): void {
  const inv = VANILLA_INTERMISSION_AND_FINALE_GATE_INVARIANTS;
  if (VANILLA_INTERMISSION_STAT_PERCENT_STEP !== inv.intermissionPercentStep) {
    throw new Error(`intermission percent step mismatch: ${VANILLA_INTERMISSION_STAT_PERCENT_STEP}`);
  }
  if (VANILLA_INTERMISSION_YOU_ARE_HERE_BLINK_TICS !== inv.intermissionYouAreHereBlinkTics) {
    throw new Error(`you-are-here blink tics mismatch: ${VANILLA_INTERMISSION_YOU_ARE_HERE_BLINK_TICS}`);
  }
  if (VANILLA_FINALE_TEXT_SPEED_TICS_PER_CHAR !== inv.finaleTextSpeedTicsPerChar) {
    throw new Error(`finale text speed mismatch: ${VANILLA_FINALE_TEXT_SPEED_TICS_PER_CHAR}`);
  }
  if (VANILLA_FINALE_TEXT_WAIT_TICS !== inv.finaleTextWaitTics) {
    throw new Error(`finale text wait tics mismatch: ${VANILLA_FINALE_TEXT_WAIT_TICS}`);
  }
}
