import { describe, expect, test } from 'bun:test';

import { clipToInt16, computeStereoGains, dmxByteToInt16, mixVoices } from '../../src/audio/pcmMixer';
import { OPL_OP_REG_WAVEFORM, createOplRegisterFile, decodeOplOperator, operatorOffset, operatorRegisterAddress, writeOplRegister } from '../../src/audio/oplRegisters';
import { OPL_ALGORITHM_FM, OPL_MULTIPLIER_TABLE_X2, OPL_PHASE_ACCUMULATOR_BITS, OPL_PHASE_ACCUMULATOR_MODULO, advancePhase, applyTotalLevel, combineOperators } from '../../src/audio/oplSynth';
import { CF_NOMOMENTUM } from '../../src/player/movement';
import { REFERENCE_BUNDLE_PATH } from '../../src/reference/policy';
import { CF_GODMODE, playerInSpecialSector } from '../../src/specials/sectorSpecials';
import quirkFixture from './fixtures/quirkCases.json';

type QuirkCase = {
  anchors?: string[];
  category: string;
  expected?: Record<string, unknown>;
  id: string;
  module: string;
  title: string;
};

type QuirkFixture = {
  cases: QuirkCase[];
  referenceExecutables: string[];
  version: number;
};

type SectorSpecialCallbacksLike = Parameters<typeof playerInSpecialSector>[3];
type SectorSpecialPlayerLike = Parameters<typeof playerInSpecialSector>[0];
type SectorSpecialSectorLike = Parameters<typeof playerInSpecialSector>[1];

type SectorCallbackEvents = {
  damageAmounts: number[];
  exitCalls: number;
  randomCalls: number;
};

const fixture: QuirkFixture = quirkFixture;

function getCase(caseId: string): QuirkCase {
  const value = fixture.cases.find((entry) => entry.id === caseId);

  if (value === undefined) {
    throw new Error(`Missing quirk case ${caseId}`);
  }

  return value;
}

function getExpected(caseEntry: QuirkCase): Record<string, unknown> {
  const { expected } = caseEntry;

  if (expected === undefined) {
    throw new Error(`Missing expected values for quirk case ${caseEntry.id}`);
  }

  return expected;
}

function getExpectedNumber(expected: Record<string, unknown>, name: string): number {
  const value = expected[name];

  if (typeof value !== 'number') {
    throw new Error(`Expected numeric ${name}`);
  }

  return value;
}

function getExpectedNumberArray(expected: Record<string, unknown>, name: string): number[] {
  const value = expected[name];

  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'number')) {
    throw new Error(`Expected numeric array ${name}`);
  }

  return value;
}

function createSectorCallbacks(player: SectorSpecialPlayerLike, randomValues: number[] = []): { callbacks: SectorSpecialCallbacksLike; events: SectorCallbackEvents } {
  const events: SectorCallbackEvents = {
    damageAmounts: [],
    exitCalls: 0,
    randomCalls: 0,
  };
  const randomQueue = randomValues.slice();

  return {
    callbacks: {
      damage(amount) {
        events.damageAmounts.push(amount);
        player.health = Math.max(0, player.health - amount);
      },
      exitLevel() {
        events.exitCalls += 1;
      },
      random() {
        events.randomCalls += 1;
        return randomQueue.shift() ?? 0;
      },
    },
    events,
  };
}

function createSectorPlayer(overrides: Partial<SectorSpecialPlayerLike> & { mo?: { z: number }; powers?: number[] } = {}): SectorSpecialPlayerLike {
  return {
    cheats: overrides.cheats ?? 0,
    health: overrides.health ?? 100,
    mo: {
      z: overrides.mo?.z ?? 0,
    },
    powers: overrides.powers ?? [0, 0, 0, 0, 0, 0, 0, 0],
    secretcount: overrides.secretcount ?? 0,
  };
}

function createSectorState(special: number, floorheight: number): SectorSpecialSectorLike {
  return {
    floorheight,
    special,
  };
}

async function readExecutable(path: string): Promise<Buffer> {
  return Buffer.from(await Bun.file(path).arrayBuffer());
}

describe('vanilla quirk regression fixture', () => {
  test('defines the expected suite inventory in stable order', () => {
    const ids = fixture.cases.map((entry) => entry.id);

    expect(fixture.version).toBe(1);
    expect(ids).toEqual(['Q-001', 'Q-002', 'Q-003', 'Q-004', 'Q-005', 'Q-006', 'Q-007', 'Q-008', 'Q-009', 'Q-010', 'Q-011', 'Q-012', 'Q-013', 'Q-014', 'Q-015', 'Q-016']);
    expect(new Set(ids).size).toBe(ids.length);
    expect(fixture.referenceExecutables.length).toBe(2);
  });
});

describe('reference binary anchors', () => {
  test('bundled DOS executables retain the shared parity anchor strings', async () => {
    const anchorCase = getCase('Q-001');
    const anchors = anchorCase.anchors ?? [];

    for (const executableName of fixture.referenceExecutables) {
      const executablePath = `${REFERENCE_BUNDLE_PATH}\\${executableName}`;
      const executable = await readExecutable(executablePath);

      for (const anchor of anchors) {
        if (!executable.includes(Buffer.from(anchor, 'ascii'))) {
          throw new Error(`Missing anchor "${anchor}" in ${executablePath}`);
        }
      }
    }
  });
});

describe('player and sector quirks', () => {
  test('godmode and no-momentum cheat bits stay distinct', () => {
    const movementCase = getCase('Q-002');
    const expected = getExpected(movementCase);

    expect(CF_GODMODE).toBe(getExpectedNumber(expected, 'cfGodmode'));
    expect(CF_NOMOMENTUM).toBe(getExpectedNumber(expected, 'cfNoMomentum'));
    expect(CF_GODMODE).not.toBe(CF_NOMOMENTUM);
  });

  test('secret sectors credit once and clear their special immediately', () => {
    const quirkCase = getCase('Q-003');
    const expected = getExpected(quirkCase);
    const player = createSectorPlayer({
      mo: { z: getExpectedNumber(expected, 'playerZ') },
    });
    const sector = createSectorState(getExpectedNumber(expected, 'special'), getExpectedNumber(expected, 'floorheight'));
    const { callbacks, events } = createSectorCallbacks(player);

    playerInSpecialSector(player, sector, getExpectedNumber(expected, 'leveltime'), callbacks);

    expect(player.secretcount).toBe(getExpectedNumber(expected, 'secretcountAfter'));
    expect(sector.special).toBe(getExpectedNumber(expected, 'sectorSpecialAfter'));
    expect(events.damageAmounts.length).toBe(getExpectedNumber(expected, 'damageCalls'));
    expect(events.exitCalls).toBe(getExpectedNumber(expected, 'exitCalls'));
    expect(events.randomCalls).toBe(getExpectedNumber(expected, 'randomCalls'));
  });

  test('airborne players do not trigger secret-sector collection', () => {
    const quirkCase = getCase('Q-004');
    const expected = getExpected(quirkCase);
    const player = createSectorPlayer({
      mo: { z: getExpectedNumber(expected, 'playerZ') },
    });
    const sector = createSectorState(getExpectedNumber(expected, 'special'), getExpectedNumber(expected, 'floorheight'));
    const { callbacks, events } = createSectorCallbacks(player);

    playerInSpecialSector(player, sector, getExpectedNumber(expected, 'leveltime'), callbacks);

    expect(player.secretcount).toBe(getExpectedNumber(expected, 'secretcountAfter'));
    expect(sector.special).toBe(getExpectedNumber(expected, 'sectorSpecialAfter'));
    expect(events.damageAmounts.length).toBe(getExpectedNumber(expected, 'damageCalls'));
    expect(events.exitCalls).toBe(getExpectedNumber(expected, 'exitCalls'));
    expect(events.randomCalls).toBe(getExpectedNumber(expected, 'randomCalls'));
  });

  test('E1M8 exit sectors strip godmode and exit even off the damage cadence', () => {
    const quirkCase = getCase('Q-005');
    const expected = getExpected(quirkCase);
    const player = createSectorPlayer({
      cheats: getExpectedNumber(expected, 'initialCheats'),
      health: getExpectedNumber(expected, 'initialHealth'),
      mo: { z: getExpectedNumber(expected, 'playerZ') },
    });
    const sector = createSectorState(getExpectedNumber(expected, 'special'), getExpectedNumber(expected, 'floorheight'));
    const { callbacks, events } = createSectorCallbacks(player);

    playerInSpecialSector(player, sector, getExpectedNumber(expected, 'leveltime'), callbacks);

    expect(player.cheats).toBe(getExpectedNumber(expected, 'cheatsAfter'));
    expect(player.health).toBe(getExpectedNumber(expected, 'healthAfter'));
    expect(events.damageAmounts.length).toBe(getExpectedNumber(expected, 'damageCalls'));
    expect(events.exitCalls).toBe(getExpectedNumber(expected, 'exitCalls'));
  });

  test('suited strobe sectors still consume RNG on non-damage tics', () => {
    const quirkCase = getCase('Q-006');
    const expected = getExpected(quirkCase);
    const powers = [0, 0, 0, 0, 0, 0, 0, 0];

    powers[getExpectedNumber(expected, 'ironFeetIndex')] = getExpectedNumber(expected, 'ironFeetValue');

    const player = createSectorPlayer({
      mo: { z: getExpectedNumber(expected, 'playerZ') },
      powers,
    });
    const sector = createSectorState(getExpectedNumber(expected, 'special'), getExpectedNumber(expected, 'floorheight'));
    const { callbacks, events } = createSectorCallbacks(player, getExpectedNumberArray(expected, 'randomValues'));

    playerInSpecialSector(player, sector, getExpectedNumber(expected, 'leveltime'), callbacks);

    expect(events.randomCalls).toBe(getExpectedNumber(expected, 'randomCalls'));
    expect(events.damageAmounts.length).toBe(getExpectedNumber(expected, 'damageCalls'));
    expect(events.exitCalls).toBe(getExpectedNumber(expected, 'exitCalls'));
  });
});

describe('pcm mixer quirks', () => {
  test('DMX midpoint byte stays at plus 128 rather than zero', () => {
    const quirkCase = getCase('Q-007');
    const expected = getExpected(quirkCase);

    expect(dmxByteToInt16(getExpectedNumber(expected, 'sampleByte'))).toBe(getExpectedNumber(expected, 'int16'));
  });

  test('the stereo endpoint math stays unclamped at separation 255', () => {
    const quirkCase = getCase('Q-008');
    const expected = getExpected(quirkCase);
    const gains = computeStereoGains(getExpectedNumber(expected, 'volume'), getExpectedNumber(expected, 'separation'));

    expect(gains.left).toBe(getExpectedNumber(expected, 'left'));
    expect(gains.right).toBe(getExpectedNumber(expected, 'right'));
  });

  test('clipToInt16 normalizes negative zero back to positive zero', () => {
    const quirkCase = getCase('Q-009');
    const expected = getExpected(quirkCase);
    const value = clipToInt16(getExpectedNumber(expected, 'accumulator'));

    expect(value).toBe(getExpectedNumber(expected, 'normalizedZero'));
    expect(Object.is(value, -0)).toBe(false);
    expect(Object.is(value, 0)).toBe(true);
  });

  test('mixVoices zero-fills a reused caller buffer before mixing', () => {
    const quirkCase = getCase('Q-010');
    const expected = getExpected(quirkCase);
    const output = new Int16Array(getExpectedNumberArray(expected, 'prefill'));

    const mixed = mixVoices([], getExpectedNumber(expected, 'frameCount'), output);

    expect(mixed).toBe(output);
    expect(Array.from(mixed)).toEqual(getExpectedNumberArray(expected, 'mixed'));
  });
});

describe('OPL register quirks', () => {
  test('channel three uses the non-contiguous YM3812 operator offsets', () => {
    const quirkCase = getCase('Q-011');
    const expected = getExpected(quirkCase);

    expect(operatorOffset(getExpectedNumber(expected, 'channel'), 0)).toBe(getExpectedNumber(expected, 'modulator'));
    expect(operatorOffset(getExpectedNumber(expected, 'channel'), 1)).toBe(getExpectedNumber(expected, 'carrier'));
  });

  test('operator waveform decode stays masked to the OPL2 range', () => {
    const quirkCase = getCase('Q-012');
    const expected = getExpected(quirkCase);
    const registerFile = createOplRegisterFile();

    writeOplRegister(registerFile, operatorRegisterAddress(getExpectedNumber(expected, 'channel'), getExpectedNumber(expected, 'operator'), OPL_OP_REG_WAVEFORM), getExpectedNumber(expected, 'rawWaveformRegister'));

    expect(decodeOplOperator(registerFile, getExpectedNumber(expected, 'channel'), getExpectedNumber(expected, 'operator')).waveform).toBe(getExpectedNumber(expected, 'decodedWaveform'));
  });
});

describe('OPL synthesis quirks', () => {
  test('the YM3812 multiplier table keeps its duplicate tail entries', () => {
    const quirkCase = getCase('Q-013');
    const expected = getExpected(quirkCase);

    expect(OPL_MULTIPLIER_TABLE_X2.slice(getExpectedNumber(expected, 'startIndex'))).toEqual(getExpectedNumberArray(expected, 'tail'));
  });

  test('algorithm zero still returns the carrier only and keeps the 20-bit phase width', () => {
    const quirkCase = getCase('Q-014');
    const expected = getExpected(quirkCase);

    expect(OPL_PHASE_ACCUMULATOR_BITS).toBe(getExpectedNumber(expected, 'phaseBits'));
    expect(combineOperators(getExpectedNumber(expected, 'modulatorSample'), getExpectedNumber(expected, 'carrierSample'), OPL_ALGORITHM_FM)).toBe(getExpectedNumber(expected, 'result'));
  });

  test('negative phase deltas wrap to modulo minus one instead of clamping', () => {
    const quirkCase = getCase('Q-015');
    const expected = getExpected(quirkCase);

    expect(advancePhase(getExpectedNumber(expected, 'phase'), getExpectedNumber(expected, 'delta'))).toBe(OPL_PHASE_ACCUMULATOR_MODULO - 1);
  });

  test('applyTotalLevel also normalizes negative zero back to positive zero', () => {
    const quirkCase = getCase('Q-016');
    const expected = getExpected(quirkCase);
    const value = applyTotalLevel(getExpectedNumber(expected, 'sample'), getExpectedNumber(expected, 'totalLevel'));

    expect(value).toBe(getExpectedNumber(expected, 'result'));
    expect(Object.is(value, -0)).toBe(false);
  });
});
