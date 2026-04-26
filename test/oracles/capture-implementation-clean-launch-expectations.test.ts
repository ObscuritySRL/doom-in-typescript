import { describe, expect, test } from 'bun:test';

const expectedFixture = {
  captureCommand: {
    contractSource: 'plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json',
    currentImplementation: 'bun run start -- [--iwad <path-to-iwad>] [--map E1M1] [--skill 2] [--scale 2]',
    refreshCommand: 'bun test test/oracles/capture-implementation-clean-launch-expectations.test.ts',
    targetPlayable: 'bun run doom.ts',
  },
  commandContracts: {
    currentLauncher: {
      entryFile: 'src/main.ts',
      helpUsageLines: ['  bun run start -- [--iwad <path-to-iwad>] [--map E1M1] [--skill 2] [--scale 2]', '  bun run start -- [--iwad <path-to-iwad>] --list-maps'],
      packageScript: 'start',
      packageScriptCommand: 'bun run src/main.ts',
    },
    targetPlayable: {
      entryFile: 'doom.ts',
      runtimeCommand: 'bun run doom.ts',
    },
  },
  expectedSourceHashes: [
    {
      path: 'package.json',
      sha256: '9075b8e3bd095247d470794741803868200ffa6788e43482988ab1b0907384fe',
      sizeBytes: 569,
    },
    {
      path: 'src/main.ts',
      sha256: '019ea4be868270e62d17d3557679dbecf0cbf838c10f07c393d1d9cd54300f44',
      sizeBytes: 3239,
    },
    {
      path: 'tsconfig.json',
      sha256: '49105a2f714747072109fdd48aebdd831c4f6df5eaaaddc3d0204df368f62b62',
      sizeBytes: 645,
    },
  ],
  expectedTransitionTrace: [
    {
      evidence: 'const commandLine = new CommandLine(Bun.argv);',
      ordinal: 1,
      path: 'src/main.ts',
      surface: 'bun-argv-command-line',
    },
    {
      evidence: "const DEFAULT_MAP_NAME = 'E1M1';",
      ordinal: 2,
      path: 'src/main.ts',
      surface: 'default-gameplay-map',
    },
    {
      evidence: "console.log('Opening gameplay window. Use Tab to switch to the automap.');",
      ordinal: 3,
      path: 'src/main.ts',
      surface: 'gameplay-first-console-message',
    },
    {
      evidence: '  The launcher now starts in the gameplay view and can switch to automap on demand.',
      ordinal: 4,
      path: 'src/main.ts',
      surface: 'gameplay-first-help-note',
    },
    {
      evidence: 'const session = createLauncherSession(resources, {',
      ordinal: 5,
      path: 'src/main.ts',
      surface: 'launcher-session-creation',
    },
    {
      evidence: 'await runLauncherWindow(session, {',
      ordinal: 6,
      path: 'src/main.ts',
      surface: 'launcher-window-entry',
    },
    {
      evidence: "if (commandLine.parameterExists('--list-maps')) {",
      ordinal: 7,
      path: 'src/main.ts',
      surface: 'list-maps-early-return',
    },
  ],
  schemaVersion: 1,
  sourceAuthority: [
    {
      authority: 'local-primary',
      id: 'S-FPS-009',
      path: 'package.json',
      source: 'package manifest',
    },
    {
      authority: 'local-primary',
      id: 'S-FPS-010',
      path: 'tsconfig.json',
      source: 'TypeScript config',
    },
    {
      authority: 'local-primary',
      id: 'S-FPS-011',
      path: 'src/main.ts',
      source: 'current launcher entry',
    },
  ],
  stepId: '02-001',
  stepTitle: 'capture-implementation-clean-launch-expectations',
  tickFrameWindow: {
    description: 'Static clean-launch expectation capture from the visible implementation launch surface before a live replay capture command exists.',
    frameEnd: 0,
    frameStart: 0,
    ticEnd: 0,
    ticStart: 0,
  },
} as const;

describe('capture implementation clean launch expectations oracle', () => {
  test('locks the oracle fixture exactly', async () => {
    const fixture: unknown = await Bun.file('test/oracles/fixtures/capture-implementation-clean-launch-expectations.json').json();

    expect(fixture).toEqual(expectedFixture);
  });

  test('records command contract and launch trace from the 01-015 manifest', async () => {
    const manifest: unknown = await Bun.file('plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json').json();

    expect(manifest).toMatchObject({
      commandContracts: expectedFixture.commandContracts,
      observedLaunchSurfaces: expectedFixture.expectedTransitionTrace.map(({ ordinal, ...launchSurface }) => launchSurface),
      schemaVersion: 1,
      sourceCatalogEvidence: expectedFixture.sourceAuthority,
      sourceHashes: expectedFixture.expectedSourceHashes,
      stepId: '01-015',
    });
  });

  test('pins the tick and frame window for static clean-launch expectation capture', () => {
    expect(expectedFixture.tickFrameWindow).toEqual({
      description: 'Static clean-launch expectation capture from the visible implementation launch surface before a live replay capture command exists.',
      frameEnd: 0,
      frameStart: 0,
      ticEnd: 0,
      ticStart: 0,
    });
  });

  test('keeps source authority aligned with the source catalog', async () => {
    const sourceCatalog = await Bun.file('plan_fps/SOURCE_CATALOG.md').text();

    expect(sourceCatalog).toContain('| S-FPS-009 | package manifest | file | local-primary | `package.json` | Bun package and dependency inventory. |');
    expect(sourceCatalog).toContain('| S-FPS-010 | TypeScript config | file | local-primary | `tsconfig.json` | Typecheck target for step verification. |');
    expect(sourceCatalog).toContain('| S-FPS-011 | current launcher entry | file | local-primary | `src/main.ts` | Current launcher surface, not the final requested `doom.ts` command. |');
  });

  test('registers the oracle artifact and refresh command', async () => {
    const referenceOracles = await Bun.file('plan_fps/REFERENCE_ORACLES.md').text();

    expect(referenceOracles).toContain(
      '| OR-FPS-006 | `test/oracles/fixtures/capture-implementation-clean-launch-expectations.json` | derived implementation clean-launch expectation from `plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json` | `bun test test/oracles/capture-implementation-clean-launch-expectations.test.ts` |',
    );
  });

  test('recomputes recorded source hashes from on-disk file contents', async () => {
    for (const expected of expectedFixture.expectedSourceHashes) {
      const buffer = await Bun.file(expected.path).arrayBuffer();
      const actualSha256 = new Bun.CryptoHasher('sha256').update(new Uint8Array(buffer)).digest('hex');

      expect({ path: expected.path, sha256: actualSha256, sizeBytes: buffer.byteLength }).toEqual({
        path: expected.path,
        sha256: expected.sha256,
        sizeBytes: expected.sizeBytes,
      });
    }
  });

  test('confirms recorded transition-trace evidence appears verbatim in the source files', async () => {
    const fileTextByPath = new Map<string, string>();
    for (const traceEntry of expectedFixture.expectedTransitionTrace) {
      let fileText = fileTextByPath.get(traceEntry.path);
      if (fileText === undefined) {
        fileText = await Bun.file(traceEntry.path).text();
        fileTextByPath.set(traceEntry.path, fileText);
      }

      expect({ surface: traceEntry.surface, evidencePresent: fileText.includes(traceEntry.evidence) }).toEqual({
        surface: traceEntry.surface,
        evidencePresent: true,
      });
    }
  });
});
