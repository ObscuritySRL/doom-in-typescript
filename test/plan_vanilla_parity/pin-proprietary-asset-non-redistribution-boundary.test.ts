import { describe, expect, test } from 'bun:test';

import { existsSync, statSync } from 'node:fs';

import { ASSET_BOUNDARIES } from '../../src/reference/policy.ts';
import type { AssetBoundary, LicenseCategory, RedistributionPolicy } from '../../src/reference/policy.ts';

const GITIGNORE_PATH = '.gitignore';
const MASTER_CHECKLIST_PATH = 'plan_vanilla_parity/MASTER_CHECKLIST.md';
const PIN_DOCUMENT_PATH = 'plan_vanilla_parity/pin-proprietary-asset-non-redistribution-boundary.md';
const POLICY_MODULE_PATH = 'src/reference/policy.ts';
const README_PATH = 'plan_vanilla_parity/README.md';
const STEP_FILE_PATH = 'plan_vanilla_parity/steps/00-005-pin-proprietary-asset-non-redistribution-boundary.md';
const USER_SUPPLIED_IWAD_SCOPE_DOCUMENT_PATH = 'plan_vanilla_parity/pin-user-supplied-registered-and-ultimate-iwad-scope.md';

interface PinProprietaryAssetBoundaryDocument {
  readonly acceptancePhrasing: string;
  readonly emulatedVanillaVersion: string;
  readonly evidenceLocations: readonly string[];
  readonly permittedWithNoticeFilenames: readonly string[];
  readonly permittedWithNoticeRule: string;
  readonly proprietaryAssetFilenames: readonly string[];
  readonly proprietaryAssetLicenseCategory: string;
  readonly proprietaryAssetRedistributionPolicy: string;
  readonly referenceEngine: string;
  readonly referenceEngineVersion: string;
  readonly scopeName: string;
  readonly userSuppliedDropLocationRule: string;
  readonly userSuppliedDropLocations: readonly string[];
}

function extractSection(documentText: string, sectionHeading: string): string {
  const heading = `## ${sectionHeading}`;
  const sectionStart = documentText.indexOf(`\n${heading}\n`);
  if (sectionStart === -1) {
    throw new Error(`Section "${sectionHeading}" not found in proprietary asset non-redistribution boundary document.`);
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

function parsePinProprietaryAssetBoundaryDocument(documentText: string): PinProprietaryAssetBoundaryDocument {
  const proprietaryAssetFilenames = extractBullets(documentText, 'proprietary asset filenames');
  if (proprietaryAssetFilenames.length === 0) {
    throw new Error('proprietary asset filenames must list at least one filename.');
  }
  const userSuppliedDropLocations = extractBullets(documentText, 'user-supplied drop locations');
  if (userSuppliedDropLocations.length === 0) {
    throw new Error('user-supplied drop locations must list at least one path.');
  }

  return {
    acceptancePhrasing: extractSection(documentText, 'acceptance phrasing'),
    emulatedVanillaVersion: extractSection(documentText, 'emulated vanilla version'),
    evidenceLocations: extractBullets(documentText, 'evidence locations'),
    permittedWithNoticeFilenames: extractBullets(documentText, 'permitted-with-notice filenames'),
    permittedWithNoticeRule: extractSection(documentText, 'permitted-with-notice rule'),
    proprietaryAssetFilenames,
    proprietaryAssetLicenseCategory: extractSection(documentText, 'proprietary asset license category'),
    proprietaryAssetRedistributionPolicy: extractSection(documentText, 'proprietary asset redistribution policy'),
    referenceEngine: extractSection(documentText, 'reference engine'),
    referenceEngineVersion: extractSection(documentText, 'reference engine version'),
    scopeName: extractSection(documentText, 'scope name'),
    userSuppliedDropLocationRule: extractSection(documentText, 'user-supplied drop location rule'),
    userSuppliedDropLocations,
  };
}

async function loadPinProprietaryAssetBoundaryDocument(): Promise<PinProprietaryAssetBoundaryDocument> {
  const documentText = await Bun.file(PIN_DOCUMENT_PATH).text();
  return parsePinProprietaryAssetBoundaryDocument(documentText);
}

function findAssetBoundary(filename: string): AssetBoundary | undefined {
  return ASSET_BOUNDARIES.find((entry) => entry.filename === filename);
}

const FORBIDDEN_LICENSE_CATEGORIES: ReadonlySet<LicenseCategory> = new Set(['commercial-shareware', 'mixed']);
const PERMITTED_LICENSE_CATEGORIES: ReadonlySet<LicenseCategory> = new Set(['gpl', 'utility']);

describe('pin proprietary asset non-redistribution boundary declaration', () => {
  test('pin document exists at the canonical path', () => {
    expect(existsSync(PIN_DOCUMENT_PATH)).toBe(true);
    expect(statSync(PIN_DOCUMENT_PATH).isFile()).toBe(true);
  });

  test('parses every required governance field with the expected vanilla parity values', async () => {
    const parsed = await loadPinProprietaryAssetBoundaryDocument();
    expect(parsed.scopeName).toBe('vanilla DOOM 1.9 proprietary asset non-redistribution boundary');
    expect(parsed.emulatedVanillaVersion).toBe('1.9');
    expect(parsed.referenceEngine).toBe('Chocolate Doom');
    expect(parsed.referenceEngineVersion).toBe('2.2.1');
  });

  test('proprietary asset filenames are unique and ASCIIbetically sorted', async () => {
    const parsed = await loadPinProprietaryAssetBoundaryDocument();
    expect(new Set(parsed.proprietaryAssetFilenames).size).toBe(parsed.proprietaryAssetFilenames.length);
    const ascendingSortedFilenames = [...parsed.proprietaryAssetFilenames].sort();
    expect(parsed.proprietaryAssetFilenames).toEqual(ascendingSortedFilenames);
  });

  test('proprietary asset filenames cover the five canonical id Software artifacts pinned by this rebuild', async () => {
    const parsed = await loadPinProprietaryAssetBoundaryDocument();
    expect(parsed.proprietaryAssetFilenames).toContain('DOOM.EXE');
    expect(parsed.proprietaryAssetFilenames).toContain('DOOM.WAD');
    expect(parsed.proprietaryAssetFilenames).toContain('DOOM1.WAD');
    expect(parsed.proprietaryAssetFilenames).toContain('DOOMD.EXE');
    expect(parsed.proprietaryAssetFilenames).toContain('DOOMDUPX.EXE');
    expect(parsed.proprietaryAssetFilenames).toHaveLength(5);
  });

  test('every proprietary asset cataloged in src/reference/policy.ts has redistributionPolicy "forbidden" and a forbidden license category', async () => {
    const parsed = await loadPinProprietaryAssetBoundaryDocument();
    for (const proprietaryFilename of parsed.proprietaryAssetFilenames) {
      const cataloged = findAssetBoundary(proprietaryFilename);
      if (cataloged === undefined) {
        // The user-supplied registered/Ultimate DOOM.WAD is not bundled in the working tree
        // and intentionally has no entry in `src/reference/policy.ts`.  Tolerate that one
        // documented exception.
        expect(proprietaryFilename).toBe('DOOM.WAD');
        continue;
      }
      const expectedRedistributionPolicy: RedistributionPolicy = 'forbidden';
      expect<RedistributionPolicy>(cataloged.redistributionPolicy).toBe(expectedRedistributionPolicy);
      expect(FORBIDDEN_LICENSE_CATEGORIES.has(cataloged.licenseCategory)).toBe(true);
    }
  });

  test('proprietary asset license category section names both forbidden upstream license families', async () => {
    const parsed = await loadPinProprietaryAssetBoundaryDocument();
    expect(parsed.proprietaryAssetLicenseCategory).toContain('commercial-shareware');
    expect(parsed.proprietaryAssetLicenseCategory).toContain('mixed');
    expect(parsed.proprietaryAssetLicenseCategory).toContain('src/reference/policy.ts');
    expect(parsed.proprietaryAssetLicenseCategory).toContain('DOOM1.WAD');
    expect(parsed.proprietaryAssetLicenseCategory).toContain('DOOM.EXE');
  });

  test('proprietary asset redistribution policy explicitly forbids bundling, regeneration, commit staging, republishing, and redistributing', async () => {
    const parsed = await loadPinProprietaryAssetBoundaryDocument();
    expect(parsed.proprietaryAssetRedistributionPolicy).toContain('proprietary');
    expect(parsed.proprietaryAssetRedistributionPolicy).toContain('user-supplied only');
    expect(parsed.proprietaryAssetRedistributionPolicy).toContain('must never be bundled');
    expect(parsed.proprietaryAssetRedistributionPolicy).toContain('regenerated');
    expect(parsed.proprietaryAssetRedistributionPolicy).toContain('staged for commit');
    expect(parsed.proprietaryAssetRedistributionPolicy).toContain('published');
    expect(parsed.proprietaryAssetRedistributionPolicy).toContain('redistributed');
    expect(parsed.proprietaryAssetRedistributionPolicy).toContain('skip cleanly');
  });

  test('user-supplied drop locations are exactly the two gitignored runtime directories doom/ and iwad/', async () => {
    const parsed = await loadPinProprietaryAssetBoundaryDocument();
    expect(parsed.userSuppliedDropLocations).toEqual(['doom/', 'iwad/']);
  });

  test('user-supplied drop locations are gitignored at the repository root', async () => {
    const parsed = await loadPinProprietaryAssetBoundaryDocument();
    const gitignoreText = await Bun.file(GITIGNORE_PATH).text();
    const gitignoreLines = new Set(gitignoreText.split(/\r?\n/).map((line) => line.trim()));
    for (const dropLocation of parsed.userSuppliedDropLocations) {
      expect(gitignoreLines.has(dropLocation)).toBe(true);
    }
  });

  test('user-supplied drop location rule explicitly forbids staging any file under those directories for commit', async () => {
    const parsed = await loadPinProprietaryAssetBoundaryDocument();
    expect(parsed.userSuppliedDropLocationRule).toContain('gitignored');
    expect(parsed.userSuppliedDropLocationRule).toContain('user-supplied');
    expect(parsed.userSuppliedDropLocationRule).toContain('never stage');
    expect(parsed.userSuppliedDropLocationRule).toContain('runtime');
    expect(parsed.userSuppliedDropLocationRule).toContain('doom/');
    expect(parsed.userSuppliedDropLocationRule).toContain('iwad/');
  });

  test('permitted-with-notice filenames cover the four cataloged GPL/utility files in src/reference/policy.ts', async () => {
    const parsed = await loadPinProprietaryAssetBoundaryDocument();
    expect(parsed.permittedWithNoticeFilenames).toContain('DOOMWUPX.exe');
    expect(parsed.permittedWithNoticeFilenames).toContain('chocolate-doom.cfg');
    expect(parsed.permittedWithNoticeFilenames).toContain('default.cfg');
    expect(parsed.permittedWithNoticeFilenames).toContain('smash.py');
    expect(parsed.permittedWithNoticeFilenames).toHaveLength(4);
  });

  test('every permitted-with-notice filename cataloged in src/reference/policy.ts has redistributionPolicy "permitted-with-notice" and a permitted license category', async () => {
    const parsed = await loadPinProprietaryAssetBoundaryDocument();
    for (const permittedFilename of parsed.permittedWithNoticeFilenames) {
      const cataloged = findAssetBoundary(permittedFilename);
      expect(cataloged).not.toBeUndefined();
      if (cataloged === undefined) {
        continue;
      }
      const expectedRedistributionPolicy: RedistributionPolicy = 'permitted-with-notice';
      expect<RedistributionPolicy>(cataloged.redistributionPolicy).toBe(expectedRedistributionPolicy);
      expect(PERMITTED_LICENSE_CATEGORIES.has(cataloged.licenseCategory)).toBe(true);
    }
  });

  test('proprietary asset filenames and permitted-with-notice filenames are disjoint sets', async () => {
    const parsed = await loadPinProprietaryAssetBoundaryDocument();
    const proprietarySet = new Set(parsed.proprietaryAssetFilenames);
    for (const permittedFilename of parsed.permittedWithNoticeFilenames) {
      expect(proprietarySet.has(permittedFilename)).toBe(false);
    }
  });

  test('every cataloged forbidden file in src/reference/policy.ts is named in the proprietary asset filenames list', async () => {
    const parsed = await loadPinProprietaryAssetBoundaryDocument();
    const documentedProprietary = new Set(parsed.proprietaryAssetFilenames);
    for (const cataloged of ASSET_BOUNDARIES) {
      if (cataloged.redistributionPolicy === 'forbidden') {
        expect(documentedProprietary.has(cataloged.filename)).toBe(true);
      }
    }
  });

  test('every cataloged permitted-with-notice file in src/reference/policy.ts is named in the permitted-with-notice filenames list', async () => {
    const parsed = await loadPinProprietaryAssetBoundaryDocument();
    const documentedPermitted = new Set(parsed.permittedWithNoticeFilenames);
    for (const cataloged of ASSET_BOUNDARIES) {
      if (cataloged.redistributionPolicy === 'permitted-with-notice') {
        expect(documentedPermitted.has(cataloged.filename)).toBe(true);
      }
    }
  });

  test('permitted-with-notice rule names every permitted-with-notice file and explains why each is not proprietary', async () => {
    const parsed = await loadPinProprietaryAssetBoundaryDocument();
    expect(parsed.permittedWithNoticeRule).toContain('DOOMWUPX.exe');
    expect(parsed.permittedWithNoticeRule).toContain('chocolate-doom.cfg');
    expect(parsed.permittedWithNoticeRule).toContain('default.cfg');
    expect(parsed.permittedWithNoticeRule).toContain('smash.py');
    expect(parsed.permittedWithNoticeRule).toContain('GPL');
    expect(parsed.permittedWithNoticeRule).toContain('proprietary');
  });

  test('every evidence location exists on disk and is a file', async () => {
    const parsed = await loadPinProprietaryAssetBoundaryDocument();
    expect(parsed.evidenceLocations.length).toBeGreaterThan(0);
    expect(new Set(parsed.evidenceLocations).size).toBe(parsed.evidenceLocations.length);
    for (const evidenceLocation of parsed.evidenceLocations) {
      expect(existsSync(evidenceLocation)).toBe(true);
      expect(statSync(evidenceLocation).isFile()).toBe(true);
    }
  });

  test('evidence locations include .gitignore, src/reference/policy.ts, the user-supplied IWAD scope pin, README.md, and SOURCE_CATALOG.md', async () => {
    const parsed = await loadPinProprietaryAssetBoundaryDocument();
    const requiredEvidence = [GITIGNORE_PATH, POLICY_MODULE_PATH, USER_SUPPLIED_IWAD_SCOPE_DOCUMENT_PATH, README_PATH, 'plan_vanilla_parity/SOURCE_CATALOG.md'];
    for (const requiredEvidenceLocation of requiredEvidence) {
      expect(parsed.evidenceLocations).toContain(requiredEvidenceLocation);
    }
  });

  test('plan_vanilla_parity README.md contains the same later-targets acceptance phrasing as the pin document', async () => {
    const parsed = await loadPinProprietaryAssetBoundaryDocument();
    const readmeText = await Bun.file(README_PATH).text();
    expect(readmeText).toContain(parsed.acceptancePhrasing);
    expect(parsed.acceptancePhrasing).toBe('Later targets: user-supplied registered or Ultimate `DOOM.WAD`; no proprietary assets are redistributed.');
  });

  test('the user-supplied IWAD scope pin document carries an aligned proprietary asset redistribution policy', async () => {
    const userSuppliedScopeText = await Bun.file(USER_SUPPLIED_IWAD_SCOPE_DOCUMENT_PATH).text();
    expect(userSuppliedScopeText).toContain('proprietary id Software assets');
    expect(userSuppliedScopeText).toContain('user-supplied only');
    expect(userSuppliedScopeText).toContain('must not bundle');
    expect(userSuppliedScopeText).toContain('must not regenerate');
    expect(userSuppliedScopeText).toContain('must not stage them for commit');
    expect(userSuppliedScopeText).toContain('must not publish');
    expect(userSuppliedScopeText).toContain('must not redistribute');
  });

  test('step 00-005 file declares the governance lane, lists this declaration under its write lock, and lists the focused test under its test files', async () => {
    expect(existsSync(STEP_FILE_PATH)).toBe(true);
    const stepText = await Bun.file(STEP_FILE_PATH).text();
    expect(stepText).toContain('# [ ] STEP 00-005: Pin Proprietary Asset Non Redistribution Boundary');
    expect(stepText).toContain('\n## lane\n\ngovernance\n');
    expect(stepText).toContain('- plan_vanilla_parity/pin-proprietary-asset-non-redistribution-boundary.md');
    expect(stepText).toContain('- test/plan_vanilla_parity/pin-proprietary-asset-non-redistribution-boundary.test.ts');
  });

  test('MASTER_CHECKLIST.md row for 00-005 references the canonical step file path and the governance lane', async () => {
    const checklistText = await Bun.file(MASTER_CHECKLIST_PATH).text();
    const expectedPendingRow = '- [ ] `00-005` `pin-proprietary-asset-non-redistribution-boundary` | lane: `governance` | prereqs: `00-004` | file: `plan_vanilla_parity/steps/00-005-pin-proprietary-asset-non-redistribution-boundary.md`';
    const expectedCompletedRow = '- [x] `00-005` `pin-proprietary-asset-non-redistribution-boundary` | lane: `governance` | prereqs: `00-004` | file: `plan_vanilla_parity/steps/00-005-pin-proprietary-asset-non-redistribution-boundary.md`';
    expect(checklistText.includes(expectedPendingRow) || checklistText.includes(expectedCompletedRow)).toBe(true);
  });

  test('parser surfaces a meaningful error when a required section is missing (failure mode)', () => {
    const documentTextWithMissingSection = '# Test\n\n## scope name\n\nvanilla DOOM 1.9 proprietary asset non-redistribution boundary\n';
    expect(() => parsePinProprietaryAssetBoundaryDocument(documentTextWithMissingSection)).toThrow('Section "proprietary asset filenames" not found in proprietary asset non-redistribution boundary document.');
  });

  test('parser surfaces a meaningful error when proprietary asset filenames is empty (failure mode)', () => {
    const documentTextWithEmptyProprietaryFilenames = [
      '# Test',
      '',
      '## scope name',
      '',
      'vanilla DOOM 1.9 proprietary asset non-redistribution boundary',
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
      '## proprietary asset filenames',
      '',
      'no bullets here',
      '',
    ].join('\n');
    expect(() => parsePinProprietaryAssetBoundaryDocument(documentTextWithEmptyProprietaryFilenames)).toThrow('proprietary asset filenames must list at least one filename.');
  });

  test('parser surfaces a meaningful error when user-supplied drop locations is empty (failure mode)', async () => {
    const validDocumentText = await Bun.file(PIN_DOCUMENT_PATH).text();
    const corruptedDocumentText = validDocumentText.replace(/\n## user-supplied drop locations\n\n- doom\/\n- iwad\/\n/, '\n## user-supplied drop locations\n\nno bullets here\n');
    expect(corruptedDocumentText).not.toBe(validDocumentText);
    expect(() => parsePinProprietaryAssetBoundaryDocument(corruptedDocumentText)).toThrow('user-supplied drop locations must list at least one path.');
  });
});
