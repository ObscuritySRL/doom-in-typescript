import { describe, expect, it } from 'bun:test';

import matrix from '../../reference/manifests/package-capability-matrix.json';
import packageJson from '../../package.json';

const C1_PACKAGES: readonly string[] = ['@bun-win32/core', '@bun-win32/gdi32', '@bun-win32/kernel32', '@bun-win32/user32', '@bun-win32/winmm'];
const PROOF_STEP_PATTERN = /^(\d{2}-\d{3}|later-target-only)$/;

describe('package-capability-matrix.json', () => {
  it('contains a non-empty standalone package inventory', () => {
    expect(matrix.entries.length).toBeGreaterThan(C1_PACKAGES.length);
  });

  it('covers every standalone runtime @bun-win32 dependency', () => {
    const matrixPackages = new Set(matrix.entries.map((entry) => entry.package));
    const runtimeDependencies = Object.keys(packageJson.dependencies ?? {})
      .filter((dependencyName) => dependencyName.startsWith('@bun-win32/'))
      .sort();

    expect(runtimeDependencies).toEqual([...C1_PACKAGES].sort());
    for (const dependencyName of runtimeDependencies) {
      expect(matrixPackages.has(dependencyName)).toBe(true);
    }
  });

  it('has unique package names across all entries', () => {
    const packages = matrix.entries.map((entry) => entry.package);
    expect(new Set(packages).size).toBe(packages.length);
  });

  it('uses @bun-win32/ scoped package names', () => {
    for (const entry of matrix.entries) {
      expect(entry.package.startsWith('@bun-win32/')).toBe(true);
    }
  });

  it('sorts entries in ASCIIbetical order by package name', () => {
    const packages = matrix.entries.map((entry) => entry.package);
    const sorted = [...packages].sort();
    expect(packages).toEqual(sorted);
  });

  it('has boolean usedInC1 for every entry', () => {
    for (const entry of matrix.entries) {
      expect(typeof entry.usedInC1).toBe('boolean');
    }
  });

  it('has non-empty capabilities for every entry', () => {
    for (const entry of matrix.entries) {
      expect(entry.capabilities).toBeTruthy();
      expect(typeof entry.capabilities).toBe('string');
    }
  });

  it('has non-empty blockedCapabilities for every entry', () => {
    for (const entry of matrix.entries) {
      expect(entry.blockedCapabilities).toBeTruthy();
      expect(typeof entry.blockedCapabilities).toBe('string');
    }
  });

  it('marks exactly the expected 5 packages as C1', () => {
    const c1Entries = matrix.entries.filter((entry) => entry.usedInC1);
    const c1Names = c1Entries.map((entry) => entry.package).sort();
    expect(c1Names).toEqual([...C1_PACKAGES].sort());
  });

  it('assigns a valid proof step to every C1 package', () => {
    const c1Entries = matrix.entries.filter((entry) => entry.usedInC1);
    for (const entry of c1Entries) {
      expect(entry.proofStep).not.toBeNull();
      expect(entry.proofStep).toMatch(PROOF_STEP_PATTERN);
    }
  });

  it('uses null or a valid proof-step format for non-C1 packages', () => {
    const nonC1Entries = matrix.entries.filter((entry) => !entry.usedInC1);
    for (const entry of nonC1Entries) {
      if (entry.proofStep !== null) {
        expect(entry.proofStep).toMatch(PROOF_STEP_PATTERN);
      }
    }
  });

  it('does not mark opengl32 or glu32 as C1 (GDI presentation decision)', () => {
    const glEntries = matrix.entries.filter((entry) => entry.package === '@bun-win32/opengl32' || entry.package === '@bun-win32/glu32');
    expect(glEntries).toHaveLength(2);
    for (const entry of glEntries) {
      expect(entry.usedInC1).toBe(false);
      expect(entry.proofStep).toBe('later-target-only');
    }
  });

  it('includes a generatedAt date string', () => {
    expect(matrix.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('includes a non-empty description', () => {
    expect(matrix.description).toBeTruthy();
    expect(typeof matrix.description).toBe('string');
  });
});
