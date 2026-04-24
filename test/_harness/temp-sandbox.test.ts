import { afterEach, describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { cleanupTempSandboxes, createTempSandbox, tempSandboxCount, tempSandboxParent } from './tempSandbox.ts';

const ROOT = resolve(import.meta.dir, '..', '..');

afterEach(async () => {
  await cleanupTempSandboxes();
});

describe('createTempSandbox', () => {
  test('returns an absolute path', async () => {
    const sandbox = await createTempSandbox();
    expect(resolve(sandbox)).toBe(sandbox);
  });

  test('created directory exists on disk', async () => {
    const sandbox = await createTempSandbox();
    expect(existsSync(sandbox)).toBe(true);
  });

  test('path is under the sandbox parent directory', async () => {
    const sandbox = await createTempSandbox();
    expect(sandbox.startsWith(tempSandboxParent())).toBe(true);
  });

  test('path contains the test- prefix', async () => {
    const sandbox = await createTempSandbox();
    const basename = sandbox.slice(sandbox.lastIndexOf('test-'));
    expect(basename).toMatch(/^test-/);
  });

  test('sequential calls produce distinct paths', async () => {
    const first = await createTempSandbox();
    const second = await createTempSandbox();
    expect(first).not.toBe(second);
  });

  test('files can be written inside the sandbox', async () => {
    const sandbox = await createTempSandbox();
    const filePath = join(sandbox, 'probe.txt');
    await Bun.write(filePath, 'hello');
    expect(existsSync(filePath)).toBe(true);
    const content = await Bun.file(filePath).text();
    expect(content).toBe('hello');
  });
});

describe('tempSandboxCount', () => {
  test('is zero before any sandbox is created', () => {
    expect(tempSandboxCount()).toBe(0);
  });

  test('increments per createTempSandbox call', async () => {
    await createTempSandbox();
    expect(tempSandboxCount()).toBe(1);
    await createTempSandbox();
    expect(tempSandboxCount()).toBe(2);
  });
});

describe('cleanupTempSandboxes', () => {
  test('removes sandbox directories from disk', async () => {
    const first = await createTempSandbox();
    const second = await createTempSandbox();
    await cleanupTempSandboxes();
    expect(existsSync(first)).toBe(false);
    expect(existsSync(second)).toBe(false);
  });

  test('resets count to zero', async () => {
    await createTempSandbox();
    await createTempSandbox();
    await cleanupTempSandboxes();
    expect(tempSandboxCount()).toBe(0);
  });

  test('is safe to call when no sandboxes exist', async () => {
    expect(tempSandboxCount()).toBe(0);
    await cleanupTempSandboxes();
    expect(tempSandboxCount()).toBe(0);
  });

  test('double cleanup is safe', async () => {
    await createTempSandbox();
    await cleanupTempSandboxes();
    await cleanupTempSandboxes();
    expect(tempSandboxCount()).toBe(0);
  });
});

describe('tempSandboxParent', () => {
  test('returns an absolute path', () => {
    const parent = tempSandboxParent();
    expect(resolve(parent)).toBe(parent);
  });

  test('ends with .sandboxes', () => {
    const parent = tempSandboxParent();
    expect(parent).toMatch(/[/\\]\.sandboxes$/);
  });

  test('is under the current workspace', () => {
    const parent = tempSandboxParent();
    expect(parent.startsWith(ROOT)).toBe(true);
  });
});

describe('parity edge case: sandbox isolation', () => {
  test('sandbox contents do not leak between sequential creates', async () => {
    const first = await createTempSandbox();
    await Bun.write(join(first, 'marker.txt'), 'first');
    const second = await createTempSandbox();
    expect(existsSync(join(second, 'marker.txt'))).toBe(false);
  });
});
