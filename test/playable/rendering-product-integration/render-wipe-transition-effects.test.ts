import { describe, expect, test } from 'bun:test';

import { RENDER_WIPE_TRANSITION_EFFECTS_RUNTIME_COMMAND, renderWipeTransitionEffects } from '../../../src/playable/rendering-product-integration/renderWipeTransitionEffects.ts';

const FRAMEBUFFER_BYTE_LENGTH = 64_000;
const SCREEN_HEIGHT = 200;
const SCREEN_WIDTH = 320;

describe('renderWipeTransitionEffects', () => {
  test('locks the Bun runtime command contract and missing-rendering audit link', async () => {
    const missingRenderingAuditManifest = await Bun.file('plan_fps/manifests/01-012-audit-missing-live-rendering.json').json();

    expect(RENDER_WIPE_TRANSITION_EFFECTS_RUNTIME_COMMAND).toBe('bun run doom.ts');
    expect(missingRenderingAuditManifest.commandContracts.target.runtimeCommand).toBe(RENDER_WIPE_TRANSITION_EFFECTS_RUNTIME_COMMAND);
    expect(missingRenderingAuditManifest.explicitNullSurfaces).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: null,
          surface: 'wipe-transition-renderer',
        }),
      ]),
    );
  });

  test('locks the implementation source hash', async () => {
    const sourceText = await Bun.file('src/playable/rendering-product-integration/renderWipeTransitionEffects.ts').text();

    expect(hashBytes(new TextEncoder().encode(sourceText))).toBe('9cf4979c4e94594078f7cf8502bcc2b90bfe7f79efb079afa78c12d94cb5c544');
  });

  test('renders a deterministic partial melt transition', () => {
    const columnRevealedRows = createColumnRevealedRows();
    const destinationFramebuffer = new Uint8Array(FRAMEBUFFER_BYTE_LENGTH);
    const endFramebuffer = createFramebuffer(211, 19);
    const startFramebuffer = createFramebuffer(17, 71);
    destinationFramebuffer.fill(0xee);

    const result = renderWipeTransitionEffects({
      columnRevealedRows,
      command: RENDER_WIPE_TRANSITION_EFFECTS_RUNTIME_COMMAND,
      destinationFramebuffer,
      endFramebuffer,
      startFramebuffer,
    });

    expect(result).toEqual({
      changedPixelCount: 63_792,
      command: RENDER_WIPE_TRANSITION_EFFECTS_RUNTIME_COMMAND,
      complete: false,
      effect: 'melt-column-reveal',
      framebufferChecksum: 3_513_728_293,
      revealedPixelCount: 26_560,
      screenHeight: SCREEN_HEIGHT,
      screenWidth: SCREEN_WIDTH,
      transition: 'start-to-end',
    });
    expect(destinationFramebuffer[0]).toBe(startFramebuffer[0]);
    expect(destinationFramebuffer[SCREEN_WIDTH + 80]).toBe(endFramebuffer[SCREEN_WIDTH + 80]);
    expect(destinationFramebuffer[99 * SCREEN_WIDTH + 160]).toBe(endFramebuffer[99 * SCREEN_WIDTH + 160]);
    expect(destinationFramebuffer[100 * SCREEN_WIDTH + 160]).toBe(startFramebuffer[100 * SCREEN_WIDTH + 160]);
    expect(destinationFramebuffer[199 * SCREEN_WIDTH + 319]).toBe(endFramebuffer[199 * SCREEN_WIDTH + 319]);
    expect(hashBytes(destinationFramebuffer)).toBe('701714d5e2a9fd72f13b2fcd77306ed12c14e9c58e5dfd0fc6984ee13b7f309c');
  });

  test('reports complete when every column reveals the end framebuffer', () => {
    const columnRevealedRows = new Int16Array(SCREEN_WIDTH);
    const destinationFramebuffer = new Uint8Array(FRAMEBUFFER_BYTE_LENGTH);
    const endFramebuffer = createFramebuffer(37, 149);
    const startFramebuffer = createFramebuffer(83, 5);
    columnRevealedRows.fill(SCREEN_HEIGHT);
    destinationFramebuffer.fill(0);

    const result = renderWipeTransitionEffects({
      columnRevealedRows,
      command: RENDER_WIPE_TRANSITION_EFFECTS_RUNTIME_COMMAND,
      destinationFramebuffer,
      endFramebuffer,
      startFramebuffer,
    });

    expect(result.complete).toBe(true);
    expect(result.revealedPixelCount).toBe(FRAMEBUFFER_BYTE_LENGTH);
    expect(destinationFramebuffer).toEqual(endFramebuffer);
  });

  test('rejects the wrong command before mutating the destination framebuffer', () => {
    const columnRevealedRows = createColumnRevealedRows();
    const destinationFramebuffer = createFramebuffer(7, 3);
    const endFramebuffer = createFramebuffer(11, 29);
    const originalDestinationFramebuffer = destinationFramebuffer.slice();
    const startFramebuffer = createFramebuffer(13, 31);

    expect(() =>
      renderWipeTransitionEffects({
        columnRevealedRows,
        command: 'bun run src/main.ts',
        destinationFramebuffer,
        endFramebuffer,
        startFramebuffer,
      }),
    ).toThrow('render wipe transition effects requires bun run doom.ts');
    expect(destinationFramebuffer).toEqual(originalDestinationFramebuffer);
  });

  test('rejects invalid column state before mutating the destination framebuffer', () => {
    const columnRevealedRows = createColumnRevealedRows();
    const destinationFramebuffer = createFramebuffer(23, 41);
    const endFramebuffer = createFramebuffer(43, 47);
    const originalDestinationFramebuffer = destinationFramebuffer.slice();
    const startFramebuffer = createFramebuffer(53, 59);
    columnRevealedRows[12] = SCREEN_HEIGHT + 1;

    expect(() =>
      renderWipeTransitionEffects({
        columnRevealedRows,
        command: RENDER_WIPE_TRANSITION_EFFECTS_RUNTIME_COMMAND,
        destinationFramebuffer,
        endFramebuffer,
        startFramebuffer,
      }),
    ).toThrow('columnRevealedRows[12] must be an integer between 0 and 200');
    expect(destinationFramebuffer).toEqual(originalDestinationFramebuffer);
  });
});

function createColumnRevealedRows(): Int16Array {
  const columnRevealedRows = new Int16Array(SCREEN_WIDTH);

  for (let columnIndex = 0; columnIndex < SCREEN_WIDTH; columnIndex += 1) {
    if (columnIndex < 80) {
      columnRevealedRows[columnIndex] = 0;
      continue;
    }

    if (columnIndex < 160) {
      columnRevealedRows[columnIndex] = 32;
      continue;
    }

    if (columnIndex < 240) {
      columnRevealedRows[columnIndex] = 100;
      continue;
    }

    columnRevealedRows[columnIndex] = SCREEN_HEIGHT;
  }

  return columnRevealedRows;
}

function createFramebuffer(multiplier: number, offset: number): Uint8Array<ArrayBuffer> {
  const framebuffer = new Uint8Array(FRAMEBUFFER_BYTE_LENGTH);

  for (let framebufferOffset = 0; framebufferOffset < framebuffer.length; framebufferOffset += 1) {
    framebuffer[framebufferOffset] = (framebufferOffset * multiplier + offset) & 0xff;
  }

  return framebuffer;
}

function hashBytes(bytes: Uint8Array): string {
  const hasher = new Bun.CryptoHasher('sha256');
  hasher.update(bytes);
  return hasher.digest('hex');
}
