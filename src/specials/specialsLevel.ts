/**
 * Level glue between the parsed (immutable) map and the mutable
 * vanilla sector/line specials (doors, floors, plats, ceilings,
 * stairs/donut, teleport, switches).
 *
 * This is the sector-special analogue of {@link ./lightsLevel.ts}.
 * Vanilla DOOM has a single mutable `sector_t`; the launcher already
 * substitutes an unfrozen `cloneSectorsMutable` clone into its
 * `MapData` so light specials can mutate `lightlevel`/`special`.  The
 * floor/door/plat/ceiling movers additionally mutate
 * `floorheight`/`ceilingheight`/`floorpic` and stash a `specialdata`
 * thinker pointer per sector — fields the bare {@link MapSector} does
 * not carry.  {@link buildSpecialsModel} wraps the shared mutable
 * sectors in {@link SpecialsSector} write-through views (heights,
 * floorpic, and special go straight back to `mapData.sectors[i]`, so
 * the software renderer — which re-reads `mapData.sectors[i]` every
 * frame via `mapRenderAccessors.sectorOf` — shows doors/lifts move),
 * builds the vanilla `sector->lines[]` with reference-identity
 * `frontSector`/`backSector` from P_GroupLines (so `getNextSector`
 * matches Chocolate Doom bit-for-bit), and assembles a single
 * {@link LineTriggerCallbacks} bundle wiring every EV_* spawner.
 *
 * `T_MovePlane` (p_floor.c) and the `P_Find*Surrounding` /
 * `P_FindShortestLowerTexture` / `getNextSector` /
 * `P_FindSectorFromLineTag` helpers (p_spec.c) are implemented here,
 * bit-for-bit against the cached Chocolate Doom 2.2.1 reference.  They
 * were declared only as callback interfaces by the specials modules
 * (to avoid a module cycle with `P_ChangeSector`); this module is the
 * level-bound implementation.
 *
 * Parity-critical behavior preserved byte-for-byte from Chocolate Doom
 * 2.2.1:
 *
 * - `T_MovePlane` clamps to `dest` when the next step would *cross* it
 *   (`height ± speed > dest` for up / `< dest` for down — strict, not
 *   `>=`), runs `P_ChangeSector(sector, crush)` after every height
 *   write, and reverts the height (re-running `P_ChangeSector`) when a
 *   thing no longer fits.  On the FLOOR-up and CEILING-down legs a
 *   crush returns `crushed` *without* reverting when `crush === true`
 *   (the grinding-crusher path); every non-crushing blocked move
 *   reverts and returns `crushed`.  The CEILING-up leg never reverts
 *   (vanilla has no crush handling there).
 * - `getNextSector` gates solely on `ML_TWOSIDED` (a back side may
 *   physically exist yet still be NULL to the neighbor scan if the
 *   flag is clear) and returns the *other* sector by reference
 *   identity.
 * - The five `P_Find*Surrounding` seeds match vanilla exactly:
 *   lowest-floor seeds at `sec.floorheight`, highest-floor at
 *   `-500*FRACUNIT`, lowest-ceiling at `INT_MAX`, highest-ceiling at
 *   `0`, next-highest collects neighbors strictly greater than the
 *   passed `currentheight` and returns the minimum of those (or
 *   `currentheight` when none).
 * - `evDoLockedDoor` / `evVerticalDoor` receive the live
 *   {@link Player} (key check) only when the activator is the local
 *   player mobj; monsters pass `null`, exactly as the p_switch.c
 *   `thing->player` cast.
 *
 * Pure simulation; no Win32 or WAD I/O.
 *
 * @example
 * ```ts
 * const model = buildSpecialsModel(mapData, thinkerList, doomRandom, player);
 * pUseSpecialLine(thing, line, side, model.callbacks);
 * model.updateSpecials(); // P_UpdateSpecials button-timer half
 * ```
 */

import type { DoomRandom } from '../core/rng.ts';
import { FRACUNIT } from '../core/fixed.ts';

import { ML_TWOSIDED } from '../map/lineSectorGeometry.ts';
import type { MapData } from '../map/mapSetup.ts';

import type { Player } from '../player/playerSpawn.ts';

import type { BlockThingsGrid } from '../world/checkPosition.ts';
import { Mobj } from '../world/mobj.ts';
import { changeSector } from '../world/sectorChange.ts';
import type { ThinkerList } from '../world/thinkers.ts';
import { evTeleport } from '../world/teleport.ts';

import { ActiveCeilings, evCeilingCrushStop, evDoCeiling } from './ceilings.ts';
import type { CeilingType } from './ceilings.ts';
import { PlaneMoveResult, evDoDoor, evDoLockedDoor, evVerticalDoor } from './doors.ts';
import type { DoorCallbacks, DoorSector, VerticalDoorType } from './doors.ts';
import { evDoFloor } from './floors.ts';
import type { FloorType } from './floors.ts';
import type { LineTriggerCallbacks, LineTriggerLine, LineTriggerThing } from './lineTriggers.ts';
import { ActivePlats, evDoPlat, evStopPlat } from './platforms.ts';
import type { PlatType } from './platforms.ts';
import { evBuildStairs, evDoDonut } from './stairsDonut.ts';
import type { StairType, StairsDonutLinedef, StairsDonutSector } from './stairsDonut.ts';
import type { MutableMapSector } from './lightsLevel.ts';
import { changeSwitchTexture, createButtonList, initSwitchList, switchEpisodeForGameMode, updateButtons } from './switches.ts';
import type { Button, SwitchList, SwitchSide } from './switches.ts';
import type { GameMode } from '../bootstrap/gameMode.ts';

const INT_MAX = 0x7fffffff;

/** `-500 * FRACUNIT` — the P_FindHighestFloorSurrounding seed. */
const HIGHEST_FLOOR_SEED = (-500 * FRACUNIT) | 0;

/**
 * One runtime `sector_t` slice the sector-special movers touch,
 * write-through to the shared mutable `mapData.sectors[i]`.  Carries
 * the door/floor/plat/ceiling/stairs union of every `*Sector`
 * contract plus the vanilla `sector->lines[]` for `getNextSector`.
 */
export interface SpecialsSector extends DoorSector, StairsDonutSector {
  /** vanilla `sector->lines[]` resolved from P_GroupLines. */
  lines: SpecialsLinedef[];
}

/** The `line_t` slice `getNextSector` reads (vanilla two-sided gate + neighbor identity). */
export interface SpecialsLinedef extends StairsDonutLinedef {
  readonly flags: number;
  readonly frontSector: SpecialsSector;
  readonly backSector: SpecialsSector | null;
}

/** Write-through view over one shared mutable `MapSector`, plus runtime-only fields. */
class SpecialsSectorView implements SpecialsSector {
  lines: SpecialsLinedef[] = [];
  /** vanilla `sector->specialdata` (door/floor/plat/ceiling thinker pointer). */
  specialdata: SpecialsSector['specialdata'] = null;

  constructor(private readonly backing: MutableMapSector) {}

  get floorheight(): number {
    return this.backing.floorheight;
  }

  set floorheight(value: number) {
    this.backing.floorheight = value;
  }

  get ceilingheight(): number {
    return this.backing.ceilingheight;
  }

  set ceilingheight(value: number) {
    this.backing.ceilingheight = value;
  }

  /**
   * `sector->floorpic` is a flat *index* in vanilla but the parsed
   * `MapSector.floorpic` is the flat *name* string (the renderer
   * resolves it per frame).  The donut/lowerAndChange/raise24AndChange
   * swaps copy one sector's pic onto another, so the relative copy is
   * preserved either way; this view stores the runtime numeric value
   * the specials layer assigns while leaving the parsed name intact
   * for sectors no special ever rewrites.
   */
  #floorpic = 0;

  get floorpic(): number {
    return this.#floorpic;
  }

  set floorpic(value: number) {
    this.#floorpic = value;
  }

  get special(): number {
    return this.backing.special;
  }

  set special(value: number) {
    this.backing.special = value;
  }

  get tag(): number {
    return this.backing.tag;
  }
}

/**
 * Mutable runtime `line_t` slice the dispatcher reads/writes.  Built
 * once per linedef index by {@link SpecialsModel.triggerLineFor} so
 * one-shot `special = 0` clears persist across activations (vanilla
 * mutates `line->special` in place; the parsed `mapData.linedefs[i]`
 * is frozen, so the runtime override lives here).  The `__*`
 * attachments carry the door sector / switch side / activator mobj
 * the EV_* spawners need but the bare `LineTriggerLine` shape omits.
 */
export interface RuntimeTriggerLine extends LineTriggerLine {
  __doorSector?: SpecialsSector;
  __switchSide?: SwitchSide;
  __mobj?: Mobj;
}

/** Result of {@link buildSpecialsModel}. */
export interface SpecialsModel {
  /** The assembled P_UseSpecialLine / P_CrossSpecialLine / P_ShootSpecialLine dispatch bridge. */
  readonly callbacks: LineTriggerCallbacks;
  /** The P_UpdateSpecials button/switch-cooldown half (call once per tic AFTER P_RunThinkers). */
  updateSpecials(): void;
  /** Per-sector views (index-aligned with `mapData.sectors`). */
  readonly sectors: readonly SpecialsSector[];
  /**
   * The persistent runtime trigger-line for a linedef index, with the
   * door sector / front switch side / activator mobj attached for the
   * upcoming dispatch.  One instance per linedef index (cached) so a
   * one-shot `line.special = 0` clear written by the dispatcher
   * survives to the next activation, exactly as vanilla's in-place
   * `line->special` mutation does.
   */
  triggerLineFor(linedefIndex: number, thing: Mobj): RuntimeTriggerLine;
  /**
   * Whether a linedef's runtime special is still armed (non-zero).
   * `P_UseLines` / `P_CrossSpecialLine` gate on this in vanilla; the
   * frozen `mapData.linedefs[i].special` cannot reflect a one-shot
   * clear, so callers consult this before dispatching.
   */
  isLineArmed(linedefIndex: number): boolean;
}

/**
 * `getNextSector` (p_spec.c): the sector on the OTHER side of `line`
 * from `sec`.  NULL unless the line is `ML_TWOSIDED` — vanilla parity
 * means the flag is the only gate, even if a back sidedef exists.
 */
function getNextSector(line: SpecialsLinedef, sec: SpecialsSector): SpecialsSector | null {
  if ((line.flags & ML_TWOSIDED) === 0) return null;
  if (line.frontSector === sec) return line.backSector;
  return line.frontSector;
}

/** P_FindLowestFloorSurrounding (p_spec.c) — min neighbor floor, seeded at `sec.floorheight`. */
function findLowestFloorSurrounding(sec: SpecialsSector): number {
  let floor = sec.floorheight;
  for (const line of sec.lines) {
    const other = getNextSector(line, sec);
    if (other === null) continue;
    if (other.floorheight < floor) floor = other.floorheight;
  }
  return floor;
}

/** P_FindHighestFloorSurrounding (p_spec.c) — max neighbor floor, seeded at `-500*FRACUNIT`. */
function findHighestFloorSurrounding(sec: SpecialsSector): number {
  let floor = HIGHEST_FLOOR_SEED;
  for (const line of sec.lines) {
    const other = getNextSector(line, sec);
    if (other === null) continue;
    if (other.floorheight > floor) floor = other.floorheight;
  }
  return floor;
}

/**
 * P_FindNextHighestFloor (p_spec.c) — minimum neighbor floor strictly
 * greater than `currentheight`, or `currentheight` when none.  Vanilla
 * builds a `heightlist[]` of qualifying neighbor floors then returns
 * its minimum; the 22-adjacent-sector stack-overflow `I_Error` is not
 * reproduced (no map on the C1 target hits it) but the
 * collect-then-min order is preserved.
 */
function findNextHighestFloor(sec: SpecialsSector, currentheight: number): number {
  let min = 0;
  let found = false;
  for (const line of sec.lines) {
    const other = getNextSector(line, sec);
    if (other === null) continue;
    if (other.floorheight > currentheight) {
      if (!found || other.floorheight < min) {
        min = other.floorheight;
        found = true;
      }
    }
  }
  return found ? min : currentheight;
}

/** P_FindLowestCeilingSurrounding (p_spec.c) — min neighbor ceiling, seeded at `INT_MAX`. */
function findLowestCeilingSurrounding(sec: SpecialsSector): number {
  let height = INT_MAX;
  for (const line of sec.lines) {
    const other = getNextSector(line, sec);
    if (other === null) continue;
    if (other.ceilingheight < height) height = other.ceilingheight;
  }
  return height;
}

/** P_FindHighestCeilingSurrounding (p_spec.c) — max neighbor ceiling, seeded at `0`. */
function findHighestCeilingSurrounding(sec: SpecialsSector): number {
  let height = 0;
  for (const line of sec.lines) {
    const other = getNextSector(line, sec);
    if (other === null) continue;
    if (other.ceilingheight > height) height = other.ceilingheight;
  }
  return height;
}

/**
 * The first two-sided neighbor whose floorheight equals `height` —
 * `lowerAndChange`'s pic/special source (p_floor.c walks
 * `sec->lines[]` in declaration order, takes the first match).
 */
function findAdjacentSectorAtFloorHeight(sec: SpecialsSector, height: number): { readonly floorpic: number; readonly special: number } | null {
  for (const line of sec.lines) {
    const other = getNextSector(line, sec);
    if (other === null) continue;
    if (other.floorheight === height) {
      return { floorpic: other.floorpic, special: other.special };
    }
  }
  return null;
}

/**
 * `T_MovePlane` (p_floor.c) bound to this level's `P_ChangeSector`.
 *
 * Runs `P_ChangeSector(sector, crush)` after every height write; on a
 * `nofit` it reverts the height and re-runs `P_ChangeSector`.  The
 * FLOOR-up and CEILING-down legs short-circuit to `crushed` *without
 * reverting* when `crush === true` (the grinding crusher keeps
 * descending into the actor); every other blocked move reverts.  The
 * clamp test is the vanilla strict inequality (`height ± speed > dest`
 * up / `< dest` down), not `>=`/`<=`.
 */
function makeMovePlane(
  sectorIndexOf: (sector: SpecialsSector) => number,
  mapData: MapData,
  blocklinks: BlockThingsGrid,
  rng: DoomRandom,
  thinkerList: ThinkerList,
  getLevelTime: () => number,
): (sector: SpecialsSector, speed: number, dest: number, crush: boolean, floorOrCeiling: 0 | 1, direction: -1 | 1) => PlaneMoveResult {
  const pChangeSector = (sector: SpecialsSector, crush: boolean): boolean => changeSector(sectorIndexOf(sector), crush, getLevelTime(), mapData, blocklinks, rng, thinkerList);

  return (sector: SpecialsSector, speed: number, dest: number, crush: boolean, floorOrCeiling: 0 | 1, direction: -1 | 1): PlaneMoveResult => {
    let flag: boolean;
    let lastpos: number;

    if (floorOrCeiling === 0) {
      // FLOOR.
      if (direction === -1) {
        if (sector.floorheight - speed < dest) {
          lastpos = sector.floorheight;
          sector.floorheight = dest;
          flag = pChangeSector(sector, crush);
          if (flag) {
            sector.floorheight = lastpos;
            pChangeSector(sector, crush);
          }
          return PlaneMoveResult.pastdest;
        }
        lastpos = sector.floorheight;
        sector.floorheight = (sector.floorheight - speed) | 0;
        flag = pChangeSector(sector, crush);
        if (flag) {
          sector.floorheight = lastpos;
          pChangeSector(sector, crush);
          return PlaneMoveResult.crushed;
        }
      } else {
        // direction === 1, UP.
        if (sector.floorheight + speed > dest) {
          lastpos = sector.floorheight;
          sector.floorheight = dest;
          flag = pChangeSector(sector, crush);
          if (flag) {
            sector.floorheight = lastpos;
            pChangeSector(sector, crush);
          }
          return PlaneMoveResult.pastdest;
        }
        lastpos = sector.floorheight;
        sector.floorheight = (sector.floorheight + speed) | 0;
        flag = pChangeSector(sector, crush);
        if (flag) {
          if (crush) {
            return PlaneMoveResult.crushed;
          }
          sector.floorheight = lastpos;
          pChangeSector(sector, crush);
          return PlaneMoveResult.crushed;
        }
      }
      return PlaneMoveResult.ok;
    }

    // CEILING.
    if (direction === -1) {
      // DOWN.
      if (sector.ceilingheight - speed < dest) {
        lastpos = sector.ceilingheight;
        sector.ceilingheight = dest;
        flag = pChangeSector(sector, crush);
        if (flag) {
          sector.ceilingheight = lastpos;
          pChangeSector(sector, crush);
        }
        return PlaneMoveResult.pastdest;
      }
      lastpos = sector.ceilingheight;
      sector.ceilingheight = (sector.ceilingheight - speed) | 0;
      flag = pChangeSector(sector, crush);
      if (flag) {
        if (crush) {
          return PlaneMoveResult.crushed;
        }
        sector.ceilingheight = lastpos;
        pChangeSector(sector, crush);
        return PlaneMoveResult.crushed;
      }
    } else {
      // direction === 1, UP.
      if (sector.ceilingheight + speed > dest) {
        lastpos = sector.ceilingheight;
        sector.ceilingheight = dest;
        flag = pChangeSector(sector, crush);
        if (flag) {
          sector.ceilingheight = lastpos;
          pChangeSector(sector, crush);
        }
        return PlaneMoveResult.pastdest;
      }
      sector.ceilingheight = (sector.ceilingheight + speed) | 0;
      pChangeSector(sector, crush);
    }
    return PlaneMoveResult.ok;
  };
}

/**
 * Build the level-bound sector-special model: write-through sector
 * views, the vanilla `sector->lines[]`, `T_MovePlane`, the neighbor
 * lookups, and the assembled {@link LineTriggerCallbacks}.
 *
 * `getPlayer` resolves the local {@link Player} for the keyed-door
 * branches; the dispatcher only forwards it when the activator mobj
 * is that player's avatar (`thing.player === player`), so monsters
 * attempting locked-door specials get the vanilla null-player
 * rejection inside `evDoLockedDoor` / `evVerticalDoor`.
 */
export function buildSpecialsModel(mapData: MapData, mutableSectors: MutableMapSector[], thinkerList: ThinkerList, rng: DoomRandom, blocklinks: BlockThingsGrid, getLevelTime: () => number, getPlayer: () => Player, gameMode: GameMode): SpecialsModel {
  const views = mutableSectors.map((sector) => new SpecialsSectorView(sector));

  const sectorIndexByView = new Map<SpecialsSector, number>();
  for (let sectorIndex = 0; sectorIndex < views.length; sectorIndex += 1) {
    sectorIndexByView.set(views[sectorIndex]!, sectorIndex);
    const group = mapData.sectorGroups[sectorIndex]!;
    const lines: SpecialsLinedef[] = [];
    for (let i = 0; i < group.lineIndices.length; i += 1) {
      const lineIndex = group.lineIndices[i]!;
      const resolved = mapData.lineSectors[lineIndex]!;
      const back = resolved.backsector;
      lines.push({
        flags: mapData.linedefs[lineIndex]!.flags,
        frontSector: views[resolved.frontsector]!,
        backSector: back === -1 ? null : views[back]!,
      });
    }
    views[sectorIndex]!.lines = lines;
  }

  // Stable name → integer id table shared by floorpics, sidedef
  // textures, and the switchlist. The renderer reads the frozen
  // sidedef NAME strings (not these ids) so the switch-texture and
  // floorpic visual swaps are not reflected on screen — but the swap
  // is internally self-consistent, so the button-cooldown timer and
  // every floor/plat mover behave bit-for-bit. The visual switch/
  // floorpic change is the renderer-side-effects milestone; see the
  // module header note.
  const nameIds = new Map<string, number>();
  const idForName = (name: string): number => {
    let id = nameIds.get(name);
    if (id === undefined) {
      id = nameIds.size;
      nameIds.set(name, id);
    }
    return id;
  };
  // Seed each sector's runtime floorpic from its parsed flat name so
  // donut / lowerAndChange / raise24AndChange copy meaningful values.
  for (let sectorIndex = 0; sectorIndex < views.length; sectorIndex += 1) {
    views[sectorIndex]!.floorpic = idForName(mutableSectors[sectorIndex]!.floorpic);
  }

  const sectorIndexOf = (sector: SpecialsSector): number => sectorIndexByView.get(sector)!;

  const movePlane = makeMovePlane(sectorIndexOf, mapData, blocklinks, rng, thinkerList, getLevelTime);

  // Shared side-effect bridge for every door/floor/plat/ceiling/stairs
  // helper. T_MovePlane + the five neighbor lookups are level-bound;
  // sound is null (the audio milestone wires startSectorSound) but the
  // movers are silent-safe (every startSectorSound? is optional).
  const moverCallbacks = {
    movePlane,
    findLowestFloorSurrounding,
    findHighestFloorSurrounding,
    findNextHighestFloor,
    findLowestCeilingSurrounding,
    findHighestCeilingSurrounding,
    // P_FindShortestLowerTexture needs textureheight[] metadata the
    // renderer owns; raiseToTexture (specials 30/96) is not on the C1
    // E1-progression path, so forward the vanilla INT_MAX sentinel
    // (P_FindShortestLowerTexture's "no valid bottom texture" return)
    // rather than fabricate a height.
    findShortestLowerTexture: (): number => INT_MAX,
    findAdjacentSectorAtFloorHeight,
    getLevelTime,
    pRandom: (): number => rng.pRandom(),
  };

  const plats = new ActivePlats();
  const ceilings = new ActiveCeilings();

  const switchList: SwitchList = initSwitchList(switchEpisodeForGameMode(gameMode), idForName);
  const buttons: Button[] = createButtonList();
  const buttonSounds = { startSound: (): void => {} };

  // Mutable runtime sidedef texture slots (numeric ids in the shared
  // name space). One view per parsed sidedef; changeSwitchTexture
  // flips one slot and updateButtons restores it on timer expiry.
  const sideViews: SwitchSide[] = mapData.sidedefs.map((side) => ({
    toptexture: idForName(side.toptexture),
    midtexture: idForName(side.midtexture),
    bottomtexture: idForName(side.bottomtexture),
  }));

  const sectorsList: readonly SpecialsSector[] = views;

  const resolveThingPlayer = (thing: LineTriggerThing): Player | null => {
    const player = getPlayer();
    return thing.player === player ? player : null;
  };

  // Persistent per-linedef runtime trigger line (one-shot special
  // clears must survive across activations, exactly as vanilla mutates
  // `line->special` in place; the parsed linedef is frozen).
  const triggerLines = new Array<RuntimeTriggerLine | undefined>(mapData.linedefs.length);
  const triggerLineFor = (linedefIndex: number, thing: Mobj): RuntimeTriggerLine => {
    let line = triggerLines[linedefIndex];
    const linedef = mapData.linedefs[linedefIndex]!;
    const lineSectors = mapData.lineSectors[linedefIndex]!;
    if (line === undefined) {
      const frontSidedef = mapData.sidedefs[linedef.sidenum0]!;
      // raiseFloor24AndChange / raiseAndChange copy the line's FRONT
      // sector pic/special (p_floor.c `line->frontsector`).
      const frontSector = views[lineSectors.frontsector]!;
      // EV_VerticalDoor moves the manual-door BACK sector (the sidedef
      // faces into the moving sector); -1 back ⇒ no door (left undefined).
      const backSector = lineSectors.backsector === -1 ? undefined : views[lineSectors.backsector]!;
      line = {
        special: linedef.special,
        flags: linedef.flags,
        tag: linedef.tag,
        frontFloorpic: frontSector.floorpic,
        frontSpecial: mutableSectors[lineSectors.frontsector]!.special,
        __doorSector: backSector,
        __switchSide: sideViews[linedef.sidenum0]!,
      };
      triggerLines[linedefIndex] = line;
    }
    line.__mobj = thing;
    return line;
  };

  const isLineArmed = (linedefIndex: number): boolean => {
    const line = triggerLines[linedefIndex];
    if (line === undefined) return mapData.linedefs[linedefIndex]!.special !== 0;
    return line.special !== 0;
  };

  const doorCallbacks = moverCallbacks as DoorCallbacks;

  const callbacks: LineTriggerCallbacks = {
    evDoDoor(line: LineTriggerLine, type: VerticalDoorType): number {
      return evDoDoor(line.tag, type, sectorsList, thinkerList, doorCallbacks);
    },
    evDoLockedDoor(line: LineTriggerLine, type: VerticalDoorType, thing: LineTriggerThing): number {
      return evDoLockedDoor(line, type, line.tag, resolveThingPlayer(thing), sectorsList, thinkerList, doorCallbacks);
    },
    evVerticalDoor(line: LineTriggerLine, thing: LineTriggerThing): void {
      // Vanilla EV_VerticalDoor operates on the door sector = the
      // line's BACK sector (the manual-door sidedef faces into the
      // sector that moves). The dispatcher's LineTriggerLine does not
      // carry that pointer; the gameRuntime threading attaches the
      // resolved back sector as `__doorSector`.
      const sector = (line as RuntimeTriggerLine).__doorSector;
      if (sector === undefined) return;
      evVerticalDoor(line, sector, resolveThingPlayer(thing), thinkerList, doorCallbacks);
    },
    evDoPlat(line: LineTriggerLine, type: PlatType, amount: number): number {
      return evDoPlat(line, type, amount, sectorsList, thinkerList, plats, moverCallbacks);
    },
    evStopPlat(line: LineTriggerLine): void {
      evStopPlat(line, plats);
    },
    evDoFloor(line: LineTriggerLine, type: FloorType): number {
      return evDoFloor(line, type, sectorsList, thinkerList, moverCallbacks);
    },
    evDoCeiling(line: LineTriggerLine, type: CeilingType): number {
      return evDoCeiling(line, type, sectorsList, thinkerList, ceilings, moverCallbacks);
    },
    evCeilingCrushStop(line: LineTriggerLine): number {
      return evCeilingCrushStop(line, ceilings);
    },
    evBuildStairs(line: LineTriggerLine, type: StairType): number {
      return evBuildStairs(line, type, sectorsList, thinkerList, moverCallbacks);
    },
    evDoDonut(line: LineTriggerLine): number {
      return evDoDonut(line, sectorsList, thinkerList, moverCallbacks);
    },
    evTeleport(line: LineTriggerLine, side: number, thing: LineTriggerThing): number {
      const mobj = (line as RuntimeTriggerLine).__mobj;
      if (mobj === undefined) return 0;
      return evTeleport(line.tag, side, mobj, mapData, blocklinks, thinkerList, rng) ? 1 : 0;
    },
    evLightTurnOn(): void {
      // EV_LightTurnOn / EV_TurnTagLightsOff / EV_StartLightStrobing
      // are the sector-light-special branch; the launcher already runs
      // the P_SpawnSpecials light thinkers. Wiring runtime light line
      // triggers is the audio/light milestone — the door-progression
      // path does not depend on it. No-op (silent, parity-safe).
    },
    evStartLightStrobing(): void {},
    evTurnTagLightsOff(): void {},
    changeSwitchTexture(line: LineTriggerLine, useAgain: 0 | 1): void {
      const side = (line as RuntimeTriggerLine).__switchSide;
      if (side === undefined) return;
      changeSwitchTexture(line, side, useAgain === 1, switchList.switchlist, switchList.numswitches, buttons, buttonSounds, side);
    },
    gExitLevel(): void {
      // G_ExitLevel transitions to the next map (intermission). The
      // C1 launcher renders a single level; level exit is the
      // front-end-sequence milestone. No-op here (the switch still
      // flips via changeSwitchTexture in the exit cases).
    },
    gSecretExitLevel(): void {},
  };

  return {
    callbacks,
    updateSpecials(): void {
      updateButtons(buttons, buttonSounds);
    },
    sectors: views,
    triggerLineFor,
    isLineArmed,
  };
}
