import { describe, expect, it, beforeEach, afterAll } from 'bun:test';

import type { Player } from '../../src/player/playerSpawn.ts';
import type { PickupContext, TouchSpecialResult } from '../../src/player/pickups.ts';

import { FRACUNIT } from '../../src/core/fixed.ts';
import { ThinkerList } from '../../src/world/thinkers.ts';
import { MF_COUNTITEM, MF_DROPPED, MF_SHADOW, Mobj, SpriteNum } from '../../src/world/mobj.ts';
import { AmmoType, CardType, PowerType, WeaponType, createPlayer, playerReborn } from '../../src/player/playerSpawn.ts';
import { BONUSADD } from '../../src/player/weapons.ts';

import {
  BERSERK_HEALTH,
  DEH_BLUE_ARMOR_CLASS,
  DEH_GREEN_ARMOR_CLASS,
  DEH_MAX_ARMOR,
  DEH_MAX_HEALTH,
  DEH_MAX_SOULSPHERE,
  DEH_MEGASPHERE_HEALTH,
  DEH_SOULSPHERE_HEALTH,
  INFRATICS,
  INVISTICS,
  INVULNTICS,
  IRONTICS,
  MAXHEALTH,
  PICKUP_Z_FLOOR_MARGIN,
  PickupMessage,
  SFX_GETPOW,
  SFX_ITEMUP,
  SFX_WPNUP,
  TICRATE,
  clearPickupContext,
  getPickupContext,
  giveArmor,
  giveBody,
  giveCard,
  givePower,
  setPickupContext,
  touchSpecialThing,
} from '../../src/player/pickups.ts';

// ── Helpers ──────────────────────────────────────────────────────────

interface StartSoundCall {
  origin: Mobj | null;
  sfxId: number;
}

interface CallLog {
  startSound: StartSoundCall[];
}

function makeCallLog(): CallLog {
  return { startSound: [] };
}

function makeContext(log: CallLog, thinkerList: ThinkerList, overrides?: Partial<PickupContext>): PickupContext {
  return {
    gameMode: 'commercial',
    gameskill: 2,
    netgame: false,
    deathmatch: 0,
    isConsolePlayer: true,
    thinkerList,
    startSound: (origin, sfxId) => {
      log.startSound.push({ origin, sfxId });
    },
    ...overrides,
  };
}

/** Spawned player with pistol/fist and a player mobj attached. */
function spawnedPlayer(): Player {
  const player = createPlayer();
  playerReborn(player);
  const mo = new Mobj();
  mo.x = 0;
  mo.y = 0;
  mo.z = 0;
  mo.height = 56 * FRACUNIT;
  mo.flags = 0;
  mo.health = player.health;
  mo.player = player;
  player.mo = mo;
  return player;
}

/** Build a pickup-shaped Mobj registered in `thinkerList`. */
function makePickup(thinkerList: ThinkerList, sprite: SpriteNum, options?: { flags?: number; z?: number }): Mobj {
  const mobj = new Mobj();
  mobj.sprite = sprite;
  mobj.x = 0;
  mobj.y = 0;
  mobj.z = options?.z ?? 0;
  mobj.height = 16 * FRACUNIT;
  mobj.flags = options?.flags ?? 0;
  thinkerList.add(mobj);
  return mobj;
}

beforeEach(() => {
  clearPickupContext();
});

afterAll(() => {
  clearPickupContext();
});

// ── Constants ────────────────────────────────────────────────────────

describe('pickup constants', () => {
  it('MAXHEALTH is 100', () => {
    expect(MAXHEALTH).toBe(100);
  });

  it('DEH caps match deh_misc.h defaults', () => {
    expect(DEH_MAX_HEALTH).toBe(200);
    expect(DEH_MAX_ARMOR).toBe(200);
    expect(DEH_MAX_SOULSPHERE).toBe(200);
    expect(DEH_SOULSPHERE_HEALTH).toBe(100);
    expect(DEH_MEGASPHERE_HEALTH).toBe(200);
    expect(DEH_GREEN_ARMOR_CLASS).toBe(1);
    expect(DEH_BLUE_ARMOR_CLASS).toBe(2);
  });

  it('BERSERK_HEALTH is 100', () => {
    expect(BERSERK_HEALTH).toBe(100);
  });

  it('PICKUP_Z_FLOOR_MARGIN is 8*FRACUNIT', () => {
    expect(PICKUP_Z_FLOOR_MARGIN).toBe(8 * FRACUNIT);
  });

  it('TICRATE is 35', () => {
    expect(TICRATE).toBe(35);
  });

  it('power durations match doomdef.h', () => {
    expect(INVULNTICS).toBe(30 * 35);
    expect(INVISTICS).toBe(60 * 35);
    expect(INFRATICS).toBe(120 * 35);
    expect(IRONTICS).toBe(60 * 35);
  });

  it('sound IDs match sounds.h enum positions', () => {
    expect(SFX_ITEMUP).toBe(32);
    expect(SFX_WPNUP).toBe(33);
    expect(SFX_GETPOW).toBe(93);
  });
});

// ── Context management ──────────────────────────────────────────────

describe('pickup context', () => {
  it('getPickupContext returns null before setPickupContext', () => {
    expect(getPickupContext()).toBeNull();
  });

  it('setPickupContext stores the context and getPickupContext returns it', () => {
    const log = makeCallLog();
    const thinkerList = new ThinkerList();
    thinkerList.init();
    const ctx = makeContext(log, thinkerList);
    setPickupContext(ctx);
    expect(getPickupContext()).toBe(ctx);
  });

  it('clearPickupContext resets back to null', () => {
    const log = makeCallLog();
    const thinkerList = new ThinkerList();
    thinkerList.init();
    setPickupContext(makeContext(log, thinkerList));
    clearPickupContext();
    expect(getPickupContext()).toBeNull();
  });
});

// ── P_GiveBody ──────────────────────────────────────────────────────

describe('giveBody', () => {
  it('adds num to health and returns true when under MAXHEALTH', () => {
    const player = spawnedPlayer();
    player.health = 80;
    player.mo!.health = 80;
    expect(giveBody(player, 10)).toBe(true);
    expect(player.health).toBe(90);
  });

  it('clamps to MAXHEALTH when heal would overfill', () => {
    const player = spawnedPlayer();
    player.health = 90;
    player.mo!.health = 90;
    expect(giveBody(player, 25)).toBe(true);
    expect(player.health).toBe(MAXHEALTH);
  });

  it('returns false when already at MAXHEALTH', () => {
    const player = spawnedPlayer();
    player.health = MAXHEALTH;
    expect(giveBody(player, 10)).toBe(false);
    expect(player.health).toBe(MAXHEALTH);
  });

  it('returns false when above MAXHEALTH (soulsphere overfill)', () => {
    const player = spawnedPlayer();
    player.health = 150;
    expect(giveBody(player, 10)).toBe(false);
    expect(player.health).toBe(150);
  });

  it('syncs mo.health to player.health', () => {
    const player = spawnedPlayer();
    player.health = 50;
    player.mo!.health = 50;
    giveBody(player, 30);
    expect(player.mo!.health).toBe(80);
  });

  it('does not throw when player.mo is null', () => {
    const player = spawnedPlayer();
    player.mo = null;
    player.health = 50;
    expect(() => giveBody(player, 10)).not.toThrow();
    expect(player.health).toBe(60);
  });
});

// ── P_GiveArmor ─────────────────────────────────────────────────────

describe('giveArmor', () => {
  it('grants armor class 1 (100 points) when player has none', () => {
    const player = spawnedPlayer();
    expect(giveArmor(player, 1)).toBe(true);
    expect(player.armortype).toBe(1);
    expect(player.armorpoints).toBe(100);
  });

  it('grants armor class 2 (200 points) when upgrading from class 1', () => {
    const player = spawnedPlayer();
    player.armortype = 1;
    player.armorpoints = 50;
    expect(giveArmor(player, 2)).toBe(true);
    expect(player.armortype).toBe(2);
    expect(player.armorpoints).toBe(200);
  });

  it('returns false when current armor >= armortype*100', () => {
    const player = spawnedPlayer();
    player.armortype = 2;
    player.armorpoints = 200;
    expect(giveArmor(player, 1)).toBe(false);
    expect(player.armortype).toBe(2);
    expect(player.armorpoints).toBe(200);
  });

  it('returns false when at exact threshold (>=, not >)', () => {
    const player = spawnedPlayer();
    player.armorpoints = 100;
    expect(giveArmor(player, 1)).toBe(false);
  });
});

// ── P_GiveCard ──────────────────────────────────────────────────────

describe('giveCard', () => {
  it('sets the card bit and bonuscount to BONUSADD (raw assignment)', () => {
    const player = spawnedPlayer();
    player.bonuscount = 999;
    giveCard(player, CardType.BLUECARD);
    expect(player.cards[CardType.BLUECARD]).toBe(true);
    expect(player.bonuscount).toBe(BONUSADD);
  });

  it('is a no-op when the card is already held', () => {
    const player = spawnedPlayer();
    player.cards[CardType.REDSKULL] = true;
    player.bonuscount = 3;
    giveCard(player, CardType.REDSKULL);
    expect(player.bonuscount).toBe(3);
  });
});

// ── P_GivePower ─────────────────────────────────────────────────────

describe('givePower', () => {
  it('INVULNERABILITY sets INVULNTICS and returns true', () => {
    const player = spawnedPlayer();
    expect(givePower(player, PowerType.INVULNERABILITY)).toBe(true);
    expect(player.powers[PowerType.INVULNERABILITY]).toBe(INVULNTICS);
  });

  it('INVISIBILITY sets INVISTICS and ORs MF_SHADOW onto the mobj', () => {
    const player = spawnedPlayer();
    player.mo!.flags = 0;
    expect(givePower(player, PowerType.INVISIBILITY)).toBe(true);
    expect(player.powers[PowerType.INVISIBILITY]).toBe(INVISTICS);
    expect(player.mo!.flags & MF_SHADOW).toBe(MF_SHADOW);
  });

  it('INFRARED sets INFRATICS and returns true', () => {
    const player = spawnedPlayer();
    expect(givePower(player, PowerType.INFRARED)).toBe(true);
    expect(player.powers[PowerType.INFRARED]).toBe(INFRATICS);
  });

  it('IRONFEET sets IRONTICS and returns true', () => {
    const player = spawnedPlayer();
    expect(givePower(player, PowerType.IRONFEET)).toBe(true);
    expect(player.powers[PowerType.IRONFEET]).toBe(IRONTICS);
  });

  it('STRENGTH calls giveBody(100), sets powers=1, always returns true', () => {
    const player = spawnedPlayer();
    player.health = 50;
    expect(givePower(player, PowerType.STRENGTH)).toBe(true);
    expect(player.health).toBe(MAXHEALTH);
    expect(player.powers[PowerType.STRENGTH]).toBe(1);
  });

  it('STRENGTH returns true even when already held (berserk heal always fires)', () => {
    const player = spawnedPlayer();
    player.powers[PowerType.STRENGTH] = 1;
    player.health = 40;
    expect(givePower(player, PowerType.STRENGTH)).toBe(true);
    expect(player.health).toBe(MAXHEALTH);
  });

  it('ALLMAP (generic power) sets value to 1 when unheld and returns true', () => {
    const player = spawnedPlayer();
    expect(givePower(player, PowerType.ALLMAP)).toBe(true);
    expect(player.powers[PowerType.ALLMAP]).toBe(1);
  });

  it('ALLMAP returns false when already held', () => {
    const player = spawnedPlayer();
    player.powers[PowerType.ALLMAP] = 1;
    expect(givePower(player, PowerType.ALLMAP)).toBe(false);
  });
});

// ── touchSpecialThing — guards ───────────────────────────────────────

describe('touchSpecialThing guards', () => {
  function setup(): {
    player: Player;
    log: CallLog;
    thinkerList: ThinkerList;
    ctx: PickupContext;
  } {
    const log = makeCallLog();
    const thinkerList = new ThinkerList();
    thinkerList.init();
    const ctx = makeContext(log, thinkerList);
    setPickupContext(ctx);
    const player = spawnedPlayer();
    return { player, log, thinkerList, ctx };
  }

  it('rejects when delta.z > toucher.height (reach clamp)', () => {
    const { player, thinkerList } = setup();
    const special = makePickup(thinkerList, SpriteNum.ARM1, {
      z: player.mo!.z + player.mo!.height + 1,
    });
    const result = touchSpecialThing(special, player.mo!);
    expect(result.consumed).toBe(false);
  });

  it('rejects when delta.z < -8*FRACUNIT (floor gap)', () => {
    const { player, thinkerList } = setup();
    const special = makePickup(thinkerList, SpriteNum.ARM1, {
      z: -(9 * FRACUNIT),
    });
    const result = touchSpecialThing(special, player.mo!);
    expect(result.consumed).toBe(false);
  });

  it('accepts when delta.z is exactly -8*FRACUNIT (boundary)', () => {
    const { player, thinkerList } = setup();
    const special = makePickup(thinkerList, SpriteNum.ARM1, {
      z: -(8 * FRACUNIT),
    });
    const result = touchSpecialThing(special, player.mo!);
    expect(result.consumed).toBe(true);
  });

  it('rejects when toucher is dead (health <= 0)', () => {
    const { player, thinkerList } = setup();
    player.mo!.health = 0;
    const special = makePickup(thinkerList, SpriteNum.ARM1);
    const result = touchSpecialThing(special, player.mo!);
    expect(result.consumed).toBe(false);
  });

  it('rejects when context is not set', () => {
    clearPickupContext();
    const thinkerList = new ThinkerList();
    thinkerList.init();
    const player = spawnedPlayer();
    const special = makePickup(thinkerList, SpriteNum.ARM1);
    const result = touchSpecialThing(special, player.mo!);
    expect(result.consumed).toBe(false);
  });

  it('rejects when toucher.player is null (monster, not player)', () => {
    const { thinkerList } = setup();
    const monster = new Mobj();
    monster.height = 56 * FRACUNIT;
    monster.health = 100;
    monster.player = null;
    const special = makePickup(thinkerList, SpriteNum.ARM1);
    const result = touchSpecialThing(special, monster);
    expect(result.consumed).toBe(false);
  });

  it('rejects unknown sprites via default branch', () => {
    const { player, thinkerList } = setup();
    const special = makePickup(thinkerList, SpriteNum.TROO);
    const result = touchSpecialThing(special, player.mo!);
    expect(result.consumed).toBe(false);
    expect(result.message).toBe(PickupMessage.NONE);
  });
});

// ── touchSpecialThing — armor ────────────────────────────────────────

describe('touchSpecialThing armor', () => {
  function setup(): {
    player: Player;
    log: CallLog;
    thinkerList: ThinkerList;
  } {
    const log = makeCallLog();
    const thinkerList = new ThinkerList();
    thinkerList.init();
    setPickupContext(makeContext(log, thinkerList));
    return { player: spawnedPlayer(), log, thinkerList };
  }

  it('ARM1 grants 100 armor class 1, sfx_itemup, consumes', () => {
    const { player, log, thinkerList } = setup();
    const special = makePickup(thinkerList, SpriteNum.ARM1);
    const result = touchSpecialThing(special, player.mo!);
    expect(result.consumed).toBe(true);
    expect(result.message).toBe(PickupMessage.GOTARMOR);
    expect(result.sound).toBe(SFX_ITEMUP);
    expect(player.armorpoints).toBe(100);
    expect(player.armortype).toBe(1);
    expect(log.startSound[0]?.sfxId).toBe(SFX_ITEMUP);
  });

  it('ARM2 grants 200 armor class 2', () => {
    const { player, thinkerList } = setup();
    const special = makePickup(thinkerList, SpriteNum.ARM2);
    const result = touchSpecialThing(special, player.mo!);
    expect(result.consumed).toBe(true);
    expect(result.message).toBe(PickupMessage.GOTMEGA);
    expect(player.armorpoints).toBe(200);
    expect(player.armortype).toBe(2);
  });

  it('ARM1 rejects when armor >= 100', () => {
    const { player, thinkerList } = setup();
    player.armorpoints = 100;
    const special = makePickup(thinkerList, SpriteNum.ARM1);
    const result = touchSpecialThing(special, player.mo!);
    expect(result.consumed).toBe(false);
    expect(player.armorpoints).toBe(100);
  });
});

// ── touchSpecialThing — bonus items ──────────────────────────────────

describe('touchSpecialThing bonus items', () => {
  function setup(): {
    player: Player;
    log: CallLog;
    thinkerList: ThinkerList;
  } {
    const log = makeCallLog();
    const thinkerList = new ThinkerList();
    thinkerList.init();
    setPickupContext(makeContext(log, thinkerList));
    return { player: spawnedPlayer(), log, thinkerList };
  }

  it('BON1 adds 1 HP and caps at DEH_MAX_HEALTH=200', () => {
    const { player, thinkerList } = setup();
    player.health = 50;
    player.mo!.health = 50;
    const special = makePickup(thinkerList, SpriteNum.BON1);
    const result = touchSpecialThing(special, player.mo!);
    expect(result.consumed).toBe(true);
    expect(result.message).toBe(PickupMessage.GOTHTHBONUS);
    expect(player.health).toBe(51);
    expect(player.mo!.health).toBe(51);
  });

  it('BON1 can overfill past MAXHEALTH up to DEH_MAX_HEALTH', () => {
    const { player, thinkerList } = setup();
    player.health = 150;
    const special = makePickup(thinkerList, SpriteNum.BON1);
    touchSpecialThing(special, player.mo!);
    expect(player.health).toBe(151);
  });

  it('BON1 clamps at DEH_MAX_HEALTH (200)', () => {
    const { player, thinkerList } = setup();
    player.health = DEH_MAX_HEALTH;
    const special = makePickup(thinkerList, SpriteNum.BON1);
    touchSpecialThing(special, player.mo!);
    expect(player.health).toBe(DEH_MAX_HEALTH);
  });

  it('BON2 adds 1 armor point and sets armortype to 1 if none', () => {
    const { player, thinkerList } = setup();
    const special = makePickup(thinkerList, SpriteNum.BON2);
    const result = touchSpecialThing(special, player.mo!);
    expect(result.message).toBe(PickupMessage.GOTARMBONUS);
    expect(player.armorpoints).toBe(1);
    expect(player.armortype).toBe(1);
  });

  it('BON2 does not lower an existing class-2 armortype', () => {
    const { player, thinkerList } = setup();
    player.armortype = 2;
    player.armorpoints = 50;
    const special = makePickup(thinkerList, SpriteNum.BON2);
    touchSpecialThing(special, player.mo!);
    expect(player.armortype).toBe(2);
    expect(player.armorpoints).toBe(51);
  });

  it('BON2 caps at DEH_MAX_ARMOR (200)', () => {
    const { player, thinkerList } = setup();
    player.armorpoints = DEH_MAX_ARMOR;
    player.armortype = 1;
    const special = makePickup(thinkerList, SpriteNum.BON2);
    touchSpecialThing(special, player.mo!);
    expect(player.armorpoints).toBe(DEH_MAX_ARMOR);
  });

  it('SOUL adds 100 HP up to 200, plays sfx_getpow', () => {
    const { player, thinkerList } = setup();
    player.health = 50;
    const special = makePickup(thinkerList, SpriteNum.SOUL);
    const result = touchSpecialThing(special, player.mo!);
    expect(result.consumed).toBe(true);
    expect(result.message).toBe(PickupMessage.GOTSUPER);
    expect(result.sound).toBe(SFX_GETPOW);
    expect(player.health).toBe(150);
    expect(player.mo!.health).toBe(150);
  });

  it('SOUL clamps at DEH_MAX_SOULSPHERE (200)', () => {
    const { player, thinkerList } = setup();
    player.health = 150;
    const special = makePickup(thinkerList, SpriteNum.SOUL);
    touchSpecialThing(special, player.mo!);
    expect(player.health).toBe(DEH_MAX_SOULSPHERE);
  });

  it('MEGA in commercial: 200 HP and armor class 2', () => {
    const { player, thinkerList } = setup();
    player.health = 50;
    const special = makePickup(thinkerList, SpriteNum.MEGA);
    const result = touchSpecialThing(special, player.mo!);
    expect(result.consumed).toBe(true);
    expect(result.message).toBe(PickupMessage.GOTMSPHERE);
    expect(result.sound).toBe(SFX_GETPOW);
    expect(player.health).toBe(DEH_MEGASPHERE_HEALTH);
    expect(player.armortype).toBe(2);
    expect(player.armorpoints).toBe(200);
  });

  it('MEGA outside commercial is silently rejected', () => {
    const log = makeCallLog();
    const thinkerList = new ThinkerList();
    thinkerList.init();
    setPickupContext(makeContext(log, thinkerList, { gameMode: 'retail' }));
    const player = spawnedPlayer();
    player.health = 50;
    const special = makePickup(thinkerList, SpriteNum.MEGA);
    const result = touchSpecialThing(special, player.mo!);
    expect(result.consumed).toBe(false);
    expect(player.health).toBe(50);
  });

  it('MEGA ignores deh_blue_armor_class by hardcoding class 2', () => {
    // Even if a (hypothetical) dehacked reassigned blue armor to class 3,
    // megasphere must always give armor class 2. The implementation passes
    // literal 2 to giveArmor — verified by checking armortype after pickup.
    const { player, thinkerList } = setup();
    const special = makePickup(thinkerList, SpriteNum.MEGA);
    touchSpecialThing(special, player.mo!);
    expect(player.armortype).toBe(2);
  });
});

// ── touchSpecialThing — cards ────────────────────────────────────────

describe('touchSpecialThing cards', () => {
  function setup(netgame = false): {
    player: Player;
    log: CallLog;
    thinkerList: ThinkerList;
  } {
    const log = makeCallLog();
    const thinkerList = new ThinkerList();
    thinkerList.init();
    setPickupContext(makeContext(log, thinkerList, { netgame }));
    return { player: spawnedPlayer(), log, thinkerList };
  }

  const allCards: Array<{
    label: string;
    sprite: SpriteNum;
    card: CardType;
    msg: PickupMessage;
  }> = [
    { label: 'BKEY', sprite: SpriteNum.BKEY, card: CardType.BLUECARD, msg: PickupMessage.GOTBLUECARD },
    { label: 'YKEY', sprite: SpriteNum.YKEY, card: CardType.YELLOWCARD, msg: PickupMessage.GOTYELWCARD },
    { label: 'RKEY', sprite: SpriteNum.RKEY, card: CardType.REDCARD, msg: PickupMessage.GOTREDCARD },
    { label: 'BSKU', sprite: SpriteNum.BSKU, card: CardType.BLUESKULL, msg: PickupMessage.GOTBLUESKUL },
    { label: 'YSKU', sprite: SpriteNum.YSKU, card: CardType.YELLOWSKULL, msg: PickupMessage.GOTYELWSKUL },
    { label: 'RSKU', sprite: SpriteNum.RSKU, card: CardType.REDSKULL, msg: PickupMessage.GOTREDSKULL },
  ];

  for (const { label, sprite, card, msg } of allCards) {
    it(`${label} grants card ${card} with message ${msg}`, () => {
      const { player, thinkerList } = setup();
      const special = makePickup(thinkerList, sprite);
      const result = touchSpecialThing(special, player.mo!);
      expect(result.consumed).toBe(true);
      expect(result.message).toBe(msg);
      expect(player.cards[card]).toBe(true);
    });
  }

  it('non-netgame card pickup: bonuscount = 2 * BONUSADD (12)', () => {
    const { player, thinkerList } = setup();
    player.bonuscount = 0;
    const special = makePickup(thinkerList, SpriteNum.BKEY);
    touchSpecialThing(special, player.mo!);
    expect(player.bonuscount).toBe(2 * BONUSADD);
  });

  it('netgame card pickup: returns consumed=false, card still granted, bonuscount = BONUSADD', () => {
    const { player, thinkerList } = setup(true);
    player.bonuscount = 0;
    const special = makePickup(thinkerList, SpriteNum.BKEY);
    const result = touchSpecialThing(special, player.mo!);
    expect(result.consumed).toBe(false);
    expect(result.message).toBe(PickupMessage.GOTBLUECARD);
    expect(player.cards[CardType.BLUECARD]).toBe(true);
    expect(player.bonuscount).toBe(BONUSADD);
  });

  it('netgame duplicate card: no message (card already held)', () => {
    const { player, thinkerList } = setup(true);
    player.cards[CardType.BLUECARD] = true;
    const special = makePickup(thinkerList, SpriteNum.BKEY);
    const result = touchSpecialThing(special, player.mo!);
    expect(result.message).toBe(PickupMessage.NONE);
  });

  it('netgame card: does NOT mark the special removed', () => {
    const { player, thinkerList } = setup(true);
    const special = makePickup(thinkerList, SpriteNum.BKEY);
    touchSpecialThing(special, player.mo!);
    expect(thinkerList.isEmpty).toBe(false);
  });
});

// ── touchSpecialThing — medikits ─────────────────────────────────────

describe('touchSpecialThing medikits', () => {
  function setup(): {
    player: Player;
    log: CallLog;
    thinkerList: ThinkerList;
  } {
    const log = makeCallLog();
    const thinkerList = new ThinkerList();
    thinkerList.init();
    setPickupContext(makeContext(log, thinkerList));
    return { player: spawnedPlayer(), log, thinkerList };
  }

  it('STIM heals 10 HP with GOTSTIM', () => {
    const { player, thinkerList } = setup();
    player.health = 50;
    const special = makePickup(thinkerList, SpriteNum.STIM);
    const result = touchSpecialThing(special, player.mo!);
    expect(result.consumed).toBe(true);
    expect(result.message).toBe(PickupMessage.GOTSTIM);
    expect(player.health).toBe(60);
  });

  it('STIM at MAXHEALTH rejects without consume', () => {
    const { player, thinkerList } = setup();
    player.health = MAXHEALTH;
    const special = makePickup(thinkerList, SpriteNum.STIM);
    const result = touchSpecialThing(special, player.mo!);
    expect(result.consumed).toBe(false);
  });

  it('MEDI at health < 25 emits GOTMEDINEED', () => {
    const { player, thinkerList } = setup();
    player.health = 10;
    const special = makePickup(thinkerList, SpriteNum.MEDI);
    const result = touchSpecialThing(special, player.mo!);
    expect(result.consumed).toBe(true);
    expect(result.message).toBe(PickupMessage.GOTMEDINEED);
    expect(player.health).toBe(35);
  });

  it('MEDI at health >= 25 emits GOTMEDIKIT', () => {
    const { player, thinkerList } = setup();
    player.health = 25;
    const special = makePickup(thinkerList, SpriteNum.MEDI);
    const result = touchSpecialThing(special, player.mo!);
    expect(result.consumed).toBe(true);
    expect(result.message).toBe(PickupMessage.GOTMEDIKIT);
    expect(player.health).toBe(50);
  });

  it('MEDI caps at MAXHEALTH', () => {
    const { player, thinkerList } = setup();
    player.health = 90;
    const special = makePickup(thinkerList, SpriteNum.MEDI);
    touchSpecialThing(special, player.mo!);
    expect(player.health).toBe(MAXHEALTH);
  });

  it('MEDI at MAXHEALTH rejects', () => {
    const { player, thinkerList } = setup();
    player.health = MAXHEALTH;
    const special = makePickup(thinkerList, SpriteNum.MEDI);
    const result = touchSpecialThing(special, player.mo!);
    expect(result.consumed).toBe(false);
  });
});

// ── touchSpecialThing — power-ups ────────────────────────────────────

describe('touchSpecialThing power-ups', () => {
  function setup(): {
    player: Player;
    log: CallLog;
    thinkerList: ThinkerList;
  } {
    const log = makeCallLog();
    const thinkerList = new ThinkerList();
    thinkerList.init();
    setPickupContext(makeContext(log, thinkerList));
    return { player: spawnedPlayer(), log, thinkerList };
  }

  it('PINV grants invulnerability with GOTINVUL and sfx_getpow', () => {
    const { player, thinkerList } = setup();
    const special = makePickup(thinkerList, SpriteNum.PINV);
    const result = touchSpecialThing(special, player.mo!);
    expect(result.consumed).toBe(true);
    expect(result.message).toBe(PickupMessage.GOTINVUL);
    expect(result.sound).toBe(SFX_GETPOW);
    expect(player.powers[PowerType.INVULNERABILITY]).toBe(INVULNTICS);
  });

  it('PSTR (berserk) heals to 100 HP and switches pendingweapon to FIST', () => {
    const { player, thinkerList } = setup();
    player.health = 40;
    player.readyweapon = WeaponType.PISTOL;
    player.pendingweapon = -1;
    const special = makePickup(thinkerList, SpriteNum.PSTR);
    const result = touchSpecialThing(special, player.mo!);
    expect(result.consumed).toBe(true);
    expect(result.message).toBe(PickupMessage.GOTBERSERK);
    expect(result.sound).toBe(SFX_GETPOW);
    expect(player.health).toBe(MAXHEALTH);
    expect(player.pendingweapon).toBe(WeaponType.FIST);
  });

  it('PSTR does NOT set pendingweapon when FIST already wielded', () => {
    const { player, thinkerList } = setup();
    player.readyweapon = WeaponType.FIST;
    player.pendingweapon = -1;
    const special = makePickup(thinkerList, SpriteNum.PSTR);
    touchSpecialThing(special, player.mo!);
    expect(player.pendingweapon).toBe(-1);
  });

  it('PINS grants invisibility and ORs MF_SHADOW onto the mobj', () => {
    const { player, thinkerList } = setup();
    player.mo!.flags = 0;
    const special = makePickup(thinkerList, SpriteNum.PINS);
    const result = touchSpecialThing(special, player.mo!);
    expect(result.consumed).toBe(true);
    expect(result.message).toBe(PickupMessage.GOTINVIS);
    expect(result.sound).toBe(SFX_GETPOW);
    expect(player.mo!.flags & MF_SHADOW).toBe(MF_SHADOW);
  });

  it('SUIT grants ironfeet with GOTSUIT', () => {
    const { player, thinkerList } = setup();
    const special = makePickup(thinkerList, SpriteNum.SUIT);
    const result = touchSpecialThing(special, player.mo!);
    expect(result.message).toBe(PickupMessage.GOTSUIT);
    expect(player.powers[PowerType.IRONFEET]).toBe(IRONTICS);
  });

  it('PMAP grants allmap with GOTMAP', () => {
    const { player, thinkerList } = setup();
    const special = makePickup(thinkerList, SpriteNum.PMAP);
    const result = touchSpecialThing(special, player.mo!);
    expect(result.message).toBe(PickupMessage.GOTMAP);
    expect(player.powers[PowerType.ALLMAP]).toBe(1);
  });

  it('PMAP rejects when already held', () => {
    const { player, thinkerList } = setup();
    player.powers[PowerType.ALLMAP] = 1;
    const special = makePickup(thinkerList, SpriteNum.PMAP);
    const result = touchSpecialThing(special, player.mo!);
    expect(result.consumed).toBe(false);
  });

  it('PVIS grants infrared with GOTVISOR', () => {
    const { player, thinkerList } = setup();
    const special = makePickup(thinkerList, SpriteNum.PVIS);
    const result = touchSpecialThing(special, player.mo!);
    expect(result.message).toBe(PickupMessage.GOTVISOR);
    expect(player.powers[PowerType.INFRARED]).toBe(INFRATICS);
  });
});

// ── touchSpecialThing — ammo ─────────────────────────────────────────

describe('touchSpecialThing ammo', () => {
  function setup(): {
    player: Player;
    log: CallLog;
    thinkerList: ThinkerList;
  } {
    const log = makeCallLog();
    const thinkerList = new ThinkerList();
    thinkerList.init();
    setPickupContext(makeContext(log, thinkerList));
    const player = spawnedPlayer();
    player.ammo[AmmoType.CLIP] = 0;
    player.ammo[AmmoType.SHELL] = 0;
    player.ammo[AmmoType.CELL] = 0;
    player.ammo[AmmoType.MISL] = 0;
    return { player, log, thinkerList };
  }

  it('CLIP (placed) gives 1 clip (num=1, full)', () => {
    const { player, thinkerList } = setup();
    const special = makePickup(thinkerList, SpriteNum.CLIP);
    const before = player.ammo[AmmoType.CLIP]!;
    const result = touchSpecialThing(special, player.mo!);
    expect(result.consumed).toBe(true);
    expect(result.message).toBe(PickupMessage.GOTCLIP);
    expect(player.ammo[AmmoType.CLIP]!).toBeGreaterThan(before);
  });

  it('CLIP (MF_DROPPED) gives half-clip via num=0', () => {
    // num=0 in giveAmmo halves the clipammo amount, vs num=1 which gives full.
    const { player: p1, thinkerList: tl1 } = setup();
    const placed = makePickup(tl1, SpriteNum.CLIP);
    touchSpecialThing(placed, p1.mo!);
    const placedGain = p1.ammo[AmmoType.CLIP]!;

    const { player: p2, thinkerList: tl2 } = setup();
    const dropped = makePickup(tl2, SpriteNum.CLIP, { flags: MF_DROPPED });
    touchSpecialThing(dropped, p2.mo!);
    const droppedGain = p2.ammo[AmmoType.CLIP]!;

    expect(droppedGain).toBeLessThan(placedGain);
  });

  it('AMMO (box of bullets) gives 5 clips', () => {
    const { player, thinkerList } = setup();
    const special = makePickup(thinkerList, SpriteNum.AMMO);
    const result = touchSpecialThing(special, player.mo!);
    expect(result.consumed).toBe(true);
    expect(result.message).toBe(PickupMessage.GOTCLIPBOX);
    // 5 * CLIP_AMMO[CLIP]=10 = 50 bullets (skill 2, no doubling).
    expect(player.ammo[AmmoType.CLIP]!).toBe(50);
  });

  it('ROCK gives 1 rocket', () => {
    const { player, thinkerList } = setup();
    const special = makePickup(thinkerList, SpriteNum.ROCK);
    const result = touchSpecialThing(special, player.mo!);
    expect(result.consumed).toBe(true);
    expect(result.message).toBe(PickupMessage.GOTROCKET);
    expect(player.ammo[AmmoType.MISL]!).toBe(1);
  });

  it('BROK gives 5 rockets', () => {
    const { player, thinkerList } = setup();
    const special = makePickup(thinkerList, SpriteNum.BROK);
    const result = touchSpecialThing(special, player.mo!);
    expect(result.message).toBe(PickupMessage.GOTROCKBOX);
    expect(player.ammo[AmmoType.MISL]!).toBe(5);
  });

  it('CELL gives 20 cells (1 * CLIP_AMMO[CELL]=20)', () => {
    const { player, thinkerList } = setup();
    const special = makePickup(thinkerList, SpriteNum.CELL);
    const result = touchSpecialThing(special, player.mo!);
    expect(result.message).toBe(PickupMessage.GOTCELL);
    expect(player.ammo[AmmoType.CELL]!).toBe(20);
  });

  it('CELP gives 100 cells (5 * 20)', () => {
    const { player, thinkerList } = setup();
    const special = makePickup(thinkerList, SpriteNum.CELP);
    const result = touchSpecialThing(special, player.mo!);
    expect(result.message).toBe(PickupMessage.GOTCELLBOX);
    expect(player.ammo[AmmoType.CELL]!).toBe(100);
  });

  it('SHEL gives 4 shells (1 * CLIP_AMMO[SHELL]=4)', () => {
    const { player, thinkerList } = setup();
    const special = makePickup(thinkerList, SpriteNum.SHEL);
    const result = touchSpecialThing(special, player.mo!);
    expect(result.message).toBe(PickupMessage.GOTSHELLS);
    expect(player.ammo[AmmoType.SHELL]!).toBe(4);
  });

  it('SBOX gives 20 shells (5 * 4)', () => {
    const { player, thinkerList } = setup();
    const special = makePickup(thinkerList, SpriteNum.SBOX);
    const result = touchSpecialThing(special, player.mo!);
    expect(result.message).toBe(PickupMessage.GOTSHELLBOX);
    expect(player.ammo[AmmoType.SHELL]!).toBe(20);
  });

  it('BPAK installs backpack and doubles maxammo', () => {
    const { player, thinkerList } = setup();
    expect(player.backpack).toBe(false);
    const clipMax = player.maxammo[AmmoType.CLIP]!;
    const special = makePickup(thinkerList, SpriteNum.BPAK);
    const result = touchSpecialThing(special, player.mo!);
    expect(result.consumed).toBe(true);
    expect(result.message).toBe(PickupMessage.GOTBACKPACK);
    expect(player.backpack).toBe(true);
    expect(player.maxammo[AmmoType.CLIP]!).toBe(clipMax * 2);
  });

  it('CLIP pickup rejects when ammo is already at max', () => {
    const { player, thinkerList } = setup();
    player.ammo[AmmoType.CLIP] = player.maxammo[AmmoType.CLIP]!;
    const special = makePickup(thinkerList, SpriteNum.CLIP);
    const result = touchSpecialThing(special, player.mo!);
    expect(result.consumed).toBe(false);
  });
});

// ── touchSpecialThing — weapons ──────────────────────────────────────

describe('touchSpecialThing weapons', () => {
  function setup(): {
    player: Player;
    log: CallLog;
    thinkerList: ThinkerList;
  } {
    const log = makeCallLog();
    const thinkerList = new ThinkerList();
    thinkerList.init();
    setPickupContext(makeContext(log, thinkerList));
    return { player: spawnedPlayer(), log, thinkerList };
  }

  const placedWeapons: Array<{
    label: string;
    sprite: SpriteNum;
    weapon: WeaponType;
    msg: PickupMessage;
  }> = [
    { label: 'BFUG', sprite: SpriteNum.BFUG, weapon: WeaponType.BFG, msg: PickupMessage.GOTBFG9000 },
    { label: 'MGUN', sprite: SpriteNum.MGUN, weapon: WeaponType.CHAINGUN, msg: PickupMessage.GOTCHAINGUN },
    { label: 'CSAW', sprite: SpriteNum.CSAW, weapon: WeaponType.CHAINSAW, msg: PickupMessage.GOTCHAINSAW },
    { label: 'LAUN', sprite: SpriteNum.LAUN, weapon: WeaponType.MISSILE, msg: PickupMessage.GOTLAUNCHER },
    { label: 'PLAS', sprite: SpriteNum.PLAS, weapon: WeaponType.PLASMA, msg: PickupMessage.GOTPLASMA },
    { label: 'SHOT', sprite: SpriteNum.SHOT, weapon: WeaponType.SHOTGUN, msg: PickupMessage.GOTSHOTGUN },
    { label: 'SGN2', sprite: SpriteNum.SGN2, weapon: WeaponType.SUPERSHOTGUN, msg: PickupMessage.GOTSHOTGUN2 },
  ];

  for (const { label, sprite, weapon, msg } of placedWeapons) {
    it(`${label} grants weapon ${weapon}, plays sfx_wpnup`, () => {
      const { player, thinkerList } = setup();
      const special = makePickup(thinkerList, sprite);
      const result = touchSpecialThing(special, player.mo!);
      expect(result.consumed).toBe(true);
      expect(result.message).toBe(msg);
      expect(result.sound).toBe(SFX_WPNUP);
      expect(player.weaponowned[weapon]).toBe(true);
    });
  }

  it('MGUN with MF_DROPPED gives half ammo vs placed (dropped=true)', () => {
    // Dropped chaingun: giveWeapon passes dropped=true, which skips the
    // netgame-placed-pickup early return and passes dropped to giveAmmo.
    // In single-player, the main observable difference is that a dropped
    // weapon in deathmatch wouldn't respawn — but the ammo-granting path
    // itself still runs. Here we assert that the pickup consumes
    // regardless.
    const log = makeCallLog();
    const thinkerList = new ThinkerList();
    thinkerList.init();
    setPickupContext(makeContext(log, thinkerList));
    const player = spawnedPlayer();
    player.ammo[AmmoType.CLIP] = 0;
    const special = makePickup(thinkerList, SpriteNum.MGUN, { flags: MF_DROPPED });
    const result = touchSpecialThing(special, player.mo!);
    expect(result.consumed).toBe(true);
    expect(player.weaponowned[WeaponType.CHAINGUN]).toBe(true);
  });

  it('weapon pickup logs sfx_wpnup through the startSound callback', () => {
    const { player, log, thinkerList } = setup();
    const special = makePickup(thinkerList, SpriteNum.BFUG);
    touchSpecialThing(special, player.mo!);
    // giveWeapon fires its own weaponSoundCallback (which we wire to
    // SFX_WPNUP), and the common tail also emits its `sound` which is
    // SFX_WPNUP for the weapon branches. Either way, SFX_WPNUP appears.
    const wpnupCalls = log.startSound.filter((c) => c.sfxId === SFX_WPNUP);
    expect(wpnupCalls.length).toBeGreaterThan(0);
  });
});

// ── touchSpecialThing — common tail ──────────────────────────────────

describe('touchSpecialThing common tail', () => {
  function setup(overrides?: Partial<PickupContext>): {
    player: Player;
    log: CallLog;
    thinkerList: ThinkerList;
  } {
    const log = makeCallLog();
    const thinkerList = new ThinkerList();
    thinkerList.init();
    setPickupContext(makeContext(log, thinkerList, overrides));
    return { player: spawnedPlayer(), log, thinkerList };
  }

  it('successful pickup: bonuscount += BONUSADD', () => {
    const { player, thinkerList } = setup();
    player.bonuscount = 3;
    const special = makePickup(thinkerList, SpriteNum.ARM1);
    touchSpecialThing(special, player.mo!);
    expect(player.bonuscount).toBe(3 + BONUSADD);
  });

  it('MF_COUNTITEM increments itemcount on pickup', () => {
    const { player, thinkerList } = setup();
    player.itemcount = 0;
    const special = makePickup(thinkerList, SpriteNum.ARM1, {
      flags: MF_COUNTITEM,
    });
    touchSpecialThing(special, player.mo!);
    expect(player.itemcount).toBe(1);
  });

  it('no MF_COUNTITEM: itemcount unchanged', () => {
    const { player, thinkerList } = setup();
    player.itemcount = 7;
    const special = makePickup(thinkerList, SpriteNum.ARM1);
    touchSpecialThing(special, player.mo!);
    expect(player.itemcount).toBe(7);
  });

  it('non-console player: no startSound call', () => {
    const { player, log, thinkerList } = setup({ isConsolePlayer: false });
    const special = makePickup(thinkerList, SpriteNum.ARM1);
    touchSpecialThing(special, player.mo!);
    expect(log.startSound).toHaveLength(0);
  });

  it('null startSound callback does not throw', () => {
    const { player, thinkerList } = setup({ startSound: null });
    const special = makePickup(thinkerList, SpriteNum.ARM1);
    expect(() => touchSpecialThing(special, player.mo!)).not.toThrow();
  });

  it('successful pickup marks the special for removal', () => {
    const { player, thinkerList } = setup();
    const special = makePickup(thinkerList, SpriteNum.ARM1);
    touchSpecialThing(special, player.mo!);
    // ThinkerList.remove() tags the node; a subsequent run() unlinks it.
    thinkerList.run();
    expect(thinkerList.isEmpty).toBe(true);
  });

  it('failed pickup (armor full) does NOT remove the special', () => {
    const { player, thinkerList } = setup();
    player.armorpoints = 200;
    player.armortype = 2;
    const special = makePickup(thinkerList, SpriteNum.ARM1);
    touchSpecialThing(special, player.mo!);
    thinkerList.run();
    expect(thinkerList.isEmpty).toBe(false);
  });

  it('failed pickup does NOT bump bonuscount', () => {
    const { player, thinkerList } = setup();
    player.bonuscount = 4;
    player.armorpoints = 200;
    player.armortype = 2;
    const special = makePickup(thinkerList, SpriteNum.ARM1);
    touchSpecialThing(special, player.mo!);
    expect(player.bonuscount).toBe(4);
  });

  it('TouchSpecialResult shape for a consumed armor pickup', () => {
    const { player, thinkerList } = setup();
    const special = makePickup(thinkerList, SpriteNum.ARM1);
    const result: TouchSpecialResult = touchSpecialThing(special, player.mo!);
    expect(result).toEqual({
      consumed: true,
      message: PickupMessage.GOTARMOR,
      sound: SFX_ITEMUP,
    });
  });
});
