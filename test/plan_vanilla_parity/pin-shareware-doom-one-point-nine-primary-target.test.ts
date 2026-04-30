import { describe, expect, test } from 'bun:test';

import { existsSync, statSync } from 'node:fs';

import { EPISODE_COUNTS, getGameDescription, identifyMission, identifyMode } from '../../src/bootstrap/gameMode.ts';
import type { LumpChecker } from '../../src/bootstrap/gameMode.ts';
import { PRIMARY_TARGET } from '../../src/reference/target.ts';

const FILE_HASHES_MANIFEST_PATH = 'reference/manifests/file-hashes.json';
const MASTER_CHECKLIST_PATH = 'plan_vanilla_parity/MASTER_CHECKLIST.md';
const PIN_DOCUMENT_PATH = 'plan_vanilla_parity/pin-shareware-doom-one-point-nine-primary-target.md';
const README_PATH = 'plan_vanilla_parity/README.md';
const SOURCE_CATALOG_PATH = 'plan_vanilla_parity/SOURCE_CATALOG.md';
const STEP_FILE_PATH = 'plan_vanilla_parity/steps/00-003-pin-shareware-doom-one-point-nine-primary-target.md';

const SHA256_UPPERCASE_HEX_PATTERN = /^[0-9A-F]{64}$/;
const SHAREWARE_EPISODE_MAP_NAMES: readonly string[] = ['E1M1', 'E1M2', 'E1M3', 'E1M4', 'E1M5', 'E1M6', 'E1M7', 'E1M8', 'E1M9'];

interface PinShareware19TargetDocument {
  readonly acceptancePhrasing: string;
  readonly emulatedVanillaVersion: string;
  readonly evidenceLocations: readonly string[];
  readonly laterTargets: readonly string[];
  readonly primaryTargetName: string;
  readonly proprietaryAssetRedistributionPolicy: string;
  readonly referenceEngine: string;
  readonly referenceEngineVersion: string;
  readonly referenceGameMode: string;
  readonly shareware: SharewareTargetFields;
  readonly ticRateHertz: number;
}

interface SharewareTargetFields {
  readonly dosExecutableByteSize: number;
  readonly dosExecutableFilename: string;
  readonly dosExecutableRelativePath: string;
  readonly dosExecutableSha256: string;
  readonly episodeCount: number;
  readonly episodeMaps: readonly string[];
  readonly gameDescription: string;
  readonly identificationRule: string;
  readonly iwadByteSize: number;
  readonly iwadFilename: string;
  readonly iwadLumpCount: number;
  readonly iwadRelativePaths: readonly string[];
  readonly iwadSha256: string;
  readonly windowsExecutableByteSize: number;
  readonly windowsExecutableFilename: string;
  readonly windowsExecutableRelativePath: string;
  readonly windowsExecutableSha256: string;
}

interface FileHashManifestEntry {
  readonly filename: string;
  readonly role: string;
  readonly sha256: string;
  readonly sizeBytes: number;
}

interface FileHashManifest {
  readonly files: readonly FileHashManifestEntry[];
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
    throw new Error(`Section "${sectionHeading}" not found in shareware DOOM 1.9 pin document.`);
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

function parsePinShareware19TargetDocument(documentText: string): PinShareware19TargetDocument {
  const iwadRelativePaths = extractBullets(documentText, 'shareware iwad relative paths');
  if (iwadRelativePaths.length === 0) {
    throw new Error('shareware iwad relative paths must list at least one path.');
  }

  return {
    acceptancePhrasing: extractSection(documentText, 'acceptance phrasing'),
    emulatedVanillaVersion: extractSection(documentText, 'emulated vanilla version'),
    evidenceLocations: extractBullets(documentText, 'evidence locations'),
    laterTargets: extractBullets(documentText, 'later targets'),
    primaryTargetName: extractSection(documentText, 'primary target name'),
    proprietaryAssetRedistributionPolicy: extractSection(documentText, 'proprietary asset redistribution policy'),
    referenceEngine: extractSection(documentText, 'reference engine'),
    referenceEngineVersion: extractSection(documentText, 'reference engine version'),
    referenceGameMode: extractSection(documentText, 'reference game mode'),
    shareware: {
      dosExecutableByteSize: extractPositiveInteger(documentText, 'shareware dos executable byte size'),
      dosExecutableFilename: extractSection(documentText, 'shareware dos executable filename'),
      dosExecutableRelativePath: extractSection(documentText, 'shareware dos executable relative path'),
      dosExecutableSha256: extractSection(documentText, 'shareware dos executable sha256'),
      episodeCount: extractPositiveInteger(documentText, 'shareware episode count'),
      episodeMaps: extractBullets(documentText, 'shareware episode maps'),
      gameDescription: extractSection(documentText, 'shareware game description'),
      identificationRule: extractSection(documentText, 'shareware identification rule'),
      iwadByteSize: extractPositiveInteger(documentText, 'shareware iwad byte size'),
      iwadFilename: extractSection(documentText, 'shareware iwad filename'),
      iwadLumpCount: extractPositiveInteger(documentText, 'shareware iwad lump count'),
      iwadRelativePaths,
      iwadSha256: extractSection(documentText, 'shareware iwad sha256'),
      windowsExecutableByteSize: extractPositiveInteger(documentText, 'shareware windows executable byte size'),
      windowsExecutableFilename: extractSection(documentText, 'shareware windows executable filename'),
      windowsExecutableRelativePath: extractSection(documentText, 'shareware windows executable relative path'),
      windowsExecutableSha256: extractSection(documentText, 'shareware windows executable sha256'),
    },
    ticRateHertz: extractPositiveInteger(documentText, 'tic rate hertz'),
  };
}

async function loadPinShareware19TargetDocument(): Promise<PinShareware19TargetDocument> {
  const documentText = await Bun.file(PIN_DOCUMENT_PATH).text();
  return parsePinShareware19TargetDocument(documentText);
}

async function computeFileSha256Uppercase(relativePath: string): Promise<string> {
  const hasher = new Bun.CryptoHasher('sha256');
  hasher.update(await Bun.file(relativePath).arrayBuffer());
  return hasher.digest('hex').toUpperCase();
}

async function loadFileHashManifest(): Promise<FileHashManifest> {
  const text = await Bun.file(FILE_HASHES_MANIFEST_PATH).text();
  return JSON.parse(text) as FileHashManifest;
}

function findManifestEntryByRole(manifest: FileHashManifest, role: string): FileHashManifestEntry {
  const entry = manifest.files.find((candidate) => candidate.role === role);
  if (!entry) {
    throw new Error(`No file-hash manifest entry has role "${role}".`);
  }
  return entry;
}

describe('pin shareware DOOM 1.9 primary target declaration', () => {
  test('pin document exists at the canonical path', () => {
    expect(existsSync(PIN_DOCUMENT_PATH)).toBe(true);
    expect(statSync(PIN_DOCUMENT_PATH).isFile()).toBe(true);
  });

  test('parses every required governance field with the expected vanilla parity values', async () => {
    const parsed = await loadPinShareware19TargetDocument();
    expect(parsed.primaryTargetName).toBe('shareware DOOM 1.9');
    expect(parsed.emulatedVanillaVersion).toBe('1.9');
    expect(parsed.referenceEngine).toBe('Chocolate Doom');
    expect(parsed.referenceEngineVersion).toBe('2.2.1');
    expect(parsed.referenceGameMode).toBe('shareware');
    expect(parsed.ticRateHertz).toBe(35);
  });

  test('shareware iwad fields match the on-disk SHA-256 hash, byte size, and lump count', async () => {
    const parsed = await loadPinShareware19TargetDocument();
    expect(parsed.shareware.iwadFilename).toBe('DOOM1.WAD');
    expect(parsed.shareware.iwadSha256).toMatch(SHA256_UPPERCASE_HEX_PATTERN);
    expect(parsed.shareware.iwadByteSize).toBe(4_196_020);
    expect(parsed.shareware.iwadLumpCount).toBe(1264);

    for (const relativePath of parsed.shareware.iwadRelativePaths) {
      expect(existsSync(relativePath)).toBe(true);
      expect(statSync(relativePath).isFile()).toBe(true);
      expect(statSync(relativePath).size).toBe(parsed.shareware.iwadByteSize);
      expect(await computeFileSha256Uppercase(relativePath)).toBe(parsed.shareware.iwadSha256);
    }
  });

  test('shareware iwad relative paths cover both doom/ and iwad/ copies and are unique', async () => {
    const parsed = await loadPinShareware19TargetDocument();
    expect(parsed.shareware.iwadRelativePaths).toContain('doom/DOOM1.WAD');
    expect(parsed.shareware.iwadRelativePaths).toContain('iwad/DOOM1.WAD');
    expect(new Set(parsed.shareware.iwadRelativePaths).size).toBe(parsed.shareware.iwadRelativePaths.length);
  });

  test('shareware DOS executable fields match the on-disk SHA-256 hash and byte size', async () => {
    const parsed = await loadPinShareware19TargetDocument();
    expect(parsed.shareware.dosExecutableFilename).toBe('DOOMD.EXE');
    expect(parsed.shareware.dosExecutableSha256).toMatch(SHA256_UPPERCASE_HEX_PATTERN);
    expect(parsed.shareware.dosExecutableByteSize).toBe(709_753);
    expect(parsed.shareware.dosExecutableRelativePath).toBe('doom/DOOMD.EXE');
    expect(existsSync(parsed.shareware.dosExecutableRelativePath)).toBe(true);
    expect(statSync(parsed.shareware.dosExecutableRelativePath).isFile()).toBe(true);
    expect(statSync(parsed.shareware.dosExecutableRelativePath).size).toBe(parsed.shareware.dosExecutableByteSize);
    expect(await computeFileSha256Uppercase(parsed.shareware.dosExecutableRelativePath)).toBe(parsed.shareware.dosExecutableSha256);
  });

  test('shareware Windows polyglot executable fields match the on-disk SHA-256 hash and byte size', async () => {
    const parsed = await loadPinShareware19TargetDocument();
    expect(parsed.shareware.windowsExecutableFilename).toBe('DOOM.EXE');
    expect(parsed.shareware.windowsExecutableSha256).toMatch(SHA256_UPPERCASE_HEX_PATTERN);
    expect(parsed.shareware.windowsExecutableByteSize).toBe(1_893_888);
    expect(parsed.shareware.windowsExecutableRelativePath).toBe('doom/DOOM.EXE');
    expect(existsSync(parsed.shareware.windowsExecutableRelativePath)).toBe(true);
    expect(statSync(parsed.shareware.windowsExecutableRelativePath).isFile()).toBe(true);
    expect(statSync(parsed.shareware.windowsExecutableRelativePath).size).toBe(parsed.shareware.windowsExecutableByteSize);
    expect(await computeFileSha256Uppercase(parsed.shareware.windowsExecutableRelativePath)).toBe(parsed.shareware.windowsExecutableSha256);
  });

  test('every pinned field agrees with PRIMARY_TARGET in src/reference/target.ts', async () => {
    const parsed = await loadPinShareware19TargetDocument();
    expect(parsed.referenceEngine).toBe(PRIMARY_TARGET.engine);
    expect(parsed.referenceEngineVersion).toBe(PRIMARY_TARGET.engineVersion);
    expect(parsed.emulatedVanillaVersion).toBe(PRIMARY_TARGET.emulatedVersion);
    expect(parsed.referenceGameMode).toBe(PRIMARY_TARGET.gameMode);
    expect(parsed.shareware.iwadFilename).toBe(PRIMARY_TARGET.wadFilename);
    expect(parsed.shareware.iwadSha256).toBe(PRIMARY_TARGET.wadHash);
    expect(parsed.shareware.iwadLumpCount).toBe(PRIMARY_TARGET.wadLumpCount);
    expect(parsed.shareware.dosExecutableSha256).toBe(PRIMARY_TARGET.dosExecutableHash);
    expect(parsed.shareware.windowsExecutableSha256).toBe(PRIMARY_TARGET.executableHash);
    expect(parsed.ticRateHertz).toBe(PRIMARY_TARGET.ticRateHz);
  });

  test('every pinned field agrees with reference/manifests/file-hashes.json', async () => {
    const parsed = await loadPinShareware19TargetDocument();
    const manifest = await loadFileHashManifest();

    const sharewareIwadEntry = findManifestEntryByRole(manifest, 'shareware-iwad');
    expect(sharewareIwadEntry.filename).toBe(parsed.shareware.iwadFilename);
    expect(sharewareIwadEntry.sha256).toBe(parsed.shareware.iwadSha256);
    expect(sharewareIwadEntry.sizeBytes).toBe(parsed.shareware.iwadByteSize);

    const dosExecutableEntry = findManifestEntryByRole(manifest, 'dos-executable');
    expect(dosExecutableEntry.filename).toBe(parsed.shareware.dosExecutableFilename);
    expect(dosExecutableEntry.sha256).toBe(parsed.shareware.dosExecutableSha256);
    expect(dosExecutableEntry.sizeBytes).toBe(parsed.shareware.dosExecutableByteSize);

    const mergedExecutableEntry = findManifestEntryByRole(manifest, 'merged-polyglot-executable');
    expect(mergedExecutableEntry.filename).toBe(parsed.shareware.windowsExecutableFilename);
    expect(mergedExecutableEntry.sha256).toBe(parsed.shareware.windowsExecutableSha256);
    expect(mergedExecutableEntry.sizeBytes).toBe(parsed.shareware.windowsExecutableByteSize);
  });

  test('shareware episode count and episode maps match EPISODE_COUNTS in src/bootstrap/gameMode.ts', async () => {
    const parsed = await loadPinShareware19TargetDocument();
    expect(parsed.shareware.episodeCount).toBe(EPISODE_COUNTS.shareware);
    expect(parsed.shareware.episodeCount).toBe(1);
    expect(parsed.shareware.episodeMaps).toEqual(SHAREWARE_EPISODE_MAP_NAMES);
    expect(parsed.shareware.episodeMaps).toHaveLength(9);
  });

  test('shareware game description matches getGameDescription in src/bootstrap/gameMode.ts', async () => {
    const parsed = await loadPinShareware19TargetDocument();
    expect(parsed.shareware.gameDescription).toBe(getGameDescription('shareware', 'doom'));
    expect(parsed.shareware.gameDescription).toBe('DOOM Shareware');
  });

  test('shareware identification rule matches identifyMission and identifyMode for the shareware lump set', async () => {
    const parsed = await loadPinShareware19TargetDocument();
    expect(identifyMission('doom1.wad')).toBe('doom');
    expect(identifyMission('DOOM1.WAD')).toBe('doom');
    expect(identifyMission('doom/DOOM1.WAD')).toBe('doom');
    expect(identifyMission('iwad/DOOM1.WAD')).toBe('doom');

    const sharewareLumps = new MapLumpChecker(parsed.shareware.episodeMaps);
    expect(identifyMode('doom', sharewareLumps)).toBe('shareware');

    const registeredLumps = new MapLumpChecker([...parsed.shareware.episodeMaps, 'E2M1', 'E3M1']);
    expect(identifyMode('doom', registeredLumps)).toBe('registered');

    const ultimateLumps = new MapLumpChecker([...parsed.shareware.episodeMaps, 'E2M1', 'E3M1', 'E4M1']);
    expect(identifyMode('doom', ultimateLumps)).toBe('retail');
  });

  test('later targets list registered and ultimate DOOM with the canonical lump-detection wording', async () => {
    const parsed = await loadPinShareware19TargetDocument();
    expect(parsed.laterTargets).toHaveLength(2);
    expect(parsed.laterTargets[0]).toContain('registered');
    expect(parsed.laterTargets[0]).toContain('E3M1');
    expect(parsed.laterTargets[0]).toContain('E4M1');
    expect(parsed.laterTargets[1]).toContain('ultimate');
    expect(parsed.laterTargets[1]).toContain('E4M1');
  });

  test('proprietary asset redistribution policy explicitly forbids redistribution and commit staging', async () => {
    const parsed = await loadPinShareware19TargetDocument();
    expect(parsed.proprietaryAssetRedistributionPolicy).toContain('DOOM1.WAD');
    expect(parsed.proprietaryAssetRedistributionPolicy).toContain('DOOMD.EXE');
    expect(parsed.proprietaryAssetRedistributionPolicy).toContain('DOOM.EXE');
    expect(parsed.proprietaryAssetRedistributionPolicy).toContain('proprietary');
    expect(parsed.proprietaryAssetRedistributionPolicy).toContain('must not redistribute');
    expect(parsed.proprietaryAssetRedistributionPolicy).toContain('must not stage them for commit');
  });

  test('every evidence location exists on disk and is a file', async () => {
    const parsed = await loadPinShareware19TargetDocument();
    expect(parsed.evidenceLocations.length).toBeGreaterThan(0);
    expect(new Set(parsed.evidenceLocations).size).toBe(parsed.evidenceLocations.length);
    for (const evidenceLocation of parsed.evidenceLocations) {
      expect(existsSync(evidenceLocation)).toBe(true);
      expect(statSync(evidenceLocation).isFile()).toBe(true);
    }
  });

  test('evidence locations include src/reference/target.ts, src/bootstrap/gameMode.ts, file-hashes.json, both DOOM1.WAD copies, both executables, README.md, and SOURCE_CATALOG.md', async () => {
    const parsed = await loadPinShareware19TargetDocument();
    const requiredEvidence = [
      'src/reference/target.ts',
      'src/bootstrap/gameMode.ts',
      'reference/manifests/file-hashes.json',
      'doom/DOOM1.WAD',
      'doom/DOOMD.EXE',
      'doom/DOOM.EXE',
      'iwad/DOOM1.WAD',
      'plan_vanilla_parity/README.md',
      'plan_vanilla_parity/SOURCE_CATALOG.md',
    ];
    for (const requiredEvidenceLocation of requiredEvidence) {
      expect(parsed.evidenceLocations).toContain(requiredEvidenceLocation);
    }
  });

  test('plan_vanilla_parity README.md states the same primary-target acceptance phrasing', async () => {
    const parsed = await loadPinShareware19TargetDocument();
    const readmeText = await Bun.file(README_PATH).text();
    expect(readmeText).toContain(parsed.acceptancePhrasing);
    expect(parsed.acceptancePhrasing).toBe('Primary target: shareware DOOM 1.9 with local `DOOM1.WAD`.');
  });

  test('plan_vanilla_parity SOURCE_CATALOG.md lists the three pinned local artifacts as primary or secondary authorities', async () => {
    const sourceCatalogText = await Bun.file(SOURCE_CATALOG_PATH).text();
    expect(sourceCatalogText).toContain('`doom/DOOMD.EXE`');
    expect(sourceCatalogText).toContain('`doom/DOOM.EXE`');
    expect(sourceCatalogText).toContain('`doom/DOOM1.WAD`');
    expect(sourceCatalogText).toContain('`iwad/DOOM1.WAD`');
    expect(sourceCatalogText).toContain('shareware DOOM 1.9');
  });

  test('step 00-003 file declares the governance lane, lists this declaration under its write lock, and lists the focused test under its test files', async () => {
    expect(existsSync(STEP_FILE_PATH)).toBe(true);
    const stepText = await Bun.file(STEP_FILE_PATH).text();
    expect(stepText).toContain('# [ ] STEP 00-003: Pin Shareware Doom One Point Nine Primary Target');
    expect(stepText).toContain('\n## lane\n\ngovernance\n');
    expect(stepText).toContain('- plan_vanilla_parity/pin-shareware-doom-one-point-nine-primary-target.md');
    expect(stepText).toContain('- test/plan_vanilla_parity/pin-shareware-doom-one-point-nine-primary-target.test.ts');
  });

  test('MASTER_CHECKLIST.md row for 00-003 references the canonical step file path and the governance lane', async () => {
    const checklistText = await Bun.file(MASTER_CHECKLIST_PATH).text();
    const expectedPendingRow = '- [ ] `00-003` `pin-shareware-doom-one-point-nine-primary-target` | lane: `governance` | prereqs: `00-002` | file: `plan_vanilla_parity/steps/00-003-pin-shareware-doom-one-point-nine-primary-target.md`';
    const expectedCompletedRow = '- [x] `00-003` `pin-shareware-doom-one-point-nine-primary-target` | lane: `governance` | prereqs: `00-002` | file: `plan_vanilla_parity/steps/00-003-pin-shareware-doom-one-point-nine-primary-target.md`';
    expect(checklistText.includes(expectedPendingRow) || checklistText.includes(expectedCompletedRow)).toBe(true);
  });

  test('parser surfaces a meaningful error when a required section is missing (failure mode)', () => {
    const documentTextWithMissingSection = '# Test\n\n## primary target name\n\nshareware DOOM 1.9\n';
    expect(() => parsePinShareware19TargetDocument(documentTextWithMissingSection)).toThrow('Section "shareware iwad relative paths" not found in shareware DOOM 1.9 pin document.');
  });

  test('parser surfaces a meaningful error when a positive-integer section is not a positive integer (failure mode)', async () => {
    const validDocumentText = await Bun.file(PIN_DOCUMENT_PATH).text();
    const corruptedDocumentText = validDocumentText.replace(/\n## tic rate hertz\n\n35\n/, '\n## tic rate hertz\n\nnot-a-number\n');
    expect(corruptedDocumentText).not.toBe(validDocumentText);
    expect(() => parsePinShareware19TargetDocument(corruptedDocumentText)).toThrow('Section "tic rate hertz" must be a positive integer, got "not-a-number".');
  });

  test('parser surfaces a meaningful error when shareware iwad relative paths is empty (failure mode)', () => {
    const documentTextWithEmptyIwadPaths = [
      '# Test',
      '',
      '## primary target name',
      '',
      'shareware DOOM 1.9',
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
      '## reference game mode',
      '',
      'shareware',
      '',
      '## tic rate hertz',
      '',
      '35',
      '',
      '## shareware iwad filename',
      '',
      'DOOM1.WAD',
      '',
      '## shareware iwad sha256',
      '',
      '1D7D43BE501E67D927E415E0B8F3E29C3BF33075E859721816F652A526CAC771',
      '',
      '## shareware iwad byte size',
      '',
      '4196020',
      '',
      '## shareware iwad lump count',
      '',
      '1264',
      '',
      '## shareware iwad relative paths',
      '',
      'no bullets here',
      '',
    ].join('\n');
    expect(() => parsePinShareware19TargetDocument(documentTextWithEmptyIwadPaths)).toThrow('shareware iwad relative paths must list at least one path.');
  });
});
