import { describe, expect, test } from 'bun:test';

import {
  RENDER_TITLE_HELP_CREDIT_PAGES_COMMAND_CONTRACT,
  TITLE_HELP_CREDIT_FRAMEBUFFER_BYTE_LENGTH,
  renderTitleHelpCreditPages,
  type TitleHelpCreditPageName,
} from '../../../src/playable/rendering-product-integration/renderTitleHelpCreditPages.ts';

const EXPECTED_CREDIT_FRAMEBUFFER_SIGNATURE = '082601c5';
const EXPECTED_HELP1_FRAMEBUFFER_SIGNATURE = '7aeb60c5';
const EXPECTED_IMPLEMENTATION_SHA256 = 'a0c57e10067c74587716bc5629fa2ebe057e2e5a053e1bf89dc0849ad0775342';
const EXPECTED_TITLE_FRAMEBUFFER_SIGNATURE = 'da7519c5';
const IMPLEMENTATION_PATH = 'src/playable/rendering-product-integration/renderTitleHelpCreditPages.ts';
const MISSING_RENDERING_MANIFEST_PATH = 'plan_fps/manifests/01-012-audit-missing-live-rendering.json';

interface MissingRenderingManifest {
  readonly commandContracts: {
    readonly target: {
      readonly entryFile: string;
      readonly runtimeCommand: string;
    };
  };
  readonly explicitNullSurfaces: readonly {
    readonly path: string | null;
    readonly reason: string;
    readonly surface: string;
  }[];
  readonly schemaVersion: number;
}

describe('renderTitleHelpCreditPages', () => {
  test('locks the Bun runtime command contract', () => {
    expect(RENDER_TITLE_HELP_CREDIT_PAGES_COMMAND_CONTRACT).toEqual({
      entryFile: 'doom.ts',
      program: 'bun',
      runtimeCommand: 'bun run doom.ts',
      subcommand: 'run',
    });
  });

  test('locks the 01-012 missing title-screen renderer audit linkage', async () => {
    const manifest = await readMissingRenderingManifest();

    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.commandContracts.target).toEqual({
      entryFile: RENDER_TITLE_HELP_CREDIT_PAGES_COMMAND_CONTRACT.entryFile,
      runtimeCommand: RENDER_TITLE_HELP_CREDIT_PAGES_COMMAND_CONTRACT.runtimeCommand,
    });
    expect(manifest.explicitNullSurfaces).toContainEqual({
      path: null,
      reason: 'No title-screen renderer path is exposed by the 01-012 read scope.',
      surface: 'title-screen-renderer',
    });
  });

  test('locks the formatted implementation source hash', async () => {
    const implementationText = await Bun.file(IMPLEMENTATION_PATH).text();
    const implementationHasher = new Bun.CryptoHasher('sha256');
    implementationHasher.update(implementationText);

    expect(implementationHasher.digest('hex')).toBe(EXPECTED_IMPLEMENTATION_SHA256);
  });

  test('renders an exact title page into the full 320x200 framebuffer', () => {
    const framebuffer = new Uint8Array(TITLE_HELP_CREDIT_FRAMEBUFFER_BYTE_LENGTH);
    const pages = createPageLibrary();
    framebuffer.fill(0xee);

    const evidence = renderTitleHelpCreditPages({
      framebuffer,
      pageName: 'TITLEPIC',
      pages,
      runtimeCommand: RENDER_TITLE_HELP_CREDIT_PAGES_COMMAND_CONTRACT.runtimeCommand,
    });

    expect(framebuffer).toEqual(pages.TITLEPIC);
    expect(evidence).toEqual({
      framebufferByteLength: TITLE_HELP_CREDIT_FRAMEBUFFER_BYTE_LENGTH,
      framebufferSignature: EXPECTED_TITLE_FRAMEBUFFER_SIGNATURE,
      pageName: 'TITLEPIC',
      previousPageName: null,
      renderedPixelCount: TITLE_HELP_CREDIT_FRAMEBUFFER_BYTE_LENGTH,
      runtimeCommand: RENDER_TITLE_HELP_CREDIT_PAGES_COMMAND_CONTRACT.runtimeCommand,
      transitionName: 'initial:TITLEPIC',
    });
  });

  test('records deterministic title to help to credit page transitions', () => {
    const framebuffer = new Uint8Array(TITLE_HELP_CREDIT_FRAMEBUFFER_BYTE_LENGTH);
    const pages = createPageLibrary();

    const helpEvidence = renderTitleHelpCreditPages({
      framebuffer,
      pageName: 'HELP1',
      pages,
      previousPageName: 'TITLEPIC',
      runtimeCommand: RENDER_TITLE_HELP_CREDIT_PAGES_COMMAND_CONTRACT.runtimeCommand,
    });
    const creditEvidence = renderTitleHelpCreditPages({
      framebuffer,
      pageName: 'CREDIT',
      pages,
      previousPageName: 'HELP2',
      runtimeCommand: RENDER_TITLE_HELP_CREDIT_PAGES_COMMAND_CONTRACT.runtimeCommand,
    });

    expect(helpEvidence.framebufferSignature).toBe(EXPECTED_HELP1_FRAMEBUFFER_SIGNATURE);
    expect(helpEvidence.transitionName).toBe('TITLEPIC->HELP1');
    expect(creditEvidence.framebufferSignature).toBe(EXPECTED_CREDIT_FRAMEBUFFER_SIGNATURE);
    expect(creditEvidence.transitionName).toBe('HELP2->CREDIT');
    expect(framebuffer).toEqual(pages.CREDIT);
  });

  test('rejects invalid requests before mutating replay-visible framebuffer state', () => {
    const framebuffer = new Uint8Array(TITLE_HELP_CREDIT_FRAMEBUFFER_BYTE_LENGTH);
    const pages = createPageLibrary();
    framebuffer.fill(0x7a);
    const originalFramebuffer = framebuffer.slice();

    expect(() =>
      renderTitleHelpCreditPages({
        framebuffer,
        pageName: 'TITLEPIC',
        pages,
        runtimeCommand: 'bun run src/main.ts',
      }),
    ).toThrow('Expected runtime command bun run doom.ts.');
    expect(framebuffer).toEqual(originalFramebuffer);

    expect(() =>
      renderTitleHelpCreditPages({
        framebuffer,
        pageName: 'HELP2',
        pages: {
          ...pages,
          HELP2: new Uint8Array(TITLE_HELP_CREDIT_FRAMEBUFFER_BYTE_LENGTH - 1),
        },
        runtimeCommand: RENDER_TITLE_HELP_CREDIT_PAGES_COMMAND_CONTRACT.runtimeCommand,
      }),
    ).toThrow(`Expected HELP2 page pixels to be ${TITLE_HELP_CREDIT_FRAMEBUFFER_BYTE_LENGTH} bytes.`);
    expect(framebuffer).toEqual(originalFramebuffer);
  });
});

function createPageLibrary(): Readonly<Record<TitleHelpCreditPageName, Uint8Array<ArrayBuffer>>> {
  return {
    CREDIT: createPagePixels(0x39),
    HELP1: createPagePixels(0x1f),
    HELP2: createPagePixels(0x2b),
    TITLEPIC: createPagePixels(0x11),
  };
}

function createPagePixels(seed: number): Uint8Array<ArrayBuffer> {
  const pixels: Uint8Array<ArrayBuffer> = new Uint8Array(TITLE_HELP_CREDIT_FRAMEBUFFER_BYTE_LENGTH);

  for (let pixelIndex = 0; pixelIndex < pixels.byteLength; pixelIndex += 1) {
    pixels[pixelIndex] = (seed + pixelIndex * 17 + (pixelIndex >>> 8)) & 0xff;
  }

  return pixels;
}

function isMissingRenderingManifest(value: unknown): value is MissingRenderingManifest {
  if (!isRecord(value)) {
    return false;
  }

  const commandContracts = value.commandContracts;
  if (!isRecord(commandContracts)) {
    return false;
  }

  const target = commandContracts.target;
  if (!isRecord(target)) {
    return false;
  }

  return typeof value.schemaVersion === 'number' && Array.isArray(value.explicitNullSurfaces) && typeof target.entryFile === 'string' && typeof target.runtimeCommand === 'string';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

async function readMissingRenderingManifest(): Promise<MissingRenderingManifest> {
  const manifest: unknown = await Bun.file(MISSING_RENDERING_MANIFEST_PATH).json();

  if (!isMissingRenderingManifest(manifest)) {
    throw new Error('Missing rendering audit manifest schema changed.');
  }

  return manifest;
}
