import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import {
  collection,
  db,
  getDocs,
  onSnapshot,
  orderBy,
  query,
} from "../firebase";

// ─── Types ────────────────────────────────────────────────────────────────────
interface PlayerEntry {
  uid: string;
  displayName: string;
  coins: number;
  wins: number;
  kills: number;
  matchesPlayed: number;
  vipTier?: "bronze" | "silver" | "gold";
  joinedAt?: number;
}

interface RankedPlayer extends PlayerEntry {
  rank: number;
}

type LeaderboardTab = "alltime" | "weekly" | "monthly" | "vip";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getRankTitle(coins: number): string {
  if (coins >= 5000) return "Master";
  if (coins >= 2000) return "Legend";
  if (coins >= 1000) return "Elite";
  if (coins >= 300) return "Warrior";
  return "Rookie";
}

function getVipTier(coins: number): "gold" | "silver" | "bronze" | null {
  if (coins >= 5000) return "gold";
  if (coins >= 2000) return "silver";
  if (coins >= 500) return "bronze";
  return null;
}

function getRankColor(rank: number): string {
  if (rank === 1) return "#ffd700";
  if (rank === 2) return "#c0c0c0";
  if (rank === 3) return "#cd7f32";
  if (rank <= 5) return "#a78bfa";
  return "#ff6b00";
}

function getRankBg(rank: number): string {
  if (rank === 1)
    return "linear-gradient(135deg, rgba(255,215,0,0.3), rgba(255,150,0,0.15))";
  if (rank === 2)
    return "linear-gradient(135deg, rgba(192,192,192,0.15), rgba(255,107,0,0.05))";
  if (rank === 3)
    return "linear-gradient(135deg, rgba(205,127,50,0.15), rgba(255,107,0,0.05))";
  return "rgba(255,255,255,0.03)";
}

function AchievementBadges({ player }: { player: RankedPlayer }) {
  const badges: { label: string; color: string }[] = [];
  const vip = getVipTier(player.coins);
  if (vip === "gold") badges.push({ label: "👑 GOLD VIP", color: "#ffd700" });
  else if (vip === "silver")
    badges.push({ label: "⭐ SILVER VIP", color: "#c0c0c0" });
  else if (vip === "bronze")
    badges.push({ label: "🔥 BRONZE VIP", color: "#cd7f32" });
  if (player.kills >= 500) badges.push({ label: "💀 500K", color: "#ef4444" });
  else if (player.kills >= 100)
    badges.push({ label: "☠️ 100K", color: "#f97316" });
  if (player.rank === 1) badges.push({ label: "🏆 TOP 1", color: "#ffd700" });
  if (player.wins >= 50) badges.push({ label: "🎖️ 50W", color: "#22c55e" });
  return (
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 3 }}>
      {badges.slice(0, 2).map((b) => (
        <span
          key={b.label}
          style={{
            fontSize: "0.55rem",
            padding: "1px 5px",
            borderRadius: 10,
            background: `${b.color}22`,
            border: `1px solid ${b.color}55`,
            color: b.color,
            fontFamily: "Orbitron, sans-serif",
            fontWeight: 700,
            letterSpacing: "0.03em",
          }}
        >
          {b.label}
        </span>
      ))}
    </div>
  );
}

function PlayerRow({
  player,
  index,
  highlight,
}: {
  player: RankedPlayer;
  index: number;
  highlight?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.06, duration: 0.3 }}
      data-ocid={`leaderboard.player_row.${player.uid}`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "11px 14px",
        borderRadius: 12,
        background: highlight ? "rgba(255,107,0,0.12)" : getRankBg(player.rank),
        border: highlight
          ? "1px solid rgba(255,107,0,0.5)"
          : `1px solid ${getRankColor(player.rank)}33`,
        marginBottom: 8,
        boxShadow: highlight ? "0 0 12px rgba(255,107,0,0.2)" : undefined,
        transition: "all 0.2s",
      }}
    >
      {/* Rank Badge */}
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Orbitron, sans-serif",
          fontSize: "0.7rem",
          fontWeight: 700,
          flexShrink: 0,
          background:
            player.rank === 1
              ? "linear-gradient(135deg,#ffd700,#ff9500)"
              : player.rank === 2
                ? "linear-gradient(135deg,#c0c0c0,#909090)"
                : player.rank === 3
                  ? "linear-gradient(135deg,#cd7f32,#a0522d)"
                  : "rgba(255,107,0,0.12)",
          border:
            player.rank > 3
              ? `1px solid ${getRankColor(player.rank)}55`
              : "none",
          color: player.rank <= 2 ? "#000" : "#fff",
          boxShadow:
            player.rank === 1 ? "0 0 10px rgba(255,215,0,0.5)" : undefined,
        }}
      >
        {player.rank}
      </div>

      {/* Name + UID */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: "Rajdhani, sans-serif",
            fontSize: "0.92rem",
            fontWeight: 700,
            color: "#fff",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {player.displayName}
        </div>
        <div
          style={{
            fontSize: "0.68rem",
            color: "rgba(255,255,255,0.38)",
            fontFamily: "Rajdhani, sans-serif",
          }}
        >
          @{player.uid}
        </div>
        <AchievementBadges player={player} />
      </div>

      {/* Stats */}
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div
          style={{
            fontFamily: "Orbitron, sans-serif",
            fontSize: "0.82rem",
            fontWeight: 700,
            color: "#22c55e",
          }}
        >
          ₹{player.coins}
        </div>
        <div
          style={{
            fontSize: "0.65rem",
            color: "rgba(255,255,255,0.4)",
            fontFamily: "Rajdhani, sans-serif",
          }}
        >
          {player.wins}W · {player.kills}K
        </div>
        <div
          style={{
            fontSize: "0.6rem",
            color: getRankColor(player.rank),
            fontFamily: "Orbitron, sans-serif",
            fontWeight: 700,
          }}
        >
          {getRankTitle(player.coins)}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function SkeletonRow({ delay }: { delay: number }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "11px 14px",
        borderRadius: 12,
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,107,0,0.1)",
        marginBottom: 8,
        opacity: 1 - delay * 0.15,
      }}
    >
      <div
        className="skeleton-pulse"
        style={{ width: 34, height: 34, borderRadius: "50%", flexShrink: 0 }}
      />
      <div style={{ flex: 1 }}>
        <div
          className="skeleton-pulse"
          style={{ height: 14, borderRadius: 6, width: "55%", marginBottom: 5 }}
        />
        <div
          className="skeleton-pulse"
          style={{ height: 10, borderRadius: 4, width: "35%" }}
        />
      </div>
      <div>
        <div
          className="skeleton-pulse"
          style={{ height: 14, borderRadius: 6, width: 48, marginBottom: 5 }}
        />
        <div
          className="skeleton-pulse"
          style={{ height: 10, borderRadius: 4, width: 36 }}
        />
      </div>
    </div>
  );
}

// ─── Confetti (Champion card) ─────────────────────────────────────────────────
function ConfettiBurst() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    const particles = Array.from({ length: 60 }, () => ({
      x: canvas.width * 0.5 + (Math.random() - 0.5) * canvas.width * 0.4,
      y: canvas.height * 0.5,
      r: 3 + Math.random() * 4,
      color: ["#ffd700", "#ff6b00", "#ff9500", "#fff", "#22c55e"][
        Math.floor(Math.random() * 5)
      ],
      vx: (Math.random() - 0.5) * 5,
      vy: -3 - Math.random() * 5,
      gravity: 0.15,
      alpha: 1,
    }));
    let raf: number;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of particles) {
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.gravity;
        p.alpha -= 0.012;
      }
      ctx.globalAlpha = 1;
      if (particles.some((p) => p.alpha > 0)) raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        borderRadius: 18,
      }}
    />
  );
}

// ─── Champion Box (Top 1) ─────────────────────────────────────────────────────
function ChampionBox({ champion }: { champion: RankedPlayer }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, type: "spring", stiffness: 120 }}
      data-ocid="leaderboard.champion_box"
      style={{
        position: "relative",
        borderRadius: 18,
        overflow: "hidden",
        marginBottom: 16,
        background:
          "linear-gradient(135deg, #1a1000 0%, #2d1800 40%, #1a0800 70%, #0a0500 100%)",
        border: "2px solid rgba(255,215,0,0.6)",
        boxShadow:
          "0 0 30px rgba(255,215,0,0.25), 0 0 60px rgba(255,107,0,0.1), inset 0 1px 0 rgba(255,215,0,0.2)",
        animation: "glowBorder 2.5s ease-in-out infinite",
        padding: "22px 20px 20px",
      }}
    >
      {/* Confetti */}
      <ConfettiBurst />

      {/* Header Row */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 14,
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* Crown + Rank */}
        <div style={{ textAlign: "center", flexShrink: 0 }}>
          <div style={{ fontSize: "2.4rem", lineHeight: 1, marginBottom: 4 }}>
            👑
          </div>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: "linear-gradient(135deg,#ffd700,#ff9500)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "Orbitron, sans-serif",
              fontSize: "1rem",
              fontWeight: 900,
              color: "#000",
              boxShadow: "0 0 14px rgba(255,215,0,0.7)",
              margin: "0 auto",
            }}
          >
            #1
          </div>
        </div>

        {/* Name & Details */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: "Orbitron, sans-serif",
              fontSize: "1.05rem",
              fontWeight: 900,
              color: "#fff",
              letterSpacing: "0.04em",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              marginBottom: 2,
            }}
          >
            {champion.displayName}
          </div>
          <div
            style={{
              fontSize: "0.72rem",
              color: "rgba(255,255,255,0.45)",
              fontFamily: "Rajdhani, sans-serif",
              marginBottom: 6,
            }}
          >
            @{champion.uid}
          </div>
          {/* Rank Badge */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <span
              style={{
                fontSize: "0.6rem",
                padding: "2px 8px",
                borderRadius: 10,
                background: "rgba(255,215,0,0.18)",
                border: "1px solid rgba(255,215,0,0.5)",
                color: "#ffd700",
                fontFamily: "Orbitron, sans-serif",
                fontWeight: 700,
              }}
            >
              🏆 {getRankTitle(champion.coins)}
            </span>
            {getVipTier(champion.coins) && (
              <span
                style={{
                  fontSize: "0.6rem",
                  padding: "2px 8px",
                  borderRadius: 10,
                  background: "rgba(255,215,0,0.12)",
                  border: "1px solid rgba(255,215,0,0.4)",
                  color: "#ffd700",
                  fontFamily: "Orbitron, sans-serif",
                  fontWeight: 700,
                }}
              >
                👑 GOLD VIP
              </span>
            )}
          </div>
        </div>

        {/* Winnings */}
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div
            style={{
              fontFamily: "Orbitron, sans-serif",
              fontSize: "1.2rem",
              fontWeight: 900,
              color: "#22c55e",
              textShadow: "0 0 10px rgba(34,197,94,0.5)",
            }}
          >
            ₹{champion.coins}
          </div>
          <div
            style={{
              fontSize: "0.65rem",
              color: "rgba(255,255,255,0.4)",
              fontFamily: "Rajdhani, sans-serif",
            }}
          >
            TOTAL BALANCE
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div
        style={{
          display: "flex",
          gap: 8,
          marginTop: 14,
          position: "relative",
          zIndex: 1,
        }}
      >
        {[
          { label: "WINS", value: champion.wins, icon: "🏆" },
          { label: "KILLS", value: champion.kills, icon: "💀" },
          { label: "MATCHES", value: champion.matchesPlayed, icon: "🎮" },
        ].map((s) => (
          <div
            key={s.label}
            style={{
              flex: 1,
              background: "rgba(255,215,0,0.07)",
              border: "1px solid rgba(255,215,0,0.2)",
              borderRadius: 10,
              padding: "8px 6px",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "1rem", marginBottom: 2 }}>{s.icon}</div>
            <div
              style={{
                fontFamily: "Orbitron, sans-serif",
                fontSize: "0.9rem",
                fontWeight: 700,
                color: "#ffd700",
              }}
            >
              {s.value}
            </div>
            <div
              style={{
                fontSize: "0.55rem",
                color: "rgba(255,255,255,0.35)",
                fontFamily: "Rajdhani, sans-serif",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              {s.label}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ─── Elite Squad Box (Top 5: ranks 2–5) ──────────────────────────────────────
function EliteSquadBox({ players }: { players: RankedPlayer[] }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1, duration: 0.4 }}
      data-ocid="leaderboard.elite_squad_box"
      style={{
        borderRadius: 16,
        marginBottom: 16,
        background: "rgba(255,255,255,0.025)",
        border: "1.5px solid rgba(192,192,192,0.35)",
        boxShadow: "0 0 20px rgba(192,192,192,0.07)",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          background:
            "linear-gradient(135deg, rgba(192,192,192,0.12), rgba(255,107,0,0.06))",
          borderBottom: "1px solid rgba(192,192,192,0.2)",
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <span style={{ fontSize: "1.2rem" }}>🥈</span>
        <div>
          <div
            style={{
              fontFamily: "Orbitron, sans-serif",
              fontSize: "0.78rem",
              fontWeight: 700,
              color: "#c0c0c0",
              letterSpacing: "0.12em",
            }}
          >
            ELITE SQUAD
          </div>
          <div
            style={{
              fontSize: "0.65rem",
              color: "rgba(255,255,255,0.35)",
              fontFamily: "Rajdhani, sans-serif",
            }}
          >
            Ranks #2 – #5 • Top Challengers
          </div>
        </div>
        <span
          style={{
            marginLeft: "auto",
            fontSize: "0.6rem",
            padding: "2px 8px",
            borderRadius: 10,
            background: "rgba(192,192,192,0.12)",
            border: "1px solid rgba(192,192,192,0.3)",
            color: "#c0c0c0",
            fontFamily: "Orbitron, sans-serif",
            fontWeight: 700,
          }}
        >
          TOP 5
        </span>
      </div>

      {/* Rows */}
      <div style={{ padding: "12px 14px 10px" }}>
        {players.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "20px",
              color: "rgba(255,255,255,0.3)",
              fontFamily: "Rajdhani, sans-serif",
              fontSize: "0.85rem",
            }}
          >
            Not enough players yet
          </div>
        ) : (
          players.map((p, i) => <PlayerRow key={p.uid} player={p} index={i} />)
        )}
      </div>
    </motion.div>
  );
}

// ─── Top Challengers Box (ranks 6–10) ────────────────────────────────────────
function TopChallengersBox({ players }: { players: RankedPlayer[] }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.4 }}
      data-ocid="leaderboard.top_challengers_box"
      style={{
        borderRadius: 16,
        marginBottom: 16,
        background: "rgba(255,255,255,0.025)",
        border: "1.5px solid rgba(255,107,0,0.35)",
        boxShadow: "0 0 20px rgba(255,107,0,0.07)",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          background:
            "linear-gradient(135deg, rgba(255,107,0,0.1), rgba(10,10,26,0.6))",
          borderBottom: "1px solid rgba(255,107,0,0.2)",
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <span style={{ fontSize: "1.2rem" }}>🔥</span>
        <div>
          <div
            style={{
              fontFamily: "Orbitron, sans-serif",
              fontSize: "0.78rem",
              fontWeight: 700,
              color: "#ff6b00",
              letterSpacing: "0.12em",
            }}
          >
            TOP CHALLENGERS
          </div>
          <div
            style={{
              fontSize: "0.65rem",
              color: "rgba(255,255,255,0.35)",
              fontFamily: "Rajdhani, sans-serif",
            }}
          >
            Ranks #6 – #10 • Rising Stars
          </div>
        </div>
        <span
          style={{
            marginLeft: "auto",
            fontSize: "0.6rem",
            padding: "2px 8px",
            borderRadius: 10,
            background: "rgba(255,107,0,0.12)",
            border: "1px solid rgba(255,107,0,0.3)",
            color: "#ff6b00",
            fontFamily: "Orbitron, sans-serif",
            fontWeight: 700,
          }}
        >
          TOP 10
        </span>
      </div>

      {/* Rows */}
      <div style={{ padding: "12px 14px 10px" }}>
        {players.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "20px",
              color: "rgba(255,255,255,0.3)",
              fontFamily: "Rajdhani, sans-serif",
              fontSize: "0.85rem",
            }}
          >
            Not enough players yet
          </div>
        ) : (
          players.map((p, i) => <PlayerRow key={p.uid} player={p} index={i} />)
        )}
      </div>
    </motion.div>
  );
}

// ─── My Rank Card ─────────────────────────────────────────────────────────────
function MyRankCard({
  me,
  total,
}: {
  me: RankedPlayer | null;
  total: number;
}) {
  if (!me) return null;
  const top10Threshold = 300;
  const coinsNeeded = Math.max(0, top10Threshold - me.coins);
  const progressPct =
    me.coins >= top10Threshold
      ? 100
      : Math.min(99, Math.round((me.coins / top10Threshold) * 100));

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.4 }}
      data-ocid="leaderboard.my_rank_card"
      style={{
        borderRadius: 14,
        padding: "16px",
        background:
          "linear-gradient(135deg, rgba(255,107,0,0.1), rgba(10,10,26,0.8))",
        border: "1px solid rgba(255,107,0,0.45)",
        boxShadow: "0 0 16px rgba(255,107,0,0.12)",
        marginBottom: 20,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: "Orbitron, sans-serif",
              fontSize: "0.7rem",
              color: "rgba(255,255,255,0.45)",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              marginBottom: 2,
            }}
          >
            YOUR RANK
          </div>
          <div
            style={{
              fontFamily: "Orbitron, sans-serif",
              fontSize: "1.4rem",
              fontWeight: 900,
              color: "#ff6b00",
            }}
          >
            #{me.rank}
          </div>
          <div
            style={{
              fontSize: "0.68rem",
              color: "rgba(255,255,255,0.4)",
              fontFamily: "Rajdhani, sans-serif",
            }}
          >
            out of {total} players
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div
            style={{
              fontSize: "0.65rem",
              color: "rgba(255,255,255,0.4)",
              fontFamily: "Rajdhani, sans-serif",
              marginBottom: 2,
            }}
          >
            Balance
          </div>
          <div
            style={{
              fontFamily: "Orbitron, sans-serif",
              fontSize: "1rem",
              fontWeight: 700,
              color: "#22c55e",
            }}
          >
            ₹{me.coins}
          </div>
          <div
            style={{
              fontSize: "0.6rem",
              color: "#ff6b00",
              fontFamily: "Orbitron, sans-serif",
              fontWeight: 700,
            }}
          >
            {getRankTitle(me.coins)}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ marginTop: 4 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 5,
          }}
        >
          <span
            style={{
              fontSize: "0.65rem",
              color: "rgba(255,255,255,0.4)",
              fontFamily: "Rajdhani, sans-serif",
            }}
          >
            Progress to Top 10
          </span>
          <span
            style={{
              fontSize: "0.65rem",
              color: "#ff6b00",
              fontFamily: "Orbitron, sans-serif",
              fontWeight: 700,
            }}
          >
            {progressPct}%
          </span>
        </div>
        <div
          style={{
            height: 6,
            background: "rgba(255,107,0,0.15)",
            borderRadius: 3,
            overflow: "hidden",
          }}
        >
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.8, delay: 0.5, ease: "easeOut" }}
            style={{
              height: "100%",
              background: "linear-gradient(90deg, #ff6b00, #ffaa00)",
              borderRadius: 3,
            }}
          />
        </div>
        {coinsNeeded > 0 && (
          <div
            style={{
              fontSize: "0.65rem",
              color: "rgba(255,255,255,0.4)",
              fontFamily: "Rajdhani, sans-serif",
              marginTop: 5,
              textAlign: "center",
            }}
          >
            You need ₹{coinsNeeded} more to reach Top 10
          </div>
        )}
        {coinsNeeded === 0 && (
          <div
            style={{
              fontSize: "0.65rem",
              color: "#22c55e",
              fontFamily: "Orbitron, sans-serif",
              fontWeight: 700,
              marginTop: 5,
              textAlign: "center",
            }}
          >
            🎉 You're in the Top 10!
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Main LeaderboardView ─────────────────────────────────────────────────────
export function LeaderboardView({
  currentUser,
  setIsLoading: _setIsLoading,
}: {
  currentUser: string;
  setIsLoading: (v: boolean) => void;
}) {
  const [tab, setTab] = useState<LeaderboardTab>("alltime");
  const [allPlayers, setAllPlayers] = useState<PlayerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const unsubRef = useRef<(() => void) | null>(null);

  // ── Fetch + subscribe ──────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    let mounted = true;

    const setup = async () => {
      // Wait for db to be ready
      let attempts = 0;
      while (!db && attempts < 20) {
        await new Promise((r) => setTimeout(r, 300));
        attempts++;
      }
      if (!db || !mounted) return;

      try {
        const q = query(collection(db, "wallet"), orderBy("coins", "desc"));

        unsubRef.current = onSnapshot(
          q,
          async (walletSnap: {
            docs: { id: string; data: () => { coins: number } }[];
          }) => {
            if (!mounted) return;
            // Enrich with user display names
            const entries: PlayerEntry[] = [];
            const batchPromises = walletSnap.docs.map(async (wDoc) => {
              const uid = wDoc.id;
              if (uid === "admin") return;
              const coins = wDoc.data()?.coins ?? 0;
              try {
                const { getDoc: gd, doc: d } = await import("../firebase");
                const userSnap = await gd(d(db, "users", uid));
                if (userSnap.exists()) {
                  const u = userSnap.data();
                  entries.push({
                    uid,
                    displayName: u.displayName || uid,
                    coins,
                    wins: u.wins ?? 0,
                    kills: u.kills ?? 0,
                    matchesPlayed: u.matchesPlayed ?? 0,
                    joinedAt: u.joinedAt,
                  });
                }
              } catch (_) {
                entries.push({
                  uid,
                  displayName: uid,
                  coins,
                  wins: 0,
                  kills: 0,
                  matchesPlayed: 0,
                });
              }
            });
            await Promise.all(batchPromises);
            if (mounted) {
              entries.sort((a, b) => b.coins - a.coins);
              setAllPlayers(entries);
              setLoading(false);
            }
          },
        );
      } catch (_) {
        if (mounted) setLoading(false);
      }
    };

    setup();

    // Auto-refresh every 60s
    const refreshTimer = setInterval(() => {
      if (!db) return;
      getDocs(query(collection(db, "wallet"), orderBy("coins", "desc"))).catch(
        () => {},
      );
    }, 60000);

    return () => {
      mounted = false;
      if (unsubRef.current) unsubRef.current();
      clearInterval(refreshTimer);
    };
  }, []);

  // ── Filter by tab ──────────────────────────────────────────────────────────
  const filteredPlayers: RankedPlayer[] = (() => {
    let base = [...allPlayers];

    if (tab === "weekly") {
      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      base = base.filter((p) => !p.joinedAt || p.joinedAt > weekAgo);
    } else if (tab === "monthly") {
      const monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      base = base.filter((p) => !p.joinedAt || p.joinedAt > monthAgo);
    } else if (tab === "vip") {
      base = base.filter((p) => getVipTier(p.coins) !== null);
      base.sort((a, b) => {
        const tierOrder = { gold: 3, silver: 2, bronze: 1 };
        const ta = tierOrder[getVipTier(a.coins) ?? "bronze"] ?? 0;
        const tb = tierOrder[getVipTier(b.coins) ?? "bronze"] ?? 0;
        if (tb !== ta) return tb - ta;
        return b.coins - a.coins;
      });
    }

    return base.map((p, i) => ({ ...p, rank: i + 1 }));
  })();

  const champion = filteredPlayers[0] ?? null;
  const elitePlayers = filteredPlayers.slice(1, 5);
  const challengerPlayers = filteredPlayers.slice(5, 10);
  const myRank = filteredPlayers.find((p) => p.uid === currentUser) ?? null;

  const TABS: { key: LeaderboardTab; label: string; icon: string }[] = [
    { key: "alltime", label: "All Time", icon: "🌟" },
    { key: "weekly", label: "Weekly", icon: "📅" },
    { key: "monthly", label: "Monthly", icon: "🗓️" },
    { key: "vip", label: "VIP", icon: "👑" },
  ];

  return (
    <div className="main-content" data-ocid="leaderboard.view">
      {/* Title */}
      <div style={{ marginBottom: 14 }}>
        <div
          style={{
            fontFamily: "Orbitron, sans-serif",
            fontSize: "1rem",
            fontWeight: 700,
            color: "#fff",
            letterSpacing: "0.06em",
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 2,
          }}
        >
          🏆 LEADERBOARD
        </div>
        <div
          style={{
            fontSize: "0.72rem",
            color: "rgba(255,255,255,0.35)",
            fontFamily: "Rajdhani, sans-serif",
          }}
        >
          {filteredPlayers.length} players ranked · Live updates
        </div>
      </div>

      {/* Tab Bar */}
      <div
        style={{
          display: "flex",
          gap: 4,
          marginBottom: 16,
          overflowX: "auto",
          paddingBottom: 2,
        }}
        data-ocid="leaderboard.tabs"
      >
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            data-ocid={`leaderboard.tab.${t.key}`}
            style={{
              flexShrink: 0,
              padding: "7px 14px",
              borderRadius: 20,
              background:
                tab === t.key
                  ? "rgba(255,107,0,0.2)"
                  : "rgba(255,255,255,0.04)",
              border:
                tab === t.key
                  ? "1.5px solid #ff6b00"
                  : "1px solid rgba(255,107,0,0.18)",
              color: tab === t.key ? "#fff" : "rgba(255,255,255,0.5)",
              fontFamily: "Rajdhani, sans-serif",
              fontSize: "0.8rem",
              fontWeight: 700,
              cursor: "pointer",
              transition: "all 0.2s",
              position: "relative",
            }}
          >
            {t.icon} {t.label}
            {tab === t.key && (
              <div
                style={{
                  position: "absolute",
                  bottom: -3,
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: 20,
                  height: 2,
                  background: "#ff6b00",
                  borderRadius: 1,
                  boxShadow: "0 0 6px #ff6b00",
                }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div>
          {(["s1", "s2", "s3", "s4", "s5"] as const).map((k, i) => (
            <SkeletonRow key={k} delay={i} />
          ))}
        </div>
      )}

      {/* Content */}
      <AnimatePresence mode="wait">
        {!loading && (
          <motion.div
            key={tab}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            {filteredPlayers.length === 0 ? (
              <div className="empty-state" data-ocid="leaderboard.empty_state">
                <div className="empty-state-icon">🏆</div>
                <div className="empty-state-text">
                  No players yet. Be the first champion!
                </div>
              </div>
            ) : (
              <>
                {/* ── BOX 1: TOP 1 Champion ── */}
                {champion && (
                  <div data-ocid="leaderboard.box_top1">
                    <div
                      style={{
                        fontFamily: "Orbitron, sans-serif",
                        fontSize: "0.65rem",
                        color: "rgba(255,215,0,0.6)",
                        letterSpacing: "0.15em",
                        textTransform: "uppercase",
                        marginBottom: 8,
                      }}
                    >
                      ★ Champion
                    </div>
                    <ChampionBox champion={champion} />
                  </div>
                )}

                {/* ── BOX 2: TOP 5 Elite Squad ── */}
                {elitePlayers.length > 0 && (
                  <EliteSquadBox players={elitePlayers} />
                )}

                {/* ── BOX 3: TOP 10 Challengers ── */}
                {challengerPlayers.length > 0 && (
                  <TopChallengersBox players={challengerPlayers} />
                )}

                {/* ── My Rank ── */}
                {currentUser !== "admin" && (
                  <MyRankCard me={myRank} total={filteredPlayers.length} />
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Inline keyframe for glowBorder */}
      <style>{`
        @keyframes glowBorder {
          0%, 100% { box-shadow: 0 0 30px rgba(255,215,0,0.25), 0 0 60px rgba(255,107,0,0.1), inset 0 1px 0 rgba(255,215,0,0.2); }
          50% { box-shadow: 0 0 45px rgba(255,215,0,0.4), 0 0 90px rgba(255,107,0,0.2), inset 0 1px 0 rgba(255,215,0,0.3); }
        }
        @keyframes skeleton-shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .skeleton-pulse {
          background: linear-gradient(90deg, rgba(255,107,0,0.06) 25%, rgba(255,107,0,0.12) 50%, rgba(255,107,0,0.06) 75%);
          background-size: 200% 100%;
          animation: skeleton-shimmer 1.5s infinite;
        }
      `}</style>
    </div>
  );
}

export default LeaderboardView;
