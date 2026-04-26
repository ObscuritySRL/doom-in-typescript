import { describe, expect, test } from 'bun:test';

import {
  ISOLATE_TESTS_FROM_USER_LOCAL_CONFIG_AUDIT,
  ISOLATE_TESTS_FROM_USER_LOCAL_CONFIG_COMMAND_CONTRACT,
  ISOLATED_TEST_CONFIG_DIRECTORY_NAME,
  isolateTestsFromUserLocalConfig,
} from '../../../src/playable/config-persistence/isolateTestsFromUserLocalConfig.ts';

const EXPECTED_COMMAND_CONTRACT = Object.freeze({
  entryFile: 'doom.ts',
  program: 'bun',
  subcommand: 'run',
  targetCommand: 'bun run doom.ts',
});
const EXPECTED_IGNORED_USER_LOCAL_CONFIG_TOKENS = Object.freeze([
  '%APPDATA%/Chocolate Doom/chocolate-doom.cfg',
  '%APPDATA%/Chocolate Doom/default.cfg',
  '%LOCALAPPDATA%/Chocolate Doom/chocolate-doom.cfg',
  '%LOCALAPPDATA%/Chocolate Doom/default.cfg',
  '~/Library/Application Support/chocolate-doom/chocolate-doom.cfg',
  '~/Library/Application Support/chocolate-doom/default.cfg',
  '~/.chocolate-doom/chocolate-doom.cfg',
  '~/.chocolate-doom/default.cfg',
]);
const EXPECTED_TRANSITION = Object.freeze([
  'validate bun run doom.ts command contract',
  'derive workspace-local isolated test config directory',
  'generate chocolate-doom.cfg from typed host defaults',
  'generate default.cfg from typed vanilla defaults',
  'ignore user-local config discovery tokens',
]);
const WORKSPACE_ROOT = 'D:/Projects/doom-in-typescript';

describe('isolateTestsFromUserLocalConfig', () => {
  test('locks the Bun command contract, audit linkage, and formatted source hash', async () => {
    expect(ISOLATE_TESTS_FROM_USER_LOCAL_CONFIG_COMMAND_CONTRACT).toEqual(EXPECTED_COMMAND_CONTRACT);
    expect(ISOLATE_TESTS_FROM_USER_LOCAL_CONFIG_AUDIT).toEqual({
      explicitNullSurface: 'localConfigTestIsolation',
      manifestPath: 'plan_fps/manifests/01-014-audit-missing-config-persistence.json',
      schemaVersion: 1,
      stepId: '01-014',
    });
    expect(ISOLATED_TEST_CONFIG_DIRECTORY_NAME).toBe('.doom-test-config');
    expect(await sha256File('src/playable/config-persistence/isolateTestsFromUserLocalConfig.ts')).toBe('5f1e472c2179ade2a04f121c54ea9ef6c3dc7f7245f6e4b2233bf923ca2f768a');
  });

  test('returns deterministic workspace-local config isolation evidence', () => {
    expect(isolateTestsFromUserLocalConfig({ workspaceRoot: WORKSPACE_ROOT })).toEqual({
      auditManifestSchemaVersion: 1,
      commandContract: EXPECTED_COMMAND_CONTRACT,
      configFiles: [
        {
          byteLength: 2186,
          fileName: 'chocolate-doom.cfg',
          path: 'D:/Projects/doom-in-typescript/.doom-test-config/ralph-loop-12-009/chocolate-doom.cfg',
          sha256: 'ed8e9952182ee8999fe277cc0ff2f8034b47ea2e81c83bc53ad129f443ab2f62',
          source: 'generated-default',
          variableCount: 113,
        },
        {
          byteLength: 726,
          fileName: 'default.cfg',
          path: 'D:/Projects/doom-in-typescript/.doom-test-config/ralph-loop-12-009/default.cfg',
          sha256: '58332e2f56ed52a7b95e5dbae6275d678f0425513db8c7ad288b3cec5a35b0a7',
          source: 'generated-default',
          variableCount: 43,
        },
      ],
      ignoredUserLocalConfigTokens: EXPECTED_IGNORED_USER_LOCAL_CONFIG_TOKENS,
      isolationDirectory: 'D:/Projects/doom-in-typescript/.doom-test-config/ralph-loop-12-009',
      replayChecksum: 2967409563,
      replayHash: '08894d0ed5a5bc2665cc5d602b5eebd20d99a6e30448b5faafe4a60cada4d37e',
      transition: EXPECTED_TRANSITION,
    });
  });

  test('keeps custom isolation keys deterministic without changing config bytes', () => {
    expect(
      isolateTestsFromUserLocalConfig({
        isolationKey: 'audit-12-009',
        workspaceRoot: WORKSPACE_ROOT,
      }),
    ).toEqual({
      auditManifestSchemaVersion: 1,
      commandContract: EXPECTED_COMMAND_CONTRACT,
      configFiles: [
        {
          byteLength: 2186,
          fileName: 'chocolate-doom.cfg',
          path: 'D:/Projects/doom-in-typescript/.doom-test-config/audit-12-009/chocolate-doom.cfg',
          sha256: 'ed8e9952182ee8999fe277cc0ff2f8034b47ea2e81c83bc53ad129f443ab2f62',
          source: 'generated-default',
          variableCount: 113,
        },
        {
          byteLength: 726,
          fileName: 'default.cfg',
          path: 'D:/Projects/doom-in-typescript/.doom-test-config/audit-12-009/default.cfg',
          sha256: '58332e2f56ed52a7b95e5dbae6275d678f0425513db8c7ad288b3cec5a35b0a7',
          source: 'generated-default',
          variableCount: 43,
        },
      ],
      ignoredUserLocalConfigTokens: EXPECTED_IGNORED_USER_LOCAL_CONFIG_TOKENS,
      isolationDirectory: 'D:/Projects/doom-in-typescript/.doom-test-config/audit-12-009',
      replayChecksum: 1628148028,
      replayHash: '7e88cda2bd7fd8cd2af26b7b870a1be503ac2f9886c89ef4e2a7e1d530248cee',
      transition: EXPECTED_TRANSITION,
    });
  });

  test('validates the product runtime command before deriving config paths', () => {
    expect(() =>
      isolateTestsFromUserLocalConfig({
        command: 'bun run src/main.ts',
        workspaceRoot: WORKSPACE_ROOT,
      }),
    ).toThrow('expected Bun product command `bun run doom.ts`, got `bun run src/main.ts`');
  });

  test('rejects escaping or read-only config roots', () => {
    expect(() =>
      isolateTestsFromUserLocalConfig({
        isolationKey: '../default',
        workspaceRoot: WORKSPACE_ROOT,
      }),
    ).toThrow('isolation key must contain only letters, numbers, and hyphens');
    expect(() => isolateTestsFromUserLocalConfig({ workspaceRoot: `${WORKSPACE_ROOT}/doom` })).toThrow('workspace root must not be read-only reference root doom/');
  });
});

async function sha256File(path: string): Promise<string> {
  const text = await Bun.file(path).text();
  return new Bun.CryptoHasher('sha256').update(text).digest('hex');
}
