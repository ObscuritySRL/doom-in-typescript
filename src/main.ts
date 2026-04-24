import { CommandLine } from './bootstrap/cmdline.ts';
import { createLauncherSession, loadLauncherResources } from './launcher/session.ts';
import { runLauncherWindow } from './launcher/win32.ts';
import { REFERENCE_BUNDLE_PATH } from './reference/policy.ts';
import { PRIMARY_TARGET } from './reference/target.ts';

const DEFAULT_MAP_NAME = 'E1M1';
const DEFAULT_LOCAL_IWAD_PATH = `${REFERENCE_BUNDLE_PATH}\\${PRIMARY_TARGET.wadFilename}`;
const DEFAULT_SCALE = 2;
const DEFAULT_SKILL = 2;

const HELP_TEXT = [
  'DOOM Codex launcher',
  '',
  'Usage:',
  '  bun run start -- [--iwad <path-to-iwad>] [--map E1M1] [--skill 2] [--scale 2]',
  '  bun run start -- [--iwad <path-to-iwad>] --list-maps',
  '',
  'Controls:',
  '  W/S or Up/Down: move forward or backward',
  '  A/D or Left/Right: turn left or right',
  '  Q/E: strafe left or right',
  '  Shift: run',
  '  Tab: toggle gameplay view and automap',
  '  PageUp/PageDown: zoom the automap',
  '  F: toggle automap follow',
  '  Esc: quit',
  '',
  'Notes:',
  `  Defaults to ${DEFAULT_LOCAL_IWAD_PATH} when --iwad is omitted.`,
  '  The launcher now starts in the gameplay view and can switch to automap on demand.',
].join('\n');

async function main(): Promise<void> {
  const commandLine = new CommandLine(Bun.argv);

  if (commandLine.parameterExists('--help') || commandLine.parameterExists('-help') || commandLine.parameterExists('-h')) {
    console.log(HELP_TEXT);
    return;
  }

  const iwadPath = commandLine.getParameter('--iwad') ?? (await resolveDefaultIwadPath());

  if (iwadPath === null) {
    throw new Error('Missing required --iwad <path-to-iwad> argument.\n\n' + HELP_TEXT);
  }

  const resources = await loadLauncherResources(iwadPath);

  if (commandLine.parameterExists('--list-maps')) {
    console.log(resources.mapNames.join('\n'));
    return;
  }

  const mapName = (commandLine.getParameter('--map') ?? DEFAULT_MAP_NAME).toUpperCase();
  const scale = parseIntegerParameter(commandLine, '--scale', DEFAULT_SCALE);
  const skill = parseIntegerParameter(commandLine, '--skill', DEFAULT_SKILL);
  const session = createLauncherSession(resources, {
    mapName,
    skill,
  });

  console.log(`Launching ${session.mapName} from ${resources.iwadPath}`);
  console.log('Opening gameplay window. Use Tab to switch to the automap.');

  await runLauncherWindow(session, {
    scale,
    title: `DOOM Codex - ${session.mapName}`,
  });
}

function parseIntegerParameter(commandLine: CommandLine, parameterName: string, fallbackValue: number): number {
  const rawValue = commandLine.getParameter(parameterName);

  if (rawValue === null) {
    return fallbackValue;
  }

  const parsedValue = Number.parseInt(rawValue, 10);

  if (!Number.isInteger(parsedValue)) {
    throw new Error(`${parameterName} must be an integer, got "${rawValue}".`);
  }

  return parsedValue;
}

async function resolveDefaultIwadPath(): Promise<string | null> {
  const localIwad = Bun.file(DEFAULT_LOCAL_IWAD_PATH);

  if (await localIwad.exists()) {
    return DEFAULT_LOCAL_IWAD_PATH;
  }

  return null;
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);

  console.error(message);
  process.exit(1);
});
