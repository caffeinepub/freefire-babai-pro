import React, { useEffect, useRef, useState, useCallback } from "react";
import type { RoomInfo } from "../App";
import type { KillEvent, LocalGameState, PlayerState } from "../game/gameState";
import {
  GROUND_Y,
  PLAYER_COLORS,
  WORLD_W,
  makePlatforms,
  makeVehicles,
  makeWeaponPickups,
} from "../game/gameState";
import { makeInitialSafeZone } from "../game/safeZone";
import Controls from "./Controls";
import GameCanvas from "./GameCanvas";
import HUD from "./HUD";

interface Props {
  roomInfo: RoomInfo;
  onGameOver: (winner: string) => void;
}

const DEFAULT_WEAPONS = ["pistol", "", ""] as [string, string, string];

export default function GameScreen({ roomInfo, onGameOver }: Props) {
  const { roomCode, playerId, playerName, mode } = roomInfo;

  const [hudData, setHudData] = useState({
    hp: 100,
    maxHp: 100,
    weapons: DEFAULT_WEAPONS,
    activeSlot: 0,
    ammo: [999, 0, 0] as [number, number, number],
    aliveCount: 1,
    totalCount: 1,
    inVehicle: null as null | string,
    vehicleHp: 0,
    vehicleMaxHp: 0,
    killFeed: [] as KillEvent[],
  });

  const inputRef = useRef({
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
  });

  const initialState = useRef<LocalGameState | null>(null);

  useEffect(() => {
    const spawnX = 200 + Math.random() * (WORLD_W - 400);
    const myPlayer: PlayerState = {
      id: playerId,
      name: playerName,
      color: PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)],
      x: spawnX,
      y: GROUND_Y - 60,
      vx: 0,
      vy: 0,
      hp: 100,
      maxHp: 100,
      isAlive: true,
      facingRight: true,
      inVehicle: null,
      vehicleId: null,
      weapons: ["pistol", "" as any, "" as any],
      activeSlot: 0,
      ammo: [999, 0, 0],
      team: mode === "duo" ? 0 : null,
      animState: "idle",
      animFrame: 0,
      hitFlash: 0,
      isOnGround: true,
    };
    initialState.current = {
      playerId,
      players: { [playerId]: myPlayer },
      vehicles: Object.fromEntries(makeVehicles().map((v) => [v.id, v])),
      weapons: makeWeaponPickups(),
      projectiles: [],
      particles: [],
      platforms: makePlatforms(),
      safeZone: makeInitialSafeZone(),
      killFeed: [],
      cameraX: Math.max(0, spawnX - window.innerWidth / 2),
      cameraY: 0,
      mouseX: 0,
      mouseY: 0,
      frameCount: 0,
      lastFireTime: 0,
      nearbyVehicleId: null,
      ropeAnchor: null,
      ropeAttached: false,
    };
  }, [playerId, playerName, mode]);

  const handleHudUpdate = useCallback((data: Partial<typeof hudData>) => {
    setHudData((prev) => ({ ...prev, ...data }));
  }, []);

  return (
    <div className="sfr-game-screen">
      <GameCanvas
        roomInfo={roomInfo}
        inputRef={inputRef}
        initialState={initialState}
        onHudUpdate={handleHudUpdate}
        onGameOver={onGameOver}
      />
      <HUD
        hp={hudData.hp}
        maxHp={hudData.maxHp}
        weapons={hudData.weapons}
        activeSlot={hudData.activeSlot}
        ammo={hudData.ammo}
        aliveCount={hudData.aliveCount}
        totalCount={hudData.totalCount}
        inVehicle={hudData.inVehicle}
        vehicleHp={hudData.vehicleHp}
        vehicleMaxHp={hudData.vehicleMaxHp}
        killFeed={hudData.killFeed}
        playerName={playerName}
        mode={mode}
        roomCode={roomCode}
      />
      <Controls inputRef={inputRef} />
    </div>
  );
}
