import { describe, expect, test } from 'bun:test';

interface AuditFinding {
  evidence: string[];
  id: string;
  status: string;
  summary: string;
}

interface CurrentEntrypoint {
  command: string;
  helpUsageLines: string[];
  path: string;
  scriptName: string;
  sourceCatalogId: string;
}

interface ExplicitNull {
  evidence: string[];
  expectedPath: string;
  observedPath: string | null;
  reason: string;
  surface: string;
}

interface MissingEntrypointManifest {
  auditFindings: AuditFinding[];
  currentEntrypoint: CurrentEntrypoint;
  evidencePaths: string[];
  explicitNulls: ExplicitNull[];
  readScope: string[];
  schemaVersion: number;
  sourceHashes: SourceHashes;
  stepId: string;
  stepTitleSlug: string;
  targetCommand: TargetCommand;
  workspace: Workspace;
}

interface SourceHashFile {
  path: string;
  sha256: string;
}

interface SourceHashes {
  algorithm: string;
  files: SourceHashFile[];
}

interface TargetCommand {
  command: string;
  entryFile: string;
  status: string;
  workspacePath: string;
}

interface Workspace {
  packageName: string;
  packageType: string;
  tsconfigIncludes: string[];
  tsconfigNoEmit: boolean;
  tsconfigStrict: boolean;
  tsconfigTypes: string[];
}

const projectRoot = new URL('../../', import.meta.url);

const expectedManifest: MissingEntrypointManifest = {
  auditFindings: [
    {
      evidence: ['package.json:scripts.start', 'src/main.ts:HELP_TEXT'],
      id: 'current-launch-command-uses-src-main',
      status: 'observed',
      summary: 'The current package launch command is bun run src/main.ts, not bun run doom.ts.',
    },
    {
      evidence: ['plan_fps/SOURCE_CATALOG.md:S-FPS-011', 'plan_fps/FACT_LOG.md:F-FPS-005'],
      id: 'root-doom-ts-command-contract-not-implemented-in-current-launcher-surface',
      status: 'missing',
      summary: 'The final root doom.ts command remains a missing implementation surface for later Bun entrypoint steps.',
    },
  ],
  currentEntrypoint: {
    command: 'bun run src/main.ts',
    helpUsageLines: ['bun run start -- [--iwad <path-to-iwad>] [--map E1M1] [--skill 2] [--scale 2]', 'bun run start -- [--iwad <path-to-iwad>] --list-maps'],
    path: 'src/main.ts',
    scriptName: 'start',
    sourceCatalogId: 'S-FPS-011',
  },
  evidencePaths: ['package.json', 'plan_fps/FACT_LOG.md', 'plan_fps/SOURCE_CATALOG.md', 'src/main.ts', 'tsconfig.json'],
  explicitNulls: [
    {
      evidence: ['package.json:scripts.start', 'plan_fps/SOURCE_CATALOG.md:S-FPS-011'],
      expectedPath: 'doom.ts',
      observedPath: null,
      reason: 'The allowed current launch surfaces identify src/main.ts as the launcher and expose no root doom.ts entry file.',
      surface: 'root-entry-file',
    },
    {
      evidence: ['src/main.ts:main', 'src/main.ts:runLauncherWindow'],
      expectedPath: 'doom.ts:main',
      observedPath: null,
      reason: 'The allowed source entrypoint transitions directly from src/main.ts to runLauncherWindow; a root doom.ts transition is not implemented in this read scope.',
      surface: 'root-entrypoint-transition',
    },
    {
      evidence: ['package.json:scripts.start', 'src/main.ts:HELP_TEXT'],
      expectedPath: 'bun run doom.ts',
      observedPath: null,
      reason: 'The allowed launch help and package script advertise the current start/src/main.ts route instead of the target root doom.ts command.',
      surface: 'target-command-in-current-launch-surface',
    },
  ],
  readScope: ['package.json', 'plan_fps/FACT_LOG.md', 'plan_fps/SOURCE_CATALOG.md', 'src/main.ts', 'tsconfig.json'],
  schemaVersion: 1,
  sourceHashes: {
    algorithm: 'SHA-256',
    files: [
      {
        path: 'package.json',
        sha256: '9075b8e3bd095247d470794741803868200ffa6788e43482988ab1b0907384fe',
      },
      {
        path: 'plan_fps/SOURCE_CATALOG.md',
        sha256: '7c8de73fb48a6a12c62798b17efcac2ffba18b6926a350d0d75265e80e51de3c',
      },
      {
        path: 'src/main.ts',
        sha256: '019ea4be868270e62d17d3557679dbecf0cbf838c10f07c393d1d9cd54300f44',
      },
      {
        path: 'tsconfig.json',
        sha256: '49105a2f714747072109fdd48aebdd831c4f6df5eaaaddc3d0204df368f62b62',
      },
    ],
  },
  stepId: '01-007',
  stepTitleSlug: 'audit-missing-bun-run-doom-entrypoint',
  targetCommand: {
    command: 'bun run doom.ts',
    entryFile: 'doom.ts',
    status: 'missing-from-current-launcher-surface',
    workspacePath: 'doom.ts',
  },
  workspace: {
    packageName: 'doom-codex',
    packageType: 'module',
    tsconfigIncludes: ['src', 'test', 'tools'],
    tsconfigNoEmit: true,
    tsconfigStrict: true,
    tsconfigTypes: ['bun'],
  },
};

describe('01-007 audit-missing-bun-run-doom-entrypoint', () => {
  test('locks the exact manifest schema and command gap', async () => {
    const manifest = await readJson('plan_fps/manifests/01-007-audit-missing-bun-run-doom-entrypoint.json');

    expect(manifest).toEqual(expectedManifest);
  });

  test('cross-checks live package and TypeScript command contracts', async () => {
    const packageJson = requireRecord(await readJson('package.json'), 'package.json');
    const packageScripts = requireRecord(packageJson.scripts, 'package.json scripts');
    const targetCommandParts = expectedManifest.targetCommand.command.split(' ');
    const typeScriptConfig = requireRecord(await readJson('tsconfig.json'), 'tsconfig.json');
    const typeScriptCompilerOptions = requireRecord(typeScriptConfig.compilerOptions, 'tsconfig compilerOptions');

    expect(packageJson.name).toBe(expectedManifest.workspace.packageName);
    expect(packageJson.type).toBe(expectedManifest.workspace.packageType);
    expect(packageScripts[expectedManifest.currentEntrypoint.scriptName]).toBe(expectedManifest.currentEntrypoint.command);
    expect(packageScripts[expectedManifest.currentEntrypoint.scriptName]).not.toBe(expectedManifest.targetCommand.command);
    expect(targetCommandParts).toEqual(['bun', 'run', 'doom.ts']);
    expect(typeScriptCompilerOptions.noEmit).toBe(expectedManifest.workspace.tsconfigNoEmit);
    expect(typeScriptCompilerOptions.strict).toBe(expectedManifest.workspace.tsconfigStrict);
    expect(typeScriptCompilerOptions.types).toEqual(expectedManifest.workspace.tsconfigTypes);
    expect(typeScriptConfig.include).toEqual(expectedManifest.workspace.tsconfigIncludes);
  });

  test('cross-checks launcher transition and advertised command surface', async () => {
    const sourceMainText = await readText('src/main.ts');

    expect(sourceMainText).toContain('const commandLine = new CommandLine(Bun.argv);');
    expect(sourceMainText).toContain('const session = createLauncherSession(resources, {');
    expect(sourceMainText).toContain('await runLauncherWindow(session, {');
    expect(sourceMainText).toContain('The launcher now starts in the gameplay view and can switch to automap on demand.');
    expect(sourceMainText).not.toContain(expectedManifest.targetCommand.command);

    for (const helpUsageLine of expectedManifest.currentEntrypoint.helpUsageLines) {
      expect(sourceMainText).toContain(helpUsageLine);
    }
  });

  test('cross-checks source catalog and fact-log evidence', async () => {
    const factLogText = await readText('plan_fps/FACT_LOG.md');
    const sourceCatalogText = await readText('plan_fps/SOURCE_CATALOG.md');

    expect(sourceCatalogText).toContain('| S-FPS-011 | current launcher entry | file | local-primary | `src/main.ts` | Current launcher surface, not the final requested `doom.ts` command. |');
    expect(factLogText).toContain('## F-FPS-015');
    expect(factLogText).toContain('fact: Within the 01-007 read scope, `package.json` exposes `scripts.start` as `bun run src/main.ts`, and the allowed launch surfaces expose no implemented root `doom.ts` command contract.');
  });

  test('verifies recorded hashes for allowed source inputs', async () => {
    for (const sourceHashFile of expectedManifest.sourceHashes.files) {
      expect(await sha256Hex(sourceHashFile.path)).toBe(sourceHashFile.sha256);
    }
  });
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function readJson(relativePath: string): Promise<unknown> {
  const jsonValue: unknown = await Bun.file(new URL(relativePath, projectRoot)).json();

  return jsonValue;
}

async function readText(relativePath: string): Promise<string> {
  return await Bun.file(new URL(relativePath, projectRoot)).text();
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`${label} must be a JSON object.`);
  }

  return value;
}

async function sha256Hex(relativePath: string): Promise<string> {
  const hasher = new Bun.CryptoHasher('sha256');
  hasher.update(await Bun.file(new URL(relativePath, projectRoot)).bytes());
  return hasher.digest('hex');
}
