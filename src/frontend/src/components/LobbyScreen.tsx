import React, { useState, useCallback, useRef, useEffect } from "react";
import type { RoomInfo } from "../App";
import {
  db,
  doc,
  generateRoomCode,
  getDoc,
  onSnapshot,
  setDoc,
  updateDoc,
} from "../firebase";
import { PLAYER_COLORS } from "../game/gameState";

interface Props {
  onJoinGame: (info: RoomInfo) => void;
}

type PlayerSlot = {
  id: string;
  name: string;
  color: string;
  team: number | null;
};

export default function LobbyScreen({ onJoinGame }: Props) {
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"solo" | "duo">("solo");
  const [joinCode, setJoinCode] = useState("");
  const [step, setStep] = useState<"input" | "lobby">("input");
  const [roomCode, setRoomCode] = useState("");
  const [players, setPlayers] = useState<PlayerSlot[]>([]);
  const [isCreator, setIsCreator] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Stable refs so snapshot callback never goes stale
  const playerId = useRef(`player_${Math.random().toString(36).slice(2, 9)}`);
  const unsubRef = useRef<(() => void) | null>(null);
  const roomModeRef = useRef<"solo" | "duo">("solo");
  const nameRef = useRef(name);
  const isCreatorRef = useRef(isCreator);
  const onJoinGameRef = useRef(onJoinGame);
  const roomCodeRef = useRef(roomCode);

  useEffect(() => {
    nameRef.current = name;
  });
  useEffect(() => {
    isCreatorRef.current = isCreator;
  });
  useEffect(() => {
    onJoinGameRef.current = onJoinGame;
  });
  useEffect(() => {
    roomCodeRef.current = roomCode;
  });

  // Listen to room changes once in lobby
  useEffect(() => {
    if (step !== "lobby" || !roomCode) return;
    const pid = playerId.current;
    const code = roomCode;
    const unsub = onSnapshot(doc(db, "stickFightRooms", code), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      const ps = Object.values(data.players ?? {}) as PlayerSlot[];
      setPlayers(ps);
      if (data.status === "countdown" || data.status === "playing") {
        if (unsubRef.current) {
          unsubRef.current();
          unsubRef.current = null;
        }
        onJoinGameRef.current({
          roomCode: code,
          playerId: pid,
          playerName: nameRef.current.trim(),
          mode: (data.mode as "solo" | "duo") ?? roomModeRef.current,
          isCreator: isCreatorRef.current,
        });
      }
    });
    unsubRef.current = unsub;
    return () => {
      if (unsubRef.current) {
        unsubRef.current();
        unsubRef.current = null;
      }
    };
  }, [step, roomCode]);

  const handleCreate = useCallback(async () => {
    if (!name.trim()) {
      setError("Enter your name!");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const code = generateRoomCode();
      const pid = playerId.current;
      const color = PLAYER_COLORS[0];
      roomModeRef.current = mode;
      const roomData = {
        roomCode: code,
        mode,
        status: "lobby",
        createdBy: pid,
        winner: null,
        safeZone: { x: 3000, y: 550, radius: 2700 },
        players: {
          [pid]: {
            id: pid,
            name: name.trim(),
            color,
            x: 500,
            y: 650,
            vx: 0,
            vy: 0,
            hp: 100,
            maxHp: 100,
            isAlive: true,
            facingRight: true,
            inVehicle: null,
            vehicleId: null,
            weapons: ["pistol", "", ""],
            activeSlot: 0,
            ammo: [999, 0, 0],
            team: mode === "duo" ? 0 : null,
            animState: "idle",
            animFrame: 0,
            hitFlash: 0,
            isOnGround: true,
          },
        },
        vehicles: {},
        weapons: {},
        events: [],
      };
      await setDoc(doc(db, "stickFightRooms", code), roomData);
      setRoomCode(code);
      setIsCreator(true);
      setPlayers([
        { id: pid, name: name.trim(), color, team: mode === "duo" ? 0 : null },
      ]);
      setStep("lobby");
    } catch (e: any) {
      setError(`Failed to create room: ${e?.message ?? "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  }, [name, mode]);

  const handleJoin = useCallback(async () => {
    if (!name.trim()) {
      setError("Enter your name!");
      return;
    }
    if (!joinCode.trim()) {
      setError("Enter room code!");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const code = joinCode.trim().toUpperCase();
      const ref = doc(db, "stickFightRooms", code);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        setError("Room not found!");
        setLoading(false);
        return;
      }
      const data = snap.data();
      const existingPlayers = Object.keys(data.players ?? {});
      if (existingPlayers.length >= 20) {
        setError("Room is full (20/20)!");
        setLoading(false);
        return;
      }
      const pid = playerId.current;
      const colorIdx = existingPlayers.length % PLAYER_COLORS.length;
      const color = PLAYER_COLORS[colorIdx];
      const spawnX = 300 + existingPlayers.length * 120;
      const teamAssign =
        data.mode === "duo" ? Math.floor(existingPlayers.length / 2) % 4 : null;
      roomModeRef.current = data.mode ?? mode;
      await updateDoc(ref, {
        [`players.${pid}`]: {
          id: pid,
          name: name.trim(),
          color,
          x: spawnX,
          y: 650,
          vx: 0,
          vy: 0,
          hp: 100,
          maxHp: 100,
          isAlive: true,
          facingRight: true,
          inVehicle: null,
          vehicleId: null,
          weapons: ["pistol", "", ""],
          activeSlot: 0,
          ammo: [999, 0, 0],
          team: teamAssign,
          animState: "idle",
          animFrame: 0,
          hitFlash: 0,
          isOnGround: true,
        },
      });
      setRoomCode(code);
      setIsCreator(false);
      const prevPs = Object.values(data.players ?? {}) as PlayerSlot[];
      setPlayers([
        ...prevPs,
        { id: pid, name: name.trim(), color, team: teamAssign },
      ]);
      setStep("lobby");
    } catch (e: any) {
      setError(`Failed to join: ${e?.message ?? "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  }, [name, joinCode, mode]);

  const handleStart = useCallback(async () => {
    if (players.length < 1) {
      setError("Need at least 1 player!");
      return;
    }
    try {
      await updateDoc(doc(db, "stickFightRooms", roomCode), {
        status: "countdown",
      });
    } catch (e: any) {
      setError(`Failed to start: ${e?.message ?? "Unknown error"}`);
    }
  }, [players.length, roomCode]);

  const handleReadyToPlay = useCallback(() => {
    if (unsubRef.current) {
      unsubRef.current();
      unsubRef.current = null;
    }
    onJoinGame({
      roomCode,
      playerId: playerId.current,
      playerName: name.trim(),
      mode: roomModeRef.current,
      isCreator,
    });
  }, [roomCode, name, isCreator, onJoinGame]);

  if (step === "lobby") {
    return (
      <div className="sfr-lobby">
        <div className="sfr-lobby-card">
          <div className="sfr-room-header">
            <div className="sfr-logo">STICK FIGHT ROYALE</div>
            <div className="sfr-room-code">
              Room: <span>{roomCode}</span>
            </div>
          </div>

          <div className="sfr-mode-badge">
            {roomModeRef.current.toUpperCase()} MODE
          </div>

          <div className="sfr-players-section">
            <div className="sfr-section-label">
              PLAYERS ({players.length}/20)
            </div>
            <div className="sfr-players-grid">
              {Array.from({ length: 20 }).map((_, i) => {
                const p = players[i];
                const slotKey = p ? `filled-${p.id}` : `empty-${i}`;
                return (
                  <div
                    key={slotKey}
                    data-ocid={`lobby.player.item.${i + 1}`}
                    className={`sfr-player-slot${p ? " sfr-player-slot--filled" : ""}`}
                    style={p ? { borderColor: `${p.color}88` } : {}}
                  >
                    {p ? (
                      <>
                        <span
                          className="sfr-player-dot"
                          style={{ background: p.color }}
                        />
                        <span className="sfr-player-slot-name">{p.name}</span>
                        {roomModeRef.current === "duo" && p.team !== null && (
                          <span
                            className="sfr-team-badge"
                            style={{
                              background: `${["#58d3ff", "#ff4444", "#44ff88", "#ffdd44"][(p.team ?? 0) % 4] ?? "#58d3ff"}44`,
                            }}
                          >
                            T{(p.team ?? 0) + 1}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="sfr-slot-empty">Waiting...</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="sfr-share-box">
            <span>Share code:</span>
            <strong>{roomCode}</strong>
            <button
              type="button"
              className="sfr-copy-btn"
              onClick={() => navigator.clipboard.writeText(roomCode)}
            >
              Copy
            </button>
          </div>

          {error && <div className="sfr-error">{error}</div>}

          <div className="sfr-lobby-actions">
            {isCreator ? (
              <button
                data-ocid="lobby.start_button"
                type="button"
                className="sfr-btn sfr-btn--primary"
                onClick={handleStart}
                disabled={players.length < 1}
              >
                {players.length < 2
                  ? `WAITING... (${players.length}/2+)`
                  : `START GAME (${players.length} players)`}
              </button>
            ) : (
              <button
                data-ocid="lobby.ready_button"
                type="button"
                className="sfr-btn sfr-btn--primary"
                onClick={handleReadyToPlay}
              >
                READY TO PLAY
              </button>
            )}
            <button
              data-ocid="lobby.back_button"
              type="button"
              className="sfr-btn sfr-btn--secondary"
              onClick={() => setStep("input")}
            >
              ← Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="sfr-lobby">
      <div className="sfr-hero">
        <div className="sfr-title-glow">STICK FIGHT</div>
        <div className="sfr-title-sub">ROYALE</div>
        <div className="sfr-tagline">Last One Standing Wins</div>
      </div>

      <div className="sfr-lobby-card">
        <div className="sfr-field">
          <div className="sfr-label">PLAYER NAME</div>
          <input
            data-ocid="lobby.input"
            id="player-name"
            className="sfr-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your name..."
            maxLength={12}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
        </div>

        <div className="sfr-field">
          <div className="sfr-label">GAME MODE</div>
          <div className="sfr-mode-toggle">
            <button
              data-ocid="lobby.solo_button"
              type="button"
              className={`sfr-mode-btn${mode === "solo" ? " sfr-mode-btn--active" : ""}`}
              onClick={() => setMode("solo")}
            >
              SOLO
            </button>
            <button
              data-ocid="lobby.duo_button"
              type="button"
              className={`sfr-mode-btn${mode === "duo" ? " sfr-mode-btn--active" : ""}`}
              onClick={() => setMode("duo")}
            >
              DUO
            </button>
          </div>
        </div>

        {error && <div className="sfr-error">{error}</div>}

        <button
          data-ocid="lobby.create_button"
          type="button"
          className="sfr-btn sfr-btn--primary"
          onClick={handleCreate}
          disabled={loading}
        >
          {loading ? "Creating..." : "⚡ CREATE ROOM"}
        </button>

        <div className="sfr-divider">
          <span>OR JOIN</span>
        </div>

        <div className="sfr-join-row">
          <input
            data-ocid="lobby.join_input"
            className="sfr-input sfr-input--code"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="SKY-XXXX"
            maxLength={8}
          />
          <button
            data-ocid="lobby.join_button"
            type="button"
            className="sfr-btn sfr-btn--secondary sfr-join-btn"
            onClick={handleJoin}
            disabled={loading}
          >
            {loading ? "..." : "JOIN"}
          </button>
        </div>
      </div>

      <div className="sfr-footer">
        © {new Date().getFullYear()}. Built with love using{" "}
        <a
          href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
          target="_blank"
          rel="noreferrer"
        >
          caffeine.ai
        </a>
      </div>
    </div>
  );
}
