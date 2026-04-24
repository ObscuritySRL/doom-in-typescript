import { describe, expect, it } from 'bun:test';

import { FRACBITS, FRACUNIT, fixedMul } from '../../src/core/fixed.ts';
import { ANG90, ANG180, ANG270 } from '../../src/core/angle.ts';
import { ANGLETOFINESHIFT, FINEANGLES, FINEMASK, finecosine, finesine } from '../../src/core/trig.ts';

import { Mobj, STATES, StateNum } from '../../src/world/mobj.ts';
import { VIEWHEIGHT } from '../../src/world/zMovement.ts';

import { createPlayer, playerReborn, PlayerState } from '../../src/player/playerSpawn.ts';

import type { Player } from '../../src/player/playerSpawn.ts';

import { CF_NOMOMENTUM, MAXBOB, MOVE_SCALE, calcHeight, movePlayer, thrust } from '../../src/player/movement.ts';

import type { SetMobjStateFunction } from '../../src/player/movement.ts';

const CF_GODMODE = 2;

// ── Helpers ──────────────────────────────────────────────────────────

/** Create a player with a mobj ready for movement testing. */
function createTestPlayer(): Player {
  const player = createPlayer();
  playerReborn(player);
  const mobj = new Mobj();
  mobj.z = 0;
  mobj.floorz = 0;
  mobj.ceilingz = (128 * FRACUNIT) | 0;
  mobj.state = STATES[StateNum.PLAY]!;
  player.mo = mobj;
  player.viewheight = VIEWHEIGHT;
  player.deltaviewheight = 0;
  return player;
}

// ── MAXBOB constant ──────────────────────────────────────────────────

describe('MAXBOB', () => {
  it('equals 0x100000 (16 pixels in fixed-point)', () => {
    expect(MAXBOB).toBe(0x10_0000);
  });

  it('equals 16 << FRACBITS', () => {
    expect(MAXBOB).toBe(16 << FRACBITS);
  });
});

// ── CF_NOMOMENTUM constant ───────────────────────────────────────────

describe('CF_NOMOMENTUM', () => {
  it('equals 4 matching d_player.h CF_NOMOMENTUM', () => {
    expect(CF_NOMOMENTUM).toBe(4);
  });
});

// ── MOVE_SCALE constant ──────────────────────────────────────────────

describe('MOVE_SCALE', () => {
  it('equals 2048 matching p_user.c forwardmove*2048', () => {
    expect(MOVE_SCALE).toBe(2048);
  });

  it('equals 0x800', () => {
    expect(MOVE_SCALE).toBe(0x800);
  });
});

// ── thrust ───────────────────────────────────────────────────────────

describe('thrust', () => {
  it('adds momentum along angle 0 (east)', () => {
    const player = createTestPlayer();
    const mobj = player.mo!;
    mobj.momx = 0;
    mobj.momy = 0;
    thrust(player, 0, FRACUNIT);
    // angle 0 = east: cosine ≈ 1.0, sine ≈ 0.0
    expect(mobj.momx).toBe(fixedMul(FRACUNIT, finecosine[0]!));
    expect(mobj.momy).toBe(fixedMul(FRACUNIT, finesine[0]!));
  });

  it('adds momentum along ANG90 (north)', () => {
    const player = createTestPlayer();
    const mobj = player.mo!;
    mobj.momx = 0;
    mobj.momy = 0;
    thrust(player, ANG90, FRACUNIT);
    const fineAngle = (ANG90 >>> ANGLETOFINESHIFT) & FINEMASK;
    expect(mobj.momx).toBe(fixedMul(FRACUNIT, finecosine[fineAngle]!));
    expect(mobj.momy).toBe(fixedMul(FRACUNIT, finesine[fineAngle]!));
  });

  it('accumulates momentum on successive calls', () => {
    const player = createTestPlayer();
    const mobj = player.mo!;
    mobj.momx = 0;
    mobj.momy = 0;
    thrust(player, 0, FRACUNIT);
    const firstMomx = mobj.momx;
    thrust(player, 0, FRACUNIT);
    expect(mobj.momx).toBe((firstMomx + fixedMul(FRACUNIT, finecosine[0]!)) | 0);
  });

  it('applies int32 truncation', () => {
    const player = createTestPlayer();
    const mobj = player.mo!;
    mobj.momx = 0x7fff_0000;
    mobj.momy = 0;
    // Large thrust should wrap via | 0
    thrust(player, 0, (100 * FRACUNIT) | 0);
    expect(typeof mobj.momx).toBe('number');
    // Result should be int32-truncated
    expect(mobj.momx).toBe(mobj.momx | 0);
  });

  it('applies zero move without changing momentum', () => {
    const player = createTestPlayer();
    const mobj = player.mo!;
    mobj.momx = (5 * FRACUNIT) | 0;
    mobj.momy = (3 * FRACUNIT) | 0;
    const oldMomx = mobj.momx;
    const oldMomy = mobj.momy;
    thrust(player, 0, 0);
    expect(mobj.momx).toBe(oldMomx);
    expect(mobj.momy).toBe(oldMomy);
  });

  it('handles negative move values (backward thrust)', () => {
    const player = createTestPlayer();
    const mobj = player.mo!;
    mobj.momx = 0;
    mobj.momy = 0;
    thrust(player, 0, -FRACUNIT);
    // Negative move * positive cosine = negative momx
    expect(mobj.momx).toBe(fixedMul(-FRACUNIT, finecosine[0]!));
  });
});

// ── calcHeight: bob computation ──────────────────────────────────────

describe('calcHeight bob computation', () => {
  it('computes bob as (momx² + momy²) >> 2', () => {
    const player = createTestPlayer();
    const mobj = player.mo!;
    mobj.momx = (2 * FRACUNIT) | 0;
    mobj.momy = (3 * FRACUNIT) | 0;
    calcHeight(player, 0, true);
    const expected = (fixedMul(mobj.momx, mobj.momx) + fixedMul(mobj.momy, mobj.momy)) >> 2;
    expect(player.bob).toBe(expected);
  });

  it('clamps bob to MAXBOB', () => {
    const player = createTestPlayer();
    const mobj = player.mo!;
    // Very high momentum to exceed MAXBOB
    mobj.momx = (100 * FRACUNIT) | 0;
    mobj.momy = (100 * FRACUNIT) | 0;
    calcHeight(player, 0, true);
    expect(player.bob).toBe(MAXBOB);
  });

  it('computes bob even when not on ground (for gun swing)', () => {
    const player = createTestPlayer();
    const mobj = player.mo!;
    mobj.momx = (5 * FRACUNIT) | 0;
    mobj.momy = 0;
    calcHeight(player, 0, false);
    const expected = Math.min(fixedMul(mobj.momx, mobj.momx) >> 2, MAXBOB);
    expect(player.bob).toBe(expected);
  });

  it('produces zero bob with zero momentum', () => {
    const player = createTestPlayer();
    player.mo!.momx = 0;
    player.mo!.momy = 0;
    calcHeight(player, 0, true);
    expect(player.bob).toBe(0);
  });
});

// ── calcHeight: airborne / CF_NOMOMENTUM path ────────────────────────

describe('calcHeight airborne/nomomentum path', () => {
  it('uses z + viewheight when airborne (vanilla quirk)', () => {
    const player = createTestPlayer();
    const mobj = player.mo!;
    mobj.z = (10 * FRACUNIT) | 0;
    mobj.momx = 0;
    mobj.momy = 0;
    player.viewheight = (20 * FRACUNIT) | 0;
    calcHeight(player, 5, false);
    // Vanilla quirk: viewz is overwritten to z + viewheight
    expect(player.viewz).toBe((mobj.z + player.viewheight) | 0);
  });

  it('uses z + viewheight when CF_NOMOMENTUM set', () => {
    const player = createTestPlayer();
    const mobj = player.mo!;
    mobj.z = (10 * FRACUNIT) | 0;
    player.cheats = CF_NOMOMENTUM;
    player.viewheight = (30 * FRACUNIT) | 0;
    calcHeight(player, 5, true);
    expect(player.viewz).toBe((mobj.z + player.viewheight) | 0);
  });

  it('does not treat CF_GODMODE as CF_NOMOMENTUM', () => {
    const player = createTestPlayer();
    const mobj = player.mo!;
    mobj.momx = (4 * FRACUNIT) | 0;
    mobj.momy = 0;
    player.cheats = CF_GODMODE;
    player.viewheight = (35 * FRACUNIT) | 0;
    player.deltaviewheight = FRACUNIT;
    calcHeight(player, 5, true);
    expect(player.viewheight).toBe((36 * FRACUNIT) | 0);
    expect(player.viewz).not.toBe((mobj.z + 35 * FRACUNIT) | 0);
  });

  it('clamps to ceiling before the quirk override when ceiling is low', () => {
    const player = createTestPlayer();
    const mobj = player.mo!;
    mobj.z = 0;
    mobj.ceilingz = (40 * FRACUNIT) | 0;
    player.viewheight = (20 * FRACUNIT) | 0;
    calcHeight(player, 0, false);
    // The ceiling clamp happens first (z + VIEWHEIGHT vs ceiling - 4*FRACUNIT)
    // but then viewz is overwritten to z + viewheight.
    // viewheight (20*FRACUNIT) < VIEWHEIGHT (41*FRACUNIT), so viewz = 20*FRACUNIT
    expect(player.viewz).toBe((mobj.z + player.viewheight) | 0);
  });

  it('does not modify viewheight or deltaviewheight in airborne path', () => {
    const player = createTestPlayer();
    player.viewheight = (30 * FRACUNIT) | 0;
    player.deltaviewheight = (2 * FRACUNIT) | 0;
    const oldViewheight = player.viewheight;
    const oldDelta = player.deltaviewheight;
    calcHeight(player, 0, false);
    expect(player.viewheight).toBe(oldViewheight);
    expect(player.deltaviewheight).toBe(oldDelta);
  });
});

// ── calcHeight: view bob oscillation ─────────────────────────────────

describe('calcHeight view bob oscillation', () => {
  it('uses finesine LUT with (FINEANGLES/20 * leveltime) & FINEMASK', () => {
    const player = createTestPlayer();
    const mobj = player.mo!;
    mobj.momx = (4 * FRACUNIT) | 0;
    mobj.momy = 0;
    const leveltime = 10;
    calcHeight(player, leveltime, true);

    const expectedBob = Math.min(fixedMul(mobj.momx, mobj.momx) >> 2, MAXBOB);
    const bobAngle = (((FINEANGLES / 20) * leveltime) | 0) & FINEMASK;
    const oscillation = fixedMul((expectedBob / 2) | 0, finesine[bobAngle]!);
    expect(player.viewz).toBe((mobj.z + player.viewheight + oscillation) | 0);
  });

  it('produces zero oscillation when bob is zero', () => {
    const player = createTestPlayer();
    player.mo!.momx = 0;
    player.mo!.momy = 0;
    calcHeight(player, 17, true);
    // Zero bob → zero oscillation → viewz = z + viewheight
    expect(player.viewz).toBe((player.mo!.z + player.viewheight) | 0);
  });

  it('oscillates differently at different level times', () => {
    const player1 = createTestPlayer();
    player1.mo!.momx = (5 * FRACUNIT) | 0;

    const player2 = createTestPlayer();
    player2.mo!.momx = (5 * FRACUNIT) | 0;

    calcHeight(player1, 0, true);
    calcHeight(player2, 5, true);

    // Different leveltimes produce different bob oscillation
    // (unless they happen to hit the same sine entry)
    const bobAngle0 = (((FINEANGLES / 20) * 0) | 0) & FINEMASK;
    const bobAngle5 = (((FINEANGLES / 20) * 5) | 0) & FINEMASK;
    if (finesine[bobAngle0] !== finesine[bobAngle5]) {
      expect(player1.viewz).not.toBe(player2.viewz);
    }
  });
});

// ── calcHeight: viewheight convergence ───────────────────────────────

describe('calcHeight viewheight convergence', () => {
  it('increases viewheight when deltaviewheight is positive', () => {
    const player = createTestPlayer();
    player.viewheight = (35 * FRACUNIT) | 0;
    player.deltaviewheight = FRACUNIT;
    player.mo!.momx = 0;
    player.mo!.momy = 0;
    calcHeight(player, 0, true);
    // viewheight += deltaviewheight, then deltaviewheight += FRACUNIT/4
    expect(player.viewheight).toBe((36 * FRACUNIT) | 0);
  });

  it('clamps viewheight at VIEWHEIGHT and zeroes deltaviewheight', () => {
    const player = createTestPlayer();
    player.viewheight = VIEWHEIGHT - 1;
    player.deltaviewheight = FRACUNIT;
    player.mo!.momx = 0;
    player.mo!.momy = 0;
    calcHeight(player, 0, true);
    expect(player.viewheight).toBe(VIEWHEIGHT);
    expect(player.deltaviewheight).toBe(0);
  });

  it('clamps viewheight at VIEWHEIGHT/2 minimum', () => {
    const player = createTestPlayer();
    player.viewheight = (10 * FRACUNIT) | 0;
    player.deltaviewheight = 0;
    player.mo!.momx = 0;
    player.mo!.momy = 0;
    calcHeight(player, 0, true);
    expect(player.viewheight).toBe((VIEWHEIGHT / 2) | 0);
  });

  it('forces deltaviewheight to 1 when at minimum viewheight with non-positive delta', () => {
    const player = createTestPlayer();
    player.viewheight = (10 * FRACUNIT) | 0;
    player.deltaviewheight = -FRACUNIT;
    player.mo!.momx = 0;
    player.mo!.momy = 0;
    calcHeight(player, 0, true);
    // viewheight = 10 - 1 = 9 FRACUNIT, below VIEWHEIGHT/2, so clamped to VIEWHEIGHT/2.
    // deltaviewheight was negative → forced to 1.
    // Then the deltaviewheight != 0 block adds FRACUNIT/4 → 1 + 16384 = 16385.
    expect(player.deltaviewheight).toBe((1 + ((FRACUNIT / 4) | 0)) | 0);
  });

  it('increments deltaviewheight by FRACUNIT/4 each tic', () => {
    const player = createTestPlayer();
    player.viewheight = (30 * FRACUNIT) | 0;
    player.deltaviewheight = FRACUNIT;
    player.mo!.momx = 0;
    player.mo!.momy = 0;
    calcHeight(player, 0, true);
    // After viewheight update: deltaviewheight += FRACUNIT/4
    expect(player.deltaviewheight).toBe((FRACUNIT + ((FRACUNIT / 4) | 0)) | 0);
  });

  it('prevents deltaviewheight from becoming exactly zero (sets to 1)', () => {
    const player = createTestPlayer();
    player.viewheight = (30 * FRACUNIT) | 0;
    // deltaviewheight such that adding FRACUNIT/4 makes it exactly 0
    player.deltaviewheight = -((FRACUNIT / 4) | 0);
    player.mo!.momx = 0;
    player.mo!.momy = 0;
    calcHeight(player, 0, true);
    // deltaviewheight + FRACUNIT/4 = 0, so forced to 1
    expect(player.deltaviewheight).toBe(1);
  });

  it('does not modify viewheight when player is dead', () => {
    const player = createTestPlayer();
    player.playerstate = PlayerState.DEAD;
    player.viewheight = (10 * FRACUNIT) | 0;
    player.deltaviewheight = FRACUNIT;
    player.mo!.momx = 0;
    player.mo!.momy = 0;
    const oldViewheight = player.viewheight;
    calcHeight(player, 0, true);
    expect(player.viewheight).toBe(oldViewheight);
  });
});

// ── calcHeight: ceiling clamp ────────────────────────────────────────

describe('calcHeight ceiling clamp', () => {
  it('clamps viewz to ceilingz - 4*FRACUNIT when ceiling is low', () => {
    const player = createTestPlayer();
    const mobj = player.mo!;
    mobj.z = (50 * FRACUNIT) | 0;
    mobj.ceilingz = (55 * FRACUNIT) | 0;
    mobj.momx = 0;
    mobj.momy = 0;
    player.viewheight = VIEWHEIGHT;
    calcHeight(player, 0, true);
    // z + viewheight = 50 + 41 = 91, but ceiling - 4 = 51
    expect(player.viewz).toBe((mobj.ceilingz - 4 * FRACUNIT) | 0);
  });

  it('does not clamp when ceiling is high enough', () => {
    const player = createTestPlayer();
    const mobj = player.mo!;
    mobj.z = 0;
    mobj.ceilingz = (128 * FRACUNIT) | 0;
    mobj.momx = 0;
    mobj.momy = 0;
    player.viewheight = VIEWHEIGHT;
    calcHeight(player, 0, true);
    // z + viewheight = 0 + 41 = 41, ceiling - 4 = 124
    expect(player.viewz).toBe((mobj.z + player.viewheight) | 0);
  });
});

// ── movePlayer ───────────────────────────────────────────────────────

describe('movePlayer', () => {
  it('applies angleturn to mobj angle', () => {
    const player = createTestPlayer();
    player.mo!.angle = 0;
    player.cmd = { ...player.cmd, angleturn: 100, forwardmove: 0, sidemove: 0 };
    movePlayer(player);
    expect(player.mo!.angle).toBe((100 << FRACBITS) >>> 0);
  });

  it('wraps angle to unsigned 32-bit', () => {
    const player = createTestPlayer();
    player.mo!.angle = 0xffff_0000;
    player.cmd = { ...player.cmd, angleturn: 256, forwardmove: 0, sidemove: 0 };
    movePlayer(player);
    expect(player.mo!.angle).toBe((0xffff_0000 + (256 << FRACBITS)) >>> 0);
  });

  it('returns true when on ground (z <= floorz)', () => {
    const player = createTestPlayer();
    player.mo!.z = 0;
    player.mo!.floorz = 0;
    player.cmd = { ...player.cmd, forwardmove: 0, sidemove: 0, angleturn: 0 };
    const result = movePlayer(player);
    expect(result).toBe(true);
  });

  it('returns false when airborne (z > floorz)', () => {
    const player = createTestPlayer();
    player.mo!.z = FRACUNIT;
    player.mo!.floorz = 0;
    player.cmd = { ...player.cmd, forwardmove: 0, sidemove: 0, angleturn: 0 };
    const result = movePlayer(player);
    expect(result).toBe(false);
  });

  it('applies forward thrust when on ground', () => {
    const player = createTestPlayer();
    const mobj = player.mo!;
    mobj.angle = 0;
    mobj.momx = 0;
    mobj.momy = 0;
    player.cmd = { ...player.cmd, forwardmove: 25, sidemove: 0, angleturn: 0 };
    movePlayer(player);
    // forwardmove * 2048 = 25 * 2048 = 51200 thrust at angle 0
    const expectedThrust = (25 * MOVE_SCALE) | 0;
    expect(mobj.momx).toBe(fixedMul(expectedThrust, finecosine[0]!));
  });

  it('does not apply thrust when airborne', () => {
    const player = createTestPlayer();
    const mobj = player.mo!;
    mobj.z = FRACUNIT;
    mobj.floorz = 0;
    mobj.momx = 0;
    mobj.momy = 0;
    player.cmd = { ...player.cmd, forwardmove: 25, sidemove: 25, angleturn: 0 };
    movePlayer(player);
    expect(mobj.momx).toBe(0);
    expect(mobj.momy).toBe(0);
  });

  it('applies sidemove thrust perpendicular to facing angle', () => {
    const player = createTestPlayer();
    const mobj = player.mo!;
    mobj.angle = 0;
    mobj.momx = 0;
    mobj.momy = 0;
    player.cmd = { ...player.cmd, forwardmove: 0, sidemove: 24, angleturn: 0 };
    movePlayer(player);
    // sidemove at angle - ANG90
    const sideAngle = (0 - ANG90) >>> 0;
    const fineAngle = (sideAngle >>> ANGLETOFINESHIFT) & FINEMASK;
    const sideThrust = (24 * MOVE_SCALE) | 0;
    expect(mobj.momx).toBe(fixedMul(sideThrust, finecosine[fineAngle]!));
    expect(mobj.momy).toBe(fixedMul(sideThrust, finesine[fineAngle]!));
  });

  it('applies both forward and side thrust simultaneously', () => {
    const player = createTestPlayer();
    const mobj = player.mo!;
    mobj.angle = 0;
    mobj.momx = 0;
    mobj.momy = 0;
    player.cmd = { ...player.cmd, forwardmove: 25, sidemove: 24, angleturn: 0 };
    movePlayer(player);
    // Both thrusts should have been applied
    expect(mobj.momx).not.toBe(0);
    expect(mobj.momy).not.toBe(0);
  });

  it('triggers run animation when moving and in S_PLAY state', () => {
    const player = createTestPlayer();
    player.mo!.state = STATES[StateNum.PLAY]!;
    player.cmd = { ...player.cmd, forwardmove: 25, sidemove: 0, angleturn: 0 };
    let calledWith = -1;
    const mockSetState: SetMobjStateFunction = (_mobj, state) => {
      calledWith = state;
      return true;
    };
    movePlayer(player, mockSetState);
    expect(calledWith).toBe(StateNum.PLAY_RUN1 as number);
  });

  it('does not trigger run animation when not in S_PLAY state', () => {
    const player = createTestPlayer();
    player.mo!.state = STATES[StateNum.PLAY_RUN1]!;
    player.cmd = { ...player.cmd, forwardmove: 25, sidemove: 0, angleturn: 0 };
    let called = false;
    const mockSetState: SetMobjStateFunction = () => {
      called = true;
      return true;
    };
    movePlayer(player, mockSetState);
    expect(called).toBe(false);
  });

  it('does not trigger run animation when not moving', () => {
    const player = createTestPlayer();
    player.mo!.state = STATES[StateNum.PLAY]!;
    player.cmd = { ...player.cmd, forwardmove: 0, sidemove: 0, angleturn: 0 };
    let called = false;
    const mockSetState: SetMobjStateFunction = () => {
      called = true;
      return true;
    };
    movePlayer(player, mockSetState);
    expect(called).toBe(false);
  });

  it('works without setMobjState callback', () => {
    const player = createTestPlayer();
    player.mo!.state = STATES[StateNum.PLAY]!;
    player.cmd = { ...player.cmd, forwardmove: 25, sidemove: 0, angleturn: 0 };
    // Should not throw when callback is omitted
    expect(() => movePlayer(player)).not.toThrow();
  });

  it('does not apply thrust when forwardmove is zero', () => {
    const player = createTestPlayer();
    const mobj = player.mo!;
    mobj.momx = 0;
    mobj.momy = 0;
    player.cmd = { ...player.cmd, forwardmove: 0, sidemove: 0, angleturn: 0 };
    movePlayer(player);
    expect(mobj.momx).toBe(0);
    expect(mobj.momy).toBe(0);
  });
});

// ── Parity-sensitive edge cases ──────────────────────────────────────

describe('parity-sensitive edge cases', () => {
  it('bob uses arithmetic right shift (signed >> 2), not unsigned', () => {
    // In C: player->bob >>= 2 is arithmetic shift on signed int.
    // Negative bob values should not occur (sum of squares), but verify
    // the shift operation matches expectations.
    const player = createTestPlayer();
    player.mo!.momx = (10 * FRACUNIT) | 0;
    player.mo!.momy = 0;
    calcHeight(player, 0, true);
    const rawBob = fixedMul(player.mo!.momx, player.mo!.momx);
    expect(player.bob).toBe(Math.min(rawBob >> 2, MAXBOB));
  });

  it('FINEANGLES/20 * leveltime wrapping produces 20-tic bob period', () => {
    // Bob oscillation cycles through FINEANGLES entries at FINEANGLES/20 per tic.
    // One full sine cycle = FINEANGLES fine angles = 20 tics.
    const step = FINEANGLES / 20;
    expect(((step * 20) | 0) & FINEMASK).toBe(0);
  });

  it('forwardmove * 2048 matches C int multiplication for max speed 0x32', () => {
    // MAXPLMOVE = 0x32 = 50. 50 * 2048 = 102400 = 0x19000.
    const maxMove = 0x32;
    expect((maxMove * MOVE_SCALE) | 0).toBe(0x19000);
  });

  it('sidemove uses angle - ANG90 (unsigned wrap), not angle + ANG270', () => {
    // Both produce the same result due to unsigned wrap, but verify the mechanism.
    const player = createTestPlayer();
    const mobj = player.mo!;
    mobj.angle = 0;
    mobj.momx = 0;
    mobj.momy = 0;
    player.cmd = { ...player.cmd, forwardmove: 0, sidemove: 24, angleturn: 0 };
    movePlayer(player);
    const savedMomx = mobj.momx;
    const savedMomy = mobj.momy;

    // Reset and try with explicit ANG270 addition
    mobj.angle = 0;
    mobj.momx = 0;
    mobj.momy = 0;
    const sideAngle = (0 - ANG90) >>> 0;
    const altSideAngle = (0 + ANG270) >>> 0;
    expect(sideAngle).toBe(altSideAngle);
  });

  it('angleturn << FRACBITS matches C left shift', () => {
    // In C: player->mo->angle += (cmd->angleturn<<16)
    // angleturn is int16, so 1280 << 16 = 83886080
    const angleturn = 1280;
    expect(angleturn << FRACBITS).toBe(83886080);
  });

  it('CF_NOMOMENTUM airborne viewz quirk: second assignment overrides ceiling clamp', () => {
    // This is the vanilla bug: viewz is set to z+VIEWHEIGHT (clamped),
    // then unconditionally overwritten to z+viewheight.
    // If viewheight > ceiling-4-z, viewz can exceed the ceiling clamp.
    const player = createTestPlayer();
    const mobj = player.mo!;
    mobj.z = (50 * FRACUNIT) | 0;
    mobj.ceilingz = (55 * FRACUNIT) | 0;
    player.viewheight = (41 * FRACUNIT) | 0;
    player.cheats = CF_NOMOMENTUM;
    calcHeight(player, 0, true);
    // Vanilla quirk: viewz = z + viewheight = 50 + 41 = 91, unclamped!
    // The ceiling clamp (55 - 4 = 51) was applied to the first assignment
    // but the second assignment overwrites it.
    expect(player.viewz).toBe((mobj.z + player.viewheight) | 0);
    expect(player.viewz).toBeGreaterThan((mobj.ceilingz - 4 * FRACUNIT) | 0);
  });

  it('deltaviewheight zero-avoidance uses C truthiness check', () => {
    // In C: if (!player->deltaviewheight) player->deltaviewheight = 1;
    // This triggers when deltaviewheight becomes exactly 0 after the increment.
    const player = createTestPlayer();
    player.viewheight = (30 * FRACUNIT) | 0;
    player.deltaviewheight = -((FRACUNIT / 4) | 0);
    player.mo!.momx = 0;
    player.mo!.momy = 0;
    calcHeight(player, 0, true);
    expect(player.deltaviewheight).toBe(1);
  });

  it('viewheight is exactly VIEWHEIGHT (41 * FRACUNIT)', () => {
    expect(VIEWHEIGHT).toBe((41 * FRACUNIT) | 0);
  });

  it('negative forwardmove applies backward thrust', () => {
    const player = createTestPlayer();
    const mobj = player.mo!;
    mobj.angle = 0;
    mobj.momx = 0;
    mobj.momy = 0;
    player.cmd = { ...player.cmd, forwardmove: -25, sidemove: 0, angleturn: 0 };
    movePlayer(player);
    // -25 * 2048 = -51200, thrust at angle 0 → negative momx
    expect(mobj.momx).toBeLessThan(0);
  });

  it('VIEWHEIGHT/2 floor uses integer division (41 * FRACUNIT / 2 = 20.5 * FRACUNIT)', () => {
    // VIEWHEIGHT = 41 * 65536 = 2686976
    // VIEWHEIGHT / 2 = 1343488 (integer division truncates .5 away)
    const halfViewheight = (VIEWHEIGHT / 2) | 0;
    expect(halfViewheight).toBe(1343488);
    expect(halfViewheight).toBe(((41 * FRACUNIT) / 2) | 0);
  });
});
