import { describe, expect, test } from 'bun:test';

import {
  REFERENCE_VANILLA_D_DOOMMAIN_INIT_ORDER_HANDLER,
  VANILLA_D_DOOMMAIN_ABSENT_CHOCOLATE_SYMBOLS,
  VANILLA_D_DOOMMAIN_ABSENT_CHOCOLATE_SYMBOL_COUNT,
  VANILLA_D_DOOMMAIN_INIT_ORDER,
  VANILLA_D_DOOMMAIN_INIT_ORDER_CONTRACT_AUDIT,
  VANILLA_D_DOOMMAIN_INIT_ORDER_CONTRACT_CLAUSE_COUNT,
  VANILLA_D_DOOMMAIN_INIT_ORDER_DERIVED_INVARIANTS,
  VANILLA_D_DOOMMAIN_INIT_ORDER_DERIVED_INVARIANT_COUNT,
  VANILLA_D_DOOMMAIN_INIT_ORDER_PROBES,
  VANILLA_D_DOOMMAIN_INIT_ORDER_PROBE_COUNT,
  VANILLA_D_DOOMMAIN_INIT_STEP_COUNT,
  VANILLA_D_DOOMMAIN_POST_BANNER_STEP_COUNT,
  VANILLA_D_DOOMMAIN_PRE_BANNER_STEP_COUNT,
  crossCheckVanillaDDoomMainInitOrder,
  deriveExpectedVanillaDDoomMainInitOrderResult,
} from '../../../src/bootstrap/implement-d-doommain-init-order-skeleton.ts';
import type { VanillaDDoomMainInitOrderHandler, VanillaDDoomMainInitOrderProbe, VanillaDDoomMainInitOrderResult, VanillaInitStep } from '../../../src/bootstrap/implement-d-doommain-init-order-skeleton.ts';

const STEP_FILE_RELATIVE_PATH = 'plan_vanilla_parity/steps/03-008-implement-d-doommain-init-order-skeleton.md';

const NULL_RESULT_FIELDS = Object.freeze({
  answeredSymbol: null,
  answeredIndex: null,
  answeredPresent: null,
  answeredStdoutLine: null,
  answeredPhase: null,
  answeredPrecedes: null,
  answeredCount: null,
}) satisfies VanillaDDoomMainInitOrderResult;

describe('VANILLA_D_DOOMMAIN_INIT_ORDER_CONTRACT_AUDIT ledger shape', () => {
  test('audits exactly twenty-one contract clauses for the D_DoomMain init-order skeleton', () => {
    expect(VANILLA_D_DOOMMAIN_INIT_ORDER_CONTRACT_AUDIT.length).toBe(21);
    expect(VANILLA_D_DOOMMAIN_INIT_ORDER_CONTRACT_AUDIT.length).toBe(VANILLA_D_DOOMMAIN_INIT_ORDER_CONTRACT_CLAUSE_COUNT);
  });

  test('every clause id is unique', () => {
    const ids = VANILLA_D_DOOMMAIN_INIT_ORDER_CONTRACT_AUDIT.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('every clause references d_main.c and pins D_DoomMain', () => {
    for (const entry of VANILLA_D_DOOMMAIN_INIT_ORDER_CONTRACT_AUDIT) {
      expect(entry.referenceSourceFile).toBe('d_main.c');
      expect(entry.cSymbol).toBe('D_DoomMain');
      expect(entry.invariant.length).toBeGreaterThan(0);
    }
  });

  test('declares the twenty-one contract ids the cross-check enforces', () => {
    const ids = new Set(VANILLA_D_DOOMMAIN_INIT_ORDER_CONTRACT_AUDIT.map((entry) => entry.id));
    expect(ids).toEqual(
      new Set([
        'INIT_SEQUENCE_HAS_TWELVE_VISIBLE_X_INIT_STEPS',
        'INIT_SEQUENCE_PARTITIONS_FOUR_PRE_BANNER_AND_EIGHT_POST_BANNER',
        'INIT_SEQUENCE_FIRST_STEP_IS_V_INIT_PRE_BANNER',
        'INIT_SEQUENCE_SECOND_STEP_IS_M_LOADDEFAULTS_PRE_BANNER',
        'INIT_SEQUENCE_THIRD_STEP_IS_Z_INIT_PRE_BANNER',
        'INIT_SEQUENCE_FOURTH_STEP_IS_W_INIT_PRE_BANNER',
        'INIT_SEQUENCE_FIFTH_STEP_IS_M_INIT_POST_BANNER',
        'INIT_SEQUENCE_SIXTH_STEP_IS_R_INIT_POST_BANNER',
        'INIT_SEQUENCE_SEVENTH_STEP_IS_P_INIT_POST_BANNER',
        'INIT_SEQUENCE_EIGHTH_STEP_IS_I_INIT_POST_BANNER',
        'INIT_SEQUENCE_NINTH_STEP_IS_D_CHECKNETGAME_POST_BANNER',
        'INIT_SEQUENCE_TENTH_STEP_IS_S_INIT_POST_BANNER',
        'INIT_SEQUENCE_ELEVENTH_STEP_IS_HU_INIT_POST_BANNER',
        'INIT_SEQUENCE_TWELFTH_STEP_IS_ST_INIT_POST_BANNER',
        'INIT_SEQUENCE_OMITS_OPL_INIT_PRESENT_ONLY_IN_CHOCOLATE',
        'INIT_SEQUENCE_OMITS_NET_INIT_PRESENT_ONLY_IN_CHOCOLATE',
        'INIT_SEQUENCE_OMITS_I_INITSTRETCHTABLES_PRESENT_ONLY_IN_CHOCOLATE',
        'INIT_SEQUENCE_PRINTS_VERBATIM_STDOUT_LITERAL_PER_STEP',
        'INIT_SEQUENCE_PRE_BANNER_REORDER_DIVERGES_FROM_CHOCOLATE_FIRST_THREE_STEPS',
        'INIT_SEQUENCE_I_INIT_FOLLOWS_P_INIT_DIVERGES_FROM_CHOCOLATE_AFTER_W_INIT',
        'INIT_SEQUENCE_D_CHECKNETGAME_PRECEDES_S_INIT_DIVERGES_FROM_CHOCOLATE',
      ]),
    );
  });

  test('the INIT_SEQUENCE_HAS_TWELVE_VISIBLE_X_INIT_STEPS clause names every pinned C symbol', () => {
    const entry = VANILLA_D_DOOMMAIN_INIT_ORDER_CONTRACT_AUDIT.find((clause) => clause.id === 'INIT_SEQUENCE_HAS_TWELVE_VISIBLE_X_INIT_STEPS');
    expect(entry).toBeDefined();
    for (const symbol of ['V_Init', 'M_LoadDefaults', 'Z_Init', 'W_Init', 'M_Init', 'R_Init', 'P_Init', 'I_Init', 'D_CheckNetGame', 'S_Init', 'HU_Init', 'ST_Init']) {
      expect(entry!.invariant).toContain(symbol);
    }
  });

  test('the INIT_SEQUENCE_PARTITIONS_FOUR_PRE_BANNER_AND_EIGHT_POST_BANNER clause cites the 4 + 8 split', () => {
    const entry = VANILLA_D_DOOMMAIN_INIT_ORDER_CONTRACT_AUDIT.find((clause) => clause.id === 'INIT_SEQUENCE_PARTITIONS_FOUR_PRE_BANNER_AND_EIGHT_POST_BANNER');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('four-step pre-banner phase');
    expect(entry!.invariant).toContain('eight-step post-banner phase');
    expect(entry!.invariant).toContain('banner block');
  });

  test('the INIT_SEQUENCE_FIRST_STEP_IS_V_INIT_PRE_BANNER clause cites the verbatim V_Init printf line', () => {
    const entry = VANILLA_D_DOOMMAIN_INIT_ORDER_CONTRACT_AUDIT.find((clause) => clause.id === 'INIT_SEQUENCE_FIRST_STEP_IS_V_INIT_PRE_BANNER');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('V_Init: allocate screens.');
    expect(entry!.invariant).toContain('Chocolate Doom 2.2.1');
  });

  test('the INIT_SEQUENCE_THIRD_STEP_IS_Z_INIT_PRE_BANNER clause cites the trailing-space idiosyncrasy', () => {
    const entry = VANILLA_D_DOOMMAIN_INIT_ORDER_CONTRACT_AUDIT.find((clause) => clause.id === 'INIT_SEQUENCE_THIRD_STEP_IS_Z_INIT_PRE_BANNER');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('trailing space');
    expect(entry!.invariant).toContain('Z_Init: Init zone memory allocation daemon.');
  });

  test('the INIT_SEQUENCE_FOURTH_STEP_IS_W_INIT_PRE_BANNER clause distinguishes the print label from the called function', () => {
    const entry = VANILLA_D_DOOMMAIN_INIT_ORDER_CONTRACT_AUDIT.find((clause) => clause.id === 'INIT_SEQUENCE_FOURTH_STEP_IS_W_INIT_PRE_BANNER');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('W_Init: Init WADfiles.');
    expect(entry!.invariant).toContain('W_InitMultipleFiles');
    expect(entry!.invariant).toContain('printed label');
  });

  test('the INIT_SEQUENCE_SEVENTH_STEP_IS_P_INIT_POST_BANNER clause cites the leading-newline idiosyncrasy', () => {
    const entry = VANILLA_D_DOOMMAIN_INIT_ORDER_CONTRACT_AUDIT.find((clause) => clause.id === 'INIT_SEQUENCE_SEVENTH_STEP_IS_P_INIT_POST_BANNER');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('leading newline');
    expect(entry!.invariant).toContain('R_Init');
  });

  test('the INIT_SEQUENCE_EIGHTH_STEP_IS_I_INIT_POST_BANNER clause cites the divergence from Chocolate', () => {
    const entry = VANILLA_D_DOOMMAIN_INIT_ORDER_CONTRACT_AUDIT.find((clause) => clause.id === 'INIT_SEQUENCE_EIGHTH_STEP_IS_I_INIT_POST_BANNER');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('I_Init follows P_Init');
    expect(entry!.invariant).toContain('major divergence');
    expect(entry!.invariant).toContain('Chocolate');
  });

  test('the OMITS_OPL_INIT clause cites the SDL music synthesis context', () => {
    const entry = VANILLA_D_DOOMMAIN_INIT_ORDER_CONTRACT_AUDIT.find((clause) => clause.id === 'INIT_SEQUENCE_OMITS_OPL_INIT_PRESENT_ONLY_IN_CHOCOLATE');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('OPL2/OPL3');
    expect(entry!.invariant).toContain('SDL');
    expect(entry!.invariant).toContain('Chocolate Doom 2.2.1');
  });

  test('the OMITS_NET_INIT clause cites the chocolate-doom net-server discovery layer', () => {
    const entry = VANILLA_D_DOOMMAIN_INIT_ORDER_CONTRACT_AUDIT.find((clause) => clause.id === 'INIT_SEQUENCE_OMITS_NET_INIT_PRESENT_ONLY_IN_CHOCOLATE');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('net-server');
    expect(entry!.invariant).toContain('NET_Init: Init network subsystem.');
  });

  test('the OMITS_I_INITSTRETCHTABLES clause cites the 320×200 to 4:3-stretched aspect adapter', () => {
    const entry = VANILLA_D_DOOMMAIN_INIT_ORDER_CONTRACT_AUDIT.find((clause) => clause.id === 'INIT_SEQUENCE_OMITS_I_INITSTRETCHTABLES_PRESENT_ONLY_IN_CHOCOLATE');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('aspect-stretch');
    expect(entry!.invariant).toContain('320×200');
    expect(entry!.invariant).toContain('I_InitStretchTables');
  });

  test('the PRINTS_VERBATIM_STDOUT_LITERAL_PER_STEP clause names every literal', () => {
    const entry = VANILLA_D_DOOMMAIN_INIT_ORDER_CONTRACT_AUDIT.find((clause) => clause.id === 'INIT_SEQUENCE_PRINTS_VERBATIM_STDOUT_LITERAL_PER_STEP');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('V_Init: allocate screens.');
    expect(entry!.invariant).toContain('M_LoadDefaults: Load system defaults.');
    expect(entry!.invariant).toContain('Z_Init: Init zone memory allocation daemon.');
    expect(entry!.invariant).toContain('W_Init: Init WADfiles.');
    expect(entry!.invariant).toContain('M_Init: Init miscellaneous info.');
    expect(entry!.invariant).toContain('R_Init: Init DOOM refresh daemon - ');
    expect(entry!.invariant).toContain('P_Init: Init Playloop state.');
    expect(entry!.invariant).toContain('I_Init: Setting up machine state.');
    expect(entry!.invariant).toContain('D_CheckNetGame: Checking network game status.');
    expect(entry!.invariant).toContain('S_Init: Setting up sound.');
    expect(entry!.invariant).toContain('HU_Init: Setting up heads up display.');
    expect(entry!.invariant).toContain('ST_Init: Init status bar.');
  });

  test('the PRE_BANNER_REORDER_DIVERGES_FROM_CHOCOLATE_FIRST_THREE_STEPS clause names both orderings', () => {
    const entry = VANILLA_D_DOOMMAIN_INIT_ORDER_CONTRACT_AUDIT.find((clause) => clause.id === 'INIT_SEQUENCE_PRE_BANNER_REORDER_DIVERGES_FROM_CHOCOLATE_FIRST_THREE_STEPS');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('V_Init → M_LoadDefaults → Z_Init');
    expect(entry!.invariant).toContain('Z_Init → V_Init → M_LoadDefaults');
  });

  test('the I_INIT_FOLLOWS_P_INIT_DIVERGES_FROM_CHOCOLATE_AFTER_W_INIT clause cites the position swap', () => {
    const entry = VANILLA_D_DOOMMAIN_INIT_ORDER_CONTRACT_AUDIT.find((clause) => clause.id === 'INIT_SEQUENCE_I_INIT_FOLLOWS_P_INIT_DIVERGES_FROM_CHOCOLATE_AFTER_W_INIT');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('AFTER P_Init');
    expect(entry!.invariant).toContain('AFTER W_Init');
    expect(entry!.invariant).toContain('I_Init→D_CheckNetGame→S_Init');
  });

  test('the D_CHECKNETGAME_PRECEDES_S_INIT_DIVERGES_FROM_CHOCOLATE clause cites the swap', () => {
    const entry = VANILLA_D_DOOMMAIN_INIT_ORDER_CONTRACT_AUDIT.find((clause) => clause.id === 'INIT_SEQUENCE_D_CHECKNETGAME_PRECEDES_S_INIT_DIVERGES_FROM_CHOCOLATE');
    expect(entry).toBeDefined();
    expect(entry!.invariant).toContain('BEFORE');
    expect(entry!.invariant).toContain('AFTER');
    expect(entry!.invariant).toContain('Chocolate Doom 2.2.1');
  });
});

describe('VANILLA_D_DOOMMAIN_INIT_ORDER canonical sequence', () => {
  test('has exactly twelve entries', () => {
    expect(VANILLA_D_DOOMMAIN_INIT_ORDER.length).toBe(12);
    expect(VANILLA_D_DOOMMAIN_INIT_ORDER.length).toBe(VANILLA_D_DOOMMAIN_INIT_STEP_COUNT);
  });

  test('partitions into 4 pre-banner steps and 8 post-banner steps', () => {
    const preBanner = VANILLA_D_DOOMMAIN_INIT_ORDER.filter((step) => step.phase === 'pre-banner');
    const postBanner = VANILLA_D_DOOMMAIN_INIT_ORDER.filter((step) => step.phase === 'post-banner');
    expect(preBanner.length).toBe(4);
    expect(preBanner.length).toBe(VANILLA_D_DOOMMAIN_PRE_BANNER_STEP_COUNT);
    expect(postBanner.length).toBe(8);
    expect(postBanner.length).toBe(VANILLA_D_DOOMMAIN_POST_BANNER_STEP_COUNT);
  });

  test('orders the canonical 12-step sequence verbatim', () => {
    expect(VANILLA_D_DOOMMAIN_INIT_ORDER.map((step) => step.cSymbol)).toEqual(['V_Init', 'M_LoadDefaults', 'Z_Init', 'W_Init', 'M_Init', 'R_Init', 'P_Init', 'I_Init', 'D_CheckNetGame', 'S_Init', 'HU_Init', 'ST_Init']);
  });

  test('positions every step at the canonical 0-based index', () => {
    for (let index = 0; index < VANILLA_D_DOOMMAIN_INIT_ORDER.length; index++) {
      expect(VANILLA_D_DOOMMAIN_INIT_ORDER[index]!.index).toBe(index);
    }
  });

  test('classifies every pre-banner step before every post-banner step (no interleaving)', () => {
    let sawPostBanner = false;
    for (const step of VANILLA_D_DOOMMAIN_INIT_ORDER) {
      if (step.phase === 'post-banner') sawPostBanner = true;
      if (step.phase === 'pre-banner') expect(sawPostBanner).toBe(false);
    }
  });

  test('pins the verbatim Z_Init stdout literal with trailing space', () => {
    const zInit = VANILLA_D_DOOMMAIN_INIT_ORDER.find((step) => step.cSymbol === 'Z_Init');
    expect(zInit).toBeDefined();
    expect(zInit!.stdoutLine).toBe('Z_Init: Init zone memory allocation daemon. \n');
    expect(zInit!.stdoutLine.includes('. \n')).toBe(true);
  });

  test('pins the verbatim R_Init stdout literal with no trailing newline', () => {
    const rInit = VANILLA_D_DOOMMAIN_INIT_ORDER.find((step) => step.cSymbol === 'R_Init');
    expect(rInit).toBeDefined();
    expect(rInit!.stdoutLine).toBe('R_Init: Init DOOM refresh daemon - ');
    expect(rInit!.stdoutLine.endsWith('\n')).toBe(false);
  });

  test('pins the verbatim P_Init stdout literal with leading newline', () => {
    const pInit = VANILLA_D_DOOMMAIN_INIT_ORDER.find((step) => step.cSymbol === 'P_Init');
    expect(pInit).toBeDefined();
    expect(pInit!.stdoutLine).toBe('\nP_Init: Init Playloop state.\n');
    expect(pInit!.stdoutLine.startsWith('\n')).toBe(true);
  });

  test('pins the verbatim ST_Init stdout literal as the terminal init line', () => {
    const stInit = VANILLA_D_DOOMMAIN_INIT_ORDER[VANILLA_D_DOOMMAIN_INIT_ORDER.length - 1]!;
    expect(stInit.cSymbol).toBe('ST_Init');
    expect(stInit.stdoutLine).toBe('ST_Init: Init status bar.\n');
    expect(stInit.index).toBe(11);
  });

  test('every step has a non-empty C symbol and stdout literal', () => {
    for (const step of VANILLA_D_DOOMMAIN_INIT_ORDER) {
      expect(step.cSymbol.length).toBeGreaterThan(0);
      expect(step.stdoutLine.length).toBeGreaterThan(0);
    }
  });

  test('classifies pre-banner steps as the first four entries', () => {
    expect(VANILLA_D_DOOMMAIN_INIT_ORDER.slice(0, 4).every((step) => step.phase === 'pre-banner')).toBe(true);
  });

  test('classifies post-banner steps as the last eight entries', () => {
    expect(VANILLA_D_DOOMMAIN_INIT_ORDER.slice(4).every((step) => step.phase === 'post-banner')).toBe(true);
  });

  test('places I_Init after P_Init (the vanilla-only divergence from Chocolate)', () => {
    const iInit = VANILLA_D_DOOMMAIN_INIT_ORDER.find((step) => step.cSymbol === 'I_Init')!;
    const pInit = VANILLA_D_DOOMMAIN_INIT_ORDER.find((step) => step.cSymbol === 'P_Init')!;
    expect(iInit.index).toBe(7);
    expect(pInit.index).toBe(6);
    expect(iInit.index).toBeGreaterThan(pInit.index);
  });

  test('places D_CheckNetGame before S_Init (the vanilla-only divergence from Chocolate)', () => {
    const dCheckNetGame = VANILLA_D_DOOMMAIN_INIT_ORDER.find((step) => step.cSymbol === 'D_CheckNetGame')!;
    const sInit = VANILLA_D_DOOMMAIN_INIT_ORDER.find((step) => step.cSymbol === 'S_Init')!;
    expect(dCheckNetGame.index).toBe(8);
    expect(sInit.index).toBe(9);
    expect(dCheckNetGame.index).toBeLessThan(sInit.index);
  });

  test('places M_LoadDefaults before Z_Init (the vanilla-only pre-banner reorder vs Chocolate)', () => {
    const mLoadDefaults = VANILLA_D_DOOMMAIN_INIT_ORDER.find((step) => step.cSymbol === 'M_LoadDefaults')!;
    const zInit = VANILLA_D_DOOMMAIN_INIT_ORDER.find((step) => step.cSymbol === 'Z_Init')!;
    expect(mLoadDefaults.index).toBe(1);
    expect(zInit.index).toBe(2);
    expect(mLoadDefaults.index).toBeLessThan(zInit.index);
  });
});

describe('VANILLA_D_DOOMMAIN_ABSENT_CHOCOLATE_SYMBOLS list', () => {
  test('has exactly three Chocolate-only symbols', () => {
    expect(VANILLA_D_DOOMMAIN_ABSENT_CHOCOLATE_SYMBOLS.length).toBe(3);
    expect(VANILLA_D_DOOMMAIN_ABSENT_CHOCOLATE_SYMBOLS.length).toBe(VANILLA_D_DOOMMAIN_ABSENT_CHOCOLATE_SYMBOL_COUNT);
  });

  test('lists OPL_Init, NET_Init, and I_InitStretchTables', () => {
    expect([...VANILLA_D_DOOMMAIN_ABSENT_CHOCOLATE_SYMBOLS]).toEqual(['OPL_Init', 'NET_Init', 'I_InitStretchTables']);
  });

  test('every absent symbol is missing from the canonical init order', () => {
    const presentSymbols = new Set(VANILLA_D_DOOMMAIN_INIT_ORDER.map((step) => step.cSymbol));
    for (const absentSymbol of VANILLA_D_DOOMMAIN_ABSENT_CHOCOLATE_SYMBOLS) {
      expect(presentSymbols.has(absentSymbol as VanillaInitStep['cSymbol'])).toBe(false);
    }
  });
});

describe('VANILLA_D_DOOMMAIN_INIT_ORDER_DERIVED_INVARIANTS list', () => {
  test('has exactly twelve derived invariants', () => {
    expect(VANILLA_D_DOOMMAIN_INIT_ORDER_DERIVED_INVARIANTS.length).toBe(12);
    expect(VANILLA_D_DOOMMAIN_INIT_ORDER_DERIVED_INVARIANTS.length).toBe(VANILLA_D_DOOMMAIN_INIT_ORDER_DERIVED_INVARIANT_COUNT);
  });

  test('every invariant id is unique', () => {
    const ids = VANILLA_D_DOOMMAIN_INIT_ORDER_DERIVED_INVARIANTS.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('every invariant declares a non-empty description', () => {
    for (const entry of VANILLA_D_DOOMMAIN_INIT_ORDER_DERIVED_INVARIANTS) {
      expect(entry.id.length).toBeGreaterThan(0);
      expect(entry.description.length).toBeGreaterThan(0);
    }
  });
});

describe('VANILLA_D_DOOMMAIN_INIT_ORDER_PROBES probe set', () => {
  test('has exactly twenty-nine pinned probes', () => {
    expect(VANILLA_D_DOOMMAIN_INIT_ORDER_PROBES.length).toBe(29);
    expect(VANILLA_D_DOOMMAIN_INIT_ORDER_PROBES.length).toBe(VANILLA_D_DOOMMAIN_INIT_ORDER_PROBE_COUNT);
  });

  test('every probe id is unique', () => {
    const ids = VANILLA_D_DOOMMAIN_INIT_ORDER_PROBES.map((probe) => probe.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('every probe declares one expected answer field consistent with its query kind', () => {
    for (const probe of VANILLA_D_DOOMMAIN_INIT_ORDER_PROBES) {
      switch (probe.queryKind) {
        case 'symbol-at-index':
          expect(probe.queryIndex).not.toBeNull();
          expect(probe.expectedAnsweredSymbol).not.toBeNull();
          break;
        case 'index-of-symbol':
          expect(probe.querySymbol).not.toBeNull();
          expect(probe.expectedAnsweredIndex).not.toBeNull();
          break;
        case 'symbol-presence':
          expect(probe.querySymbol).not.toBeNull();
          expect(probe.expectedAnsweredPresent).not.toBeNull();
          break;
        case 'symbol-stdout-line':
          expect(probe.querySymbol).not.toBeNull();
          expect(probe.expectedAnsweredStdoutLine).not.toBeNull();
          break;
        case 'symbol-phase':
          expect(probe.querySymbol).not.toBeNull();
          expect(probe.expectedAnsweredPhase).not.toBeNull();
          break;
        case 'symbol-precedes':
          expect(probe.queryEarlierSymbol).not.toBeNull();
          expect(probe.queryLaterSymbol).not.toBeNull();
          expect(probe.expectedAnsweredPrecedes).not.toBeNull();
          break;
        case 'sequence-length':
        case 'pre-banner-step-count':
        case 'post-banner-step-count':
          expect(probe.expectedAnsweredCount).not.toBeNull();
          break;
      }
    }
  });

  test('every witness invariant id refers to a declared derived invariant', () => {
    const declaredInvariantIds = new Set(VANILLA_D_DOOMMAIN_INIT_ORDER_DERIVED_INVARIANTS.map((entry) => entry.id));
    for (const probe of VANILLA_D_DOOMMAIN_INIT_ORDER_PROBES) {
      expect(declaredInvariantIds.has(probe.witnessInvariantId)).toBe(true);
    }
  });
});

describe('REFERENCE_VANILLA_D_DOOMMAIN_INIT_ORDER_HANDLER cross-check', () => {
  test('passes every probe with zero failures', () => {
    expect(crossCheckVanillaDDoomMainInitOrder(REFERENCE_VANILLA_D_DOOMMAIN_INIT_ORDER_HANDLER)).toEqual([]);
  });

  test('answers symbol-at-index probes with the canonical symbol', () => {
    for (const probe of VANILLA_D_DOOMMAIN_INIT_ORDER_PROBES) {
      if (probe.queryKind !== 'symbol-at-index') continue;
      const result = REFERENCE_VANILLA_D_DOOMMAIN_INIT_ORDER_HANDLER.runProbe(probe);
      expect(result.answeredSymbol).toBe(probe.expectedAnsweredSymbol);
      expect(result.answeredIndex).toBeNull();
      expect(result.answeredPresent).toBeNull();
    }
  });

  test('answers symbol-presence probes correctly', () => {
    for (const probe of VANILLA_D_DOOMMAIN_INIT_ORDER_PROBES) {
      if (probe.queryKind !== 'symbol-presence') continue;
      const result = REFERENCE_VANILLA_D_DOOMMAIN_INIT_ORDER_HANDLER.runProbe(probe);
      expect(result.answeredPresent).toBe(probe.expectedAnsweredPresent);
    }
  });

  test('answers symbol-stdout-line probes with the verbatim literal', () => {
    for (const probe of VANILLA_D_DOOMMAIN_INIT_ORDER_PROBES) {
      if (probe.queryKind !== 'symbol-stdout-line') continue;
      const result = REFERENCE_VANILLA_D_DOOMMAIN_INIT_ORDER_HANDLER.runProbe(probe);
      expect(result.answeredStdoutLine).toBe(probe.expectedAnsweredStdoutLine);
    }
  });

  test('answers symbol-phase probes with pre-banner or post-banner', () => {
    for (const probe of VANILLA_D_DOOMMAIN_INIT_ORDER_PROBES) {
      if (probe.queryKind !== 'symbol-phase') continue;
      const result = REFERENCE_VANILLA_D_DOOMMAIN_INIT_ORDER_HANDLER.runProbe(probe);
      expect(result.answeredPhase).toBe(probe.expectedAnsweredPhase);
    }
  });

  test('answers symbol-precedes probes with true/false', () => {
    for (const probe of VANILLA_D_DOOMMAIN_INIT_ORDER_PROBES) {
      if (probe.queryKind !== 'symbol-precedes') continue;
      const result = REFERENCE_VANILLA_D_DOOMMAIN_INIT_ORDER_HANDLER.runProbe(probe);
      expect(result.answeredPrecedes).toBe(probe.expectedAnsweredPrecedes);
    }
  });

  test('answers sequence-length with 12', () => {
    for (const probe of VANILLA_D_DOOMMAIN_INIT_ORDER_PROBES) {
      if (probe.queryKind !== 'sequence-length') continue;
      const result = REFERENCE_VANILLA_D_DOOMMAIN_INIT_ORDER_HANDLER.runProbe(probe);
      expect(result.answeredCount).toBe(12);
    }
  });

  test('answers index-of-symbol probes correctly', () => {
    for (const probe of VANILLA_D_DOOMMAIN_INIT_ORDER_PROBES) {
      if (probe.queryKind !== 'index-of-symbol') continue;
      const result = REFERENCE_VANILLA_D_DOOMMAIN_INIT_ORDER_HANDLER.runProbe(probe);
      expect(result.answeredIndex).toBe(probe.expectedAnsweredIndex);
    }
  });
});

describe('crossCheckVanillaDDoomMainInitOrder failure modes', () => {
  test('detects a handler that places Z_Init at index 0 (Chocolate-style first step)', () => {
    const chocolateStyleFirstStep: VanillaDDoomMainInitOrderHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_D_DOOMMAIN_INIT_ORDER_HANDLER.runProbe(probe);
        if (probe.queryKind === 'symbol-at-index' && probe.queryIndex === 0) {
          return Object.freeze({ ...inner, answeredSymbol: 'Z_Init' });
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaDDoomMainInitOrder(chocolateStyleFirstStep);
    expect(failures.some((failure) => failure.startsWith('probe:index-zero-is-v-init:answeredSymbol:value-mismatch'))).toBe(true);
  });

  test('detects a handler that schedules I_Init at index 4 (Chocolate-style I_Init position)', () => {
    const chocolateStyleIInit: VanillaDDoomMainInitOrderHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_D_DOOMMAIN_INIT_ORDER_HANDLER.runProbe(probe);
        if (probe.queryKind === 'symbol-at-index' && probe.queryIndex === 7) {
          return Object.freeze({ ...inner, answeredSymbol: 'M_Init' });
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaDDoomMainInitOrder(chocolateStyleIInit);
    expect(failures.some((failure) => failure.startsWith('probe:index-seven-is-i-init:answeredSymbol:value-mismatch'))).toBe(true);
  });

  test('detects a handler that swaps D_CheckNetGame and S_Init (Chocolate-style ordering)', () => {
    const swappedDCheckSInit: VanillaDDoomMainInitOrderHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_D_DOOMMAIN_INIT_ORDER_HANDLER.runProbe(probe);
        if (probe.queryKind === 'symbol-precedes' && probe.queryEarlierSymbol === 'D_CheckNetGame' && probe.queryLaterSymbol === 'S_Init') {
          return Object.freeze({ ...inner, answeredPrecedes: false });
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaDDoomMainInitOrder(swappedDCheckSInit);
    expect(failures.some((failure) => failure.startsWith('probe:d-checknetgame-precedes-s-init:answeredPrecedes:value-mismatch'))).toBe(true);
  });

  test('detects a handler that includes OPL_Init in the init order', () => {
    const includesOplInit: VanillaDDoomMainInitOrderHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_D_DOOMMAIN_INIT_ORDER_HANDLER.runProbe(probe);
        if (probe.queryKind === 'symbol-presence' && probe.querySymbol === 'OPL_Init') {
          return Object.freeze({ ...inner, answeredPresent: true });
        }
        if (probe.queryKind === 'index-of-symbol' && probe.querySymbol === 'OPL_Init') {
          return Object.freeze({ ...inner, answeredIndex: 5 });
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaDDoomMainInitOrder(includesOplInit);
    expect(failures.some((failure) => failure.startsWith('probe:opl-init-is-absent:answeredPresent:value-mismatch'))).toBe(true);
    expect(failures.some((failure) => failure.startsWith('probe:opl-init-index-is-minus-one:answeredIndex:value-mismatch'))).toBe(true);
  });

  test('detects a handler that includes NET_Init in the init order', () => {
    const includesNetInit: VanillaDDoomMainInitOrderHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_D_DOOMMAIN_INIT_ORDER_HANDLER.runProbe(probe);
        if (probe.queryKind === 'symbol-presence' && probe.querySymbol === 'NET_Init') {
          return Object.freeze({ ...inner, answeredPresent: true });
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaDDoomMainInitOrder(includesNetInit);
    expect(failures.some((failure) => failure.startsWith('probe:net-init-is-absent:answeredPresent:value-mismatch'))).toBe(true);
  });

  test('detects a handler that appends I_InitStretchTables after ST_Init', () => {
    const appendsStretchTables: VanillaDDoomMainInitOrderHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_D_DOOMMAIN_INIT_ORDER_HANDLER.runProbe(probe);
        if (probe.queryKind === 'symbol-presence' && probe.querySymbol === 'I_InitStretchTables') {
          return Object.freeze({ ...inner, answeredPresent: true });
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaDDoomMainInitOrder(appendsStretchTables);
    expect(failures.some((failure) => failure.startsWith('probe:i-initstretchtables-is-absent:answeredPresent:value-mismatch'))).toBe(true);
  });

  test('detects a handler that drops the trailing space on the Z_Init stdout literal', () => {
    const dropsTrailingSpace: VanillaDDoomMainInitOrderHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_D_DOOMMAIN_INIT_ORDER_HANDLER.runProbe(probe);
        if (probe.queryKind === 'symbol-stdout-line' && probe.querySymbol === 'Z_Init') {
          return Object.freeze({ ...inner, answeredStdoutLine: 'Z_Init: Init zone memory allocation daemon.\n' });
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaDDoomMainInitOrder(dropsTrailingSpace);
    expect(failures.some((failure) => failure.startsWith('probe:z-init-stdout-includes-trailing-space:answeredStdoutLine:value-mismatch'))).toBe(true);
  });

  test('detects a handler that adds a trailing newline to the R_Init stdout literal', () => {
    const addsTrailingNewline: VanillaDDoomMainInitOrderHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_D_DOOMMAIN_INIT_ORDER_HANDLER.runProbe(probe);
        if (probe.queryKind === 'symbol-stdout-line' && probe.querySymbol === 'R_Init') {
          return Object.freeze({ ...inner, answeredStdoutLine: 'R_Init: Init DOOM refresh daemon - \n' });
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaDDoomMainInitOrder(addsTrailingNewline);
    expect(failures.some((failure) => failure.startsWith('probe:r-init-stdout-omits-trailing-newline:answeredStdoutLine:value-mismatch'))).toBe(true);
  });

  test('detects a handler that drops the leading newline from the P_Init stdout literal', () => {
    const dropsLeadingNewline: VanillaDDoomMainInitOrderHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_D_DOOMMAIN_INIT_ORDER_HANDLER.runProbe(probe);
        if (probe.queryKind === 'symbol-stdout-line' && probe.querySymbol === 'P_Init') {
          return Object.freeze({ ...inner, answeredStdoutLine: 'P_Init: Init Playloop state.\n' });
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaDDoomMainInitOrder(dropsLeadingNewline);
    expect(failures.some((failure) => failure.startsWith('probe:p-init-stdout-includes-leading-newline:answeredStdoutLine:value-mismatch'))).toBe(true);
  });

  test('detects a handler that misclassifies V_Init as post-banner', () => {
    const wrongPhase: VanillaDDoomMainInitOrderHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_D_DOOMMAIN_INIT_ORDER_HANDLER.runProbe(probe);
        if (probe.queryKind === 'symbol-phase' && probe.querySymbol === 'V_Init') {
          return Object.freeze({ ...inner, answeredPhase: 'post-banner' });
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaDDoomMainInitOrder(wrongPhase);
    expect(failures.some((failure) => failure.startsWith('probe:v-init-phase-is-pre-banner:answeredPhase:value-mismatch'))).toBe(true);
  });

  test('detects a handler that reports sequence-length as 15 (Chocolate count)', () => {
    const chocolateLength: VanillaDDoomMainInitOrderHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_D_DOOMMAIN_INIT_ORDER_HANDLER.runProbe(probe);
        if (probe.queryKind === 'sequence-length') {
          return Object.freeze({ ...inner, answeredCount: 15 });
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaDDoomMainInitOrder(chocolateLength);
    expect(failures.some((failure) => failure.startsWith('probe:sequence-length-is-twelve:answeredCount:value-mismatch'))).toBe(true);
  });

  test('detects a handler that reports pre-banner-step-count as 3 (Chocolate-style 3 + 12)', () => {
    const wrongPreBannerCount: VanillaDDoomMainInitOrderHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_D_DOOMMAIN_INIT_ORDER_HANDLER.runProbe(probe);
        if (probe.queryKind === 'pre-banner-step-count') {
          return Object.freeze({ ...inner, answeredCount: 3 });
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaDDoomMainInitOrder(wrongPreBannerCount);
    expect(failures.some((failure) => failure.startsWith('probe:pre-banner-step-count-is-four:answeredCount:value-mismatch'))).toBe(true);
  });

  test('detects a handler that swaps M_LoadDefaults and Z_Init (Chocolate pre-banner reorder)', () => {
    const chocolatePreBanner: VanillaDDoomMainInitOrderHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_D_DOOMMAIN_INIT_ORDER_HANDLER.runProbe(probe);
        if (probe.queryKind === 'symbol-at-index' && probe.queryIndex === 1) {
          return Object.freeze({ ...inner, answeredSymbol: 'Z_Init' });
        }
        if (probe.queryKind === 'symbol-at-index' && probe.queryIndex === 2) {
          return Object.freeze({ ...inner, answeredSymbol: 'M_LoadDefaults' });
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaDDoomMainInitOrder(chocolatePreBanner);
    expect(failures.some((failure) => failure.startsWith('probe:index-one-is-m-loaddefaults:answeredSymbol:value-mismatch'))).toBe(true);
    expect(failures.some((failure) => failure.startsWith('probe:index-two-is-z-init:answeredSymbol:value-mismatch'))).toBe(true);
  });

  test('detects a handler that places ST_Init before HU_Init', () => {
    const reorderedTail: VanillaDDoomMainInitOrderHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_D_DOOMMAIN_INIT_ORDER_HANDLER.runProbe(probe);
        if (probe.queryKind === 'symbol-at-index' && probe.queryIndex === 11) {
          return Object.freeze({ ...inner, answeredSymbol: 'HU_Init' });
        }
        if (probe.queryKind === 'index-of-symbol' && probe.querySymbol === 'ST_Init') {
          return Object.freeze({ ...inner, answeredIndex: 10 });
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaDDoomMainInitOrder(reorderedTail);
    expect(failures.some((failure) => failure.startsWith('probe:index-eleven-is-st-init:answeredSymbol:value-mismatch'))).toBe(true);
    expect(failures.some((failure) => failure.startsWith('probe:st-init-index-is-eleven:answeredIndex:value-mismatch'))).toBe(true);
  });

  test('detects a handler that reports OPL_Init as preceding ST_Init', () => {
    const oplPrecedesSt: VanillaDDoomMainInitOrderHandler = {
      runProbe: (probe) => {
        const inner = REFERENCE_VANILLA_D_DOOMMAIN_INIT_ORDER_HANDLER.runProbe(probe);
        if (probe.queryKind === 'symbol-precedes' && probe.queryEarlierSymbol === 'OPL_Init' && probe.queryLaterSymbol === 'ST_Init') {
          return Object.freeze({ ...inner, answeredPrecedes: true });
        }
        return inner;
      },
    };
    const failures = crossCheckVanillaDDoomMainInitOrder(oplPrecedesSt);
    expect(failures.some((failure) => failure.startsWith('probe:opl-init-precedence-against-st-init-is-false:answeredPrecedes:value-mismatch'))).toBe(true);
  });
});

describe('deriveExpectedVanillaDDoomMainInitOrderResult helper', () => {
  test('matches the canonical answer for every pinned probe', () => {
    for (const probe of VANILLA_D_DOOMMAIN_INIT_ORDER_PROBES) {
      const expected = deriveExpectedVanillaDDoomMainInitOrderResult(probe);
      const actual = REFERENCE_VANILLA_D_DOOMMAIN_INIT_ORDER_HANDLER.runProbe(probe);
      expect(actual).toEqual(expected);
    }
  });

  test('answers symbol-at-index for an out-of-range index by returning null answeredSymbol', () => {
    const outOfRangeProbe: VanillaDDoomMainInitOrderProbe = {
      id: 'derive-out-of-range',
      description: 'Synthetic probe used to verify out-of-range handling outside the pinned probe set.',
      queryKind: 'symbol-at-index',
      queryIndex: 99,
      querySymbol: null,
      queryEarlierSymbol: null,
      queryLaterSymbol: null,
      expectedAnsweredSymbol: null,
      expectedAnsweredIndex: null,
      expectedAnsweredPresent: null,
      expectedAnsweredStdoutLine: null,
      expectedAnsweredPhase: null,
      expectedAnsweredPrecedes: null,
      expectedAnsweredCount: null,
      witnessInvariantId: 'INIT_SEQUENCE_HAS_EXACTLY_TWELVE_STEPS',
    };
    const result = deriveExpectedVanillaDDoomMainInitOrderResult(outOfRangeProbe);
    expect(result.answeredSymbol).toBeNull();
  });

  test('answers index-of-symbol with -1 for an unrecognised symbol', () => {
    const unknownSymbolProbe: VanillaDDoomMainInitOrderProbe = {
      id: 'derive-unknown-symbol',
      description: 'Synthetic probe for an unrecognised symbol.',
      queryKind: 'index-of-symbol',
      queryIndex: null,
      querySymbol: 'Foo_Init',
      queryEarlierSymbol: null,
      queryLaterSymbol: null,
      expectedAnsweredSymbol: null,
      expectedAnsweredIndex: -1,
      expectedAnsweredPresent: null,
      expectedAnsweredStdoutLine: null,
      expectedAnsweredPhase: null,
      expectedAnsweredPrecedes: null,
      expectedAnsweredCount: null,
      witnessInvariantId: 'INIT_SEQUENCE_HAS_EXACTLY_TWELVE_STEPS',
    };
    const result = deriveExpectedVanillaDDoomMainInitOrderResult(unknownSymbolProbe);
    expect(result.answeredIndex).toBe(-1);
  });

  test('answers symbol-precedes with false when one or both symbols are absent', () => {
    const absentEarlierProbe: VanillaDDoomMainInitOrderProbe = {
      id: 'derive-absent-earlier',
      description: 'Synthetic probe for a precedence query with an absent earlier symbol.',
      queryKind: 'symbol-precedes',
      queryIndex: null,
      querySymbol: null,
      queryEarlierSymbol: 'Foo_Init',
      queryLaterSymbol: 'V_Init',
      expectedAnsweredSymbol: null,
      expectedAnsweredIndex: null,
      expectedAnsweredPresent: null,
      expectedAnsweredStdoutLine: null,
      expectedAnsweredPhase: null,
      expectedAnsweredPrecedes: false,
      expectedAnsweredCount: null,
      witnessInvariantId: 'INIT_SEQUENCE_HAS_EXACTLY_TWELVE_STEPS',
    };
    const result = deriveExpectedVanillaDDoomMainInitOrderResult(absentEarlierProbe);
    expect(result.answeredPrecedes).toBe(false);
  });
});

describe('vanilla DOOM 1.9 D_DoomMain init order matches the linuxdoom-1.10 stdout fingerprint', () => {
  test('emits exactly twelve init lines covering the canonical symbols in order', () => {
    const stdoutLines = VANILLA_D_DOOMMAIN_INIT_ORDER.map((step) => step.stdoutLine);
    expect(stdoutLines.length).toBe(12);
    const reconstructed = stdoutLines.join('');
    expect(reconstructed).toContain('V_Init: allocate screens.');
    expect(reconstructed).toContain('M_LoadDefaults: Load system defaults.');
    expect(reconstructed).toContain('Z_Init: Init zone memory allocation daemon. ');
    expect(reconstructed).toContain('W_Init: Init WADfiles.');
    expect(reconstructed).toContain('M_Init: Init miscellaneous info.');
    expect(reconstructed).toContain('R_Init: Init DOOM refresh daemon - ');
    expect(reconstructed).toContain('P_Init: Init Playloop state.');
    expect(reconstructed).toContain('I_Init: Setting up machine state.');
    expect(reconstructed).toContain('D_CheckNetGame: Checking network game status.');
    expect(reconstructed).toContain('S_Init: Setting up sound.');
    expect(reconstructed).toContain('HU_Init: Setting up heads up display.');
    expect(reconstructed).toContain('ST_Init: Init status bar.');
  });

  test('emits the I_Init line strictly after the P_Init line in the reconstructed stream', () => {
    const stdoutLines = VANILLA_D_DOOMMAIN_INIT_ORDER.map((step) => step.stdoutLine);
    const reconstructed = stdoutLines.join('');
    const pInitOffset = reconstructed.indexOf('P_Init: Init Playloop state.');
    const iInitOffset = reconstructed.indexOf('I_Init: Setting up machine state.');
    expect(pInitOffset).toBeGreaterThan(0);
    expect(iInitOffset).toBeGreaterThan(0);
    expect(iInitOffset).toBeGreaterThan(pInitOffset);
  });

  test('emits the D_CheckNetGame line strictly before the S_Init line in the reconstructed stream', () => {
    const stdoutLines = VANILLA_D_DOOMMAIN_INIT_ORDER.map((step) => step.stdoutLine);
    const reconstructed = stdoutLines.join('');
    const dCheckOffset = reconstructed.indexOf('D_CheckNetGame: Checking network game status.');
    const sInitOffset = reconstructed.indexOf('S_Init: Setting up sound.');
    expect(dCheckOffset).toBeGreaterThan(0);
    expect(sInitOffset).toBeGreaterThan(0);
    expect(dCheckOffset).toBeLessThan(sInitOffset);
  });

  test('emits the V_Init line strictly before the Z_Init line (the vanilla pre-banner reorder)', () => {
    const stdoutLines = VANILLA_D_DOOMMAIN_INIT_ORDER.map((step) => step.stdoutLine);
    const reconstructed = stdoutLines.join('');
    const vInitOffset = reconstructed.indexOf('V_Init: allocate screens.');
    const zInitOffset = reconstructed.indexOf('Z_Init: Init zone memory allocation daemon.');
    expect(vInitOffset).toBeGreaterThan(-1);
    expect(zInitOffset).toBeGreaterThan(0);
    expect(vInitOffset).toBeLessThan(zInitOffset);
  });

  test('omits every Chocolate-only stdout literal', () => {
    const stdoutLines = VANILLA_D_DOOMMAIN_INIT_ORDER.map((step) => step.stdoutLine);
    const reconstructed = stdoutLines.join('');
    expect(reconstructed).not.toContain("OPL_Init: Using driver 'SDL'.");
    expect(reconstructed).not.toContain('NET_Init: Init network subsystem.');
    expect(reconstructed).not.toContain('I_InitStretchTables: Generating lookup tables.');
  });
});

describe('NULL_RESULT_FIELDS template (test-internal sanity)', () => {
  test('matches the answeredX-null shape that probes use when a field is not relevant', () => {
    expect(NULL_RESULT_FIELDS.answeredSymbol).toBeNull();
    expect(NULL_RESULT_FIELDS.answeredIndex).toBeNull();
    expect(NULL_RESULT_FIELDS.answeredPresent).toBeNull();
    expect(NULL_RESULT_FIELDS.answeredStdoutLine).toBeNull();
    expect(NULL_RESULT_FIELDS.answeredPhase).toBeNull();
    expect(NULL_RESULT_FIELDS.answeredPrecedes).toBeNull();
    expect(NULL_RESULT_FIELDS.answeredCount).toBeNull();
  });
});

describe('implement-d-doommain-init-order-skeleton step file', () => {
  test('declares the launch lane and the implement write lock', async () => {
    const stepText = await Bun.file(STEP_FILE_RELATIVE_PATH).text();
    expect(stepText).toContain('## lane\n\nlaunch');
    expect(stepText).toContain('- src/bootstrap/implement-d-doommain-init-order-skeleton.ts');
    expect(stepText).toContain('- test/vanilla_parity/launch/implement-d-doommain-init-order-skeleton.test.ts');
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
