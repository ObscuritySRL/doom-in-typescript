import { describe, expect, test } from 'bun:test';

import { COMPOSE_MENU_OVERLAY_AUDIT_MANIFEST_PATH, COMPOSE_MENU_OVERLAY_COMMAND_CONTRACT, composeMenuOverlay } from '../../../src/playable/rendering-product-integration/composeMenuOverlay.ts';
import { SCREENHEIGHT, SCREENWIDTH } from '../../../src/render/projection.ts';

interface AuditManifest {
  readonly explicitNullSurfaces: readonly AuditNullSurface[];
  readonly schemaVersion: number;
}

interface AuditNullSurface {
  readonly path: null | string;
  readonly reason: string;
  readonly surface: string;
}

const FULL_FRAMEBUFFER_LENGTH = SCREENWIDTH * SCREENHEIGHT;
const IMPLEMENTATION_PATH = 'src/playable/rendering-product-integration/composeMenuOverlay.ts';
const LOCKED_IMPLEMENTATION_SHA256 = '02b8c231b4f5d8e8c2df97a2227a3ed0eb2ae687a3450647162f760923894c5e';

describe('composeMenuOverlay', () => {
  test('locks the Bun runtime command contract and missing-rendering audit linkage', async () => {
    expect(COMPOSE_MENU_OVERLAY_COMMAND_CONTRACT).toEqual({
      entryFile: 'doom.ts',
      program: 'bun',
      runtimeCommand: 'bun run doom.ts',
      subcommand: 'run',
    });
    expect(COMPOSE_MENU_OVERLAY_AUDIT_MANIFEST_PATH).toBe('plan_fps/manifests/01-012-audit-missing-live-rendering.json');

    const auditManifest = await readAuditManifest();
    const menuOverlaySurface = auditManifest.explicitNullSurfaces.find((surface) => surface.surface === 'menu-overlay-composition');

    expect(auditManifest.schemaVersion).toBe(1);
    expect(menuOverlaySurface).toEqual({
      path: null,
      reason: 'No menu overlay composition path is exposed by the 01-012 read scope.',
      surface: 'menu-overlay-composition',
    });
  });

  test('locks the implementation source hash', async () => {
    expect(await readSha256(IMPLEMENTATION_PATH)).toBe(LOCKED_IMPLEMENTATION_SHA256);
  });

  test('composes transparent menu pixels over the existing framebuffer', () => {
    const framebuffer = new Uint8Array(FULL_FRAMEBUFFER_LENGTH);
    framebuffer.fill(7);

    const evidence = composeMenuOverlay({
      framebuffer,
      layers: [
        {
          height: 3,
          left: 6,
          pixels: new Uint8Array([0xff, 21, 22, 23, 24, 0xff, 25, 26, 27, 28, 0xff, 29]),
          top: 4,
          transparentPaletteIndex: 0xff,
          width: 4,
        },
      ],
      runtimeCommand: 'bun run doom.ts',
    });

    expect(evidence).toEqual({
      auditManifestPath: 'plan_fps/manifests/01-012-audit-missing-live-rendering.json',
      commandContract: {
        entryFile: 'doom.ts',
        program: 'bun',
        runtimeCommand: 'bun run doom.ts',
        subcommand: 'run',
      },
      copiedPixels: 9,
      framebufferLength: FULL_FRAMEBUFFER_LENGTH,
      layerCount: 1,
      skippedOffscreenPixels: 0,
      skippedTransparentPixels: 3,
    });
    expect(framebuffer[4 * SCREENWIDTH + 6]).toBe(7);
    expect(framebuffer[4 * SCREENWIDTH + 7]).toBe(21);
    expect(framebuffer[5 * SCREENWIDTH + 7]).toBe(7);
    expect(framebuffer[6 * SCREENWIDTH + 9]).toBe(29);
    expect(hashBytes(framebuffer)).toBe('2471e81e9cd5600541b5b4fab78019f6a53354503d0e6b7fb0c628395b309a97');
  });

  test('clips offscreen menu pixels without mutating outside the framebuffer', () => {
    const framebuffer = new Uint8Array(FULL_FRAMEBUFFER_LENGTH);
    framebuffer.fill(3);

    const evidence = composeMenuOverlay({
      framebuffer,
      layers: [
        {
          height: 2,
          left: -1,
          pixels: new Uint8Array([40, 41, 42, 43, 44, 45]),
          top: SCREENHEIGHT - 1,
          transparentPaletteIndex: 0xff,
          width: 3,
        },
      ],
      runtimeCommand: 'bun run doom.ts',
    });

    expect(evidence.copiedPixels).toBe(2);
    expect(evidence.skippedOffscreenPixels).toBe(4);
    expect(evidence.skippedTransparentPixels).toBe(0);
    expect(framebuffer[(SCREENHEIGHT - 1) * SCREENWIDTH]).toBe(41);
    expect(framebuffer[(SCREENHEIGHT - 1) * SCREENWIDTH + 1]).toBe(42);
  });

  test('rejects the wrong command before mutating framebuffer bytes', () => {
    const framebuffer = new Uint8Array(FULL_FRAMEBUFFER_LENGTH);
    framebuffer.fill(11);

    expect(() =>
      composeMenuOverlay({
        framebuffer,
        layers: [
          {
            height: 1,
            left: 0,
            pixels: new Uint8Array([99]),
            top: 0,
            transparentPaletteIndex: 0xff,
            width: 1,
          },
        ],
        runtimeCommand: 'bun run src/main.ts',
      }),
    ).toThrow('compose menu overlay requires bun run doom.ts');
    expect(framebuffer[0]).toBe(11);
  });

  test('rejects invalid layer dimensions before mutating framebuffer bytes', () => {
    const framebuffer = new Uint8Array(FULL_FRAMEBUFFER_LENGTH);
    framebuffer.fill(13);

    expect(() =>
      composeMenuOverlay({
        framebuffer,
        layers: [
          {
            height: 2,
            left: 0,
            pixels: new Uint8Array([80, 81, 82]),
            top: 0,
            transparentPaletteIndex: 0xff,
            width: 2,
          },
        ],
        runtimeCommand: 'bun run doom.ts',
      }),
    ).toThrow('compose menu overlay layer pixel length must match width and height');
    expect(framebuffer[0]).toBe(13);
  });
});

function hashBytes(bytes: Uint8Array): string {
  return new Bun.CryptoHasher('sha256').update(bytes).digest('hex');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

async function readAuditManifest(): Promise<AuditManifest> {
  const manifest: unknown = JSON.parse(await Bun.file(COMPOSE_MENU_OVERLAY_AUDIT_MANIFEST_PATH).text());

  if (!isRecord(manifest)) {
    throw new Error('audit manifest must be an object');
  }

  const explicitNullSurfaces = manifest.explicitNullSurfaces;
  const schemaVersion = manifest.schemaVersion;

  if (!Array.isArray(explicitNullSurfaces)) {
    throw new Error('audit manifest explicitNullSurfaces must be an array');
  }

  if (typeof schemaVersion !== 'number') {
    throw new Error('audit manifest schemaVersion must be a number');
  }

  return {
    explicitNullSurfaces: explicitNullSurfaces.map((surfaceValue: unknown) => readAuditNullSurface(surfaceValue)),
    schemaVersion,
  };
}

function readAuditNullSurface(value: unknown): AuditNullSurface {
  if (!isRecord(value)) {
    throw new Error('audit null surface must be an object');
  }

  const path = value.path;
  const reason = value.reason;
  const surface = value.surface;

  if (path !== null && typeof path !== 'string') {
    throw new Error('audit null surface path must be null or a string');
  }

  if (typeof reason !== 'string') {
    throw new Error('audit null surface reason must be a string');
  }

  if (typeof surface !== 'string') {
    throw new Error('audit null surface surface must be a string');
  }

  return { path, reason, surface };
}

async function readSha256(path: string): Promise<string> {
  return new Bun.CryptoHasher('sha256').update(await Bun.file(path).text()).digest('hex');
}
