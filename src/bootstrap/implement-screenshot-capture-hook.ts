/**
 * Vanilla Chocolate Doom 2.2.1 screenshot capture hook contract.
 *
 * default.cfg key_menu_screenshot = 0 means screenshot is unbound by default;
 * vanilla supports F1-F12 binding via the menu. When triggered, vanilla calls
 * G_ScreenShot which sets gameaction = ga_screenshot; the next D_Display tic
 * grabs the raw 320x200 palette-indexed framebuffer and writes a PCX file
 * (DOOM00.PCX through DOOM99.PCX) via M_ScreenShot. chocolate-doom.cfg
 * png_screenshots=0 (default) writes PCX; png_screenshots=1 writes PNG.
 */

/** Vanilla default.cfg key_menu_screenshot default (0 = unbound). */
export const VANILLA_DEFAULT_SCREENSHOT_KEY_SCANCODE = 0;

/** Vanilla chocolate-doom.cfg png_screenshots default. */
export const VANILLA_DEFAULT_PNG_SCREENSHOTS = 0;

/** Vanilla screenshot filename format prefix. */
export const VANILLA_SCREENSHOT_FILENAME_PREFIX = 'DOOM';

/** Vanilla maximum screenshot slot number (DOOM00 to DOOM99 = 100 slots). */
export const VANILLA_SCREENSHOT_MAX_SLOT = 99;

/** Vanilla screenshot dimensions (raw framebuffer). */
export const VANILLA_SCREENSHOT_WIDTH = 320;
export const VANILLA_SCREENSHOT_HEIGHT = 200;

export type ScreenshotFormat = 'pcx' | 'png';

export function decideScreenshotFormat(pngScreenshotsCfg: number): ScreenshotFormat {
  return pngScreenshotsCfg === 1 ? 'png' : 'pcx';
}

export interface ScreenshotFilenameInput {
  readonly nextAvailableSlot: number;
  readonly pngScreenshotsCfg: number;
}

export function buildScreenshotFilename(input: ScreenshotFilenameInput): string {
  if (input.nextAvailableSlot < 0 || input.nextAvailableSlot > VANILLA_SCREENSHOT_MAX_SLOT) {
    throw new Error(`Screenshot slot ${input.nextAvailableSlot} out of range [0, ${VANILLA_SCREENSHOT_MAX_SLOT}]`);
  }
  const format = decideScreenshotFormat(input.pngScreenshotsCfg);
  const paddedSlot = input.nextAvailableSlot.toString().padStart(2, '0');
  return `${VANILLA_SCREENSHOT_FILENAME_PREFIX}${paddedSlot}.${format}`;
}
