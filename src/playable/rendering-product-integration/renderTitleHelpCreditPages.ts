import { SCREENHEIGHT, SCREENWIDTH } from '../../render/projection.ts';

export const RENDER_TITLE_HELP_CREDIT_PAGES_COMMAND_CONTRACT = Object.freeze({
  entryFile: 'doom.ts',
  program: 'bun',
  runtimeCommand: 'bun run doom.ts',
  subcommand: 'run',
});

export const TITLE_HELP_CREDIT_FRAMEBUFFER_BYTE_LENGTH = SCREENWIDTH * SCREENHEIGHT;

export const TITLE_HELP_CREDIT_PAGE_SEQUENCE = ['TITLEPIC', 'HELP1', 'HELP2', 'CREDIT'] as const;

export type TitleHelpCreditPageName = (typeof TITLE_HELP_CREDIT_PAGE_SEQUENCE)[number];

export interface TitleHelpCreditPageRenderEvidence {
  readonly framebufferByteLength: number;
  readonly framebufferSignature: string;
  readonly pageName: TitleHelpCreditPageName;
  readonly previousPageName: TitleHelpCreditPageName | null;
  readonly renderedPixelCount: number;
  readonly runtimeCommand: string;
  readonly transitionName: string;
}

export interface TitleHelpCreditPageRenderRequest {
  readonly framebuffer: Uint8Array;
  readonly pageName: TitleHelpCreditPageName;
  readonly pages: Readonly<Record<TitleHelpCreditPageName, Uint8Array>>;
  readonly previousPageName?: TitleHelpCreditPageName | null;
  readonly runtimeCommand: string;
}

const TITLE_HELP_CREDIT_PAGE_NAME_SET: ReadonlySet<string> = new Set(TITLE_HELP_CREDIT_PAGE_SEQUENCE);

/**
 * Copy one full-screen title, help, or credit page into the playable 320x200 framebuffer.
 *
 * @param renderRequest Full-screen page source, target framebuffer, selected page, and runtime command.
 * @returns Deterministic render evidence suitable for replay assertions.
 *
 * @example
 * ```ts
 * const pagePixels = new Uint8Array(TITLE_HELP_CREDIT_FRAMEBUFFER_BYTE_LENGTH);
 * const framebuffer = new Uint8Array(TITLE_HELP_CREDIT_FRAMEBUFFER_BYTE_LENGTH);
 * renderTitleHelpCreditPages({
 *   framebuffer,
 *   pageName: "TITLEPIC",
 *   pages: { CREDIT: pagePixels, HELP1: pagePixels, HELP2: pagePixels, TITLEPIC: pagePixels },
 *   runtimeCommand: "bun run doom.ts",
 * });
 * ```
 */
export function renderTitleHelpCreditPages(renderRequest: TitleHelpCreditPageRenderRequest): TitleHelpCreditPageRenderEvidence {
  assertRuntimeCommand(renderRequest.runtimeCommand);
  assertFramebuffer(renderRequest.framebuffer);
  assertPageName(renderRequest.pageName, 'pageName');

  const previousPageName = renderRequest.previousPageName ?? null;

  if (previousPageName !== null) {
    assertPageName(previousPageName, 'previousPageName');
  }

  for (const candidatePageName of TITLE_HELP_CREDIT_PAGE_SEQUENCE) {
    assertPagePixels(candidatePageName, renderRequest.pages[candidatePageName]);
  }

  const pagePixels = renderRequest.pages[renderRequest.pageName];
  renderRequest.framebuffer.set(pagePixels);

  return {
    framebufferByteLength: renderRequest.framebuffer.byteLength,
    framebufferSignature: calculateByteSignature(renderRequest.framebuffer),
    pageName: renderRequest.pageName,
    previousPageName,
    renderedPixelCount: pagePixels.byteLength,
    runtimeCommand: renderRequest.runtimeCommand,
    transitionName: previousPageName === null ? `initial:${renderRequest.pageName}` : `${previousPageName}->${renderRequest.pageName}`,
  };
}

function assertFramebuffer(framebuffer: Uint8Array): void {
  if (!(framebuffer instanceof Uint8Array) || framebuffer.byteLength !== TITLE_HELP_CREDIT_FRAMEBUFFER_BYTE_LENGTH) {
    throw new RangeError(`Expected a 320x200 framebuffer (${TITLE_HELP_CREDIT_FRAMEBUFFER_BYTE_LENGTH} bytes).`);
  }
}

function assertPageName(pageName: unknown, fieldName: string): asserts pageName is TitleHelpCreditPageName {
  if (!isTitleHelpCreditPageName(pageName)) {
    throw new RangeError(`Expected ${fieldName} to be TITLEPIC, HELP1, HELP2, or CREDIT.`);
  }
}

function assertPagePixels(pageName: TitleHelpCreditPageName, pagePixels: Uint8Array): void {
  if (!(pagePixels instanceof Uint8Array)) {
    throw new TypeError(`Missing ${pageName} page pixels.`);
  }

  if (pagePixels.byteLength !== TITLE_HELP_CREDIT_FRAMEBUFFER_BYTE_LENGTH) {
    throw new RangeError(`Expected ${pageName} page pixels to be ${TITLE_HELP_CREDIT_FRAMEBUFFER_BYTE_LENGTH} bytes.`);
  }
}

function assertRuntimeCommand(runtimeCommand: string): void {
  if (runtimeCommand !== RENDER_TITLE_HELP_CREDIT_PAGES_COMMAND_CONTRACT.runtimeCommand) {
    throw new Error(`Expected runtime command ${RENDER_TITLE_HELP_CREDIT_PAGES_COMMAND_CONTRACT.runtimeCommand}.`);
  }
}

function calculateByteSignature(bytes: Uint8Array): string {
  let signature = 0x811c_9dc5;

  for (const byte of bytes) {
    signature ^= byte;
    signature = Math.imul(signature, 0x0100_0193) >>> 0;
  }

  return signature.toString(16).padStart(8, '0');
}

function isTitleHelpCreditPageName(value: unknown): value is TitleHelpCreditPageName {
  return typeof value === 'string' && TITLE_HELP_CREDIT_PAGE_NAME_SET.has(value);
}
