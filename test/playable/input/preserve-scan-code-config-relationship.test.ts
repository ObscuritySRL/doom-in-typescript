import { describe, expect, test } from 'bun:test';

import { createHash } from 'node:crypto';

import { EMPTY_TICCMD, TICCMD_SIZE } from '../../../src/input/ticcmd.ts';
import { KEY_UPARROW } from '../../../src/input/keyboard.ts';
import { PRESERVE_SCAN_CODE_CONFIG_RELATIONSHIP_CONTRACT, preserveScanCodeConfigRelationship } from '../../../src/playable/input/preserveScanCodeConfigRelationship.ts';

const PRESERVE_SCAN_CODE_CONFIG_RELATIONSHIP_CONTRACT_HASH = '8d8bdbc1812d70c3cb7dcac6f2ecfb3e33219c17196034f74c939eac03588336';
const BUN_RUNTIME_COMMAND = 'bun run doom.ts';
const UP_ARROW_SCAN_CODE = 0x48;
const W_SCAN_CODE = 0x11;

function createKeyboardLParam(scanCode: number, isExtended = false): number {
  return (scanCode << 16) | (isExtended ? 0x0100_0000 : 0);
}

describe('preserveScanCodeConfigRelationship', () => {
  test('exports the exact step contract', () => {
    expect(PRESERVE_SCAN_CODE_CONFIG_RELATIONSHIP_CONTRACT).toEqual({
      auditManifest: {
        path: 'plan_fps/manifests/01-010-audit-missing-live-input.json',
        stepId: '01-010',
        surface: 'key-translation-table',
      },
      configBindingAuthority: {
        bindingUnit: 'hardware-scan-code',
        eventScanCodeSource: 'extractScanCode(lparam)',
        extendedKeyBehavior: 'Ignore the Win32 extended flag when matching configured scan codes.',
        translationSource: 'translateScanCode(lparam)',
      },
      deterministicReplayAuthority: {
        neutralTicCommand: EMPTY_TICCMD,
        ticCommandSize: TICCMD_SIZE,
        ticMutation: 'none',
      },
      runtimeCommand: BUN_RUNTIME_COMMAND,
      stepId: '06-003',
      stepTitle: 'preserve-scan-code-config-relationship',
    });

    const contractHash = createHash('sha256').update(JSON.stringify(PRESERVE_SCAN_CODE_CONFIG_RELATIONSHIP_CONTRACT)).digest('hex');

    expect(contractHash).toBe(PRESERVE_SCAN_CODE_CONFIG_RELATIONSHIP_CONTRACT_HASH);
  });

  test('locks the 01-010 manifest linkage and runtime contract', async () => {
    const auditManifest = await Bun.file(PRESERVE_SCAN_CODE_CONFIG_RELATIONSHIP_CONTRACT.auditManifest.path).json();

    expect(auditManifest).toMatchObject({
      commandContracts: {
        target: {
          runtimeCommand: PRESERVE_SCAN_CODE_CONFIG_RELATIONSHIP_CONTRACT.runtimeCommand,
        },
      },
      stepId: '01-010',
    });
    expect(auditManifest.explicitNullSurfaces.some((surface: { readonly surface: string }) => surface.surface === PRESERVE_SCAN_CODE_CONFIG_RELATIONSHIP_CONTRACT.auditManifest.surface)).toBe(true);
  });

  test('matches configured scan codes through the live event scan code', () => {
    const relationship = preserveScanCodeConfigRelationship({
      configuredScanCode: W_SCAN_CODE,
      lparam: createKeyboardLParam(W_SCAN_CODE),
      runtimeCommand: BUN_RUNTIME_COMMAND,
    });

    expect(relationship).toEqual({
      configuredScanCode: W_SCAN_CODE,
      doomKey: 0x77,
      eventScanCode: W_SCAN_CODE,
      extendedKey: false,
      matchesConfiguredScanCode: true,
      neutralTicCommand: EMPTY_TICCMD,
    });
  });

  test('ignores the extended flag when comparing configured scan codes', () => {
    const baseRelationship = preserveScanCodeConfigRelationship({
      configuredScanCode: UP_ARROW_SCAN_CODE,
      lparam: createKeyboardLParam(UP_ARROW_SCAN_CODE),
      runtimeCommand: BUN_RUNTIME_COMMAND,
    });
    const extendedRelationship = preserveScanCodeConfigRelationship({
      configuredScanCode: UP_ARROW_SCAN_CODE,
      lparam: createKeyboardLParam(UP_ARROW_SCAN_CODE, true),
      runtimeCommand: BUN_RUNTIME_COMMAND,
    });

    expect(baseRelationship.matchesConfiguredScanCode).toBe(true);
    expect(extendedRelationship).toEqual({
      configuredScanCode: UP_ARROW_SCAN_CODE,
      doomKey: KEY_UPARROW,
      eventScanCode: UP_ARROW_SCAN_CODE,
      extendedKey: true,
      matchesConfiguredScanCode: true,
      neutralTicCommand: EMPTY_TICCMD,
    });
  });

  test('reports mismatched scan codes without mutating the neutral tic command', () => {
    const relationship = preserveScanCodeConfigRelationship({
      configuredScanCode: W_SCAN_CODE,
      lparam: createKeyboardLParam(UP_ARROW_SCAN_CODE),
      runtimeCommand: BUN_RUNTIME_COMMAND,
    });

    expect(relationship.matchesConfiguredScanCode).toBe(false);
    expect(relationship.neutralTicCommand).toBe(EMPTY_TICCMD);
    expect(relationship.doomKey).toBe(KEY_UPARROW);
  });

  test('rejects non-Bun runtime commands and invalid configured scan codes', () => {
    expect(() =>
      preserveScanCodeConfigRelationship({
        configuredScanCode: W_SCAN_CODE,
        lparam: createKeyboardLParam(W_SCAN_CODE),
        runtimeCommand: 'bun run src/main.ts',
      }),
    ).toThrow('preserveScanCodeConfigRelationship requires bun run doom.ts');

    expect(() =>
      preserveScanCodeConfigRelationship({
        configuredScanCode: 0x80,
        lparam: createKeyboardLParam(W_SCAN_CODE),
        runtimeCommand: BUN_RUNTIME_COMMAND,
      }),
    ).toThrow('Configured scan code must be an integer between 0 and 127.');
  });
});
