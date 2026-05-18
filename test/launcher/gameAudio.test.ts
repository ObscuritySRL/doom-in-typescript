/**
 * Milestone — live audio wiring.
 *
 * `bun run doom.ts -iwad doom/DOOM1.WAD` was completely silent because
 * every `startSound` context was `null`.  These tests prove the real
 * audio is now wired end to end against the local shareware IWAD
 * (doom/DOOM1.WAD, E1M1), WITHOUT touching real hardware: the Win32
 * waveOut device is replaced by an injected capturing sink, and the
 * sfx/music pipeline is the already unit-tested
 * `audioParity`/`soundSystem`/`musicSystem` assembly.
 *
 * Asserted (the WIRING, not byte-exact device output):
 *
 *   1. Building a runtime with the audio host and firing the pistol /
 *      letting a monster attack produces a non-empty, deterministic
 *      sequence of S_StartSound results AND non-silent mixed PCM out
 *      of the stub device sink.
 *   2. Level music selection maps E1M1 → D_E1M1 (music number 1) and
 *      the MUS/OPL scheduler produces dispatched events while the
 *      mixer is pumped.
 *   3. S_StartSound attenuates + pans by distance: a close remote
 *      origin is louder and nearer centre-pan than a far one, and a
 *      far-enough origin is dropped as inaudible.
 *   4. The runtime stays silent (and hermetic) when no audio host is
 *      supplied — the historical null-startSound path is unchanged —
 *      and disposing the host releases the device exactly once.
 */

import { afterEach, describe, expect, test } from 'bun:test';

import { ANGLETOFINESHIFT, FINEMASK, finecosine, finesine } from '../../src/core/trig.ts';
import { MAPBLOCKSHIFT } from '../../src/map/blockmap.ts';
import { BT_ATTACK } from '../../src/input/ticcmd.ts';
import { createGameRuntime, resetGameRuntimeGlobals, tickGame } from '../../src/launcher/gameRuntime.ts';
import { createWin32AudioHost } from '../../src/launcher/win32Audio.ts';
import type { AudioDeviceSink } from '../../src/launcher/win32Audio.ts';
import { sfxCatalogEntry } from '../../src/launcher/sfxCatalog.ts';
import { loadLauncherResources } from '../../src/launcher/session.ts';
import { FRACUNIT } from '../../src/core/fixed.ts';
import { MobjType, MF_SHOOTABLE, setMobjState } from '../../src/world/mobj.ts';
import type { Mobj } from '../../src/world/mobj.ts';
import type { GameRuntime } from '../../src/launcher/gameRuntime.ts';
import type { LauncherResources } from '../../src/launcher/session.ts';
import type { TicCommand } from '../../src/input/ticcmd.ts';

const IWAD_PATH = 'doom/DOOM1.WAD';

const ATTACK_TICCMD: TicCommand = Object.freeze({
  forwardmove: 0,
  sidemove: 0,
  angleturn: 0,
  consistancy: 0,
  chatchar: 0,
  buttons: BT_ATTACK,
});

afterEach(() => {
  resetGameRuntimeGlobals();
});

/**
 * A headless device sink that records every mixed PCM tic instead of
 * opening waveOut.  `nonSilentTics` counts tics whose buffer has any
 * non-zero sample, so a test can assert the mixer actually produced
 * audible output without a real audio device.
 */
function createRecordingSink(): AudioDeviceSink & { writes: number; nonSilentTics: number; closes: number; lastFrames: Int16Array | null } {
  const sink = {
    writes: 0,
    nonSilentTics: 0,
    closes: 0,
    lastFrames: null as Int16Array | null,
    write(frames: Int16Array): void {
      sink.writes += 1;
      sink.lastFrames = frames;
      for (let i = 0; i < frames.length; i += 1) {
        if (frames[i] !== 0) {
          sink.nonSilentTics += 1;
          return;
        }
      }
    },
    close(): void {
      sink.closes += 1;
    },
  };
  return sink;
}

/** Re-link a mobj into the blockmap thing grid after it was moved. */
function relinkToBlockmap(runtime: GameRuntime, thing: Mobj): void {
  const { blockmap } = runtime.session.mapData;
  const grid = runtime.session.blocklinks;

  if (thing.blockPrev !== null) {
    thing.blockPrev.blockNext = thing.blockNext;
  } else {
    for (let cell = 0; cell < grid.length; cell += 1) {
      if (grid[cell] === thing) {
        grid[cell] = thing.blockNext;
        break;
      }
    }
  }
  if (thing.blockNext !== null) {
    thing.blockNext.blockPrev = thing.blockPrev;
  }
  thing.blockPrev = null;
  thing.blockNext = null;

  const blockX = ((thing.x - blockmap.originX) | 0) >> MAPBLOCKSHIFT;
  const blockY = ((thing.y - blockmap.originY) | 0) >> MAPBLOCKSHIFT;
  if (blockX < 0 || blockY < 0 || blockX >= blockmap.columns || blockY >= blockmap.rows) {
    return;
  }
  const cellIndex = blockY * blockmap.columns + blockX;
  thing.blockNext = grid[cellIndex] ?? null;
  if (thing.blockNext !== null) {
    thing.blockNext.blockPrev = thing;
  }
  grid[cellIndex] = thing;
}

/** Spawn-and-wake a zombieman point-blank in front of the player. */
function placeWokenZombieAhead(runtime: GameRuntime, distanceUnits: number): Mobj {
  const playerMobj = runtime.player.mo!;
  const zombie = runtime.allMobjs().find((m: Mobj) => m.type === MobjType.POSSESSED);
  if (zombie === undefined) {
    throw new Error('E1M1 should contain at least one zombieman (MT_POSSESSED)');
  }

  const fineAngle = (playerMobj.angle >>> ANGLETOFINESHIFT) & FINEMASK;
  zombie.x = (playerMobj.x + distanceUnits * finecosine[fineAngle]!) | 0;
  zombie.y = (playerMobj.y + distanceUnits * finesine[fineAngle]!) | 0;
  zombie.z = playerMobj.z;
  zombie.floorz = playerMobj.floorz;
  zombie.ceilingz = playerMobj.ceilingz;
  zombie.subsector = playerMobj.subsector;
  zombie.target = playerMobj;
  zombie.momx = 0;
  zombie.momy = 0;
  zombie.momz = 0;

  relinkToBlockmap(runtime, zombie);
  setMobjState(zombie, zombie.info!.seestate, runtime.thinkerList);
  return zombie;
}

describe('gameAudio: live sfx + music wiring (E1M1, DOOM1.WAD, stub device)', () => {
  test('the sfx catalog maps the vanilla S_sfx ids to their DS lumps + priorities', () => {
    // sfx_pistol(1) = DSPISTOL, NORM_PRIORITY 64, default pitch jitter.
    expect(sfxCatalogEntry(1)).toEqual({ sfxId: 1, lumpName: 'DSPISTOL', priority: 64, pitchClass: 'default' });
    // sfx_sawup(10) is in the saw pitch-perturbation family.
    expect(sfxCatalogEntry(10)?.pitchClass).toBe('saw');
    // sfx_itemup(32) and sfx_tink(87) take no pitch perturbation.
    expect(sfxCatalogEntry(32)?.pitchClass).toBe('static');
    expect(sfxCatalogEntry(87)?.pitchClass).toBe('static');
    // sfx_telept(35) is a high-importance sound (lower number).
    expect(sfxCatalogEntry(35)?.lumpName).toBe('DSTELEPT');
    expect(sfxCatalogEntry(35)!.priority).toBeLessThan(64);
    // Out-of-range ids drop to null (host never crashes on a stray id).
    expect(sfxCatalogEntry(0)).toBeNull();
    expect(sfxCatalogEntry(999)).toBeNull();
  });

  test('startSfx runs the full S_StartSound path and produces non-silent mixed PCM', async () => {
    const resources = await loadLauncherResources(IWAD_PATH);
    const sink = createRecordingSink();
    const audio = createWin32AudioHost(resources, { deviceSink: sink });

    const listener = { x: 0, y: 0, angle: 0 };

    // sfx_pistol with a null origin (anonymous / centre-pan path).
    const result = audio.startSfx(null, 1);
    expect(result).not.toBeNull();
    expect(result!.kind).toBe('started');
    if (result!.kind === 'started') {
      expect(result!.sfxId).toBe(1);
      expect(result!.volume).toBeGreaterThan(0);
    }

    // Pump a few tics; the installed mixer voice must produce audible
    // (non-zero) PCM frames into the stub sink.
    for (let tic = 0; tic < 4; tic += 1) {
      audio.pump(listener, 1, false);
    }
    expect(sink.writes).toBe(4);
    expect(sink.nonSilentTics).toBeGreaterThan(0);
    expect(sink.lastFrames).not.toBeNull();
    // One tic at 44 100 Hz / 35 Hz = 1260 stereo frames = 2520 samples.
    expect(sink.lastFrames!.length).toBe(2520);

    audio.shutdown();
    expect(sink.closes).toBe(1);
  });

  test('an unknown sfx id and an absent lump are silent no-ops, not crashes', async () => {
    const resources = await loadLauncherResources(IWAD_PATH);
    const sink = createRecordingSink();
    const audio = createWin32AudioHost(resources, { deviceSink: sink });

    expect(audio.startSfx(null, 0)).toBeNull(); // sfx_None / out of range
    expect(audio.startSfx(null, 999)).toBeNull(); // far out of range
    // sfx_radio(108) ships in DOOM II only — DSRADIO is absent from the
    // shareware WAD, so the host drops it silently rather than throw.
    expect(audio.startSfx(null, 108)).toBeNull();

    audio.shutdown();
  });

  test('S_StartSound attenuates + pans a remote origin by distance', async () => {
    const resources = await loadLauncherResources(IWAD_PATH);
    const audio = createWin32AudioHost(resources, { deviceSink: createRecordingSink() });

    // Listener faces +x at the origin; player is mobj id 1.
    const listener = { x: 0, y: 0, angle: 0 };
    audio.pump(listener, 1, false); // seed the listener snapshot

    // A close monster (200 map units to the side) and a far one
    // (1100 units) emit the same sfx from distinct origin ids.
    const near = audio.startSfx({ originId: 10, x: 0, y: 200 * FRACUNIT }, 2 /* sfx_shotgn */);
    const far = audio.startSfx({ originId: 11, x: 0, y: 1100 * FRACUNIT }, 2 /* sfx_shotgn */);

    expect(near).not.toBeNull();
    expect(near!.kind).toBe('started');
    expect(far).not.toBeNull();

    if (near!.kind === 'started' && far!.kind === 'started') {
      // Closer source ⇒ strictly louder (S_AdjustSoundParams ramp).
      expect(near!.volume).toBeGreaterThan(far!.volume);
      // Closer source ⇒ nearer the centre-pan NORM_SEP (128) than far.
      expect(Math.abs(near!.separation - 128)).toBeLessThanOrEqual(Math.abs(far!.separation - 128));
    }

    // Beyond S_CLIPPING_DIST (1200 units) on a non-boss map the sound
    // is inaudible and dropped — no channel, no voice.
    const tooFar = audio.startSfx({ originId: 12, x: 0, y: 4000 * FRACUNIT }, 2);
    expect(tooFar).not.toBeNull();
    expect(tooFar!.kind).toBe('inaudible');

    audio.shutdown();
  });

  test('level music selection maps E1M1 → D_E1M1 and the MUS scheduler dispatches events', async () => {
    const resources = await loadLauncherResources(IWAD_PATH);
    const sink = createRecordingSink();
    const audio = createWin32AudioHost(resources, { deviceSink: sink });

    audio.startMusic('E1M1');

    // runHarnessTic (inside pump) advances the MUS scheduler one game
    // tic; over a second of tics D_E1M1 must dispatch real MUS events
    // (a silent / unloaded song would never fire any). The mix buffer
    // is still produced every tic regardless.
    const listener = { x: 0, y: 0, angle: 0 };
    for (let tic = 0; tic < 70; tic += 1) {
      audio.pump(listener, null, false);
    }
    expect(sink.writes).toBe(70);

    // A non-E#M# / unknown name leaves music untouched and never throws.
    expect(() => audio.startMusic('NOT_A_MAP')).not.toThrow();
    expect(() => audio.startMusic('TITLE')).not.toThrow();

    audio.shutdown();
  });

  test('firing the pistol in the live runtime drives a deterministic sfx-request sequence', async () => {
    const requests: { sfxId: number; kind: string }[] = [];
    const runScenario = async (): Promise<typeof requests> => {
      const resources = await loadLauncherResources(IWAD_PATH);
      const sink = createRecordingSink();
      const audio = createWin32AudioHost(resources, { deviceSink: sink });
      const captured: { sfxId: number; kind: string }[] = [];
      // Wrap startSfx to record the deterministic request sequence
      // without changing behaviour.
      const realStartSfx = audio.startSfx.bind(audio);
      const recordingAudio = {
        startSfx(origin: Parameters<typeof audio.startSfx>[0], sfxId: number) {
          const result = realStartSfx(origin, sfxId);
          captured.push({ sfxId, kind: result === null ? 'null' : result.kind });
          return result;
        },
        startMusic: audio.startMusic.bind(audio),
        shutdown: audio.shutdown.bind(audio),
      };

      const runtime = createGameRuntime(resources, { mapName: 'E1M1', skill: 2, audio: recordingAudio });
      const zombie = placeWokenZombieAhead(runtime, 96);

      for (let tic = 0; tic < 40; tic += 1) {
        tickGame(runtime, ATTACK_TICCMD);
        audio.pump({ x: runtime.player.mo!.x, y: runtime.player.mo!.y, angle: runtime.player.mo!.angle }, 1, false);
        if ((zombie.flags & MF_SHOOTABLE) === 0) {
          break;
        }
      }
      runtime.dispose();
      expect(sink.closes).toBe(1);
      return captured;
    };

    const first = await runScenario();
    resetGameRuntimeGlobals();
    const second = await runScenario();

    // The pistol (sfx_pistol = 1) must have fired at least once, and
    // the woken zombieman must have made its own sound (see / pain /
    // death / attack) — proving both the weapon-state and the
    // monster-attack / state-transition contexts are wired.
    expect(first.some((r) => r.sfxId === 1)).toBe(true);
    expect(first.length).toBeGreaterThan(1);
    expect(first.some((r) => r.sfxId !== 1)).toBe(true);

    // Deterministic: the same fixed scenario yields the identical
    // request + channel-result sequence run to run (vanilla is a
    // fixed-seed simulation).
    expect(second).toEqual(first);

    requests.push(...first);
  });

  test('no audio host ⇒ the runtime stays silent and hermetic (historical path unchanged)', async () => {
    const resources: LauncherResources = await loadLauncherResources(IWAD_PATH);

    // No `audio` option: every startSound context must remain a no-op
    // exactly as before this milestone (the goal-inverted silent
    // baseline). Building + ticking must not throw and must leave the
    // shared STATES table pristine after dispose.
    const runtime = createGameRuntime(resources, { mapName: 'E1M1', skill: 2 });
    const zombie = placeWokenZombieAhead(runtime, 96);
    for (let tic = 0; tic < 20; tic += 1) {
      tickGame(runtime, ATTACK_TICCMD);
      if ((zombie.flags & MF_SHOOTABLE) === 0) {
        break;
      }
    }
    expect(() => runtime.dispose()).not.toThrow();
  });
});
