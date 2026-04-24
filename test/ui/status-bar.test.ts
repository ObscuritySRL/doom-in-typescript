import { describe, expect, it } from 'bun:test';

import type { Angle } from '../../src/core/angle.ts';
import { ANG45, ANG180 } from '../../src/core/angle.ts';
import type { Fixed } from '../../src/core/fixed.ts';

import { AM_NOAMMO, AmmoType, CardType, NUMAMMO, NUMCARDS, NUMPOWERS, NUMWEAPONS, PlayerState, PowerType, WEAPON_INFO, WeaponType, WP_NOCHANGE, createPlayer } from '../../src/player/playerSpawn.ts';

import type { Player } from '../../src/player/playerSpawn.ts';

import { MAXPLAYERS, Mobj } from '../../src/world/mobj.ts';

import { ST_DEADFACE_INDEX, ST_FACESTRIDE, ST_GODFACE_INDEX, ST_NUMPAINFACES, ST_NUMSTRAIGHTFACES, ST_NUMTURNFACES } from '../../src/ui/assets.ts';

import {
  ST_EVILGRINCOUNT,
  ST_EVILGRINOFFSET,
  ST_FACE_PRIORITY_DEAD,
  ST_FACE_PRIORITY_EVIL_GRIN,
  ST_FACE_PRIORITY_INVUL,
  ST_FACE_PRIORITY_LOOK,
  ST_FACE_PRIORITY_OWN_PAIN,
  ST_FACE_PRIORITY_PAIN,
  ST_FACE_PRIORITY_RAMPAGE,
  ST_LARGEAMMO,
  ST_LAST_ATTACK_DOWN_IDLE,
  ST_MUCHPAIN,
  ST_NUM_ARMS_SLOTS,
  ST_NUM_KEY_BOXES,
  ST_OUCHCOUNT,
  ST_OUCHOFFSET,
  ST_RAMPAGEDELAY,
  ST_RAMPAGEOFFSET,
  ST_STRAIGHTFACECOUNT,
  ST_TURNCOUNT,
  ST_TURNOFFSET,
  calcPainOffset,
  computeStatusBarValues,
  createStatusBarState,
  tickFaceWidget,
  tickStatusBar,
  updateKeyBoxes,
} from '../../src/ui/statusBar.ts';

import type { FaceWidgetState, FaceWidgetTickContext, StatusBarState, StatusBarValuesContext } from '../../src/ui/statusBar.ts';

// ── Test helpers ─────────────────────────────────────────────────────

function makeMobj(x: Fixed = 0, y: Fixed = 0, angle: Angle = 0): Mobj {
  const mo = new Mobj();
  mo.x = x;
  mo.y = y;
  mo.angle = angle;
  return mo;
}

function makePlayer(overrides: Partial<Player> = {}): Player {
  const player = createPlayer();
  player.health = 100;
  player.mo = makeMobj();
  Object.assign(player, overrides);
  return player;
}

const NOOP_POINT_TO_ANGLE2 = (_x1: Fixed, _y1: Fixed, _x2: Fixed, _y2: Fixed): Angle => 0;

function makeCtx(player: Player, overrides: Partial<FaceWidgetTickContext> = {}): FaceWidgetTickContext {
  return {
    player,
    godMode: false,
    randomNumber: 0,
    pointToAngle2: NOOP_POINT_TO_ANGLE2,
    ...overrides,
  };
}

// ── Constants ────────────────────────────────────────────────────────

describe('status bar constants', () => {
  it('ST_STRAIGHTFACECOUNT is TICRATE/2 = 17 (not 35)', () => {
    expect(ST_STRAIGHTFACECOUNT).toBe(17);
  });

  it('ST_TURNCOUNT is 1 * TICRATE = 35', () => {
    expect(ST_TURNCOUNT).toBe(35);
  });

  it('ST_OUCHCOUNT is 1 * TICRATE = 35', () => {
    expect(ST_OUCHCOUNT).toBe(35);
  });

  it('ST_EVILGRINCOUNT is 2 * TICRATE = 70', () => {
    expect(ST_EVILGRINCOUNT).toBe(70);
  });

  it('ST_RAMPAGEDELAY is 2 * TICRATE = 70', () => {
    expect(ST_RAMPAGEDELAY).toBe(70);
  });

  it('ST_MUCHPAIN threshold is 20', () => {
    expect(ST_MUCHPAIN).toBe(20);
  });

  it('face-row offsets match vanilla layout', () => {
    expect(ST_TURNOFFSET).toBe(ST_NUMSTRAIGHTFACES);
    expect(ST_OUCHOFFSET).toBe(ST_NUMSTRAIGHTFACES + ST_NUMTURNFACES);
    expect(ST_EVILGRINOFFSET).toBe(ST_NUMSTRAIGHTFACES + ST_NUMTURNFACES + 1);
    expect(ST_RAMPAGEOFFSET).toBe(ST_NUMSTRAIGHTFACES + ST_NUMTURNFACES + 2);
  });

  it('priority ladder has the exact vanilla values (0/4/5/6/7/8/9)', () => {
    expect(ST_FACE_PRIORITY_LOOK).toBe(0);
    expect(ST_FACE_PRIORITY_INVUL).toBe(4);
    expect(ST_FACE_PRIORITY_RAMPAGE).toBe(5);
    expect(ST_FACE_PRIORITY_OWN_PAIN).toBe(6);
    expect(ST_FACE_PRIORITY_PAIN).toBe(7);
    expect(ST_FACE_PRIORITY_EVIL_GRIN).toBe(8);
    expect(ST_FACE_PRIORITY_DEAD).toBe(9);
  });

  it('widget sentinels and slot counts match vanilla', () => {
    expect(ST_LARGEAMMO).toBe(1994);
    expect(ST_NUM_KEY_BOXES).toBe(3);
    expect(ST_NUM_ARMS_SLOTS).toBe(6);
    expect(ST_LAST_ATTACK_DOWN_IDLE).toBe(-1);
  });
});

// ── createStatusBarState ─────────────────────────────────────────────

describe('createStatusBarState', () => {
  it('seeds oldWeaponsOwned from the player (vanilla ST_initData)', () => {
    const player = makePlayer();
    player.weaponowned[WeaponType.FIST] = true;
    player.weaponowned[WeaponType.PISTOL] = true;
    player.weaponowned[WeaponType.CHAINSAW] = true;
    const state = createStatusBarState(player);
    expect(state.face.oldWeaponsOwned).toEqual(player.weaponowned);
    expect(state.face.oldWeaponsOwned).not.toBe(player.weaponowned);
  });

  it('initializes face with priority 0, count 0, index 0', () => {
    const state = createStatusBarState(makePlayer());
    expect(state.face.priority).toBe(ST_FACE_PRIORITY_LOOK);
    expect(state.face.faceCount).toBe(0);
    expect(state.face.faceIndex).toBe(0);
  });

  it('seeds lastAttackDown to -1 (idle sentinel)', () => {
    const state = createStatusBarState(makePlayer());
    expect(state.face.lastAttackDown).toBe(ST_LAST_ATTACK_DOWN_IDLE);
  });

  it('seeds oldHealth to -1 so first-tic ouch branch never fires from construction', () => {
    const state = createStatusBarState(makePlayer());
    expect(state.face.oldHealth).toBe(-1);
  });

  it('seeds painOffset cache to (0, -1) so first calcPainOffset always recomputes', () => {
    const state = createStatusBarState(makePlayer());
    expect(state.face.painOffsetLastCalc).toBe(0);
    expect(state.face.painOffsetLastHealth).toBe(-1);
  });

  it('fills all key boxes with -1 (no key seen)', () => {
    const state = createStatusBarState(makePlayer());
    expect(state.keyBoxes).toHaveLength(ST_NUM_KEY_BOXES);
    for (const slot of state.keyBoxes) {
      expect(slot).toBe(-1);
    }
  });

  it('throws RangeError when player.weaponowned length is wrong', () => {
    const player = makePlayer();
    player.weaponowned = [true];
    expect(() => createStatusBarState(player)).toThrow(RangeError);
  });
});

// ── calcPainOffset ───────────────────────────────────────────────────

describe('calcPainOffset', () => {
  function mkState(): FaceWidgetState {
    return createStatusBarState(makePlayer()).face;
  }

  it('returns 0 * ST_FACESTRIDE at full health (100)', () => {
    expect(calcPainOffset(mkState(), 100)).toBe(0);
  });

  it('returns ST_FACESTRIDE * 4 at health 0 (most hurt row)', () => {
    expect(calcPainOffset(mkState(), 0)).toBe(ST_FACESTRIDE * 4);
  });

  it('clamps health > 100 to 100', () => {
    const s = mkState();
    expect(calcPainOffset(s, 150)).toBe(0);
    expect(calcPainOffset(s, 200)).toBe(0);
  });

  it('matches vanilla formula floor((100-h) * NUMPAINFACES / 101) at each transition', () => {
    const cases: Array<[number, number]> = [
      [100, 0],
      [80, 0],
      [79, 1],
      [60, 1],
      [59, 2],
      [40, 2],
      [39, 3],
      [20, 3],
      [19, 4],
      [1, 4],
      [0, 4],
    ];
    for (const [health, expectedLevel] of cases) {
      const s = mkState();
      expect(calcPainOffset(s, health)).toBe(ST_FACESTRIDE * expectedLevel);
    }
  });

  it('caches the result for repeat calls with the same clamped health', () => {
    const state = mkState();
    calcPainOffset(state, 50);
    const cachedValue = state.painOffsetLastCalc;
    state.painOffsetLastCalc = 9999;
    const second = calcPainOffset(state, 50);
    expect(second).toBe(9999);
    expect(state.painOffsetLastCalc).toBe(9999);
    expect(cachedValue).toBe(ST_FACESTRIDE * 2);
  });

  it('two different health values that clamp to 100 share the cache', () => {
    const state = mkState();
    calcPainOffset(state, 150);
    state.painOffsetLastCalc = 9999;
    expect(calcPainOffset(state, 200)).toBe(9999);
  });

  it('recomputes after a health change', () => {
    const state = mkState();
    calcPainOffset(state, 100);
    state.painOffsetLastCalc = 9999;
    expect(calcPainOffset(state, 50)).toBe(ST_FACESTRIDE * 2);
  });
});

// ── tickFaceWidget: dead branch ──────────────────────────────────────

describe('tickFaceWidget — dead branch', () => {
  it('sets dead face at priority 9 when health === 0', () => {
    const player = makePlayer({ health: 0 });
    const state = createStatusBarState(player);
    tickFaceWidget(state.face, makeCtx(player));
    expect(state.face.priority).toBe(ST_FACE_PRIORITY_DEAD);
    expect(state.face.faceIndex).toBe(ST_DEADFACE_INDEX);
  });

  it('does not fire dead branch if priority is already >= 10 (unreachable in vanilla, but guards against external bumps)', () => {
    const player = makePlayer({ health: 0 });
    const state = createStatusBarState(player);
    state.face.priority = 10;
    state.face.faceIndex = 123;
    state.face.faceCount = 5;
    tickFaceWidget(state.face, makeCtx(player));
    expect(state.face.faceIndex).toBe(123);
  });

  it('dead face survives the faceCount decrement to remain selected next tic', () => {
    const player = makePlayer({ health: 0 });
    const state = createStatusBarState(player);
    tickFaceWidget(state.face, makeCtx(player));
    expect(state.face.faceIndex).toBe(ST_DEADFACE_INDEX);
    tickFaceWidget(state.face, makeCtx(player));
    expect(state.face.priority).toBe(ST_FACE_PRIORITY_DEAD);
    expect(state.face.faceIndex).toBe(ST_DEADFACE_INDEX);
  });
});

// ── tickFaceWidget: evil grin branch ─────────────────────────────────

describe('tickFaceWidget — evil grin branch', () => {
  it('fires when bonuscount > 0 and a new weapon was added', () => {
    const player = makePlayer({ bonuscount: 1 });
    const state = createStatusBarState(player);
    player.weaponowned[WeaponType.SHOTGUN] = true;
    tickFaceWidget(state.face, makeCtx(player));
    expect(state.face.priority).toBe(ST_FACE_PRIORITY_EVIL_GRIN);
    expect(state.face.faceCount).toBe(ST_EVILGRINCOUNT - 1);
    expect(state.face.faceIndex).toBe(calcPainOffset(state.face, player.health) + ST_EVILGRINOFFSET);
  });

  it('does NOT fire when bonuscount is 0 (even if weapons changed externally)', () => {
    const player = makePlayer({ bonuscount: 0 });
    const state = createStatusBarState(player);
    player.weaponowned[WeaponType.SHOTGUN] = true;
    tickFaceWidget(state.face, makeCtx(player));
    expect(state.face.priority).not.toBe(ST_FACE_PRIORITY_EVIL_GRIN);
  });

  it('does NOT fire when bonuscount is set but no weapon change (bare item pickup)', () => {
    const player = makePlayer({ bonuscount: 1 });
    const state = createStatusBarState(player);
    tickFaceWidget(state.face, makeCtx(player));
    expect(state.face.priority).not.toBe(ST_FACE_PRIORITY_EVIL_GRIN);
  });

  it('syncs oldWeaponsOwned to the player so a second tic does not re-fire', () => {
    const player = makePlayer({ bonuscount: 1 });
    const state = createStatusBarState(player);
    player.weaponowned[WeaponType.SHOTGUN] = true;
    tickFaceWidget(state.face, makeCtx(player));
    expect(state.face.oldWeaponsOwned[WeaponType.SHOTGUN]).toBe(true);

    state.face.priority = ST_FACE_PRIORITY_LOOK;
    state.face.faceCount = 1;
    tickFaceWidget(state.face, makeCtx(player));
    expect(state.face.priority).not.toBe(ST_FACE_PRIORITY_EVIL_GRIN);
  });

  it('does not fire on first tic when player already owns starting weapons (no spurious grin)', () => {
    const player = makePlayer({ bonuscount: 1 });
    player.weaponowned[WeaponType.FIST] = true;
    player.weaponowned[WeaponType.PISTOL] = true;
    const state = createStatusBarState(player);
    tickFaceWidget(state.face, makeCtx(player));
    expect(state.face.priority).not.toBe(ST_FACE_PRIORITY_EVIL_GRIN);
  });

  it('is locked out when dead-face priority (9) is already set', () => {
    const player = makePlayer({ bonuscount: 1, health: 0 });
    const state = createStatusBarState(player);
    player.weaponowned[WeaponType.SHOTGUN] = true;
    tickFaceWidget(state.face, makeCtx(player));
    expect(state.face.priority).toBe(ST_FACE_PRIORITY_DEAD);
    expect(state.face.faceIndex).toBe(ST_DEADFACE_INDEX);
  });
});

// ── tickFaceWidget: attacker-pain branch ─────────────────────────────

describe('tickFaceWidget — attacker-pain branch', () => {
  it('does not fire when attacker is the player themselves (self-damage) — own-pain fires instead', () => {
    const player = makePlayer({ damagecount: 10 });
    player.attacker = player.mo;
    const state = createStatusBarState(player);
    state.face.oldHealth = player.health;
    let angleCalls = 0;
    const ctx = makeCtx(player, {
      pointToAngle2: () => {
        angleCalls++;
        return 0 as Angle;
      },
    });
    tickFaceWidget(state.face, ctx);
    expect(angleCalls).toBe(0);
    expect(state.face.priority).toBe(ST_FACE_PRIORITY_OWN_PAIN);
  });

  it('does not fire when there is no attacker — own-pain fires instead', () => {
    const player = makePlayer({ damagecount: 10 });
    player.attacker = null;
    const state = createStatusBarState(player);
    state.face.oldHealth = player.health;
    let angleCalls = 0;
    const ctx = makeCtx(player, {
      pointToAngle2: () => {
        angleCalls++;
        return 0 as Angle;
      },
    });
    tickFaceWidget(state.face, ctx);
    expect(angleCalls).toBe(0);
    expect(state.face.priority).toBe(ST_FACE_PRIORITY_OWN_PAIN);
  });

  it('selects the rampage-offset face when diffAngle < ANG45 (attacker is ahead)', () => {
    const player = makePlayer({ damagecount: 10 });
    player.attacker = makeMobj(100, 0);
    if (player.mo !== null) player.mo.angle = 0;
    const state = createStatusBarState(player);
    state.face.oldHealth = player.health;
    const angleCtx = makeCtx(player, {
      pointToAngle2: () => 0 as Angle,
    });
    tickFaceWidget(state.face, angleCtx);
    expect(state.face.priority).toBe(ST_FACE_PRIORITY_PAIN);
    expect(state.face.faceCount).toBe(ST_TURNCOUNT - 1);
    expect(state.face.faceIndex).toBe(calcPainOffset(state.face, player.health) + ST_RAMPAGEOFFSET);
  });

  it('selects the turn face (right) when badGuyAngle > playerAngle and diff <= ANG180', () => {
    const player = makePlayer({ damagecount: 10 });
    player.attacker = makeMobj(100, 0);
    if (player.mo !== null) player.mo.angle = 0;
    const state = createStatusBarState(player);
    state.face.oldHealth = player.health;
    const ctx = makeCtx(player, { pointToAngle2: () => (ANG45 + ANG45) as Angle });
    tickFaceWidget(state.face, ctx);
    expect(state.face.faceIndex).toBe(calcPainOffset(state.face, player.health) + ST_TURNOFFSET + 1);
  });

  it('selects the turn face (left) when badGuyAngle > playerAngle and diff > ANG180', () => {
    const player = makePlayer({ damagecount: 10 });
    player.attacker = makeMobj(100, 0);
    if (player.mo !== null) player.mo.angle = 0;
    const state = createStatusBarState(player);
    state.face.oldHealth = player.health;
    const ctx = makeCtx(player, { pointToAngle2: () => ((ANG180 + ANG45 * 2) >>> 0) as Angle });
    tickFaceWidget(state.face, ctx);
    expect(state.face.faceIndex).toBe(calcPainOffset(state.face, player.health) + ST_TURNOFFSET);
  });

  it('selects the turn face (right) when playerAngle > badGuyAngle and diff > ANG180', () => {
    const player = makePlayer({ damagecount: 10 });
    player.attacker = makeMobj(100, 0);
    if (player.mo !== null) player.mo.angle = (ANG180 + ANG45 * 2) >>> 0;
    const state = createStatusBarState(player);
    state.face.oldHealth = player.health;
    const ctx = makeCtx(player, { pointToAngle2: () => 0 as Angle });
    tickFaceWidget(state.face, ctx);
    expect(state.face.faceIndex).toBe(calcPainOffset(state.face, player.health) + ST_TURNOFFSET + 1);
  });

  it('selects the turn face (left) when playerAngle > badGuyAngle and diff <= ANG180', () => {
    const player = makePlayer({ damagecount: 10 });
    player.attacker = makeMobj(100, 0);
    if (player.mo !== null) player.mo.angle = ANG45 * 2;
    const state = createStatusBarState(player);
    state.face.oldHealth = player.health;
    const ctx = makeCtx(player, { pointToAngle2: () => 0 as Angle });
    tickFaceWidget(state.face, ctx);
    expect(state.face.faceIndex).toBe(calcPainOffset(state.face, player.health) + ST_TURNOFFSET);
  });

  it('preserves the vanilla OUCH-face bug (fires on health INCREASE > 20, not damage)', () => {
    const player = makePlayer({ damagecount: 10, health: 50 });
    player.attacker = makeMobj(100, 0);
    const state = createStatusBarState(player);
    state.face.oldHealth = 20;
    tickFaceWidget(state.face, makeCtx(player));
    expect(state.face.faceIndex).toBe(calcPainOffset(state.face, player.health) + ST_OUCHOFFSET);
    expect(state.face.faceCount).toBe(ST_TURNCOUNT - 1);
  });

  it('does NOT fire ouch branch when taking real damage (health decrease) — vanilla bug', () => {
    const player = makePlayer({ damagecount: 10, health: 20 });
    player.attacker = makeMobj(100, 0);
    const state = createStatusBarState(player);
    state.face.oldHealth = 100;
    tickFaceWidget(state.face, makeCtx(player));
    expect(state.face.faceIndex).not.toBe(calcPainOffset(state.face, player.health) + ST_OUCHOFFSET);
  });

  it('sets priority = 7 even when the ouch branch does not fire (locks out own-pain)', () => {
    const player = makePlayer({ damagecount: 10, health: 50 });
    player.attacker = makeMobj(100, 0);
    const state = createStatusBarState(player);
    state.face.oldHealth = 60;
    tickFaceWidget(state.face, makeCtx(player));
    expect(state.face.priority).toBe(ST_FACE_PRIORITY_PAIN);
  });
});

// ── tickFaceWidget: own-pain branch ──────────────────────────────────

describe('tickFaceWidget — own-pain branch', () => {
  it('fires at priority 6 with rampage-offset face when damagecount > 0 and no attacker', () => {
    const player = makePlayer({ damagecount: 10, health: 50 });
    player.attacker = null;
    const state = createStatusBarState(player);
    state.face.oldHealth = 60;
    tickFaceWidget(state.face, makeCtx(player));
    expect(state.face.priority).toBe(ST_FACE_PRIORITY_OWN_PAIN);
    expect(state.face.faceCount).toBe(ST_TURNCOUNT - 1);
    expect(state.face.faceIndex).toBe(calcPainOffset(state.face, player.health) + ST_RAMPAGEOFFSET);
  });

  it('upgrades to priority 7 + OUCH face when health increases by > ST_MUCHPAIN with no attacker', () => {
    const player = makePlayer({ damagecount: 10, health: 50 });
    player.attacker = null;
    const state = createStatusBarState(player);
    state.face.oldHealth = 10;
    tickFaceWidget(state.face, makeCtx(player));
    expect(state.face.priority).toBe(ST_FACE_PRIORITY_PAIN);
    expect(state.face.faceIndex).toBe(calcPainOffset(state.face, player.health) + ST_OUCHOFFSET);
  });

  it('is locked out when attacker-pain already set priority 7 this tic', () => {
    const player = makePlayer({ damagecount: 10, health: 50 });
    player.attacker = makeMobj(100, 0);
    const state = createStatusBarState(player);
    state.face.oldHealth = 55;
    const ctx = makeCtx(player, { pointToAngle2: () => ANG180 as Angle });
    tickFaceWidget(state.face, ctx);
    expect(state.face.priority).toBe(ST_FACE_PRIORITY_PAIN);
    expect(state.face.faceIndex).not.toBe(calcPainOffset(state.face, player.health) + ST_RAMPAGEOFFSET);
  });

  it('does not fire when damagecount is 0', () => {
    const player = makePlayer({ damagecount: 0 });
    const state = createStatusBarState(player);
    tickFaceWidget(state.face, makeCtx(player));
    expect(state.face.priority).not.toBe(ST_FACE_PRIORITY_OWN_PAIN);
  });
});

// ── tickFaceWidget: rampage branch ───────────────────────────────────

describe('tickFaceWidget — rampage branch', () => {
  it('starts the rampage timer when attack is first pressed (lastAttackDown = idle)', () => {
    const player = makePlayer({ attackdown: true });
    const state = createStatusBarState(player);
    expect(state.face.lastAttackDown).toBe(ST_LAST_ATTACK_DOWN_IDLE);
    tickFaceWidget(state.face, makeCtx(player));
    expect(state.face.lastAttackDown).toBe(ST_RAMPAGEDELAY);
  });

  it('decrements the timer each subsequent tic while attack is held', () => {
    const player = makePlayer({ attackdown: true });
    const state = createStatusBarState(player);
    state.face.lastAttackDown = 5;
    tickFaceWidget(state.face, makeCtx(player));
    expect(state.face.lastAttackDown).toBe(4);
    expect(state.face.priority).not.toBe(ST_FACE_PRIORITY_RAMPAGE);
  });

  it('fires rampage face at priority 5 when the timer hits 0, then resets to 1', () => {
    const player = makePlayer({ attackdown: true });
    const state = createStatusBarState(player);
    state.face.lastAttackDown = 1;
    tickFaceWidget(state.face, makeCtx(player));
    expect(state.face.priority).toBe(ST_FACE_PRIORITY_RAMPAGE);
    expect(state.face.faceIndex).toBe(calcPainOffset(state.face, player.health) + ST_RAMPAGEOFFSET);
    expect(state.face.faceCount).toBe(0);
    expect(state.face.lastAttackDown).toBe(1);
  });

  it('resets timer to idle when attack is released', () => {
    const player = makePlayer({ attackdown: false });
    const state = createStatusBarState(player);
    state.face.lastAttackDown = 50;
    tickFaceWidget(state.face, makeCtx(player));
    expect(state.face.lastAttackDown).toBe(ST_LAST_ATTACK_DOWN_IDLE);
  });

  it('is locked out by own-pain (priority 6)', () => {
    const player = makePlayer({ attackdown: true, damagecount: 10, health: 50 });
    player.attacker = null;
    const state = createStatusBarState(player);
    state.face.oldHealth = 55;
    tickFaceWidget(state.face, makeCtx(player));
    expect(state.face.priority).toBe(ST_FACE_PRIORITY_OWN_PAIN);
  });
});

// ── tickFaceWidget: invulnerability branch ───────────────────────────

describe('tickFaceWidget — invulnerability branch', () => {
  it('shows the god face when cheats & CF_GODMODE is set (godMode ctx flag)', () => {
    const player = makePlayer();
    const state = createStatusBarState(player);
    tickFaceWidget(state.face, makeCtx(player, { godMode: true }));
    expect(state.face.priority).toBe(ST_FACE_PRIORITY_INVUL);
    expect(state.face.faceIndex).toBe(ST_GODFACE_INDEX);
    expect(state.face.faceCount).toBe(0);
  });

  it('shows the god face when powers[INVULNERABILITY] > 0', () => {
    const player = makePlayer();
    player.powers[PowerType.INVULNERABILITY] = 10;
    const state = createStatusBarState(player);
    tickFaceWidget(state.face, makeCtx(player));
    expect(state.face.priority).toBe(ST_FACE_PRIORITY_INVUL);
    expect(state.face.faceIndex).toBe(ST_GODFACE_INDEX);
  });

  it('is locked out by rampage (priority 5)', () => {
    const player = makePlayer({ attackdown: true });
    player.powers[PowerType.INVULNERABILITY] = 10;
    const state = createStatusBarState(player);
    state.face.lastAttackDown = 1;
    tickFaceWidget(state.face, makeCtx(player));
    expect(state.face.priority).toBe(ST_FACE_PRIORITY_RAMPAGE);
    expect(state.face.faceIndex).not.toBe(ST_GODFACE_INDEX);
  });

  it('is locked out by dead (priority 9)', () => {
    const player = makePlayer({ health: 0 });
    player.powers[PowerType.INVULNERABILITY] = 10;
    const state = createStatusBarState(player);
    tickFaceWidget(state.face, makeCtx(player, { godMode: true }));
    expect(state.face.priority).toBe(ST_FACE_PRIORITY_DEAD);
    expect(state.face.faceIndex).toBe(ST_DEADFACE_INDEX);
  });
});

// ── tickFaceWidget: look / face-count timeout branch ─────────────────

describe('tickFaceWidget — look (face-count timeout) branch', () => {
  it('picks a straight face indexed by randomNumber % ST_NUMSTRAIGHTFACES when count hits 0', () => {
    const player = makePlayer();
    const state = createStatusBarState(player);
    tickFaceWidget(state.face, makeCtx(player, { randomNumber: 0 }));
    expect(state.face.priority).toBe(ST_FACE_PRIORITY_LOOK);
    expect(state.face.faceIndex).toBe(calcPainOffset(state.face, player.health) + 0);
  });

  it('cycles across all three straight-face slots based on randomNumber modulo', () => {
    for (let rn = 0; rn < ST_NUMSTRAIGHTFACES; rn++) {
      const player = makePlayer();
      const state = createStatusBarState(player);
      tickFaceWidget(state.face, makeCtx(player, { randomNumber: rn }));
      expect(state.face.faceIndex).toBe(calcPainOffset(state.face, player.health) + rn);
    }
  });

  it('resets the count to ST_STRAIGHTFACECOUNT (17) then decrements to 16 before returning', () => {
    const player = makePlayer();
    const state = createStatusBarState(player);
    tickFaceWidget(state.face, makeCtx(player));
    expect(state.face.faceCount).toBe(ST_STRAIGHTFACECOUNT - 1);
  });

  it('does NOT fire when faceCount was > 0 coming in (still counting down an existing face)', () => {
    const player = makePlayer();
    const state = createStatusBarState(player);
    state.face.faceCount = 5;
    state.face.priority = 3;
    state.face.faceIndex = 42;
    tickFaceWidget(state.face, makeCtx(player, { randomNumber: 1 }));
    expect(state.face.faceIndex).toBe(42);
    expect(state.face.faceCount).toBe(4);
    expect(state.face.priority).toBe(3);
  });
});

// ── tickFaceWidget: oldHealth snapshot ───────────────────────────────

describe('tickFaceWidget — oldHealth snapshot', () => {
  it('updates oldHealth to the current health at the end of the tic', () => {
    const player = makePlayer({ health: 75 });
    const state = createStatusBarState(player);
    tickFaceWidget(state.face, makeCtx(player));
    expect(state.face.oldHealth).toBe(75);
  });

  it('snapshot runs even if the dead branch fired', () => {
    const player = makePlayer({ health: 0 });
    const state = createStatusBarState(player);
    tickFaceWidget(state.face, makeCtx(player));
    expect(state.face.oldHealth).toBe(0);
  });

  it('drives the next-tic ouch / much-pain delta check', () => {
    const player = makePlayer({ health: 100 });
    const state = createStatusBarState(player);
    tickFaceWidget(state.face, makeCtx(player));

    player.health = 60;
    player.damagecount = 10;
    player.attacker = null;
    state.face.priority = ST_FACE_PRIORITY_LOOK;
    state.face.faceCount = 1;
    tickFaceWidget(state.face, makeCtx(player));
    expect(state.face.priority).toBe(ST_FACE_PRIORITY_OWN_PAIN);
  });
});

// ── updateKeyBoxes ───────────────────────────────────────────────────

describe('updateKeyBoxes', () => {
  it('places a keycard index into its matching slot', () => {
    const player = makePlayer();
    const state = createStatusBarState(player);
    player.cards[CardType.REDCARD] = true;
    updateKeyBoxes(state, player);
    expect(state.keyBoxes[CardType.REDCARD]).toBe(CardType.REDCARD);
  });

  it('places a skull index (i + 3) into its matching slot when the card is absent', () => {
    const player = makePlayer();
    const state = createStatusBarState(player);
    player.cards[CardType.BLUESKULL] = true;
    updateKeyBoxes(state, player);
    expect(state.keyBoxes[CardType.BLUECARD]).toBe(CardType.BLUESKULL);
  });

  it('skull OVERWRITES keycard value when both are held (vanilla: skull check runs second)', () => {
    const player = makePlayer();
    const state = createStatusBarState(player);
    player.cards[CardType.REDCARD] = true;
    player.cards[CardType.REDSKULL] = true;
    updateKeyBoxes(state, player);
    expect(state.keyBoxes[CardType.REDCARD]).toBe(CardType.REDSKULL);
  });

  it('leaves -1 in slots where the player has neither card nor skull of that color', () => {
    const player = makePlayer();
    const state = createStatusBarState(player);
    player.cards[CardType.BLUECARD] = true;
    updateKeyBoxes(state, player);
    expect(state.keyBoxes[CardType.BLUECARD]).toBe(CardType.BLUECARD);
    expect(state.keyBoxes[CardType.YELLOWCARD]).toBe(-1);
    expect(state.keyBoxes[CardType.REDCARD]).toBe(-1);
  });

  it('retains a previously-seen key forever (never resets to -1 after card removal)', () => {
    const player = makePlayer();
    const state = createStatusBarState(player);
    player.cards[CardType.YELLOWCARD] = true;
    updateKeyBoxes(state, player);
    expect(state.keyBoxes[CardType.YELLOWCARD]).toBe(CardType.YELLOWCARD);

    player.cards[CardType.YELLOWCARD] = false;
    updateKeyBoxes(state, player);
    expect(state.keyBoxes[CardType.YELLOWCARD]).toBe(CardType.YELLOWCARD);
  });

  it('card→skull upgrade is sticky: skull value persists when both are dropped', () => {
    const player = makePlayer();
    const state = createStatusBarState(player);
    player.cards[CardType.BLUECARD] = true;
    player.cards[CardType.BLUESKULL] = true;
    updateKeyBoxes(state, player);
    expect(state.keyBoxes[CardType.BLUECARD]).toBe(CardType.BLUESKULL);

    for (let i = 0; i < NUMCARDS; i++) {
      player.cards[i] = false;
    }
    updateKeyBoxes(state, player);
    expect(state.keyBoxes[CardType.BLUECARD]).toBe(CardType.BLUESKULL);
  });

  it('updates only three slots (blue=0, yellow=1, red=2), not six', () => {
    const player = makePlayer();
    const state = createStatusBarState(player);
    for (let i = 0; i < NUMCARDS; i++) {
      player.cards[i] = true;
    }
    updateKeyBoxes(state, player);
    expect(state.keyBoxes).toHaveLength(ST_NUM_KEY_BOXES);
  });
});

// ── tickStatusBar ────────────────────────────────────────────────────

describe('tickStatusBar', () => {
  it('runs both updateKeyBoxes and tickFaceWidget in one call', () => {
    const player = makePlayer({ health: 0 });
    player.cards[CardType.REDCARD] = true;
    const state = createStatusBarState(player);
    tickStatusBar(state, makeCtx(player));
    expect(state.keyBoxes[CardType.REDCARD]).toBe(CardType.REDCARD);
    expect(state.face.priority).toBe(ST_FACE_PRIORITY_DEAD);
    expect(state.face.faceIndex).toBe(ST_DEADFACE_INDEX);
  });

  it('per-tic oldHealth snapshot still runs through the combined tick', () => {
    const player = makePlayer({ health: 42 });
    const state = createStatusBarState(player);
    tickStatusBar(state, makeCtx(player));
    expect(state.face.oldHealth).toBe(42);
  });
});

// ── computeStatusBarValues ───────────────────────────────────────────

function makeValuesCtx(player: Player, overrides: Partial<StatusBarValuesContext> = {}): StatusBarValuesContext {
  const state = overrides.state ?? createStatusBarState(player);
  return {
    state,
    player,
    deathmatch: false,
    statusBarOn: true,
    consolePlayer: 0,
    ...overrides,
  };
}

describe('computeStatusBarValues — ready ammo', () => {
  it('returns ST_LARGEAMMO (1994) for the fist (am_noammo)', () => {
    const player = makePlayer({ readyweapon: WeaponType.FIST });
    const v = computeStatusBarValues(makeValuesCtx(player));
    expect(v.ready).toBe(ST_LARGEAMMO);
  });

  it('returns ST_LARGEAMMO for the chainsaw (am_noammo)', () => {
    const player = makePlayer({ readyweapon: WeaponType.CHAINSAW });
    const v = computeStatusBarValues(makeValuesCtx(player));
    expect(v.ready).toBe(ST_LARGEAMMO);
  });

  it('returns the current clip count for the pistol (am_clip)', () => {
    const player = makePlayer({ readyweapon: WeaponType.PISTOL });
    player.ammo[AmmoType.CLIP] = 42;
    const v = computeStatusBarValues(makeValuesCtx(player));
    expect(v.ready).toBe(42);
  });

  it('returns the current shell count for the shotgun (am_shell)', () => {
    const player = makePlayer({ readyweapon: WeaponType.SHOTGUN });
    player.ammo[AmmoType.SHELL] = 13;
    const v = computeStatusBarValues(makeValuesCtx(player));
    expect(v.ready).toBe(13);
  });

  it('returns the current cell count for the BFG (am_cell)', () => {
    const player = makePlayer({ readyweapon: WeaponType.BFG });
    player.ammo[AmmoType.CELL] = 200;
    const v = computeStatusBarValues(makeValuesCtx(player));
    expect(v.ready).toBe(200);
  });
});

describe('computeStatusBarValues — frag math', () => {
  it('sums opponents frags and subtracts self-frags (suicides reduce displayed total)', () => {
    const player = makePlayer();
    player.frags[0] = 2;
    player.frags[1] = 5;
    player.frags[2] = 3;
    player.frags[3] = 1;
    const v = computeStatusBarValues(makeValuesCtx(player, { consolePlayer: 0 }));
    expect(v.frags).toBe(5 + 3 + 1 - 2);
  });

  it('zero all-around → frags = 0', () => {
    const v = computeStatusBarValues(makeValuesCtx(makePlayer()));
    expect(v.frags).toBe(0);
  });

  it('self-only frags produce a negative total', () => {
    const player = makePlayer();
    player.frags[2] = 4;
    const v = computeStatusBarValues(makeValuesCtx(player, { consolePlayer: 2 }));
    expect(v.frags).toBe(-4);
  });
});

describe('computeStatusBarValues — visibility flags', () => {
  it('fragsVisible only when statusBarOn && deathmatch', () => {
    const player = makePlayer();
    expect(computeStatusBarValues(makeValuesCtx(player, { statusBarOn: true, deathmatch: true })).fragsVisible).toBe(true);
    expect(computeStatusBarValues(makeValuesCtx(player, { statusBarOn: true, deathmatch: false })).fragsVisible).toBe(false);
    expect(computeStatusBarValues(makeValuesCtx(player, { statusBarOn: false, deathmatch: true })).fragsVisible).toBe(false);
    expect(computeStatusBarValues(makeValuesCtx(player, { statusBarOn: false, deathmatch: false })).fragsVisible).toBe(false);
  });

  it('armsVisible only when statusBarOn && !deathmatch', () => {
    const player = makePlayer();
    expect(computeStatusBarValues(makeValuesCtx(player, { statusBarOn: true, deathmatch: false })).armsVisible).toBe(true);
    expect(computeStatusBarValues(makeValuesCtx(player, { statusBarOn: true, deathmatch: true })).armsVisible).toBe(false);
    expect(computeStatusBarValues(makeValuesCtx(player, { statusBarOn: false, deathmatch: false })).armsVisible).toBe(false);
  });
});

describe('computeStatusBarValues — arms / ammo / maxammo / keyBoxes / faceIndex', () => {
  it('armsOwned mirrors weaponowned[1..6] (pistol..BFG), skipping fist', () => {
    const player = makePlayer();
    player.weaponowned[WeaponType.PISTOL] = true;
    player.weaponowned[WeaponType.SHOTGUN] = true;
    player.weaponowned[WeaponType.BFG] = true;
    const v = computeStatusBarValues(makeValuesCtx(player));
    expect(v.armsOwned).toHaveLength(ST_NUM_ARMS_SLOTS);
    expect(v.armsOwned[0]).toBe(true);
    expect(v.armsOwned[1]).toBe(true);
    expect(v.armsOwned[2]).toBe(false);
    expect(v.armsOwned[3]).toBe(false);
    expect(v.armsOwned[4]).toBe(false);
    expect(v.armsOwned[5]).toBe(true);
  });

  it('currentAmmo mirrors player.ammo (length 4)', () => {
    const player = makePlayer();
    player.ammo = [10, 20, 30, 40];
    const v = computeStatusBarValues(makeValuesCtx(player));
    expect(v.currentAmmo).toEqual([10, 20, 30, 40]);
    expect(v.currentAmmo).toHaveLength(NUMAMMO);
  });

  it('maxAmmo mirrors player.maxammo (length 4)', () => {
    const player = makePlayer();
    player.maxammo = [200, 50, 300, 50];
    const v = computeStatusBarValues(makeValuesCtx(player));
    expect(v.maxAmmo).toEqual([200, 50, 300, 50]);
    expect(v.maxAmmo).toHaveLength(NUMAMMO);
  });

  it('keyBoxes are snapshotted (changing state after the call does not mutate snapshot)', () => {
    const player = makePlayer();
    const state = createStatusBarState(player);
    player.cards[CardType.REDCARD] = true;
    updateKeyBoxes(state, player);
    const v = computeStatusBarValues(makeValuesCtx(player, { state }));
    expect(v.keyBoxes[CardType.REDCARD]).toBe(CardType.REDCARD);
    state.keyBoxes[CardType.REDCARD] = -99;
    expect(v.keyBoxes[CardType.REDCARD]).toBe(CardType.REDCARD);
  });

  it('faceIndex tracks state.face.faceIndex', () => {
    const player = makePlayer({ health: 0 });
    const state = createStatusBarState(player);
    tickFaceWidget(state.face, makeCtx(player));
    const v = computeStatusBarValues(makeValuesCtx(player, { state }));
    expect(v.faceIndex).toBe(ST_DEADFACE_INDEX);
  });

  it('health, armor, armorType mirror the player', () => {
    const player = makePlayer({ health: 73 });
    player.armorpoints = 88;
    player.armortype = 2;
    const v = computeStatusBarValues(makeValuesCtx(player));
    expect(v.health).toBe(73);
    expect(v.armor).toBe(88);
    expect(v.armorType).toBe(2);
  });

  it('returned object is frozen (immutable snapshot)', () => {
    const v = computeStatusBarValues(makeValuesCtx(makePlayer()));
    expect(Object.isFrozen(v)).toBe(true);
    expect(Object.isFrozen(v.armsOwned)).toBe(true);
    expect(Object.isFrozen(v.currentAmmo)).toBe(true);
    expect(Object.isFrozen(v.maxAmmo)).toBe(true);
    expect(Object.isFrozen(v.keyBoxes)).toBe(true);
  });
});
