/**
 * Vanilla DOOM 1.9 screen size, detail, and gamma adjustment contracts.
 *
 * From Chocolate Doom 2.2.1 m_menu.c M_SizeDisplay / M_ChangeDetail / M_ChangeMessages / r_main.c:
 *
 *   // Screen size: screenblocks ranges 3..11
 *   //   3..9   = various status-bar-visible sizes
 *   //   10     = status bar visible, larger view
 *   //   11     = fullscreen, status bar hidden
 *   void M_SizeDisplay(int choice) {
 *     switch(choice) {
 *       case 0: if (screenSize > 0) { screenblocks--; screenSize--; } break;  // left arrow
 *       case 1: if (screenSize < 8) { screenblocks++; screenSize++; } break;  // right arrow
 *     }
 *     R_SetViewSize(screenblocks, detailLevel);
 *   }
 *
 *   // Detail level toggle (only 2 values)
 *   void M_ChangeDetail(int choice) {
 *     detailLevel = 1 - detailLevel;   // toggle between 0=high and 1=low
 *     R_SetViewSize(screenblocks, detailLevel);
 *   }
 *
 *   // Gamma cycles through 5 levels via F11 (M_ChangeGamma; not in the options menu directly)
 *   void M_ChangeGamma(int choice) {
 *     usegamma++;
 *     if (usegamma > 4) usegamma = 0;
 *     I_SetPalette(W_CacheLumpName("PLAYPAL", PU_CACHE));
 *   }
 *
 * Notes for parity:
 *   - screenblocks runs 3..11. Internal screenSize variable is 0..8 (8 = screenblocks 11 = fullscreen).
 *     Default at startup is screenblocks 10, screenSize 7 (full view with status bar).
 *   - detailLevel is a binary toggle: 0 = high detail, 1 = low detail. Default 0.
 *   - usegamma cycles 0..4 (5 gamma correction tables). Default 0.
 *   - The menu calls R_SetViewSize each time screen size or detail changes.
 *   - The gamma key (F11) wraps around 4 -> 0 immediately.
 */

export const VANILLA_SCREENBLOCKS_MIN = 3;
export const VANILLA_SCREENBLOCKS_MAX = 11;
export const VANILLA_SCREENBLOCKS_DEFAULT = 10;
export const VANILLA_SCREENSIZE_MIN = 0;
export const VANILLA_SCREENSIZE_MAX = 8;
export const VANILLA_SCREENSIZE_DEFAULT = 7;

export const VANILLA_DETAIL_HIGH = 0;
export const VANILLA_DETAIL_LOW = 1;
export const VANILLA_DETAIL_DEFAULT = VANILLA_DETAIL_HIGH;

export const VANILLA_GAMMA_LEVELS = 5;
export const VANILLA_GAMMA_MIN = 0;
export const VANILLA_GAMMA_MAX = 4;
export const VANILLA_GAMMA_DEFAULT = 0;

export interface SizeDisplayInput {
  readonly currentScreenSize: number;
  readonly currentScreenblocks: number;
  readonly arrowDirection: 'left' | 'right';
}

export interface SizeDisplayResult {
  readonly screenSizeAfter: number;
  readonly screenblocksAfter: number;
  readonly viewSizeChanged: boolean;
}

export function applyVanillaSizeDisplay(input: SizeDisplayInput): SizeDisplayResult {
  if (input.arrowDirection === 'left') {
    if (input.currentScreenSize > VANILLA_SCREENSIZE_MIN) {
      return Object.freeze({
        screenSizeAfter: input.currentScreenSize - 1,
        screenblocksAfter: input.currentScreenblocks - 1,
        viewSizeChanged: true,
      });
    }
  } else if (input.currentScreenSize < VANILLA_SCREENSIZE_MAX) {
    return Object.freeze({
      screenSizeAfter: input.currentScreenSize + 1,
      screenblocksAfter: input.currentScreenblocks + 1,
      viewSizeChanged: true,
    });
  }
  return Object.freeze({
    screenSizeAfter: input.currentScreenSize,
    screenblocksAfter: input.currentScreenblocks,
    viewSizeChanged: false,
  });
}

export function toggleVanillaDetail(currentDetail: number): number {
  return 1 - currentDetail;
}

export function cycleVanillaGamma(currentGamma: number): number {
  const next = currentGamma + 1;
  return next > VANILLA_GAMMA_MAX ? VANILLA_GAMMA_MIN : next;
}
