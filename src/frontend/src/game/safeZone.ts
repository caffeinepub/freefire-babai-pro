import type { SafeZone } from "./gameState";
import { WORLD_H, WORLD_W } from "./gameState";

export const SAFE_ZONE_STAGES = [
  { radius: WORLD_W * 0.45, delay: 0 },
  { radius: WORLD_W * 0.32, delay: 45000 },
  { radius: WORLD_W * 0.22, delay: 45000 },
  { radius: WORLD_W * 0.14, delay: 45000 },
  { radius: WORLD_W * 0.07, delay: 45000 },
  { radius: 80, delay: 45000 },
];

export function makeInitialSafeZone(): SafeZone {
  return {
    x: WORLD_W / 2,
    y: WORLD_H * 0.55,
    radius: SAFE_ZONE_STAGES[0].radius,
    targetRadius: SAFE_ZONE_STAGES[0].radius,
  };
}

export function tickSafeZone(sz: SafeZone, delta: number): void {
  if (sz.radius > sz.targetRadius) {
    sz.radius = Math.max(sz.targetRadius, sz.radius - delta * 0.5);
  }
}

export function isInsideSafeZone(
  px: number,
  py: number,
  sz: SafeZone,
): boolean {
  const dx = px - sz.x;
  const dy = py - sz.y;
  return Math.sqrt(dx * dx + dy * dy) <= sz.radius;
}
