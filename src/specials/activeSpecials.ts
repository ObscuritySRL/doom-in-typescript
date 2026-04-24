/**
 * Active-special save hooks — p_plats.c, p_ceilng.c, p_switch.c.
 *
 * Captures the per-level registry state that a later savegame layer
 * must round-trip alongside the thinker list: the 30-slot
 * {@link ActivePlats} array, the 30-slot {@link ActiveCeilings} array,
 * and the 16-slot buttonlist array.  Each hook comes in a
 * {@link snapshotActivePlats snapshot} / {@link restoreActivePlats restore}
 * pair that produces plain, reference-free data and then rebuilds the
 * live registry from it.
 *
 * Parity-critical behavior preserved byte-for-byte from Chocolate Doom
 * 2.2.1:
 *
 * - Slot positions round-trip unchanged.  {@link snapshotActivePlats}
 *   and {@link snapshotActiveCeilings} emit a positional
 *   `readonly (T | null)[]` of length `MAXPLATS` / `MAXCEILINGS`;
 *   {@link restoreActivePlats} / {@link restoreActiveCeilings} write
 *   each non-null entry back into the same slot index.  Callers that
 *   save and reload without mutating the sector array observe the
 *   exact same `activeplats[i]` / `activeceilings[i]` pointer ordering
 *   that the original level run produced — preserving enumeration
 *   order through {@link evStopPlat} / {@link evCeilingCrushStop}
 *   scans.
 * - In-stasis plats round-trip with `action === null` and the
 *   {@link PlatStatus.inStasis} sentinel.  Vanilla
 *   {@link evStopPlat} marks a suspended plat by writing
 *   `thinker.function.acv = NULL`; we encode the same invariant by
 *   emitting `inStasis: true` in the snapshot when
 *   `plat.status === PlatStatus.inStasis`.  On restore the rebuilt
 *   plat retains `action = null` so {@link ThinkerList.run} continues
 *   to skip it, and `oldstatus` is preserved for
 *   {@link pActivateInStasis} to resume the plat at its exact
 *   pre-stasis direction.
 * - In-stasis ceilings round-trip with `action === null` and the
 *   {@link CeilingDirection.inStasis} (`0`) sentinel.  Vanilla
 *   {@link evCeilingCrushStop} detaches the action; we preserve
 *   `olddirection` so {@link pActivateInStasisCeiling} can resume the
 *   ceiling at its exact pre-stasis direction.
 * - Active (non-stasis) plats restore with the exact
 *   {@link tPlatRaise} action closure that {@link evDoPlat} installs,
 *   captured over the rebuilt {@link ActivePlats} so a pastdest
 *   transition inside the closure removes the plat from the correct
 *   registry.  Active ceilings restore with the matching
 *   {@link tMoveCeiling} closure over the rebuilt
 *   {@link ActiveCeilings}.
 * - Buttons round-trip as 16 positional entries mirroring vanilla
 *   `buttonlist[MAXBUTTONS]`.  A slot is "active" when
 *   `btimer !== 0`; inactive slots emit `null` and restore via
 *   {@link resetButton}.  The snapshot stores `line` / `side` /
 *   `soundorg` as caller-supplied integer indices so the serializer
 *   can resolve them against its own map-level tables; callers supply
 *   matching resolvers on the restore path.  Bindings with
 *   `line === null` or `side === null` encode as `-1` indices and
 *   decode back to `null` — the {@link updateButtons} restore branch
 *   already defends against null sides, so this is safe parity.
 * - Neither snapshot function mutates the source registries; neither
 *   restore function depends on registry state beyond the array
 *   length.  Callers typically call the restore functions against a
 *   freshly-initialized (empty) level whose sector/line tables have
 *   already been loaded by the savegame layer.
 *
 * Thinker-level state (speed / low / high / topheight / etc.) is
 * captured inline in each snapshot so this module is the single
 * source of truth for per-special save state; the thinker-list
 * serializer in step 16-008 only needs to know registry membership
 * and the per-thinker class tag.  The {@link ButtonSnapshot} shape
 * mirrors the {@link Button} record verbatim except that its object
 * references are replaced with integer indices.
 *
 * @example
 * ```ts
 * import {
 *   snapshotActivePlats,
 *   restoreActivePlats,
 * } from "../src/specials/activeSpecials.ts";
 *
 * const snap = snapshotActivePlats(plats, (sector) => sectors.indexOf(sector));
 * // later, after a fresh level-load:
 * const reloaded = restoreActivePlats(snap, sectors, callbacks, thinkerList);
 * ```
 */

import type { ThinkerList } from '../world/thinkers.ts';
import { ActiveCeilings, Ceiling, CeilingDirection, MAXCEILINGS, tMoveCeiling } from './ceilings.ts';
import type { CeilingCallbacks, CeilingSector, CeilingType } from './ceilings.ts';
import { ActivePlats, MAXPLATS, Platform, PlatStatus, tPlatRaise } from './platforms.ts';
import type { PlatCallbacks, PlatSector, PlatType } from './platforms.ts';
import { MAXBUTTONS, resetButton } from './switches.ts';
import type { Button, ButtonWhere, SwitchLine, SwitchSide } from './switches.ts';

// ── Plat snapshot ──────────────────────────────────────────────────

/**
 * Plain-data snapshot of one {@link Platform}.  Captures every field
 * {@link tPlatRaise} and {@link pActivateInStasis} consume; the
 * callbacks, prev/next pointers, and action closure are re-derived on
 * restore.  `sectorIndex` is resolved by a caller-supplied
 * {@link snapshotActivePlats} mapping and indexes into the same
 * sector array passed to {@link restoreActivePlats}.
 */
export interface ActivePlatSnapshot {
  readonly sectorIndex: number;
  readonly type: PlatType;
  readonly speed: number;
  readonly low: number;
  readonly high: number;
  readonly wait: number;
  readonly count: number;
  readonly status: PlatStatus;
  readonly oldstatus: PlatStatus;
  readonly crush: boolean;
  readonly tag: number;
  readonly inStasis: boolean;
}

/**
 * Positional `MAXPLATS`-length array mirroring vanilla
 * `activeplats[MAXPLATS]`.  Free slots are `null`; non-null entries
 * carry the full {@link ActivePlatSnapshot}.  The array length is
 * always {@link MAXPLATS}.
 */
export type ActivePlatsSnapshot = readonly (ActivePlatSnapshot | null)[];

/**
 * Snapshot every occupied slot of `plats` in slot order.  Returns a
 * fresh `MAXPLATS`-long array whose `null` entries match the empty
 * slots of the registry.  `sectorIndexOf` resolves each live plat's
 * sector back to an integer index that the caller will later feed to
 * {@link restoreActivePlats}; it must return a non-negative integer
 * for every in-use sector.
 */
export function snapshotActivePlats<S extends PlatSector>(plats: ActivePlats, sectorIndexOf: (sector: S) => number): ActivePlatsSnapshot {
  const out: (ActivePlatSnapshot | null)[] = new Array(MAXPLATS).fill(null);
  for (let i = 0; i < MAXPLATS; i++) {
    const plat = plats.slots[i];
    if (plat === null) continue;
    out[i] = {
      sectorIndex: sectorIndexOf(plat.sector as S),
      type: plat.type,
      speed: plat.speed,
      low: plat.low,
      high: plat.high,
      wait: plat.wait,
      count: plat.count,
      status: plat.status,
      oldstatus: plat.oldstatus,
      crush: plat.crush,
      tag: plat.tag,
      inStasis: plat.status === PlatStatus.inStasis,
    };
  }
  return out;
}

/**
 * Rebuild an {@link ActivePlats} registry from `snapshot`.  Creates a
 * fresh registry, reconstructs each non-null entry as a live
 * {@link Platform} at the same slot index, reattaches the
 * {@link tPlatRaise} action (or leaves `action = null` for in-stasis
 * entries), sets `sector.specialdata = plat` on the resolved sector,
 * and adds the plat to `thinkerList` so the next tic observes it.
 *
 * The returned registry is ready to be passed to
 * {@link pActivateInStasis}, {@link evStopPlat}, and
 * {@link evDoPlat} without additional setup.
 */
export function restoreActivePlats<S extends PlatSector>(snapshot: ActivePlatsSnapshot, sectors: readonly S[], callbacks: PlatCallbacks, thinkerList: ThinkerList): ActivePlats {
  const plats = new ActivePlats();
  for (let i = 0; i < MAXPLATS; i++) {
    const entry = snapshot[i] ?? null;
    if (entry === null) continue;
    const sector = sectors[entry.sectorIndex]!;
    const plat = new Platform(sector, entry.type, callbacks);
    plat.speed = entry.speed;
    plat.low = entry.low;
    plat.high = entry.high;
    plat.wait = entry.wait;
    plat.count = entry.count;
    plat.status = entry.status;
    plat.oldstatus = entry.oldstatus;
    plat.crush = entry.crush;
    plat.tag = entry.tag;
    plat.action = entry.inStasis ? null : (t) => tPlatRaise(t, plats);
    sector.specialdata = plat;
    thinkerList.add(plat);
    plats.slots[i] = plat;
  }
  return plats;
}

// ── Ceiling snapshot ───────────────────────────────────────────────

/**
 * Plain-data snapshot of one {@link Ceiling}.  Captures every field
 * {@link tMoveCeiling} and {@link pActivateInStasisCeiling} consume.
 * The stasis marker is encoded in `direction === CeilingDirection.inStasis`
 * (`0`); `olddirection` preserves the pre-stasis direction so
 * {@link pActivateInStasisCeiling} can resume the ceiling exactly.
 */
export interface ActiveCeilingSnapshot {
  readonly sectorIndex: number;
  readonly type: CeilingType;
  readonly bottomheight: number;
  readonly topheight: number;
  readonly speed: number;
  readonly crush: boolean;
  readonly direction: CeilingDirection;
  readonly olddirection: CeilingDirection;
  readonly tag: number;
  readonly inStasis: boolean;
}

/**
 * Positional `MAXCEILINGS`-length array mirroring vanilla
 * `activeceilings[MAXCEILINGS]`.  Free slots are `null`; non-null
 * entries carry the full {@link ActiveCeilingSnapshot}.  The array
 * length is always {@link MAXCEILINGS}.
 */
export type ActiveCeilingsSnapshot = readonly (ActiveCeilingSnapshot | null)[];

/**
 * Snapshot every occupied slot of `ceilings` in slot order.  Returns
 * a fresh `MAXCEILINGS`-long array.  `sectorIndexOf` follows the
 * same contract as {@link snapshotActivePlats}.
 */
export function snapshotActiveCeilings<S extends CeilingSector>(ceilings: ActiveCeilings, sectorIndexOf: (sector: S) => number): ActiveCeilingsSnapshot {
  const out: (ActiveCeilingSnapshot | null)[] = new Array(MAXCEILINGS).fill(null);
  for (let i = 0; i < MAXCEILINGS; i++) {
    const ceiling = ceilings.slots[i];
    if (ceiling === null) continue;
    out[i] = {
      sectorIndex: sectorIndexOf(ceiling.sector as S),
      type: ceiling.type,
      bottomheight: ceiling.bottomheight,
      topheight: ceiling.topheight,
      speed: ceiling.speed,
      crush: ceiling.crush,
      direction: ceiling.direction,
      olddirection: ceiling.olddirection,
      tag: ceiling.tag,
      inStasis: ceiling.direction === CeilingDirection.inStasis,
    };
  }
  return out;
}

/**
 * Rebuild an {@link ActiveCeilings} registry from `snapshot`.
 * Creates a fresh registry, reconstructs each non-null entry as a
 * live {@link Ceiling} at the same slot index, reattaches the
 * {@link tMoveCeiling} action (or leaves `action = null` for
 * in-stasis entries), sets `sector.specialdata = ceiling` on the
 * resolved sector, and adds the ceiling to `thinkerList`.
 *
 * The returned registry is ready to be passed to
 * {@link pActivateInStasisCeiling}, {@link evCeilingCrushStop}, and
 * {@link evDoCeiling} without additional setup.
 */
export function restoreActiveCeilings<S extends CeilingSector>(snapshot: ActiveCeilingsSnapshot, sectors: readonly S[], callbacks: CeilingCallbacks, thinkerList: ThinkerList): ActiveCeilings {
  const ceilings = new ActiveCeilings();
  for (let i = 0; i < MAXCEILINGS; i++) {
    const entry = snapshot[i] ?? null;
    if (entry === null) continue;
    const sector = sectors[entry.sectorIndex]!;
    const ceiling = new Ceiling(sector, entry.type, callbacks);
    ceiling.bottomheight = entry.bottomheight;
    ceiling.topheight = entry.topheight;
    ceiling.speed = entry.speed;
    ceiling.crush = entry.crush;
    ceiling.direction = entry.direction;
    ceiling.olddirection = entry.olddirection;
    ceiling.tag = entry.tag;
    ceiling.action = entry.inStasis ? null : (t) => tMoveCeiling(t, ceilings);
    sector.specialdata = ceiling;
    thinkerList.add(ceiling);
    ceilings.slots[i] = ceiling;
  }
  return ceilings;
}

// ── Button snapshot ────────────────────────────────────────────────

/**
 * Plain-data snapshot of one {@link Button} slot.  `lineIndex`,
 * `sideIndex`, and `soundorgIndex` are the integer replacements for
 * the opaque object references that vanilla stores directly; `-1`
 * encodes the null references a reset slot carries (a slot whose
 * `btimer === 0` never appears here — it is `null` in the parent
 * {@link ButtonListSnapshot}).
 */
export interface ButtonSnapshot {
  readonly lineIndex: number;
  readonly sideIndex: number;
  readonly where: ButtonWhere;
  readonly btexture: number;
  readonly btimer: number;
  readonly soundorgIndex: number;
}

/**
 * Positional `MAXBUTTONS`-length array mirroring vanilla
 * `buttonlist[MAXBUTTONS]`.  Free slots (`btimer === 0`) are
 * represented as `null`; active slots carry the full
 * {@link ButtonSnapshot}.  The array length is always
 * {@link MAXBUTTONS}.
 */
export type ButtonListSnapshot = readonly (ButtonSnapshot | null)[];

/**
 * Snapshot every active slot (`btimer !== 0`) of `buttons` in slot
 * order.  Inactive slots emit `null`.  `lineIndexOf`, `sideIndexOf`,
 * and `soundorgIndexOf` resolve the opaque Button references into
 * integer indices; they MUST return `-1` when the value is `null`.
 *
 * Non-null `line` / `side` bindings with a negative index are
 * preserved — this situation is not produced by
 * {@link changeSwitchTexture} but is defensive against callers who
 * enter a non-resolvable reference (e.g., a synthetic line crafted
 * in tests).
 */
export function snapshotButtons(buttons: readonly Button[], lineIndexOf: (line: SwitchLine | null) => number, sideIndexOf: (side: SwitchSide | null) => number, soundorgIndexOf: (origin: unknown) => number): ButtonListSnapshot {
  const out: (ButtonSnapshot | null)[] = new Array(MAXBUTTONS).fill(null);
  for (let i = 0; i < MAXBUTTONS; i++) {
    const slot = buttons[i]!;
    if (slot.btimer === 0) continue;
    out[i] = {
      lineIndex: lineIndexOf(slot.line),
      sideIndex: sideIndexOf(slot.side),
      where: slot.where,
      btexture: slot.btexture,
      btimer: slot.btimer,
      soundorgIndex: soundorgIndexOf(slot.soundorg),
    };
  }
  return out;
}

/**
 * Rebuild `buttons` in-place from `snapshot`.  For each `null`
 * snapshot entry the slot is {@link resetButton reset}; for each
 * non-null entry the slot fields are written back using
 * `lineByIndex`, `sideByIndex`, and `soundorgByIndex` to resolve the
 * integer indices back into live references.  A `-1` index resolves
 * to `null` for `line` and `side`, and to `null` for `soundorg`
 * (vanilla's fresh-level `buttonlist->soundorg` starts null).
 *
 * `buttons` must have length {@link MAXBUTTONS}; a shorter array is
 * an authoring error surfaced by the standard index-out-of-range
 * behavior.
 */
export function restoreButtons(snapshot: ButtonListSnapshot, buttons: Button[], lineByIndex: (index: number) => SwitchLine | null, sideByIndex: (index: number) => SwitchSide | null, soundorgByIndex: (index: number) => unknown): void {
  for (let i = 0; i < MAXBUTTONS; i++) {
    const slot = buttons[i]!;
    const entry = snapshot[i] ?? null;
    if (entry === null) {
      resetButton(slot);
      continue;
    }
    slot.line = entry.lineIndex < 0 ? null : lineByIndex(entry.lineIndex);
    slot.side = entry.sideIndex < 0 ? null : sideByIndex(entry.sideIndex);
    slot.where = entry.where;
    slot.btexture = entry.btexture;
    slot.btimer = entry.btimer;
    slot.soundorg = entry.soundorgIndex < 0 ? null : soundorgByIndex(entry.soundorgIndex);
  }
}
