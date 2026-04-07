// @ts-nocheck
/* eslint-disable */
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import {
  addDoc,
  collection,
  db,
  doc,
  getDoc,
  initFirebase,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "../firebase";

// ─── Types ─────────────────────────────────────────────────────────────────────
interface FireMatch {
  id: string;
  mode: string;
  modeName: string;
  entryFee: number;
  prizePool: number;
  perKill?: number;
  winnerBonus?: number;
  maxPlayers: number;
  joinedPlayers: string[];
  teamA?: string[];
  teamB?: string[];
  status: "open" | "active" | "completed" | "cancelled";
  roomId?: string;
  roomPass?: string;
  scheduledTime?: string;
  customTitle?: string;
  voiceLink?: string;
  isVisible?: boolean;
  startTimestamp?: number;
  createdAt?: number;
  winner?: string;
  prizeAwarded?: number;
}

// biome-ignore lint/correctness/noUnusedVariables: kept for future side-bet feature
interface SideBet {
  id: string;
  matchId: string;
  challenger: string;
  opponent: string;
  amount: number;
  status: "pending" | "accepted" | "completed";
  winner?: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
const MODE_POSTERS: Record<string, { gradient: string; accentColor: string }> =
  {
    "br-solo": {
      gradient:
        "radial-gradient(ellipse at 30% 20%, #1a4a1a 0%, #0d2b0d 40%, #050a05 70%, #000 100%), radial-gradient(ellipse at 70% 80%, #3d0a00 0%, transparent 50%)",
      accentColor: "#ff3d00",
    },
    "br-duo": {
      gradient:
        "radial-gradient(ellipse at 40% 30%, #0a1a3d 0%, #050d1a 40%, #020508 70%, #000 100%), radial-gradient(ellipse at 60% 70%, #001a3d 0%, transparent 50%)",
      accentColor: "#00aaff",
    },
    "br-squad": {
      gradient:
        "radial-gradient(ellipse at 35% 25%, #2a2a00 0%, #1a1500 40%, #0a0800 70%, #000 100%), radial-gradient(ellipse at 65% 75%, #3d1a00 0%, transparent 50%)",
      accentColor: "#ff8800",
    },
    clash: {
      gradient:
        "radial-gradient(ellipse at 50% 40%, #3d0d00 0%, #1a0500 40%, #0a0200 70%, #000 100%), radial-gradient(ellipse at 70% 60%, #2a1500 0%, transparent 50%)",
      accentColor: "#ff4400",
    },
    squad: {
      gradient:
        "radial-gradient(ellipse at 40% 30%, #1a0033 0%, #0d0020 40%, #050010 70%, #000 100%), radial-gradient(ellipse at 60% 70%, #1a0a33 0%, transparent 50%)",
      accentColor: "#cc00ff",
    },
    "1v1": {
      gradient:
        "radial-gradient(ellipse at 50% 30%, #3d1000 0%, #1a0800 40%, #080300 70%, #000 100%), radial-gradient(ellipse at 50% 80%, #2a0800 0%, transparent 50%)",
      accentColor: "#ff6b00",
    },
    "2v2": {
      gradient:
        "radial-gradient(ellipse at 40% 30%, #001a1a 0%, #000d0d 40%, #000505 70%, #000 100%), radial-gradient(ellipse at 60% 70%, #003333 0%, transparent 50%)",
      accentColor: "#00ffcc",
    },
    highstakes: {
      gradient:
        "radial-gradient(ellipse at 50% 30%, #1a1500 0%, #0d0a00 40%, #050400 70%, #000 100%), radial-gradient(ellipse at 50% 80%, #2a2000 0%, transparent 50%)",
      accentColor: "#ffd700",
    },
  };

const MODE_EMOJIS: Record<string, string> = {
  "br-solo": "🎯",
  "br-duo": "🎮",
  "br-squad": "🏆",
  clash: "💥",
  squad: "🛡️",
  "1v1": "⚔️",
  "2v2": "🤝",
  highstakes: "💎",
};

const MODE_LABELS: Record<string, string> = {
  "br-solo": "BR Solo",
  "br-duo": "BR Duo",
  "br-squad": "BR Squad",
  clash: "Clash Squad",
  squad: "Squad 4v4",
  "1v1": "1v1 Custom",
  "2v2": "2v2 Match",
  highstakes: "High Stakes",
};

const FILTER_CHIPS = [
  { key: "all", label: "All" },
  { key: "1v1", label: "1v1" },
  { key: "br", label: "BR" },
  { key: "squad", label: "Squad" },
  { key: "clash", label: "Clash" },
];

const SCHEDULE_SLOTS = [
  "5:00 PM",
  "5:15 PM",
  "5:30 PM",
  "5:45 PM",
  "6:00 PM",
  "6:15 PM",
  "6:30 PM",
  "6:45 PM",
  "7:00 PM",
  "7:15 PM",
  "7:30 PM",
  "7:45 PM",
  "8:00 PM",
  "8:15 PM",
  "8:30 PM",
  "8:45 PM",
  "9:00 PM",
  "9:15 PM",
  "9:30 PM",
  "9:45 PM",
  "10:00 PM",
  "10:15 PM",
  "10:30 PM",
  "10:45 PM",
  "11:00 PM",
];

function getCurrentSlotIndex() {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  const totalMin = h * 60 + m;
  const startMin = 17 * 60; // 5:00 PM
  const endMin = 23 * 60; // 11:00 PM
  if (totalMin < startMin || totalMin > endMin) return -1;
  return Math.floor((totalMin - startMin) / 15);
}

function isTeamMode(mode: string) {
  return mode === "clash" || mode === "squad";
}

function getFilterMatch(mode: string, filter: string) {
  if (filter === "all") return true;
  if (filter === "br") return mode.startsWith("br-");
  if (filter === "squad") return mode === "squad" || mode === "2v2";
  if (filter === "clash") return mode === "clash";
  if (filter === "1v1") return mode === "1v1";
  return false;
}

function playClickSound() {
  try {
    const ctx = new (
      window.AudioContext || (window as any).webkitAudioContext
    )();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  } catch (_) {}
}

// ─── Countdown Hook ─────────────────────────────────────────────────────────
function useCountdown(targetMs: number | null) {
  const [remaining, setRemaining] = useState<number | null>(null);
  useEffect(() => {
    if (!targetMs) return;
    const tick = () => {
      const diff = targetMs - Date.now();
      setRemaining(diff > 0 ? diff : 0);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetMs]);
  return remaining;
}

function formatCountdown(ms: number | null) {
  if (ms === null) return null;
  if (ms <= 0) return "LIVE NOW";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

// ─── Skeleton ──────────────────────────────────────────────────────────────────
function MatchSkeleton() {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.04)",
        borderRadius: 16,
        overflow: "hidden",
        border: "1px solid rgba(255,107,0,0.1)",
        marginBottom: 16,
      }}
    >
      <div
        style={{
          height: 120,
          background:
            "linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%)",
          backgroundSize: "200% 100%",
          animation: "shimmer 1.5s infinite",
        }}
      />
      <div
        style={{
          padding: 14,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {[70, 50, 90].map((w) => (
          <div
            key={`shimmer-${w}`}
            style={{
              height: 10,
              width: `${w}%`,
              background:
                "linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 75%)",
              backgroundSize: "200% 100%",
              animation: "shimmer 1.5s infinite",
              borderRadius: 4,
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Match Card ────────────────────────────────────────────────────────────────
function MatchCard({
  match,
  currentUser,
  coins: _coins,
  onJoin,
  onViewRoom,
  onSideBet,
  onShare,
  userData,
}: {
  match: FireMatch;
  currentUser: string;
  coins: number;
  onJoin: (m: FireMatch) => void;
  onViewRoom: (m: FireMatch) => void;
  onSideBet: (m: FireMatch) => void;
  onShare: (m: FireMatch) => void;
  userData: any;
}) {
  const poster = MODE_POSTERS[match.mode] || MODE_POSTERS["1v1"];
  const emoji = MODE_EMOJIS[match.mode] || "🎮";
  const label = match.modeName || MODE_LABELS[match.mode] || match.mode;
  const isFull =
    match.joinedPlayers.length >= match.maxPlayers || match.status === "active";
  const hasJoined = match.joinedPlayers.includes(currentUser);
  const joinCount = match.joinedPlayers.length;
  const fillPct = Math.min(
    100,
    Math.round((joinCount / match.maxPlayers) * 100),
  );
  const startMs = match.startTimestamp || null;
  const countdown = useCountdown(startMs);
  const cdLabel = formatCountdown(countdown);
  const isLive = match.status === "active";
  const isOpen = match.status === "open" && !isFull;
  const vipDiscount = userData?.vipTier ? 5 : 0;
  const effectiveFee = isTeamMode(match.mode)
    ? Math.ceil(match.entryFee / (match.maxPlayers / 2)) -
      Math.floor(
        (match.entryFee / (match.maxPlayers / 2)) * (vipDiscount / 100),
      )
    : match.entryFee - Math.floor(match.entryFee * (vipDiscount / 100));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      style={{
        borderRadius: 18,
        overflow: "hidden",
        border: `1px solid ${poster.accentColor}33`,
        boxShadow: `0 4px 24px ${poster.accentColor}22, 0 1px 4px rgba(0,0,0,0.6)`,
        marginBottom: 16,
        background: "#060810",
        position: "relative",
      }}
      data-ocid={`matches.card.${match.id}`}
    >
      {/* Cinematic Poster */}
      <div
        style={{
          height: 130,
          background: poster.gradient,
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {/* Glow overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `radial-gradient(ellipse at center, ${poster.accentColor}18 0%, transparent 70%)`,
          }}
        />
        {/* Stick figure silhouettes */}
        <div
          style={{
            position: "absolute",
            bottom: 10,
            left: 20,
            fontSize: 36,
            opacity: 0.35,
            filter: `drop-shadow(0 0 8px ${poster.accentColor})`,
            transform: "scaleX(-1)",
          }}
        >
          🧍
        </div>
        <div
          style={{
            position: "absolute",
            bottom: 10,
            right: 20,
            fontSize: 36,
            opacity: 0.35,
            filter: `drop-shadow(0 0 8px ${poster.accentColor})`,
          }}
        >
          🧍
        </div>
        {/* Mode label */}
        <div
          style={{
            fontFamily: "Orbitron, monospace",
            fontSize: "1.1rem",
            fontWeight: 900,
            color: "#fff",
            textShadow: `0 0 20px ${poster.accentColor}, 0 2px 4px rgba(0,0,0,0.8)`,
            letterSpacing: "0.05em",
            textAlign: "center",
            zIndex: 1,
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 4 }}>{emoji}</div>
          {label}
        </div>

        {/* Badges */}
        <div
          style={{
            position: "absolute",
            top: 8,
            left: 8,
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          {isLive && (
            <span
              style={{
                background: "rgba(255,107,0,0.9)",
                color: "#fff",
                fontSize: "0.6rem",
                fontFamily: "Orbitron, sans-serif",
                fontWeight: 700,
                padding: "2px 7px",
                borderRadius: 6,
                letterSpacing: "0.1em",
                animation: "livePulse 1.5s ease-in-out infinite",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <span
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  background: "#fff",
                  display: "inline-block",
                }}
              />
              LIVE
            </span>
          )}
          {isFull && !isLive && (
            <span
              style={{
                background: "rgba(239,68,68,0.9)",
                color: "#fff",
                fontSize: "0.6rem",
                fontFamily: "Orbitron, sans-serif",
                fontWeight: 700,
                padding: "2px 7px",
                borderRadius: 6,
                letterSpacing: "0.1em",
              }}
            >
              FULL
            </span>
          )}
          {match.customTitle && (
            <span
              style={{
                background: "rgba(255,215,0,0.85)",
                color: "#000",
                fontSize: "0.55rem",
                fontFamily: "Rajdhani, sans-serif",
                fontWeight: 700,
                padding: "2px 6px",
                borderRadius: 5,
                maxWidth: 100,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              🏅 {match.customTitle}
            </span>
          )}
        </div>

        {/* Countdown */}
        {cdLabel && cdLabel !== "LIVE NOW" && (
          <div
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              background: "rgba(0,0,0,0.7)",
              border: `1px solid ${poster.accentColor}66`,
              color: poster.accentColor,
              fontSize: "0.65rem",
              fontFamily: "Orbitron, monospace",
              fontWeight: 700,
              padding: "3px 8px",
              borderRadius: 7,
            }}
          >
            ⏱ {cdLabel}
          </div>
        )}

        {/* Late join warning (< 5 min) */}
        {countdown !== null && countdown < 5 * 60 * 1000 && countdown > 0 && (
          <div
            style={{
              position: "absolute",
              bottom: 6,
              left: "50%",
              transform: "translateX(-50%)",
              background: "rgba(255,60,0,0.85)",
              color: "#fff",
              fontSize: "0.58rem",
              fontFamily: "Rajdhani, sans-serif",
              fontWeight: 700,
              padding: "2px 10px",
              borderRadius: 5,
              whiteSpace: "nowrap",
            }}
          >
            ⚠️ STARTING SOON — Non-refundable
          </div>
        )}
      </div>

      {/* Card Body */}
      <div style={{ padding: "12px 14px" }}>
        {/* Stats Row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 8,
            marginBottom: 10,
          }}
        >
          {[
            { label: "ENTRY", value: `₹${effectiveFee}` },
            { label: "PRIZE", value: `₹${match.prizePool}` },
            ...(match.perKill
              ? [{ label: "PER KILL", value: `₹${match.perKill}` }]
              : [
                  { label: "SLOTS", value: `${joinCount}/${match.maxPlayers}` },
                ]),
          ].map((stat) => (
            <div
              key={stat.label}
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,107,0,0.12)",
                borderRadius: 8,
                padding: "6px 4px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  color: "rgba(255,255,255,0.45)",
                  fontSize: "0.55rem",
                  fontFamily: "Orbitron, monospace",
                  letterSpacing: "0.05em",
                  marginBottom: 2,
                }}
              >
                {stat.label}
              </div>
              <div
                style={{
                  color: "#fff",
                  fontSize: "0.85rem",
                  fontFamily: "Orbitron, monospace",
                  fontWeight: 700,
                  textShadow: `0 0 8px ${poster.accentColor}`,
                }}
              >
                {stat.value}
              </div>
            </div>
          ))}
        </div>

        {/* Fill Progress */}
        <div style={{ marginBottom: 10 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 4,
              fontSize: "0.65rem",
              color: "rgba(255,255,255,0.5)",
              fontFamily: "Rajdhani, sans-serif",
            }}
          >
            <span>
              👥 {joinCount}/{match.maxPlayers} players
            </span>
            <span>{fillPct}%</span>
          </div>
          <div
            style={{
              height: 4,
              background: "rgba(255,255,255,0.08)",
              borderRadius: 2,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${fillPct}%`,
                background: `linear-gradient(90deg, ${poster.accentColor}, ${poster.accentColor}aa)`,
                borderRadius: 2,
                transition: "width 0.5s ease",
              }}
            />
          </div>
        </div>

        {/* Join Order Badges */}
        {joinCount > 0 && (
          <div
            style={{
              display: "flex",
              gap: 5,
              flexWrap: "wrap",
              marginBottom: 10,
            }}
          >
            {match.joinedPlayers.slice(0, 6).map((uid, i) => (
              <span
                key={uid}
                style={{
                  background:
                    i === 0 ? "rgba(255,215,0,0.15)" : "rgba(255,255,255,0.06)",
                  border:
                    i === 0
                      ? "1px solid rgba(255,215,0,0.4)"
                      : "1px solid rgba(255,255,255,0.1)",
                  color: i === 0 ? "#ffd700" : "rgba(255,255,255,0.6)",
                  fontSize: "0.6rem",
                  fontFamily: "Rajdhani, sans-serif",
                  fontWeight: 700,
                  padding: "2px 6px",
                  borderRadius: 5,
                  display: "flex",
                  alignItems: "center",
                  gap: 3,
                }}
              >
                {i === 0 ? "⭐" : `#${i + 1}`} {uid}
              </span>
            ))}
            {joinCount > 6 && (
              <span
                style={{
                  color: "rgba(255,255,255,0.4)",
                  fontSize: "0.6rem",
                  alignSelf: "center",
                }}
              >
                +{joinCount - 6} more
              </span>
            )}
          </div>
        )}

        {/* Team A/B for squad modes */}
        {isTeamMode(match.mode) &&
          ((match.teamA?.length ?? 0) > 0 ||
            (match.teamB?.length ?? 0) > 0) && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
                marginBottom: 10,
              }}
            >
              {(["A", "B"] as const).map((team) => {
                const members =
                  team === "A" ? (match.teamA ?? []) : (match.teamB ?? []);
                return (
                  <div
                    key={team}
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,107,0,0.15)",
                      borderRadius: 8,
                      padding: "6px 8px",
                    }}
                  >
                    <div
                      style={{
                        color: poster.accentColor,
                        fontSize: "0.6rem",
                        fontFamily: "Orbitron, sans-serif",
                        fontWeight: 700,
                        marginBottom: 4,
                      }}
                    >
                      TEAM {team}
                    </div>
                    {members.slice(0, 4).map((uid, i) => (
                      <div
                        key={uid}
                        style={{
                          fontSize: "0.6rem",
                          color: i === 0 ? "#ffd700" : "rgba(255,255,255,0.6)",
                          display: "flex",
                          alignItems: "center",
                          gap: 3,
                          marginBottom: 2,
                        }}
                      >
                        {i === 0 ? "⭐" : "•"} {uid}
                      </div>
                    ))}
                    {members.length === 0 && (
                      <div
                        style={{
                          fontSize: "0.55rem",
                          color: "rgba(255,255,255,0.3)",
                        }}
                      >
                        Waiting...
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

        {/* VIP discount note */}
        {vipDiscount > 0 && (
          <div
            style={{
              fontSize: "0.62rem",
              color: "#ffd700",
              fontFamily: "Rajdhani, sans-serif",
              marginBottom: 8,
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            👑 VIP Discount Applied: {vipDiscount}% off entry fee
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {hasJoined ? (
            <button
              type="button"
              onClick={() => {
                playClickSound();
                onViewRoom(match);
              }}
              data-ocid={`matches.view_room.${match.id}`}
              style={{
                flex: 1,
                padding: "10px 8px",
                background: "linear-gradient(135deg, #ff6b00, #ff8800)",
                border: "none",
                borderRadius: 10,
                color: "#fff",
                fontFamily: "Rajdhani, sans-serif",
                fontWeight: 700,
                fontSize: "0.82rem",
                cursor: "pointer",
                letterSpacing: "0.03em",
                boxShadow: "0 2px 12px rgba(255,107,0,0.35)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 5,
              }}
            >
              🔑 VIEW ROOM ID & PASSWORD
            </button>
          ) : isOpen ? (
            <button
              type="button"
              onClick={() => {
                playClickSound();
                onJoin(match);
              }}
              data-ocid={`matches.join.${match.id}`}
              style={{
                flex: 1,
                padding: "10px 8px",
                background: `linear-gradient(135deg, ${poster.accentColor}, ${poster.accentColor}cc)`,
                border: "none",
                borderRadius: 10,
                color: "#fff",
                fontFamily: "Rajdhani, sans-serif",
                fontWeight: 700,
                fontSize: "0.85rem",
                cursor: "pointer",
                letterSpacing: "0.05em",
                boxShadow: `0 2px 12px ${poster.accentColor}44`,
              }}
            >
              JOIN NOW
            </button>
          ) : (
            <div
              style={{
                flex: 1,
                padding: "10px 8px",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 10,
                color: "rgba(255,255,255,0.4)",
                fontFamily: "Rajdhani, sans-serif",
                fontWeight: 700,
                fontSize: "0.8rem",
                textAlign: "center",
              }}
            >
              {isFull ? "MATCH FULL" : "CLOSED"}
            </div>
          )}

          {/* Side Bet */}
          {hasJoined && isOpen && (
            <button
              type="button"
              onClick={() => {
                playClickSound();
                onSideBet(match);
              }}
              data-ocid={`matches.sidebet.${match.id}`}
              style={{
                padding: "10px 12px",
                background: "rgba(255,215,0,0.12)",
                border: "1px solid rgba(255,215,0,0.3)",
                borderRadius: 10,
                color: "#ffd700",
                fontFamily: "Rajdhani, sans-serif",
                fontWeight: 700,
                fontSize: "0.78rem",
                cursor: "pointer",
              }}
            >
              💰 Bet
            </button>
          )}

          {/* Voice Channel */}
          {match.voiceLink && (
            <a
              href={match.voiceLink}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                padding: "10px 12px",
                background: "rgba(0,200,100,0.1)",
                border: "1px solid rgba(0,200,100,0.25)",
                borderRadius: 10,
                color: "#00c864",
                fontFamily: "Rajdhani, sans-serif",
                fontWeight: 700,
                fontSize: "0.78rem",
                textDecoration: "none",
                display: "flex",
                alignItems: "center",
              }}
            >
              🎙️ Voice
            </a>
          )}

          {/* Share */}
          <button
            type="button"
            onClick={() => onShare(match)}
            data-ocid={`matches.share.${match.id}`}
            style={{
              padding: "10px 12px",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 10,
              color: "rgba(255,255,255,0.6)",
              fontFamily: "Rajdhani, sans-serif",
              fontWeight: 700,
              fontSize: "0.78rem",
              cursor: "pointer",
            }}
          >
            📤
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Room Reveal Modal ─────────────────────────────────────────────────────────
function RoomRevealModal({
  match,
  onClose,
}: {
  match: FireMatch;
  onClose: () => void;
}) {
  const [liveMatch, setLiveMatch] = useState<FireMatch>(match);
  const copyToClipboard = (text: string, _label: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    if (navigator.vibrate) navigator.vibrate([30]);
  };

  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(doc(db, "matches", match.id), (snap) => {
      if (snap.exists()) {
        setLiveMatch({
          id: snap.id,
          ...(snap.data() as Omit<FireMatch, "id">),
        });
      }
    });
    return () => unsub();
  }, [match.id]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.85)",
        zIndex: 200,
        display: "flex",
        alignItems: "flex-end",
        padding: 0,
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 250 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          background: "linear-gradient(180deg, #0d0f1a 0%, #060810 100%)",
          border: "1px solid rgba(255,107,0,0.3)",
          borderRadius: "20px 20px 0 0",
          padding: 24,
          paddingBottom: 36,
        }}
      >
        <div
          style={{
            width: 40,
            height: 4,
            background: "rgba(255,255,255,0.2)",
            borderRadius: 2,
            margin: "0 auto 20px",
          }}
        />
        <div
          style={{
            fontFamily: "Orbitron, monospace",
            fontSize: "1rem",
            fontWeight: 700,
            color: "#ff6b00",
            textAlign: "center",
            marginBottom: 20,
          }}
        >
          🔑 Room Credentials
        </div>

        {liveMatch.roomId ? (
          <>
            {[
              { label: "ROOM ID", value: liveMatch.roomId },
              { label: "PASSWORD", value: liveMatch.roomPass || "N/A" },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  background: "rgba(255,107,0,0.08)",
                  border: "1px solid rgba(255,107,0,0.3)",
                  borderRadius: 12,
                  padding: "12px 14px",
                  marginBottom: 12,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: "0.6rem",
                      color: "rgba(255,255,255,0.45)",
                      fontFamily: "Orbitron, sans-serif",
                      letterSpacing: "0.1em",
                      marginBottom: 4,
                    }}
                  >
                    {item.label}
                  </div>
                  <div
                    style={{
                      fontSize: "1.2rem",
                      fontFamily: "Orbitron, monospace",
                      fontWeight: 700,
                      color: "#fff",
                      letterSpacing: "0.1em",
                    }}
                  >
                    {item.value}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(item.value, item.label)}
                  data-ocid={`room.copy.${item.label.toLowerCase()}`}
                  style={{
                    background: "rgba(255,107,0,0.2)",
                    border: "1px solid rgba(255,107,0,0.4)",
                    borderRadius: 8,
                    color: "#ff6b00",
                    padding: "6px 12px",
                    fontFamily: "Rajdhani, sans-serif",
                    fontWeight: 700,
                    fontSize: "0.75rem",
                    cursor: "pointer",
                  }}
                >
                  📋 Copy
                </button>
              </div>
            ))}
          </>
        ) : (
          <div
            style={{
              textAlign: "center",
              padding: "30px 16px",
              background: "rgba(255,255,255,0.03)",
              borderRadius: 12,
              border: "1px dashed rgba(255,107,0,0.2)",
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 10 }}>⏳</div>
            <div
              style={{
                color: "rgba(255,255,255,0.6)",
                fontFamily: "Rajdhani, sans-serif",
                fontSize: "0.9rem",
              }}
            >
              Room ID &amp; Password not yet assigned by admin...
            </div>
            <div
              style={{
                color: "rgba(255,255,255,0.35)",
                fontSize: "0.75rem",
                marginTop: 6,
              }}
            >
              This page will update automatically when admin assigns credentials
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          style={{
            width: "100%",
            marginTop: 14,
            padding: "12px",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 10,
            color: "rgba(255,255,255,0.6)",
            fontFamily: "Rajdhani, sans-serif",
            fontWeight: 700,
            fontSize: "0.85rem",
            cursor: "pointer",
          }}
        >
          Close
        </button>
      </motion.div>
    </motion.div>
  );
}

// ─── Join Modal ────────────────────────────────────────────────────────────────
function JoinModal({
  match,
  currentUser,
  coins,
  userData,
  onClose,
  onJoined,
  showToast,
}: {
  match: FireMatch;
  currentUser: string;
  coins: number;
  userData: any;
  onClose: () => void;
  onJoined: () => void;
  showToast: (msg: string, type?: "success" | "error") => void;
}) {
  const [teamChoice, setTeamChoice] = useState<"A" | "B">("A");
  const [joining, setJoining] = useState(false);
  const poster = MODE_POSTERS[match.mode] || MODE_POSTERS["1v1"];
  const teamMode = isTeamMode(match.mode);
  const vipDiscount = userData?.vipTier ? 5 : 0;
  const rawFee = teamMode
    ? Math.ceil(match.entryFee / (match.maxPlayers / 2))
    : match.entryFee;
  const fee = rawFee - Math.floor(rawFee * (vipDiscount / 100));
  const now = Date.now();
  const startMs = match.startTimestamp || null;
  const lateJoin = startMs !== null && startMs - now < 5 * 60 * 1000;

  const handleConfirm = async () => {
    if (coins < fee) {
      showToast(`Insufficient balance. Need ₹${fee}, have ₹${coins}`, "error");
      return;
    }
    setJoining(true);
    try {
      // Deduct from wallet
      const walletSnap = await getDoc(doc(db, "wallet", currentUser));
      const currentCoins = walletSnap.exists()
        ? (walletSnap.data().coins ?? 0)
        : 0;
      if (currentCoins < fee) {
        showToast("Insufficient balance", "error");
        return;
      }
      await setDoc(doc(db, "wallet", currentUser), {
        coins: currentCoins - fee,
      });

      // Add to match
      const matchSnap = await getDoc(doc(db, "matches", match.id));
      if (!matchSnap.exists()) {
        showToast("Match not found", "error");
        return;
      }
      const matchData = matchSnap.data() as FireMatch;
      const currentJoined = matchData.joinedPlayers || [];
      if (currentJoined.includes(currentUser)) {
        showToast("Already joined this match", "error");
        return;
      }
      if (currentJoined.length >= match.maxPlayers) {
        showToast("Match is full", "error");
        return;
      }
      const newJoined = [...currentJoined, currentUser];
      const updates: Record<string, unknown> = { joinedPlayers: newJoined };

      if (teamMode) {
        const teamAMembers = matchData.teamA || [];
        const teamBMembers = matchData.teamB || [];
        const halfSize = match.maxPlayers / 2;
        // Auto-assign to less full team if choice is unavailable
        let chosenTeam = teamChoice;
        if (chosenTeam === "A" && teamAMembers.length >= halfSize) {
          chosenTeam = "B";
        } else if (chosenTeam === "B" && teamBMembers.length >= halfSize) {
          chosenTeam = "A";
        }
        if (chosenTeam === "A") {
          updates.teamA = [...teamAMembers, currentUser];
        } else {
          updates.teamB = [...teamBMembers, currentUser];
        }
      }

      // Auto-lock if full
      if (newJoined.length >= match.maxPlayers) {
        updates.status = "active";
      }

      await updateDoc(doc(db, "matches", match.id), updates);

      // Notify admin
      await addDoc(collection(db, "notifications"), {
        uid: "admin",
        title: "🎮 Player Joined",
        message: `${currentUser} joined ${match.modeName || match.mode} match (₹${fee} deducted)`,
        read: false,
        timestamp: serverTimestamp(),
      });

      onJoined();
    } catch (_err) {
      showToast("Failed to join. Try again.", "error");
    } finally {
      setJoining(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.85)",
        zIndex: 200,
        display: "flex",
        alignItems: "flex-end",
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 250 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          background: "linear-gradient(180deg, #0d0f1a 0%, #060810 100%)",
          border: `1px solid ${poster.accentColor}33`,
          borderRadius: "20px 20px 0 0",
          padding: 24,
          paddingBottom: 36,
        }}
      >
        <div
          style={{
            width: 40,
            height: 4,
            background: "rgba(255,255,255,0.2)",
            borderRadius: 2,
            margin: "0 auto 20px",
          }}
        />
        <div
          style={{
            fontFamily: "Orbitron, monospace",
            fontSize: "0.95rem",
            fontWeight: 700,
            color: "#fff",
            textAlign: "center",
            marginBottom: 6,
          }}
        >
          {MODE_EMOJIS[match.mode]} {match.modeName || MODE_LABELS[match.mode]}
        </div>
        {match.customTitle && (
          <div
            style={{
              textAlign: "center",
              color: "#ffd700",
              fontSize: "0.7rem",
              fontFamily: "Rajdhani, sans-serif",
              fontWeight: 700,
              marginBottom: 16,
            }}
          >
            🏅 {match.customTitle}
          </div>
        )}

        {/* Fee breakdown */}
        <div
          style={{
            background: "rgba(255,107,0,0.07)",
            border: "1px solid rgba(255,107,0,0.2)",
            borderRadius: 12,
            padding: 14,
            marginBottom: 16,
          }}
        >
          {teamMode && (
            <div
              style={{
                color: "rgba(255,255,255,0.5)",
                fontSize: "0.7rem",
                fontFamily: "Rajdhani, sans-serif",
                marginBottom: 6,
              }}
            >
              Team entry: ₹{match.entryFee} ÷ {match.maxPlayers / 2} players = ₹
              {rawFee}/player
            </div>
          )}
          {vipDiscount > 0 && (
            <div
              style={{
                color: "#ffd700",
                fontSize: "0.7rem",
                fontFamily: "Rajdhani, sans-serif",
                marginBottom: 6,
              }}
            >
              👑 VIP discount: -{vipDiscount}%
            </div>
          )}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span
              style={{
                color: "rgba(255,255,255,0.7)",
                fontFamily: "Rajdhani, sans-serif",
                fontWeight: 700,
                fontSize: "0.9rem",
              }}
            >
              Your Entry Fee
            </span>
            <span
              style={{
                color: "#ff6b00",
                fontFamily: "Orbitron, monospace",
                fontWeight: 700,
                fontSize: "1.1rem",
              }}
            >
              ₹{fee}
            </span>
          </div>
          <div
            style={{
              color:
                coins >= fee ? "rgba(0,200,100,0.7)" : "rgba(239,68,68,0.8)",
              fontSize: "0.7rem",
              fontFamily: "Rajdhani, sans-serif",
              marginTop: 4,
            }}
          >
            Balance: ₹{coins} → After: ₹{Math.max(0, coins - fee)}
          </div>
        </div>

        {/* Late warning */}
        {lateJoin && (
          <div
            style={{
              background: "rgba(255,60,0,0.12)",
              border: "1px solid rgba(255,60,0,0.3)",
              borderRadius: 10,
              padding: "8px 12px",
              marginBottom: 14,
              color: "#ff6b00",
              fontSize: "0.75rem",
              fontFamily: "Rajdhani, sans-serif",
              fontWeight: 700,
            }}
          >
            ⚠️ Match starts soon! Entry fee is non-refundable.
          </div>
        )}

        {/* Team selection */}
        {teamMode && (
          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                fontSize: "0.7rem",
                color: "rgba(255,255,255,0.5)",
                fontFamily: "Rajdhani, sans-serif",
                marginBottom: 8,
              }}
            >
              Choose Team:
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              {(["A", "B"] as const).map((t) => {
                const teamMembers =
                  t === "A" ? (match.teamA ?? []) : (match.teamB ?? []);
                const halfSize = match.maxPlayers / 2;
                const full = teamMembers.length >= halfSize;
                return (
                  <button
                    key={t}
                    type="button"
                    disabled={full}
                    onClick={() => setTeamChoice(t)}
                    data-ocid={`join.team_${t.toLowerCase()}.button`}
                    style={{
                      flex: 1,
                      padding: "10px",
                      borderRadius: 10,
                      border:
                        teamChoice === t
                          ? "2px solid #ff6b00"
                          : "1px solid rgba(255,255,255,0.12)",
                      background:
                        teamChoice === t
                          ? "rgba(255,107,0,0.15)"
                          : "rgba(255,255,255,0.04)",
                      color: full ? "rgba(255,255,255,0.3)" : "#fff",
                      fontFamily: "Rajdhani, sans-serif",
                      fontWeight: 700,
                      fontSize: "0.85rem",
                      cursor: full ? "not-allowed" : "pointer",
                    }}
                  >
                    Team {t} ({teamMembers.length}/{halfSize}){full && " FULL"}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <button
          type="button"
          disabled={joining || coins < fee}
          onClick={handleConfirm}
          data-ocid="join.confirm.button"
          style={{
            width: "100%",
            padding: "14px",
            background:
              coins < fee
                ? "rgba(255,255,255,0.08)"
                : `linear-gradient(135deg, ${poster.accentColor}, ${poster.accentColor}cc)`,
            border: "none",
            borderRadius: 12,
            color: coins < fee ? "rgba(255,255,255,0.4)" : "#fff",
            fontFamily: "Orbitron, monospace",
            fontWeight: 700,
            fontSize: "0.9rem",
            cursor: coins < fee || joining ? "not-allowed" : "pointer",
            letterSpacing: "0.05em",
            boxShadow:
              coins >= fee ? `0 4px 16px ${poster.accentColor}44` : "none",
          }}
        >
          {joining
            ? "Joining..."
            : coins < fee
              ? `Insufficient Balance (Need ₹${fee})`
              : `CONFIRM JOIN ₹${fee}`}
        </button>
        <button
          type="button"
          onClick={onClose}
          style={{
            width: "100%",
            marginTop: 10,
            padding: "11px",
            background: "transparent",
            border: "none",
            color: "rgba(255,255,255,0.4)",
            fontFamily: "Rajdhani, sans-serif",
            fontWeight: 600,
            fontSize: "0.85rem",
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </motion.div>
    </motion.div>
  );
}

// ─── Side Bet Modal ───────────────────────────────────────────────────────────
function SideBetModal({
  match,
  currentUser,
  coins,
  onClose,
  showToast,
}: {
  match: FireMatch;
  currentUser: string;
  coins: number;
  onClose: () => void;
  showToast: (msg: string, type?: "success" | "error") => void;
}) {
  const [opponent, setOpponent] = useState("");
  const [amount, setAmount] = useState(10);
  const [sending, setSending] = useState(false);
  const opponents = match.joinedPlayers.filter((p) => p !== currentUser);

  const sendBet = async () => {
    if (!opponent) {
      showToast("Select an opponent", "error");
      return;
    }
    if (coins < amount) {
      showToast("Insufficient balance", "error");
      return;
    }
    setSending(true);
    try {
      await addDoc(collection(db, "sideBets"), {
        matchId: match.id,
        challenger: currentUser,
        opponent,
        amount,
        status: "pending",
        createdAt: serverTimestamp(),
      });
      await addDoc(collection(db, "notifications"), {
        uid: opponent,
        title: "💰 Side Bet Challenge!",
        message: `${currentUser} challenges you to a ₹${amount} side bet in ${match.modeName || match.mode}!`,
        read: false,
        timestamp: serverTimestamp(),
      });
      showToast(`Side bet challenge sent to ${opponent}!`);
      onClose();
    } catch (_) {
      showToast("Failed to send bet", "error");
    } finally {
      setSending(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.85)",
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "linear-gradient(180deg, #0d0f1a 0%, #060810 100%)",
          border: "1px solid rgba(255,215,0,0.3)",
          borderRadius: 18,
          padding: 24,
          width: "100%",
          maxWidth: 380,
        }}
      >
        <div
          style={{
            fontFamily: "Orbitron, monospace",
            fontSize: "1rem",
            fontWeight: 700,
            color: "#ffd700",
            textAlign: "center",
            marginBottom: 20,
          }}
        >
          💰 Side Bet Challenge
        </div>

        <div style={{ marginBottom: 14 }}>
          <div
            style={{
              fontSize: "0.7rem",
              color: "rgba(255,255,255,0.5)",
              fontFamily: "Rajdhani, sans-serif",
              marginBottom: 6,
            }}
          >
            Select Opponent:
          </div>
          {opponents.length === 0 ? (
            <div
              style={{
                color: "rgba(255,255,255,0.35)",
                fontSize: "0.8rem",
                fontFamily: "Rajdhani, sans-serif",
              }}
            >
              No other players in this match yet
            </div>
          ) : (
            <select
              value={opponent}
              onChange={(e) => setOpponent(e.target.value)}
              data-ocid="sidebet.opponent.select"
              style={{
                width: "100%",
                padding: "10px 12px",
                background: "#0d0f1a",
                border: "1px solid rgba(255,215,0,0.25)",
                borderRadius: 8,
                color: "#fff",
                fontFamily: "Rajdhani, sans-serif",
                fontSize: "0.9rem",
              }}
            >
              <option value="">-- Choose opponent --</option>
              {opponents.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          )}
        </div>

        <div style={{ marginBottom: 20 }}>
          <div
            style={{
              fontSize: "0.7rem",
              color: "rgba(255,255,255,0.5)",
              fontFamily: "Rajdhani, sans-serif",
              marginBottom: 6,
            }}
          >
            Bet Amount:
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {[10, 20, 50].map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAmount(a)}
                data-ocid={`sidebet.amount.${a}`}
                style={{
                  flex: 1,
                  padding: "9px",
                  borderRadius: 8,
                  border:
                    amount === a
                      ? "2px solid #ffd700"
                      : "1px solid rgba(255,215,0,0.2)",
                  background:
                    amount === a
                      ? "rgba(255,215,0,0.15)"
                      : "rgba(255,255,255,0.04)",
                  color: amount === a ? "#ffd700" : "rgba(255,255,255,0.6)",
                  fontFamily: "Orbitron, monospace",
                  fontWeight: 700,
                  fontSize: "0.85rem",
                  cursor: "pointer",
                }}
              >
                ₹{a}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          disabled={sending || !opponent || coins < amount}
          onClick={sendBet}
          data-ocid="sidebet.send.button"
          style={{
            width: "100%",
            padding: "12px",
            background:
              opponent && coins >= amount
                ? "linear-gradient(135deg, #ffd700, #ffaa00)"
                : "rgba(255,255,255,0.06)",
            border: "none",
            borderRadius: 10,
            color:
              opponent && coins >= amount ? "#000" : "rgba(255,255,255,0.3)",
            fontFamily: "Orbitron, monospace",
            fontWeight: 700,
            fontSize: "0.85rem",
            cursor:
              sending || !opponent || coins < amount
                ? "not-allowed"
                : "pointer",
          }}
        >
          {sending ? "Sending..." : `Challenge for ₹${amount}`}
        </button>
        <button
          type="button"
          onClick={onClose}
          style={{
            width: "100%",
            marginTop: 10,
            padding: "10px",
            background: "transparent",
            border: "none",
            color: "rgba(255,255,255,0.4)",
            fontFamily: "Rajdhani, sans-serif",
            fontWeight: 600,
            fontSize: "0.8rem",
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </motion.div>
    </motion.div>
  );
}

// ─── MatchesView ───────────────────────────────────────────────────────────────
export default function MatchesView({
  user,
  onNavigate: _onNavigate,
}: {
  user: any;
  onNavigate: (view: string) => void;
}) {
  const [matches, setMatches] = useState<FireMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [currentSlot, setCurrentSlot] = useState(getCurrentSlotIndex());
  const [joinTarget, setJoinTarget] = useState<FireMatch | null>(null);
  const [roomTarget, setRoomTarget] = useState<FireMatch | null>(null);
  const [betTarget, setBetTarget] = useState<FireMatch | null>(null);
  const [coins, setCoins] = useState(0);
  const [userData, setUserData] = useState<any>(null);
  const [copyToast, setCopyToast] = useState<string | null>(null);
  const scheduleRef = useRef<HTMLDivElement>(null);
  const liveSlotRef = useRef<HTMLDivElement>(null);
  const uid = user?.uid || "";

  // Load user wallet + data
  useEffect(() => {
    if (!uid) return;
    let cancel = false;
    const load = async () => {
      await initFirebase();
      if (cancel) return;
      try {
        const walletSnap = await getDoc(doc(db, "wallet", uid));
        if (!cancel && walletSnap.exists())
          setCoins(walletSnap.data().coins ?? 0);
        const userSnap = await getDoc(doc(db, "users", uid));
        if (!cancel && userSnap.exists()) setUserData(userSnap.data());
      } catch (_) {}
    };
    load();
    return () => {
      cancel = true;
    };
  }, [uid]);

  // Real-time wallet sync
  useEffect(() => {
    if (!uid || !db) return;
    const unsub = onSnapshot(doc(db, "wallet", uid), (snap) => {
      if (snap.exists()) setCoins(snap.data().coins ?? 0);
    });
    return () => unsub();
  }, [uid]);

  // Real-time matches
  useEffect(() => {
    let unsub: (() => void) | null = null;
    const setup = async () => {
      await initFirebase();
      const q = query(
        collection(db, "matches"),
        where("status", "in", ["open", "active"]),
        orderBy("createdAt", "desc"),
      );
      unsub = onSnapshot(
        q,
        (snap) => {
          const data = snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as Omit<FireMatch, "id">) }))
            .filter((m) => m.isVisible !== false);
          setMatches(data);
          setLoading(false);
        },
        () => setLoading(false),
      );
    };
    setup();
    return () => {
      if (unsub) unsub();
    };
  }, []);

  // Schedule live slot update
  useEffect(() => {
    const id = setInterval(() => {
      setCurrentSlot(getCurrentSlotIndex());
    }, 15 * 1000);
    return () => clearInterval(id);
  }, []);

  // Scroll to live slot
  // biome-ignore lint/correctness/useExhaustiveDependencies: currentSlot triggers scroll but isn't used in body
  useEffect(() => {
    if (liveSlotRef.current && scheduleRef.current) {
      const container = scheduleRef.current;
      const el = liveSlotRef.current;
      const offset =
        el.offsetLeft - container.offsetWidth / 2 + el.offsetWidth / 2;
      container.scrollTo({ left: offset, behavior: "smooth" });
    }
  }, [currentSlot]);

  const handleShare = (m: FireMatch) => {
    const text = `🎮 Join MR.SONIC FF!\nMode: ${m.modeName || MODE_LABELS[m.mode] || m.mode}\nEntry: ₹${m.entryFee} | Prize: ₹${m.prizePool}\nDownload at: ${window.location.href}`;
    navigator.clipboard.writeText(text).catch(() => {});
    if (navigator.vibrate) navigator.vibrate([30]);
    setCopyToast("Match link copied!");
    setTimeout(() => setCopyToast(null), 2500);
  };

  const filteredMatches = matches.filter((m) => getFilterMatch(m.mode, filter));

  // My active matches (user has joined but not completed)
  const myActiveMatches = matches.filter((m) => m.joinedPlayers?.includes(uid));

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.35 }}
      style={{
        minHeight: "100%",
        paddingBottom: 100,
        background: "#060810",
      }}
    >
      {/* Copy Toast */}
      <AnimatePresence>
        {copyToast && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            style={{
              position: "fixed",
              top: 70,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 300,
              background: "rgba(0,180,80,0.92)",
              color: "#fff",
              padding: "8px 20px",
              borderRadius: 10,
              fontFamily: "Rajdhani, sans-serif",
              fontWeight: 700,
              fontSize: "0.85rem",
              backdropFilter: "blur(10px)",
            }}
          >
            ✓ {copyToast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modals */}
      <AnimatePresence>
        {joinTarget && (
          <JoinModal
            key="join-modal"
            match={joinTarget}
            currentUser={uid}
            coins={coins}
            userData={userData}
            onClose={() => setJoinTarget(null)}
            onJoined={() => {
              setJoinTarget(null);
              setCopyToast("Joined! Waiting for room credentials...");
              setTimeout(() => setCopyToast(null), 3000);
            }}
            showToast={(msg, _type) => {
              setCopyToast(msg);
              setTimeout(() => setCopyToast(null), 3000);
            }}
          />
        )}
        {roomTarget && (
          <RoomRevealModal
            key="room-modal"
            match={roomTarget}
            onClose={() => setRoomTarget(null)}
          />
        )}
        {betTarget && (
          <SideBetModal
            key="bet-modal"
            match={betTarget}
            currentUser={uid}
            coins={coins}
            onClose={() => setBetTarget(null)}
            showToast={(msg, _type) => {
              setCopyToast(msg);
              setTimeout(() => setCopyToast(null), 3000);
            }}
          />
        )}
      </AnimatePresence>

      {/* Header */}
      <div
        style={{
          padding: "20px 16px 12px",
          background:
            "linear-gradient(180deg, rgba(255,107,0,0.08) 0%, transparent 100%)",
        }}
      >
        <div
          style={{
            fontFamily: "Orbitron, monospace",
            fontSize: "1.1rem",
            fontWeight: 700,
            color: "#fff",
            marginBottom: 4,
          }}
        >
          ⚔️ Live Matches
        </div>
        <div
          style={{
            fontSize: "0.75rem",
            color: "rgba(255,255,255,0.45)",
            fontFamily: "Rajdhani, sans-serif",
          }}
        >
          ₹{coins} balance · {filteredMatches.length} active{" "}
          {filteredMatches.length === 1 ? "match" : "matches"}
        </div>
      </div>

      {/* Schedule Strip */}
      <div
        style={{
          padding: "0 16px 4px",
          marginBottom: 4,
        }}
      >
        <div
          style={{
            fontSize: "0.6rem",
            color: "rgba(255,255,255,0.4)",
            fontFamily: "Orbitron, sans-serif",
            letterSpacing: "0.1em",
            marginBottom: 6,
          }}
        >
          TODAY'S SCHEDULE
        </div>
        <div
          ref={scheduleRef}
          style={{
            display: "flex",
            gap: 6,
            overflowX: "auto",
            scrollbarWidth: "none",
            paddingBottom: 4,
          }}
        >
          {SCHEDULE_SLOTS.map((slot, i) => {
            const isLive = i === currentSlot;
            const isPast = i < currentSlot;
            return (
              <div
                key={slot}
                ref={isLive ? liveSlotRef : undefined}
                style={{
                  minWidth: 70,
                  padding: "6px 10px",
                  borderRadius: 8,
                  background: isLive
                    ? "rgba(255,107,0,0.2)"
                    : isPast
                      ? "rgba(255,255,255,0.03)"
                      : "rgba(255,255,255,0.06)",
                  border: isLive
                    ? "1px solid rgba(255,107,0,0.6)"
                    : isPast
                      ? "1px solid rgba(255,255,255,0.05)"
                      : "1px solid rgba(255,255,255,0.1)",
                  textAlign: "center",
                  animation: isLive
                    ? "livePulse 2s ease-in-out infinite"
                    : "none",
                  flexShrink: 0,
                }}
                data-ocid={isLive ? "schedule.live_slot" : undefined}
              >
                <div
                  style={{
                    fontSize: "0.65rem",
                    fontFamily: "Orbitron, monospace",
                    color: isLive
                      ? "#ff6b00"
                      : isPast
                        ? "rgba(255,255,255,0.2)"
                        : "rgba(255,255,255,0.7)",
                    fontWeight: isLive ? 700 : 500,
                  }}
                >
                  {slot}
                </div>
                {isLive && (
                  <div
                    style={{
                      fontSize: "0.5rem",
                      color: "#ff6b00",
                      fontFamily: "Rajdhani, sans-serif",
                      fontWeight: 700,
                      letterSpacing: "0.05em",
                    }}
                  >
                    LIVE
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Filter Chips */}
      <div
        style={{
          padding: "8px 16px 12px",
          display: "flex",
          gap: 8,
          overflowX: "auto",
          scrollbarWidth: "none",
        }}
      >
        {FILTER_CHIPS.map((chip) => (
          <button
            key={chip.key}
            type="button"
            onClick={() => {
              playClickSound();
              setFilter(chip.key);
            }}
            data-ocid={`matches.filter.${chip.key}`}
            style={{
              padding: "6px 16px",
              borderRadius: 20,
              border:
                filter === chip.key
                  ? "1px solid #ff6b00"
                  : "1px solid rgba(255,255,255,0.12)",
              background:
                filter === chip.key
                  ? "rgba(255,107,0,0.2)"
                  : "rgba(255,255,255,0.05)",
              color: filter === chip.key ? "#ff6b00" : "rgba(255,255,255,0.6)",
              fontFamily: "Rajdhani, sans-serif",
              fontWeight: 700,
              fontSize: "0.8rem",
              cursor: "pointer",
              whiteSpace: "nowrap",
              flexShrink: 0,
              transition: "all 0.2s ease",
            }}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* Match Cards */}
      <div style={{ padding: "0 16px" }}>
        {loading ? (
          <>
            <MatchSkeleton />
            <MatchSkeleton />
            <MatchSkeleton />
          </>
        ) : filteredMatches.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "50px 20px",
              background: "rgba(255,255,255,0.03)",
              borderRadius: 16,
              border: "1px dashed rgba(255,107,0,0.15)",
            }}
            data-ocid="matches.empty_state"
          >
            <div style={{ fontSize: 48, marginBottom: 12 }}>🎮</div>
            <div
              style={{
                fontFamily: "Orbitron, monospace",
                fontSize: "0.9rem",
                fontWeight: 700,
                color: "rgba(255,255,255,0.6)",
                marginBottom: 6,
              }}
            >
              No Matches Available
            </div>
            <div
              style={{
                fontSize: "0.75rem",
                color: "rgba(255,255,255,0.35)",
                fontFamily: "Rajdhani, sans-serif",
                lineHeight: 1.5,
              }}
            >
              Admin will open matches at 5:00 PM
              <br />
              Check back soon!
            </div>
          </div>
        ) : (
          filteredMatches.map((m, i) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06, duration: 0.35 }}
            >
              <MatchCard
                match={m}
                currentUser={uid}
                coins={coins}
                userData={userData}
                onJoin={setJoinTarget}
                onViewRoom={setRoomTarget}
                onSideBet={setBetTarget}
                onShare={handleShare}
              />
            </motion.div>
          ))
        )}
      </div>

      {/* My Active Matches */}
      {myActiveMatches.length > 0 && (
        <div style={{ padding: "8px 16px 0" }}>
          <div
            style={{
              fontFamily: "Orbitron, monospace",
              fontSize: "0.85rem",
              fontWeight: 700,
              color: "#ff6b00",
              marginBottom: 10,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#ff6b00",
                display: "inline-block",
                animation: "livePulse 1.5s ease-in-out infinite",
              }}
            />
            MY ACTIVE MATCHES
          </div>
          {myActiveMatches.map((m) => (
            <div
              key={m.id}
              style={{
                background: "rgba(255,107,0,0.06)",
                border: "1px solid rgba(255,107,0,0.2)",
                borderRadius: 12,
                padding: 14,
                marginBottom: 10,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
              data-ocid={`matches.active.${m.id}`}
            >
              <div>
                <div
                  style={{
                    fontFamily: "Rajdhani, sans-serif",
                    fontWeight: 700,
                    fontSize: "0.9rem",
                    color: "#fff",
                    marginBottom: 2,
                  }}
                >
                  {MODE_EMOJIS[m.mode]}{" "}
                  {m.modeName || MODE_LABELS[m.mode] || m.mode}
                </div>
                <div
                  style={{
                    fontSize: "0.7rem",
                    color: "rgba(255,255,255,0.5)",
                    fontFamily: "Rajdhani, sans-serif",
                  }}
                >
                  Entry ₹{m.entryFee} · Prize ₹{m.prizePool}
                </div>
                <div
                  style={{
                    fontSize: "0.65rem",
                    color:
                      m.status === "active"
                        ? "#ff6b00"
                        : "rgba(255,255,255,0.4)",
                    fontFamily: "Orbitron, monospace",
                    marginTop: 2,
                  }}
                >
                  {m.status === "active"
                    ? "🔴 LIVE"
                    : m.status === "completed"
                      ? "✅ Completed"
                      : "⏳ Waiting for players"}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  playClickSound();
                  setRoomTarget(m);
                }}
                data-ocid={`matches.active_view_room.${m.id}`}
                style={{
                  padding: "8px 14px",
                  background: "linear-gradient(135deg, #ff6b00, #ff8800)",
                  border: "none",
                  borderRadius: 8,
                  color: "#fff",
                  fontFamily: "Rajdhani, sans-serif",
                  fontWeight: 700,
                  fontSize: "0.72rem",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                🔑 Room
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Info note */}
      <div
        style={{
          margin: "16px 16px 0",
          padding: "10px 14px",
          background: "rgba(255,107,0,0.05)",
          border: "1px solid rgba(255,107,0,0.1)",
          borderRadius: 10,
        }}
      >
        <div
          style={{
            fontSize: "0.68rem",
            color: "rgba(255,255,255,0.4)",
            fontFamily: "Rajdhani, sans-serif",
            lineHeight: 1.6,
          }}
        >
          📋 Entry fees are non-refundable · Room credentials are assigned by
          admin · 10% platform fee applies to all prizes
        </div>
      </div>
    </motion.div>
  );
}
