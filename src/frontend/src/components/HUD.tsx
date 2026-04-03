import React from "react";
import type { KillEvent } from "../game/gameState";
import { WEAPON_DEFS } from "../game/gameState";

interface Props {
  hp: number;
  maxHp: number;
  weapons: string[];
  activeSlot: number;
  ammo: number[];
  aliveCount: number;
  totalCount: number;
  inVehicle: string | null;
  vehicleHp: number;
  vehicleMaxHp: number;
  killFeed: KillEvent[];
  playerName: string;
  mode: string;
  roomCode: string;
}

export default function HUD({
  hp,
  maxHp,
  weapons,
  activeSlot,
  ammo,
  aliveCount,
  totalCount,
  inVehicle,
  vehicleHp,
  vehicleMaxHp,
  killFeed,
  playerName,
  mode,
  roomCode,
}: Props) {
  const hpPct = hp / maxHp;
  const hpColor = hpPct > 0.6 ? "#3bd35a" : hpPct > 0.3 ? "#ffdd44" : "#e53935";

  const weaponEmoji: Record<string, string> = {
    pistol: "🔫",
    rifle: "🔫",
    shotgun: "🔫",
    rocket: "💥",
    grenade: "💣",
    rope: "🪝",
    bat: "🪓",
  };

  const vhpPct = vehicleMaxHp > 0 ? vehicleHp / vehicleMaxHp : 0;

  return (
    <>
      {/* Top Bar */}
      <div className="sfr-hud-topbar">
        <div className="sfr-hud-logo">STICK FIGHT ROYALE</div>
        <div className="sfr-hud-center">
          <span className="sfr-alive-count">
            👥 {aliveCount} / {totalCount} ALIVE
          </span>
        </div>
        <div className="sfr-hud-right">
          <span className="sfr-mode-pill">{mode.toUpperCase()}</span>
          <span className="sfr-room-pill">{roomCode}</span>
        </div>
      </div>

      {/* Top-left player info */}
      <div className="sfr-hud-player-panel">
        <div className="sfr-hud-name">{playerName}</div>
        <div className="sfr-hp-label">
          HP {hp} / {maxHp}
        </div>
        <div className="sfr-hp-bar-bg">
          <div
            className="sfr-hp-bar-fill"
            style={{ width: `${hpPct * 100}%`, background: hpColor }}
          />
        </div>
        {inVehicle && vehicleMaxHp > 0 && (
          <>
            <div className="sfr-hp-label" style={{ marginTop: 6 }}>
              🚗 {inVehicle.toUpperCase()} {vehicleHp}/{vehicleMaxHp}
            </div>
            <div className="sfr-hp-bar-bg">
              <div
                className="sfr-hp-bar-fill"
                style={{ width: `${vhpPct * 100}%`, background: "#58d3ff" }}
              />
            </div>
          </>
        )}
        <div className="sfr-wep-label">
          {weapons[activeSlot]
            ? `${weaponEmoji[weapons[activeSlot]] ?? "🔫"} ${(WEAPON_DEFS[weapons[activeSlot] as keyof typeof WEAPON_DEFS]?.name ?? weapons[activeSlot]).toUpperCase()}  ${ammo[activeSlot] === 999 ? "\u221e" : ammo[activeSlot]}`
            : "No weapon"}
        </div>
      </div>

      {/* Kill Feed */}
      <div className="sfr-kill-feed">
        {killFeed.slice(0, 5).map((k, i) => (
          <div
            key={`${k.killer}-${k.victim}-${k.ts}`}
            className="sfr-kill-row"
            style={{ opacity: 1 - i * 0.15 }}
          >
            <span className="sfr-kill-killer">{k.killer}</span>
            <span className="sfr-kill-icon">
              {k.weapon === "rocket" || k.weapon === "grenade"
                ? " 💥 "
                : " 🔫 "}
            </span>
            <span className="sfr-kill-victim">{k.victim}</span>
          </div>
        ))}
      </div>

      {/* Weapon slots */}
      <div className="sfr-weapon-slots">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`sfr-wep-slot${i === activeSlot ? " sfr-wep-slot--active" : ""}`}
            data-ocid={`game.slot.${i + 1}`}
          >
            <span className="sfr-wep-slot-icon">
              {weapons[i] ? (weaponEmoji[weapons[i]] ?? "🔫") : "•"}
            </span>
            <span className="sfr-wep-slot-name">
              {weapons[i] ? weapons[i].slice(0, 3).toUpperCase() : "---"}
            </span>
            <span className="sfr-wep-slot-ammo">
              {weapons[i] ? (ammo[i] === 999 ? "∞" : ammo[i]) : ""}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}
