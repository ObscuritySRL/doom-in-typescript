import { describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import packageJson from '../../package.json';
import tsconfig from '../../tsconfig.json';

const ROOT = resolve(import.meta.dir, '..', '..');

const C1_PACKAGES = ['@bun-win32/core', '@bun-win32/gdi32', '@bun-win32/kernel32', '@bun-win32/user32', '@bun-win32/winmm'] as const;

describe('package.json scaffold', () => {
  test('name is doom-codex', () => {
    expect(packageJson.name).toBe('doom-codex');
  });

  test('is private', () => {
    expect(packageJson.private).toBe(true);
  });

  test('type is module', () => {
    expect(packageJson.type).toBe('module');
  });

  test('has version field', () => {
    expect(packageJson.version).toBe('0.0.0');
  });

  test('has description', () => {
    expect(packageJson.description).toBeTruthy();
  });

  test('declares all 5 C1 dependencies', () => {
    const dependencies = packageJson.dependencies ?? {};
    for (const packageName of C1_PACKAGES) {
      expect(dependencies).toHaveProperty(packageName);
    }
  });

  test('C1 dependencies use registry semver ranges', () => {
    const dependencies = packageJson.dependencies as Record<string, string>;
    for (const packageName of C1_PACKAGES) {
      expect(dependencies[packageName]).toMatch(/^\^\d+\.\d+\.\d+$/);
      expect(dependencies[packageName]).not.toBe('workspace:*');
    }
  });

  test('has exactly 5 runtime dependencies', () => {
    const dependencyCount = Object.keys(packageJson.dependencies ?? {}).length;
    expect(dependencyCount).toBe(5);
  });

  test('dependencies are ASCIIbetically sorted', () => {
    const dependencyNames = Object.keys(packageJson.dependencies ?? {});
    const sorted = [...dependencyNames].sort();
    expect(dependencyNames).toEqual(sorted);
  });

  test('no non-C1 dependency present (parity edge case)', () => {
    const dependencyNames = Object.keys(packageJson.dependencies ?? {});
    for (const name of dependencyNames) {
      expect(C1_PACKAGES as readonly string[]).toContain(name);
    }
  });

  test('devDependencies includes @types/bun', () => {
    expect(packageJson.devDependencies).toHaveProperty('@types/bun');
  });
});

describe('tsconfig.json scaffold', () => {
  test('is self-contained for the standalone checkout', () => {
    expect(tsconfig).not.toHaveProperty('extends');
  });

  test('targets Bun-compatible ESNext modules', () => {
    expect(tsconfig.compilerOptions.target).toBe('ESNext');
    expect(tsconfig.compilerOptions.module).toBe('Preserve');
    expect(tsconfig.compilerOptions.moduleResolution).toBe('bundler');
  });

  test('allows .ts imports used throughout the project', () => {
    expect(tsconfig.compilerOptions.allowImportingTsExtensions).toBe(true);
  });

  test('includes src directory', () => {
    expect(tsconfig.include).toContain('src');
  });

  test('includes test directory', () => {
    expect(tsconfig.include).toContain('test');
  });

  test('includes tools directory', () => {
    expect(tsconfig.include).toContain('tools');
  });

  test('project tsconfig exists on disk', () => {
    const configPath = resolve(ROOT, 'tsconfig.json');
    expect(existsSync(configPath)).toBe(true);
  });
});

describe('directory structure', () => {
  test('src directory exists', () => {
    expect(existsSync(resolve(ROOT, 'src'))).toBe(true);
  });

  test('test directory exists', () => {
    expect(existsSync(resolve(ROOT, 'test'))).toBe(true);
  });

  test('tools directory exists', () => {
    expect(existsSync(resolve(ROOT, 'tools'))).toBe(true);
  });

  test('reference directory exists', () => {
    expect(existsSync(resolve(ROOT, 'reference'))).toBe(true);
  });

  test('plan_engine directory exists', () => {
    expect(existsSync(resolve(ROOT, 'plan_engine'))).toBe(true);
  });
});
