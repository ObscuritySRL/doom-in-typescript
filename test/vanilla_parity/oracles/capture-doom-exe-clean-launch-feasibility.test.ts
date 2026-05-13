import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync, statSync } from 'node:fs';

import feasibility from './capture-doom-exe-clean-launch-feasibility.json';

const STEP_FILE_PATH = 'plan_vanilla_parity/steps/02-006-capture-doom-exe-clean-launch-feasibility.md';
const HEX_PATTERN = /^[0-9A-F]+$/;
const VALID_VERDICTS = new Set(['launchable-directly', 'launchable-with-emulation', 'not-launchable-directly']);
const IMAGE_FILE_MACHINE_I386 = 0x14c;
const PE_OPTIONAL_HEADER_MAGIC_PE32 = 0x10b;

function readSubjectBytes(): Buffer {
  return readFileSync(feasibility.subjectRelativePath);
}

describe('feasibility identity and metadata', () => {
  test('declares OR-VP-DOOMEXE-FEASIBILITY-006 oracle id, step 02-006, and oracle lane', () => {
    expect(feasibility.id).toBe('OR-VP-DOOMEXE-FEASIBILITY-006');
    expect(feasibility.stepId).toBe('02-006');
    expect(feasibility.stepTitle).toBe('Capture Doom Exe Clean Launch Feasibility');
    expect(feasibility.lane).toBe('oracle');
  });

  test('pins DOOM.EXE as the subject under doom/', () => {
    expect(feasibility.subjectFilename).toBe('DOOM.EXE');
    expect(feasibility.subjectRelativePath).toBe('doom/DOOM.EXE');
    expect(existsSync(feasibility.subjectRelativePath)).toBe(true);
    expect(statSync(feasibility.subjectRelativePath).isFile()).toBe(true);
  });

  test('verdict is launchable-directly and rationale is non-empty', () => {
    expect(VALID_VERDICTS.has(feasibility.verdict)).toBe(true);
    expect(feasibility.verdict).toBe('launchable-directly');
    expect(feasibility.verdictRationale.length).toBeGreaterThan(0);
    expect(feasibility.description.length).toBeGreaterThan(0);
  });

  test('host capability requirements list is non-empty and unique', () => {
    expect(feasibility.hostCapabilityRequirements.length).toBeGreaterThan(0);
    expect(new Set(feasibility.hostCapabilityRequirements).size).toBe(feasibility.hostCapabilityRequirements.length);
  });
});

describe('subject PE header byte-level verification', () => {
  test('subject begins with the DOS MZ signature 0x4D 0x5A', () => {
    const subjectBytes = readSubjectBytes();
    expect(subjectBytes[0]).toBe(0x4d);
    expect(subjectBytes[1]).toBe(0x5a);
    expect(feasibility.subjectHeader.mzSignatureBytes).toBe('4D5A');
    expect(feasibility.subjectHeader.mzSignatureBytes).toMatch(HEX_PATTERN);
  });

  test('PE offset at 0x3C matches the declared value and points inside the file', () => {
    const subjectBytes = readSubjectBytes();
    const peOffset = subjectBytes.readUInt32LE(0x3c);
    const declaredOffset = parseInt(feasibility.subjectHeader.peOffsetFieldHex, 16);
    expect(peOffset).toBe(declaredOffset);
    expect(peOffset).toBeLessThan(subjectBytes.length);
    expect(feasibility.subjectHeader.peOffsetWithinFile).toBe(true);
  });

  test('PE signature `PE\\0\\0` is present at the declared PE offset', () => {
    const subjectBytes = readSubjectBytes();
    const peOffset = subjectBytes.readUInt32LE(0x3c);
    expect(subjectBytes[peOffset]).toBe(0x50);
    expect(subjectBytes[peOffset + 1]).toBe(0x45);
    expect(subjectBytes[peOffset + 2]).toBe(0x00);
    expect(subjectBytes[peOffset + 3]).toBe(0x00);
    expect(feasibility.subjectHeader.peSignatureBytes).toBe('50450000');
  });

  test('machine field is IMAGE_FILE_MACHINE_I386 and matches the declared name', () => {
    const subjectBytes = readSubjectBytes();
    const peOffset = subjectBytes.readUInt32LE(0x3c);
    const machine = subjectBytes.readUInt16LE(peOffset + 4);
    expect(machine).toBe(IMAGE_FILE_MACHINE_I386);
    const declaredMachine = parseInt(feasibility.subjectHeader.machineHex, 16);
    expect(declaredMachine).toBe(IMAGE_FILE_MACHINE_I386);
    expect(feasibility.subjectHeader.machineName).toBe('IMAGE_FILE_MACHINE_I386');
  });

  test('number of sections and optional header size match the declared values', () => {
    const subjectBytes = readSubjectBytes();
    const peOffset = subjectBytes.readUInt32LE(0x3c);
    const numberOfSections = subjectBytes.readUInt16LE(peOffset + 6);
    const sizeOfOptionalHeader = subjectBytes.readUInt16LE(peOffset + 20);
    expect(numberOfSections).toBe(feasibility.subjectHeader.numberOfSections);
    expect(sizeOfOptionalHeader).toBe(feasibility.subjectHeader.sizeOfOptionalHeader);
  });

  test('optional header magic is PE32 (0x10B) and matches the declared format', () => {
    const subjectBytes = readSubjectBytes();
    const peOffset = subjectBytes.readUInt32LE(0x3c);
    const optionalHeaderOffset = peOffset + 24;
    const optionalHeaderMagic = subjectBytes.readUInt16LE(optionalHeaderOffset);
    expect(optionalHeaderMagic).toBe(PE_OPTIONAL_HEADER_MAGIC_PE32);
    const declaredMagic = parseInt(feasibility.subjectHeader.optionalHeaderMagicHex, 16);
    expect(declaredMagic).toBe(PE_OPTIONAL_HEADER_MAGIC_PE32);
    expect(feasibility.subjectHeader.optionalHeaderFormat).toBe('PE32');
  });
});

describe('downstream follow-ups', () => {
  test('downstream follow-ups list is non-empty and unique', () => {
    expect(feasibility.downstreamFollowUps.length).toBeGreaterThan(0);
    expect(new Set(feasibility.downstreamFollowUps).size).toBe(feasibility.downstreamFollowUps.length);
  });
});

describe('alignment with plan_vanilla_parity step 02-006', () => {
  test('step file write lock pins the feasibility json and test paths to the oracle lane', async () => {
    const stepFileText = await Bun.file(STEP_FILE_PATH).text();
    expect(stepFileText).toContain('- test/vanilla_parity/oracles/capture-doom-exe-clean-launch-feasibility.json');
    expect(stepFileText).toContain('- test/vanilla_parity/oracles/capture-doom-exe-clean-launch-feasibility.test.ts');
    expect(stepFileText).toContain('\n## lane\n\noracle\n');
  });

  test('step file lists DOOM.EXE among its research sources', async () => {
    const stepFileText = await Bun.file(STEP_FILE_PATH).text();
    expect(stepFileText).toContain('- doom/DOOM.EXE');
  });
});

describe('failure-mode validation invariants', () => {
  test('valid verdicts set rejects unknown values', () => {
    expect(VALID_VERDICTS.has('runnable')).toBe(false);
    expect(VALID_VERDICTS.has('')).toBe(false);
    expect(VALID_VERDICTS.has('maybe')).toBe(false);
  });

  test('hex pattern rejects non-hex and lowercase characters', () => {
    expect('1ac').not.toMatch(HEX_PATTERN);
    expect('GG').not.toMatch(HEX_PATTERN);
    expect('').not.toMatch(HEX_PATTERN);
  });

  test('a non-PE32 magic value would not match the gate', () => {
    const PE_OPTIONAL_HEADER_MAGIC_PE32_PLUS = 0x20b;
    expect(PE_OPTIONAL_HEADER_MAGIC_PE32_PLUS).not.toBe(PE_OPTIONAL_HEADER_MAGIC_PE32);
  });
});
