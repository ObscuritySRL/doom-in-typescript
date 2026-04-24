import { describe, expect, test } from 'bun:test';

type JsonArray = JsonValue[];
type JsonObject = { [key: string]: JsonValue };
type JsonValue = JsonArray | JsonObject | boolean | null | number | string;

const FIXTURE_PATH = 'test/oracles/fixtures/capture-startup-sequence.json';
const MANIFEST_PATH = 'plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json';
const REFERENCE_ORACLES_PATH = 'plan_fps/REFERENCE_ORACLES.md';
const SOURCE_CATALOG_PATH = 'plan_fps/SOURCE_CATALOG.md';

function getJsonArray(sourceObject: JsonObject, key: string): JsonArray {
  const value = sourceObject[key];

  if (!Array.isArray(value)) {
    throw new Error(`Expected ${key} to be an array`);
  }

  return value;
}

function getJsonObject(sourceObject: JsonObject, key: string): JsonObject {
  const value = sourceObject[key];

  if (!isJsonObject(value)) {
    throw new Error(`Expected ${key} to be an object`);
  }

  return value;
}

function getNumber(sourceObject: JsonObject, key: string): number {
  const value = sourceObject[key];

  if (typeof value !== 'number') {
    throw new Error(`Expected ${key} to be a number`);
  }

  return value;
}

function getString(sourceObject: JsonObject, key: string): string {
  const value = sourceObject[key];

  if (typeof value !== 'string') {
    throw new Error(`Expected ${key} to be a string`);
  }

  return value;
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function readJsonObject(path: string): Promise<JsonObject> {
  const parsedJson: unknown = JSON.parse(await Bun.file(path).text());

  if (!isJsonObject(parsedJson)) {
    throw new Error(`Expected ${path} to contain a JSON object`);
  }

  return parsedJson;
}

async function sha256Hex(content: string): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(content));

  return Array.from(new Uint8Array(hashBuffer), (byteValue) => byteValue.toString(16).padStart(2, '0')).join('');
}

function toJsonObjects(values: JsonArray, label: string): JsonObject[] {
  return values.map((value, valueIndex) => {
    if (!isJsonObject(value)) {
      throw new Error(`Expected ${label}[${valueIndex}] to be an object`);
    }

    return value;
  });
}

describe('capture-startup-sequence oracle', () => {
  test('locks the fixture contract exactly', async () => {
    const fixture = await readJsonObject(FIXTURE_PATH);

    expect(fixture).toEqual({
      captureCommand: {
        captureMode: 'startup-sequence-static-contract',
        currentLauncherCommand: 'bun run start',
        currentLauncherEntryFile: 'src/main.ts',
        currentLauncherPackageScriptCommand: 'bun run src/main.ts',
        targetPlayableCommand: 'bun run doom.ts',
        targetPlayableEntryFile: 'doom.ts',
      },
      captureWindow: {
        endFrame: 5,
        endTic: 5,
        frameRateSource: 'one startup observation per captured transition',
        startFrame: 0,
        startTic: 0,
        ticRateHz: 35,
      },
      expectedStartupTrace: [
        {
          evidence: 'const commandLine = new CommandLine(Bun.argv);',
          frame: 0,
          phase: 'bun-argv-command-line',
          sourcePath: 'src/main.ts',
          tic: 0,
        },
        {
          evidence: "const DEFAULT_MAP_NAME = 'E1M1';",
          frame: 1,
          phase: 'default-gameplay-map',
          sourcePath: 'src/main.ts',
          tic: 1,
        },
        {
          evidence: "if (commandLine.parameterExists('--list-maps')) {",
          frame: 2,
          phase: 'list-maps-early-return',
          sourcePath: 'src/main.ts',
          tic: 2,
        },
        {
          evidence: 'const session = createLauncherSession(resources, {',
          frame: 3,
          phase: 'launcher-session-creation',
          sourcePath: 'src/main.ts',
          tic: 3,
        },
        {
          evidence: "console.log('Opening gameplay window. Use Tab to switch to the automap.');",
          frame: 4,
          phase: 'gameplay-first-console-message',
          sourcePath: 'src/main.ts',
          tic: 4,
        },
        {
          evidence: 'await runLauncherWindow(session, {',
          frame: 5,
          phase: 'launcher-window-entry',
          sourcePath: 'src/main.ts',
          tic: 5,
        },
      ],
      expectedTraceHash: {
        algorithm: 'sha256',
        input: 'JSON.stringify(expectedStartupTrace)',
        value: '443afed7fbe2b545229b10be974a3127c7aedc35b01f078ea60cc1c2b25c333c',
      },
      schemaVersion: 1,
      sourceAuthority: [
        {
          authority: 'local-primary-binary',
          path: 'doom/DOOMD.EXE',
          role: 'preferred executable authority when usable',
          sourceIdentifier: 'S-FPS-005',
        },
        {
          authority: 'local-primary-data',
          path: 'doom/DOOM1.WAD',
          role: 'shareware IWAD data',
          sourceIdentifier: 'S-FPS-006',
        },
        {
          authority: 'local-primary',
          path: 'src/main.ts',
          role: 'current launcher startup surface',
          sourceIdentifier: 'S-FPS-011',
        },
      ],
      sourceHashes: [
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
      sourceManifest: {
        path: 'plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json',
        schemaVersion: 1,
        stepId: '01-015',
        stepTitle: 'audit-missing-side-by-side-replay',
      },
      stepId: '02-003',
      stepTitle: 'capture-startup-sequence',
    });
  });

  test('derives command and source hashes from the allowed launch-surface manifest', async () => {
    const fixture = await readJsonObject(FIXTURE_PATH);
    const manifest = await readJsonObject(MANIFEST_PATH);
    const captureCommand = getJsonObject(fixture, 'captureCommand');
    const commandContracts = getJsonObject(manifest, 'commandContracts');
    const currentLauncher = getJsonObject(commandContracts, 'currentLauncher');
    const targetPlayable = getJsonObject(commandContracts, 'targetPlayable');
    const sourceManifest = getJsonObject(fixture, 'sourceManifest');

    expect(getNumber(sourceManifest, 'schemaVersion')).toBe(getNumber(manifest, 'schemaVersion'));
    expect(getString(sourceManifest, 'stepId')).toBe(getString(manifest, 'stepId'));
    expect(getString(sourceManifest, 'stepTitle')).toBe(getString(manifest, 'stepTitle'));
    expect(getString(captureCommand, 'currentLauncherPackageScriptCommand')).toBe(getString(currentLauncher, 'packageScriptCommand'));
    expect(getString(captureCommand, 'currentLauncherEntryFile')).toBe(getString(currentLauncher, 'entryFile'));
    expect(getString(captureCommand, 'targetPlayableCommand')).toBe(getString(targetPlayable, 'runtimeCommand'));
    expect(getString(captureCommand, 'targetPlayableEntryFile')).toBe(getString(targetPlayable, 'entryFile'));
    expect(getJsonArray(fixture, 'sourceHashes')).toEqual(getJsonArray(manifest, 'sourceHashes'));
  });

  test('locks the startup trace hash and transition ordering', async () => {
    const fixture = await readJsonObject(FIXTURE_PATH);
    const expectedStartupTrace = getJsonArray(fixture, 'expectedStartupTrace');
    const expectedTraceHash = getJsonObject(fixture, 'expectedTraceHash');
    const startupTraceEntries = toJsonObjects(expectedStartupTrace, 'expectedStartupTrace');
    const phaseNames = startupTraceEntries.map((startupTraceEntry) => getString(startupTraceEntry, 'phase'));

    expect(await sha256Hex(JSON.stringify(expectedStartupTrace))).toBe(getString(expectedTraceHash, 'value'));
    expect(phaseNames).toEqual(['bun-argv-command-line', 'default-gameplay-map', 'list-maps-early-return', 'launcher-session-creation', 'gameplay-first-console-message', 'launcher-window-entry']);
    expect(phaseNames.indexOf('launcher-session-creation')).toBeLessThan(phaseNames.indexOf('launcher-window-entry'));
    expect(startupTraceEntries.map((startupTraceEntry) => getNumber(startupTraceEntry, 'tic'))).toEqual([0, 1, 2, 3, 4, 5]);
    expect(startupTraceEntries.map((startupTraceEntry) => getNumber(startupTraceEntry, 'frame'))).toEqual([0, 1, 2, 3, 4, 5]);
  });

  test('cross-checks trace evidence against the allowed manifest observations', async () => {
    const fixture = await readJsonObject(FIXTURE_PATH);
    const manifest = await readJsonObject(MANIFEST_PATH);
    const expectedStartupTrace = toJsonObjects(getJsonArray(fixture, 'expectedStartupTrace'), 'expectedStartupTrace');
    const observedLaunchSurfaces = toJsonObjects(getJsonArray(manifest, 'observedLaunchSurfaces'), 'observedLaunchSurfaces');
    const observedEvidenceBySurface = new Map<string, string>();

    for (const observedLaunchSurface of observedLaunchSurfaces) {
      observedEvidenceBySurface.set(getString(observedLaunchSurface, 'surface'), getString(observedLaunchSurface, 'evidence'));
    }

    for (const startupTraceEntry of expectedStartupTrace) {
      expect(observedEvidenceBySurface.get(getString(startupTraceEntry, 'phase'))).toBe(getString(startupTraceEntry, 'evidence'));
      expect(getString(startupTraceEntry, 'sourcePath')).toBe('src/main.ts');
    }
  });

  test('registers source authority and the oracle refresh command', async () => {
    const fixture = await readJsonObject(FIXTURE_PATH);
    const referenceOraclesText = await Bun.file(REFERENCE_ORACLES_PATH).text();
    const sourceCatalogText = await Bun.file(SOURCE_CATALOG_PATH).text();
    const sourceAuthorityEntries = toJsonObjects(getJsonArray(fixture, 'sourceAuthority'), 'sourceAuthority');

    for (const sourceAuthorityEntry of sourceAuthorityEntries) {
      expect(sourceCatalogText).toContain(getString(sourceAuthorityEntry, 'sourceIdentifier'));
      expect(sourceCatalogText).toContain(`\`${getString(sourceAuthorityEntry, 'path')}\``);
    }

    expect(referenceOraclesText).toContain('OR-FPS-008');
    expect(referenceOraclesText).toContain(`\`${FIXTURE_PATH}\``);
    expect(referenceOraclesText).toContain('`bun test test/oracles/capture-startup-sequence.test.ts`');
  });
});
