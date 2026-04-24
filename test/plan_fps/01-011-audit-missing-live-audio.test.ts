import { describe, expect, test } from 'bun:test';

type JsonArray = JsonValue[];
type JsonObject = { [key: string]: JsonValue };
type JsonValue = boolean | JsonArray | JsonObject | null | number | string;

const EXPECTED_MANIFEST = {
  audioDependencyEvidence: [
    {
      declaredVersion: '^1.0.2',
      dependencyName: '@bun-win32/winmm',
      liveAudioWiringVisible: false,
      path: 'package.json',
      purpose: 'WinMM binding package declared in workspace dependencies; no allowed launcher import uses it in this read scope.',
    },
  ],
  commandContracts: {
    current: {
      entryFile: 'src/main.ts',
      scriptName: 'start',
      scriptValue: 'bun run src/main.ts',
    },
    target: {
      entryFile: 'doom.ts',
      runtimeCommand: 'bun run doom.ts',
    },
  },
  explicitNullSurfaces: [
    {
      name: 'audio-event-queue',
      path: null,
      reason: 'No per-tic or host audio event queue is exposed by src/main.ts.',
    },
    {
      name: 'audio-hash-window-capture',
      path: null,
      reason: 'No audio hash capture path is exposed by the allowed read scope.',
    },
    {
      name: 'live-audio-host',
      path: null,
      reason: 'No live audio host open/start call is exposed by src/main.ts.',
    },
    {
      name: 'live-music-playback',
      path: null,
      reason: 'No music playback route is exposed by src/main.ts.',
    },
    {
      name: 'live-sfx-mixer',
      path: null,
      reason: 'No sound-effect mixer route is exposed by src/main.ts.',
    },
    {
      name: 'menu-sound-events',
      path: null,
      reason: 'No menu controller or menu sound event route is exposed by src/main.ts.',
    },
    {
      name: 'shutdown-audio-path',
      path: null,
      reason: 'No audio shutdown route is exposed by src/main.ts.',
    },
    {
      name: 'volume-control-route',
      path: null,
      reason: 'No sound or music volume control route is exposed by src/main.ts.',
    },
  ],
  launcherSource: {
    defaultMapName: 'E1M1',
    defaultScale: 2,
    defaultSkill: 2,
    documentedControls: [
      'W/S or Up/Down: move forward or backward',
      'A/D or Left/Right: turn left or right',
      'Q/E: strafe left or right',
      'Shift: run',
      'Tab: toggle gameplay view and automap',
      'PageUp/PageDown: zoom the automap',
      'F: toggle automap follow',
      'Esc: quit',
    ],
    helpTextAudioControlVisible: false,
    imports: [
      {
        kind: 'bootstrap',
        path: './bootstrap/cmdline.ts',
        symbols: ['CommandLine'],
      },
      {
        kind: 'launcher-session',
        path: './launcher/session.ts',
        symbols: ['createLauncherSession', 'loadLauncherResources'],
      },
      {
        kind: 'launcher-host',
        path: './launcher/win32.ts',
        symbols: ['runLauncherWindow'],
      },
      {
        kind: 'reference-policy',
        path: './reference/policy.ts',
        symbols: ['REFERENCE_BUNDLE_PATH'],
      },
      {
        kind: 'reference-target',
        path: './reference/target.ts',
        symbols: ['PRIMARY_TARGET'],
      },
    ],
    launchTransitions: ['create CommandLine from Bun.argv', 'resolve IWAD path', 'load launcher resources', 'create gameplay launcher session', 'run launcher window'],
    path: 'src/main.ts',
    sha256: '019ea4be868270e62d17d3557679dbecf0cbf838c10f07c393d1d9cd54300f44',
    visibleAudioCalls: [],
  },
  observedSurfaces: [
    {
      name: 'package-winmm-dependency',
      path: 'package.json',
      summary: 'Workspace declares @bun-win32/winmm, an audio-adjacent WinMM binding package.',
    },
    {
      name: 'src-main-gameplay-window-launch',
      path: 'src/main.ts',
      summary: 'Launcher creates a gameplay session and awaits runLauncherWindow without exposing live audio wiring.',
    },
    {
      name: 'src-main-help-text-without-audio-controls',
      path: 'src/main.ts',
      summary: 'Help text documents movement, automap, and quit controls, with no sound, music, or volume controls.',
    },
  ],
  packageManifest: {
    dependencies: {
      '@bun-win32/core': '^1.1.1',
      '@bun-win32/gdi32': '^1.0.12',
      '@bun-win32/kernel32': '^1.0.21',
      '@bun-win32/user32': '^3.0.20',
      '@bun-win32/winmm': '^1.0.2',
    },
    name: 'doom-codex',
    path: 'package.json',
    scripts: {
      format: 'bun run tools/format-changed.ts',
      start: 'bun run src/main.ts',
    },
    sha256: '9075b8e3bd095247d470794741803868200ffa6788e43482988ab1b0907384fe',
    type: 'module',
  },
  readScope: ['package.json', 'plan_fps/FACT_LOG.md', 'plan_fps/SOURCE_CATALOG.md', 'src/main.ts', 'tsconfig.json'],
  schemaVersion: 1,
  sourceCatalogEvidence: [
    {
      authority: 'local-primary',
      id: 'S-FPS-009',
      kind: 'file',
      path: 'package.json',
      source: 'package manifest',
    },
    {
      authority: 'local-primary',
      id: 'S-FPS-010',
      kind: 'file',
      path: 'tsconfig.json',
      source: 'TypeScript config',
    },
    {
      authority: 'local-primary',
      id: 'S-FPS-011',
      kind: 'file',
      path: 'src/main.ts',
      source: 'current launcher entry',
    },
  ],
  step: {
    id: '01-011',
    title: 'audit-missing-live-audio',
  },
  tsconfig: {
    compilerOptionsNoEmit: true,
    include: ['src', 'test', 'tools'],
    path: 'tsconfig.json',
    sha256: '49105a2f714747072109fdd48aebdd831c4f6df5eaaaddc3d0204df368f62b62',
    types: ['bun'],
  },
} satisfies JsonObject;

const FACT_LOG_PATH = 'plan_fps/FACT_LOG.md';
const MANIFEST_PATH = 'plan_fps/manifests/01-011-audit-missing-live-audio.json';
const PACKAGE_JSON_PATH = 'package.json';
const SOURCE_CATALOG_PATH = 'plan_fps/SOURCE_CATALOG.md';
const SOURCE_MAIN_PATH = 'src/main.ts';
const TSCONFIG_PATH = 'tsconfig.json';

describe('01-011 audit missing live audio manifest', () => {
  test('locks the manifest schema and exact audit values', async () => {
    expect(await readJsonObject(MANIFEST_PATH)).toEqual(EXPECTED_MANIFEST);
  });

  test('cross-checks live package and TypeScript configuration values', async () => {
    const packageManifest = await readJsonObject(PACKAGE_JSON_PATH);
    const packageDependencies = getJsonObject(packageManifest, 'dependencies');
    const packageScripts = getJsonObject(packageManifest, 'scripts');
    const tsconfig = await readJsonObject(TSCONFIG_PATH);
    const tsconfigCompilerOptions = getJsonObject(tsconfig, 'compilerOptions');

    expect(getJsonString(packageManifest, 'name')).toBe('doom-codex');
    expect(getJsonString(packageManifest, 'type')).toBe('module');
    expect(getJsonString(packageDependencies, '@bun-win32/winmm')).toBe('^1.0.2');
    expect(Object.keys(packageDependencies).sort()).toEqual(['@bun-win32/core', '@bun-win32/gdi32', '@bun-win32/kernel32', '@bun-win32/user32', '@bun-win32/winmm']);
    expect(getJsonString(packageScripts, 'start')).toBe('bun run src/main.ts');
    expect(getJsonBoolean(tsconfigCompilerOptions, 'noEmit')).toBe(true);
    expect(getJsonArray(tsconfig, 'include')).toEqual(['src', 'test', 'tools']);
    expect(getJsonArray(tsconfigCompilerOptions, 'types')).toEqual(['bun']);
  });

  test('cross-checks source hashes and the visible launcher transition', async () => {
    const sourceText = await Bun.file(SOURCE_MAIN_PATH).text();

    expect(await createSha256Digest(PACKAGE_JSON_PATH)).toBe('9075b8e3bd095247d470794741803868200ffa6788e43482988ab1b0907384fe');
    expect(await createSha256Digest(TSCONFIG_PATH)).toBe('49105a2f714747072109fdd48aebdd831c4f6df5eaaaddc3d0204df368f62b62');
    expect(await createSha256Digest(SOURCE_MAIN_PATH)).toBe('019ea4be868270e62d17d3557679dbecf0cbf838c10f07c393d1d9cd54300f44');
    expect(sourceText).toContain("import { runLauncherWindow } from './launcher/win32.ts';");
    expect(sourceText).toContain('const session = createLauncherSession(resources, {');
    expect(sourceText).toContain('await runLauncherWindow(session, {');
    expect(sourceText.indexOf('const session = createLauncherSession(resources, {')).toBeLessThan(sourceText.indexOf('await runLauncherWindow(session, {'));
    expect(sourceText).toContain('Opening gameplay window. Use Tab to switch to the automap.');
    expect(sourceText).not.toContain('audio');
    expect(sourceText).not.toContain('music');
    expect(sourceText).not.toContain('volume');
  });

  test('keeps explicit null surfaces sorted with null paths', async () => {
    const manifest = await readJsonObject(MANIFEST_PATH);
    const explicitNullSurfaces = getJsonArray(manifest, 'explicitNullSurfaces');
    const explicitNullSurfaceNames = explicitNullSurfaces.map((surface) => getJsonString(assertJsonObject(surface), 'name'));

    expect(explicitNullSurfaceNames).toEqual(['audio-event-queue', 'audio-hash-window-capture', 'live-audio-host', 'live-music-playback', 'live-sfx-mixer', 'menu-sound-events', 'shutdown-audio-path', 'volume-control-route']);
    expect(explicitNullSurfaceNames).toEqual([...explicitNullSurfaceNames].sort());
    expect(explicitNullSurfaces.every((surface) => getJsonValue(assertJsonObject(surface), 'path') === null)).toBe(true);
  });

  test('verifies source catalog and durable fact evidence', async () => {
    const factLogText = await Bun.file(FACT_LOG_PATH).text();
    const sourceCatalogText = await Bun.file(SOURCE_CATALOG_PATH).text();

    expect(sourceCatalogText).toContain('| S-FPS-009 | package manifest | file | local-primary | `package.json` | Bun package and dependency inventory. |');
    expect(sourceCatalogText).toContain('| S-FPS-010 | TypeScript config | file | local-primary | `tsconfig.json` | Typecheck target for step verification. |');
    expect(sourceCatalogText).toContain('| S-FPS-011 | current launcher entry | file | local-primary | `src/main.ts` | Current launcher surface, not the final requested `doom.ts` command. |');
    expect(factLogText).toContain('## F-FPS-019');
    expect(factLogText).toContain(
      'Within the 01-011 read scope, `src/main.ts` launches `runLauncherWindow` without any exposed live audio host, mixer, music, sound-effect, volume, or audio hash surfaces; only the package-level `@bun-win32/winmm` dependency is visible as an audio-adjacent capability.',
    );
  });
});

async function createSha256Digest(filePath: string): Promise<string> {
  const hasher = new Bun.CryptoHasher('sha256');

  hasher.update(await Bun.file(filePath).arrayBuffer());

  return hasher.digest('hex');
}

function assertJsonObject(value: JsonValue): JsonObject {
  if (isJsonObject(value)) {
    return value;
  }

  throw new Error('Expected JSON object.');
}

function getJsonArray(jsonObject: JsonObject, key: string): JsonArray {
  const value = getJsonValue(jsonObject, key);

  if (Array.isArray(value)) {
    return value;
  }

  throw new Error(`Expected ${key} to be a JSON array.`);
}

function getJsonBoolean(jsonObject: JsonObject, key: string): boolean {
  const value = getJsonValue(jsonObject, key);

  if (typeof value === 'boolean') {
    return value;
  }

  throw new Error(`Expected ${key} to be a JSON boolean.`);
}

function getJsonObject(jsonObject: JsonObject, key: string): JsonObject {
  return assertJsonObject(getJsonValue(jsonObject, key));
}

function getJsonString(jsonObject: JsonObject, key: string): string {
  const value = getJsonValue(jsonObject, key);

  if (typeof value === 'string') {
    return value;
  }

  throw new Error(`Expected ${key} to be a JSON string.`);
}

function getJsonValue(jsonObject: JsonObject, key: string): JsonValue {
  if (Object.hasOwn(jsonObject, key)) {
    return jsonObject[key];
  }

  throw new Error(`Missing JSON key ${key}.`);
}

function isJsonObject(value: JsonValue): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function readJsonObject(filePath: string): Promise<JsonObject> {
  const parsedValue = JSON.parse(await Bun.file(filePath).text()) as JsonValue;

  return assertJsonObject(parsedValue);
}
