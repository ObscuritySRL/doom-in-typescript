import { describe, expect, test } from 'bun:test';

import { LOCKED_BUN_RUN_DOOM_COMMAND, lockBunRunDoomCommand } from '../../../src/playable/bun-launch-local-distribution-boundary/lockBunRunDoomCommand.ts';

const PRODUCT_SOURCE_PATH = 'src/playable/bun-launch-local-distribution-boundary/lockBunRunDoomCommand.ts';

describe('lockBunRunDoomCommand', () => {
  test('locks the exact Bun root command contract and transition', () => {
    const evidence = lockBunRunDoomCommand();

    expect(LOCKED_BUN_RUN_DOOM_COMMAND).toBe('bun run doom.ts');
    expect(evidence).toEqual({
      commandArguments: ['run', 'doom.ts'],
      commandHash: '819863a289609cd4c24173f37348ef42eb0fcc009dac4005d195bf4502743d6b',
      deterministicReplayCompatibility: {
        inputStreamMutation: 'none',
        randomSeedMutation: 'none',
        simulationTickMutation: 'none',
      },
      legacyStartScript: 'bun run src/main.ts',
      lockedCommand: 'bun run doom.ts',
      runtimeProgram: 'bun',
      stepIdentifier: '14-001',
      transition: {
        from: 'package-start-script',
        to: 'root-doom-ts-command',
      },
    });
  });

  test('returns deeply frozen deterministic replay evidence', () => {
    const evidence = lockBunRunDoomCommand();

    expect(Object.isFrozen(evidence)).toBe(true);
    expect(Object.isFrozen(evidence.commandArguments)).toBe(true);
    expect(Object.isFrozen(evidence.deterministicReplayCompatibility)).toBe(true);
    expect(Object.isFrozen(evidence.transition)).toBe(true);
  });

  test('rejects legacy or non-Bun launch commands before replay work', () => {
    expect(() => lockBunRunDoomCommand('bun run src/main.ts')).toThrow('Expected Bun launch command "bun run doom.ts", got "bun run src/main.ts".');
    expect(() => lockBunRunDoomCommand('node doom.ts')).toThrow('Expected Bun launch command "bun run doom.ts", got "node doom.ts".');
  });

  test('locks the formatted product source hash', async () => {
    const source = await Bun.file(PRODUCT_SOURCE_PATH).text();
    const sourceHash = new Bun.CryptoHasher('sha256').update(source).digest('hex');

    expect(sourceHash).toBe('671794a14e8316033e208299880ad42e56d2ba5c003026fb186db9f0d56a30a9');
  });
});
