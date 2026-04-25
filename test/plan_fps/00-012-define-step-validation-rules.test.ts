import { describe, expect, test } from 'bun:test';

import { basename, resolve } from 'node:path';

type CurrentWorkspaceContract = {
  packageJson: {
    path: string;
    private: boolean;
    requiredBunScriptNames: string[];
    requiredScriptCommandPrefix: string;
    type: string;
  };
  tsconfigJson: {
    noEmit: boolean;
    path: string;
    requiredTypes: string[];
  };
};

type LoopCommandRule = {
  command?: string;
  commandPattern?: string;
  commandSource?: string;
  kind: string;
  order: number;
};

type StepFileContract = {
  commandSectionHeading: string;
  directory: string;
  fileExtension: string;
  fileNamePattern: string;
  headingPattern: string;
  pathBulletPattern: string;
  pathListSectionHeadings: string[];
  prerequisiteBulletPattern: string;
  requiredLogUpdateLabels: string[];
  requiredSectionOrder: string[];
};

type StepValidationManifest = {
  bunOnlyDecisionId: string;
  completionRules: {
    focusedTestRequirement: string;
    markCompleteOnlyAfterAllRequiredVerificationPasses: boolean;
    mustRemainBunOnly: boolean;
    mustRemainDeterministicReplayCompatible: boolean;
  };
  currentWorkspace: CurrentWorkspaceContract;
  decisionId: string;
  deterministicReplayCompatible: boolean;
  evidencePaths: string[];
  runtimeTarget: {
    command: string;
    decisionId: string;
  };
  schemaVersion: number;
  sideBySideAcceptanceDecisionId: string;
  stepFileContract: StepFileContract;
  verificationRules: {
    loopCommandOrder: LoopCommandRule[];
    stepFileCommandPatterns: string[];
    stepFileCommandSectionUsesBackticks: boolean;
  };
};

const workspaceRootPath = resolve(import.meta.dir, '..', '..');
const manifestPath = resolve(workspaceRootPath, 'plan_fps/manifests/00-012-define-step-validation-rules.json');
const packageJsonPath = resolve(workspaceRootPath, 'package.json');
const readmePath = resolve(workspaceRootPath, 'plan_fps/README.md');
const stepFilePath = resolve(workspaceRootPath, 'plan_fps/steps/00-012-define-step-validation-rules.md');
const tsconfigPath = resolve(workspaceRootPath, 'tsconfig.json');

const expectedManifest: StepValidationManifest = {
  bunOnlyDecisionId: 'D-FPS-006',
  completionRules: {
    focusedTestRequirement: 'The focused test locks an exact value, hash, transition, command contract, or manifest schema rather than only checking existence.',
    markCompleteOnlyAfterAllRequiredVerificationPasses: true,
    mustRemainBunOnly: true,
    mustRemainDeterministicReplayCompatible: true,
  },
  currentWorkspace: {
    packageJson: {
      path: 'package.json',
      private: true,
      requiredBunScriptNames: ['format', 'start'],
      requiredScriptCommandPrefix: 'bun ',
      type: 'module',
    },
    tsconfigJson: {
      noEmit: true,
      path: 'tsconfig.json',
      requiredTypes: ['bun'],
    },
  },
  decisionId: 'D-FPS-012',
  deterministicReplayCompatible: true,
  evidencePaths: ['package.json', 'plan_fps/README.md', 'plan_fps/steps/00-012-define-step-validation-rules.md', 'tsconfig.json'],
  runtimeTarget: {
    command: 'bun run doom.ts',
    decisionId: 'D-FPS-003',
  },
  schemaVersion: 1,
  sideBySideAcceptanceDecisionId: 'D-FPS-011',
  stepFileContract: {
    commandSectionHeading: 'Verification',
    directory: 'plan_fps/steps',
    fileExtension: '.md',
    fileNamePattern: '^[0-9]{2}-[0-9]{3}-[a-z0-9-]+\\.md$',
    headingPattern: '^# \\[ \\] STEP [0-9]{2}-[0-9]{3}: [^\\r\\n]+$',
    pathBulletPattern: '^- [A-Za-z0-9_./-]+$',
    pathListSectionHeadings: ['Read Only', 'Expected Changes', 'Test Files'],
    prerequisiteBulletPattern: '^- (none|[0-9]{2}-[0-9]{3})$',
    requiredLogUpdateLabels: ['FACT_LOG.md', 'DECISION_LOG.md', 'REFERENCE_ORACLES.md', 'HANDOFF_LOG.md'],
    requiredSectionOrder: ['Goal', 'Prerequisites', 'Read Only', 'Consult Only If Blocked', 'Expected Changes', 'Test Files', 'Verification', 'Completion Criteria', 'Required Log Updates', 'Later Steps That May Benefit'],
  },
  verificationRules: {
    loopCommandOrder: [
      {
        command: 'bun run format',
        kind: 'formatter',
        order: 1,
      },
      {
        commandPattern: '^bun test test/plan_fps/[0-9]{2}-[0-9]{3}-[a-z0-9-]+\\.test\\.ts$',
        kind: 'focused-test',
        order: 2,
      },
      {
        command: 'bun test',
        kind: 'full-suite',
        order: 3,
      },
      {
        command: 'bun x tsc --noEmit --project tsconfig.json',
        kind: 'typecheck',
        order: 4,
      },
      {
        commandSource: 'selected step file Verification section commands after the required minimum',
        kind: 'extra-step-commands',
        order: 5,
      },
    ],
    stepFileCommandPatterns: ['^`bun test test/plan_fps/[0-9]{2}-[0-9]{3}-[a-z0-9-]+\\.test\\.ts`$', '^`bun test`$', '^`bun x tsc --noEmit --project tsconfig.json`$'],
    stepFileCommandSectionUsesBackticks: true,
  },
};

const expectedDecisionLogEntry = `## D-FPS-012

- status: accepted
- date: 2026-04-24
- decision: Every \`plan_fps/steps/*.md\` file must follow the shared step schema (title line, ordered section headings, path lists, Bun-only verification commands, and required log-update labels), and a step may be marked complete only after its focused test plus the required Bun verification sequence pass.
- rationale: D-FPS-003 pins the runtime target to \`bun run doom.ts\`, D-FPS-006 pins Bun as the only runtime and test toolchain, and D-FPS-011 turns later parity work into a strict acceptance gate. A machine-checkable step schema is required before the later validator implementation steps so the Ralph loop can reject malformed step files and incomplete verification sequences deterministically.
- evidence: plan_fps/README.md, plan_fps/manifests/00-012-define-step-validation-rules.json, package.json, tsconfig.json
- affected_steps: 00-012, 00-013, 00-014, 15-001
- supersedes: none`;

function escapeRegularExpression(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractListItems(sectionBody: string): string[] {
  return sectionBody
    .split(/\r?\n/)
    .filter((line) => line.startsWith('- '))
    .map((line) => line.slice(2));
}

function extractLogUpdateLabels(sectionBody: string): string[] {
  return extractListItems(sectionBody).map((line) => {
    const labelMatch = /^`([^`]+)`: /.exec(line);

    if (!labelMatch) {
      throw new Error(`Missing required log-update label: ${line}`);
    }

    return labelMatch[1];
  });
}

function getSectionBody(fileContents: string, heading: string): string {
  const sectionPattern = new RegExp(`## ${escapeRegularExpression(heading)}\\r?\\n([\\s\\S]*?)(?=\\r?\\n## |$)`);
  const sectionMatch = sectionPattern.exec(fileContents);

  if (!sectionMatch) {
    throw new Error(`Missing section: ${heading}`);
  }

  return sectionMatch[1].trimEnd();
}

function getSectionHeadings(fileContents: string): string[] {
  return Array.from(fileContents.matchAll(/^## (.+)$/gm), (match) => match[1]);
}

describe('00-012 define-step-validation-rules manifest', () => {
  test('locks the manifest schema exactly', async () => {
    const manifest = (await Bun.file(manifestPath).json()) as StepValidationManifest;

    expect(manifest).toEqual(expectedManifest);
  });

  test('matches the live step file contract and Bun-only verification minimum', async () => {
    const manifest = (await Bun.file(manifestPath).json()) as StepValidationManifest;
    const stepFileContents = await Bun.file(stepFilePath).text();
    const fileNamePattern = new RegExp(manifest.stepFileContract.fileNamePattern);
    const headingPattern = new RegExp(manifest.stepFileContract.headingPattern);
    const pathBulletPattern = new RegExp(manifest.stepFileContract.pathBulletPattern);
    const prerequisiteBulletPattern = new RegExp(manifest.stepFileContract.prerequisiteBulletPattern);
    const sectionHeadings = getSectionHeadings(stepFileContents);
    const verificationItems = extractListItems(getSectionBody(stepFileContents, manifest.stepFileContract.commandSectionHeading));

    expect(basename(stepFilePath)).toMatch(fileNamePattern);
    expect(stepFileContents.split(/\r?\n/, 1)[0]).toMatch(headingPattern);
    expect(sectionHeadings).toEqual(manifest.stepFileContract.requiredSectionOrder);

    const prerequisiteItems = extractListItems(getSectionBody(stepFileContents, 'Prerequisites'));

    expect(prerequisiteItems).toHaveLength(1);
    expect(`- ${prerequisiteItems[0]}`).toMatch(prerequisiteBulletPattern);

    for (const sectionHeading of manifest.stepFileContract.pathListSectionHeadings) {
      const pathItems = extractListItems(getSectionBody(stepFileContents, sectionHeading));

      expect(pathItems.length).toBeGreaterThan(0);

      for (const pathItem of pathItems) {
        expect(`- ${pathItem}`).toMatch(pathBulletPattern);
      }
    }

    expect(verificationItems).toHaveLength(manifest.verificationRules.stepFileCommandPatterns.length);

    manifest.verificationRules.stepFileCommandPatterns.forEach((pattern, index) => {
      expect(verificationItems[index]).toMatch(new RegExp(pattern));
    });

    const requiredLogUpdateLabels = extractLogUpdateLabels(getSectionBody(stepFileContents, 'Required Log Updates'));

    expect(requiredLogUpdateLabels).toEqual(manifest.stepFileContract.requiredLogUpdateLabels);
  });

  test('rejects malformed names, headings, prerequisites, paths, and non-Bun command examples', async () => {
    const manifest = (await Bun.file(manifestPath).json()) as StepValidationManifest;
    const fileNamePattern = new RegExp(manifest.stepFileContract.fileNamePattern);
    const headingPattern = new RegExp(manifest.stepFileContract.headingPattern);
    const prerequisiteBulletPattern = new RegExp(manifest.stepFileContract.prerequisiteBulletPattern);
    const pathBulletPattern = new RegExp(manifest.stepFileContract.pathBulletPattern);

    expect('0-12-define-step-validation-rules.md').not.toMatch(fileNamePattern);
    expect('00-12-define-step-validation-rules.md').not.toMatch(fileNamePattern);
    expect('00-012-Define-Step-Validation-Rules.md').not.toMatch(fileNamePattern);
    expect('# [x] STEP 00-012: Define Step Validation Rules').not.toMatch(headingPattern);
    expect('# [ ] step 00-012: Define Step Validation Rules').not.toMatch(headingPattern);
    expect('# [ ] STEP 0-12: Define Step Validation Rules').not.toMatch(headingPattern);

    expect('- 00-12').not.toMatch(prerequisiteBulletPattern);
    expect('- NONE').not.toMatch(prerequisiteBulletPattern);
    expect('- has spaces.md').not.toMatch(pathBulletPattern);
    expect('- back\\slashed.md').not.toMatch(pathBulletPattern);

    const focusedTestPattern = new RegExp(manifest.verificationRules.stepFileCommandPatterns[0]);
    const fullSuitePattern = new RegExp(manifest.verificationRules.stepFileCommandPatterns[1]);
    const typecheckPattern = new RegExp(manifest.verificationRules.stepFileCommandPatterns[2]);

    expect('`npm test test/plan_fps/00-012-define-step-validation-rules.test.ts`').not.toMatch(focusedTestPattern);
    expect('`bun test test/plan_fps/00-012-define-step-validation-rules.test.ts`').toMatch(focusedTestPattern);
    expect('`yarn test`').not.toMatch(fullSuitePattern);
    expect('`bun test`').toMatch(fullSuitePattern);
    expect('`tsc --noEmit`').not.toMatch(typecheckPattern);
    expect('`bun x tsc --noEmit --project tsconfig.json`').toMatch(typecheckPattern);
  });

  test('locks the structural invariants of the manifest', async () => {
    const manifest = (await Bun.file(manifestPath).json()) as StepValidationManifest;

    const orders = manifest.verificationRules.loopCommandOrder.map((rule) => rule.order);
    expect(orders).toEqual([1, 2, 3, 4, 5]);
    expect(orders).toEqual([...orders].sort((left, right) => left - right));

    const kinds = manifest.verificationRules.loopCommandOrder.map((rule) => rule.kind);
    expect(new Set(kinds).size).toBe(kinds.length);

    for (const rule of manifest.verificationRules.loopCommandOrder) {
      const fieldsPresent: Array<keyof LoopCommandRule> = (['command', 'commandPattern', 'commandSource'] as const).filter((key) => rule[key] !== undefined);

      expect(fieldsPresent).toHaveLength(1);
    }

    expect(manifest.evidencePaths).toEqual([...manifest.evidencePaths].sort());
    expect(new Set(manifest.evidencePaths).size).toBe(manifest.evidencePaths.length);

    for (const evidencePath of manifest.evidencePaths) {
      expect(await Bun.file(resolve(workspaceRootPath, evidencePath)).exists()).toBe(true);
    }

    expect(manifest.currentWorkspace.packageJson.requiredBunScriptNames).toEqual([...manifest.currentWorkspace.packageJson.requiredBunScriptNames].sort());
    expect(new Set(manifest.currentWorkspace.packageJson.requiredBunScriptNames).size).toBe(manifest.currentWorkspace.packageJson.requiredBunScriptNames.length);

    expect(new Set(manifest.stepFileContract.requiredSectionOrder).size).toBe(manifest.stepFileContract.requiredSectionOrder.length);

    for (const heading of manifest.stepFileContract.pathListSectionHeadings) {
      expect(manifest.stepFileContract.requiredSectionOrder).toContain(heading);
    }

    expect(new Set(manifest.stepFileContract.requiredLogUpdateLabels).size).toBe(manifest.stepFileContract.requiredLogUpdateLabels.length);

    expect(manifest.verificationRules.stepFileCommandPatterns).toHaveLength(3);
  });

  test('records the exact decision and the live Bun workspace constraints', async () => {
    const manifest = (await Bun.file(manifestPath).json()) as StepValidationManifest;
    const decisionLogContents = await Bun.file(resolve(workspaceRootPath, 'plan_fps/DECISION_LOG.md')).text();
    const packageJson = (await Bun.file(packageJsonPath).json()) as {
      private: boolean;
      scripts: Record<string, string>;
      type: string;
    };
    const readmeContents = await Bun.file(readmePath).text();
    const tsconfig = (await Bun.file(tsconfigPath).json()) as {
      compilerOptions: {
        noEmit: boolean;
        types: string[];
      };
    };

    expect(decisionLogContents).toContain(expectedDecisionLogEntry);
    expect(packageJson.private).toBe(manifest.currentWorkspace.packageJson.private);
    expect(packageJson.type).toBe(manifest.currentWorkspace.packageJson.type);
    expect(Object.keys(packageJson.scripts).sort()).toEqual(manifest.currentWorkspace.packageJson.requiredBunScriptNames);

    for (const scriptName of manifest.currentWorkspace.packageJson.requiredBunScriptNames) {
      expect(packageJson.scripts[scriptName]).toStartWith(manifest.currentWorkspace.packageJson.requiredScriptCommandPrefix);
    }

    expect(tsconfig.compilerOptions.noEmit).toBe(manifest.currentWorkspace.tsconfigJson.noEmit);
    expect(tsconfig.compilerOptions.types).toEqual(manifest.currentWorkspace.tsconfigJson.requiredTypes);
    expect(readmeContents).toContain('Final command: `bun run doom.ts`');
    expect(readmeContents).toContain('bun run format');
    expect(readmeContents).toContain('bun test plan_fps/validate-plan.test.ts');
    expect(readmeContents).toContain('bun run plan_fps/validate-plan.ts');
    expect(readmeContents).toMatch(/bun test\r?\nbun x tsc --noEmit --project tsconfig\.json/);

    for (const evidencePath of manifest.evidencePaths) {
      expect(Bun.file(resolve(workspaceRootPath, evidencePath)).size).toBeGreaterThan(0);
    }
  });
});
