import { describe, expect, it } from 'bun:test';

import type { Fixed } from '../../src/core/fixed.ts';
import { FRACUNIT } from '../../src/core/fixed.ts';
import { DoomRandom } from '../../src/core/rng.ts';

import type { GameVersion } from '../../src/bootstrap/gameMode.ts';

import { MF_FLOAT, MF_INFLOAT, MF_MISSILE, MF_NOCLIP, MF_NOGRAVITY, MF_SKULLFLY, MOBJINFO, Mobj, MobjType, StateNum } from '../../src/world/mobj.ts';
import { ThinkerList } from '../../src/world/thinkers.ts';
import { FLOATSPEED, GRAVITY, VIEWHEIGHT, approxDistance, zMovement } from '../../src/world/zMovement.ts';
import type { ZMovementCallbacks } from '../../src/world/zMovement.ts';

// ── Helpers ──────────────────────────────────────────────────────────

const F = FRACUNIT;

function createMobj(props: {
  x?: Fixed;
  y?: Fixed;
  z?: Fixed;
  radius?: Fixed;
  height?: Fixed;
  flags?: number;
  type?: MobjType;
  player?: unknown;
  floorz?: Fixed;
  ceilingz?: Fixed;
  momx?: Fixed;
  momy?: Fixed;
  momz?: Fixed;
  target?: Mobj | null;
}): Mobj {
  const mobj = new Mobj();
  mobj.x = props.x ?? 0;
  mobj.y = props.y ?? 0;
  mobj.z = props.z ?? 0;
  mobj.radius = props.radius ?? (20 * F) | 0;
  mobj.height = props.height ?? (56 * F) | 0;
  mobj.flags = props.flags ?? 0;
  mobj.type = props.type ?? MobjType.PLAYER;
  mobj.player = props.player ?? null;
  mobj.floorz = props.floorz ?? 0;
  mobj.ceilingz = props.ceilingz ?? (128 * F) | 0;
  mobj.momx = props.momx ?? 0;
  mobj.momy = props.momy ?? 0;
  mobj.momz = props.momz ?? 0;
  mobj.target = props.target ?? null;
  mobj.info = MOBJINFO[mobj.type] ?? null;
  return mobj;
}

function makeRng(): DoomRandom {
  return new DoomRandom();
}

function makeList(): ThinkerList {
  const list = new ThinkerList();
  list.init();
  return list;
}

// ── Constants ────────────────────────────────────────────────────────

describe('GRAVITY', () => {
  it('equals FRACUNIT', () => {
    expect(GRAVITY).toBe(FRACUNIT);
  });

  it('equals 0x10000', () => {
    expect(GRAVITY).toBe(0x10000);
  });
});

describe('FLOATSPEED', () => {
  it('equals 4 * FRACUNIT', () => {
    expect(FLOATSPEED).toBe((4 * FRACUNIT) | 0);
  });

  it('equals 0x40000', () => {
    expect(FLOATSPEED).toBe(0x40000);
  });
});

describe('VIEWHEIGHT', () => {
  it('equals 41 * FRACUNIT', () => {
    expect(VIEWHEIGHT).toBe((41 * FRACUNIT) | 0);
  });
});

// ── approxDistance ────────────────────────────────────────────────────

describe('approxDistance', () => {
  it('returns 0 for zero deltas', () => {
    expect(approxDistance(0, 0)).toBe(0);
  });

  it('returns dx + dy/2 when dx > dy', () => {
    const dx = (10 * F) | 0;
    const dy = (4 * F) | 0;
    expect(approxDistance(dx, dy)).toBe((dx + dy - (dy >> 1)) | 0);
  });

  it('returns dy + dx/2 when dy > dx', () => {
    const dx = (3 * F) | 0;
    const dy = (9 * F) | 0;
    expect(approxDistance(dx, dy)).toBe((dx + dy - (dx >> 1)) | 0);
  });

  it('handles negative inputs by taking absolute values', () => {
    const positive = approxDistance((5 * F) | 0, (7 * F) | 0);
    const negative = approxDistance((-5 * F) | 0, (-7 * F) | 0);
    expect(negative).toBe(positive);
  });

  it('handles mixed sign inputs', () => {
    const result = approxDistance((-5 * F) | 0, (7 * F) | 0);
    expect(result).toBe(approxDistance((5 * F) | 0, (7 * F) | 0));
  });

  it('returns exact value for axis-aligned distance', () => {
    expect(approxDistance((10 * F) | 0, 0)).toBe((10 * F) | 0);
    expect(approxDistance(0, (10 * F) | 0)).toBe((10 * F) | 0);
  });

  it('overestimates diagonal (3,4,5 triangle)', () => {
    const result = approxDistance((3 * F) | 0, (4 * F) | 0);
    const trueDistance = (5 * F) | 0;
    expect(result).toBeGreaterThan(trueDistance);
    expect(result).toBeLessThan((6 * F) | 0);
  });
});

// ── zMovement: basic height adjustment ───────────────────────────────

describe('zMovement: basic height adjustment', () => {
  it('adds momz to z', () => {
    const mobj = createMobj({ z: (10 * F) | 0, momz: (3 * F) | 0, ceilingz: (128 * F) | 0 });
    zMovement(mobj, makeRng(), makeList());
    expect(mobj.z).toBe((13 * F) | 0);
  });

  it('handles negative momz', () => {
    const mobj = createMobj({ z: (50 * F) | 0, momz: (-5 * F) | 0, ceilingz: (128 * F) | 0 });
    zMovement(mobj, makeRng(), makeList());
    // z = 50 - 5 = 45, which is > floorz (0), so gravity applies
    expect(mobj.z).toBe((45 * F) | 0);
  });
});

// ── zMovement: floor clipping ────────────────────────────────────────

describe('zMovement: floor clipping', () => {
  it('clamps z to floorz when z drops below', () => {
    const mobj = createMobj({ z: (2 * F) | 0, momz: (-5 * F) | 0 });
    zMovement(mobj, makeRng(), makeList());
    expect(mobj.z).toBe(0); // floorz = 0
  });

  it('zeroes negative momz on floor hit', () => {
    const mobj = createMobj({ z: (2 * F) | 0, momz: (-5 * F) | 0 });
    zMovement(mobj, makeRng(), makeList());
    expect(mobj.momz).toBe(0);
  });

  it('does not zero positive momz on floor', () => {
    // Mobj starts on floor with upward momentum
    const mobj = createMobj({ z: 0, momz: (5 * F) | 0, ceilingz: (128 * F) | 0 });
    zMovement(mobj, makeRng(), makeList());
    // z = 0 + 5F = 5F, not on floor, gravity applied (momz -= GRAVITY)
    expect(mobj.momz).toBe((5 * F - GRAVITY) | 0);
  });

  it('sets z exactly to floorz', () => {
    const floorz = (10 * F) | 0;
    const mobj = createMobj({ z: (12 * F) | 0, momz: (-5 * F) | 0, floorz });
    zMovement(mobj, makeRng(), makeList());
    expect(mobj.z).toBe(floorz);
  });
});

// ── zMovement: gravity ───────────────────────────────────────────────

describe('zMovement: gravity', () => {
  it('applies -GRAVITY*2 on first airborne tic (momz=0 in air)', () => {
    const mobj = createMobj({ z: (10 * F) | 0, momz: 0, ceilingz: (128 * F) | 0 });
    // z + momz = 10F, which is > floorz=0, so airborne.
    // momz was 0 → gets -GRAVITY*2
    zMovement(mobj, makeRng(), makeList());
    expect(mobj.momz).toBe((-GRAVITY * 2) | 0);
  });

  it('applies -GRAVITY on subsequent airborne tics', () => {
    const mobj = createMobj({ z: (10 * F) | 0, momz: (-GRAVITY * 2) | 0, ceilingz: (128 * F) | 0 });
    // z = 10F + (-2G) = 10F - 2F = 8F > 0, still airborne
    zMovement(mobj, makeRng(), makeList());
    expect(mobj.momz).toBe((-GRAVITY * 3) | 0);
  });

  it('does not apply gravity when MF_NOGRAVITY', () => {
    const mobj = createMobj({
      z: (10 * F) | 0,
      momz: 0,
      flags: MF_NOGRAVITY,
      ceilingz: (128 * F) | 0,
    });
    zMovement(mobj, makeRng(), makeList());
    expect(mobj.momz).toBe(0);
  });

  it('does not apply gravity when on floor', () => {
    const mobj = createMobj({ z: 0, momz: 0 });
    zMovement(mobj, makeRng(), makeList());
    // z = 0 + 0 = 0, z <= floorz, so floor clip branch, not gravity
    expect(mobj.momz).toBe(0);
    expect(mobj.z).toBe(0);
  });
});

// ── zMovement: ceiling clipping ──────────────────────────────────────

describe('zMovement: ceiling clipping', () => {
  it('clamps z to ceilingz - height when too high', () => {
    const ceilingz = (64 * F) | 0;
    const height = (56 * F) | 0;
    const mobj = createMobj({
      z: (10 * F) | 0,
      momz: (20 * F) | 0,
      height,
      ceilingz,
      flags: MF_NOGRAVITY,
    });
    zMovement(mobj, makeRng(), makeList());
    // z = 10F + 20F = 30F, z + height = 30F + 56F = 86F > 64F
    expect(mobj.z).toBe((ceilingz - height) | 0);
  });

  it('zeroes positive momz on ceiling hit', () => {
    const ceilingz = (64 * F) | 0;
    const mobj = createMobj({
      z: (10 * F) | 0,
      momz: (20 * F) | 0,
      height: (56 * F) | 0,
      ceilingz,
      flags: MF_NOGRAVITY,
    });
    zMovement(mobj, makeRng(), makeList());
    expect(mobj.momz).toBe(0);
  });

  it('does not zero negative momz at ceiling', () => {
    // This shouldn't normally happen, but if momz is already negative when
    // hitting ceiling (e.g., from a float chase), it stays negative.
    const ceilingz = (64 * F) | 0;
    const height = (56 * F) | 0;
    // Start at z=9F with positive momz to reach ceiling, but also have a target
    // that could float z upward past ceiling
    const mobj = createMobj({
      z: (9 * F) | 0,
      momz: 0,
      height,
      ceilingz,
      flags: MF_NOGRAVITY | MF_FLOAT,
    });
    // Place target high so float pushes z up
    const target = createMobj({ z: (100 * F) | 0 });
    mobj.target = target;
    // After z += momz = 9F, float adds FLOATSPEED: z = 9F + 4F = 13F
    // z + height = 13F + 56F = 69F > 64F → ceiling clip
    // momz was 0, not > 0, so NOT zeroed
    zMovement(mobj, makeRng(), makeList());
    expect(mobj.z).toBe((ceilingz - height) | 0);
    expect(mobj.momz).toBe(0); // momz was 0, stays 0
  });
});

// ── zMovement: lost soul bounce ──────────────────────────────────────

describe('zMovement: lost soul floor bounce', () => {
  it('bounces momz on floor in exe_ultimate (corrected)', () => {
    const mobj = createMobj({
      z: (2 * F) | 0,
      momz: (-10 * F) | 0,
      flags: MF_SKULLFLY,
    });
    zMovement(mobj, makeRng(), makeList(), 'exe_ultimate');
    // Corrected: bounce BEFORE zero → momz = -(-10F) = 10F, then momz < 0? No!
    // Wait: momz was -10F, bounce → +10F. Then momz < 0? No, so momz stays 10F.
    expect(mobj.momz).toBe((10 * F) | 0);
    expect(mobj.z).toBe(0);
  });

  it('does NOT bounce momz on floor in exe_doom_1_9 (buggy)', () => {
    const mobj = createMobj({
      z: (2 * F) | 0,
      momz: (-10 * F) | 0,
      flags: MF_SKULLFLY,
    });
    zMovement(mobj, makeRng(), makeList(), 'exe_doom_1_9');
    // Buggy: momz < 0 → momz = 0, THEN bounce → momz = -0 = 0
    expect(mobj.momz).toBe(0);
    expect(mobj.z).toBe(0);
  });

  it('bounces on ceiling regardless of version', () => {
    const ceilingz = (64 * F) | 0;
    const height = (56 * F) | 0;
    const mobj = createMobj({
      z: (2 * F) | 0,
      momz: (20 * F) | 0,
      height,
      ceilingz,
      flags: MF_SKULLFLY,
    });
    zMovement(mobj, makeRng(), makeList(), 'exe_doom_1_9');
    // z = 2F + 20F = 22F, z+h = 78F > 64F → ceiling clip
    // momz > 0 → momz = 0, then bounce → momz = -0 = 0
    expect(mobj.momz).toBe(0);
    expect(mobj.z).toBe((ceilingz - height) | 0);
  });

  it('ceiling bounce flips negative momz when momz is preserved through the clip', () => {
    // Contrived scenario: skull positioned past the ceiling (e.g. floor raise
    // below it) with negative momz. Ceiling clip fires but momz < 0 is NOT
    // zeroed (the zero branch guards momz > 0), so the SKULLFLY bounce
    // flips it to positive.
    const ceilingz = (60 * F) | 0;
    const height = (56 * F) | 0;
    const mobj = createMobj({
      z: (10 * F) | 0,
      momz: (-1 * F) | 0,
      height,
      ceilingz,
      flags: MF_SKULLFLY | MF_NOGRAVITY,
    });
    // z = 10F - 1F = 9F, z+h = 65F > 60F → ceiling clip.
    // momz > 0? No → momz stays -1F. z = 60F - 56F = 4F.
    // MF_SKULLFLY bounce: momz = -(-1F) = 1F.
    zMovement(mobj, makeRng(), makeList(), 'exe_doom_1_9');
    expect(mobj.z).toBe((4 * F) | 0);
    expect(mobj.momz).toBe((1 * F) | 0);
  });
});

describe('zMovement: lost soul bounce version variants', () => {
  const bouncingVersions: GameVersion[] = ['exe_ultimate', 'exe_final', 'exe_final2', 'exe_chex'];
  const nonBouncingVersions: GameVersion[] = ['exe_doom_1_2', 'exe_doom_1_666', 'exe_doom_1_7', 'exe_doom_1_8', 'exe_doom_1_9', 'exe_hacx'];

  for (const version of bouncingVersions) {
    it(`${version} has corrected floor bounce`, () => {
      const mobj = createMobj({
        z: (1 * F) | 0,
        momz: (-5 * F) | 0,
        flags: MF_SKULLFLY,
      });
      zMovement(mobj, makeRng(), makeList(), version);
      expect(mobj.momz).toBe((5 * F) | 0);
    });
  }

  for (const version of nonBouncingVersions) {
    it(`${version} has buggy floor bounce (dead code)`, () => {
      const mobj = createMobj({
        z: (1 * F) | 0,
        momz: (-5 * F) | 0,
        flags: MF_SKULLFLY,
      });
      zMovement(mobj, makeRng(), makeList(), version);
      expect(mobj.momz).toBe(0);
    });
  }
});

// ── zMovement: MF_FLOAT chase ────────────────────────────────────────

describe('zMovement: MF_FLOAT chase', () => {
  it('floats up toward target when target is above and close', () => {
    const mobj = createMobj({
      z: 0,
      momz: 0,
      flags: MF_FLOAT | MF_NOGRAVITY,
      height: (56 * F) | 0,
      ceilingz: (256 * F) | 0,
    });
    // Target above, close horizontally
    const target = createMobj({ x: (10 * F) | 0, z: (50 * F) | 0 });
    mobj.target = target;
    // After z += momz: z = 0
    // delta = target.z + height/2 - z = 50F + 28F - 0 = 78F > 0
    // dist = approxDistance(0 - 10F, 0) = 10F
    // delta*3 = 234F, dist(10F) < 234F → float up
    zMovement(mobj, makeRng(), makeList());
    expect(mobj.z).toBe(FLOATSPEED);
  });

  it('floats down toward target when target is below and close', () => {
    const mobj = createMobj({
      z: (80 * F) | 0,
      momz: 0,
      flags: MF_FLOAT | MF_NOGRAVITY,
      height: (56 * F) | 0,
      ceilingz: (256 * F) | 0,
    });
    const target = createMobj({ x: (10 * F) | 0, z: 0 });
    mobj.target = target;
    // delta = 0 + 28F - 80F = -52F < 0
    // dist = 10F, -(delta*3) = 156F, dist < 156F → float down
    zMovement(mobj, makeRng(), makeList());
    expect(mobj.z).toBe((80 * F - FLOATSPEED) | 0);
  });

  it('does not float when target is far horizontally', () => {
    const mobj = createMobj({
      z: 0,
      momz: 0,
      flags: MF_FLOAT | MF_NOGRAVITY,
      height: (56 * F) | 0,
      ceilingz: (256 * F) | 0,
    });
    const target = createMobj({ x: (1000 * F) | 0, z: (10 * F) | 0 });
    mobj.target = target;
    // delta = 10F + 28F - 0 = 38F
    // dist = approxDistance(1000F, 0) = 1000F
    // delta*3 = 114F, dist(1000F) >= 114F → no float
    zMovement(mobj, makeRng(), makeList());
    expect(mobj.z).toBe(0);
  });

  it('does not float when MF_INFLOAT is set', () => {
    const mobj = createMobj({
      z: 0,
      momz: 0,
      flags: MF_FLOAT | MF_INFLOAT | MF_NOGRAVITY,
      height: (56 * F) | 0,
      ceilingz: (256 * F) | 0,
    });
    const target = createMobj({ x: (10 * F) | 0, z: (50 * F) | 0 });
    mobj.target = target;
    zMovement(mobj, makeRng(), makeList());
    expect(mobj.z).toBe(0);
  });

  it('does not float when MF_SKULLFLY is set', () => {
    const mobj = createMobj({
      z: 0,
      momz: 0,
      flags: MF_FLOAT | MF_SKULLFLY | MF_NOGRAVITY,
      height: (56 * F) | 0,
      ceilingz: (256 * F) | 0,
    });
    const target = createMobj({ x: (10 * F) | 0, z: (50 * F) | 0 });
    mobj.target = target;
    zMovement(mobj, makeRng(), makeList());
    expect(mobj.z).toBe(0);
  });

  it('does not float when target is null', () => {
    const mobj = createMobj({
      z: (10 * F) | 0,
      momz: 0,
      flags: MF_FLOAT | MF_NOGRAVITY,
      height: (56 * F) | 0,
      ceilingz: (256 * F) | 0,
    });
    // No target set
    zMovement(mobj, makeRng(), makeList());
    expect(mobj.z).toBe((10 * F) | 0);
  });
});

// ── zMovement: missile explosion ─────────────────────────────────────

describe('zMovement: missile explosion', () => {
  it('explodes missile on floor hit', () => {
    const list = makeList();
    const mobj = createMobj({
      z: (2 * F) | 0,
      momz: (-5 * F) | 0,
      flags: MF_MISSILE,
      type: MobjType.ROCKET,
    });
    mobj.info = MOBJINFO[MobjType.ROCKET]!;
    list.add(mobj);
    mobj.action = () => {};

    zMovement(mobj, makeRng(), list);
    expect(mobj.z).toBe(0);
    expect(mobj.momz).toBe(0);
    expect(mobj.momx).toBe(0);
    expect(mobj.momy).toBe(0);
    expect(mobj.flags & MF_MISSILE).toBe(0);
  });

  it('explodes missile on ceiling hit', () => {
    const ceilingz = (64 * F) | 0;
    const height = (16 * F) | 0;
    const list = makeList();
    const mobj = createMobj({
      z: (40 * F) | 0,
      momz: (20 * F) | 0,
      height,
      ceilingz,
      flags: MF_MISSILE,
      type: MobjType.ROCKET,
    });
    mobj.info = MOBJINFO[MobjType.ROCKET]!;
    list.add(mobj);
    mobj.action = () => {};

    zMovement(mobj, makeRng(), list);
    // z + momz = 60F, z+h = 76F > 64F → ceiling clip
    expect(mobj.z).toBe((ceilingz - height) | 0);
    expect(mobj.momz).toBe(0);
    expect(mobj.flags & MF_MISSILE).toBe(0);
  });

  it('does not explode MF_NOCLIP missile on floor', () => {
    const mobj = createMobj({
      z: (2 * F) | 0,
      momz: (-5 * F) | 0,
      flags: MF_MISSILE | MF_NOCLIP,
      type: MobjType.ROCKET,
    });
    mobj.info = MOBJINFO[MobjType.ROCKET]!;

    zMovement(mobj, makeRng(), makeList());
    expect(mobj.z).toBe(0);
    expect(mobj.flags & MF_MISSILE).toBe(MF_MISSILE);
  });

  it('does not explode MF_NOCLIP missile on ceiling', () => {
    const ceilingz = (64 * F) | 0;
    const height = (16 * F) | 0;
    const mobj = createMobj({
      z: (40 * F) | 0,
      momz: (20 * F) | 0,
      height,
      ceilingz,
      flags: MF_MISSILE | MF_NOCLIP,
      type: MobjType.ROCKET,
    });
    mobj.info = MOBJINFO[MobjType.ROCKET]!;

    zMovement(mobj, makeRng(), makeList());
    expect(mobj.z).toBe((ceilingz - height) | 0);
    expect(mobj.flags & MF_MISSILE).toBe(MF_MISSILE);
  });
});

// ── zMovement: player callbacks ──────────────────────────────────────

describe('zMovement: player smooth step-up', () => {
  it('calls playerSmoothStep when player z < floorz', () => {
    let capturedDelta = 0;
    let callCount = 0;
    const callbacks: ZMovementCallbacks = {
      playerSmoothStep: (_mobj, delta) => {
        capturedDelta = delta;
        callCount++;
      },
    };
    const mobj = createMobj({
      z: (-2 * F) | 0,
      momz: 0,
      floorz: 0,
      player: {},
    });
    zMovement(mobj, makeRng(), makeList(), 'exe_doom_1_9', callbacks);
    expect(callCount).toBe(1);
    expect(capturedDelta).toBe((2 * F) | 0);
  });

  it('does not call playerSmoothStep when z >= floorz', () => {
    let called = false;
    const callbacks: ZMovementCallbacks = {
      playerSmoothStep: () => {
        called = true;
      },
    };
    const mobj = createMobj({
      z: (5 * F) | 0,
      momz: 0,
      floorz: 0,
      player: {},
      ceilingz: (128 * F) | 0,
    });
    zMovement(mobj, makeRng(), makeList(), 'exe_doom_1_9', callbacks);
    expect(called).toBe(false);
  });

  it('does not call playerSmoothStep for non-player', () => {
    let called = false;
    const callbacks: ZMovementCallbacks = {
      playerSmoothStep: () => {
        called = true;
      },
    };
    const mobj = createMobj({
      z: (-2 * F) | 0,
      momz: 0,
      floorz: 0,
    });
    zMovement(mobj, makeRng(), makeList(), 'exe_doom_1_9', callbacks);
    expect(called).toBe(false);
  });
});

describe('zMovement: player landing', () => {
  it('calls playerLanding when momz < -GRAVITY*8', () => {
    let capturedMomz = 0;
    let callCount = 0;
    const callbacks: ZMovementCallbacks = {
      playerLanding: (_mobj, momz) => {
        capturedMomz = momz;
        callCount++;
      },
    };
    const mobj = createMobj({
      z: (2 * F) | 0,
      momz: (-GRAVITY * 9) | 0,
      floorz: 0,
      player: {},
    });
    zMovement(mobj, makeRng(), makeList(), 'exe_doom_1_9', callbacks);
    expect(callCount).toBe(1);
    expect(capturedMomz).toBe((-GRAVITY * 9) | 0);
  });

  it('does not call playerLanding at exactly -GRAVITY*8 (strict less-than)', () => {
    let called = false;
    const callbacks: ZMovementCallbacks = {
      playerLanding: () => {
        called = true;
      },
    };
    const mobj = createMobj({
      z: (2 * F) | 0,
      momz: (-GRAVITY * 8) | 0,
      floorz: 0,
      player: {},
    });
    zMovement(mobj, makeRng(), makeList(), 'exe_doom_1_9', callbacks);
    expect(called).toBe(false);
  });

  it('does not call playerLanding for non-player', () => {
    let called = false;
    const callbacks: ZMovementCallbacks = {
      playerLanding: () => {
        called = true;
      },
    };
    const mobj = createMobj({
      z: (2 * F) | 0,
      momz: (-GRAVITY * 9) | 0,
      floorz: 0,
    });
    zMovement(mobj, makeRng(), makeList(), 'exe_doom_1_9', callbacks);
    expect(called).toBe(false);
  });
});

// ── Parity-sensitive edge cases ──────────────────────────────────────

describe('parity-sensitive edge cases', () => {
  it('gravity double on first airborne tic vs single on subsequent', () => {
    // First tic: momz was 0 → becomes -2G
    const mobj1 = createMobj({ z: (20 * F) | 0, momz: 0, ceilingz: (128 * F) | 0 });
    zMovement(mobj1, makeRng(), makeList());
    expect(mobj1.momz).toBe((-GRAVITY * 2) | 0);

    // Second tic: momz was -2G → becomes -3G (not -4G)
    const mobj2 = createMobj({ z: (20 * F) | 0, momz: (-GRAVITY * 2) | 0, ceilingz: (128 * F) | 0 });
    zMovement(mobj2, makeRng(), makeList());
    expect(mobj2.momz).toBe((-GRAVITY * 3) | 0);
  });

  it('lost soul bounce on floor is version-dependent but ceiling is not', () => {
    // Floor bounce: version-dependent
    const floorSkull19 = createMobj({
      z: (1 * F) | 0,
      momz: (-3 * F) | 0,
      flags: MF_SKULLFLY,
    });
    zMovement(floorSkull19, makeRng(), makeList(), 'exe_doom_1_9');
    expect(floorSkull19.momz).toBe(0); // Buggy: dead bounce

    const floorSkullUlt = createMobj({
      z: (1 * F) | 0,
      momz: (-3 * F) | 0,
      flags: MF_SKULLFLY,
    });
    zMovement(floorSkullUlt, makeRng(), makeList(), 'exe_ultimate');
    expect(floorSkullUlt.momz).toBe((3 * F) | 0); // Corrected: real bounce

    // Ceiling bounce: always works
    const ceilingz = (64 * F) | 0;
    const height = (56 * F) | 0;
    const ceilSkull19 = createMobj({
      z: 0,
      momz: (20 * F) | 0,
      height,
      ceilingz,
      flags: MF_SKULLFLY,
    });
    zMovement(ceilSkull19, makeRng(), makeList(), 'exe_doom_1_9');
    // momz > 0 → zeroed, then bounce → -0 = 0
    expect(ceilSkull19.momz).toBe(0);
    expect(ceilSkull19.z).toBe((ceilingz - height) | 0);
  });

  it('player landing squat threshold is strict less-than -GRAVITY*8', () => {
    const threshold = (-GRAVITY * 8) | 0;
    let landingCount = 0;
    const callbacks: ZMovementCallbacks = {
      playerLanding: () => {
        landingCount++;
      },
    };

    // At threshold: no squat
    const mobjAt = createMobj({ z: (2 * F) | 0, momz: threshold, player: {} });
    zMovement(mobjAt, makeRng(), makeList(), 'exe_doom_1_9', callbacks);
    expect(landingCount).toBe(0);

    // Below threshold: squat
    const mobjBelow = createMobj({ z: (2 * F) | 0, momz: (threshold - 1) | 0, player: {} });
    zMovement(mobjBelow, makeRng(), makeList(), 'exe_doom_1_9', callbacks);
    expect(landingCount).toBe(1);
  });

  it('floor clip uses <= (z exactly at floorz triggers floor branch)', () => {
    // z + momz == floorz exactly
    const mobj = createMobj({
      z: (5 * F) | 0,
      momz: (-5 * F) | 0,
      floorz: 0,
    });
    zMovement(mobj, makeRng(), makeList());
    // z = 5F - 5F = 0, z <= floorz(0), floor branch taken
    expect(mobj.z).toBe(0);
    expect(mobj.momz).toBe(0);
  });

  it('ceiling clip uses strict greater-than', () => {
    // z + height == ceilingz exactly: should NOT trigger ceiling clip
    const ceilingz = (64 * F) | 0;
    const height = (56 * F) | 0;
    const mobj = createMobj({
      z: (8 * F) | 0,
      momz: 0,
      height,
      ceilingz,
      flags: MF_NOGRAVITY,
    });
    // z + momz = 8F, z + height = 8F + 56F = 64F, NOT > 64F
    zMovement(mobj, makeRng(), makeList());
    expect(mobj.z).toBe((8 * F) | 0);
  });

  it('missile explosion consumes RNG for tic randomization', () => {
    const rng1 = makeRng();
    const rng2 = makeRng();
    const list = makeList();

    const mobj = createMobj({
      z: (2 * F) | 0,
      momz: (-5 * F) | 0,
      flags: MF_MISSILE,
      type: MobjType.ROCKET,
    });
    mobj.info = MOBJINFO[MobjType.ROCKET]!;
    list.add(mobj);
    mobj.action = () => {};

    zMovement(mobj, rng1, list);

    // RNG should have advanced by one call (P_Random() in explodeMissile)
    rng2.pRandom(); // Consume one value to match
    expect(rng1.prndindex).toBe(rng2.prndindex);
  });

  it('float chase uses approxDistance for dist comparison', () => {
    // Verify float only triggers when horizontally close relative to z-delta
    const mobj = createMobj({
      x: 0,
      z: 0,
      momz: 0,
      flags: MF_FLOAT | MF_NOGRAVITY,
      height: (56 * F) | 0,
      ceilingz: (256 * F) | 0,
    });
    const target = createMobj({ x: (10 * F) | 0, z: (10 * F) | 0 });
    mobj.target = target;

    // delta = 10F + 28F - 0 = 38F > 0
    // dist = approxDistance(0 - 10F, 0) = 10F
    // delta*3 = 114F, dist(10F) < 114F → should float up
    const zBefore = mobj.z;
    zMovement(mobj, makeRng(), makeList());
    expect(mobj.z).toBe((zBefore + FLOATSPEED) | 0);
  });

  it('smooth step-up fires before z adjustment', () => {
    let capturedZ = 0;
    let callCount = 0;
    const callbacks: ZMovementCallbacks = {
      playerSmoothStep: (mobj) => {
        capturedZ = mobj.z;
        callCount++;
      },
    };
    const mobj = createMobj({
      z: (-3 * F) | 0,
      momz: (-2 * F) | 0,
      floorz: 0,
      player: {},
    });
    zMovement(mobj, makeRng(), makeList(), 'exe_doom_1_9', callbacks);
    // Callback must see pre-adjustment z (-3F), not post-adjustment z (-5F).
    expect(callCount).toBe(1);
    expect(capturedZ).toBe((-3 * F) | 0);
    // After z += momz and floor clip: z clamped to floorz=0.
    expect(mobj.z).toBe(0);
  });

  it('int32 wrapping on z + momz via | 0', () => {
    // Large positive z + large positive momz wraps to negative via | 0.
    // Set floorz below the wrapped value so floor clipping does not
    // mask the result.
    const wrappedZ = (0x7fff_0000 + 0x0002_0000) | 0; // -2147418112
    const mobj = createMobj({
      z: 0x7fff_0000,
      momz: 0x0002_0000,
      flags: MF_NOGRAVITY,
      ceilingz: 0x7fff_ffff,
      floorz: -0x8000_0000,
      height: 0,
    });
    zMovement(mobj, makeRng(), makeList());
    expect(mobj.z).toBe(wrappedZ);
  });
});
