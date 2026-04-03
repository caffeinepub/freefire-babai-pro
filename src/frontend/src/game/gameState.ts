// ─── Game State Types ────────────────────────────────────────────────────────

export type GameMode = "solo" | "duo";
export type RoomStatus = "lobby" | "countdown" | "playing" | "gameover";
export type VehicleType = "jet" | "tank" | "bike" | "buggy";
export type WeaponType =
  | "pistol"
  | "rifle"
  | "shotgun"
  | "rocket"
  | "grenade"
  | "rope"
  | "bat";

export const PLAYER_COLORS = [
  "#58d3ff", // cyan
  "#ff4444", // red
  "#44ff88", // green
  "#ffdd44", // yellow
  "#cc44ff", // purple
  "#ff8800", // orange
  "#ff44aa", // pink
  "#ffffff", // white
];

export const WEAPON_DEFS: Record<WeaponType, WeaponDef> = {
  pistol: {
    name: "Pistol",
    damage: 15,
    fireRate: 300,
    ammo: 999,
    spread: 0.05,
    projectileSpeed: 14,
  },
  rifle: {
    name: "AR",
    damage: 25,
    fireRate: 120,
    ammo: 30,
    spread: 0.06,
    projectileSpeed: 16,
  },
  shotgun: {
    name: "Shotgun",
    damage: 50,
    fireRate: 700,
    ammo: 10,
    spread: 0.25,
    projectileSpeed: 13,
  },
  rocket: {
    name: "Rocket",
    damage: 100,
    fireRate: 1200,
    ammo: 3,
    spread: 0.01,
    projectileSpeed: 8,
  },
  grenade: {
    name: "Grenade",
    damage: 80,
    fireRate: 800,
    ammo: 3,
    spread: 0.08,
    projectileSpeed: 10,
  },
  rope: {
    name: "Rope",
    damage: 0,
    fireRate: 500,
    ammo: 999,
    spread: 0.0,
    projectileSpeed: 12,
  },
  bat: {
    name: "Bat",
    damage: 30,
    fireRate: 400,
    ammo: 999,
    spread: 0.0,
    projectileSpeed: 0,
  },
};

export interface WeaponDef {
  name: string;
  damage: number;
  fireRate: number;
  ammo: number;
  spread: number;
  projectileSpeed: number;
}

export interface Vec2 {
  x: number;
  y: number;
}

export interface PlayerState {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  isAlive: boolean;
  facingRight: boolean;
  inVehicle: null | VehicleType;
  vehicleId: null | string;
  weapons: WeaponType[];
  activeSlot: number;
  ammo: [number, number, number];
  team: null | number;
  animState: "idle" | "run" | "jump" | "attack" | "dead";
  animFrame: number;
  hitFlash: number;
  isOnGround: boolean;
}

export interface VehicleState {
  id: string;
  type: VehicleType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  driverId: null | string;
  facingRight: boolean;
  angle: number;
  onGround: boolean;
}

export interface WeaponPickup {
  id: string;
  type: WeaponType;
  x: number;
  y: number;
  available: boolean;
}

export interface Projectile {
  id: string;
  ownerId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: WeaponType;
  life: number;
  isExplosive: boolean;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export interface KillEvent {
  killer: string;
  victim: string;
  weapon: string;
  ts: number;
}

export interface Platform {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SafeZone {
  x: number;
  y: number;
  radius: number;
  targetRadius: number;
}

export interface LocalGameState {
  playerId: string;
  players: Record<string, PlayerState>;
  vehicles: Record<string, VehicleState>;
  weapons: WeaponPickup[];
  projectiles: Projectile[];
  particles: Particle[];
  platforms: Platform[];
  safeZone: SafeZone;
  killFeed: KillEvent[];
  cameraX: number;
  cameraY: number;
  mouseX: number;
  mouseY: number;
  frameCount: number;
  lastFireTime: number;
  nearbyVehicleId: null | string;
  ropeAnchor: null | Vec2;
  ropeAttached: boolean;
}

export const WORLD_W = 6000;
export const WORLD_H = 800;
export const GROUND_Y = 700;
export const GRAVITY = 0.55;
export const JUMP_FORCE = -13.5;
export const RUN_SPEED = 4;
export const SPRINT_SPEED = 6;
export const FRICTION = 0.82;
export const AIR_RESIST = 0.985;
export const INTERACT_DIST = 65;
export const CANVAS_H_RATIO = 0.85;

export function makePlatforms(): Platform[] {
  return [
    { x: 300, y: 580, w: 200, h: 20 },
    { x: 700, y: 500, w: 180, h: 20 },
    { x: 1050, y: 560, w: 150, h: 20 },
    { x: 1400, y: 480, w: 220, h: 20 },
    { x: 1800, y: 540, w: 160, h: 20 },
    { x: 2100, y: 470, w: 250, h: 20 },
    { x: 2500, y: 530, w: 180, h: 20 },
    { x: 2900, y: 490, w: 200, h: 20 },
    { x: 3200, y: 560, w: 160, h: 20 },
    { x: 3600, y: 500, w: 220, h: 20 },
    { x: 4000, y: 460, w: 180, h: 20 },
    { x: 4350, y: 540, w: 150, h: 20 },
    { x: 4700, y: 490, w: 200, h: 20 },
    { x: 5100, y: 520, w: 180, h: 20 },
    { x: 5500, y: 470, w: 150, h: 20 },
    // upper level platforms
    { x: 500, y: 420, w: 120, h: 20 },
    { x: 1200, y: 380, w: 140, h: 20 },
    { x: 2200, y: 350, w: 160, h: 20 },
    { x: 3400, y: 400, w: 130, h: 20 },
    { x: 4600, y: 360, w: 150, h: 20 },
  ];
}

export function makeVehicles(): VehicleState[] {
  return [
    {
      id: "jet1",
      type: "jet",
      x: 600,
      y: 430,
      vx: 0,
      vy: 0,
      hp: 200,
      maxHp: 200,
      driverId: null,
      facingRight: true,
      angle: 0,
      onGround: false,
    },
    {
      id: "jet2",
      type: "jet",
      x: 4200,
      y: 380,
      vx: 0,
      vy: 0,
      hp: 200,
      maxHp: 200,
      driverId: null,
      facingRight: false,
      angle: 0,
      onGround: false,
    },
    {
      id: "tank1",
      type: "tank",
      x: 900,
      y: GROUND_Y - 44,
      vx: 0,
      vy: 0,
      hp: 300,
      maxHp: 300,
      driverId: null,
      facingRight: true,
      angle: 0,
      onGround: true,
    },
    {
      id: "tank2",
      type: "tank",
      x: 2800,
      y: GROUND_Y - 44,
      vx: 0,
      vy: 0,
      hp: 300,
      maxHp: 300,
      driverId: null,
      facingRight: true,
      angle: 0,
      onGround: true,
    },
    {
      id: "tank3",
      type: "tank",
      x: 4800,
      y: GROUND_Y - 44,
      vx: 0,
      vy: 0,
      hp: 300,
      maxHp: 300,
      driverId: null,
      facingRight: false,
      angle: 0,
      onGround: true,
    },
    {
      id: "bike1",
      type: "bike",
      x: 400,
      y: GROUND_Y - 28,
      vx: 0,
      vy: 0,
      hp: 80,
      maxHp: 80,
      driverId: null,
      facingRight: true,
      angle: 0,
      onGround: true,
    },
    {
      id: "bike2",
      type: "bike",
      x: 2200,
      y: GROUND_Y - 28,
      vx: 0,
      vy: 0,
      hp: 80,
      maxHp: 80,
      driverId: null,
      facingRight: true,
      angle: 0,
      onGround: true,
    },
    {
      id: "bike3",
      type: "bike",
      x: 3800,
      y: GROUND_Y - 28,
      vx: 0,
      vy: 0,
      hp: 80,
      maxHp: 80,
      driverId: null,
      facingRight: false,
      angle: 0,
      onGround: true,
    },
    {
      id: "bike4",
      type: "bike",
      x: 5200,
      y: GROUND_Y - 28,
      vx: 0,
      vy: 0,
      hp: 80,
      maxHp: 80,
      driverId: null,
      facingRight: false,
      angle: 0,
      onGround: true,
    },
    {
      id: "buggy1",
      type: "buggy",
      x: 1500,
      y: GROUND_Y - 36,
      vx: 0,
      vy: 0,
      hp: 120,
      maxHp: 120,
      driverId: null,
      facingRight: true,
      angle: 0,
      onGround: true,
    },
    {
      id: "buggy2",
      type: "buggy",
      x: 3300,
      y: GROUND_Y - 36,
      vx: 0,
      vy: 0,
      hp: 120,
      maxHp: 120,
      driverId: null,
      facingRight: true,
      angle: 0,
      onGround: true,
    },
    {
      id: "buggy3",
      type: "buggy",
      x: 5500,
      y: GROUND_Y - 36,
      vx: 0,
      vy: 0,
      hp: 120,
      maxHp: 120,
      driverId: null,
      facingRight: false,
      angle: 0,
      onGround: true,
    },
  ];
}

export function makeWeaponPickups(): WeaponPickup[] {
  const types: WeaponType[] = [
    "pistol",
    "rifle",
    "shotgun",
    "rocket",
    "grenade",
    "rope",
    "bat",
  ];
  const picks: WeaponPickup[] = [];
  const positions = [
    200, 450, 800, 1100, 1350, 1700, 2050, 2300, 2650, 3000, 3250, 3550, 3900,
    4100, 4400, 4750, 5000, 5300, 5600, 5800, 600, 1250, 2150, 3050, 4050, 5150,
  ];
  positions.forEach((px, i) => {
    picks.push({
      id: `wp${i}`,
      type: types[i % types.length],
      x: px,
      y: GROUND_Y - 20,
      available: true,
    });
  });
  return picks;
}
