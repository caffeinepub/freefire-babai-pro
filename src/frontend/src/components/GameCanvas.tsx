import type React from "react";
import { useEffect, useRef } from "react";
import type { RoomInfo } from "../App";
import { db, doc, onSnapshot, updateDoc } from "../firebase";
import type { KillEvent, LocalGameState, PlayerState } from "../game/gameState";
import { GROUND_Y, WORLD_H, WORLD_W } from "../game/gameState";
import {
  checkPickup,
  checkProjectileHit,
  enterVehicle,
  exitVehicle,
  findNearbyVehicle,
  spawnParticles,
  stepParticles,
  stepPlayer,
  stepProjectile,
  stepVehicle,
} from "../game/physics";
import type { InputState } from "../game/physics";
import {
  drawBackground,
  drawCrates,
  drawMinimap,
  drawParticles,
  drawPlatforms,
  drawProjectiles,
  drawRope,
  drawSafeZone,
  drawStickman,
  drawTerrain,
  drawVehicle,
  drawWeaponPickups,
} from "../game/renderer";
import {
  SAFE_ZONE_STAGES,
  isInsideSafeZone,
  tickSafeZone,
} from "../game/safeZone";
import { SoundEngine } from "../game/soundEngine";
import { tryFire, tryFireVehicle } from "../game/weapons";

interface Props {
  roomInfo: RoomInfo;
  inputRef: React.MutableRefObject<InputState>;
  initialState: React.MutableRefObject<LocalGameState | null>;
  onHudUpdate: (data: any) => void;
  onGameOver: (winner: string) => void;
}

const DEFAULT_WEAPONS: [string, string, string] = ["pistol", "", ""];

export default function GameCanvas({
  roomInfo,
  inputRef,
  initialState,
  onHudUpdate,
  onGameOver,
}: Props) {
  const { playerId, isCreator, roomCode } = roomInfo;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gsRef = useRef<LocalGameState | null>(null);
  const rafRef = useRef<number>(0);
  const lastFbWriteRef = useRef<number>(0);
  const lastSafeZoneWrite = useRef<number>(0);
  const gameStartTime = useRef<number>(Date.now());
  const unsubRef = useRef<(() => void) | null>(null);
  const gameActiveRef = useRef<boolean>(true);
  const hudUpdateThrottle = useRef<number>(0);

  // Key event handlers
  useEffect(() => {
    const input = inputRef.current;

    const setIfKey = (e: KeyboardEvent, val: boolean) => {
      switch (e.key) {
        case "ArrowLeft":
        case "a":
        case "A":
          input.left = val;
          break;
        case "ArrowRight":
        case "d":
        case "D":
          input.right = val;
          break;
        case "ArrowUp":
        case "w":
        case "W":
          input.up = val;
          break;
        case "ArrowDown":
        case "s":
        case "S":
          input.down = val;
          break;
        case "Shift":
          input.sprint = val;
          break;
        case " ":
          input.shoot = val;
          if (val) e.preventDefault();
          break;
        case "e":
        case "E":
          input.interact = val;
          break;
        case "1":
          input.slot1 = val;
          break;
        case "2":
          input.slot2 = val;
          break;
        case "3":
          input.slot3 = val;
          break;
        default:
          break;
      }
    };

    const onDown = (e: KeyboardEvent) => setIfKey(e, true);
    const onUp = (e: KeyboardEvent) => setIfKey(e, false);
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, [inputRef]);

  // Mouse tracking
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!gsRef.current) return;
      const gs = gsRef.current;
      gs.mouseX = e.clientX + gs.cameraX;
      gs.mouseY = e.clientY + gs.cameraY;
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  // Firebase listener
  useEffect(() => {
    if (unsubRef.current) unsubRef.current();
    const unsub = onSnapshot(doc(db, "stickFightRooms", roomCode), (snap) => {
      if (!snap.exists() || !gsRef.current) return;
      const data = snap.data();

      if (data.status === "gameover" && data.winner && gameActiveRef.current) {
        gameActiveRef.current = false;
        onGameOver(data.winner as string);
        return;
      }

      const gs = gsRef.current;

      // Merge remote players
      const remotePlayers = (data.players ?? {}) as Record<string, any>;
      for (const [id, rp] of Object.entries(remotePlayers)) {
        if (id === playerId) continue;
        const rpAny = rp as any;
        if (!gs.players[id]) {
          gs.players[id] = {
            ...rpAny,
            vx: 0,
            vy: 0,
            animFrame: 0,
            hitFlash: 0,
            isOnGround: true,
          } as PlayerState;
        } else {
          const cur = gs.players[id];
          cur.x = cur.x + (rpAny.x - cur.x) * 0.3;
          cur.y = cur.y + (rpAny.y - cur.y) * 0.3;
          cur.hp = rpAny.hp;
          cur.isAlive = rpAny.isAlive;
          cur.facingRight = rpAny.facingRight;
          cur.animState = rpAny.animState ?? "idle";
          cur.inVehicle = rpAny.inVehicle ?? null;
          cur.vehicleId = rpAny.vehicleId ?? null;
          cur.weapons = rpAny.weapons ?? ["pistol", "", ""];
          cur.activeSlot = rpAny.activeSlot ?? 0;
        }
      }

      // Merge safe zone
      if (data.safeZone) {
        gs.safeZone.x = data.safeZone.x;
        gs.safeZone.y = data.safeZone.y;
        gs.safeZone.targetRadius = data.safeZone.radius;
      }
    });
    unsubRef.current = unsub;
    return () => {
      if (unsubRef.current) unsubRef.current();
    };
  }, [roomCode, playerId, onGameOver]);

  // Main game loop
  useEffect(() => {
    if (!initialState.current) return;
    gsRef.current = initialState.current;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    let interactWasPressed = false;
    let slot1Was = false;
    let slot2Was = false;
    let slot3Was = false;
    let safeZoneDamageAccum = 0;
    let lastFootstep = 0;

    const loop = (ts: number) => {
      if (!gameActiveRef.current) return;
      rafRef.current = requestAnimationFrame(loop);

      const gs = gsRef.current;
      if (!gs) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const cw = canvas.width;
      const ch = canvas.height;
      const input = inputRef.current;

      gs.frameCount++;

      // Weapon slot switching
      const me = gs.players[playerId];
      if (me) {
        if (input.slot1 && !slot1Was) me.activeSlot = 0;
        if (input.slot2 && !slot2Was) me.activeSlot = 1;
        if (input.slot3 && !slot3Was) me.activeSlot = 2;
      }
      slot1Was = input.slot1;
      slot2Was = input.slot2;
      slot3Was = input.slot3;

      // Interact
      if (input.interact && !interactWasPressed && me && me.isAlive) {
        if (me.inVehicle && me.vehicleId) {
          const v = gs.vehicles[me.vehicleId];
          if (v) {
            exitVehicle(me, v);
            SoundEngine.jump();
          }
          gs.ropeAttached = false;
          gs.ropeAnchor = null;
        } else {
          const nearId = findNearbyVehicle(me, gs.vehicles);
          if (nearId) {
            enterVehicle(me, gs.vehicles[nearId]);
            SoundEngine.pickup();
          }
        }
      }
      interactWasPressed = input.interact;

      // Step my player
      if (me?.isAlive) {
        const wasOnGround = me.isOnGround;
        if (!me.inVehicle) {
          stepPlayer(me, input, gs, 1, true);
          if (input.up && !wasOnGround && me.vy < -8) SoundEngine.jump();
          if (me.isOnGround && Math.abs(me.vx) > 1 && ts - lastFootstep > 200) {
            SoundEngine.footstep();
            lastFootstep = ts;
          }
        }

        // Vehicle driving
        if (me.inVehicle && me.vehicleId) {
          const v = gs.vehicles[me.vehicleId];
          if (v) {
            stepVehicle(v, input, gs);
            me.x = v.x;
            me.y = v.y;
            SoundEngine.vehicleEngine(true);
          }
        }

        // Shooting
        if (input.shoot && !me.inVehicle) {
          const proj = tryFire(me, gs, gs.mouseX, gs.mouseY, ts);
          if (proj) {
            gs.projectiles.push(proj);
            SoundEngine.shoot(proj.type);
          }
        }
        if (input.shoot && me.inVehicle && me.vehicleId) {
          const v = gs.vehicles[me.vehicleId];
          if (v) {
            const proj2 = tryFireVehicle(
              {
                type: v.type,
                x: v.x,
                y: v.y,
                facingRight: v.facingRight,
                driverId: playerId,
              },
              ts,
              gs.lastFireTime,
            );
            if (proj2) {
              gs.projectiles.push(proj2);
              gs.lastFireTime = ts;
              SoundEngine.shoot("rocket");
            }
          }
        }

        // Pickups
        checkPickup(me, gs);

        // Safe zone damage
        if (!isInsideSafeZone(me.x, me.y, gs.safeZone)) {
          safeZoneDamageAccum += 2 / 60;
          if (safeZoneDamageAccum >= 1) {
            me.hp = Math.max(0, me.hp - Math.floor(safeZoneDamageAccum));
            safeZoneDamageAccum %= 1;
            if (gs.frameCount % 90 === 0) SoundEngine.safeZoneWarning();
          }
          if (me.hp <= 0 && me.isAlive) {
            me.isAlive = false;
            me.animState = "dead";
            SoundEngine.death();
          }
        } else {
          safeZoneDamageAccum = 0;
        }

        gs.nearbyVehicleId = !me.inVehicle
          ? findNearbyVehicle(me, gs.vehicles)
          : null;
      }

      // Remote player physics (gravity only)
      for (const [id, p] of Object.entries(gs.players)) {
        if (id === playerId || !p.isAlive || p.inVehicle) continue;
        if (!p.isOnGround) {
          p.vy = Math.min((p.vy || 0) + 0.55, 22);
          p.y += p.vy;
          if (p.y >= GROUND_Y - 40) {
            p.y = GROUND_Y - 40;
            p.vy = 0;
            p.isOnGround = true;
          }
        }
      }

      // Parked vehicle gravity
      const emptyInput: InputState = {
        left: false,
        right: false,
        up: false,
        down: false,
        sprint: false,
        shoot: false,
        interact: false,
        slot1: false,
        slot2: false,
        slot3: false,
      };
      for (const v of Object.values(gs.vehicles)) {
        if (!v.driverId) stepVehicle(v, emptyInput, gs);
      }

      // Projectiles
      for (let i = gs.projectiles.length - 1; i >= 0; i--) {
        const proj = gs.projectiles[i];
        const alive = stepProjectile(proj, gs);
        if (!alive) {
          if (proj.isExplosive) {
            spawnParticles(gs.particles, proj.x, proj.y, "#ff8800", 15, true);
            SoundEngine.explosion();
          }
          gs.projectiles.splice(i, 1);
          continue;
        }
        const hit = checkProjectileHit(
          proj,
          gs.players,
          gs.vehicles,
          gs.particles,
          gs.killFeed,
          playerId,
        );
        if (hit) {
          if (proj.isExplosive) {
            spawnParticles(gs.particles, proj.x, proj.y, "#ff8800", 15, true);
            SoundEngine.explosion();
          } else {
            SoundEngine.hit();
          }
          gs.projectiles.splice(i, 1);
        }
      }

      // Particles
      stepParticles(gs.particles);

      // Safe zone shrink (creator manages the stages)
      if (isCreator) {
        const elapsed = Date.now() - gameStartTime.current;
        let stageTarget = SAFE_ZONE_STAGES[0].radius;
        let cumDelay = 0;
        for (let si = 0; si < SAFE_ZONE_STAGES.length; si++) {
          cumDelay += SAFE_ZONE_STAGES[si].delay;
          if (elapsed >= cumDelay) {
            stageTarget =
              SAFE_ZONE_STAGES[Math.min(si + 1, SAFE_ZONE_STAGES.length - 1)]
                .radius;
          }
        }
        gs.safeZone.targetRadius = stageTarget;
        tickSafeZone(gs.safeZone, 1);
        if (ts - lastSafeZoneWrite.current > 5000) {
          lastSafeZoneWrite.current = ts;
          updateDoc(doc(db, "stickFightRooms", roomCode), {
            "safeZone.radius": gs.safeZone.radius,
          }).catch(() => {});
        }
      } else {
        tickSafeZone(gs.safeZone, 1);
      }

      // Kill feed limit
      if (gs.killFeed.length > 6) gs.killFeed.splice(6);

      // Check for game over
      const allPlayers = Object.values(gs.players);
      if (allPlayers.length > 1) {
        const alive = allPlayers.filter((p) => p.isAlive);
        if (alive.length <= 1 && gameActiveRef.current) {
          const winnerName = alive[0]?.name ?? "No one";
          gameActiveRef.current = false;
          if (isCreator) {
            updateDoc(doc(db, "stickFightRooms", roomCode), {
              status: "gameover",
              winner: winnerName,
            }).catch(() => {});
          }
          onGameOver(winnerName);
          return;
        }
      }

      // Camera follow
      if (me) {
        const targetX = me.x - cw / 2;
        const targetY = me.y - ch * 0.55;
        gs.cameraX += (targetX - gs.cameraX) * 0.1;
        gs.cameraY += (targetY - gs.cameraY) * 0.08;
        gs.cameraX = Math.max(0, Math.min(WORLD_W - cw, gs.cameraX));
        gs.cameraY = Math.max(-200, Math.min(WORLD_H - ch + 50, gs.cameraY));
      }

      // ---- RENDER ----
      ctx.clearRect(0, 0, cw, ch);
      drawBackground(ctx, cw, ch, gs.cameraX, gs.frameCount);
      drawSafeZone(ctx, gs.safeZone, gs.cameraX, gs.cameraY, cw, ch);
      drawTerrain(ctx, cw, ch, gs.cameraX, gs.cameraY);
      drawPlatforms(ctx, gs.platforms, gs.cameraX, gs.cameraY);
      drawCrates(ctx, gs.cameraX, gs.cameraY);
      drawWeaponPickups(ctx, gs.weapons, gs.cameraX, gs.cameraY);

      if (gs.ropeAttached && gs.ropeAnchor && me) {
        drawRope(ctx, gs.ropeAnchor, me.x, me.y, gs.cameraX, gs.cameraY);
      }

      for (const v of Object.values(gs.vehicles)) {
        drawVehicle(ctx, v, gs.cameraX, gs.cameraY);
      }
      for (const [id, p] of Object.entries(gs.players)) {
        drawStickman(ctx, p, gs.cameraX, gs.cameraY, id === playerId);
      }
      drawProjectiles(ctx, gs.projectiles, gs.cameraX, gs.cameraY);
      drawParticles(ctx, gs.particles, gs.cameraX, gs.cameraY);
      drawMinimap(ctx, gs, playerId, cw - 135, 70, 125, 75);

      // ---- Firebase write (15fps) ----
      if (me && ts - lastFbWriteRef.current > 66) {
        lastFbWriteRef.current = ts;
        updateDoc(doc(db, "stickFightRooms", roomCode), {
          [`players.${playerId}.x`]: Math.round(me.x),
          [`players.${playerId}.y`]: Math.round(me.y),
          [`players.${playerId}.hp`]: me.hp,
          [`players.${playerId}.isAlive`]: me.isAlive,
          [`players.${playerId}.facingRight`]: me.facingRight,
          [`players.${playerId}.animState`]: me.animState,
          [`players.${playerId}.inVehicle`]: me.inVehicle ?? null,
          [`players.${playerId}.vehicleId`]: me.vehicleId ?? null,
          [`players.${playerId}.weapons`]: me.weapons,
          [`players.${playerId}.activeSlot`]: me.activeSlot,
        }).catch(() => {});
      }

      // HUD update (~5fps)
      if (ts - hudUpdateThrottle.current > 200) {
        hudUpdateThrottle.current = ts;
        const myVehicle = me?.vehicleId ? gs.vehicles[me.vehicleId] : null;
        const allPs = Object.values(gs.players);
        onHudUpdate({
          hp: me?.hp ?? 0,
          maxHp: me?.maxHp ?? 100,
          weapons: me?.weapons ?? DEFAULT_WEAPONS,
          activeSlot: me?.activeSlot ?? 0,
          ammo: me?.ammo ?? [0, 0, 0],
          aliveCount: allPs.filter((p) => p.isAlive).length,
          totalCount: allPs.length,
          inVehicle: me?.inVehicle ?? null,
          vehicleHp: myVehicle?.hp ?? 0,
          vehicleMaxHp: myVehicle?.maxHp ?? 0,
          killFeed: [...gs.killFeed] as KillEvent[],
        });
      }
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      gameActiveRef.current = false;
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [
    playerId,
    isCreator,
    roomCode,
    inputRef,
    initialState,
    onHudUpdate,
    onGameOver,
  ]);

  return (
    <canvas
      ref={canvasRef}
      className="sfr-canvas"
      tabIndex={0}
      style={{ display: "block", width: "100vw", height: "100vh" }}
    />
  );
}
