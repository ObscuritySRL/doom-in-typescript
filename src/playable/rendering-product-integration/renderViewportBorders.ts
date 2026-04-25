import type { Viewport } from '../../render/projection.ts';
import { DetailMode, SBARHEIGHT, SCREENHEIGHT, SCREENWIDTH, computeViewport } from '../../render/projection.ts';

export const RENDER_VIEWPORT_BORDERS_AUDIT_MANIFEST_PATH = 'plan_fps/manifests/01-012-audit-missing-live-rendering.json';
export const RENDER_VIEWPORT_BORDERS_COMMAND_CONTRACT = Object.freeze({
  entryFile: 'doom.ts',
  runtimeCommand: 'bun run doom.ts',
});
export const VIEWPORT_BORDER_DEFAULT_PALETTE_INDEX = 0x70;

export interface RenderViewportBordersEvidence {
  readonly borderPaletteIndex: number;
  readonly borderPixelCount: number;
  readonly borderRegion: ViewportBorderRegion;
  readonly commandContract: typeof RENDER_VIEWPORT_BORDERS_COMMAND_CONTRACT;
  readonly detailMode: DetailMode;
  readonly framebuffer: Uint8Array;
  readonly framebufferLength: number;
  readonly runtimeCommand: string;
  readonly setBlocks: number;
  readonly viewport: Viewport;
}

export interface RenderViewportBordersOptions {
  readonly borderPaletteIndex?: number;
  readonly detailMode: DetailMode;
  readonly framebuffer: Uint8Array;
  readonly runtimeCommand: string;
  readonly setBlocks: number;
}

export interface ViewportBorderRegion {
  readonly bottomExclusive: number;
  readonly left: number;
  readonly rightExclusive: number;
  readonly top: number;
}

/**
 * Render deterministic palette-index viewport borders around the vanilla view window.
 *
 * @param options framebuffer, viewport, palette, and command-contract values.
 * @returns Replay-stable evidence for the border composition pass.
 * @example
 * ```ts
 * import { DetailMode, SCREENHEIGHT, SCREENWIDTH } from "../../render/projection.ts";
 * import { renderViewportBorders } from "./renderViewportBorders.ts";
 *
 * const framebuffer = new Uint8Array(SCREENWIDTH * SCREENHEIGHT);
 * renderViewportBorders({ detailMode: DetailMode.high, framebuffer, runtimeCommand: "bun run doom.ts", setBlocks: 9 });
 * ```
 */
export function renderViewportBorders(options: RenderViewportBordersOptions): RenderViewportBordersEvidence {
  if (options.runtimeCommand !== RENDER_VIEWPORT_BORDERS_COMMAND_CONTRACT.runtimeCommand) {
    throw new Error(`render viewport borders requires ${RENDER_VIEWPORT_BORDERS_COMMAND_CONTRACT.runtimeCommand}`);
  }

  if (options.framebuffer.length !== SCREENWIDTH * SCREENHEIGHT) {
    throw new Error(`render viewport borders requires a ${SCREENWIDTH}x${SCREENHEIGHT} framebuffer`);
  }

  const borderPaletteIndex = options.borderPaletteIndex ?? VIEWPORT_BORDER_DEFAULT_PALETTE_INDEX;

  if (!Number.isInteger(borderPaletteIndex) || borderPaletteIndex < 0 || borderPaletteIndex > 0xff) {
    throw new Error('render viewport borders requires an 8-bit palette index');
  }

  const viewport = computeViewport(options.setBlocks, options.detailMode);
  const borderRegion = getViewportBorderRegion(viewport);
  const borderPixelCount = fillViewportBorderPixels(options.framebuffer, borderPaletteIndex, borderRegion, getBorderAreaHeight(viewport));

  return Object.freeze({
    borderPaletteIndex,
    borderPixelCount,
    borderRegion,
    commandContract: RENDER_VIEWPORT_BORDERS_COMMAND_CONTRACT,
    detailMode: options.detailMode,
    framebuffer: options.framebuffer,
    framebufferLength: options.framebuffer.length,
    runtimeCommand: options.runtimeCommand,
    setBlocks: options.setBlocks,
    viewport,
  });
}

function fillViewportBorderPixels(framebuffer: Uint8Array, borderPaletteIndex: number, borderRegion: ViewportBorderRegion, borderAreaHeight: number): number {
  let borderPixelCount = 0;

  for (let row = 0; row < borderAreaHeight; row += 1) {
    const rowOffset = row * SCREENWIDTH;

    for (let column = 0; column < SCREENWIDTH; column += 1) {
      if (column >= borderRegion.left && column < borderRegion.rightExclusive && row >= borderRegion.top && row < borderRegion.bottomExclusive) {
        continue;
      }

      framebuffer[rowOffset + column] = borderPaletteIndex;
      borderPixelCount += 1;
    }
  }

  return borderPixelCount;
}

function getBorderAreaHeight(viewport: Viewport): number {
  if (viewport.scaledViewWidth === SCREENWIDTH && viewport.viewHeight === SCREENHEIGHT) {
    return SCREENHEIGHT;
  }

  return SCREENHEIGHT - SBARHEIGHT;
}

function getViewportBorderRegion(viewport: Viewport): ViewportBorderRegion {
  return Object.freeze({
    bottomExclusive: viewport.viewWindowY + viewport.viewHeight,
    left: viewport.viewWindowX,
    rightExclusive: viewport.viewWindowX + viewport.scaledViewWidth,
    top: viewport.viewWindowY,
  });
}
