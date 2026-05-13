/**
 * Vanilla DOOM 1.9 P_TraverseIntercepts contract.
 *
 * Path traversal collects line and thing intercepts into the intercepts[]
 * array, then sorts ascending by frac (fraction along the path). A
 * MAXINTERCEPTS=128 cap limits the number; overflow truncates the list.
 * Each call returns intercepts in strict frac-ascending order; ties keep
 * insertion order (stable sort).
 */

export const VANILLA_MAXINTERCEPTS = 128;

export interface InterceptRecord {
  readonly frac: number;
  readonly kind: 'line' | 'thing';
  readonly referenceId: number;
  readonly insertionOrder: number;
}

export interface InterceptSortResult {
  readonly sorted: readonly InterceptRecord[];
  readonly truncatedAtCap: boolean;
}

export function sortAndCapIntercepts(unsorted: readonly InterceptRecord[]): InterceptSortResult {
  const capped = unsorted.length > VANILLA_MAXINTERCEPTS;
  const slice = capped ? unsorted.slice(0, VANILLA_MAXINTERCEPTS) : [...unsorted];
  const sorted = slice.slice().sort((leftRecord, rightRecord) => {
    if (leftRecord.frac !== rightRecord.frac) {
      return leftRecord.frac - rightRecord.frac;
    }
    return leftRecord.insertionOrder - rightRecord.insertionOrder;
  });
  return Object.freeze({
    sorted: Object.freeze(sorted),
    truncatedAtCap: capped,
  });
}
