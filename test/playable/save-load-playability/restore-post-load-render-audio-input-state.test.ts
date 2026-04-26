import { describe, expect, test } from 'bun:test';

import type { SaveGameHeader, SaveGamePlayerPresence } from '../../../src/save/saveHeader.ts';

import {
  RESTORE_POST_LOAD_RENDER_AUDIO_INPUT_STATE_COMMAND_CONTRACT,
  RESTORE_POST_LOAD_RENDER_AUDIO_INPUT_STATE_RUNTIME_COMMAND,
  restorePostLoadRenderAudioInputState,
} from '../../../src/playable/save-load-playability/restorePostLoadRenderAudioInputState.ts';
import { SAVEGAME_VERSION_TEXT } from '../../../src/save/saveHeader.ts';

const sourcePath = 'src/playable/save-load-playability/restorePostLoadRenderAudioInputState.ts';

const loadedPlayerPresence: SaveGamePlayerPresence = Object.freeze([1, 0, 0, 0]);

const loadedHeader: SaveGameHeader = Object.freeze({
  description: 'E1M1 post load',
  gameepisode: 1,
  gamemap: 1,
  gameskill: 2,
  leveltime: 0x01_23_45,
  playeringame: loadedPlayerPresence,
});

async function calculateSourceHash(): Promise<string> {
  const sourceBytes = new Uint8Array(await Bun.file(sourcePath).arrayBuffer());

  return new Bun.CryptoHasher('sha256').update(sourceBytes).digest('hex');
}

describe('restorePostLoadRenderAudioInputState', () => {
  test('locks the Bun runtime command contract and source hash', async () => {
    expect(RESTORE_POST_LOAD_RENDER_AUDIO_INPUT_STATE_RUNTIME_COMMAND).toBe('bun run doom.ts');
    expect(RESTORE_POST_LOAD_RENDER_AUDIO_INPUT_STATE_COMMAND_CONTRACT).toEqual({
      entryFile: 'doom.ts',
      program: 'bun',
      runtimeCommand: 'bun run doom.ts',
      subcommand: 'run',
    });
    expect(await calculateSourceHash()).toBe('68d6447cf1a31a54bc8e575438941265ed1202c7528325f70ac06f029e8fc9af');
  });

  test('restores deterministic render audio and input state after a successful load', () => {
    const result = restorePostLoadRenderAudioInputState({
      command: 'bun run doom.ts',
      header: loadedHeader,
    });

    expect(result).toEqual({
      audioState: {
        activeMusic: 'e1m1',
        loopMusic: true,
        pendingSoundEffectsCleared: true,
        resumeAudio: true,
      },
      commandContract: {
        entryFile: 'doom.ts',
        program: 'bun',
        runtimeCommand: 'bun run doom.ts',
        subcommand: 'run',
      },
      headerDescription: 'E1M1 post load',
      inputState: {
        heldKeysCleared: true,
        horizontalMouseDelta: 0,
        mouseButtonsCleared: true,
        pendingEventsCleared: true,
        verticalMouseDelta: 0,
      },
      renderState: {
        automapStateCleared: true,
        fullFrameRefreshRequired: true,
        paletteIndex: 0,
        statusBarRefreshRequired: true,
        viewMode: 'gameplay',
      },
      replayChecksum: 166819490,
      restoreAccepted: true,
      transition: 'restored',
      transitionSignature: 'restored|E1M1|skill=2|leveltime=74565|players=1000|version=version 109|eof=29|render=full-frame|audio=e1m1|input=flushed',
    });
  });

  test('skips state mutation when the load path did not produce a compatible header', () => {
    const result = restorePostLoadRenderAudioInputState({
      command: 'bun run doom.ts',
      header: null,
    });

    expect(result).toEqual({
      audioState: {
        activeMusic: null,
        loopMusic: false,
        pendingSoundEffectsCleared: false,
        resumeAudio: false,
      },
      commandContract: {
        entryFile: 'doom.ts',
        program: 'bun',
        runtimeCommand: 'bun run doom.ts',
        subcommand: 'run',
      },
      headerDescription: null,
      inputState: {
        heldKeysCleared: false,
        horizontalMouseDelta: 0,
        mouseButtonsCleared: false,
        pendingEventsCleared: false,
        verticalMouseDelta: 0,
      },
      renderState: {
        automapStateCleared: false,
        fullFrameRefreshRequired: false,
        paletteIndex: 0,
        statusBarRefreshRequired: false,
        viewMode: null,
      },
      replayChecksum: 142851233,
      restoreAccepted: false,
      transition: 'skipped',
      transitionSignature: 'skipped|version=version 109|eof=29|render=preserved|audio=preserved|input=preserved',
    });
  });

  test('rejects non-product commands before post-load state changes', () => {
    expect(() =>
      restorePostLoadRenderAudioInputState({
        command: 'bun run src/main.ts',
        header: loadedHeader,
      }),
    ).toThrow('restore post-load render/audio/input state requires bun run doom.ts.');
  });

  test('rejects an empty-string command at the boundary so silent fallback drift cannot bypass the runtime check', () => {
    expect(() =>
      restorePostLoadRenderAudioInputState({
        command: '',
        header: loadedHeader,
      }),
    ).toThrow('restore post-load render/audio/input state requires bun run doom.ts.');

    expect(() =>
      restorePostLoadRenderAudioInputState({
        command: '',
        header: null,
      }),
    ).toThrow('restore post-load render/audio/input state requires bun run doom.ts.');
  });

  test('returns a frozen restored evidence whose nested audio render and input states are also frozen', () => {
    const result = restorePostLoadRenderAudioInputState({
      command: 'bun run doom.ts',
      header: loadedHeader,
    });

    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.audioState)).toBe(true);
    expect(Object.isFrozen(result.commandContract)).toBe(true);
    expect(Object.isFrozen(result.inputState)).toBe(true);
    expect(Object.isFrozen(result.renderState)).toBe(true);
  });

  test('returns a frozen skipped evidence whose nested audio render and input states are also frozen', () => {
    const result = restorePostLoadRenderAudioInputState({
      command: 'bun run doom.ts',
      header: null,
    });

    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.audioState)).toBe(true);
    expect(Object.isFrozen(result.commandContract)).toBe(true);
    expect(Object.isFrozen(result.inputState)).toBe(true);
    expect(Object.isFrozen(result.renderState)).toBe(true);
  });

  test('keeps the shared command contract object frozen so callers cannot mutate it', () => {
    expect(Object.isFrozen(RESTORE_POST_LOAD_RENDER_AUDIO_INPUT_STATE_COMMAND_CONTRACT)).toBe(true);
  });

  test('locks the missing save load UI audit link for post-load state handling', async () => {
    const auditManifestText = await Bun.file('plan_fps/manifests/01-013-audit-missing-save-load-ui.json').text();

    expect(auditManifestText).toContain('"schemaVersion": 1');
    expect(auditManifestText).toContain('"runtimeCommand": "bun run doom.ts"');
    expect(auditManifestText).toContain('"surface": "live-load-game-roundtrip"');
    expect(auditManifestText).toContain('post-load state handling');
    expect(SAVEGAME_VERSION_TEXT).toBe('version 109');
  });
});
