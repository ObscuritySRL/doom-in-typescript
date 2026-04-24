import { describe, expect, test } from 'bun:test';

import { EMPTY_DEMO_PLAYBACK_MANUAL_GATE, EMPTY_TITLE_LOOP_MANUAL_GATE, MANUAL_GATE_DOMAINS, MANUAL_GATE_VERDICTS, REQUIRED_DOMAINS_BY_RUN_MODE, isGateSetComplete } from '../../src/oracles/manualGatePolicy.ts';
import type { ManualGateArtifact, ManualGateDomain, ManualGateEntry, ManualGatePayload, ManualGateVerdict } from '../../src/oracles/manualGatePolicy.ts';
import { ORACLE_KINDS } from '../../src/oracles/schema.ts';
import type { OracleArtifact } from '../../src/oracles/schema.ts';
import { PRIMARY_TARGET } from '../../src/reference/target.ts';

describe('MANUAL_GATE_DOMAINS', () => {
  test('has exactly 6 domains', () => {
    expect(MANUAL_GATE_DOMAINS).toHaveLength(6);
  });

  test('contains all expected domains', () => {
    expect(MANUAL_GATE_DOMAINS).toContain('audio');
    expect(MANUAL_GATE_DOMAINS).toContain('input');
    expect(MANUAL_GATE_DOMAINS).toContain('music');
    expect(MANUAL_GATE_DOMAINS).toContain('timing');
    expect(MANUAL_GATE_DOMAINS).toContain('title-loop');
    expect(MANUAL_GATE_DOMAINS).toContain('visual');
  });

  test('is ASCIIbetically sorted', () => {
    const sorted = [...MANUAL_GATE_DOMAINS].sort();
    expect(MANUAL_GATE_DOMAINS).toEqual(sorted);
  });

  test('has unique entries', () => {
    const unique = new Set(MANUAL_GATE_DOMAINS);
    expect(unique.size).toBe(MANUAL_GATE_DOMAINS.length);
  });

  test('is frozen', () => {
    expect(Object.isFrozen(MANUAL_GATE_DOMAINS)).toBe(true);
  });
});

describe('MANUAL_GATE_VERDICTS', () => {
  test('has exactly 3 verdicts', () => {
    expect(MANUAL_GATE_VERDICTS).toHaveLength(3);
  });

  test('contains all expected verdicts', () => {
    expect(MANUAL_GATE_VERDICTS).toContain('pass');
    expect(MANUAL_GATE_VERDICTS).toContain('fail');
    expect(MANUAL_GATE_VERDICTS).toContain('inconclusive');
  });

  test('is ASCIIbetically sorted', () => {
    const sorted = [...MANUAL_GATE_VERDICTS].sort();
    expect(MANUAL_GATE_VERDICTS).toEqual(sorted);
  });

  test('has unique entries', () => {
    const unique = new Set(MANUAL_GATE_VERDICTS);
    expect(unique.size).toBe(MANUAL_GATE_VERDICTS.length);
  });

  test('is frozen', () => {
    expect(Object.isFrozen(MANUAL_GATE_VERDICTS)).toBe(true);
  });
});

describe('ORACLE_KINDS cross-reference', () => {
  test('manual-gate is a registered oracle kind', () => {
    expect(ORACLE_KINDS).toContain('manual-gate');
  });
});

describe('REQUIRED_DOMAINS_BY_RUN_MODE', () => {
  test('title-loop requires all 6 domains', () => {
    expect(REQUIRED_DOMAINS_BY_RUN_MODE['title-loop']).toHaveLength(6);
    for (const domain of MANUAL_GATE_DOMAINS) {
      expect(REQUIRED_DOMAINS_BY_RUN_MODE['title-loop']).toContain(domain);
    }
  });

  test('demo-playback requires 4 domains (excludes input and title-loop)', () => {
    expect(REQUIRED_DOMAINS_BY_RUN_MODE['demo-playback']).toHaveLength(4);
    expect(REQUIRED_DOMAINS_BY_RUN_MODE['demo-playback']).toContain('audio');
    expect(REQUIRED_DOMAINS_BY_RUN_MODE['demo-playback']).toContain('music');
    expect(REQUIRED_DOMAINS_BY_RUN_MODE['demo-playback']).toContain('timing');
    expect(REQUIRED_DOMAINS_BY_RUN_MODE['demo-playback']).toContain('visual');
    expect(REQUIRED_DOMAINS_BY_RUN_MODE['demo-playback']).not.toContain('input');
    expect(REQUIRED_DOMAINS_BY_RUN_MODE['demo-playback']).not.toContain('title-loop');
  });

  test('both run mode domain lists are ASCIIbetically sorted', () => {
    const titleSorted = [...REQUIRED_DOMAINS_BY_RUN_MODE['title-loop']].sort();
    expect(REQUIRED_DOMAINS_BY_RUN_MODE['title-loop']).toEqual(titleSorted);

    const demoSorted = [...REQUIRED_DOMAINS_BY_RUN_MODE['demo-playback']].sort();
    expect(REQUIRED_DOMAINS_BY_RUN_MODE['demo-playback']).toEqual(demoSorted);
  });

  test('is frozen at all levels', () => {
    expect(Object.isFrozen(REQUIRED_DOMAINS_BY_RUN_MODE)).toBe(true);
    expect(Object.isFrozen(REQUIRED_DOMAINS_BY_RUN_MODE['title-loop'])).toBe(true);
    expect(Object.isFrozen(REQUIRED_DOMAINS_BY_RUN_MODE['demo-playback'])).toBe(true);
  });
});

describe('EMPTY_TITLE_LOOP_MANUAL_GATE', () => {
  test('targets title-loop run mode', () => {
    expect(EMPTY_TITLE_LOOP_MANUAL_GATE.targetRunMode).toBe('title-loop');
  });

  test('ticRateHz matches PRIMARY_TARGET', () => {
    expect(EMPTY_TITLE_LOOP_MANUAL_GATE.ticRateHz).toBe(PRIMARY_TARGET.ticRateHz);
    expect(EMPTY_TITLE_LOOP_MANUAL_GATE.ticRateHz).toBe(35);
  });

  test('has empty observer string', () => {
    expect(EMPTY_TITLE_LOOP_MANUAL_GATE.observer).toBe('');
  });

  test('has empty entries array', () => {
    expect(EMPTY_TITLE_LOOP_MANUAL_GATE.entries).toHaveLength(0);
  });

  test('has non-empty description', () => {
    expect(EMPTY_TITLE_LOOP_MANUAL_GATE.description.length).toBeGreaterThan(0);
  });

  test('is frozen at top level and entries array', () => {
    expect(Object.isFrozen(EMPTY_TITLE_LOOP_MANUAL_GATE)).toBe(true);
    expect(Object.isFrozen(EMPTY_TITLE_LOOP_MANUAL_GATE.entries)).toBe(true);
  });
});

describe('EMPTY_DEMO_PLAYBACK_MANUAL_GATE', () => {
  test('targets demo-playback run mode', () => {
    expect(EMPTY_DEMO_PLAYBACK_MANUAL_GATE.targetRunMode).toBe('demo-playback');
  });

  test('ticRateHz matches PRIMARY_TARGET', () => {
    expect(EMPTY_DEMO_PLAYBACK_MANUAL_GATE.ticRateHz).toBe(PRIMARY_TARGET.ticRateHz);
  });

  test('has empty observer string', () => {
    expect(EMPTY_DEMO_PLAYBACK_MANUAL_GATE.observer).toBe('');
  });

  test('has empty entries array', () => {
    expect(EMPTY_DEMO_PLAYBACK_MANUAL_GATE.entries).toHaveLength(0);
  });

  test('is frozen at top level and entries array', () => {
    expect(Object.isFrozen(EMPTY_DEMO_PLAYBACK_MANUAL_GATE)).toBe(true);
    expect(Object.isFrozen(EMPTY_DEMO_PLAYBACK_MANUAL_GATE.entries)).toBe(true);
  });
});

describe('isGateSetComplete', () => {
  test('empty title-loop payload is incomplete', () => {
    expect(isGateSetComplete(EMPTY_TITLE_LOOP_MANUAL_GATE)).toBe(false);
  });

  test('empty demo-playback payload is incomplete', () => {
    expect(isGateSetComplete(EMPTY_DEMO_PLAYBACK_MANUAL_GATE)).toBe(false);
  });

  test('title-loop with all 6 domains passing is complete', () => {
    const payload: ManualGatePayload = {
      description: 'Full title-loop evaluation',
      targetRunMode: 'title-loop',
      ticRateHz: 35,
      observer: 'test-observer',
      entries: MANUAL_GATE_DOMAINS.map((domain) => ({
        domain,
        description: `Check ${domain}`,
        verdict: 'pass' as ManualGateVerdict,
        notes: '',
        evaluatedAt: '2026-04-12T00:00:00Z',
      })),
    };
    expect(isGateSetComplete(payload)).toBe(true);
  });

  test('demo-playback with 4 required domains passing is complete', () => {
    const payload: ManualGatePayload = {
      description: 'Full demo-playback evaluation',
      targetRunMode: 'demo-playback',
      ticRateHz: 35,
      observer: 'test-observer',
      entries: REQUIRED_DOMAINS_BY_RUN_MODE['demo-playback'].map((domain) => ({
        domain,
        description: `Check ${domain}`,
        verdict: 'pass' as ManualGateVerdict,
        notes: '',
        evaluatedAt: '2026-04-12T00:00:00Z',
      })),
    };
    expect(isGateSetComplete(payload)).toBe(true);
  });

  test('title-loop missing one domain is incomplete', () => {
    const allButVisual = MANUAL_GATE_DOMAINS.filter((domain) => domain !== 'visual');
    const payload: ManualGatePayload = {
      description: 'Partial title-loop evaluation',
      targetRunMode: 'title-loop',
      ticRateHz: 35,
      observer: 'test-observer',
      entries: allButVisual.map((domain) => ({
        domain,
        description: `Check ${domain}`,
        verdict: 'pass' as ManualGateVerdict,
        notes: '',
        evaluatedAt: '2026-04-12T00:00:00Z',
      })),
    };
    expect(isGateSetComplete(payload)).toBe(false);
  });

  test('fail verdict does not satisfy a required domain', () => {
    const payload: ManualGatePayload = {
      description: 'Demo-playback with a failure',
      targetRunMode: 'demo-playback',
      ticRateHz: 35,
      observer: 'test-observer',
      entries: [
        { domain: 'audio', description: 'Audio check', verdict: 'pass', notes: '', evaluatedAt: '2026-04-12T00:00:00Z' },
        { domain: 'music', description: 'Music check', verdict: 'pass', notes: '', evaluatedAt: '2026-04-12T00:00:00Z' },
        { domain: 'timing', description: 'Timing check', verdict: 'pass', notes: '', evaluatedAt: '2026-04-12T00:00:00Z' },
        { domain: 'visual', description: 'Visual check', verdict: 'fail', notes: 'Colors are wrong', evaluatedAt: '2026-04-12T00:00:00Z' },
      ],
    };
    expect(isGateSetComplete(payload)).toBe(false);
  });

  test('inconclusive verdict does not satisfy a required domain', () => {
    const payload: ManualGatePayload = {
      description: 'Demo-playback with inconclusive',
      targetRunMode: 'demo-playback',
      ticRateHz: 35,
      observer: 'test-observer',
      entries: [
        { domain: 'audio', description: 'Audio check', verdict: 'pass', notes: '', evaluatedAt: '2026-04-12T00:00:00Z' },
        { domain: 'music', description: 'Music check', verdict: 'inconclusive', notes: 'Could not hear clearly', evaluatedAt: '2026-04-12T00:00:00Z' },
        { domain: 'timing', description: 'Timing check', verdict: 'pass', notes: '', evaluatedAt: '2026-04-12T00:00:00Z' },
        { domain: 'visual', description: 'Visual check', verdict: 'pass', notes: '', evaluatedAt: '2026-04-12T00:00:00Z' },
      ],
    };
    expect(isGateSetComplete(payload)).toBe(false);
  });

  test('later pass overrides earlier fail for the same domain', () => {
    const payload: ManualGatePayload = {
      description: 'Demo-playback with re-evaluation',
      targetRunMode: 'demo-playback',
      ticRateHz: 35,
      observer: 'test-observer',
      entries: [
        { domain: 'audio', description: 'Audio check', verdict: 'pass', notes: '', evaluatedAt: '2026-04-12T00:00:00Z' },
        { domain: 'music', description: 'Music check', verdict: 'fail', notes: 'Wrong track', evaluatedAt: '2026-04-12T00:00:00Z' },
        { domain: 'music', description: 'Music re-check after fix', verdict: 'pass', notes: 'Fixed', evaluatedAt: '2026-04-12T01:00:00Z' },
        { domain: 'timing', description: 'Timing check', verdict: 'pass', notes: '', evaluatedAt: '2026-04-12T00:00:00Z' },
        { domain: 'visual', description: 'Visual check', verdict: 'pass', notes: '', evaluatedAt: '2026-04-12T00:00:00Z' },
      ],
    };
    expect(isGateSetComplete(payload)).toBe(true);
  });

  test('extra non-required domains do not affect completeness', () => {
    const payload: ManualGatePayload = {
      description: 'Demo-playback with extra domains',
      targetRunMode: 'demo-playback',
      ticRateHz: 35,
      observer: 'test-observer',
      entries: [
        { domain: 'audio', description: 'Audio check', verdict: 'pass', notes: '', evaluatedAt: '2026-04-12T00:00:00Z' },
        { domain: 'input', description: 'Input check (not required)', verdict: 'fail', notes: 'Not applicable', evaluatedAt: '2026-04-12T00:00:00Z' },
        { domain: 'music', description: 'Music check', verdict: 'pass', notes: '', evaluatedAt: '2026-04-12T00:00:00Z' },
        { domain: 'timing', description: 'Timing check', verdict: 'pass', notes: '', evaluatedAt: '2026-04-12T00:00:00Z' },
        { domain: 'visual', description: 'Visual check', verdict: 'pass', notes: '', evaluatedAt: '2026-04-12T00:00:00Z' },
      ],
    };
    expect(isGateSetComplete(payload)).toBe(true);
  });
});

describe('ManualGateEntry well-formed acceptance', () => {
  test('accepts a fully populated entry', () => {
    const entry: ManualGateEntry = {
      domain: 'visual',
      description: 'Framebuffer matches reference screenshot at TITLEPIC',
      verdict: 'pass',
      notes: 'Pixel-identical under normal palette',
      evaluatedAt: '2026-04-12T14:30:00Z',
    };
    expect(entry.domain).toBe('visual');
    expect(entry.verdict).toBe('pass');
    expect(entry.notes.length).toBeGreaterThan(0);
  });

  test('accepts an entry with empty notes', () => {
    const entry: ManualGateEntry = {
      domain: 'timing',
      description: '35 Hz tic rate feels smooth',
      verdict: 'pass',
      notes: '',
      evaluatedAt: '2026-04-12T14:30:00Z',
    };
    expect(entry.notes).toBe('');
  });
});

describe('ManualGatePayload well-formed acceptance', () => {
  test('accepts a multi-entry payload with mixed verdicts', () => {
    const payload: ManualGatePayload = {
      description: 'Title loop initial evaluation',
      targetRunMode: 'title-loop',
      ticRateHz: 35,
      observer: 'human-tester-1',
      entries: [
        { domain: 'audio', description: 'SFX audible and correct', verdict: 'pass', notes: '', evaluatedAt: '2026-04-12T14:00:00Z' },
        { domain: 'input', description: 'Keyboard responsive', verdict: 'pass', notes: '', evaluatedAt: '2026-04-12T14:01:00Z' },
        { domain: 'music', description: 'D_INTRO plays at startup', verdict: 'pass', notes: '', evaluatedAt: '2026-04-12T14:02:00Z' },
        { domain: 'timing', description: 'Smooth 35 Hz', verdict: 'inconclusive', notes: 'System load was high', evaluatedAt: '2026-04-12T14:03:00Z' },
        { domain: 'title-loop', description: '6-state cycle correct', verdict: 'pass', notes: '', evaluatedAt: '2026-04-12T14:04:00Z' },
        { domain: 'visual', description: 'TITLEPIC rendered correctly', verdict: 'pass', notes: '', evaluatedAt: '2026-04-12T14:05:00Z' },
      ],
    };
    expect(payload.entries).toHaveLength(6);
    expect(payload.observer).toBe('human-tester-1');
    const domains = payload.entries.map((entry) => entry.domain);
    const sorted = [...domains].sort();
    expect(domains).toEqual(sorted);
  });
});

describe('compile-time type satisfaction', () => {
  test('ManualGateArtifact wraps ManualGatePayload in OracleArtifact envelope', () => {
    const artifact: ManualGateArtifact = {
      kind: 'manual-gate',
      version: 1,
      generatedAt: '2026-04-12T00:00:00Z',
      sourceHash: '0'.repeat(64),
      payload: EMPTY_TITLE_LOOP_MANUAL_GATE,
    };
    expect(artifact.kind).toBe('manual-gate');
    expect(artifact.version).toBe(1);
    expect(artifact.payload).toBe(EMPTY_TITLE_LOOP_MANUAL_GATE);
  });

  test('ManualGateArtifact satisfies OracleArtifact<ManualGatePayload>', () => {
    const artifact: OracleArtifact<ManualGatePayload> = {
      kind: 'manual-gate',
      version: 1,
      generatedAt: '2026-04-12T00:00:00Z',
      sourceHash: 'A'.repeat(64),
      payload: EMPTY_DEMO_PLAYBACK_MANUAL_GATE,
    };
    expect(artifact.payload.targetRunMode).toBe('demo-playback');
  });

  test('ManualGateDomain type covers all MANUAL_GATE_DOMAINS entries', () => {
    for (const domain of MANUAL_GATE_DOMAINS) {
      const typed: ManualGateDomain = domain;
      expect(typed).toBe(domain);
    }
  });

  test('ManualGateVerdict type covers all MANUAL_GATE_VERDICTS entries', () => {
    for (const verdict of MANUAL_GATE_VERDICTS) {
      const typed: ManualGateVerdict = verdict;
      expect(typed).toBe(verdict);
    }
  });
});

describe('parity-sensitive edge cases', () => {
  test('demo-playback excludes input and title-loop because input is scripted (F-034)', () => {
    const demoRequired = REQUIRED_DOMAINS_BY_RUN_MODE['demo-playback'];
    expect(demoRequired).not.toContain('input');
    expect(demoRequired).not.toContain('title-loop');
  });

  test('title-loop includes all domains because attract loop exercises every subsystem (F-025)', () => {
    const titleRequired = REQUIRED_DOMAINS_BY_RUN_MODE['title-loop'];
    expect(titleRequired).toHaveLength(MANUAL_GATE_DOMAINS.length);
    for (const domain of MANUAL_GATE_DOMAINS) {
      expect(titleRequired).toContain(domain);
    }
  });

  test('visual gate is always required because framebuffer hash cannot catch palette perception errors', () => {
    expect(REQUIRED_DOMAINS_BY_RUN_MODE['title-loop']).toContain('visual');
    expect(REQUIRED_DOMAINS_BY_RUN_MODE['demo-playback']).toContain('visual');
  });

  test('timing gate is always required because hash comparison cannot detect frame pacing jitter', () => {
    expect(REQUIRED_DOMAINS_BY_RUN_MODE['title-loop']).toContain('timing');
    expect(REQUIRED_DOMAINS_BY_RUN_MODE['demo-playback']).toContain('timing');
  });
});
