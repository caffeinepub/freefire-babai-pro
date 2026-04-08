// @ts-nocheck
/* eslint-disable */
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import {
  addDoc,
  collection,
  db,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
} from "../firebase";

interface UserData {
  uid: string;
  displayName: string;
  wins: number;
  kills: number;
  matchesPlayed: number;
  coins: number;
}

interface GamificationViewProps {
  currentUser: string;
  userData: UserData;
  onNavigate: (v: string) => void;
  showToast: (msg: string, type?: "success" | "error") => void;
}

const DAILY_MISSIONS = [
  { id: "join_match", label: "Join 1 Match", emoji: "⚔️", goal: 1, reward: 5 },
  { id: "login_streak", label: "Login Today", emoji: "📅", goal: 1, reward: 3 },
  {
    id: "visit_leaderboard",
    label: "Check Leaderboard",
    emoji: "🏆",
    goal: 1,
    reward: 2,
  },
];

const ACHIEVEMENTS = [
  {
    id: "first_win",
    label: "First Victory",
    emoji: "🏆",
    desc: "Win your first match",
    req: (u: UserData) => u.wins >= 1,
  },
  {
    id: "kills_10",
    label: "10 Kills",
    emoji: "💀",
    desc: "Get 10 kills",
    req: (u: UserData) => u.kills >= 10,
  },
  {
    id: "kills_50",
    label: "Killing Spree",
    emoji: "🔥",
    desc: "Get 50 kills",
    req: (u: UserData) => u.kills >= 50,
  },
  {
    id: "kills_100",
    label: "Terminator",
    emoji: "🤖",
    desc: "Get 100 kills",
    req: (u: UserData) => u.kills >= 100,
  },
  {
    id: "kills_500",
    label: "Legend Slayer",
    emoji: "👑",
    desc: "Get 500 kills",
    req: (u: UserData) => u.kills >= 500,
  },
  {
    id: "matches_1",
    label: "First Match",
    emoji: "🎮",
    desc: "Play your first match",
    req: (u: UserData) => u.matchesPlayed >= 1,
  },
  {
    id: "matches_10",
    label: "Regular Player",
    emoji: "⭐",
    desc: "Play 10 matches",
    req: (u: UserData) => u.matchesPlayed >= 10,
  },
  {
    id: "matches_25",
    label: "Veteran",
    emoji: "🛡️",
    desc: "Play 25 matches",
    req: (u: UserData) => u.matchesPlayed >= 25,
  },
  {
    id: "wins_5",
    label: "5 Victories",
    emoji: "🥇",
    desc: "Win 5 matches",
    req: (u: UserData) => u.wins >= 5,
  },
  {
    id: "wins_20",
    label: "Champion",
    emoji: "💎",
    desc: "Win 20 matches",
    req: (u: UserData) => u.wins >= 20,
  },
];

export default function GamificationView({
  currentUser,
  userData,
  onNavigate: _onNavigate,
  showToast,
}: GamificationViewProps) {
  const [activeTab, setActiveTab] = useState("missions");
  const [luckyDipUsed, setLuckyDipUsed] = useState(false);
  const [luckyDipResult, setLuckyDipResult] = useState<number | null>(null);
  const [weeklyChallenge, setWeeklyChallenge] = useState<any>(null);
  const [missionProgress, setMissionProgress] = useState<
    Record<string, number>
  >({});
  const [countdown, setCountdown] = useState("");

  const battlePassTier = Math.min(
    10,
    Math.floor((userData?.matchesPlayed ?? 0) / 5),
  );

  useEffect(() => {
    const today = new Date().toDateString();
    const lastUsed = localStorage.getItem(`luckyDip_${currentUser}`);
    setLuckyDipUsed(lastUsed === today);
  }, [currentUser]);

  useEffect(() => {
    const today = new Date().toDateString();
    const saved = localStorage.getItem(`missions_${currentUser}_${today}`);
    if (saved) {
      try {
        setMissionProgress(JSON.parse(saved));
      } catch (_) {}
    } else {
      const progress: Record<string, number> = {
        login_streak: 1,
        join_match: 0,
        visit_leaderboard: 0,
      };
      setMissionProgress(progress);
      localStorage.setItem(
        `missions_${currentUser}_${today}`,
        JSON.stringify(progress),
      );
    }
  }, [currentUser]);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const nextSunday = new Date();
      const daysUntilSunday = (7 - now.getDay()) % 7 || 7;
      nextSunday.setDate(now.getDate() + daysUntilSunday);
      nextSunday.setHours(18, 0, 0, 0);
      const diff = nextSunday.getTime() - now.getTime();
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setCountdown(`${d}d ${h}h ${m}m`);
    };
    tick();
    const t = setInterval(tick, 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!db) return;
    const q = query(
      collection(db, "weeklyChallenges"),
      orderBy("createdAt", "desc"),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        if (!snap.empty)
          setWeeklyChallenge({ id: snap.docs[0].id, ...snap.docs[0].data() });
      },
      () => {},
    );
    return () => unsub();
  }, []);

  const handleLuckyDip = async () => {
    const today = new Date().toDateString();
    if (luckyDipUsed) {
      showToast("Already used today!", "error");
      return;
    }
    const reward = Math.floor(Math.random() * 10) + 1;
    setLuckyDipResult(reward);
    setLuckyDipUsed(true);
    localStorage.setItem(`luckyDip_${currentUser}`, today);
    try {
      const walletRef = doc(db, "wallet", currentUser);
      const walletSnap = await getDoc(walletRef);
      const currentCoins = walletSnap.exists()
        ? walletSnap.data().coins || 0
        : 0;
      await setDoc(walletRef, { coins: currentCoins + reward });
      showToast(`🎲 Lucky! You got ${reward} coins!`, "success");
    } catch (_) {
      showToast("Failed to credit coins", "error");
    }
  };

  const tabs = [
    { id: "missions", label: "🎯 Missions" },
    { id: "battlepass", label: "⚡ Battle Pass" },
    { id: "achievements", label: "🏅 Badges" },
    { id: "arena", label: "🏟️ Arena" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="main-content"
      data-ocid="gamification.section"
    >
      <div
        style={{
          fontFamily: "Orbitron, sans-serif",
          fontSize: "1rem",
          fontWeight: 700,
          color: "#fff",
          marginBottom: 14,
        }}
      >
        🎯 MISSIONS & REWARDS
      </div>

      <div className="tab-bar" style={{ marginBottom: 16 }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`tab-item ${activeTab === t.id ? "active" : ""}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "missions" && (
        <div>
          <div className="section-label" style={{ marginBottom: 10 }}>
            📅 Daily Missions
          </div>
          {DAILY_MISSIONS.map((mission) => {
            const progress = missionProgress[mission.id] ?? 0;
            const completed = progress >= mission.goal;
            return (
              <motion.div
                key={mission.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                data-ocid="gamification.mission_row"
                style={{
                  background: completed
                    ? "rgba(34,197,94,0.08)"
                    : "rgba(255,255,255,0.03)",
                  border: `1px solid ${completed ? "rgba(34,197,94,0.3)" : "rgba(255,107,0,0.15)"}`,
                  borderRadius: 12,
                  padding: "14px 16px",
                  marginBottom: 10,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    marginBottom: 8,
                  }}
                >
                  <div style={{ fontSize: "1.5rem" }}>{mission.emoji}</div>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontFamily: "Rajdhani, sans-serif",
                        fontWeight: 600,
                        fontSize: "0.9rem",
                        color: "#fff",
                      }}
                    >
                      {mission.label}
                    </div>
                    <div
                      style={{
                        fontSize: "0.7rem",
                        color: "rgba(255,255,255,0.4)",
                      }}
                    >
                      Reward: {mission.reward} 🪙
                    </div>
                  </div>
                  {completed ? (
                    <span className="badge badge-success">✓ DONE</span>
                  ) : (
                    <span
                      style={{
                        fontFamily: "Orbitron, sans-serif",
                        fontSize: "0.7rem",
                        color: "#ff6b00",
                      }}
                    >
                      {progress}/{mission.goal}
                    </span>
                  )}
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
                      width: `${Math.min(100, (progress / mission.goal) * 100)}%`,
                      background: completed
                        ? "#22c55e"
                        : "linear-gradient(90deg,#ff6b00,#fbbf24)",
                      borderRadius: 2,
                      transition: "width 0.4s",
                    }}
                  />
                </div>
              </motion.div>
            );
          })}

          <div
            className="section-label"
            style={{ marginBottom: 10, marginTop: 16 }}
          >
            📆 Weekly Challenge
          </div>
          <div
            style={{
              background: "rgba(99,102,241,0.08)",
              border: "1px solid rgba(99,102,241,0.25)",
              borderRadius: 12,
              padding: "14px 16px",
              marginBottom: 16,
            }}
          >
            {weeklyChallenge ? (
              <>
                <div
                  style={{
                    fontFamily: "Rajdhani, sans-serif",
                    fontWeight: 600,
                    color: "#818cf8",
                    marginBottom: 4,
                  }}
                >
                  {weeklyChallenge.title}
                </div>
                <div
                  style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.6)" }}
                >
                  {weeklyChallenge.description}
                </div>
              </>
            ) : (
              <div
                style={{
                  fontFamily: "Rajdhani, sans-serif",
                  color: "rgba(255,255,255,0.4)",
                  textAlign: "center",
                }}
              >
                No weekly challenge set yet
              </div>
            )}
          </div>

          <div className="section-label" style={{ marginBottom: 10 }}>
            🎲 Lucky Dip
          </div>
          <div
            style={{
              background:
                "linear-gradient(135deg,rgba(168,85,247,0.1),rgba(10,10,26,0.8))",
              border: "1px solid rgba(168,85,247,0.25)",
              borderRadius: 14,
              padding: "20px",
              marginBottom: 16,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "3rem", marginBottom: 8 }}>🎲</div>
            <div
              style={{
                fontFamily: "Orbitron, sans-serif",
                fontSize: "0.85rem",
                color: "#fff",
                marginBottom: 8,
              }}
            >
              Daily Mystery Box
            </div>
            <div
              style={{
                fontFamily: "Rajdhani, sans-serif",
                fontSize: "0.8rem",
                color: "rgba(255,255,255,0.5)",
                marginBottom: 12,
              }}
            >
              Win 1–10 random coins once per day!
            </div>
            {luckyDipResult !== null && (
              <div
                style={{
                  fontFamily: "Orbitron, sans-serif",
                  fontWeight: 900,
                  fontSize: "1.4rem",
                  color: "#fbbf24",
                  marginBottom: 12,
                }}
              >
                🎉 +{luckyDipResult} coins!
              </div>
            )}
            <button
              type="button"
              onClick={handleLuckyDip}
              disabled={luckyDipUsed}
              data-ocid="gamification.lucky_dip.button"
              style={{
                padding: "12px 28px",
                background: luckyDipUsed
                  ? "rgba(255,255,255,0.08)"
                  : "linear-gradient(135deg,#a855f7,#7c3aed)",
                border: luckyDipUsed
                  ? "1px solid rgba(255,255,255,0.1)"
                  : "none",
                borderRadius: 12,
                color: luckyDipUsed ? "rgba(255,255,255,0.4)" : "#fff",
                fontFamily: "Orbitron, sans-serif",
                fontWeight: 700,
                fontSize: "0.8rem",
                cursor: luckyDipUsed ? "not-allowed" : "pointer",
              }}
            >
              {luckyDipUsed ? "Used Today ✓" : "🎲 OPEN BOX"}
            </button>
          </div>
        </div>
      )}

      {activeTab === "battlepass" && (
        <div>
          <div
            style={{
              background:
                "linear-gradient(135deg,rgba(255,107,0,0.1),rgba(10,10,26,0.8))",
              border: "1px solid rgba(255,107,0,0.25)",
              borderRadius: 16,
              padding: "20px 16px",
              marginBottom: 16,
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontFamily: "Orbitron, sans-serif",
                fontSize: "0.75rem",
                color: "rgba(255,255,255,0.5)",
                marginBottom: 8,
              }}
            >
              CURRENT SEASON
            </div>
            <div
              style={{
                fontFamily: "Orbitron, sans-serif",
                fontWeight: 900,
                fontSize: "2rem",
                color: "#ff6b00",
                marginBottom: 12,
              }}
            >
              Tier {battlePassTier}/10
            </div>
            <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
              {Array.from({ length: 10 }, (_, i) => (
                <div
                  key={`bpt-${i + 1}`}
                  style={{
                    flex: 1,
                    height: 10,
                    borderRadius: 5,
                    background:
                      i < battlePassTier
                        ? "linear-gradient(90deg,#ff6b00,#fbbf24)"
                        : "rgba(255,255,255,0.1)",
                    transition: "background 0.3s",
                  }}
                />
              ))}
            </div>
            <div
              style={{
                fontFamily: "Rajdhani, sans-serif",
                fontSize: "0.8rem",
                color: "rgba(255,255,255,0.4)",
              }}
            >
              Play more matches to advance. {10 - battlePassTier} tiers
              remaining.
            </div>
          </div>

          <div className="section-label" style={{ marginBottom: 10 }}>
            🎁 Tier Rewards
          </div>
          {Array.from({ length: 10 }, (_, i) => {
            const tier = i + 1;
            const unlocked = tier <= battlePassTier;
            const rewards = [
              "5 coins",
              "10 coins",
              "Bronze Badge",
              "15 coins",
              "Silver Badge",
              "25 coins",
              "Gold Badge",
              "50 coins",
              "Elite Title",
              "Legend Crown",
            ];
            return (
              <div
                key={`tier-${tier}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 14px",
                  background: unlocked
                    ? "rgba(255,107,0,0.08)"
                    : "rgba(255,255,255,0.02)",
                  border: `1px solid ${unlocked ? "rgba(255,107,0,0.25)" : "rgba(255,255,255,0.06)"}`,
                  borderRadius: 10,
                  marginBottom: 6,
                  opacity: unlocked ? 1 : 0.5,
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: unlocked
                      ? "linear-gradient(135deg,#ff6b00,#fbbf24)"
                      : "rgba(255,255,255,0.1)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: "Orbitron, sans-serif",
                    fontWeight: 700,
                    fontSize: "0.75rem",
                    color: unlocked ? "#000" : "rgba(255,255,255,0.4)",
                    flexShrink: 0,
                  }}
                >
                  {tier}
                </div>
                <div
                  style={{
                    flex: 1,
                    fontFamily: "Rajdhani, sans-serif",
                    fontSize: "0.85rem",
                    color: "#fff",
                  }}
                >
                  {rewards[i]}
                </div>
                {unlocked && (
                  <span
                    className="badge badge-success"
                    style={{ fontSize: "0.6rem" }}
                  >
                    UNLOCKED ✓
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {activeTab === "achievements" && (
        <div>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}
          >
            {ACHIEVEMENTS.map((ach) => {
              const unlocked = ach.req(userData);
              return (
                <motion.div
                  key={ach.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  data-ocid="gamification.achievement_badge"
                  style={{
                    background: unlocked
                      ? "rgba(255,107,0,0.1)"
                      : "rgba(255,255,255,0.03)",
                    border: `1px solid ${unlocked ? "rgba(255,107,0,0.35)" : "rgba(255,255,255,0.08)"}`,
                    borderRadius: 14,
                    padding: "16px 12px",
                    textAlign: "center",
                    opacity: unlocked ? 1 : 0.45,
                  }}
                >
                  <div
                    style={{
                      fontSize: "2rem",
                      marginBottom: 6,
                      filter: unlocked ? "none" : "grayscale(100%)",
                    }}
                  >
                    {ach.emoji}
                  </div>
                  <div
                    style={{
                      fontFamily: "Orbitron, sans-serif",
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      color: unlocked ? "#fff" : "rgba(255,255,255,0.4)",
                      marginBottom: 3,
                    }}
                  >
                    {ach.label}
                  </div>
                  <div
                    style={{
                      fontFamily: "Rajdhani, sans-serif",
                      fontSize: "0.65rem",
                      color: "rgba(255,255,255,0.35)",
                      lineHeight: 1.3,
                    }}
                  >
                    {ach.desc}
                  </div>
                  {unlocked && (
                    <div
                      style={{
                        marginTop: 6,
                        fontSize: "0.6rem",
                        color: "#22c55e",
                        fontFamily: "Orbitron, sans-serif",
                      }}
                    >
                      ✓ EARNED
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === "arena" && (
        <div>
          <div
            style={{
              background: "linear-gradient(135deg,#1a0800,#3d1200,#1a0800)",
              border: "2px solid rgba(255,107,0,0.4)",
              borderRadius: 20,
              padding: "24px 20px",
              marginBottom: 16,
              textAlign: "center",
              boxShadow: "0 0 40px rgba(255,107,0,0.2)",
            }}
          >
            <div style={{ fontSize: "3rem", marginBottom: 8 }}>🏟️</div>
            <div
              style={{
                fontFamily: "Orbitron, sans-serif",
                fontWeight: 900,
                fontSize: "1rem",
                color: "#fff",
                letterSpacing: "0.05em",
                marginBottom: 8,
              }}
            >
              WEEKLY TOURNAMENT
            </div>
            <div
              style={{
                fontFamily: "Rajdhani, sans-serif",
                fontSize: "0.85rem",
                color: "rgba(255,255,255,0.5)",
                marginBottom: 8,
              }}
            >
              Next Tournament In:
            </div>
            <div
              style={{
                fontFamily: "Orbitron, sans-serif",
                fontWeight: 900,
                fontSize: "1.4rem",
                color: "#ff6b00",
                marginBottom: 16,
              }}
            >
              {countdown}
            </div>
            <div
              style={{
                display: "flex",
                gap: 12,
                justifyContent: "center",
                marginBottom: 16,
              }}
            >
              {[
                { label: "Registration", value: "₹50", icon: "💰" },
                { label: "Prize Pool", value: "₹2000", icon: "🏆" },
                { label: "Max Players", value: "64", icon: "👥" },
              ].map((s) => (
                <div key={s.label} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "1.2rem" }}>{s.icon}</div>
                  <div
                    style={{
                      fontFamily: "Orbitron, sans-serif",
                      fontWeight: 700,
                      fontSize: "0.9rem",
                      color: "#fbbf24",
                    }}
                  >
                    {s.value}
                  </div>
                  <div
                    style={{
                      fontSize: "0.62rem",
                      color: "rgba(255,255,255,0.4)",
                      fontFamily: "Rajdhani, sans-serif",
                    }}
                  >
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              data-ocid="gamification.tournament_register.button"
              className="fire-btn"
            >
              🏟️ REGISTER NOW
            </button>
          </div>

          <div className="section-label" style={{ marginBottom: 10 }}>
            📋 Tournament Rules
          </div>
          <div
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 12,
              padding: "14px 16px",
            }}
          >
            {[
              "Single elimination bracket format",
              "Top 8 players receive prizes",
              "Admin assigns matches after registration",
              "No-shows forfeit their slot",
              "Results announced in announcements feed",
            ].map((rule, i) => (
              <div
                key={`rule-${i + 1}`}
                style={{
                  fontFamily: "Rajdhani, sans-serif",
                  fontSize: "0.82rem",
                  color: "rgba(255,255,255,0.7)",
                  marginBottom: 8,
                  display: "flex",
                  gap: 8,
                }}
              >
                <span style={{ color: "#ff6b00", flexShrink: 0 }}>
                  {i + 1}.
                </span>{" "}
                {rule}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="footer-text">
        © {new Date().getFullYear()}. Built with ❤️ using{" "}
        <a
          href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          caffeine.ai
        </a>
      </div>
    </motion.div>
  );
}
