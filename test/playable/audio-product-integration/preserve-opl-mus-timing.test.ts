import { describe, expect, test } from 'bun:test';

import { createMusicSystem } from '../../../src/audio/musicSystem.ts';
import { MISSING_LIVE_AUDIO_AUDIT_STEP_ID, OPL_MUS_QUICKTICKS_PER_GAME_TIC, PLAYABLE_RUNTIME_COMMAND, preserveOplMusTiming } from '../../../src/playable/audio-product-integration/preserveOplMusTiming.ts';

function hashText(text: string): string {
  const hasher = new Bun.CryptoHasher('sha256');
  hasher.update(text);
  return hasher.digest('hex');
}

describe('preserveOplMusTiming', () => {
  test('locks the Bun command contract, audit linkage, and source hash', async () => {
    const source = await Bun.file('src/playable/audio-product-integration/preserveOplMusTiming.ts').text();

    expect(PLAYABLE_RUNTIME_COMMAND).toBe('bun run doom.ts');
    expect(MISSING_LIVE_AUDIO_AUDIT_STEP_ID).toBe('01-011');
    expect(OPL_MUS_QUICKTICKS_PER_GAME_TIC).toBe(4);
    expect(hashText(source)).toBe('f90266a05cbb8542119ccef8c734cd4584b771b90a9ae46dccdd626112bddde3');
  });

  test('preserves replay-stable MUS quicktick timing evidence', () => {
    const system = createMusicSystem();
    const evidence = preserveOplMusTiming({
      runtimeCommand: PLAYABLE_RUNTIME_COMMAND,
      system,
      windows: [
        { gameTic: 0, gameTics: 1 },
        { gameTic: 1, gameTics: 2 },
        { gameTic: 3, gameTics: 0 },
      ],
    });

    expect(evidence).toEqual({
      auditStepId: '01-011',
      replayChecksum: 1_140_817_209,
      replayHash: 'efc07f9186dc0b84d1bd5742717662842f5f1f9bef238dd0fa9c9b81bda606c0',
      runtimeCommand: 'bun run doom.ts',
      totalDispatchedEventCount: 0,
      totalGameTics: 3,
      totalQuickTicks: 12,
      windows: [
        {
          dispatchedEventCount: 0,
          eventHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          eventSignature: '',
          gameTic: 0,
          gameTics: 1,
          quickTicks: 4,
        },
        {
          dispatchedEventCount: 0,
          eventHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          eventSignature: '',
          gameTic: 1,
          gameTics: 2,
          quickTicks: 8,
        },
        {
          dispatchedEventCount: 0,
          eventHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          eventSignature: '',
          gameTic: 3,
          gameTics: 0,
          quickTicks: 0,
        },
      ],
    });
  });

  test('rejects non-playable runtime commands before timing advance', () => {
    const system = createMusicSystem();

    expect(() =>
      preserveOplMusTiming({
        runtimeCommand: 'bun run src/main.ts',
        system,
        windows: [{ gameTic: 0, gameTics: 1 }],
      }),
    ).toThrow('preserveOplMusTiming requires bun run doom.ts, got bun run src/main.ts');

    expect(system.currentMusicNum).toBeNull();
  });

  test('rejects invalid timing windows before producing evidence', () => {
    const system = createMusicSystem();

    expect(() =>
      preserveOplMusTiming({
        runtimeCommand: PLAYABLE_RUNTIME_COMMAND,
        system,
        windows: [{ gameTic: 0, gameTics: -1 }],
      }),
    ).toThrow('gameTics must be a non-negative integer, got -1');

    expect(system.currentMusicNum).toBeNull();
  });
});
