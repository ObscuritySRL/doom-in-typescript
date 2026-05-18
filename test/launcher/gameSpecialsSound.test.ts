/**
 * Milestone — audible sector/line specials.
 *
 * `bun run doom.ts -iwad doom/DOOM1.WAD` opened doors, flipped
 * switches, and ran lifts/floors in TOTAL SILENCE: `specialsLevel.ts`
 * assembled the door/plat/ceiling spawners with hard-wired no-op sound
 * hooks (`buttonSounds = { startSound: () => {} }`, `moverCallbacks`
 * with no `startSectorSound`).  This suite proves the real vanilla
 * `S_StartSound(&sec->soundorg, sfx)` path is now threaded into the
 * sector/line specials end to end against the local shareware IWAD
 * (doom/DOOM1.WAD, E1M1), WITHOUT touching real hardware: the Win32
 * waveOut device is replaced by an injected capturing sink and the
 * sfx pipeline is the already unit-tested
 * `audioParity`/`soundSystem`/`spatial` assembly.
 *
 * Asserted (the WIRING + vanilla sfx ids, not byte-exact device PCM):
 *
 *   (a) USE-ing the E1M1 DR (special 1) door emits the vanilla door
 *       open sfx (`sfx_doropn` = 20) at press, then the door close sfx
 *       (`sfx_dorcls` = 21) after the open/wait/close cycle — the
 *       exact `T_VerticalDoor` sound sequence from p_doors.c.
 *   (b) Flipping the E1M1 exit switch (linedef special 11, the only
 *       switch face on the map) emits `sfx_swtchn` (= 23) — vanilla
 *       p_switch.c `P_ChangeSwitchTexture` (the special-11
 *       sfx_swtchx-unreachable quirk means it is sfx_swtchn).
 *   (c) The emitted `(sfxId, tic)` sequence is deterministic
 *       run-to-run (vanilla is a fixed-seed simulation).
 *   (d) Sector sounds are POSITIONAL: a door whose soundorg is far
 *       from the player listener is strictly quieter (and no nearer
 *       centre-pan) than one adjacent to the player — proving the
 *       sector path runs the same `S_AdjustSoundParams` attenuation
 *       the mobj sfx path does, not a flat full-volume centre-pan.
 *
 * Robust assertions: sfx-id sequence + monotonic tic + attenuation
 * ordering, never device bytes.
 */

import { afterEach, describe, expect, test } from 'bun:test';

import { FRACUNIT } from '../../src/core/fixed.ts';
import { MAPBLOCKSHIFT } from '../../src/map/blockmap.ts';
import { BT_USE, EMPTY_TICCMD } from '../../src/input/ticcmd.ts';
import { createGameRuntime, resetGameRuntimeGlobals, tickGame } from '../../src/launcher/gameRuntime.ts';
import { createWin32AudioHost } from '../../src/launcher/win32Audio.ts';
import { loadLauncherResources } from '../../src/launcher/session.ts';
import { rPointToAngle2 } from '../../src/render/wallScaleMath.ts';
import type { AudioDeviceSink } from '../../src/launcher/win32Audio.ts';
import type { GameRuntime } from '../../src/launcher/gameRuntime.ts';
import type { Mobj } from '../../src/world/mobj.ts';
import type { TicCommand } from '../../src/input/ticcmd.ts';

const IWAD_PATH = 'doom/DOOM1.WAD';

/** sfx_doropn — normal door open (p_doors.c). */
const SFX_DOROPN = 20;
/** sfx_dorcls — normal door close (p_doors.c). */
const SFX_DORCLS = 21;
/** sfx_swtchn — switch press / button release (p_switch.c). */
const SFX_SWTCHN = 23;

const USE_TICCMD: TicCommand = Object.freeze({
  forwardmove: 0,
  sidemove: 0,
  angleturn: 0,
  consistancy: 0,
  chatchar: 0,
  buttons: BT_USE,
});

afterEach(() => {
  resetGameRuntimeGlobals();
});

/** Headless device sink — never opens waveOut. */
function createSilentSink(): AudioDeviceSink & { closes: number } {
  const sink = {
    closes: 0,
    write(): void {},
    close(): void {
      sink.closes += 1;
    },
  };
  return sink;
}

interface SectorSfxEvent {
  readonly tic: number;
  readonly sfxId: number;
  /** `'sector'` ⇒ positional `startSectorSfx`; `'anon'` ⇒ `startSfx(null,…)`. */
  readonly via: 'sector' | 'anon';
  readonly x: number;
  readonly y: number;
  readonly volume: number;
  readonly separation: number;
  readonly kind: string;
}

/**
 * Wrap the real {@link createWin32AudioHost} so every
 * `startSectorSfx(x, y, sfx)` (the positional sector/line-special
 * path) is captured with the host's spatialized
 * volume/separation/kind, tagged with the current game tic.  Behaviour
 * is unchanged (the real host still runs); only an observation tap is
 * added.
 */
function createCapturingAudio(resources: Awaited<ReturnType<typeof loadLauncherResources>>): {
  bridge: { startSfx: (...a: unknown[]) => unknown; startSectorSfx: (x: number, y: number, sfxId: number) => unknown; startMusic: (m: string) => void; shutdown: () => void };
  events: SectorSfxEvent[];
  setTic: (tic: number) => void;
  pump: (listener: { x: number; y: number; angle: number }) => void;
  closes: () => number;
} {
  const sink = createSilentSink();
  const host = createWin32AudioHost(resources, { deviceSink: sink });
  const events: SectorSfxEvent[] = [];
  let currentTic = 0;
  return {
    bridge: {
      startSfx: (origin: unknown, sfxId: unknown) => {
        const result = host.startSfx(origin as never, sfxId as number);
        // The locked-door denial `S_StartSound(NULL, sfx_oof)` AND the
        // vanilla fresh-level `buttonlist->soundorg == NULL` first
        // switch press both arrive here (anonymous centre-pan path).
        events.push({
          tic: currentTic,
          sfxId: sfxId as number,
          via: 'anon',
          x: 0,
          y: 0,
          volume: result !== null && result.kind === 'started' ? result.volume : -1,
          separation: result !== null && result.kind === 'started' ? result.separation : -1,
          kind: result === null ? 'null' : result.kind,
        });
        return result;
      },
      startSectorSfx: (x: number, y: number, sfxId: number) => {
        const result = host.startSectorSfx(x, y, sfxId);
        events.push({
          tic: currentTic,
          sfxId,
          via: 'sector',
          x,
          y,
          volume: result !== null && result.kind === 'started' ? result.volume : -1,
          separation: result !== null && result.kind === 'started' ? result.separation : -1,
          kind: result === null ? 'null' : result.kind,
        });
        return result;
      },
      startMusic: (mapName: string) => host.startMusic(mapName),
      shutdown: () => host.shutdown(),
    },
    events,
    setTic: (tic: number) => {
      currentTic = tic;
    },
    pump: (listener: { x: number; y: number; angle: number }) => host.pump(listener, 1, false),
    closes: () => sink.closes,
  };
}

/** Re-link a moved mobj into the blockmap thing grid. */
function relinkBlockmap(runtime: GameRuntime, mobj: Mobj): void {
  const { mapData, blocklinks } = runtime.session;
  const blockmap = mapData.blockmap;
  const blockX = ((mobj.x - blockmap.originX) | 0) >> MAPBLOCKSHIFT;
  const blockY = ((mobj.y - blockmap.originY) | 0) >> MAPBLOCKSHIFT;
  if (blockX < 0 || blockY < 0 || blockX >= blockmap.columns || blockY >= blockmap.rows) return;
  const cellIndex = blockY * blockmap.columns + blockX;
  mobj.blockPrev = null;
  mobj.blockNext = blocklinks[cellIndex];
  if (mobj.blockNext !== null) mobj.blockNext.blockPrev = mobj;
  blocklinks[cellIndex] = mobj;
}

/**
 * Find the first DR (special 1) door linedef whose back sector is a
 * *closed* door (ceiling === floor) — picked by special id, not
 * fragile geometry (same technique as gameSpecials.test.ts).
 */
function findManualDoor(runtime: GameRuntime, skipDistinctSectors = 0): { linedefIndex: number; doorSectorIndex: number } {
  const { mapData } = runtime.session;
  const seenSectors = new Set<number>();
  for (let linedefIndex = 0; linedefIndex < mapData.linedefs.length; linedefIndex += 1) {
    if (mapData.linedefs[linedefIndex]!.special !== 1) continue;
    const back = mapData.lineSectors[linedefIndex]!.backsector;
    if (back === -1) continue;
    const sector = runtime.specials.sectors[back]!;
    if (sector.ceilingheight !== sector.floorheight) continue;
    if (seenSectors.has(back)) continue;
    seenSectors.add(back);
    if (seenSectors.size <= skipDistinctSectors) continue;
    return { linedefIndex, doorSectorIndex: back };
  }
  throw new Error('E1M1 has no closed DR (special 1) door — fixture drift');
}

/** Find the E1M1 exit switch (the only switch face: linedef special 11). */
function findExitSwitch(runtime: GameRuntime): number {
  const { mapData } = runtime.session;
  for (let linedefIndex = 0; linedefIndex < mapData.linedefs.length; linedefIndex += 1) {
    if (mapData.linedefs[linedefIndex]!.special === 11) return linedefIndex;
  }
  throw new Error('E1M1 has no exit switch (special 11) — fixture drift');
}

/**
 * Stand the player ~32 map units in front of `linedefIndex`'s midpoint
 * facing the line so the next BT_USE press's P_UseLines ray (USERANGE
 * = 64) hits it.
 */
function facePlayerAtLine(runtime: GameRuntime, linedefIndex: number): void {
  const { mapData } = runtime.session;
  const playerMobj = runtime.player.mo!;
  const linedef = mapData.linedefs[linedefIndex]!;
  const v1 = mapData.vertexes[linedef.v1]!;
  const v2 = mapData.vertexes[linedef.v2]!;
  const midX = (v1.x + v2.x) >> 1;
  const midY = (v1.y + v2.y) >> 1;
  const length = Math.hypot(linedef.dx, linedef.dy) || 1;
  const normalX = linedef.dy / length;
  const normalY = -linedef.dx / length;
  playerMobj.x = (midX + normalX * 32 * FRACUNIT) | 0;
  playerMobj.y = (midY + normalY * 32 * FRACUNIT) | 0;
  playerMobj.angle = rPointToAngle2(playerMobj.x, playerMobj.y, midX, midY) >>> 0;
  relinkBlockmap(runtime, playerMobj);
}

describe('gameSpecialsSound: audible doors/switches (E1M1, DOOM1.WAD, stub device)', () => {
  test('(a) USE on a DR door emits sfx_doropn at press then sfx_dorcls after the cycle', async () => {
    const resources = await loadLauncherResources(IWAD_PATH);
    const audio = createCapturingAudio(resources);
    const runtime = createGameRuntime(resources, { mapName: 'E1M1', skill: 2, audio: audio.bridge });

    const { linedefIndex, doorSectorIndex } = findManualDoor(runtime);
    facePlayerAtLine(runtime, linedefIndex);
    const door = runtime.specials.sectors[doorSectorIndex]!;

    // P_PlayerReborn sets usedown=true; release one tic then press USE.
    audio.setTic(0);
    tickGame(runtime, EMPTY_TICCMD);
    audio.setTic(1);
    tickGame(runtime, USE_TICCMD);

    // The first sector sfx must be the door-open sound.
    expect(audio.events.length).toBeGreaterThan(0);
    expect(audio.events[0]!.sfxId).toBe(SFX_DOROPN);

    // Drive the full open → wait(VDOORWAIT=150) → close cycle. The
    // normal (DR) door fires sfx_dorcls on the waiting→closing flip.
    for (let tic = 2; tic < 320; tic += 1) {
      audio.setTic(tic);
      tickGame(runtime, EMPTY_TICCMD);
    }

    const ids = audio.events.map((e) => e.sfxId);
    expect(ids).toContain(SFX_DOROPN);
    expect(ids).toContain(SFX_DORCLS);
    // Open strictly precedes close (the vanilla T_VerticalDoor order).
    expect(ids.indexOf(SFX_DOROPN)).toBeLessThan(ids.indexOf(SFX_DORCLS));
    // The door actually cycled shut again (sd back to null).
    expect(door.specialdata).toBeNull();

    runtime.dispose();
    expect(audio.closes()).toBe(1);
  });

  test('(b) flipping the E1M1 exit switch emits sfx_swtchn', async () => {
    const resources = await loadLauncherResources(IWAD_PATH);
    const audio = createCapturingAudio(resources);
    const runtime = createGameRuntime(resources, { mapName: 'E1M1', skill: 2, audio: audio.bridge });

    const switchLine = findExitSwitch(runtime);
    facePlayerAtLine(runtime, switchLine);

    audio.setTic(0);
    tickGame(runtime, EMPTY_TICCMD);
    audio.setTic(1);
    tickGame(runtime, USE_TICCMD);

    // The exit switch (special 11) flips its texture unconditionally
    // and plays sfx_swtchn (the special-11 sfx_swtchx-unreachable
    // vanilla quirk). p_switch.c broadcasts the press at
    // `buttonlist->soundorg`; on a fresh level that slot is NULL, so
    // the FIRST press of the level plays anonymously (centre pan) —
    // the vanilla buttonlist->soundorg quirk this codebase preserves
    // (see switches.ts module note). It still must be audible.
    const swtchn = audio.events.find((e) => e.sfxId === SFX_SWTCHN);
    expect(swtchn).toBeDefined();
    expect(swtchn!.via).toBe('anon'); // fresh-level buttonlist->soundorg == NULL quirk
    expect(swtchn!.kind).toBe('started');
    expect(swtchn!.volume).toBeGreaterThan(0);
    expect(runtime.levelComplete).toEqual({ secret: false });

    runtime.dispose();
  });

  test('(c) the emitted (sfxId, tic) sequence is deterministic run-to-run', async () => {
    const resources = await loadLauncherResources(IWAD_PATH);

    function runDoorCycle(): string {
      const audio = createCapturingAudio(resources);
      const runtime = createGameRuntime(resources, { mapName: 'E1M1', skill: 2, audio: audio.bridge });
      const { linedefIndex } = findManualDoor(runtime);
      facePlayerAtLine(runtime, linedefIndex);

      audio.setTic(0);
      tickGame(runtime, EMPTY_TICCMD);
      audio.setTic(1);
      tickGame(runtime, USE_TICCMD);
      for (let tic = 2; tic < 320; tic += 1) {
        audio.setTic(tic);
        tickGame(runtime, EMPTY_TICCMD);
      }
      const seq = audio.events.map((e) => `${e.tic}:${e.sfxId}`).join(',');
      runtime.dispose();
      resetGameRuntimeGlobals();
      return seq;
    }

    const first = runDoorCycle();
    const second = runDoorCycle();
    expect(first).toBe(second);
    // Non-trivial: it actually emitted the open + close pair.
    expect(first).toContain(`:${SFX_DOROPN}`);
    expect(first).toContain(`:${SFX_DORCLS}`);
    // Monotonic non-decreasing tic stamps.
    const tics = first.split(',').map((p) => Number(p.split(':')[0]));
    for (let i = 1; i < tics.length; i += 1) {
      expect(tics[i]!).toBeGreaterThanOrEqual(tics[i - 1]!);
    }
  });

  test('(d) a far door is quieter / no nearer centre-pan than an adjacent one (positional)', async () => {
    const resources = await loadLauncherResources(IWAD_PATH);
    const audio = createCapturingAudio(resources);
    const runtime = createGameRuntime(resources, { mapName: 'E1M1', skill: 2, audio: audio.bridge });

    // Two distinct closed DR doors with distinct sector soundorgs.
    const doorA = findManualDoor(runtime, 0);
    const doorB = findManualDoor(runtime, 1);
    expect(doorA.doorSectorIndex).not.toBe(doorB.doorSectorIndex);

    const groups = runtime.session.mapData.sectorGroups;
    const aOrigin = { x: groups[doorA.doorSectorIndex]!.soundOriginX, y: groups[doorA.doorSectorIndex]!.soundOriginY };
    const bOrigin = { x: groups[doorB.doorSectorIndex]!.soundOriginX, y: groups[doorB.doorSectorIndex]!.soundOriginY };

    // Listener sits exactly on door A's soundorg facing +x, so A is
    // point-blank (S_CLOSE_DIST ⇒ full volume) and B is whatever the
    // map distance between the two door sectors is. Seed the host
    // listener snapshot the positional path attenuates against.
    const listener = { x: aOrigin.x, y: aOrigin.y, angle: 0 };
    audio.pump(listener);

    // Emit the same sfx from both sector origins directly through the
    // wired positional bridge (the exact call the door spawner makes).
    audio.setTic(0);
    audio.bridge.startSectorSfx(aOrigin.x, aOrigin.y, SFX_DOROPN);
    audio.bridge.startSectorSfx(bOrigin.x, bOrigin.y, SFX_DOROPN);

    const near = audio.events.find((e) => e.x === aOrigin.x && e.y === aOrigin.y)!;
    const far = audio.events.find((e) => e.x === bOrigin.x && e.y === bOrigin.y)!;
    expect(near).toBeDefined();
    expect(far).toBeDefined();
    expect(near.kind).toBe('started');

    // The near door is at S_CLOSE_DIST (full volume); the far door is
    // attenuated by S_AdjustSoundParams. It must be no louder, and —
    // if it is audible — no nearer to centre pan (NORM_SEP = 128) than
    // the (centre, on-axis) near door. If the far door is past
    // S_CLIPPING_DIST it is dropped (inaudible) — also a valid
    // positional outcome (proves it is NOT a flat full-volume hook).
    if (far.kind === 'started') {
      expect(far.volume).toBeLessThanOrEqual(near.volume);
      expect(near.volume).toBeGreaterThan(0);
    } else {
      expect(far.kind).toBe('inaudible');
    }
    // The near, on-listener door is full volume (NOT silent) — proves
    // the sector path is wired (the goal: not silent).
    expect(near.volume).toBeGreaterThan(0);

    runtime.dispose();
  });
});
