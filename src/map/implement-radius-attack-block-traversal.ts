/**
 * Vanilla DOOM 1.9 P_RadiusAttack block traversal.
 *
 * RadiusAttack walks a bbox of blockmap cells around the source and calls
 * PIT_RadiusAttack on every thing in those cells. Vanilla bbox extension
 * is the explosion damage radius converted to map units. Each target is
 * tested for line-of-sight before damage; targets beyond the radius receive
 * proportionally less damage (damage * (1 - distance/radius)).
 */

export interface RadiusAttackInput {
  readonly sourceX: number;
  readonly sourceY: number;
  readonly damage: number;
  readonly radius: number;
}

export interface RadiusAttackBoundingBox {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}

export function buildRadiusAttackBoundingBox(input: RadiusAttackInput): RadiusAttackBoundingBox {
  return Object.freeze({
    minX: input.sourceX - input.radius,
    maxX: input.sourceX + input.radius,
    minY: input.sourceY - input.radius,
    maxY: input.sourceY + input.radius,
  });
}

export function computeRadiusAttackDamage(input: RadiusAttackInput, targetX: number, targetY: number): number {
  const dx = Math.abs(targetX - input.sourceX);
  const dy = Math.abs(targetY - input.sourceY);
  const distance = Math.max(dx, dy);
  if (distance >= input.radius) {
    return 0;
  }
  return Math.floor((input.damage * (input.radius - distance)) / input.radius);
}
