import { DetailMode, SCREENHEIGHT, SCREENWIDTH, computeViewport } from '../../render/projection.ts';

const FRAMEBUFFER_PIXEL_COUNT = SCREENWIDTH * SCREENHEIGHT;
const FULL_MODE_TARGET_X = 0;
const FULL_MODE_TARGET_Y = 0;
const MAX_PALETTE_INDEX = 0xff;
const RUNTIME_COMMAND = 'bun run doom.ts';

export const RENDER_AUTOMAP_OVERLAY_AND_FULL_MODE_COMMAND_CONTRACT = Object.freeze({
  entryFile: 'doom.ts',
  runtimeCommand: RUNTIME_COMMAND,
});

export interface AutomapLine {
  readonly colorIndex: number;
  readonly endX: number;
  readonly endY: number;
  readonly startX: number;
  readonly startY: number;
}

export type AutomapMode = 'full' | 'overlay';

export interface AutomapWorldBounds {
  readonly maxX: number;
  readonly maxY: number;
  readonly minX: number;
  readonly minY: number;
}

export interface RenderAutomapOverlayAndFullModeInput {
  readonly backgroundPaletteIndex: number;
  readonly command: string;
  readonly detailMode: DetailMode;
  readonly framebuffer: Uint8Array;
  readonly lines: readonly AutomapLine[];
  readonly mode: AutomapMode;
  readonly setBlocks: number;
  readonly worldBounds: AutomapWorldBounds;
}

export interface RenderAutomapOverlayAndFullModeResult {
  readonly backgroundPaletteIndex: number | null;
  readonly changedPixelCount: number;
  readonly clippedLineCount: number;
  readonly command: string;
  readonly detailMode: DetailMode;
  readonly drawnPixelCount: number;
  readonly framebufferChecksum: number;
  readonly mode: AutomapMode;
  readonly targetHeight: number;
  readonly targetWidth: number;
  readonly targetX: number;
  readonly targetY: number;
}

interface ClippedLine {
  readonly endX: number;
  readonly endY: number;
  readonly startX: number;
  readonly startY: number;
}

interface ProjectedLine extends ClippedLine {
  readonly colorIndex: number;
}

interface RenderTarget {
  readonly height: number;
  readonly width: number;
  readonly x: number;
  readonly y: number;
}

/**
 * Render deterministic automap pixels into the playable framebuffer.
 *
 * @param input Automap render input, including the exact Bun command contract.
 * @returns Replay-stable evidence for the rendered automap frame.
 * @example
 * ```ts
 * import { DetailMode } from "../../render/projection.ts";
 * import { renderAutomapOverlayAndFullMode } from "./renderAutomapOverlayAndFullMode.ts";
 *
 * const framebuffer = new Uint8Array(320 * 200);
 * renderAutomapOverlayAndFullMode({
 *   backgroundPaletteIndex: 0,
 *   command: "bun run doom.ts",
 *   detailMode: DetailMode.high,
 *   framebuffer,
 *   lines: [{ colorIndex: 32, endX: 128, endY: 0, startX: 0, startY: 0 }],
 *   mode: "full",
 *   setBlocks: 11,
 *   worldBounds: { maxX: 128, maxY: 128, minX: 0, minY: 0 },
 * });
 * ```
 */
export function renderAutomapOverlayAndFullMode(input: RenderAutomapOverlayAndFullModeInput): RenderAutomapOverlayAndFullModeResult {
  validateInput(input);

  const target = getRenderTarget(input.mode, input.setBlocks, input.detailMode);
  const projectedLines = projectLines(input.lines, input.worldBounds, target);
  const originalFramebuffer = input.framebuffer.slice();
  const linePixelMask = new Uint8Array(FRAMEBUFFER_PIXEL_COUNT);
  let clippedLineCount = 0;
  let drawnPixelCount = 0;

  if (input.mode === 'full') {
    input.framebuffer.fill(input.backgroundPaletteIndex);
  }

  for (const projectedLine of projectedLines) {
    const clippedLine = clipLineToTarget(projectedLine, target);

    if (clippedLine === null) {
      clippedLineCount += 1;
      continue;
    }

    if (clippedLine.startX !== projectedLine.startX || clippedLine.startY !== projectedLine.startY || clippedLine.endX !== projectedLine.endX || clippedLine.endY !== projectedLine.endY) {
      clippedLineCount += 1;
    }

    drawnPixelCount += drawLine(input.framebuffer, linePixelMask, clippedLine, projectedLine.colorIndex, target);
  }

  return {
    backgroundPaletteIndex: input.mode === 'full' ? input.backgroundPaletteIndex : null,
    changedPixelCount: countChangedPixels(originalFramebuffer, input.framebuffer),
    clippedLineCount,
    command: input.command,
    detailMode: input.detailMode,
    drawnPixelCount,
    framebufferChecksum: calculateFramebufferChecksum(input.framebuffer),
    mode: input.mode,
    targetHeight: target.height,
    targetWidth: target.width,
    targetX: target.x,
    targetY: target.y,
  };
}

function calculateFramebufferChecksum(framebuffer: Uint8Array): number {
  let checksum = 0x811c9dc5;

  for (const value of framebuffer) {
    checksum ^= value;
    checksum = Math.imul(checksum, 0x01000193) >>> 0;
  }

  return checksum;
}

function clipLineToTarget(line: ProjectedLine, target: RenderTarget): ClippedLine | null {
  const deltaX = line.endX - line.startX;
  const deltaY = line.endY - line.startY;
  let maximumFactor = 1;
  let minimumFactor = 0;
  const targetBottom = target.y + target.height - 1;
  const targetRight = target.x + target.width - 1;

  const clipEdges = [
    { numerator: line.startX - target.x, denominator: -deltaX },
    { numerator: targetRight - line.startX, denominator: deltaX },
    { numerator: line.startY - target.y, denominator: -deltaY },
    { numerator: targetBottom - line.startY, denominator: deltaY },
  ];

  for (const edge of clipEdges) {
    if (edge.denominator === 0) {
      if (edge.numerator < 0) {
        return null;
      }

      continue;
    }

    const factor = edge.numerator / edge.denominator;

    if (edge.denominator < 0) {
      if (factor > maximumFactor) {
        return null;
      }

      minimumFactor = Math.max(minimumFactor, factor);
      continue;
    }

    if (factor < minimumFactor) {
      return null;
    }

    maximumFactor = Math.min(maximumFactor, factor);
  }

  return {
    endX: Math.round(line.startX + maximumFactor * deltaX),
    endY: Math.round(line.startY + maximumFactor * deltaY),
    startX: Math.round(line.startX + minimumFactor * deltaX),
    startY: Math.round(line.startY + minimumFactor * deltaY),
  };
}

function countChangedPixels(originalFramebuffer: Uint8Array, framebuffer: Uint8Array): number {
  let changedPixelCount = 0;

  for (let pixelIndex = 0; pixelIndex < FRAMEBUFFER_PIXEL_COUNT; pixelIndex += 1) {
    if (originalFramebuffer[pixelIndex] !== framebuffer[pixelIndex]) {
      changedPixelCount += 1;
    }
  }

  return changedPixelCount;
}

function drawLine(framebuffer: Uint8Array, linePixelMask: Uint8Array, line: ClippedLine, colorIndex: number, target: RenderTarget): number {
  const deltaX = line.endX - line.startX;
  const deltaY = line.endY - line.startY;
  const steps = Math.max(Math.abs(deltaX), Math.abs(deltaY));

  if (steps === 0) {
    return writeAutomapPixel(framebuffer, linePixelMask, line.startX, line.startY, colorIndex, target);
  }

  let drawnPixelCount = 0;

  for (let stepIndex = 0; stepIndex <= steps; stepIndex += 1) {
    const x = Math.round(line.startX + (deltaX * stepIndex) / steps);
    const y = Math.round(line.startY + (deltaY * stepIndex) / steps);
    drawnPixelCount += writeAutomapPixel(framebuffer, linePixelMask, x, y, colorIndex, target);
  }

  return drawnPixelCount;
}

function getRenderTarget(mode: AutomapMode, setBlocks: number, detailMode: DetailMode): RenderTarget {
  if (mode === 'full') {
    return {
      height: SCREENHEIGHT,
      width: SCREENWIDTH,
      x: FULL_MODE_TARGET_X,
      y: FULL_MODE_TARGET_Y,
    };
  }

  const viewport = computeViewport(setBlocks, detailMode);

  return {
    height: viewport.viewHeight,
    width: viewport.scaledViewWidth,
    x: viewport.viewWindowX,
    y: viewport.viewWindowY,
  };
}

function isFiniteNumber(value: number): boolean {
  return Number.isFinite(value);
}

function isPaletteIndex(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= MAX_PALETTE_INDEX;
}

function projectLine(line: AutomapLine, worldBounds: AutomapWorldBounds, target: RenderTarget): ProjectedLine {
  const worldHeight = worldBounds.maxY - worldBounds.minY;
  const worldWidth = worldBounds.maxX - worldBounds.minX;

  return {
    colorIndex: line.colorIndex,
    endX: target.x + Math.round(((line.endX - worldBounds.minX) * (target.width - 1)) / worldWidth),
    endY: target.y + Math.round(((worldBounds.maxY - line.endY) * (target.height - 1)) / worldHeight),
    startX: target.x + Math.round(((line.startX - worldBounds.minX) * (target.width - 1)) / worldWidth),
    startY: target.y + Math.round(((worldBounds.maxY - line.startY) * (target.height - 1)) / worldHeight),
  };
}

function projectLines(lines: readonly AutomapLine[], worldBounds: AutomapWorldBounds, target: RenderTarget): readonly ProjectedLine[] {
  const projectedLines: ProjectedLine[] = [];

  for (const line of lines) {
    projectedLines.push(projectLine(line, worldBounds, target));
  }

  return projectedLines;
}

function validateInput(input: RenderAutomapOverlayAndFullModeInput): void {
  if (input.command !== RUNTIME_COMMAND) {
    throw new Error('Automap rendering requires command "bun run doom.ts".');
  }

  if (input.framebuffer.length !== FRAMEBUFFER_PIXEL_COUNT) {
    throw new Error(`Automap rendering requires a ${SCREENWIDTH}x${SCREENHEIGHT} framebuffer.`);
  }

  if (input.mode !== 'full' && input.mode !== 'overlay') {
    throw new Error('Automap mode must be "full" or "overlay".');
  }

  if (!Array.isArray(input.lines)) {
    throw new Error('Automap lines must be an array.');
  }

  validateWorldBounds(input.worldBounds);

  if (input.mode === 'full' && !isPaletteIndex(input.backgroundPaletteIndex)) {
    throw new Error('Automap background palette index must be an integer from 0 to 255.');
  }

  for (const line of input.lines) {
    validateLine(line);
  }
}

function validateLine(line: AutomapLine): void {
  if (!isPaletteIndex(line.colorIndex)) {
    throw new Error('Automap line palette index must be an integer from 0 to 255.');
  }

  if (!isFiniteNumber(line.endX) || !isFiniteNumber(line.endY) || !isFiniteNumber(line.startX) || !isFiniteNumber(line.startY)) {
    throw new Error('Automap line coordinates must be finite numbers.');
  }
}

function validateWorldBounds(worldBounds: AutomapWorldBounds): void {
  if (!isFiniteNumber(worldBounds.maxX) || !isFiniteNumber(worldBounds.maxY) || !isFiniteNumber(worldBounds.minX) || !isFiniteNumber(worldBounds.minY)) {
    throw new Error('Automap world bounds must be finite numbers.');
  }

  if (worldBounds.minX >= worldBounds.maxX || worldBounds.minY >= worldBounds.maxY) {
    throw new Error('Automap world bounds must have positive width and height.');
  }
}

function writeAutomapPixel(framebuffer: Uint8Array, linePixelMask: Uint8Array, x: number, y: number, colorIndex: number, target: RenderTarget): number {
  if (x < target.x || x >= target.x + target.width || y < target.y || y >= target.y + target.height) {
    return 0;
  }

  const pixelIndex = y * SCREENWIDTH + x;
  const firstLinePixelWrite = linePixelMask[pixelIndex] === 0;

  framebuffer[pixelIndex] = colorIndex;
  linePixelMask[pixelIndex] = 1;

  return firstLinePixelWrite ? 1 : 0;
}
