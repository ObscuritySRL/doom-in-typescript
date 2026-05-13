/**
 * Vanilla DOOM 1.9 switch texture/sound activation contract.
 *
 * From Chocolate Doom 2.2.1 p_switch.c P_ChangeSwitchTexture and
 * P_InitSwitchList:
 *   - Each switch is a paired wall texture (off/on). On use, the texture
 *     swaps between paired indices and SFX_SWTCHN (sound 60) plays at the
 *     wall midpoint.
 *   - Once-only switches stay in the "on" state forever; repeatable switches
 *     queue a P_StartButton thinker that flips back after BUTTONTIME
 *     (1 second = 35 tics) and plays SFX_SWTCHX (sound 61) on flip-back.
 *   - switchlist[] is paired (off, on, off, on, ...); the search is linear
 *     and the swap index is the XOR with 1 of the matched index.
 *
 * Texture pairs (from p_switch.c switchlist):
 *   SW1BRCOM/SW2BRCOM, SW1BRN1/SW2BRN1, SW1BRN2/SW2BRN2, ... etc.
 *   The exact list is gamemode-dependent; the SW1/SW2 naming pattern is
 *   universal.
 *
 * Vanilla quirk: BUTTONTIME = 35 tics (1 second at 35 Hz). Repeatable
 * switches with manual reactivation can still fire while the timer is
 * running (no debounce on usedown beyond the player-side latch).
 */

export const VANILLA_SFX_SWTCHN = 60;
export const VANILLA_SFX_SWTCHX = 61;
export const VANILLA_BUTTONTIME_TICS = 35;
export const VANILLA_SWITCH_NAME_PREFIX_OFF = 'SW1';
export const VANILLA_SWITCH_NAME_PREFIX_ON = 'SW2';

export interface SwitchActivationInput {
  readonly currentTextureIndex: number;
  readonly switchPairs: readonly [number, number][];
  readonly isRepeatable: boolean;
}

export interface SwitchActivationResult {
  readonly newTextureIndex: number;
  readonly soundOnPress: number;
  readonly resetSoundOnRevert: number | null;
  readonly resetAfterTics: number | null;
}

export function classifyVanillaSwitchActivation(input: SwitchActivationInput): SwitchActivationResult {
  for (const [offIndex, onIndex] of input.switchPairs) {
    if (input.currentTextureIndex === offIndex) {
      return Object.freeze({
        newTextureIndex: onIndex,
        soundOnPress: VANILLA_SFX_SWTCHN,
        resetSoundOnRevert: input.isRepeatable ? VANILLA_SFX_SWTCHX : null,
        resetAfterTics: input.isRepeatable ? VANILLA_BUTTONTIME_TICS : null,
      });
    }
    if (input.currentTextureIndex === onIndex) {
      return Object.freeze({
        newTextureIndex: offIndex,
        soundOnPress: VANILLA_SFX_SWTCHN,
        resetSoundOnRevert: input.isRepeatable ? VANILLA_SFX_SWTCHX : null,
        resetAfterTics: input.isRepeatable ? VANILLA_BUTTONTIME_TICS : null,
      });
    }
  }
  return Object.freeze({
    newTextureIndex: input.currentTextureIndex,
    soundOnPress: 0,
    resetSoundOnRevert: null,
    resetAfterTics: null,
  });
}
