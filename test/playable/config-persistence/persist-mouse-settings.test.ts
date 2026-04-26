import { describe, expect, test } from 'bun:test';

import { createDefaultVanillaCfg } from '../../../src/config/defaultCfg.ts';
import { createDefaultHostExtraCfg } from '../../../src/config/hostConfig.ts';
import { CONFIG_PERSISTENCE_AUDIT_MANIFEST_PATH, MOUSE_SETTINGS_AUDIT_SURFACE, PLAYABLE_CONFIG_COMMAND, persistMouseSettings } from '../../../src/playable/config-persistence/persistMouseSettings.ts';

function hashString(value: string): string {
  const hasher = new Bun.CryptoHasher('sha256');
  hasher.update(value);
  return hasher.digest('hex');
}

describe('persistMouseSettings', () => {
  test('locks the command contract and missing-persistence audit linkage', async () => {
    expect(PLAYABLE_CONFIG_COMMAND).toBe('bun run doom.ts');
    expect(CONFIG_PERSISTENCE_AUDIT_MANIFEST_PATH).toBe('plan_fps/manifests/01-014-audit-missing-config-persistence.json');
    expect(MOUSE_SETTINGS_AUDIT_SURFACE).toBe('mouseSettingsPersistence');

    const auditManifestText = await Bun.file(CONFIG_PERSISTENCE_AUDIT_MANIFEST_PATH).text();
    expect(auditManifestText).toContain('"surface": "mouseSettingsPersistence"');
    expect(auditManifestText).toContain('"visibleConfigPersistenceSurface": null');
  });

  test('persists default mouse settings with deterministic replay evidence', () => {
    const result = persistMouseSettings();

    expect(result.command).toBe(PLAYABLE_CONFIG_COMMAND);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.hostConfig)).toBe(true);
    expect(Object.isFrozen(result.replayEvidence)).toBe(true);
    expect(Object.isFrozen(result.vanillaConfig)).toBe(true);
    expect(result.replayEvidence.transition).toBe('mouse-settings-persisted');
    expect(result.replayEvidence.fieldNames).toEqual([
      'mouse_sensitivity',
      'use_mouse',
      'mouseb_fire',
      'mouseb_strafe',
      'mouseb_forward',
      'grabmouse',
      'novert',
      'mouse_acceleration',
      'mouse_threshold',
      'mouseb_strafeleft',
      'mouseb_straferight',
      'mouseb_use',
      'mouseb_backward',
      'mouseb_prevweapon',
      'mouseb_nextweapon',
      'dclick_use',
    ]);
    expect(result.replayEvidence.serializedState).toBe(
      [
        'mouse_sensitivity=5',
        'use_mouse=1',
        'mouseb_fire=0',
        'mouseb_strafe=1',
        'mouseb_forward=2',
        'grabmouse=1',
        'novert=0',
        'mouse_acceleration=2.000000',
        'mouse_threshold=10',
        'mouseb_strafeleft=-1',
        'mouseb_straferight=-1',
        'mouseb_use=-1',
        'mouseb_backward=-1',
        'mouseb_prevweapon=-1',
        'mouseb_nextweapon=-1',
        'dclick_use=1',
      ].join('\n'),
    );
    expect(result.replayEvidence.stateHash).toBe('118b3e54685ddaa85d2c4a8300565f4653d22fa013bf10e49c8fbe979bd254b2');
    expect(result.replayEvidence.replayChecksum).toBe(1_140_755_854);
  });

  test('persists custom mouse settings across both config namespaces', async () => {
    const sourceText = await Bun.file('src/playable/config-persistence/persistMouseSettings.ts').text();
    const result = persistMouseSettings({
      mouseSettings: {
        dclickUse: 0,
        grabMouse: 0,
        mouseAcceleration: 1.5,
        mouseBackwardButton: 7,
        mouseFireButton: 3,
        mouseForwardButton: 4,
        mouseNextWeaponButton: 6,
        mousePreviousWeaponButton: 5,
        mouseSensitivity: 8,
        mouseStrafeButton: 2,
        mouseStrafeLeftButton: 8,
        mouseStrafeRightButton: 9,
        mouseThreshold: 12,
        mouseUseButton: 1,
        noVerticalMouseMovement: 1,
        useMouse: 1,
      },
    });

    expect(hashString(sourceText)).toBe('e659532c56a9d3d7de58ee31435a8d66348a623c0398834397df9ff4d558f83d');
    expect(result.vanillaConfig.mouse_sensitivity).toBe(8);
    expect(result.vanillaConfig.mouseb_fire).toBe(3);
    expect(result.vanillaConfig.mouseb_forward).toBe(4);
    expect(result.vanillaConfig.mouseb_strafe).toBe(2);
    expect(result.vanillaConfig.use_mouse).toBe(1);
    expect(result.hostConfig.dclick_use).toBe(0);
    expect(result.hostConfig.grabmouse).toBe(0);
    expect(result.hostConfig.mouse_acceleration).toBe(1.5);
    expect(result.hostConfig.mouse_threshold).toBe(12);
    expect(result.hostConfig.mouseb_backward).toBe(7);
    expect(result.hostConfig.mouseb_nextweapon).toBe(6);
    expect(result.hostConfig.mouseb_prevweapon).toBe(5);
    expect(result.hostConfig.mouseb_strafeleft).toBe(8);
    expect(result.hostConfig.mouseb_straferight).toBe(9);
    expect(result.hostConfig.mouseb_use).toBe(1);
    expect(result.hostConfig.novert).toBe(1);
    expect(result.replayEvidence.serializedState).toBe(
      [
        'mouse_sensitivity=8',
        'use_mouse=1',
        'mouseb_fire=3',
        'mouseb_strafe=2',
        'mouseb_forward=4',
        'grabmouse=0',
        'novert=1',
        'mouse_acceleration=1.500000',
        'mouse_threshold=12',
        'mouseb_strafeleft=8',
        'mouseb_straferight=9',
        'mouseb_use=1',
        'mouseb_backward=7',
        'mouseb_prevweapon=5',
        'mouseb_nextweapon=6',
        'dclick_use=0',
      ].join('\n'),
    );
    expect(result.replayEvidence.stateHash).toBe('752145076e2e74ce0dcd6fdbdf8ab9b65f07dd77fd1adf10b109bd91708e4ee1');
    expect(result.replayEvidence.replayChecksum).toBe(1_858_208_252);
  });

  test('prevalidates the playable command before applying mouse settings', () => {
    expect(() =>
      persistMouseSettings({
        command: 'bun run src/main.ts',
        mouseSettings: { mouseSensitivity: 8 },
      }),
    ).toThrow('persist mouse settings requires bun run doom.ts');
  });

  test('rejects invalid mouse settings before returning replay evidence', () => {
    expect(() => persistMouseSettings({ mouseSettings: { mouseSensitivity: 10 } })).toThrow('mouse_sensitivity must be an integer from 0 through 9');
    expect(() => persistMouseSettings({ mouseSettings: { mouseAcceleration: -0.25 } })).toThrow('mouse_acceleration must be a finite non-negative number');
    expect(() => persistMouseSettings({ mouseSettings: { mouseBackwardButton: -2 } })).toThrow('mouseb_backward must be an integer from -1 through 15');
  });

  test('preserves non-mouse config values from supplied config snapshots', () => {
    const vanillaConfig = createDefaultVanillaCfg();
    const hostConfig = createDefaultHostExtraCfg();
    const result = persistMouseSettings({
      hostConfig,
      mouseSettings: { mouseSensitivity: 6, noVerticalMouseMovement: 1 },
      vanillaConfig,
    });

    expect(result.vanillaConfig.sfx_volume).toBe(vanillaConfig.sfx_volume);
    expect(result.vanillaConfig.music_volume).toBe(vanillaConfig.music_volume);
    expect(result.hostConfig.fullscreen).toBe(hostConfig.fullscreen);
    expect(result.hostConfig.vanilla_keyboard_mapping).toBe(hostConfig.vanilla_keyboard_mapping);
    expect(result.vanillaConfig.mouse_sensitivity).toBe(6);
    expect(result.hostConfig.novert).toBe(1);
  });
});
