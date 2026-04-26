import { describe, expect, test } from 'bun:test';

import { existsSync, statSync } from 'node:fs';

const AGENTS_PATH = 'AGENTS.md';
const CLAUDE_PATH = 'CLAUDE.md';
const MASTER_CHECKLIST_PATH = 'plan_vanilla_parity/MASTER_CHECKLIST.md';
const PIN_DOCUMENT_PATH = 'plan_vanilla_parity/pin-local-git-direct-commit-and-push-workflow.md';
const PLAN_PROMPT_PATH = 'plan_vanilla_parity/PROMPT.md';
const README_PATH = 'plan_vanilla_parity/README.md';
const STEP_FILE_PATH = 'plan_vanilla_parity/steps/00-006-pin-local-git-direct-commit-and-push-workflow.md';

const CANONICAL_CONVENTIONAL_COMMIT_TYPES: readonly string[] = ['build', 'chore', 'ci', 'docs', 'feat', 'fix', 'perf', 'refactor', 'style', 'test'];
const CANONICAL_FORBIDDEN_ATTRIBUTION_MARKERS: readonly string[] = ['Co-Authored-By: Claude', 'Co-Authored-By: Codex', 'Co-Authored-By: GPT', 'Generated with Claude Code', 'Generated with Codex', '🤖'];
const CANONICAL_FORBIDDEN_PUBLISHING_TOOLS: readonly string[] = ['gh api', 'gh issue', 'gh pr', 'gh release', 'gh workflow'];
const CANONICAL_FORBIDDEN_STAGE_COMMANDS: readonly string[] = ['git add --all', 'git add -A', 'git add .', 'git commit --all', 'git commit -a'];
const CANONICAL_SANCTIONED_PUBLISHING_COMMANDS: readonly string[] = ['git add <path>', 'git commit', 'git push'];
const CANONICAL_VERIFICATION_COMMAND_ORDER: readonly string[] = ['bun run format', 'bun test <path>', 'bun test', 'bun x tsc --noEmit --project tsconfig.json'];

interface PinLocalGitWorkflowDocument {
  readonly acceptancePhrasing: string;
  readonly branchPolicyRule: string;
  readonly commitAndPushCadenceRule: string;
  readonly commitAuthorIdentity: string;
  readonly conventionalCommitTypes: readonly string[];
  readonly conventionalCommitsFormat: string;
  readonly emulatedVanillaVersion: string;
  readonly evidenceLocations: readonly string[];
  readonly explicitStageByPathRule: string;
  readonly forbiddenCommitAttributionMarkers: readonly string[];
  readonly forbiddenGitStageCommands: readonly string[];
  readonly forbiddenPublishingTools: readonly string[];
  readonly localOnlyPublishingRule: string;
  readonly pushFailureRule: string;
  readonly referenceEngine: string;
  readonly referenceEngineVersion: string;
  readonly sanctionedPublishingCommands: readonly string[];
  readonly scopeName: string;
  readonly verificationCommandOrder: readonly string[];
  readonly verifyBeforeCommitRule: string;
}

function extractSection(documentText: string, sectionHeading: string): string {
  const heading = `## ${sectionHeading}`;
  const sectionStart = documentText.indexOf(`\n${heading}\n`);
  if (sectionStart === -1) {
    throw new Error(`Section "${sectionHeading}" not found in local git direct commit and push workflow document.`);
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

function parsePinLocalGitWorkflowDocument(documentText: string): PinLocalGitWorkflowDocument {
  const conventionalCommitTypes = extractBullets(documentText, 'conventional commit types');
  if (conventionalCommitTypes.length === 0) {
    throw new Error('conventional commit types must list at least one type.');
  }
  const verificationCommandOrder = extractBullets(documentText, 'verification command order');
  if (verificationCommandOrder.length === 0) {
    throw new Error('verification command order must list at least one command.');
  }
  const forbiddenGitStageCommands = extractBullets(documentText, 'forbidden git stage commands');
  if (forbiddenGitStageCommands.length === 0) {
    throw new Error('forbidden git stage commands must list at least one command.');
  }
  const sanctionedPublishingCommands = extractBullets(documentText, 'sanctioned publishing commands');
  if (sanctionedPublishingCommands.length === 0) {
    throw new Error('sanctioned publishing commands must list at least one command.');
  }

  return {
    acceptancePhrasing: extractSection(documentText, 'acceptance phrasing'),
    branchPolicyRule: extractSection(documentText, 'branch policy rule'),
    commitAndPushCadenceRule: extractSection(documentText, 'commit and push cadence rule'),
    commitAuthorIdentity: extractSection(documentText, 'commit author identity'),
    conventionalCommitTypes,
    conventionalCommitsFormat: extractSection(documentText, 'conventional commits format'),
    emulatedVanillaVersion: extractSection(documentText, 'emulated vanilla version'),
    evidenceLocations: extractBullets(documentText, 'evidence locations'),
    explicitStageByPathRule: extractSection(documentText, 'explicit stage by path rule'),
    forbiddenCommitAttributionMarkers: extractBullets(documentText, 'forbidden commit attribution markers'),
    forbiddenGitStageCommands,
    forbiddenPublishingTools: extractBullets(documentText, 'forbidden publishing tools'),
    localOnlyPublishingRule: extractSection(documentText, 'local only publishing rule'),
    pushFailureRule: extractSection(documentText, 'push failure rule'),
    referenceEngine: extractSection(documentText, 'reference engine'),
    referenceEngineVersion: extractSection(documentText, 'reference engine version'),
    sanctionedPublishingCommands,
    scopeName: extractSection(documentText, 'scope name'),
    verificationCommandOrder,
    verifyBeforeCommitRule: extractSection(documentText, 'verify before commit rule'),
  };
}

async function loadPinLocalGitWorkflowDocument(): Promise<PinLocalGitWorkflowDocument> {
  const documentText = await Bun.file(PIN_DOCUMENT_PATH).text();
  return parsePinLocalGitWorkflowDocument(documentText);
}

describe('pin local git direct commit and push workflow declaration', () => {
  test('pin document exists at the canonical path', () => {
    expect(existsSync(PIN_DOCUMENT_PATH)).toBe(true);
    expect(statSync(PIN_DOCUMENT_PATH).isFile()).toBe(true);
  });

  test('parses every required governance field with the expected vanilla parity values', async () => {
    const parsed = await loadPinLocalGitWorkflowDocument();
    expect(parsed.scopeName).toBe('vanilla DOOM 1.9 local git direct commit and push workflow');
    expect(parsed.emulatedVanillaVersion).toBe('1.9');
    expect(parsed.referenceEngine).toBe('Chocolate Doom');
    expect(parsed.referenceEngineVersion).toBe('2.2.1');
  });

  test('conventional commit types cover the ten canonical Conventional Commits spec types pinned by AGENTS.md, are unique, and ASCIIbetically sorted', async () => {
    const parsed = await loadPinLocalGitWorkflowDocument();
    expect(parsed.conventionalCommitTypes).toEqual(CANONICAL_CONVENTIONAL_COMMIT_TYPES);
    expect(new Set(parsed.conventionalCommitTypes).size).toBe(parsed.conventionalCommitTypes.length);
    const ascendingSortedTypes = [...parsed.conventionalCommitTypes].sort();
    expect(parsed.conventionalCommitTypes).toEqual(ascendingSortedTypes);
  });

  test('conventional commits format pins the type(scope): description header, lowercase imperative, and no trailing period', async () => {
    const parsed = await loadPinLocalGitWorkflowDocument();
    expect(parsed.conventionalCommitsFormat).toContain('type(scope): description');
    expect(parsed.conventionalCommitsFormat).toContain('lowercase');
    expect(parsed.conventionalCommitsFormat).toContain('imperative');
    expect(parsed.conventionalCommitsFormat).toContain('not end with a trailing period');
    expect(parsed.conventionalCommitsFormat).toContain('one logical change');
    for (const conventionalCommitType of CANONICAL_CONVENTIONAL_COMMIT_TYPES) {
      expect(parsed.conventionalCommitsFormat).toContain(`\`${conventionalCommitType}\``);
    }
  });

  test('commit author identity pins Stev Peifer as the only commit author and forbids overriding user.name or user.email', async () => {
    const parsed = await loadPinLocalGitWorkflowDocument();
    expect(parsed.commitAuthorIdentity).toContain('Stev Peifer');
    expect(parsed.commitAuthorIdentity).toContain('user.name');
    expect(parsed.commitAuthorIdentity).toContain('user.email');
    expect(parsed.commitAuthorIdentity).toContain('source of truth');
    expect(parsed.commitAuthorIdentity).toContain('must not be overridden');
    expect(parsed.commitAuthorIdentity).toContain('Co-Authored-By: Claude');
    expect(parsed.commitAuthorIdentity).toContain('human-authored');
  });

  test('forbidden commit attribution markers cover every AI/agent attribution variant pinned by AGENTS.md and CLAUDE.md, are unique, and ASCIIbetically sorted', async () => {
    const parsed = await loadPinLocalGitWorkflowDocument();
    expect(parsed.forbiddenCommitAttributionMarkers).toEqual(CANONICAL_FORBIDDEN_ATTRIBUTION_MARKERS);
    expect(new Set(parsed.forbiddenCommitAttributionMarkers).size).toBe(parsed.forbiddenCommitAttributionMarkers.length);
    const ascendingSortedMarkers = [...parsed.forbiddenCommitAttributionMarkers].sort();
    expect(parsed.forbiddenCommitAttributionMarkers).toEqual(ascendingSortedMarkers);
  });

  test('explicit stage by path rule forbids every wildcard staging variant and explains why the prohibition exists', async () => {
    const parsed = await loadPinLocalGitWorkflowDocument();
    expect(parsed.explicitStageByPathRule).toContain('git add <path>');
    expect(parsed.explicitStageByPathRule).toContain('git add -A');
    expect(parsed.explicitStageByPathRule).toContain('git add .');
    expect(parsed.explicitStageByPathRule).toContain('git add --all');
    expect(parsed.explicitStageByPathRule).toContain('git commit -a');
    expect(parsed.explicitStageByPathRule).toContain('git commit --all');
    expect(parsed.explicitStageByPathRule).toContain('doom/');
    expect(parsed.explicitStageByPathRule).toContain('iwad/');
    expect(parsed.explicitStageByPathRule).toContain('proprietary');
    expect(parsed.explicitStageByPathRule).toContain('credentials');
    expect(parsed.explicitStageByPathRule).toContain('.env');
  });

  test('forbidden git stage commands cover every wildcard staging variant, are unique, and ASCIIbetically sorted', async () => {
    const parsed = await loadPinLocalGitWorkflowDocument();
    expect(parsed.forbiddenGitStageCommands).toEqual(CANONICAL_FORBIDDEN_STAGE_COMMANDS);
    expect(new Set(parsed.forbiddenGitStageCommands).size).toBe(parsed.forbiddenGitStageCommands.length);
    const ascendingSortedCommands = [...parsed.forbiddenGitStageCommands].sort();
    expect(parsed.forbiddenGitStageCommands).toEqual(ascendingSortedCommands);
  });

  test('local only publishing rule forbids GitHub apps, GitHub API tools, the gh CLI, and the pull request workflow', async () => {
    const parsed = await loadPinLocalGitWorkflowDocument();
    expect(parsed.localOnlyPublishingRule).toContain('local git commands');
    expect(parsed.localOnlyPublishingRule).toContain('gh');
    expect(parsed.localOnlyPublishingRule).toContain('GitHub REST');
    expect(parsed.localOnlyPublishingRule).toContain('GitHub apps');
    expect(parsed.localOnlyPublishingRule).toContain('issue automation');
    expect(parsed.localOnlyPublishingRule).toContain('release automation');
    expect(parsed.localOnlyPublishingRule).toContain('PR creation');
    expect(parsed.localOnlyPublishingRule).toContain('pull request workflow');
    expect(parsed.localOnlyPublishingRule).toContain('git push');
    expect(parsed.localOnlyPublishingRule).toContain('current branch');
  });

  test('forbidden publishing tools cover every gh subcommand variant, are unique, and ASCIIbetically sorted', async () => {
    const parsed = await loadPinLocalGitWorkflowDocument();
    expect(parsed.forbiddenPublishingTools).toEqual(CANONICAL_FORBIDDEN_PUBLISHING_TOOLS);
    expect(new Set(parsed.forbiddenPublishingTools).size).toBe(parsed.forbiddenPublishingTools.length);
    const ascendingSortedTools = [...parsed.forbiddenPublishingTools].sort();
    expect(parsed.forbiddenPublishingTools).toEqual(ascendingSortedTools);
  });

  test('sanctioned publishing commands cover only git add by path, git commit, and git push', async () => {
    const parsed = await loadPinLocalGitWorkflowDocument();
    expect(parsed.sanctionedPublishingCommands).toEqual(CANONICAL_SANCTIONED_PUBLISHING_COMMANDS);
    expect(parsed.sanctionedPublishingCommands).toHaveLength(3);
  });

  test('sanctioned publishing commands and forbidden git stage commands are disjoint sets', async () => {
    const parsed = await loadPinLocalGitWorkflowDocument();
    const forbiddenSet = new Set(parsed.forbiddenGitStageCommands);
    for (const sanctionedCommand of parsed.sanctionedPublishingCommands) {
      expect(forbiddenSet.has(sanctionedCommand)).toBe(false);
    }
  });

  test('verify before commit rule lists the four canonical verification commands in the fixed order pinned by AGENTS.md and PROMPT.md', async () => {
    const parsed = await loadPinLocalGitWorkflowDocument();
    expect(parsed.verifyBeforeCommitRule).toContain('bun run format');
    expect(parsed.verifyBeforeCommitRule).toContain('bun test <path>');
    expect(parsed.verifyBeforeCommitRule).toContain('bun test');
    expect(parsed.verifyBeforeCommitRule).toContain('bun x tsc --noEmit --project tsconfig.json');
    expect(parsed.verifyBeforeCommitRule).toContain('fixed order');
    expect(parsed.verifyBeforeCommitRule).toContain('known-broken state');
    const formatOffset = parsed.verifyBeforeCommitRule.indexOf('bun run format');
    const focusedTestOffset = parsed.verifyBeforeCommitRule.indexOf('bun test <path>');
    const fullTestOffset = parsed.verifyBeforeCommitRule.indexOf('full `bun test`');
    const typecheckOffset = parsed.verifyBeforeCommitRule.indexOf('bun x tsc --noEmit --project tsconfig.json');
    expect(formatOffset).toBeGreaterThanOrEqual(0);
    expect(focusedTestOffset).toBeGreaterThan(formatOffset);
    expect(fullTestOffset).toBeGreaterThan(focusedTestOffset);
    expect(typecheckOffset).toBeGreaterThan(fullTestOffset);
  });

  test('verification command order lists the four canonical commands in the fixed order pinned by AGENTS.md', async () => {
    const parsed = await loadPinLocalGitWorkflowDocument();
    expect(parsed.verificationCommandOrder).toEqual(CANONICAL_VERIFICATION_COMMAND_ORDER);
    expect(parsed.verificationCommandOrder).toHaveLength(4);
  });

  test('commit and push cadence rule pins one verified commit and one direct push to the current branch per Ralph-loop step', async () => {
    const parsed = await loadPinLocalGitWorkflowDocument();
    expect(parsed.commitAndPushCadenceRule).toContain('verified Ralph-loop step');
    expect(parsed.commitAndPushCadenceRule).toContain('exactly one Conventional Commit');
    expect(parsed.commitAndPushCadenceRule).toContain('exactly one `git push`');
    expect(parsed.commitAndPushCadenceRule).toContain('current branch');
    expect(parsed.commitAndPushCadenceRule).toContain('not batch');
    expect(parsed.commitAndPushCadenceRule).toContain('at-risk');
    expect(parsed.commitAndPushCadenceRule).toContain('blocker');
  });

  test('push failure rule forbids marking the step complete when git push fails and pins the BLOCKED status reporting requirement', async () => {
    const parsed = await loadPinLocalGitWorkflowDocument();
    expect(parsed.pushFailureRule).toContain('`git push` fails');
    expect(parsed.pushFailureRule).toContain('incomplete');
    expect(parsed.pushFailureRule).toContain('MASTER_CHECKLIST.md');
    expect(parsed.pushFailureRule).toContain('HANDOFF_LOG.md');
    expect(parsed.pushFailureRule).toContain('RLP_STATUS: COMPLETED');
    expect(parsed.pushFailureRule).toContain('RLP_STATUS: BLOCKED');
    expect(parsed.pushFailureRule).toContain('non-fast-forward');
  });

  test('branch policy rule forbids force-pushing main and rewriting shared history under any circumstance', async () => {
    const parsed = await loadPinLocalGitWorkflowDocument();
    expect(parsed.branchPolicyRule).toContain('current branch');
    expect(parsed.branchPolicyRule).toContain('force-push `main`');
    expect(parsed.branchPolicyRule).toContain('git push --force');
    expect(parsed.branchPolicyRule).toContain('git rebase --interactive');
    expect(parsed.branchPolicyRule).toContain('shared history');
    expect(parsed.branchPolicyRule).toContain('human owner');
  });

  test('every evidence location exists on disk and is a file', async () => {
    const parsed = await loadPinLocalGitWorkflowDocument();
    expect(parsed.evidenceLocations.length).toBeGreaterThan(0);
    expect(new Set(parsed.evidenceLocations).size).toBe(parsed.evidenceLocations.length);
    for (const evidenceLocation of parsed.evidenceLocations) {
      expect(existsSync(evidenceLocation)).toBe(true);
      expect(statSync(evidenceLocation).isFile()).toBe(true);
    }
  });

  test('evidence locations include AGENTS.md, CLAUDE.md, plan_vanilla_parity README.md, and plan_vanilla_parity PROMPT.md', async () => {
    const parsed = await loadPinLocalGitWorkflowDocument();
    const requiredEvidence = [AGENTS_PATH, CLAUDE_PATH, PLAN_PROMPT_PATH, README_PATH];
    for (const requiredEvidenceLocation of requiredEvidence) {
      expect(parsed.evidenceLocations).toContain(requiredEvidenceLocation);
    }
  });

  test('AGENTS.md GitHub-and-Publishing-Authority section pins the same local-only direct commit and push workflow this declaration freezes', async () => {
    const agentsText = await Bun.file(AGENTS_PATH).text();
    expect(agentsText).toContain('## GitHub and Publishing Authority');
    expect(agentsText).toContain('Use only local Git commands');
    expect(agentsText).toContain('Do not use GitHub apps, GitHub API tools');
    expect(agentsText).toContain('pull request workflows');
    expect(agentsText).toContain('commit and push directly');
    expect(agentsText).toContain('Do not open pull requests');
  });

  test('AGENTS.md Commits section pins the same Conventional Commits format and ten commit types this declaration freezes', async () => {
    const agentsText = await Bun.file(AGENTS_PATH).text();
    expect(agentsText).toContain('Conventional Commits');
    expect(agentsText).toContain('type(scope): description');
    expect(agentsText).toContain('lowercase, imperative mood, no trailing period');
    for (const conventionalCommitType of CANONICAL_CONVENTIONAL_COMMIT_TYPES) {
      expect(agentsText).toContain(`\`${conventionalCommitType}\``);
    }
  });

  test('AGENTS.md Attribution section pins the same Stev-Peifer-only authorship and no-AI-attribution rule this declaration freezes', async () => {
    const agentsText = await Bun.file(AGENTS_PATH).text();
    expect(agentsText).toContain('All commits are authored by the human owner of this repository (Stev Peifer)');
    expect(agentsText).toContain('Do not add AI co-authorship');
    expect(agentsText).toContain('Co-Authored-By: Claude');
    expect(agentsText).toContain('Generated with Claude Code');
    expect(agentsText).toContain('Commit messages must read as human-authored');
  });

  test('CLAUDE.md Commits-and-publishing section pins the same direct-commit-and-push workflow this declaration freezes', async () => {
    const claudeText = await Bun.file(CLAUDE_PATH).text();
    expect(claudeText).toContain('## Commits and publishing');
    expect(claudeText).toContain('Conventional Commits');
    expect(claudeText).toContain('Authored as Stev Peifer only');
    expect(claudeText).toContain('Stage files explicitly by path');
    expect(claudeText).toContain('git add -A');
    expect(claudeText).toContain('git add .');
    expect(claudeText).toContain('Every verified Ralph-loop step ends with a commit and a direct push to the current branch');
    expect(claudeText).toContain('Do not open pull requests');
    expect(claudeText).toContain('`gh`');
    expect(claudeText).toContain('If a push fails, report the blocker');
  });

  test('plan_vanilla_parity PROMPT.md pins the same verification command order and stage-by-path rule this declaration freezes', async () => {
    const planPromptText = await Bun.file(PLAN_PROMPT_PATH).text();
    expect(planPromptText).toContain('Verification order is fixed');
    expect(planPromptText).toContain('bun run format');
    expect(planPromptText).toContain('bun test <path>');
    expect(planPromptText).toContain('bun test');
    expect(planPromptText).toContain('bun x tsc --noEmit --project tsconfig.json');
    expect(planPromptText).toContain('stage files explicitly by path');
    expect(planPromptText).toContain('Conventional Commits');
    expect(planPromptText).toContain('push the current branch directly with local git commands');
    expect(planPromptText).toContain('Do not open a pull request');
  });

  test('plan_vanilla_parity README.md pins the same direct-commit-and-push Ralph-loop workflow rules this declaration freezes', async () => {
    const readmeText = await Bun.file(README_PATH).text();
    expect(readmeText).toContain('Commit and push directly with local git commands');
    expect(readmeText).toContain('Never use GitHub API, GitHub apps, PR workflow');
  });

  test('step 00-006 file declares the governance lane, lists this declaration under its write lock, and lists the focused test under its test files', async () => {
    expect(existsSync(STEP_FILE_PATH)).toBe(true);
    const stepText = await Bun.file(STEP_FILE_PATH).text();
    expect(stepText).toContain('# [ ] STEP 00-006: Pin Local Git Direct Commit And Push Workflow');
    expect(stepText).toContain('\n## lane\n\ngovernance\n');
    expect(stepText).toContain('- plan_vanilla_parity/pin-local-git-direct-commit-and-push-workflow.md');
    expect(stepText).toContain('- test/plan_vanilla_parity/pin-local-git-direct-commit-and-push-workflow.test.ts');
  });

  test('MASTER_CHECKLIST.md row for 00-006 references the canonical step file path and the governance lane', async () => {
    const checklistText = await Bun.file(MASTER_CHECKLIST_PATH).text();
    const expectedPendingRow = '- [ ] `00-006` `pin-local-git-direct-commit-and-push-workflow` | lane: `governance` | prereqs: `00-005` | file: `plan_vanilla_parity/steps/00-006-pin-local-git-direct-commit-and-push-workflow.md`';
    const expectedCompletedRow = '- [x] `00-006` `pin-local-git-direct-commit-and-push-workflow` | lane: `governance` | prereqs: `00-005` | file: `plan_vanilla_parity/steps/00-006-pin-local-git-direct-commit-and-push-workflow.md`';
    expect(checklistText.includes(expectedPendingRow) || checklistText.includes(expectedCompletedRow)).toBe(true);
  });

  test('acceptance phrasing names the verified-step + Conventional Commit + direct push + no-PR + no-API canonical phrasing', async () => {
    const parsed = await loadPinLocalGitWorkflowDocument();
    expect(parsed.acceptancePhrasing).toBe('Every verified Ralph-loop step ends with a Conventional Commit and a direct `git push` to the current branch; no pull requests are opened and no GitHub API tools are used.');
  });

  test('parser surfaces a meaningful error when a required section is missing (failure mode)', () => {
    const documentTextWithMissingSection = '# Test\n\n## scope name\n\nvanilla DOOM 1.9 local git direct commit and push workflow\n';
    expect(() => parsePinLocalGitWorkflowDocument(documentTextWithMissingSection)).toThrow('Section "conventional commit types" not found in local git direct commit and push workflow document.');
  });

  test('parser surfaces a meaningful error when conventional commit types is empty (failure mode)', () => {
    const documentTextWithEmptyTypes = [
      '# Test',
      '',
      '## scope name',
      '',
      'vanilla DOOM 1.9 local git direct commit and push workflow',
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
      '## conventional commits format',
      '',
      'placeholder format text',
      '',
      '## conventional commit types',
      '',
      'no bullets here',
      '',
    ].join('\n');
    expect(() => parsePinLocalGitWorkflowDocument(documentTextWithEmptyTypes)).toThrow('conventional commit types must list at least one type.');
  });

  test('parser surfaces a meaningful error when verification command order is empty (failure mode)', async () => {
    const validDocumentText = await Bun.file(PIN_DOCUMENT_PATH).text();
    const corruptedDocumentText = validDocumentText.replace(
      /\n## verification command order\n\n- bun run format\n- bun test <path>\n- bun test\n- bun x tsc --noEmit --project tsconfig.json\n/,
      '\n## verification command order\n\nno bullets here\n',
    );
    expect(corruptedDocumentText).not.toBe(validDocumentText);
    expect(() => parsePinLocalGitWorkflowDocument(corruptedDocumentText)).toThrow('verification command order must list at least one command.');
  });

  test('parser surfaces a meaningful error when forbidden git stage commands is empty (failure mode)', async () => {
    const validDocumentText = await Bun.file(PIN_DOCUMENT_PATH).text();
    const corruptedDocumentText = validDocumentText.replace(
      /\n## forbidden git stage commands\n\n- git add --all\n- git add -A\n- git add \.\n- git commit --all\n- git commit -a\n/,
      '\n## forbidden git stage commands\n\nno bullets here\n',
    );
    expect(corruptedDocumentText).not.toBe(validDocumentText);
    expect(() => parsePinLocalGitWorkflowDocument(corruptedDocumentText)).toThrow('forbidden git stage commands must list at least one command.');
  });
});
