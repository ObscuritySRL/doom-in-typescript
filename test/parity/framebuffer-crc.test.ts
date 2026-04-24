import { describe, expect, it } from 'bun:test';

import { fileURLToPath } from 'node:url';

import { FRACBITS, FRACUNIT } from '../../src/core/fixed.ts';
import { renderMaskedSegRange } from '../../src/render/maskedTextures.ts';
import type { MaskedDrawSeg, MaskedSegRenderContext } from '../../src/render/maskedTextures.ts';
import { decodePatch, drawPatch, PATCH_COLUMN_END_MARKER, PATCH_COLUMN_OFFSET_BYTES, PATCH_HEADER_BYTES, POST_HEADER_BYTES, POST_TRAILING_PAD_BYTES } from '../../src/render/patchDraw.ts';
import type { DecodedPatch, PatchColumn, PatchPost } from '../../src/render/patchDraw.ts';
import { DetailMode, MAXLIGHTSCALE, SCREENHEIGHT, SCREENWIDTH, computeViewport } from '../../src/render/projection.ts';
import { VISPLANE_TOP_UNFILLED } from '../../src/render/renderLimits.ts';
import type { Visplane } from '../../src/render/renderLimits.ts';
import { REFERENCE_BUNDLE_PATH } from '../../src/reference/policy.ts';
import { ANGLETOSKYSHIFT, renderSkyVisplane } from '../../src/render/sky.ts';
import type { SkyRenderContext } from '../../src/render/sky.ts';
import { HEIGHTUNIT as SOLID_HEIGHT_UNIT, renderSolidWall } from '../../src/render/solidWalls.ts';
import type { SolidWallRenderContext, SolidWallSegment } from '../../src/render/solidWalls.ts';
import { createSpriteClipBuffers, drawMasked } from '../../src/render/spriteClip.ts';
import { createVisSpritePool, projectSprite } from '../../src/render/spriteProjection.ts';
import type { ProjectableThing, SpriteDef, SpriteFrame, SpriteMetrics, SpriteProjectionContext, VisSprite } from '../../src/render/spriteProjection.ts';
import { HEIGHTUNIT as TWO_SIDED_HEIGHT_UNIT, renderTwoSidedWall } from '../../src/render/twoSidedWalls.ts';
import type { TwoSidedWallRenderContext, TwoSidedWallSegment } from '../../src/render/twoSidedWalls.ts';
import { createPlaneSpanCache, renderVisplaneSpans } from '../../src/render/visplaneSpans.ts';
import type { PlaneSpanCache, VisplaneSpanContext } from '../../src/render/visplaneSpans.ts';
import { prepareWallTexture } from '../../src/render/wallColumns.ts';
import type { PreparedWallTexture, WallPatchPlacement } from '../../src/render/wallColumns.ts';

const EXECUTABLE_FILE_NAMES = Object.freeze(['DOOM.EXE', 'DOOMD.EXE'] as const);
const IDENTITY_COLORMAP = Uint8Array.from({ length: 256 }, (_, paletteByte) => paletteByte);
const VIEWPORT_CONFIGURATIONS = Object.freeze(
  Array.from({ length: 9 }, (_, configurationOffset) => {
    const setBlocks = configurationOffset + 3;
    return Object.freeze([Object.freeze({ detailShift: DetailMode.high, setBlocks }), Object.freeze({ detailShift: DetailMode.low, setBlocks })]);
  }).flat(),
);

interface FramebufferHashFixture {
  readonly description: string;
  readonly viewportEntries: readonly FramebufferViewportFixtureEntry[];
}

interface FramebufferViewportFixtureEntry {
  readonly detailShift: number;
  readonly fullFrameHash: string;
  readonly paletteIndex: number;
  readonly scaledViewWidth: number;
  readonly setBlocks: number;
  readonly viewHeight: number;
  readonly viewWidth: number;
  readonly viewWindowHash: string;
  readonly viewWindowX: number;
  readonly viewWindowY: number;
}

interface RenderedViewportFrame {
  readonly entry: FramebufferViewportFixtureEntry;
  readonly fullFramebuffer: Uint8Array;
}

interface RenderViewportFrameOptions {
  readonly duplicateLowDetailColumns?: boolean;
  readonly paletteIndex?: number;
}

interface SyntheticPost {
  readonly pixels: readonly number[];
  readonly topDelta: number;
}

interface ViewportConfiguration {
  readonly detailShift: DetailMode;
  readonly setBlocks: number;
}

function buildPatchLump(width: number, height: number, columns: readonly (readonly SyntheticPost[])[]): Uint8Array {
  if (columns.length !== width) {
    throw new RangeError(`column count ${columns.length} does not match width ${width}`);
  }

  const serializedColumns = columns.map((columnPosts) => {
    const columnByteLength = columnPosts.reduce((currentTotal, currentPost) => currentTotal + POST_HEADER_BYTES + currentPost.pixels.length + POST_TRAILING_PAD_BYTES, 0) + 1;
    const serializedColumn = new Uint8Array(columnByteLength);
    let columnCursor = 0;

    for (const currentPost of columnPosts) {
      serializedColumn[columnCursor] = currentPost.topDelta & 0xff;
      serializedColumn[columnCursor + 1] = currentPost.pixels.length & 0xff;
      serializedColumn[columnCursor + 2] = 0x00;

      for (let pixelIndex = 0; pixelIndex < currentPost.pixels.length; pixelIndex += 1) {
        serializedColumn[columnCursor + POST_HEADER_BYTES + pixelIndex] = currentPost.pixels[pixelIndex]! & 0xff;
      }

      serializedColumn[columnCursor + POST_HEADER_BYTES + currentPost.pixels.length] = 0x00;
      columnCursor += POST_HEADER_BYTES + currentPost.pixels.length + POST_TRAILING_PAD_BYTES;
    }

    serializedColumn[columnCursor] = PATCH_COLUMN_END_MARKER;
    return serializedColumn;
  });

  const columnOffsetTableByteLength = width * PATCH_COLUMN_OFFSET_BYTES;
  const patchHeaderByteLength = PATCH_HEADER_BYTES + columnOffsetTableByteLength;
  const totalPatchByteLength = patchHeaderByteLength + serializedColumns.reduce((currentTotal, serializedColumn) => currentTotal + serializedColumn.length, 0);
  const patchLump = new Uint8Array(totalPatchByteLength);
  const patchView = new DataView(patchLump.buffer, patchLump.byteOffset, patchLump.byteLength);

  patchView.setInt16(0, width, true);
  patchView.setInt16(2, height, true);
  patchView.setInt16(4, 0, true);
  patchView.setInt16(6, 0, true);

  let columnStartOffset = patchHeaderByteLength;
  for (let columnIndex = 0; columnIndex < width; columnIndex += 1) {
    patchView.setInt32(PATCH_HEADER_BYTES + columnIndex * PATCH_COLUMN_OFFSET_BYTES, columnStartOffset, true);
    const serializedColumn = serializedColumns[columnIndex]!;
    patchLump.set(serializedColumn, columnStartOffset);
    columnStartOffset += serializedColumn.length;
  }

  return patchLump;
}

function createColumnDistinctTexture(width: number, height: number): PreparedWallTexture {
  const distinctPatch = createSolidPatch(width, height, (columnIndex, rowIndex) => (columnIndex * 19 + rowIndex * 7) & 0xff);
  const patchPlacements: readonly WallPatchPlacement[] = [{ originX: 0, originY: 0, patch: distinctPatch }];
  return prepareWallTexture('DISTINCT', width, height, patchPlacements);
}

function createDecorPatch(): DecodedPatch {
  return decodePatch(
    buildPatchLump(8, 8, [
      [
        { pixels: [0x90, 0x91, 0x92], topDelta: 0 },
        { pixels: [0x93, 0x94], topDelta: 5 },
      ],
      [{ pixels: [0x95, 0x96, 0x97, 0x98], topDelta: 1 }],
      [
        { pixels: [0x99, 0x9a], topDelta: 0 },
        { pixels: [0x9b, 0x9c, 0x9d], topDelta: 4 },
      ],
      [{ pixels: [0x9e, 0x9f, 0xa0, 0xa1, 0xa2], topDelta: 2 }],
      [
        { pixels: [0xa3, 0xa4, 0xa5], topDelta: 1 },
        { pixels: [0xa6, 0xa7], topDelta: 6 },
      ],
      [{ pixels: [0xa8, 0xa9, 0xaa, 0xab], topDelta: 0 }],
      [
        { pixels: [0xac, 0xad, 0xae], topDelta: 2 },
        { pixels: [0xaf], topDelta: 6 },
      ],
      [{ pixels: [0xb0, 0xb1, 0xb2, 0xb3], topDelta: 1 }],
    ]),
  );
}

function createExecutableText(executableFileName: (typeof EXECUTABLE_FILE_NAMES)[number]): Promise<string> {
  const executablePath = `${REFERENCE_BUNDLE_PATH}\\${executableFileName}`;
  return Bun.file(executablePath)
    .arrayBuffer()
    .then((executableBuffer) => Buffer.from(executableBuffer).toString('latin1'));
}

function createFlatSource(configuration: Readonly<ViewportConfiguration>): Uint8Array {
  return Uint8Array.from({ length: 64 * 64 }, (_ignoredValue, pixelIndex) => (pixelIndex + configuration.setBlocks * 13 + configuration.detailShift * 29) & 0xff);
}

function createFloorVisplane(viewWidth: number, viewHeight: number, firstFloorRow: number, configuration: Readonly<ViewportConfiguration>): Visplane {
  const floorVisplane = createVisplane(viewWidth, 0, viewWidth - 1);

  for (let columnIndex = 0; columnIndex < viewWidth; columnIndex += 1) {
    const topRow = Math.min(viewHeight - 1, firstFloorRow + ((columnIndex + configuration.setBlocks) & 1));
    paintVisplaneColumn(floorVisplane, columnIndex, topRow, viewHeight - 1);
  }

  return floorVisplane;
}

function createLogicalBackgroundByte(configuration: Readonly<ViewportConfiguration>): number {
  return (0x18 + configuration.setBlocks * 3 + configuration.detailShift * 11) & 0xff;
}

function createMaskedColumn(postHeight: number, secondPostStart: number, secondPostHeight: number, textureColumn: number): PatchColumn {
  const firstPost: PatchPost = Object.freeze({
    length: postHeight,
    pixels: Uint8Array.from({ length: postHeight }, (_ignoredValue, pixelIndex) => (0xb8 + textureColumn * 5 + pixelIndex) & 0xff),
    topDelta: 2,
  });
  const secondPost: PatchPost = Object.freeze({
    length: secondPostHeight,
    pixels: Uint8Array.from({ length: secondPostHeight }, (_ignoredValue, pixelIndex) => (0xc8 + textureColumn * 7 + pixelIndex) & 0xff),
    topDelta: secondPostStart,
  });

  return Object.freeze([firstPost, secondPost]);
}

function createMaskedDrawSegment(viewWidth: number, viewHeight: number, firstColumn: number, lastColumn: number): MaskedDrawSeg {
  const maskedTextureColumns = new Int16Array(viewWidth);
  maskedTextureColumns.fill(0);
  const spriteBottomClip = new Int16Array(viewWidth).fill(viewHeight);
  const spriteTopClip = new Int16Array(viewWidth).fill(-1);
  const secondPostHeight = Math.max(2, Math.min(5, Math.floor(viewHeight / 10)));
  const secondPostStart = Math.max(6, Math.floor(viewHeight / 2));
  const topPostHeight = Math.max(2, Math.min(4, Math.floor(viewHeight / 12)));

  for (let columnIndex = 0; columnIndex < viewWidth; columnIndex += 1) {
    if (columnIndex < firstColumn || columnIndex > lastColumn) {
      maskedTextureColumns[columnIndex] = 0x7fff;
    } else {
      maskedTextureColumns[columnIndex] = columnIndex - firstColumn;
    }
  }

  const wallLights = Array.from({ length: MAXLIGHTSCALE }, () => IDENTITY_COLORMAP);

  return {
    bsilheight: 0,
    fixedColormap: null,
    maskedColumnFor: (textureColumn) => createMaskedColumn(topPostHeight, secondPostStart, secondPostHeight, textureColumn),
    maskedtexturecol: maskedTextureColumns,
    midTextureWidthMask: 127,
    scale1: FRACUNIT,
    scale2: FRACUNIT,
    scaleStep: 0,
    silhouette: 0,
    sprbottomclip: spriteBottomClip,
    sprtopclip: spriteTopClip,
    textureMid: (viewHeight >> 1) * FRACUNIT,
    tsilheight: 0,
    v1x: 0,
    v1y: 0,
    wallLights,
    x1: firstColumn,
    x2: lastColumn,
    v2x: 1,
    v2y: 0,
  };
}

function createMaskedRenderContext(framebuffer: Uint8Array, viewWidth: number, viewHeight: number): MaskedSegRenderContext {
  return {
    centerY: viewHeight >> 1,
    centerYFrac: (viewHeight >> 1) * FRACUNIT,
    framebuffer,
    screenWidth: viewWidth,
  };
}

function createProjectableThing(): ProjectableThing {
  return {
    angle: 0,
    flags: 0,
    frame: 0,
    sprite: 0,
    x: 128 << FRACBITS,
    y: 0,
    z: 0,
  };
}

function createSkyContext(framebuffer: Uint8Array, viewWidth: number, viewHeight: number, configuration: Readonly<ViewportConfiguration>): SkyRenderContext {
  const xToViewAngle = new Int32Array(viewWidth);

  for (let columnIndex = 0; columnIndex < viewWidth; columnIndex += 1) {
    xToViewAngle[columnIndex] = (((columnIndex + configuration.setBlocks + configuration.detailShift) & 7) << ANGLETOSKYSHIFT) | 0;
  }

  return {
    baseColormap: IDENTITY_COLORMAP,
    centerY: viewHeight >> 1,
    framebuffer,
    iscale: FRACUNIT,
    screenWidth: viewWidth,
    skyTexture: createSkyTexture(8, 128, configuration),
    textureMid: 0,
    viewAngle: 0,
    xToViewAngle,
  };
}

function createSkyTexture(width: number, height: number, configuration: Readonly<ViewportConfiguration>): PreparedWallTexture {
  let widthMask = 0;

  if (width > 0) {
    let powerOfTwoWidth = 1;
    while (powerOfTwoWidth * 2 <= width) {
      powerOfTwoWidth <<= 1;
    }
    widthMask = powerOfTwoWidth - 1;
  }

  const compositePixels = new Uint8Array(width * height);
  const columns: Uint8Array[] = new Array(width);

  for (let columnIndex = 0; columnIndex < width; columnIndex += 1) {
    const columnOffset = columnIndex * height;
    for (let rowIndex = 0; rowIndex < height; rowIndex += 1) {
      compositePixels[columnOffset + rowIndex] = (0x40 + configuration.setBlocks * 5 + configuration.detailShift * 17 + columnIndex * 13 + rowIndex) & 0xff;
    }
    columns[columnIndex] = compositePixels.subarray(columnOffset, columnOffset + height);
  }

  return Object.freeze({
    columns: Object.freeze(columns),
    composite: compositePixels,
    height,
    name: `SKY${width}`,
    width,
    widthMask,
  }) as PreparedWallTexture;
}

function createSolidPatch(width: number, height: number, pixelForCell: (columnIndex: number, rowIndex: number) => number): DecodedPatch {
  const columns = Array.from({ length: width }, (_ignoredValue, columnIndex) =>
    Object.freeze([
      Object.freeze({
        pixels: Array.from({ length: height }, (_innerIgnoredValue, rowIndex) => pixelForCell(columnIndex, rowIndex)),
        topDelta: 0,
      }),
    ]),
  );

  return decodePatch(buildPatchLump(width, height, columns));
}

function createSolidWallContext(framebuffer: Uint8Array, viewWidth: number, viewHeight: number): SolidWallRenderContext {
  return {
    ceilingClip: new Int16Array(viewWidth).fill(-1),
    centerY: viewHeight >> 1,
    floorClip: new Int16Array(viewWidth).fill(viewHeight),
    framebuffer,
    screenWidth: viewWidth,
    viewHeight,
  };
}

function createSolidWallSegment(viewWidth: number, viewHeight: number): SolidWallSegment {
  const firstSolidColumn = 0;
  const lastSolidColumn = Math.max(4, Math.floor(viewWidth / 4));
  const firstVisibleRow = Math.max(1, Math.floor(viewHeight / 10));
  const lastVisibleRow = Math.max(firstVisibleRow + 4, Math.floor((viewHeight * 3) / 5));
  const wallLights = Array.from({ length: MAXLIGHTSCALE }, () => IDENTITY_COLORMAP);

  return {
    bottomFrac: lastVisibleRow * SOLID_HEIGHT_UNIT,
    bottomStep: 0,
    ceilingPlane: null,
    floorPlane: null,
    markCeiling: false,
    markFloor: false,
    midTexture: createColumnDistinctTexture(8, 128),
    midTextureMid: 0,
    rwStopX: Math.min(viewWidth, lastSolidColumn),
    rwX: firstSolidColumn,
    scale: 0x1000,
    scaleStep: 0,
    textureColumnFor: (columnIndex) => columnIndex * 3,
    topFrac: firstVisibleRow * SOLID_HEIGHT_UNIT,
    topStep: 0,
    wallLights,
  };
}

function createSpriteDefinitions(): readonly SpriteDef[] {
  return Object.freeze([{ frames: [createSpriteFrame()], numFrames: 1 }]);
}

function createSpriteFrame(): SpriteFrame {
  return {
    flip: [false, false, false, false, false, false, false, false],
    lump: [0, 1, 2, 3, 4, 5, 6, 7],
    rotate: false,
  };
}

function createSpriteLights(): readonly Uint8Array[] {
  return Array.from({ length: MAXLIGHTSCALE }, (_ignoredValue, lightIndex) => Uint8Array.from({ length: 256 }, (_innerIgnoredValue, paletteIndex) => (paletteIndex + lightIndex) & 0xff));
}

function createSpriteMetrics(): SpriteMetrics {
  const lumpCount = 8;
  const horizontalOffsets = new Int32Array(lumpCount);
  const topOffsets = new Int32Array(lumpCount).fill(12 << FRACBITS);
  const widths = new Int32Array(lumpCount).fill(8 << FRACBITS);

  return {
    offset: horizontalOffsets,
    topOffset: topOffsets,
    width: widths,
  };
}

function createSpriteProjectionContext(viewportConfiguration: Readonly<ViewportConfiguration>, viewWidth: number): SpriteProjectionContext {
  const viewport = computeViewport(viewportConfiguration.setBlocks, viewportConfiguration.detailShift);

  return {
    centerXFrac: viewport.centerXFrac,
    colormaps: IDENTITY_COLORMAP,
    detailShift: viewportConfiguration.detailShift,
    fixedColormap: null,
    projection: viewport.projection,
    spriteLights: createSpriteLights(),
    spriteMetrics: createSpriteMetrics(),
    sprites: createSpriteDefinitions(),
    viewCos: FRACUNIT,
    viewSin: 0,
    viewWidth,
    viewX: 0,
    viewY: 0,
    viewZ: 0,
  };
}

function createTwoSidedWallContext(framebuffer: Uint8Array, viewWidth: number, viewHeight: number): TwoSidedWallRenderContext {
  return {
    ceilingClip: new Int16Array(viewWidth).fill(-1),
    centerY: viewHeight >> 1,
    floorClip: new Int16Array(viewWidth).fill(viewHeight),
    framebuffer,
    screenWidth: viewWidth,
    viewHeight,
  };
}

function createTwoSidedWallSegment(viewWidth: number, viewHeight: number): TwoSidedWallSegment {
  const firstColumn = Math.max(2, Math.floor(viewWidth / 3));
  const lastColumn = Math.min(viewWidth, firstColumn + Math.max(4, Math.floor(viewWidth / 5)));
  const openingTopRow = Math.max(3, Math.floor(viewHeight / 4));
  const openingBottomRow = Math.max(openingTopRow + 6, Math.floor((viewHeight * 2) / 3));
  const wallLights = Array.from({ length: MAXLIGHTSCALE }, () => IDENTITY_COLORMAP);

  return {
    bottomFrac: (viewHeight - 1) * TWO_SIDED_HEIGHT_UNIT,
    bottomStep: 0,
    bottomTexture: createUniformTexture('LOWER', 8, 128, 0x6e),
    bottomTextureMid: 0,
    ceilingPlane: null,
    floorPlane: null,
    markCeiling: false,
    markFloor: false,
    maskedTextureCol: null,
    pixHigh: openingTopRow * TWO_SIDED_HEIGHT_UNIT,
    pixHighStep: 0,
    pixLow: openingBottomRow * TWO_SIDED_HEIGHT_UNIT,
    pixLowStep: 0,
    rwStopX: lastColumn,
    rwX: firstColumn,
    scale: 0x1000,
    scaleStep: 0,
    textureColumnFor: (columnIndex) => columnIndex * 5,
    topFrac: 0,
    topStep: 0,
    topTexture: createUniformTexture('UPPER', 8, 128, 0x5d),
    topTextureMid: 0,
    wallLights,
  };
}

function createUniformTexture(name: string, width: number, height: number, byteValue: number): PreparedWallTexture {
  const uniformPatch = createSolidPatch(width, height, () => byteValue);
  const patchPlacements: readonly WallPatchPlacement[] = [{ originX: 0, originY: 0, patch: uniformPatch }];
  return prepareWallTexture(name, width, height, patchPlacements);
}

function createVisplane(viewWidth: number, minimumColumn: number, maximumColumn: number): Visplane {
  return {
    bottom: new Uint8Array(viewWidth),
    height: 0,
    lightlevel: 0,
    maxx: maximumColumn,
    minx: minimumColumn,
    picnum: 0,
    top: new Uint8Array(viewWidth).fill(VISPLANE_TOP_UNFILLED),
  };
}

function createVisplaneSpanContext(framebuffer: Uint8Array, planeSpanCache: PlaneSpanCache, viewWidth: number, viewHeight: number, configuration: Readonly<ViewportConfiguration>): VisplaneSpanContext {
  const planeZLight = Array.from({ length: 128 }, () => IDENTITY_COLORMAP);

  return {
    baseXScale: 0,
    baseYScale: 0,
    cachedDistance: planeSpanCache.cachedDistance,
    cachedHeight: planeSpanCache.cachedHeight,
    cachedXStep: planeSpanCache.cachedXStep,
    cachedYStep: planeSpanCache.cachedYStep,
    distScale: new Int32Array(viewWidth),
    fixedColormap: null,
    flatSource: createFlatSource(configuration),
    framebuffer,
    planeHeight: FRACUNIT,
    planeZLight,
    screenWidth: viewWidth,
    spanStart: planeSpanCache.spanStart,
    viewAngle: 0,
    viewX: 0,
    viewY: 0,
    xToViewAngle: new Int32Array(viewWidth + 1),
    ySlope: new Int32Array(viewHeight),
  };
}

function createViewWindowBytes(fullFramebuffer: Uint8Array, viewportEntry: Readonly<FramebufferViewportFixtureEntry>): Uint8Array {
  const viewWindowByteCount = viewportEntry.scaledViewWidth * viewportEntry.viewHeight;
  const viewWindowBytes = new Uint8Array(viewWindowByteCount);
  let writeOffset = 0;

  for (let rowIndex = 0; rowIndex < viewportEntry.viewHeight; rowIndex += 1) {
    const rowOffset = (viewportEntry.viewWindowY + rowIndex) * SCREENWIDTH + viewportEntry.viewWindowX;
    viewWindowBytes.set(fullFramebuffer.subarray(rowOffset, rowOffset + viewportEntry.scaledViewWidth), writeOffset);
    writeOffset += viewportEntry.scaledViewWidth;
  }

  return viewWindowBytes;
}

function findViewportFixtureEntry(framebufferHashFixture: Readonly<FramebufferHashFixture>, setBlocks: number, detailShift: DetailMode): FramebufferViewportFixtureEntry {
  const matchingViewportEntry = framebufferHashFixture.viewportEntries.find((viewportEntry) => viewportEntry.setBlocks === setBlocks && viewportEntry.detailShift === detailShift);

  if (matchingViewportEntry === undefined) {
    throw new Error(`Missing fixture entry for setBlocks=${setBlocks}, detailShift=${detailShift}`);
  }

  return matchingViewportEntry;
}

function hashBytes(bytes: Uint8Array): string {
  return new Bun.CryptoHasher('sha256').update(bytes).digest('hex').toUpperCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function paintDecorPatch(framebuffer: Uint8Array, viewWidth: number, viewHeight: number): void {
  const patchOriginX = Math.max(6, viewWidth - 9);
  const patchOriginY = Math.max(6, Math.floor(viewHeight / 2));

  drawPatch(createDecorPatch(), patchOriginX, patchOriginY, framebuffer, viewWidth, viewHeight);
}

function paintPlayerWeaponOverlay(framebuffer: Uint8Array, viewWidth: number, viewHeight: number): void {
  const centerColumn = Math.floor(viewWidth / 2);
  const firstColumn = Math.max(0, centerColumn - 2);
  const lastColumn = Math.min(viewWidth - 1, centerColumn + 2);
  const firstRow = Math.max(0, viewHeight - Math.max(4, Math.floor(viewHeight / 8)));

  for (let rowIndex = firstRow; rowIndex < viewHeight; rowIndex += 1) {
    for (let columnIndex = firstColumn; columnIndex <= lastColumn; columnIndex += 1) {
      framebuffer[rowIndex * viewWidth + columnIndex] = (0xd0 + columnIndex - firstColumn + rowIndex - firstRow) & 0xff;
    }
  }
}

function paintProjectedSprite(framebuffer: Uint8Array, viewWidth: number, viewHeight: number, visibleSprite: Readonly<VisSprite>, clipBottom: Int16Array, clipTop: Int16Array): void {
  for (let columnIndex = visibleSprite.x1; columnIndex <= visibleSprite.x2; columnIndex += 1) {
    const firstVisibleRow = Math.max(0, clipTop[columnIndex]! + 1, Math.floor(viewHeight / 3));
    const lastVisibleRow = Math.min(viewHeight - 1, clipBottom[columnIndex]! - 1, firstVisibleRow + Math.max(3, Math.floor(viewHeight / 8)));

    for (let rowIndex = firstVisibleRow; rowIndex <= lastVisibleRow; rowIndex += 1) {
      framebuffer[rowIndex * viewWidth + columnIndex] = (0xe0 + visibleSprite.patch * 3 + columnIndex - visibleSprite.x1 + rowIndex - firstVisibleRow) & 0xff;
    }
  }
}

function paintVisplaneColumn(plane: Visplane, columnIndex: number, topRow: number, bottomRow: number): void {
  plane.bottom[columnIndex] = bottomRow;
  plane.top[columnIndex] = topRow;
}

function parseFixtureHash(name: string, value: unknown): string {
  if (typeof value !== 'string' || !/^[0-9A-F]{64}$/.test(value)) {
    throw new TypeError(`${name} must be a 64-character upper-case SHA-256 hex string.`);
  }

  return value;
}

function parseFramebufferHashFixture(value: unknown): FramebufferHashFixture {
  if (!isRecord(value)) {
    throw new TypeError('framebuffer hash fixture must be an object.');
  }

  if (typeof value.description !== 'string' || value.description.length === 0) {
    throw new TypeError('framebuffer hash fixture description must be a non-empty string.');
  }

  if (!Array.isArray(value.viewportEntries)) {
    throw new TypeError('framebuffer hash fixture viewportEntries must be an array.');
  }

  return {
    description: value.description,
    viewportEntries: value.viewportEntries.map((viewportEntry, entryIndex) => parseFramebufferViewportFixtureEntry(viewportEntry, `viewportEntries[${entryIndex}]`)),
  };
}

function parseFramebufferViewportFixtureEntry(value: unknown, name: string): FramebufferViewportFixtureEntry {
  if (!isRecord(value)) {
    throw new TypeError(`${name} must be an object.`);
  }

  return {
    detailShift: parseViewportInteger(`${name}.detailShift`, value.detailShift, [DetailMode.high, DetailMode.low]),
    fullFrameHash: parseFixtureHash(`${name}.fullFrameHash`, value.fullFrameHash),
    paletteIndex: parseViewportInteger(
      `${name}.paletteIndex`,
      value.paletteIndex,
      Array.from({ length: 14 }, (_ignoredValue, paletteIndex) => paletteIndex),
    ),
    scaledViewWidth: parseViewportInteger(`${name}.scaledViewWidth`, value.scaledViewWidth),
    setBlocks: parseViewportInteger(
      `${name}.setBlocks`,
      value.setBlocks,
      Array.from({ length: 9 }, (_ignoredValue, blockIndex) => blockIndex + 3),
    ),
    viewHeight: parseViewportInteger(`${name}.viewHeight`, value.viewHeight),
    viewWidth: parseViewportInteger(`${name}.viewWidth`, value.viewWidth),
    viewWindowHash: parseFixtureHash(`${name}.viewWindowHash`, value.viewWindowHash),
    viewWindowX: parseViewportInteger(`${name}.viewWindowX`, value.viewWindowX),
    viewWindowY: parseViewportInteger(`${name}.viewWindowY`, value.viewWindowY),
  };
}

function parseViewportInteger(name: string, value: unknown, allowedValues?: readonly number[]): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new TypeError(`${name} must be an integer.`);
  }

  if (allowedValues !== undefined && !allowedValues.includes(value)) {
    throw new TypeError(`${name} must be one of ${allowedValues.join(', ')}.`);
  }

  return value;
}

function placeLogicalViewportIntoFullFramebuffer(logicalFramebuffer: Uint8Array, configuration: Readonly<ViewportConfiguration>, viewportEntry: Readonly<FramebufferViewportFixtureEntry>, duplicateLowDetailColumns: boolean): Uint8Array {
  const fullFramebuffer = new Uint8Array(SCREENWIDTH * SCREENHEIGHT).fill((0x28 + configuration.setBlocks * 5 + configuration.detailShift * 9) & 0xff);
  const horizontalScale = configuration.detailShift === DetailMode.low && duplicateLowDetailColumns ? 2 : 1;

  for (let rowIndex = 0; rowIndex < viewportEntry.viewHeight; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < viewportEntry.viewWidth; columnIndex += 1) {
      const logicalPixel = logicalFramebuffer[rowIndex * viewportEntry.viewWidth + columnIndex]!;
      const destinationColumn = viewportEntry.viewWindowX + columnIndex * horizontalScale;
      const destinationRowOffset = (viewportEntry.viewWindowY + rowIndex) * SCREENWIDTH;

      for (let duplicateColumnIndex = 0; duplicateColumnIndex < horizontalScale; duplicateColumnIndex += 1) {
        const finalColumn = destinationColumn + duplicateColumnIndex;
        if (finalColumn >= viewportEntry.viewWindowX + viewportEntry.scaledViewWidth) {
          break;
        }
        fullFramebuffer[destinationRowOffset + finalColumn] = logicalPixel;
      }
    }
  }

  return fullFramebuffer;
}

function renderProjectedSpriteScene(framebuffer: Uint8Array, configuration: Readonly<ViewportConfiguration>, viewWidth: number, viewHeight: number): void {
  const spriteProjectionContext = createSpriteProjectionContext(configuration, viewWidth);
  const visibleSpritePool = createVisSpritePool();
  const projectedThing = createProjectableThing();
  const projectedSprite = projectSprite(projectedThing, spriteProjectionContext, visibleSpritePool);

  if (projectedSprite === null) {
    throw new Error(`Projected sprite disappeared for setBlocks=${configuration.setBlocks}, detailShift=${configuration.detailShift}`);
  }

  const spriteClipBuffers = createSpriteClipBuffers(viewWidth);

  drawMasked(
    visibleSpritePool,
    {
      drawPlayerSprites: () => {
        paintPlayerWeaponOverlay(framebuffer, viewWidth, viewHeight);
      },
      drawVisSprite: (visibleSprite, clipBuffers) => {
        paintProjectedSprite(framebuffer, viewWidth, viewHeight, visibleSprite, clipBuffers.clipBot, clipBuffers.clipTop);
      },
      drawsegs: [],
      renderMaskedSegRange: () => {},
      viewAngleOffset: 0,
      viewHeight,
    },
    spriteClipBuffers,
  );
}

function renderSyntheticViewportFrame(configuration: Readonly<ViewportConfiguration>, options: Readonly<RenderViewportFrameOptions> = {}): RenderedViewportFrame {
  const duplicateLowDetailColumns = options.duplicateLowDetailColumns ?? true;
  const paletteIndex = options.paletteIndex ?? 0;
  const viewport = computeViewport(configuration.setBlocks, configuration.detailShift);
  const logicalFramebuffer = new Uint8Array(viewport.viewWidth * viewport.viewHeight).fill(createLogicalBackgroundByte(configuration));
  const firstFloorRow = Math.max(4, Math.floor(viewport.viewHeight / 2));
  const skyBottomRow = Math.max(2, Math.floor(viewport.viewHeight / 3));
  const skyVisplane = createVisplane(viewport.viewWidth, 0, viewport.viewWidth - 1);

  for (let columnIndex = 0; columnIndex < viewport.viewWidth; columnIndex += 1) {
    paintVisplaneColumn(skyVisplane, columnIndex, 0, skyBottomRow);
  }

  renderSkyVisplane(skyVisplane, createSkyContext(logicalFramebuffer, viewport.viewWidth, viewport.viewHeight, configuration));

  const planeSpanCache = createPlaneSpanCache(viewport.viewHeight);
  renderVisplaneSpans(createFloorVisplane(viewport.viewWidth, viewport.viewHeight, firstFloorRow, configuration), createVisplaneSpanContext(logicalFramebuffer, planeSpanCache, viewport.viewWidth, viewport.viewHeight, configuration));

  renderSolidWall(createSolidWallSegment(viewport.viewWidth, viewport.viewHeight), createSolidWallContext(logicalFramebuffer, viewport.viewWidth, viewport.viewHeight));

  renderTwoSidedWall(createTwoSidedWallSegment(viewport.viewWidth, viewport.viewHeight), createTwoSidedWallContext(logicalFramebuffer, viewport.viewWidth, viewport.viewHeight));

  const maskedFirstColumn = Math.max(3, Math.floor(viewport.viewWidth / 3) + 1);
  const maskedLastColumn = Math.min(viewport.viewWidth - 1, maskedFirstColumn + Math.max(3, Math.floor(viewport.viewWidth / 8)));
  renderMaskedSegRange(
    createMaskedDrawSegment(viewport.viewWidth, viewport.viewHeight, maskedFirstColumn, maskedLastColumn),
    maskedFirstColumn,
    maskedLastColumn,
    createMaskedRenderContext(logicalFramebuffer, viewport.viewWidth, viewport.viewHeight),
  );

  paintDecorPatch(logicalFramebuffer, viewport.viewWidth, viewport.viewHeight);
  renderProjectedSpriteScene(logicalFramebuffer, configuration, viewport.viewWidth, viewport.viewHeight);

  const viewportEntry: FramebufferViewportFixtureEntry = {
    detailShift: configuration.detailShift,
    fullFrameHash: '',
    paletteIndex,
    scaledViewWidth: viewport.scaledViewWidth,
    setBlocks: configuration.setBlocks,
    viewHeight: viewport.viewHeight,
    viewWidth: viewport.viewWidth,
    viewWindowHash: '',
    viewWindowX: viewport.viewWindowX,
    viewWindowY: viewport.viewWindowY,
  };

  const fullFramebuffer = placeLogicalViewportIntoFullFramebuffer(logicalFramebuffer, configuration, viewportEntry, duplicateLowDetailColumns);
  const completeViewportEntry: FramebufferViewportFixtureEntry = {
    detailShift: viewportEntry.detailShift,
    fullFrameHash: hashBytes(fullFramebuffer),
    paletteIndex: viewportEntry.paletteIndex,
    scaledViewWidth: viewportEntry.scaledViewWidth,
    setBlocks: viewportEntry.setBlocks,
    viewHeight: viewportEntry.viewHeight,
    viewWidth: viewportEntry.viewWidth,
    viewWindowHash: hashBytes(createViewWindowBytes(fullFramebuffer, viewportEntry)),
    viewWindowX: viewportEntry.viewWindowX,
    viewWindowY: viewportEntry.viewWindowY,
  };

  return {
    entry: completeViewportEntry,
    fullFramebuffer,
  };
}

const fixturePath = fileURLToPath(new URL('./fixtures/framebufferHashes.json', import.meta.url));
const framebufferHashFixture = parseFramebufferHashFixture(await Bun.file(fixturePath).json());

describe('framebuffer hash fixture', () => {
  it('locks all 18 setBlocks/detail combinations in numeric order', () => {
    expect(framebufferHashFixture.viewportEntries).toHaveLength(VIEWPORT_CONFIGURATIONS.length);

    for (let configurationIndex = 0; configurationIndex < VIEWPORT_CONFIGURATIONS.length; configurationIndex += 1) {
      const viewportConfiguration = VIEWPORT_CONFIGURATIONS[configurationIndex]!;
      const viewportEntry = framebufferHashFixture.viewportEntries[configurationIndex]!;
      const computedViewport = computeViewport(viewportConfiguration.setBlocks, viewportConfiguration.detailShift);

      expect(viewportEntry.detailShift).toBe(viewportConfiguration.detailShift);
      expect(viewportEntry.paletteIndex).toBe(0);
      expect(viewportEntry.scaledViewWidth).toBe(computedViewport.scaledViewWidth);
      expect(viewportEntry.setBlocks).toBe(viewportConfiguration.setBlocks);
      expect(viewportEntry.viewHeight).toBe(computedViewport.viewHeight);
      expect(viewportEntry.viewWidth).toBe(computedViewport.viewWidth);
      expect(viewportEntry.viewWindowX).toBe(computedViewport.viewWindowX);
      expect(viewportEntry.viewWindowY).toBe(computedViewport.viewWindowY);
    }
  });

  it('anchors the high-detail and message-toggle menu strings in both bundled DOS executables', async () => {
    for (const executableFileName of EXECUTABLE_FILE_NAMES) {
      const executableText = await createExecutableText(executableFileName);

      expect(executableText).toContain('High detail');
      expect(executableText).toContain('Low detail');
      expect(executableText).toContain('Messages OFF');
      expect(executableText).toContain('Messages ON');
    }
  });
});

describe('framebuffer parity suite', () => {
  it('matches the canonical synthetic full-frame and view-window hashes for every viewport configuration', () => {
    const renderedViewportEntries = VIEWPORT_CONFIGURATIONS.map((viewportConfiguration) => renderSyntheticViewportFrame(viewportConfiguration).entry);

    expect(renderedViewportEntries).toEqual(Array.from(framebufferHashFixture.viewportEntries));
  });
});

describe('parity-sensitive edge cases', () => {
  it('drops out of sync if low-detail frames are copied without horizontal duplication', () => {
    const referenceViewportEntry = findViewportFixtureEntry(framebufferHashFixture, 9, DetailMode.low);
    const incorrectViewportEntry = renderSyntheticViewportFrame({ detailShift: DetailMode.low, setBlocks: 9 }, { duplicateLowDetailColumns: false }).entry;

    expect(incorrectViewportEntry.fullFrameHash).not.toBe(referenceViewportEntry.fullFrameHash);
    expect(incorrectViewportEntry.viewWindowHash).not.toBe(referenceViewportEntry.viewWindowHash);
  });

  it('keeps paletteIndex load-bearing even when the framebuffer bytes are identical', () => {
    const baselineViewportEntry = renderSyntheticViewportFrame({ detailShift: DetailMode.high, setBlocks: 11 }).entry;
    const alternatePaletteViewportEntry = renderSyntheticViewportFrame({ detailShift: DetailMode.high, setBlocks: 11 }, { paletteIndex: 13 }).entry;

    expect(alternatePaletteViewportEntry.fullFrameHash).toBe(baselineViewportEntry.fullFrameHash);
    expect(alternatePaletteViewportEntry.viewWindowHash).toBe(baselineViewportEntry.viewWindowHash);
    expect(alternatePaletteViewportEntry.paletteIndex).toBe(13);
    expect(alternatePaletteViewportEntry).not.toEqual(baselineViewportEntry);
  });
});
