import { describe, expect, it } from 'bun:test';

import { fileURLToPath } from 'node:url';

import type { DemoTicCommand } from '../../src/demo/demoParse.ts';
import { DemoPlayback } from '../../src/demo/demoPlayback.ts';
import type { TicCommand } from '../../src/input/ticcmd.ts';
import { packTicCommand } from '../../src/input/ticcmd.ts';
import { REFERENCE_BUNDLE_PATH } from '../../src/reference/policy.ts';
import { PRIMARY_TARGET } from '../../src/reference/target.ts';
import { parseWadDirectory } from '../../src/wad/directory.ts';
import { parseWadHeader } from '../../src/wad/header.ts';
import { LumpLookup } from '../../src/wad/lumpLookup.ts';

const ATTRACT_SEQUENCE_STRINGS = Object.freeze(['TITLEPIC', 'demo1', 'CREDIT', 'demo2', 'HELP2', 'demo3'] as const);
const DEMO_NAMES = Object.freeze(['DEMO1', 'DEMO2', 'DEMO3'] as const);
const EXECUTABLE_FILE_NAMES = Object.freeze(['DOOM.EXE', 'DOOMD.EXE'] as const);
const FIXTURE_CHECKPOINT_COUNT = 5;

type DemoName = (typeof DEMO_NAMES)[number];
type DemoSyncCompletionAction = 'advance-demo' | 'none' | 'quit';

interface DemoSyncCheckpoint {
  readonly hash: string;
  readonly tic: number;
}

interface DemoSyncFixture {
  readonly demos: Readonly<Record<DemoName, DemoSyncFixtureEntry>>;
  readonly description: string;
  readonly versionByte: number;
}

interface DemoSyncFixtureEntry {
  readonly checkpoints: readonly DemoSyncCheckpoint[];
  readonly completionAction: DemoSyncCompletionAction;
  readonly map: string;
  readonly nonZeroCommandCount: number;
  readonly skill: number;
  readonly streamHash: string;
  readonly ticCount: number;
}

function buildBundledDemoSummary(demoName: DemoName, versionByte: number): DemoSyncFixtureEntry {
  const demoBuffer = getReferenceDemoLump(demoName);
  const playback = new DemoPlayback(demoBuffer, { expectedVersionByte: versionByte });
  const streamedCommands: TicCommand[] = [];

  while (true) {
    const ticCommands = playback.readNextTic();
    if (ticCommands === null) {
      break;
    }

    if (ticCommands.length !== 1) {
      throw new Error(`${demoName} must remain a single-player demo, got ${ticCommands.length} commands`);
    }

    streamedCommands.push(toTicCommand(ticCommands[0]!));
  }

  const parsedDemo = playback.parsedDemo;

  return {
    checkpoints: computeCheckpointTics(streamedCommands.length).map((tic) => ({
      hash: sha256Hex(streamedCommands.slice(0, tic + 1)),
      tic,
    })),
    completionAction: playback.snapshot().completionAction,
    map: `E${parsedDemo.episode}M${parsedDemo.map}`,
    nonZeroCommandCount: streamedCommands.filter((command) => isNonZeroTicCommand(command)).length,
    skill: parsedDemo.skill,
    streamHash: sha256Hex(streamedCommands),
    ticCount: streamedCommands.length,
  };
}

function computeCheckpointTics(ticCount: number): readonly number[] {
  if (!Number.isInteger(ticCount) || ticCount <= 0) {
    throw new RangeError(`ticCount must be a positive integer, got ${ticCount}`);
  }

  return Object.freeze([0, Math.trunc(ticCount / 4), Math.trunc(ticCount / 2), Math.trunc((ticCount * 3) / 4), ticCount - 1]);
}

function getReferenceDemoLump(name: DemoName): Buffer {
  return referenceWadLookup.getLumpData(name, referenceWadBuffer);
}

function isNonZeroTicCommand(command: Readonly<TicCommand>): boolean {
  return command.angleturn !== 0 || command.buttons !== 0 || command.chatchar !== 0 || command.consistancy !== 0 || command.forwardmove !== 0 || command.sidemove !== 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function parseCompletionAction(name: string, value: unknown): DemoSyncCompletionAction {
  if (value === 'advance-demo' || value === 'none' || value === 'quit') {
    return value;
  }

  throw new TypeError(`${name} must be a valid demo completion action.`);
}

function parseDemoSyncCheckpoint(value: unknown, name: string): DemoSyncCheckpoint {
  if (!isRecord(value)) {
    throw new TypeError(`${name} must be an object.`);
  }

  return {
    hash: parseFixtureHash(`${name}.hash`, value.hash),
    tic: parseFixtureInteger(`${name}.tic`, value.tic),
  };
}

function parseDemoSyncFixture(value: unknown): DemoSyncFixture {
  if (!isRecord(value)) {
    throw new TypeError('demo sync fixture must be an object.');
  }

  if (!isRecord(value.demos)) {
    throw new TypeError('demo sync fixture demos must be an object.');
  }

  if (typeof value.description !== 'string' || value.description.length === 0) {
    throw new TypeError('demo sync fixture description must be a non-empty string.');
  }

  const versionByte = parseFixtureInteger('versionByte', value.versionByte);

  return {
    demos: {
      DEMO1: parseDemoSyncFixtureEntry(value.demos.DEMO1, 'DEMO1'),
      DEMO2: parseDemoSyncFixtureEntry(value.demos.DEMO2, 'DEMO2'),
      DEMO3: parseDemoSyncFixtureEntry(value.demos.DEMO3, 'DEMO3'),
    },
    description: value.description,
    versionByte,
  };
}

function parseDemoSyncFixtureEntry(value: unknown, demoName: DemoName): DemoSyncFixtureEntry {
  if (!isRecord(value)) {
    throw new TypeError(`${demoName} fixture entry must be an object.`);
  }

  const ticCount = parseFixtureInteger(`${demoName}.ticCount`, value.ticCount);
  const checkpointTics = computeCheckpointTics(ticCount);

  if (!Array.isArray(value.checkpoints) || value.checkpoints.length !== FIXTURE_CHECKPOINT_COUNT) {
    throw new TypeError(`${demoName}.checkpoints must contain ${FIXTURE_CHECKPOINT_COUNT} items.`);
  }

  const checkpoints = value.checkpoints.map((checkpoint, checkpointIndex) => parseDemoSyncCheckpoint(checkpoint, `${demoName}.checkpoints[${checkpointIndex}]`));

  for (let checkpointIndex = 0; checkpointIndex < checkpointTics.length; checkpointIndex += 1) {
    if (checkpoints[checkpointIndex]!.tic !== checkpointTics[checkpointIndex]) {
      throw new TypeError(`${demoName}.checkpoints[${checkpointIndex}].tic must equal ${checkpointTics[checkpointIndex]}.`);
    }
  }

  if (typeof value.map !== 'string' || !/^E[1-4]M[1-9]$/.test(value.map)) {
    throw new TypeError(`${demoName}.map must be an ExMy map name.`);
  }

  return {
    checkpoints,
    completionAction: parseCompletionAction(`${demoName}.completionAction`, value.completionAction),
    map: value.map,
    nonZeroCommandCount: parseFixtureInteger(`${demoName}.nonZeroCommandCount`, value.nonZeroCommandCount),
    skill: parseFixtureInteger(`${demoName}.skill`, value.skill),
    streamHash: parseFixtureHash(`${demoName}.streamHash`, value.streamHash),
    ticCount,
  };
}

function parseFixtureHash(name: string, value: unknown): string {
  if (typeof value !== 'string' || !/^[0-9A-F]{64}$/.test(value)) {
    throw new TypeError(`${name} must be a 64-character upper-case SHA-256 hex string.`);
  }

  return value;
}

function parseFixtureInteger(name: string, value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new TypeError(`${name} must be an integer.`);
  }

  return value;
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

function toTicCommand(command: Readonly<DemoTicCommand>): Readonly<TicCommand> {
  return packTicCommand(command.forwardMove, command.sideMove, command.angleTurn, command.buttons, 0, 0);
}

const fixturePath = fileURLToPath(new URL('./fixtures/demoSync.json', import.meta.url));
const demoSyncFixture = parseDemoSyncFixture(await Bun.file(fixturePath).json());
const referenceWadPath = `${REFERENCE_BUNDLE_PATH}\\${PRIMARY_TARGET.wadFilename}`;
const referenceWadBuffer = Buffer.from(await Bun.file(referenceWadPath).arrayBuffer());
const referenceWadDirectory = parseWadDirectory(referenceWadBuffer, parseWadHeader(referenceWadBuffer));
const referenceWadLookup = new LumpLookup(referenceWadDirectory);

describe('bundled demo sync fixture', () => {
  it('locks the Doom 1.9 version byte and all three bundled shareware demos', () => {
    expect(demoSyncFixture.versionByte).toBe(109);
    expect(Object.keys(demoSyncFixture.demos)).toEqual([...DEMO_NAMES]);
  });

  it('matches the attract demo sequence strings embedded in both reference DOS executables', async () => {
    for (const executableFileName of EXECUTABLE_FILE_NAMES) {
      const executablePath = `${REFERENCE_BUNDLE_PATH}\\${executableFileName}`;
      const executableText = Buffer.from(await Bun.file(executablePath).arrayBuffer()).toString('latin1');
      let previousIndex = -1;

      for (const attractSequenceString of ATTRACT_SEQUENCE_STRINGS) {
        const currentIndex = executableText.indexOf(attractSequenceString, previousIndex + 1);
        expect(currentIndex).toBeGreaterThan(-1);
        expect(currentIndex).toBeGreaterThan(previousIndex);
        previousIndex = currentIndex;
      }

      expect(executableText).toContain('Demo is from a different game version!');
    }
  });
});

describe('bundled demo sync', () => {
  it('matches the canonical single-player ticcmd hashes for DEMO1, DEMO2, and DEMO3', () => {
    for (const demoName of DEMO_NAMES) {
      expect(buildBundledDemoSummary(demoName, demoSyncFixture.versionByte)).toEqual(demoSyncFixture.demos[demoName]);
    }
  });
});

describe('parity-sensitive edge cases', () => {
  it('drops out of sync if the final real tic before the marker is omitted', () => {
    const demoBuffer = getReferenceDemoLump('DEMO1');
    const playback = new DemoPlayback(demoBuffer, { expectedVersionByte: demoSyncFixture.versionByte });
    const truncatedCommands: TicCommand[] = [];

    while (truncatedCommands.length < playback.parsedDemo.ticCount - 1) {
      const ticCommands = playback.readNextTic();

      if (ticCommands === null || ticCommands.length !== 1) {
        throw new Error('Expected a single-player DEMO1 tic before the marker boundary.');
      }

      truncatedCommands.push(toTicCommand(ticCommands[0]!));
    }

    expect(playback.snapshot().completionAction).toBe('none');
    expect(playback.snapshot().demoplayback).toBe(true);
    expect(sha256Hex(truncatedCommands)).not.toBe(demoSyncFixture.demos.DEMO1.streamHash);
  });
});
