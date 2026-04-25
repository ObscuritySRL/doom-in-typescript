import { SCREENHEIGHT, SCREENWIDTH, computeViewport } from '../../render/projection.ts';
import type { DetailMode } from '../../render/projection.ts';

const FULL_FRAMEBUFFER_LENGTH = SCREENWIDTH * SCREENHEIGHT;
const HIGH_DETAIL_SHIFT: DetailMode = 0;
const LOW_DETAIL_SHIFT: DetailMode = 1;

export const RENDER_DETAIL_MODE_MISSING_LIVE_RENDERING_MANIFEST_PATH = 'plan_fps/manifests/01-012-audit-missing-live-rendering.json';
export const RENDER_DETAIL_MODE_RUNTIME_COMMAND = 'bun run doom.ts';

export interface RenderDetailModeEvidence {
  readonly changedPixelCount: number;
  readonly command: string;
  readonly detailShift: DetailMode;
  readonly duplicatedColumnCount: number;
  readonly framebufferChecksum: number;
  readonly framebufferLength: number;
  readonly sampleColumnCount: number;
  readonly scaledViewWidth: number;
  readonly setBlocks: number;
  readonly viewHeight: number;
  readonly viewWindowX: number;
  readonly viewWindowY: number;
}

export interface RenderDetailModeInput {
  readonly command: string;
  readonly detailShift: DetailMode;
  readonly framebuffer: Uint8Array;
  readonly setBlocks: number;
}

export function renderDetailMode(input: RenderDetailModeInput): RenderDetailModeEvidence {
  if (input.command !== RENDER_DETAIL_MODE_RUNTIME_COMMAND) {
    throw new Error(`render-detail-mode requires command ${RENDER_DETAIL_MODE_RUNTIME_COMMAND}`);
  }

  if (input.framebuffer.length !== FULL_FRAMEBUFFER_LENGTH) {
    throw new Error(`render-detail-mode requires ${FULL_FRAMEBUFFER_LENGTH} framebuffer bytes`);
  }

  const detailShift = input.detailShift === HIGH_DETAIL_SHIFT ? HIGH_DETAIL_SHIFT : LOW_DETAIL_SHIFT;
  const viewport = computeViewport(input.setBlocks, detailShift);
  const sampleColumnCount = viewport.viewWidth;
  let changedPixelCount = 0;

  if (detailShift === LOW_DETAIL_SHIFT) {
    const rowSamples = new Uint8Array(sampleColumnCount);

    for (let viewportRowIndex = 0; viewportRowIndex < viewport.viewHeight; viewportRowIndex += 1) {
      const framebufferRowStart = (viewport.viewWindowY + viewportRowIndex) * SCREENWIDTH;
      const sourceRowStart = framebufferRowStart + viewport.viewWindowX;

      rowSamples.set(input.framebuffer.subarray(sourceRowStart, sourceRowStart + sampleColumnCount));

      for (let logicalColumnIndex = 0; logicalColumnIndex < sampleColumnCount; logicalColumnIndex += 1) {
        const sampleValue = rowSamples[logicalColumnIndex]!;
        const destinationColumn = viewport.viewWindowX + logicalColumnIndex * 2;
        const firstDestinationIndex = framebufferRowStart + destinationColumn;
        const secondDestinationIndex = firstDestinationIndex + 1;

        if (input.framebuffer[firstDestinationIndex] !== sampleValue) {
          changedPixelCount += 1;
          input.framebuffer[firstDestinationIndex] = sampleValue;
        }

        if (input.framebuffer[secondDestinationIndex] !== sampleValue) {
          changedPixelCount += 1;
          input.framebuffer[secondDestinationIndex] = sampleValue;
        }
      }
    }
  }

  return {
    changedPixelCount,
    command: RENDER_DETAIL_MODE_RUNTIME_COMMAND,
    detailShift,
    duplicatedColumnCount: detailShift === LOW_DETAIL_SHIFT ? sampleColumnCount : 0,
    framebufferChecksum: computeFramebufferChecksum(input.framebuffer),
    framebufferLength: input.framebuffer.length,
    sampleColumnCount,
    scaledViewWidth: viewport.scaledViewWidth,
    setBlocks: input.setBlocks,
    viewHeight: viewport.viewHeight,
    viewWindowX: viewport.viewWindowX,
    viewWindowY: viewport.viewWindowY,
  };
}

function computeFramebufferChecksum(framebuffer: Uint8Array): number {
  let checksum = 0x811c9dc5;

  for (const byteValue of framebuffer) {
    checksum = Math.imul(checksum ^ byteValue, 0x0100_0193) >>> 0;
  }

  return checksum;
}
