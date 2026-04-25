import { computeViewport, DetailMode, SCREENHEIGHT, SCREENWIDTH } from '../../render/projection.ts';

import type { Viewport } from '../../render/projection.ts';

export const ADD_FRAMEBUFFER_HASH_TEST_HOOKS_AUDIT_SCHEMA_VERSION = 1;
export const ADD_FRAMEBUFFER_HASH_TEST_HOOKS_COMMAND = 'bun run doom.ts';
export const ADD_FRAMEBUFFER_HASH_TEST_HOOKS_MISSING_SURFACE = 'framebuffer-hash-capture-hook';

const FRAMEBUFFER_BYTE_LENGTH = SCREENWIDTH * SCREENHEIGHT;

export interface AddFramebufferHashTestHooksOptions {
  readonly detailMode: DetailMode;
  readonly runtimeCommand: string;
  readonly screenBlocks: number;
}

export interface CaptureFramebufferHashOptions {
  readonly frameNumber: number;
  readonly framebuffer: Uint8Array;
  readonly previousFramebuffer?: Uint8Array;
  readonly tag: string;
}

export interface FramebufferHashEvidence {
  readonly changedByteCount: number;
  readonly command: typeof ADD_FRAMEBUFFER_HASH_TEST_HOOKS_COMMAND;
  readonly frameNumber: number;
  readonly fullFramebufferChecksum: number;
  readonly fullFramebufferHash: string;
  readonly tag: string;
  readonly transitionHash: string;
  readonly viewport: FramebufferHashViewportEvidence;
}

export interface FramebufferHashTestHooks {
  readonly captureFramebufferHash: (options: CaptureFramebufferHashOptions) => FramebufferHashEvidence;
  readonly command: typeof ADD_FRAMEBUFFER_HASH_TEST_HOOKS_COMMAND;
  readonly detailMode: DetailMode;
  readonly screenBlocks: number;
}

export interface FramebufferHashViewportEvidence {
  readonly checksum: number;
  readonly hash: string;
  readonly height: number;
  readonly width: number;
  readonly x: number;
  readonly y: number;
}

export function addFramebufferHashTestHooks(options: AddFramebufferHashTestHooksOptions): FramebufferHashTestHooks {
  assertRuntimeCommand(options.runtimeCommand);

  const viewport = computeViewport(options.screenBlocks, options.detailMode);

  return Object.freeze({
    captureFramebufferHash: (captureOptions: CaptureFramebufferHashOptions): FramebufferHashEvidence => captureFramebufferHash(captureOptions, viewport),
    command: ADD_FRAMEBUFFER_HASH_TEST_HOOKS_COMMAND,
    detailMode: options.detailMode,
    screenBlocks: options.screenBlocks,
  });
}

function assertFramebuffer(framebuffer: Uint8Array, name: string): void {
  if (framebuffer.length !== FRAMEBUFFER_BYTE_LENGTH) {
    throw new Error(`${name} must be ${FRAMEBUFFER_BYTE_LENGTH} bytes.`);
  }
}

function assertRuntimeCommand(runtimeCommand: string): void {
  if (runtimeCommand !== ADD_FRAMEBUFFER_HASH_TEST_HOOKS_COMMAND) {
    throw new Error(`Expected runtime command ${ADD_FRAMEBUFFER_HASH_TEST_HOOKS_COMMAND}.`);
  }
}

function captureFramebufferHash(options: CaptureFramebufferHashOptions, viewport: Viewport): FramebufferHashEvidence {
  assertFramebuffer(options.framebuffer, 'framebuffer');

  if (!Number.isInteger(options.frameNumber) || options.frameNumber < 0) {
    throw new Error('frameNumber must be a non-negative integer.');
  }

  if (options.tag.length === 0) {
    throw new Error('tag must not be empty.');
  }

  if (options.previousFramebuffer !== undefined) {
    assertFramebuffer(options.previousFramebuffer, 'previousFramebuffer');
  }

  return {
    changedByteCount: options.previousFramebuffer === undefined ? 0 : countChangedBytes(options.previousFramebuffer, options.framebuffer),
    command: ADD_FRAMEBUFFER_HASH_TEST_HOOKS_COMMAND,
    frameNumber: options.frameNumber,
    fullFramebufferChecksum: computeByteChecksum(options.framebuffer),
    fullFramebufferHash: computeSha256Hex(options.framebuffer),
    tag: options.tag,
    transitionHash: computeTransitionHash(options.previousFramebuffer, options.framebuffer),
    viewport: {
      checksum: computeViewportChecksum(options.framebuffer, viewport),
      hash: computeViewportHash(options.framebuffer, viewport),
      height: viewport.viewHeight,
      width: viewport.scaledViewWidth,
      x: viewport.viewWindowX,
      y: viewport.viewWindowY,
    },
  };
}

function computeByteChecksum(framebuffer: Uint8Array): number {
  const byteCount = framebuffer.length;
  let checksum = 0;

  for (let byteIndex = 0; byteIndex < byteCount; byteIndex += 1) {
    checksum = (checksum + framebuffer[byteIndex]! * (byteIndex + 1)) >>> 0;
  }

  return checksum;
}

function computeSha256Hex(bytes: Uint8Array): string {
  const hasher = new Bun.CryptoHasher('sha256');
  hasher.update(bytes);
  return hasher.digest('hex');
}

function computeTransitionHash(previousFramebuffer: Uint8Array | undefined, framebuffer: Uint8Array): string {
  const hasher = new Bun.CryptoHasher('sha256');

  if (previousFramebuffer !== undefined) {
    hasher.update(previousFramebuffer);
  }

  hasher.update(framebuffer);
  return hasher.digest('hex');
}

function computeViewportChecksum(framebuffer: Uint8Array, viewport: Viewport): number {
  const viewWindowY = viewport.viewWindowY;
  const viewWindowX = viewport.viewWindowX;
  const viewHeight = viewport.viewHeight;
  const scaledViewWidth = viewport.scaledViewWidth;
  const yEnd = viewWindowY + viewHeight;
  const xEnd = viewWindowX + scaledViewWidth;
  let checksum = 0;
  let viewportByteIndex = 0;

  for (let y = viewWindowY; y < yEnd; y += 1) {
    const rowOffset = y * SCREENWIDTH;

    for (let x = viewWindowX; x < xEnd; x += 1) {
      viewportByteIndex += 1;
      checksum = (checksum + framebuffer[rowOffset + x]! * viewportByteIndex) >>> 0;
    }
  }

  return checksum;
}

function computeViewportHash(framebuffer: Uint8Array, viewport: Viewport): string {
  const hasher = new Bun.CryptoHasher('sha256');
  const viewWindowY = viewport.viewWindowY;
  const viewWindowX = viewport.viewWindowX;
  const viewHeight = viewport.viewHeight;
  const scaledViewWidth = viewport.scaledViewWidth;
  const yEnd = viewWindowY + viewHeight;

  for (let y = viewWindowY; y < yEnd; y += 1) {
    const rowOffset = y * SCREENWIDTH + viewWindowX;
    hasher.update(framebuffer.subarray(rowOffset, rowOffset + scaledViewWidth));
  }

  return hasher.digest('hex');
}

function countChangedBytes(previousFramebuffer: Uint8Array, framebuffer: Uint8Array): number {
  const byteCount = framebuffer.length;
  let changedByteCount = 0;

  for (let byteIndex = 0; byteIndex < byteCount; byteIndex += 1) {
    if (previousFramebuffer[byteIndex] !== framebuffer[byteIndex]) {
      changedByteCount += 1;
    }
  }

  return changedByteCount;
}
