const READ_ONLY_ROOTS = ['doom/', 'iwad/', 'reference/'] as const;
const UNTRACKED_FORMAT_ROOTS = ['plan_fps/', 'plan_vanilla_parity/', 'src/', 'test/', 'tools/'] as const;
const UNTRACKED_FORMAT_FILES = ['biome.json', 'package.json', 'tsconfig.json'] as const;

const changedPaths = new Set<string>();

for (const changedPath of await collectGitPaths(['diff', '--name-only', '--diff-filter=ACMRTUXB'])) {
  addFormatPath(changedPath);
}

for (const changedPath of await collectGitPaths(['diff', '--cached', '--name-only', '--diff-filter=ACMRTUXB'])) {
  addFormatPath(changedPath);
}

for (const changedPath of await collectGitPaths(['ls-files', '--others', '--exclude-standard'])) {
  if (isAllowedUntrackedPath(changedPath)) {
    addFormatPath(changedPath);
  }
}

const formatPaths = [...changedPaths].sort();
if (formatPaths.length === 0) {
  console.log('No changed files to format.');
  process.exit(0);
}

const subprocess = Bun.spawn({
  cmd: ['bun', 'x', 'biome', 'format', '--write', '--no-errors-on-unmatched', ...formatPaths],
  stderr: 'inherit',
  stdout: 'inherit',
});

process.exit(await subprocess.exited);

function addFormatPath(changedPath: string): void {
  const normalizedPath = changedPath.replace(/\\/g, '/');
  const lowerCasePath = normalizedPath.toLowerCase();
  if (READ_ONLY_ROOTS.some((readOnlyRoot) => lowerCasePath.startsWith(readOnlyRoot))) {
    return;
  }

  changedPaths.add(normalizedPath);
}

async function collectGitPaths(gitArguments: readonly string[]): Promise<readonly string[]> {
  const subprocess = Bun.spawn({
    cmd: ['git', ...gitArguments],
    stderr: 'pipe',
    stdout: 'pipe',
  });

  const [standardErrorText, standardOutputText, exitCode] = await Promise.all([new Response(subprocess.stderr).text(), new Response(subprocess.stdout).text(), subprocess.exited]);

  if (exitCode !== 0) {
    throw new Error(`git ${gitArguments.join(' ')} failed with exit code ${exitCode}: ${standardErrorText.trim()}`);
  }

  return standardOutputText.split(/\r?\n/).filter((line) => line.length > 0);
}

function isAllowedUntrackedPath(changedPath: string): boolean {
  const normalizedPath = changedPath.replace(/\\/g, '/');
  return UNTRACKED_FORMAT_FILES.some((formatFile) => normalizedPath === formatFile) || UNTRACKED_FORMAT_ROOTS.some((formatRoot) => normalizedPath.startsWith(formatRoot));
}
