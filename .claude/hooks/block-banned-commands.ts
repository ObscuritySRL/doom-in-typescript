import { readFileSync } from 'node:fs';

interface HookInput {
  tool_input?: {
    command?: string;
  };
}

const bannedRuntimes = new Set(['jest', 'mocha', 'node', 'npm', 'npx', 'pnpm', 'ts-node', 'tsx', 'vitest', 'yarn']);

const input = readFileSync(0, 'utf8');
const data = JSON.parse(input) as HookInput;
const command = data.tool_input?.command ?? '';

if (!command) {
  process.exit(0);
}

function splitRespectingQuotes(source: string): readonly string[] {
  const result: string[] = [];
  let current = '';
  let quote: "'" | '"' | null = null;
  let index = 0;
  while (index < source.length) {
    const char = source[index];
    if (quote) {
      if (char === quote) quote = null;
      current += char;
      index += 1;
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      current += char;
      index += 1;
      continue;
    }
    if (char === ';' || char === '&' || char === '|') {
      while (index + 1 < source.length && (source[index + 1] === ';' || source[index + 1] === '&' || source[index + 1] === '|')) {
        index += 1;
      }
      const trimmed = current.trim();
      if (trimmed) result.push(trimmed);
      current = '';
      index += 1;
      continue;
    }
    current += char;
    index += 1;
  }
  const tail = current.trim();
  if (tail) result.push(tail);
  return result;
}

const segments = splitRespectingQuotes(command);

function commandTokens(segment: string): readonly string[] {
  return segment.split(/\s+/).filter((token) => !/^[A-Z_][A-Z0-9_]*=/.test(token));
}

function findBannedRuntime(segment: string): string | null {
  const first = commandTokens(segment)[0] ?? '';
  return bannedRuntimes.has(first) ? first : null;
}

function findGitAntiPattern(segment: string): string | null {
  const tokens = commandTokens(segment);
  if (tokens[0] !== 'git') return null;
  const rest = tokens.slice(1).join(' ');
  if (/^add\s+(-A\b|--all\b|\.(\s|$))/.test(rest) || rest === 'add .' || rest === 'add -A' || rest === 'add --all') return "'git add -A' / 'git add .' is banned — stage files by path per AGENTS.md";
  if (/(^|\s)--no-verify(\s|$)/.test(rest)) return "'--no-verify' skips hooks — banned unless explicitly authorized";
  if (/^push(\s|$)/.test(rest) && /(^|\s)(--force|-f)(\s|$)/.test(rest)) return "'git push --force' is destructive and not authorized";
  return null;
}

for (const segment of segments) {
  const runtime = findBannedRuntime(segment);
  if (runtime) {
    process.stderr.write(`BLOCKED: '${runtime}' is banned per AGENTS.md Runtime section.\n`);
    process.stderr.write(`Use 'bun', 'bun install', 'bun run', 'bun test', or 'bun x' instead.\n`);
    process.exit(2);
  }
  const gitIssue = findGitAntiPattern(segment);
  if (gitIssue) {
    process.stderr.write(`BLOCKED: ${gitIssue}.\n`);
    process.exit(2);
  }
}
