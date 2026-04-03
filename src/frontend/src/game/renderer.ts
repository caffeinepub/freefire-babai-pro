import type {
  LocalGameState,
  Particle,
  Platform,
  PlayerState,
  Projectile,
  VehicleState,
  WeaponPickup,
} from "./gameState";
import { GROUND_Y, PLAYER_COLORS, WORLD_H, WORLD_W } from "./gameState";

// ─── Camera helpers ──────────────────────────────────────────────────────────
export function worldToScreen(
  wx: number,
  wy: number,
  camX: number,
  camY: number,
): [number, number] {
  return [wx - camX, wy - camY];
}

// ─── Background ──────────────────────────────────────────────────────────────
let starPositions: { x: number; y: number; r: number }[] | null = null;
let cloudPositions:
  | { x: number; y: number; w: number; h: number; speed: number }[]
  | null = null;

function initStars() {
  starPositions = [];
  for (let i = 0; i < 200; i++) {
    starPositions.push({
      x: Math.random() * WORLD_W,
      y: Math.random() * 600,
      r: Math.random() * 1.5 + 0.3,
    });
  }
}
function initClouds() {
  cloudPositions = [];
  for (let i = 0; i < 12; i++) {
    cloudPositions.push({
      x: Math.random() * WORLD_W,
      y: Math.random() * 200 + 60,
      w: Math.random() * 120 + 60,
      h: Math.random() * 35 + 18,
      speed: Math.random() * 0.2 + 0.05,
    });
  }
}

export function drawBackground(
  ctx: CanvasRenderingContext2D,
  cw: number,
  ch: number,
  camX: number,
  frame: number,
) {
  if (!starPositions) initStars();
  if (!cloudPositions) initClouds();

  // Sky gradient
  const skyGrad = ctx.createLinearGradient(0, 0, 0, ch * 0.85);
  skyGrad.addColorStop(0, "#060e1f");
  skyGrad.addColorStop(0.6, "#0b1a33");
  skyGrad.addColorStop(1, "#132a4a");
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, cw, ch);

  // Stars - parallax at 0.15x
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  for (const s of starPositions!) {
    const sx = (((s.x - camX * 0.15) % WORLD_W) + WORLD_W) % WORLD_W;
    if (sx < 0 || sx > cw + 4) continue;
    ctx.beginPath();
    ctx.arc(sx, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Far buildings silhouettes - parallax 0.3x
  ctx.fillStyle = "#0d1e2e";
  for (let bx = 0; bx < WORLD_W; bx += 140) {
    const bh = 80 + ((bx * 137) % 120);
    const bsx = bx - camX * 0.3;
    if (bsx > -150 && bsx < cw + 150) {
      ctx.fillRect(bsx, ch - bh - (WORLD_H - GROUND_Y + 0), 110, bh);
      // Windows
      ctx.fillStyle = "rgba(88,211,255,0.15)";
      for (let wy2 = 10; wy2 < bh - 10; wy2 += 18) {
        for (let wx = 10; wx < 90; wx += 20) {
          if ((bx + wy2 + wx) % 3 !== 0)
            ctx.fillRect(
              bsx + wx,
              ch - bh + wy2 - (WORLD_H - GROUND_Y + 0),
              10,
              10,
            );
        }
      }
      ctx.fillStyle = "#0d1e2e";
    }
  }

  // Clouds - slow drift, parallax 0.4x
  for (const c of cloudPositions!) {
    const cxPos =
      ((((c.x + frame * c.speed - camX * 0.4) % (WORLD_W + 200)) +
        WORLD_W +
        200) %
        (WORLD_W + 200)) -
      200;
    if (cxPos < -200 || cxPos > cw + 200) continue;
    ctx.fillStyle = "rgba(60,80,100,0.35)";
    ctx.beginPath();
    ctx.ellipse(cxPos, c.y, c.w, c.h, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ─── Terrain / Ground ────────────────────────────────────────────────────────
export function drawTerrain(
  ctx: CanvasRenderingContext2D,
  cw: number,
  ch: number,
  camX: number,
  camY: number,
) {
  const [_gsx, gsy] = worldToScreen(0, GROUND_Y, camX, camY);

  // Dirt
  const dirtGrad = ctx.createLinearGradient(0, gsy, 0, ch);
  dirtGrad.addColorStop(0, "#5a3a2a");
  dirtGrad.addColorStop(1, "#2e1a0f");
  ctx.fillStyle = dirtGrad;
  ctx.fillRect(0, gsy, cw, ch - gsy);

  // Grass strip
  ctx.fillStyle = "#5aa84f";
  ctx.fillRect(0, gsy, cw, 20);

  // Grass tufts detail
  ctx.fillStyle = "#6bc460";
  for (let gx = camX % 40; gx < cw; gx += 40) {
    ctx.fillRect(gx, gsy, 4, 8);
    ctx.fillRect(gx + 12, gsy, 3, 10);
    ctx.fillRect(gx + 24, gsy, 4, 6);
  }
}

// ─── Platforms ───────────────────────────────────────────────────────────────
export function drawPlatforms(
  ctx: CanvasRenderingContext2D,
  platforms: Platform[],
  camX: number,
  camY: number,
) {
  for (const plat of platforms) {
    const [sx, sy] = worldToScreen(plat.x, plat.y, camX, camY);
    if (sx > ctx.canvas.width + 50 || sx + plat.w < -50) continue;
    // Dirt base
    const platGrad = ctx.createLinearGradient(sx, sy, sx, sy + plat.h + 20);
    platGrad.addColorStop(0, "#5a3a2a");
    platGrad.addColorStop(1, "#3a2010");
    ctx.fillStyle = platGrad;
    ctx.fillRect(sx, sy + 16, plat.w, 24);
    // Grass top
    ctx.fillStyle = "#5aa84f";
    ctx.fillRect(sx, sy, plat.w, 18);
    // Grass detail
    ctx.fillStyle = "#6bc460";
    for (let gx = 4; gx < plat.w - 4; gx += 14) {
      ctx.fillRect(sx + gx, sy, 3, 7);
    }
    // Hanging vines
    if (plat.w > 150) {
      ctx.strokeStyle = "#2d5a1e";
      ctx.lineWidth = 2;
      for (let vx2 = 20; vx2 < plat.w - 10; vx2 += 35) {
        const vlen = 20 + ((vx2 * 13) % 30);
        ctx.beginPath();
        ctx.moveTo(sx + vx2, sy + plat.h + 4);
        ctx.lineTo(sx + vx2 + 3, sy + plat.h + vlen);
        ctx.stroke();
      }
    }
  }
}

// ─── Crates ───────────────────────────────────────────────────────────────────
export function drawCrates(
  ctx: CanvasRenderingContext2D,
  camX: number,
  camY: number,
) {
  const cratePositions = [600, 1100, 1700, 2400, 3000, 3700, 4300, 4900, 5500];
  for (const cx2 of cratePositions) {
    const [sx, sy] = worldToScreen(cx2, GROUND_Y - 30, camX, camY);
    if (sx < -50 || sx > ctx.canvas.width + 50) continue;
    ctx.fillStyle = "#7a5a2a";
    ctx.fillRect(sx - 18, sy - 18, 36, 36);
    ctx.strokeStyle = "#5a3a10";
    ctx.lineWidth = 2;
    ctx.strokeRect(sx - 18, sy - 18, 36, 36);
    ctx.strokeStyle = "#5a3a10";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(sx - 18, sy);
    ctx.lineTo(sx + 18, sy);
    ctx.moveTo(sx, sy - 18);
    ctx.lineTo(sx, sy + 18);
    ctx.stroke();
  }
}

// ─── Weapons on ground ───────────────────────────────────────────────────────
export function drawWeaponPickups(
  ctx: CanvasRenderingContext2D,
  weapons: WeaponPickup[],
  camX: number,
  camY: number,
) {
  for (const wp of weapons) {
    if (!wp.available) continue;
    const [sx, sy] = worldToScreen(wp.x, wp.y, camX, camY);
    if (sx < -30 || sx > ctx.canvas.width + 30) continue;

    // Glow
    const grd = ctx.createRadialGradient(sx, sy, 2, sx, sy, 18);
    grd.addColorStop(0, "rgba(88,211,255,0.4)");
    grd.addColorStop(1, "rgba(88,211,255,0)");
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(sx, sy, 18, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(sx, sy);

    switch (wp.type) {
      case "pistol":
        ctx.fillStyle = "#aaa";
        ctx.fillRect(-10, -4, 18, 7);
        ctx.fillRect(-2, -8, 6, 4);
        ctx.fillStyle = "#888";
        ctx.fillRect(7, -2, 5, 3);
        break;
      case "rifle":
        ctx.fillStyle = "#888";
        ctx.fillRect(-16, -4, 32, 6);
        ctx.fillRect(-8, -8, 8, 4);
        ctx.fillStyle = "#555";
        ctx.fillRect(10, -3, 8, 2);
        break;
      case "shotgun":
        ctx.fillStyle = "#8B4513";
        ctx.fillRect(-14, -4, 28, 8);
        ctx.fillStyle = "#555";
        ctx.fillRect(10, -4, 8, 3);
        ctx.fillRect(10, 1, 8, 3);
        break;
      case "rocket":
        ctx.fillStyle = "#5a5a5a";
        ctx.fillRect(-14, -5, 26, 10);
        ctx.fillStyle = "#ff4400";
        ctx.beginPath();
        ctx.moveTo(12, -5);
        ctx.lineTo(20, 0);
        ctx.lineTo(12, 5);
        ctx.fill();
        break;
      case "grenade":
        ctx.fillStyle = "#3a6e2a";
        ctx.beginPath();
        ctx.ellipse(0, 0, 9, 11, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#aaa";
        ctx.fillRect(-2, -13, 4, 5);
        break;
      case "rope":
        ctx.strokeStyle = "#c8a850";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        for (let ri = 0; ri < 3; ri++) {
          ctx.arc(0, 0, 7 + ri * 3, ri * 0.5, ri * 0.5 + Math.PI * 1.3);
        }
        ctx.stroke();
        break;
      case "bat":
        ctx.fillStyle = "#8B4513";
        ctx.fillRect(-3, -18, 6, 32);
        ctx.fillStyle = "#c8a850";
        ctx.fillRect(-6, -18, 12, 10);
        break;
    }
    ctx.restore();

    // Label
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(sx - 16, sy + 12, 32, 14);
    ctx.fillStyle = "#58d3ff";
    ctx.font = "bold 9px 'Orbitron', monospace";
    ctx.textAlign = "center";
    ctx.fillText(wp.type.toUpperCase(), sx, sy + 22);
  }
}

// ─── Stickman ────────────────────────────────────────────────────────────────
export function drawStickman(
  ctx: CanvasRenderingContext2D,
  p: PlayerState,
  camX: number,
  camY: number,
  isMe: boolean,
) {
  if (!p.isAlive && p.animState !== "dead") return;
  const [sx, sy] = worldToScreen(p.x, p.y, camX, camY);
  if (sx < -60 || sx > ctx.canvas.width + 60) return;

  const hitAlpha = p.hitFlash > 0 ? (p.hitFlash % 2 === 0 ? 1 : 0.3) : 1;
  ctx.globalAlpha = hitAlpha;

  const f = p.animFrame;
  const _alive = p.isAlive;
  const _facing = p.facingRight ? 1 : -1;

  ctx.save();
  ctx.translate(sx, sy);
  if (!p.facingRight) ctx.scale(-1, 1);

  if (p.animState === "dead") {
    // Ragdoll dead pose
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.fillStyle = "#FFB347";
    ctx.beginPath();
    ctx.arc(12, -8, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = p.color;
    ctx.stroke();
    // Eyes closed X
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(8, -10);
    ctx.lineTo(12, -6);
    ctx.moveTo(12, -10);
    ctx.lineTo(8, -6);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(14, -10);
    ctx.lineTo(18, -6);
    ctx.moveTo(18, -10);
    ctx.lineTo(14, -6);
    ctx.stroke();
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 2.5;
    // Body flat
    ctx.beginPath();
    ctx.moveTo(12, 2);
    ctx.lineTo(12, 28);
    ctx.stroke();
    // Arms splayed
    ctx.beginPath();
    ctx.moveTo(12, 8);
    ctx.lineTo(-12, 22);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(12, 8);
    ctx.lineTo(36, 22);
    ctx.stroke();
    // Legs
    ctx.beginPath();
    ctx.moveTo(12, 28);
    ctx.lineTo(-4, 50);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(12, 28);
    ctx.lineTo(28, 50);
    ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 1;
    return;
  }

  if (p.inVehicle) {
    // Simple driving pose - arms up
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.fillStyle = "#FFB347";
    ctx.beginPath();
    ctx.arc(0, -36, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = p.color;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -26);
    ctx.lineTo(0, 0);
    ctx.stroke(); // body
    ctx.beginPath();
    ctx.moveTo(0, -20);
    ctx.lineTo(-14, -32);
    ctx.stroke(); // left arm up
    ctx.beginPath();
    ctx.moveTo(0, -20);
    ctx.lineTo(14, -32);
    ctx.stroke(); // right arm up
    ctx.restore();
    ctx.globalAlpha = 1;
    return;
  }

  const animT = f / 60;

  let legLAngle = 0;
  let legRAngle = 0;
  let armLAngle = 0;
  let armRAngle = 0;
  let bodyBob = 0;

  if (p.animState === "run") {
    const swing = Math.sin(f * 0.4) * 0.5;
    legLAngle = swing;
    legRAngle = -swing;
    armLAngle = -swing * 0.6;
    armRAngle = swing * 0.6;
    bodyBob = Math.abs(Math.sin(f * 0.4)) * 2;
  } else if (p.animState === "jump") {
    legLAngle = -0.4;
    legRAngle = -0.4;
    armLAngle = 0.5;
    armRAngle = -0.5;
    bodyBob = -2;
  } else if (p.animState === "attack") {
    armRAngle = -0.8;
    armLAngle = 0.2;
  } else {
    // Idle sway
    const sway = Math.sin(animT * Math.PI * 2) * 0.08;
    armLAngle = sway;
    armRAngle = -sway;
    bodyBob = Math.abs(Math.sin(animT * Math.PI * 2)) * 1;
  }

  const headY = -42 + bodyBob;
  const shoulderY = -28 + bodyBob;
  const hipY = 0;

  ctx.strokeStyle = p.color;
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";

  // Head
  ctx.fillStyle = "#FFB347";
  ctx.beginPath();
  ctx.arc(0, headY - 2, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = p.color;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Eyes
  ctx.fillStyle = "#222";
  ctx.beginPath();
  ctx.arc(4, headY - 4, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(9, headY - 4, 2, 0, Math.PI * 2);
  ctx.fill();

  // Mouth - smile or grimace
  ctx.strokeStyle = "#333";
  ctx.lineWidth = 1.5;
  if (p.hp < 30) {
    ctx.beginPath();
    ctx.arc(6.5, headY, 4, 0, Math.PI);
    ctx.stroke(); // grimace
  } else {
    ctx.beginPath();
    ctx.arc(6.5, headY, 4, Math.PI, 0);
    ctx.stroke(); // smile
  }

  // Body
  ctx.strokeStyle = p.color;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(0, shoulderY);
  ctx.lineTo(0, hipY);
  ctx.stroke();

  // Arms with elbow bend
  const armLen = 20;
  const elbowOffset = 8;
  // Left arm
  const lax = Math.sin(armLAngle - 0.4) * armLen;
  const lay = Math.cos(armLAngle - 0.4) * armLen;
  ctx.beginPath();
  ctx.moveTo(0, shoulderY);
  ctx.lineTo(0 - elbowOffset + lax * 0.5, shoulderY + lay * 0.5 + 4);
  ctx.lineTo(0 - elbowOffset + lax, shoulderY + lay + 4);
  ctx.stroke();
  // Right arm
  const rax = Math.sin(armRAngle + 0.4) * armLen;
  const ray = Math.cos(armRAngle + 0.4) * armLen;
  ctx.beginPath();
  ctx.moveTo(0, shoulderY);
  ctx.lineTo(elbowOffset + rax * 0.5, shoulderY + ray * 0.5 + 4);
  ctx.lineTo(elbowOffset + rax, shoulderY + ray + 4);
  ctx.stroke();

  // Legs with knee bend
  const legLen = 22;
  const kneeOffset = 6;
  // Left leg
  const llx = Math.sin(legLAngle) * legLen;
  const lly = Math.cos(legLAngle) * legLen;
  ctx.beginPath();
  ctx.moveTo(-4, hipY);
  ctx.lineTo(-4 - kneeOffset + llx * 0.5, hipY + lly * 0.5);
  ctx.lineTo(-4 + llx, hipY + lly + 6);
  ctx.stroke();
  // Right leg
  const rlx = Math.sin(legRAngle) * legLen;
  const rly = Math.cos(legRAngle) * legLen;
  ctx.beginPath();
  ctx.moveTo(4, hipY);
  ctx.lineTo(4 + kneeOffset + rlx * 0.5, hipY + rly * 0.5);
  ctx.lineTo(4 + rlx, hipY + rly + 6);
  ctx.stroke();

  ctx.restore();

  // Weapon in hand (if any and not in vehicle)
  const wep = p.weapons[p.activeSlot];
  if (wep && p.isAlive) {
    const [wsx, wsy] = worldToScreen(p.x, p.y, camX, camY);
    ctx.save();
    ctx.translate(wsx + (p.facingRight ? 18 : -18), wsy - 20);
    if (!p.facingRight) ctx.scale(-1, 1);
    ctx.fillStyle = wep === "bat" ? "#8B4513" : "#888";
    if (wep === "bat") {
      ctx.fillRect(0, -12, 5, 22);
    } else if (wep === "rifle") {
      ctx.fillRect(0, -3, 24, 5);
      ctx.fillRect(6, -7, 6, 4);
    } else if (wep === "shotgun") {
      ctx.fillRect(0, -4, 18, 7);
    } else if (wep === "rocket") {
      ctx.fillRect(0, -5, 22, 10);
      ctx.fillStyle = "#ff4400";
      ctx.beginPath();
      ctx.moveTo(22, -5);
      ctx.lineTo(28, 0);
      ctx.lineTo(22, 5);
      ctx.fill();
    } else {
      ctx.fillRect(0, -3, 14, 6); // pistol/default
    }
    ctx.restore();
  }

  // Name label (only for other players)
  if (!isMe) {
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(sx - 30, sy - 68, 60, 16);
    ctx.fillStyle = p.color;
    ctx.font = "bold 10px 'Orbitron', monospace";
    ctx.textAlign = "center";
    ctx.fillText(p.name.slice(0, 8), sx, sy - 55);
  }

  // HP bar above head
  const barW = 40;
  const barX = sx - barW / 2;
  const barY = sy - 80;
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(barX - 1, barY - 1, barW + 2, 7);
  const hpPct = p.hp / p.maxHp;
  const hpColor = hpPct > 0.6 ? "#3bd35a" : hpPct > 0.3 ? "#ffdd44" : "#e53935";
  ctx.fillStyle = hpColor;
  ctx.fillRect(barX, barY, barW * hpPct, 5);

  ctx.globalAlpha = 1;
}

// ─── Vehicles ────────────────────────────────────────────────────────────────
export function drawVehicle(
  ctx: CanvasRenderingContext2D,
  v: VehicleState,
  camX: number,
  camY: number,
) {
  const [sx, sy] = worldToScreen(v.x, v.y, camX, camY);
  if (sx < -120 || sx > ctx.canvas.width + 120) return;

  ctx.save();
  ctx.translate(sx, sy);
  if (!v.facingRight) ctx.scale(-1, 1);

  switch (v.type) {
    case "jet":
      drawJet(ctx, v);
      break;
    case "tank":
      drawTank(ctx, v);
      break;
    case "bike":
      drawBike(ctx, v);
      break;
    case "buggy":
      drawBuggy(ctx, v);
      break;
  }

  ctx.restore();

  // HP bar
  const barW = 50;
  const hpPct = v.hp / v.maxHp;
  const barY = sy - (v.type === "jet" ? 36 : v.type === "tank" ? 60 : 44);
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(sx - barW / 2, barY, barW, 5);
  ctx.fillStyle =
    hpPct > 0.5 ? "#3bd35a" : hpPct > 0.25 ? "#ffdd44" : "#e53935";
  ctx.fillRect(sx - barW / 2, barY, barW * hpPct, 5);

  // Interact prompt
  if (!v.driverId) {
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(sx - 35, sy - (v.type === "tank" ? 75 : 60), 70, 16);
    ctx.fillStyle = "#58d3ff";
    ctx.font = "bold 9px 'Orbitron', monospace";
    ctx.textAlign = "center";
    ctx.fillText("[E] ENTER", sx, sy - (v.type === "tank" ? 63 : 48));
  }
}

function drawJet(ctx: CanvasRenderingContext2D, v: VehicleState) {
  // Fuselage
  ctx.fillStyle = "#3a3a3a";
  ctx.beginPath();
  ctx.moveTo(60, 0);
  ctx.lineTo(-30, -10);
  ctx.lineTo(-40, 0);
  ctx.lineTo(-30, 10);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#555";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Cockpit
  ctx.fillStyle = "#1a3a5a";
  ctx.beginPath();
  ctx.ellipse(20, -2, 18, 10, -0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#58d3ff";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Wings
  ctx.fillStyle = "#2a2a2a";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-25, 30);
  ctx.lineTo(-35, 28);
  ctx.lineTo(-15, 0);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-25, -30);
  ctx.lineTo(-35, -28);
  ctx.lineTo(-15, 0);
  ctx.closePath();
  ctx.fill();

  // Tail fins
  ctx.fillStyle = "#333";
  ctx.beginPath();
  ctx.moveTo(-30, 0);
  ctx.lineTo(-50, -20);
  ctx.lineTo(-42, 0);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-30, 0);
  ctx.lineTo(-50, 20);
  ctx.lineTo(-42, 0);
  ctx.closePath();
  ctx.fill();

  // Engine glow
  const eGlow = ctx.createRadialGradient(-42, 0, 2, -42, 0, 14);
  eGlow.addColorStop(0, "rgba(255,140,0,0.9)");
  eGlow.addColorStop(1, "rgba(255,60,0,0)");
  ctx.fillStyle = eGlow;
  ctx.beginPath();
  ctx.arc(-42, 0, 14, 0, Math.PI * 2);
  ctx.fill();

  // Smoke trail
  if (v.driverId) {
    ctx.strokeStyle = "rgba(180,180,180,0.25)";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(-42, 0);
    for (let i = 1; i <= 5; i++) {
      ctx.lineTo(-42 - i * 12, Math.sin(i * 0.8) * 8);
    }
    ctx.stroke();
  }
}

function drawTank(ctx: CanvasRenderingContext2D, _v: VehicleState) {
  // Treads
  const treadColors = ["#3a3a2a", "#4a4a3a"];
  for (let i = 0; i < 12; i++) {
    ctx.fillStyle = treadColors[i % 2];
    ctx.beginPath();
    ctx.arc(-44 + i * 8, 28, 9, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#2a2a1a";
  ctx.fillRect(-48, 22, 96, 12);

  // Body
  const bodyGrad = ctx.createLinearGradient(0, -16, 0, 22);
  bodyGrad.addColorStop(0, "#6a7a3a");
  bodyGrad.addColorStop(1, "#4a5a2a");
  ctx.fillStyle = bodyGrad;
  ctx.fillRect(-44, -16, 88, 38);
  ctx.strokeStyle = "#3a4a1a";
  ctx.lineWidth = 2;
  ctx.strokeRect(-44, -16, 88, 38);

  // Turret
  const turretGrad = ctx.createLinearGradient(0, -38, 0, -10);
  turretGrad.addColorStop(0, "#7a8a4a");
  turretGrad.addColorStop(1, "#5a6a2a");
  ctx.fillStyle = turretGrad;
  ctx.beginPath();
  ctx.ellipse(0, -22, 26, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#4a5a1a";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Barrel
  ctx.fillStyle = "#3a4a1a";
  ctx.fillRect(0, -25, 52, 8);
  ctx.fillStyle = "#2a3a0a";
  ctx.fillRect(48, -27, 8, 12);

  // Hatch
  ctx.fillStyle = "#8a9a4a";
  ctx.beginPath();
  ctx.arc(0, -26, 8, 0, Math.PI * 2);
  ctx.fill();
}

function drawBike(ctx: CanvasRenderingContext2D, _v: VehicleState) {
  // Wheels
  ctx.strokeStyle = "#333";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(-22, 14, 16, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(22, 14, 16, 0, Math.PI * 2);
  ctx.stroke();
  // Spokes
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "#555";
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    ctx.beginPath();
    ctx.moveTo(-22, 14);
    ctx.lineTo(-22 + Math.cos(a) * 14, 14 + Math.sin(a) * 14);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(22, 14);
    ctx.lineTo(22 + Math.cos(a) * 14, 14 + Math.sin(a) * 14);
    ctx.stroke();
  }
  // Hub caps
  ctx.fillStyle = "#ff8800";
  ctx.beginPath();
  ctx.arc(-22, 14, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(22, 14, 4, 0, Math.PI * 2);
  ctx.fill();

  // Frame
  ctx.strokeStyle = "#555";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-22, 14);
  ctx.lineTo(-5, -6);
  ctx.lineTo(10, -6);
  ctx.lineTo(22, 14);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-5, -6);
  ctx.lineTo(-8, -18); // fork
  ctx.stroke();

  // Handlebars
  ctx.strokeStyle = "#888";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(5, -8);
  ctx.lineTo(16, -14);
  ctx.lineTo(20, -10);
  ctx.stroke();

  // Seat
  ctx.fillStyle = "#333";
  ctx.fillRect(-8, -12, 20, 6);
  ctx.strokeStyle = "#444";
  ctx.lineWidth = 1;
  ctx.strokeRect(-8, -12, 20, 6);

  // Exhaust
  ctx.fillStyle = "#ff8800";
  ctx.beginPath();
  ctx.arc(-26, 6, 3, 0, Math.PI * 2);
  ctx.fill();
}

function drawBuggy(ctx: CanvasRenderingContext2D, _v: VehicleState) {
  // Wheels
  for (const wx of [-32, 32]) {
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(wx, 20, 15, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#c8a850";
    ctx.beginPath();
    ctx.arc(wx, 20, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#555";
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      ctx.beginPath();
      ctx.moveTo(wx, 20);
      ctx.lineTo(wx + Math.cos(a) * 12, 20 + Math.sin(a) * 12);
      ctx.stroke();
    }
  }
  // Body
  const bodyGrad = ctx.createLinearGradient(0, -18, 0, 20);
  bodyGrad.addColorStop(0, "#d8b860");
  bodyGrad.addColorStop(1, "#9a7a30");
  ctx.fillStyle = bodyGrad;
  ctx.fillRect(-30, -18, 60, 38);
  ctx.strokeStyle = "#8a6a20";
  ctx.lineWidth = 2;
  ctx.strokeRect(-30, -18, 60, 38);

  // Roll cage
  ctx.strokeStyle = "#888";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-28, -18);
  ctx.lineTo(-24, -36);
  ctx.moveTo(28, -18);
  ctx.lineTo(24, -36);
  ctx.moveTo(-24, -36);
  ctx.lineTo(24, -36);
  ctx.stroke();

  // Seats
  ctx.fillStyle = "#555";
  ctx.fillRect(-22, -14, 18, 8);
  ctx.fillRect(4, -14, 18, 8);

  // Headlights
  ctx.fillStyle = "rgba(255,255,200,0.8)";
  ctx.beginPath();
  ctx.arc(32, -5, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(32, 10, 5, 0, Math.PI * 2);
  ctx.fill();
}

// ─── Projectiles ─────────────────────────────────────────────────────────────
export function drawProjectiles(
  ctx: CanvasRenderingContext2D,
  projectiles: Projectile[],
  camX: number,
  camY: number,
) {
  for (const proj of projectiles) {
    const [sx, sy] = worldToScreen(proj.x, proj.y, camX, camY);
    if (sx < -20 || sx > ctx.canvas.width + 20) continue;

    switch (proj.type) {
      case "rocket": {
        const grd = ctx.createRadialGradient(sx, sy, 1, sx, sy, 10);
        grd.addColorStop(0, "#ff8800");
        grd.addColorStop(1, "rgba(255,80,0,0)");
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(sx, sy, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ff6600";
        ctx.fillRect(sx - 5, sy - 3, 12, 6);
        break;
      }
      case "grenade":
        ctx.fillStyle = "#3a6e2a";
        ctx.beginPath();
        ctx.arc(sx, sy, 6, 0, Math.PI * 2);
        ctx.fill();
        break;
      default: {
        const grd2 = ctx.createRadialGradient(sx, sy, 0, sx, sy, 5);
        grd2.addColorStop(0, "#ffffff");
        grd2.addColorStop(1, "rgba(88,211,255,0)");
        ctx.fillStyle = grd2;
        ctx.beginPath();
        ctx.arc(sx, sy, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

// ─── Particles ───────────────────────────────────────────────────────────────
export function drawParticles(
  ctx: CanvasRenderingContext2D,
  particles: Particle[],
  camX: number,
  camY: number,
) {
  for (const p of particles) {
    const [sx, sy] = worldToScreen(p.x, p.y, camX, camY);
    if (sx < -20 || sx > ctx.canvas.width + 20) continue;
    const alpha = p.life / p.maxLife;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(sx, sy, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ─── Safe Zone ───────────────────────────────────────────────────────────────
export function drawSafeZone(
  ctx: CanvasRenderingContext2D,
  sz: { x: number; y: number; radius: number },
  camX: number,
  camY: number,
  cw: number,
  ch: number,
) {
  const [scx, scy] = worldToScreen(sz.x, sz.y, camX, camY);

  // Dark red overlay outside zone
  ctx.save();
  ctx.fillStyle = "rgba(120,0,0,0.22)";
  ctx.fillRect(0, 0, cw, ch);
  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.arc(scx, scy, sz.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Zone border
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 4]);
  ctx.beginPath();
  ctx.arc(scx, scy, sz.radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
}

// ─── Rope ────────────────────────────────────────────────────────────────────
export function drawRope(
  ctx: CanvasRenderingContext2D,
  anchor: { x: number; y: number },
  playerX: number,
  playerY: number,
  camX: number,
  camY: number,
) {
  const [ax, ay] = worldToScreen(anchor.x, anchor.y, camX, camY);
  const [px, py] = worldToScreen(playerX, playerY, camX, camY);
  ctx.strokeStyle = "#c8a850";
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 3]);
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.quadraticCurveTo((ax + px) / 2, Math.max(ay, py) + 30, px, py);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "#c8a850";
  ctx.beginPath();
  ctx.arc(ax, ay, 4, 0, Math.PI * 2);
  ctx.fill();
}

// ─── Minimap ─────────────────────────────────────────────────────────────────
export function drawMinimap(
  ctx: CanvasRenderingContext2D,
  gs: LocalGameState,
  myId: string,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const scaleX = w / WORLD_W;
  const scaleY = h / WORLD_H;

  ctx.fillStyle = "rgba(10,20,40,0.85)";
  ctx.strokeStyle = "rgba(88,211,255,0.6)";
  ctx.lineWidth = 1.5;
  ctx.fillRect(x, y, w, h);
  ctx.strokeRect(x, y, w, h);

  // Ground line
  ctx.fillStyle = "#5aa84f";
  ctx.fillRect(x, y + GROUND_Y * scaleY, w, 2);

  // Safe zone
  const sz = gs.safeZone;
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(
    x + sz.x * scaleX,
    y + sz.y * scaleY,
    sz.radius * scaleX,
    0,
    Math.PI * 2,
  );
  ctx.stroke();

  // Players
  for (const p of Object.values(gs.players)) {
    if (!p.isAlive) continue;
    ctx.fillStyle = p.id === myId ? "#ffffff" : p.color;
    const dotSize = p.id === myId ? 4 : 3;
    ctx.beginPath();
    ctx.arc(x + p.x * scaleX, y + p.y * scaleY, dotSize, 0, Math.PI * 2);
    ctx.fill();
    if (p.id === myId) {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  // Vehicles
  for (const v of Object.values(gs.vehicles)) {
    ctx.fillStyle =
      v.type === "jet" ? "#58d3ff" : v.type === "tank" ? "#6a7a3a" : "#888";
    ctx.fillRect(x + v.x * scaleX - 2, y + v.y * scaleY - 2, 4, 4);
  }

  // Label
  ctx.fillStyle = "rgba(88,211,255,0.7)";
  ctx.font = "bold 7px 'Orbitron', monospace";
  ctx.textAlign = "left";
  ctx.fillText("MAP", x + 3, y + 9);
}
