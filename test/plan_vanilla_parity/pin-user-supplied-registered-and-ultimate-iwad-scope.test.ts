import { describe, expect, test } from 'bun:test';

import { existsSync, statSync } from 'node:fs';

import { EPISODE_COUNTS, GAME_VERSIONS, getGameDescription, identifyMission, identifyMode } from '../../src/bootstrap/gameMode.ts';
import type { LumpChecker } from '../../src/bootstrap/gameMode.ts';

const MASTER_CHECKLIST_PATH = 'plan_vanilla_parity/MASTER_CHECKLIST.md';
const PIN_DOCUMENT_PATH = 'plan_vanilla_parity/pin-user-supplied-registered-and-ultimate-iwad-scope.md';
const README_PATH = 'plan_vanilla_parity/README.md';
const SOURCE_CATALOG_PATH = 'plan_vanilla_parity/SOURCE_CATALOG.md';
const STEP_FILE_PATH = 'plan_vanilla_parity/steps/00-004-pin-user-supplied-registered-and-ultimate-iwad-scope.md';

const SHAREWARE_EPISODE_MAP_NAMES: readonly string[] = ['E1M1', 'E1M2', 'E1M3', 'E1M4', 'E1M5', 'E1M6', 'E1M7', 'E1M8', 'E1M9'];
const REGISTERED_EXTRA_EPISODE_MAP_NAMES: readonly string[] = ['E2M1', 'E2M2', 'E2M3', 'E2M4', 'E2M5', 'E2M6', 'E2M7', 'E2M8', 'E2M9', 'E3M1', 'E3M2', 'E3M3', 'E3M4', 'E3M5', 'E3M6', 'E3M7', 'E3M8', 'E3M9'];
const ULTIMATE_EXTRA_EPISODE_MAP_NAMES: readonly string[] = ['E4M1', 'E4M2', 'E4M3', 'E4M4', 'E4M5', 'E4M6', 'E4M7', 'E4M8', 'E4M9'];
const REGISTERED_EPISODE_MAP_NAMES: readonly string[] = [...SHAREWARE_EPISODE_MAP_NAMES, ...REGISTERED_EXTRA_EPISODE_MAP_NAMES];
const ULTIMATE_EPISODE_MAP_NAMES: readonly string[] = [...REGISTERED_EPISODE_MAP_NAMES, ...ULTIMATE_EXTRA_EPISODE_MAP_NAMES];

interface PinSuppliedIwadScopeDocument {
  readonly acceptancePhrasing: string;
  readonly emulatedVanillaVersion: string;
  readonly evidenceLocations: readonly string[];
  readonly localAvailability: string;
  readonly proprietaryAssetRedistributionPolicy: string;
  readonly referenceEngine: string;
  readonly referenceEngineVersion: string;
  readonly registered: TargetFields;
  readonly scopeName: string;
  readonly suppliedIwadFilename: string;
  readonly suppliedIwadMission: string;
  readonly suppliedIwadMissionIdentificationRule: string;
  readonly suppliedIwadSearchRelativePaths: readonly string[];
  readonly ticRateHertz: number;
  readonly ultimate: TargetFields;
}

interface TargetFields {
  readonly episodeCount: number;
  readonly episodeMaps: readonly string[];
  readonly gameDescription: string;
  readonly gameMode: string;
  readonly gameVersion: string;
  readonly identificationRule: string;
}

class MapLumpChecker implements LumpChecker {
  readonly #lumpNames: ReadonlySet<string>;

  constructor(lumpNames: Iterable<string>) {
    this.#lumpNames = new Set(lumpNames);
  }

  hasLump(lumpName: string): boolean {
    return this.#lumpNames.has(lumpName);
  }
}

function extractSection(documentText: string, sectionHeading: string): string {
  const heading = `## ${sectionHeading}`;
  const sectionStart = documentText.indexOf(`\n${heading}\n`);
  if (sectionStart === -1) {
    throw new Error(`Section "${sectionHeading}" not found in user-supplied registered/Ultimate IWAD scope document.`);
  }
  const bodyStart = sectionStart + heading.length + 2;
  const remainder = documentText.slice(bodyStart);
  const nextHeadingOffset = remainder.search(/\n## /);
  return (nextHeadingOffset === -1 ? remainder : remainder.slice(0, nextHeadingOffset)).trim();
}

function extractBullets(documentText: string, sectionHeading: string): readonly string[] {
  return extractSection(documentText, sectionHeading)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '))
    .map((line) => line.slice(2).trim().replace(/^`|`$/g, ''));
}

function extractPositiveInteger(documentText: string, sectionHeading: string): number {
  const sectionText = extractSection(documentText, sectionHeading);
  const parsed = Number(sectionText);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Section "${sectionHeading}" must be a positive integer, got "${sectionText}".`);
  }
  return parsed;
}

function parsePinSuppliedIwadScopeDocument(documentText: string): PinSuppliedIwadScopeDocument {
  const suppliedIwadSearchRelativePaths = extractBullets(documentText, 'supplied iwad search relative paths');
  if (suppliedIwadSearchRelativePaths.length === 0) {
    throw new Error('supplied iwad search relative paths must list at least one path.');
  }

  return {
    acceptancePhrasing: extractSection(documentText, 'acceptance phrasing'),
    emulatedVanillaVersion: extractSection(documentText, 'emulated vanilla version'),
    evidenceLocations: extractBullets(documentText, 'evidence locations'),
    localAvailability: extractSection(documentText, 'local availability'),
    proprietaryAssetRedistributionPolicy: extractSection(documentText, 'proprietary asset redistribution policy'),
    referenceEngine: extractSection(documentText, 'reference engine'),
    referenceEngineVersion: extractSection(documentText, 'reference engine version'),
    registered: {
      episodeCount: extractPositiveInteger(documentText, 'registered episode count'),
      episodeMaps: extractBullets(documentText, 'registered episode maps'),
      gameDescription: extractSection(documentText, 'registered game description'),
      gameMode: extractSection(documentText, 'registered game mode'),
      gameVersion: extractSection(documentText, 'registered game version'),
      identificationRule: extractSection(documentText, 'registered identification rule'),
    },
    scopeName: extractSection(documentText, 'scope name'),
    suppliedIwadFilename: extractSection(documentText, 'supplied iwad filename'),
    suppliedIwadMission: extractSection(documentText, 'supplied iwad mission'),
    suppliedIwadMissionIdentificationRule: extractSection(documentText, 'supplied iwad mission identification rule'),
    suppliedIwadSearchRelativePaths,
    ticRateHertz: extractPositiveInteger(documentText, 'tic rate hertz'),
    ultimate: {
      episodeCount: extractPositiveInteger(documentText, 'ultimate episode count'),
      episodeMaps: extractBullets(documentText, 'ultimate episode maps'),
      gameDescription: extractSection(documentText, 'ultimate game description'),
      gameMode: extractSection(documentText, 'ultimate game mode'),
      gameVersion: extractSection(documentText, 'ultimate game version'),
      identificationRule: extractSection(documentText, 'ultimate identification rule'),
    },
  };
}

async function loadPinSuppliedIwadScopeDocument(): Promise<PinSuppliedIwadScopeDocument> {
  const documentText = await Bun.file(PIN_DOCUMENT_PATH).text();
  return parsePinSuppliedIwadScopeDocument(documentText);
}

describe('pin user-supplied registered and Ultimate IWAD scope declaration', () => {
  test('pin document exists at the canonical path', () => {
    expect(existsSync(PIN_DOCUMENT_PATH)).toBe(true);
    expect(statSync(PIN_DOCUMENT_PATH).isFile()).toBe(true);
  });

  test('parses every required governance field with the expected vanilla parity values', async () => {
    const parsed = await loadPinSuppliedIwadScopeDocument();
    expect(parsed.scopeName).toBe('user-supplied registered and Ultimate DOOM');
    expect(parsed.emulatedVanillaVersion).toBe('1.9');
    expect(parsed.referenceEngine).toBe('Chocolate Doom');
    expect(parsed.referenceEngineVersion).toBe('2.2.1');
    expect(parsed.ticRateHertz).toBe(35);
  });

  test('supplied IWAD filename and mission match the user-supplied DOOM.WAD scope', async () => {
    const parsed = await loadPinSuppliedIwadScopeDocument();
    expect(parsed.suppliedIwadFilename).toBe('DOOM.WAD');
    expect(parsed.suppliedIwadMission).toBe('doom');
  });

  test('supplied IWAD search relative paths cover both doom/ and iwad/ drop locations and are unique', async () => {
    const parsed = await loadPinSuppliedIwadScopeDocument();
    expect(parsed.suppliedIwadSearchRelativePaths).toContain('doom/DOOM.WAD');
    expect(parsed.suppliedIwadSearchRelativePaths).toContain('iwad/DOOM.WAD');
    expect(new Set(parsed.suppliedIwadSearchRelativePaths).size).toBe(parsed.suppliedIwadSearchRelativePaths.length);
  });

  test('supplied IWAD mission identification rule references identifyMission and the case-insensitive doom.wad basename', async () => {
    const parsed = await loadPinSuppliedIwadScopeDocument();
    expect(parsed.suppliedIwadMissionIdentificationRule).toContain('identifyMission');
    expect(parsed.suppliedIwadMissionIdentificationRule).toContain('src/bootstrap/gameMode.ts');
    expect(parsed.suppliedIwadMissionIdentificationRule).toContain('doom.wad');
    expect(parsed.suppliedIwadMissionIdentificationRule).toContain('case-insensitive');
    expect(parsed.suppliedIwadMissionIdentificationRule).toContain('Chocolate Doom 2.2.1');
  });

  test('identifyMission resolves the supplied DOOM.WAD basename to mission "doom" from every documented search relative path', async () => {
    const parsed = await loadPinSuppliedIwadScopeDocument();
    expect<string>(identifyMission(parsed.suppliedIwadFilename)).toBe(parsed.suppliedIwadMission);
    expect(identifyMission('doom.wad')).toBe('doom');
    expect(identifyMission('DOOM.WAD')).toBe('doom');
    for (const searchPath of parsed.suppliedIwadSearchRelativePaths) {
      expect<string>(identifyMission(searchPath)).toBe(parsed.suppliedIwadMission);
    }
  });

  test('registered target fields match Chocolate Doom 2.2.1 GameMode_t / GameVersion_t / D_SetGameDescription', async () => {
    const parsed = await loadPinSuppliedIwadScopeDocument();
    expect(parsed.registered.gameMode).toBe('registered');
    expect(parsed.registered.gameDescription).toBe('DOOM Registered');
    expect(parsed.registered.gameDescription).toBe(getGameDescription('registered', 'doom'));
    expect(parsed.registered.gameVersion).toBe('exe_doom_1_9');
    expect<readonly string[]>(GAME_VERSIONS).toContain(parsed.registered.gameVersion);
    expect(parsed.registered.episodeCount).toBe(EPISODE_COUNTS.registered);
    expect(parsed.registered.episodeCount).toBe(3);
    expect(parsed.registered.episodeMaps).toEqual(REGISTERED_EPISODE_MAP_NAMES);
    expect(parsed.registered.episodeMaps).toHaveLength(27);
  });

  test('registered identification rule says E3M1 present and E4M1 absent select the registered branch', async () => {
    const parsed = await loadPinSuppliedIwadScopeDocument();
    expect(parsed.registered.identificationRule).toContain('E3M1');
    expect(parsed.registered.identificationRule).toContain('E4M1');
    expect(parsed.registered.identificationRule).toContain('identifyMode');
    expect(parsed.registered.identificationRule).toContain('Chocolate Doom 2.2.1');
    expect(parsed.registered.identificationRule).toContain('registered');
  });

  test('identifyMode returns "registered" for a doom-mission lump set with E3M1 present and E4M1 absent', async () => {
    const parsed = await loadPinSuppliedIwadScopeDocument();
    const registeredLumps = new MapLumpChecker(parsed.registered.episodeMaps);
    expect(registeredLumps.hasLump('E3M1')).toBe(true);
    expect(registeredLumps.hasLump('E4M1')).toBe(false);
    expect<string>(identifyMode('doom', registeredLumps)).toBe(parsed.registered.gameMode);
  });

  test('ultimate target fields match Chocolate Doom 2.2.1 GameMode_t / GameVersion_t / D_SetGameDescription', async () => {
    const parsed = await loadPinSuppliedIwadScopeDocument();
    expect(parsed.ultimate.gameMode).toBe('retail');
    expect(parsed.ultimate.gameDescription).toBe('The Ultimate DOOM');
    expect(parsed.ultimate.gameDescription).toBe(getGameDescription('retail', 'doom'));
    expect(parsed.ultimate.gameVersion).toBe('exe_ultimate');
    expect<readonly string[]>(GAME_VERSIONS).toContain(parsed.ultimate.gameVersion);
    expect(parsed.ultimate.episodeCount).toBe(EPISODE_COUNTS.retail);
    expect(parsed.ultimate.episodeCount).toBe(4);
    expect(parsed.ultimate.episodeMaps).toEqual(ULTIMATE_EPISODE_MAP_NAMES);
    expect(parsed.ultimate.episodeMaps).toHaveLength(36);
  });

  test('ultimate identification rule says E4M1 present selects the retail branch regardless of E3M1', async () => {
    const parsed = await loadPinSuppliedIwadScopeDocument();
    expect(parsed.ultimate.identificationRule).toContain('E4M1');
    expect(parsed.ultimate.identificationRule).toContain('identifyMode');
    expect(parsed.ultimate.identificationRule).toContain('Chocolate Doom 2.2.1');
    expect(parsed.ultimate.identificationRule).toContain('retail');
  });

  test('identifyMode returns "retail" for a doom-mission lump set with E4M1 present even when E3M1 is also present', async () => {
    const parsed = await loadPinSuppliedIwadScopeDocument();
    const ultimateLumps = new MapLumpChecker(parsed.ultimate.episodeMaps);
    expect(ultimateLumps.hasLump('E3M1')).toBe(true);
    expect(ultimateLumps.hasLump('E4M1')).toBe(true);
    expect<string>(identifyMode('doom', ultimateLumps)).toBe(parsed.ultimate.gameMode);
  });

  test('registered and Ultimate scopes nest correctly: every registered episode map is present in the Ultimate set', async () => {
    const parsed = await loadPinSuppliedIwadScopeDocument();
    for (const registeredMap of parsed.registered.episodeMaps) {
      expect(parsed.ultimate.episodeMaps).toContain(registeredMap);
    }
    expect(parsed.ultimate.episodeMaps.length - parsed.registered.episodeMaps.length).toBe(9);
  });

  test('local availability section confirms no DOOM.WAD exists at either documented search relative path', async () => {
    const parsed = await loadPinSuppliedIwadScopeDocument();
    expect(parsed.localAvailability).toContain('No registered or Ultimate `DOOM.WAD`');
    expect(parsed.localAvailability).toContain('doom/DOOM.WAD');
    expect(parsed.localAvailability).toContain('iwad/DOOM.WAD');
    expect(parsed.localAvailability).toContain('user-supplied');
    for (const searchPath of parsed.suppliedIwadSearchRelativePaths) {
      expect(existsSync(searchPath)).toBe(false);
    }
  });

  test('proprietary asset redistribution policy explicitly forbids bundling, regeneration, commit staging, and republishing', async () => {
    const parsed = await loadPinSuppliedIwadScopeDocument();
    expect(parsed.proprietaryAssetRedistributionPolicy).toContain('DOOM.WAD');
    expect(parsed.proprietaryAssetRedistributionPolicy).toContain('proprietary');
    expect(parsed.proprietaryAssetRedistributionPolicy).toContain('user-supplied only');
    expect(parsed.proprietaryAssetRedistributionPolicy).toContain('must not bundle');
    expect(parsed.proprietaryAssetRedistributionPolicy).toContain('must not regenerate');
    expect(parsed.proprietaryAssetRedistributionPolicy).toContain('must not stage them for commit');
    expect(parsed.proprietaryAssetRedistributionPolicy).toContain('must not publish');
    expect(parsed.proprietaryAssetRedistributionPolicy).toContain('must not redistribute');
  });

  test('every evidence location exists on disk and is a file', async () => {
    const parsed = await loadPinSuppliedIwadScopeDocument();
    expect(parsed.evidenceLocations.length).toBeGreaterThan(0);
    expect(new Set(parsed.evidenceLocations).size).toBe(parsed.evidenceLocations.length);
    for (const evidenceLocation of parsed.evidenceLocations) {
      expect(existsSync(evidenceLocation)).toBe(true);
      expect(statSync(evidenceLocation).isFile()).toBe(true);
    }
  });

  test('evidence locations include src/bootstrap/gameMode.ts, src/reference/target.ts, README.md, and SOURCE_CATALOG.md', async () => {
    const parsed = await loadPinSuppliedIwadScopeDocument();
    const requiredEvidence = ['src/bootstrap/gameMode.ts', 'src/reference/target.ts', 'plan_vanilla_parity/README.md', 'plan_vanilla_parity/SOURCE_CATALOG.md'];
    for (const requiredEvidenceLocation of requiredEvidence) {
      expect(parsed.evidenceLocations).toContain(requiredEvidenceLocation);
    }
  });

  test('plan_vanilla_parity README.md contains the same later-targets acceptance phrasing as the pin document', async () => {
    const parsed = await loadPinSuppliedIwadScopeDocument();
    const readmeText = await Bun.file(README_PATH).text();
    expect(readmeText).toContain(parsed.acceptancePhrasing);
    expect(parsed.acceptancePhrasing).toBe('Later targets: user-supplied registered or Ultimate `DOOM.WAD`; no proprietary assets are redistributed.');
  });

  test('plan_vanilla_parity SOURCE_CATALOG.md only inventories shareware artifacts locally (no registered or Ultimate IWAD)', async () => {
    const sourceCatalogText = await Bun.file(SOURCE_CATALOG_PATH).text();
    expect(sourceCatalogText).toContain('`doom/DOOM1.WAD`');
    expect(sourceCatalogText).toContain('`iwad/DOOM1.WAD`');
    expect(sourceCatalogText).not.toContain('`doom/DOOM.WAD`');
    expect(sourceCatalogText).not.toContain('`iwad/DOOM.WAD`');
  });

  test('step 00-004 file declares the governance lane, lists this declaration under its write lock, and lists the focused test under its test files', async () => {
    expect(existsSync(STEP_FILE_PATH)).toBe(true);
    const stepText = await Bun.file(STEP_FILE_PATH).text();
    expect(stepText).toContain('# [ ] STEP 00-004: Pin User Supplied Registered And Ultimate Iwad Scope');
    expect(stepText).toContain('\n## lane\n\ngovernance\n');
    expect(stepText).toContain('- plan_vanilla_parity/pin-user-supplied-registered-and-ultimate-iwad-scope.md');
    expect(stepText).toContain('- test/plan_vanilla_parity/pin-user-supplied-registered-and-ultimate-iwad-scope.test.ts');
  });

  test('MASTER_CHECKLIST.md row for 00-004 references the canonical step file path and the governance lane', async () => {
    const checklistText = await Bun.file(MASTER_CHECKLIST_PATH).text();
    const expectedPendingRow =
      '- [ ] `00-004` `pin-user-supplied-registered-and-ultimate-iwad-scope` | lane: `governance` | prereqs: `00-003` | file: `plan_vanilla_parity/steps/00-004-pin-user-supplied-registered-and-ultimate-iwad-scope.md`';
    const expectedCompletedRow =
      '- [x] `00-004` `pin-user-supplied-registered-and-ultimate-iwad-scope` | lane: `governance` | prereqs: `00-003` | file: `plan_vanilla_parity/steps/00-004-pin-user-supplied-registered-and-ultimate-iwad-scope.md`';
    expect(checklistText.includes(expectedPendingRow) || checklistText.includes(expectedCompletedRow)).toBe(true);
  });

  test('parser surfaces a meaningful error when a required section is missing (failure mode)', () => {
    const documentTextWithMissingSection = '# Test\n\n## scope name\n\nuser-supplied registered and Ultimate DOOM\n';
    expect(() => parsePinSuppliedIwadScopeDocument(documentTextWithMissingSection)).toThrow('Section "supplied iwad search relative paths" not found in user-supplied registered/Ultimate IWAD scope document.');
  });

  test('parser surfaces a meaningful error when a positive-integer section is not a positive integer (failure mode)', async () => {
    const validDocumentText = await Bun.file(PIN_DOCUMENT_PATH).text();
    const corruptedDocumentText = validDocumentText.replace(/\n## tic rate hertz\n\n35\n/, '\n## tic rate hertz\n\nnot-a-number\n');
    expect(corruptedDocumentText).not.toBe(validDocumentText);
    expect(() => parsePinSuppliedIwadScopeDocument(corruptedDocumentText)).toThrow('Section "tic rate hertz" must be a positive integer, got "not-a-number".');
  });

  test('parser surfaces a meaningful error when supplied iwad search relative paths is empty (failure mode)', () => {
    const documentTextWithEmptySearchPaths = [
      '# Test',
      '',
      '## scope name',
      '',
      'user-supplied registered and Ultimate DOOM',
      '',
      '## emulated vanilla version',
      '',
      '1.9',
      '',
      '## reference engine',
      '',
      'Chocolate Doom',
      '',
      '## reference engine version',
      '',
      '2.2.1',
      '',
      '## tic rate hertz',
      '',
      '35',
      '',
      '## supplied iwad filename',
      '',
      'DOOM.WAD',
      '',
      '## supplied iwad search relative paths',
      '',
      'no bullets here',
      '',
    ].join('\n');
    expect(() => parsePinSuppliedIwadScopeDocument(documentTextWithEmptySearchPaths)).toThrow('supplied iwad search relative paths must list at least one path.');
  });
});
