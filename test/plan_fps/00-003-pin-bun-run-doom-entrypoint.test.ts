import { describe, expect, test } from 'bun:test';

import { existsSync } from 'node:fs';

import classificationManifest from '../../plan_fps/manifests/existing-plan-classification.json';
import controlCenterManifest from '../../plan_fps/manifests/00-002-declare-plan-fps-control-center.json';
import manifest from '../../plan_fps/manifests/00-003-pin-bun-run-doom-entrypoint.json';

const README_PATH = 'plan_fps/README.md';
const CHECKLIST_PATH = 'plan_fps/MASTER_CHECKLIST.md';
const DECISION_LOG_PATH = 'plan_fps/DECISION_LOG.md';
const PACKAGE_JSON_PATH = 'package.json';
const TSCONFIG_JSON_PATH = 'tsconfig.json';

describe('pin-bun-run-doom-entrypoint manifest', () => {
  test('locks schemaVersion 1 and ties the decision to D-FPS-003', () => {
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.decisionId).toBe('D-FPS-003');
  });

  test('locks the runtime command contract as the literal string `bun run doom.ts`', () => {
    expect(manifest.runtimeCommand).toBe('bun run doom.ts');
  });

  test('decomposes the command contract into program=bun, subcommand=run, entryFile=doom.ts', () => {
    expect(manifest.commandContract.kind).toBe('bun-run-script');
    expect(manifest.commandContract.program).toBe('bun');
    expect(manifest.commandContract.subcommand).toBe('run');
    expect(manifest.commandContract.entryFile).toBe('doom.ts');
  });

  test('runtimeCommand is exactly program + space + subcommand + space + entryFile', () => {
    const composed = `${manifest.commandContract.program} ${manifest.commandContract.subcommand} ${manifest.commandContract.entryFile}`;
    expect(composed).toBe(manifest.runtimeCommand);
  });

  test('pins the entry point at workspace root doom.ts and records that it is not yet on disk', () => {
    expect(manifest.entryPoint.workspaceRelativePath).toBe('doom.ts');
    expect(manifest.entryPoint.workspaceAbsolutePath).toBe('D:/Projects/doom-in-typescript/doom.ts');
    expect(manifest.entryPoint.workspaceRelativePath).toBe(manifest.commandContract.entryFile);
    expect(manifest.entryPoint.presentOnDisk).toBe(false);
    expect(existsSync(manifest.entryPoint.workspaceRelativePath)).toBe(false);
  });

  test('assigns the implementation owner to step 03-002 wire-root-doom-ts-entrypoint and the file exists', () => {
    expect(manifest.entryPoint.ownerStepId).toBe('03-002');
    expect(manifest.entryPoint.ownerStepFilePath).toBe('plan_fps/steps/03-002-wire-root-doom-ts-entrypoint.md');
    expect(existsSync(manifest.entryPoint.ownerStepFilePath)).toBe(true);
  });

  test('records the current package.json start script and entry file, and flags that they do not match the contract', () => {
    expect(manifest.currentLauncher.packageJsonPath).toBe(PACKAGE_JSON_PATH);
    expect(manifest.currentLauncher.scriptName).toBe('start');
    expect(manifest.currentLauncher.scriptValue).toBe('bun run src/main.ts');
    expect(manifest.currentLauncher.entryFile).toBe('src/main.ts');
    expect(manifest.currentLauncher.entryFilePresentOnDisk).toBe(true);
    expect(manifest.currentLauncher.matchesRuntimeCommand).toBe(false);
    expect(manifest.currentLauncher.scriptValue).not.toBe(manifest.runtimeCommand);
  });

  test('current package.json scripts.start matches the recorded scriptValue and the entry file exists on disk', async () => {
    const packageJson = (await Bun.file(PACKAGE_JSON_PATH).json()) as { scripts?: Record<string, string> };
    expect(packageJson.scripts?.[manifest.currentLauncher.scriptName]).toBe(manifest.currentLauncher.scriptValue);
    expect(existsSync(manifest.currentLauncher.entryFile)).toBe(true);
  });

  test('control-center manifest cross-reference exists and ties to the same runtime target string', () => {
    expect(manifest.controlCenterManifestPath).toBe('plan_fps/manifests/00-002-declare-plan-fps-control-center.json');
    expect(existsSync(manifest.controlCenterManifestPath)).toBe(true);
    expect(controlCenterManifest.runtimeTarget).toBe(manifest.runtimeCommand);
  });

  test('every evidence path exists on disk and lives outside the read-only reference roots', () => {
    expect(Array.isArray(manifest.evidencePaths)).toBe(true);
    expect(manifest.evidencePaths.length).toBeGreaterThanOrEqual(6);
    for (const evidencePath of manifest.evidencePaths) {
      expect(typeof evidencePath).toBe('string');
      expect(existsSync(evidencePath)).toBe(true);
      expect(evidencePath.startsWith('doom/')).toBe(false);
      expect(evidencePath.startsWith('iwad/')).toBe(false);
      expect(evidencePath.startsWith('reference/')).toBe(false);
    }
    expect(manifest.evidencePaths).toContain(PACKAGE_JSON_PATH);
    expect(manifest.evidencePaths).toContain('src/main.ts');
    expect(manifest.evidencePaths).toContain(README_PATH);
    expect(manifest.evidencePaths).toContain(CHECKLIST_PATH);
    expect(manifest.evidencePaths).toContain(DECISION_LOG_PATH);
    expect(manifest.evidencePaths).toContain(manifest.controlCenterManifestPath);
    expect(manifest.evidencePaths).toContain(manifest.entryPoint.ownerStepFilePath);
  });

  test('rationale pins the runtime command, the current launcher script, and the implementation owner step', () => {
    expect(typeof manifest.rationale).toBe('string');
    expect(manifest.rationale.length).toBeGreaterThan(0);
    expect(manifest.rationale).toContain('bun run doom.ts');
    expect(manifest.rationale).toContain('bun run src/main.ts');
    expect(manifest.rationale).toContain('03-002');
  });

  test('README.md still pins the runtime command verbatim under the Final command line', async () => {
    const readmeText = await Bun.file(README_PATH).text();
    expect(readmeText).toContain(`Final command: \`${manifest.runtimeCommand}\``);
  });

  test('MASTER_CHECKLIST.md Runtime target line matches the manifest runtime command', async () => {
    const checklistText = await Bun.file(CHECKLIST_PATH).text();
    expect(checklistText).toContain(`Runtime target: \`${manifest.runtimeCommand}\``);
  });

  test('DECISION_LOG.md records D-FPS-003 as accepted, pins the exact runtime command, and cites this manifest as evidence', async () => {
    const decisionLogText = await Bun.file(DECISION_LOG_PATH).text();
    const sectionStart = decisionLogText.indexOf(`## ${manifest.decisionId}`);
    expect(sectionStart).toBeGreaterThanOrEqual(0);

    const afterHeader = decisionLogText.slice(sectionStart);
    const nextSectionIndex = afterHeader.indexOf('\n## ', 1);
    const sectionBody = nextSectionIndex === -1 ? afterHeader : afterHeader.slice(0, nextSectionIndex);

    expect(sectionBody).toContain('status: accepted');
    expect(sectionBody).toContain('The C1 runtime target is exactly `bun run doom.ts`.');
    expect(sectionBody).toContain('plan_fps/manifests/00-003-pin-bun-run-doom-entrypoint.json');
  });

  test('package.json and tsconfig.json (the read-only inputs to this step) exist on disk', () => {
    expect(existsSync(PACKAGE_JSON_PATH)).toBe(true);
    expect(existsSync(TSCONFIG_JSON_PATH)).toBe(true);
  });

  test('command contract entry file matches the basename portion of the entry point workspace path', () => {
    const relativePath = manifest.entryPoint.workspaceRelativePath;
    const lastSlashIndex = relativePath.lastIndexOf('/');
    const basename = lastSlashIndex === -1 ? relativePath : relativePath.slice(lastSlashIndex + 1);
    expect(basename).toBe(manifest.commandContract.entryFile);
  });

  test('currentLauncher scriptValue contains the recorded entryFile and both agree with the 00-001 classification manifest', () => {
    expect(manifest.currentLauncher.scriptValue).toContain(manifest.currentLauncher.entryFile);
    expect(manifest.currentLauncher.scriptValue.startsWith('bun run ')).toBe(true);
    expect(manifest.currentLauncher.scriptValue).toBe(classificationManifest.playableParityGaps.currentPackageStartScript);
    expect(manifest.currentLauncher.entryFile).toBe(classificationManifest.playableParityGaps.currentEntryPointFile);
  });

  test('runtimeCommand agrees with the 00-001 classification manifest requiredRuntimeCommand', () => {
    expect(manifest.runtimeCommand).toBe(classificationManifest.playableParityGaps.requiredRuntimeCommand);
    expect(manifest.commandContract.entryFile).toBe(classificationManifest.playableParityGaps.missingEntryPointFile);
  });

  test('evidencePaths contains no duplicate entries', () => {
    expect(new Set(manifest.evidencePaths).size).toBe(manifest.evidencePaths.length);
  });
});
