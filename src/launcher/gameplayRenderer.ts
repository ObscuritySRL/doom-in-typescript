import type { Angle } from '../core/angle.ts';
import { FRACUNIT } from '../core/fixed.ts';
import { ML_DONTPEGBOTTOM, ML_DONTPEGTOP } from '../map/lineSectorGeometry.ts';
import type { MapData } from '../map/mapSetup.ts';
import { pointOnSide } from '../map/nodeTraversal.ts';
import type { Player } from '../player/playerSpawn.ts';
import { SCREENHEIGHT, SCREENWIDTH } from '../host/windowPolicy.ts';
import { NF_SUBSECTOR } from '../map/bspStructs.ts';

import type { GameplayRenderResources, GameplayTexture } from './gameplayAssets.ts';

const BAM_TO_RADIANS = (Math.PI * 2) / 0x1_0000_0000;
const CENTERX = SCREENWIDTH / 2;
const CENTERY = SCREENHEIGHT / 2;
const FOV_DEGREES = 90;
const HALF_FOV_RADIANS = (FOV_DEGREES * Math.PI) / 360;
const HALF_FOV_TANGENT = Math.tan(HALF_FOV_RADIANS);
const LIGHTLEVELS = 16;
const LIGHTSEGSHIFT = 4;
const MAXLIGHTSCALE = 48;
const NEAR_PLANE = 1;
const PROJECTION_PLANE_X = SCREENWIDTH / 2;
const REGULAR_COLORMAP_COUNT = 32;
const SKY_FLAT_NAME = 'F_SKY1';
const SKY_REPEAT_COUNT = 4;

interface SolidSegRange {
  readonly first: number;
  readonly last: number;
}

interface ViewPoint {
  readonly factor: number;
  readonly viewX: number;
  readonly viewY: number;
}

interface Visplane {
  readonly bottom: Int16Array;
  readonly height: number;
  readonly lightLevel: number;
  maxX: number;
  minX: number;
  readonly picName: string;
  readonly top: Int16Array;
}

export interface GameplayRenderContext {
  readonly framebuffer: Uint8Array;
  readonly mapData: MapData;
  readonly player: Player;
  readonly renderResources: GameplayRenderResources;
  readonly renderState: GameplayRenderState;
}

export interface GameplayRenderState {
  readonly ceilingClip: Int16Array;
  readonly floorClip: Int16Array;
  readonly solidSegs: SolidSegs;
  readonly visplanes: VisplaneCollection;
}

export function createGameplayRenderState(): GameplayRenderState {
  return Object.freeze({
    ceilingClip: new Int16Array(SCREENWIDTH),
    floorClip: new Int16Array(SCREENWIDTH),
    solidSegs: new SolidSegs(SCREENWIDTH),
    visplanes: new VisplaneCollection(),
  });
}

export function renderGameplayFrame(ctx: GameplayRenderContext): Uint8Array {
  const playerMapObject = ctx.player.mo;

  if (playerMapObject === null) {
    ctx.framebuffer.fill(0);
    return ctx.framebuffer;
  }

  const playerX = fixedToMapUnits(playerMapObject.x);
  const playerY = fixedToMapUnits(playerMapObject.y);
  const playerEyeHeight = fixedToMapUnits(ctx.player.viewz);
  const viewAngle = angleToRadians(playerMapObject.angle);
  const cosine = Math.cos(viewAngle);
  const sine = Math.sin(viewAngle);
  const ceilingClip = ctx.renderState.ceilingClip;
  const floorClip = ctx.renderState.floorClip;
  const solidSegs = ctx.renderState.solidSegs;
  const visplanes = ctx.renderState.visplanes;

  ctx.framebuffer.fill(0);
  ceilingClip.fill(-1);
  floorClip.fill(SCREENHEIGHT);
  solidSegs.clear();
  visplanes.clear();

  const subsectorIndices = collectSubsectorsFrontToBack(ctx.mapData, playerMapObject.x, playerMapObject.y);

  for (const subsectorIndex of subsectorIndices) {
    const subsector = ctx.mapData.subsectors[subsectorIndex]!;

    for (let segIndex = 0; segIndex < subsector.numsegs; segIndex += 1) {
      const seg = ctx.mapData.segs[subsector.firstseg + segIndex]!;
      const linedef = ctx.mapData.linedefs[seg.linedef]!;
      const lineSectors = ctx.mapData.lineSectors[seg.linedef]!;
      const sidedefIndex = seg.side === 0 ? linedef.sidenum0 : linedef.sidenum1;

      if (sidedefIndex < 0) {
        continue;
      }

      const sidedef = ctx.mapData.sidedefs[sidedefIndex]!;
      const frontSectorIndex = seg.side === 0 ? lineSectors.frontsector : lineSectors.backsector;
      const backSectorIndex = seg.side === 0 ? lineSectors.backsector : lineSectors.frontsector;

      if (frontSectorIndex < 0) {
        continue;
      }

      const startVertex = ctx.mapData.vertexes[seg.v1]!;
      const endVertex = ctx.mapData.vertexes[seg.v2]!;
      const clippedPoints = clipSegmentToFrustum(
        {
          factor: 0,
          ...worldToView(fixedToMapUnits(startVertex.x), fixedToMapUnits(startVertex.y), playerX, playerY, cosine, sine),
        },
        {
          factor: 1,
          ...worldToView(fixedToMapUnits(endVertex.x), fixedToMapUnits(endVertex.y), playerX, playerY, cosine, sine),
        },
      );

      if (clippedPoints === null) {
        continue;
      }

      const firstColumn = Math.max(
        0,
        Math.min(SCREENWIDTH - 1, Math.round(Math.min(viewToScreenX(clippedPoints.startPoint.viewX, clippedPoints.startPoint.viewY), viewToScreenX(clippedPoints.endPoint.viewX, clippedPoints.endPoint.viewY)))),
      );
      const lastColumn = Math.max(0, Math.min(SCREENWIDTH - 1, Math.round(Math.max(viewToScreenX(clippedPoints.startPoint.viewX, clippedPoints.startPoint.viewY), viewToScreenX(clippedPoints.endPoint.viewX, clippedPoints.endPoint.viewY)))));

      if (firstColumn > lastColumn) {
        continue;
      }

      const visibleRanges = solidSegs.getVisibleRanges(firstColumn, lastColumn);

      if (visibleRanges.length === 0) {
        continue;
      }

      const frontSector = ctx.mapData.sectors[frontSectorIndex]!;
      const frontCeilingHeight = fixedToMapUnits(frontSector.ceilingheight);
      const frontFloorHeight = fixedToMapUnits(frontSector.floorheight);
      const segLength = Math.hypot(fixedToMapUnits(endVertex.x - startVertex.x), fixedToMapUnits(endVertex.y - startVertex.y));
      const rowOffset = fixedToMapUnits(sidedef.rowoffset);
      const sideOffset = fixedToMapUnits(sidedef.textureoffset);

      if (backSectorIndex < 0) {
        const middleTexture = ctx.renderResources.textures.get(sidedef.midtexture.toUpperCase()) ?? null;

        if (middleTexture === null) {
          continue;
        }

        const middleTextureTopWorld = getMiddleWallTextureTopWorld(frontCeilingHeight, frontFloorHeight, linedef.flags, middleTexture.height, rowOffset);

        for (const range of visibleRanges) {
          for (let x = range.first; x <= range.last; x += 1) {
            const intersection = getWallIntersectionAtColumn(x, clippedPoints.startPoint, clippedPoints.endPoint);

            if (intersection.depth <= NEAR_PLANE) {
              continue;
            }

            const ceilingY = worldHeightToScreen(frontCeilingHeight, playerEyeHeight, intersection.depth);
            const floorY = worldHeightToScreen(frontFloorHeight, playerEyeHeight, intersection.depth);
            const clipTop = ceilingClip[x]! + 1;
            const clipBottom = floorClip[x]! - 1;

            collectVisplaneSpans(visplanes, frontSector.ceilingpic, frontSector.floorpic, frontSector.lightlevel, x, clipTop, clipBottom, ceilingY, floorY, frontCeilingHeight, frontFloorHeight, playerEyeHeight);

            const drawTop = Math.max(Math.ceil(ceilingY), clipTop);
            const drawBottom = Math.min(Math.floor(floorY), clipBottom);

            if (drawTop > drawBottom) {
              continue;
            }

            drawWallColumn(
              ctx.framebuffer,
              ctx.renderResources.colormaps,
              middleTexture,
              x,
              drawTop,
              drawBottom,
              getWallTextureColumnOffset(intersection.factor, seg.side, segLength, fixedToMapUnits(seg.offset), sideOffset),
              middleTextureTopWorld - frontCeilingHeight + (drawTop + 0.5 - ceilingY) * (intersection.depth / PROJECTION_PLANE_X),
              intersection.depth / PROJECTION_PLANE_X,
              frontSector.lightlevel,
              intersection.depth,
            );

            ceilingClip[x] = SCREENHEIGHT;
            floorClip[x] = -1;
          }
        }

        solidSegs.add(firstColumn, lastColumn);
        continue;
      }

      const backSector = ctx.mapData.sectors[backSectorIndex]!;
      const backCeilingHeight = fixedToMapUnits(backSector.ceilingheight);
      const backFloorHeight = fixedToMapUnits(backSector.floorheight);
      const collapseSkyUpper = frontSector.ceilingpic === SKY_FLAT_NAME && backSector.ceilingpic === SKY_FLAT_NAME;
      const needUpper = !collapseSkyUpper && backCeilingHeight < frontCeilingHeight;
      const needLower = backFloorHeight > frontFloorHeight;
      const closedPortal = backCeilingHeight <= frontFloorHeight || backFloorHeight >= frontCeilingHeight;
      const upperTexture = needUpper ? (ctx.renderResources.textures.get(sidedef.toptexture.toUpperCase()) ?? null) : null;
      const lowerTexture = needLower ? (ctx.renderResources.textures.get(sidedef.bottomtexture.toUpperCase()) ?? null) : null;
      const upperTextureTopWorld = upperTexture === null ? 0 : getUpperWallTextureTopWorld(backCeilingHeight, frontCeilingHeight, linedef.flags, upperTexture.height, rowOffset);
      const lowerTextureTopWorld = lowerTexture === null ? 0 : getLowerWallTextureTopWorld(backFloorHeight, frontCeilingHeight, linedef.flags, rowOffset);

      for (const range of visibleRanges) {
        for (let x = range.first; x <= range.last; x += 1) {
          const intersection = getWallIntersectionAtColumn(x, clippedPoints.startPoint, clippedPoints.endPoint);

          if (intersection.depth <= NEAR_PLANE) {
            continue;
          }

          const frontCeilingY = worldHeightToScreen(frontCeilingHeight, playerEyeHeight, intersection.depth);
          const frontFloorY = worldHeightToScreen(frontFloorHeight, playerEyeHeight, intersection.depth);
          const backCeilingY = worldHeightToScreen(backCeilingHeight, playerEyeHeight, intersection.depth);
          const backFloorY = worldHeightToScreen(backFloorHeight, playerEyeHeight, intersection.depth);
          const clipTop = ceilingClip[x]! + 1;
          const clipBottom = floorClip[x]! - 1;

          if (clipTop > clipBottom) {
            continue;
          }

          collectVisplaneSpans(visplanes, frontSector.ceilingpic, frontSector.floorpic, frontSector.lightlevel, x, clipTop, clipBottom, frontCeilingY, frontFloorY, frontCeilingHeight, frontFloorHeight, playerEyeHeight);

          const textureColumn = getWallTextureColumnOffset(intersection.factor, seg.side, segLength, fixedToMapUnits(seg.offset), sideOffset);
          const textureStep = intersection.depth / PROJECTION_PLANE_X;

          if (upperTexture !== null) {
            const upperTop = Math.max(Math.ceil(frontCeilingY), clipTop);
            const upperBottom = Math.min(Math.ceil(backCeilingY) - 1, clipBottom);

            if (upperTop <= upperBottom) {
              drawWallColumn(
                ctx.framebuffer,
                ctx.renderResources.colormaps,
                upperTexture,
                x,
                upperTop,
                upperBottom,
                textureColumn,
                upperTextureTopWorld - frontCeilingHeight + (upperTop + 0.5 - frontCeilingY) * textureStep,
                textureStep,
                frontSector.lightlevel,
                intersection.depth,
              );
            }
          }

          if (lowerTexture !== null) {
            const lowerTop = Math.max(Math.floor(backFloorY) + 1, clipTop);
            const lowerBottom = Math.min(Math.floor(frontFloorY), clipBottom);

            if (lowerTop <= lowerBottom) {
              drawWallColumn(
                ctx.framebuffer,
                ctx.renderResources.colormaps,
                lowerTexture,
                x,
                lowerTop,
                lowerBottom,
                textureColumn,
                lowerTextureTopWorld - backFloorHeight + (lowerTop + 0.5 - backFloorY) * textureStep,
                textureStep,
                frontSector.lightlevel,
                intersection.depth,
              );
            }
          }

          if (closedPortal) {
            ceilingClip[x] = SCREENHEIGHT;
            floorClip[x] = -1;
            continue;
          }

          ceilingClip[x] = Math.max(ceilingClip[x]!, needUpper ? Math.ceil(backCeilingY) - 1 : Math.ceil(frontCeilingY) - 1);
          floorClip[x] = Math.min(floorClip[x]!, needLower ? Math.floor(backFloorY) + 1 : Math.floor(frontFloorY) + 1);
        }
      }

      if (closedPortal) {
        solidSegs.add(firstColumn, lastColumn);
      }
    }
  }

  renderFloors(ctx.framebuffer, ctx.renderResources, visplanes.planes, playerX, playerY, playerEyeHeight, cosine, sine);
  renderCeilings(ctx.framebuffer, ctx.renderResources, visplanes.planes, playerX, playerY, playerEyeHeight, viewAngle, cosine, sine);

  return ctx.framebuffer;
}

class SolidSegs {
  readonly #screenWidth: number;
  #ranges: SolidSegRange[];

  constructor(screenWidth: number) {
    this.#screenWidth = screenWidth;
    this.#ranges = [];
    this.clear();
  }

  add(first: number, last: number): void {
    const range = this.#clampRange(first, last);

    if (range === null) {
      return;
    }

    let insertionIndex = 1;

    while (this.#ranges[insertionIndex]!.last < range.first - 1) {
      insertionIndex += 1;
    }

    let mergedFirst = range.first;
    let mergedLast = range.last;
    let removeCount = 0;

    while (insertionIndex + removeCount < this.#ranges.length - 1) {
      const currentRange = this.#ranges[insertionIndex + removeCount]!;

      if (currentRange.first > mergedLast + 1) {
        break;
      }

      mergedFirst = Math.min(mergedFirst, currentRange.first);
      mergedLast = Math.max(mergedLast, currentRange.last);
      removeCount += 1;
    }

    this.#ranges.splice(insertionIndex, removeCount, { first: mergedFirst, last: mergedLast });
  }

  clear(): void {
    this.#ranges = [
      { first: Number.MIN_SAFE_INTEGER, last: -1 },
      { first: this.#screenWidth, last: Number.MAX_SAFE_INTEGER },
    ];
  }

  getVisibleRanges(first: number, last: number): readonly SolidSegRange[] {
    const range = this.#clampRange(first, last);

    if (range === null) {
      return [];
    }

    const visibleRanges: SolidSegRange[] = [];
    let currentFirst = range.first;
    let blockedRangeIndex = 0;

    while (this.#ranges[blockedRangeIndex]!.last < currentFirst) {
      blockedRangeIndex += 1;
    }

    while (currentFirst <= range.last) {
      const blockedRange = this.#ranges[blockedRangeIndex]!;

      if (blockedRange.first > range.last) {
        visibleRanges.push({ first: currentFirst, last: range.last });
        break;
      }

      if (blockedRange.first > currentFirst) {
        visibleRanges.push({
          first: currentFirst,
          last: blockedRange.first - 1,
        });
      }

      if (blockedRange.last >= range.last) {
        break;
      }

      currentFirst = blockedRange.last + 1;
      blockedRangeIndex += 1;
    }

    return visibleRanges;
  }

  #clampRange(first: number, last: number): SolidSegRange | null {
    if (last < first) {
      return null;
    }

    const clampedFirst = Math.max(0, first);
    const clampedLast = Math.min(this.#screenWidth - 1, last);

    if (clampedFirst > clampedLast) {
      return null;
    }

    return { first: clampedFirst, last: clampedLast };
  }
}

class VisplaneCollection {
  readonly #planes: Visplane[] = [];

  addColumnSpan(height: number, picName: string, lightLevel: number, x: number, top: number, bottom: number): void {
    if (x < 0 || x >= SCREENWIDTH) {
      return;
    }

    const clampedTop = Math.max(0, top);
    const clampedBottom = Math.min(SCREENHEIGHT - 1, bottom);

    if (clampedTop > clampedBottom) {
      return;
    }

    const matchingIndices: number[] = [];

    for (let planeIndex = 0; planeIndex < this.#planes.length; planeIndex += 1) {
      const plane = this.#planes[planeIndex]!;

      if (plane.height !== height || plane.lightLevel !== lightLevel || plane.picName !== picName) {
        continue;
      }

      if (x < plane.minX - 1 || x > plane.maxX + 1) {
        continue;
      }

      if (!canAcceptColumnSpan(plane, x, clampedTop, clampedBottom)) {
        continue;
      }

      matchingIndices.push(planeIndex);
    }

    if (matchingIndices.length === 0) {
      const plane = createVisplane(height, picName, lightLevel);
      mergeColumnSpan(plane, x, clampedTop, clampedBottom);
      this.#planes.push(plane);
      return;
    }

    const target = this.#planes[matchingIndices[0]]!;
    mergeColumnSpan(target, x, clampedTop, clampedBottom);

    for (let matchIndex = matchingIndices.length - 1; matchIndex >= 1; matchIndex -= 1) {
      const plane = this.#planes[matchingIndices[matchIndex]!]!;

      if (!canMergeVisplanes(target, plane)) {
        continue;
      }

      mergeVisplane(target, plane);
      this.#planes.splice(matchingIndices[matchIndex]!, 1);
    }
  }

  clear(): void {
    this.#planes.length = 0;
  }

  get planes(): readonly Visplane[] {
    return this.#planes;
  }
}

function angleToRadians(angle: Angle): number {
  return (angle >>> 0) * BAM_TO_RADIANS;
}

function canAcceptColumnSpan(plane: Visplane, x: number, top: number, bottom: number): boolean {
  if (x < plane.minX || x > plane.maxX) {
    return true;
  }

  if (!hasSpanAtColumn(plane, x)) {
    return true;
  }

  return spansOverlapOrTouch(plane.top[x]!, plane.bottom[x]!, top, bottom);
}

function canMergeVisplanes(target: Visplane, source: Visplane): boolean {
  const overlapStart = Math.max(target.minX, source.minX);
  const overlapEnd = Math.min(target.maxX, source.maxX);

  if (overlapStart > overlapEnd) {
    return true;
  }

  for (let x = overlapStart; x <= overlapEnd; x += 1) {
    if (!hasSpanAtColumn(target, x) || !hasSpanAtColumn(source, x)) {
      continue;
    }

    if (!spansOverlapOrTouch(target.top[x]!, target.bottom[x]!, source.top[x]!, source.bottom[x]!)) {
      return false;
    }
  }

  return true;
}

function clipSegmentAgainstPlane(startPoint: ViewPoint, endPoint: ViewPoint, evaluatePoint: (point: ViewPoint) => number): { readonly endPoint: ViewPoint; readonly startPoint: ViewPoint } | null {
  const startDistance = evaluatePoint(startPoint);
  const endDistance = evaluatePoint(endPoint);

  if (startDistance < 0 && endDistance < 0) {
    return null;
  }

  if (startDistance >= 0 && endDistance >= 0) {
    return { endPoint, startPoint };
  }

  const intersectionFactor = startDistance / (startDistance - endDistance);
  const intersectionPoint = {
    factor: startPoint.factor + (endPoint.factor - startPoint.factor) * intersectionFactor,
    viewX: startPoint.viewX + (endPoint.viewX - startPoint.viewX) * intersectionFactor,
    viewY: startPoint.viewY + (endPoint.viewY - startPoint.viewY) * intersectionFactor,
  };

  if (startDistance < 0) {
    return {
      endPoint,
      startPoint: intersectionPoint,
    };
  }

  return {
    endPoint: intersectionPoint,
    startPoint,
  };
}

function clipSegmentToFrustum(startPoint: ViewPoint, endPoint: ViewPoint): { readonly endPoint: ViewPoint; readonly startPoint: ViewPoint } | null {
  let clippedPoints = clipSegmentAgainstPlane(startPoint, endPoint, (point) => point.viewY - NEAR_PLANE);

  if (clippedPoints === null) {
    return null;
  }

  clippedPoints = clipSegmentAgainstPlane(clippedPoints.startPoint, clippedPoints.endPoint, (point) => point.viewY * HALF_FOV_TANGENT + point.viewX);

  if (clippedPoints === null) {
    return null;
  }

  return clipSegmentAgainstPlane(clippedPoints.startPoint, clippedPoints.endPoint, (point) => point.viewY * HALF_FOV_TANGENT - point.viewX);
}

function collectSubsectorsFrontToBack(mapData: MapData, playerX: number, playerY: number): readonly number[] {
  if (mapData.subsectors.length === 0) {
    return [];
  }

  if (mapData.nodes.length === 0) {
    return [0];
  }

  const subsectorIndices: number[] = [];

  const visitChild = (childReference: number): void => {
    if ((childReference & NF_SUBSECTOR) !== 0) {
      subsectorIndices.push(childReference & ~NF_SUBSECTOR);
      return;
    }

    visitNode(childReference);
  };

  const visitNode = (nodeIndex: number): void => {
    const node = mapData.nodes[nodeIndex]!;
    const frontSide = pointOnSide(playerX, playerY, node);
    const frontChild = node.children[frontSide]!;
    const backChild = node.children[frontSide ^ 1]!;

    visitChild(frontChild);
    visitChild(backChild);
  };

  visitNode(mapData.nodes.length - 1);
  return subsectorIndices;
}

function collectVisplaneSpans(
  visplanes: VisplaneCollection,
  ceilingPic: string,
  floorPic: string,
  lightLevel: number,
  x: number,
  clipTop: number,
  clipBottom: number,
  ceilingY: number,
  floorY: number,
  ceilingHeight: number,
  floorHeight: number,
  playerEyeHeight: number,
): void {
  if (clipTop > clipBottom) {
    return;
  }

  const ceilingBottom = Math.min(Math.ceil(ceilingY) - 1, clipBottom);

  if ((ceilingHeight > playerEyeHeight || ceilingPic === SKY_FLAT_NAME) && clipTop <= ceilingBottom) {
    visplanes.addColumnSpan(ceilingHeight, ceilingPic.toUpperCase(), lightLevel, x, clipTop, ceilingBottom);
  }

  const floorTop = Math.max(Math.floor(floorY) + 1, clipTop);

  if (floorHeight < playerEyeHeight && floorTop <= clipBottom) {
    visplanes.addColumnSpan(floorHeight, floorPic.toUpperCase(), lightLevel, x, floorTop, clipBottom);
  }
}

function createVisplane(height: number, picName: string, lightLevel: number): Visplane {
  const top = new Int16Array(SCREENWIDTH);
  const bottom = new Int16Array(SCREENWIDTH);
  top.fill(SCREENHEIGHT);
  bottom.fill(-1);

  return {
    bottom,
    height,
    lightLevel,
    maxX: -1,
    minX: SCREENWIDTH,
    picName,
    top,
  };
}

function drawCeilingSpan(
  framebuffer: Uint8Array,
  y: number,
  x1: number,
  x2: number,
  flatData: Uint8Array,
  playerX: number,
  playerY: number,
  cosine: number,
  sine: number,
  planeHeight: number,
  colormaps: readonly Uint8Array[],
  lightLevel: number,
): void {
  const dy = y - CENTERY + 0.5;

  if (Math.abs(dy) < 0.01) {
    return;
  }

  const distance = Math.abs((planeHeight * PROJECTION_PLANE_X) / dy);
  const colormap = getColormapTable(colormaps, lightLevel, distance);
  const stepWorldX = (sine * distance) / PROJECTION_PLANE_X;
  const stepWorldY = (-cosine * distance) / PROJECTION_PLANE_X;
  const viewLocalX = ((CENTERX - (x1 + 0.5)) * distance) / PROJECTION_PLANE_X;
  let worldX = playerX + -sine * viewLocalX + cosine * distance;
  let worldY = playerY + cosine * viewLocalX + sine * distance;

  for (let x = x1; x <= x2; x += 1) {
    const textureX = Math.floor(worldX) & 63;
    const textureY = Math.floor(worldY) & 63;
    framebuffer[y * SCREENWIDTH + x] = colormap[flatData[textureY * 64 + textureX]!]!;
    worldX += stepWorldX;
    worldY += stepWorldY;
  }
}

function drawFloorSpan(
  framebuffer: Uint8Array,
  y: number,
  x1: number,
  x2: number,
  flatData: Uint8Array,
  playerX: number,
  playerY: number,
  cosine: number,
  sine: number,
  planeHeight: number,
  colormaps: readonly Uint8Array[],
  lightLevel: number,
): void {
  const dy = y - CENTERY + 0.5;

  if (Math.abs(dy) < 0.01) {
    return;
  }

  const distance = Math.abs((planeHeight * PROJECTION_PLANE_X) / dy);
  const colormap = getColormapTable(colormaps, lightLevel, distance);
  const stepWorldX = (sine * distance) / PROJECTION_PLANE_X;
  const stepWorldY = (-cosine * distance) / PROJECTION_PLANE_X;
  const viewLocalX = ((CENTERX - (x1 + 0.5)) * distance) / PROJECTION_PLANE_X;
  let worldX = playerX + -sine * viewLocalX + cosine * distance;
  let worldY = playerY + cosine * viewLocalX + sine * distance;

  for (let x = x1; x <= x2; x += 1) {
    const textureX = Math.floor(worldX) & 63;
    const textureY = Math.floor(worldY) & 63;
    framebuffer[y * SCREENWIDTH + x] = colormap[flatData[textureY * 64 + textureX]!]!;
    worldX += stepWorldX;
    worldY += stepWorldY;
  }
}

function drawSkyColumn(framebuffer: Uint8Array, texture: GameplayTexture, viewAngle: number, x: number, top: number, bottom: number, colormap: Uint8Array): void {
  const skyColumn = getSkyTextureColumn(texture.width, viewAngle, x);
  const textureColumn = texture.columns[skyColumn]!;

  for (let y = top; y <= bottom; y += 1) {
    const textureY = Math.min(texture.height - 1, Math.floor(((y + 0.5) * texture.height) / SCREENHEIGHT));
    framebuffer[y * SCREENWIDTH + x] = colormap[textureColumn[textureY]!]!;
  }
}

function drawWallColumn(
  framebuffer: Uint8Array,
  colormaps: readonly Uint8Array[],
  texture: GameplayTexture,
  x: number,
  top: number,
  bottom: number,
  textureColumnIndex: number,
  textureY: number,
  textureStep: number,
  lightLevel: number,
  depth: number,
): void {
  if (top > bottom) {
    return;
  }

  const column = getWrappedTextureColumn(texture, textureColumnIndex);
  const colormap = getColormapTable(colormaps, lightLevel, depth);
  let sampleY = textureY;

  for (let y = top; y <= bottom; y += 1) {
    let textureRow = Math.floor(sampleY) % texture.height;

    if (textureRow < 0) {
      textureRow += texture.height;
    }

    framebuffer[y * SCREENWIDTH + x] = colormap[column[textureRow]!]!;
    sampleY += textureStep;
  }
}

function fixedToMapUnits(value: number): number {
  return value / FRACUNIT;
}

function getColormapTable(colormaps: readonly Uint8Array[], sectorLightLevel: number, depth: number): Uint8Array {
  const lightBucket = Math.min(LIGHTLEVELS - 1, Math.max(0, sectorLightLevel >> LIGHTSEGSHIFT));
  const startMap = (((LIGHTLEVELS - 1 - lightBucket) * 2 * REGULAR_COLORMAP_COUNT) / LIGHTLEVELS) | 0;
  const scaleIndex = Math.min(MAXLIGHTSCALE - 1, Math.max(0, Math.floor((PROJECTION_PLANE_X * 16) / Math.max(depth, NEAR_PLANE))));
  const level = Math.max(0, Math.min(REGULAR_COLORMAP_COUNT - 1, startMap - Math.floor(scaleIndex / 2)));
  return colormaps[level]!;
}

function getLowerWallTextureTopWorld(backFloorHeight: number, frontCeilingHeight: number, linedefFlags: number, rowOffset: number): number {
  if ((linedefFlags & ML_DONTPEGBOTTOM) !== 0) {
    return frontCeilingHeight + rowOffset;
  }

  return backFloorHeight + rowOffset;
}

function getMiddleWallTextureTopWorld(frontCeilingHeight: number, frontFloorHeight: number, linedefFlags: number, textureHeight: number, rowOffset: number): number {
  if ((linedefFlags & ML_DONTPEGBOTTOM) !== 0) {
    return frontFloorHeight + textureHeight + rowOffset;
  }

  return frontCeilingHeight + rowOffset;
}

function getSkyTextureColumn(textureWidth: number, viewAngle: number, screenX: number): number {
  const relativeAngle = Math.atan2(CENTERX - (screenX + 0.5), PROJECTION_PLANE_X);
  const wrappedAngle = normalizeRadians(viewAngle + relativeAngle);
  const fullRotation = Math.PI * 2;
  const rawColumn = Math.floor(((((wrappedAngle % fullRotation) + fullRotation) % fullRotation) * textureWidth * SKY_REPEAT_COUNT) / fullRotation);
  return rawColumn % textureWidth;
}

function getUpperWallTextureTopWorld(backCeilingHeight: number, frontCeilingHeight: number, linedefFlags: number, textureHeight: number, rowOffset: number): number {
  if ((linedefFlags & ML_DONTPEGTOP) !== 0) {
    return frontCeilingHeight + rowOffset;
  }

  return backCeilingHeight + textureHeight + rowOffset;
}

function getWallIntersectionAtColumn(screenColumn: number, startPoint: ViewPoint, endPoint: ViewPoint): { readonly depth: number; readonly factor: number } {
  const screenX = screenColumn + 0.5;
  const raySlope = (CENTERX - screenX) / PROJECTION_PLANE_X;
  const deltaViewX = endPoint.viewX - startPoint.viewX;
  const deltaViewY = endPoint.viewY - startPoint.viewY;
  const denominator = deltaViewX - raySlope * deltaViewY;

  if (Math.abs(denominator) < 1e-6) {
    return {
      depth: (startPoint.viewY + endPoint.viewY) * 0.5,
      factor: (startPoint.factor + endPoint.factor) * 0.5,
    };
  }

  const intersectionFactor = (raySlope * startPoint.viewY - startPoint.viewX) / denominator;
  const clampedFactor = Math.min(1, Math.max(0, intersectionFactor));

  return {
    depth: startPoint.viewY + deltaViewY * clampedFactor,
    factor: startPoint.factor + (endPoint.factor - startPoint.factor) * clampedFactor,
  };
}

function getWallTextureColumnOffset(factor: number, segSide: number, segLength: number, segOffset: number, sideOffset: number): number {
  const distanceAlongSeg = factor * segLength;
  const distanceAlongLinedef = segSide === 0 ? segOffset + distanceAlongSeg : segOffset - distanceAlongSeg;
  return Math.floor(distanceAlongLinedef + sideOffset);
}

function getWrappedTextureColumn(texture: GameplayTexture, textureColumn: number): Uint8Array {
  let wrappedColumn = textureColumn % texture.width;

  if (wrappedColumn < 0) {
    wrappedColumn += texture.width;
  }

  return texture.columns[wrappedColumn]!;
}

function hasSpanAtColumn(plane: Visplane, x: number): boolean {
  return plane.top[x]! <= plane.bottom[x]!;
}

function mergeColumnSpan(plane: Visplane, x: number, top: number, bottom: number): void {
  if (hasSpanAtColumn(plane, x)) {
    plane.top[x] = Math.min(plane.top[x]!, top);
    plane.bottom[x] = Math.max(plane.bottom[x]!, bottom);
  } else {
    plane.top[x] = top;
    plane.bottom[x] = bottom;
  }

  plane.minX = Math.min(plane.minX, x);
  plane.maxX = Math.max(plane.maxX, x);
}

function mergeVisplane(target: Visplane, source: Visplane): void {
  for (let x = source.minX; x <= source.maxX; x += 1) {
    if (!hasSpanAtColumn(source, x)) {
      continue;
    }

    mergeColumnSpan(target, x, source.top[x]!, source.bottom[x]!);
  }
}

function normalizeRadians(angle: number): number {
  const fullRotation = Math.PI * 2;
  let normalizedAngle = angle % fullRotation;

  if (normalizedAngle < 0) {
    normalizedAngle += fullRotation;
  }

  return normalizedAngle;
}

function renderCeilings(framebuffer: Uint8Array, renderResources: GameplayRenderResources, visplanes: readonly Visplane[], playerX: number, playerY: number, playerEyeHeight: number, viewAngle: number, cosine: number, sine: number): void {
  for (const plane of visplanes) {
    if (plane.height <= playerEyeHeight) {
      continue;
    }

    if (plane.picName === SKY_FLAT_NAME) {
      if (renderResources.skyTexture === null) {
        continue;
      }

      for (let x = plane.minX; x <= plane.maxX; x += 1) {
        if (plane.top[x]! > plane.bottom[x]!) {
          continue;
        }

        drawSkyColumn(framebuffer, renderResources.skyTexture, viewAngle, x, plane.top[x]!, plane.bottom[x]!, renderResources.colormaps[0]!);
      }

      continue;
    }

    const flat = renderResources.flats.get(plane.picName);

    if (flat === undefined) {
      continue;
    }

    const planeHeight = plane.height - playerEyeHeight;
    let minY = SCREENHEIGHT;
    let maxY = -1;

    for (let x = plane.minX; x <= plane.maxX; x += 1) {
      if (plane.top[x]! > plane.bottom[x]!) {
        continue;
      }

      minY = Math.min(minY, plane.top[x]!);
      maxY = Math.max(maxY, plane.bottom[x]!);
    }

    if (minY > maxY) {
      continue;
    }

    for (let y = minY; y <= maxY; y += 1) {
      let spanStart = -1;

      for (let x = plane.minX; x <= plane.maxX; x += 1) {
        if (plane.top[x]! <= y && y <= plane.bottom[x]!) {
          if (spanStart < 0) {
            spanStart = x;
          }
          continue;
        }

        if (spanStart >= 0) {
          drawCeilingSpan(framebuffer, y, spanStart, x - 1, flat, playerX, playerY, cosine, sine, planeHeight, renderResources.colormaps, plane.lightLevel);
          spanStart = -1;
        }
      }

      if (spanStart >= 0) {
        drawCeilingSpan(framebuffer, y, spanStart, plane.maxX, flat, playerX, playerY, cosine, sine, planeHeight, renderResources.colormaps, plane.lightLevel);
      }
    }
  }
}

function renderFloors(framebuffer: Uint8Array, renderResources: GameplayRenderResources, visplanes: readonly Visplane[], playerX: number, playerY: number, playerEyeHeight: number, cosine: number, sine: number): void {
  for (const plane of visplanes) {
    if (plane.height >= playerEyeHeight || plane.picName === SKY_FLAT_NAME) {
      continue;
    }

    const flat = renderResources.flats.get(plane.picName);

    if (flat === undefined) {
      continue;
    }

    const planeHeight = playerEyeHeight - plane.height;
    let minY = SCREENHEIGHT;
    let maxY = -1;

    for (let x = plane.minX; x <= plane.maxX; x += 1) {
      if (plane.top[x]! > plane.bottom[x]!) {
        continue;
      }

      minY = Math.min(minY, plane.top[x]!);
      maxY = Math.max(maxY, plane.bottom[x]!);
    }

    if (minY > maxY) {
      continue;
    }

    for (let y = minY; y <= maxY; y += 1) {
      let spanStart = -1;

      for (let x = plane.minX; x <= plane.maxX; x += 1) {
        if (plane.top[x]! <= y && y <= plane.bottom[x]!) {
          if (spanStart < 0) {
            spanStart = x;
          }
          continue;
        }

        if (spanStart >= 0) {
          drawFloorSpan(framebuffer, y, spanStart, x - 1, flat, playerX, playerY, cosine, sine, planeHeight, renderResources.colormaps, plane.lightLevel);
          spanStart = -1;
        }
      }

      if (spanStart >= 0) {
        drawFloorSpan(framebuffer, y, spanStart, plane.maxX, flat, playerX, playerY, cosine, sine, planeHeight, renderResources.colormaps, plane.lightLevel);
      }
    }
  }
}

function spansOverlapOrTouch(existingTop: number, existingBottom: number, incomingTop: number, incomingBottom: number): boolean {
  return incomingTop <= existingBottom + 1 && incomingBottom + 1 >= existingTop;
}

function viewToScreenX(viewX: number, viewY: number): number {
  return CENTERX - (viewX * PROJECTION_PLANE_X) / viewY;
}

function worldHeightToScreen(worldHeight: number, playerEyeHeight: number, depth: number): number {
  return CENTERY - ((worldHeight - playerEyeHeight) * PROJECTION_PLANE_X) / depth;
}

function worldToView(worldX: number, worldY: number, playerX: number, playerY: number, cosine: number, sine: number): Omit<ViewPoint, 'factor'> {
  const deltaX = worldX - playerX;
  const deltaY = worldY - playerY;

  return {
    viewX: -deltaX * sine + deltaY * cosine,
    viewY: deltaX * cosine + deltaY * sine,
  };
}
