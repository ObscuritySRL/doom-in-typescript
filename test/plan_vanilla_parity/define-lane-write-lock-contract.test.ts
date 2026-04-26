import { describe, expect, test } from 'bun:test';

import { existsSync, statSync } from 'node:fs';

const AGENTS_PATH = 'AGENTS.md';
const CLAUDE_PATH = 'CLAUDE.md';
const LANE_LOCK_SOURCE_PATH = 'plan_vanilla_parity/lane-lock.ts';
const LANE_LOCK_TEST_PATH = 'plan_vanilla_parity/lane-lock.test.ts';
const MASTER_CHECKLIST_PATH = 'plan_vanilla_parity/MASTER_CHECKLIST.md';
const PARALLEL_WORK_PATH = 'plan_vanilla_parity/PARALLEL_WORK.md';
const PIN_DOCUMENT_PATH = 'plan_vanilla_parity/define-lane-write-lock-contract.md';
const PLAN_PROMPT_PATH = 'plan_vanilla_parity/PROMPT.md';
const PLAN_README_PATH = 'plan_vanilla_parity/README.md';
const STEP_FILE_PATH = 'plan_vanilla_parity/steps/00-009-define-lane-write-lock-contract.md';
const VALIDATE_PLAN_PATH = 'plan_vanilla_parity/validate-plan.ts';
const VALIDATE_PLAN_TEST_PATH = 'plan_vanilla_parity/validate-plan.test.ts';

const CANONICAL_LANE_SLUG_PATTERN = '^[a-z][a-z0-9-]*$';

const CANONICAL_LANE_SLUGS: readonly string[] = ['acceptance', 'ai', 'audio', 'core', 'gameplay', 'governance', 'inventory', 'launch', 'map', 'oracle', 'render', 'save', 'ui', 'wad'];

const CANONICAL_IMMEDIATE_LANE_ROOTS: readonly string[] = ['governance', 'inventory', 'oracle', 'launch', 'core', 'wad'];

const CANONICAL_LANE_READ_ONLY_ROOTS: readonly string[] = ['doom/', 'iwad/', 'reference/'];

const CANONICAL_FORBIDDEN_WRITE_LOCK_PREFIXES: readonly string[] = ['../', 'doom/', 'iwad/', 'reference/'];

const CANONICAL_VALIDATE_PLAN_HELPER_NAMES: readonly string[] = ['parseLaneWriteScopes', 'pathsConflict', 'validateParallelWork', 'validateWritablePath'];

const CANONICAL_LANE_LOCK_RECORD_FIELDS: readonly string[] = ['acquiredAtUtc', 'expiresAtUtc', 'heartbeatUtc', 'lane', 'lockId', 'owner', 'planDirectory', 'processIdentifier', 'stepId', 'stepTitle', 'version'];

const CANONICAL_LANE_LOCK_RECORD_FIELD_COUNT = 11;

const CANONICAL_LANE_LOCK_COMMAND_SURFACE: readonly string[] = ['acquire', 'heartbeat', 'list', 'release'];

const CANONICAL_DEFAULT_LEASE_MINUTES = 120;

const CANONICAL_LANE_LOCK_DIRECTORY = 'plan_vanilla_parity/lane_locks/';

const CANONICAL_LANE_LOCK_FILE_PATH_PATTERN = 'plan_vanilla_parity/lane_locks/<lane>.lock/lock.json';

const CANONICAL_LANE_LOCK_RECORD_VERSION = '1';

interface PinLaneWriteLockContractDocument {
  readonly acceptancePhrasing: string;
  readonly canonicalLaneSlugs: readonly string[];
  readonly defaultLeaseMinutes: string;
  readonly emulatedVanillaVersion: string;
  readonly evidenceLocations: readonly string[];
  readonly forbiddenWriteLockPrefixes: readonly string[];
  readonly immediateLaneRoots: readonly string[];
  readonly laneDefinitionSource: string;
  readonly laneDisjointScopeRule: string;
  readonly laneLockAcquisitionRule: string;
  readonly laneLockCommandSource: string;
  readonly laneLockCommandSurface: readonly string[];
  readonly laneLockDirectory: string;
  readonly laneLockExpirationRule: string;
  readonly laneLockFilePathPattern: string;
  readonly laneLockHeartbeatRule: string;
  readonly laneLockRecordFieldCount: string;
  readonly laneLockRecordFields: readonly string[];
  readonly laneLockRecordVersion: string;
  readonly laneLockReleaseRule: string;
  readonly laneLockTestSource: string;
  readonly laneOwnedWriteRootRule: string;
  readonly laneReadOnlyRoots: readonly string[];
  readonly laneSlugPattern: string;
  readonly noLaneSwitchRule: string;
  readonly referenceEngine: string;
  readonly referenceEngineVersion: string;
  readonly scopeName: string;
  readonly stepFileWriteLockFieldContract: string;
  readonly validatePlanDiagnosticMessages: readonly string[];
  readonly validatePlanHelperNames: readonly string[];
}

function extractSection(documentText: string, sectionHeading: string): string {
  const heading = `## ${sectionHeading}`;
  const sectionStart = documentText.indexOf(`\n${heading}\n`);
  if (sectionStart === -1) {
    throw new Error(`Section "${sectionHeading}" not found in lane write lock contract document.`);
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

function parsePinLaneWriteLockContractDocument(documentText: string): PinLaneWriteLockContractDocument {
  const canonicalLaneSlugs = extractBullets(documentText, 'canonical lane slugs');
  if (canonicalLaneSlugs.length === 0) {
    throw new Error('canonical lane slugs must list at least one slug.');
  }

  const immediateLaneRoots = extractBullets(documentText, 'immediate lane roots');
  if (immediateLaneRoots.length === 0) {
    throw new Error('immediate lane roots must list at least one lane.');
  }

  const laneReadOnlyRoots = extractBullets(documentText, 'lane read-only roots');
  if (laneReadOnlyRoots.length === 0) {
    throw new Error('lane read-only roots must list at least one root.');
  }

  const forbiddenWriteLockPrefixes = extractBullets(documentText, 'forbidden write lock prefixes');
  if (forbiddenWriteLockPrefixes.length === 0) {
    throw new Error('forbidden write lock prefixes must list at least one prefix.');
  }

  const validatePlanHelperNames = extractBullets(documentText, 'validate plan helper names');
  if (validatePlanHelperNames.length === 0) {
    throw new Error('validate plan helper names must list at least one helper.');
  }

  const validatePlanDiagnosticMessages = extractBullets(documentText, 'validate plan diagnostic messages');
  if (validatePlanDiagnosticMessages.length === 0) {
    throw new Error('validate plan diagnostic messages must list at least one diagnostic.');
  }

  const laneLockRecordFields = extractBullets(documentText, 'lane lock record fields');
  if (laneLockRecordFields.length === 0) {
    throw new Error('lane lock record fields must list at least one field.');
  }

  const laneLockCommandSurface = extractBullets(documentText, 'lane lock command surface');
  if (laneLockCommandSurface.length === 0) {
    throw new Error('lane lock command surface must list at least one command.');
  }

  return {
    acceptancePhrasing: extractSection(documentText, 'acceptance phrasing'),
    canonicalLaneSlugs,
    defaultLeaseMinutes: extractSection(documentText, 'default lease minutes'),
    emulatedVanillaVersion: extractSection(documentText, 'emulated vanilla version'),
    evidenceLocations: extractBullets(documentText, 'evidence locations'),
    forbiddenWriteLockPrefixes,
    immediateLaneRoots,
    laneDefinitionSource: extractSection(documentText, 'lane definition source'),
    laneDisjointScopeRule: extractSection(documentText, 'lane disjoint scope rule'),
    laneLockAcquisitionRule: extractSection(documentText, 'lane lock acquisition rule'),
    laneLockCommandSource: extractSection(documentText, 'lane lock command source'),
    laneLockCommandSurface,
    laneLockDirectory: extractSection(documentText, 'lane lock directory'),
    laneLockExpirationRule: extractSection(documentText, 'lane lock expiration rule'),
    laneLockFilePathPattern: extractSection(documentText, 'lane lock file path pattern'),
    laneLockHeartbeatRule: extractSection(documentText, 'lane lock heartbeat rule'),
    laneLockRecordFieldCount: extractSection(documentText, 'lane lock record field count'),
    laneLockRecordFields,
    laneLockRecordVersion: extractSection(documentText, 'lane lock record version'),
    laneLockReleaseRule: extractSection(documentText, 'lane lock release rule'),
    laneLockTestSource: extractSection(documentText, 'lane lock test source'),
    laneOwnedWriteRootRule: extractSection(documentText, 'lane owned write root rule'),
    laneReadOnlyRoots,
    laneSlugPattern: extractSection(documentText, 'lane slug pattern'),
    noLaneSwitchRule: extractSection(documentText, 'no lane switch rule'),
    referenceEngine: extractSection(documentText, 'reference engine'),
    referenceEngineVersion: extractSection(documentText, 'reference engine version'),
    scopeName: extractSection(documentText, 'scope name'),
    stepFileWriteLockFieldContract: extractSection(documentText, 'step file write lock field contract'),
    validatePlanDiagnosticMessages,
    validatePlanHelperNames,
  };
}

async function loadPinLaneWriteLockContractDocument(): Promise<PinLaneWriteLockContractDocument> {
  const documentText = await Bun.file(PIN_DOCUMENT_PATH).text();
  return parsePinLaneWriteLockContractDocument(documentText);
}

describe('define lane write lock contract declaration', () => {
  test('pin document exists at the canonical path and is a file', () => {
    expect(existsSync(PIN_DOCUMENT_PATH)).toBe(true);
    expect(statSync(PIN_DOCUMENT_PATH).isFile()).toBe(true);
  });

  test('parses every required governance field with the expected vanilla parity values', async () => {
    const parsed = await loadPinLaneWriteLockContractDocument();
    expect(parsed.scopeName).toBe('vanilla DOOM 1.9 lane write lock contract');
    expect(parsed.emulatedVanillaVersion).toBe('1.9');
    expect(parsed.referenceEngine).toBe('Chocolate Doom');
    expect(parsed.referenceEngineVersion).toBe('2.2.1');
  });

  test('lane slug pattern equals the canonical regular expression enforced by lane-lock.ts', async () => {
    const parsed = await loadPinLaneWriteLockContractDocument();
    expect(parsed.laneSlugPattern).toContain(CANONICAL_LANE_SLUG_PATTERN);
    expect(parsed.laneSlugPattern).toContain('VALID_LANE_PATTERN');
    expect(parsed.laneSlugPattern).toContain('plan_vanilla_parity/lane-lock.ts');
  });

  test('canonical lane slugs match the fourteen committed lane rows in PARALLEL_WORK.md', async () => {
    const parsed = await loadPinLaneWriteLockContractDocument();
    expect(parsed.canonicalLaneSlugs).toEqual(CANONICAL_LANE_SLUGS);
    expect(parsed.canonicalLaneSlugs).toHaveLength(14);
    expect(new Set(parsed.canonicalLaneSlugs).size).toBe(parsed.canonicalLaneSlugs.length);

    const laneSlugRegExp = new RegExp(CANONICAL_LANE_SLUG_PATTERN);
    for (const laneSlug of parsed.canonicalLaneSlugs) {
      expect(laneSlugRegExp.test(laneSlug)).toBe(true);
    }

    const ascendingSortedLaneSlugs = [...parsed.canonicalLaneSlugs].sort();
    expect(parsed.canonicalLaneSlugs).toEqual(ascendingSortedLaneSlugs);
  });

  test('immediate lane roots match the six lanes README.md anchors as immediate roots', async () => {
    const parsed = await loadPinLaneWriteLockContractDocument();
    expect(parsed.immediateLaneRoots).toEqual(CANONICAL_IMMEDIATE_LANE_ROOTS);
    expect(parsed.immediateLaneRoots).toHaveLength(6);
    expect(new Set(parsed.immediateLaneRoots).size).toBe(parsed.immediateLaneRoots.length);
    for (const immediateLaneRoot of parsed.immediateLaneRoots) {
      expect(parsed.canonicalLaneSlugs).toContain(immediateLaneRoot);
    }
  });

  test('lane read-only roots are the canonical doom/, iwad/, reference/ trio', async () => {
    const parsed = await loadPinLaneWriteLockContractDocument();
    expect(parsed.laneReadOnlyRoots).toEqual(CANONICAL_LANE_READ_ONLY_ROOTS);
  });

  test('forbidden write lock prefixes include workspace escape and every read-only root', async () => {
    const parsed = await loadPinLaneWriteLockContractDocument();
    expect(parsed.forbiddenWriteLockPrefixes).toEqual(CANONICAL_FORBIDDEN_WRITE_LOCK_PREFIXES);
    expect(parsed.forbiddenWriteLockPrefixes).toContain('../');
    for (const readOnlyRoot of CANONICAL_LANE_READ_ONLY_ROOTS) {
      expect(parsed.forbiddenWriteLockPrefixes).toContain(readOnlyRoot);
    }
  });

  test('lane definition source pins PARALLEL_WORK.md as the single source of truth', async () => {
    const parsed = await loadPinLaneWriteLockContractDocument();
    expect(parsed.laneDefinitionSource).toContain('plan_vanilla_parity/PARALLEL_WORK.md');
    expect(parsed.laneDefinitionSource).toContain('owns');
    expect(parsed.laneDefinitionSource).toContain('must not touch');
    expect(parsed.laneDefinitionSource).toContain('parseLaneWriteScopes');
    expect(parsed.laneDefinitionSource).toContain('LaneWriteScope');
  });

  test('lane owned write root rule pins the at-least-one rule and validateWritablePath', async () => {
    const parsed = await loadPinLaneWriteLockContractDocument();
    expect(parsed.laneOwnedWriteRootRule).toContain('Lane <lane> must list at least one owned write root.');
    expect(parsed.laneOwnedWriteRootRule).toContain('validateParallelWork');
    expect(parsed.laneOwnedWriteRootRule).toContain('validateWritablePath');
    expect(parsed.laneOwnedWriteRootRule).toContain('plan_vanilla_parity/validate-plan.ts');
    for (const readOnlyRoot of CANONICAL_LANE_READ_ONLY_ROOTS) {
      expect(parsed.laneOwnedWriteRootRule).toContain(`\`${readOnlyRoot}\``);
    }
  });

  test('lane disjoint scope rule pins pathsConflict and the overlap diagnostic', async () => {
    const parsed = await loadPinLaneWriteLockContractDocument();
    expect(parsed.laneDisjointScopeRule).toContain('pathsConflict');
    expect(parsed.laneDisjointScopeRule).toContain('Lane write scopes overlap: <leftLane> owns <leftRoot> and <rightLane> owns <rightRoot>.');
    expect(parsed.laneDisjointScopeRule).toContain('plan_vanilla_parity/validate-plan.ts');
  });

  test('no lane switch rule pins the PROMPT.md "Do not switch lanes." wording', async () => {
    const parsed = await loadPinLaneWriteLockContractDocument();
    expect(parsed.noLaneSwitchRule).toContain('Do not switch lanes.');
    expect(parsed.noLaneSwitchRule).toContain('plan_vanilla_parity/PROMPT.md');
    expect(parsed.noLaneSwitchRule).toContain('NO_ELIGIBLE_STEP');
  });

  test('step file write lock field contract pins the four enforced rules and the expected-changes mirror rule', async () => {
    const parsed = await loadPinLaneWriteLockContractDocument();
    expect(parsed.stepFileWriteLockFieldContract).toContain('validateWritablePath');
    expect(parsed.stepFileWriteLockFieldContract).toContain('plan_vanilla_parity/validate-plan.ts');
    expect(parsed.stepFileWriteLockFieldContract).toContain('../');
    for (const readOnlyRoot of CANONICAL_LANE_READ_ONLY_ROOTS) {
      expect(parsed.stepFileWriteLockFieldContract).toContain(`\`${readOnlyRoot}\``);
    }
    expect(parsed.stepFileWriteLockFieldContract).toContain('expected changes');
  });

  test('validate plan helper names list exactly the four canonical helpers and are ASCIIbetically sorted', async () => {
    const parsed = await loadPinLaneWriteLockContractDocument();
    expect(parsed.validatePlanHelperNames).toEqual(CANONICAL_VALIDATE_PLAN_HELPER_NAMES);
    expect(parsed.validatePlanHelperNames).toHaveLength(4);
    expect(new Set(parsed.validatePlanHelperNames).size).toBe(parsed.validatePlanHelperNames.length);
    const ascendingSortedHelpers = [...parsed.validatePlanHelperNames].sort();
    expect(parsed.validatePlanHelperNames).toEqual(ascendingSortedHelpers);
  });

  test('validate plan diagnostic messages cover the five canonical diagnostics emitted by validateWritablePath and validateParallelWork', async () => {
    const parsed = await loadPinLaneWriteLockContractDocument();
    expect(parsed.validatePlanDiagnosticMessages).toContain('Lane <lane> must list at least one owned write root.');
    expect(parsed.validatePlanDiagnosticMessages).toContain('Lane write scopes overlap: <leftLane> owns <leftRoot> and <rightLane> owns <rightRoot>.');
    expect(parsed.validatePlanDiagnosticMessages).toContain('Write lock escapes the workspace: <path>.');
    expect(parsed.validatePlanDiagnosticMessages).toContain('Write lock is inside read-only reference root: <path>.');
    expect(parsed.validatePlanDiagnosticMessages).toContain('Write lock path must not be empty.');
  });

  test('lane lock directory equals the canonical plan_vanilla_parity/lane_locks/ path', async () => {
    const parsed = await loadPinLaneWriteLockContractDocument();
    expect(parsed.laneLockDirectory).toBe(CANONICAL_LANE_LOCK_DIRECTORY);
  });

  test('lane lock file path pattern equals the canonical <lane>.lock/lock.json path', async () => {
    const parsed = await loadPinLaneWriteLockContractDocument();
    expect(parsed.laneLockFilePathPattern).toBe(CANONICAL_LANE_LOCK_FILE_PATH_PATTERN);
    expect(parsed.laneLockFilePathPattern).toContain('<lane>.lock');
    expect(parsed.laneLockFilePathPattern).toContain('lock.json');
  });

  test('lane lock record version is the canonical version 1', async () => {
    const parsed = await loadPinLaneWriteLockContractDocument();
    expect(parsed.laneLockRecordVersion).toBe(CANONICAL_LANE_LOCK_RECORD_VERSION);
  });

  test('lane lock record fields list the canonical eleven fields in canonical order', async () => {
    const parsed = await loadPinLaneWriteLockContractDocument();
    expect(parsed.laneLockRecordFields).toEqual(CANONICAL_LANE_LOCK_RECORD_FIELDS);
    expect(parsed.laneLockRecordFields).toHaveLength(CANONICAL_LANE_LOCK_RECORD_FIELD_COUNT);
    expect(new Set(parsed.laneLockRecordFields).size).toBe(parsed.laneLockRecordFields.length);
    expect(parsed.laneLockRecordFieldCount).toBe(String(CANONICAL_LANE_LOCK_RECORD_FIELD_COUNT));
  });

  test('lane lock record fields are ASCIIbetically sorted', async () => {
    const parsed = await loadPinLaneWriteLockContractDocument();
    const ascendingSortedFields = [...parsed.laneLockRecordFields].sort();
    expect(parsed.laneLockRecordFields).toEqual(ascendingSortedFields);
  });

  test('lane lock acquisition rule pins acquireLaneLock semantics and crypto.randomUUID lock id', async () => {
    const parsed = await loadPinLaneWriteLockContractDocument();
    expect(parsed.laneLockAcquisitionRule).toContain('acquireLaneLock');
    expect(parsed.laneLockAcquisitionRule).toContain('plan_vanilla_parity/lane-lock.ts');
    expect(parsed.laneLockAcquisitionRule).toContain('plan_vanilla_parity/PARALLEL_WORK.md');
    expect(parsed.laneLockAcquisitionRule).toContain('plan_vanilla_parity/MASTER_CHECKLIST.md');
    expect(parsed.laneLockAcquisitionRule).toContain('removeExpiredLockDirectory');
    expect(parsed.laneLockAcquisitionRule).toContain('crypto.randomUUID');
  });

  test('lane lock heartbeat rule pins the lock-id-must-match check and refreshes both timestamps', async () => {
    const parsed = await loadPinLaneWriteLockContractDocument();
    expect(parsed.laneLockHeartbeatRule).toContain('heartbeatLaneLock');
    expect(parsed.laneLockHeartbeatRule).toContain('lock id');
    expect(parsed.laneLockHeartbeatRule).toContain('heartbeatUtc');
    expect(parsed.laneLockHeartbeatRule).toContain('expiresAtUtc');
  });

  test('lane lock release rule pins the lock-id-must-match check and recursive removal', async () => {
    const parsed = await loadPinLaneWriteLockContractDocument();
    expect(parsed.laneLockReleaseRule).toContain('releaseLaneLock');
    expect(parsed.laneLockReleaseRule).toContain('lock id');
  });

  test('lane lock expiration rule pins the Date.parse comparison and removeExpiredLockDirectory', async () => {
    const parsed = await loadPinLaneWriteLockContractDocument();
    expect(parsed.laneLockExpirationRule).toContain('expiresAtUtc');
    expect(parsed.laneLockExpirationRule).toContain('removeExpiredLockDirectory');
    expect(parsed.laneLockExpirationRule).toContain('Date.parse');
  });

  test('default lease minutes equals the canonical 120 minute lease', async () => {
    const parsed = await loadPinLaneWriteLockContractDocument();
    expect(parsed.defaultLeaseMinutes).toBe(String(CANONICAL_DEFAULT_LEASE_MINUTES));
  });

  test('lane lock command surface lists the four canonical CLI commands ASCIIbetically sorted', async () => {
    const parsed = await loadPinLaneWriteLockContractDocument();
    expect(parsed.laneLockCommandSurface).toEqual(CANONICAL_LANE_LOCK_COMMAND_SURFACE);
    const ascendingSortedCommands = [...parsed.laneLockCommandSurface].sort();
    expect(parsed.laneLockCommandSurface).toEqual(ascendingSortedCommands);
  });

  test('lane lock command source and test source point at the canonical Bun helper paths', async () => {
    const parsed = await loadPinLaneWriteLockContractDocument();
    expect(parsed.laneLockCommandSource).toBe(LANE_LOCK_SOURCE_PATH);
    expect(parsed.laneLockTestSource).toBe(LANE_LOCK_TEST_PATH);
  });

  test('every evidence location exists on disk and is a file', async () => {
    const parsed = await loadPinLaneWriteLockContractDocument();
    expect(parsed.evidenceLocations.length).toBeGreaterThan(0);
    expect(new Set(parsed.evidenceLocations).size).toBe(parsed.evidenceLocations.length);
    for (const evidenceLocation of parsed.evidenceLocations) {
      expect(existsSync(evidenceLocation)).toBe(true);
      expect(statSync(evidenceLocation).isFile()).toBe(true);
    }
  });

  test('evidence locations include AGENTS.md, CLAUDE.md, plan_vanilla_parity governance files, and the lane-lock helper plus its test', async () => {
    const parsed = await loadPinLaneWriteLockContractDocument();
    const requiredEvidence: readonly string[] = [
      AGENTS_PATH,
      CLAUDE_PATH,
      MASTER_CHECKLIST_PATH,
      PARALLEL_WORK_PATH,
      PLAN_PROMPT_PATH,
      PLAN_README_PATH,
      LANE_LOCK_SOURCE_PATH,
      LANE_LOCK_TEST_PATH,
      VALIDATE_PLAN_PATH,
      VALIDATE_PLAN_TEST_PATH,
    ];
    for (const requiredEvidenceLocation of requiredEvidence) {
      expect(parsed.evidenceLocations).toContain(requiredEvidenceLocation);
    }
  });

  test('plan_vanilla_parity lane-lock.ts declares the canonical VALID_LANE_PATTERN and DEFAULT_LEASE_MINUTES literals', async () => {
    const laneLockText = await Bun.file(LANE_LOCK_SOURCE_PATH).text();
    expect(laneLockText).toContain('const VALID_LANE_PATTERN = /^[a-z][a-z0-9-]*$/;');
    expect(laneLockText).toContain(`const DEFAULT_LEASE_MINUTES = ${CANONICAL_DEFAULT_LEASE_MINUTES};`);
    expect(laneLockText).toContain(`const DEFAULT_LOCK_DIRECTORY = '${CANONICAL_LANE_LOCK_DIRECTORY.replace(/\/$/, '')}';`);
  });

  test('plan_vanilla_parity lane-lock.ts declares the canonical LaneLockRecord interface with the eleven canonical fields', async () => {
    const laneLockText = await Bun.file(LANE_LOCK_SOURCE_PATH).text();
    expect(laneLockText).toContain('export interface LaneLockRecord {');
    for (const recordField of CANONICAL_LANE_LOCK_RECORD_FIELDS) {
      expect(laneLockText).toContain(`readonly ${recordField}:`);
    }
    expect(laneLockText).toContain('readonly version: 1;');
  });

  test('plan_vanilla_parity lane-lock.ts exports the four canonical lane lock command implementations', async () => {
    const laneLockText = await Bun.file(LANE_LOCK_SOURCE_PATH).text();
    expect(laneLockText).toContain('export async function acquireLaneLock(');
    expect(laneLockText).toContain('export async function heartbeatLaneLock(');
    expect(laneLockText).toContain('export async function listLaneLocks(');
    expect(laneLockText).toContain('export async function releaseLaneLock(');
  });

  test('plan_vanilla_parity validate-plan.ts declares every helper this document anchors and the READ_ONLY_ROOTS literal', async () => {
    const validatePlanText = await Bun.file(VALIDATE_PLAN_PATH).text();
    for (const helperName of CANONICAL_VALIDATE_PLAN_HELPER_NAMES) {
      expect(validatePlanText).toContain(helperName);
    }
    expect(validatePlanText).toContain("const READ_ONLY_ROOTS = ['doom/', 'iwad/', 'reference/'] as const;");
  });

  test('plan_vanilla_parity validate-plan.ts emits the five canonical lane and write-lock diagnostic strings', async () => {
    const validatePlanText = await Bun.file(VALIDATE_PLAN_PATH).text();
    expect(validatePlanText).toContain('Lane ${scope.lane} must list at least one owned write root.');
    expect(validatePlanText).toContain('Lane write scopes overlap: ${leftScope.lane} owns ${leftRoot} and ${rightScope.lane} owns ${rightRoot}.');
    expect(validatePlanText).toContain('Write lock escapes the workspace: ${path}.');
    expect(validatePlanText).toContain('Write lock is inside read-only reference root: ${path}.');
    expect(validatePlanText).toContain("'Write lock path must not be empty.'");
  });

  test('plan_vanilla_parity PARALLEL_WORK.md declares one row per canonical lane slug with a non-empty owns column', async () => {
    const parallelWorkText = await Bun.file(PARALLEL_WORK_PATH).text();
    const laneRowPattern = /^\| (?<lane>[a-z][a-z0-9-]*) \| [^|]* \| [^|]* \| (?<owns>[^|]+) \| [^|]+ \|$/gm;
    const declaredLanes = new Map<string, string>();
    for (const match of parallelWorkText.matchAll(laneRowPattern)) {
      const groups = match.groups;
      if (!groups) {
        continue;
      }
      const laneCell = groups.lane.trim();
      if (laneCell === 'lane') {
        continue;
      }
      declaredLanes.set(laneCell, groups.owns.trim());
    }
    for (const laneSlug of CANONICAL_LANE_SLUGS) {
      expect(declaredLanes.has(laneSlug)).toBe(true);
      expect((declaredLanes.get(laneSlug) ?? '').length).toBeGreaterThan(0);
    }
    expect(declaredLanes.size).toBe(CANONICAL_LANE_SLUGS.length);
  });

  test('plan_vanilla_parity PROMPT.md anchors the no-lane-switch rule and the RLP_LANE status field', async () => {
    const promptText = await Bun.file(PLAN_PROMPT_PATH).text();
    expect(promptText).toContain('Do not switch lanes.');
    expect(promptText).toContain('RLP_LANE');
  });

  test('plan_vanilla_parity README.md anchors the six immediate lane roots in the canonical order', async () => {
    const readmeText = await Bun.file(PLAN_README_PATH).text();
    expect(readmeText).toContain('immediate lane roots are `governance`, `inventory`, `oracle`, `launch`, `core`, and `wad`');
  });

  test('AGENTS.md anchors the local-only publishing authority that lane locks support', async () => {
    const agentsText = await Bun.file(AGENTS_PATH).text();
    expect(agentsText).toContain('GitHub and Publishing Authority');
    expect(agentsText).toContain('local Git commands');
  });

  test('CLAUDE.md anchors the planning-system rule that constrains every Ralph-loop step to a single read-only and expected-changes scope', async () => {
    const claudeText = await Bun.file(CLAUDE_PATH).text();
    expect(claudeText).toContain('Planning system');
    expect(claudeText).toContain('Read Only');
    expect(claudeText).toContain('Expected Changes');
  });

  test('step 00-009 file declares the governance lane, lists this declaration under its write lock, and lists the focused test under its test files', async () => {
    expect(existsSync(STEP_FILE_PATH)).toBe(true);
    const stepText = await Bun.file(STEP_FILE_PATH).text();
    expect(stepText).toContain('# [ ] STEP 00-009: Define Lane Write Lock Contract');
    expect(stepText).toContain('\n## lane\n\ngovernance\n');
    expect(stepText).toContain('- plan_vanilla_parity/define-lane-write-lock-contract.md');
    expect(stepText).toContain('- test/plan_vanilla_parity/define-lane-write-lock-contract.test.ts');
  });

  test('MASTER_CHECKLIST.md row for 00-009 references the canonical step file path and the governance lane', async () => {
    const checklistText = await Bun.file(MASTER_CHECKLIST_PATH).text();
    const expectedPendingRow = '- [ ] `00-009` `define-lane-write-lock-contract` | lane: `governance` | prereqs: `00-008` | file: `plan_vanilla_parity/steps/00-009-define-lane-write-lock-contract.md`';
    const expectedCompletedRow = '- [x] `00-009` `define-lane-write-lock-contract` | lane: `governance` | prereqs: `00-008` | file: `plan_vanilla_parity/steps/00-009-define-lane-write-lock-contract.md`';
    expect(checklistText.includes(expectedPendingRow) || checklistText.includes(expectedCompletedRow)).toBe(true);
  });

  test('acceptance phrasing names the lane lock directory, the write lock field, the read-only roots, and the no-lane-switch rule', async () => {
    const parsed = await loadPinLaneWriteLockContractDocument();
    expect(parsed.acceptancePhrasing).toContain('plan_vanilla_parity/PARALLEL_WORK.md');
    expect(parsed.acceptancePhrasing).toContain('plan_vanilla_parity/lane_locks/<lane>.lock/lock.json');
    expect(parsed.acceptancePhrasing).toContain('write lock');
    expect(parsed.acceptancePhrasing).toContain('expected changes');
    for (const readOnlyRoot of CANONICAL_LANE_READ_ONLY_ROOTS) {
      expect(parsed.acceptancePhrasing).toContain(`\`${readOnlyRoot}\``);
    }
    expect(parsed.acceptancePhrasing).toContain('../');
    expect(parsed.acceptancePhrasing).toContain('never switches lanes');
  });

  test('parser surfaces a meaningful error when a required section is missing (failure mode)', () => {
    const documentTextWithMissingSection = '# Test\n\n## scope name\n\nvanilla DOOM 1.9 lane write lock contract\n';
    expect(() => parsePinLaneWriteLockContractDocument(documentTextWithMissingSection)).toThrow('Section "canonical lane slugs" not found in lane write lock contract document.');
  });

  test('parser surfaces a meaningful error when canonical lane slugs is empty (failure mode)', async () => {
    const validDocumentText = await Bun.file(PIN_DOCUMENT_PATH).text();
    const corruptedDocumentText = validDocumentText.replace(
      /\n## canonical lane slugs\n\n- acceptance\n- ai\n- audio\n- core\n- gameplay\n- governance\n- inventory\n- launch\n- map\n- oracle\n- render\n- save\n- ui\n- wad\n/,
      '\n## canonical lane slugs\n\nno bullets here\n',
    );
    expect(corruptedDocumentText).not.toBe(validDocumentText);
    expect(() => parsePinLaneWriteLockContractDocument(corruptedDocumentText)).toThrow('canonical lane slugs must list at least one slug.');
  });

  test('parser surfaces a meaningful error when lane lock record fields is empty (failure mode)', async () => {
    const validDocumentText = await Bun.file(PIN_DOCUMENT_PATH).text();
    const corruptedDocumentText = validDocumentText.replace(
      /\n## lane lock record fields\n\n- acquiredAtUtc\n- expiresAtUtc\n- heartbeatUtc\n- lane\n- lockId\n- owner\n- planDirectory\n- processIdentifier\n- stepId\n- stepTitle\n- version\n/,
      '\n## lane lock record fields\n\nno bullets here\n',
    );
    expect(corruptedDocumentText).not.toBe(validDocumentText);
    expect(() => parsePinLaneWriteLockContractDocument(corruptedDocumentText)).toThrow('lane lock record fields must list at least one field.');
  });
});
