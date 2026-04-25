import { computeClientDimensions, SCREENHEIGHT, SCREENWIDTH } from '../../host/windowPolicy.ts';

const TARGET_RUNTIME_PROGRAM = 'bun';
const TARGET_RUNTIME_SUBCOMMAND = 'run';
const TARGET_RUNTIME_ENTRY_FILE = 'doom.ts';
const TARGET_RUNTIME_COMMAND = `${TARGET_RUNTIME_PROGRAM} ${TARGET_RUNTIME_SUBCOMMAND} ${TARGET_RUNTIME_ENTRY_FILE}` as const;

const CURRENT_LAUNCHER_COMMAND = 'bun run src/main.ts' as const;
const CURRENT_HOST_FILE = 'src/launcher/win32.ts' as const;
const CURRENT_HOST_FUNCTION = 'runLauncherWindow' as const;
const CURRENT_INITIAL_VIEW = 'gameplay' as const;
const CURRENT_TOGGLE_VIEW_CONTROL = 'Tab' as const;
const CURRENT_TITLE_TEMPLATE = 'DOOM Codex - ${session.mapName}' as const;

const DEFAULT_SCALE = 2;
const WINDOW_CLASS_NAME = 'STATIC' as const;
const WINDOW_CREATE_LIBRARY = 'user32.dll' as const;
const WINDOW_CREATE_SYMBOL = 'CreateWindowExW' as const;
const WINDOW_SHOW_COMMAND = 5 as const;
const WINDOW_STYLE_HEX = '0x10cf0000' as const;
const WIDE_STRING_ENCODING = 'utf16le' as const;
const TITLE_POLICY_DEFERRED_STEP = '04-002' as const;

const DEFAULT_CLIENT_SIZE = computeClientDimensions(DEFAULT_SCALE, true);

type CreateBunCompatibleWin32WindowContract = {
  readonly bunCompatibility: {
    readonly createWindowLibrary: typeof WINDOW_CREATE_LIBRARY;
    readonly createWindowSymbol: typeof WINDOW_CREATE_SYMBOL;
    readonly foreignFunctionInterfaceModule: 'bun:ffi';
    readonly wideStringEncoding: typeof WIDE_STRING_ENCODING;
    readonly windowClassName: typeof WINDOW_CLASS_NAME;
  };
  readonly currentLauncherTransition: {
    readonly currentLauncherCommand: typeof CURRENT_LAUNCHER_COMMAND;
    readonly hostFile: typeof CURRENT_HOST_FILE;
    readonly hostFunction: typeof CURRENT_HOST_FUNCTION;
    readonly initialView: typeof CURRENT_INITIAL_VIEW;
    readonly titleTemplate: typeof CURRENT_TITLE_TEMPLATE;
    readonly toggleViewControl: typeof CURRENT_TOGGLE_VIEW_CONTROL;
  };
  readonly currentWindowImplementation: {
    readonly windowShowCommand: typeof WINDOW_SHOW_COMMAND;
    readonly windowStyleHex: typeof WINDOW_STYLE_HEX;
  };
  readonly deterministicReplayCompatibility: {
    readonly createsNativeWindowOnly: true;
    readonly loadsNoIwadBytes: true;
    readonly mutatesNoGameplayState: true;
    readonly mutatesNoGlobalRandomSeed: true;
    readonly readsNoReplayInput: true;
    readonly requiresLaterStepsForPresentation: readonly ['04-004', '04-010'];
  };
  readonly stepId: '04-001';
  readonly stepTitle: 'create-bun-compatible-win32-window';
  readonly targetRuntime: {
    readonly entryFile: typeof TARGET_RUNTIME_ENTRY_FILE;
    readonly program: typeof TARGET_RUNTIME_PROGRAM;
    readonly runtimeCommand: typeof TARGET_RUNTIME_COMMAND;
    readonly subcommand: typeof TARGET_RUNTIME_SUBCOMMAND;
  };
  readonly windowPolicy: {
    readonly aspectRatioCorrect: true;
    readonly defaultClientHeight: number;
    readonly defaultClientWidth: number;
    readonly defaultScale: typeof DEFAULT_SCALE;
    readonly screenHeight: typeof SCREENHEIGHT;
    readonly screenWidth: typeof SCREENWIDTH;
  };
};

const createBunCompatibleWin32WindowContract = {
  bunCompatibility: {
    createWindowLibrary: WINDOW_CREATE_LIBRARY,
    createWindowSymbol: WINDOW_CREATE_SYMBOL,
    foreignFunctionInterfaceModule: 'bun:ffi',
    wideStringEncoding: WIDE_STRING_ENCODING,
    windowClassName: WINDOW_CLASS_NAME,
  },
  currentLauncherTransition: {
    currentLauncherCommand: CURRENT_LAUNCHER_COMMAND,
    hostFile: CURRENT_HOST_FILE,
    hostFunction: CURRENT_HOST_FUNCTION,
    initialView: CURRENT_INITIAL_VIEW,
    titleTemplate: CURRENT_TITLE_TEMPLATE,
    toggleViewControl: CURRENT_TOGGLE_VIEW_CONTROL,
  },
  currentWindowImplementation: {
    windowShowCommand: WINDOW_SHOW_COMMAND,
    windowStyleHex: WINDOW_STYLE_HEX,
  },
  deterministicReplayCompatibility: {
    createsNativeWindowOnly: true,
    loadsNoIwadBytes: true,
    mutatesNoGameplayState: true,
    mutatesNoGlobalRandomSeed: true,
    readsNoReplayInput: true,
    requiresLaterStepsForPresentation: ['04-004', '04-010'] as const,
  },
  stepId: '04-001',
  stepTitle: 'create-bun-compatible-win32-window',
  targetRuntime: {
    entryFile: TARGET_RUNTIME_ENTRY_FILE,
    program: TARGET_RUNTIME_PROGRAM,
    runtimeCommand: TARGET_RUNTIME_COMMAND,
    subcommand: TARGET_RUNTIME_SUBCOMMAND,
  },
  windowPolicy: {
    aspectRatioCorrect: true,
    defaultClientHeight: DEFAULT_CLIENT_SIZE.height,
    defaultClientWidth: DEFAULT_CLIENT_SIZE.width,
    defaultScale: DEFAULT_SCALE,
    screenHeight: SCREENHEIGHT,
    screenWidth: SCREENWIDTH,
  },
} as const satisfies CreateBunCompatibleWin32WindowContract;

export const CREATE_BUN_COMPATIBLE_WIN32_WINDOW_CONTRACT = Object.freeze(createBunCompatibleWin32WindowContract);

export interface CreateBunCompatibleWin32WindowOptions {
  readonly command: string;
  readonly scale?: number;
  readonly title: string;
}

export interface CreateBunCompatibleWin32WindowPlan {
  readonly aspectRatioCorrect: true;
  readonly clientSize: Readonly<{ height: number; width: number }>;
  readonly command: typeof TARGET_RUNTIME_COMMAND;
  readonly createWindowLibrary: typeof WINDOW_CREATE_LIBRARY;
  readonly createWindowSymbol: typeof WINDOW_CREATE_SYMBOL;
  readonly currentLauncherCommand: typeof CURRENT_LAUNCHER_COMMAND;
  readonly foreignFunctionInterfaceModule: 'bun:ffi';
  readonly initialView: typeof CURRENT_INITIAL_VIEW;
  readonly requestedScale: number;
  readonly title: string;
  readonly titlePolicyDeferredStep: typeof TITLE_POLICY_DEFERRED_STEP;
  readonly wideStringEncoding: typeof WIDE_STRING_ENCODING;
  readonly windowClassName: typeof WINDOW_CLASS_NAME;
  readonly windowShowCommand: typeof WINDOW_SHOW_COMMAND;
  readonly windowStyleHex: typeof WINDOW_STYLE_HEX;
}

function validateTargetRuntimeCommand(command: string): asserts command is typeof TARGET_RUNTIME_COMMAND {
  if (command !== TARGET_RUNTIME_COMMAND) {
    throw new Error(`createBunCompatibleWin32Window requires ${TARGET_RUNTIME_COMMAND}, received ${command}`);
  }
}

function validateScale(scale: number): void {
  if (!Number.isInteger(scale) || scale < 1) {
    throw new Error(`createBunCompatibleWin32Window requires an integer scale of at least 1, received ${scale}`);
  }
}

function validateWindowTitle(title: string): void {
  if (title.trim().length === 0) {
    throw new Error('createBunCompatibleWin32Window requires a non-empty window title');
  }
}

export function createBunCompatibleWin32Window(options: CreateBunCompatibleWin32WindowOptions): CreateBunCompatibleWin32WindowPlan {
  validateTargetRuntimeCommand(options.command);
  validateWindowTitle(options.title);

  const requestedScale = options.scale ?? CREATE_BUN_COMPATIBLE_WIN32_WINDOW_CONTRACT.windowPolicy.defaultScale;

  validateScale(requestedScale);

  return Object.freeze({
    aspectRatioCorrect: CREATE_BUN_COMPATIBLE_WIN32_WINDOW_CONTRACT.windowPolicy.aspectRatioCorrect,
    clientSize: computeClientDimensions(requestedScale, CREATE_BUN_COMPATIBLE_WIN32_WINDOW_CONTRACT.windowPolicy.aspectRatioCorrect),
    command: CREATE_BUN_COMPATIBLE_WIN32_WINDOW_CONTRACT.targetRuntime.runtimeCommand,
    createWindowLibrary: CREATE_BUN_COMPATIBLE_WIN32_WINDOW_CONTRACT.bunCompatibility.createWindowLibrary,
    createWindowSymbol: CREATE_BUN_COMPATIBLE_WIN32_WINDOW_CONTRACT.bunCompatibility.createWindowSymbol,
    currentLauncherCommand: CREATE_BUN_COMPATIBLE_WIN32_WINDOW_CONTRACT.currentLauncherTransition.currentLauncherCommand,
    foreignFunctionInterfaceModule: CREATE_BUN_COMPATIBLE_WIN32_WINDOW_CONTRACT.bunCompatibility.foreignFunctionInterfaceModule,
    initialView: CREATE_BUN_COMPATIBLE_WIN32_WINDOW_CONTRACT.currentLauncherTransition.initialView,
    requestedScale,
    title: options.title,
    titlePolicyDeferredStep: TITLE_POLICY_DEFERRED_STEP,
    wideStringEncoding: CREATE_BUN_COMPATIBLE_WIN32_WINDOW_CONTRACT.bunCompatibility.wideStringEncoding,
    windowClassName: CREATE_BUN_COMPATIBLE_WIN32_WINDOW_CONTRACT.bunCompatibility.windowClassName,
    windowShowCommand: CREATE_BUN_COMPATIBLE_WIN32_WINDOW_CONTRACT.currentWindowImplementation.windowShowCommand,
    windowStyleHex: CREATE_BUN_COMPATIBLE_WIN32_WINDOW_CONTRACT.currentWindowImplementation.windowStyleHex,
  });
}
