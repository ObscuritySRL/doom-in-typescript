import { describe, expect, test } from 'bun:test';

import { existsSync, statSync } from 'node:fs';

const AGENTS_PATH = 'AGENTS.md';
const CLAUDE_PATH = 'CLAUDE.md';
const MASTER_CHECKLIST_PATH = 'plan_vanilla_parity/MASTER_CHECKLIST.md';
const PACKAGE_JSON_PATH = 'package.json';
const PIN_DOCUMENT_PATH = 'plan_vanilla_parity/ban-non-bun-runtime-and-package-commands.md';
const PLAN_PROMPT_PATH = 'plan_vanilla_parity/PROMPT.md';
const PLAN_README_PATH = 'plan_vanilla_parity/README.md';
const STEP_FILE_PATH = 'plan_vanilla_parity/steps/00-007-ban-non-bun-runtime-and-package-commands.md';
const VALIDATE_PLAN_PATH = 'plan_vanilla_parity/validate-plan.ts';

const CANONICAL_SANCTIONED_BUN_COMMANDS: readonly string[] = ['bun', 'bun add', 'bun build', 'bun install', 'bun remove', 'bun run', 'bun test', 'bun x'];
const CANONICAL_FORBIDDEN_RUNTIME_COMMANDS: readonly string[] = ['node', 'ts-node', 'tsx'];
const CANONICAL_FORBIDDEN_PACKAGE_MANAGER_COMMANDS: readonly string[] = ['npm', 'npx', 'pnpm', 'yarn'];
const CANONICAL_FORBIDDEN_TEST_RUNNER_COMMANDS: readonly string[] = ['jest', 'mocha', 'vitest'];
const CANONICAL_FORBIDDEN_COMMAND_LIST: readonly string[] = ['jest', 'mocha', 'node', 'npm', 'npx', 'pnpm', 'ts-node', 'tsx', 'vitest', 'yarn'];
const CANONICAL_FORBIDDEN_LOCKFILES: readonly string[] = ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock'];
const CANONICAL_SANCTIONED_LOCKFILE = 'bun.lock';
const CANONICAL_BUN_NATIVE_API_NAMES: readonly string[] = ['Bun.argv', 'Bun.env', 'Bun.file', 'Bun.serve', 'Bun.sleep', 'Bun.spawn', 'Bun.write', 'bun:ffi', 'bun:sqlite', 'bun:test'];
const CANONICAL_BUN_WIN32_PACKAGE_NAMES: readonly string[] = ['@bun-win32/core', '@bun-win32/gdi32', '@bun-win32/kernel32', '@bun-win32/user32', '@bun-win32/winmm'];

interface PinBanNonBunDocument {
  readonly acceptancePhrasing: string;
  readonly bunExclusivityRule: string;
  readonly bunNativeApiPreference: string;
  readonly emulatedVanillaVersion: string;
  readonly evidenceLocations: readonly string[];
  readonly forbiddenCommandList: readonly string[];
  readonly forbiddenLockfiles: readonly string[];
  readonly forbiddenPackageManagerCommands: readonly string[];
  readonly forbiddenRuntimeCommands: readonly string[];
  readonly forbiddenTestRunnerCommands: readonly string[];
  readonly referenceEngine: string;
  readonly referenceEngineVersion: string;
  readonly sanctionedBunCommands: readonly string[];
  readonly sanctionedLockfile: string;
  readonly scopeName: string;
  readonly verificationCommandRule: string;
}

function extractSection(documentText: string, sectionHeading: string): string {
  const heading = `## ${sectionHeading}`;
  const sectionStart = documentText.indexOf(`\n${heading}\n`);
  if (sectionStart === -1) {
    throw new Error(`Section "${sectionHeading}" not found in ban non-Bun runtime and package commands document.`);
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

function parsePinBanNonBunDocument(documentText: string): PinBanNonBunDocument {
  const sanctionedBunCommands = extractBullets(documentText, 'sanctioned bun commands');
  if (sanctionedBunCommands.length === 0) {
    throw new Error('sanctioned bun commands must list at least one command.');
  }
  const forbiddenRuntimeCommands = extractBullets(documentText, 'forbidden runtime commands');
  if (forbiddenRuntimeCommands.length === 0) {
    throw new Error('forbidden runtime commands must list at least one command.');
  }
  const forbiddenPackageManagerCommands = extractBullets(documentText, 'forbidden package manager commands');
  if (forbiddenPackageManagerCommands.length === 0) {
    throw new Error('forbidden package manager commands must list at least one command.');
  }
  const forbiddenTestRunnerCommands = extractBullets(documentText, 'forbidden test runner commands');
  if (forbiddenTestRunnerCommands.length === 0) {
    throw new Error('forbidden test runner commands must list at least one command.');
  }
  const forbiddenCommandList = extractBullets(documentText, 'forbidden command list');
  if (forbiddenCommandList.length === 0) {
    throw new Error('forbidden command list must list at least one command.');
  }
  const forbiddenLockfiles = extractBullets(documentText, 'forbidden lockfiles');
  if (forbiddenLockfiles.length === 0) {
    throw new Error('forbidden lockfiles must list at least one lockfile.');
  }

  return {
    acceptancePhrasing: extractSection(documentText, 'acceptance phrasing'),
    bunExclusivityRule: extractSection(documentText, 'bun exclusivity rule'),
    bunNativeApiPreference: extractSection(documentText, 'bun native api preference'),
    emulatedVanillaVersion: extractSection(documentText, 'emulated vanilla version'),
    evidenceLocations: extractBullets(documentText, 'evidence locations'),
    forbiddenCommandList,
    forbiddenLockfiles,
    forbiddenPackageManagerCommands,
    forbiddenRuntimeCommands,
    forbiddenTestRunnerCommands,
    referenceEngine: extractSection(documentText, 'reference engine'),
    referenceEngineVersion: extractSection(documentText, 'reference engine version'),
    sanctionedBunCommands,
    sanctionedLockfile: extractSection(documentText, 'sanctioned lockfile'),
    scopeName: extractSection(documentText, 'scope name'),
    verificationCommandRule: extractSection(documentText, 'verification command rule'),
  };
}

async function loadPinBanNonBunDocument(): Promise<PinBanNonBunDocument> {
  const documentText = await Bun.file(PIN_DOCUMENT_PATH).text();
  return parsePinBanNonBunDocument(documentText);
}

describe('ban non-Bun runtime and package commands declaration', () => {
  test('pin document exists at the canonical path', () => {
    expect(existsSync(PIN_DOCUMENT_PATH)).toBe(true);
    expect(statSync(PIN_DOCUMENT_PATH).isFile()).toBe(true);
  });

  test('parses every required governance field with the expected vanilla parity values', async () => {
    const parsed = await loadPinBanNonBunDocument();
    expect(parsed.scopeName).toBe('vanilla DOOM 1.9 Bun runtime and package command exclusivity');
    expect(parsed.emulatedVanillaVersion).toBe('1.9');
    expect(parsed.referenceEngine).toBe('Chocolate Doom');
    expect(parsed.referenceEngineVersion).toBe('2.2.1');
  });

  test('sanctioned bun commands cover the eight canonical Bun command surfaces, are unique, and ASCIIbetically sorted', async () => {
    const parsed = await loadPinBanNonBunDocument();
    expect(parsed.sanctionedBunCommands).toEqual(CANONICAL_SANCTIONED_BUN_COMMANDS);
    expect(new Set(parsed.sanctionedBunCommands).size).toBe(parsed.sanctionedBunCommands.length);
    const ascendingSortedCommands = [...parsed.sanctionedBunCommands].sort();
    expect(parsed.sanctionedBunCommands).toEqual(ascendingSortedCommands);
  });

  test('forbidden runtime commands cover node, ts-node, and tsx, are unique, and ASCIIbetically sorted', async () => {
    const parsed = await loadPinBanNonBunDocument();
    expect(parsed.forbiddenRuntimeCommands).toEqual(CANONICAL_FORBIDDEN_RUNTIME_COMMANDS);
    expect(new Set(parsed.forbiddenRuntimeCommands).size).toBe(parsed.forbiddenRuntimeCommands.length);
    const ascendingSortedCommands = [...parsed.forbiddenRuntimeCommands].sort();
    expect(parsed.forbiddenRuntimeCommands).toEqual(ascendingSortedCommands);
  });

  test('forbidden package manager commands cover npm, npx, pnpm, and yarn, are unique, and ASCIIbetically sorted', async () => {
    const parsed = await loadPinBanNonBunDocument();
    expect(parsed.forbiddenPackageManagerCommands).toEqual(CANONICAL_FORBIDDEN_PACKAGE_MANAGER_COMMANDS);
    expect(new Set(parsed.forbiddenPackageManagerCommands).size).toBe(parsed.forbiddenPackageManagerCommands.length);
    const ascendingSortedCommands = [...parsed.forbiddenPackageManagerCommands].sort();
    expect(parsed.forbiddenPackageManagerCommands).toEqual(ascendingSortedCommands);
  });

  test('forbidden test runner commands cover jest, mocha, and vitest, are unique, and ASCIIbetically sorted', async () => {
    const parsed = await loadPinBanNonBunDocument();
    expect(parsed.forbiddenTestRunnerCommands).toEqual(CANONICAL_FORBIDDEN_TEST_RUNNER_COMMANDS);
    expect(new Set(parsed.forbiddenTestRunnerCommands).size).toBe(parsed.forbiddenTestRunnerCommands.length);
    const ascendingSortedCommands = [...parsed.forbiddenTestRunnerCommands].sort();
    expect(parsed.forbiddenTestRunnerCommands).toEqual(ascendingSortedCommands);
  });

  test('forbidden command list is the union of forbidden runtime + package manager + test runner commands, is unique, and ASCIIbetically sorted', async () => {
    const parsed = await loadPinBanNonBunDocument();
    expect(parsed.forbiddenCommandList).toEqual(CANONICAL_FORBIDDEN_COMMAND_LIST);
    expect(parsed.forbiddenCommandList).toHaveLength(10);
    expect(new Set(parsed.forbiddenCommandList).size).toBe(parsed.forbiddenCommandList.length);
    const ascendingSortedCommands = [...parsed.forbiddenCommandList].sort();
    expect(parsed.forbiddenCommandList).toEqual(ascendingSortedCommands);
    const expectedUnion = [...new Set([...parsed.forbiddenRuntimeCommands, ...parsed.forbiddenPackageManagerCommands, ...parsed.forbiddenTestRunnerCommands])].sort();
    expect(parsed.forbiddenCommandList).toEqual(expectedUnion);
  });

  test('sanctioned bun commands and the comprehensive forbidden command list are disjoint sets', async () => {
    const parsed = await loadPinBanNonBunDocument();
    const forbiddenSet = new Set<string>(parsed.forbiddenCommandList);
    for (const sanctionedCommand of parsed.sanctionedBunCommands) {
      expect(forbiddenSet.has(sanctionedCommand)).toBe(false);
      const firstToken = sanctionedCommand.split(/\s+/)[0] ?? '';
      expect(forbiddenSet.has(firstToken)).toBe(false);
    }
  });

  test('forbidden lockfiles cover package-lock.json, pnpm-lock.yaml, and yarn.lock, are unique, and ASCIIbetically sorted', async () => {
    const parsed = await loadPinBanNonBunDocument();
    expect(parsed.forbiddenLockfiles).toEqual(CANONICAL_FORBIDDEN_LOCKFILES);
    expect(new Set(parsed.forbiddenLockfiles).size).toBe(parsed.forbiddenLockfiles.length);
    const ascendingSortedLockfiles = [...parsed.forbiddenLockfiles].sort();
    expect(parsed.forbiddenLockfiles).toEqual(ascendingSortedLockfiles);
  });

  test('sanctioned lockfile is bun.lock and the forbidden lockfiles do not overlap', async () => {
    const parsed = await loadPinBanNonBunDocument();
    expect(parsed.sanctionedLockfile).toBe(CANONICAL_SANCTIONED_LOCKFILE);
    expect(parsed.forbiddenLockfiles).not.toContain(parsed.sanctionedLockfile);
  });

  test('on-disk lockfile state matches the rule: bun.lock exists, no forbidden lockfile is committed', async () => {
    const parsed = await loadPinBanNonBunDocument();
    expect(existsSync(parsed.sanctionedLockfile)).toBe(true);
    expect(statSync(parsed.sanctionedLockfile).isFile()).toBe(true);
    for (const forbiddenLockfile of parsed.forbiddenLockfiles) {
      expect(existsSync(forbiddenLockfile)).toBe(false);
    }
  });

  test('bun exclusivity rule pins the AGENTS.md Runtime declaration and the CLAUDE.md Runtime constraints declaration', async () => {
    const parsed = await loadPinBanNonBunDocument();
    expect(parsed.bunExclusivityRule).toContain('Bun');
    expect(parsed.bunExclusivityRule).toContain('runtime');
    expect(parsed.bunExclusivityRule).toContain('package manager');
    expect(parsed.bunExclusivityRule).toContain('script runner');
    expect(parsed.bunExclusivityRule).toContain('test runner');
    expect(parsed.bunExclusivityRule).toContain('AGENTS.md');
    expect(parsed.bunExclusivityRule).toContain('CLAUDE.md');
    expect(parsed.bunExclusivityRule).toContain('This project uses Bun. Always.');
    expect(parsed.bunExclusivityRule).toContain('Bun only');
    expect(parsed.bunExclusivityRule).toContain('no Node.js compatibility paths');
    for (const forbiddenCommand of CANONICAL_FORBIDDEN_COMMAND_LIST) {
      expect(parsed.bunExclusivityRule).toContain(`\`${forbiddenCommand}\``);
    }
  });

  test('bun native api preference names every canonical Bun-native API and every @bun-win32 binding package', async () => {
    const parsed = await loadPinBanNonBunDocument();
    for (const bunNativeApiName of CANONICAL_BUN_NATIVE_API_NAMES) {
      expect(parsed.bunNativeApiPreference).toContain(bunNativeApiName);
    }
    for (const bunWin32PackageName of CANONICAL_BUN_WIN32_PACKAGE_NAMES) {
      expect(parsed.bunNativeApiPreference).toContain(bunWin32PackageName);
    }
    expect(parsed.bunNativeApiPreference).toContain('bun:test');
    expect(parsed.bunNativeApiPreference).toContain('bun test');
  });

  test('verification command rule pins the four canonical verification commands and the validate-plan.ts BANNED_COMMANDS enforcement', async () => {
    const parsed = await loadPinBanNonBunDocument();
    expect(parsed.verificationCommandRule).toContain('bun run format');
    expect(parsed.verificationCommandRule).toContain('bun test <path>');
    expect(parsed.verificationCommandRule).toContain('bun test');
    expect(parsed.verificationCommandRule).toContain('bun x tsc --noEmit --project tsconfig.json');
    expect(parsed.verificationCommandRule).toContain('plan_vanilla_parity/validate-plan.ts');
    expect(parsed.verificationCommandRule).toContain('BANNED_COMMANDS');
    expect(parsed.verificationCommandRule).toContain('verification commands');
    for (const forbiddenCommand of CANONICAL_FORBIDDEN_COMMAND_LIST) {
      expect(parsed.verificationCommandRule).toContain(`\`${forbiddenCommand}\``);
    }
  });

  test('every evidence location exists on disk and is a file', async () => {
    const parsed = await loadPinBanNonBunDocument();
    expect(parsed.evidenceLocations.length).toBeGreaterThan(0);
    expect(new Set(parsed.evidenceLocations).size).toBe(parsed.evidenceLocations.length);
    for (const evidenceLocation of parsed.evidenceLocations) {
      expect(existsSync(evidenceLocation)).toBe(true);
      expect(statSync(evidenceLocation).isFile()).toBe(true);
    }
  });

  test('evidence locations include AGENTS.md, CLAUDE.md, package.json, plan_vanilla_parity README/PROMPT/MASTER_CHECKLIST, and validate-plan.ts', async () => {
    const parsed = await loadPinBanNonBunDocument();
    const requiredEvidence: readonly string[] = [AGENTS_PATH, CLAUDE_PATH, MASTER_CHECKLIST_PATH, PACKAGE_JSON_PATH, PLAN_PROMPT_PATH, PLAN_README_PATH, VALIDATE_PLAN_PATH];
    for (const requiredEvidenceLocation of requiredEvidence) {
      expect(parsed.evidenceLocations).toContain(requiredEvidenceLocation);
    }
  });

  test('AGENTS.md Runtime section pins the same Bun-only declaration this document freezes', async () => {
    const agentsText = await Bun.file(AGENTS_PATH).text();
    expect(agentsText).toContain('## Runtime');
    expect(agentsText).toContain('This project uses Bun. Always.');
    expect(agentsText).toContain('Bun is the runtime, the package manager, the test runner, and the script executor');
    expect(agentsText).toContain('no exceptions');
    expect(agentsText).toContain('no Node.js paths');
    for (const forbiddenCommand of CANONICAL_FORBIDDEN_COMMAND_LIST) {
      expect(agentsText).toContain(`\`${forbiddenCommand}\``);
    }
    for (const bunNativeApiName of CANONICAL_BUN_NATIVE_API_NAMES) {
      expect(agentsText).toContain(`\`${bunNativeApiName}\``);
    }
  });

  test('AGENTS.md pins bun.lock as the lockfile and forbids committing every non-Bun lockfile this document freezes', async () => {
    const agentsText = await Bun.file(AGENTS_PATH).text();
    expect(agentsText).toContain('`bun.lock` is the lockfile');
    for (const forbiddenLockfile of CANONICAL_FORBIDDEN_LOCKFILES) {
      expect(agentsText).toContain(`\`${forbiddenLockfile}\``);
    }
  });

  test('CLAUDE.md Runtime constraints section pins the same Bun-only rule this document freezes', async () => {
    const claudeText = await Bun.file(CLAUDE_PATH).text();
    expect(claudeText).toContain('## Runtime constraints');
    expect(claudeText).toContain('**Bun only.**');
    expect(claudeText).toContain('Runtime, package manager, script runner, and test runner');
    for (const forbiddenCommand of CANONICAL_FORBIDDEN_COMMAND_LIST) {
      expect(claudeText).toContain(`\`${forbiddenCommand}\``);
    }
  });

  test('plan_vanilla_parity validate-plan.ts BANNED_COMMANDS literal contains exactly the forbidden command list this document freezes', async () => {
    const validatePlanText = await Bun.file(VALIDATE_PLAN_PATH).text();
    expect(validatePlanText).toContain('const BANNED_COMMANDS = new Set');
    const bannedCommandsLiteralPattern = /const BANNED_COMMANDS = new Set\(\[([^\]]+)\]\)/;
    const bannedCommandsLiteralMatch = bannedCommandsLiteralPattern.exec(validatePlanText);
    expect(bannedCommandsLiteralMatch).not.toBeNull();
    if (bannedCommandsLiteralMatch === null) {
      return;
    }
    const literalBody = bannedCommandsLiteralMatch[1] ?? '';
    const bannedCommands: readonly string[] = literalBody
      .split(',')
      .map((entry) => entry.trim().replace(/^['"]|['"]$/g, ''))
      .filter((entry) => entry.length > 0);
    expect(bannedCommands).toEqual(CANONICAL_FORBIDDEN_COMMAND_LIST);
  });

  test('plan_vanilla_parity README.md Ralph-loop rules section forbids the same ten non-Bun commands this document freezes', async () => {
    const readmeText = await Bun.file(PLAN_README_PATH).text();
    expect(readmeText).toContain('Never use GitHub API, GitHub apps, PR workflow, npm, yarn, pnpm, npx, node, jest, vitest, mocha, ts-node, or tsx.');
  });

  test('package.json scripts only invoke Bun-native commands and do not call any forbidden runtime, package manager, or test runner', async () => {
    const packageJsonText = await Bun.file(PACKAGE_JSON_PATH).text();
    const packageJson = JSON.parse(packageJsonText) as { readonly scripts?: Readonly<Record<string, string>> };
    const scripts = packageJson.scripts ?? {};
    expect(Object.keys(scripts).length).toBeGreaterThan(0);
    for (const [scriptName, scriptCommand] of Object.entries(scripts)) {
      expect(scriptCommand.startsWith('bun ')).toBe(true);
      const tokens = scriptCommand.split(/\s+/);
      for (const forbiddenCommand of CANONICAL_FORBIDDEN_COMMAND_LIST) {
        expect(tokens).not.toContain(forbiddenCommand);
      }
      expect(scriptName.length).toBeGreaterThan(0);
    }
  });

  test('step 00-007 file declares the governance lane, lists this declaration under its write lock, and lists the focused test under its test files', async () => {
    expect(existsSync(STEP_FILE_PATH)).toBe(true);
    const stepText = await Bun.file(STEP_FILE_PATH).text();
    expect(stepText).toContain('# [ ] STEP 00-007: Ban Non Bun Runtime And Package Commands');
    expect(stepText).toContain('\n## lane\n\ngovernance\n');
    expect(stepText).toContain('- plan_vanilla_parity/ban-non-bun-runtime-and-package-commands.md');
    expect(stepText).toContain('- test/plan_vanilla_parity/ban-non-bun-runtime-and-package-commands.test.ts');
  });

  test('MASTER_CHECKLIST.md row for 00-007 references the canonical step file path and the governance lane', async () => {
    const checklistText = await Bun.file(MASTER_CHECKLIST_PATH).text();
    const expectedPendingRow = '- [ ] `00-007` `ban-non-bun-runtime-and-package-commands` | lane: `governance` | prereqs: `00-006` | file: `plan_vanilla_parity/steps/00-007-ban-non-bun-runtime-and-package-commands.md`';
    const expectedCompletedRow = '- [x] `00-007` `ban-non-bun-runtime-and-package-commands` | lane: `governance` | prereqs: `00-006` | file: `plan_vanilla_parity/steps/00-007-ban-non-bun-runtime-and-package-commands.md`';
    expect(checklistText.includes(expectedPendingRow) || checklistText.includes(expectedCompletedRow)).toBe(true);
  });

  test('acceptance phrasing names the Bun-only canonical phrasing and lists every forbidden command', async () => {
    const parsed = await loadPinBanNonBunDocument();
    expect(parsed.acceptancePhrasing).toBe('Bun is the only sanctioned runtime, package manager, script runner, and test runner; never `jest`, `mocha`, `node`, `npm`, `npx`, `pnpm`, `ts-node`, `tsx`, `vitest`, or `yarn`.');
  });

  test('parser surfaces a meaningful error when a required section is missing (failure mode)', () => {
    const documentTextWithMissingSection = '# Test\n\n## scope name\n\nvanilla DOOM 1.9 Bun runtime and package command exclusivity\n';
    expect(() => parsePinBanNonBunDocument(documentTextWithMissingSection)).toThrow('Section "sanctioned bun commands" not found in ban non-Bun runtime and package commands document.');
  });

  test('parser surfaces a meaningful error when forbidden command list is empty (failure mode)', async () => {
    const validDocumentText = await Bun.file(PIN_DOCUMENT_PATH).text();
    const corruptedDocumentText = validDocumentText.replace(/\n## forbidden command list\n\n- jest\n- mocha\n- node\n- npm\n- npx\n- pnpm\n- ts-node\n- tsx\n- vitest\n- yarn\n/, '\n## forbidden command list\n\nno bullets here\n');
    expect(corruptedDocumentText).not.toBe(validDocumentText);
    expect(() => parsePinBanNonBunDocument(corruptedDocumentText)).toThrow('forbidden command list must list at least one command.');
  });

  test('parser surfaces a meaningful error when forbidden lockfiles is empty (failure mode)', async () => {
    const validDocumentText = await Bun.file(PIN_DOCUMENT_PATH).text();
    const corruptedDocumentText = validDocumentText.replace(/\n## forbidden lockfiles\n\n- package-lock\.json\n- pnpm-lock\.yaml\n- yarn\.lock\n/, '\n## forbidden lockfiles\n\nno bullets here\n');
    expect(corruptedDocumentText).not.toBe(validDocumentText);
    expect(() => parsePinBanNonBunDocument(corruptedDocumentText)).toThrow('forbidden lockfiles must list at least one lockfile.');
  });
});
