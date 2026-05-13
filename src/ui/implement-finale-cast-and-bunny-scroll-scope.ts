/**
 * Vanilla DOOM 1.9 finale post-text stage scope (cast call vs bunny scroll vs art).
 *
 * From Chocolate Doom 2.2.1 f_finale.c F_Ticker / F_StartCast / F_BunnyScroll:
 *
 *   void F_Ticker(void)
 *   {
 *       ...
 *       if (finalestage == F_STAGE_TEXT && finalecount > strlen(...)*TEXTSPEED + TEXTWAIT)
 *       {
 *           if (gamemode != commercial)
 *           {
 *               finalecount = 0;
 *               finalestage = F_STAGE_ART;
 *               wipegamestate = -1;
 *               switch (gameepisode)
 *               {
 *                 case 1: ...
 *                 case 3: F_StartCast();   // only Doom 2 reaches here on commercial
 *                 default: ...
 *               }
 *           }
 *       }
 *   }
 *
 *   void F_BunnyScroll(void)
 *   {
 *       // Only invoked for Doom 1 episode 1 ending. Renders Daisy the bunny scrolling
 *       // across the screen with end-of-episode text overlay.
 *   }
 *
 *   void F_StartCast(void)
 *   {
 *       // Only invoked at the end of Doom 2. Cycles through caststate_t for each
 *       // monster type, playing their idle and death animations.
 *   }
 *
 * Notes for parity:
 *   - Doom 1 episode 1 (shareware/registered/retail): bunny scroll after text.
 *   - Doom 1 episode 2, 3, 4: static finale art (background image, no animation).
 *   - Doom 2 (commercial): cast call after the final map's text.
 *   - The bunny scroll is NOT available in commercial mode.
 *   - The cast call is NOT available in non-commercial modes.
 */

export type VanillaFinaleGameMode = 'shareware' | 'registered' | 'retail' | 'commercial';
export type VanillaFinaleEpisode = 1 | 2 | 3 | 4;
export type VanillaFinalePostTextScope = 'bunny-scroll' | 'cast-call' | 'static-art';

export interface FinalePostTextScopeInput {
  readonly gameMode: VanillaFinaleGameMode;
  readonly episode: VanillaFinaleEpisode;
}

export function resolveVanillaFinalePostTextScope(input: FinalePostTextScopeInput): VanillaFinalePostTextScope {
  if (input.gameMode === 'commercial') {
    return 'cast-call';
  }
  if (input.episode === 1) {
    return 'bunny-scroll';
  }
  return 'static-art';
}

export function vanillaFinaleBunnyScrollIsAvailable(input: FinalePostTextScopeInput): boolean {
  return input.gameMode !== 'commercial' && input.episode === 1;
}

export function vanillaFinaleCastCallIsAvailable(gameMode: VanillaFinaleGameMode): boolean {
  return gameMode === 'commercial';
}
