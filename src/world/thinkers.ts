/**
 * Thinker list lifecycle (p_tick.c).
 *
 * Doom manages all active game entities through a circular doubly-linked
 * list of thinkers. A sentinel node (`thinkercap` in the C source) anchors
 * the ring. Each tic, {@link ThinkerList.run} walks the ring: removed
 * nodes are unlinked, live nodes have their action called.
 *
 * @example
 * ```ts
 * import { ThinkerList, ThinkerNode } from "../src/world/thinkers.ts";
 * const list = new ThinkerList();
 * const node = new ThinkerNode();
 * node.action = () => { }; // per-tic logic
 * list.add(node);
 * list.run(); // calls the action once
 * ```
 */

/**
 * Sentinel value marking a thinker for deferred removal.
 * Matches Chocolate Doom's `(actionf_v)(-1)` cast in P_RemoveThinker.
 */
export const REMOVED: unique symbol = Symbol('REMOVED');

/** Think function called once per tic for each active thinker. */
export type ThinkFunction = (thinker: ThinkerNode) => void;

/**
 * Circular doubly-linked list node matching `thinker_t` from d_think.h.
 * Concrete thinker types (mobj, ceiling, floor, etc.) extend this class.
 */
export class ThinkerNode {
  prev: ThinkerNode = this;
  next: ThinkerNode = this;
  action: ThinkFunction | typeof REMOVED | null = null;
}

/**
 * Manages the thinker linked list, mirroring the `thinkercap` sentinel
 * and the P_InitThinkers / P_AddThinker / P_RemoveThinker / P_RunThinkers
 * lifecycle from Chocolate Doom p_tick.c.
 */
export class ThinkerList {
  readonly #sentinel: ThinkerNode = new ThinkerNode();

  /** True when the list contains no thinkers. */
  get isEmpty(): boolean {
    return this.#sentinel.next === this.#sentinel;
  }

  /**
   * P_InitThinkers: reset the list to empty.
   * Called at level setup; existing nodes become orphaned.
   */
  init(): void {
    this.#sentinel.prev = this.#sentinel;
    this.#sentinel.next = this.#sentinel;
  }

  /**
   * P_AddThinker: insert a thinker at the tail of the list.
   */
  add(thinker: ThinkerNode): void {
    this.#sentinel.prev.next = thinker;
    thinker.next = this.#sentinel;
    thinker.prev = this.#sentinel.prev;
    this.#sentinel.prev = thinker;
  }

  /**
   * P_RemoveThinker: mark a thinker for deferred removal.
   * Actual unlinking happens during the next {@link run} call.
   */
  remove(thinker: ThinkerNode): void {
    thinker.action = REMOVED;
  }

  /**
   * P_RunThinkers: iterate the ring, unlink removed thinkers, and call
   * think functions for active ones.
   *
   * Parity-critical: the `next` pointer for live thinkers is captured
   * *after* calling the action, so a node added during another node's
   * action IS visited in the same tic.
   */
  run(): void {
    let current = this.#sentinel.next;
    while (current !== this.#sentinel) {
      let next: ThinkerNode;
      if (current.action === REMOVED) {
        next = current.next;
        current.next.prev = current.prev;
        current.prev.next = current.next;
      } else {
        if (current.action !== null) {
          current.action(current);
        }
        next = current.next;
      }
      current = next;
    }
  }

  /** Walk every live node without invoking actions. */
  forEach(callback: (thinker: ThinkerNode) => void): void {
    let current = this.#sentinel.next;
    while (current !== this.#sentinel) {
      callback(current);
      current = current.next;
    }
  }
}
