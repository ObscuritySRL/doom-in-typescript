import { expect, test } from 'bun:test';

import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

import { APPLY_PLAYPAL_PALETTE_CONTRACT, applyPlaypalPalette } from '../../../src/playable/window-host/applyPlaypalPalette.ts';

const EXPECTED_CONTRACT_HASH = '3bdb2278339f4d335fb0ab8683ba611d116ff16ec5078f361d671f76831d81d0';
const AUDIT_MANIFEST_PATH = resolve(import.meta.dir, '..', '..', '..', 'plan_fps', 'manifests', '01-006-audit-playable-host-surface.json');
const LAUNCHER_SOURCE_PATH = resolve(import.meta.dir, '..', '..', '..', 'src', 'launcher', 'win32.ts');
const WINDOW_POLICY_SOURCE_PATH = resolve(import.meta.dir, '..', '..', '..', 'src', 'host', 'windowPolicy.ts');

test('locks the exact playpal palette contract and hash', () => {
  const expectedContract = {
    alphaMask: 0xff00_0000,
    auditedHostTransition: 'runLauncherWindow(session, { scale, title: `DOOM Codex - ${session.mapName}` })',
    blueShift: 0,
    deterministicReplayCompatible: true,
    greenShift: 8,
    indexedFramebufferBytesLength: 64_000,
    indexedFramebufferHeight: 200,
    indexedFramebufferPixelCount: 64_000,
    indexedFramebufferWidth: 320,
    paletteBytesLength: 768,
    paletteEntries: 256,
    paletteEntryBytes: 3,
    paletteLookupSourceEvidence: 'const paletteLookup = buildPaletteLookup(session.palette);',
    palettePresentationSourceEvidence: 'convertIndexedFrame(session.framebuffer, indexedFrameBuffer, paletteLookup);',
    paletteWriteSourceEvidence: 'colors[colorIndex] = blue | (green << 8) | (red << 16) | 0xff00_0000;',
    presentedPixelFormat: '0xAARRGGBB',
    redShift: 16,
    runtimeCommand: 'bun run doom.ts',
    scope: 'palette-application-only',
  } as const satisfies typeof APPLY_PLAYPAL_PALETTE_CONTRACT;

  expect(APPLY_PLAYPAL_PALETTE_CONTRACT).toEqual(expectedContract);

  const contractHash = createHash('sha256').update(JSON.stringify(APPLY_PLAYPAL_PALETTE_CONTRACT)).digest('hex');

  expect(contractHash).toBe(EXPECTED_CONTRACT_HASH);
});

test('matches the audited launcher transition and live palette sources', async () => {
  const auditManifest = JSON.parse(await Bun.file(AUDIT_MANIFEST_PATH).text()) as unknown;

  if (typeof auditManifest !== 'object' || auditManifest === null) {
    throw new TypeError('Audit manifest must parse to an object');
  }

  const currentLauncherHostTransition = Reflect.get(auditManifest, 'currentLauncherHostTransition');

  if (typeof currentLauncherHostTransition !== 'object' || currentLauncherHostTransition === null) {
    throw new TypeError('Audit manifest must expose currentLauncherHostTransition');
  }

  const auditedHostTransition = Reflect.get(currentLauncherHostTransition, 'call');

  expect(auditedHostTransition).toBe(APPLY_PLAYPAL_PALETTE_CONTRACT.auditedHostTransition);

  const launcherSource = await Bun.file(LAUNCHER_SOURCE_PATH).text();
  const windowPolicySource = await Bun.file(WINDOW_POLICY_SOURCE_PATH).text();

  expect(launcherSource).toContain(APPLY_PLAYPAL_PALETTE_CONTRACT.paletteLookupSourceEvidence);
  expect(launcherSource).toContain(APPLY_PLAYPAL_PALETTE_CONTRACT.palettePresentationSourceEvidence);
  expect(launcherSource).toContain(APPLY_PLAYPAL_PALETTE_CONTRACT.paletteWriteSourceEvidence);
  expect(windowPolicySource).toContain('export const SCREENHEIGHT = 200;');
  expect(windowPolicySource).toContain('export const SCREENWIDTH = 320;');
});

test('applies the playpal palette deterministically', () => {
  const indexedFramebuffer = new Uint8Array(APPLY_PLAYPAL_PALETTE_CONTRACT.indexedFramebufferBytesLength);
  const playpalPalette = new Uint8Array(APPLY_PLAYPAL_PALETTE_CONTRACT.paletteBytesLength);

  for (let colorIndex = 0; colorIndex < APPLY_PLAYPAL_PALETTE_CONTRACT.paletteEntries; colorIndex += 1) {
    const paletteOffset = colorIndex * APPLY_PLAYPAL_PALETTE_CONTRACT.paletteEntryBytes;

    playpalPalette[paletteOffset] = colorIndex;
    playpalPalette[paletteOffset + 1] = (colorIndex + 1) & 0xff;
    playpalPalette[paletteOffset + 2] = (colorIndex + 2) & 0xff;
  }

  indexedFramebuffer[0] = 0;
  indexedFramebuffer[1] = 1;
  indexedFramebuffer[2] = 255;

  const paletteApplication = applyPlaypalPalette({
    indexedFramebuffer,
    playpalPalette,
    runtimeCommand: 'bun run doom.ts',
  });

  expect(paletteApplication.contract).toBe(APPLY_PLAYPAL_PALETTE_CONTRACT);
  expect(paletteApplication.paletteLookup.length).toBe(256);
  expect(paletteApplication.paletteLookup[0]).toBe(0xff00_0102);
  expect(paletteApplication.paletteLookup[1]).toBe(0xff01_0203);
  expect(paletteApplication.paletteLookup[255]).toBe(0xffff_0001);
  expect(paletteApplication.presentedFramebuffer.length).toBe(64_000);
  expect(paletteApplication.presentedFramebuffer[0]).toBe(0xff00_0102);
  expect(paletteApplication.presentedFramebuffer[1]).toBe(0xff01_0203);
  expect(paletteApplication.presentedFramebuffer[2]).toBe(0xffff_0001);
  expect(paletteApplication.presentedFramebuffer[63_999]).toBe(0xff00_0102);
});

test('rejects runtime commands outside bun run doom.ts', () => {
  expect(() =>
    applyPlaypalPalette({
      indexedFramebuffer: new Uint8Array(APPLY_PLAYPAL_PALETTE_CONTRACT.indexedFramebufferBytesLength),
      playpalPalette: new Uint8Array(APPLY_PLAYPAL_PALETTE_CONTRACT.paletteBytesLength),
      runtimeCommand: 'bun run src/main.ts',
    }),
  ).toThrow('Expected runtime command bun run doom.ts, received bun run src/main.ts');
});
