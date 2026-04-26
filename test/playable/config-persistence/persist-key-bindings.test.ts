import { expect, test } from 'bun:test';

import { DEFAULT_CFG_KEY_BINDING_NAMES, HOST_CFG_KEY_BINDING_NAMES, PERSIST_KEY_BINDINGS_COMMAND, PERSIST_KEY_BINDINGS_COMMAND_CONTRACT, persistKeyBindings } from '../../../src/playable/config-persistence/persistKeyBindings.ts';

async function hashSourceFile(path: string): Promise<string> {
  const hasher = new Bun.CryptoHasher('sha256');
  hasher.update(await Bun.file(path).arrayBuffer());
  return hasher.digest('hex');
}

test('persists key bindings through the Bun doom command contract', () => {
  const result = persistKeyBindings({
    keyBindingOverrides: {
      key_fire: 58,
      key_map_toggle: 31,
      key_menu_activate: 15,
    },
  });

  expect(PERSIST_KEY_BINDINGS_COMMAND_CONTRACT).toEqual({
    entryFile: 'doom.ts',
    program: 'bun',
    subcommand: 'run',
    targetCommand: PERSIST_KEY_BINDINGS_COMMAND,
  });
  expect(result.defaultConfiguration.key_fire).toBe(58);
  expect(result.hostConfiguration.key_map_toggle).toBe(31);
  expect(result.hostConfiguration.key_menu_activate).toBe(15);
  expect(result.keyBindings).toHaveLength(64);
  expect(result.replayEvidence.serializedKeyBindingState).toBe(
    [
      'default.cfg:key_down=80',
      'default.cfg:key_fire=58',
      'default.cfg:key_left=75',
      'default.cfg:key_right=77',
      'default.cfg:key_speed=54',
      'default.cfg:key_strafe=56',
      'default.cfg:key_strafeleft=51',
      'default.cfg:key_straferight=52',
      'default.cfg:key_up=72',
      'default.cfg:key_use=57',
      'chocolate-doom.cfg:key_demo_quit=16',
      'chocolate-doom.cfg:key_map_clearmark=46',
      'chocolate-doom.cfg:key_map_east=77',
      'chocolate-doom.cfg:key_map_follow=33',
      'chocolate-doom.cfg:key_map_grid=34',
      'chocolate-doom.cfg:key_map_mark=50',
      'chocolate-doom.cfg:key_map_maxzoom=11',
      'chocolate-doom.cfg:key_map_north=72',
      'chocolate-doom.cfg:key_map_south=80',
      'chocolate-doom.cfg:key_map_toggle=31',
      'chocolate-doom.cfg:key_map_west=75',
      'chocolate-doom.cfg:key_map_zoomin=13',
      'chocolate-doom.cfg:key_map_zoomout=12',
      'chocolate-doom.cfg:key_menu_abort=49',
      'chocolate-doom.cfg:key_menu_activate=15',
      'chocolate-doom.cfg:key_menu_back=14',
      'chocolate-doom.cfg:key_menu_confirm=21',
      'chocolate-doom.cfg:key_menu_decscreen=12',
      'chocolate-doom.cfg:key_menu_detail=63',
      'chocolate-doom.cfg:key_menu_down=80',
      'chocolate-doom.cfg:key_menu_endgame=65',
      'chocolate-doom.cfg:key_menu_forward=28',
      'chocolate-doom.cfg:key_menu_gamma=87',
      'chocolate-doom.cfg:key_menu_help=59',
      'chocolate-doom.cfg:key_menu_incscreen=13',
      'chocolate-doom.cfg:key_menu_left=75',
      'chocolate-doom.cfg:key_menu_load=61',
      'chocolate-doom.cfg:key_menu_messages=66',
      'chocolate-doom.cfg:key_menu_qload=67',
      'chocolate-doom.cfg:key_menu_qsave=64',
      'chocolate-doom.cfg:key_menu_quit=68',
      'chocolate-doom.cfg:key_menu_right=77',
      'chocolate-doom.cfg:key_menu_save=60',
      'chocolate-doom.cfg:key_menu_screenshot=0',
      'chocolate-doom.cfg:key_menu_up=72',
      'chocolate-doom.cfg:key_menu_volume=62',
      'chocolate-doom.cfg:key_message_refresh=28',
      'chocolate-doom.cfg:key_multi_msg=20',
      'chocolate-doom.cfg:key_multi_msgplayer1=34',
      'chocolate-doom.cfg:key_multi_msgplayer2=23',
      'chocolate-doom.cfg:key_multi_msgplayer3=48',
      'chocolate-doom.cfg:key_multi_msgplayer4=19',
      'chocolate-doom.cfg:key_nextweapon=0',
      'chocolate-doom.cfg:key_pause=69',
      'chocolate-doom.cfg:key_prevweapon=0',
      'chocolate-doom.cfg:key_spy=88',
      'chocolate-doom.cfg:key_weapon1=2',
      'chocolate-doom.cfg:key_weapon2=3',
      'chocolate-doom.cfg:key_weapon3=4',
      'chocolate-doom.cfg:key_weapon4=5',
      'chocolate-doom.cfg:key_weapon5=6',
      'chocolate-doom.cfg:key_weapon6=7',
      'chocolate-doom.cfg:key_weapon7=8',
      'chocolate-doom.cfg:key_weapon8=9',
    ].join('\n'),
  );
  expect(result.replayEvidence).toEqual({
    auditStepId: '01-014',
    auditSurface: 'keyBindingPersistence',
    checksum: 45_207_071,
    command: 'bun run doom.ts',
    defaultCfgBindingCount: 10,
    hostCfgBindingCount: 54,
    serializedKeyBindingState: result.replayEvidence.serializedKeyBindingState,
    transition: 'key-bindings-persisted',
  });
});

test('locks source hash and the audited missing persistence surface', async () => {
  const auditManifest = await Bun.file('plan_fps/manifests/01-014-audit-missing-config-persistence.json').json();

  expect(auditManifest.explicitNullSurfaces).toContainEqual({
    reason: 'No allowed file exposes persisted key binding settings.',
    surface: 'keyBindingPersistence',
    visiblePath: null,
  });
  expect(await hashSourceFile('src/playable/config-persistence/persistKeyBindings.ts')).toBe('82b63bdc50fa1d03169e50184f9976cdaa51c4786d55855f2e3b12387a1bca3f');
});

test('preserves canonical key binding order across config namespaces', () => {
  const result = persistKeyBindings();

  expect(DEFAULT_CFG_KEY_BINDING_NAMES).toEqual(['key_down', 'key_fire', 'key_left', 'key_right', 'key_speed', 'key_strafe', 'key_strafeleft', 'key_straferight', 'key_up', 'key_use']);
  expect(HOST_CFG_KEY_BINDING_NAMES.at(0)).toBe('key_demo_quit');
  expect(HOST_CFG_KEY_BINDING_NAMES.at(-1)).toBe('key_weapon8');
  expect(result.keyBindings.at(0)).toEqual({
    name: 'key_down',
    namespace: 'default.cfg',
    value: 80,
  });
  expect(result.keyBindings.at(-1)).toEqual({
    name: 'key_weapon8',
    namespace: 'chocolate-doom.cfg',
    value: 9,
  });
});

test('rejects launch commands outside the product runtime path before mutating bindings', () => {
  expect(() =>
    persistKeyBindings({
      keyBindingOverrides: {
        key_fire: 58,
      },
      runtimeCommand: 'bun run src/main.ts',
    }),
  ).toThrow('persist key bindings requires bun run doom.ts');
});

test('rejects invalid DOS scan codes', () => {
  expect(() =>
    persistKeyBindings({
      keyBindingOverrides: {
        key_fire: -1,
      },
    }),
  ).toThrow('invalid DOS scan code for key_fire');

  expect(() =>
    persistKeyBindings({
      keyBindingOverrides: {
        key_map_toggle: 256,
      },
    }),
  ).toThrow('invalid DOS scan code for key_map_toggle');
});
