import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync, statSync } from 'node:fs';

import feasibility from './capture-doomd-clean-launch-feasibility.json';

const STEP_FILE_PATH = 'plan_vanilla_parity/steps/02-005-capture-doomd-clean-launch-feasibility.md';
const HEX_PATTERN = /^[0-9A-F]+$/;
const VALID_VERDICTS = new Set(['launchable-directly', 'launchable-with-emulation', 'not-launchable-directly']);

function readSubjectBytes(): Buffer {
  return readFileSync(feasibility.subjectRelativePath);
}

function readPeOffsetField(bytes: Buffer): number {
  return bytes.readUInt32LE(0x3c);
}

describe('feasibility identity and metadata', () => {
  test('declares OR-VP-DOOMD-FEASIBILITY-005 oracle id, step 02-005, and oracle lane', () => {
    expect(feasibility.id).toBe('OR-VP-DOOMD-FEASIBILITY-005');
    expect(feasibility.stepId).toBe('02-005');
    expect(feasibility.stepTitle).toBe('Capture Doomd Clean Launch Feasibility');
    expect(feasibility.lane).toBe('oracle');
  });

  test('pins DOOMD.EXE as the subject under the read-only doom/ source', () => {
    expect(feasibility.subjectFilename).toBe('DOOMD.EXE');
    expect(feasibility.subjectRelativePath).toBe('doom/DOOMD.EXE');
    expect(existsSync(feasibility.subjectRelativePath)).toBe(true);
    expect(statSync(feasibility.subjectRelativePath).isFile()).toBe(true);
  });

  test('verdict is one of the canonical feasibility values', () => {
    expect(VALID_VERDICTS.has(feasibility.verdict)).toBe(true);
    expect(feasibility.verdict).toBe('not-launchable-directly');
  });

  test('verdict rationale and description are non-empty', () => {
    expect(feasibility.verdictRationale.length).toBeGreaterThan(0);
    expect(feasibility.description.length).toBeGreaterThan(0);
  });

  test('host capability requirements list is non-empty and contains unique values', () => {
    expect(feasibility.hostCapabilityRequirements.length).toBeGreaterThan(0);
    expect(new Set(feasibility.hostCapabilityRequirements).size).toBe(feasibility.hostCapabilityRequirements.length);
  });
});

describe('subject header byte-level verification', () => {
  test('subject begins with the DOS MZ signature 0x4D 0x5A', () => {
    const subjectBytes = readSubjectBytes();
    expect(subjectBytes[0]).toBe(0x4d);
    expect(subjectBytes[1]).toBe(0x5a);
    expect(feasibility.subjectHeader.mzSignatureBytes).toBe('4D5A');
    expect(feasibility.subjectHeader.mzSignatureBytes).toMatch(HEX_PATTERN);
  });

  test('PE offset field at 0x3C in the subject equals the declared value', () => {
    const subjectBytes = readSubjectBytes();
    const peOffset = readPeOffsetField(subjectBytes);
    const declaredOffset = parseInt(feasibility.subjectHeader.peOffsetFieldHex, 16);
    expect(peOffset).toBe(declaredOffset);
  });

  test('declared PE offset is outside the subject file (no PE header)', () => {
    const subjectBytes = readSubjectBytes();
    const peOffset = readPeOffsetField(subjectBytes);
    expect(peOffset).toBeGreaterThanOrEqual(subjectBytes.length);
    expect(feasibility.subjectHeader.peOffsetWithinFile).toBe(false);
  });
});

describe('recommended substitute byte-level verification', () => {
  test('declares DOOM.EXE as the practical substitute under doom/', () => {
    expect(feasibility.recommendedSubstitute.filename).toBe('DOOM.EXE');
    expect(feasibility.recommendedSubstitute.relativePath).toBe('doom/DOOM.EXE');
    expect(existsSync(feasibility.recommendedSubstitute.relativePath)).toBe(true);
    expect(statSync(feasibility.recommendedSubstitute.relativePath).isFile()).toBe(true);
  });

  test('substitute has a valid PE header at the declared offset', () => {
    const substituteBytes = readFileSync(feasibility.recommendedSubstitute.relativePath);
    const peOffset = substituteBytes.readUInt32LE(0x3c);
    const declaredOffset = parseInt(feasibility.recommendedSubstitute.peOffsetFieldHex, 16);
    expect(peOffset).toBe(declaredOffset);
    expect(peOffset).toBeLessThan(substituteBytes.length);
    expect(substituteBytes[peOffset]).toBe(0x50);
    expect(substituteBytes[peOffset + 1]).toBe(0x45);
    expect(substituteBytes[peOffset + 2]).toBe(0x00);
    expect(substituteBytes[peOffset + 3]).toBe(0x00);
    expect(feasibility.recommendedSubstitute.peSignatureBytes).toBe('50450000');
  });
});

describe('downstream follow-ups', () => {
  test('downstream follow-ups list is non-empty and contains unique values', () => {
    expect(feasibility.downstreamFollowUps.length).toBeGreaterThan(0);
    expect(new Set(feasibility.downstreamFollowUps).size).toBe(feasibility.downstreamFollowUps.length);
  });
});

describe('alignment with plan_vanilla_parity step 02-005', () => {
  test('step file write lock pins the feasibility json and test paths to the oracle lane', async () => {
    const stepFileText = await Bun.file(STEP_FILE_PATH).text();
    expect(stepFileText).toContain('- test/vanilla_parity/oracles/capture-doomd-clean-launch-feasibility.json');
    expect(stepFileText).toContain('- test/vanilla_parity/oracles/capture-doomd-clean-launch-feasibility.test.ts');
    expect(stepFileText).toContain('\n## lane\n\noracle\n');
  });

  test('step file lists DOOMD.EXE among its research sources', async () => {
    const stepFileText = await Bun.file(STEP_FILE_PATH).text();
    expect(stepFileText).toContain('- doom/DOOMD.EXE');
  });
});

describe('failure-mode validation invariants', () => {
  test('valid verdicts set rejects unknown values', () => {
    expect(VALID_VERDICTS.has('runnable')).toBe(false);
    expect(VALID_VERDICTS.has('')).toBe(false);
    expect(VALID_VERDICTS.has('unknown')).toBe(false);
  });

  test('hex pattern rejects non-hex characters and lowercase letters', () => {
    expect('4d5a').not.toMatch(HEX_PATTERN);
    expect('xyz').not.toMatch(HEX_PATTERN);
    expect('').not.toMatch(HEX_PATTERN);
  });

  test('a hypothetical valid PE offset within the file would flip the verdict gate', () => {
    const subjectBytes = readSubjectBytes();
    const hypotheticalValidOffset = 0x100;
    expect(hypotheticalValidOffset).toBeLessThan(subjectBytes.length);
    const declaredOffset = parseInt(feasibility.subjectHeader.peOffsetFieldHex, 16);
    expect(declaredOffset).not.toBe(hypotheticalValidOffset);
  });
});
