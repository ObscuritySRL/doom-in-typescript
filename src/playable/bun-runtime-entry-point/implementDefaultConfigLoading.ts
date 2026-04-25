export type DefaultConfigurationLoadStatus = 'loaded' | 'missing';

export interface DefaultConfigurationEntry {
  readonly key: string;
  readonly lineNumber: number;
  readonly value: string;
}

export interface DefaultConfigurationFileReader {
  readonly exists: (configurationPath: string) => Promise<boolean>;
  readonly text: (configurationPath: string) => Promise<string>;
}

export interface DefaultConfigurationLoadResult {
  readonly checkedPaths: readonly string[];
  readonly configurationPath: string | null;
  readonly configurationText: string | null;
  readonly entries: readonly DefaultConfigurationEntry[];
  readonly status: DefaultConfigurationLoadStatus;
}

export const DEFAULT_CONFIGURATION_CANDIDATE_PATHS = ['doom\\default.cfg', 'doom\\chocolate-doom.cfg'] as const;

const bunDefaultConfigurationFileReader: DefaultConfigurationFileReader = {
  exists: async (configurationPath: string): Promise<boolean> => Bun.file(configurationPath).exists(),
  text: async (configurationPath: string): Promise<string> => Bun.file(configurationPath).text(),
};

export const IMPLEMENT_DEFAULT_CONFIG_LOADING_CONTRACT = {
  currentEntrypoint: {
    command: 'bun run src/main.ts',
    helpUsageLines: ['bun run start -- [--iwad <path-to-iwad>] [--map E1M1] [--skill 2] [--scale 2]', 'bun run start -- [--iwad <path-to-iwad>] --list-maps'],
    path: 'src/main.ts',
    scriptName: 'start',
    sourceCatalogId: 'S-FPS-011',
  },
  defaultConfigurationLoading: {
    candidatePaths: DEFAULT_CONFIGURATION_CANDIDATE_PATHS,
    fileReader: 'Bun.file',
    loadTiming: 'launcher-startup-before-session',
    missingResultStatus: 'missing',
    parser: 'whitespace-separated-doom-default-configuration-lines',
    rejectedNodeSurfaces: ['fs', 'node:fs'],
  },
  deterministicReplayCompatibility: {
    gameStateMutation: 'none-before-session',
    loadPhase: 'launcher-startup-before-session',
    replayInputDependency: 'none',
    result: 'default-configuration-loaded-before-deterministic-session-creation',
  },
  schemaVersion: 1,
  sourceManifestPath: 'plan_fps/manifests/01-007-audit-missing-bun-run-doom-entrypoint.json',
  stepId: '03-009',
  stepTitleSlug: 'implement-default-config-loading',
  targetCommand: {
    command: 'bun run doom.ts',
    entryFile: 'doom.ts',
    status: 'missing-from-current-launcher-surface',
    workspacePath: 'doom.ts',
  },
} as const;

export async function loadDefaultConfiguration(
  candidatePaths: readonly string[] = DEFAULT_CONFIGURATION_CANDIDATE_PATHS,
  fileReader: DefaultConfigurationFileReader = bunDefaultConfigurationFileReader,
): Promise<DefaultConfigurationLoadResult> {
  const checkedPaths: string[] = [];

  for (const configurationPath of candidatePaths) {
    checkedPaths.push(configurationPath);

    if (await fileReader.exists(configurationPath)) {
      const configurationText = await fileReader.text(configurationPath);

      return {
        checkedPaths,
        configurationPath,
        configurationText,
        entries: parseDefaultConfigurationText(configurationText),
        status: 'loaded',
      };
    }
  }

  return {
    checkedPaths,
    configurationPath: null,
    configurationText: null,
    entries: [],
    status: 'missing',
  };
}

export function parseDefaultConfigurationText(configurationText: string): readonly DefaultConfigurationEntry[] {
  const entries: DefaultConfigurationEntry[] = [];
  const lines = configurationText.replaceAll('\r\n', '\n').replaceAll('\r', '\n').split('\n');

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const trimmedLine = lines[lineIndex].trim();

    if (trimmedLine.length === 0 || trimmedLine.startsWith('#') || trimmedLine.startsWith(';')) {
      continue;
    }

    const separatorMatch = /\s/.exec(trimmedLine);

    if (separatorMatch === null) {
      entries.push({
        key: trimmedLine,
        lineNumber: lineIndex + 1,
        value: '',
      });
      continue;
    }

    const separatorIndex = separatorMatch.index;

    entries.push({
      key: trimmedLine.slice(0, separatorIndex),
      lineNumber: lineIndex + 1,
      value: trimmedLine.slice(separatorIndex).trim(),
    });
  }

  return entries;
}
