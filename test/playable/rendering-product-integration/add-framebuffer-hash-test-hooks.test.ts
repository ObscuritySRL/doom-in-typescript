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

    expect(Object.isFrozen(hooks)).toBe(true);
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

  test('produces deterministic evidence across repeated calls with identical inputs', () => {
    const hooks = addFramebufferHashTestHooks({
      detailMode: DetailMode.high,
      runtimeCommand: ADD_FRAMEBUFFER_HASH_TEST_HOOKS_COMMAND,
      screenBlocks: 9,
    });

    const captureOptions = {
      frameNumber: 7,
      framebuffer: createFramebuffer(11),
      previousFramebuffer: createFramebuffer(3),
      tag: 'deterministic-replay',
    };

    const firstEvidence = hooks.captureFramebufferHash(captureOptions);
    const secondEvidence = hooks.captureFramebufferHash(captureOptions);
    expect(secondEvidence).toEqual(firstEvidence);
  });

  test('reports zero changed bytes and the doubled-buffer transition hash for identical previous and current framebuffers', () => {
    const hooks = addFramebufferHashTestHooks({
      detailMode: DetailMode.high,
      runtimeCommand: ADD_FRAMEBUFFER_HASH_TEST_HOOKS_COMMAND,
      screenBlocks: 9,
    });
    const framebuffer = createFramebuffer(5);

    const evidence = hooks.captureFramebufferHash({
      frameNumber: 0,
      framebuffer,
      previousFramebuffer: framebuffer,
      tag: 'identical-frames',
    });

    expect(evidence.changedByteCount).toBe(0);
    const expectedTransitionHasher = new Bun.CryptoHasher('sha256');
    expectedTransitionHasher.update(framebuffer);
    expectedTransitionHasher.update(framebuffer);
    expect(evidence.transitionHash).toBe(expectedTransitionHasher.digest('hex'));
  });

  test('handles undefined previousFramebuffer by reporting zero changed bytes and a single-buffer transition hash', () => {
    const hooks = addFramebufferHashTestHooks({
      detailMode: DetailMode.high,
      runtimeCommand: ADD_FRAMEBUFFER_HASH_TEST_HOOKS_COMMAND,
      screenBlocks: 9,
    });
    const framebuffer = createFramebuffer(5);

    const evidence = hooks.captureFramebufferHash({
      frameNumber: 0,
      framebuffer,
      tag: 'no-previous-frame',
    });

    expect(evidence.changedByteCount).toBe(0);
    const expectedTransitionHasher = new Bun.CryptoHasher('sha256');
    expectedTransitionHasher.update(framebuffer);
    expect(evidence.transitionHash).toBe(expectedTransitionHasher.digest('hex'));
    expect(evidence.fullFramebufferHash).toBe(evidence.transitionHash);
  });

  test('reports the full screen viewport when screenBlocks is at the maximum', () => {
    const hooks = addFramebufferHashTestHooks({
      detailMode: DetailMode.high,
      runtimeCommand: ADD_FRAMEBUFFER_HASH_TEST_HOOKS_COMMAND,
      screenBlocks: 11,
    });
    const evidence = hooks.captureFramebufferHash({
      frameNumber: 0,
      framebuffer: createFramebuffer(0),
      tag: 'full-screen-viewport',
    });

    expect(evidence.viewport.x).toBe(0);
    expect(evidence.viewport.y).toBe(0);
    expect(evidence.viewport.height).toBe(SCREENHEIGHT);
    expect(evidence.viewport.width).toBe(SCREENWIDTH);
    expect(evidence.viewport.hash).toBe(evidence.fullFramebufferHash);
  });

  test('preserves the unshifted scaledViewWidth in the viewport evidence under low detail mode', () => {
    const hooks = addFramebufferHashTestHooks({
      detailMode: DetailMode.low,
      runtimeCommand: ADD_FRAMEBUFFER_HASH_TEST_HOOKS_COMMAND,
      screenBlocks: 9,
    });
    const evidence = hooks.captureFramebufferHash({
      frameNumber: 0,
      framebuffer: createFramebuffer(0),
      tag: 'low-detail-viewport',
    });

    expect(hooks.detailMode).toBe(DetailMode.low);
    expect(evidence.viewport.width).toBe(288);
    expect(evidence.viewport.height).toBe(144);
    expect(evidence.viewport.x).toBe(16);
    expect(evidence.viewport.y).toBe(12);
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

  test.each<{ readonly framebufferLength: number }>([
    { framebufferLength: 0 },
    { framebufferLength: FRAMEBUFFER_BYTE_LENGTH - 1 },
    { framebufferLength: FRAMEBUFFER_BYTE_LENGTH + 1 },
  ])('rejects framebuffers whose byte length is $framebufferLength', ({ framebufferLength }) => {
    const hooks = addFramebufferHashTestHooks({
      detailMode: DetailMode.high,
      runtimeCommand: ADD_FRAMEBUFFER_HASH_TEST_HOOKS_COMMAND,
      screenBlocks: 9,
    });

    expect(() =>
      hooks.captureFramebufferHash({
        frameNumber: 0,
        framebuffer: new Uint8Array(framebufferLength),
        tag: 'bad-framebuffer',
      }),
    ).toThrow(`framebuffer must be ${FRAMEBUFFER_BYTE_LENGTH} bytes.`);
  });

  test.each<{ readonly frameNumber: number }>([{ frameNumber: -1 }, { frameNumber: 1.5 }, { frameNumber: Number.NaN }])('rejects frame number $frameNumber', ({ frameNumber }) => {
    const hooks = addFramebufferHashTestHooks({
      detailMode: DetailMode.high,
      runtimeCommand: ADD_FRAMEBUFFER_HASH_TEST_HOOKS_COMMAND,
      screenBlocks: 9,
    });

    expect(() =>
      hooks.captureFramebufferHash({
        frameNumber,
        framebuffer: createFramebuffer(0),
        tag: 'bad-frame-number',
      }),
    ).toThrow('frameNumber must be a non-negative integer.');
  });

  test('rejects empty tag values', () => {
    const hooks = addFramebufferHashTestHooks({
      detailMode: DetailMode.high,
      runtimeCommand: ADD_FRAMEBUFFER_HASH_TEST_HOOKS_COMMAND,
      screenBlocks: 9,
    });

    expect(() =>
      hooks.captureFramebufferHash({
        frameNumber: 0,
        framebuffer: createFramebuffer(0),
        tag: '',
      }),
    ).toThrow('tag must not be empty.');
  });
});

function createFramebuffer(seed: number): Uint8Array<ArrayBuffer> {
  const framebuffer = new Uint8Array(FRAMEBUFFER_BYTE_LENGTH);

  for (let byteIndex = 0; byteIndex < framebuffer.length; byteIndex += 1) {
    framebuffer[byteIndex] = (byteIndex * 17 + Math.trunc(byteIndex / 256) + seed) % 256;
  }

  return framebuffer;
}
