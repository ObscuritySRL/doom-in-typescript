/**
 * Level glue between the parsed (immutable) map and the mutable
 * vanilla sector-light specials in {@link ./lights.ts}.
 *
 * Vanilla DOOM has a single mutable `sector_t`; this codebase split
 * the WAD parse (`parseSectors`, which `Object.freeze`s each
 * `MapSector` and is pinned frozen by the map-lane tests) from the
 * runtime simulation.  The light thinkers — like every sector
 * special — mutate `sector->lightlevel` every tic, so the runtime
 * needs mutable sectors.  {@link cloneSectorsMutable} produces an
 * unfrozen, structurally-identical copy the launcher substitutes into
 * its `MapData`; the parsed output stays frozen (its pins intact) and
 * the renderer transparently reads the mutated values, because the
 * software renderer re-snapshots `mapData.sectors[i].lightlevel`
 * (`mapRenderAccessors` `sectorOf`, plus the masked path) every frame.
 *
 * {@link buildLightSectors} wraps those mutable sectors in the
 * {@link LightSector} shape the thinkers consume.  Each view writes
 * `lightlevel`/`special` straight through to the shared
 * `mapData.sectors[i]` object, and each sector's line list is the
 * vanilla `sector->lines[]` resolved from the P_GroupLines
 * `sectorGroups[i].lineIndices` → `lineSectors[lineIndex]`
 * (`frontsector`/`backsector` indices, `-1` = one-sided NULL) plus
 * the linedef `flags`, so `getNextSector` /
 * `P_FindMinSurroundingLight` match Chocolate Doom bit-for-bit.
 *
 * Pure; no Win32 or WAD I/O.
 */

import type { MapSector } from '../map/lineSectorGeometry.ts';

import type { LightLine, LightSector } from './lights.ts';

/**
 * The runtime (post-clone) sector shape: structurally a
 * {@link MapSector} but with the parse-layer `readonly` dropped from
 * the fields the sector specials mutate at simulation time —
 * `floorheight` / `ceilingheight` / `floorpic` (doors, floors, plats,
 * ceilings, donut) in addition to the already-mutable
 * `lightlevel` / `special` (light specials).  `parseSectors` keeps
 * returning frozen `MapSector`; this is only the *clone's* type, so
 * the parse-layer pin is untouched.
 */
export interface MutableMapSector extends Omit<MapSector, 'floorheight' | 'ceilingheight' | 'floorpic'> {
  floorheight: MapSector['floorheight'];
  ceilingheight: MapSector['ceilingheight'];
  floorpic: MapSector['floorpic'];
}

/**
 * The `MapData` slice {@link buildLightSectors} reads: the runtime
 * sectors, the linedef flags, and the P_GroupLines line/sector
 * resolution.  A minimal structural shape (not full `MapData`) keeps
 * the adapter directly unit-testable, matching the `MapRenderTables`
 * convention; the real frozen `MapData` satisfies it structurally.
 */
export interface LightLevelMap {
  readonly sectors: readonly MapSector[];
  readonly linedefs: readonly { readonly flags: number }[];
  readonly lineSectors: readonly { readonly frontsector: number; readonly backsector: number }[];
  readonly sectorGroups: readonly { readonly lineIndices: readonly number[] }[];
}

/**
 * Deep-clone the parsed (frozen) sectors into unfrozen, mutable
 * runtime sector objects with byte-identical field values.  The
 * launcher substitutes the result into its `MapData` so the
 * simulation can mutate `lightlevel`/`special` while `parseSectors`'
 * own frozen output (and its pins) is untouched.
 */
export function cloneSectorsMutable(sectors: readonly MapSector[]): MutableMapSector[] {
  return sectors.map((s) => ({
    floorheight: s.floorheight,
    ceilingheight: s.ceilingheight,
    floorpic: s.floorpic,
    ceilingpic: s.ceilingpic,
    lightlevel: s.lightlevel,
    special: s.special,
    tag: s.tag,
  }));
}

/**
 * A {@link LightSector} backed by a shared mutable `MapSector`:
 * `lightlevel`/`special` write straight through, so a thinker's
 * mutation is exactly what the renderer re-reads next frame.
 */
class LightSectorView implements LightSector {
  /** vanilla `sector->lines[]`; filled after every view exists. */
  lines: LightLine[] = [];

  constructor(private readonly backing: MapSector) {}

  get lightlevel(): number {
    return this.backing.lightlevel;
  }

  set lightlevel(value: number) {
    this.backing.lightlevel = value;
  }

  get special(): number {
    return this.backing.special;
  }

  set special(value: number) {
    this.backing.special = value;
  }
}

/**
 * Build one {@link LightSector} per sector index, sharing the SAME
 * mutable `map.sectors[i]` (write-through) and the vanilla
 * `sector->lines[]` resolved from P_GroupLines.  Views are created
 * first and reused as each line's `frontsector`/`backsector`, so the
 * reference-identity `getNextSector` performs (`frontsector === sec`)
 * is exact.
 */
export function buildLightSectors(map: LightLevelMap): LightSector[] {
  const views = map.sectors.map((sector) => new LightSectorView(sector));

  for (let sectorIndex = 0; sectorIndex < views.length; sectorIndex += 1) {
    const group = map.sectorGroups[sectorIndex]!;
    const lines: LightLine[] = [];

    for (let i = 0; i < group.lineIndices.length; i += 1) {
      const lineIndex = group.lineIndices[i]!;
      const resolved = map.lineSectors[lineIndex]!;
      const back = resolved.backsector;
      lines.push({
        flags: map.linedefs[lineIndex]!.flags,
        frontsector: views[resolved.frontsector]!,
        backsector: back === -1 ? null : views[back]!,
      });
    }

    views[sectorIndex]!.lines = lines;
  }

  return views;
}
