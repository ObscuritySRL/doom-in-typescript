import { readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';

interface HookInput {
  tool_input?: {
    file_path?: string;
    notebook_path?: string;
  };
}

const repoRoot = resolve(import.meta.dir, '..', '..');
const input = readFileSync(0, 'utf8');
const data = JSON.parse(input) as HookInput;
const filePath = data.tool_input?.file_path ?? data.tool_input?.notebook_path ?? '';

if (filePath) {
  const absolute = resolve(repoRoot, filePath);
  const rel = relative(repoRoot, absolute).replace(/\\/g, '/');
  const readOnlyRoots = ['doom', 'iwad', 'reference'];

  for (const root of readOnlyRoots) {
    if (rel === root || rel.startsWith(root + '/')) {
      process.stderr.write(`BLOCKED: '${filePath}' is in read-only boundary '${root}/' per CLAUDE.md.\n`);
      process.stderr.write(`Oracle artifacts must land under test/oracles/fixtures/, test/parity/fixtures/, or plan_fps/manifests/.\n`);
      process.exit(2);
    }
  }
}
