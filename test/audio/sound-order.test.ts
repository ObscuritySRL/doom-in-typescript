import { describe, expect, it } from 'bun:test';

import { ANG90 } from '../../src/core/angle.ts';
import { FRACUNIT } from '../../src/core/fixed.ts';
import { DoomRandom, RNG_TABLE } from '../../src/core/rng.ts';
import { NORM_PITCH, NORM_PRIORITY, allocateChannel, createChannelTable } from '../../src/audio/channels.ts';
import type { ChannelTable } from '../../src/audio/channels.ts';
import { MAX_STEREO_SEP, MIN_STEREO_SEP, NORM_SEP, S_CLIPPING_DIST, S_CLOSE_DIST, adjustSoundParams } from '../../src/audio/spatial.ts';
import { NUMSFX, PITCH_CLAMP_MAX, PITCH_CLAMP_MIN, SFX_ID_MAX, SFX_ID_MIN, START_SOUND_LINK_MIN_VOLUME, startSound } from '../../src/audio/soundSystem.ts';
import type { StartSoundRequest, StartSoundResult } from '../../src/audio/soundSystem.ts';

const SFX_PISTOL = 1;
const SFX_SAWUP = 10;
const SFX_SAWHIT = 13;
const SFX_ITEMUP = 32;
const SFX_TINK = 87;
const SFX_DOOR = 70;

const PLAYER_ORIGIN = 1;
const IMP_ORIGIN = 42;
const LOST_SOUL_ORIGIN = 43;

const HANDLE_PREALLOCATED = 0x77;

const LISTENER_AT_ORIGIN = { x: 0, y: 0, angle: 0 };
const SFX_VOLUME_FULL = 15;

function baseRequest(table: ChannelTable, overrides: Partial<StartSoundRequest> = {}): StartSoundRequest {
  return {
    sfxId: overrides.sfxId ?? SFX_PISTOL,
    priority: overrides.priority ?? NORM_PRIORITY,
    pitchClass: overrides.pitchClass ?? 'default',
    origin: overrides.origin ?? null,
    sourcePosition: overrides.sourcePosition ?? null,
    listener: overrides.listener ?? LISTENER_AT_ORIGIN,
    listenerOrigin: overrides.listenerOrigin ?? PLAYER_ORIGIN,
    sfxVolume: overrides.sfxVolume ?? SFX_VOLUME_FULL,
    isBossMap: overrides.isBossMap ?? false,
    linkVolumeAdjust: overrides.linkVolumeAdjust ?? null,
    linkPitch: overrides.linkPitch ?? null,
    rng: overrides.rng ?? new DoomRandom(),
    table,
  };
}

function assertStarted(result: StartSoundResult): asserts result is Extract<StartSoundResult, { kind: 'started' }> {
  if (result.kind !== 'started') {
    throw new Error(`expected started result, got ${result.kind}`);
  }
}

describe('soundSystem constants', () => {
  it('NUMSFX matches vanilla sounds.h terminator value (109)', () => {
    expect(NUMSFX).toBe(109);
  });

  it('SFX_ID_MIN / SFX_ID_MAX bracket the vanilla sfx_id validation', () => {
    expect(SFX_ID_MIN).toBe(1);
    expect(SFX_ID_MAX).toBe(NUMSFX);
  });

  it('START_SOUND_LINK_MIN_VOLUME matches the vanilla `volume < 1` guard', () => {
    expect(START_SOUND_LINK_MIN_VOLUME).toBe(1);
  });

  it('PITCH_CLAMP_MIN / PITCH_CLAMP_MAX cover the full i_sound.c Clamp range', () => {
    expect(PITCH_CLAMP_MIN).toBe(0);
    expect(PITCH_CLAMP_MAX).toBe(255);
  });
});

describe('startSound — sfx id validation', () => {
  it('throws RangeError for sfxId=0 (sfx_None below SFX_ID_MIN)', () => {
    const table = createChannelTable();
    expect(() => startSound(baseRequest(table, { sfxId: 0 }))).toThrow(RangeError);
  });

  it('throws RangeError for sfxId above SFX_ID_MAX', () => {
    const table = createChannelTable();
    expect(() => startSound(baseRequest(table, { sfxId: SFX_ID_MAX + 1 }))).toThrow(RangeError);
  });

  it('throws RangeError for negative sfxId', () => {
    const table = createChannelTable();
    expect(() => startSound(baseRequest(table, { sfxId: -1 }))).toThrow(RangeError);
  });

  it('throws RangeError for non-integer sfxId', () => {
    const table = createChannelTable();
    expect(() => startSound(baseRequest(table, { sfxId: 1.5 }))).toThrow(RangeError);
  });

  it('accepts sfxId=NUMSFX (vanilla `<= NUMSFX` boundary quirk)', () => {
    const table = createChannelTable();
    const result = startSound(baseRequest(table, { sfxId: NUMSFX }));
    expect(result.kind).toBe('started');
  });

  it('accepts sfxId=1 (sfx_pistol)', () => {
    const table = createChannelTable();
    const result = startSound(baseRequest(table, { sfxId: SFX_PISTOL }));
    expect(result.kind).toBe('started');
  });
});

describe('startSound — remote origin without sourcePosition', () => {
  it('throws TypeError when a remote origin is supplied without sourcePosition', () => {
    const table = createChannelTable();
    expect(() =>
      startSound(
        baseRequest(table, {
          origin: IMP_ORIGIN,
          sourcePosition: null,
        }),
      ),
    ).toThrow(TypeError);
  });
});

describe('startSound — link-silence branch', () => {
  it('returns link-silenced when linkVolumeAdjust drops volume strictly below 1', () => {
    const table = createChannelTable();
    const result = startSound(
      baseRequest(table, {
        linkVolumeAdjust: -SFX_VOLUME_FULL,
      }),
    );
    expect(result).toEqual({ kind: 'link-silenced' });
    expect(table.channels[0]!.sfxId).toBeNull();
  });

  it('link-silenced drop happens BEFORE the audibility branch for remote origins', () => {
    const table = createChannelTable();
    const result = startSound(
      baseRequest(table, {
        origin: IMP_ORIGIN,
        sourcePosition: { x: 10 * FRACUNIT, y: 0 },
        linkVolumeAdjust: -SFX_VOLUME_FULL - 5,
      }),
    );
    expect(result).toEqual({ kind: 'link-silenced' });
    expect(table.channels[0]!.sfxId).toBeNull();
  });

  it('link volume exactly at threshold 1 survives and starts the sound', () => {
    const table = createChannelTable();
    const result = startSound(
      baseRequest(table, {
        linkVolumeAdjust: -(SFX_VOLUME_FULL - 1),
      }),
    );
    assertStarted(result);
    expect(result.volume).toBe(1);
  });

  it('link volume of 0 (below 1) fires the silence drop via strict `<` guard', () => {
    const table = createChannelTable();
    const result = startSound(
      baseRequest(table, {
        linkVolumeAdjust: -SFX_VOLUME_FULL,
      }),
    );
    expect(result).toEqual({ kind: 'link-silenced' });
  });

  it('link clamp caps a too-high volume back down to sfxVolume', () => {
    const table = createChannelTable();
    const result = startSound(
      baseRequest(table, {
        linkVolumeAdjust: 1000,
      }),
    );
    assertStarted(result);
    expect(result.volume).toBe(SFX_VOLUME_FULL);
  });

  it('link replaces NORM_PITCH with linkPitch before perturbation', () => {
    const table = createChannelTable();
    const rng = new DoomRandom();
    const result = startSound(
      baseRequest(table, {
        pitchClass: 'static',
        linkVolumeAdjust: 0,
        linkPitch: 100,
        rng,
      }),
    );
    assertStarted(result);
    expect(result.pitch).toBe(100);
  });

  it('linkPitch=null leaves NORM_PITCH in place even with a non-null linkVolumeAdjust', () => {
    const table = createChannelTable();
    const result = startSound(
      baseRequest(table, {
        pitchClass: 'static',
        linkVolumeAdjust: 0,
        linkPitch: null,
      }),
    );
    assertStarted(result);
    expect(result.pitch).toBe(NORM_PITCH);
  });
});

describe('startSound — anonymous and self-origin fast path', () => {
  it('origin=0 is normalized to anonymous/null and skips remote-source validation', () => {
    const table = createChannelTable();
    const result = startSound(
      baseRequest(table, {
        origin: 0,
        sourcePosition: null,
        pitchClass: 'static',
      }),
    );
    assertStarted(result);
    expect(result.separation).toBe(NORM_SEP);
    expect(result.volume).toBe(SFX_VOLUME_FULL);
    expect(table.channels[result.cnum]!.origin).toBeNull();
  });

  it('anonymous (origin=null) request uses NORM_SEP without calling adjust', () => {
    const table = createChannelTable();
    const result = startSound(
      baseRequest(table, {
        origin: null,
        sourcePosition: { x: S_CLIPPING_DIST + 100 * FRACUNIT, y: 0 },
        pitchClass: 'static',
      }),
    );
    assertStarted(result);
    expect(result.separation).toBe(NORM_SEP);
    expect(result.volume).toBe(SFX_VOLUME_FULL);
  });

  it('self-originated (origin===listenerOrigin) request uses NORM_SEP without adjust', () => {
    const table = createChannelTable();
    const result = startSound(
      baseRequest(table, {
        origin: PLAYER_ORIGIN,
        sourcePosition: { x: S_CLIPPING_DIST + 100 * FRACUNIT, y: 0 },
        pitchClass: 'static',
      }),
    );
    assertStarted(result);
    expect(result.separation).toBe(NORM_SEP);
    expect(result.volume).toBe(SFX_VOLUME_FULL);
  });

  it('listenerOrigin=null routes every non-null origin through adjust', () => {
    const table = createChannelTable();
    const source = { x: 300 * FRACUNIT, y: 0 };
    const result = startSound(
      baseRequest(table, {
        listenerOrigin: null,
        origin: IMP_ORIGIN,
        sourcePosition: source,
        pitchClass: 'static',
      }),
    );
    assertStarted(result);
    const expected = adjustSoundParams({
      listener: LISTENER_AT_ORIGIN,
      source,
      sfxVolume: SFX_VOLUME_FULL,
      isBossMap: false,
    });
    expect(result.volume).toBe(expected.volume);
    expect(result.separation).toBe(expected.separation);
  });

  it('listenerOrigin=0 is normalized to null so non-null origins still route through adjust', () => {
    const table = createChannelTable();
    const source = { x: 300 * FRACUNIT, y: 0 };
    const result = startSound(
      baseRequest(table, {
        listenerOrigin: 0,
        origin: IMP_ORIGIN,
        sourcePosition: source,
        pitchClass: 'static',
      }),
    );
    assertStarted(result);
    const expected = adjustSoundParams({
      listener: LISTENER_AT_ORIGIN,
      source,
      sfxVolume: SFX_VOLUME_FULL,
      isBossMap: false,
    });
    expect(result.volume).toBe(expected.volume);
    expect(result.separation).toBe(expected.separation);
  });
});

describe('startSound — remote origin adjust branch', () => {
  it('forwards adjustSoundParams output when the remote source is audible', () => {
    const table = createChannelTable();
    const source = { x: 300 * FRACUNIT, y: 0 };
    const result = startSound(
      baseRequest(table, {
        origin: IMP_ORIGIN,
        sourcePosition: source,
        pitchClass: 'static',
      }),
    );
    assertStarted(result);
    const expected = adjustSoundParams({
      listener: LISTENER_AT_ORIGIN,
      source,
      sfxVolume: SFX_VOLUME_FULL,
      isBossMap: false,
    });
    expect(result.volume).toBe(expected.volume);
    expect(result.separation).toBe(expected.separation);
  });

  it('returns inaudible when the remote source is beyond S_CLIPPING_DIST (non-boss)', () => {
    const table = createChannelTable();
    const result = startSound(
      baseRequest(table, {
        origin: IMP_ORIGIN,
        sourcePosition: { x: S_CLIPPING_DIST + 10 * FRACUNIT, y: 0 },
      }),
    );
    expect(result).toEqual({ kind: 'inaudible' });
    expect(table.channels[0]!.sfxId).toBeNull();
  });

  it('MAP08 boss branch keeps far sources audible via the floor-of-15 branch', () => {
    const table = createChannelTable();
    const source = { x: S_CLIPPING_DIST + 100 * FRACUNIT, y: 0 };
    const result = startSound(
      baseRequest(table, {
        origin: IMP_ORIGIN,
        sourcePosition: source,
        isBossMap: true,
        pitchClass: 'static',
      }),
    );
    assertStarted(result);
    const expected = adjustSoundParams({
      listener: LISTENER_AT_ORIGIN,
      source,
      sfxVolume: SFX_VOLUME_FULL,
      isBossMap: true,
    });
    expect(result.volume).toBe(expected.volume);
    expect(result.separation).toBe(expected.separation);
  });

  it('same-position remote source forces separation = NORM_SEP (vanilla override)', () => {
    const table = createChannelTable();
    const source = { x: 0, y: 0 };
    const result = startSound(
      baseRequest(table, {
        origin: IMP_ORIGIN,
        sourcePosition: source,
        pitchClass: 'static',
      }),
    );
    assertStarted(result);
    const adjusted = adjustSoundParams({
      listener: LISTENER_AT_ORIGIN,
      source,
      sfxVolume: SFX_VOLUME_FULL,
      isBossMap: false,
    });
    expect(adjusted.separation).toBe(NORM_SEP + 1);
    expect(result.separation).toBe(NORM_SEP);
    expect(result.volume).toBe(SFX_VOLUME_FULL);
  });

  it('honours listener angle when computing stereo separation for remote sources', () => {
    const table = createChannelTable();
    const listener = { x: 0, y: 0, angle: ANG90 };
    const source = { x: 500 * FRACUNIT, y: 0 };
    const result = startSound(
      baseRequest(table, {
        listener,
        origin: IMP_ORIGIN,
        sourcePosition: source,
        pitchClass: 'static',
      }),
    );
    assertStarted(result);
    const expected = adjustSoundParams({
      listener,
      source,
      sfxVolume: SFX_VOLUME_FULL,
      isBossMap: false,
    });
    expect(result.separation).toBe(expected.separation);
    expect(result.separation).toBeGreaterThanOrEqual(MIN_STEREO_SEP);
    expect(result.separation).toBeLessThanOrEqual(MAX_STEREO_SEP);
  });

  it('remote source within close range reports volume = sfxVolume', () => {
    const table = createChannelTable();
    const source = { x: S_CLOSE_DIST - FRACUNIT, y: 0 };
    const result = startSound(
      baseRequest(table, {
        origin: IMP_ORIGIN,
        sourcePosition: source,
        pitchClass: 'static',
      }),
    );
    assertStarted(result);
    expect(result.volume).toBe(SFX_VOLUME_FULL);
  });

  it('sfxVolume=0 drops a remote sound as inaudible', () => {
    const table = createChannelTable();
    const result = startSound(
      baseRequest(table, {
        sfxVolume: 0,
        origin: IMP_ORIGIN,
        sourcePosition: { x: 500 * FRACUNIT, y: 0 },
      }),
    );
    expect(result).toEqual({ kind: 'inaudible' });
  });
});

describe('startSound — pitch perturbation', () => {
  it('saw class applies `pitch += 8 - (mRandom() & 15)` and advances the menu stream once', () => {
    const table = createChannelTable();
    const rng = new DoomRandom();
    const probe = new DoomRandom();
    const menuValue = probe.mRandom();
    const expectedPitch = NORM_PITCH + (8 - (menuValue & 15));

    const result = startSound(
      baseRequest(table, {
        sfxId: SFX_SAWUP,
        pitchClass: 'saw',
        rng,
      }),
    );
    assertStarted(result);
    expect(result.pitch).toBe(expectedPitch);
    expect(rng.rndindex).toBe(1);
  });

  it('saw class covers the inclusive [sfx_sawup, sfx_sawhit] range', () => {
    for (const sfxId of [SFX_SAWUP, SFX_SAWUP + 1, SFX_SAWUP + 2, SFX_SAWHIT]) {
      const table = createChannelTable();
      const rng = new DoomRandom();
      const result = startSound(
        baseRequest(table, {
          sfxId,
          pitchClass: 'saw',
          rng,
        }),
      );
      assertStarted(result);
      expect(rng.rndindex).toBe(1);
    }
  });

  it('default class applies `pitch += 16 - (mRandom() & 31)` and advances the menu stream once', () => {
    const table = createChannelTable();
    const rng = new DoomRandom();
    const probe = new DoomRandom();
    const menuValue = probe.mRandom();
    const expectedPitch = NORM_PITCH + (16 - (menuValue & 31));

    const result = startSound(
      baseRequest(table, {
        sfxId: SFX_DOOR,
        pitchClass: 'default',
        rng,
      }),
    );
    assertStarted(result);
    expect(result.pitch).toBe(expectedPitch);
    expect(rng.rndindex).toBe(1);
  });

  it('static class leaves pitch at NORM_PITCH and does NOT advance the menu stream', () => {
    const table = createChannelTable();
    const rng = new DoomRandom();
    for (const sfxId of [SFX_ITEMUP, SFX_TINK]) {
      table.channels[0]!.sfxId = null;
      table.channels[0]!.origin = null;
      const result = startSound(
        baseRequest(table, {
          sfxId,
          pitchClass: 'static',
          rng,
        }),
      );
      assertStarted(result);
      expect(result.pitch).toBe(NORM_PITCH);
    }
    expect(rng.rndindex).toBe(0);
  });

  it('pitch is clamped to PITCH_CLAMP_MIN when perturbation would push below zero', () => {
    const table = createChannelTable();
    const rng = new DoomRandom();
    const result = startSound(
      baseRequest(table, {
        sfxId: SFX_PISTOL,
        pitchClass: 'default',
        linkVolumeAdjust: 0,
        linkPitch: -1000,
        rng,
      }),
    );
    assertStarted(result);
    expect(result.pitch).toBe(PITCH_CLAMP_MIN);
  });

  it('pitch is clamped to PITCH_CLAMP_MAX when perturbation would push above 255', () => {
    const table = createChannelTable();
    const rng = new DoomRandom();
    const result = startSound(
      baseRequest(table, {
        sfxId: SFX_PISTOL,
        pitchClass: 'default',
        linkVolumeAdjust: 0,
        linkPitch: 1000,
        rng,
      }),
    );
    assertStarted(result);
    expect(result.pitch).toBe(PITCH_CLAMP_MAX);
  });

  it('deterministic RNG advances exactly once for saw / default classes', () => {
    const table = createChannelTable();
    const rng = new DoomRandom();
    expect(rng.rndindex).toBe(0);

    startSound(baseRequest(table, { pitchClass: 'default', rng }));
    expect(rng.rndindex).toBe(1);

    const first = rng.rndindex;
    const menuTable = RNG_TABLE;
    expect(menuTable[first]).toBeGreaterThanOrEqual(0);
  });
});

describe('startSound — allocator composition', () => {
  it('allocates cnum=0 into a fresh table with sfxId/origin/priority/pitch installed', () => {
    const table = createChannelTable();
    const rng = new DoomRandom();
    const result = startSound(
      baseRequest(table, {
        sfxId: SFX_PISTOL,
        priority: NORM_PRIORITY,
        origin: IMP_ORIGIN,
        sourcePosition: { x: 300 * FRACUNIT, y: 0 },
        pitchClass: 'static',
        rng,
      }),
    );
    assertStarted(result);
    expect(result.cnum).toBe(0);
    expect(table.channels[0]!.sfxId).toBe(SFX_PISTOL);
    expect(table.channels[0]!.origin).toBe(IMP_ORIGIN);
    expect(table.channels[0]!.priority).toBe(NORM_PRIORITY);
    expect(table.channels[0]!.pitch).toBe(result.pitch);
    expect(table.channels[0]!.handle).toBe(0);
  });

  it('calls stopSound before allocateChannel — an existing origin slot is freed then reused', () => {
    const table = createChannelTable();
    allocateChannel(table, {
      origin: IMP_ORIGIN,
      sfxId: SFX_DOOR,
      priority: NORM_PRIORITY,
      handle: HANDLE_PREALLOCATED,
    });
    expect(table.channels[0]!.sfxId).toBe(SFX_DOOR);

    const result = startSound(
      baseRequest(table, {
        sfxId: SFX_PISTOL,
        origin: IMP_ORIGIN,
        sourcePosition: { x: 10 * FRACUNIT, y: 0 },
        pitchClass: 'static',
      }),
    );
    assertStarted(result);
    expect(result.cnum).toBe(0);
    expect(table.channels[0]!.sfxId).toBe(SFX_PISTOL);
    expect(table.channels[0]!.handle).toBe(0);
  });

  it('returns no-channel when every slot holds strictly higher-priority sounds', () => {
    const table = createChannelTable();
    const HIGH_PRIORITY = 16;
    for (let i = 0; i < table.capacity; i++) {
      allocateChannel(table, {
        origin: 1000 + i,
        sfxId: SFX_DOOR,
        priority: HIGH_PRIORITY,
      });
    }

    const result = startSound(
      baseRequest(table, {
        sfxId: SFX_PISTOL,
        priority: NORM_PRIORITY,
        origin: LOST_SOUL_ORIGIN,
        sourcePosition: { x: 10 * FRACUNIT, y: 0 },
      }),
    );
    expect(result).toEqual({ kind: 'no-channel' });
    expect(table.channels[0]!.sfxId).toBe(SFX_DOOR);
  });

  it('uses the allocator origin-dedup path for anonymous calls with free slots', () => {
    const table = createChannelTable();
    const result = startSound(
      baseRequest(table, {
        sfxId: SFX_PISTOL,
        origin: null,
        pitchClass: 'static',
      }),
    );
    assertStarted(result);
    expect(result.cnum).toBe(0);
    expect(table.channels[0]!.origin).toBeNull();
  });

  it('does not touch the handle — caller installs the real I_StartSound return value', () => {
    const table = createChannelTable();
    const result = startSound(
      baseRequest(table, {
        sfxId: SFX_PISTOL,
        origin: IMP_ORIGIN,
        sourcePosition: { x: 10 * FRACUNIT, y: 0 },
        pitchClass: 'static',
      }),
    );
    assertStarted(result);
    expect(table.channels[result.cnum]!.handle).toBe(0);
  });
});

describe('startSound — ordering parity edge cases', () => {
  it('link-silenced drop never calls stopSound — an existing slot stays intact', () => {
    const table = createChannelTable();
    allocateChannel(table, {
      origin: IMP_ORIGIN,
      sfxId: SFX_DOOR,
      priority: NORM_PRIORITY,
      handle: HANDLE_PREALLOCATED,
    });

    const result = startSound(
      baseRequest(table, {
        sfxId: SFX_PISTOL,
        origin: IMP_ORIGIN,
        sourcePosition: { x: 10 * FRACUNIT, y: 0 },
        linkVolumeAdjust: -SFX_VOLUME_FULL,
      }),
    );
    expect(result).toEqual({ kind: 'link-silenced' });
    expect(table.channels[0]!.sfxId).toBe(SFX_DOOR);
    expect(table.channels[0]!.handle).toBe(HANDLE_PREALLOCATED);
  });

  it('inaudible drop never calls stopSound — an existing slot stays intact', () => {
    const table = createChannelTable();
    allocateChannel(table, {
      origin: IMP_ORIGIN,
      sfxId: SFX_DOOR,
      priority: NORM_PRIORITY,
      handle: HANDLE_PREALLOCATED,
    });

    const result = startSound(
      baseRequest(table, {
        sfxId: SFX_PISTOL,
        origin: IMP_ORIGIN,
        sourcePosition: { x: S_CLIPPING_DIST + 10 * FRACUNIT, y: 0 },
      }),
    );
    expect(result).toEqual({ kind: 'inaudible' });
    expect(table.channels[0]!.sfxId).toBe(SFX_DOOR);
    expect(table.channels[0]!.handle).toBe(HANDLE_PREALLOCATED);
  });

  it('full pipeline: saw pitch + MAP08 + remote origin returns consistent volume and separation', () => {
    const table = createChannelTable();
    const rng = new DoomRandom();
    const source = { x: S_CLIPPING_DIST + 500 * FRACUNIT, y: 0 };
    const result = startSound(
      baseRequest(table, {
        sfxId: SFX_SAWUP,
        pitchClass: 'saw',
        origin: IMP_ORIGIN,
        sourcePosition: source,
        isBossMap: true,
        rng,
      }),
    );
    assertStarted(result);
    const expected = adjustSoundParams({
      listener: LISTENER_AT_ORIGIN,
      source,
      sfxVolume: SFX_VOLUME_FULL,
      isBossMap: true,
    });
    expect(result.volume).toBe(expected.volume);
    expect(result.separation).toBe(expected.separation);
    expect(result.pitch).toBeGreaterThanOrEqual(PITCH_CLAMP_MIN);
    expect(result.pitch).toBeLessThanOrEqual(PITCH_CLAMP_MAX);
  });

  it('multiple anonymous starts stack in successive slots without origin dedup', () => {
    const table = createChannelTable();
    const rng = new DoomRandom();
    const rA = startSound(baseRequest(table, { origin: null, pitchClass: 'static', rng }));
    const rB = startSound(baseRequest(table, { origin: null, pitchClass: 'static', rng }));
    const rC = startSound(baseRequest(table, { origin: null, pitchClass: 'static', rng }));
    assertStarted(rA);
    assertStarted(rB);
    assertStarted(rC);
    expect([rA.cnum, rB.cnum, rC.cnum]).toEqual([0, 1, 2]);
  });

  it('started result echoes the requested sfxId', () => {
    const table = createChannelTable();
    const result = startSound(
      baseRequest(table, {
        sfxId: SFX_DOOR,
        origin: IMP_ORIGIN,
        sourcePosition: { x: 10 * FRACUNIT, y: 0 },
        pitchClass: 'static',
      }),
    );
    assertStarted(result);
    expect(result.sfxId).toBe(SFX_DOOR);
  });
});
