import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import {
  addDoc,
  collection,
  db,
  doc,
  getDoc,
  getDocs,
  initFirebase,
  limit,
  orderBy,
  query,
  updateDoc,
  where,
} from "../firebase";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function getLsJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function setLsJson(key: string, val: unknown) {
  localStorage.setItem(key, JSON.stringify(val));
}

function msUntilMidnight() {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return midnight.getTime() - now.getTime();
}

function formatCountdown(ms: number) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface GamificationViewProps {
  user: Record<string, unknown>;
  onNavigate: (view: string) => void;
}

interface MissionState {
  [key: string]: { progress: number; claimed: boolean; date: string };
}

// ─── ConfettiOverlay ─────────────────────────────────────────────────────────
export function ConfettiOverlay({
  show,
  onComplete,
}: {
  show: boolean;
  onComplete: () => void;
}) {
  useEffect(() => {
    if (!show) return;
    const t = setTimeout(onComplete, 3200);
    return () => clearTimeout(t);
  }, [show, onComplete]);

  if (!show) return null;

  const particles = Array.from({ length: 54 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.8,
    duration: 2.2 + Math.random() * 1.2,
    color: ["#ff6b00", "#ffd700", "#ffffff", "#ef4444", "#ff9500", "#ffaa00"][
      Math.floor(Math.random() * 6)
    ],
    size: 6 + Math.random() * 8,
    rotate: Math.random() * 360,
  }));

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9998,
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      {particles.map((p) => (
        <div
          key={p.id}
          style={{
            position: "absolute",
            left: `${p.left}%`,
            top: "-10px",
            width: p.size,
            height: p.size,
            background: p.color,
            borderRadius: Math.random() > 0.5 ? "50%" : "2px",
            transform: `rotate(${p.rotate}deg)`,
            animation: `confettiFall ${p.duration}s ${p.delay}s ease-in forwards`,
            opacity: 0,
          }}
        />
      ))}
      <style>{`
        @keyframes confettiFall {
          0% { opacity: 1; transform: translateY(0) rotate(0deg); }
          100% { opacity: 0; transform: translateY(110vh) rotate(720deg); }
        }
      `}</style>
    </div>
  );
}

// ─── RankUpOverlay ───────────────────────────────────────────────────────────
export function RankUpOverlay({
  show,
  oldRank,
  newRank,
  onComplete,
}: {
  show: boolean;
  oldRank: string;
  newRank: string;
  onComplete: () => void;
}) {
  useEffect(() => {
    if (!show) return;
    const t = setTimeout(onComplete, 3200);
    return () => clearTimeout(t);
  }, [show, onComplete]);

  const burst = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    angle: (i / 20) * 360,
    color: ["#ff6b00", "#ffd700", "#ffffff", "#ffaa00"][i % 4],
  }));

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(0,0,0,0.88)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
          }}
        >
          {/* Particle burst */}
          <div style={{ position: "absolute", width: 200, height: 200 }}>
            {burst.map((p) => (
              <div
                key={p.id}
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  width: 8,
                  height: 8,
                  background: p.color,
                  borderRadius: "50%",
                  animation: "burstParticle 1s ease-out forwards",
                  transformOrigin: "0 0",
                  transform: `rotate(${p.angle}deg) translateX(0)`,
                }}
              />
            ))}
          </div>

          <motion.div
            initial={{ scale: 0.3, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 12 }}
            style={{
              fontSize: "5rem",
              filter: "drop-shadow(0 0 20px #ffd700)",
            }}
          >
            🏆
          </motion.div>

          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            style={{
              fontFamily: "Orbitron, sans-serif",
              fontSize: "1.8rem",
              fontWeight: 900,
              color: "#ffd700",
              textShadow: "0 0 30px #ffd700, 0 0 60px rgba(255,215,0,0.5)",
              letterSpacing: "0.1em",
            }}
          >
            RANK UP!
          </motion.div>

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.35 }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              fontFamily: "Rajdhani, sans-serif",
              fontSize: "1.1rem",
              color: "rgba(255,255,255,0.8)",
            }}
          >
            <span
              style={{
                padding: "4px 14px",
                borderRadius: 20,
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.2)",
              }}
            >
              {oldRank}
            </span>
            <motion.span
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ repeat: Number.POSITIVE_INFINITY, duration: 0.8 }}
              style={{ color: "#ff6b00", fontSize: "1.4rem" }}
            >
              →
            </motion.span>
            <span
              style={{
                padding: "4px 14px",
                borderRadius: 20,
                background: "rgba(255,107,0,0.2)",
                border: "1px solid #ff6b00",
                color: "#ff6b00",
                fontWeight: 700,
              }}
            >
              {newRank}
            </span>
          </motion.div>

          <style>{`
            @keyframes burstParticle {
              0% { transform: rotate(var(--a,0deg)) translateX(0); opacity: 1; }
              100% { transform: rotate(var(--a,0deg)) translateX(80px); opacity: 0; }
            }
          `}</style>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── ScratchCard ─────────────────────────────────────────────────────────────
export function ScratchCard({
  show,
  onClose,
  onClaim,
}: {
  show: boolean;
  onClose: () => void;
  onClaim: (coins: number) => void;
}) {
  const [revealed, setRevealed] = useState<boolean[]>([
    false,
    false,
    false,
    false,
  ]);
  const [cells] = useState<{ id: string; value: number }[]>(() =>
    ["c0", "c1", "c2", "c3"].map((id) => ({
      id,
      value: 1 + Math.floor(Math.random() * 15),
    })),
  );
  const values = cells.map((c) => c.value);
  const [isClaimed, setIsClaimed] = useState(false);

  const allRevealed = revealed.every(Boolean);
  const total = values.reduce((a, b) => a + b, 0);

  const revealCell = (i: number) => {
    if (revealed[i] || isClaimed) return;
    setRevealed((prev) => {
      const next = [...prev];
      next[i] = true;
      return next;
    });
  };

  const handleClaim = () => {
    if (!allRevealed || isClaimed) return;
    setIsClaimed(true);
    onClaim(total);
  };

  if (!show) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9000,
          background: "rgba(0,0,0,0.85)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px",
        }}
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 160 }}
          style={{
            background: "linear-gradient(135deg, #111122, #0a0a1a)",
            border: "2px solid rgba(255,107,0,0.5)",
            borderRadius: 24,
            padding: "28px 24px",
            width: "100%",
            maxWidth: 360,
            textAlign: "center",
            boxShadow: "0 0 40px rgba(255,107,0,0.2)",
          }}
        >
          <div
            style={{
              fontFamily: "Orbitron, sans-serif",
              fontSize: "1rem",
              fontWeight: 700,
              color: "#ffffff",
              marginBottom: 6,
              letterSpacing: "0.08em",
            }}
          >
            🎴 SCRATCH CARD
          </div>
          <div
            style={{
              fontSize: "0.78rem",
              color: "rgba(255,255,255,0.5)",
              fontFamily: "Rajdhani, sans-serif",
              marginBottom: 20,
            }}
          >
            Tap each cell to reveal your reward!
          </div>

          {/* 2x2 grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
              marginBottom: 20,
            }}
          >
            {cells.map(({ id, value }, i) => (
              <motion.button
                key={id}
                type="button"
                onClick={() => revealCell(i)}
                animate={{ rotateY: revealed[i] ? 180 : 0 }}
                transition={{ duration: 0.45 }}
                style={{
                  height: 80,
                  borderRadius: 14,
                  border: `2px solid ${revealed[i] ? "rgba(255,107,0,0.6)" : "rgba(255,255,255,0.15)"}`,
                  background: revealed[i]
                    ? "linear-gradient(135deg, rgba(255,107,0,0.15), rgba(10,10,26,0.8))"
                    : "linear-gradient(135deg, #1a1a2e, #16213e)",
                  cursor: revealed[i] ? "default" : "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                  transformStyle: "preserve-3d",
                  position: "relative",
                }}
              >
                {revealed[i] ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2 }}
                    style={{ transform: "rotateY(180deg)" }}
                  >
                    <div style={{ fontSize: "1.5rem" }}>🪙</div>
                    <div
                      style={{
                        fontFamily: "Orbitron, sans-serif",
                        fontSize: "0.85rem",
                        fontWeight: 700,
                        color: "#ffd700",
                      }}
                    >
                      +{value}
                    </div>
                  </motion.div>
                ) : (
                  <div
                    style={{
                      fontSize: "1.6rem",
                      animation: "pulse-glow 2s ease-in-out infinite",
                    }}
                  >
                    ❓
                  </div>
                )}
              </motion.button>
            ))}
          </div>

          {allRevealed && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              style={{ marginBottom: 16 }}
            >
              <div
                style={{
                  fontFamily: "Rajdhani, sans-serif",
                  fontSize: "0.85rem",
                  color: "rgba(255,255,255,0.5)",
                  marginBottom: 4,
                }}
              >
                Total Reward
              </div>
              <div
                style={{
                  fontFamily: "Orbitron, sans-serif",
                  fontSize: "1.4rem",
                  fontWeight: 700,
                  color: "#ffd700",
                  textShadow: "0 0 16px rgba(255,215,0,0.5)",
                }}
              >
                🪙 {total} Coins
              </div>
            </motion.div>
          )}

          <div style={{ display: "flex", gap: 10 }}>
            {allRevealed && !isClaimed && (
              <button
                type="button"
                className="fire-btn fire-btn-success"
                style={{ flex: 1 }}
                onClick={handleClaim}
              >
                Claim {total} Coins
              </button>
            )}
            <button
              type="button"
              className="fire-btn fire-btn-secondary"
              style={{ flex: isClaimed || !allRevealed ? 1 : undefined }}
              onClick={onClose}
            >
              {isClaimed ? "Close" : "Later"}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Tab Button ───────────────────────────────────────────────────────────────
function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        padding: "9px 4px",
        background: active ? "rgba(255,107,0,0.18)" : "rgba(255,255,255,0.04)",
        border: `1px solid ${active ? "#ff6b00" : "rgba(255,107,0,0.2)"}`,
        borderRadius: 10,
        color: active ? "#ffffff" : "rgba(255,255,255,0.5)",
        fontFamily: "Rajdhani, sans-serif",
        fontSize: "0.7rem",
        fontWeight: 700,
        cursor: "pointer",
        letterSpacing: "0.02em",
        transition: "all 0.2s",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────
function ProgressBar({
  value,
  max,
  color = "#06b6d4",
  height = 8,
}: {
  value: number;
  max: number;
  color?: string;
  height?: number;
}) {
  const pct = Math.min(100, (value / Math.max(1, max)) * 100);
  return (
    <div
      style={{
        width: "100%",
        height,
        background: "rgba(255,255,255,0.08)",
        borderRadius: height / 2,
        overflow: "hidden",
      }}
    >
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        style={{
          height: "100%",
          background: `linear-gradient(90deg, ${color}, ${color}cc)`,
          borderRadius: height / 2,
          boxShadow: `0 0 8px ${color}66`,
        }}
      />
    </div>
  );
}

// ─── Section Heading ──────────────────────────────────────────────────────────
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: "Orbitron, sans-serif",
        fontSize: "0.85rem",
        fontWeight: 700,
        color: "#ffffff",
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        marginBottom: 14,
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      {children}
    </div>
  );
}

// ─── GamificationView ─────────────────────────────────────────────────────────
export default function GamificationView({
  user,
  onNavigate: _onNavigate,
}: GamificationViewProps) {
  const [activeTab, setActiveTab] = useState<
    "missions" | "battlepass" | "vip" | "extras"
  >("missions");
  const uid = (user?.uid as string) ?? "";
  const coins = (user?.coins as number) ?? 0;
  const matchesPlayed = (user?.matchesPlayed as number) ?? 0;
  const wins = (user?.wins as number) ?? 0;
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  };

  const creditCoins = async (amount: number, reason: string) => {
    if (!uid || !db) return;
    try {
      const snap = await getDoc(doc(db, "wallet", uid));
      const current = snap.exists() ? ((snap.data().coins as number) ?? 0) : 0;
      await updateDoc(doc(db, "wallet", uid), { coins: current + amount });
      await addDoc(collection(db, "notifications"), {
        uid,
        title: `🪙 +${amount} Coins`,
        message: reason,
        read: false,
        timestamp: new Date(),
      });
      showToast(`+${amount} 🪙 coins credited!`);
    } catch {
      showToast("Error crediting coins");
    }
  };

  // ── Firebase init
  useEffect(() => {
    initFirebase().catch(() => {});
  }, []);

  return (
    <div className="view-container" data-ocid="gamification.panel">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            style={{
              position: "fixed",
              top: 66,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 9000,
              background: "rgba(20,50,30,0.97)",
              border: "1px solid rgba(34,197,94,0.5)",
              color: "white",
              padding: "10px 20px",
              borderRadius: 12,
              fontFamily: "Rajdhani, sans-serif",
              fontWeight: 700,
              fontSize: "0.9rem",
              maxWidth: "88%",
              textAlign: "center",
              boxShadow: "0 6px 24px rgba(34,197,94,0.3)",
              backdropFilter: "blur(12px)",
            }}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <SectionTitle>🎮 Gamification Hub</SectionTitle>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
        <TabBtn
          active={activeTab === "missions"}
          onClick={() => setActiveTab("missions")}
        >
          📋 Missions
        </TabBtn>
        <TabBtn
          active={activeTab === "battlepass"}
          onClick={() => setActiveTab("battlepass")}
        >
          🎫 Battle Pass
        </TabBtn>
        <TabBtn
          active={activeTab === "vip"}
          onClick={() => setActiveTab("vip")}
        >
          👑 VIP
        </TabBtn>
        <TabBtn
          active={activeTab === "extras"}
          onClick={() => setActiveTab("extras")}
        >
          🎰 Extras
        </TabBtn>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === "missions" && (
            <MissionsTab
              uid={uid}
              matchesPlayed={matchesPlayed}
              onCreditCoins={creditCoins}
              showToast={showToast}
            />
          )}
          {activeTab === "battlepass" && (
            <BattlePassTab
              uid={uid}
              matchesPlayed={matchesPlayed}
              wins={wins}
              onCreditCoins={creditCoins}
            />
          )}
          {activeTab === "vip" && (
            <VIPTab
              uid={uid}
              user={user}
              coins={coins}
              onCreditCoins={creditCoins}
              showToast={showToast}
            />
          )}
          {activeTab === "extras" && (
            <ExtrasTab
              uid={uid}
              onCreditCoins={creditCoins}
              showToast={showToast}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ─── Missions Tab ─────────────────────────────────────────────────────────────
const MISSIONS = [
  {
    id: "join_match",
    name: "Join 1 Match",
    emoji: "⚔️",
    reward: 5,
    goal: 1,
    description: "Join any tournament match today",
  },
  {
    id: "deposit",
    name: "Deposit ₹30",
    emoji: "💰",
    reward: 5,
    goal: 30,
    description: "Add ₹30 or more to your wallet",
  },
  {
    id: "invite_friend",
    name: "Invite 1 Friend",
    emoji: "🤝",
    reward: 5,
    goal: 1,
    description: "Share your referral link with a friend",
  },
];

function MissionsTab({
  uid,
  matchesPlayed,
  onCreditCoins,
  showToast,
}: {
  uid: string;
  matchesPlayed: number;
  onCreditCoins: (amount: number, reason: string) => Promise<void>;
  showToast: (msg: string) => void;
}) {
  const stateKey = `ff_missions_${uid}_${todayKey()}`;
  const [mState, setMState] = useState<MissionState>(() =>
    getLsJson<MissionState>(stateKey, {}),
  );
  const [countdown, setCountdown] = useState(msUntilMidnight());
  const [weeklyChallenge, setWeeklyChallenge] = useState<{
    title: string;
    description: string;
    reward: number;
  } | null>(null);

  // Countdown timer
  useEffect(() => {
    const t = setInterval(() => {
      setCountdown(msUntilMidnight());
    }, 1000);
    return () => clearInterval(t);
  }, []);

  // Load weekly challenge from Firestore
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, "weeklyChallenge", "current"));
        if (snap.exists()) {
          setWeeklyChallenge(snap.data() as typeof weeklyChallenge);
        }
      } catch {
        /* silent */
      }
    })();
  }, []);

  const getMissionProgress = (id: string) => {
    if (id === "join_match") return Math.min(matchesPlayed > 0 ? 1 : 0, 1);
    const saved = mState[id];
    return saved ? saved.progress : 0;
  };

  const isClaimed = (id: string) => {
    return mState[id]?.claimed && mState[id]?.date === todayKey();
  };

  const claimMission = async (mission: (typeof MISSIONS)[0]) => {
    if (isClaimed(mission.id)) return;
    const progress = getMissionProgress(mission.id);
    if (progress < mission.goal) {
      showToast("Complete the mission first!");
      return;
    }
    const next = {
      ...mState,
      [mission.id]: {
        progress: mission.goal,
        claimed: true,
        date: todayKey(),
      },
    };
    setMState(next);
    setLsJson(stateKey, next);
    await onCreditCoins(mission.reward, `Daily Mission: ${mission.name}`);
  };

  const isComplete = (id: string, goal: number) =>
    getMissionProgress(id) >= goal;

  return (
    <div>
      {/* Daily reset countdown */}
      <div
        style={{
          background: "rgba(6,182,212,0.08)",
          border: "1px solid rgba(6,182,212,0.3)",
          borderRadius: 12,
          padding: "10px 14px",
          marginBottom: 18,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span
          style={{
            fontFamily: "Rajdhani, sans-serif",
            fontSize: "0.8rem",
            color: "rgba(255,255,255,0.6)",
          }}
        >
          ⏱️ Resets in
        </span>
        <span
          style={{
            fontFamily: "Orbitron, sans-serif",
            fontSize: "0.88rem",
            fontWeight: 700,
            color: "#06b6d4",
          }}
        >
          {formatCountdown(countdown)}
        </span>
      </div>

      <SectionTitle>📋 Daily Missions</SectionTitle>

      {MISSIONS.map((m, idx) => {
        const progress = getMissionProgress(m.id);
        const claimed = isClaimed(m.id);
        const complete = isComplete(m.id, m.goal);

        return (
          <motion.div
            key={m.id}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.08 }}
            style={{
              background: claimed
                ? "rgba(34,197,94,0.06)"
                : "rgba(255,255,255,0.04)",
              border: `1px solid ${claimed ? "rgba(34,197,94,0.35)" : "rgba(255,107,0,0.2)"}`,
              borderRadius: 14,
              padding: "14px 16px",
              marginBottom: 10,
            }}
            data-ocid={`mission.${m.id}.card`}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                marginBottom: 10,
              }}
            >
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontFamily: "Rajdhani, sans-serif",
                    fontWeight: 700,
                    fontSize: "0.95rem",
                    color: "#ffffff",
                    marginBottom: 2,
                  }}
                >
                  {m.emoji} {m.name}
                </div>
                <div
                  style={{
                    fontSize: "0.75rem",
                    color: "rgba(255,255,255,0.45)",
                    fontFamily: "Rajdhani, sans-serif",
                  }}
                >
                  {m.description}
                </div>
              </div>
              <div
                style={{
                  fontFamily: "Orbitron, sans-serif",
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  color: "#06b6d4",
                  background: "rgba(6,182,212,0.1)",
                  border: "1px solid rgba(6,182,212,0.3)",
                  borderRadius: 8,
                  padding: "3px 8px",
                  whiteSpace: "nowrap",
                  marginLeft: 10,
                  flexShrink: 0,
                }}
              >
                +{m.reward} 🪙
              </div>
            </div>

            <ProgressBar
              value={progress}
              max={m.goal}
              color="#06b6d4"
              height={7}
            />
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginTop: 10,
              }}
            >
              <span
                style={{
                  fontSize: "0.72rem",
                  color: "rgba(255,255,255,0.4)",
                  fontFamily: "Rajdhani, sans-serif",
                }}
              >
                {progress}/{m.goal}
              </span>
              <button
                type="button"
                onClick={() => claimMission(m)}
                disabled={claimed || !complete}
                data-ocid={`mission.${m.id}.claim_button`}
                style={{
                  padding: "6px 16px",
                  borderRadius: 8,
                  fontFamily: "Orbitron, sans-serif",
                  fontSize: "0.68rem",
                  fontWeight: 700,
                  letterSpacing: "0.05em",
                  cursor: claimed || !complete ? "not-allowed" : "pointer",
                  border: "none",
                  background: claimed
                    ? "rgba(34,197,94,0.15)"
                    : complete
                      ? "linear-gradient(135deg, #06b6d4, #0891b2)"
                      : "rgba(255,255,255,0.06)",
                  color: claimed
                    ? "#22c55e"
                    : complete
                      ? "#ffffff"
                      : "rgba(255,255,255,0.3)",
                  boxShadow:
                    complete && !claimed
                      ? "0 2px 12px rgba(6,182,212,0.4)"
                      : "none",
                  transition: "all 0.2s",
                }}
              >
                {claimed ? "✓ Claimed" : complete ? "Claim" : "Locked"}
              </button>
            </div>
          </motion.div>
        );
      })}

      {/* Weekly Challenge */}
      {weeklyChallenge && (
        <div style={{ marginTop: 8 }}>
          <SectionTitle>🏆 Weekly Challenge</SectionTitle>
          <div
            style={{
              background:
                "linear-gradient(135deg, rgba(255,215,0,0.06), rgba(10,10,26,0.8))",
              border: "1px solid rgba(255,215,0,0.3)",
              borderRadius: 14,
              padding: "16px",
            }}
          >
            <div
              style={{
                fontFamily: "Rajdhani, sans-serif",
                fontWeight: 700,
                fontSize: "1rem",
                color: "#ffd700",
                marginBottom: 4,
              }}
            >
              {weeklyChallenge.title}
            </div>
            <div
              style={{
                fontSize: "0.8rem",
                color: "rgba(255,255,255,0.55)",
                fontFamily: "Rajdhani, sans-serif",
                marginBottom: 12,
              }}
            >
              {weeklyChallenge.description}
            </div>
            <div
              style={{
                fontFamily: "Orbitron, sans-serif",
                fontSize: "0.8rem",
                fontWeight: 700,
                color: "#ffd700",
              }}
            >
              Reward: +{weeklyChallenge.reward} 🪙
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Battle Pass Tab ──────────────────────────────────────────────────────────
const TIERS = [
  { tier: 1, coins: 5, emoji: "🥉", xp: 2 },
  { tier: 2, coins: 10, emoji: "🎯", xp: 5 },
  { tier: 3, coins: 15, emoji: "⚔️", xp: 10 },
  { tier: 4, coins: 20, emoji: "🛡️", xp: 18 },
  { tier: 5, coins: 30, emoji: "🎖️", xp: 28 },
  { tier: 6, coins: 40, emoji: "💎", xp: 40 },
  { tier: 7, coins: 50, emoji: "🏅", xp: 55 },
  { tier: 8, coins: 65, emoji: "🎗️", xp: 72 },
  { tier: 9, coins: 80, emoji: "👑", xp: 90 },
  { tier: 10, coins: 100, emoji: "🏆", xp: 110 },
];

function BattlePassTab({
  uid,
  matchesPlayed,
  wins,
  onCreditCoins,
}: {
  uid: string;
  matchesPlayed: number;
  wins: number;
  onCreditCoins: (amount: number, reason: string) => Promise<void>;
}) {
  const xp = matchesPlayed * 2 + wins * 8;
  const currentTier = TIERS.findIndex((t) => xp < t.xp);
  const tierIdx = currentTier === -1 ? 10 : currentTier;

  const claimedKey = `ff_bp_claimed_${uid}`;
  const [claimed, setClaimed] = useState<number[]>(() =>
    getLsJson<number[]>(claimedKey, []),
  );

  const claimTier = async (tier: (typeof TIERS)[0]) => {
    if (claimed.includes(tier.tier)) return;
    if (tierIdx < tier.tier) return;
    const next = [...claimed, tier.tier];
    setClaimed(next);
    setLsJson(claimedKey, next);
    await onCreditCoins(
      tier.coins,
      `Battle Pass Tier ${tier.tier} reward claimed!`,
    );
  };

  const currentXP = xp;
  const nextThreshold =
    tierIdx < TIERS.length ? TIERS[tierIdx].xp : TIERS[9].xp;
  const prevThreshold = tierIdx > 0 ? TIERS[tierIdx - 1].xp : 0;

  return (
    <div>
      {/* Header stats */}
      <div
        style={{
          background:
            "linear-gradient(135deg, rgba(255,107,0,0.12), rgba(10,10,26,0.8))",
          border: "1px solid rgba(255,107,0,0.3)",
          borderRadius: 14,
          padding: "16px",
          marginBottom: 18,
        }}
      >
        <div
          style={{
            fontFamily: "Orbitron, sans-serif",
            fontSize: "0.9rem",
            fontWeight: 700,
            color: "#ffffff",
            marginBottom: 6,
          }}
        >
          🎫 SEASON BATTLE PASS
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 10,
          }}
        >
          <span
            style={{
              fontFamily: "Rajdhani, sans-serif",
              fontSize: "0.85rem",
              color: "rgba(255,255,255,0.6)",
            }}
          >
            Tier{" "}
            <strong style={{ color: "#ff6b00" }}>
              {Math.min(tierIdx, 10)}
            </strong>{" "}
            / 10
          </span>
          <span
            style={{
              fontFamily: "Orbitron, sans-serif",
              fontSize: "0.75rem",
              color: "#ff6b00",
            }}
          >
            {currentXP} XP
          </span>
        </div>
        <ProgressBar
          value={currentXP - prevThreshold}
          max={nextThreshold - prevThreshold}
          color="#ff6b00"
          height={10}
        />
        <div
          style={{
            fontSize: "0.72rem",
            color: "rgba(255,255,255,0.35)",
            fontFamily: "Rajdhani, sans-serif",
            marginTop: 6,
            textAlign: "right",
          }}
        >
          ♻️ Resets each season
        </div>
      </div>

      <SectionTitle>🏆 Tier Rewards</SectionTitle>

      {/* Horizontal tiers scroll */}
      <div
        style={{
          display: "flex",
          gap: 8,
          overflowX: "auto",
          paddingBottom: 4,
          marginBottom: 20,
          WebkitOverflowScrolling: "touch",
        }}
      >
        {TIERS.map((t) => {
          const unlocked = tierIdx >= t.tier;
          const isClaimed = claimed.includes(t.tier);
          return (
            <div
              key={t.tier}
              style={{
                flexShrink: 0,
                width: 76,
                background: unlocked
                  ? isClaimed
                    ? "rgba(34,197,94,0.1)"
                    : "rgba(255,107,0,0.12)"
                  : "rgba(255,255,255,0.04)",
                border: `1px solid ${unlocked ? (isClaimed ? "rgba(34,197,94,0.4)" : "#ff6b00") : "rgba(255,255,255,0.1)"}`,
                borderRadius: 12,
                padding: "10px 6px",
                textAlign: "center",
                opacity: unlocked ? 1 : 0.45,
                position: "relative",
              }}
            >
              {t.tier === tierIdx && (
                <div
                  style={{
                    position: "absolute",
                    top: -6,
                    left: "50%",
                    transform: "translateX(-50%)",
                    background: "#ff6b00",
                    color: "white",
                    fontFamily: "Orbitron, sans-serif",
                    fontSize: "0.45rem",
                    fontWeight: 700,
                    padding: "1px 5px",
                    borderRadius: 4,
                    whiteSpace: "nowrap",
                  }}
                >
                  CURRENT
                </div>
              )}
              <div style={{ fontSize: "1.4rem", marginBottom: 4 }}>
                {t.emoji}
              </div>
              <div
                style={{
                  fontFamily: "Orbitron, sans-serif",
                  fontSize: "0.6rem",
                  fontWeight: 700,
                  color: "#ff6b00",
                  marginBottom: 2,
                }}
              >
                T{t.tier}
              </div>
              <div
                style={{
                  fontFamily: "Rajdhani, sans-serif",
                  fontSize: "0.7rem",
                  color: "#ffd700",
                  marginBottom: 6,
                }}
              >
                +{t.coins}🪙
              </div>
              <button
                type="button"
                disabled={!unlocked || isClaimed}
                onClick={() => claimTier(t)}
                style={{
                  width: "100%",
                  padding: "4px 2px",
                  fontSize: "0.55rem",
                  fontFamily: "Orbitron, sans-serif",
                  fontWeight: 700,
                  borderRadius: 6,
                  border: "none",
                  cursor: unlocked && !isClaimed ? "pointer" : "not-allowed",
                  background: isClaimed
                    ? "rgba(34,197,94,0.2)"
                    : unlocked
                      ? "linear-gradient(135deg, #ff6b00, #cc5500)"
                      : "rgba(255,255,255,0.05)",
                  color: isClaimed
                    ? "#22c55e"
                    : unlocked
                      ? "white"
                      : "rgba(255,255,255,0.2)",
                }}
              >
                {isClaimed ? "✓" : unlocked ? "Claim" : "🔒"}
              </button>
            </div>
          );
        })}
      </div>

      <div
        style={{
          background: "rgba(255,255,255,0.04)",
          borderRadius: 10,
          padding: "12px 14px",
          fontSize: "0.78rem",
          color: "rgba(255,255,255,0.45)",
          fontFamily: "Rajdhani, sans-serif",
          lineHeight: 1.5,
        }}
      >
        💡 Earn XP by playing matches (+2 XP each) and winning (+8 XP each).
        Claim rewards as you unlock tiers!
      </div>
    </div>
  );
}

// ─── VIP Tab ──────────────────────────────────────────────────────────────────
function VIPTab({
  uid,
  user,
  coins: _coins,
  onCreditCoins,
  showToast,
}: {
  uid: string;
  user: Record<string, unknown>;
  coins: number;
  onCreditCoins: (amount: number, reason: string) => Promise<void>;
  showToast: (msg: string) => void;
}) {
  const totalDeposited = (user?.totalDeposited as number) ?? 0;
  const loyaltyPoints = Math.floor(totalDeposited / 10);
  const referralCode = uid ? `${uid}REF` : "";
  const referralCount = (user?.referralCount as number) ?? 0;
  const [birthMonth, setBirthMonth] = useState(
    () => localStorage.getItem(`ff_birthmonth_${uid}`) ?? "",
  );
  const [redeemingPoints, setRedeemingPoints] = useState(false);
  const [loginStreak] = useState(() => {
    const key = `ff_streak_${uid}`;
    const data = getLsJson<{ streak: number; lastDate: string }>(key, {
      streak: 0,
      lastDate: "",
    });
    const today = todayKey();
    const yesterday = new Date(Date.now() - 86400000)
      .toISOString()
      .slice(0, 10);
    if (data.lastDate === today) return data.streak;
    if (data.lastDate === yesterday) {
      const next = { streak: data.streak + 1, lastDate: today };
      setLsJson(key, next);
      return next.streak;
    }
    const reset = { streak: 1, lastDate: today };
    setLsJson(key, reset);
    return 1;
  });

  let vipTier = "None";
  let vipColor = "rgba(255,255,255,0.3)";
  let nextTierAmount = 500;
  if (totalDeposited >= 5000) {
    vipTier = "Gold";
    vipColor = "#ffd700";
    nextTierAmount = 5000;
  } else if (totalDeposited >= 2000) {
    vipTier = "Silver";
    vipColor = "#c0c0c0";
    nextTierAmount = 5000;
  } else if (totalDeposited >= 500) {
    vipTier = "Bronze";
    vipColor = "#cd7f32";
    nextTierAmount = 2000;
  }

  const vipProgress =
    vipTier === "Gold"
      ? 100
      : vipTier === "Silver"
        ? ((totalDeposited - 2000) / 3000) * 100
        : vipTier === "Bronze"
          ? ((totalDeposited - 500) / 1500) * 100
          : (totalDeposited / 500) * 100;

  const saveMonth = (m: string) => {
    setBirthMonth(m);
    localStorage.setItem(`ff_birthmonth_${uid}`, m);
    showToast("Birth month saved! 🎂");
  };

  const redeemPoints = async () => {
    if (loyaltyPoints < 100) {
      showToast("Need at least 100 loyalty points!");
      return;
    }
    setRedeemingPoints(true);
    try {
      await addDoc(collection(db, "pointRedemptions"), {
        uid,
        points: 100,
        reward: 5,
        status: "pending",
        timestamp: new Date(),
      });
      showToast("Redemption request submitted! Admin will approve soon.");
    } catch {
      showToast("Error submitting request");
    } finally {
      setRedeemingPoints(false);
    }
  };

  const copyReferral = () => {
    const text = `Join MR.SONIC FF with my code: ${referralCode}\nhttps://mrsonicff.app?ref=${uid}`;
    navigator.clipboard
      .writeText(text)
      .then(() => showToast("Referral code copied! 🔗"))
      .catch(() => showToast("Copy failed"));
  };

  const MONTHS = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  return (
    <div>
      {/* VIP Status Card */}
      <div
        style={{
          background: `linear-gradient(135deg, ${vipColor}18, rgba(10,10,26,0.9))`,
          border: `2px solid ${vipColor}55`,
          borderRadius: 16,
          padding: "18px",
          marginBottom: 14,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            right: -20,
            top: -20,
            fontSize: "6rem",
            opacity: 0.06,
            transform: "rotate(20deg)",
          }}
        >
          👑
        </div>
        <div style={{ position: "relative" }}>
          <div
            style={{
              fontFamily: "Orbitron, sans-serif",
              fontSize: "0.7rem",
              color: "rgba(255,255,255,0.4)",
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              marginBottom: 4,
            }}
          >
            Your VIP Status
          </div>
          <div
            style={{
              fontFamily: "Orbitron, sans-serif",
              fontSize: "1.6rem",
              fontWeight: 900,
              color: vipColor,
              textShadow: `0 0 20px ${vipColor}66`,
              marginBottom: 12,
            }}
          >
            {vipTier === "None" ? "No VIP" : `${vipTier} VIP`}
          </div>
          <ProgressBar
            value={Math.min(vipProgress, 100)}
            max={100}
            color={vipColor === "rgba(255,255,255,0.3)" ? "#ff6b00" : vipColor}
            height={8}
          />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: 6,
              fontSize: "0.72rem",
              fontFamily: "Rajdhani, sans-serif",
              color: "rgba(255,255,255,0.4)",
            }}
          >
            <span>₹{totalDeposited} deposited</span>
            {vipTier !== "Gold" && <span>₹{nextTierAmount} for next tier</span>}
          </div>
        </div>
      </div>

      {/* VIP Tiers */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 8,
          marginBottom: 14,
        }}
      >
        {[
          { name: "Bronze", color: "#cd7f32", req: "₹500+", emoji: "🥉" },
          { name: "Silver", color: "#c0c0c0", req: "₹2000+", emoji: "🥈" },
          { name: "Gold", color: "#ffd700", req: "₹5000+", emoji: "🥇" },
        ].map((v) => (
          <div
            key={v.name}
            style={{
              background:
                vipTier === v.name ? `${v.color}18` : "rgba(255,255,255,0.03)",
              border: `1px solid ${vipTier === v.name ? `${v.color}55` : "rgba(255,255,255,0.08)"}`,
              borderRadius: 12,
              padding: "12px 8px",
              textAlign: "center",
              opacity: vipTier === v.name ? 1 : 0.5,
            }}
          >
            <div style={{ fontSize: "1.5rem", marginBottom: 4 }}>{v.emoji}</div>
            <div
              style={{
                fontFamily: "Orbitron, sans-serif",
                fontSize: "0.62rem",
                fontWeight: 700,
                color: v.color,
                marginBottom: 2,
              }}
            >
              {v.name}
            </div>
            <div
              style={{
                fontSize: "0.62rem",
                color: "rgba(255,255,255,0.4)",
                fontFamily: "Rajdhani, sans-serif",
              }}
            >
              {v.req}
            </div>
          </div>
        ))}
      </div>

      {/* VIP Perks */}
      <div
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,107,0,0.2)",
          borderRadius: 14,
          padding: "14px 16px",
          marginBottom: 14,
        }}
      >
        <div
          style={{
            fontFamily: "Orbitron, sans-serif",
            fontSize: "0.72rem",
            fontWeight: 700,
            color: "#ffffff",
            marginBottom: 10,
            letterSpacing: "0.08em",
          }}
        >
          👑 VIP PERKS
        </div>
        {[
          "⚡ -5% entry fee on all matches",
          "🚀 Priority withdrawal processing",
          "🏅 VIP badge in leaderboard",
          "🎯 Special VIP tag in matches",
        ].map((perk) => (
          <div
            key={perk}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 0",
              borderBottom:
                perk !== "🎯 Special VIP tag in matches"
                  ? "1px solid rgba(255,255,255,0.05)"
                  : "none",
              fontFamily: "Rajdhani, sans-serif",
              fontSize: "0.83rem",
              color: vipTier !== "None" ? "#ffffff" : "rgba(255,255,255,0.4)",
            }}
          >
            {perk}
          </div>
        ))}
      </div>

      {/* Loyalty Points */}
      <div
        style={{
          background: "rgba(6,182,212,0.06)",
          border: "1px solid rgba(6,182,212,0.25)",
          borderRadius: 14,
          padding: "14px 16px",
          marginBottom: 14,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 8,
          }}
        >
          <div
            style={{
              fontFamily: "Orbitron, sans-serif",
              fontSize: "0.72rem",
              fontWeight: 700,
              color: "#06b6d4",
              letterSpacing: "0.08em",
            }}
          >
            💎 LOYALTY POINTS
          </div>
          <div
            style={{
              fontFamily: "Orbitron, sans-serif",
              fontSize: "1rem",
              fontWeight: 700,
              color: "#06b6d4",
            }}
          >
            {loyaltyPoints}
          </div>
        </div>
        <div
          style={{
            fontSize: "0.75rem",
            color: "rgba(255,255,255,0.45)",
            fontFamily: "Rajdhani, sans-serif",
            marginBottom: 10,
          }}
        >
          1 point per ₹10 deposited • 100 points = ₹5 bonus coins
        </div>
        <button
          type="button"
          onClick={redeemPoints}
          disabled={redeemingPoints || loyaltyPoints < 100}
          data-ocid="vip.redeem_points.button"
          style={{
            width: "100%",
            padding: "9px",
            borderRadius: 8,
            fontFamily: "Orbitron, sans-serif",
            fontSize: "0.68rem",
            fontWeight: 700,
            letterSpacing: "0.05em",
            border: "none",
            cursor: loyaltyPoints >= 100 ? "pointer" : "not-allowed",
            background:
              loyaltyPoints >= 100
                ? "linear-gradient(135deg, #06b6d4, #0891b2)"
                : "rgba(255,255,255,0.06)",
            color: loyaltyPoints >= 100 ? "white" : "rgba(255,255,255,0.25)",
            boxShadow:
              loyaltyPoints >= 100 ? "0 2px 12px rgba(6,182,212,0.4)" : "none",
          }}
        >
          {redeemingPoints ? "Submitting..." : "Redeem 100 Points → ₹5"}
        </button>
      </div>

      {/* Login Streak */}
      <div
        style={{
          background: "rgba(255,215,0,0.06)",
          border: "1px solid rgba(255,215,0,0.25)",
          borderRadius: 14,
          padding: "14px 16px",
          marginBottom: 14,
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
          <div
            style={{
              fontFamily: "Orbitron, sans-serif",
              fontSize: "0.72rem",
              fontWeight: 700,
              color: "#ffd700",
              letterSpacing: "0.08em",
            }}
          >
            🔥 LOGIN STREAK
          </div>
          <div
            style={{
              fontFamily: "Orbitron, sans-serif",
              fontSize: "1rem",
              fontWeight: 700,
              color: "#ffd700",
            }}
          >
            {loginStreak}/7
          </div>
        </div>
        <ProgressBar value={loginStreak} max={7} color="#ffd700" height={8} />
        <div
          style={{
            fontSize: "0.73rem",
            color: "rgba(255,255,255,0.4)",
            fontFamily: "Rajdhani, sans-serif",
            marginTop: 6,
          }}
        >
          {loginStreak >= 7
            ? "🎉 7-day streak! Claim your ₹5 bonus below."
            : `${7 - loginStreak} more days for ₹5 streak bonus`}
        </div>
        {loginStreak >= 7 && (
          <button
            type="button"
            onClick={() => {
              const k = `ff_streak_claimed_${uid}`;
              if (localStorage.getItem(k) === todayKey()) {
                showToast("Already claimed today!");
                return;
              }
              localStorage.setItem(k, todayKey());
              onCreditCoins(5, "7-day login streak bonus!");
            }}
            style={{
              marginTop: 10,
              width: "100%",
              padding: "9px",
              borderRadius: 8,
              fontFamily: "Orbitron, sans-serif",
              fontSize: "0.68rem",
              fontWeight: 700,
              background: "linear-gradient(135deg, #ffd700, #ff9500)",
              color: "#000",
              border: "none",
              cursor: "pointer",
              boxShadow: "0 2px 12px rgba(255,215,0,0.4)",
            }}
          >
            Claim ₹5 Streak Bonus
          </button>
        )}
      </div>

      {/* Birthday Reward */}
      <div
        style={{
          background: "rgba(255,107,0,0.06)",
          border: "1px solid rgba(255,107,0,0.2)",
          borderRadius: 14,
          padding: "14px 16px",
          marginBottom: 14,
        }}
      >
        <div
          style={{
            fontFamily: "Orbitron, sans-serif",
            fontSize: "0.72rem",
            fontWeight: 700,
            color: "#ff6b00",
            letterSpacing: "0.08em",
            marginBottom: 10,
          }}
        >
          🎂 BIRTHDAY REWARD
        </div>
        <div
          style={{
            fontSize: "0.75rem",
            color: "rgba(255,255,255,0.5)",
            fontFamily: "Rajdhani, sans-serif",
            marginBottom: 10,
          }}
        >
          Get ₹10 bonus in your birth month!
        </div>
        <select
          className="fire-input"
          value={birthMonth}
          onChange={(e) => saveMonth(e.target.value)}
          data-ocid="vip.birth_month.input"
          style={{ marginBottom: 0 }}
        >
          <option value="">-- Select birth month --</option>
          {MONTHS.map((m, i) => (
            <option key={m} value={String(i + 1)}>
              {m}
            </option>
          ))}
        </select>
        {birthMonth && String(new Date().getMonth() + 1) === birthMonth && (
          <button
            type="button"
            onClick={() => {
              const k = `ff_bday_${uid}_${new Date().getFullYear()}_${birthMonth}`;
              if (localStorage.getItem(k)) {
                showToast("Birthday bonus already claimed this year!");
                return;
              }
              localStorage.setItem(k, "1");
              onCreditCoins(10, "🎂 Happy Birthday! Bonus coins credited.");
            }}
            style={{
              marginTop: 10,
              width: "100%",
              padding: "9px",
              borderRadius: 8,
              fontFamily: "Orbitron, sans-serif",
              fontSize: "0.68rem",
              fontWeight: 700,
              background: "linear-gradient(135deg, #ff6b00, #cc5500)",
              color: "white",
              border: "none",
              cursor: "pointer",
              boxShadow: "0 2px 12px rgba(255,107,0,0.4)",
            }}
          >
            🎉 Claim Birthday ₹10!
          </button>
        )}
      </div>

      {/* Referral System */}
      <div
        style={{
          background: "rgba(0,200,100,0.06)",
          border: "1px solid rgba(0,200,100,0.25)",
          borderRadius: 14,
          padding: "14px 16px",
          marginBottom: 14,
        }}
      >
        <div
          style={{
            fontFamily: "Orbitron, sans-serif",
            fontSize: "0.72rem",
            fontWeight: 700,
            color: "#00c864",
            letterSpacing: "0.08em",
            marginBottom: 10,
          }}
        >
          🔗 REFERRAL SYSTEM
        </div>
        <div
          style={{
            fontSize: "0.75rem",
            color: "rgba(255,255,255,0.5)",
            fontFamily: "Rajdhani, sans-serif",
            marginBottom: 12,
          }}
        >
          Both you and your friend get ₹10 when they sign up with your code!
        </div>
        <div
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px dashed rgba(0,200,100,0.4)",
            borderRadius: 10,
            padding: "10px 12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 10,
          }}
        >
          <span
            style={{
              fontFamily: "Orbitron, sans-serif",
              fontSize: "0.82rem",
              fontWeight: 700,
              color: "#00c864",
              letterSpacing: "0.05em",
            }}
          >
            {referralCode}
          </span>
          <button
            type="button"
            onClick={copyReferral}
            data-ocid="vip.copy_referral.button"
            style={{
              padding: "5px 12px",
              background: "rgba(0,200,100,0.15)",
              border: "1px solid rgba(0,200,100,0.3)",
              borderRadius: 6,
              color: "#00c864",
              fontFamily: "Rajdhani, sans-serif",
              fontSize: "0.72rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            📋 Copy
          </button>
        </div>
        <div
          style={{
            fontFamily: "Rajdhani, sans-serif",
            fontSize: "0.8rem",
            color: "rgba(255,255,255,0.5)",
          }}
        >
          Total referrals:{" "}
          <strong style={{ color: "#00c864" }}>{referralCount}</strong>
        </div>
      </div>
    </div>
  );
}

// ─── Extras Tab ───────────────────────────────────────────────────────────────
function ExtrasTab({
  uid,
  onCreditCoins,
  showToast,
}: {
  uid: string;
  onCreditCoins: (amount: number, reason: string) => Promise<void>;
  showToast: (msg: string) => void;
}) {
  const luckyKey = `ff_lucky_${uid}_${todayKey()}`;
  const [luckyUsed, setLuckyUsed] = useState(
    () => localStorage.getItem(luckyKey) === "1",
  );
  const [luckyResult, setLuckyResult] = useState<number | null>(null);
  const [luckyOpen, setLuckyOpen] = useState(false);

  const [redeemCode, setRedeemCode] = useState("");
  const [redeemLoading, setRedeemLoading] = useState(false);

  const [topReferrers, setTopReferrers] = useState<
    { uid: string; name: string; count: number }[]
  >([]);
  const listRef = useRef(false);

  // Load top referrers once
  useEffect(() => {
    if (listRef.current) return;
    listRef.current = true;
    (async () => {
      try {
        const q = query(
          collection(db, "users"),
          orderBy("referralCount", "desc"),
          limit(5),
        );
        const snap = await getDocs(q);
        const rows = snap.docs.map((d) => ({
          uid: d.id,
          name: (d.data().displayName as string) ?? d.id,
          count: (d.data().referralCount as number) ?? 0,
        }));
        setTopReferrers(rows);
      } catch {
        /* silent */
      }
    })();
  }, []);

  const claimLucky = async () => {
    if (luckyUsed) return;
    const amount = 1 + Math.floor(Math.random() * 10);
    setLuckyResult(amount);
    setLuckyOpen(true);
    setTimeout(() => {
      setLuckyOpen(false);
    }, 1800);
    localStorage.setItem(luckyKey, "1");
    setLuckyUsed(true);
    await onCreditCoins(amount, "🎁 Lucky Dip reward!");
  };

  const handleRedeem = async () => {
    if (!redeemCode.trim()) return;
    setRedeemLoading(true);
    try {
      const q = query(
        collection(db, "redeemCodes"),
        where("code", "==", redeemCode.trim().toUpperCase()),
        where("active", "==", true),
        limit(1),
      );
      const snap = await getDocs(q);
      if (snap.empty) {
        showToast("Invalid or expired code!");
        setRedeemLoading(false);
        return;
      }
      const codeDoc = snap.docs[0];
      const data = codeDoc.data();

      // Check if this uid already used it
      const usedBy: string[] = (data.usedBy as string[]) ?? [];
      if (usedBy.includes(uid)) {
        showToast("You already used this code!");
        setRedeemLoading(false);
        return;
      }

      // Check usage limit
      if (data.maxUses && usedBy.length >= (data.maxUses as number)) {
        showToast("Code usage limit reached!");
        setRedeemLoading(false);
        return;
      }

      await updateDoc(codeDoc.ref, { usedBy: [...usedBy, uid] });
      await onCreditCoins(
        data.reward as number,
        `🎉 Redeem code ${redeemCode.trim().toUpperCase()} applied!`,
      );
      setRedeemCode("");
    } catch {
      showToast("Error redeeming code");
    } finally {
      setRedeemLoading(false);
    }
  };

  return (
    <div>
      {/* Lucky Dip */}
      <SectionTitle>🎁 Lucky Dip</SectionTitle>
      <div
        style={{
          background:
            "linear-gradient(135deg, rgba(255,215,0,0.08), rgba(10,10,26,0.8))",
          border: "1px solid rgba(255,215,0,0.3)",
          borderRadius: 16,
          padding: "20px",
          marginBottom: 20,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: "0.8rem",
            color: "rgba(255,255,255,0.5)",
            fontFamily: "Rajdhani, sans-serif",
            marginBottom: 14,
          }}
        >
          Tap the mystery box for 1–10 coins! Once per day.
        </div>

        <AnimatePresence>
          {luckyOpen && luckyResult !== null && (
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1.2, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 200 }}
              style={{
                fontFamily: "Orbitron, sans-serif",
                fontSize: "1.8rem",
                fontWeight: 900,
                color: "#ffd700",
                textShadow: "0 0 24px rgba(255,215,0,0.6)",
                marginBottom: 12,
              }}
            >
              🪙 +{luckyResult}
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button
          type="button"
          onClick={claimLucky}
          disabled={luckyUsed}
          whileHover={luckyUsed ? {} : { scale: 1.06 }}
          whileTap={luckyUsed ? {} : { scale: 0.94 }}
          data-ocid="extras.lucky_dip.button"
          style={{
            width: 100,
            height: 100,
            borderRadius: "50%",
            border: `3px solid ${luckyUsed ? "rgba(255,255,255,0.1)" : "rgba(255,215,0,0.5)"}`,
            background: luckyUsed
              ? "rgba(255,255,255,0.05)"
              : "radial-gradient(circle, rgba(255,215,0,0.2) 0%, rgba(255,107,0,0.1) 100%)",
            cursor: luckyUsed ? "not-allowed" : "pointer",
            fontSize: "3rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto",
            boxShadow: luckyUsed ? "none" : "0 0 24px rgba(255,215,0,0.3)",
            animation: luckyUsed
              ? "none"
              : "pulse-glow 2s ease-in-out infinite",
          }}
        >
          {luckyUsed ? "🔒" : "🎁"}
        </motion.button>

        {luckyUsed && (
          <div
            style={{
              marginTop: 10,
              fontSize: "0.75rem",
              color: "rgba(255,255,255,0.35)",
              fontFamily: "Rajdhani, sans-serif",
            }}
          >
            Used today. Come back tomorrow!
          </div>
        )}
      </div>

      {/* Redeem Code */}
      <SectionTitle>🎟️ Redeem Code</SectionTitle>
      <div
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,107,0,0.2)",
          borderRadius: 14,
          padding: "16px",
          marginBottom: 20,
        }}
      >
        <div
          style={{
            fontSize: "0.78rem",
            color: "rgba(255,255,255,0.45)",
            fontFamily: "Rajdhani, sans-serif",
            marginBottom: 12,
          }}
        >
          Enter a promo or reward code to claim coins instantly.
        </div>
        <input
          className="fire-input"
          placeholder="Enter promo code"
          value={redeemCode}
          onChange={(e) => setRedeemCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && handleRedeem()}
          data-ocid="extras.redeem_code.input"
          style={{
            marginBottom: 10,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            fontFamily: "Orbitron, sans-serif",
          }}
        />
        <button
          type="button"
          onClick={handleRedeem}
          disabled={redeemLoading || !redeemCode.trim()}
          data-ocid="extras.redeem.button"
          className="fire-btn"
          style={{ opacity: redeemCode.trim() ? 1 : 0.5 }}
        >
          {redeemLoading ? "Checking..." : "🎟️ REDEEM"}
        </button>
      </div>

      {/* Referral Leaderboard */}
      <SectionTitle>🏆 Top Referrers</SectionTitle>
      <div
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,107,0,0.2)",
          borderRadius: 14,
          padding: "14px 16px",
          marginBottom: 14,
        }}
      >
        {topReferrers.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "20px",
              color: "rgba(255,255,255,0.3)",
              fontFamily: "Rajdhani, sans-serif",
              fontSize: "0.85rem",
            }}
          >
            No referrals yet. Be the first! 🚀
          </div>
        ) : (
          topReferrers.map((r, i) => (
            <div
              key={r.uid}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "9px 0",
                borderBottom:
                  i < topReferrers.length - 1
                    ? "1px solid rgba(255,255,255,0.05)"
                    : "none",
              }}
            >
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: "50%",
                  background:
                    i === 0
                      ? "linear-gradient(135deg, #ffd700, #ff9500)"
                      : i === 1
                        ? "linear-gradient(135deg, #c0c0c0, #a0a0a0)"
                        : i === 2
                          ? "linear-gradient(135deg, #cd7f32, #a0522d)"
                          : "rgba(255,107,0,0.1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "Orbitron, sans-serif",
                  fontSize: "0.68rem",
                  fontWeight: 700,
                  color: i < 3 ? "#000" : "#ff6b00",
                  flexShrink: 0,
                }}
              >
                {i + 1}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontFamily: "Rajdhani, sans-serif",
                    fontWeight: 600,
                    fontSize: "0.9rem",
                    color: "#ffffff",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {r.name}
                </div>
                <div
                  style={{
                    fontSize: "0.7rem",
                    color: "rgba(255,255,255,0.35)",
                    fontFamily: "Rajdhani, sans-serif",
                  }}
                >
                  {r.uid}
                </div>
              </div>
              <div
                style={{
                  fontFamily: "Orbitron, sans-serif",
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  color: "#00c864",
                  flexShrink: 0,
                }}
              >
                {r.count} refs
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
