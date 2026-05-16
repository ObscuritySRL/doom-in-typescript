/**
 * MapData seg → assembled-renderer seg model adapter (Chocolate Doom
 * 2.2.1 p_setup.c `P_LoadSegs` per-seg `frontsector` / `backsector` /
 * `sidedef` resolution).
 *
 * The parsed {@link MapData} stores raw seg lump fields plus per-linedef
 * `lineSectors`; vanilla resolves a seg's front/back sector and sidedef
 * per-seg in `P_LoadSegs` using `seg->side` (`ldef->sidenum[side]` /
 * `[side^1]`). This adapter reproduces that resolution exactly and
 * shapes the result into the inputs the I4a {@link addLine} projector
 * and the I2 {@link storeWallRange} coordinator consume.
 *
 * `MapData` keeps flat / texture references as uppercase NAME strings
 * (lump-index resolution is a catalog concern); the I4a / I2 contracts
 * use integer flat / texture numbers. The catalogs are injected as
 * `flatNumber` / `textureNumber` resolvers (mirroring `storeWallRange`'s
 * injected `textures`), so this stays pure and decoupled and the SAME
 * resolver is applied to front and back (the `R_AddLine` window /
 * trigger classification compares them).
 *
 * Pure; no Win32 or runtime dependencies.
 */

import type { Angle } from '../core/angle.ts';
import type { Fixed } from '../core/fixed.ts';
import type { MapSeg } from '../map/bspStructs.ts';
import type { MapLinedef, MapSector, MapSidedef, MapVertex } from '../map/lineSectorGeometry.ts';
import { ML_TWOSIDED } from '../map/lineSectorGeometry.ts';

import type { AddLineSeg, AddLineSector } from './addLine.ts';
import type { SegSector, SegSidedef, SegVertex, StoreWallRangeSeg } from './storeWallRange.ts';

/** Flat NAME → flat lump number (e.g. `skyflatnum`-comparable). */
export type FlatNumberResolver = (flatName: string) => number;

/** Texture NAME → texture number (`0` = none). */
export type TextureNumberResolver = (textureName: string) => number;

/** The subset of the parsed level `segRenderModel` reads. */
export interface SegRenderScene {
  readonly vertexes: readonly MapVertex[];
  readonly segs: readonly MapSeg[];
  readonly linedefs: readonly MapLinedef[];
  readonly sidedefs: readonly MapSidedef[];
  readonly sectors: readonly MapSector[];
}

/**
 * Resolved per-seg render data: the I4a {@link addLine} inputs plus the
 * fields the I2 {@link buildStoreWallRangeSeg} needs to assemble a
 * {@link StoreWallRangeSeg} once the sequencer has the projected screen
 * range and `rw_angle1` from {@link addLine}.
 */
export interface SegRenderModel {
  readonly addLineSeg: AddLineSeg;
  /** Front sector (numeric pics); satisfies both `AddLineSector` and `SegSector`. */
  readonly frontsector: AddLineSector & SegSector;
  readonly backsector: (AddLineSector & SegSector) | null;
  /**
   * `true` when `ML_TWOSIDED` but `sidenum[side^1]` is out of range —
   * the `GetSectorAtNullAddress` "glass hack". Vanilla overwrites the
   * zeroed null sector's floor/ceiling via `I_GetMemoryValue`; that
   * emulator-specific value is a deferred parity edge and is NOT
   * fabricated here (the E1M1-spawn route, 13-003's target, never
   * triggers it). `backsector` is the `memset`-zero baseline.
   */
  readonly backsectorIsNullAddress: boolean;
  readonly sidedef: SegSidedef;
  readonly curlineAngle: Angle;
  readonly curlineOffset: Fixed;
  readonly linedefFlags: number;
  readonly v1: SegVertex;
  readonly v2: SegVertex;
}

const NULL_ADDRESS_SECTOR: AddLineSector & SegSector = Object.freeze({
  ceilingheight: 0,
  floorheight: 0,
  ceilingpic: 0,
  floorpic: 0,
  lightlevel: 0,
});

function toNumericSector(sector: MapSector, flatNumber: FlatNumberResolver): AddLineSector & SegSector {
  return Object.freeze({
    ceilingheight: sector.ceilingheight,
    floorheight: sector.floorheight,
    ceilingpic: flatNumber(sector.ceilingpic),
    floorpic: flatNumber(sector.floorpic),
    lightlevel: sector.lightlevel,
  });
}

/**
 * Resolve one seg (by index) into its renderer model, reproducing
 * p_setup.c `P_LoadSegs`: `side = seg->side`; the front sidedef /
 * frontsector are `sides[ldef->sidenum[side]]`; the backsector is
 * `sides[ldef->sidenum[side^1]].sector` only when `ML_TWOSIDED` and
 * that sidenum is in range (else the `GetSectorAtNullAddress` glass
 * hack), and is `NULL` for one-sided lines.
 */
export function segRenderModel(scene: SegRenderScene, segIndex: number, flatNumber: FlatNumberResolver, textureNumber: TextureNumberResolver): SegRenderModel {
  const seg = scene.segs[segIndex]!;
  const linedef = scene.linedefs[seg.linedef]!;
  const side = seg.side;

  const frontSidenum = side === 0 ? linedef.sidenum0 : linedef.sidenum1; // ldef->sidenum[side]
  const mapSidedef = scene.sidedefs[frontSidenum]!;
  const frontsector = toNumericSector(scene.sectors[mapSidedef.sector]!, flatNumber);

  let backsector: (AddLineSector & SegSector) | null;
  let backsectorIsNullAddress = false;
  if ((linedef.flags & ML_TWOSIDED) !== 0) {
    const backSidenum = side === 0 ? linedef.sidenum1 : linedef.sidenum0; // ldef->sidenum[side^1]
    if (backSidenum < 0 || backSidenum >= scene.sidedefs.length) {
      backsector = NULL_ADDRESS_SECTOR;
      backsectorIsNullAddress = true;
    } else {
      backsector = toNumericSector(scene.sectors[scene.sidedefs[backSidenum]!.sector]!, flatNumber);
    }
  } else {
    backsector = null;
  }

  const v1: SegVertex = Object.freeze({ x: scene.vertexes[seg.v1]!.x, y: scene.vertexes[seg.v1]!.y });
  const v2: SegVertex = Object.freeze({ x: scene.vertexes[seg.v2]!.x, y: scene.vertexes[seg.v2]!.y });

  const sidedef: SegSidedef = Object.freeze({
    midtexture: textureNumber(mapSidedef.midtexture),
    toptexture: textureNumber(mapSidedef.toptexture),
    bottomtexture: textureNumber(mapSidedef.bottomtexture),
    textureoffset: mapSidedef.textureoffset,
    rowoffset: mapSidedef.rowoffset,
  });

  const addLineSeg: AddLineSeg = Object.freeze({
    v1,
    v2,
    backsector,
    sidedefMidtexture: sidedef.midtexture,
  });

  return Object.freeze({
    addLineSeg,
    frontsector,
    backsector,
    backsectorIsNullAddress,
    sidedef,
    curlineAngle: seg.angle >>> 0,
    curlineOffset: seg.offset,
    linedefFlags: linedef.flags,
    v1,
    v2,
  });
}

/**
 * Assemble the I2 {@link StoreWallRangeSeg} once the sequencer has the
 * projected inclusive screen range and `rw_angle1` from
 * {@link addLine}.
 */
export function buildStoreWallRangeSeg(model: SegRenderModel, start: number, stop: number, rwAngle1: Angle): StoreWallRangeSeg {
  return Object.freeze({
    start,
    stop,
    curlineAngle: model.curlineAngle,
    curlineOffset: model.curlineOffset,
    v1: model.v1,
    v2: model.v2,
    linedefFlags: model.linedefFlags,
    sidedef: model.sidedef,
    frontsector: model.frontsector,
    backsector: model.backsector,
    rwAngle1,
  });
}
