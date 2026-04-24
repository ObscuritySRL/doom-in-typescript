/**
 * Map setup orchestrator matching P_SetupLevel from Chocolate Doom's
 * p_setup.c.
 *
 * Parses all map lumps in the canonical order, then runs a P_GroupLines
 * equivalent to derive per-sector bounding boxes, line lists, sound
 * origins, and blockmap bounding boxes.  The result is a single frozen
 * MapData snapshot that downstream gameplay and renderer code can consume.
 *
 * @example
 * ```ts
 * import { setupLevel } from "../src/map/mapSetup.ts";
 * const mapData = setupLevel(mapBundle);
 * console.log(mapData.sectorGroups[0]!.lineIndices.length);
 * ```
 */

import type { Fixed } from '../core/fixed.ts';
import { FRACBITS } from '../core/fixed.ts';
import type { MapLumpBundle } from './mapBundle.ts';
import { parseVertexes, parseSectors, parseSidedefs, parseLinedefs, ML_TWOSIDED, BOXTOP, BOXBOTTOM, BOXLEFT, BOXRIGHT } from './lineSectorGeometry.ts';
import type { MapVertex, MapSector, MapSidedef, MapLinedef } from './lineSectorGeometry.ts';
import { parseSegs, parseSubsectors, parseNodes } from './bspStructs.ts';
import type { MapSeg, MapSubsector, MapNode } from './bspStructs.ts';
import { parseBlockmap, MAPBLOCKSHIFT } from './blockmap.ts';
import type { Blockmap } from './blockmap.ts';
import { parseReject } from './reject.ts';
import type { RejectMap } from './reject.ts';
import { parseThings } from './things.ts';
import type { MapThing } from './things.ts';
import { buildSubsectorSectorMap } from './subsectorQuery.ts';
import { createValidCount } from './blockmapIter.ts';
import type { ValidCount } from './blockmapIter.ts';

// ── Constants ────────────────────────────────────────────────────────

/**
 * Maximum thing radius used for blockbox expansion.
 * Matches MAXRADIUS (32*FRACUNIT) from Chocolate Doom's p_local.h.
 */
export const MAXRADIUS: Fixed = (32 << FRACBITS) | 0;

// ── Interfaces ───────────────────────────────────────────────────────

/**
 * Per-linedef front/back sector resolution produced by P_GroupLines.
 *
 * Matches the `frontsector` / `backsector` pointer assignment in
 * Chocolate Doom's P_GroupLines (p_setup.c), using sector indices
 * instead of pointers.  A backsector of -1 means the line is
 * one-sided (NULL in the C code).
 */
export interface LineSectors {
  /** Front sector index (resolved from sidenum0 → sidedef → sector). */
  readonly frontsector: number;
  /** Back sector index, or -1 if one-sided. */
  readonly backsector: number;
}

/**
 * Per-sector derived data produced by P_GroupLines.
 *
 * Contains the sector's touching linedef indices, bounding box,
 * sound origin (center of bbox), and blockmap bounding box
 * (expanded by MAXRADIUS and clamped to the grid).
 */
export interface SectorGroup {
  /** Indices of linedefs whose front or back sector is this sector. */
  readonly lineIndices: readonly number[];
  /** Bounding box [top, bottom, left, right] in 16.16 fixed-point. */
  readonly bbox: readonly [Fixed, Fixed, Fixed, Fixed];
  /** Sound origin X: center of bounding box, matching C integer division. */
  readonly soundOriginX: Fixed;
  /** Sound origin Y: center of bounding box, matching C integer division. */
  readonly soundOriginY: Fixed;
  /** Blockmap bounding box [top, bottom, left, right] in block coordinates, clamped to grid. */
  readonly blockbox: readonly [number, number, number, number];
}

/**
 * Complete parsed map state equivalent to Chocolate Doom's global
 * level data after P_SetupLevel returns.
 */
export interface MapData {
  /** Map marker name (e.g. "E1M1"). */
  readonly name: string;
  readonly vertexes: readonly MapVertex[];
  readonly sectors: readonly MapSector[];
  readonly sidedefs: readonly MapSidedef[];
  readonly linedefs: readonly MapLinedef[];
  readonly segs: readonly MapSeg[];
  readonly subsectors: readonly MapSubsector[];
  readonly nodes: readonly MapNode[];
  readonly things: readonly MapThing[];
  readonly blockmap: Blockmap;
  readonly reject: RejectMap;
  /** Subsector-to-sector index lookup (from P_GroupLines subsector pass). */
  readonly subsectorSectors: readonly number[];
  /** Per-linedef front/back sector resolution. */
  readonly lineSectors: readonly LineSectors[];
  /** Per-sector line lists, bounding boxes, and sound origins. */
  readonly sectorGroups: readonly SectorGroup[];
  /** Mutable linedef-visit deduplication tracker for blockmap queries. */
  readonly validCount: ValidCount;
}

// ── M_ClearBox / M_AddToBox parity ──────────────────────────────────

const INT_MIN = -0x80000000;
const INT_MAX = 0x7fffffff;

/**
 * Replicates M_AddToBox from Chocolate Doom's m_bbox.c exactly,
 * including the `else if` branch structure that is parity-critical.
 */
function addToBox(bbox: number[], x: Fixed, y: Fixed): void {
  if (x < bbox[BOXLEFT]!) bbox[BOXLEFT] = x;
  else if (x > bbox[BOXRIGHT]!) bbox[BOXRIGHT] = x;

  if (y < bbox[BOXBOTTOM]!) bbox[BOXBOTTOM] = y;
  else if (y > bbox[BOXTOP]!) bbox[BOXTOP] = y;
}

// ── P_GroupLines ─────────────────────────────────────────────────────

/**
 * Derive per-linedef sector references and per-sector metadata.
 *
 * Matches P_GroupLines from Chocolate Doom's p_setup.c:
 *
 * 1. Resolve each linedef's frontsector from sidenum0 → sidedef → sector.
 * 2. Resolve backsector from sidenum1 only when ML_TWOSIDED is set and
 *    sidenum1 != -1; otherwise backsector is -1 (NULL in C).
 * 3. For each sector, collect touching linedefs by comparing front/back
 *    sector indices, computing M_AddToBox over their vertex endpoints.
 * 4. Compute sound origin as the center of the bounding box using C
 *    integer truncation semantics.
 * 5. Compute blockbox by expanding the bbox by MAXRADIUS, shifting to
 *    block coordinates, and clamping to the blockmap grid.
 */
function groupLines(
  linedefs: readonly MapLinedef[],
  sidedefs: readonly MapSidedef[],
  vertexes: readonly MapVertex[],
  sectorCount: number,
  blockmap: Blockmap,
): {
  lineSectors: readonly LineSectors[];
  sectorGroups: readonly SectorGroup[];
} {
  // Step 1–2: resolve front/back sectors for each linedef
  const lineSectors: LineSectors[] = new Array(linedefs.length);
  for (let i = 0; i < linedefs.length; i++) {
    const ld = linedefs[i]!;
    const frontsector = sidedefs[ld.sidenum0]!.sector;
    let backsector: number;
    if ((ld.flags & ML_TWOSIDED) !== 0 && ld.sidenum1 !== -1) {
      backsector = sidedefs[ld.sidenum1]!.sector;
    } else {
      backsector = -1;
    }
    lineSectors[i] = Object.freeze({ frontsector, backsector });
  }

  // Step 3–5: build per-sector line lists, bboxes, sound origins, blockboxes
  const sectorGroups: SectorGroup[] = new Array(sectorCount);
  for (let si = 0; si < sectorCount; si++) {
    // M_ClearBox: BOXTOP=BOXRIGHT=INT_MIN, BOXBOTTOM=BOXLEFT=INT_MAX
    const bbox = [INT_MIN, INT_MAX, INT_MAX, INT_MIN];
    const lineIndices: number[] = [];

    for (let li = 0; li < linedefs.length; li++) {
      const ls = lineSectors[li]!;
      if (ls.frontsector === si || ls.backsector === si) {
        lineIndices.push(li);

        const ld = linedefs[li]!;
        const v1 = vertexes[ld.v1]!;
        const v2 = vertexes[ld.v2]!;
        addToBox(bbox, v1.x, v1.y);
        addToBox(bbox, v2.x, v2.y);
      }
    }

    // Sound origin = center of bounding box (C integer division)
    const soundOriginX = (((bbox[BOXRIGHT]! + bbox[BOXLEFT]!) / 2) | 0) as Fixed;
    const soundOriginY = (((bbox[BOXTOP]! + bbox[BOXBOTTOM]!) / 2) | 0) as Fixed;

    // Blockbox: expand by MAXRADIUS, shift to block coords, clamp
    let blockTop = ((bbox[BOXTOP]! - blockmap.originY + MAXRADIUS) | 0) >> MAPBLOCKSHIFT;
    if (blockTop >= blockmap.rows) blockTop = blockmap.rows - 1;

    let blockBottom = ((bbox[BOXBOTTOM]! - blockmap.originY - MAXRADIUS) | 0) >> MAPBLOCKSHIFT;
    if (blockBottom < 0) blockBottom = 0;

    let blockRight = ((bbox[BOXRIGHT]! - blockmap.originX + MAXRADIUS) | 0) >> MAPBLOCKSHIFT;
    if (blockRight >= blockmap.columns) blockRight = blockmap.columns - 1;

    let blockLeft = ((bbox[BOXLEFT]! - blockmap.originX - MAXRADIUS) | 0) >> MAPBLOCKSHIFT;
    if (blockLeft < 0) blockLeft = 0;

    sectorGroups[si] = Object.freeze({
      lineIndices: Object.freeze(lineIndices),
      bbox: Object.freeze([bbox[BOXTOP]!, bbox[BOXBOTTOM]!, bbox[BOXLEFT]!, bbox[BOXRIGHT]!] as const),
      soundOriginX,
      soundOriginY,
      blockbox: Object.freeze([blockTop, blockBottom, blockLeft, blockRight] as const),
    });
  }

  return {
    lineSectors: Object.freeze(lineSectors),
    sectorGroups: Object.freeze(sectorGroups),
  };
}

// ── setupLevel ───────────────────────────────────────────────────────

/**
 * Parse and derive all map data from a lump bundle.
 *
 * Matches the lump load order of P_SetupLevel in Chocolate Doom's
 * p_setup.c:
 *
 * 1. Blockmap (P_LoadBlockMap)
 * 2. Vertexes (P_LoadVertexes)
 * 3. Sectors  (P_LoadSectors)
 * 4. Sidedefs (P_LoadSideDefs)
 * 5. Linedefs (P_LoadLineDefs) — needs vertexes
 * 6. Subsectors (P_LoadSubsectors)
 * 7. Nodes   (P_LoadNodes)
 * 8. Segs    (P_LoadSegs)
 * 9. GroupLines (P_GroupLines) — derives sector metadata
 * 10. Things  (P_LoadThings)
 * 11. Reject  (P_LoadRejectMap)
 *
 * @param bundle - Raw map lump bundle from parseMapBundle.
 * @returns Complete frozen MapData with all derived fields.
 */
export function setupLevel(bundle: MapLumpBundle): MapData {
  // 1. Blockmap
  const blockmap = parseBlockmap(bundle.blockmap);

  // 2. Vertexes
  const vertexes = parseVertexes(bundle.vertexes);

  // 3. Sectors
  const sectors = parseSectors(bundle.sectors);

  // 4. Sidedefs
  const sidedefs = parseSidedefs(bundle.sidedefs);

  // 5. Linedefs (needs vertexes)
  const linedefs = parseLinedefs(bundle.linedefs, vertexes);

  // 6. Subsectors
  const subsectors = parseSubsectors(bundle.ssectors);

  // 7. Nodes
  const nodes = parseNodes(bundle.nodes);

  // 8. Segs
  const segs = parseSegs(bundle.segs);

  // 9. GroupLines: subsector→sector map + per-sector/line derived data
  const subsectorSectors = buildSubsectorSectorMap(subsectors, segs, linedefs, sidedefs);
  const { lineSectors, sectorGroups } = groupLines(linedefs, sidedefs, vertexes, sectors.length, blockmap);

  // 10. Things
  const things = parseThings(bundle.things);

  // 11. Reject
  const reject = parseReject(bundle.reject, sectors.length);

  // ValidCount tracker for blockmap queries
  const validCount = createValidCount(linedefs.length);

  return Object.freeze({
    name: bundle.name,
    vertexes,
    sectors,
    sidedefs,
    linedefs,
    segs,
    subsectors,
    nodes,
    things,
    blockmap,
    reject,
    subsectorSectors,
    lineSectors,
    sectorGroups,
    validCount,
  });
}
