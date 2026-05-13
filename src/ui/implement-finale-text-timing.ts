/**
 * Vanilla DOOM 1.9 finale text-timing contract.
 *
 * From Chocolate Doom 2.2.1 f_finale.c F_TextWrite / F_Ticker:
 *
 *   #define TEXTSPEED  3   // tics per character drawn
 *   #define TEXTWAIT   250 // tics to hold after text fully drawn
 *
 *   void F_Ticker(void)
 *   {
 *       // F_StartCast may advance state when applicable.
 *       if (!finalecount)
 *           S_StartMusic(textmusic[gameepisode - 1]);
 *
 *       finalecount++;
 *
 *       if (finalestage == F_STAGE_TEXT
 *           && finalecount > strlen(finaletext) * TEXTSPEED + TEXTWAIT)
 *       {
 *           if (gamemode == commercial)
 *               { ... }
 *           else
 *           {
 *               finalecount = 0;
 *               finalestage = F_STAGE_ART;
 *               wipegamestate = -1;  // force wipe
 *           }
 *       }
 *   }
 *
 *   void F_TextWrite(void)
 *   {
 *       // Compute the visible character count from finalecount:
 *       count = (finalecount - 10) / TEXTSPEED;
 *       if (count < 0) count = 0;
 *       if (count > strlen(finaletext)) count = strlen(finaletext);
 *       ...
 *   }
 *
 * Notes for parity:
 *   - TEXTSPEED = 3 tics per character. A 100-char string takes 300 tics to fully draw.
 *   - TEXTWAIT = 250 tics. After full text is drawn, wait 250 more tics before advancing.
 *   - The 10-tic lead-in delay before the first character is drawn is hard-coded in F_TextWrite.
 *   - Total finale-text duration is `strlen(text) * 3 + 250 + 10` tics.
 *   - On commercial (Doom 2), specific maps trigger CastCall or BunnyScroll afterwards
 *     instead of just art; this contract only covers the text-stage timing.
 */

export const VANILLA_FINALE_TEXT_SPEED_TICS_PER_CHAR = 3;
export const VANILLA_FINALE_TEXT_WAIT_TICS = 250;
export const VANILLA_FINALE_TEXT_LEAD_IN_TICS = 10;

export interface FinaleVisibleCharCountInput {
  readonly finalecount: number;
  readonly textLength: number;
}

export function computeVanillaFinaleVisibleCharCount(input: FinaleVisibleCharCountInput): number {
  const raw = Math.trunc((input.finalecount - VANILLA_FINALE_TEXT_LEAD_IN_TICS) / VANILLA_FINALE_TEXT_SPEED_TICS_PER_CHAR);
  if (raw <= 0) {
    return 0;
  }
  if (raw > input.textLength) {
    return input.textLength;
  }
  return raw;
}

export interface FinaleTextDurationInput {
  readonly textLength: number;
}

export function computeVanillaFinaleTextStageDurationTics(input: FinaleTextDurationInput): number {
  return input.textLength * VANILLA_FINALE_TEXT_SPEED_TICS_PER_CHAR + VANILLA_FINALE_TEXT_WAIT_TICS + VANILLA_FINALE_TEXT_LEAD_IN_TICS;
}

export interface FinaleAdvanceInput {
  readonly finalecount: number;
  readonly textLength: number;
}

export function vanillaFinaleTextStageShouldAdvance(input: FinaleAdvanceInput): boolean {
  // From upstream: finalecount > strlen(text) * TEXTSPEED + TEXTWAIT
  return input.finalecount > input.textLength * VANILLA_FINALE_TEXT_SPEED_TICS_PER_CHAR + VANILLA_FINALE_TEXT_WAIT_TICS;
}
