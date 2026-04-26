import { describe, expect, test } from 'bun:test';

import { RENDER_SCREENBLOCKS_FRAMEBUFFER_BYTE_LENGTH, RENDER_SCREENBLOCKS_RUNTIME_COMMAND, RENDER_SCREENBLOCKS_RUNTIME_ENTRY_FILE, renderScreenblocks } from '../../../src/playable/rendering-product-integration/renderScreenblocks.ts';
import { DetailMode, SCREENHEIGHT, SCREENWIDTH } from '../../../src/render/projection.ts';

const SOURCE_PATH = 'src/playable/rendering-product-integration/renderScreenblocks.ts';

describe('renderScreenblocks', () => {
  test('locks the Bun command contract and missing-live-rendering audit linkage', async () => {
    const manifestText = await Bun.file('plan_fps/manifests/01-012-audit-missing-live-rendering.json').text();

    expect(RENDER_SCREENBLOCKS_RUNTIME_COMMAND).toBe('bun run doom.ts');
    expect(RENDER_SCREENBLOCKS_RUNTIME_ENTRY_FILE).toBe('doom.ts');
    expect(manifestText).toContain('"schemaVersion": 1');
    expect(manifestText).toContain('"runtimeCommand": "bun run doom.ts"');
    expect(manifestText).toContain('"surface": "live-framebuffer-surface"');
    expect(manifestText).toContain('"surface": "presentation-blit-implementation"');
  });

  test('locks the implementation source hash', async () => {
    expect(await sha256File(SOURCE_PATH)).toBe('d3aaa138c0fadf9f2f2a5a70fdb74d2816310056e9fe1e01a31e846ee1a1c1ff');
  });

  test('copies only the vanilla screenblocks viewport into the replay framebuffer', () => {
    const destinationFramebuffer = new Uint8Array(RENDER_SCREENBLOCKS_FRAMEBUFFER_BYTE_LENGTH);
    const sourceFramebuffer = createSourceFramebuffer();

    destinationFramebuffer.fill(0xff);

    const evidence = renderScreenblocks({
      command: RENDER_SCREENBLOCKS_RUNTIME_COMMAND,
      destinationFramebuffer,
      detailMode: DetailMode.high,
      setBlocks: 9,
      sourceFramebuffer,
    });

    expect(evidence).toEqual({
      changedPixelCount: 41_472,
      command: 'bun run doom.ts',
      copiedPixelCount: 41_472,
      destinationChecksum: 1_722_970_560,
      detailMode: DetailMode.high,
      framebufferByteLength: 64_000,
      preservedPixelCount: 22_528,
      runtimeEntryFile: 'doom.ts',
      setBlocks: 9,
      viewport: {
        height: 144,
        left: 16,
        top: 12,
        width: 288,
      },
    });
    expect(destinationFramebuffer[0]).toBe(0xff);
    expect(destinationFramebuffer[12 * SCREENWIDTH + 16]).toBe(sourceFramebuffer[12 * SCREENWIDTH + 16]);
    expect(destinationFramebuffer[155 * SCREENWIDTH + 303]).toBe(sourceFramebuffer[155 * SCREENWIDTH + 303]);
    expect(destinationFramebuffer[156 * SCREENWIDTH + 303]).toBe(0xff);
    expect(sha256Bytes(destinationFramebuffer)).toBe('da2b2f946e920ba7ad180bbe96bd90cdec3b6d60fa54e5b6edf87262f432ae0f');
  });

  test('copies the full framebuffer when screenblocks is fullscreen', () => {
    const destinationFramebuffer = new Uint8Array(RENDER_SCREENBLOCKS_FRAMEBUFFER_BYTE_LENGTH);
    const sourceFramebuffer = createSourceFramebuffer();

    destinationFramebuffer.fill(0xff);

    const evidence = renderScreenblocks({
      command: RENDER_SCREENBLOCKS_RUNTIME_COMMAND,
      destinationFramebuffer,
      detailMode: DetailMode.low,
      setBlocks: 11,
      sourceFramebuffer,
    });

    expect(evidence.changedPixelCount).toBe(SCREENWIDTH * SCREENHEIGHT);
    expect(evidence.copiedPixelCount).toBe(SCREENWIDTH * SCREENHEIGHT);
    expect(evidence.detailMode).toBe(DetailMode.low);
    expect(evidence.preservedPixelCount).toBe(0);
    expect(evidence.viewport).toEqual({
      height: 200,
      left: 0,
      top: 0,
      width: 320,
    });
    expect(destinationFramebuffer).toEqual(sourceFramebuffer);
  });

  test('rejects non-Bun runtime commands before mutation', () => {
    const destinationFramebuffer = new Uint8Array(RENDER_SCREENBLOCKS_FRAMEBUFFER_BYTE_LENGTH);
    const originalDestination = new Uint8Array(destinationFramebuffer);

    expect(() =>
      renderScreenblocks({
        command: 'node doom.ts',
        destinationFramebuffer,
        detailMode: DetailMode.high,
        setBlocks: 9,
        sourceFramebuffer: createSourceFramebuffer(),
      }),
    ).toThrow('render screenblocks requires bun run doom.ts.');
    expect(destinationFramebuffer).toEqual(originalDestination);
  });

  test('rejects invalid framebuffers before mutation', () => {
    const destinationFramebuffer = new Uint8Array(RENDER_SCREENBLOCKS_FRAMEBUFFER_BYTE_LENGTH);
    const originalDestination = new Uint8Array(destinationFramebuffer);

    expect(() =>
      renderScreenblocks({
        command: RENDER_SCREENBLOCKS_RUNTIME_COMMAND,
        destinationFramebuffer,
        detailMode: DetailMode.high,
        setBlocks: 9,
        sourceFramebuffer: new Uint8Array(RENDER_SCREENBLOCKS_FRAMEBUFFER_BYTE_LENGTH - 1),
      }),
    ).toThrow('sourceFramebuffer must contain exactly 64000 bytes.');
    expect(destinationFramebuffer).toEqual(originalDestination);
  });

  test('clamps setBlocks below the vanilla minimum to MIN_SETBLOCKS=3', () => {
    const destinationFramebuffer = new Uint8Array(RENDER_SCREENBLOCKS_FRAMEBUFFER_BYTE_LENGTH);
    const sourceFramebuffer = createSourceFramebuffer();

    const evidence = renderScreenblocks({
      command: RENDER_SCREENBLOCKS_RUNTIME_COMMAND,
      destinationFramebuffer,
      detailMode: DetailMode.high,
      setBlocks: 0,
      sourceFramebuffer,
    });

    expect(evidence.setBlocks).toBe(3);
    expect(evidence.viewport).toEqual({ height: 48, left: 112, top: 60, width: 96 });
    expect(evidence.copiedPixelCount).toBe(96 * 48);
  });

  test('clamps setBlocks above the vanilla maximum to MAX_SETBLOCKS=11', () => {
    const destinationFramebuffer = new Uint8Array(RENDER_SCREENBLOCKS_FRAMEBUFFER_BYTE_LENGTH);
    const sourceFramebuffer = createSourceFramebuffer();

    const evidence = renderScreenblocks({
      command: RENDER_SCREENBLOCKS_RUNTIME_COMMAND,
      destinationFramebuffer,
      detailMode: DetailMode.high,
      setBlocks: 50,
      sourceFramebuffer,
    });

    expect(evidence.setBlocks).toBe(11);
    expect(evidence.viewport).toEqual({ height: SCREENHEIGHT, left: 0, top: 0, width: SCREENWIDTH });
    expect(evidence.copiedPixelCount).toBe(SCREENWIDTH * SCREENHEIGHT);
  });

  test('truncates fractional setBlocks toward zero before clamping', () => {
    const destinationFramebuffer = new Uint8Array(RENDER_SCREENBLOCKS_FRAMEBUFFER_BYTE_LENGTH);

    const evidence = renderScreenblocks({
      command: RENDER_SCREENBLOCKS_RUNTIME_COMMAND,
      destinationFramebuffer,
      detailMode: DetailMode.high,
      setBlocks: 9.95,
      sourceFramebuffer: createSourceFramebuffer(),
    });

    expect(evidence.setBlocks).toBe(9);
  });

  test('rejects non-finite setBlocks before mutation', () => {
    const destinationFramebuffer = new Uint8Array(RENDER_SCREENBLOCKS_FRAMEBUFFER_BYTE_LENGTH);
    const originalDestination = new Uint8Array(destinationFramebuffer);

    for (const setBlocks of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(() =>
        renderScreenblocks({
          command: RENDER_SCREENBLOCKS_RUNTIME_COMMAND,
          destinationFramebuffer,
          detailMode: DetailMode.high,
          setBlocks,
          sourceFramebuffer: createSourceFramebuffer(),
        }),
      ).toThrow('setBlocks must be a finite number.');
    }

    expect(destinationFramebuffer).toEqual(originalDestination);
  });

  test('treats any non-zero detail-mode integer as low detail', () => {
    const destinationFramebuffer = new Uint8Array(RENDER_SCREENBLOCKS_FRAMEBUFFER_BYTE_LENGTH);

    const evidence = renderScreenblocks({
      command: RENDER_SCREENBLOCKS_RUNTIME_COMMAND,
      destinationFramebuffer,
      detailMode: 7 as DetailMode,
      setBlocks: 11,
      sourceFramebuffer: createSourceFramebuffer(),
    });

    expect(evidence.detailMode).toBe(DetailMode.low);
  });
});

function createSourceFramebuffer(): Uint8Array<ArrayBuffer> {
  const framebuffer = new Uint8Array(RENDER_SCREENBLOCKS_FRAMEBUFFER_BYTE_LENGTH);

  for (let index = 0; index < framebuffer.length; index += 1) {
    framebuffer[index] = (index * 37 + 11) % 251;
  }

  return framebuffer;
}

async function sha256File(path: string): Promise<string> {
  const bytes = new Uint8Array(await Bun.file(path).arrayBuffer());
  return sha256Bytes(bytes);
}

function sha256Bytes(bytes: Uint8Array<ArrayBuffer>): string {
  return new Bun.CryptoHasher('sha256').update(bytes).digest('hex');
}
