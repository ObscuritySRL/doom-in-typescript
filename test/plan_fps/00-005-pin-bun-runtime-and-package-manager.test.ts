import { describe, expect, test } from 'bun:test';

import { existsSync } from 'node:fs';

import controlCenterManifest from '../../plan_fps/manifests/00-002-declare-plan-fps-control-center.json';
import entryPointManifest from '../../plan_fps/manifests/00-003-pin-bun-run-doom-entrypoint.json';
import rejectCompiledExeManifest from '../../plan_fps/manifests/00-004-reject-compiled-exe-target.json';
import manifest from '../../plan_fps/manifests/00-005-pin-bun-runtime-and-package-manager.json';

const README_PATH = 'plan_fps/README.md';
const CHECKLIST_PATH = 'plan_fps/MASTER_CHECKLIST.md';
const DECISION_LOG_PATH = 'plan_fps/DECISION_LOG.md';
const FACT_LOG_PATH = 'plan_fps/FACT_LOG.md';
const PACKAGE_JSON_PATH = 'package.json';
const BUN_LOCK_PATH = 'bun.lock';
const AGENTS_MD_PATH = 'AGENTS.md';

describe('pin-bun-runtime-and-package-manager manifest', () => {
  test('locks schemaVersion 1 and ties the decision to D-FPS-006', () => {
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.decisionId).toBe('D-FPS-006');
  });

  test('pins exactly six Bun roles in the canonical order', () => {
    expect(manifest.bunRoles.length).toBe(6);
    expect(manifest.bunRoles.map((bunRole) => bunRole.role)).toEqual(['runtime', 'package-manager', 'package-adder', 'script-runner', 'test-runner', 'builder']);
  });

  test('every bunRoles entry has a non-empty role, commandPrefix starting with "bun", and unique description', () => {
    const seenRoles = new Set<string>();
    const seenCommandPrefixes = new Set<string>();
    const seenDescriptions = new Set<string>();
    for (const bunRole of manifest.bunRoles) {
      expect(typeof bunRole.role).toBe('string');
      expect(bunRole.role.length).toBeGreaterThan(0);
      expect(typeof bunRole.commandPrefix).toBe('string');
      expect(bunRole.commandPrefix.length).toBeGreaterThan(0);
      expect(bunRole.commandPrefix === 'bun' || bunRole.commandPrefix.startsWith('bun ')).toBe(true);
      expect(typeof bunRole.description).toBe('string');
      expect(bunRole.description.length).toBeGreaterThan(0);
      expect(seenRoles.has(bunRole.role)).toBe(false);
      seenRoles.add(bunRole.role);
      expect(seenCommandPrefixes.has(bunRole.commandPrefix)).toBe(false);
      seenCommandPrefixes.add(bunRole.commandPrefix);
      expect(seenDescriptions.has(bunRole.description)).toBe(false);
      seenDescriptions.add(bunRole.description);
    }
    expect(seenRoles.size).toBe(manifest.bunRoles.length);
    expect(seenCommandPrefixes.size).toBe(manifest.bunRoles.length);
    expect(seenDescriptions.size).toBe(manifest.bunRoles.length);
  });

  test('bunRoles pins the exact Bun command prefix for each canonical role', () => {
    const rolesByName = new Map(manifest.bunRoles.map((bunRole) => [bunRole.role, bunRole.commandPrefix]));
    expect(rolesByName.get('runtime')).toBe('bun');
    expect(rolesByName.get('package-manager')).toBe('bun install');
    expect(rolesByName.get('package-adder')).toBe('bun add');
    expect(rolesByName.get('script-runner')).toBe('bun run');
    expect(rolesByName.get('test-runner')).toBe('bun test');
    expect(rolesByName.get('builder')).toBe('bun build');
  });

  test('forbiddenRuntimePrograms pins Node.js and is unique', () => {
    expect(manifest.forbiddenRuntimePrograms).toContain('node');
    for (const program of manifest.forbiddenRuntimePrograms) {
      expect(typeof program).toBe('string');
      expect(program.length).toBeGreaterThan(0);
      expect(program).toBe(program.toLowerCase());
    }
    expect(new Set(manifest.forbiddenRuntimePrograms).size).toBe(manifest.forbiddenRuntimePrograms.length);
  });

  test('forbiddenPackageManagers pins npm/yarn/pnpm and is unique', () => {
    expect(manifest.forbiddenPackageManagers).toEqual(['npm', 'yarn', 'pnpm']);
    expect(new Set(manifest.forbiddenPackageManagers).size).toBe(manifest.forbiddenPackageManagers.length);
  });

  test('forbiddenScriptRunners pins npx/ts-node/tsx and is unique', () => {
    expect(manifest.forbiddenScriptRunners).toEqual(['npx', 'ts-node', 'tsx']);
    expect(new Set(manifest.forbiddenScriptRunners).size).toBe(manifest.forbiddenScriptRunners.length);
  });

  test('forbiddenTestRunners pins vitest/jest/mocha and is unique', () => {
    expect(manifest.forbiddenTestRunners).toEqual(['vitest', 'jest', 'mocha']);
    expect(new Set(manifest.forbiddenTestRunners).size).toBe(manifest.forbiddenTestRunners.length);
  });

  test('allowedLockfile pins bun.lock and the lockfile is present on disk', () => {
    expect(manifest.allowedLockfile.path).toBe('bun.lock');
    expect(manifest.allowedLockfile.expectedPresentOnDisk).toBe(true);
    expect(existsSync(manifest.allowedLockfile.path)).toBe(true);
  });

  test('forbiddenLockfiles pins package-lock.json/yarn.lock/pnpm-lock.yaml and none are present on disk', () => {
    expect(manifest.forbiddenLockfiles.length).toBe(3);
    const seenPaths = new Set<string>();
    for (const forbiddenLockfile of manifest.forbiddenLockfiles) {
      expect(typeof forbiddenLockfile.path).toBe('string');
      expect(forbiddenLockfile.path.length).toBeGreaterThan(0);
      expect(forbiddenLockfile.expectedPresentOnDisk).toBe(false);
      expect(existsSync(forbiddenLockfile.path)).toBe(false);
      expect(seenPaths.has(forbiddenLockfile.path)).toBe(false);
      seenPaths.add(forbiddenLockfile.path);
    }
    expect([...seenPaths].sort()).toEqual(['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock']);
  });

  test('allowedLockfile path does not collide with any forbiddenLockfiles path', () => {
    for (const forbiddenLockfile of manifest.forbiddenLockfiles) {
      expect(forbiddenLockfile.path).not.toBe(manifest.allowedLockfile.path);
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

  test('requiredRuntimeTarget runtime command begins with the Bun runtime program and uses the pinned script-runner prefix', () => {
    const runtimeRole = manifest.bunRoles.find((bunRole) => bunRole.role === 'runtime');
    const scriptRunnerRole = manifest.bunRoles.find((bunRole) => bunRole.role === 'script-runner');
    expect(runtimeRole).toBeDefined();
    expect(scriptRunnerRole).toBeDefined();
    expect(manifest.requiredRuntimeTarget.runtimeCommand.startsWith(`${runtimeRole!.commandPrefix} `)).toBe(true);
    expect(manifest.requiredRuntimeTarget.runtimeCommand.startsWith(`${scriptRunnerRole!.commandPrefix} `)).toBe(true);
  });

  test('currentWorkspace pins package.json with only the format and start scripts, both starting with "bun run"', async () => {
    expect(manifest.currentWorkspace.packageJsonPath).toBe(PACKAGE_JSON_PATH);
    expect(existsSync(manifest.currentWorkspace.packageJsonPath)).toBe(true);
    expect(manifest.currentWorkspace.scriptNames).toEqual(['format', 'start']);
    expect(manifest.currentWorkspace.scriptCommandPrefixes.format).toBe('bun run');
    expect(manifest.currentWorkspace.scriptCommandPrefixes.start).toBe('bun run');
    expect(manifest.currentWorkspace.everyScriptUsesBun).toBe(true);

    const packageJson = (await Bun.file(PACKAGE_JSON_PATH).json()) as { scripts?: Record<string, string> };
    const scripts = packageJson.scripts ?? {};
    expect(Object.keys(scripts).sort()).toEqual([...manifest.currentWorkspace.scriptNames].sort());
    for (const scriptName of manifest.currentWorkspace.scriptNames) {
      const scriptValue = scripts[scriptName];
      expect(typeof scriptValue).toBe('string');
      const expectedPrefix = manifest.currentWorkspace.scriptCommandPrefixes[scriptName as keyof typeof manifest.currentWorkspace.scriptCommandPrefixes];
      expect(scriptValue!.startsWith(`${expectedPrefix} `)).toBe(true);
    }
  });

  test('no package.json script value begins with any forbidden runtime, package manager, script runner, or test runner token', async () => {
    const packageJson = (await Bun.file(PACKAGE_JSON_PATH).json()) as { scripts?: Record<string, string> };
    const scriptValues = Object.values(packageJson.scripts ?? {});
    const allForbiddenFirstTokens = [...manifest.forbiddenRuntimePrograms, ...manifest.forbiddenPackageManagers, ...manifest.forbiddenScriptRunners, ...manifest.forbiddenTestRunners];
    for (const scriptValue of scriptValues) {
      const firstToken = scriptValue.trim().split(/\s+/)[0];
      expect(firstToken).toBeDefined();
      expect(allForbiddenFirstTokens).not.toContain(firstToken);
    }
  });

  test('package.json does not list any forbidden runtime, package manager, script runner, or test runner as a dependency', async () => {
    const packageJson = (await Bun.file(PACKAGE_JSON_PATH).json()) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    const allDependencyNames = [...Object.keys(packageJson.dependencies ?? {}), ...Object.keys(packageJson.devDependencies ?? {})];
    const allForbiddenNames = [...manifest.forbiddenRuntimePrograms, ...manifest.forbiddenPackageManagers, ...manifest.forbiddenScriptRunners, ...manifest.forbiddenTestRunners];
    for (const forbiddenName of allForbiddenNames) {
      expect(allDependencyNames).not.toContain(forbiddenName);
    }
  });

  test('control-center manifest cross-reference exists and runtimeTarget agrees with the required runtime command', () => {
    expect(manifest.controlCenterManifestPath).toBe('plan_fps/manifests/00-002-declare-plan-fps-control-center.json');
    expect(existsSync(manifest.controlCenterManifestPath)).toBe(true);
    expect(controlCenterManifest.runtimeTarget).toBe(manifest.requiredRuntimeTarget.runtimeCommand);
  });

  test('reject-compiled-exe manifest cross-reference exists and its runtime target agrees with this manifest', () => {
    expect(manifest.rejectCompiledExeManifestPath).toBe('plan_fps/manifests/00-004-reject-compiled-exe-target.json');
    expect(existsSync(manifest.rejectCompiledExeManifestPath)).toBe(true);
    expect(rejectCompiledExeManifest.requiredRuntimeTarget.runtimeCommand).toBe(manifest.requiredRuntimeTarget.runtimeCommand);
    expect(rejectCompiledExeManifest.requiredRuntimeTarget.decisionId).toBe(manifest.requiredRuntimeTarget.decisionId);
  });

  test('every evidencePath exists on disk, lives outside read-only reference roots, and the list contains no duplicates', () => {
    expect(Array.isArray(manifest.evidencePaths)).toBe(true);
    expect(manifest.evidencePaths.length).toBeGreaterThanOrEqual(7);
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
    expect(manifest.evidencePaths).toContain(BUN_LOCK_PATH);
    expect(manifest.evidencePaths).toContain(AGENTS_MD_PATH);
    expect(manifest.evidencePaths).toContain(manifest.controlCenterManifestPath);
    expect(manifest.evidencePaths).toContain(manifest.requiredRuntimeTarget.manifestPath);
    expect(manifest.evidencePaths).toContain(manifest.rejectCompiledExeManifestPath);
    expect(new Set(manifest.evidencePaths).size).toBe(manifest.evidencePaths.length);
  });

  test('rationale pins Bun as the four-way role set, the runtime command, and the lockfile policy', () => {
    expect(typeof manifest.rationale).toBe('string');
    expect(manifest.rationale.length).toBeGreaterThan(0);
    expect(manifest.rationale).toContain('runtime');
    expect(manifest.rationale).toContain('package manager');
    expect(manifest.rationale).toContain('script runner');
    expect(manifest.rationale).toContain('test runner');
    expect(manifest.rationale).toContain('bun run doom.ts');
    expect(manifest.rationale).toContain('D-FPS-003');
    expect(manifest.rationale).toContain('bun.lock');
  });

  test('DECISION_LOG.md records D-FPS-006 as accepted, pins the Bun-only sentence, and cites this manifest as evidence', async () => {
    const decisionLogText = await Bun.file(DECISION_LOG_PATH).text();
    const sectionStart = decisionLogText.indexOf(`## ${manifest.decisionId}`);
    expect(sectionStart).toBeGreaterThanOrEqual(0);

    const afterHeader = decisionLogText.slice(sectionStart);
    const nextSectionIndex = afterHeader.indexOf('\n## ', 1);
    const sectionBody = nextSectionIndex === -1 ? afterHeader : afterHeader.slice(0, nextSectionIndex);

    expect(sectionBody).toContain('status: accepted');
    expect(sectionBody).toContain('Bun is the only runtime, package manager, script runner, and test runner');
    expect(sectionBody).toContain('plan_fps/manifests/00-005-pin-bun-runtime-and-package-manager.json');
  });

  test('AGENTS.md Runtime section pins every forbidden alternative and the canonical lockfile names at a word boundary', async () => {
    const agentsText = await Bun.file(AGENTS_MD_PATH).text();
    const runtimeSectionStart = agentsText.indexOf('## Runtime\n');
    expect(runtimeSectionStart).toBeGreaterThanOrEqual(0);
    const afterHeader = agentsText.slice(runtimeSectionStart);
    const nextSectionIndex = afterHeader.indexOf('\n## ', 1);
    const runtimeSection = nextSectionIndex === -1 ? afterHeader : afterHeader.slice(0, nextSectionIndex);

    for (const runtimeProgram of manifest.forbiddenRuntimePrograms) {
      expect(runtimeSection).toContain(runtimeProgram);
    }
    for (const packageManager of manifest.forbiddenPackageManagers) {
      expect(runtimeSection).toContain(packageManager);
    }
    for (const scriptRunner of manifest.forbiddenScriptRunners) {
      expect(runtimeSection).toContain(scriptRunner);
    }
    for (const testRunner of manifest.forbiddenTestRunners) {
      expect(runtimeSection).toContain(testRunner);
    }

    const allowedLockfilePattern = buildLockfileWordBoundaryPattern(manifest.allowedLockfile.path);
    expect(allowedLockfilePattern.test(runtimeSection)).toBe(true);
    for (const forbiddenLockfile of manifest.forbiddenLockfiles) {
      const forbiddenLockfilePattern = buildLockfileWordBoundaryPattern(forbiddenLockfile.path);
      expect(forbiddenLockfilePattern.test(runtimeSection)).toBe(true);
    }
  });
});

function buildLockfileWordBoundaryPattern(lockfilePath: string): RegExp {
  const escapedPath = lockfilePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escapedPath}\\b`);
}
