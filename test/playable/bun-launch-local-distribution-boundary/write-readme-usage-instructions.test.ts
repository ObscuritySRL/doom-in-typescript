import { describe, expect, test } from 'bun:test';

import { WRITE_README_USAGE_INSTRUCTIONS_RUNTIME_COMMAND, writeReadmeUsageInstructions } from '../../../src/playable/bun-launch-local-distribution-boundary/writeReadmeUsageInstructions.ts';

const EXPECTED_DOCUMENTATION_HASH = '6f23060f9284717468135efa7ef4be31d98e7cb14e006b7e40f074885bca5056';
const EXPECTED_INSTRUCTIONS = Object.freeze([
  '## Usage',
  '',
  'Run from the repository root:',
  '',
  '```sh',
  'bun run doom.ts',
  '```',
  '',
  'Optional launch arguments:',
  '',
  '- `--iwad <path-to-iwad>` overrides the default local IWAD path.',
  '- `--map E1M1` selects the starting map.',
  '- `--skill 2` selects the vanilla skill number.',
  '- `--scale 2` sets the window scale.',
  '- `--list-maps` prints the IWAD map names and exits.',
  '',
  'Required local files:',
  '',
  '- `doom\\DOOM1.WAD` must exist locally unless `--iwad` points at another valid IWAD.',
  '',
  'The product runs through Bun only and does not redistribute IWAD or reference executable assets.',
]);

describe('writeReadmeUsageInstructions', () => {
  test('locks readme usage instructions to the product Bun command', () => {
    const evidence = writeReadmeUsageInstructions();

    expect(evidence).toEqual({
      commandContract: {
        entryFile: 'doom.ts',
        program: 'bun',
        runtimeCommand: 'bun run doom.ts',
        subcommand: 'run',
      },
      documentationHash: EXPECTED_DOCUMENTATION_HASH,
      instructions: EXPECTED_INSTRUCTIONS,
      replayCompatibility: {
        inputStreamMutated: false,
        randomSeedMutated: false,
        simulationTickAdvanced: false,
      },
      requiredLocalFiles: [
        {
          defaultPath: 'doom\\DOOM1.WAD',
          description: 'shareware IWAD supplied by the local user',
          requiredWhen: 'no --iwad override is provided',
        },
      ],
      stepIdentifier: '14-006',
      transition: {
        fromPackageScript: 'bun run src/main.ts',
        preservesDeterministicReplay: true,
        toProductCommand: 'bun run doom.ts',
      },
    });
  });

  test('keeps the usage evidence frozen and deterministic-replay compatible', () => {
    const evidence = writeReadmeUsageInstructions();

    expect(Object.isFrozen(evidence)).toBe(true);
    expect(Object.isFrozen(evidence.commandContract)).toBe(true);
    expect(Object.isFrozen(evidence.instructions)).toBe(true);
    expect(Object.isFrozen(evidence.replayCompatibility)).toBe(true);
    expect(Object.isFrozen(evidence.requiredLocalFiles)).toBe(true);
    expect(Object.isFrozen(evidence.transition)).toBe(true);

    for (const requiredLocalFile of evidence.requiredLocalFiles) {
      expect(Object.isFrozen(requiredLocalFile)).toBe(true);
    }

    expect(evidence.instructions.join('\n')).not.toContain('bun run start');
    expect(evidence.instructions.join('\n')).toContain(WRITE_README_USAGE_INSTRUCTIONS_RUNTIME_COMMAND);
  });

  test('rejects non-product launch commands before producing usage instructions', () => {
    expect(() => writeReadmeUsageInstructions('bun run src/main.ts')).toThrow('write-readme-usage-instructions requires bun run doom.ts, got bun run src/main.ts.');
  });
});
