import type { LocalGameState, PlayerState, Projectile } from "./gameState";
import { WEAPON_DEFS } from "./gameState";

let _projId = 0;

export function tryFire(
  p: PlayerState,
  gs: LocalGameState,
  aimX: number,
  aimY: number,
  now: number,
): Projectile | null {
  const wep = p.weapons[p.activeSlot];
  if (!wep) return null;
  const def = WEAPON_DEFS[wep];
  if (now - gs.lastFireTime < def.fireRate) return null;

  // Melee weapons
  if (wep === "bat") {
    gs.lastFireTime = now;
    p.animState = "attack";
    // Deal melee damage to nearby enemies
    for (const other of Object.values(gs.players)) {
      if (!other.isAlive || other.id === p.id) continue;
      const dx = other.x - p.x;
      const dy = other.y - p.y;
      if (
        Math.abs(dx) < 50 &&
        Math.abs(dy) < 50 &&
        Math.sign(dx) === (p.facingRight ? 1 : -1)
      ) {
        other.hp -= def.damage;
        other.hitFlash = 10;
        other.vx += p.facingRight ? 5 : -5;
        if (other.hp <= 0) {
          other.hp = 0;
          other.isAlive = false;
          other.animState = "dead";
        }
      }
    }
    return null;
  }

  if (def.ammo !== 999) {
    if (p.ammo[p.activeSlot] <= 0) return null;
    p.ammo[p.activeSlot]--;
    if (p.ammo[p.activeSlot] <= 0) {
      p.weapons[p.activeSlot] = "" as any;
    }
  }

  gs.lastFireTime = now;

  const dx = aimX - p.x;
  const dy = aimY - p.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = dx / len;
  const ny = dy / len;

  const spread = (Math.random() - 0.5) * 2 * def.spread;
  const angle = Math.atan2(ny, nx) + spread;
  const vx = Math.cos(angle) * def.projectileSpeed;
  const vy = Math.sin(angle) * def.projectileSpeed;

  if (wep === "rope") {
    // Throw rope to anchor point
    gs.ropeAnchor = { x: aimX, y: aimY };
    gs.ropeAttached = true;
    return null;
  }

  return {
    id: `proj${_projId++}`,
    ownerId: p.id,
    x: p.x + (p.facingRight ? 20 : -20),
    y: p.y - 20,
    vx,
    vy,
    type: wep,
    life: wep === "grenade" ? 80 : wep === "rocket" ? 120 : 60,
    isExplosive: wep === "rocket" || wep === "grenade",
  };
}

export function tryFireVehicle(
  v: {
    type: string;
    x: number;
    y: number;
    facingRight: boolean;
    driverId: string;
  },
  now: number,
  lastFireTime: number,
): Projectile | null {
  const cooldown = v.type === "tank" ? 1500 : 800;
  if (now - lastFireTime < cooldown) return null;

  const dir = v.facingRight ? 1 : -1;
  if (v.type === "tank") {
    return {
      id: `proj${_projId++}`,
      ownerId: v.driverId,
      x: v.x + dir * 60,
      y: v.y - 22,
      vx: dir * 8,
      vy: -1,
      type: "rocket",
      life: 120,
      isExplosive: true,
    };
  }
  if (v.type === "jet") {
    return {
      id: `proj${_projId++}`,
      ownerId: v.driverId,
      x: v.x + dir * 60,
      y: v.y,
      vx: dir * 16,
      vy: 0,
      type: "rocket",
      life: 90,
      isExplosive: true,
    };
  }
  return null;
}
