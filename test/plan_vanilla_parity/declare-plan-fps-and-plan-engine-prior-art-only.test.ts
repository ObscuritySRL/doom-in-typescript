import { describe, expect, test } from 'bun:test';

import { existsSync, statSync } from 'node:fs';

const AGENTS_PATH = 'AGENTS.md';
const CLAUDE_PATH = 'CLAUDE.md';
const CONTROL_CENTER_DOCUMENT_PATH = 'plan_vanilla_parity/establish-vanilla-parity-control-center.md';
const MASTER_CHECKLIST_PATH = 'plan_vanilla_parity/MASTER_CHECKLIST.md';
const PRIOR_ART_DECLARATION_PATH = 'plan_vanilla_parity/declare-plan-fps-and-plan-engine-prior-art-only.md';
const PROMPT_PATH = 'plan_vanilla_parity/PROMPT.md';
const README_PATH = 'plan_vanilla_parity/README.md';
const STEP_FILE_PATH = 'plan_vanilla_parity/steps/00-002-declare-plan-fps-and-plan-engine-prior-art-only.md';

interface PriorArtDeclarationDocument {
  readonly acceptancePhrasing: string;
  readonly activeControlCenterDirectory: string;
  readonly activeControlCenterSelectionSources: readonly string[];
  readonly evidenceLocations: readonly string[];
  readonly priorArtClassification: string;
  readonly priorArtForwardLoopWriteProhibitions: readonly string[];
  readonly priorArtOnlyDirectories: readonly string[];
  readonly priorArtReadOnlyAllowanceRule: string;
}

function extractSection(documentText: string, sectionHeading: string): string {
  const heading = `## ${sectionHeading}`;
  const sectionStart = documentText.indexOf(`\n${heading}\n`);
  if (sectionStart === -1) {
    throw new Error(`Section "${sectionHeading}" not found in prior-art declaration document.`);
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

function parsePriorArtDeclarationDocument(documentText: string): PriorArtDeclarationDocument {
  const priorArtOnlyDirectories = extractBullets(documentText, 'prior-art only directories');
  if (priorArtOnlyDirectories.length === 0) {
    throw new Error('prior-art only directories must list at least one directory.');
  }
  return {
    acceptancePhrasing: extractSection(documentText, 'acceptance phrasing'),
    activeControlCenterDirectory: extractSection(documentText, 'active control center directory'),
    activeControlCenterSelectionSources: extractBullets(documentText, 'active control center selection sources'),
    evidenceLocations: extractBullets(documentText, 'evidence locations'),
    priorArtClassification: extractSection(documentText, 'prior-art classification'),
    priorArtForwardLoopWriteProhibitions: extractBullets(documentText, 'prior-art forward-loop write prohibitions'),
    priorArtOnlyDirectories,
    priorArtReadOnlyAllowanceRule: extractSection(documentText, 'prior-art read-only allowance rule'),
  };
}

async function loadPriorArtDeclarationDocument(): Promise<PriorArtDeclarationDocument> {
  const documentText = await Bun.file(PRIOR_ART_DECLARATION_PATH).text();
  return parsePriorArtDeclarationDocument(documentText);
}

describe('plan_engine and plan_fps prior-art-only declaration', () => {
  test('prior-art declaration document exists at the canonical path', () => {
    expect(existsSync(PRIOR_ART_DECLARATION_PATH)).toBe(true);
    expect(statSync(PRIOR_ART_DECLARATION_PATH).isFile()).toBe(true);
  });

  test('parses every required governance field with the expected vanilla parity values', async () => {
    const parsed = await loadPriorArtDeclarationDocument();
    expect(parsed.activeControlCenterDirectory).toBe('plan_vanilla_parity/');
    expect(parsed.priorArtOnlyDirectories).toEqual(['plan_engine/', 'plan_fps/']);
    expect(parsed.acceptancePhrasing).toBe('Prior art only: `plan_engine/` and `plan_fps/`.');
  });

  test('every declared prior-art directory exists on disk, is a directory, and is not the active control center', async () => {
    const parsed = await loadPriorArtDeclarationDocument();
    expect(new Set(parsed.priorArtOnlyDirectories).size).toBe(parsed.priorArtOnlyDirectories.length);
    for (const priorArtDirectory of parsed.priorArtOnlyDirectories) {
      expect(priorArtDirectory).not.toBe(parsed.activeControlCenterDirectory);
      expect(priorArtDirectory.endsWith('/')).toBe(true);
      const trimmedPath = priorArtDirectory.replace(/\/$/, '');
      expect(existsSync(trimmedPath)).toBe(true);
      expect(statSync(trimmedPath).isDirectory()).toBe(true);
    }
  });

  test('active control center directory exists on disk, is a directory, and is plan_vanilla_parity/', async () => {
    const parsed = await loadPriorArtDeclarationDocument();
    expect(parsed.activeControlCenterDirectory).toBe('plan_vanilla_parity/');
    const trimmedPath = parsed.activeControlCenterDirectory.replace(/\/$/, '');
    expect(existsSync(trimmedPath)).toBe(true);
    expect(statSync(trimmedPath).isDirectory()).toBe(true);
  });

  test('every declared active control center selection source exists, lives under plan_vanilla_parity/, and is unique', async () => {
    const parsed = await loadPriorArtDeclarationDocument();
    expect(parsed.activeControlCenterSelectionSources.length).toBeGreaterThan(0);
    expect(new Set(parsed.activeControlCenterSelectionSources).size).toBe(parsed.activeControlCenterSelectionSources.length);
    for (const selectionSource of parsed.activeControlCenterSelectionSources) {
      expect(selectionSource.startsWith('plan_vanilla_parity/')).toBe(true);
      expect(existsSync(selectionSource)).toBe(true);
      expect(statSync(selectionSource).isFile()).toBe(true);
    }
  });

  test('selection sources include MASTER_CHECKLIST.md, PROMPT.md, README.md, PARALLEL_WORK.md, and lane-lock.ts so lane selection is unambiguous', async () => {
    const parsed = await loadPriorArtDeclarationDocument();
    const required = ['plan_vanilla_parity/MASTER_CHECKLIST.md', 'plan_vanilla_parity/PROMPT.md', 'plan_vanilla_parity/README.md', 'plan_vanilla_parity/PARALLEL_WORK.md', 'plan_vanilla_parity/lane-lock.ts'];
    for (const requiredSource of required) {
      expect(parsed.activeControlCenterSelectionSources).toContain(requiredSource);
    }
  });

  test('every prior-art forward-loop write prohibition resolves to plan_engine/ or plan_fps/ and is unique', async () => {
    const parsed = await loadPriorArtDeclarationDocument();
    expect(parsed.priorArtForwardLoopWriteProhibitions.length).toBeGreaterThan(0);
    expect(new Set(parsed.priorArtForwardLoopWriteProhibitions).size).toBe(parsed.priorArtForwardLoopWriteProhibitions.length);
    for (const prohibition of parsed.priorArtForwardLoopWriteProhibitions) {
      const isPriorArtPath = prohibition.startsWith('plan_engine/') || prohibition.startsWith('plan_fps/');
      expect(isPriorArtPath).toBe(true);
      const isDirectory = prohibition.endsWith('/');
      const fileSystemTarget = isDirectory ? prohibition.replace(/\/$/, '') : prohibition;
      expect(existsSync(fileSystemTarget)).toBe(true);
      const stats = statSync(fileSystemTarget);
      if (isDirectory) {
        expect(stats.isDirectory()).toBe(true);
      } else {
        expect(stats.isFile()).toBe(true);
      }
    }
  });

  test('write prohibitions cover both prior-art MASTER_CHECKLIST.md and HANDOFF_LOG.md so forward loops cannot select work or claim completions there', async () => {
    const parsed = await loadPriorArtDeclarationDocument();
    const requiredProhibitions = ['plan_engine/MASTER_CHECKLIST.md', 'plan_engine/HANDOFF_LOG.md', 'plan_fps/MASTER_CHECKLIST.md', 'plan_fps/HANDOFF_LOG.md'];
    for (const requiredProhibition of requiredProhibitions) {
      expect(parsed.priorArtForwardLoopWriteProhibitions).toContain(requiredProhibition);
    }
  });

  test('every evidence location exists on disk and is a file', async () => {
    const parsed = await loadPriorArtDeclarationDocument();
    expect(parsed.evidenceLocations.length).toBeGreaterThan(0);
    for (const evidenceLocation of parsed.evidenceLocations) {
      expect(existsSync(evidenceLocation)).toBe(true);
      expect(statSync(evidenceLocation).isFile()).toBe(true);
    }
  });

  test('evidence locations include AGENTS.md, CLAUDE.md, plan_vanilla_parity README/PROMPT/MASTER_CHECKLIST, the control center document, and both prior-art READMEs', async () => {
    const parsed = await loadPriorArtDeclarationDocument();
    const requiredEvidence = [
      'AGENTS.md',
      'CLAUDE.md',
      'plan_vanilla_parity/README.md',
      'plan_vanilla_parity/PROMPT.md',
      'plan_vanilla_parity/MASTER_CHECKLIST.md',
      'plan_vanilla_parity/establish-vanilla-parity-control-center.md',
      'plan_engine/README.md',
      'plan_fps/README.md',
    ];
    for (const requiredEvidenceLocation of requiredEvidence) {
      expect(parsed.evidenceLocations).toContain(requiredEvidenceLocation);
    }
  });

  test('prior-art classification text forbids forward-loop selection from prior-art checklists and handoff appends', async () => {
    const parsed = await loadPriorArtDeclarationDocument();
    expect(parsed.priorArtClassification).toContain('must not be the source of the next eligible step');
    expect(parsed.priorArtClassification).toContain('must not receive new step files');
    expect(parsed.priorArtClassification).toContain('plan_vanilla_parity/');
  });

  test('prior-art read-only allowance rule pins selection to plan_vanilla_parity/MASTER_CHECKLIST.md and forbids writes to prior-art paths', async () => {
    const parsed = await loadPriorArtDeclarationDocument();
    expect(parsed.priorArtReadOnlyAllowanceRule).toContain('plan_vanilla_parity/MASTER_CHECKLIST.md');
    expect(parsed.priorArtReadOnlyAllowanceRule).toContain('read-only paths');
    expect(parsed.priorArtReadOnlyAllowanceRule).toContain('forbidden');
  });

  test('plan_vanilla_parity README.md states the prior-art-only classification with the canonical phrasing', async () => {
    const parsed = await loadPriorArtDeclarationDocument();
    const readmeText = await Bun.file(README_PATH).text();
    expect(readmeText).toContain(parsed.acceptancePhrasing);
  });

  test('plan_vanilla_parity PROMPT.md treats both prior-art directories as prior art only and pins plan_vanilla_parity as the only active control center', async () => {
    const promptText = await Bun.file(PROMPT_PATH).text();
    expect(promptText).toContain('Treat `plan_engine/` and `plan_fps/` as prior art only.');
    expect(promptText).toContain('`plan_vanilla_parity/` as the only active planning and execution control center');
  });

  test('CLAUDE.md classifies plan_engine/ as prior art only with the same selection rule', async () => {
    const claudeText = await Bun.file(CLAUDE_PATH).text();
    expect(claudeText).toContain('`plan_engine/` is prior art only.');
    expect(claudeText).toContain('Do not use it as the active control center');
  });

  test('AGENTS.md exists and remains the authoritative runtime/publishing rules document referenced by this declaration', async () => {
    expect(existsSync(AGENTS_PATH)).toBe(true);
    const agentsText = await Bun.file(AGENTS_PATH).text();
    expect(agentsText).toContain('## Runtime');
    expect(agentsText).toContain('## GitHub and Publishing Authority');
  });

  test('control center document declares the same active control center directory and the same prior-art-only directories as this declaration', async () => {
    const parsed = await loadPriorArtDeclarationDocument();
    const controlCenterText = await Bun.file(CONTROL_CENTER_DOCUMENT_PATH).text();
    expect(controlCenterText).toContain(`\n## active control center directory\n\n${parsed.activeControlCenterDirectory}\n`);
    expect(controlCenterText).toContain('\n## prior-art only directories\n\n- plan_engine/\n- plan_fps/\n');
  });

  test('step 00-002 file declares the governance lane, lists this declaration under its write lock, and lists the focused test under its test files', async () => {
    expect(existsSync(STEP_FILE_PATH)).toBe(true);
    const stepText = await Bun.file(STEP_FILE_PATH).text();
    expect(stepText).toContain('# [ ] STEP 00-002: Declare Plan Fps And Plan Engine Prior Art Only');
    expect(stepText).toContain('\n## lane\n\ngovernance\n');
    expect(stepText).toContain('- plan_vanilla_parity/declare-plan-fps-and-plan-engine-prior-art-only.md');
    expect(stepText).toContain('- test/plan_vanilla_parity/declare-plan-fps-and-plan-engine-prior-art-only.test.ts');
  });

  test('MASTER_CHECKLIST.md row for 00-002 references the canonical step file path and the governance lane', async () => {
    const checklistText = await Bun.file(MASTER_CHECKLIST_PATH).text();
    const expectedPendingRow = '- [ ] `00-002` `declare-plan-fps-and-plan-engine-prior-art-only` | lane: `governance` | prereqs: `00-001` | file: `plan_vanilla_parity/steps/00-002-declare-plan-fps-and-plan-engine-prior-art-only.md`';
    const expectedCompletedRow = '- [x] `00-002` `declare-plan-fps-and-plan-engine-prior-art-only` | lane: `governance` | prereqs: `00-001` | file: `plan_vanilla_parity/steps/00-002-declare-plan-fps-and-plan-engine-prior-art-only.md`';
    expect(checklistText.includes(expectedPendingRow) || checklistText.includes(expectedCompletedRow)).toBe(true);
  });

  test('parser surfaces a meaningful error when a required section is missing (failure mode)', () => {
    const documentTextWithMissingSection = '# Test\n\n## active control center directory\n\nplan_vanilla_parity/\n';
    expect(() => parsePriorArtDeclarationDocument(documentTextWithMissingSection)).toThrow('Section "prior-art only directories" not found in prior-art declaration document.');
  });

  test('parser surfaces a meaningful error when prior-art only directories is empty (failure mode)', () => {
    const documentTextWithEmptyPriorArt = [
      '# Test',
      '',
      '## active control center directory',
      '',
      'plan_vanilla_parity/',
      '',
      '## prior-art only directories',
      '',
      'no bullets here',
      '',
      '## prior-art classification',
      '',
      'placeholder',
      '',
      '## prior-art forward-loop write prohibitions',
      '',
      '- plan_engine/MASTER_CHECKLIST.md',
      '',
      '## active control center selection sources',
      '',
      '- plan_vanilla_parity/MASTER_CHECKLIST.md',
      '',
      '## prior-art read-only allowance rule',
      '',
      'placeholder',
      '',
      '## evidence locations',
      '',
      '- plan_vanilla_parity/README.md',
      '',
      '## acceptance phrasing',
      '',
      'placeholder',
      '',
    ].join('\n');
    expect(() => parsePriorArtDeclarationDocument(documentTextWithEmptyPriorArt)).toThrow('prior-art only directories must list at least one directory.');
  });
});
