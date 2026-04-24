import { describe, expect, test } from 'bun:test';

import { existsSync } from 'node:fs';

import bunOnlyManifest from '../../plan_fps/manifests/00-005-pin-bun-runtime-and-package-manager.json';
import controlCenterManifest from '../../plan_fps/manifests/00-002-declare-plan-fps-control-center.json';
import entryPointManifest from '../../plan_fps/manifests/00-003-pin-bun-run-doom-entrypoint.json';
import manifest from '../../plan_fps/manifests/00-006-record-bun-native-api-preference.json';

const README_PATH = 'plan_fps/README.md';
const CHECKLIST_PATH = 'plan_fps/MASTER_CHECKLIST.md';
const DECISION_LOG_PATH = 'plan_fps/DECISION_LOG.md';
const FACT_LOG_PATH = 'plan_fps/FACT_LOG.md';
const PACKAGE_JSON_PATH = 'package.json';
const TSCONFIG_JSON_PATH = 'tsconfig.json';
const AGENTS_MD_PATH = 'AGENTS.md';

const EXPECTED_PREFERRED_API_NAMES = ['Bun.file', 'Bun.write', 'Bun.serve', 'Bun.argv', 'Bun.env', 'Bun.sleep', 'Bun.spawn', 'bun:test', 'bun:ffi', 'bun:sqlite'];

describe('record-bun-native-api-preference manifest', () => {
  test('locks schemaVersion 1 and ties the decision to D-FPS-007', () => {
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.decisionId).toBe('D-FPS-007');
  });

  test('pins exactly ten preferred Bun APIs in the canonical order from AGENTS.md', () => {
    expect(manifest.preferredBunApis.length).toBe(10);
    expect(manifest.preferredBunApis.map((preferredApi) => preferredApi.name)).toEqual(EXPECTED_PREFERRED_API_NAMES);
  });

  test('every preferredBunApis entry has a unique name/purpose, a valid kind, and at least one nodeAlternative', () => {
    const seenNames = new Set<string>();
    const seenPurposes = new Set<string>();
    const validKinds = new Set(['global-namespace', 'builtin-module']);
    for (const preferredApi of manifest.preferredBunApis) {
      expect(typeof preferredApi.name).toBe('string');
      expect(preferredApi.name.length).toBeGreaterThan(0);
      expect(typeof preferredApi.kind).toBe('string');
      expect(validKinds.has(preferredApi.kind)).toBe(true);
      expect(typeof preferredApi.purpose).toBe('string');
      expect(preferredApi.purpose.length).toBeGreaterThan(0);
      expect(Array.isArray(preferredApi.nodeAlternatives)).toBe(true);
      expect(preferredApi.nodeAlternatives.length).toBeGreaterThanOrEqual(1);
      for (const nodeAlternative of preferredApi.nodeAlternatives) {
        expect(typeof nodeAlternative).toBe('string');
        expect(nodeAlternative.length).toBeGreaterThan(0);
      }
      expect(new Set(preferredApi.nodeAlternatives).size).toBe(preferredApi.nodeAlternatives.length);

      expect(seenNames.has(preferredApi.name)).toBe(false);
      seenNames.add(preferredApi.name);
      expect(seenPurposes.has(preferredApi.purpose)).toBe(false);
      seenPurposes.add(preferredApi.purpose);
    }
    expect(seenNames.size).toBe(manifest.preferredBunApis.length);
    expect(seenPurposes.size).toBe(manifest.preferredBunApis.length);
  });

  test('every preferredBunApis kind-to-name pairing matches the expected prefix ("Bun." for global-namespace, "bun:" for builtin-module)', () => {
    for (const preferredApi of manifest.preferredBunApis) {
      if (preferredApi.kind === 'global-namespace') {
        expect(preferredApi.name.startsWith('Bun.')).toBe(true);
        expect(preferredApi.name.includes(':')).toBe(false);
      } else if (preferredApi.kind === 'builtin-module') {
        expect(preferredApi.name.startsWith('bun:')).toBe(true);
        expect(preferredApi.name.startsWith('Bun.')).toBe(false);
      }
    }
  });

  test('importGroupOrder pins four groups in canonical order with ordinals 1..4 and unique groups', () => {
    expect(manifest.importGroupOrder.length).toBe(4);
    expect(manifest.importGroupOrder.map((importGroup) => importGroup.group)).toEqual(['bun', 'node', 'third-party', 'relative']);

    const seenOrdinals = new Set<number>();
    const seenGroups = new Set<string>();
    const seenDescriptions = new Set<string>();
    for (const importGroup of manifest.importGroupOrder) {
      expect(Number.isInteger(importGroup.ordinal)).toBe(true);
      expect(importGroup.ordinal).toBeGreaterThanOrEqual(1);
      expect(importGroup.ordinal).toBeLessThanOrEqual(manifest.importGroupOrder.length);
      expect(seenOrdinals.has(importGroup.ordinal)).toBe(false);
      seenOrdinals.add(importGroup.ordinal);

      expect(typeof importGroup.group).toBe('string');
      expect(importGroup.group.length).toBeGreaterThan(0);
      expect(seenGroups.has(importGroup.group)).toBe(false);
      seenGroups.add(importGroup.group);

      expect(typeof importGroup.prefix).toBe('string');
      expect(typeof importGroup.description).toBe('string');
      expect(importGroup.description.length).toBeGreaterThan(0);
      expect(seenDescriptions.has(importGroup.description)).toBe(false);
      seenDescriptions.add(importGroup.description);
    }
    expect(seenOrdinals.size).toBe(manifest.importGroupOrder.length);
    expect(seenGroups.size).toBe(manifest.importGroupOrder.length);
    expect(seenDescriptions.size).toBe(manifest.importGroupOrder.length);

    const sortedOrdinals = [...seenOrdinals].sort((lhs, rhs) => lhs - rhs);
    expect(sortedOrdinals).toEqual([1, 2, 3, 4]);

    const ordinalSequence = manifest.importGroupOrder.map((importGroup) => importGroup.ordinal);
    expect(ordinalSequence).toEqual([1, 2, 3, 4]);

    const nonEmptyPrefixes = manifest.importGroupOrder.map((importGroup) => importGroup.prefix).filter((prefix) => prefix.length > 0);
    expect(new Set(nonEmptyPrefixes).size).toBe(nonEmptyPrefixes.length);
    expect(nonEmptyPrefixes).toEqual(['bun:', 'node:']);
  });

  test('importGroupOrder pins the exact "bun:" and "node:" prefix pair and empty prefixes for third-party and relative', () => {
    const groupsByName = new Map(manifest.importGroupOrder.map((importGroup) => [importGroup.group, importGroup.prefix]));
    expect(groupsByName.get('bun')).toBe('bun:');
    expect(groupsByName.get('node')).toBe('node:');
    expect(groupsByName.get('third-party')).toBe('');
    expect(groupsByName.get('relative')).toBe('');
  });

  test('forbiddenNodeOnlyDependencies pins FFI and SQLite Node alternatives and is unique', () => {
    expect(manifest.forbiddenNodeOnlyDependencies).toEqual(['ffi-napi', 'node-ffi', 'node-addon-api', 'better-sqlite3', 'sqlite3']);
    expect(new Set(manifest.forbiddenNodeOnlyDependencies).size).toBe(manifest.forbiddenNodeOnlyDependencies.length);
    for (const forbiddenDependency of manifest.forbiddenNodeOnlyDependencies) {
      expect(typeof forbiddenDependency).toBe('string');
      expect(forbiddenDependency.length).toBeGreaterThan(0);
      expect(forbiddenDependency).toBe(forbiddenDependency.toLowerCase());
    }
  });

  test('no preferredBunApis name collides with any forbiddenNodeOnlyDependency or nodeAlternative listed on another entry', () => {
    const allPreferredNames = new Set(manifest.preferredBunApis.map((preferredApi) => preferredApi.name));
    for (const forbiddenDependency of manifest.forbiddenNodeOnlyDependencies) {
      expect(allPreferredNames.has(forbiddenDependency)).toBe(false);
    }
    for (const preferredApi of manifest.preferredBunApis) {
      for (const nodeAlternative of preferredApi.nodeAlternatives) {
        expect(allPreferredNames.has(nodeAlternative)).toBe(false);
      }
    }
  });

  test('package.json does not list any forbiddenNodeOnlyDependency as a dependency or devDependency', async () => {
    const packageJson = (await Bun.file(PACKAGE_JSON_PATH).json()) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    const allDependencyNames = [...Object.keys(packageJson.dependencies ?? {}), ...Object.keys(packageJson.devDependencies ?? {})];
    for (const forbiddenDependency of manifest.forbiddenNodeOnlyDependencies) {
      expect(allDependencyNames).not.toContain(forbiddenDependency);
    }
  });

  test('requiredRuntimeTarget cross-references D-FPS-003 and matches the 00-003 manifest runtime command', () => {
    expect(manifest.requiredRuntimeTarget.runtimeCommand).toBe('bun run doom.ts');
    expect(manifest.requiredRuntimeTarget.decisionId).toBe('D-FPS-003');
    expect(manifest.requiredRuntimeTarget.manifestPath).toBe('plan_fps/manifests/00-003-pin-bun-run-doom-entrypoint.json');
    expect(existsSync(manifest.requiredRuntimeTarget.manifestPath)).toBe(true);
    expect(entryPointManifest.runtimeCommand).toBe(manifest.requiredRuntimeTarget.runtimeCommand);
    expect(entryPointManifest.decisionId).toBe(manifest.requiredRuntimeTarget.decisionId);
  });

  test('bunOnlyManifestPath cross-references the 00-005 Bun-only manifest (D-FPS-006) and its runtime target matches this manifest', () => {
    expect(manifest.bunOnlyManifestPath).toBe('plan_fps/manifests/00-005-pin-bun-runtime-and-package-manager.json');
    expect(existsSync(manifest.bunOnlyManifestPath)).toBe(true);
    expect(bunOnlyManifest.decisionId).toBe('D-FPS-006');
    expect(bunOnlyManifest.requiredRuntimeTarget.runtimeCommand).toBe(manifest.requiredRuntimeTarget.runtimeCommand);
    expect(bunOnlyManifest.requiredRuntimeTarget.decisionId).toBe(manifest.requiredRuntimeTarget.decisionId);
  });

  test('controlCenterManifestPath cross-references the 00-002 manifest and its runtime target matches this manifest', () => {
    expect(manifest.controlCenterManifestPath).toBe('plan_fps/manifests/00-002-declare-plan-fps-control-center.json');
    expect(existsSync(manifest.controlCenterManifestPath)).toBe(true);
    expect(controlCenterManifest.runtimeTarget).toBe(manifest.requiredRuntimeTarget.runtimeCommand);
  });

  test('currentWorkspace pins tsconfig types=["bun"] and package.json @bun-win32 FFI provider scope with exactly five scoped dependencies', async () => {
    expect(manifest.currentWorkspace.tsconfigJsonPath).toBe(TSCONFIG_JSON_PATH);
    expect(existsSync(manifest.currentWorkspace.tsconfigJsonPath)).toBe(true);
    expect(manifest.currentWorkspace.tsconfigCompilerOptionsTypes).toEqual(['bun']);
    expect(manifest.currentWorkspace.packageJsonPath).toBe(PACKAGE_JSON_PATH);
    expect(existsSync(manifest.currentWorkspace.packageJsonPath)).toBe(true);
    expect(manifest.currentWorkspace.ffiProviderScope).toBe('@bun-win32');
    expect(manifest.currentWorkspace.ffiProviderDependencies).toEqual(['@bun-win32/core', '@bun-win32/gdi32', '@bun-win32/kernel32', '@bun-win32/user32', '@bun-win32/winmm']);
    expect(new Set(manifest.currentWorkspace.ffiProviderDependencies).size).toBe(manifest.currentWorkspace.ffiProviderDependencies.length);

    const tsconfigJson = (await Bun.file(TSCONFIG_JSON_PATH).json()) as { compilerOptions?: { types?: readonly string[] } };
    expect(tsconfigJson.compilerOptions?.types).toEqual(manifest.currentWorkspace.tsconfigCompilerOptionsTypes);

    const packageJson = (await Bun.file(PACKAGE_JSON_PATH).json()) as { dependencies?: Record<string, string> };
    const declaredDependencyNames = Object.keys(packageJson.dependencies ?? {});
    for (const ffiProviderDependency of manifest.currentWorkspace.ffiProviderDependencies) {
      expect(declaredDependencyNames).toContain(ffiProviderDependency);
      expect(ffiProviderDependency.startsWith(`${manifest.currentWorkspace.ffiProviderScope}/`)).toBe(true);
    }
  });

  test('every evidencePath exists on disk, lives outside read-only reference roots, and the list contains no duplicates', () => {
    expect(Array.isArray(manifest.evidencePaths)).toBe(true);
    expect(manifest.evidencePaths.length).toBeGreaterThanOrEqual(8);
    for (const evidencePath of manifest.evidencePaths) {
      expect(typeof evidencePath).toBe('string');
      expect(existsSync(evidencePath)).toBe(true);
      expect(evidencePath.startsWith('doom/')).toBe(false);
      expect(evidencePath.startsWith('iwad/')).toBe(false);
      expect(evidencePath.startsWith('reference/')).toBe(false);
    }
    expect(manifest.evidencePaths).toContain(README_PATH);
    expect(manifest.evidencePaths).toContain(CHECKLIST_PATH);
    expect(manifest.evidencePaths).toContain(DECISION_LOG_PATH);
    expect(manifest.evidencePaths).toContain(FACT_LOG_PATH);
    expect(manifest.evidencePaths).toContain(PACKAGE_JSON_PATH);
    expect(manifest.evidencePaths).toContain(TSCONFIG_JSON_PATH);
    expect(manifest.evidencePaths).toContain(AGENTS_MD_PATH);
    expect(manifest.evidencePaths).toContain(manifest.controlCenterManifestPath);
    expect(manifest.evidencePaths).toContain(manifest.requiredRuntimeTarget.manifestPath);
    expect(manifest.evidencePaths).toContain(manifest.bunOnlyManifestPath);
    expect(new Set(manifest.evidencePaths).size).toBe(manifest.evidencePaths.length);
  });

  test('rationale pins the Bun-native preference, the import group order, the runtime command, and the FFI provider scope', () => {
    expect(typeof manifest.rationale).toBe('string');
    expect(manifest.rationale.length).toBeGreaterThan(0);
    expect(manifest.rationale).toContain('Bun-native');
    expect(manifest.rationale).toContain('bun:*');
    expect(manifest.rationale).toContain('node:*');
    expect(manifest.rationale).toContain('third-party');
    expect(manifest.rationale).toContain('relative');
    expect(manifest.rationale).toContain('bun run doom.ts');
    expect(manifest.rationale).toContain('D-FPS-003');
    expect(manifest.rationale).toContain('D-FPS-006');
    expect(manifest.rationale).toContain('@bun-win32');
  });

  test('DECISION_LOG.md records D-FPS-007 as accepted, pins the Bun-native preference sentence, and cites this manifest as evidence', async () => {
    const decisionLogText = await Bun.file(DECISION_LOG_PATH).text();
    const sectionStart = decisionLogText.indexOf(`## ${manifest.decisionId}`);
    expect(sectionStart).toBeGreaterThanOrEqual(0);

    const afterHeader = decisionLogText.slice(sectionStart);
    const nextSectionIndex = afterHeader.indexOf('\n## ', 1);
    const sectionBody = nextSectionIndex === -1 ? afterHeader : afterHeader.slice(0, nextSectionIndex);

    expect(sectionBody).toContain('status: accepted');
    expect(sectionBody).toContain('Prefer Bun-native APIs');
    expect(sectionBody).toContain('`bun:*` → `node:*` → third-party → relative');
    expect(sectionBody).toContain('plan_fps/manifests/00-006-record-bun-native-api-preference.json');
  });

  test('AGENTS.md Runtime section contains every preferredBunApis name verbatim and both canonical import-scheme prefixes', async () => {
    const agentsText = await Bun.file(AGENTS_MD_PATH).text();
    const runtimeSectionStart = agentsText.indexOf('## Runtime\n');
    expect(runtimeSectionStart).toBeGreaterThanOrEqual(0);
    const afterHeader = agentsText.slice(runtimeSectionStart);
    const nextSectionIndex = afterHeader.indexOf('\n## ', 1);
    const runtimeSection = nextSectionIndex === -1 ? afterHeader : afterHeader.slice(0, nextSectionIndex);

    for (const preferredApi of manifest.preferredBunApis) {
      expect(runtimeSection).toContain(preferredApi.name);
    }

    const bunGroupPrefix = manifest.importGroupOrder.find((importGroup) => importGroup.group === 'bun')?.prefix;
    const nodeGroupPrefix = manifest.importGroupOrder.find((importGroup) => importGroup.group === 'node')?.prefix;
    expect(bunGroupPrefix).toBe('bun:');
    expect(nodeGroupPrefix).toBe('node:');
    expect(runtimeSection).toContain(`${bunGroupPrefix}*`);
    expect(runtimeSection).toContain(`${nodeGroupPrefix}*`);
  });
});
