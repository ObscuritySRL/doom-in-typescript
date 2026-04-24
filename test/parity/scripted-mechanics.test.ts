import { describe, expect, it } from 'bun:test';

import { fileURLToPath } from 'node:url';

import { FRACUNIT } from '../../src/core/fixed.ts';
import { DoomRandom } from '../../src/core/rng.ts';
import { BT_ATTACK, BT_USE, packTicCommand } from '../../src/input/ticcmd.ts';
import { AmmoType, WeaponType, createPlayer, movePsprites, playerReborn, pspriteActions, setupPsprites } from '../../src/player/playerSpawn.ts';
import { setWeaponStateContext, wireWeaponStateActions } from '../../src/player/weaponStates.ts';
import { REFERENCE_BUNDLE_PATH } from '../../src/reference/policy.ts';
import type { DoorSector } from '../../src/specials/doors.ts';
import { PD_BLUEK, PD_BLUEO, VerticalDoorType, evDoLockedDoor, evVerticalDoor } from '../../src/specials/doors.ts';
import { MobjType, STATES, spawnMobj } from '../../src/world/mobj.ts';
import { ThinkerList } from '../../src/world/thinkers.ts';

const EXECUTABLE_FILE_NAMES = Object.freeze(['DOOM.EXE', 'DOOMD.EXE'] as const);

interface AttackLatchFixtureEntry {
  readonly description: string;
  readonly fireTics: readonly number[];
  readonly finalAttackdown: boolean;
  readonly finalMoStateIndex: number | null;
  readonly finalRefire: number;
  readonly finalWeaponStateIndex: number | null;
  readonly finalWeaponSy: number;
  readonly streamHash: string;
  readonly ticCount: number;
}

interface DenialFixtureEntry {
  readonly description: string;
  readonly doorCreated: boolean;
  readonly lineSpecial: number;
  readonly message: string;
  readonly playerSoundSequence: readonly number[];
  readonly result: number;
  readonly summaryHash: string;
}

interface ScriptedMechanicsFixture {
  readonly description: string;
  readonly scenarios: {
    readonly attackLatch: AttackLatchFixtureEntry;
    readonly manualBlueDenied: DenialFixtureEntry;
    readonly taggedBlueDenied: DenialFixtureEntry;
    readonly useLatch: UseLatchFixtureEntry;
  };
}

interface UseLatchFixtureEntry {
  readonly activationTics: readonly number[];
  readonly description: string;
  readonly directionAfterActivation: readonly number[];
  readonly finalDoorDirection: number | null;
  readonly finalUsedown: boolean;
  readonly lineSpecial: number;
  readonly sectorSoundSequence: readonly number[];
  readonly streamHash: string;
  readonly ticCount: number;
}

function buildAttackLatchSummary(releaseTic: number | null = 18): AttackLatchFixtureEntry {
  const savedPspriteActions = [...pspriteActions];

  wireWeaponStateActions();

  const thinkerList = new ThinkerList();
  const doomRandom = new DoomRandom();
  const player = createPlayer();

  doomRandom.clearRandom();
  playerReborn(player);
  player.weaponowned[WeaponType.MISSILE] = true;
  player.readyweapon = WeaponType.MISSILE;
  player.pendingweapon = WeaponType.MISSILE;
  player.ammo[AmmoType.MISL] = 5;

  const playerMapObject = spawnMobj(0, 0, 0, MobjType.PLAYER, doomRandom, thinkerList);
  playerMapObject.health = player.health;
  playerMapObject.player = player;
  player.mo = playerMapObject;

  const weaponStateContext = {
    gamemode: 'shareware' as const,
    leveltime: 0,
    noiseAlert: null,
    startSound: null,
    thinkerList,
  };

  try {
    setWeaponStateContext(weaponStateContext);
    setupPsprites(player);

    const fireTics: number[] = [];
    const snapshots: Array<{
      readonly attackdown: boolean;
      readonly buttons: number;
      readonly moStateIndex: number | null;
      readonly refire: number;
      readonly tic: number;
      readonly weaponStateIndex: number | null;
      readonly weaponSy: number;
    }> = [];

    let previousWeaponStateIndex = findStateIndex(player.psprites[0]!.state);

    for (let tic = 0; tic < 80; tic += 1) {
      const buttons = releaseTic !== null && tic === releaseTic ? 0 : BT_ATTACK;

      weaponStateContext.leveltime = tic;
      player.cmd = packTicCommand(0, 0, 0, buttons, 0, 0);
      movePsprites(player);

      const weaponStateIndex = findStateIndex(player.psprites[0]!.state);
      if (weaponStateIndex === 60 && previousWeaponStateIndex !== 60) {
        fireTics.push(tic);
      }

      snapshots.push({
        attackdown: player.attackdown,
        buttons,
        moStateIndex: findStateIndex(player.mo?.state ?? null),
        refire: player.refire,
        tic,
        weaponStateIndex,
        weaponSy: player.psprites[0]!.sy,
      });

      previousWeaponStateIndex = weaponStateIndex;
    }

    return {
      description: 'Holding attack from respawn does not fire the rocket launcher until a ready-state release clears attackdown, after which held input re-enters MISSILE1 on a fixed 20-tic cadence.',
      finalAttackdown: player.attackdown,
      finalMoStateIndex: findStateIndex(player.mo?.state ?? null),
      finalRefire: player.refire,
      finalWeaponStateIndex: findStateIndex(player.psprites[0]!.state),
      finalWeaponSy: player.psprites[0]!.sy,
      fireTics,
      streamHash: sha256Hex(snapshots),
      ticCount: snapshots.length,
    };
  } finally {
    pspriteActions.length = 0;
    pspriteActions.push(...savedPspriteActions);
    setWeaponStateContext(null);
  }
}

function buildManualBlueDeniedSummary(): DenialFixtureEntry {
  const thinkerList = new ThinkerList();
  const player = createPlayer();

  playerReborn(player);

  const sector = {
    ceilingheight: 0,
    floorheight: 0,
    special: 0,
    specialdata: null,
    tag: 1,
  };
  const line = { special: 26 };
  const playerSoundSequence: number[] = [];
  const callbacks = {
    findLowestCeilingSurrounding: () => 0,
    movePlane: () => 0,
    startPlayerSound: (sfx: number) => {
      playerSoundSequence.push(sfx);
    },
  };
  const result = evVerticalDoor(line, sector, player, thinkerList, callbacks);
  const summary = {
    doorCreated: sector.specialdata !== null,
    lineSpecial: line.special,
    message: player.message,
    playerSoundSequence,
    result,
  };

  return {
    description: 'Manual blue-door specials use the -K denial string and sfx_oof when the player lacks both blue key variants.',
    doorCreated: summary.doorCreated,
    lineSpecial: summary.lineSpecial,
    message: parseNonEmptyString('manualBlueDenied.message', summary.message),
    playerSoundSequence: summary.playerSoundSequence,
    result: summary.result,
    summaryHash: sha256Hex(summary),
  };
}

function buildTaggedBlueDeniedSummary(): DenialFixtureEntry {
  const thinkerList = new ThinkerList();
  const player = createPlayer();

  playerReborn(player);

  const line = { special: 99 };
  const sectors = [
    {
      ceilingheight: 0,
      floorheight: 0,
      special: 0,
      specialdata: null,
      tag: 7,
    },
  ];
  const playerSoundSequence: number[] = [];
  const callbacks = {
    findLowestCeilingSurrounding: () => 0,
    movePlane: () => 0,
    startPlayerSound: (sfx: number) => {
      playerSoundSequence.push(sfx);
    },
  };
  const result = evDoLockedDoor(line, VerticalDoorType.normal, 7, player, sectors, thinkerList, callbacks);
  const summary = {
    doorCreated: sectors[0]!.specialdata !== null,
    lineSpecial: line.special,
    message: player.message,
    playerSoundSequence,
    result,
  };

  return {
    description: 'Tagged locked-door specials use the distinct -O denial string and the same sfx_oof branch when no blue key is present.',
    doorCreated: summary.doorCreated,
    lineSpecial: summary.lineSpecial,
    message: parseNonEmptyString('taggedBlueDenied.message', summary.message),
    playerSoundSequence: summary.playerSoundSequence,
    result: summary.result,
    summaryHash: sha256Hex(summary),
  };
}

function buildUseLatchSummary(): UseLatchFixtureEntry {
  const thinkerList = new ThinkerList();
  const player = createPlayer();

  playerReborn(player);

  const sector = {
    ceilingheight: 64 * FRACUNIT,
    floorheight: 0,
    special: 0,
    specialdata: null,
    tag: 1,
  };
  const line = { special: 1 };
  const sectorSoundSequence: number[] = [];
  const callbacks = {
    findLowestCeilingSurrounding: () => 128 * FRACUNIT,
    movePlane: () => 0,
    startSectorSound: (_sector: unknown, sfx: number) => {
      sectorSoundSequence.push(sfx);
    },
  };
  const buttonsByTic = [BT_USE, BT_USE, 0, BT_USE, BT_USE, 0, BT_USE];
  const activationTics: number[] = [];
  const directionAfterActivation: number[] = [];
  const snapshots: Array<{
    readonly activated: boolean;
    readonly buttons: number;
    readonly direction: number | null;
    readonly soundCount: number;
    readonly tic: number;
    readonly usedown: boolean;
  }> = [];

  for (let tic = 0; tic < buttonsByTic.length; tic += 1) {
    const buttons = buttonsByTic[tic]!;

    player.cmd = packTicCommand(0, 0, 0, buttons, 0, 0);

    let activated = false;
    if ((player.cmd.buttons & BT_USE) !== 0) {
      if (!player.usedown) {
        activated = evVerticalDoor(line, sector, player, thinkerList, callbacks) === 1;
        if (activated) {
          activationTics.push(tic);
          directionAfterActivation.push(getDoorDirection(sector) ?? 0);
        }
        player.usedown = true;
      }
    } else {
      player.usedown = false;
    }

    snapshots.push({
      activated,
      buttons,
      direction: getDoorDirection(sector),
      soundCount: sectorSoundSequence.length,
      tic,
      usedown: player.usedown,
    });
  }

  return {
    activationTics,
    description: 'usedown starts true after reborn, so held use is ignored until release; repeatable door special 1 then opens on the first re-press and closes on the next re-press without replaying the open sound.',
    directionAfterActivation,
    finalDoorDirection: getDoorDirection(sector),
    finalUsedown: player.usedown,
    lineSpecial: line.special,
    sectorSoundSequence,
    streamHash: sha256Hex(snapshots),
    ticCount: snapshots.length,
  };
}

function findStateIndex(state: (typeof STATES)[number] | null): number | null {
  if (state === null) {
    return null;
  }

  const stateIndex = STATES.indexOf(state);
  if (stateIndex < 0) {
    throw new RangeError('State table entry is missing from STATES.');
  }

  return stateIndex;
}

function getDoorDirection(sector: DoorSector): number | null {
  const specialdata = sector.specialdata;
  if (specialdata !== null && 'direction' in specialdata && typeof specialdata.direction === 'number') {
    return specialdata.direction;
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function parseAttackLatchFixtureEntry(value: unknown): AttackLatchFixtureEntry {
  if (!isRecord(value)) {
    throw new TypeError('attackLatch fixture entry must be an object.');
  }

  return {
    description: parseNonEmptyString('attackLatch.description', value.description),
    finalAttackdown: parseBoolean('attackLatch.finalAttackdown', value.finalAttackdown),
    finalMoStateIndex: parseNullableInteger('attackLatch.finalMoStateIndex', value.finalMoStateIndex),
    finalRefire: parseInteger('attackLatch.finalRefire', value.finalRefire),
    finalWeaponStateIndex: parseNullableInteger('attackLatch.finalWeaponStateIndex', value.finalWeaponStateIndex),
    finalWeaponSy: parseInteger('attackLatch.finalWeaponSy', value.finalWeaponSy),
    fireTics: parseIntegerArray('attackLatch.fireTics', value.fireTics),
    streamHash: parseFixtureHash('attackLatch.streamHash', value.streamHash),
    ticCount: parseInteger('attackLatch.ticCount', value.ticCount),
  };
}

function parseBoolean(name: string, value: unknown): boolean {
  if (typeof value !== 'boolean') {
    throw new TypeError(`${name} must be a boolean.`);
  }

  return value;
}

function parseDenialFixtureEntry(name: string, value: unknown): DenialFixtureEntry {
  if (!isRecord(value)) {
    throw new TypeError(`${name} fixture entry must be an object.`);
  }

  return {
    description: parseNonEmptyString(`${name}.description`, value.description),
    doorCreated: parseBoolean(`${name}.doorCreated`, value.doorCreated),
    lineSpecial: parseInteger(`${name}.lineSpecial`, value.lineSpecial),
    message: parseNonEmptyString(`${name}.message`, value.message),
    playerSoundSequence: parseIntegerArray(`${name}.playerSoundSequence`, value.playerSoundSequence),
    result: parseInteger(`${name}.result`, value.result),
    summaryHash: parseFixtureHash(`${name}.summaryHash`, value.summaryHash),
  };
}

function parseFixtureHash(name: string, value: unknown): string {
  if (typeof value !== 'string' || !/^[0-9A-F]{64}$/.test(value)) {
    throw new TypeError(`${name} must be a 64-character upper-case SHA-256 hex string.`);
  }

  return value;
}

function parseInteger(name: string, value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new TypeError(`${name} must be an integer.`);
  }

  return value;
}

function parseIntegerArray(name: string, value: unknown): readonly number[] {
  if (!Array.isArray(value)) {
    throw new TypeError(`${name} must be an array.`);
  }

  return value.map((entry, index) => parseInteger(`${name}[${index}]`, entry));
}

function parseNonEmptyString(name: string, value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${name} must be a non-empty string.`);
  }

  return value;
}

function parseNullableInteger(name: string, value: unknown): number | null {
  if (value === null) {
    return null;
  }

  return parseInteger(name, value);
}

function parseScriptedMechanicsFixture(value: unknown): ScriptedMechanicsFixture {
  if (!isRecord(value)) {
    throw new TypeError('scripted mechanics fixture must be an object.');
  }

  if (!isRecord(value.scenarios)) {
    throw new TypeError('scripted mechanics fixture scenarios must be an object.');
  }

  return {
    description: parseNonEmptyString('description', value.description),
    scenarios: {
      attackLatch: parseAttackLatchFixtureEntry(value.scenarios.attackLatch),
      manualBlueDenied: parseDenialFixtureEntry('manualBlueDenied', value.scenarios.manualBlueDenied),
      taggedBlueDenied: parseDenialFixtureEntry('taggedBlueDenied', value.scenarios.taggedBlueDenied),
      useLatch: parseUseLatchFixtureEntry(value.scenarios.useLatch),
    },
  };
}

function parseUseLatchFixtureEntry(value: unknown): UseLatchFixtureEntry {
  if (!isRecord(value)) {
    throw new TypeError('useLatch fixture entry must be an object.');
  }

  return {
    activationTics: parseIntegerArray('useLatch.activationTics', value.activationTics),
    description: parseNonEmptyString('useLatch.description', value.description),
    directionAfterActivation: parseIntegerArray('useLatch.directionAfterActivation', value.directionAfterActivation),
    finalDoorDirection: parseNullableInteger('useLatch.finalDoorDirection', value.finalDoorDirection),
    finalUsedown: parseBoolean('useLatch.finalUsedown', value.finalUsedown),
    lineSpecial: parseInteger('useLatch.lineSpecial', value.lineSpecial),
    sectorSoundSequence: parseIntegerArray('useLatch.sectorSoundSequence', value.sectorSoundSequence),
    streamHash: parseFixtureHash('useLatch.streamHash', value.streamHash),
    ticCount: parseInteger('useLatch.ticCount', value.ticCount),
  };
}

function sha256Hex(value: unknown): string {
  return new Bun.CryptoHasher('sha256').update(stableSerialize(value)).digest('hex').toUpperCase();
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableSerialize(entry)).join(',')}]`;
  }

  if (isRecord(value)) {
    const sortedEntries = Object.entries(value).sort(([leftKey], [rightKey]) => {
      if (leftKey < rightKey) {
        return -1;
      }

      if (leftKey > rightKey) {
        return 1;
      }

      return 0;
    });

    return `{${sortedEntries.map(([key, entryValue]) => `${JSON.stringify(key)}:${stableSerialize(entryValue)}`).join(',')}}`;
  }

  return JSON.stringify(value);
}

const fixturePath = fileURLToPath(new URL('./fixtures/scriptedMechanics.json', import.meta.url));
const scriptedMechanicsFixture = parseScriptedMechanicsFixture(await Bun.file(fixturePath).json());

describe('scripted mechanics fixture', () => {
  it('locks the four synthetic mechanics scenarios used by later parity work', () => {
    expect(Object.keys(scriptedMechanicsFixture.scenarios)).toEqual(['attackLatch', 'manualBlueDenied', 'taggedBlueDenied', 'useLatch']);
    expect(scriptedMechanicsFixture.description.length).toBeGreaterThan(0);
  });

  it('anchors both blue-key denial strings in both bundled DOS executables', async () => {
    for (const executableFileName of EXECUTABLE_FILE_NAMES) {
      const executablePath = `${REFERENCE_BUNDLE_PATH}\\${executableFileName}`;
      const executableText = Buffer.from(await Bun.file(executablePath).arrayBuffer()).toString('latin1');

      expect(executableText).toContain(PD_BLUEK);
      expect(executableText).toContain(PD_BLUEO);
    }
  });
});

describe('scripted input core mechanics', () => {
  it('matches the rocket attack latch fixture', () => {
    expect(buildAttackLatchSummary()).toEqual(scriptedMechanicsFixture.scenarios.attackLatch);
  });

  it('matches the use-button latch fixture', () => {
    expect(buildUseLatchSummary()).toEqual(scriptedMechanicsFixture.scenarios.useLatch);
  });

  it('matches the manual blue-door denial fixture', () => {
    expect(buildManualBlueDeniedSummary()).toEqual(scriptedMechanicsFixture.scenarios.manualBlueDenied);
  });

  it('matches the tagged blue-door denial fixture', () => {
    expect(buildTaggedBlueDeniedSummary()).toEqual(scriptedMechanicsFixture.scenarios.taggedBlueDenied);
  });
});

describe('parity-sensitive edge cases', () => {
  it('never enters MISSILE1 when attack is held continuously from respawn without a ready-state release', () => {
    const summary = buildAttackLatchSummary(null);

    expect(summary.fireTics).toEqual([]);
    expect(summary.finalWeaponStateIndex).toBe(57);
  });

  it('does not retrigger the door while use remains held across consecutive tics', () => {
    const summary = buildUseLatchSummary();

    expect(summary.activationTics).toEqual([3, 6]);
    expect(summary.sectorSoundSequence).toEqual([20]);
  });
});
