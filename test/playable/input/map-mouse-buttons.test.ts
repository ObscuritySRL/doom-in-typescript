import { describe, expect, it } from 'bun:test';

import { BT_ATTACK, EMPTY_TICCMD, FORWARD_MOVE, TICCMD_SIZE, packTicCommand } from '../../../src/input/ticcmd.ts';
import { MAP_MOUSE_BUTTONS_CONTRACT, mapMouseButtons } from '../../../src/playable/input/mapMouseButtons.ts';

interface AuditMissingLiveInputManifest {
  readonly commandContracts: {
    readonly target: {
      readonly runtimeCommand: string;
    };
  };
  readonly documentedInputControls: ReadonlyArray<{
    readonly control: string;
  }>;
  readonly explicitNullSurfaces: ReadonlyArray<{
    readonly surface: string;
  }>;
  readonly stepId: string;
}

const AUDIT_MANIFEST_PATH = new URL('../../../plan_fps/manifests/01-010-audit-missing-live-input.json', import.meta.url);
const EXPECTED_CONTRACT_HASH = '508ba352f0883d069d882f50bac8d31def629c17affa01eb29086914fb34ebfe';
const RUNTIME_COMMAND = 'bun run doom.ts';

function isAuditMissingLiveInputManifest(value: unknown): value is AuditMissingLiveInputManifest {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as AuditMissingLiveInputManifest;

  return candidate.stepId === '01-010' && Array.isArray(candidate.documentedInputControls) && Array.isArray(candidate.explicitNullSurfaces) && typeof candidate.commandContracts?.target?.runtimeCommand === 'string';
}

describe('mapMouseButtons', () => {
  it('locks the exact contract and hash', () => {
    expect(MAP_MOUSE_BUTTONS_CONTRACT).toEqual({
      auditManifestStepId: '01-010',
      deterministicReplayCompatible: true,
      eventTypes: ['down', 'up'],
      runtimeCommand: RUNTIME_COMMAND,
      supportedButtons: [
        {
          buttonName: 'left',
          buttonSlot: 0,
          semanticAction: 'attack',
          ticCommandDelta: packTicCommand(0, 0, 0, BT_ATTACK, 0, 0),
        },
        {
          buttonName: 'right',
          buttonSlot: 1,
          semanticAction: 'strafe-modifier',
          ticCommandDelta: EMPTY_TICCMD,
        },
        {
          buttonName: 'middle',
          buttonSlot: 2,
          semanticAction: 'move-forward',
          ticCommandDelta: packTicCommand(FORWARD_MOVE[0], 0, 0, 0, 0, 0),
        },
      ],
      ticCommandSize: TICCMD_SIZE,
    });

    const contractHash = new Bun.CryptoHasher('sha256').update(JSON.stringify(MAP_MOUSE_BUTTONS_CONTRACT)).digest('hex');

    expect(contractHash).toBe(EXPECTED_CONTRACT_HASH);
  });

  it('stays aligned with the 01-010 live-input audit gap', async () => {
    const parsedAuditManifest: unknown = JSON.parse(await Bun.file(AUDIT_MANIFEST_PATH).text());

    if (!isAuditMissingLiveInputManifest(parsedAuditManifest)) {
      throw new Error('Expected the 01-010 audit manifest schema.');
    }

    const auditManifest = parsedAuditManifest;
    const nullSurfaces = auditManifest.explicitNullSurfaces.map(({ surface }) => surface);
    const documentedControls = auditManifest.documentedInputControls.map(({ control }) => control);

    expect(auditManifest.stepId).toBe(MAP_MOUSE_BUTTONS_CONTRACT.auditManifestStepId);
    expect(auditManifest.commandContracts.target.runtimeCommand).toBe(MAP_MOUSE_BUTTONS_CONTRACT.runtimeCommand);
    expect(nullSurfaces).toContain('input-event-source');
    expect(nullSurfaces).toContain('mouse-capture-policy');
    expect(nullSurfaces).toContain('per-tic-input-accumulation');
    expect(documentedControls.some((control) => control.toLowerCase().includes('mouse'))).toBeFalse();
  });

  it('maps the left button press to attack without mutating tic timing', () => {
    expect(
      mapMouseButtons({
        buttonName: 'left',
        eventType: 'down',
        runtimeCommand: RUNTIME_COMMAND,
      }),
    ).toEqual({
      buttonName: 'left',
      buttonSlot: 0,
      eventType: 'down',
      semanticAction: 'attack',
      ticCommandDelta: packTicCommand(0, 0, 0, BT_ATTACK, 0, 0),
      ticCommandSize: TICCMD_SIZE,
    });
  });

  it('maps the right button press to a neutral strafe modifier surface', () => {
    expect(
      mapMouseButtons({
        buttonName: 'right',
        eventType: 'down',
        runtimeCommand: RUNTIME_COMMAND,
      }),
    ).toEqual({
      buttonName: 'right',
      buttonSlot: 1,
      eventType: 'down',
      semanticAction: 'strafe-modifier',
      ticCommandDelta: EMPTY_TICCMD,
      ticCommandSize: TICCMD_SIZE,
    });
  });

  it('maps the middle button press to forward movement', () => {
    expect(
      mapMouseButtons({
        buttonName: 'middle',
        eventType: 'down',
        runtimeCommand: RUNTIME_COMMAND,
      }),
    ).toEqual({
      buttonName: 'middle',
      buttonSlot: 2,
      eventType: 'down',
      semanticAction: 'move-forward',
      ticCommandDelta: packTicCommand(FORWARD_MOVE[0], 0, 0, 0, 0, 0),
      ticCommandSize: TICCMD_SIZE,
    });
  });

  it('keeps button release events replay-safe by returning the neutral ticcmd delta', () => {
    expect(
      mapMouseButtons({
        buttonName: 'left',
        eventType: 'up',
        runtimeCommand: RUNTIME_COMMAND,
      }),
    ).toEqual({
      buttonName: 'left',
      buttonSlot: 0,
      eventType: 'up',
      semanticAction: 'attack',
      ticCommandDelta: EMPTY_TICCMD,
      ticCommandSize: TICCMD_SIZE,
    });
  });

  it('returns null for unsupported buttons', () => {
    expect(
      mapMouseButtons({
        buttonName: 'x1',
        eventType: 'down',
        runtimeCommand: RUNTIME_COMMAND,
      }),
    ).toBeNull();
  });

  it('rejects non-Bun runtime commands', () => {
    expect(() =>
      mapMouseButtons({
        buttonName: 'left',
        eventType: 'down',
        runtimeCommand: 'bun run src/main.ts',
      }),
    ).toThrow('mapMouseButtons requires `bun run doom.ts`.');
  });

  it('rejects unsupported mouse button event types', () => {
    expect(() =>
      mapMouseButtons({
        buttonName: 'left',
        eventType: 'held',
        runtimeCommand: RUNTIME_COMMAND,
      }),
    ).toThrow('Unsupported mouse button event type: held');
  });

  it('keeps middle button release events replay-safe by returning the neutral ticcmd delta', () => {
    expect(
      mapMouseButtons({
        buttonName: 'middle',
        eventType: 'up',
        runtimeCommand: RUNTIME_COMMAND,
      }),
    ).toEqual({
      buttonName: 'middle',
      buttonSlot: 2,
      eventType: 'up',
      semanticAction: 'move-forward',
      ticCommandDelta: EMPTY_TICCMD,
      ticCommandSize: TICCMD_SIZE,
    });
  });

  it('keeps right button release events replay-safe by returning the neutral ticcmd delta', () => {
    expect(
      mapMouseButtons({
        buttonName: 'right',
        eventType: 'up',
        runtimeCommand: RUNTIME_COMMAND,
      }),
    ).toEqual({
      buttonName: 'right',
      buttonSlot: 1,
      eventType: 'up',
      semanticAction: 'strafe-modifier',
      ticCommandDelta: EMPTY_TICCMD,
      ticCommandSize: TICCMD_SIZE,
    });
  });

  it('treats button name lookup as case-sensitive and returns null for casefold variants', () => {
    expect(
      mapMouseButtons({
        buttonName: 'Left',
        eventType: 'down',
        runtimeCommand: RUNTIME_COMMAND,
      }),
    ).toBeNull();
    expect(
      mapMouseButtons({
        buttonName: 'LEFT',
        eventType: 'down',
        runtimeCommand: RUNTIME_COMMAND,
      }),
    ).toBeNull();
    expect(
      mapMouseButtons({
        buttonName: 'Right',
        eventType: 'down',
        runtimeCommand: RUNTIME_COMMAND,
      }),
    ).toBeNull();
    expect(
      mapMouseButtons({
        buttonName: 'Middle',
        eventType: 'down',
        runtimeCommand: RUNTIME_COMMAND,
      }),
    ).toBeNull();
  });

  it('returns null for whitespace-padded or empty button names rather than coercing them', () => {
    expect(
      mapMouseButtons({
        buttonName: ' left',
        eventType: 'down',
        runtimeCommand: RUNTIME_COMMAND,
      }),
    ).toBeNull();
    expect(
      mapMouseButtons({
        buttonName: 'left ',
        eventType: 'down',
        runtimeCommand: RUNTIME_COMMAND,
      }),
    ).toBeNull();
    expect(
      mapMouseButtons({
        buttonName: '',
        eventType: 'down',
        runtimeCommand: RUNTIME_COMMAND,
      }),
    ).toBeNull();
  });

  it('rejects an empty-string runtime command at the boundary', () => {
    expect(() =>
      mapMouseButtons({
        buttonName: 'left',
        eventType: 'down',
        runtimeCommand: '',
      }),
    ).toThrow('mapMouseButtons requires `bun run doom.ts`.');
  });

  it('rejects an empty-string event type at the boundary', () => {
    expect(() =>
      mapMouseButtons({
        buttonName: 'left',
        eventType: '',
        runtimeCommand: RUNTIME_COMMAND,
      }),
    ).toThrow('Unsupported mouse button event type: ');
  });

  it('locks the runtime-frozen invariant on every layer of the contract', () => {
    expect(Object.isFrozen(MAP_MOUSE_BUTTONS_CONTRACT)).toBeTrue();
    expect(Object.isFrozen(MAP_MOUSE_BUTTONS_CONTRACT.eventTypes)).toBeTrue();
    expect(Object.isFrozen(MAP_MOUSE_BUTTONS_CONTRACT.supportedButtons)).toBeTrue();
    for (const supportedButton of MAP_MOUSE_BUTTONS_CONTRACT.supportedButtons) {
      expect(Object.isFrozen(supportedButton)).toBeTrue();
      expect(Object.isFrozen(supportedButton.ticCommandDelta)).toBeTrue();
    }
  });

  it('returns frozen mappings whose ticcmd delta is itself frozen', () => {
    const mapping = mapMouseButtons({
      buttonName: 'left',
      eventType: 'down',
      runtimeCommand: RUNTIME_COMMAND,
    });
    expect(Object.isFrozen(mapping)).toBeTrue();
    expect(Object.isFrozen(mapping.ticCommandDelta)).toBeTrue();

    const releaseMapping = mapMouseButtons({
      buttonName: 'middle',
      eventType: 'up',
      runtimeCommand: RUNTIME_COMMAND,
    });
    expect(Object.isFrozen(releaseMapping)).toBeTrue();
    expect(Object.isFrozen(releaseMapping.ticCommandDelta)).toBeTrue();
  });

  it('locks every supported button slot to the vanilla mousebfire/mousebstrafe/mousebforward indices', () => {
    const slotByName = new Map<string, number>();
    for (const supportedButton of MAP_MOUSE_BUTTONS_CONTRACT.supportedButtons) {
      slotByName.set(supportedButton.buttonName, supportedButton.buttonSlot);
    }
    expect(slotByName.get('left')).toBe(0);
    expect(slotByName.get('right')).toBe(1);
    expect(slotByName.get('middle')).toBe(2);
    expect(slotByName.size).toBe(3);
  });
});
