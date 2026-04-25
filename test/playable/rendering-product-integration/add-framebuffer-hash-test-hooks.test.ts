import { describe, expect, test } from 'bun:test';

import {
  ADD_FRAMEBUFFER_HASH_TEST_HOOKS_AUDIT_SCHEMA_VERSION,
  ADD_FRAMEBUFFER_HASH_TEST_HOOKS_COMMAND,
  ADD_FRAMEBUFFER_HASH_TEST_HOOKS_MISSING_SURFACE,
  addFramebufferHashTestHooks,
} from '../../../src/playable/rendering-product-integration/addFramebufferHashTestHooks.ts';
import { DetailMode, SCREENHEIGHT, SCREENWIDTH } from '../../../src/render/projection.ts';

const FRAMEBUFFER_BYTE_LENGTH = SCREENWIDTH * SCREENHEIGHT;

describe('addFramebufferHashTestHooks', () => {
  test('captures deterministic full-frame viewport and transition evidence', () => {
    const hooks = addFramebufferHashTestHooks({
      detailMode: DetailMode.high,
      runtimeCommand: ADD_FRAMEBUFFER_HASH_TEST_HOOKS_COMMAND,
      screenBlocks: 9,
    });

    expect(hooks.command).toBe(ADD_FRAMEBUFFER_HASH_TEST_HOOKS_COMMAND);
    expect(hooks.detailMode).toBe(DetailMode.high);
    expect(hooks.screenBlocks).toBe(9);

    const evidence = hooks.captureFramebufferHash({
      frameNumber: 35,
      framebuffer: createFramebuffer(11),
      previousFramebuffer: createFramebuffer(3),
      tag: 'e1m1-visible-tic-35',
    });

    expect(evidence).toEqual({
      changedByteCount: 64_000,
      command: ADD_FRAMEBUFFER_HASH_TEST_HOOKS_COMMAND,
      frameNumber: 35,
      fullFramebufferChecksum: 3_425_308_800,
      fullFramebufferHash: 'b4f0d2b9a424beb742351d4d90b3ed45470af1e0c02fb217231215a8581b387b',
      tag: 'e1m1-visible-tic-35',
      transitionHash: '7f4df0d55a03b72b3460661854d3a6ffbfadad83bbe657321856c1eb0763ece1',
      viewport: {
        checksum: 2_264_032_128,
        hash: '298920bce846c3eab8becff9aade99fc1fd089778621f70843e69bb83e1e085c',
        height: 144,
        width: 288,
        x: 16,
        y: 12,
      },
    });
  });

  test('locks the command contract and missing-rendering audit surface', async () => {
    const manifestText = await Bun.file('plan_fps/manifests/01-012-audit-missing-live-rendering.json').text();

    expect(ADD_FRAMEBUFFER_HASH_TEST_HOOKS_AUDIT_SCHEMA_VERSION).toBe(1);
    expect(ADD_FRAMEBUFFER_HASH_TEST_HOOKS_COMMAND).toBe('bun run doom.ts');
    expect(ADD_FRAMEBUFFER_HASH_TEST_HOOKS_MISSING_SURFACE).toBe('framebuffer-hash-capture-hook');
    expect(manifestText).toContain('"schemaVersion": 1');
    expect(manifestText).toContain('"surface": "framebuffer-hash-capture-hook"');
    expect(manifestText).toContain('"path": null');
  });

  test('rejects non-target runtime commands', () => {
    expect(() =>
      addFramebufferHashTestHooks({
        detailMode: DetailMode.high,
        runtimeCommand: 'bun run src/main.ts',
        screenBlocks: 9,
      }),
    ).toThrow('Expected runtime command bun run doom.ts.');
  });

  test('rejects invalid previous framebuffers before capture evidence is produced', () => {
    const framebuffer = createFramebuffer(5);
    const framebufferBefore = new Uint8Array(framebuffer);
    const hooks = addFramebufferHashTestHooks({
      detailMode: DetailMode.low,
      runtimeCommand: ADD_FRAMEBUFFER_HASH_TEST_HOOKS_COMMAND,
      screenBlocks: 10,
    });

    expect(() =>
      hooks.captureFramebufferHash({
        frameNumber: 1,
        framebuffer,
        previousFramebuffer: new Uint8Array(1),
        tag: 'bad-previous-framebuffer',
      }),
    ).toThrow(`previousFramebuffer must be ${FRAMEBUFFER_BYTE_LENGTH} bytes.`);
    expect(framebuffer).toEqual(framebufferBefore);
  });
});

function createFramebuffer(seed: number): Uint8Array<ArrayBuffer> {
  const framebuffer = new Uint8Array(FRAMEBUFFER_BYTE_LENGTH);

  for (let byteIndex = 0; byteIndex < framebuffer.length; byteIndex += 1) {
    framebuffer[byteIndex] = (byteIndex * 17 + Math.trunc(byteIndex / 256) + seed) % 256;
  }

  return framebuffer;
}
