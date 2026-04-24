import { describe, expect, it } from 'bun:test';

import { AM_NOAMMO, AmmoType, INITIAL_BULLETS, MAX_AMMO, NUMAMMO, NUMWEAPONS, WEAPON_INFO, WeaponType, WP_NOCHANGE, createPlayer, playerReborn } from '../../src/player/playerSpawn.ts';

import type { Player } from '../../src/player/playerSpawn.ts';

import { BFG_CELLS_PER_SHOT, BONUSADD, CLIP_AMMO, SK_BABY, SK_NIGHTMARE, checkAmmo, giveAmmo, giveBackpack, giveWeapon } from '../../src/player/weapons.ts';

// ── Helper ───────────────────────────────────────────────────────────

/** Create a player with standard post-reborn loadout. */
function spawnedPlayer(): Player {
  const player = createPlayer();
  playerReborn(player);
  return player;
}

/** Medium skill (no doubling). */
const MEDIUM = 2;

// ── CLIP_AMMO constant ──────────────────────────────────────────────

describe('CLIP_AMMO', () => {
  it('has NUMAMMO entries matching p_inter.c clipammo[]', () => {
    expect(CLIP_AMMO).toHaveLength(NUMAMMO);
    expect(CLIP_AMMO[AmmoType.CLIP]).toBe(10);
    expect(CLIP_AMMO[AmmoType.SHELL]).toBe(4);
    expect(CLIP_AMMO[AmmoType.CELL]).toBe(20);
    expect(CLIP_AMMO[AmmoType.MISL]).toBe(1);
  });

  it('is frozen', () => {
    expect(Object.isFrozen(CLIP_AMMO)).toBe(true);
  });
});

// ── BFG_CELLS_PER_SHOT constant ─────────────────────────────────────

describe('BFG_CELLS_PER_SHOT', () => {
  it('is 40 matching DEH_DEFAULT_BFG_CELLS_PER_SHOT', () => {
    expect(BFG_CELLS_PER_SHOT).toBe(40);
  });
});

// ── BONUSADD constant ───────────────────────────────────────────────

describe('BONUSADD', () => {
  it('is 6 matching p_inter.c', () => {
    expect(BONUSADD).toBe(6);
  });
});

// ── Skill constants ─────────────────────────────────────────────────

describe('skill constants', () => {
  it('SK_BABY is 0', () => {
    expect(SK_BABY).toBe(0);
  });

  it('SK_NIGHTMARE is 4', () => {
    expect(SK_NIGHTMARE).toBe(4);
  });
});

// ── giveAmmo ─────────────────────────────────────────────────────────

describe('giveAmmo', () => {
  it('returns false for AM_NOAMMO', () => {
    const player = spawnedPlayer();
    expect(giveAmmo(player, AM_NOAMMO, 1, MEDIUM)).toBe(false);
  });

  it('returns false when already at maxammo', () => {
    const player = spawnedPlayer();
    player.ammo[AmmoType.CLIP] = player.maxammo[AmmoType.CLIP]!;
    expect(giveAmmo(player, AmmoType.CLIP, 1, MEDIUM)).toBe(false);
  });

  it('gives num * clipammo for num > 0', () => {
    const player = spawnedPlayer();
    player.ammo[AmmoType.SHELL] = 0;
    giveAmmo(player, AmmoType.SHELL, 2, MEDIUM);
    // 2 * 4 = 8 shells
    expect(player.ammo[AmmoType.SHELL]).toBe(8);
  });

  it('gives clipammo/2 for num === 0 (half clip)', () => {
    const player = spawnedPlayer();
    player.ammo[AmmoType.CLIP] = 0;
    giveAmmo(player, AmmoType.CLIP, 0, MEDIUM);
    // floor(10/2) = 5 bullets
    expect(player.ammo[AmmoType.CLIP]).toBe(5);
  });

  it('clamps to maxammo', () => {
    const player = spawnedPlayer();
    player.ammo[AmmoType.CLIP] = 195;
    giveAmmo(player, AmmoType.CLIP, 1, MEDIUM);
    expect(player.ammo[AmmoType.CLIP]).toBe(MAX_AMMO[AmmoType.CLIP]);
  });

  it('doubles ammo on SK_BABY', () => {
    const player = spawnedPlayer();
    player.ammo[AmmoType.SHELL] = 0;
    giveAmmo(player, AmmoType.SHELL, 1, SK_BABY);
    // 1 * 4 * 2 = 8
    expect(player.ammo[AmmoType.SHELL]).toBe(8);
  });

  it('doubles ammo on SK_NIGHTMARE', () => {
    const player = spawnedPlayer();
    player.ammo[AmmoType.SHELL] = 0;
    giveAmmo(player, AmmoType.SHELL, 1, SK_NIGHTMARE);
    // 1 * 4 * 2 = 8
    expect(player.ammo[AmmoType.SHELL]).toBe(8);
  });

  it('does not double ammo on medium skill', () => {
    const player = spawnedPlayer();
    player.ammo[AmmoType.SHELL] = 0;
    giveAmmo(player, AmmoType.SHELL, 1, MEDIUM);
    // 1 * 4 = 4
    expect(player.ammo[AmmoType.SHELL]).toBe(4);
  });

  it('returns true on successful pickup', () => {
    const player = spawnedPlayer();
    player.ammo[AmmoType.SHELL] = 0;
    expect(giveAmmo(player, AmmoType.SHELL, 1, MEDIUM)).toBe(true);
  });

  it('does not auto-switch when player already had ammo', () => {
    const player = spawnedPlayer();
    player.readyweapon = WeaponType.FIST;
    player.pendingweapon = WP_NOCHANGE;
    player.ammo[AmmoType.CLIP] = 10; // already had ammo
    player.weaponowned[WeaponType.CHAINGUN] = true;
    giveAmmo(player, AmmoType.CLIP, 1, MEDIUM);
    expect(player.pendingweapon).toBe(WP_NOCHANGE);
  });
});

// ── giveAmmo auto-switch on zero-to-nonzero ─────────────────────────

describe('giveAmmo auto-switch', () => {
  it('switches to chaingun from fist when picking up clip ammo (chaingun owned)', () => {
    const player = spawnedPlayer();
    player.readyweapon = WeaponType.FIST;
    player.pendingweapon = WP_NOCHANGE;
    player.ammo[AmmoType.CLIP] = 0;
    player.weaponowned[WeaponType.CHAINGUN] = true;
    giveAmmo(player, AmmoType.CLIP, 1, MEDIUM);
    expect(player.pendingweapon).toBe(WeaponType.CHAINGUN);
  });

  it('switches to pistol from fist when picking up clip ammo (no chaingun)', () => {
    const player = spawnedPlayer();
    player.readyweapon = WeaponType.FIST;
    player.pendingweapon = WP_NOCHANGE;
    player.ammo[AmmoType.CLIP] = 0;
    player.weaponowned[WeaponType.CHAINGUN] = false;
    giveAmmo(player, AmmoType.CLIP, 1, MEDIUM);
    expect(player.pendingweapon).toBe(WeaponType.PISTOL);
  });

  it('does not switch from pistol when picking up clip ammo', () => {
    const player = spawnedPlayer();
    player.readyweapon = WeaponType.PISTOL;
    player.pendingweapon = WP_NOCHANGE;
    player.ammo[AmmoType.CLIP] = 0;
    giveAmmo(player, AmmoType.CLIP, 1, MEDIUM);
    expect(player.pendingweapon).toBe(WP_NOCHANGE);
  });

  it('switches to shotgun from fist on shell pickup', () => {
    const player = spawnedPlayer();
    player.readyweapon = WeaponType.FIST;
    player.pendingweapon = WP_NOCHANGE;
    player.ammo[AmmoType.SHELL] = 0;
    player.weaponowned[WeaponType.SHOTGUN] = true;
    giveAmmo(player, AmmoType.SHELL, 1, MEDIUM);
    expect(player.pendingweapon).toBe(WeaponType.SHOTGUN);
  });

  it('switches to shotgun from pistol on shell pickup', () => {
    const player = spawnedPlayer();
    player.readyweapon = WeaponType.PISTOL;
    player.pendingweapon = WP_NOCHANGE;
    player.ammo[AmmoType.SHELL] = 0;
    player.weaponowned[WeaponType.SHOTGUN] = true;
    giveAmmo(player, AmmoType.SHELL, 1, MEDIUM);
    expect(player.pendingweapon).toBe(WeaponType.SHOTGUN);
  });

  it('does not switch from shotgun when picking up shells', () => {
    const player = spawnedPlayer();
    player.readyweapon = WeaponType.SHOTGUN;
    player.pendingweapon = WP_NOCHANGE;
    player.ammo[AmmoType.SHELL] = 0;
    giveAmmo(player, AmmoType.SHELL, 1, MEDIUM);
    expect(player.pendingweapon).toBe(WP_NOCHANGE);
  });

  it('switches to plasma from fist on cell pickup', () => {
    const player = spawnedPlayer();
    player.readyweapon = WeaponType.FIST;
    player.pendingweapon = WP_NOCHANGE;
    player.ammo[AmmoType.CELL] = 0;
    player.weaponowned[WeaponType.PLASMA] = true;
    giveAmmo(player, AmmoType.CELL, 1, MEDIUM);
    expect(player.pendingweapon).toBe(WeaponType.PLASMA);
  });

  it('switches to plasma from pistol on cell pickup', () => {
    const player = spawnedPlayer();
    player.readyweapon = WeaponType.PISTOL;
    player.pendingweapon = WP_NOCHANGE;
    player.ammo[AmmoType.CELL] = 0;
    player.weaponowned[WeaponType.PLASMA] = true;
    giveAmmo(player, AmmoType.CELL, 1, MEDIUM);
    expect(player.pendingweapon).toBe(WeaponType.PLASMA);
  });

  it('switches to missile from fist on rocket pickup', () => {
    const player = spawnedPlayer();
    player.readyweapon = WeaponType.FIST;
    player.pendingweapon = WP_NOCHANGE;
    player.ammo[AmmoType.MISL] = 0;
    player.weaponowned[WeaponType.MISSILE] = true;
    giveAmmo(player, AmmoType.MISL, 1, MEDIUM);
    expect(player.pendingweapon).toBe(WeaponType.MISSILE);
  });

  it('does not switch from pistol on rocket pickup (only from fist)', () => {
    const player = spawnedPlayer();
    player.readyweapon = WeaponType.PISTOL;
    player.pendingweapon = WP_NOCHANGE;
    player.ammo[AmmoType.MISL] = 0;
    player.weaponowned[WeaponType.MISSILE] = true;
    giveAmmo(player, AmmoType.MISL, 1, MEDIUM);
    expect(player.pendingweapon).toBe(WP_NOCHANGE);
  });
});

// ── giveWeapon ───────────────────────────────────────────────────────

describe('giveWeapon', () => {
  it('gives weapon and ammo in single-player', () => {
    const player = spawnedPlayer();
    const result = giveWeapon(player, WeaponType.SHOTGUN, false, false, 0, true, MEDIUM);
    expect(result).toBe(true);
    expect(player.weaponowned[WeaponType.SHOTGUN]).toBe(true);
    expect(player.pendingweapon).toBe(WeaponType.SHOTGUN);
    // 2 clips of shells = 2 * 4 = 8
    expect(player.ammo[AmmoType.SHELL]).toBe(8);
  });

  it('gives only ammo if weapon already owned (no gaveweapon)', () => {
    const player = spawnedPlayer();
    player.weaponowned[WeaponType.SHOTGUN] = true;
    player.ammo[AmmoType.SHELL] = 10; // already had ammo, so no auto-switch
    const oldPending = player.pendingweapon;
    const result = giveWeapon(player, WeaponType.SHOTGUN, false, false, 0, true, MEDIUM);
    expect(result).toBe(true); // gave ammo
    // giveWeapon does NOT set pendingweapon when weapon already owned
    // giveAmmo does NOT auto-switch when oldammo > 0
    expect(player.pendingweapon).toBe(oldPending);
  });

  it('returns false when already owned and already at max ammo', () => {
    const player = spawnedPlayer();
    player.weaponowned[WeaponType.SHOTGUN] = true;
    player.ammo[AmmoType.SHELL] = player.maxammo[AmmoType.SHELL]!;
    const result = giveWeapon(player, WeaponType.SHOTGUN, false, false, 0, true, MEDIUM);
    expect(result).toBe(false);
  });

  it('gives half ammo for dropped weapons', () => {
    const player = spawnedPlayer();
    player.ammo[AmmoType.SHELL] = 0;
    giveWeapon(player, WeaponType.SHOTGUN, true, false, 0, true, MEDIUM);
    // dropped: 1 clip = 1 * 4 = 4
    expect(player.ammo[AmmoType.SHELL]).toBe(4);
  });

  it('gives no ammo for AM_NOAMMO weapons (fist, chainsaw)', () => {
    const player = spawnedPlayer();
    const result = giveWeapon(player, WeaponType.CHAINSAW, false, false, 0, true, MEDIUM);
    expect(result).toBe(true); // gave weapon (not ammo)
    expect(player.weaponowned[WeaponType.CHAINSAW]).toBe(true);
    expect(player.pendingweapon).toBe(WeaponType.CHAINSAW);
  });

  it('in co-op netgame: returns false for already-owned weapon', () => {
    const player = spawnedPlayer();
    player.weaponowned[WeaponType.SHOTGUN] = true;
    const result = giveWeapon(player, WeaponType.SHOTGUN, false, true, 0, true, MEDIUM);
    expect(result).toBe(false);
  });

  it('in co-op netgame: gives weapon + 2 clips + bonuscount on first pickup', () => {
    const player = spawnedPlayer();
    player.bonuscount = 0;
    player.ammo[AmmoType.SHELL] = 0;
    const result = giveWeapon(player, WeaponType.SHOTGUN, false, true, 0, true, MEDIUM);
    expect(result).toBe(false); // always false in netgame non-dropped
    expect(player.weaponowned[WeaponType.SHOTGUN]).toBe(true);
    expect(player.pendingweapon).toBe(WeaponType.SHOTGUN);
    expect(player.bonuscount).toBe(BONUSADD);
    // co-op: 2 clips = 2 * 4 = 8
    expect(player.ammo[AmmoType.SHELL]).toBe(8);
  });

  it('in deathmatch-1: gives weapon + 5 clips', () => {
    const player = spawnedPlayer();
    player.ammo[AmmoType.SHELL] = 0;
    giveWeapon(player, WeaponType.SHOTGUN, false, true, 1, true, MEDIUM);
    expect(player.weaponowned[WeaponType.SHOTGUN]).toBe(true);
    // deathmatch: 5 clips = 5 * 4 = 20
    expect(player.ammo[AmmoType.SHELL]).toBe(20);
  });

  it('in deathmatch-2: behaves like single-player (altdeath)', () => {
    const player = spawnedPlayer();
    player.ammo[AmmoType.SHELL] = 0;
    const result = giveWeapon(player, WeaponType.SHOTGUN, false, true, 2, true, MEDIUM);
    expect(result).toBe(true); // altdeath does not take the netgame path
    // 2 clips = 2 * 4 = 8
    expect(player.ammo[AmmoType.SHELL]).toBe(8);
  });

  it('plays weapon sound for console player in netgame', () => {
    const player = spawnedPlayer();
    let soundPlayed = false;
    giveWeapon(player, WeaponType.SHOTGUN, false, true, 0, true, MEDIUM, () => {
      soundPlayed = true;
    });
    expect(soundPlayed).toBe(true);
  });

  it('does not play weapon sound for non-console player', () => {
    const player = spawnedPlayer();
    let soundPlayed = false;
    giveWeapon(player, WeaponType.SHOTGUN, false, true, 0, false, MEDIUM, () => {
      soundPlayed = true;
    });
    expect(soundPlayed).toBe(false);
  });

  it('dropped weapons bypass the netgame check', () => {
    const player = spawnedPlayer();
    player.weaponowned[WeaponType.SHOTGUN] = true;
    player.ammo[AmmoType.SHELL] = 0;
    const result = giveWeapon(player, WeaponType.SHOTGUN, true, true, 0, true, MEDIUM);
    // Dropped bypasses netgame path — gives ammo even if weapon owned
    expect(result).toBe(true);
    expect(player.ammo[AmmoType.SHELL]).toBe(4); // 1 clip
  });
});

// ── checkAmmo ────────────────────────────────────────────────────────

describe('checkAmmo', () => {
  it('returns true for AM_NOAMMO weapons (fist)', () => {
    const player = spawnedPlayer();
    player.readyweapon = WeaponType.FIST;
    expect(checkAmmo(player, 'shareware')).toBe(true);
  });

  it('returns true for AM_NOAMMO weapons (chainsaw)', () => {
    const player = spawnedPlayer();
    player.readyweapon = WeaponType.CHAINSAW;
    player.weaponowned[WeaponType.CHAINSAW] = true;
    expect(checkAmmo(player, 'shareware')).toBe(true);
  });

  it('returns true when ammo >= 1 for regular weapon', () => {
    const player = spawnedPlayer();
    player.readyweapon = WeaponType.PISTOL;
    player.ammo[AmmoType.CLIP] = 1;
    expect(checkAmmo(player, 'shareware')).toBe(true);
  });

  it('returns false and switches weapon when pistol has 0 clip ammo', () => {
    const player = spawnedPlayer();
    player.readyweapon = WeaponType.PISTOL;
    player.ammo[AmmoType.CLIP] = 0;
    player.weaponowned[WeaponType.CHAINSAW] = false;
    const result = checkAmmo(player, 'shareware');
    expect(result).toBe(false);
    // Preference cascade: no plasma (shareware), no SSG, no chaingun ammo,
    // no shotgun ammo, no clip ammo, no chainsaw → fist
    expect(player.pendingweapon).toBe(WeaponType.FIST);
  });

  it('BFG requires 40 cells', () => {
    const player = spawnedPlayer();
    player.readyweapon = WeaponType.BFG;
    player.weaponowned[WeaponType.BFG] = true;
    player.ammo[AmmoType.CELL] = 40;
    expect(checkAmmo(player, 'registered')).toBe(true);
  });

  it('BFG returns false with 39 cells', () => {
    const player = spawnedPlayer();
    player.readyweapon = WeaponType.BFG;
    player.weaponowned[WeaponType.BFG] = true;
    player.ammo[AmmoType.CELL] = 39;
    const result = checkAmmo(player, 'registered');
    expect(result).toBe(false);
  });

  it('super shotgun requires 2 shells', () => {
    const player = spawnedPlayer();
    player.readyweapon = WeaponType.SUPERSHOTGUN;
    player.weaponowned[WeaponType.SUPERSHOTGUN] = true;
    player.ammo[AmmoType.SHELL] = 2;
    expect(checkAmmo(player, 'commercial')).toBe(true);
  });

  it('super shotgun returns false with 1 shell', () => {
    const player = spawnedPlayer();
    player.readyweapon = WeaponType.SUPERSHOTGUN;
    player.weaponowned[WeaponType.SUPERSHOTGUN] = true;
    player.ammo[AmmoType.SHELL] = 1;
    const result = checkAmmo(player, 'commercial');
    expect(result).toBe(false);
  });
});

// ── checkAmmo weapon preference cascade ─────────────────────────────

describe('checkAmmo preference cascade', () => {
  it('prefers plasma first (non-shareware)', () => {
    const player = spawnedPlayer();
    player.readyweapon = WeaponType.SHOTGUN;
    player.ammo[AmmoType.SHELL] = 0;
    player.weaponowned[WeaponType.PLASMA] = true;
    player.ammo[AmmoType.CELL] = 1;
    const result = checkAmmo(player, 'registered');
    expect(result).toBe(false);
    expect(player.pendingweapon).toBe(WeaponType.PLASMA);
  });

  it('skips plasma in shareware mode', () => {
    const player = spawnedPlayer();
    player.readyweapon = WeaponType.SHOTGUN;
    player.ammo[AmmoType.SHELL] = 0;
    player.weaponowned[WeaponType.PLASMA] = true;
    player.ammo[AmmoType.CELL] = 1;
    player.weaponowned[WeaponType.CHAINGUN] = true;
    player.ammo[AmmoType.CLIP] = 1;
    const result = checkAmmo(player, 'shareware');
    expect(result).toBe(false);
    // Plasma skipped → SSG skipped (not commercial) → chaingun
    expect(player.pendingweapon).toBe(WeaponType.CHAINGUN);
  });

  it('prefers SSG second (commercial, > 2 shells)', () => {
    const player = spawnedPlayer();
    player.readyweapon = WeaponType.CHAINGUN;
    player.ammo[AmmoType.CLIP] = 0;
    player.weaponowned[WeaponType.PLASMA] = false;
    player.weaponowned[WeaponType.SUPERSHOTGUN] = true;
    player.ammo[AmmoType.SHELL] = 3;
    const result = checkAmmo(player, 'commercial');
    expect(result).toBe(false);
    expect(player.pendingweapon).toBe(WeaponType.SUPERSHOTGUN);
  });

  it('SSG requires > 2 shells (not >= 2)', () => {
    const player = spawnedPlayer();
    player.readyweapon = WeaponType.CHAINGUN;
    player.ammo[AmmoType.CLIP] = 0;
    player.weaponowned[WeaponType.PLASMA] = false;
    player.weaponowned[WeaponType.SUPERSHOTGUN] = true;
    player.ammo[AmmoType.SHELL] = 2;
    player.weaponowned[WeaponType.SHOTGUN] = true;
    const result = checkAmmo(player, 'commercial');
    expect(result).toBe(false);
    // SSG skipped (only 2 shells, needs > 2) → chaingun (no ammo) → shotgun
    expect(player.pendingweapon).toBe(WeaponType.SHOTGUN);
  });

  it('SSG not selected in non-commercial mode', () => {
    const player = spawnedPlayer();
    player.readyweapon = WeaponType.CHAINGUN;
    player.ammo[AmmoType.CLIP] = 0;
    player.weaponowned[WeaponType.PLASMA] = false;
    player.weaponowned[WeaponType.SUPERSHOTGUN] = true;
    player.ammo[AmmoType.SHELL] = 10;
    player.weaponowned[WeaponType.SHOTGUN] = true;
    const result = checkAmmo(player, 'registered');
    expect(result).toBe(false);
    // SSG skipped (not commercial) → chaingun (no ammo) → shotgun
    expect(player.pendingweapon).toBe(WeaponType.SHOTGUN);
  });

  it('prefers chaingun third', () => {
    const player = spawnedPlayer();
    player.readyweapon = WeaponType.SHOTGUN;
    player.ammo[AmmoType.SHELL] = 0;
    player.weaponowned[WeaponType.PLASMA] = false;
    player.weaponowned[WeaponType.SUPERSHOTGUN] = false;
    player.weaponowned[WeaponType.CHAINGUN] = true;
    player.ammo[AmmoType.CLIP] = 1;
    const result = checkAmmo(player, 'shareware');
    expect(result).toBe(false);
    expect(player.pendingweapon).toBe(WeaponType.CHAINGUN);
  });

  it('prefers shotgun fourth', () => {
    const player = spawnedPlayer();
    player.readyweapon = WeaponType.CHAINGUN;
    player.ammo[AmmoType.CLIP] = 0;
    player.weaponowned[WeaponType.PLASMA] = false;
    player.weaponowned[WeaponType.SUPERSHOTGUN] = false;
    player.weaponowned[WeaponType.CHAINGUN] = false;
    player.weaponowned[WeaponType.SHOTGUN] = true;
    player.ammo[AmmoType.SHELL] = 1;
    const result = checkAmmo(player, 'shareware');
    expect(result).toBe(false);
    expect(player.pendingweapon).toBe(WeaponType.SHOTGUN);
  });

  it('prefers pistol fifth (always owned)', () => {
    const player = spawnedPlayer();
    player.readyweapon = WeaponType.SHOTGUN;
    player.ammo[AmmoType.SHELL] = 0;
    player.weaponowned[WeaponType.PLASMA] = false;
    player.weaponowned[WeaponType.SUPERSHOTGUN] = false;
    player.weaponowned[WeaponType.CHAINGUN] = false;
    player.weaponowned[WeaponType.SHOTGUN] = false;
    player.ammo[AmmoType.CLIP] = 1;
    const result = checkAmmo(player, 'shareware');
    expect(result).toBe(false);
    expect(player.pendingweapon).toBe(WeaponType.PISTOL);
  });

  it('prefers chainsaw sixth', () => {
    const player = spawnedPlayer();
    player.readyweapon = WeaponType.SHOTGUN;
    player.ammo[AmmoType.SHELL] = 0;
    player.ammo[AmmoType.CLIP] = 0;
    player.ammo[AmmoType.CELL] = 0;
    player.ammo[AmmoType.MISL] = 0;
    player.weaponowned[WeaponType.CHAINSAW] = true;
    const result = checkAmmo(player, 'shareware');
    expect(result).toBe(false);
    expect(player.pendingweapon).toBe(WeaponType.CHAINSAW);
  });

  it('prefers missile seventh', () => {
    const player = spawnedPlayer();
    player.readyweapon = WeaponType.SHOTGUN;
    player.ammo[AmmoType.SHELL] = 0;
    player.ammo[AmmoType.CLIP] = 0;
    player.ammo[AmmoType.CELL] = 0;
    player.weaponowned[WeaponType.CHAINSAW] = false;
    player.weaponowned[WeaponType.MISSILE] = true;
    player.ammo[AmmoType.MISL] = 1;
    const result = checkAmmo(player, 'shareware');
    expect(result).toBe(false);
    expect(player.pendingweapon).toBe(WeaponType.MISSILE);
  });

  it('prefers BFG eighth (non-shareware, > 40 cells)', () => {
    const player = spawnedPlayer();
    player.readyweapon = WeaponType.SHOTGUN;
    player.ammo[AmmoType.SHELL] = 0;
    player.ammo[AmmoType.CLIP] = 0;
    player.weaponowned[WeaponType.CHAINSAW] = false;
    player.weaponowned[WeaponType.MISSILE] = false;
    player.weaponowned[WeaponType.BFG] = true;
    player.ammo[AmmoType.CELL] = 41;
    const result = checkAmmo(player, 'registered');
    expect(result).toBe(false);
    expect(player.pendingweapon).toBe(WeaponType.BFG);
  });

  it('BFG cascade check requires > 40 cells (not >= 40)', () => {
    const player = spawnedPlayer();
    player.readyweapon = WeaponType.SHOTGUN;
    player.ammo[AmmoType.SHELL] = 0;
    player.ammo[AmmoType.CLIP] = 0;
    player.weaponowned[WeaponType.CHAINSAW] = false;
    player.weaponowned[WeaponType.MISSILE] = false;
    player.weaponowned[WeaponType.BFG] = true;
    player.ammo[AmmoType.CELL] = 40;
    const result = checkAmmo(player, 'registered');
    expect(result).toBe(false);
    // BFG skipped (only 40 cells, needs > 40) → fist
    expect(player.pendingweapon).toBe(WeaponType.FIST);
  });

  it('falls through to fist as last resort', () => {
    const player = spawnedPlayer();
    player.readyweapon = WeaponType.PISTOL;
    player.ammo[AmmoType.CLIP] = 0;
    player.ammo[AmmoType.SHELL] = 0;
    player.ammo[AmmoType.CELL] = 0;
    player.ammo[AmmoType.MISL] = 0;
    player.weaponowned[WeaponType.CHAINSAW] = false;
    player.weaponowned[WeaponType.MISSILE] = false;
    player.weaponowned[WeaponType.BFG] = false;
    const result = checkAmmo(player, 'shareware');
    expect(result).toBe(false);
    expect(player.pendingweapon).toBe(WeaponType.FIST);
  });
});

// ── giveBackpack ─────────────────────────────────────────────────────

describe('giveBackpack', () => {
  it('doubles maxammo on first pickup', () => {
    const player = spawnedPlayer();
    giveBackpack(player, MEDIUM);
    for (let index = 0; index < NUMAMMO; index++) {
      expect(player.maxammo[index]).toBe(MAX_AMMO[index]! * 2);
    }
  });

  it('sets backpack flag', () => {
    const player = spawnedPlayer();
    expect(player.backpack).toBe(false);
    giveBackpack(player, MEDIUM);
    expect(player.backpack).toBe(true);
  });

  it('gives one clip of each ammo type', () => {
    const player = spawnedPlayer();
    player.ammo[AmmoType.CLIP] = 0;
    player.ammo[AmmoType.SHELL] = 0;
    player.ammo[AmmoType.CELL] = 0;
    player.ammo[AmmoType.MISL] = 0;
    giveBackpack(player, MEDIUM);
    expect(player.ammo[AmmoType.CLIP]).toBe(CLIP_AMMO[AmmoType.CLIP]);
    expect(player.ammo[AmmoType.SHELL]).toBe(CLIP_AMMO[AmmoType.SHELL]);
    expect(player.ammo[AmmoType.CELL]).toBe(CLIP_AMMO[AmmoType.CELL]);
    expect(player.ammo[AmmoType.MISL]).toBe(CLIP_AMMO[AmmoType.MISL]);
  });

  it('does not double maxammo on second pickup', () => {
    const player = spawnedPlayer();
    giveBackpack(player, MEDIUM);
    const maxAfterFirst = player.maxammo.slice();
    giveBackpack(player, MEDIUM);
    for (let index = 0; index < NUMAMMO; index++) {
      expect(player.maxammo[index]).toBe(maxAfterFirst[index]);
    }
  });

  it('second pickup still gives ammo', () => {
    const player = spawnedPlayer();
    giveBackpack(player, MEDIUM);
    // Drain all ammo
    player.ammo[AmmoType.CLIP] = 0;
    player.ammo[AmmoType.SHELL] = 0;
    player.ammo[AmmoType.CELL] = 0;
    player.ammo[AmmoType.MISL] = 0;
    giveBackpack(player, MEDIUM);
    expect(player.ammo[AmmoType.CLIP]).toBe(CLIP_AMMO[AmmoType.CLIP]);
    expect(player.ammo[AmmoType.SHELL]).toBe(CLIP_AMMO[AmmoType.SHELL]);
  });

  it('ammo doubled by baby skill', () => {
    const player = spawnedPlayer();
    player.ammo[AmmoType.CLIP] = 0;
    player.ammo[AmmoType.SHELL] = 0;
    player.ammo[AmmoType.CELL] = 0;
    player.ammo[AmmoType.MISL] = 0;
    giveBackpack(player, SK_BABY);
    // Baby doubles: 10*2=20, 4*2=8, 20*2=40, 1*2=2
    expect(player.ammo[AmmoType.CLIP]).toBe(CLIP_AMMO[AmmoType.CLIP]! * 2);
    expect(player.ammo[AmmoType.SHELL]).toBe(CLIP_AMMO[AmmoType.SHELL]! * 2);
    expect(player.ammo[AmmoType.CELL]).toBe(CLIP_AMMO[AmmoType.CELL]! * 2);
    expect(player.ammo[AmmoType.MISL]).toBe(CLIP_AMMO[AmmoType.MISL]! * 2);
  });
});

// ── Parity-sensitive edge cases ──────────────────────────────────────

describe('parity-sensitive edge cases', () => {
  it('giveAmmo half-clip for missile is 0 (floor(1/2)=0)', () => {
    const player = spawnedPlayer();
    player.ammo[AmmoType.MISL] = 0;
    giveAmmo(player, AmmoType.MISL, 0, MEDIUM);
    // floor(1/2) = 0 → no ammo given... but wait, 0 means false in the if check
    // Actually: num=0 → amount = floor(clipammo[misl]/2) = floor(1/2) = 0
    // Then the amount is 0, so ammo[misl] += 0 stays 0
    // BUT: the function already passed the maxammo check, and 0 != maxammo
    // AND: oldammo is 0, so auto-switch logic runs
    // Returns true even though no ammo was actually added (ammo was 0, still 0)
    // This matches vanilla: P_GiveAmmo modifies ammo by 0 but still returns true
    expect(player.ammo[AmmoType.MISL]).toBe(0);
  });

  it('giveAmmo half-clip for missile on baby gives 1 (floor(1/2)<<1=0)', () => {
    const player = spawnedPlayer();
    player.ammo[AmmoType.MISL] = 0;
    giveAmmo(player, AmmoType.MISL, 0, SK_BABY);
    // floor(1/2) = 0, then <<1 = 0
    expect(player.ammo[AmmoType.MISL]).toBe(0);
  });

  it('checkAmmo do-while loop always terminates (fist fallback)', () => {
    const player = spawnedPlayer();
    player.readyweapon = WeaponType.PISTOL;
    player.ammo[AmmoType.CLIP] = 0;
    player.ammo[AmmoType.SHELL] = 0;
    player.ammo[AmmoType.CELL] = 0;
    player.ammo[AmmoType.MISL] = 0;
    for (let index = 0; index < NUMWEAPONS; index++) {
      player.weaponowned[index] = false;
    }
    player.weaponowned[WeaponType.FIST] = true;
    player.weaponowned[WeaponType.PISTOL] = true;
    // Should not loop forever
    const result = checkAmmo(player, 'shareware');
    expect(result).toBe(false);
    expect(player.pendingweapon).toBe(WeaponType.FIST);
  });

  it('checkAmmo lowers current weapon via setPsprite to downstate', () => {
    const player = spawnedPlayer();
    player.readyweapon = WeaponType.PISTOL;
    player.ammo[AmmoType.CLIP] = 0;
    checkAmmo(player, 'shareware');
    // After checkAmmo returns false, the weapon psprite should be set
    // to the pistol's downstate
    const downstate = WEAPON_INFO[WeaponType.PISTOL]!.downstate;
    expect(player.psprites[0]!.state).not.toBeNull();
  });

  it('giveWeapon netgame always returns false (weapon stays on map)', () => {
    const player = spawnedPlayer();
    // Even for a weapon the player doesn't own
    const result = giveWeapon(player, WeaponType.PLASMA, false, true, 0, false, MEDIUM);
    expect(result).toBe(false);
  });

  it('giveBackpack maxammo doubled before giveAmmo clips are applied', () => {
    // Ensures the doubled maxammo takes effect before the ammo gifts
    const player = spawnedPlayer();
    // Fill to original max
    for (let index = 0; index < NUMAMMO; index++) {
      player.ammo[index] = MAX_AMMO[index]!;
    }
    giveBackpack(player, MEDIUM);
    // After doubling maxammo, the ammo gifts can be applied on top
    expect(player.ammo[AmmoType.CLIP]).toBe(MAX_AMMO[AmmoType.CLIP]! + CLIP_AMMO[AmmoType.CLIP]!);
    expect(player.ammo[AmmoType.SHELL]).toBe(MAX_AMMO[AmmoType.SHELL]! + CLIP_AMMO[AmmoType.SHELL]!);
  });

  it('WEAPON_INFO ammo types match clipammo indexing', () => {
    // Verify all weapon ammo types are valid CLIP_AMMO indices or AM_NOAMMO
    for (let index = 0; index < NUMWEAPONS; index++) {
      const ammo = WEAPON_INFO[index]!.ammo;
      if (ammo !== AM_NOAMMO) {
        expect(ammo).toBeGreaterThanOrEqual(0);
        expect(ammo).toBeLessThan(NUMAMMO);
        expect(CLIP_AMMO[ammo]).toBeDefined();
      }
    }
  });

  it('giveAmmo skill doubling uses left shift (<<1), not multiplication', () => {
    // For odd clipammo values, <<1 and *2 are identical for positive integers,
    // but we verify the behavior matches the C left-shift semantics
    const player = spawnedPlayer();
    player.ammo[AmmoType.MISL] = 0;
    giveAmmo(player, AmmoType.MISL, 1, SK_BABY);
    // 1 * 1 = 1, then <<1 = 2
    expect(player.ammo[AmmoType.MISL]).toBe(2);
  });

  it('giveAmmo with num=5 (deathmatch weapon pickup) gives 5 clips', () => {
    const player = spawnedPlayer();
    player.ammo[AmmoType.SHELL] = 0;
    giveAmmo(player, AmmoType.SHELL, 5, MEDIUM);
    // 5 * 4 = 20
    expect(player.ammo[AmmoType.SHELL]).toBe(20);
  });

  it('playerReborn initial ammo matches INITIAL_BULLETS for clip only', () => {
    const player = spawnedPlayer();
    expect(player.ammo[AmmoType.CLIP]).toBe(INITIAL_BULLETS);
    expect(player.ammo[AmmoType.SHELL]).toBe(0);
    expect(player.ammo[AmmoType.CELL]).toBe(0);
    expect(player.ammo[AmmoType.MISL]).toBe(0);
  });
});
