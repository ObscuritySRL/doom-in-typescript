import { describe, expect, test } from 'bun:test';

import {
  NO_ASSET_REDISTRIBUTION_AUDIT,
  NO_ASSET_REDISTRIBUTION_DERIVED_INVARIANTS,
  PERMITTED_WITH_NOTICE_FILENAMES,
  PROHIBITED_PROPRIETARY_FILENAMES,
  PROHIBITED_PROPRIETARY_SHA256_HASHES,
  ProprietaryAssetRedistributionError,
  USER_SUPPLIED_DROP_LOCATIONS,
  USER_SUPPLIED_PROPRIETARY_IWAD_BASENAMES,
  assertTestArtifactPathIsNotProprietary,
  assertTestPayloadHashIsNotProprietary,
  classifyAssetForRedistribution,
  crossCheckNoAssetRedistributionRuntime,
  isInsideUserSuppliedDropLocation,
  isPermittedWithNoticeFilename,
  isProprietaryFilename,
  isProprietarySha256,
  shouldSkipTestWhenAssetAbsent,
} from '../../../src/assets/enforce-no-asset-redistribution-in-tests.ts';
import type { NoAssetRedistributionAuditEntry, NoAssetRedistributionRuntimeSnapshot } from '../../../src/assets/enforce-no-asset-redistribution-in-tests.ts';

const ALLOWED_AXIS_IDS = new Set<NoAssetRedistributionAuditEntry['id']>([
  'proprietary-filename-doom-exe-forbidden',
  'proprietary-filename-doom-wad-forbidden',
  'proprietary-filename-doom1-wad-forbidden',
  'proprietary-filename-doomd-exe-forbidden',
  'proprietary-filename-doomdupx-exe-forbidden',
  'proprietary-filename-doomu-wad-forbidden',
  'proprietary-sha256-doom-exe-pinned',
  'proprietary-sha256-doom1-wad-pinned',
  'proprietary-sha256-doomd-exe-pinned',
  'proprietary-sha256-doomdupx-exe-pinned',
  'permitted-filename-doomwupx-exe-not-staged',
  'permitted-filename-chocolate-doom-cfg-not-staged',
  'permitted-filename-default-cfg-not-staged',
  'permitted-filename-smash-py-not-staged',
  'user-supplied-drop-location-doom-gitignored',
  'user-supplied-drop-location-iwad-gitignored',
  'license-category-commercial-shareware-forbidden',
  'license-category-mixed-polyglot-forbidden',
  'license-category-gpl-permitted-with-notice',
  'license-category-utility-permitted-with-notice',
  'tests-must-skip-when-proprietary-asset-absent',
  'tests-must-not-regenerate-proprietary-bytes',
  'tests-must-not-fabricate-proprietary-bytes',
  'tests-must-not-substitute-proprietary-bytes',
  'tests-must-not-stage-proprietary-bytes-for-commit',
  'tests-must-not-publish-proprietary-under-alternate-name',
  'tests-must-not-embed-proprietary-bytes-in-output',
  'tests-must-not-derive-binary-from-proprietary-bytes',
  'reference-bundle-path-locks-doom-as-read-only-source',
]);

const ALLOWED_SUBJECTS = new Set<NoAssetRedistributionAuditEntry['subject']>([
  'proprietary-asset-filename',
  'proprietary-asset-sha256',
  'permitted-with-notice-asset',
  'user-supplied-drop-location',
  'license-category',
  'test-suite-redistribution-rule',
  'reference-bundle-root',
]);

const ALLOWED_REFERENCE_FILES = new Set<NoAssetRedistributionAuditEntry['referenceSourceFile']>([
  'plan_vanilla_parity/pin-proprietary-asset-non-redistribution-boundary.md',
  'plan_vanilla_parity/pin-shareware-doom-one-point-nine-primary-target.md',
  'plan_vanilla_parity/pin-user-supplied-registered-and-ultimate-iwad-scope.md',
  'src/reference/policy.ts',
  'src/reference/target.ts',
  'reference/manifests/file-hashes.json',
  '.gitignore',
]);

const DOOM_EXE_SHA256 = '5CA97717FD79F833B248AE5985FFFADBEE39533F5E0529BC9D7B439E08B8F1D2';
const DOOM1_WAD_SHA256 = '1D7D43BE501E67D927E415E0B8F3E29C3BF33075E859721816F652A526CAC771';
const DOOMD_EXE_SHA256 = '9D3216605417888D5A699FA3794E46638EB4CB8634501AE748D74F9C2CFAE37B';
const DOOMDUPX_EXE_SHA256 = '051868114DF076FD0BAE8632D0D565B11EF85BB714B12D453F84F2E2E45E4764';
const DOOMWUPX_EXE_SHA256 = '6D19555FE98F36F70246D1178ABF6B69D78473B36EC79E409D6E8032BC3FB8B3';
const BENIGN_ZERO_SHA256 = '0000000000000000000000000000000000000000000000000000000000000000';

function buildLiveRuntimeSnapshot(): NoAssetRedistributionRuntimeSnapshot {
  let assertTestArtifactPathThrowsOnProprietaryFilename = false;
  try {
    assertTestArtifactPathIsNotProprietary('test/oracles/fixtures/DOOM1.WAD');
  } catch (e) {
    assertTestArtifactPathThrowsOnProprietaryFilename = e instanceof ProprietaryAssetRedistributionError;
  }

  let assertTestArtifactPathThrowsOnDropLocationPath = false;
  try {
    assertTestArtifactPathIsNotProprietary('doom/anything.bin');
  } catch (e) {
    assertTestArtifactPathThrowsOnDropLocationPath = e instanceof ProprietaryAssetRedistributionError;
  }

  let assertTestArtifactPathDoesNotThrowForRegularFixture = false;
  try {
    assertTestArtifactPathIsNotProprietary('test/oracles/fixtures/probe.json');
    assertTestArtifactPathDoesNotThrowForRegularFixture = true;
  } catch {
    assertTestArtifactPathDoesNotThrowForRegularFixture = false;
  }

  let assertTestPayloadHashThrowsOnProprietaryHash = false;
  try {
    assertTestPayloadHashIsNotProprietary(DOOM1_WAD_SHA256);
  } catch (e) {
    assertTestPayloadHashThrowsOnProprietaryHash = e instanceof ProprietaryAssetRedistributionError;
  }

  let assertTestPayloadHashDoesNotThrowForBenignHash = false;
  try {
    assertTestPayloadHashIsNotProprietary(BENIGN_ZERO_SHA256);
    assertTestPayloadHashDoesNotThrowForBenignHash = true;
  } catch {
    assertTestPayloadHashDoesNotThrowForBenignHash = false;
  }

  const sampleError = new ProprietaryAssetRedistributionError('hash', DOOM1_WAD_SHA256, 'sample');

  const userSuppliedSet = new Set(USER_SUPPLIED_DROP_LOCATIONS);
  const prohibitedSet = new Set(PROHIBITED_PROPRIETARY_FILENAMES);
  const permittedSet = new Set(PERMITTED_WITH_NOTICE_FILENAMES);
  let disjoint = true;
  for (const name of userSuppliedSet) {
    if (prohibitedSet.has(name) || permittedSet.has(name)) {
      disjoint = false;
      break;
    }
  }
  for (const name of prohibitedSet) {
    if (permittedSet.has(name)) {
      disjoint = false;
      break;
    }
  }

  return {
    prohibitedFilenamesIncludeDoomExe: PROHIBITED_PROPRIETARY_FILENAMES.includes('DOOM.EXE'),
    prohibitedFilenamesIncludeDoomWad: PROHIBITED_PROPRIETARY_FILENAMES.includes('DOOM.WAD'),
    prohibitedFilenamesIncludeDoom1Wad: PROHIBITED_PROPRIETARY_FILENAMES.includes('DOOM1.WAD'),
    prohibitedFilenamesIncludeDoomdExe: PROHIBITED_PROPRIETARY_FILENAMES.includes('DOOMD.EXE'),
    prohibitedFilenamesIncludeDoomdupxExe: PROHIBITED_PROPRIETARY_FILENAMES.includes('DOOMDUPX.EXE'),
    prohibitedFilenamesIncludeDoomuWad: PROHIBITED_PROPRIETARY_FILENAMES.includes('doomu.wad'),
    isProprietaryFilenameIsCaseInsensitive: isProprietaryFilename('DOOM1.WAD') && isProprietaryFilename('doom1.wad') && isProprietaryFilename('Doom1.Wad'),
    isProprietaryFilenameRejectsUnrelatedNames: !isProprietaryFilename('README.md') && !isProprietaryFilename('STBAR.LMP'),
    prohibitedSha256IncludesDoom1WadHash: PROHIBITED_PROPRIETARY_SHA256_HASHES.includes(DOOM1_WAD_SHA256),
    prohibitedSha256IncludesDoomExeHash: PROHIBITED_PROPRIETARY_SHA256_HASHES.includes(DOOM_EXE_SHA256),
    prohibitedSha256IncludesDoomdExeHash: PROHIBITED_PROPRIETARY_SHA256_HASHES.includes(DOOMD_EXE_SHA256),
    prohibitedSha256IncludesDoomdupxExeHash: PROHIBITED_PROPRIETARY_SHA256_HASHES.includes(DOOMDUPX_EXE_SHA256),
    isProprietarySha256IsCaseInsensitive: isProprietarySha256(DOOM1_WAD_SHA256) && isProprietarySha256(DOOM1_WAD_SHA256.toLowerCase()),
    isProprietarySha256RejectsUnrelatedHashes: !isProprietarySha256(DOOMWUPX_EXE_SHA256) && !isProprietarySha256(BENIGN_ZERO_SHA256),
    permittedWithNoticeIncludesDoomwupxExe: PERMITTED_WITH_NOTICE_FILENAMES.includes('DOOMWUPX.exe'),
    permittedWithNoticeIncludesChocolateDoomCfg: PERMITTED_WITH_NOTICE_FILENAMES.includes('chocolate-doom.cfg'),
    permittedWithNoticeIncludesDefaultCfg: PERMITTED_WITH_NOTICE_FILENAMES.includes('default.cfg'),
    permittedWithNoticeIncludesSmashPy: PERMITTED_WITH_NOTICE_FILENAMES.includes('smash.py'),
    userSuppliedDropLocationsIncludeDoom: USER_SUPPLIED_DROP_LOCATIONS.includes('doom'),
    userSuppliedDropLocationsIncludeIwad: USER_SUPPLIED_DROP_LOCATIONS.includes('iwad'),
    userSuppliedAndProhibitedAndPermittedAreDisjoint: disjoint,
    isInsideUserSuppliedDropLocationHandlesDoomPrefix: isInsideUserSuppliedDropLocation('doom/DOOM1.WAD') && isInsideUserSuppliedDropLocation('doom\\DOOM1.WAD'),
    isInsideUserSuppliedDropLocationHandlesIwadPrefix: isInsideUserSuppliedDropLocation('iwad/DOOM.WAD') && isInsideUserSuppliedDropLocation('iwad\\DOOM.WAD'),
    isInsideUserSuppliedDropLocationRejectsTestFixturesPrefix: !isInsideUserSuppliedDropLocation('test/oracles/fixtures/probe.json'),
    classifyAssetReturnsForbiddenForCommercialShareware:
      classifyAssetForRedistribution('DOOM1.WAD') === 'forbidden' && classifyAssetForRedistribution('DOOMD.EXE') === 'forbidden' && classifyAssetForRedistribution('DOOMDUPX.EXE') === 'forbidden',
    classifyAssetReturnsForbiddenForMixedPolyglot: classifyAssetForRedistribution('DOOM.EXE') === 'forbidden',
    classifyAssetReturnsPermittedWithNoticeForGpl:
      classifyAssetForRedistribution('DOOMWUPX.exe') === 'permitted-with-notice' &&
      classifyAssetForRedistribution('chocolate-doom.cfg') === 'permitted-with-notice' &&
      classifyAssetForRedistribution('default.cfg') === 'permitted-with-notice',
    classifyAssetReturnsPermittedWithNoticeForUtility: classifyAssetForRedistribution('smash.py') === 'permitted-with-notice',
    classifyAssetReturnsNullForUnknownFilename: classifyAssetForRedistribution('README.md') === null,
    assertTestArtifactPathThrowsOnProprietaryFilename,
    assertTestArtifactPathThrowsOnDropLocationPath,
    assertTestArtifactPathDoesNotThrowForRegularFixture,
    assertTestPayloadHashThrowsOnProprietaryHash,
    assertTestPayloadHashDoesNotThrowForBenignHash,
    shouldSkipTestWhenAssetAbsentReturnsTrueWhenProprietaryAbsent: shouldSkipTestWhenAssetAbsent('doom/DOOM1.WAD', false) === true,
    shouldSkipTestWhenAssetAbsentReturnsFalseWhenProprietaryPresent: shouldSkipTestWhenAssetAbsent('doom/DOOM1.WAD', true) === false,
    shouldSkipTestWhenAssetAbsentReturnsFalseForNonProprietaryPath: shouldSkipTestWhenAssetAbsent('test/oracles/fixtures/probe.json', false) === false,
    proprietaryAssetRedistributionErrorCarriesReasonAndOffendingValue: sampleError.reason === 'hash' && sampleError.offendingValue === DOOM1_WAD_SHA256,
  };
}

const liveRuntimeSnapshot = Object.freeze(buildLiveRuntimeSnapshot());

describe('No-asset-redistribution audit ledger shape', () => {
  test('audits exactly twenty-nine redistribution-boundary axes', () => {
    expect(NO_ASSET_REDISTRIBUTION_AUDIT.length).toBe(29);
  });

  test('every audit entry carries an allowed axis id', () => {
    for (const entry of NO_ASSET_REDISTRIBUTION_AUDIT) {
      expect(ALLOWED_AXIS_IDS.has(entry.id)).toBe(true);
    }
  });

  test('every axis id is unique', () => {
    const ids = NO_ASSET_REDISTRIBUTION_AUDIT.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('every audit entry carries one of the allowed subjects', () => {
    for (const entry of NO_ASSET_REDISTRIBUTION_AUDIT) {
      expect(ALLOWED_SUBJECTS.has(entry.subject)).toBe(true);
    }
  });

  test('every audit entry carries one of the allowed reference source files', () => {
    for (const entry of NO_ASSET_REDISTRIBUTION_AUDIT) {
      expect(ALLOWED_REFERENCE_FILES.has(entry.referenceSourceFile)).toBe(true);
    }
  });

  test('every audit entry carries a non-empty invariant', () => {
    for (const entry of NO_ASSET_REDISTRIBUTION_AUDIT) {
      expect(entry.invariant.length).toBeGreaterThan(0);
    }
  });

  test('the proprietary-filename-doom1-wad-forbidden axis cites the shareware target document', () => {
    const entry = NO_ASSET_REDISTRIBUTION_AUDIT.find((e) => e.id === 'proprietary-filename-doom1-wad-forbidden');
    expect(entry).toBeDefined();
    expect(entry!.subject).toBe('proprietary-asset-filename');
    expect(entry!.referenceSourceFile).toBe('plan_vanilla_parity/pin-shareware-doom-one-point-nine-primary-target.md');
    expect(entry!.invariant).toContain('DOOM1.WAD');
  });

  test('the proprietary-filename-doom-wad-forbidden axis cites the user-supplied IWAD scope document', () => {
    const entry = NO_ASSET_REDISTRIBUTION_AUDIT.find((e) => e.id === 'proprietary-filename-doom-wad-forbidden');
    expect(entry).toBeDefined();
    expect(entry!.subject).toBe('proprietary-asset-filename');
    expect(entry!.referenceSourceFile).toBe('plan_vanilla_parity/pin-user-supplied-registered-and-ultimate-iwad-scope.md');
  });

  test('the proprietary-filename-doomu-wad-forbidden axis pins the Ultimate alternate name', () => {
    const entry = NO_ASSET_REDISTRIBUTION_AUDIT.find((e) => e.id === 'proprietary-filename-doomu-wad-forbidden');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('doomu.wad');
  });

  test('every proprietary-filename axis pins the proprietary-asset-filename subject', () => {
    const filenameAxes: ReadonlyArray<NoAssetRedistributionAuditEntry['id']> = [
      'proprietary-filename-doom-exe-forbidden',
      'proprietary-filename-doom-wad-forbidden',
      'proprietary-filename-doom1-wad-forbidden',
      'proprietary-filename-doomd-exe-forbidden',
      'proprietary-filename-doomdupx-exe-forbidden',
      'proprietary-filename-doomu-wad-forbidden',
    ];
    for (const id of filenameAxes) {
      const entry = NO_ASSET_REDISTRIBUTION_AUDIT.find((e) => e.id === id);
      expect(entry).toBeDefined();
      expect(entry!.subject).toBe('proprietary-asset-filename');
    }
  });

  test('every proprietary-sha256 axis pins the proprietary-asset-sha256 subject and cites the file-hashes manifest', () => {
    const sha256Axes: ReadonlyArray<NoAssetRedistributionAuditEntry['id']> = ['proprietary-sha256-doom-exe-pinned', 'proprietary-sha256-doom1-wad-pinned', 'proprietary-sha256-doomd-exe-pinned', 'proprietary-sha256-doomdupx-exe-pinned'];
    for (const id of sha256Axes) {
      const entry = NO_ASSET_REDISTRIBUTION_AUDIT.find((e) => e.id === id);
      expect(entry).toBeDefined();
      expect(entry!.subject).toBe('proprietary-asset-sha256');
      expect(entry!.referenceSourceFile).toBe('reference/manifests/file-hashes.json');
    }
  });

  test('every permitted-with-notice axis pins the permitted-with-notice-asset subject and cites src/reference/policy.ts', () => {
    const permittedAxes: ReadonlyArray<NoAssetRedistributionAuditEntry['id']> = [
      'permitted-filename-doomwupx-exe-not-staged',
      'permitted-filename-chocolate-doom-cfg-not-staged',
      'permitted-filename-default-cfg-not-staged',
      'permitted-filename-smash-py-not-staged',
    ];
    for (const id of permittedAxes) {
      const entry = NO_ASSET_REDISTRIBUTION_AUDIT.find((e) => e.id === id);
      expect(entry).toBeDefined();
      expect(entry!.subject).toBe('permitted-with-notice-asset');
      expect(entry!.referenceSourceFile).toBe('src/reference/policy.ts');
    }
  });

  test('both user-supplied-drop-location axes cite .gitignore as their reference source', () => {
    const dropLocationAxes: ReadonlyArray<NoAssetRedistributionAuditEntry['id']> = ['user-supplied-drop-location-doom-gitignored', 'user-supplied-drop-location-iwad-gitignored'];
    for (const id of dropLocationAxes) {
      const entry = NO_ASSET_REDISTRIBUTION_AUDIT.find((e) => e.id === id);
      expect(entry).toBeDefined();
      expect(entry!.subject).toBe('user-supplied-drop-location');
      expect(entry!.referenceSourceFile).toBe('.gitignore');
    }
  });

  test('every license-category axis pins the license-category subject and cites src/reference/policy.ts', () => {
    const licenseAxes: ReadonlyArray<NoAssetRedistributionAuditEntry['id']> = [
      'license-category-commercial-shareware-forbidden',
      'license-category-mixed-polyglot-forbidden',
      'license-category-gpl-permitted-with-notice',
      'license-category-utility-permitted-with-notice',
    ];
    for (const id of licenseAxes) {
      const entry = NO_ASSET_REDISTRIBUTION_AUDIT.find((e) => e.id === id);
      expect(entry).toBeDefined();
      expect(entry!.subject).toBe('license-category');
      expect(entry!.referenceSourceFile).toBe('src/reference/policy.ts');
    }
  });

  test('every test-suite-redistribution-rule axis pins the test-suite-redistribution-rule subject and cites the boundary doc', () => {
    const testRuleAxes: ReadonlyArray<NoAssetRedistributionAuditEntry['id']> = [
      'tests-must-skip-when-proprietary-asset-absent',
      'tests-must-not-regenerate-proprietary-bytes',
      'tests-must-not-fabricate-proprietary-bytes',
      'tests-must-not-substitute-proprietary-bytes',
      'tests-must-not-stage-proprietary-bytes-for-commit',
      'tests-must-not-publish-proprietary-under-alternate-name',
      'tests-must-not-embed-proprietary-bytes-in-output',
      'tests-must-not-derive-binary-from-proprietary-bytes',
    ];
    for (const id of testRuleAxes) {
      const entry = NO_ASSET_REDISTRIBUTION_AUDIT.find((e) => e.id === id);
      expect(entry).toBeDefined();
      expect(entry!.subject).toBe('test-suite-redistribution-rule');
      expect(entry!.referenceSourceFile).toBe('plan_vanilla_parity/pin-proprietary-asset-non-redistribution-boundary.md');
    }
  });

  test('the reference-bundle-path-locks-doom-as-read-only-source axis pins the reference-bundle-root subject', () => {
    const entry = NO_ASSET_REDISTRIBUTION_AUDIT.find((e) => e.id === 'reference-bundle-path-locks-doom-as-read-only-source');
    expect(entry).toBeDefined();
    expect(entry!.subject).toBe('reference-bundle-root');
    expect(entry!.referenceSourceFile).toBe('src/reference/policy.ts');
  });
});

describe('No-asset-redistribution derived invariants ledger', () => {
  test('declares thirty-nine derived invariants', () => {
    expect(NO_ASSET_REDISTRIBUTION_DERIVED_INVARIANTS.length).toBe(39);
  });

  test('every derived invariant has a unique stable id', () => {
    const ids = NO_ASSET_REDISTRIBUTION_DERIVED_INVARIANTS.map((invariant) => invariant.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('declares every derived invariant the cross-check enforces', () => {
    const ids = new Set(NO_ASSET_REDISTRIBUTION_DERIVED_INVARIANTS.map((invariant) => invariant.id));
    expect(ids).toEqual(
      new Set([
        'PROHIBITED_FILENAMES_INCLUDE_DOOM_EXE',
        'PROHIBITED_FILENAMES_INCLUDE_DOOM_WAD',
        'PROHIBITED_FILENAMES_INCLUDE_DOOM1_WAD',
        'PROHIBITED_FILENAMES_INCLUDE_DOOMD_EXE',
        'PROHIBITED_FILENAMES_INCLUDE_DOOMDUPX_EXE',
        'PROHIBITED_FILENAMES_INCLUDE_DOOMU_WAD',
        'IS_PROPRIETARY_FILENAME_IS_CASE_INSENSITIVE',
        'IS_PROPRIETARY_FILENAME_REJECTS_UNRELATED_NAMES',
        'PROHIBITED_SHA256_INCLUDES_DOOM1_WAD_HASH',
        'PROHIBITED_SHA256_INCLUDES_DOOM_EXE_HASH',
        'PROHIBITED_SHA256_INCLUDES_DOOMD_EXE_HASH',
        'PROHIBITED_SHA256_INCLUDES_DOOMDUPX_EXE_HASH',
        'IS_PROPRIETARY_SHA256_IS_CASE_INSENSITIVE',
        'IS_PROPRIETARY_SHA256_REJECTS_UNRELATED_HASHES',
        'PERMITTED_WITH_NOTICE_FILENAMES_INCLUDE_DOOMWUPX_EXE',
        'PERMITTED_WITH_NOTICE_FILENAMES_INCLUDE_CHOCOLATE_DOOM_CFG',
        'PERMITTED_WITH_NOTICE_FILENAMES_INCLUDE_DEFAULT_CFG',
        'PERMITTED_WITH_NOTICE_FILENAMES_INCLUDE_SMASH_PY',
        'USER_SUPPLIED_DROP_LOCATIONS_INCLUDE_DOOM',
        'USER_SUPPLIED_DROP_LOCATIONS_INCLUDE_IWAD',
        'USER_SUPPLIED_DROP_LOCATIONS_AND_PROHIBITED_AND_PERMITTED_ARE_DISJOINT',
        'IS_INSIDE_USER_SUPPLIED_DROP_LOCATION_HANDLES_DOOM_PREFIX',
        'IS_INSIDE_USER_SUPPLIED_DROP_LOCATION_HANDLES_IWAD_PREFIX',
        'IS_INSIDE_USER_SUPPLIED_DROP_LOCATION_REJECTS_TEST_FIXTURES_PREFIX',
        'CLASSIFY_ASSET_RETURNS_FORBIDDEN_FOR_COMMERCIAL_SHAREWARE',
        'CLASSIFY_ASSET_RETURNS_FORBIDDEN_FOR_MIXED_POLYGLOT',
        'CLASSIFY_ASSET_RETURNS_PERMITTED_WITH_NOTICE_FOR_GPL',
        'CLASSIFY_ASSET_RETURNS_PERMITTED_WITH_NOTICE_FOR_UTILITY',
        'CLASSIFY_ASSET_RETURNS_NULL_FOR_UNKNOWN_FILENAME',
        'ASSERT_TEST_ARTIFACT_PATH_THROWS_ON_PROPRIETARY_FILENAME',
        'ASSERT_TEST_ARTIFACT_PATH_THROWS_ON_DROP_LOCATION_PATH',
        'ASSERT_TEST_ARTIFACT_PATH_DOES_NOT_THROW_FOR_REGULAR_FIXTURE',
        'ASSERT_TEST_PAYLOAD_HASH_THROWS_ON_PROPRIETARY_HASH',
        'ASSERT_TEST_PAYLOAD_HASH_DOES_NOT_THROW_FOR_BENIGN_HASH',
        'SHOULD_SKIP_TEST_WHEN_ASSET_ABSENT_RETURNS_TRUE_WHEN_PROPRIETARY_ABSENT',
        'SHOULD_SKIP_TEST_WHEN_ASSET_ABSENT_RETURNS_FALSE_WHEN_PROPRIETARY_PRESENT',
        'SHOULD_SKIP_TEST_WHEN_ASSET_ABSENT_RETURNS_FALSE_FOR_NON_PROPRIETARY_PATH',
        'PROPRIETARY_ASSET_REDISTRIBUTION_ERROR_CARRIES_REASON_AND_OFFENDING_VALUE',
        'EVERY_AUDIT_AXIS_IS_DECLARED',
      ]),
    );
  });

  test('every derived invariant has a non-empty description', () => {
    for (const invariant of NO_ASSET_REDISTRIBUTION_DERIVED_INVARIANTS) {
      expect(invariant.description.length).toBeGreaterThan(0);
    }
  });
});

describe('Prohibited filename, sha256, permitted, and drop-location catalogs', () => {
  test('PROHIBITED_PROPRIETARY_FILENAMES is frozen and asciibetically sorted', () => {
    expect(Object.isFrozen(PROHIBITED_PROPRIETARY_FILENAMES)).toBe(true);
    const sorted = [...PROHIBITED_PROPRIETARY_FILENAMES].sort();
    expect(PROHIBITED_PROPRIETARY_FILENAMES).toEqual(sorted);
  });

  test('PROHIBITED_PROPRIETARY_FILENAMES contains all six pinned proprietary basenames', () => {
    expect(PROHIBITED_PROPRIETARY_FILENAMES).toContain('DOOM.EXE');
    expect(PROHIBITED_PROPRIETARY_FILENAMES).toContain('DOOM.WAD');
    expect(PROHIBITED_PROPRIETARY_FILENAMES).toContain('DOOM1.WAD');
    expect(PROHIBITED_PROPRIETARY_FILENAMES).toContain('DOOMD.EXE');
    expect(PROHIBITED_PROPRIETARY_FILENAMES).toContain('DOOMDUPX.EXE');
    expect(PROHIBITED_PROPRIETARY_FILENAMES).toContain('doomu.wad');
  });

  test('PROHIBITED_PROPRIETARY_FILENAMES has exactly six entries (no surprise additions)', () => {
    expect(PROHIBITED_PROPRIETARY_FILENAMES.length).toBe(6);
  });

  test('PROHIBITED_PROPRIETARY_SHA256_HASHES is frozen and asciibetically sorted', () => {
    expect(Object.isFrozen(PROHIBITED_PROPRIETARY_SHA256_HASHES)).toBe(true);
    const sorted = [...PROHIBITED_PROPRIETARY_SHA256_HASHES].sort();
    expect(PROHIBITED_PROPRIETARY_SHA256_HASHES).toEqual(sorted);
  });

  test('PROHIBITED_PROPRIETARY_SHA256_HASHES contains all four pinned proprietary hashes', () => {
    expect(PROHIBITED_PROPRIETARY_SHA256_HASHES).toContain(DOOM_EXE_SHA256);
    expect(PROHIBITED_PROPRIETARY_SHA256_HASHES).toContain(DOOM1_WAD_SHA256);
    expect(PROHIBITED_PROPRIETARY_SHA256_HASHES).toContain(DOOMD_EXE_SHA256);
    expect(PROHIBITED_PROPRIETARY_SHA256_HASHES).toContain(DOOMDUPX_EXE_SHA256);
  });

  test('PROHIBITED_PROPRIETARY_SHA256_HASHES has exactly four entries', () => {
    expect(PROHIBITED_PROPRIETARY_SHA256_HASHES.length).toBe(4);
  });

  test('PROHIBITED_PROPRIETARY_SHA256_HASHES does not contain the GPL DOOMWUPX.exe hash (commercial vs gpl boundary)', () => {
    expect(PROHIBITED_PROPRIETARY_SHA256_HASHES).not.toContain(DOOMWUPX_EXE_SHA256);
  });

  test('PERMITTED_WITH_NOTICE_FILENAMES is frozen and asciibetically sorted', () => {
    expect(Object.isFrozen(PERMITTED_WITH_NOTICE_FILENAMES)).toBe(true);
    const sorted = [...PERMITTED_WITH_NOTICE_FILENAMES].sort();
    expect(PERMITTED_WITH_NOTICE_FILENAMES).toEqual(sorted);
  });

  test('PERMITTED_WITH_NOTICE_FILENAMES contains all four GPL/utility basenames', () => {
    expect(PERMITTED_WITH_NOTICE_FILENAMES).toContain('DOOMWUPX.exe');
    expect(PERMITTED_WITH_NOTICE_FILENAMES).toContain('chocolate-doom.cfg');
    expect(PERMITTED_WITH_NOTICE_FILENAMES).toContain('default.cfg');
    expect(PERMITTED_WITH_NOTICE_FILENAMES).toContain('smash.py');
  });

  test('PERMITTED_WITH_NOTICE_FILENAMES has exactly four entries', () => {
    expect(PERMITTED_WITH_NOTICE_FILENAMES.length).toBe(4);
  });

  test('USER_SUPPLIED_DROP_LOCATIONS is frozen and asciibetically sorted', () => {
    expect(Object.isFrozen(USER_SUPPLIED_DROP_LOCATIONS)).toBe(true);
    const sorted = [...USER_SUPPLIED_DROP_LOCATIONS].sort();
    expect(USER_SUPPLIED_DROP_LOCATIONS).toEqual(sorted);
  });

  test('USER_SUPPLIED_DROP_LOCATIONS contains exactly the two pinned drop directories', () => {
    expect(USER_SUPPLIED_DROP_LOCATIONS).toEqual(['doom', 'iwad']);
  });

  test('USER_SUPPLIED_PROPRIETARY_IWAD_BASENAMES contains the registered/Ultimate basenames', () => {
    expect(Object.isFrozen(USER_SUPPLIED_PROPRIETARY_IWAD_BASENAMES)).toBe(true);
    expect(USER_SUPPLIED_PROPRIETARY_IWAD_BASENAMES).toContain('DOOM.WAD');
    expect(USER_SUPPLIED_PROPRIETARY_IWAD_BASENAMES).toContain('doomu.wad');
  });

  test('the prohibited filename, permitted filename, and drop-location sets are pairwise disjoint', () => {
    const prohibited = new Set(PROHIBITED_PROPRIETARY_FILENAMES);
    const permitted = new Set(PERMITTED_WITH_NOTICE_FILENAMES);
    const dropLocations = new Set(USER_SUPPLIED_DROP_LOCATIONS);
    for (const name of prohibited) {
      expect(permitted.has(name)).toBe(false);
      expect(dropLocations.has(name)).toBe(false);
    }
    for (const name of permitted) {
      expect(dropLocations.has(name)).toBe(false);
    }
  });
});

describe('isProprietaryFilename runtime', () => {
  test('returns true for the literal recorded basenames', () => {
    for (const filename of PROHIBITED_PROPRIETARY_FILENAMES) {
      expect(isProprietaryFilename(filename)).toBe(true);
    }
  });

  test('returns true for an upper-cased query of a lower-cased recorded basename (doomu.wad)', () => {
    expect(isProprietaryFilename('DOOMU.WAD')).toBe(true);
  });

  test('returns true for a lower-cased query of an upper-cased recorded basename (DOOM1.WAD)', () => {
    expect(isProprietaryFilename('doom1.wad')).toBe(true);
  });

  test('returns true for a mixed-case query of an upper-cased recorded basename', () => {
    expect(isProprietaryFilename('Doom1.Wad')).toBe(true);
  });

  test('returns false for unrelated basenames (README, source files, lump names)', () => {
    expect(isProprietaryFilename('README.md')).toBe(false);
    expect(isProprietaryFilename('STBAR.LMP')).toBe(false);
    expect(isProprietaryFilename('PLAYPAL')).toBe(false);
    expect(isProprietaryFilename('audio.wav')).toBe(false);
  });

  test('returns false for the empty string', () => {
    expect(isProprietaryFilename('')).toBe(false);
  });

  test('returns false for partial matches that are not exact basenames', () => {
    expect(isProprietaryFilename('DOOM')).toBe(false);
    expect(isProprietaryFilename('DOOM1')).toBe(false);
    expect(isProprietaryFilename('DOOM1.WADX')).toBe(false);
  });
});

describe('isProprietarySha256 runtime', () => {
  test('returns true for each pinned proprietary hash', () => {
    expect(isProprietarySha256(DOOM_EXE_SHA256)).toBe(true);
    expect(isProprietarySha256(DOOM1_WAD_SHA256)).toBe(true);
    expect(isProprietarySha256(DOOMD_EXE_SHA256)).toBe(true);
    expect(isProprietarySha256(DOOMDUPX_EXE_SHA256)).toBe(true);
  });

  test('returns true for a lower-cased query of an upper-cased pinned hash', () => {
    expect(isProprietarySha256(DOOM1_WAD_SHA256.toLowerCase())).toBe(true);
  });

  test('returns false for an unrelated SHA-256 (zero hash)', () => {
    expect(isProprietarySha256(BENIGN_ZERO_SHA256)).toBe(false);
  });

  test('returns false for the GPL DOOMWUPX.exe hash (commercial vs gpl boundary)', () => {
    expect(isProprietarySha256(DOOMWUPX_EXE_SHA256)).toBe(false);
  });

  test('returns false for the empty string', () => {
    expect(isProprietarySha256('')).toBe(false);
  });
});

describe('isPermittedWithNoticeFilename runtime', () => {
  test('returns true for the literal recorded basenames (case-sensitive on the upstream casing)', () => {
    for (const filename of PERMITTED_WITH_NOTICE_FILENAMES) {
      expect(isPermittedWithNoticeFilename(filename)).toBe(true);
    }
  });

  test('returns false for proprietary basenames (the two sets are disjoint)', () => {
    for (const filename of PROHIBITED_PROPRIETARY_FILENAMES) {
      expect(isPermittedWithNoticeFilename(filename)).toBe(false);
    }
  });

  test('returns false for unrelated basenames', () => {
    expect(isPermittedWithNoticeFilename('README.md')).toBe(false);
  });
});

describe('isInsideUserSuppliedDropLocation runtime', () => {
  test('returns true for paths under doom/ (forward slash)', () => {
    expect(isInsideUserSuppliedDropLocation('doom/DOOM1.WAD')).toBe(true);
    expect(isInsideUserSuppliedDropLocation('doom/DOOM.EXE')).toBe(true);
    expect(isInsideUserSuppliedDropLocation('doom/sub/nested.txt')).toBe(true);
  });

  test('returns true for paths under doom\\ (Windows backslash)', () => {
    expect(isInsideUserSuppliedDropLocation('doom\\DOOM1.WAD')).toBe(true);
  });

  test('returns true for paths under iwad/ (forward slash)', () => {
    expect(isInsideUserSuppliedDropLocation('iwad/DOOM.WAD')).toBe(true);
    expect(isInsideUserSuppliedDropLocation('iwad/DOOM1.WAD')).toBe(true);
  });

  test('returns true for paths under iwad\\ (Windows backslash)', () => {
    expect(isInsideUserSuppliedDropLocation('iwad\\DOOM.WAD')).toBe(true);
  });

  test('returns true for the bare directory name itself', () => {
    expect(isInsideUserSuppliedDropLocation('doom')).toBe(true);
    expect(isInsideUserSuppliedDropLocation('iwad')).toBe(true);
  });

  test('matches the directory name case-insensitively', () => {
    expect(isInsideUserSuppliedDropLocation('DOOM/DOOM1.WAD')).toBe(true);
    expect(isInsideUserSuppliedDropLocation('Iwad/DOOM.WAD')).toBe(true);
  });

  test('returns false for paths not under one of the drop directories', () => {
    expect(isInsideUserSuppliedDropLocation('test/oracles/fixtures/probe.json')).toBe(false);
    expect(isInsideUserSuppliedDropLocation('src/assets/parse-pnames-lump.ts')).toBe(false);
    expect(isInsideUserSuppliedDropLocation('reference/manifests/file-hashes.json')).toBe(false);
  });

  test('returns false for paths whose first component merely starts with one of the drop directory names', () => {
    expect(isInsideUserSuppliedDropLocation('doom-codex/file.ts')).toBe(false);
    expect(isInsideUserSuppliedDropLocation('iwad-extra/something.bin')).toBe(false);
  });

  test('returns false for the empty string', () => {
    expect(isInsideUserSuppliedDropLocation('')).toBe(false);
  });
});

describe('classifyAssetForRedistribution runtime', () => {
  test('returns "forbidden" for every commercial-shareware asset filename', () => {
    expect(classifyAssetForRedistribution('DOOM1.WAD')).toBe('forbidden');
    expect(classifyAssetForRedistribution('DOOMD.EXE')).toBe('forbidden');
    expect(classifyAssetForRedistribution('DOOMDUPX.EXE')).toBe('forbidden');
  });

  test('returns "forbidden" for the mixed polyglot DOOM.EXE', () => {
    expect(classifyAssetForRedistribution('DOOM.EXE')).toBe('forbidden');
  });

  test('returns "permitted-with-notice" for every GPL bundle file', () => {
    expect(classifyAssetForRedistribution('DOOMWUPX.exe')).toBe('permitted-with-notice');
    expect(classifyAssetForRedistribution('chocolate-doom.cfg')).toBe('permitted-with-notice');
    expect(classifyAssetForRedistribution('default.cfg')).toBe('permitted-with-notice');
  });

  test('returns "permitted-with-notice" for the smash.py utility', () => {
    expect(classifyAssetForRedistribution('smash.py')).toBe('permitted-with-notice');
  });

  test('returns null for unknown filenames not catalogued in ASSET_BOUNDARIES', () => {
    expect(classifyAssetForRedistribution('README.md')).toBe(null);
    expect(classifyAssetForRedistribution('package.json')).toBe(null);
    expect(classifyAssetForRedistribution('')).toBe(null);
  });

  test('does NOT classify the user-supplied registered or Ultimate IWAD by name (no canonical hash bundled)', () => {
    expect(classifyAssetForRedistribution('DOOM.WAD')).toBe(null);
    expect(classifyAssetForRedistribution('doomu.wad')).toBe(null);
  });
});

describe('assertTestArtifactPathIsNotProprietary runtime', () => {
  test('does not throw for a regular oracle fixture path', () => {
    expect(() => assertTestArtifactPathIsNotProprietary('test/oracles/fixtures/probe.json')).not.toThrow();
  });

  test('does not throw for a src module path', () => {
    expect(() => assertTestArtifactPathIsNotProprietary('src/assets/parse-pnames-lump.ts')).not.toThrow();
  });

  test('throws ProprietaryAssetRedistributionError for a path whose basename matches DOOM1.WAD', () => {
    expect(() => assertTestArtifactPathIsNotProprietary('test/oracles/fixtures/DOOM1.WAD')).toThrow(ProprietaryAssetRedistributionError);
  });

  test('throws ProprietaryAssetRedistributionError for a path whose basename matches DOOM.EXE (case-insensitive)', () => {
    expect(() => assertTestArtifactPathIsNotProprietary('test/oracles/fixtures/doom.exe')).toThrow(ProprietaryAssetRedistributionError);
  });

  test('throws ProprietaryAssetRedistributionError for a path inside doom/', () => {
    expect(() => assertTestArtifactPathIsNotProprietary('doom/anything.bin')).toThrow(ProprietaryAssetRedistributionError);
  });

  test('throws ProprietaryAssetRedistributionError for a path inside iwad/', () => {
    expect(() => assertTestArtifactPathIsNotProprietary('iwad/anything.bin')).toThrow(ProprietaryAssetRedistributionError);
  });

  test('error carries reason === "path" and the offending value', () => {
    try {
      assertTestArtifactPathIsNotProprietary('doom/anything.bin');
      throw new Error('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(ProprietaryAssetRedistributionError);
      expect((e as ProprietaryAssetRedistributionError).reason).toBe('path');
      expect((e as ProprietaryAssetRedistributionError).offendingValue).toBe('doom/anything.bin');
    }
  });

  test('error message identifies the basename when the rejection is filename-based', () => {
    try {
      assertTestArtifactPathIsNotProprietary('test/oracles/fixtures/DOOM1.WAD');
      throw new Error('expected throw');
    } catch (e) {
      expect((e as Error).message).toContain('DOOM1.WAD');
    }
  });

  test('error message identifies the drop locations when the rejection is location-based', () => {
    try {
      assertTestArtifactPathIsNotProprietary('doom/anything.bin');
      throw new Error('expected throw');
    } catch (e) {
      const message = (e as Error).message;
      for (const dropLocation of USER_SUPPLIED_DROP_LOCATIONS) {
        expect(message).toContain(dropLocation);
      }
    }
  });

  test('throws for every proprietary basename when placed under a non-drop-location prefix', () => {
    for (const filename of PROHIBITED_PROPRIETARY_FILENAMES) {
      expect(() => assertTestArtifactPathIsNotProprietary(`tmp/redistributed/${filename}`)).toThrow(ProprietaryAssetRedistributionError);
    }
  });
});

describe('assertTestPayloadHashIsNotProprietary runtime', () => {
  test('does not throw for the benign zero hash', () => {
    expect(() => assertTestPayloadHashIsNotProprietary(BENIGN_ZERO_SHA256)).not.toThrow();
  });

  test('does not throw for the GPL DOOMWUPX.exe hash (not in the proprietary set)', () => {
    expect(() => assertTestPayloadHashIsNotProprietary(DOOMWUPX_EXE_SHA256)).not.toThrow();
  });

  test('throws ProprietaryAssetRedistributionError for the DOOM1.WAD hash', () => {
    expect(() => assertTestPayloadHashIsNotProprietary(DOOM1_WAD_SHA256)).toThrow(ProprietaryAssetRedistributionError);
  });

  test('throws ProprietaryAssetRedistributionError for the DOOM.EXE hash', () => {
    expect(() => assertTestPayloadHashIsNotProprietary(DOOM_EXE_SHA256)).toThrow(ProprietaryAssetRedistributionError);
  });

  test('throws ProprietaryAssetRedistributionError for the DOOMD.EXE hash', () => {
    expect(() => assertTestPayloadHashIsNotProprietary(DOOMD_EXE_SHA256)).toThrow(ProprietaryAssetRedistributionError);
  });

  test('throws ProprietaryAssetRedistributionError for the DOOMDUPX.EXE hash', () => {
    expect(() => assertTestPayloadHashIsNotProprietary(DOOMDUPX_EXE_SHA256)).toThrow(ProprietaryAssetRedistributionError);
  });

  test('throws ProprietaryAssetRedistributionError for a lower-cased query of a pinned proprietary hash', () => {
    expect(() => assertTestPayloadHashIsNotProprietary(DOOM1_WAD_SHA256.toLowerCase())).toThrow(ProprietaryAssetRedistributionError);
  });

  test('error carries reason === "hash" and the offending hash', () => {
    try {
      assertTestPayloadHashIsNotProprietary(DOOM1_WAD_SHA256);
      throw new Error('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(ProprietaryAssetRedistributionError);
      expect((e as ProprietaryAssetRedistributionError).reason).toBe('hash');
      expect((e as ProprietaryAssetRedistributionError).offendingValue).toBe(DOOM1_WAD_SHA256);
    }
  });

  test('error message includes the rejected hash', () => {
    try {
      assertTestPayloadHashIsNotProprietary(DOOM1_WAD_SHA256);
      throw new Error('expected throw');
    } catch (e) {
      expect((e as Error).message).toContain(DOOM1_WAD_SHA256);
    }
  });
});

describe('shouldSkipTestWhenAssetAbsent runtime', () => {
  test('returns true when DOOM1.WAD is absent from doom/', () => {
    expect(shouldSkipTestWhenAssetAbsent('doom/DOOM1.WAD', false)).toBe(true);
  });

  test('returns true when DOOM.WAD is absent from iwad/', () => {
    expect(shouldSkipTestWhenAssetAbsent('iwad/DOOM.WAD', false)).toBe(true);
  });

  test('returns true when an Ultimate doomu.wad is absent', () => {
    expect(shouldSkipTestWhenAssetAbsent('doom/doomu.wad', false)).toBe(true);
  });

  test('returns false when the proprietary asset is present', () => {
    expect(shouldSkipTestWhenAssetAbsent('doom/DOOM1.WAD', true)).toBe(false);
    expect(shouldSkipTestWhenAssetAbsent('iwad/DOOM.WAD', true)).toBe(false);
  });

  test('returns true when an arbitrary asset under a drop location is absent', () => {
    expect(shouldSkipTestWhenAssetAbsent('doom/anything.bin', false)).toBe(true);
  });

  test('returns false when a non-proprietary fixture is absent (the boundary does not gate non-proprietary tests)', () => {
    expect(shouldSkipTestWhenAssetAbsent('test/oracles/fixtures/probe.json', false)).toBe(false);
  });

  test('returns false for an unrelated path even when the asset is missing', () => {
    expect(shouldSkipTestWhenAssetAbsent('src/assets/parse-pnames-lump.ts', false)).toBe(false);
  });
});

describe('ProprietaryAssetRedistributionError shape', () => {
  test('extends Error and exposes message, reason, offendingValue, and name', () => {
    const error = new ProprietaryAssetRedistributionError('hash', DOOM1_WAD_SHA256, 'sample message');
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('sample message');
    expect(error.reason).toBe('hash');
    expect(error.offendingValue).toBe(DOOM1_WAD_SHA256);
    expect(error.name).toBe('ProprietaryAssetRedistributionError');
  });

  test('supports the path reason discriminant', () => {
    const error = new ProprietaryAssetRedistributionError('path', 'doom/DOOM1.WAD', 'sample message');
    expect(error.reason).toBe('path');
    expect(error.offendingValue).toBe('doom/DOOM1.WAD');
  });
});

describe('crossCheckNoAssetRedistributionRuntime', () => {
  test('reports zero failures for the live runtime snapshot', () => {
    expect(crossCheckNoAssetRedistributionRuntime(liveRuntimeSnapshot)).toEqual([]);
  });

  test('detects a missing DOOM.EXE entry in PROHIBITED_PROPRIETARY_FILENAMES', () => {
    const tampered: NoAssetRedistributionRuntimeSnapshot = { ...liveRuntimeSnapshot, prohibitedFilenamesIncludeDoomExe: false };
    const failures = crossCheckNoAssetRedistributionRuntime(tampered);
    expect(failures).toContain('derived:PROHIBITED_FILENAMES_INCLUDE_DOOM_EXE');
    expect(failures).toContain('audit:proprietary-filename-doom-exe-forbidden:not-observed');
  });

  test('detects a missing DOOM1.WAD entry in PROHIBITED_PROPRIETARY_FILENAMES', () => {
    const tampered: NoAssetRedistributionRuntimeSnapshot = { ...liveRuntimeSnapshot, prohibitedFilenamesIncludeDoom1Wad: false };
    const failures = crossCheckNoAssetRedistributionRuntime(tampered);
    expect(failures).toContain('derived:PROHIBITED_FILENAMES_INCLUDE_DOOM1_WAD');
    expect(failures).toContain('audit:proprietary-filename-doom1-wad-forbidden:not-observed');
  });

  test('detects a missing doomu.wad entry in PROHIBITED_PROPRIETARY_FILENAMES', () => {
    const tampered: NoAssetRedistributionRuntimeSnapshot = { ...liveRuntimeSnapshot, prohibitedFilenamesIncludeDoomuWad: false };
    const failures = crossCheckNoAssetRedistributionRuntime(tampered);
    expect(failures).toContain('derived:PROHIBITED_FILENAMES_INCLUDE_DOOMU_WAD');
    expect(failures).toContain('audit:proprietary-filename-doomu-wad-forbidden:not-observed');
  });

  test('detects an isProprietaryFilename that is not case-insensitive', () => {
    const tampered: NoAssetRedistributionRuntimeSnapshot = { ...liveRuntimeSnapshot, isProprietaryFilenameIsCaseInsensitive: false };
    const failures = crossCheckNoAssetRedistributionRuntime(tampered);
    expect(failures).toContain('derived:IS_PROPRIETARY_FILENAME_IS_CASE_INSENSITIVE');
  });

  test('detects an isProprietaryFilename that returns true for unrelated names', () => {
    const tampered: NoAssetRedistributionRuntimeSnapshot = { ...liveRuntimeSnapshot, isProprietaryFilenameRejectsUnrelatedNames: false };
    const failures = crossCheckNoAssetRedistributionRuntime(tampered);
    expect(failures).toContain('derived:IS_PROPRIETARY_FILENAME_REJECTS_UNRELATED_NAMES');
  });

  test('detects a missing DOOM1.WAD SHA-256 in PROHIBITED_PROPRIETARY_SHA256_HASHES', () => {
    const tampered: NoAssetRedistributionRuntimeSnapshot = { ...liveRuntimeSnapshot, prohibitedSha256IncludesDoom1WadHash: false };
    const failures = crossCheckNoAssetRedistributionRuntime(tampered);
    expect(failures).toContain('derived:PROHIBITED_SHA256_INCLUDES_DOOM1_WAD_HASH');
    expect(failures).toContain('audit:proprietary-sha256-doom1-wad-pinned:not-observed');
  });

  test('detects a missing DOOM.EXE SHA-256', () => {
    const tampered: NoAssetRedistributionRuntimeSnapshot = { ...liveRuntimeSnapshot, prohibitedSha256IncludesDoomExeHash: false };
    const failures = crossCheckNoAssetRedistributionRuntime(tampered);
    expect(failures).toContain('derived:PROHIBITED_SHA256_INCLUDES_DOOM_EXE_HASH');
  });

  test('detects a missing DOOMD.EXE SHA-256', () => {
    const tampered: NoAssetRedistributionRuntimeSnapshot = { ...liveRuntimeSnapshot, prohibitedSha256IncludesDoomdExeHash: false };
    const failures = crossCheckNoAssetRedistributionRuntime(tampered);
    expect(failures).toContain('derived:PROHIBITED_SHA256_INCLUDES_DOOMD_EXE_HASH');
  });

  test('detects a missing DOOMDUPX.EXE SHA-256', () => {
    const tampered: NoAssetRedistributionRuntimeSnapshot = { ...liveRuntimeSnapshot, prohibitedSha256IncludesDoomdupxExeHash: false };
    const failures = crossCheckNoAssetRedistributionRuntime(tampered);
    expect(failures).toContain('derived:PROHIBITED_SHA256_INCLUDES_DOOMDUPX_EXE_HASH');
  });

  test('detects an isProprietarySha256 that is not case-insensitive', () => {
    const tampered: NoAssetRedistributionRuntimeSnapshot = { ...liveRuntimeSnapshot, isProprietarySha256IsCaseInsensitive: false };
    const failures = crossCheckNoAssetRedistributionRuntime(tampered);
    expect(failures).toContain('derived:IS_PROPRIETARY_SHA256_IS_CASE_INSENSITIVE');
  });

  test('detects an isProprietarySha256 that accepts unrelated hashes', () => {
    const tampered: NoAssetRedistributionRuntimeSnapshot = { ...liveRuntimeSnapshot, isProprietarySha256RejectsUnrelatedHashes: false };
    const failures = crossCheckNoAssetRedistributionRuntime(tampered);
    expect(failures).toContain('derived:IS_PROPRIETARY_SHA256_REJECTS_UNRELATED_HASHES');
  });

  test('detects a missing DOOMWUPX.exe in PERMITTED_WITH_NOTICE_FILENAMES', () => {
    const tampered: NoAssetRedistributionRuntimeSnapshot = { ...liveRuntimeSnapshot, permittedWithNoticeIncludesDoomwupxExe: false };
    const failures = crossCheckNoAssetRedistributionRuntime(tampered);
    expect(failures).toContain('derived:PERMITTED_WITH_NOTICE_FILENAMES_INCLUDE_DOOMWUPX_EXE');
  });

  test('detects a missing chocolate-doom.cfg in PERMITTED_WITH_NOTICE_FILENAMES', () => {
    const tampered: NoAssetRedistributionRuntimeSnapshot = { ...liveRuntimeSnapshot, permittedWithNoticeIncludesChocolateDoomCfg: false };
    const failures = crossCheckNoAssetRedistributionRuntime(tampered);
    expect(failures).toContain('derived:PERMITTED_WITH_NOTICE_FILENAMES_INCLUDE_CHOCOLATE_DOOM_CFG');
  });

  test('detects a missing default.cfg in PERMITTED_WITH_NOTICE_FILENAMES', () => {
    const tampered: NoAssetRedistributionRuntimeSnapshot = { ...liveRuntimeSnapshot, permittedWithNoticeIncludesDefaultCfg: false };
    const failures = crossCheckNoAssetRedistributionRuntime(tampered);
    expect(failures).toContain('derived:PERMITTED_WITH_NOTICE_FILENAMES_INCLUDE_DEFAULT_CFG');
  });

  test('detects a missing smash.py in PERMITTED_WITH_NOTICE_FILENAMES', () => {
    const tampered: NoAssetRedistributionRuntimeSnapshot = { ...liveRuntimeSnapshot, permittedWithNoticeIncludesSmashPy: false };
    const failures = crossCheckNoAssetRedistributionRuntime(tampered);
    expect(failures).toContain('derived:PERMITTED_WITH_NOTICE_FILENAMES_INCLUDE_SMASH_PY');
  });

  test('detects a missing doom in USER_SUPPLIED_DROP_LOCATIONS', () => {
    const tampered: NoAssetRedistributionRuntimeSnapshot = { ...liveRuntimeSnapshot, userSuppliedDropLocationsIncludeDoom: false };
    const failures = crossCheckNoAssetRedistributionRuntime(tampered);
    expect(failures).toContain('derived:USER_SUPPLIED_DROP_LOCATIONS_INCLUDE_DOOM');
  });

  test('detects a missing iwad in USER_SUPPLIED_DROP_LOCATIONS', () => {
    const tampered: NoAssetRedistributionRuntimeSnapshot = { ...liveRuntimeSnapshot, userSuppliedDropLocationsIncludeIwad: false };
    const failures = crossCheckNoAssetRedistributionRuntime(tampered);
    expect(failures).toContain('derived:USER_SUPPLIED_DROP_LOCATIONS_INCLUDE_IWAD');
  });

  test('detects a non-disjoint set membership in the three catalogs', () => {
    const tampered: NoAssetRedistributionRuntimeSnapshot = { ...liveRuntimeSnapshot, userSuppliedAndProhibitedAndPermittedAreDisjoint: false };
    const failures = crossCheckNoAssetRedistributionRuntime(tampered);
    expect(failures).toContain('derived:USER_SUPPLIED_DROP_LOCATIONS_AND_PROHIBITED_AND_PERMITTED_ARE_DISJOINT');
  });

  test('detects an isInsideUserSuppliedDropLocation that fails to match the doom/ prefix', () => {
    const tampered: NoAssetRedistributionRuntimeSnapshot = { ...liveRuntimeSnapshot, isInsideUserSuppliedDropLocationHandlesDoomPrefix: false };
    const failures = crossCheckNoAssetRedistributionRuntime(tampered);
    expect(failures).toContain('derived:IS_INSIDE_USER_SUPPLIED_DROP_LOCATION_HANDLES_DOOM_PREFIX');
  });

  test('detects an isInsideUserSuppliedDropLocation that fails to match the iwad/ prefix', () => {
    const tampered: NoAssetRedistributionRuntimeSnapshot = { ...liveRuntimeSnapshot, isInsideUserSuppliedDropLocationHandlesIwadPrefix: false };
    const failures = crossCheckNoAssetRedistributionRuntime(tampered);
    expect(failures).toContain('derived:IS_INSIDE_USER_SUPPLIED_DROP_LOCATION_HANDLES_IWAD_PREFIX');
  });

  test('detects an isInsideUserSuppliedDropLocation that incorrectly accepts the test/oracles prefix', () => {
    const tampered: NoAssetRedistributionRuntimeSnapshot = { ...liveRuntimeSnapshot, isInsideUserSuppliedDropLocationRejectsTestFixturesPrefix: false };
    const failures = crossCheckNoAssetRedistributionRuntime(tampered);
    expect(failures).toContain('derived:IS_INSIDE_USER_SUPPLIED_DROP_LOCATION_REJECTS_TEST_FIXTURES_PREFIX');
  });

  test('detects a classifyAsset that fails to return forbidden for commercial-shareware', () => {
    const tampered: NoAssetRedistributionRuntimeSnapshot = { ...liveRuntimeSnapshot, classifyAssetReturnsForbiddenForCommercialShareware: false };
    const failures = crossCheckNoAssetRedistributionRuntime(tampered);
    expect(failures).toContain('derived:CLASSIFY_ASSET_RETURNS_FORBIDDEN_FOR_COMMERCIAL_SHAREWARE');
  });

  test('detects a classifyAsset that fails to return forbidden for the mixed polyglot', () => {
    const tampered: NoAssetRedistributionRuntimeSnapshot = { ...liveRuntimeSnapshot, classifyAssetReturnsForbiddenForMixedPolyglot: false };
    const failures = crossCheckNoAssetRedistributionRuntime(tampered);
    expect(failures).toContain('derived:CLASSIFY_ASSET_RETURNS_FORBIDDEN_FOR_MIXED_POLYGLOT');
  });

  test('detects a classifyAsset that fails to return permitted-with-notice for GPL files', () => {
    const tampered: NoAssetRedistributionRuntimeSnapshot = { ...liveRuntimeSnapshot, classifyAssetReturnsPermittedWithNoticeForGpl: false };
    const failures = crossCheckNoAssetRedistributionRuntime(tampered);
    expect(failures).toContain('derived:CLASSIFY_ASSET_RETURNS_PERMITTED_WITH_NOTICE_FOR_GPL');
  });

  test('detects a classifyAsset that fails to return permitted-with-notice for utility', () => {
    const tampered: NoAssetRedistributionRuntimeSnapshot = { ...liveRuntimeSnapshot, classifyAssetReturnsPermittedWithNoticeForUtility: false };
    const failures = crossCheckNoAssetRedistributionRuntime(tampered);
    expect(failures).toContain('derived:CLASSIFY_ASSET_RETURNS_PERMITTED_WITH_NOTICE_FOR_UTILITY');
  });

  test('detects a classifyAsset that fails to return null for unknown filenames', () => {
    const tampered: NoAssetRedistributionRuntimeSnapshot = { ...liveRuntimeSnapshot, classifyAssetReturnsNullForUnknownFilename: false };
    const failures = crossCheckNoAssetRedistributionRuntime(tampered);
    expect(failures).toContain('derived:CLASSIFY_ASSET_RETURNS_NULL_FOR_UNKNOWN_FILENAME');
  });

  test('detects an assertTestArtifactPath that does not throw for a proprietary filename', () => {
    const tampered: NoAssetRedistributionRuntimeSnapshot = { ...liveRuntimeSnapshot, assertTestArtifactPathThrowsOnProprietaryFilename: false };
    const failures = crossCheckNoAssetRedistributionRuntime(tampered);
    expect(failures).toContain('derived:ASSERT_TEST_ARTIFACT_PATH_THROWS_ON_PROPRIETARY_FILENAME');
    expect(failures).toContain('audit:tests-must-not-stage-proprietary-bytes-for-commit:not-observed');
    expect(failures).toContain('audit:tests-must-not-publish-proprietary-under-alternate-name:not-observed');
  });

  test('detects an assertTestArtifactPath that does not throw for a drop-location path', () => {
    const tampered: NoAssetRedistributionRuntimeSnapshot = { ...liveRuntimeSnapshot, assertTestArtifactPathThrowsOnDropLocationPath: false };
    const failures = crossCheckNoAssetRedistributionRuntime(tampered);
    expect(failures).toContain('derived:ASSERT_TEST_ARTIFACT_PATH_THROWS_ON_DROP_LOCATION_PATH');
  });

  test('detects an assertTestArtifactPath that wrongly throws for a regular fixture path', () => {
    const tampered: NoAssetRedistributionRuntimeSnapshot = { ...liveRuntimeSnapshot, assertTestArtifactPathDoesNotThrowForRegularFixture: false };
    const failures = crossCheckNoAssetRedistributionRuntime(tampered);
    expect(failures).toContain('derived:ASSERT_TEST_ARTIFACT_PATH_DOES_NOT_THROW_FOR_REGULAR_FIXTURE');
  });

  test('detects an assertTestPayloadHash that does not throw for a proprietary hash', () => {
    const tampered: NoAssetRedistributionRuntimeSnapshot = { ...liveRuntimeSnapshot, assertTestPayloadHashThrowsOnProprietaryHash: false };
    const failures = crossCheckNoAssetRedistributionRuntime(tampered);
    expect(failures).toContain('derived:ASSERT_TEST_PAYLOAD_HASH_THROWS_ON_PROPRIETARY_HASH');
    expect(failures).toContain('audit:tests-must-not-regenerate-proprietary-bytes:not-observed');
    expect(failures).toContain('audit:tests-must-not-fabricate-proprietary-bytes:not-observed');
    expect(failures).toContain('audit:tests-must-not-substitute-proprietary-bytes:not-observed');
    expect(failures).toContain('audit:tests-must-not-embed-proprietary-bytes-in-output:not-observed');
    expect(failures).toContain('audit:tests-must-not-derive-binary-from-proprietary-bytes:not-observed');
  });

  test('detects an assertTestPayloadHash that wrongly throws for a benign hash', () => {
    const tampered: NoAssetRedistributionRuntimeSnapshot = { ...liveRuntimeSnapshot, assertTestPayloadHashDoesNotThrowForBenignHash: false };
    const failures = crossCheckNoAssetRedistributionRuntime(tampered);
    expect(failures).toContain('derived:ASSERT_TEST_PAYLOAD_HASH_DOES_NOT_THROW_FOR_BENIGN_HASH');
  });

  test('detects a shouldSkip that fails to return true when proprietary asset is absent', () => {
    const tampered: NoAssetRedistributionRuntimeSnapshot = { ...liveRuntimeSnapshot, shouldSkipTestWhenAssetAbsentReturnsTrueWhenProprietaryAbsent: false };
    const failures = crossCheckNoAssetRedistributionRuntime(tampered);
    expect(failures).toContain('derived:SHOULD_SKIP_TEST_WHEN_ASSET_ABSENT_RETURNS_TRUE_WHEN_PROPRIETARY_ABSENT');
    expect(failures).toContain('audit:tests-must-skip-when-proprietary-asset-absent:not-observed');
  });

  test('detects a shouldSkip that wrongly returns true when proprietary asset is present', () => {
    const tampered: NoAssetRedistributionRuntimeSnapshot = { ...liveRuntimeSnapshot, shouldSkipTestWhenAssetAbsentReturnsFalseWhenProprietaryPresent: false };
    const failures = crossCheckNoAssetRedistributionRuntime(tampered);
    expect(failures).toContain('derived:SHOULD_SKIP_TEST_WHEN_ASSET_ABSENT_RETURNS_FALSE_WHEN_PROPRIETARY_PRESENT');
  });

  test('detects a shouldSkip that wrongly returns true for a non-proprietary path', () => {
    const tampered: NoAssetRedistributionRuntimeSnapshot = { ...liveRuntimeSnapshot, shouldSkipTestWhenAssetAbsentReturnsFalseForNonProprietaryPath: false };
    const failures = crossCheckNoAssetRedistributionRuntime(tampered);
    expect(failures).toContain('derived:SHOULD_SKIP_TEST_WHEN_ASSET_ABSENT_RETURNS_FALSE_FOR_NON_PROPRIETARY_PATH');
  });

  test('detects a ProprietaryAssetRedistributionError that fails to carry reason and offendingValue', () => {
    const tampered: NoAssetRedistributionRuntimeSnapshot = { ...liveRuntimeSnapshot, proprietaryAssetRedistributionErrorCarriesReasonAndOffendingValue: false };
    const failures = crossCheckNoAssetRedistributionRuntime(tampered);
    expect(failures).toContain('derived:PROPRIETARY_ASSET_REDISTRIBUTION_ERROR_CARRIES_REASON_AND_OFFENDING_VALUE');
  });
});
