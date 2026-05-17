/**
 * Parsed map → {@link SubsectorVisitorDeps} accessors — the
 * Chocolate Doom 2.2.1 p_setup.c `P_LoadSegs` / `P_GroupLines`
 * resolution the BSP-walk render path reads as `curline->frontsector`
 * / `curline->backsector` / `sub->sector`.
 *
 * `R_AddLine` / `R_Subsector` consume pointer-resolved seg and
 * subsector structs; the map parser keeps lump-faithful *indices* and
 * *names*. This binds them: each accessor performs exactly the
 * `P_LoadSegs` / `P_GroupLines` dereference vanilla did at load time,
 * with the parsed-string flat / texture names mapped through the
 * `R_FlatNumForName` / `R_TextureNumForName` resolvers (so
 * {@link AddLineSector} pics and `sidedefMidtexture` are the integer
 * numbers the seg pipeline expects).
 *
 *   P_LoadSegs (per seg):
 *     li->frontsector = sides[ldef->sidenum[side]].sector;
 *     if (ldef->flags & ML_TWOSIDED)
 *         li->backsector = sides[ldef->sidenum[side^1]].sector;
 *     else
 *         li->backsector = 0;
 *
 *   P_GroupLines (per subsector, via the first seg):
 *     ss->sector = ss->firstline->sidedef->sector;
 *
 * The `ML_TWOSIDED` line whose opposite `sidenum` is `-1` is vanilla's
 * `GetSectorAtNullAddress` "glass hack" — an emulator-specific zeroed
 * sector. As {@link segRenderModel} documents, that value is NOT
 * fabricated here and the E1M1-spawn route (13-003's target) never
 * triggers it; encountering it is surfaced as a hard error rather than
 * a silent wrong sector (consistent with the renderer's
 * never-silent-fallback rule).
 *
 * Pure; no Win32 or runtime dependencies. The subsector→sector map is
 * the existing bit-exact {@link buildSubsectorSectorMap}.
 */

import type { MapSeg, MapSubsector } from '../map/bspStructs.ts';
import type { MapLinedef, MapSector, MapSidedef, MapVertex } from '../map/lineSectorGeometry.ts';
import { ML_TWOSIDED } from '../map/lineSectorGeometry.ts';
import { buildSubsectorSectorMap } from '../map/subsectorQuery.ts';

import type { AddLineSeg, AddLineSector } from './addLine.ts';
import type { FlatNumberResolver, TextureNumberResolver } from './segRenderModel.ts';
import type { SubsectorVisitorDeps } from './subsectorVisitor.ts';

/** The parsed map lump tables the render accessors dereference. */
export interface MapRenderTables {
  readonly subsectors: readonly MapSubsector[];
  readonly segs: readonly MapSeg[];
  readonly linedefs: readonly MapLinedef[];
  readonly sidedefs: readonly MapSidedef[];
  readonly sectors: readonly MapSector[];
  readonly vertexes: readonly MapVertex[];
}

/** The map-resolved subset of {@link SubsectorVisitorDeps} (the frame context is supplied separately). */
export type MapRenderAccessors = Pick<SubsectorVisitorDeps, 'subsectorAt' | 'frontsectorOf' | 'addLineSegAt'>;

/**
 * Build the parsed-map render accessors. `flatNumber` is
 * `R_FlatNumForName` (sector pic name → flat number); `textureNumber`
 * is `R_TextureNumForName` (sidedef texture name → texture number,
 * `"-"` → `0`).
 *
 * @example
 * ```ts
 * const acc = makeMapRenderAccessors(mapTables, flatNumber, textureNumber);
 * const onSubsector = makeSubsectorVisitor({ ...acc, view, pool, state, makeSegStore });
 * ```
 */
export function makeMapRenderAccessors(map: MapRenderTables, flatNumber: FlatNumberResolver, textureNumber: TextureNumberResolver): MapRenderAccessors {
  const subsectorSector = buildSubsectorSectorMap(map.subsectors, map.segs, map.linedefs, map.sidedefs);

  const sectorOf = (sectorIndex: number): AddLineSector => {
    const s = map.sectors[sectorIndex]!;
    return {
      ceilingheight: s.ceilingheight,
      floorheight: s.floorheight,
      ceilingpic: flatNumber(s.ceilingpic),
      floorpic: flatNumber(s.floorpic),
      lightlevel: s.lightlevel,
    };
  };

  return {
    subsectorAt: (subsectorIndex: number): MapSubsector => map.subsectors[subsectorIndex]!,

    frontsectorOf: (subsectorIndex: number): AddLineSector => sectorOf(subsectorSector[subsectorIndex]!),

    addLineSegAt: (segIndex: number): AddLineSeg => {
      const seg = map.segs[segIndex]!;
      const linedef = map.linedefs[seg.linedef]!;
      const frontSidenum = seg.side === 0 ? linedef.sidenum0 : linedef.sidenum1;
      const frontSidedef = map.sidedefs[frontSidenum]!;

      let backsector: AddLineSector | null = null;
      if ((linedef.flags & ML_TWOSIDED) !== 0) {
        const backSidenum = seg.side === 0 ? linedef.sidenum1 : linedef.sidenum0;
        if (backSidenum === -1) {
          // GetSectorAtNullAddress glass hack — deferred parity edge,
          // never on the E1M1-spawn route; not fabricated here.
          throw new Error(`makeMapRenderAccessors: seg ${segIndex} hits the GetSectorAtNullAddress glass hack (ML_TWOSIDED with sidenum == -1) — a deferred parity edge`);
        }
        backsector = sectorOf(map.sidedefs[backSidenum]!.sector);
      }

      return {
        v1: { x: map.vertexes[seg.v1]!.x, y: map.vertexes[seg.v1]!.y },
        v2: { x: map.vertexes[seg.v2]!.x, y: map.vertexes[seg.v2]!.y },
        backsector,
        sidedefMidtexture: textureNumber(frontSidedef.midtexture),
      };
    },
  };
}
