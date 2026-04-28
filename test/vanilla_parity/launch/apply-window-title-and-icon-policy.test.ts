import { describe, expect, test } from 'bun:test';

import {
  CHOCOLATE_ICON_DATA_BITS_PER_PIXEL,
  CHOCOLATE_INIT_ORDERING_TITLE_BEFORE_ICON,
  CHOCOLATE_TITLE_FORMAT_TEMPLATE,
  CHOCOLATE_TITLE_JOIN_FUNCTION_SYMBOL,
  REFERENCE_VANILLA_WINDOW_TITLE_AND_ICON_POLICY_HANDLER,
  VANILLA_DOS_PORT_HAS_WINDOW_CONCEPT,
  VANILLA_WINDOW_ATTRIBUTE_CHANNEL_COUNT,
  VANILLA_WINDOW_ATTRIBUTE_CHANNEL_LANDSCAPE,
  VANILLA_WINDOW_ICON_API_CALL_COUNT,
  VANILLA_WINDOW_TITLE_AND_ICON_POLICY_ABSENT_CHOCOLATE_API_CALLS,
  VANILLA_WINDOW_TITLE_AND_ICON_POLICY_ABSENT_CHOCOLATE_API_CALL_COUNT,
  VANILLA_WINDOW_TITLE_AND_ICON_POLICY_CONTRACT_AUDIT,
  VANILLA_WINDOW_TITLE_AND_ICON_POLICY_CONTRACT_CLAUSE_COUNT,
  VANILLA_WINDOW_TITLE_AND_ICON_POLICY_DERIVED_INVARIANTS,
  VANILLA_WINDOW_TITLE_AND_ICON_POLICY_DERIVED_INVARIANT_COUNT,
  VANILLA_WINDOW_TITLE_AND_ICON_POLICY_PROBES,
  VANILLA_WINDOW_TITLE_AND_ICON_POLICY_PROBE_COUNT,
  VANILLA_WINDOW_TITLE_API_CALL_COUNT,
  VANILLA_WINDOW_WM_CLASS_API_CALL_COUNT,
  VANILLA_X11_PORT_USES_BARE_XCREATEWINDOW,
  VANILLA_X11_XCREATEWINDOW_ATTRIBMASK_TOKENS,
  VANILLA_X11_XCREATEWINDOW_ATTRIBMASK_TOKEN_COUNT,
  crossCheckVanillaWindowTitleAndIconPolicy,
  deriveExpectedVanillaWindowTitleAndIconPolicyResult,
} from '../../../src/bootstrap/apply-window-title-and-icon-policy.ts';
import type { VanillaWindowTitleAndIconPolicyHandler, VanillaWindowTitleAndIconPolicyProbe, VanillaWindowTitleAndIconPolicyResult } from '../../../src/bootstrap/apply-window-title-and-icon-policy.ts';

const STEP_FILE_RELATIVE_PATH = 'plan_vanilla_parity/steps/03-013-apply-window-title-and-icon-policy.md';

describe('VANILLA_WINDOW_TITLE_AND_ICON_POLICY_CONTRACT_AUDIT ledger shape', () => {
  test('audits exactly twenty-two contract clauses for the vanilla 1.9 title-and-icon policy', () => {
    expect(VANILLA_WINDOW_TITLE_AND_ICON_POLICY_CONTRACT_AUDIT.length).toBe(22);
    expect(VANILLA_WINDOW_TITLE_AND_ICON_POLICY_CONTRACT_AUDIT.length).toBe(VANILLA_WINDOW_TITLE_AND_ICON_POLICY_CONTRACT_CLAUSE_COUNT);
  });

  test('every clause id is unique', () => {
    const ids = VANILLA_WINDOW_TITLE_AND_ICON_POLICY_CONTRACT_AUDIT.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('every clause references a real linuxdoom-1.10 source file and a canonical C symbol', () => {
    for (const entry of VANILLA_WINDOW_TITLE_AND_ICON_POLICY_CONTRACT_AUDIT) {
      expect(['i_video.c', 'd_main.c']).toContain(entry.referenceSourceFile);
      expect(['I_InitGraphics', 'I_ShutdownGraphics', 'D_DoomMain', 'D_DoomLoop']).toContain(entry.cSymbol);
      expect(entry.invariant.length).toBeGreaterThan(0);
    }
  });

  test('the VANILLA_X11_PORT_HAS_NO_XSTORENAME_CALL clause cites XStoreName and the bare flow', () => {
    const entry = VANILLA_WINDOW_TITLE_AND_ICON_POLICY_CONTRACT_AUDIT.find((clause) => clause.id === 'VANILLA_X11_PORT_HAS_NO_XSTORENAME_CALL');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('XStoreName');
    expect(entry!.invariant).toContain('XCreateWindow');
    expect(entry!.invariant).toContain('XMapWindow');
  });

  test('the VANILLA_X11_PORT_HAS_NO_XSETWMNAME_CALL clause cites XSetWMName and the locale-aware nature', () => {
    const entry = VANILLA_WINDOW_TITLE_AND_ICON_POLICY_CONTRACT_AUDIT.find((clause) => clause.id === 'VANILLA_X11_PORT_HAS_NO_XSETWMNAME_CALL');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('XSetWMName');
    expect(entry!.invariant).toContain('locale');
  });

  test('the VANILLA_X11_PORT_HAS_NO_XSETWMICONNAME_CALL clause cites XSetWMIconName and the minimised state', () => {
    const entry = VANILLA_WINDOW_TITLE_AND_ICON_POLICY_CONTRACT_AUDIT.find((clause) => clause.id === 'VANILLA_X11_PORT_HAS_NO_XSETWMICONNAME_CALL');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('XSetWMIconName');
    expect(entry!.invariant).toContain('minimised');
  });

  test('the VANILLA_X11_PORT_HAS_NO_XSETCLASSHINT_CALL clause cites XSetClassHint and WM_CLASS', () => {
    const entry = VANILLA_WINDOW_TITLE_AND_ICON_POLICY_CONTRACT_AUDIT.find((clause) => clause.id === 'VANILLA_X11_PORT_HAS_NO_XSETCLASSHINT_CALL');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('XSetClassHint');
    expect(entry!.invariant).toContain('WM_CLASS');
    expect(entry!.invariant).toContain('argv[0]');
  });

  test('the VANILLA_X11_PORT_HAS_NO_XSETWMHINTS_CALL clause cites XSetWMHints and WM_HINTS', () => {
    const entry = VANILLA_WINDOW_TITLE_AND_ICON_POLICY_CONTRACT_AUDIT.find((clause) => clause.id === 'VANILLA_X11_PORT_HAS_NO_XSETWMHINTS_CALL');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('XSetWMHints');
    expect(entry!.invariant).toContain('WM_HINTS');
  });

  test('the VANILLA_X11_PORT_HAS_NO_ICON_PIXMAP clause distinguishes the cursormask pixmap', () => {
    const entry = VANILLA_WINDOW_TITLE_AND_ICON_POLICY_CONTRACT_AUDIT.find((clause) => clause.id === 'VANILLA_X11_PORT_HAS_NO_ICON_PIXMAP');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('XCreatePixmap');
    expect(entry!.invariant).toContain('cursormask');
    expect(entry!.invariant).toContain('createnullcursor');
  });

  test('the VANILLA_X11_PORT_USES_BARE_XCREATEWINDOW_ATTRIBMASK clause names the three flags', () => {
    const entry = VANILLA_WINDOW_TITLE_AND_ICON_POLICY_CONTRACT_AUDIT.find((clause) => clause.id === 'VANILLA_X11_PORT_USES_BARE_XCREATEWINDOW_ATTRIBMASK');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('CWEventMask');
    expect(entry!.invariant).toContain('CWColormap');
    expect(entry!.invariant).toContain('CWBorderPixel');
    expect(entry!.invariant).toContain('KeyPressMask');
  });

  test('the VANILLA_DOS_PORT_HAS_NO_WINDOW_CONCEPT clause cites VGA mode 13h and fullscreen', () => {
    const entry = VANILLA_WINDOW_TITLE_AND_ICON_POLICY_CONTRACT_AUDIT.find((clause) => clause.id === 'VANILLA_DOS_PORT_HAS_NO_WINDOW_CONCEPT');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('VGA mode 13h');
    expect(entry!.invariant).toContain('fullscreen');
    expect(entry!.invariant).toContain('320x200');
  });

  test('the VANILLA_HAS_NO_EMBEDDED_ICON_DATA_ARRAY clause cites icon.c and Chocolate', () => {
    const entry = VANILLA_WINDOW_TITLE_AND_ICON_POLICY_CONTRACT_AUDIT.find((clause) => clause.id === 'VANILLA_HAS_NO_EMBEDDED_ICON_DATA_ARRAY');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('icon.c');
    expect(entry!.invariant).toContain('icon_data');
    expect(entry!.invariant).toContain('Chocolate Doom 2.2.1');
  });

  test('the VANILLA_HAS_NO_TITLE_SETTER_FUNCTION clause cites I_SetWindowTitle and window_title', () => {
    const entry = VANILLA_WINDOW_TITLE_AND_ICON_POLICY_CONTRACT_AUDIT.find((clause) => clause.id === 'VANILLA_HAS_NO_TITLE_SETTER_FUNCTION');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('I_SetWindowTitle');
    expect(entry!.invariant).toContain('window_title');
  });

  test('every Chocolate-only-omission clause names its specific Chocolate addition', () => {
    const omissionClauses: ReadonlyArray<{ id: string; expectedSnippet: string }> = [
      { id: 'VANILLA_TITLE_AND_ICON_POLICY_OMITS_I_SETWINDOWTITLE', expectedSnippet: 'I_SetWindowTitle' },
      { id: 'VANILLA_TITLE_AND_ICON_POLICY_OMITS_I_INITWINDOWTITLE', expectedSnippet: 'I_InitWindowTitle' },
      { id: 'VANILLA_TITLE_AND_ICON_POLICY_OMITS_I_INITWINDOWICON', expectedSnippet: 'I_InitWindowIcon' },
      { id: 'VANILLA_TITLE_AND_ICON_POLICY_OMITS_SDL_WM_SETCAPTION', expectedSnippet: 'SDL_WM_SetCaption' },
      { id: 'VANILLA_TITLE_AND_ICON_POLICY_OMITS_SDL_WM_SETICON', expectedSnippet: 'SDL_WM_SetIcon' },
    ];
    for (const { id, expectedSnippet } of omissionClauses) {
      const entry = VANILLA_WINDOW_TITLE_AND_ICON_POLICY_CONTRACT_AUDIT.find((clause) => clause.id === id);
      expect(entry).toBeDefined();
      expect(entry!.invariant).toContain(expectedSnippet);
      expect(entry!.invariant).toContain('Chocolate Doom 2.2.1');
    }
  });

  test('the VANILLA_TITLE_AND_ICON_POLICY_OMITS_PACKAGE_STRING_SUFFIX clause cites autotools and M_StringJoin', () => {
    const entry = VANILLA_WINDOW_TITLE_AND_ICON_POLICY_CONTRACT_AUDIT.find((clause) => clause.id === 'VANILLA_TITLE_AND_ICON_POLICY_OMITS_PACKAGE_STRING_SUFFIX');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('PACKAGE_STRING');
    expect(entry!.invariant).toContain('autotools');
    expect(entry!.invariant).toContain('M_StringJoin');
  });

  test('the VANILLA_TITLE_AND_ICON_POLICY_OMITS_M_STRINGJOIN_TITLE_FORMAT clause cites m_misc.h', () => {
    const entry = VANILLA_WINDOW_TITLE_AND_ICON_POLICY_CONTRACT_AUDIT.find((clause) => clause.id === 'VANILLA_TITLE_AND_ICON_POLICY_OMITS_M_STRINGJOIN_TITLE_FORMAT');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('M_StringJoin');
    expect(entry!.invariant).toContain('m_misc.h');
  });

  test('the VANILLA_HAS_NO_TITLE_BEFORE_ICON_INIT_ORDERING_REQUIREMENT clause cites the Chocolate verbatim comment', () => {
    const entry = VANILLA_WINDOW_TITLE_AND_ICON_POLICY_CONTRACT_AUDIT.find((clause) => clause.id === 'VANILLA_HAS_NO_TITLE_BEFORE_ICON_INIT_ORDERING_REQUIREMENT');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('Windows cares about the ordering');
    expect(entry!.invariant).toContain('I_InitWindowTitle');
    expect(entry!.invariant).toContain('I_InitWindowIcon');
  });

  test('the VANILLA_HAS_NO_RUNTIME_TITLE_OR_ICON_MUTATION clause cites E1M1 and Paused as counterexamples', () => {
    const entry = VANILLA_WINDOW_TITLE_AND_ICON_POLICY_CONTRACT_AUDIT.find((clause) => clause.id === 'VANILLA_HAS_NO_RUNTIME_TITLE_OR_ICON_MUTATION');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('E1M1');
    expect(entry!.invariant).toContain('Paused');
    expect(entry!.invariant).toContain('I_InitGraphics');
  });

  test('every i_video.c-pinned clause references the I_InitGraphics or I_ShutdownGraphics symbol', () => {
    const iVideoClauses = VANILLA_WINDOW_TITLE_AND_ICON_POLICY_CONTRACT_AUDIT.filter((entry) => entry.referenceSourceFile === 'i_video.c');
    for (const clause of iVideoClauses) {
      expect(['I_InitGraphics', 'I_ShutdownGraphics']).toContain(clause.cSymbol);
    }
  });

  test('the d_main.c-pinned clause references D_DoomMain or D_DoomLoop', () => {
    const dMainClauses = VANILLA_WINDOW_TITLE_AND_ICON_POLICY_CONTRACT_AUDIT.filter((entry) => entry.referenceSourceFile === 'd_main.c');
    expect(dMainClauses.length).toBe(1);
    expect(['D_DoomMain', 'D_DoomLoop']).toContain(dMainClauses[0]!.cSymbol);
  });
});

describe('VANILLA_WINDOW_ATTRIBUTE_CHANNEL_LANDSCAPE pinned ledger', () => {
  test('has exactly five entries', () => {
    expect(VANILLA_WINDOW_ATTRIBUTE_CHANNEL_LANDSCAPE.length).toBe(5);
    expect(VANILLA_WINDOW_ATTRIBUTE_CHANNEL_LANDSCAPE.length).toBe(VANILLA_WINDOW_ATTRIBUTE_CHANNEL_COUNT);
  });

  test('orders the canonical five-channel landscape verbatim (title, icon-pixmap, icon-name, wm-class, wm-hints)', () => {
    expect(VANILLA_WINDOW_ATTRIBUTE_CHANNEL_LANDSCAPE.map((entry) => entry.channelName)).toEqual(['title', 'icon-pixmap', 'icon-name', 'wm-class', 'wm-hints']);
  });

  test('every channel uses `wm-default-no-explicit-set` on the X11 port', () => {
    for (const entry of VANILLA_WINDOW_ATTRIBUTE_CHANNEL_LANDSCAPE) {
      expect(entry.x11SourceStrategy).toBe('wm-default-no-explicit-set');
    }
  });

  test('every channel uses `dos-no-window-concept` on the DOS port', () => {
    for (const entry of VANILLA_WINDOW_ATTRIBUTE_CHANNEL_LANDSCAPE) {
      expect(entry.dosSourceStrategy).toBe('dos-no-window-concept');
    }
  });

  test('every channel name is unique', () => {
    const names = VANILLA_WINDOW_ATTRIBUTE_CHANNEL_LANDSCAPE.map((entry) => entry.channelName);
    expect(new Set(names).size).toBe(names.length);
  });

  test('the title channel pins the X11 omitted symbol as XStoreName and the Chocolate symbol as SDL_WM_SetCaption', () => {
    const entry = VANILLA_WINDOW_ATTRIBUTE_CHANNEL_LANDSCAPE.find((e) => e.channelName === 'title');
    expect(entry).toBeDefined();
    expect(entry!.x11ApiSymbolThatVanillaOmits).toBe('XStoreName');
    expect(entry!.chocolateApiSymbol).toBe('SDL_WM_SetCaption');
  });

  test('the icon-pixmap channel pins the X11 omitted symbol as XSetWMHints and the Chocolate symbol as SDL_WM_SetIcon', () => {
    const entry = VANILLA_WINDOW_ATTRIBUTE_CHANNEL_LANDSCAPE.find((e) => e.channelName === 'icon-pixmap');
    expect(entry).toBeDefined();
    expect(entry!.x11ApiSymbolThatVanillaOmits).toBe('XSetWMHints');
    expect(entry!.chocolateApiSymbol).toBe('SDL_WM_SetIcon');
  });

  test('the icon-name channel pins the X11 omitted symbol as XSetWMIconName with no Chocolate counterpart', () => {
    const entry = VANILLA_WINDOW_ATTRIBUTE_CHANNEL_LANDSCAPE.find((e) => e.channelName === 'icon-name');
    expect(entry).toBeDefined();
    expect(entry!.x11ApiSymbolThatVanillaOmits).toBe('XSetWMIconName');
    expect(entry!.chocolateApiSymbol).toBeNull();
  });

  test('the wm-class channel pins the X11 omitted symbol as XSetClassHint with no Chocolate counterpart', () => {
    const entry = VANILLA_WINDOW_ATTRIBUTE_CHANNEL_LANDSCAPE.find((e) => e.channelName === 'wm-class');
    expect(entry).toBeDefined();
    expect(entry!.x11ApiSymbolThatVanillaOmits).toBe('XSetClassHint');
    expect(entry!.chocolateApiSymbol).toBeNull();
  });

  test('the wm-hints channel pins the X11 omitted symbol as XSetWMHints with no Chocolate counterpart', () => {
    const entry = VANILLA_WINDOW_ATTRIBUTE_CHANNEL_LANDSCAPE.find((e) => e.channelName === 'wm-hints');
    expect(entry).toBeDefined();
    expect(entry!.x11ApiSymbolThatVanillaOmits).toBe('XSetWMHints');
    expect(entry!.chocolateApiSymbol).toBeNull();
  });
});

describe('Pinned canonical constants', () => {
  test('VANILLA_WINDOW_TITLE_API_CALL_COUNT is exactly 0', () => {
    expect(VANILLA_WINDOW_TITLE_API_CALL_COUNT).toBe(0);
  });

  test('VANILLA_WINDOW_ICON_API_CALL_COUNT is exactly 0', () => {
    expect(VANILLA_WINDOW_ICON_API_CALL_COUNT).toBe(0);
  });

  test('VANILLA_WINDOW_WM_CLASS_API_CALL_COUNT is exactly 0', () => {
    expect(VANILLA_WINDOW_WM_CLASS_API_CALL_COUNT).toBe(0);
  });

  test('VANILLA_DOS_PORT_HAS_WINDOW_CONCEPT is false', () => {
    expect(VANILLA_DOS_PORT_HAS_WINDOW_CONCEPT).toBe(false);
  });

  test('VANILLA_X11_PORT_USES_BARE_XCREATEWINDOW is true', () => {
    expect(VANILLA_X11_PORT_USES_BARE_XCREATEWINDOW).toBe(true);
  });

  test('VANILLA_X11_XCREATEWINDOW_ATTRIBMASK_TOKENS lists exactly three tokens in canonical order', () => {
    expect(VANILLA_X11_XCREATEWINDOW_ATTRIBMASK_TOKENS).toEqual(['CWEventMask', 'CWColormap', 'CWBorderPixel']);
    expect(VANILLA_X11_XCREATEWINDOW_ATTRIBMASK_TOKENS.length).toBe(VANILLA_X11_XCREATEWINDOW_ATTRIBMASK_TOKEN_COUNT);
  });

  test('VANILLA_WINDOW_TITLE_AND_ICON_POLICY_ABSENT_CHOCOLATE_API_CALLS lists the five Chocolate-only additions', () => {
    expect(VANILLA_WINDOW_TITLE_AND_ICON_POLICY_ABSENT_CHOCOLATE_API_CALLS).toEqual(['I_SetWindowTitle', 'I_InitWindowTitle', 'I_InitWindowIcon', 'SDL_WM_SetCaption', 'SDL_WM_SetIcon']);
    expect(VANILLA_WINDOW_TITLE_AND_ICON_POLICY_ABSENT_CHOCOLATE_API_CALLS.length).toBe(VANILLA_WINDOW_TITLE_AND_ICON_POLICY_ABSENT_CHOCOLATE_API_CALL_COUNT);
  });

  test('CHOCOLATE_TITLE_FORMAT_TEMPLATE matches the verbatim format', () => {
    expect(CHOCOLATE_TITLE_FORMAT_TEMPLATE).toBe('<window_title> - PACKAGE_STRING');
  });

  test('CHOCOLATE_TITLE_JOIN_FUNCTION_SYMBOL is M_StringJoin', () => {
    expect(CHOCOLATE_TITLE_JOIN_FUNCTION_SYMBOL).toBe('M_StringJoin');
  });

  test('CHOCOLATE_ICON_DATA_BITS_PER_PIXEL is 24', () => {
    expect(CHOCOLATE_ICON_DATA_BITS_PER_PIXEL).toBe(24);
  });

  test('CHOCOLATE_INIT_ORDERING_TITLE_BEFORE_ICON is true', () => {
    expect(CHOCOLATE_INIT_ORDERING_TITLE_BEFORE_ICON).toBe(true);
  });
});

describe('VANILLA_WINDOW_TITLE_AND_ICON_POLICY_DERIVED_INVARIANTS ledger', () => {
  test('has exactly twenty derived invariants', () => {
    expect(VANILLA_WINDOW_TITLE_AND_ICON_POLICY_DERIVED_INVARIANTS.length).toBe(20);
    expect(VANILLA_WINDOW_TITLE_AND_ICON_POLICY_DERIVED_INVARIANTS.length).toBe(VANILLA_WINDOW_TITLE_AND_ICON_POLICY_DERIVED_INVARIANT_COUNT);
  });

  test('every invariant id is unique', () => {
    const ids = VANILLA_WINDOW_TITLE_AND_ICON_POLICY_DERIVED_INVARIANTS.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('every invariant has a non-empty description', () => {
    for (const entry of VANILLA_WINDOW_TITLE_AND_ICON_POLICY_DERIVED_INVARIANTS) {
      expect(entry.description.length).toBeGreaterThan(0);
    }
  });
});

describe('VANILLA_WINDOW_TITLE_AND_ICON_POLICY_PROBES ledger', () => {
  test('has exactly thirty probes', () => {
    expect(VANILLA_WINDOW_TITLE_AND_ICON_POLICY_PROBES.length).toBe(30);
    expect(VANILLA_WINDOW_TITLE_AND_ICON_POLICY_PROBES.length).toBe(VANILLA_WINDOW_TITLE_AND_ICON_POLICY_PROBE_COUNT);
  });

  test('every probe id is unique', () => {
    const ids = VANILLA_WINDOW_TITLE_AND_ICON_POLICY_PROBES.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('every probe witnesses a declared derived invariant', () => {
    const declaredIds = new Set(VANILLA_WINDOW_TITLE_AND_ICON_POLICY_DERIVED_INVARIANTS.map((entry) => entry.id));
    for (const probe of VANILLA_WINDOW_TITLE_AND_ICON_POLICY_PROBES) {
      expect(declaredIds.has(probe.witnessInvariantId)).toBe(true);
    }
  });

  test('every probe targets a known query kind', () => {
    const validQueryKinds: ReadonlyArray<string> = [
      'window-title-api-call-count',
      'window-icon-api-call-count',
      'window-wm-class-api-call-count',
      'channel-x11-source-strategy',
      'channel-dos-source-strategy',
      'channel-x11-omitted-api-symbol',
      'landscape-channel-count',
      'dos-port-has-window-concept',
      'x11-port-uses-bare-xcreatewindow',
      'x11-port-attribmask-token-count',
      'x11-port-attribmask-includes-token',
      'title-and-icon-policy-includes-chocolate-api-call',
      'runtime-title-or-icon-mutation-allowed',
      'title-before-icon-ordering-required',
    ];
    for (const probe of VANILLA_WINDOW_TITLE_AND_ICON_POLICY_PROBES) {
      expect(validQueryKinds).toContain(probe.queryKind);
    }
  });

  test('count-bearing query kinds populate exactly the answeredCount expectation', () => {
    const countQueryKinds = new Set(['window-title-api-call-count', 'window-icon-api-call-count', 'window-wm-class-api-call-count', 'landscape-channel-count', 'x11-port-attribmask-token-count']);
    for (const probe of VANILLA_WINDOW_TITLE_AND_ICON_POLICY_PROBES) {
      if (countQueryKinds.has(probe.queryKind)) {
        expect(probe.expectedAnsweredCount).not.toBeNull();
        expect(probe.expectedAnsweredSourceStrategy).toBeNull();
        expect(probe.expectedAnsweredApiSymbol).toBeNull();
        expect(probe.expectedAnsweredPresent).toBeNull();
      }
    }
  });

  test('strategy-bearing query kinds populate exactly the answeredSourceStrategy expectation', () => {
    const strategyQueryKinds = new Set(['channel-x11-source-strategy', 'channel-dos-source-strategy']);
    for (const probe of VANILLA_WINDOW_TITLE_AND_ICON_POLICY_PROBES) {
      if (strategyQueryKinds.has(probe.queryKind)) {
        expect(probe.expectedAnsweredSourceStrategy).not.toBeNull();
        expect(probe.expectedAnsweredApiSymbol).toBeNull();
        expect(probe.expectedAnsweredPresent).toBeNull();
        expect(probe.expectedAnsweredCount).toBeNull();
      }
    }
  });

  test('api-symbol query kind populates exactly the answeredApiSymbol expectation', () => {
    for (const probe of VANILLA_WINDOW_TITLE_AND_ICON_POLICY_PROBES) {
      if (probe.queryKind === 'channel-x11-omitted-api-symbol') {
        expect(probe.expectedAnsweredApiSymbol).not.toBeNull();
        expect(probe.expectedAnsweredSourceStrategy).toBeNull();
        expect(probe.expectedAnsweredPresent).toBeNull();
        expect(probe.expectedAnsweredCount).toBeNull();
      }
    }
  });

  test('boolean query kinds populate exactly the answeredPresent expectation', () => {
    const booleanQueryKinds = new Set([
      'dos-port-has-window-concept',
      'x11-port-uses-bare-xcreatewindow',
      'x11-port-attribmask-includes-token',
      'title-and-icon-policy-includes-chocolate-api-call',
      'runtime-title-or-icon-mutation-allowed',
      'title-before-icon-ordering-required',
    ]);
    for (const probe of VANILLA_WINDOW_TITLE_AND_ICON_POLICY_PROBES) {
      if (booleanQueryKinds.has(probe.queryKind)) {
        expect(probe.expectedAnsweredPresent).not.toBeNull();
        expect(probe.expectedAnsweredSourceStrategy).toBeNull();
        expect(probe.expectedAnsweredApiSymbol).toBeNull();
        expect(probe.expectedAnsweredCount).toBeNull();
      }
    }
  });
});

describe('REFERENCE_VANILLA_WINDOW_TITLE_AND_ICON_POLICY_HANDLER', () => {
  test('passes every probe with zero failures', () => {
    const failures = crossCheckVanillaWindowTitleAndIconPolicy(REFERENCE_VANILLA_WINDOW_TITLE_AND_ICON_POLICY_HANDLER);
    expect(failures).toEqual([]);
  });

  test('answers every query kind correctly with the reference handler', () => {
    for (const probe of VANILLA_WINDOW_TITLE_AND_ICON_POLICY_PROBES) {
      const result = REFERENCE_VANILLA_WINDOW_TITLE_AND_ICON_POLICY_HANDLER.runProbe(probe);
      if (probe.expectedAnsweredCount !== null) {
        expect(result.answeredCount).toBe(probe.expectedAnsweredCount);
      }
      if (probe.expectedAnsweredSourceStrategy !== null) {
        expect(result.answeredSourceStrategy).toBe(probe.expectedAnsweredSourceStrategy);
      }
      if (probe.expectedAnsweredApiSymbol !== null) {
        expect(result.answeredApiSymbol).toBe(probe.expectedAnsweredApiSymbol);
      }
      if (probe.expectedAnsweredPresent !== null) {
        expect(result.answeredPresent).toBe(probe.expectedAnsweredPresent);
      }
    }
  });
});

describe('crossCheckVanillaWindowTitleAndIconPolicy failure modes', () => {
  test('detects a handler that reports a non-zero window-title API call count', () => {
    const titleApiPositive: VanillaWindowTitleAndIconPolicyHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_WINDOW_TITLE_AND_ICON_POLICY_HANDLER.runProbe(probe);
        if (probe.queryKind === 'window-title-api-call-count') {
          return Object.freeze({ ...inner, answeredCount: 1 });
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaWindowTitleAndIconPolicy(titleApiPositive);
    expect(failures.some((failure) => failure.startsWith('probe:window-title-api-call-count-is-zero:answeredCount:value-mismatch'))).toBe(true);
  });

  test('detects a handler that reports a non-zero window-icon API call count', () => {
    const iconApiPositive: VanillaWindowTitleAndIconPolicyHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_WINDOW_TITLE_AND_ICON_POLICY_HANDLER.runProbe(probe);
        if (probe.queryKind === 'window-icon-api-call-count') {
          return Object.freeze({ ...inner, answeredCount: 1 });
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaWindowTitleAndIconPolicy(iconApiPositive);
    expect(failures.some((failure) => failure.startsWith('probe:window-icon-api-call-count-is-zero:answeredCount:value-mismatch'))).toBe(true);
  });

  test('detects a handler that reports a non-zero WM_CLASS API call count', () => {
    const wmClassApiPositive: VanillaWindowTitleAndIconPolicyHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_WINDOW_TITLE_AND_ICON_POLICY_HANDLER.runProbe(probe);
        if (probe.queryKind === 'window-wm-class-api-call-count') {
          return Object.freeze({ ...inner, answeredCount: 1 });
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaWindowTitleAndIconPolicy(wmClassApiPositive);
    expect(failures.some((failure) => failure.startsWith('probe:window-wm-class-api-call-count-is-zero:answeredCount:value-mismatch'))).toBe(true);
  });

  test('detects a handler that reports the title channel as having an explicit X11 source', () => {
    const titleExplicit: VanillaWindowTitleAndIconPolicyHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_WINDOW_TITLE_AND_ICON_POLICY_HANDLER.runProbe(probe);
        if (probe.queryKind === 'channel-x11-source-strategy' && probe.queryChannelName === 'title') {
          return Object.freeze({ ...inner, answeredSourceStrategy: 'dos-no-window-concept' });
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaWindowTitleAndIconPolicy(titleExplicit);
    expect(failures.some((failure) => failure.startsWith('probe:channel-title-x11-strategy-is-wm-default:answeredSourceStrategy:value-mismatch'))).toBe(true);
  });

  test('detects a handler that reports the icon-pixmap omitted symbol incorrectly as XStoreName', () => {
    const wrongIconSymbol: VanillaWindowTitleAndIconPolicyHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_WINDOW_TITLE_AND_ICON_POLICY_HANDLER.runProbe(probe);
        if (probe.queryKind === 'channel-x11-omitted-api-symbol' && probe.queryChannelName === 'icon-pixmap') {
          return Object.freeze({ ...inner, answeredApiSymbol: 'XStoreName' });
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaWindowTitleAndIconPolicy(wrongIconSymbol);
    expect(failures.some((failure) => failure.startsWith('probe:channel-icon-pixmap-x11-omits-xsetwmhints:answeredApiSymbol:value-mismatch'))).toBe(true);
  });

  test('detects a handler that reports the channel landscape with the wrong count (4 instead of 5)', () => {
    const wrongChannelCount: VanillaWindowTitleAndIconPolicyHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_WINDOW_TITLE_AND_ICON_POLICY_HANDLER.runProbe(probe);
        if (probe.queryKind === 'landscape-channel-count') {
          return Object.freeze({ ...inner, answeredCount: 4 });
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaWindowTitleAndIconPolicy(wrongChannelCount);
    expect(failures.some((failure) => failure.startsWith('probe:landscape-channel-count-is-five:answeredCount:value-mismatch'))).toBe(true);
  });

  test('detects a handler that reports the DOS port as having a window concept', () => {
    const dosWindowed: VanillaWindowTitleAndIconPolicyHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_WINDOW_TITLE_AND_ICON_POLICY_HANDLER.runProbe(probe);
        if (probe.queryKind === 'dos-port-has-window-concept') {
          return Object.freeze({ ...inner, answeredPresent: true });
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaWindowTitleAndIconPolicy(dosWindowed);
    expect(failures.some((failure) => failure.startsWith('probe:dos-port-has-no-window-concept:answeredPresent:value-mismatch'))).toBe(true);
  });

  test('detects a handler that reports the X11 port using a non-bare XCreateWindow attribmask', () => {
    const nonBareXCreate: VanillaWindowTitleAndIconPolicyHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_WINDOW_TITLE_AND_ICON_POLICY_HANDLER.runProbe(probe);
        if (probe.queryKind === 'x11-port-uses-bare-xcreatewindow') {
          return Object.freeze({ ...inner, answeredPresent: false });
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaWindowTitleAndIconPolicy(nonBareXCreate);
    expect(failures.some((failure) => failure.startsWith('probe:x11-port-uses-bare-xcreatewindow:answeredPresent:value-mismatch'))).toBe(true);
  });

  test('detects a handler that reports the attribmask token count as 4 instead of 3', () => {
    const wrongTokenCount: VanillaWindowTitleAndIconPolicyHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_WINDOW_TITLE_AND_ICON_POLICY_HANDLER.runProbe(probe);
        if (probe.queryKind === 'x11-port-attribmask-token-count') {
          return Object.freeze({ ...inner, answeredCount: 4 });
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaWindowTitleAndIconPolicy(wrongTokenCount);
    expect(failures.some((failure) => failure.startsWith('probe:x11-port-attribmask-has-three-tokens:answeredCount:value-mismatch'))).toBe(true);
  });

  test('detects a handler that reports the attribmask as missing CWEventMask', () => {
    const droppedEventMask: VanillaWindowTitleAndIconPolicyHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_WINDOW_TITLE_AND_ICON_POLICY_HANDLER.runProbe(probe);
        if (probe.queryKind === 'x11-port-attribmask-includes-token' && probe.queryAttribmaskToken === 'CWEventMask') {
          return Object.freeze({ ...inner, answeredPresent: false });
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaWindowTitleAndIconPolicy(droppedEventMask);
    expect(failures.some((failure) => failure.startsWith('probe:x11-port-attribmask-includes-cweventmask:answeredPresent:value-mismatch'))).toBe(true);
  });

  test('detects a handler that reports the attribmask as including CWBackPixmap', () => {
    const addedBackPixmap: VanillaWindowTitleAndIconPolicyHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_WINDOW_TITLE_AND_ICON_POLICY_HANDLER.runProbe(probe);
        if (probe.queryKind === 'x11-port-attribmask-includes-token' && probe.queryAttribmaskToken === 'CWBackPixmap') {
          return Object.freeze({ ...inner, answeredPresent: true });
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaWindowTitleAndIconPolicy(addedBackPixmap);
    expect(failures.some((failure) => failure.startsWith('probe:x11-port-attribmask-excludes-cwbackpixmap:answeredPresent:value-mismatch'))).toBe(true);
  });

  test('detects a handler that includes I_SetWindowTitle (Chocolate-only)', () => {
    const includesISetWindowTitle: VanillaWindowTitleAndIconPolicyHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_WINDOW_TITLE_AND_ICON_POLICY_HANDLER.runProbe(probe);
        if (probe.queryKind === 'title-and-icon-policy-includes-chocolate-api-call' && probe.queryChocolateApiCallName === 'I_SetWindowTitle') {
          return Object.freeze({ ...inner, answeredPresent: true });
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaWindowTitleAndIconPolicy(includesISetWindowTitle);
    expect(failures.some((failure) => failure.startsWith('probe:title-and-icon-policy-omits-i-setwindowtitle:answeredPresent:value-mismatch'))).toBe(true);
  });

  test('detects a handler that includes SDL_WM_SetCaption (Chocolate-only)', () => {
    const includesSdlWmSetCaption: VanillaWindowTitleAndIconPolicyHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_WINDOW_TITLE_AND_ICON_POLICY_HANDLER.runProbe(probe);
        if (probe.queryKind === 'title-and-icon-policy-includes-chocolate-api-call' && probe.queryChocolateApiCallName === 'SDL_WM_SetCaption') {
          return Object.freeze({ ...inner, answeredPresent: true });
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaWindowTitleAndIconPolicy(includesSdlWmSetCaption);
    expect(failures.some((failure) => failure.startsWith('probe:title-and-icon-policy-omits-sdl-wm-setcaption:answeredPresent:value-mismatch'))).toBe(true);
  });

  test('detects a handler that includes SDL_WM_SetIcon (Chocolate-only)', () => {
    const includesSdlWmSetIcon: VanillaWindowTitleAndIconPolicyHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_WINDOW_TITLE_AND_ICON_POLICY_HANDLER.runProbe(probe);
        if (probe.queryKind === 'title-and-icon-policy-includes-chocolate-api-call' && probe.queryChocolateApiCallName === 'SDL_WM_SetIcon') {
          return Object.freeze({ ...inner, answeredPresent: true });
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaWindowTitleAndIconPolicy(includesSdlWmSetIcon);
    expect(failures.some((failure) => failure.startsWith('probe:title-and-icon-policy-omits-sdl-wm-seticon:answeredPresent:value-mismatch'))).toBe(true);
  });

  test('detects a handler that allows runtime title-or-icon mutation', () => {
    const runtimeMutationAllowed: VanillaWindowTitleAndIconPolicyHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_WINDOW_TITLE_AND_ICON_POLICY_HANDLER.runProbe(probe);
        if (probe.queryKind === 'runtime-title-or-icon-mutation-allowed') {
          return Object.freeze({ ...inner, answeredPresent: true });
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaWindowTitleAndIconPolicy(runtimeMutationAllowed);
    expect(failures.some((failure) => failure.startsWith('probe:runtime-title-or-icon-mutation-not-allowed:answeredPresent:value-mismatch'))).toBe(true);
  });

  test('detects a handler that requires title-before-icon init ordering', () => {
    const titleBeforeIconRequired: VanillaWindowTitleAndIconPolicyHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_WINDOW_TITLE_AND_ICON_POLICY_HANDLER.runProbe(probe);
        if (probe.queryKind === 'title-before-icon-ordering-required') {
          return Object.freeze({ ...inner, answeredPresent: true });
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaWindowTitleAndIconPolicy(titleBeforeIconRequired);
    expect(failures.some((failure) => failure.startsWith('probe:title-before-icon-ordering-not-required:answeredPresent:value-mismatch'))).toBe(true);
  });

  test('detects a handler that reports the wm-class channel with the wrong omitted symbol', () => {
    const wrongWmClassSymbol: VanillaWindowTitleAndIconPolicyHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_WINDOW_TITLE_AND_ICON_POLICY_HANDLER.runProbe(probe);
        if (probe.queryKind === 'channel-x11-omitted-api-symbol' && probe.queryChannelName === 'wm-class') {
          return Object.freeze({ ...inner, answeredApiSymbol: 'XStoreName' });
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaWindowTitleAndIconPolicy(wrongWmClassSymbol);
    expect(failures.some((failure) => failure.startsWith('probe:channel-wm-class-x11-omits-xsetclasshint:answeredApiSymbol:value-mismatch'))).toBe(true);
  });
});

describe('deriveExpectedVanillaWindowTitleAndIconPolicyResult helper', () => {
  test('matches the reference handler answer for every pinned probe', () => {
    for (const probe of VANILLA_WINDOW_TITLE_AND_ICON_POLICY_PROBES) {
      const derived: VanillaWindowTitleAndIconPolicyResult = deriveExpectedVanillaWindowTitleAndIconPolicyResult(probe);
      const reference: VanillaWindowTitleAndIconPolicyResult = REFERENCE_VANILLA_WINDOW_TITLE_AND_ICON_POLICY_HANDLER.runProbe(probe);
      expect(derived.answeredSourceStrategy).toBe(reference.answeredSourceStrategy);
      expect(derived.answeredApiSymbol).toBe(reference.answeredApiSymbol);
      expect(derived.answeredPresent).toBe(reference.answeredPresent);
      expect(derived.answeredCount).toBe(reference.answeredCount);
    }
  });

  test('returns null answeredSourceStrategy for an unknown channel name on channel-x11-source-strategy', () => {
    const probe: VanillaWindowTitleAndIconPolicyProbe = {
      id: 'unknown-channel-x11-strategy-test',
      description: 'Test probe with an unknown channel name.',
      queryKind: 'channel-x11-source-strategy',
      queryChannelName: null,
      queryAttribmaskToken: null,
      queryChocolateApiCallName: null,
      expectedAnsweredSourceStrategy: null,
      expectedAnsweredApiSymbol: null,
      expectedAnsweredPresent: null,
      expectedAnsweredCount: null,
      witnessInvariantId: 'TITLE_CHANNEL_X11_STRATEGY_IS_WM_DEFAULT',
    };
    const result = deriveExpectedVanillaWindowTitleAndIconPolicyResult(probe);
    expect(result.answeredSourceStrategy).toBeNull();
  });

  test('returns null answeredApiSymbol for an unknown channel name on channel-x11-omitted-api-symbol', () => {
    const probe: VanillaWindowTitleAndIconPolicyProbe = {
      id: 'unknown-channel-omitted-symbol-test',
      description: 'Test probe with an unknown channel name.',
      queryKind: 'channel-x11-omitted-api-symbol',
      queryChannelName: null,
      queryAttribmaskToken: null,
      queryChocolateApiCallName: null,
      expectedAnsweredSourceStrategy: null,
      expectedAnsweredApiSymbol: null,
      expectedAnsweredPresent: null,
      expectedAnsweredCount: null,
      witnessInvariantId: 'TITLE_CHANNEL_X11_STRATEGY_IS_WM_DEFAULT',
    };
    const result = deriveExpectedVanillaWindowTitleAndIconPolicyResult(probe);
    expect(result.answeredApiSymbol).toBeNull();
  });

  test('returns false for a x11-port-attribmask-includes-token query with an unknown token', () => {
    const probe: VanillaWindowTitleAndIconPolicyProbe = {
      id: 'unknown-attribmask-token-test',
      description: 'Test probe with an unknown attribmask token.',
      queryKind: 'x11-port-attribmask-includes-token',
      queryChannelName: null,
      queryAttribmaskToken: 'CWNonexistentFlag',
      queryChocolateApiCallName: null,
      expectedAnsweredSourceStrategy: null,
      expectedAnsweredApiSymbol: null,
      expectedAnsweredPresent: null,
      expectedAnsweredCount: null,
      witnessInvariantId: 'X11_PORT_USES_BARE_XCREATEWINDOW',
    };
    const result = deriveExpectedVanillaWindowTitleAndIconPolicyResult(probe);
    expect(result.answeredPresent).toBe(false);
  });
});

describe('apply-window-title-and-icon-policy step file', () => {
  test('declares the launch lane and the apply write lock', async () => {
    const stepText = await Bun.file(STEP_FILE_RELATIVE_PATH).text();
    expect(stepText).toContain('## lane\n\nlaunch');
    expect(stepText).toContain('- src/bootstrap/apply-window-title-and-icon-policy.ts');
    expect(stepText).toContain('- test/vanilla_parity/launch/apply-window-title-and-icon-policy.test.ts');
  });

  test('lists d_main.c, g_game.c, i_timer.c, i_video.c, and m_menu.c as research sources', async () => {
    const stepText = await Bun.file(STEP_FILE_RELATIVE_PATH).text();
    expect(stepText).toContain('- d_main.c');
    expect(stepText).toContain('- g_game.c');
    expect(stepText).toContain('- i_timer.c');
    expect(stepText).toContain('- i_video.c');
    expect(stepText).toContain('- m_menu.c');
  });

  test('declares the prerequisite gate 00-018', async () => {
    const stepText = await Bun.file(STEP_FILE_RELATIVE_PATH).text();
    expect(stepText).toContain('## prerequisites\n\n- 00-018');
  });
});
