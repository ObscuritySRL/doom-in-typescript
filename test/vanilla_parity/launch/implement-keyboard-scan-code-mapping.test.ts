import { describe, expect, test } from 'bun:test';

import { VANILLA_BYPASSES_OS_LAYOUT_TRANSLATION, VANILLA_EXTENDED_KEY_FLAG_MASK, VANILLA_KEY_SCAN_CODES, VANILLA_SCAN_CODE_MAX, VANILLA_SCAN_CODE_MIN, evaluateScanCode } from '../../../src/bootstrap/implement-keyboard-scan-code-mapping.ts';

describe('vanilla keyboard scan-code mapping contract', () => {
  test('canonical scan codes match default.cfg defaults', () => {
    expect(VANILLA_KEY_SCAN_CODES.KEY_ESCAPE).toBe(1);
    expect(VANILLA_KEY_SCAN_CODES.KEY_ENTER).toBe(28);
    expect(VANILLA_KEY_SCAN_CODES.KEY_FIRE).toBe(29);
    expect(VANILLA_KEY_SCAN_CODES.KEY_STRAFE_LEFT).toBe(51);
    expect(VANILLA_KEY_SCAN_CODES.KEY_STRAFE_RIGHT).toBe(52);
    expect(VANILLA_KEY_SCAN_CODES.KEY_SPEED).toBe(54);
    expect(VANILLA_KEY_SCAN_CODES.KEY_STRAFE).toBe(56);
    expect(VANILLA_KEY_SCAN_CODES.KEY_USE).toBe(57);
    expect(VANILLA_KEY_SCAN_CODES.KEY_LEFT).toBe(75);
    expect(VANILLA_KEY_SCAN_CODES.KEY_RIGHT).toBe(77);
    expect(VANILLA_KEY_SCAN_CODES.KEY_UP).toBe(72);
    expect(VANILLA_KEY_SCAN_CODES.KEY_DOWN).toBe(80);
    expect(VANILLA_KEY_SCAN_CODES.KEY_PAUSE).toBe(69);
  });

  test('vanilla_keyboard_mapping = 1 bypasses OS layout translation', () => {
    expect(VANILLA_BYPASSES_OS_LAYOUT_TRANSLATION).toBe(true);
  });

  test('extended-key flag is 0x80', () => {
    expect(VANILLA_EXTENDED_KEY_FLAG_MASK).toBe(0x80);
  });

  test('scan-code range is [1, 127]', () => {
    expect(VANILLA_SCAN_CODE_MIN).toBe(1);
    expect(VANILLA_SCAN_CODE_MAX).toBe(127);
  });
});

describe('evaluateScanCode', () => {
  test('valid scan codes from default.cfg pass the range guard', () => {
    for (const scanCode of Object.values(VANILLA_KEY_SCAN_CODES)) {
      const decision = evaluateScanCode(scanCode);
      expect(decision.inRange).toBe(true);
      expect(decision.violation).toBeNull();
    }
  });

  test('reserved zero is rejected with the reserved_zero violation', () => {
    const decision = evaluateScanCode(0);
    expect(decision.inRange).toBe(false);
    expect(decision.violation).toBe('reserved_zero');
  });

  test('negative scan codes are rejected with below_min', () => {
    const decision = evaluateScanCode(-1);
    expect(decision.inRange).toBe(false);
    expect(decision.violation).toBe('below_min');
  });

  test('scan codes > 127 are rejected with above_max', () => {
    const decision = evaluateScanCode(128);
    expect(decision.inRange).toBe(false);
    expect(decision.violation).toBe('above_max');
  });
});
