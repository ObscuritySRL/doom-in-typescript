import { describe, expect, test } from 'bun:test';

import { existsSync } from 'node:fs';

import controlCenterManifest from '../../plan_fps/manifests/00-002-declare-plan-fps-control-center.json';
import entryPointManifest from '../../plan_fps/manifests/00-003-pin-bun-run-doom-entrypoint.json';
import manifest from '../../plan_fps/manifests/00-004-reject-compiled-exe-target.json';

const README_PATH = 'plan_fps/README.md';
const CHECKLIST_PATH = 'plan_fps/MASTER_CHECKLIST.md';
const DECISION_LOG_PATH = 'plan_fps/DECISION_LOG.md';
const FACT_LOG_PATH = 'plan_fps/FACT_LOG.md';
const PACKAGE_JSON_PATH = 'package.json';
const TSCONFIG_JSON_PATH = 'tsconfig.json';

describe('reject-compiled-exe-target manifest', () => {
  test('locks schemaVersion 1 and ties the decision to D-FPS-005', () => {
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.decisionId).toBe('D-FPS-005');
  });

  test('pins exactly four rejected target kinds in the canonical order', () => {
    expect(manifest.rejectedTargets.length).toBe(4);
    expect(manifest.rejectedTargets.map((rejectedTarget) => rejectedTarget.kind)).toEqual(['compiled-executable', 'wrapper-executable', 'installer', 'packaged-binary']);
  });

  test('every rejectedTargets entry has a non-empty string kind and description, with unique kinds and unique descriptions', () => {
    const seenKinds = new Set<string>();
    const seenDescriptions = new Set<string>();
    for (const target of manifest.rejectedTargets) {
      expect(typeof target.kind).toBe('string');
      expect(target.kind.length).toBeGreaterThan(0);
      expect(typeof target.description).toBe('string');
      expect(target.description.length).toBeGreaterThan(0);
      expect(seenKinds.has(target.kind)).toBe(false);
      seenKinds.add(target.kind);
      expect(seenDescriptions.has(target.description)).toBe(false);
      seenDescriptions.add(target.description);
    }
    expect(seenKinds.size).toBe(manifest.rejectedTargets.length);
    expect(seenDescriptions.size).toBe(manifest.rejectedTargets.length);
  });

  test('forbiddenArtifactExtensions starts each entry with a dot, contains .exe and .msi, and is unique', () => {
    expect(Array.isArray(manifest.forbiddenArtifactExtensions)).toBe(true);
    expect(manifest.forbiddenArtifactExtensions).toContain('.exe');
    expect(manifest.forbiddenArtifactExtensions).toContain('.msi');
    for (const extension of manifest.forbiddenArtifactExtensions) {
      expect(typeof extension).toBe('string');
      expect(extension.startsWith('.')).toBe(true);
      expect(extension.length).toBeGreaterThan(1);
      expect(extension).toBe(extension.toLowerCase());
    }
    expect(new Set(manifest.forbiddenArtifactExtensions).size).toBe(manifest.forbiddenArtifactExtensions.length);
  });

  test('forbiddenBuildCommands pins the Bun compile command and common standalone packagers and is unique', () => {
    expect(manifest.forbiddenBuildCommands).toContain('bun build --compile');
    expect(manifest.forbiddenBuildCommands).toContain('pkg');
    expect(manifest.forbiddenBuildCommands).toContain('nexe');
    for (const command of manifest.forbiddenBuildCommands) {
      expect(typeof command).toBe('string');
      expect(command.length).toBeGreaterThan(0);
    }
    expect(new Set(manifest.forbiddenBuildCommands).size).toBe(manifest.forbiddenBuildCommands.length);
  });

  test('forbiddenPackageJsonScriptNames contains expected exe/compile/build/package variants, is all-lowercase, and is unique', () => {
    expect(manifest.forbiddenPackageJsonScriptNames).toContain('build-exe');
    expect(manifest.forbiddenPackageJsonScriptNames).toContain('build:exe');
    expect(manifest.forbiddenPackageJsonScriptNames).toContain('compile-exe');
    expect(manifest.forbiddenPackageJsonScriptNames).toContain('compile:exe');
    expect(manifest.forbiddenPackageJsonScriptNames).toContain('make-exe');
    expect(manifest.forbiddenPackageJsonScriptNames).toContain('dist-exe');
    expect(manifest.forbiddenPackageJsonScriptNames).toContain('package-exe');
    expect(manifest.forbiddenPackageJsonScriptNames).toContain('bundle-exe');
    for (const scriptName of manifest.forbiddenPackageJsonScriptNames) {
      expect(typeof scriptName).toBe('string');
      expect(scriptName.length).toBeGreaterThan(0);
      expect(scriptName).toBe(scriptName.toLowerCase());
    }
    expect(new Set(manifest.forbiddenPackageJsonScriptNames).size).toBe(manifest.forbiddenPackageJsonScriptNames.length);
  });

  test('requiredRuntimeTarget cross-references D-FPS-003 and matches the 00-003 manifest runtime command', () => {
    expect(manifest.requiredRuntimeTarget.runtimeCommand).toBe('bun run doom.ts');
    expect(manifest.requiredRuntimeTarget.decisionId).toBe('D-FPS-003');
    expect(manifest.requiredRuntimeTarget.manifestPath).toBe('plan_fps/manifests/00-003-pin-bun-run-doom-entrypoint.json');
    expect(existsSync(manifest.requiredRuntimeTarget.manifestPath)).toBe(true);
    expect(entryPointManifest.runtimeCommand).toBe(manifest.requiredRuntimeTarget.runtimeCommand);
    expect(entryPointManifest.decisionId).toBe(manifest.requiredRuntimeTarget.decisionId);
  });

  test('currentWorkspace pins package.json and tsconfig.json with noEmit true and both files exist on disk', async () => {
    expect(manifest.currentWorkspace.packageJsonPath).toBe(PACKAGE_JSON_PATH);
    expect(manifest.currentWorkspace.tsconfigJsonPath).toBe(TSCONFIG_JSON_PATH);
    expect(existsSync(manifest.currentWorkspace.packageJsonPath)).toBe(true);
    expect(existsSync(manifest.currentWorkspace.tsconfigJsonPath)).toBe(true);
    expect(manifest.currentWorkspace.tsconfigNoEmit).toBe(true);
    const tsconfig = (await Bun.file(TSCONFIG_JSON_PATH).json()) as { compilerOptions?: { noEmit?: boolean } };
    expect(tsconfig.compilerOptions?.noEmit).toBe(true);
  });

  test('every currentWorkspace.forbiddenArtifactCheck path is absent on disk today', () => {
    expect(manifest.currentWorkspace.forbiddenArtifactChecks.length).toBeGreaterThan(0);
    const seenPaths = new Set<string>();
    for (const check of manifest.currentWorkspace.forbiddenArtifactChecks) {
      expect(typeof check.path).toBe('string');
      expect(check.path.length).toBeGreaterThan(0);
      expect(check.expectedPresentOnDisk).toBe(false);
      expect(existsSync(check.path)).toBe(false);
      expect(seenPaths.has(check.path)).toBe(false);
      seenPaths.add(check.path);
      let endsWithForbiddenExtension = false;
      for (const extension of manifest.forbiddenArtifactExtensions) {
        if (check.path.toLowerCase().endsWith(extension)) {
          endsWithForbiddenExtension = true;
          break;
        }
      }
      expect(endsWithForbiddenExtension).toBe(true);
    }
  });

  test('package.json scripts do not contain any forbidden script name', async () => {
    const packageJson = (await Bun.file(PACKAGE_JSON_PATH).json()) as { scripts?: Record<string, string> };
    const scriptNames = Object.keys(packageJson.scripts ?? {});
    for (const forbiddenName of manifest.forbiddenPackageJsonScriptNames) {
      expect(scriptNames).not.toContain(forbiddenName);
    }
  });

  test('package.json script values do not contain any forbidden build command string', async () => {
    const packageJson = (await Bun.file(PACKAGE_JSON_PATH).json()) as { scripts?: Record<string, string> };
    const scriptValues = Object.values(packageJson.scripts ?? {});
    for (const forbiddenCommand of manifest.forbiddenBuildCommands) {
      for (const scriptValue of scriptValues) {
        expect(scriptValue.includes(forbiddenCommand)).toBe(false);
      }
    }
  });

  test('control-center manifest cross-reference exists and runtimeTarget agrees with the required runtime command', () => {
    expect(manifest.controlCenterManifestPath).toBe('plan_fps/manifests/00-002-declare-plan-fps-control-center.json');
    expect(existsSync(manifest.controlCenterManifestPath)).toBe(true);
    expect(controlCenterManifest.runtimeTarget).toBe(manifest.requiredRuntimeTarget.runtimeCommand);
  });

  test('README.md contains the rejection line verbatim and the line names every rejectedTargets humanized phrase', async () => {
    const readmeText = await Bun.file(README_PATH).text();
    expect(readmeText).toContain(manifest.readmeRejectionLine);
    expect(manifest.readmeRejectionLine).toContain('compiled executable');
    expect(manifest.readmeRejectionLine).toContain('wrapper executable');
    expect(manifest.readmeRejectionLine).toContain('installer');
    expect(manifest.readmeRejectionLine).toContain('packaged binary');
  });

  test('every evidencePath exists on disk, lives outside read-only reference roots, and the list contains no duplicates', () => {
    expect(Array.isArray(manifest.evidencePaths)).toBe(true);
    expect(manifest.evidencePaths.length).toBeGreaterThanOrEqual(6);
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
    expect(manifest.evidencePaths).toContain(manifest.controlCenterManifestPath);
    expect(manifest.evidencePaths).toContain(manifest.requiredRuntimeTarget.manifestPath);
    expect(new Set(manifest.evidencePaths).size).toBe(manifest.evidencePaths.length);
  });

  test('rationale pins the runtime command, the required-target manifest cross-reference, and the tsconfig noEmit posture', () => {
    expect(typeof manifest.rationale).toBe('string');
    expect(manifest.rationale.length).toBeGreaterThan(0);
    expect(manifest.rationale).toContain('bun run doom.ts');
    expect(manifest.rationale).toContain('D-FPS-003');
    expect(manifest.rationale).toContain('plan_fps/manifests/00-003-pin-bun-run-doom-entrypoint.json');
    expect(manifest.rationale).toContain('noEmit');
  });

  test('DECISION_LOG.md records D-FPS-005 as accepted, pins the exact rejection sentence, and cites this manifest as evidence', async () => {
    const decisionLogText = await Bun.file(DECISION_LOG_PATH).text();
    const sectionStart = decisionLogText.indexOf(`## ${manifest.decisionId}`);
    expect(sectionStart).toBeGreaterThanOrEqual(0);

    const afterHeader = decisionLogText.slice(sectionStart);
    const nextSectionIndex = afterHeader.indexOf('\n## ', 1);
    const sectionBody = nextSectionIndex === -1 ? afterHeader : afterHeader.slice(0, nextSectionIndex);

    expect(sectionBody).toContain('status: accepted');
    expect(sectionBody).toContain('Reject compiled-binary delivery targets for the C1 playable parity product.');
    expect(sectionBody).toContain('No compiled executable, wrapper executable, installer, or packaged binary.');
    expect(sectionBody).toContain('plan_fps/manifests/00-004-reject-compiled-exe-target.json');
  });

  test('workspace root contains no file ending in any forbiddenArtifactExtension', async () => {
    const rootGlob = new Bun.Glob('*');
    const rootFiles: string[] = [];
    for await (const entry of rootGlob.scan({ cwd: '.', onlyFiles: true })) {
      rootFiles.push(entry);
    }
    for (const rootFile of rootFiles) {
      const lowered = rootFile.toLowerCase();
      for (const extension of manifest.forbiddenArtifactExtensions) {
        expect(lowered.endsWith(extension)).toBe(false);
      }
    }
  });
});
