/**
 * Vanilla DOOM 1.9 P_CheckSight REJECT fast-path contract.
 *
 * Before running the expensive BSP line-of-sight trace, P_CheckSight indexes
 * into the REJECT lump bitmap with (s1 * numSectors + s2). The REJECT
 * bitmap is sectorCount * sectorCount bits; a set bit means s1 and s2 are
 * REJECTED (proven mutually invisible). When the bit is set, sight returns
 * false immediately without the trace.
 */

export interface RejectFastPathInput {
  readonly sourceSectorIndex: number;
  readonly targetSectorIndex: number;
  readonly sectorCount: number;
  readonly rejectBitmap: Uint8Array;
}

export type RejectFastPathOutcome = 'rejected' | 'requires-trace';

export function rejectBitmapByteIndex(sourceSectorIndex: number, targetSectorIndex: number, sectorCount: number): number {
  return (sourceSectorIndex * sectorCount + targetSectorIndex) >> 3;
}

export function rejectBitmapBitOffset(sourceSectorIndex: number, targetSectorIndex: number, sectorCount: number): number {
  return (sourceSectorIndex * sectorCount + targetSectorIndex) & 7;
}

export function evaluateRejectFastPath(input: RejectFastPathInput): RejectFastPathOutcome {
  if (input.sourceSectorIndex < 0 || input.sourceSectorIndex >= input.sectorCount) {
    return 'requires-trace';
  }
  if (input.targetSectorIndex < 0 || input.targetSectorIndex >= input.sectorCount) {
    return 'requires-trace';
  }
  const byteIndex = rejectBitmapByteIndex(input.sourceSectorIndex, input.targetSectorIndex, input.sectorCount);
  const bitOffset = rejectBitmapBitOffset(input.sourceSectorIndex, input.targetSectorIndex, input.sectorCount);
  if (byteIndex >= input.rejectBitmap.length) {
    return 'requires-trace';
  }
  const byteValue = input.rejectBitmap[byteIndex] ?? 0;
  return (byteValue & (1 << bitOffset)) !== 0 ? 'rejected' : 'requires-trace';
}
