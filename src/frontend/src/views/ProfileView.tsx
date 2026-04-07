// ProfileView.tsx — Full profile page for MR.SONIC FF
// Uses state-based routing (no react-router). Firebase via initFirebase().
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import {
  addDoc,
  collection,
  db,
  doc,
  getDoc,
  getDocs,
  initFirebase,
  orderBy,
  query,
  updateDoc,
  where,
} from "../firebase";

// ── Types ─────────────────────────────────────────────────────────────────────
interface ProfileProps {
  currentUser: string;
  userData: {
    uid: string;
    displayName: string;
    phone?: string;
    wins?: number;
    kills?: number;
    matchesPlayed?: number;
    coins?: number;
    clanId?: string;
    createdAt?: number;
    avatarColor?: string;
    vipTier?: "bronze" | "silver" | "gold";
    withdrawPin?: string;
    darkMode?: boolean;
    notifMatches?: boolean;
    notifDeposit?: boolean;
    notifAnnounce?: boolean;
    [key: string]: unknown;
  };
  coins: number;
  setView: (view: string) => void;
  logout: () => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const AVATAR_COLORS = [
  { name: "orange", hex: "#ff6b00" },
  { name: "purple", hex: "#8b5cf6" },
  { name: "blue", hex: "#3b82f6" },
  { name: "green", hex: "#22c55e" },
  { name: "red", hex: "#ef4444" },
  { name: "gold", hex: "#f59e0b" },
];

function getRankInfo(wins: number) {
  if (wins >= 50)
    return {
      label: "Master",
      color: "#f59e0b",
      glow: "rgba(245,158,11,0.5)",
      emoji: "👑",
    };
  if (wins >= 25)
    return {
      label: "Legend",
      color: "#8b5cf6",
      glow: "rgba(139,92,246,0.5)",
      emoji: "💜",
    };
  if (wins >= 10)
    return {
      label: "Elite",
      color: "#3b82f6",
      glow: "rgba(59,130,246,0.5)",
      emoji: "💎",
    };
  if (wins >= 3)
    return {
      label: "Warrior",
      color: "#22c55e",
      glow: "rgba(34,197,94,0.5)",
      emoji: "⚔️",
    };
  return {
    label: "Rookie",
    color: "#9ca3af",
    glow: "rgba(156,163,175,0.5)",
    emoji: "🛡️",
  };
}

function getVipInfo(tier?: string) {
  if (tier === "gold")
    return {
      label: "Gold VIP",
      color: "#f59e0b",
      bg: "linear-gradient(135deg,#78350f,#92400e)",
      border: "#f59e0b",
    };
  if (tier === "silver")
    return {
      label: "Silver VIP",
      color: "#e2e8f0",
      bg: "linear-gradient(135deg,#334155,#475569)",
      border: "#cbd5e1",
    };
  if (tier === "bronze")
    return {
      label: "Bronze VIP",
      color: "#d97706",
      bg: "linear-gradient(135deg,#431407,#7c2d12)",
      border: "#cd7f32",
    };
  return null;
}

function getPasswordStrength(pw: string): {
  level: number;
  label: string;
  color: string;
} {
  if (!pw) return { level: 0, label: "", color: "" };
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { level: 1, label: "Weak", color: "#ef4444" };
  if (score <= 2) return { level: 2, label: "Fair", color: "#f59e0b" };
  if (score <= 3) return { level: 3, label: "Good", color: "#3b82f6" };
  return { level: 4, label: "Strong", color: "#22c55e" };
}

function nextKillMilestone(kills: number) {
  const milestones = [10, 50, 100, 500];
  for (const m of milestones) if (kills < m) return m;
  return null;
}

// ── Achievements definition ───────────────────────────────────────────────────
function getAchievements(stats: {
  wins: number;
  kills: number;
  matchesPlayed: number;
  vipTier?: string;
}) {
  return [
    {
      id: "first-win",
      emoji: "🥇",
      label: "First Win",
      desc: "Win your first match",
      unlocked: stats.wins >= 1,
    },
    {
      id: "kill-machine",
      emoji: "🔫",
      label: "Kill Machine",
      desc: "10 total kills",
      unlocked: stats.kills >= 10,
    },
    {
      id: "hunter",
      emoji: "🎯",
      label: "Hunter",
      desc: "50 total kills",
      unlocked: stats.kills >= 50,
    },
    {
      id: "legend-killer",
      emoji: "💀",
      label: "Legend Killer",
      desc: "100 total kills",
      unlocked: stats.kills >= 100,
    },
    {
      id: "veteran",
      emoji: "🛡️",
      label: "Veteran",
      desc: "10 matches played",
      unlocked: stats.matchesPlayed >= 10,
    },
    {
      id: "champion",
      emoji: "⭐",
      label: "Champion",
      desc: "25 wins",
      unlocked: stats.wins >= 25,
    },
    {
      id: "vip-member",
      emoji: "👑",
      label: "VIP Member",
      desc: "VIP tier unlocked",
      unlocked: !!stats.vipTier,
    },
    {
      id: "squad-leader",
      emoji: "🎖️",
      label: "Squad Leader",
      desc: "5 squad wins",
      unlocked: stats.wins >= 5,
    },
  ];
}

// ── Rules content ──────────────────────────────────────────────────────────────
const RULES = [
  {
    num: "01",
    text: "Fair play only — cheating, hacking, or exploiting bugs results in permanent ban without refund.",
  },
  {
    num: "02",
    text: "Each player may only use one account. Multi-account abuse leads to all accounts being banned.",
  },
  {
    num: "03",
    text: "Entry fees are non-refundable once a match is started. If admin cancels, coins are returned.",
  },
  {
    num: "04",
    text: "Room ID and Password are confidential. Sharing credentials leads to disqualification.",
  },
  {
    num: "05",
    text: "Results are based on kills and survival. Admin decision is final and non-disputable.",
  },
  {
    num: "06",
    text: "Withdrawals are processed manually. Minimum withdrawal is ₹100. Service charge applies.",
  },
  {
    num: "07",
    text: "Admin reserves the right to modify prize pools, entry fees, and rules at any time.",
  },
  {
    num: "08",
    text: "No-show players forfeit entry fees. Late join after room start = disqualification.",
  },
  {
    num: "09",
    text: "False UPI IDs or fraudulent payment reports result in permanent account suspension.",
  },
  {
    num: "10",
    text: "By playing, you agree to all MR.SONIC FF terms, conditions, and admin authority.",
  },
];

// ── Main Component ─────────────────────────────────────────────────────────────
export default function ProfileView({
  currentUser,
  userData,
  coins,
  setView,
  logout,
}: ProfileProps) {
  const [avatarColor, setAvatarColor] = useState(
    userData.avatarColor || "#ff6b00",
  );
  const [displayName, setDisplayName] = useState(userData.displayName || "");
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(userData.displayName || "");

  // Password change
  const [oldPass, setOldPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [changingPass, setChangingPass] = useState(false);

  // Withdrawal PIN
  const [withdrawPin, setWithdrawPin] = useState("");
  const [pinInput, setPinInput] = useState("");
  const [settingPin, setSettingPin] = useState(false);

  // Notifications toggle
  const [notifMatches, setNotifMatches] = useState(
    userData.notifMatches !== false,
  );
  const [notifDeposit, setNotifDeposit] = useState(
    userData.notifDeposit !== false,
  );
  const [notifAnnounce, setNotifAnnounce] = useState(
    userData.notifAnnounce !== false,
  );

  // Match history
  const [recentMatches, setRecentMatches] = useState<
    {
      id: string;
      mode: string;
      result: string;
      kills: number;
      prize: number;
      ts: number;
    }[]
  >([]);

  // Clan
  const [clanName, setClanName] = useState<string | null>(null);

  // Rules modal
  const [showRules, setShowRules] = useState(false);

  // Logout confirm
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Deletion request
  const [showDeleteInfo, setShowDeleteInfo] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  // Dark mode state (read from body)
  const [isDark, setIsDark] = useState(
    () => !document.body.classList.contains("light-mode"),
  );

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  // Derived stats
  const wins = userData.wins ?? 0;
  const kills = userData.kills ?? 0;
  const matchesPlayed = userData.matchesPlayed ?? 0;
  const kd = matchesPlayed > 0 ? (kills / matchesPlayed).toFixed(2) : "0.00";
  const winRate =
    matchesPlayed > 0 ? ((wins / matchesPlayed) * 100).toFixed(1) : "0.0";
  const rank = getRankInfo(wins);
  const vip = getVipInfo(userData.vipTier as string | undefined);
  const achievements = getAchievements({
    wins,
    kills,
    matchesPlayed,
    vipTier: userData.vipTier as string | undefined,
  });
  const nextMilestone = nextKillMilestone(kills);
  const milestoneProgress = nextMilestone
    ? Math.min(100, (kills / nextMilestone) * 100)
    : 100;
  const isAdmin = currentUser === "admin";
  const pwStrength = getPasswordStrength(newPass);
  const accountAge = userData.createdAt
    ? Math.floor(
        (Date.now() - Number(userData.createdAt)) / (1000 * 60 * 60 * 24),
      )
    : 0;

  // Load data on mount
  useEffect(() => {
    const load = async () => {
      await initFirebase();

      // Recent matches
      try {
        const q = query(
          collection(db, "matches"),
          where("player", "==", currentUser),
          orderBy("timestamp", "desc"),
        );
        const snap = await getDocs(q);
        const rows = snap.docs.slice(0, 5).map((d) => {
          const data = d.data();
          return {
            id: d.id,
            mode: data.mode || "Match",
            result:
              data.status === "completed"
                ? data.winner === currentUser
                  ? "Win"
                  : "Loss"
                : data.status,
            kills: data.kills ?? 0,
            prize: data.prizeAwarded ?? 0,
            ts: data.timestamp?.toMillis?.() ?? Date.now(),
          };
        });
        setRecentMatches(rows);
      } catch (_) {}

      // Clan name
      if (userData.clanId) {
        try {
          const cSnap = await getDoc(doc(db, "clans", userData.clanId));
          if (cSnap.exists()) setClanName(cSnap.data().name || "Clan");
        } catch (_) {}
      }

      // Withdrawal PIN
      try {
        const uSnap = await getDoc(doc(db, "users", currentUser));
        if (uSnap.exists()) {
          const d = uSnap.data();
          if (d.withdrawPin) setWithdrawPin(d.withdrawPin);
          if (d.avatarColor) setAvatarColor(d.avatarColor);
        }
      } catch (_) {}
    };
    load();
  }, [currentUser, userData.clanId]);

  // Save avatar color
  const saveAvatarColor = async (color: string) => {
    setAvatarColor(color);
    try {
      await updateDoc(doc(db, "users", currentUser), { avatarColor: color });
    } catch (_) {}
  };

  // Save display name
  const saveName = async () => {
    if (!nameInput.trim()) return;
    try {
      await updateDoc(doc(db, "users", currentUser), {
        displayName: nameInput.trim(),
      });
      setDisplayName(nameInput.trim());
      setEditingName(false);
      showToast("Name updated!");
    } catch (_) {
      showToast("Failed to update name", false);
    }
  };

  // Change password
  const changePassword = async () => {
    if (!oldPass || !newPass || !confirmPass) {
      showToast("Fill all fields", false);
      return;
    }
    if (newPass !== confirmPass) {
      showToast("Passwords don't match", false);
      return;
    }
    if (newPass.length < 6) {
      showToast("Password must be 6+ chars", false);
      return;
    }
    setChangingPass(true);
    try {
      const snap = await getDoc(doc(db, "users", currentUser));
      if (!snap.exists() || snap.data().pass !== oldPass) {
        showToast("Old password incorrect", false);
        return;
      }
      await updateDoc(doc(db, "users", currentUser), { pass: newPass });
      setOldPass("");
      setNewPass("");
      setConfirmPass("");
      showToast("Password changed!");
    } catch (_) {
      showToast("Error changing password", false);
    } finally {
      setChangingPass(false);
    }
  };

  // Save withdrawal PIN
  const savePin = async () => {
    if (pinInput.length !== 6 || !/^\d{6}$/.test(pinInput)) {
      showToast("PIN must be exactly 6 digits", false);
      return;
    }
    setSettingPin(true);
    try {
      await updateDoc(doc(db, "users", currentUser), { withdrawPin: pinInput });
      setWithdrawPin(pinInput);
      setPinInput("");
      showToast("Withdrawal PIN saved!");
    } catch (_) {
      showToast("Failed to save PIN", false);
    } finally {
      setSettingPin(false);
    }
  };

  // Toggle dark mode
  const toggleDarkMode = () => {
    const next = !isDark;
    setIsDark(next);
    document.body.classList.toggle("light-mode", !next);
    localStorage.setItem("ff_darkmode", String(next));
  };

  // Save notification prefs
  const saveNotifPref = async (key: string, val: boolean) => {
    try {
      await updateDoc(doc(db, "users", currentUser), { [key]: val });
    } catch (_) {}
  };

  // Leave clan
  const leaveClan = async () => {
    if (!userData.clanId) return;
    try {
      await updateDoc(doc(db, "users", currentUser), { clanId: null });
      setClanName(null);
      showToast("Left clan");
    } catch (_) {
      showToast("Error leaving clan", false);
    }
  };

  // Request account deletion
  const requestDeletion = async () => {
    try {
      await addDoc(collection(db, "deletionRequests"), {
        uid: currentUser,
        requestedAt: Date.now(),
        status: "pending",
      });
      showToast("Deletion request sent. Admin will review.");
      setShowDeleteInfo(false);
    } catch (_) {
      showToast("Failed to send request", false);
    }
  };

  return (
    <div className="main-content" data-ocid="profile.view">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            style={{
              position: "fixed",
              top: 72,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 999,
              background: toast.ok
                ? "rgba(20,50,30,0.97)"
                : "rgba(50,15,15,0.97)",
              border: `1px solid ${toast.ok ? "rgba(34,197,94,0.5)" : "rgba(239,68,68,0.5)"}`,
              color: "white",
              padding: "10px 20px",
              borderRadius: 12,
              fontFamily: "Rajdhani, sans-serif",
              fontWeight: 700,
              fontSize: "0.88rem",
              boxShadow: "0 6px 24px rgba(0,0,0,0.4)",
              backdropFilter: "blur(12px)",
              maxWidth: "88%",
              textAlign: "center",
            }}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rules Modal */}
      <AnimatePresence>
        {showRules && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowRules(false)}
            data-ocid="profile.rules_modal"
          >
            <motion.div
              className="modal-sheet"
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              style={{ maxHeight: "80vh", overflowY: "auto" }}
            >
              <div className="modal-handle" />
              <div className="modal-title">📋 Rules & Regulations</div>
              <ul className="rules-list">
                {RULES.map((r) => (
                  <li key={r.num}>
                    <span className="rules-num">{r.num}</span>
                    <span>{r.text}</span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="fire-btn"
                style={{ marginTop: 16 }}
                onClick={() => setShowRules(false)}
                data-ocid="profile.rules_close"
              >
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Logout Confirm Modal */}
      <AnimatePresence>
        {showLogoutConfirm && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowLogoutConfirm(false)}
            data-ocid="profile.logout_modal"
          >
            <motion.div
              className="modal-sheet"
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-handle" />
              <div style={{ textAlign: "center", marginBottom: 16 }}>
                <div style={{ fontSize: "2.5rem", marginBottom: 8 }}>🚪</div>
                <div className="modal-title" style={{ marginBottom: 6 }}>
                  Logout?
                </div>
                <div
                  style={{
                    color: "rgba(255,255,255,0.55)",
                    fontSize: "0.85rem",
                    fontFamily: "Rajdhani, sans-serif",
                  }}
                >
                  Are you sure you want to logout from MR.SONIC FF?
                </div>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  type="button"
                  className="fire-btn fire-btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => setShowLogoutConfirm(false)}
                  data-ocid="profile.logout_cancel"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="fire-btn fire-btn-danger"
                  style={{ flex: 1 }}
                  onClick={() => {
                    setShowLogoutConfirm(false);
                    logout();
                  }}
                  data-ocid="profile.logout_confirm"
                >
                  Logout
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Profile Header ─────────────────────────────────────────────── */}
      <motion.div
        className="profile-header"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        data-ocid="profile.header"
      >
        {/* Avatar */}
        <motion.div
          className="avatar"
          style={{
            background: `radial-gradient(circle at 35% 35%, ${avatarColor}cc, ${avatarColor}66)`,
            borderColor: avatarColor,
            boxShadow: `0 0 20px ${avatarColor}66, 0 0 40px ${avatarColor}33`,
            width: 80,
            height: 80,
            fontSize: "1.8rem",
          }}
          whileTap={{ scale: 0.95 }}
        >
          {(displayName || userData.displayName || currentUser)
            .charAt(0)
            .toUpperCase()}
        </motion.div>

        {/* Color Picker */}
        <div
          style={{
            display: "flex",
            gap: 8,
            margin: "10px 0 6px",
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          {AVATAR_COLORS.map((c) => (
            <button
              key={c.name}
              type="button"
              className={`color-swatch${avatarColor === c.hex ? " selected" : ""}`}
              style={{ background: c.hex }}
              onClick={() => saveAvatarColor(c.hex)}
              aria-label={`Set avatar color to ${c.name}`}
              data-ocid={`profile.avatar_color_${c.name}`}
            />
          ))}
        </div>

        {/* Name */}
        {editingName ? (
          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              margin: "6px 0",
            }}
          >
            <input
              className="fire-input"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveName()}
              style={{ padding: "7px 12px", fontSize: "0.9rem", maxWidth: 180 }}
              data-ocid="profile.name_input"
            />
            <button
              type="button"
              className="fire-btn"
              style={{ padding: "7px 14px", fontSize: "0.72rem" }}
              onClick={saveName}
              data-ocid="profile.save_name"
            >
              Save
            </button>
            <button
              type="button"
              className="fire-btn fire-btn-secondary"
              style={{ padding: "7px 10px", fontSize: "0.72rem" }}
              onClick={() => {
                setEditingName(false);
                setNameInput(displayName);
              }}
            >
              ✕
            </button>
          </div>
        ) : (
          <button
            type="button"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
            onClick={() => setEditingName(true)}
            data-ocid="profile.edit_name"
          >
            <div className="profile-name">{displayName}</div>
            <span style={{ fontSize: "0.7rem", color: "rgba(255,107,0,0.7)" }}>
              ✏️
            </span>
          </button>
        )}

        <div className="profile-uid" style={{ marginBottom: 8 }}>
          UID: {currentUser}
        </div>

        {/* Admin-only phone display */}
        {isAdmin && userData.phone && (
          <div
            style={{
              background: "rgba(255,107,0,0.1)",
              border: "1px solid rgba(255,107,0,0.3)",
              borderRadius: 8,
              padding: "5px 12px",
              fontSize: "0.8rem",
              fontFamily: "Rajdhani, sans-serif",
              color: "rgba(255,255,255,0.7)",
              marginBottom: 6,
            }}
          >
            📱 {userData.phone}
          </div>
        )}

        {/* Rank Badge */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: `${rank.color}22`,
            border: `1.5px solid ${rank.color}66`,
            borderRadius: 20,
            padding: "5px 14px",
            marginBottom: 6,
            boxShadow: `0 0 12px ${rank.glow}`,
          }}
        >
          <span>{rank.emoji}</span>
          <span
            style={{
              fontFamily: "Orbitron, sans-serif",
              fontSize: "0.72rem",
              fontWeight: 700,
              color: rank.color,
              letterSpacing: "0.08em",
            }}
          >
            {rank.label}
          </span>
        </div>

        {/* VIP Badge */}
        {vip && (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              background: vip.bg,
              border: `1.5px solid ${vip.border}`,
              borderRadius: 20,
              padding: "4px 12px",
              marginBottom: 6,
              marginLeft: 6,
            }}
          >
            <span
              style={{
                fontFamily: "Orbitron, sans-serif",
                fontSize: "0.68rem",
                fontWeight: 700,
                color: vip.color,
              }}
            >
              👑 {vip.label}
            </span>
          </div>
        )}

        {/* Account age */}
        {accountAge > 0 && (
          <div
            style={{
              fontSize: "0.75rem",
              color: "rgba(255,255,255,0.35)",
              fontFamily: "Rajdhani, sans-serif",
              marginTop: 2,
            }}
          >
            Member for {accountAge} day{accountAge !== 1 ? "s" : ""}
          </div>
        )}
      </motion.div>

      {/* ── Stats Grid ─────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}
      >
        <div className="section-label" style={{ marginBottom: 10 }}>
          📊 Stats
        </div>
        <div
          className="stat-grid"
          style={{
            gridTemplateColumns: "repeat(3,1fr)",
            gap: 8,
            marginBottom: 14,
          }}
          data-ocid="profile.stats_grid"
        >
          {[
            { label: "Matches", value: matchesPlayed },
            { label: "Wins", value: wins },
            { label: "Kills", value: kills },
            { label: "K/D", value: kd },
            { label: "Win Rate", value: `${winRate}%` },
            { label: "Balance", value: `₹${coins}` },
          ].map((s) => (
            <div key={s.label} className="stat-card">
              <div className="stat-value">{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* ── Kill Milestone Progress ──────────────────────────────────────── */}
      {nextMilestone && (
        <motion.div
          className="card card-glow"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.4 }}
          style={{ marginBottom: 14 }}
          data-ocid="profile.kill_milestone"
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 8,
            }}
          >
            <span
              style={{
                fontFamily: "Orbitron, sans-serif",
                fontSize: "0.75rem",
                color: "white",
                fontWeight: 700,
              }}
            >
              💥 Kill Progress
            </span>
            <span
              style={{
                fontSize: "0.75rem",
                color: "rgba(255,255,255,0.5)",
                fontFamily: "Rajdhani, sans-serif",
              }}
            >
              {kills}/{nextMilestone}
            </span>
          </div>
          <div
            style={{
              height: 8,
              background: "rgba(255,107,0,0.15)",
              borderRadius: 4,
              overflow: "hidden",
            }}
          >
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${milestoneProgress}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              style={{
                height: "100%",
                background: "linear-gradient(90deg,#ff6b00,#ffaa00)",
                borderRadius: 4,
              }}
            />
          </div>
          <div
            style={{
              fontSize: "0.72rem",
              color: "rgba(255,255,255,0.4)",
              fontFamily: "Rajdhani, sans-serif",
              marginTop: 6,
            }}
          >
            {nextMilestone - kills} kills until next milestone badge
          </div>
        </motion.div>
      )}

      {/* ── Achievements ─────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
      >
        <div className="section-label" style={{ marginBottom: 10 }}>
          🏆 Achievements
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4,1fr)",
            gap: 8,
            marginBottom: 14,
          }}
          data-ocid="profile.achievements_grid"
        >
          {achievements.map((a) => (
            <motion.div
              key={a.id}
              whileTap={{ scale: 0.92 }}
              style={{
                background: a.unlocked
                  ? "rgba(255,107,0,0.12)"
                  : "rgba(255,255,255,0.03)",
                border: `1.5px solid ${a.unlocked ? "rgba(255,107,0,0.5)" : "rgba(255,255,255,0.08)"}`,
                borderRadius: 12,
                padding: "10px 6px",
                textAlign: "center",
                opacity: a.unlocked ? 1 : 0.4,
                boxShadow: a.unlocked ? "0 0 10px rgba(255,107,0,0.2)" : "none",
                transition: "all 0.2s",
              }}
              title={a.desc}
            >
              <div style={{ fontSize: "1.4rem", marginBottom: 4 }}>
                {a.emoji}
              </div>
              <div
                style={{
                  fontSize: "0.58rem",
                  fontFamily: "Rajdhani, sans-serif",
                  fontWeight: 700,
                  color: a.unlocked ? "white" : "rgba(255,255,255,0.4)",
                  textTransform: "uppercase",
                  letterSpacing: "0.03em",
                  lineHeight: 1.2,
                }}
              >
                {a.label}
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* ── Recent Match History ─────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.4 }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 10,
          }}
        >
          <div className="section-label" style={{ marginBottom: 0 }}>
            🎮 Recent Matches
          </div>
          <button
            type="button"
            style={{
              fontSize: "0.75rem",
              color: "#ff6b00",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontFamily: "Rajdhani, sans-serif",
              fontWeight: 700,
            }}
            onClick={() => setView("match-history")}
            data-ocid="profile.view_all_history"
          >
            View All →
          </button>
        </div>
        {recentMatches.length === 0 ? (
          <div
            className="empty-state"
            style={{ padding: "20px", opacity: 0.5 }}
          >
            <div style={{ fontSize: "1.5rem", marginBottom: 4 }}>🎮</div>
            <div className="empty-state-text">No matches yet — join one!</div>
          </div>
        ) : (
          <div
            style={{ marginBottom: 14 }}
            data-ocid="profile.match_history_list"
          >
            {recentMatches.map((m) => (
              <div
                key={m.id}
                className="list-item flex-between"
                style={{ padding: "10px 14px" }}
              >
                <div>
                  <div
                    style={{
                      fontSize: "0.85rem",
                      color: "white",
                      fontWeight: 600,
                      fontFamily: "Rajdhani, sans-serif",
                    }}
                  >
                    {m.mode}
                  </div>
                  <div
                    style={{
                      fontSize: "0.72rem",
                      color: "rgba(255,255,255,0.4)",
                      fontFamily: "Rajdhani, sans-serif",
                    }}
                  >
                    {m.kills} kills
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div
                    style={{
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      fontFamily: "Rajdhani, sans-serif",
                      color:
                        m.result === "Win"
                          ? "#22c55e"
                          : m.result === "Loss"
                            ? "#ef4444"
                            : "rgba(255,255,255,0.5)",
                    }}
                  >
                    {m.result}
                  </div>
                  {m.prize > 0 && (
                    <div
                      style={{
                        fontSize: "0.7rem",
                        color: "#22c55e",
                        fontFamily: "Rajdhani, sans-serif",
                      }}
                    >
                      +₹{m.prize}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* ── Clan Info ─────────────────────────────────────────────────────── */}
      <motion.div
        className="card"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
        data-ocid="profile.clan_section"
      >
        <div className="section-label" style={{ marginBottom: 10 }}>
          ⚔️ Clan
        </div>
        {clanName ? (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "0.95rem",
                  fontWeight: 600,
                  color: "white",
                  fontFamily: "Rajdhani, sans-serif",
                }}
              >
                🛡️ {clanName}
              </div>
              <div
                style={{
                  fontSize: "0.72rem",
                  color: "rgba(255,255,255,0.4)",
                  fontFamily: "Rajdhani, sans-serif",
                  marginTop: 2,
                }}
              >
                Active member
              </div>
            </div>
            <button
              type="button"
              className="fire-btn fire-btn-danger"
              style={{ padding: "6px 14px", fontSize: "0.72rem" }}
              onClick={leaveClan}
              data-ocid="profile.leave_clan"
            >
              Leave
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="fire-btn"
              style={{ flex: 1, fontSize: "0.75rem", padding: "9px" }}
              onClick={() => setView("clans")}
              data-ocid="profile.join_clan"
            >
              🛡️ Join Clan
            </button>
            <button
              type="button"
              className="fire-btn fire-btn-secondary"
              style={{ flex: 1, fontSize: "0.75rem", padding: "9px" }}
              onClick={() => setView("clans")}
              data-ocid="profile.create_clan"
            >
              ➕ Create Clan
            </button>
          </div>
        )}
      </motion.div>

      {/* ── Settings ─────────────────────────────────────────────────────── */}
      <motion.div
        className="card"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.4 }}
        data-ocid="profile.settings_section"
      >
        <div className="section-label" style={{ marginBottom: 14 }}>
          ⚙️ Settings
        </div>

        {/* Dark/Light mode */}
        <div
          className="flex-between"
          style={{
            marginBottom: 16,
            paddingBottom: 14,
            borderBottom: "1px solid rgba(255,107,0,0.12)",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "0.88rem",
                color: "white",
                fontFamily: "Rajdhani, sans-serif",
                fontWeight: 600,
              }}
            >
              {isDark ? "🌙 Dark Mode" : "☀️ Light Mode"}
            </div>
            <div
              style={{
                fontSize: "0.72rem",
                color: "rgba(255,255,255,0.4)",
                fontFamily: "Rajdhani, sans-serif",
              }}
            >
              Toggle app theme
            </div>
          </div>
          <button
            type="button"
            onClick={toggleDarkMode}
            data-ocid="profile.toggle_theme"
            style={{
              width: 44,
              height: 24,
              borderRadius: 12,
              border: "none",
              cursor: "pointer",
              position: "relative",
              background: isDark ? "#ff6b00" : "rgba(255,255,255,0.2)",
              transition: "all 0.25s",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 2,
                left: isDark ? 22 : 2,
                width: 20,
                height: 20,
                borderRadius: "50%",
                background: "white",
                transition: "left 0.25s",
              }}
            />
          </button>
        </div>

        {/* Notifications */}
        <div
          style={{
            marginBottom: 14,
            paddingBottom: 14,
            borderBottom: "1px solid rgba(255,107,0,0.12)",
          }}
        >
          <div
            style={{
              fontSize: "0.82rem",
              color: "rgba(255,255,255,0.6)",
              fontFamily: "Rajdhani, sans-serif",
              marginBottom: 10,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            🔔 Notifications
          </div>
          {[
            {
              label: "Match Updates",
              key: "notifMatches",
              val: notifMatches,
              set: (v: boolean) => {
                setNotifMatches(v);
                saveNotifPref("notifMatches", v);
              },
            },
            {
              label: "Deposits/Withdrawals",
              key: "notifDeposit",
              val: notifDeposit,
              set: (v: boolean) => {
                setNotifDeposit(v);
                saveNotifPref("notifDeposit", v);
              },
            },
            {
              label: "Announcements",
              key: "notifAnnounce",
              val: notifAnnounce,
              set: (v: boolean) => {
                setNotifAnnounce(v);
                saveNotifPref("notifAnnounce", v);
              },
            },
          ].map((n) => (
            <div
              key={n.key}
              className="flex-between"
              style={{ marginBottom: 10 }}
              data-ocid={`profile.notif_${n.key}`}
            >
              <span
                style={{
                  fontSize: "0.85rem",
                  color: "rgba(255,255,255,0.75)",
                  fontFamily: "Rajdhani, sans-serif",
                }}
              >
                {n.label}
              </span>
              <button
                type="button"
                onClick={() => n.set(!n.val)}
                style={{
                  width: 40,
                  height: 22,
                  borderRadius: 11,
                  border: "none",
                  cursor: "pointer",
                  position: "relative",
                  background: n.val ? "#ff6b00" : "rgba(255,255,255,0.15)",
                  transition: "all 0.2s",
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: 2,
                    left: n.val ? 19 : 2,
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    background: "white",
                    transition: "left 0.2s",
                  }}
                />
              </button>
            </div>
          ))}
        </div>

        {/* Change display name */}
        <div
          style={{
            marginBottom: 14,
            paddingBottom: 14,
            borderBottom: "1px solid rgba(255,107,0,0.12)",
          }}
        >
          <div
            style={{
              fontSize: "0.82rem",
              color: "rgba(255,255,255,0.6)",
              fontFamily: "Rajdhani, sans-serif",
              marginBottom: 10,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            ✏️ Display Name
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              className="fire-input"
              placeholder="New display name"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              style={{ flex: 1 }}
              data-ocid="profile.display_name_input"
            />
            <button
              type="button"
              className="fire-btn"
              style={{ padding: "0 18px", fontSize: "0.75rem" }}
              onClick={saveName}
              data-ocid="profile.save_display_name"
            >
              Save
            </button>
          </div>
        </div>

        {/* Change Password */}
        <div style={{ marginBottom: 0 }}>
          <div
            style={{
              fontSize: "0.82rem",
              color: "rgba(255,255,255,0.6)",
              fontFamily: "Rajdhani, sans-serif",
              marginBottom: 10,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            🔑 Change Password
          </div>
          <div className="field-group" style={{ marginBottom: 8 }}>
            <input
              className="fire-input"
              type="password"
              placeholder="Current password"
              value={oldPass}
              onChange={(e) => setOldPass(e.target.value)}
              data-ocid="profile.old_password_input"
            />
          </div>
          <div className="field-group" style={{ marginBottom: 8 }}>
            <input
              className="fire-input"
              type="password"
              placeholder="New password"
              value={newPass}
              onChange={(e) => setNewPass(e.target.value)}
              data-ocid="profile.new_password_input"
            />
            {newPass && (
              <div style={{ marginTop: 4 }}>
                <div style={{ display: "flex", gap: 3, marginBottom: 3 }}>
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      style={{
                        flex: 1,
                        height: 4,
                        borderRadius: 2,
                        background:
                          i <= pwStrength.level
                            ? pwStrength.color
                            : "rgba(255,255,255,0.1)",
                        transition: "background 0.2s",
                      }}
                    />
                  ))}
                </div>
                <div
                  style={{
                    fontSize: "0.68rem",
                    color: pwStrength.color,
                    fontFamily: "Rajdhani, sans-serif",
                  }}
                >
                  {pwStrength.label}
                </div>
              </div>
            )}
          </div>
          <div className="field-group" style={{ marginBottom: 10 }}>
            <input
              className="fire-input"
              type="password"
              placeholder="Confirm new password"
              value={confirmPass}
              onChange={(e) => setConfirmPass(e.target.value)}
              data-ocid="profile.confirm_password_input"
            />
          </div>
          <button
            type="button"
            className="fire-btn fire-btn-secondary"
            disabled={changingPass}
            onClick={changePassword}
            data-ocid="profile.change_password_submit"
            style={{ fontSize: "0.78rem" }}
          >
            {changingPass ? "Changing..." : "Change Password"}
          </button>
        </div>
      </motion.div>

      {/* ── Rules & Regulations Button ──────────────────────────────────── */}
      <motion.button
        type="button"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.35 }}
        onClick={() => setShowRules(true)}
        data-ocid="profile.rules_button"
        style={{
          width: "100%",
          padding: "13px",
          marginBottom: 14,
          background: "transparent",
          border: "1.5px solid #ff6b00",
          borderRadius: 10,
          color: "white",
          fontFamily: "Orbitron, sans-serif",
          fontSize: "0.75rem",
          fontWeight: 700,
          cursor: "pointer",
          letterSpacing: "0.05em",
          transition: "all 0.2s",
        }}
      >
        📋 View Rules & Regulations
      </motion.button>

      {/* ── Security ─────────────────────────────────────────────────────── */}
      <motion.div
        className="card"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45, duration: 0.4 }}
        data-ocid="profile.security_section"
      >
        <div className="section-label" style={{ marginBottom: 14 }}>
          🔒 Security
        </div>

        {/* Withdrawal PIN */}
        <div
          style={{
            marginBottom: 14,
            paddingBottom: 14,
            borderBottom: "1px solid rgba(255,107,0,0.12)",
          }}
        >
          <div
            style={{
              fontSize: "0.82rem",
              color: "rgba(255,255,255,0.6)",
              fontFamily: "Rajdhani, sans-serif",
              marginBottom: 8,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            💳 Withdrawal PIN{" "}
            {withdrawPin ? (
              <span style={{ color: "#22c55e" }}>● Set</span>
            ) : (
              <span style={{ color: "#ef4444" }}>● Not Set</span>
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              className="fire-input"
              type="password"
              inputMode="numeric"
              maxLength={6}
              placeholder="Set 6-digit PIN"
              value={pinInput}
              onChange={(e) =>
                setPinInput(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              style={{ flex: 1, letterSpacing: "0.2em" }}
              data-ocid="profile.pin_input"
            />
            <button
              type="button"
              className="fire-btn"
              disabled={settingPin}
              onClick={savePin}
              style={{ padding: "0 16px", fontSize: "0.72rem" }}
              data-ocid="profile.save_pin"
            >
              {settingPin ? "..." : withdrawPin ? "Update" : "Set"}
            </button>
          </div>
          <div
            style={{
              fontSize: "0.7rem",
              color: "rgba(255,255,255,0.35)",
              fontFamily: "Rajdhani, sans-serif",
              marginTop: 5,
            }}
          >
            Required for withdrawals above ₹200
          </div>
        </div>

        {/* Session info */}
        <div
          style={{
            fontSize: "0.8rem",
            color: "rgba(255,255,255,0.5)",
            fontFamily: "Rajdhani, sans-serif",
          }}
        >
          📱 Session active · Last login from this device
          <div
            style={{
              marginTop: 4,
              fontSize: "0.72rem",
              color: "rgba(255,255,255,0.3)",
            }}
          >
            UID: {currentUser} · Secured by MR.SONIC FF
          </div>
        </div>
      </motion.div>

      {/* ── Logout Button ────────────────────────────────────────────────── */}
      <motion.button
        type="button"
        className="fire-btn fire-btn-danger"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.35 }}
        whileTap={{ scale: 0.97 }}
        onClick={() => setShowLogoutConfirm(true)}
        data-ocid="profile.logout_button"
        style={{
          fontSize: "0.85rem",
          marginBottom: 10,
          letterSpacing: "0.1em",
        }}
      >
        🚪 LOGOUT
      </motion.button>

      {/* ── Account Deletion ─────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.55, duration: 0.35 }}
        style={{ textAlign: "center", paddingBottom: 8 }}
      >
        {!showDeleteInfo ? (
          <button
            type="button"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: "0.75rem",
              color: "rgba(255,255,255,0.25)",
              fontFamily: "Rajdhani, sans-serif",
              textDecoration: "underline",
            }}
            onClick={() => setShowDeleteInfo(true)}
            data-ocid="profile.delete_account_link"
          >
            Request account deletion
          </button>
        ) : (
          <div className="card" style={{ textAlign: "left", marginTop: 8 }}>
            <div
              style={{
                fontSize: "0.82rem",
                color: "white",
                fontFamily: "Rajdhani, sans-serif",
                marginBottom: 8,
                fontWeight: 600,
              }}
            >
              ⚠️ Account Deletion
            </div>
            <div
              style={{
                fontSize: "0.78rem",
                color: "rgba(255,255,255,0.55)",
                fontFamily: "Rajdhani, sans-serif",
                marginBottom: 12,
                lineHeight: 1.5,
              }}
            >
              Deleting your account will permanently remove all your data,
              balance, and match history. This action cannot be undone. A
              request will be sent to admin for review.
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="fire-btn fire-btn-secondary"
                style={{ flex: 1, fontSize: "0.75rem" }}
                onClick={() => setShowDeleteInfo(false)}
                data-ocid="profile.delete_cancel"
              >
                Cancel
              </button>
              <button
                type="button"
                className="fire-btn fire-btn-danger"
                style={{ flex: 1, fontSize: "0.75rem" }}
                onClick={requestDeletion}
                data-ocid="profile.delete_confirm"
              >
                Send Request
              </button>
            </div>
          </div>
        )}
      </motion.div>

      {/* Footer spacer */}
      <div style={{ height: 16 }} />
    </div>
  );
}
