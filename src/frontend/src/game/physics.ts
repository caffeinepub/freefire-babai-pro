import type {
  LocalGameState,
  Particle,
  PlayerState,
  Projectile,
  VehicleState,
} from "./gameState";
import {
  AIR_RESIST,
  FRICTION,
  GRAVITY,
  GROUND_Y,
  INTERACT_DIST,
  JUMP_FORCE,
  RUN_SPEED,
  SPRINT_SPEED,
  WORLD_H,
  WORLD_W,
} from "./gameState";
import { WEAPON_DEFS } from "./gameState";

export interface InputState {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  sprint: boolean;
  shoot: boolean;
  interact: boolean;
  slot1: boolean;
  slot2: boolean;
  slot3: boolean;
}

const VEHICLE_HEIGHTS: Record<string, number> = {
  jet: 22,
  tank: 44,
  bike: 28,
  buggy: 36,
};

export function stepPlayer(
  p: PlayerState,
  input: InputState,
  gs: LocalGameState,
  _dt: number,
  _isMe: boolean,
): void {
  if (!p.isAlive || p.inVehicle) return;

  const speed = input.sprint ? SPRINT_SPEED : RUN_SPEED;

  // Horizontal movement
  if (input.left) {
    p.vx -= (speed - Math.abs(p.vx)) * 0.35;
    p.facingRight = false;
  } else if (input.right) {
    p.vx += (speed - Math.abs(p.vx)) * 0.35;
    p.facingRight = true;
  }

  // Jump
  if (input.up && p.isOnGround) {
    p.vy = JUMP_FORCE;
    p.isOnGround = false;
  }

  // Gravity
  if (!p.isOnGround) {
    p.vy += GRAVITY;
  }

  // Friction / air resistance
  if (p.isOnGround) {
    p.vx *= FRICTION;
  } else {
    p.vx *= AIR_RESIST;
  }

  // Clamp vx
  const maxV = input.sprint ? SPRINT_SPEED : RUN_SPEED;
  p.vx = Math.max(-maxV * 1.3, Math.min(maxV * 1.3, p.vx));
  p.vy = Math.min(p.vy, 22);

  // Rope swing
  if (gs.ropeAttached && gs.ropeAnchor) {
    const ax = gs.ropeAnchor.x;
    const ay = gs.ropeAnchor.y;
    const dx = p.x - ax;
    const dy = p.y - ay;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const ropeLen = 120;
    if (len > ropeLen) {
      const nx = dx / len;
      const ny = dy / len;
      p.x = ax + nx * ropeLen;
      p.y = ay + ny * ropeLen;
      const dot = p.vx * nx + p.vy * ny;
      p.vx -= dot * nx * 1.2;
      p.vy -= dot * ny * 1.2;
    }
  }

  // Integrate position
  p.x += p.vx;
  p.y += p.vy;

  // World bounds
  p.x = Math.max(20, Math.min(WORLD_W - 20, p.x));

  // Ground collision
  p.isOnGround = false;
  if (p.y >= GROUND_Y - 40) {
    p.y = GROUND_Y - 40;
    p.vy = 0;
    p.isOnGround = true;
  }

  // Platform collision
  for (const plat of gs.platforms) {
    if (
      p.x + 14 > plat.x &&
      p.x - 14 < plat.x + plat.w &&
      p.y > plat.y - 32 &&
      p.y - p.vy <= plat.y &&
      p.vy >= 0
    ) {
      p.y = plat.y - 1;
      p.vy = 0;
      p.isOnGround = true;
    }
  }

  // Keep above world
  if (p.y < 20) {
    p.y = 20;
    p.vy = Math.abs(p.vy) * 0.3;
  }

  // Animation state
  if (!p.isOnGround) {
    p.animState = "jump";
  } else if (Math.abs(p.vx) > 0.5) {
    p.animState = "run";
  } else {
    p.animState = "idle";
  }

  p.animFrame = (p.animFrame + 1) % 60;
  if (p.hitFlash > 0) p.hitFlash--;
}

export function stepVehicle(
  v: VehicleState,
  input: InputState,
  gs: LocalGameState,
): void {
  if (!v.driverId) {
    // Stationary vehicle gravity
    if (!v.onGround) {
      v.vy += GRAVITY;
      v.y += v.vy;
    }
    const h = VEHICLE_HEIGHTS[v.type] || 30;
    if (v.y >= GROUND_Y - h) {
      v.y = GROUND_Y - h;
      v.vy = 0;
      v.onGround = true;
    }
    return;
  }

  if (v.type === "jet") {
    const jspeed = 7;
    if (input.left) {
      v.vx -= (jspeed - Math.abs(v.vx)) * 0.2;
      v.facingRight = false;
    }
    if (input.right) {
      v.vx += (jspeed - Math.abs(v.vx)) * 0.2;
      v.facingRight = true;
    }
    if (input.up) v.vy -= 0.5;
    if (input.down) v.vy += 0.5;
    v.vx *= 0.93;
    v.vy *= 0.93;
    v.vx = Math.max(-jspeed, Math.min(jspeed, v.vx));
    v.vy = Math.max(-jspeed, Math.min(jspeed, v.vy));
    v.x += v.vx;
    v.y += v.vy;
    v.x = Math.max(20, Math.min(WORLD_W - 20, v.x));
    v.y = Math.max(40, Math.min(GROUND_Y - 40, v.y));
    v.onGround = false;
  } else {
    // Ground vehicles
    const spd =
      v.type === "bike"
        ? RUN_SPEED * 2
        : v.type === "buggy"
          ? RUN_SPEED * 1.5
          : RUN_SPEED * 1.2;
    if (input.left) {
      v.vx -= (spd - Math.abs(v.vx)) * 0.3;
      v.facingRight = false;
    }
    if (input.right) {
      v.vx += (spd - Math.abs(v.vx)) * 0.3;
      v.facingRight = true;
    }
    if (input.up && v.onGround) {
      v.vy = v.type === "bike" ? JUMP_FORCE * 0.9 : JUMP_FORCE * 0.7;
      v.onGround = false;
    }
    v.vx *= FRICTION;
    v.vy += GRAVITY;
    v.vy = Math.min(v.vy, 22);
    v.x += v.vx;
    v.y += v.vy;
    v.x = Math.max(20, Math.min(WORLD_W - 20, v.x));
    v.onGround = false;
    const h = VEHICLE_HEIGHTS[v.type] || 30;
    if (v.y >= GROUND_Y - h) {
      v.y = GROUND_Y - h;
      v.vy = 0;
      v.onGround = true;
    }
    for (const plat of gs.platforms) {
      if (
        v.x + 24 > plat.x &&
        v.x - 24 < plat.x + plat.w &&
        v.y + h > plat.y - 8 &&
        v.y + h - v.vy <= plat.y + 4 &&
        v.vy >= 0
      ) {
        v.y = plat.y - h;
        v.vy = 0;
        v.onGround = true;
      }
    }
    if (v.y < 20) {
      v.y = 20;
      v.vy = Math.abs(v.vy) * 0.3;
    }
  }
}

export function stepProjectile(proj: Projectile, _gs: LocalGameState): boolean {
  if (proj.type === "grenade") {
    proj.vy += GRAVITY * 0.7;
  }
  proj.x += proj.vx;
  proj.y += proj.vy;
  proj.life--;
  if (proj.life <= 0) return false;
  if (proj.x < 0 || proj.x > WORLD_W || proj.y > GROUND_Y + 20 || proj.y < 0)
    return false;
  return true;
}

export function checkPickup(p: PlayerState, gs: LocalGameState): void {
  for (const wp of gs.weapons) {
    if (!wp.available) continue;
    const dx = p.x - wp.x;
    const dy = p.y - wp.y;
    if (Math.sqrt(dx * dx + dy * dy) < 35) {
      wp.available = false;
      // find empty slot or replace slot 2
      const emptyIdx = p.weapons.findIndex((w) => !w);
      const slotIdx =
        emptyIdx >= 0 ? emptyIdx : p.activeSlot < 3 ? p.activeSlot : 0;
      p.weapons[slotIdx] = wp.type;
      p.ammo[slotIdx] = WEAPON_DEFS[wp.type].ammo;
    }
  }
}

export function findNearbyVehicle(
  p: PlayerState,
  vehicles: Record<string, VehicleState>,
): string | null {
  for (const [id, v] of Object.entries(vehicles)) {
    if (v.driverId && v.driverId !== p.id) continue;
    if (v.driverId === p.id) continue; // already driving
    const dx = p.x - v.x;
    const dy = p.y - v.y;
    if (Math.sqrt(dx * dx + dy * dy) < INTERACT_DIST) return id;
  }
  return null;
}

export function enterVehicle(p: PlayerState, v: VehicleState): void {
  p.inVehicle = v.type;
  p.vehicleId = v.id;
  v.driverId = p.id;
}

export function exitVehicle(p: PlayerState, v: VehicleState): void {
  p.x = v.x + (v.facingRight ? 60 : -60);
  p.y = v.y;
  p.vx = v.vx * 0.3;
  p.vy = -3;
  p.inVehicle = null;
  p.vehicleId = null;
  v.driverId = null;
}

export function spawnParticles(
  particles: Particle[],
  x: number,
  y: number,
  color: string,
  count: number,
  explosive: boolean,
): void {
  const cap = 50;
  for (let i = 0; i < count && particles.length < cap; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = explosive ? Math.random() * 6 + 2 : Math.random() * 3 + 0.5;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - (explosive ? 2 : 0),
      life: explosive ? 40 : 20,
      maxLife: explosive ? 40 : 20,
      color,
      size: explosive ? Math.random() * 4 + 2 : Math.random() * 3 + 1,
    });
  }
}

export function stepParticles(particles: Particle[]): void {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += GRAVITY * 0.4;
    p.life--;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

export function checkProjectileHit(
  proj: Projectile,
  players: Record<string, PlayerState>,
  vehicles: Record<string, VehicleState>,
  particles: Particle[],
  killFeed: { killer: string; victim: string; weapon: string; ts: number }[],
  myId: string,
): boolean {
  const splashR = proj.type === "rocket" || proj.type === "grenade" ? 80 : 0;
  const def = WEAPON_DEFS[proj.type];

  if (splashR > 0) {
    // Splash damage
    let hit = false;
    for (const p of Object.values(players)) {
      if (!p.isAlive || p.id === proj.ownerId) continue;
      const dx = p.x - proj.x;
      const dy = p.y - proj.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < splashR) {
        const dmg = Math.floor(def.damage * (1 - dist / splashR));
        p.hp -= dmg;
        p.hitFlash = 12;
        spawnParticles(particles, proj.x, proj.y, "#ff8800", 18, true);
        if (p.hp <= 0 && p.isAlive) {
          p.hp = 0;
          p.isAlive = false;
          p.animState = "dead";
          if (proj.ownerId === myId) {
            killFeed.unshift({
              killer: players[proj.ownerId]?.name ?? "?",
              victim: p.name,
              weapon: proj.type,
              ts: Date.now(),
            });
          }
        }
        hit = true;
      }
    }
    for (const v of Object.values(vehicles)) {
      if (!v.driverId) continue;
      const dx = v.x - proj.x;
      const dy = v.y - proj.y;
      if (Math.sqrt(dx * dx + dy * dy) < splashR + 30) {
        v.hp -= def.damage;
        spawnParticles(particles, proj.x, proj.y, "#ff8800", 12, true);
        hit = true;
      }
    }
    return hit;
  }
  // Direct hit
  for (const p of Object.values(players)) {
    if (!p.isAlive || p.id === proj.ownerId) continue;
    const dx = p.x - proj.x;
    const dy = p.y - proj.y;
    if (Math.sqrt(dx * dx + dy * dy) < 18) {
      p.hp -= def.damage;
      p.hitFlash = 8;
      spawnParticles(particles, proj.x, proj.y, "#ff4444", 5, false);
      if (p.hp <= 0 && p.isAlive) {
        p.hp = 0;
        p.isAlive = false;
        p.animState = "dead";
        if (proj.ownerId === myId) {
          killFeed.unshift({
            killer: players[proj.ownerId]?.name ?? "?",
            victim: p.name,
            weapon: proj.type,
            ts: Date.now(),
          });
        }
      }
      return true;
    }
  }
  for (const v of Object.values(vehicles)) {
    const dx = v.x - proj.x;
    const dy = v.y - proj.y;
    if (Math.sqrt(dx * dx + dy * dy) < 35) {
      v.hp -= def.damage;
      spawnParticles(particles, proj.x, proj.y, "#ff8800", 5, false);
      return true;
    }
  }
  return false;
}
