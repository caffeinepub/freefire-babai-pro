// @ts-nocheck
/* eslint-disable */
/**
 * DashboardView — MR.SONIC FF main home screen
 * Self-contained: all state, effects, and Firebase calls are local.
 * Props match the existing App.tsx contract so this can be swapped in.
 */
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  addDoc,
  collection,
  db,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
} from "../firebase";

// ─── Types ───────────────────────────────────────────────────────────────────

interface UserData {
  uid: string;
  displayName: string;
  wins: number;
  kills: number;
  matchesPlayed: number;
  coins: number;
  clanId?: string;
}

interface ActivityEntry {
  id: string;
  text: string;
  timestamp: unknown;
  type?: string;
}

interface PotwData {
  uid: string;
  name: string;
  wins: number;
  badge?: string;
  pinnedAt?: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning ☀️";
  if (h < 17) return "Good Afternoon ⚡";
  return "Good Evening 🌙";
}

function getRankInfo(wins: number): {
  label: string;
  color: string;
  emoji: string;
} {
  if (wins >= 100) return { label: "MASTER", color: "#a855f7", emoji: "👑" };
  if (wins >= 50) return { label: "LEGEND", color: "#f59e0b", emoji: "⭐" };
  if (wins >= 20) return { label: "ELITE", color: "#3b82f6", emoji: "💎" };
  if (wins >= 5) return { label: "WARRIOR", color: "#ff6b00", emoji: "⚔️" };
  return { label: "ROOKIE", color: "#22c55e", emoji: "🌱" };
}

function getVipInfo(coins: number): { tier: string; color: string } | null {
  if (coins >= 5000) return { tier: "Gold VIP", color: "#fbbf24" };
  if (coins >= 2000) return { tier: "Silver VIP", color: "#94a3b8" };
  if (coins >= 500) return { tier: "Bronze VIP", color: "#cd7c3e" };
  return null;
}

function formatTime(timestamp: unknown): string {
  if (!timestamp) return "";
  const ts =
    typeof timestamp === "object" && "toDate" in (timestamp as object)
      ? (timestamp as { toDate: () => Date }).toDate()
      : new Date(timestamp as number);
  const now = new Date();
  const diff = (now.getTime() - ts.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

// ─── Schedule ────────────────────────────────────────────────────────────────

const SCHEDULE_SLOTS = Array.from({ length: 25 }, (_, i) => {
  const totalMins = 17 * 60 + i * 15; // 5:00 PM = 17:00
  if (totalMins > 23 * 60) return null;
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
}).filter(Boolean) as string[];

function getCurrentSlotIndex(): number {
  const now = new Date();
  const totalMins = now.getHours() * 60 + now.getMinutes();
  const slotMins = SCHEDULE_SLOTS.map((s) => {
    const [time, ampm] = s.split(" ");
    const [hStr, mStr] = time.split(":");
    let h = Number.parseInt(hStr, 10);
    if (ampm === "PM" && h !== 12) h += 12;
    if (ampm === "AM" && h === 12) h = 0;
    return h * 60 + Number.parseInt(mStr, 10);
  });
  return slotMins.findIndex((sm, i) => {
    const next = slotMins[i + 1] ?? sm + 15;
    return totalMins >= sm && totalMins < next;
  });
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function Skeleton({
  w = "100%",
  h = 16,
  rounded = 8,
  className = "",
}: { w?: string | number; h?: number; rounded?: number; className?: string }) {
  return (
    <div
      className={className}
      style={{
        width: w,
        height: h,
        borderRadius: rounded,
        background:
          "linear-gradient(90deg,rgba(255,107,0,0.07) 0%,rgba(255,107,0,0.15) 50%,rgba(255,107,0,0.07) 100%)",
        backgroundSize: "200% 100%",
        animation: "shimmerSkeleton 1.5s infinite",
      }}
    />
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface DashboardViewProps {
  user: UserData;
  onNavigate: (view: string) => void;
  darkMode: boolean;
  deferredPrompt?: Event | null;
  onInstall?: () => void;
  // legacy compat (used when embedded from App.tsx)
  currentUser?: string;
  userData?: UserData;
  coins?: number;
  setView?: (v: string) => void;
  showToast?: (msg: string, type?: "success" | "error") => void;
  setSelectedMode?: (m: unknown) => void;
}

export default function DashboardView(props: DashboardViewProps) {
  // Support both new prop contract and legacy App.tsx contract
  const user: UserData = props.user ?? props.userData!;
  const currentUid: string = user?.uid ?? props.currentUser!;
  const coins: number = props.coins ?? user?.coins ?? 0;
  const navigate = props.onNavigate ?? props.setView ?? (() => {});
  const showToastFn = props.showToast ?? (() => {});
  void (props.darkMode ?? true); // darkMode consumed by parent

  // ── State
  const [liveMatchCount, setLiveMatchCount] = useState<number | null>(null);
  const [activityFeed, setActivityFeed] = useState<ActivityEntry[]>([]);
  const [potwData, setPotwData] = useState<PotwData | null>(null);
  const [activityLoading, setActivityLoading] = useState(true);
  const [potwLoading, setPotwLoading] = useState(true);
  const [installDismissed, setInstallDismissed] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [scheduleIdx, setScheduleIdx] = useState(getCurrentSlotIndex());
  const scheduleRef = useRef<HTMLDivElement>(null);
  const currentSlotRef = useRef<HTMLDivElement>(null);

  const deferredPrompt = props.deferredPrompt;

  // ── Toast helper
  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  }, []);

  // ── Live match count (real-time)
  useEffect(() => {
    if (!db) return;
    const q = query(
      collection(db, "matches"),
      where("status", "in", ["waiting", "live"]),
    );
    const unsub = onSnapshot(
      q,
      (snap) => setLiveMatchCount(snap.size),
      () => setLiveMatchCount(0),
    );
    return () => unsub();
  }, []);

  // ── Activity feed (last 10 match events)
  useEffect(() => {
    if (!db) return;
    const q = query(
      collection(db, "activity"),
      orderBy("timestamp", "desc"),
      limit(10),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        if (snap.empty) {
          setActivityFeed([]);
        } else {
          setActivityFeed(
            snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ActivityEntry),
          );
        }
        setActivityLoading(false);
      },
      () => setActivityLoading(false),
    );
    return () => unsub();
  }, []);

  // ── Player of the Week
  useEffect(() => {
    if (!db) return;
    const q = query(
      collection(db, "potw"),
      orderBy("pinnedAt", "desc"),
      limit(1),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        if (!snap.empty)
          setPotwData({
            id: snap.docs[0].id,
            ...snap.docs[0].data(),
          } as unknown as PotwData);
        setPotwLoading(false);
      },
      () => setPotwLoading(false),
    );
    return () => unsub();
  }, []);

  // ── Schedule — update current slot every minute
  useEffect(() => {
    const t = setInterval(() => setScheduleIdx(getCurrentSlotIndex()), 60000);
    return () => clearInterval(t);
  }, []);

  // ── Scroll current slot into view when index changes
  const prevScheduleIdx = useRef(scheduleIdx);
  useEffect(() => {
    if (prevScheduleIdx.current !== scheduleIdx) {
      prevScheduleIdx.current = scheduleIdx;
    }
    if (currentSlotRef.current) {
      currentSlotRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  });

  const rank = getRankInfo(user?.wins ?? 0);
  const vip = getVipInfo(coins);

  const copyUpi = () => {
    navigator.clipboard
      .writeText("8247835354@ibl")
      .then(() => {
        showToast("UPI ID copied! ✅");
        showToastFn("UPI ID copied! ✅", "success");
      })
      .catch(() => showToast("Copy failed"));
  };

  const quickActions = [
    {
      icon: "🎮",
      label: "Join Match",
      sub: "Enter Battle",
      gradient: "linear-gradient(135deg,#ff6b00 0%,#ff0000 100%)",
      glow: "rgba(255,107,0,0.55)",
      action: () => navigate("match-history"),
    },
    {
      icon: "📋",
      label: "History",
      sub: "Past Matches",
      gradient: "linear-gradient(135deg,#7c3aed 0%,#2563eb 100%)",
      glow: "rgba(124,58,237,0.5)",
      action: () => navigate("match-history"),
    },
    {
      icon: "🏆",
      label: "Leaderboard",
      sub: "Top Players",
      gradient: "linear-gradient(135deg,#d97706 0%,#fbbf24 100%)",
      glow: "rgba(217,119,6,0.55)",
      action: () => navigate("leaderboard"),
    },
    {
      icon: "💰",
      label: "Wallet",
      sub: "Coins & Pay",
      gradient: "linear-gradient(135deg,#059669 0%,#34d399 100%)",
      glow: "rgba(5,150,105,0.55)",
      action: () => navigate("payment"),
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="main-content"
      data-ocid="dashboard.section"
      style={{ paddingBottom: 80 }}
    >
      {/* ── Inline Toast ── */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            style={{
              position: "fixed",
              top: 70,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 999,
              background: "rgba(20,50,30,0.97)",
              border: "1px solid rgba(34,197,94,0.5)",
              color: "#fff",
              padding: "10px 20px",
              borderRadius: 12,
              fontFamily: "Rajdhani, sans-serif",
              fontWeight: 700,
              fontSize: "0.9rem",
              backdropFilter: "blur(12px)",
            }}
          >
            {toastMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Welcome Section ── */}
      <div
        data-ocid="dashboard.welcome"
        style={{
          background:
            "linear-gradient(135deg,rgba(255,107,0,0.1) 0%,rgba(10,10,26,0.95) 100%)",
          border: "1px solid rgba(255,107,0,0.25)",
          borderRadius: 16,
          padding: "16px 16px 12px",
          marginBottom: 14,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: "0.75rem",
              color: "rgba(255,183,77,0.9)",
              fontFamily: "Rajdhani, sans-serif",
              letterSpacing: 1,
              marginBottom: 3,
            }}
          >
            {getGreeting()}
          </div>
          <div
            style={{
              fontFamily: "Orbitron, sans-serif",
              fontWeight: 900,
              fontSize: "1.1rem",
              color: "#fff",
              letterSpacing: "0.04em",
              marginBottom: 6,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {user?.displayName || currentUid}
          </div>

          {/* Rank Badge */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                background: `${rank.color}22`,
                border: `1px solid ${rank.color}66`,
                borderRadius: 20,
                padding: "2px 10px",
                fontSize: "0.65rem",
                fontFamily: "Orbitron, sans-serif",
                fontWeight: 700,
                color: rank.color,
                letterSpacing: "0.08em",
              }}
            >
              {rank.emoji} {rank.label}
            </span>

            {/* VIP Badge */}
            {vip && (
              <span
                style={{
                  background: `${vip.color}22`,
                  border: `1px solid ${vip.color}66`,
                  borderRadius: 20,
                  padding: "2px 10px",
                  fontSize: "0.62rem",
                  fontFamily: "Orbitron, sans-serif",
                  fontWeight: 700,
                  color: vip.color,
                  letterSpacing: "0.06em",
                }}
              >
                💎 {vip.tier}
              </span>
            )}
          </div>

          <div
            style={{
              marginTop: 6,
              fontSize: "0.68rem",
              color: "rgba(255,255,255,0.4)",
              fontFamily: "Rajdhani, sans-serif",
            }}
          >
            UID:{" "}
            <span style={{ color: "rgba(255,107,0,0.8)" }}>{currentUid}</span>
          </div>
        </div>

        {/* Avatar */}
        <div
          style={{
            width: 52,
            height: 52,
            flexShrink: 0,
            background: `linear-gradient(135deg,${rank.color}44,${rank.color}22)`,
            border: `2px solid ${rank.color}66`,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "Orbitron, sans-serif",
            fontWeight: 900,
            fontSize: "1.2rem",
            color: rank.color,
            boxShadow: `0 0 16px ${rank.color}44`,
          }}
        >
          {(user?.displayName || currentUid || "?")[0].toUpperCase()}
        </div>
      </div>

      {/* ── Coin balance in header strip ── */}
      <div
        data-ocid="dashboard.coins_strip"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "rgba(255,107,0,0.08)",
          border: "1px solid rgba(255,107,0,0.2)",
          borderRadius: 12,
          padding: "8px 14px",
          marginBottom: 14,
        }}
      >
        <span
          style={{
            fontFamily: "Rajdhani, sans-serif",
            fontSize: "0.85rem",
            color: "rgba(255,255,255,0.7)",
          }}
        >
          🪙 Balance
        </span>
        <span
          style={{
            fontFamily: "Orbitron, sans-serif",
            fontWeight: 900,
            fontSize: "1rem",
            color: "#fbbf24",
          }}
        >
          ₹{coins}
        </span>
        <button
          type="button"
          onClick={() => navigate("payment")}
          data-ocid="dashboard.add_coins.button"
          style={{
            background: "linear-gradient(135deg,#ff6b00,#ff9a00)",
            border: "none",
            borderRadius: 8,
            padding: "5px 14px",
            color: "#fff",
            fontFamily: "Orbitron, sans-serif",
            fontWeight: 700,
            fontSize: "0.65rem",
            letterSpacing: "0.06em",
            cursor: "pointer",
          }}
        >
          + ADD
        </button>
      </div>

      {/* ── Hero Banner ── */}
      <div
        data-ocid="dashboard.hero_banner"
        style={{
          position: "relative",
          borderRadius: 18,
          overflow: "hidden",
          marginBottom: 14,
          border: "1.5px solid rgba(255,140,0,0.35)",
          boxShadow:
            "0 0 32px rgba(255,107,0,0.25), 0 8px 32px rgba(0,0,0,0.5)",
          animation: "heroBannerPulse 3s ease-in-out infinite",
        }}
      >
        <img
          src="/assets/generated/brand-hero-banner.dim_480x200.jpg"
          alt="MR.SONIC FF Tournament Arena"
          style={{
            width: "100%",
            height: 160,
            objectFit: "cover",
            display: "block",
          }}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
        {/* Gradient overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(135deg,rgba(8,12,20,0.6) 0%,rgba(255,107,0,0.15) 100%)",
          }}
        />
        {/* Animated gold border */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 2,
            background:
              "linear-gradient(90deg,transparent,#fbbf24,#ff6b00,#fbbf24,transparent)",
            animation: "shimmerLine 2s linear infinite",
          }}
        />
        <div style={{ position: "absolute", bottom: 16, left: 16 }}>
          <div
            style={{
              fontFamily: "Orbitron, sans-serif",
              fontSize: "1.1rem",
              fontWeight: 900,
              color: "#fff",
              textShadow:
                "0 0 20px rgba(255,107,0,0.9), 0 0 40px rgba(255,107,0,0.5)",
              letterSpacing: "0.05em",
              marginBottom: 5,
            }}
          >
            🏆 MR.SONIC FF TOURNAMENT ARENA
          </div>
          <div
            style={{
              fontSize: "0.78rem",
              color: "rgba(255,200,120,0.92)",
              fontWeight: 600,
            }}
          >
            Join matches, earn coins, climb ranks!
          </div>
          <button
            type="button"
            onClick={() => navigate("match-history")}
            data-ocid="dashboard.hero_cta.button"
            style={{
              marginTop: 10,
              background: "linear-gradient(135deg,#ff6b00,#ff9a00)",
              border: "none",
              borderRadius: 20,
              padding: "6px 20px",
              color: "#fff",
              fontFamily: "Orbitron, sans-serif",
              fontWeight: 700,
              fontSize: "0.7rem",
              letterSpacing: "0.08em",
              cursor: "pointer",
              boxShadow: "0 4px 16px rgba(255,107,0,0.5)",
            }}
          >
            JOIN NOW →
          </button>
        </div>
        {/* Live badge */}
        <div
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            background: "rgba(255,107,0,0.15)",
            border: "1px solid rgba(255,107,0,0.5)",
            color: "#fff",
            fontSize: "0.6rem",
            fontWeight: 700,
            fontFamily: "Orbitron, sans-serif",
            padding: "3px 10px",
            borderRadius: 20,
            backdropFilter: "blur(6px)",
            letterSpacing: "0.06em",
            animation: "live-pulse 1.8s infinite",
          }}
        >
          ● LIVE
        </div>
      </div>

      {/* ── Live Match Info Box ── */}
      <button
        type="button"
        onClick={() => navigate("match-history")}
        data-ocid="dashboard.live_matches.button"
        style={{
          width: "100%",
          marginBottom: 14,
          background:
            "linear-gradient(135deg,rgba(255,107,0,0.12),rgba(255,0,0,0.06))",
          border: "1.5px solid rgba(255,107,0,0.4)",
          borderRadius: 14,
          padding: "12px 16px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          boxShadow: "0 0 18px rgba(255,107,0,0.15)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: "#ef4444",
              animation: "live-pulse 1.5s infinite",
              flexShrink: 0,
            }}
          />
          <div>
            <div
              style={{
                fontFamily: "Orbitron, sans-serif",
                fontWeight: 700,
                fontSize: "0.8rem",
                color: "#fff",
              }}
            >
              {liveMatchCount === null
                ? "Loading live matches..."
                : liveMatchCount === 0
                  ? "No active matches right now"
                  : `${liveMatchCount} LIVE match${liveMatchCount !== 1 ? "es" : ""} available!`}
            </div>
            <div
              style={{
                fontSize: "0.7rem",
                color: "rgba(255,255,255,0.5)",
                marginTop: 2,
                fontFamily: "Rajdhani, sans-serif",
              }}
            >
              Tap to view live matches →
            </div>
          </div>
        </div>
        <span
          style={{
            background: "#ef4444",
            color: "#fff",
            borderRadius: 20,
            padding: "2px 10px",
            fontSize: "0.62rem",
            fontFamily: "Orbitron, sans-serif",
            fontWeight: 700,
            letterSpacing: "0.06em",
          }}
        >
          🔴 LIVE
        </span>
      </button>

      {/* ── Quick Actions ── */}
      <div className="section-label" style={{ marginBottom: 10 }}>
        Quick Actions
      </div>
      <div
        data-ocid="dashboard.quick_actions.grid"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
          marginBottom: 16,
        }}
      >
        {quickActions.map((item, i) => (
          <motion.button
            key={item.label}
            type="button"
            onClick={item.action}
            data-ocid="dashboard.primary_button"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08, duration: 0.35 }}
            whileTap={{ scale: 0.95 }}
            style={{
              position: "relative",
              overflow: "hidden",
              background: item.gradient,
              border: "none",
              borderRadius: 16,
              padding: "18px 14px 14px",
              cursor: "pointer",
              textAlign: "left",
              boxShadow: `0 6px 24px ${item.glow}, 0 2px 8px rgba(0,0,0,0.4)`,
              minHeight: 100,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              transition: "box-shadow 0.2s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow =
                `0 8px 32px ${item.glow}, 0 4px 12px rgba(0,0,0,0.5)`;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow =
                `0 6px 24px ${item.glow}, 0 2px 8px rgba(0,0,0,0.4)`;
            }}
          >
            {/* Shimmer */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(120deg,transparent 30%,rgba(255,255,255,0.08) 50%,transparent 70%)",
                pointerEvents: "none",
              }}
            />
            <div
              style={{
                fontSize: "2.5rem",
                lineHeight: 1,
                filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.5))",
              }}
            >
              {item.icon}
            </div>
            <div>
              <div
                style={{
                  fontFamily: "Orbitron, sans-serif",
                  fontWeight: 800,
                  fontSize: "0.75rem",
                  color: "#fff",
                  letterSpacing: "0.05em",
                  lineHeight: 1.2,
                }}
              >
                {item.label}
              </div>
              <div
                style={{
                  fontFamily: "Rajdhani, sans-serif",
                  fontSize: "0.68rem",
                  color: "rgba(255,255,255,0.75)",
                  marginTop: 2,
                }}
              >
                {item.sub}
              </div>
            </div>
          </motion.button>
        ))}
      </div>

      {/* ── Activity Feed ── */}
      <div className="section-label" style={{ marginBottom: 8 }}>
        Recent Activity
      </div>
      <div
        data-ocid="dashboard.activity_feed"
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,107,0,0.18)",
          borderRadius: 14,
          overflow: "hidden",
          marginBottom: 14,
        }}
      >
        {activityLoading ? (
          <div
            style={{
              padding: "12px 14px",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{ display: "flex", alignItems: "center", gap: 10 }}
              >
                <Skeleton w={28} h={28} rounded={14} />
                <div style={{ flex: 1 }}>
                  <Skeleton w="70%" h={12} rounded={4} />
                  <div style={{ marginTop: 5 }}>
                    <Skeleton w="35%" h={10} rounded={4} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : activityFeed.length === 0 ? (
          <div
            data-ocid="dashboard.activity_empty"
            style={{
              padding: "24px 16px",
              textAlign: "center",
              color: "rgba(255,255,255,0.4)",
              fontFamily: "Rajdhani, sans-serif",
              fontSize: "0.88rem",
            }}
          >
            <div style={{ fontSize: "2rem", marginBottom: 8 }}>🎮</div>
            No recent activity — be the first to play!
          </div>
        ) : (
          activityFeed.map((item, i) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 14px",
                borderBottom:
                  i < activityFeed.length - 1
                    ? "1px solid rgba(255,107,0,0.1)"
                    : "none",
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  flexShrink: 0,
                  background: "rgba(255,107,0,0.15)",
                  border: "1px solid rgba(255,107,0,0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.9rem",
                }}
              >
                {item.type === "win" ? "🏆" : item.type === "join" ? "⚔️" : "🎮"}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontFamily: "Rajdhani, sans-serif",
                    fontSize: "0.82rem",
                    color: "#fff",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.text}
                </div>
                <div
                  style={{
                    fontSize: "0.65rem",
                    color: "rgba(255,255,255,0.35)",
                    marginTop: 2,
                  }}
                >
                  {formatTime(item.timestamp)}
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* ── UPI / WhatsApp Box ── */}
      <div
        data-ocid="dashboard.upi_box"
        style={{
          background:
            "linear-gradient(135deg,#0e1420 0%,#121929 40%,#0d1a3a 100%)",
          border: "2px solid #ff6b00",
          borderRadius: 16,
          padding: "16px 14px",
          marginBottom: 14,
          boxShadow: "0 0 24px rgba(255,107,0,0.3), 0 4px 16px rgba(0,0,0,0.5)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Top accent line */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            background: "#ff6b00",
            borderRadius: "16px 16px 0 0",
          }}
        />

        <div style={{ textAlign: "center", marginBottom: 12 }}>
          <span
            style={{
              fontSize: "0.68rem",
              fontFamily: "Orbitron, sans-serif",
              letterSpacing: 2,
              color: "#fff",
              textTransform: "uppercase",
            }}
          >
            💳 Payment Details
          </span>
        </div>

        {/* UPI Row */}
        <div
          style={{
            background: "rgba(255,107,0,0.12)",
            border: "1.5px solid rgba(255,107,0,0.5)",
            borderRadius: 10,
            padding: "10px 12px",
            marginBottom: 10,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span style={{ fontSize: "1.4rem" }}>📲</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: "0.6rem",
                color: "#ffb347",
                fontFamily: "Rajdhani, sans-serif",
                letterSpacing: 1,
                marginBottom: 2,
              }}
            >
              UPI ID
            </div>
            <div
              style={{
                fontSize: "0.95rem",
                fontWeight: 700,
                fontFamily: "Orbitron, sans-serif",
                color: "#fff",
                letterSpacing: 1,
              }}
            >
              8247835354@ibl
            </div>
          </div>
          <button
            type="button"
            onClick={copyUpi}
            data-ocid="dashboard.copy_upi.button"
            style={{
              background: "rgba(255,107,0,0.2)",
              border: "1px solid rgba(255,107,0,0.6)",
              borderRadius: 6,
              padding: "6px 10px",
              cursor: "pointer",
              color: "#ffb347",
              fontSize: "0.72rem",
              fontWeight: 700,
            }}
          >
            📋 COPY
          </button>
        </div>

        {/* WhatsApp Row */}
        <a
          href="https://wa.me/917013256124"
          target="_blank"
          rel="noopener noreferrer"
          data-ocid="dashboard.whatsapp.link"
          style={{
            background: "rgba(34,197,94,0.1)",
            border: "1.5px solid rgba(34,197,94,0.4)",
            borderRadius: 10,
            padding: "10px 12px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            textDecoration: "none",
          }}
        >
          <span style={{ fontSize: "1.4rem" }}>💬</span>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: "0.6rem",
                color: "#4ade80",
                fontFamily: "Rajdhani, sans-serif",
                letterSpacing: 1,
                marginBottom: 2,
              }}
            >
              WhatsApp Support
            </div>
            <div
              style={{
                fontSize: "0.95rem",
                fontWeight: 700,
                fontFamily: "Orbitron, sans-serif",
                color: "#fff",
                letterSpacing: 1,
              }}
            >
              7013256124
            </div>
          </div>
          <span
            style={{ fontSize: "0.72rem", color: "#4ade80", fontWeight: 700 }}
          >
            CHAT →
          </span>
        </a>

        <div
          style={{
            textAlign: "center",
            marginTop: 10,
            fontSize: "0.68rem",
            color: "rgba(255,255,255,0.4)",
            fontFamily: "Rajdhani, sans-serif",
          }}
        >
          Pay via UPI → Submit UTR in Payments tab
        </div>
      </div>

      {/* ── Match Schedule ── */}
      <div className="section-label" style={{ marginBottom: 8 }}>
        Today's Match Schedule
      </div>
      <div
        data-ocid="dashboard.schedule"
        ref={scheduleRef}
        style={
          {
            display: "flex",
            gap: 6,
            overflowX: "auto",
            paddingBottom: 8,
            marginBottom: 14,
            scrollbarWidth: "none",
            WebkitOverflowScrolling: "touch",
          } as React.CSSProperties
        }
      >
        {SCHEDULE_SLOTS.map((slot, i) => {
          const isLive = i === scheduleIdx;
          return (
            <div
              key={slot}
              ref={isLive ? currentSlotRef : undefined}
              data-ocid={isLive ? "dashboard.schedule_live" : undefined}
              style={{
                flexShrink: 0,
                background: isLive
                  ? "linear-gradient(135deg,#ff6b00,#ff9a00)"
                  : "rgba(255,107,0,0.07)",
                border: isLive
                  ? "1.5px solid #ff6b00"
                  : "1px solid rgba(255,107,0,0.2)",
                borderRadius: 20,
                padding: "5px 12px",
                fontFamily: "Orbitron, sans-serif",
                fontSize: "0.62rem",
                fontWeight: isLive ? 700 : 500,
                color: isLive ? "#fff" : "rgba(255,255,255,0.5)",
                letterSpacing: isLive ? "0.04em" : 0,
                display: "flex",
                alignItems: "center",
                gap: 5,
                boxShadow: isLive ? "0 0 12px rgba(255,107,0,0.5)" : "none",
                whiteSpace: "nowrap",
              }}
            >
              {isLive && (
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "#fff",
                    animation: "live-pulse 1.5s infinite",
                    flexShrink: 0,
                  }}
                />
              )}
              {slot}
              {isLive && (
                <span style={{ fontSize: "0.55rem", letterSpacing: "0.1em" }}>
                  LIVE
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Player of the Week ── */}
      {(potwLoading || potwData) && (
        <div style={{ marginBottom: 14 }}>
          <div className="section-label" style={{ marginBottom: 8 }}>
            ⭐ Player of the Week
          </div>
          {potwLoading ? (
            <div
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(251,191,36,0.3)",
                borderRadius: 14,
                padding: "14px 16px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Skeleton w={48} h={48} rounded={24} />
                <div style={{ flex: 1 }}>
                  <Skeleton w="55%" h={14} rounded={4} />
                  <div style={{ marginTop: 6 }}>
                    <Skeleton w="35%" h={10} rounded={4} />
                  </div>
                </div>
              </div>
            </div>
          ) : potwData ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              data-ocid="dashboard.potw_card"
              style={{
                background:
                  "linear-gradient(135deg,rgba(251,191,36,0.1) 0%,rgba(10,10,26,0.95) 100%)",
                border: "1.5px solid rgba(251,191,36,0.4)",
                borderRadius: 14,
                padding: "14px 16px",
                boxShadow: "0 0 24px rgba(251,191,36,0.15)",
                display: "flex",
                alignItems: "center",
                gap: 14,
              }}
            >
              <div
                style={{
                  width: 50,
                  height: 50,
                  flexShrink: 0,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg,#fbbf24,#f59e0b)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "Orbitron, sans-serif",
                  fontWeight: 900,
                  fontSize: "1.3rem",
                  color: "#1a1a1a",
                  boxShadow: "0 0 16px rgba(251,191,36,0.4)",
                }}
              >
                {(potwData.name || potwData.uid || "?")[0].toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontFamily: "Orbitron, sans-serif",
                    fontWeight: 800,
                    fontSize: "0.9rem",
                    color: "#fbbf24",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {potwData.name || potwData.uid}
                </div>
                <div
                  style={{
                    fontSize: "0.72rem",
                    color: "rgba(255,255,255,0.6)",
                    marginTop: 3,
                    fontFamily: "Rajdhani, sans-serif",
                  }}
                >
                  🏆 {potwData.wins} wins this week
                </div>
                {potwData.badge && (
                  <span
                    style={{
                      fontSize: "0.6rem",
                      fontFamily: "Orbitron, sans-serif",
                      background: "rgba(251,191,36,0.2)",
                      border: "1px solid rgba(251,191,36,0.5)",
                      borderRadius: 10,
                      padding: "1px 8px",
                      color: "#fbbf24",
                      marginTop: 4,
                      display: "inline-block",
                    }}
                  >
                    {potwData.badge}
                  </span>
                )}
              </div>
              <div
                style={{
                  fontSize: "2rem",
                  filter: "drop-shadow(0 0 8px rgba(251,191,36,0.5))",
                }}
              >
                👑
              </div>
            </motion.div>
          ) : null}
        </div>
      )}

      {/* ── PWA Install Prompt ── */}
      <AnimatePresence>
        {deferredPrompt && !installDismissed && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            data-ocid="dashboard.pwa_install"
            style={{
              background:
                "linear-gradient(135deg,rgba(255,107,0,0.15),rgba(10,10,26,0.97))",
              border: "2px solid rgba(255,107,0,0.5)",
              borderRadius: 16,
              padding: "16px 14px",
              marginBottom: 14,
              boxShadow: "0 0 24px rgba(255,107,0,0.25)",
              position: "relative",
            }}
          >
            <button
              type="button"
              onClick={() => setInstallDismissed(true)}
              aria-label="Dismiss install prompt"
              style={{
                position: "absolute",
                top: 8,
                right: 10,
                background: "none",
                border: "none",
                color: "rgba(255,255,255,0.4)",
                fontSize: "1.1rem",
                cursor: "pointer",
                padding: 4,
              }}
            >
              ✕
            </button>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginBottom: 12,
              }}
            >
              <div style={{ fontSize: "2.2rem" }}>📲</div>
              <div>
                <div
                  style={{
                    fontFamily: "Orbitron, sans-serif",
                    fontWeight: 700,
                    fontSize: "0.85rem",
                    color: "#fff",
                  }}
                >
                  Install MR.SONIC FF App
                </div>
                <div
                  style={{
                    fontSize: "0.72rem",
                    color: "rgba(255,255,255,0.5)",
                    marginTop: 2,
                    fontFamily: "Rajdhani, sans-serif",
                  }}
                >
                  Play faster, get notifications instantly
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                props.onInstall?.();
                setInstallDismissed(true);
              }}
              data-ocid="dashboard.install_app.button"
              style={{
                width: "100%",
                padding: "10px 20px",
                background: "linear-gradient(135deg,#ff6b00,#ff9a00)",
                border: "none",
                borderRadius: 10,
                color: "#fff",
                fontFamily: "Orbitron, sans-serif",
                fontWeight: 700,
                fontSize: "0.75rem",
                letterSpacing: "0.08em",
                cursor: "pointer",
                boxShadow: "0 4px 16px rgba(255,107,0,0.4)",
              }}
            >
              ⚡ INSTALL NOW — FREE
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
