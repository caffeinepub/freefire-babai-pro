// @ts-nocheck
/* eslint-disable */
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  addDoc,
  collection,
  db,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  initFirebase,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "../firebase";

// ─── Types ────────────────────────────────────────────────────────────────────
type AdminTab =
  | "dashboard"
  | "users"
  | "matches"
  | "deposits"
  | "withdrawals"
  | "revenue"
  | "announcements"
  | "messagebox"
  | "reports";

interface AdminUser {
  uid: string;
  displayName: string;
  phone: string;
  coins: number;
  wins: number;
  kills: number;
  matchesPlayed: number;
  blocked: boolean;
  banReason?: string;
  fcmToken?: string;
  kycVerified?: boolean;
  ipNote?: string;
  vipTier?: string;
  createdAt?: number;
  lastLogin?: number;
}

interface AdminMatch {
  id: string;
  mode: string;
  customTitle?: string;
  status: string;
  entryFee: number;
  prizePool: number;
  perKill?: number;
  maxPlayers?: number;
  players?: string[];
  roomId?: string;
  roomPass?: string;
  voiceLink?: string;
  isVisible?: boolean;
  scheduleTime?: string;
  winner?: string;
  timestamp?: unknown;
}

interface Deposit {
  id: string;
  user: string;
  amount: number;
  utr: string;
  status: string;
  timestamp?: unknown;
}

interface Withdrawal {
  id: string;
  user: string;
  amount: number;
  upiId: string;
  status: string;
  timestamp?: unknown;
}

interface Report {
  id: string;
  reporterUid: string;
  reportedUid: string;
  reason: string;
  timestamp?: unknown;
}

const GAME_MODES = [
  "BR Solo",
  "BR Duo",
  "BR Squad",
  "Clash Squad",
  "Squad 4v4",
  "1v1 Custom",
];

const EMOJIS = [
  "🔥",
  "⚡",
  "🏆",
  "💀",
  "⚔️",
  "🎯",
  "💥",
  "🚀",
  "👑",
  "🎮",
  "💰",
  "⭐",
  "🛡️",
  "🎁",
  "📢",
  "⚠️",
  "✅",
  "❌",
  "🔴",
  "🟢",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtTime(ts: unknown): string {
  if (!ts) return "—";
  try {
    const d =
      ts instanceof Date
        ? ts
        : new Date(
            (ts as any)?.seconds ? (ts as any).seconds * 1000 : Number(ts),
          );
    return d.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function vipColor(tier?: string): string {
  if (tier === "Gold") return "#ffd700";
  if (tier === "Silver") return "#c0c0c0";
  if (tier === "Bronze") return "#cd7f32";
  return "rgba(255,255,255,0.4)";
}

// getVipTier is available for future use
function _getVipTier(totalDeposited: number): string {
  if (totalDeposited >= 5000) return "Gold";
  if (totalDeposited >= 2000) return "Silver";
  if (totalDeposited >= 500) return "Bronze";
  return "None";
}
void _getVipTier;

// ─── Mini Components ─────────────────────────────────────────────────────────
function StatWidget({
  label,
  value,
  icon,
  color = "#ff6b00",
  sub,
}: {
  label: string;
  value: string | number;
  icon: string;
  color?: string;
  sub?: string;
}) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.04)",
        border: `1px solid ${color}40`,
        borderRadius: 12,
        padding: "12px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <div style={{ fontSize: "1.3rem" }}>{icon}</div>
      <div
        style={{
          fontFamily: "Orbitron, sans-serif",
          fontSize: "1.1rem",
          fontWeight: 700,
          color,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: "0.7rem",
          color: "rgba(255,255,255,0.5)",
          fontFamily: "Rajdhani, sans-serif",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {label}
      </div>
      {sub && (
        <div
          style={{
            fontSize: "0.65rem",
            color: "rgba(255,255,255,0.35)",
            fontFamily: "Rajdhani, sans-serif",
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

function AdminBtn({
  children,
  onClick,
  color = "orange",
  size = "sm",
  disabled = false,
  "data-ocid": ocid,
}: any) {
  const colors: Record<string, string> = {
    orange: "linear-gradient(135deg,#ff6b00,#cc5500)",
    green: "linear-gradient(135deg,#00c864,#00a050)",
    red: "linear-gradient(135deg,#ef4444,#dc2626)",
    blue: "linear-gradient(135deg,#6366f1,#4f46e5)",
    yellow: "linear-gradient(135deg,#f59e0b,#d97706)",
    ghost: "rgba(255,255,255,0.06)",
  };
  return (
    <button
      type="button"
      disabled={disabled}
      data-ocid={ocid}
      onClick={onClick}
      style={{
        padding: size === "sm" ? "6px 12px" : "10px 18px",
        background: disabled
          ? "rgba(255,255,255,0.08)"
          : (colors[color] ?? colors.orange),
        border: "none",
        borderRadius: 8,
        color: "white",
        fontFamily: "Rajdhani, sans-serif",
        fontWeight: 700,
        fontSize: size === "sm" ? "0.78rem" : "0.88rem",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        transition: "all 0.2s",
        whiteSpace: "nowrap",
        letterSpacing: "0.03em",
      }}
    >
      {children}
    </button>
  );
}

function AdminInput({
  value,
  onChange,
  placeholder,
  type = "text",
  style = {},
}: any) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      style={{
        width: "100%",
        padding: "9px 12px",
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,107,0,0.3)",
        borderRadius: 8,
        color: "white",
        fontFamily: "Rajdhani, sans-serif",
        fontSize: "0.9rem",
        outline: "none",
        ...style,
      }}
    />
  );
}

function AdminSelect({
  value,
  onChange,
  options,
  style = {},
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  style?: React.CSSProperties;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: "100%",
        padding: "9px 12px",
        background: "#111122",
        border: "1px solid rgba(255,107,0,0.3)",
        borderRadius: 8,
        color: "white",
        fontFamily: "Rajdhani, sans-serif",
        fontSize: "0.9rem",
        outline: "none",
        cursor: "pointer",
        ...style,
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value} style={{ background: "#111122" }}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: "Orbitron, sans-serif",
        fontSize: "0.75rem",
        fontWeight: 700,
        color: "rgba(255,255,255,0.6)",
        textTransform: "uppercase",
        letterSpacing: "0.12em",
        marginBottom: 10,
        marginTop: 4,
        borderBottom: "1px solid rgba(255,107,0,0.15)",
        paddingBottom: 6,
      }}
    >
      {children}
    </div>
  );
}

// ─── Simple Bar Chart ─────────────────────────────────────────────────────────
function BarChart({
  data,
  color = "#ff6b00",
}: { data: { label: string; value: number }[]; color?: string }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div
      style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 80 }}
    >
      {data.map((d, i) => (
        <div
          key={`${d.label}-${i}`}
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
            height: "100%",
          }}
        >
          <div
            style={{
              flex: 1,
              width: "100%",
              display: "flex",
              alignItems: "flex-end",
            }}
          >
            <div
              style={{
                width: "100%",
                height: `${Math.max((d.value / max) * 100, 4)}%`,
                background: color,
                borderRadius: "4px 4px 0 0",
                opacity: 0.85,
                transition: "height 0.4s ease",
              }}
            />
          </div>
          <div
            style={{
              fontSize: "0.58rem",
              color: "rgba(255,255,255,0.4)",
              fontFamily: "Rajdhani, sans-serif",
              textAlign: "center",
            }}
          >
            {d.label}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Dashboard Tab ────────────────────────────────────────────────────────────
function DashboardTab({
  showToast,
}: { showToast: (m: string, t?: "success" | "error") => void }) {
  const [stats, setStats] = useState({
    users: 0,
    activeMatches: 0,
    revenue: 0,
    pendingWithdrawals: 0,
    todayUsers: 0,
    todayDeposits: 0,
  });
  const [chartData, setChartData] = useState<
    { label: string; value: number }[]
  >([]);
  const [potwUid, setPotwUid] = useState("");
  const [fraudMsg, setFraudMsg] = useState("");
  const [currentFraud, setCurrentFraud] = useState("");

  useEffect(() => {
    loadStats();
    loadFraudBanner();
  }, []);

  async function loadStats() {
    try {
      const [usersSnap, matchesSnap, depositsSnap, withdrawSnap] =
        await Promise.all([
          getDocs(collection(db, "users")),
          getDocs(
            query(collection(db, "matches"), where("status", "==", "waiting")),
          ),
          getDocs(
            query(
              collection(db, "payments"),
              where("status", "==", "approved"),
            ),
          ),
          getDocs(
            query(collection(db, "withdraw"), where("status", "==", "pending")),
          ),
        ]);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayUsers = usersSnap.docs.filter((d) => {
        const ca = d.data().createdAt;
        return ca && new Date(ca) >= today;
      }).length;
      const totalRevenue = depositsSnap.docs.reduce(
        (s, d) => s + (d.data().amount || 0),
        0,
      );
      const todayDeposits = depositsSnap.docs
        .filter((d) => {
          try {
            const ts = d.data().timestamp;
            const dt = ts?.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
            return dt >= today;
          } catch {
            return false;
          }
        })
        .reduce((s, d) => s + (d.data().amount || 0), 0);

      setStats({
        users: usersSnap.size,
        activeMatches: matchesSnap.size,
        revenue: totalRevenue,
        pendingWithdrawals: withdrawSnap.size,
        todayUsers,
        todayDeposits,
      });

      // Build 7-day chart
      const days: { label: string; value: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        d.setHours(0, 0, 0, 0);
        const de = new Date(d);
        de.setHours(23, 59, 59, 999);
        const dayTotal = depositsSnap.docs
          .filter((doc) => {
            try {
              const ts = doc.data().timestamp;
              const dt = ts?.seconds
                ? new Date(ts.seconds * 1000)
                : new Date(ts);
              return dt >= d && dt <= de;
            } catch {
              return false;
            }
          })
          .reduce((s, doc) => s + (doc.data().amount || 0), 0);
        days.push({
          label: d.toLocaleDateString("en", { weekday: "short" }).slice(0, 3),
          value: dayTotal,
        });
      }
      setChartData(days);
    } catch {
      /* silent */
    }
  }

  async function loadFraudBanner() {
    try {
      const snap = await getDoc(doc(db, "adminSettings", "fraudBanner"));
      if (snap.exists()) setCurrentFraud(snap.data().message || "");
    } catch {
      /* silent */
    }
  }

  async function setPlayerOfWeek() {
    if (!potwUid.trim()) return;
    try {
      await setDoc(doc(db, "adminSettings", "potw"), {
        uid: potwUid.trim(),
        setAt: Date.now(),
      });
      showToast(`Player of Week set: ${potwUid}`);
      setPotwUid("");
    } catch {
      showToast("Error setting POTW", "error");
    }
  }

  async function saveFraudBanner() {
    try {
      await setDoc(doc(db, "adminSettings", "fraudBanner"), {
        message: fraudMsg,
        active: !!fraudMsg,
      });
      setCurrentFraud(fraudMsg);
      showToast(fraudMsg ? "Fraud banner set" : "Banner cleared");
    } catch {
      showToast("Error", "error");
    }
  }

  return (
    <div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2,1fr)",
          gap: 10,
          marginBottom: 16,
        }}
      >
        <StatWidget icon="👥" label="Total Users" value={stats.users} />
        <StatWidget
          icon="⚔️"
          label="Active Matches"
          value={stats.activeMatches}
          color="#6366f1"
        />
        <StatWidget
          icon="💰"
          label="Total Revenue"
          value={`₹${stats.revenue}`}
          color="#00c864"
        />
        <StatWidget
          icon="⏳"
          label="Pending Withdrawals"
          value={stats.pendingWithdrawals}
          color="#f59e0b"
        />
        <StatWidget
          icon="🆕"
          label="Today's Users"
          value={stats.todayUsers}
          color="#06b6d4"
        />
        <StatWidget
          icon="📥"
          label="Today Deposits"
          value={`₹${stats.todayDeposits}`}
          color="#00c864"
        />
      </div>

      {chartData.length > 0 && (
        <div
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,107,0,0.2)",
            borderRadius: 12,
            padding: 14,
            marginBottom: 14,
          }}
        >
          <SectionTitle>7-Day Deposit Revenue</SectionTitle>
          <BarChart data={chartData} />
        </div>
      )}

      <div
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,107,0,0.2)",
          borderRadius: 12,
          padding: 14,
          marginBottom: 14,
        }}
      >
        <SectionTitle>🏅 Player of the Week</SectionTitle>
        {currentFraud && (
          <div
            style={{
              fontSize: "0.78rem",
              color: "#ffd700",
              marginBottom: 8,
              fontFamily: "Rajdhani, sans-serif",
            }}
          >
            Current: Set ✓
          </div>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <AdminInput
            value={potwUid}
            onChange={(e: any) => setPotwUid(e.target.value)}
            placeholder="Player UID"
            style={{ flex: 1 }}
          />
          <AdminBtn onClick={setPlayerOfWeek} color="orange">
            Set
          </AdminBtn>
        </div>
      </div>

      <div
        style={{
          background: "rgba(239,68,68,0.06)",
          border: "1px solid rgba(239,68,68,0.3)",
          borderRadius: 12,
          padding: 14,
        }}
      >
        <SectionTitle>⚠️ Fraud Alert Banner</SectionTitle>
        {currentFraud && (
          <div
            style={{
              background: "rgba(239,68,68,0.12)",
              border: "1px solid rgba(239,68,68,0.4)",
              borderRadius: 8,
              padding: "8px 12px",
              marginBottom: 8,
              fontSize: "0.82rem",
              color: "#ef4444",
              fontFamily: "Rajdhani, sans-serif",
            }}
          >
            Active: {currentFraud}
          </div>
        )}
        <AdminInput
          value={fraudMsg}
          onChange={(e: any) => setFraudMsg(e.target.value)}
          placeholder="Fraud warning message (empty to clear)"
          style={{ marginBottom: 8 }}
        />
        <div style={{ display: "flex", gap: 8 }}>
          <AdminBtn onClick={saveFraudBanner} color="red" size="sm">
            Set Banner
          </AdminBtn>
          <AdminBtn
            onClick={() => {
              setFraudMsg("");
              saveFraudBanner();
            }}
            color="ghost"
            size="sm"
          >
            Clear
          </AdminBtn>
        </div>
      </div>
    </div>
  );
}

// ─── Users Tab ────────────────────────────────────────────────────────────────
function UsersTab({
  showToast,
}: { showToast: (m: string, t?: "success" | "error") => void }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [banReason, setBanReason] = useState("");
  const [walletAdj, setWalletAdj] = useState("");
  const [walletNote, setWalletNote] = useState("");
  const [coinAdj, setCoinAdj] = useState("");
  const [ipNote, setIpNote] = useState("");
  const [dmMsg, setDmMsg] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    try {
      const snap = await getDocs(collection(db, "users"));
      const list: AdminUser[] = [];
      for (const d of snap.docs) {
        if (d.id === "admin") continue;
        const data = d.data();
        // Load wallet coins
        let coins = data.coins ?? 0;
        try {
          const wSnap = await getDoc(doc(db, "wallet", d.id));
          if (wSnap.exists()) coins = wSnap.data().coins ?? 0;
        } catch {}
        list.push({ uid: d.id, ...data, coins } as AdminUser);
      }
      setUsers(list);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }

  const filtered = users.filter(
    (u) =>
      !search ||
      u.uid.toLowerCase().includes(search.toLowerCase()) ||
      u.displayName?.toLowerCase().includes(search.toLowerCase()),
  );

  async function toggleBan(u: AdminUser) {
    try {
      const newBlocked = !u.blocked;
      await updateDoc(doc(db, "users", u.uid), {
        blocked: newBlocked,
        banReason: newBlocked ? banReason : "",
      });
      setUsers((prev) =>
        prev.map((x) =>
          x.uid === u.uid
            ? {
                ...x,
                blocked: newBlocked,
                banReason: newBlocked ? banReason : "",
              }
            : x,
        ),
      );
      showToast(newBlocked ? `Banned: ${u.uid}` : `Unbanned: ${u.uid}`);
      setBanReason("");
    } catch {
      showToast("Error", "error");
    }
  }

  async function markKYC(u: AdminUser) {
    try {
      await updateDoc(doc(db, "users", u.uid), { kycVerified: true });
      setUsers((prev) =>
        prev.map((x) => (x.uid === u.uid ? { ...x, kycVerified: true } : x)),
      );
      showToast("KYC verified ✅");
    } catch {
      showToast("Error", "error");
    }
  }

  async function adjustWallet(u: AdminUser, add: boolean) {
    const amt = Number.parseFloat(walletAdj);
    if (!Number.isFinite(amt) || amt <= 0) {
      showToast("Invalid amount", "error");
      return;
    }
    try {
      const wSnap = await getDoc(doc(db, "wallet", u.uid));
      const cur = wSnap.exists() ? (wSnap.data().coins ?? 0) : 0;
      const newCoins = add ? cur + amt : Math.max(0, cur - amt);
      await setDoc(doc(db, "wallet", u.uid), { coins: newCoins });
      await addDoc(collection(db, "notifications"), {
        uid: u.uid,
        title: add ? "💰 Wallet Credited" : "💸 Wallet Debited",
        message: `Admin ${add ? "added" : "deducted"} ₹${amt}. ${walletNote || ""}`,
        read: false,
        timestamp: new Date(),
      });
      setUsers((prev) =>
        prev.map((x) => (x.uid === u.uid ? { ...x, coins: newCoins } : x)),
      );
      showToast(`Wallet ${add ? "+" : "-"}${amt} for ${u.uid}`);
      setWalletAdj("");
      setWalletNote("");
    } catch {
      showToast("Error", "error");
    }
  }

  async function adjustCoins(u: AdminUser, add: boolean) {
    const amt = Number.parseInt(coinAdj, 10);
    if (!Number.isFinite(amt) || amt <= 0) {
      showToast("Invalid", "error");
      return;
    }
    try {
      const cur = u.coins ?? 0;
      const newC = add ? cur + amt : Math.max(0, cur - amt);
      await updateDoc(doc(db, "users", u.uid), { coins: newC });
      await setDoc(doc(db, "wallet", u.uid), { coins: newC });
      setUsers((prev) =>
        prev.map((x) => (x.uid === u.uid ? { ...x, coins: newC } : x)),
      );
      showToast(`Coins ${add ? "+" : "-"}${amt} for ${u.uid}`);
      setCoinAdj("");
    } catch {
      showToast("Error", "error");
    }
  }

  async function saveIpNote(u: AdminUser) {
    try {
      await updateDoc(doc(db, "users", u.uid), { ipNote });
      setUsers((prev) =>
        prev.map((x) => (x.uid === u.uid ? { ...x, ipNote } : x)),
      );
      showToast("IP note saved");
    } catch {
      showToast("Error", "error");
    }
  }

  async function sendDM(u: AdminUser) {
    if (!dmMsg.trim()) return;
    try {
      await addDoc(collection(db, "directMessages"), {
        toUid: u.uid,
        fromUid: "admin",
        message: dmMsg,
        timestamp: new Date(),
        read: false,
      });
      await addDoc(collection(db, "notifications"), {
        uid: u.uid,
        title: "📨 Admin Message",
        message: dmMsg,
        read: false,
        timestamp: new Date(),
      });
      showToast(`Message sent to ${u.uid}`);
      setDmMsg("");
    } catch {
      showToast("Error", "error");
    }
  }

  if (loading)
    return (
      <div
        style={{
          textAlign: "center",
          padding: 40,
          color: "rgba(255,255,255,0.4)",
          fontFamily: "Rajdhani, sans-serif",
        }}
      >
        Loading users...
      </div>
    );

  return (
    <div>
      <AdminInput
        value={search}
        onChange={(e: any) => setSearch(e.target.value)}
        placeholder="🔍 Search by UID or name..."
        style={{ marginBottom: 12 }}
      />
      <div
        style={{
          fontSize: "0.75rem",
          color: "rgba(255,255,255,0.4)",
          fontFamily: "Rajdhani, sans-serif",
          marginBottom: 10,
        }}
      >
        {filtered.length} user{filtered.length !== 1 ? "s" : ""} found
      </div>
      {filtered.map((u) => (
        <div
          key={u.uid}
          data-ocid={`admin.users.user_card.${u.uid}`}
          style={{
            background: "rgba(255,255,255,0.03)",
            border: `1px solid ${u.blocked ? "rgba(239,68,68,0.4)" : "rgba(255,107,0,0.2)"}`,
            borderRadius: 12,
            padding: "10px 14px",
            marginBottom: 8,
          }}
        >
          <button
            type="button"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              cursor: "pointer",
              width: "100%",
              background: "none",
              border: "none",
              padding: 0,
              textAlign: "left",
            }}
            onClick={() => {
              setExpanded(expanded === u.uid ? null : u.uid);
              setIpNote(u.ipNote || "");
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
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
                    fontFamily: "Orbitron, sans-serif",
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    color: "white",
                  }}
                >
                  {u.displayName || u.uid}
                </span>
                {u.kycVerified && (
                  <span
                    title="KYC Verified"
                    style={{ color: "#22c55e", fontSize: "0.85rem" }}
                  >
                    🛡️
                  </span>
                )}
                {u.blocked && (
                  <span
                    className="badge badge-rejected"
                    style={{ fontSize: "0.6rem" }}
                  >
                    BANNED
                  </span>
                )}
                {u.vipTier && u.vipTier !== "None" && (
                  <span
                    style={{
                      fontSize: "0.62rem",
                      color: vipColor(u.vipTier),
                      fontFamily: "Rajdhani, sans-serif",
                      fontWeight: 700,
                    }}
                  >
                    👑 {u.vipTier}
                  </span>
                )}
              </div>
              <div
                style={{
                  fontSize: "0.72rem",
                  color: "rgba(255,255,255,0.4)",
                  fontFamily: "Rajdhani, sans-serif",
                  marginTop: 2,
                }}
              >
                UID: {u.uid} · 🪙 ₹{u.coins}
              </div>
              {/* Phone number - admin only */}
              <div
                style={{
                  fontSize: "0.78rem",
                  color: "#ff9a00",
                  fontFamily: "Rajdhani, sans-serif",
                  fontWeight: 700,
                  marginTop: 3,
                  background: "rgba(255,107,0,0.08)",
                  borderRadius: 4,
                  padding: "2px 6px",
                  display: "inline-block",
                }}
              >
                📱 {u.phone || "No phone"}
              </div>
            </div>
            <div
              style={{
                fontSize: "1rem",
                color: "rgba(255,255,255,0.3)",
                marginLeft: 8,
              }}
            >
              {expanded === u.uid ? "▲" : "▼"}
            </div>
          </button>

          {expanded === u.uid && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              style={{ overflow: "hidden" }}
            >
              <div
                style={{
                  borderTop: "1px solid rgba(255,107,0,0.15)",
                  marginTop: 10,
                  paddingTop: 10,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                {/* Stats row */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3,1fr)",
                    gap: 6,
                  }}
                >
                  {[
                    { label: "Matches", value: u.matchesPlayed ?? 0 },
                    { label: "Wins", value: u.wins ?? 0 },
                    { label: "Kills", value: u.kills ?? 0 },
                  ].map((s) => (
                    <div
                      key={s.label}
                      style={{
                        background: "rgba(255,255,255,0.04)",
                        borderRadius: 8,
                        padding: "8px 6px",
                        textAlign: "center",
                      }}
                    >
                      <div
                        style={{
                          fontFamily: "Orbitron, sans-serif",
                          fontSize: "0.9rem",
                          fontWeight: 700,
                          color: "white",
                        }}
                      >
                        {s.value}
                      </div>
                      <div
                        style={{
                          fontSize: "0.62rem",
                          color: "rgba(255,255,255,0.4)",
                          fontFamily: "Rajdhani, sans-serif",
                          textTransform: "uppercase",
                        }}
                      >
                        {s.label}
                      </div>
                    </div>
                  ))}
                </div>

                {/* KYC & Actions */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  <AdminBtn
                    onClick={() => markKYC(u)}
                    color="green"
                    size="sm"
                    data-ocid={`admin.users.kyc_verify.${u.uid}`}
                  >
                    🛡️ KYC Verify
                  </AdminBtn>
                  <AdminBtn
                    onClick={() => {
                      if (!u.blocked) setBanReason("");
                      toggleBan(u);
                    }}
                    color={u.blocked ? "green" : "red"}
                    size="sm"
                    data-ocid={`admin.users.ban_toggle.${u.uid}`}
                  >
                    {u.blocked ? "✅ Unban" : "🚫 Ban"}
                  </AdminBtn>
                </div>

                {/* Ban reason (shown when not banned) */}
                {!u.blocked && (
                  <AdminInput
                    value={banReason}
                    onChange={(e: any) => setBanReason(e.target.value)}
                    placeholder="Ban reason (optional)"
                  />
                )}

                {/* Wallet Adjust */}
                <SectionTitle>Wallet Adjust</SectionTitle>
                <AdminInput
                  value={walletAdj}
                  onChange={(e: any) => setWalletAdj(e.target.value)}
                  placeholder="Amount (₹)"
                  type="number"
                />
                <AdminInput
                  value={walletNote}
                  onChange={(e: any) => setWalletNote(e.target.value)}
                  placeholder="Note (optional)"
                />
                <div style={{ display: "flex", gap: 6 }}>
                  <AdminBtn
                    onClick={() => adjustWallet(u, true)}
                    color="green"
                    size="sm"
                    data-ocid={`admin.wallet.add.${u.uid}`}
                  >
                    + Add ₹
                  </AdminBtn>
                  <AdminBtn
                    onClick={() => adjustWallet(u, false)}
                    color="red"
                    size="sm"
                    data-ocid={`admin.wallet.deduct.${u.uid}`}
                  >
                    - Deduct ₹
                  </AdminBtn>
                </div>

                {/* Coins Adjust */}
                <SectionTitle>Coins Adjust</SectionTitle>
                <AdminInput
                  value={coinAdj}
                  onChange={(e: any) => setCoinAdj(e.target.value)}
                  placeholder="Coin amount"
                  type="number"
                />
                <div style={{ display: "flex", gap: 6 }}>
                  <AdminBtn
                    onClick={() => adjustCoins(u, true)}
                    color="orange"
                    size="sm"
                  >
                    + Coins
                  </AdminBtn>
                  <AdminBtn
                    onClick={() => adjustCoins(u, false)}
                    color="yellow"
                    size="sm"
                  >
                    - Coins
                  </AdminBtn>
                </div>

                {/* IP Note */}
                <SectionTitle>IP Note</SectionTitle>
                <textarea
                  value={ipNote}
                  onChange={(e) => setIpNote(e.target.value)}
                  placeholder="Suspicious activity note..."
                  rows={2}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,107,0,0.25)",
                    borderRadius: 8,
                    color: "white",
                    fontFamily: "Rajdhani, sans-serif",
                    fontSize: "0.85rem",
                    resize: "none",
                    outline: "none",
                  }}
                />
                <AdminBtn
                  onClick={() => saveIpNote(u)}
                  color="yellow"
                  size="sm"
                >
                  Save Note
                </AdminBtn>

                {/* Direct Message */}
                <SectionTitle>Direct Message</SectionTitle>
                <AdminInput
                  value={dmMsg}
                  onChange={(e: any) => setDmMsg(e.target.value)}
                  placeholder="Type message to player..."
                />
                <AdminBtn
                  onClick={() => sendDM(u)}
                  color="blue"
                  size="sm"
                  data-ocid={`admin.users.dm.${u.uid}`}
                >
                  📨 Send DM
                </AdminBtn>
              </div>
            </motion.div>
          )}
        </div>
      ))}
      {filtered.length === 0 && (
        <div
          style={{
            textAlign: "center",
            padding: 30,
            color: "rgba(255,255,255,0.35)",
            fontFamily: "Rajdhani, sans-serif",
          }}
        >
          No users found
        </div>
      )}
    </div>
  );
}

// ─── Matches Tab ──────────────────────────────────────────────────────────────
function MatchesTab({
  showToast,
}: { showToast: (m: string, t?: "success" | "error") => void }) {
  const [matches, setMatches] = useState<AdminMatch[]>([]);
  const [templates, setTemplates] = useState<AdminMatch[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [roomIds, setRoomIds] = useState<Record<string, string>>({});
  const [roomPasses, setRoomPasses] = useState<Record<string, string>>({});
  const [killInputs, setKillInputs] = useState<
    Record<string, Record<string, string>>
  >({});
  const [newMatch, setNewMatch] = useState({
    mode: "BR Solo",
    customTitle: "",
    entryFee: "20",
    prizePool: "35",
    perKill: "3",
    maxPlayers: "12",
    scheduleTime: "",
    voiceLink: "",
    hidden: false,
    saveTemplate: false,
  });

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "matches"), (snap) => {
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as AdminMatch[];
      list.sort(
        (a, b) =>
          (a.status === "completed" ? 1 : 0) -
          (b.status === "completed" ? 1 : 0),
      );
      setMatches(list);
    });
    loadTemplates();
    return () => unsub();
  }, []);

  async function loadTemplates() {
    try {
      const snap = await getDocs(collection(db, "matchTemplates"));
      setTemplates(
        snap.docs.map((d) => ({ id: d.id, ...d.data() })) as AdminMatch[],
      );
    } catch {}
  }

  async function createMatch() {
    try {
      const data: Omit<AdminMatch, "id"> = {
        mode: newMatch.mode,
        customTitle: newMatch.customTitle,
        status: "waiting",
        entryFee: Number.parseFloat(newMatch.entryFee) || 20,
        prizePool: Number.parseFloat(newMatch.prizePool) || 35,
        perKill: Number.parseFloat(newMatch.perKill) || 0,
        maxPlayers: Number.parseInt(newMatch.maxPlayers, 10) || 12,
        voiceLink: newMatch.voiceLink,
        isVisible: !newMatch.hidden,
        players: [],
        roomId: "",
        roomPass: "",
        scheduleTime: newMatch.scheduleTime,
        timestamp: new Date(),
      };
      await addDoc(collection(db, "matches"), data);
      if (newMatch.saveTemplate) {
        await addDoc(collection(db, "matchTemplates"), data);
        loadTemplates();
      }
      showToast("Match created! 🎮");
      setNewMatch({
        mode: "BR Solo",
        customTitle: "",
        entryFee: "20",
        prizePool: "35",
        perKill: "3",
        maxPlayers: "12",
        scheduleTime: "",
        voiceLink: "",
        hidden: false,
        saveTemplate: false,
      });
    } catch {
      showToast("Error creating match", "error");
    }
  }

  async function assignRoom(m: AdminMatch) {
    const rid = roomIds[m.id] || m.roomId || "";
    const rp = roomPasses[m.id] || m.roomPass || "";
    try {
      await updateDoc(doc(db, "matches", m.id), {
        roomId: rid,
        roomPass: rp,
        status: "live",
      });
      // Notify all joined players
      for (const uid of m.players || []) {
        await addDoc(collection(db, "notifications"), {
          uid,
          title: "🔑 Room ID Assigned!",
          message: `Room ID: ${rid} | Password: ${rp}`,
          read: false,
          timestamp: new Date(),
        });
      }
      showToast("Room assigned & players notified! 🔑");
    } catch {
      showToast("Error assigning room", "error");
    }
  }

  async function awardKills(m: AdminMatch) {
    const kills = killInputs[m.id] || {};
    try {
      for (const [uid, killsStr] of Object.entries(kills)) {
        const k = Number.parseInt(killsStr, 10) || 0;
        if (k <= 0) continue;
        const perKill = m.perKill || 0;
        const bonus = k * perKill;
        if (bonus > 0) {
          const wSnap = await getDoc(doc(db, "wallet", uid));
          const cur = wSnap.exists() ? (wSnap.data().coins ?? 0) : 0;
          await setDoc(doc(db, "wallet", uid), { coins: cur + bonus });
          await addDoc(collection(db, "notifications"), {
            uid,
            title: "💀 Kill Coins Awarded!",
            message: `You got ${k} kills × ₹${perKill} = ₹${bonus} added to your wallet.`,
            read: false,
            timestamp: new Date(),
          });
        }
      }
      showToast("Kill coins awarded! 💀");
      setKillInputs((prev) => ({ ...prev, [m.id]: {} }));
    } catch {
      showToast("Error awarding kills", "error");
    }
  }

  async function declareWinner(m: AdminMatch, winnerUid: string) {
    try {
      const prize = Math.floor(m.prizePool * 0.9); // 90% to winner, 10% admin
      const wSnap = await getDoc(doc(db, "wallet", winnerUid));
      const cur = wSnap.exists() ? (wSnap.data().coins ?? 0) : 0;
      await setDoc(doc(db, "wallet", winnerUid), { coins: cur + prize });
      await updateDoc(doc(db, "matches", m.id), {
        status: "completed",
        winner: winnerUid,
        prizeAwarded: prize,
      });
      await addDoc(collection(db, "notifications"), {
        uid: winnerUid,
        title: "🏆 You Won!",
        message: `Congratulations! You won ₹${prize} in ${m.mode}${m.customTitle ? ` (${m.customTitle})` : ""}!`,
        read: false,
        timestamp: new Date(),
      });
      showToast(`Winner: ${winnerUid} gets ₹${prize} 🏆`);
    } catch {
      showToast("Error declaring winner", "error");
    }
  }

  async function deleteMatch(id: string) {
    try {
      await deleteDoc(doc(db, "matches", id));
      showToast("Match deleted");
    } catch {
      showToast("Error", "error");
    }
  }

  async function toggleVisibility(m: AdminMatch) {
    try {
      await updateDoc(doc(db, "matches", m.id), { isVisible: !m.isVisible });
    } catch {
      showToast("Error", "error");
    }
  }

  return (
    <div>
      {/* Create Match Form */}
      <div
        style={{
          background: "rgba(255,107,0,0.06)",
          border: "1px solid rgba(255,107,0,0.25)",
          borderRadius: 12,
          padding: 14,
          marginBottom: 16,
        }}
      >
        <SectionTitle>➕ Create New Match</SectionTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <AdminSelect
            value={newMatch.mode}
            onChange={(v) => setNewMatch((p) => ({ ...p, mode: v }))}
            options={GAME_MODES.map((m) => ({ value: m, label: m }))}
          />
          <AdminInput
            value={newMatch.customTitle}
            onChange={(e: any) =>
              setNewMatch((p) => ({ ...p, customTitle: e.target.value }))
            }
            placeholder="Custom title (e.g. Sunday Special)"
          />
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}
          >
            <AdminInput
              value={newMatch.entryFee}
              onChange={(e: any) =>
                setNewMatch((p) => ({ ...p, entryFee: e.target.value }))
              }
              placeholder="Entry Fee ₹"
              type="number"
            />
            <AdminInput
              value={newMatch.prizePool}
              onChange={(e: any) =>
                setNewMatch((p) => ({ ...p, prizePool: e.target.value }))
              }
              placeholder="Prize Pool ₹"
              type="number"
            />
            <AdminInput
              value={newMatch.perKill}
              onChange={(e: any) =>
                setNewMatch((p) => ({ ...p, perKill: e.target.value }))
              }
              placeholder="Per Kill ₹"
              type="number"
            />
            <AdminInput
              value={newMatch.maxPlayers}
              onChange={(e: any) =>
                setNewMatch((p) => ({ ...p, maxPlayers: e.target.value }))
              }
              placeholder="Max Players"
              type="number"
            />
          </div>
          <AdminInput
            value={newMatch.scheduleTime}
            onChange={(e: any) =>
              setNewMatch((p) => ({ ...p, scheduleTime: e.target.value }))
            }
            placeholder="Schedule time (optional)"
            type="datetime-local"
          />
          <AdminInput
            value={newMatch.voiceLink}
            onChange={(e: any) =>
              setNewMatch((p) => ({ ...p, voiceLink: e.target.value }))
            }
            placeholder="Voice channel link (WhatsApp/Discord)"
          />
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: "0.82rem",
                color: "rgba(255,255,255,0.65)",
                fontFamily: "Rajdhani, sans-serif",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={newMatch.hidden}
                onChange={(e) =>
                  setNewMatch((p) => ({ ...p, hidden: e.target.checked }))
                }
              />
              Hidden from players
            </label>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: "0.82rem",
                color: "rgba(255,255,255,0.65)",
                fontFamily: "Rajdhani, sans-serif",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={newMatch.saveTemplate}
                onChange={(e) =>
                  setNewMatch((p) => ({ ...p, saveTemplate: e.target.checked }))
                }
              />
              Save as template
            </label>
          </div>
          <AdminBtn
            onClick={createMatch}
            color="orange"
            size="lg"
            data-ocid="admin.matches.create_button"
          >
            🎮 Create Match
          </AdminBtn>
        </div>
      </div>

      {/* Templates */}
      {templates.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <SectionTitle>📋 Match Templates</SectionTitle>
          <div
            style={{
              display: "flex",
              gap: 8,
              overflowX: "auto",
              paddingBottom: 6,
            }}
          >
            {templates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() =>
                  setNewMatch((p) => ({
                    ...p,
                    mode: t.mode || "BR Solo",
                    entryFee: String(t.entryFee),
                    prizePool: String(t.prizePool),
                    perKill: String(t.perKill || 0),
                    maxPlayers: String(t.maxPlayers || 12),
                  }))
                }
                style={{
                  background: "rgba(255,107,0,0.1)",
                  border: "1px solid rgba(255,107,0,0.3)",
                  borderRadius: 8,
                  padding: "6px 12px",
                  color: "white",
                  fontFamily: "Rajdhani, sans-serif",
                  fontSize: "0.78rem",
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                {t.mode} — ₹{t.entryFee}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Active Matches */}
      <SectionTitle>🔥 All Matches ({matches.length})</SectionTitle>
      {matches.map((m) => (
        <div
          key={m.id}
          data-ocid={`admin.matches.match_card.${m.id}`}
          style={{
            background: "rgba(255,255,255,0.03)",
            border: `1px solid ${m.status === "live" ? "rgba(255,107,0,0.5)" : "rgba(255,107,0,0.2)"}`,
            borderRadius: 12,
            padding: "12px 14px",
            marginBottom: 10,
          }}
        >
          <button
            type="button"
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              cursor: "pointer",
              width: "100%",
              background: "none",
              border: "none",
              padding: 0,
              textAlign: "left",
            }}
            onClick={() => setExpanded(expanded === m.id ? null : m.id)}
          >
            <div>
              <div
                style={{
                  fontFamily: "Orbitron, sans-serif",
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  color: "white",
                  marginBottom: 4,
                }}
              >
                {m.customTitle || m.mode}
                {m.customTitle && (
                  <span
                    style={{
                      fontFamily: "Rajdhani, sans-serif",
                      color: "rgba(255,255,255,0.45)",
                      fontSize: "0.7rem",
                      marginLeft: 6,
                    }}
                  >
                    {m.mode}
                  </span>
                )}
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                <span className={`status-badge status-${m.status}`}>
                  {m.status}
                </span>
                <span
                  style={{
                    fontSize: "0.72rem",
                    color: "rgba(255,255,255,0.45)",
                    fontFamily: "Rajdhani, sans-serif",
                  }}
                >
                  ₹{m.entryFee} in · ₹{m.prizePool} prize
                </span>
                <span
                  style={{
                    fontSize: "0.72rem",
                    color: "rgba(255,255,255,0.45)",
                    fontFamily: "Rajdhani, sans-serif",
                  }}
                >
                  👥 {(m.players || []).length}/{m.maxPlayers || "?"}
                </span>
                {!m.isVisible && (
                  <span
                    style={{
                      fontSize: "0.62rem",
                      color: "#f59e0b",
                      fontFamily: "Rajdhani, sans-serif",
                    }}
                  >
                    🔒 Hidden
                  </span>
                )}
              </div>
            </div>
            <div style={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.3)" }}>
              {expanded === m.id ? "▲" : "▼"}
            </div>
          </button>

          {expanded === m.id && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{
                borderTop: "1px solid rgba(255,107,0,0.15)",
                marginTop: 10,
                paddingTop: 10,
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              {/* Players List */}
              <div>
                <div
                  style={{
                    fontSize: "0.72rem",
                    color: "rgba(255,255,255,0.4)",
                    fontFamily: "Rajdhani, sans-serif",
                    marginBottom: 6,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                  }}
                >
                  Players Joined
                </div>
                {(m.players || []).length === 0 ? (
                  <div
                    style={{
                      color: "rgba(255,255,255,0.3)",
                      fontSize: "0.8rem",
                      fontFamily: "Rajdhani, sans-serif",
                    }}
                  >
                    No players yet
                  </div>
                ) : (
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 4 }}
                  >
                    {(m.players || []).map((uid, idx) => (
                      <div
                        key={uid}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          background: "rgba(255,107,0,0.06)",
                          borderRadius: 8,
                          padding: "6px 10px",
                        }}
                      >
                        <span
                          style={{
                            fontFamily: "Orbitron, sans-serif",
                            fontSize: "0.7rem",
                            color:
                              idx === 0 ? "#ffd700" : "rgba(255,255,255,0.4)",
                          }}
                        >
                          {idx === 0 ? "⭐" : `#${idx + 1}`}
                        </span>
                        <span
                          style={{
                            fontFamily: "Rajdhani, sans-serif",
                            fontSize: "0.85rem",
                            color: "white",
                            flex: 1,
                          }}
                        >
                          {uid}
                        </span>
                        {m.status !== "completed" && m.perKill > 0 && (
                          <input
                            type="number"
                            min={0}
                            value={killInputs[m.id]?.[uid] || ""}
                            onChange={(e) =>
                              setKillInputs((prev) => ({
                                ...prev,
                                [m.id]: {
                                  ...(prev[m.id] || {}),
                                  [uid]: e.target.value,
                                },
                              }))
                            }
                            placeholder="kills"
                            style={{
                              width: 60,
                              padding: "4px 8px",
                              background: "rgba(255,255,255,0.06)",
                              border: "1px solid rgba(255,107,0,0.3)",
                              borderRadius: 6,
                              color: "white",
                              fontFamily: "Rajdhani, sans-serif",
                              fontSize: "0.82rem",
                              outline: "none",
                            }}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Kill Award */}
              {m.status !== "completed" && m.perKill > 0 && (
                <AdminBtn
                  onClick={() => awardKills(m)}
                  color="orange"
                  size="sm"
                  data-ocid={`admin.matches.award_kills.${m.id}`}
                >
                  💀 Award Kills
                </AdminBtn>
              )}

              {/* Room Assignment */}
              {m.status !== "completed" && (
                <div>
                  <SectionTitle>🔑 Assign Room</SectionTitle>
                  <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                    <AdminInput
                      value={roomIds[m.id] ?? m.roomId ?? ""}
                      onChange={(e: any) =>
                        setRoomIds((p) => ({ ...p, [m.id]: e.target.value }))
                      }
                      placeholder="Room ID"
                      style={{ flex: 1 }}
                    />
                    <AdminInput
                      value={roomPasses[m.id] ?? m.roomPass ?? ""}
                      onChange={(e: any) =>
                        setRoomPasses((p) => ({ ...p, [m.id]: e.target.value }))
                      }
                      placeholder="Password"
                      style={{ flex: 1 }}
                    />
                  </div>
                  <AdminBtn
                    onClick={() => assignRoom(m)}
                    color="orange"
                    size="sm"
                    data-ocid={`admin.matches.assign_room.${m.id}`}
                  >
                    📤 ASSIGN ROOM
                  </AdminBtn>
                </div>
              )}

              {/* Declare Winner */}
              {m.status !== "completed" && (m.players || []).length > 0 && (
                <div>
                  <SectionTitle>🏆 Declare Winner</SectionTitle>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {(m.players || []).map((uid) => (
                      <AdminBtn
                        key={uid}
                        onClick={() => declareWinner(m, uid)}
                        color="yellow"
                        size="sm"
                        data-ocid={`admin.matches.declare_winner.${m.id}`}
                      >
                        🏆 {uid}
                      </AdminBtn>
                    ))}
                  </div>
                  <div
                    style={{
                      fontSize: "0.68rem",
                      color: "rgba(255,255,255,0.4)",
                      fontFamily: "Rajdhani, sans-serif",
                      marginTop: 4,
                    }}
                  >
                    Winner gets 90% = ₹{Math.floor(m.prizePool * 0.9)} · Admin
                    keeps 10%
                  </div>
                </div>
              )}

              {/* Match Actions */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <AdminBtn
                  onClick={() => toggleVisibility(m)}
                  color="ghost"
                  size="sm"
                >
                  {m.isVisible ? "🔒 Hide" : "👁 Show"}
                </AdminBtn>
                <AdminBtn
                  onClick={() => deleteMatch(m.id)}
                  color="red"
                  size="sm"
                  data-ocid={`admin.matches.delete.${m.id}`}
                >
                  🗑 Delete
                </AdminBtn>
              </div>
            </motion.div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Deposits Tab ─────────────────────────────────────────────────────────────
function DepositsTab({
  showToast,
}: { showToast: (m: string, t?: "success" | "error") => void }) {
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({});
  const [fakeUid, setFakeUid] = useState("");
  const [fakeAmt, setFakeAmt] = useState("");

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "payments"), orderBy("timestamp", "desc")),
      (snap) =>
        setDeposits(
          snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Deposit[],
        ),
    );
    return () => unsub();
  }, []);

  async function approveDeposit(dep: Deposit) {
    try {
      await updateDoc(doc(db, "payments", dep.id), { status: "approved" });
      const wSnap = await getDoc(doc(db, "wallet", dep.user));
      const cur = wSnap.exists() ? (wSnap.data().coins ?? 0) : 0;
      await setDoc(doc(db, "wallet", dep.user), { coins: cur + dep.amount });
      await addDoc(collection(db, "notifications"), {
        uid: dep.user,
        title: "✅ Deposit Approved!",
        message: `₹${dep.amount} has been credited to your wallet.`,
        read: false,
        timestamp: new Date(),
      });
      showToast(`Approved ₹${dep.amount} for ${dep.user} ✅`);
    } catch {
      showToast("Error", "error");
    }
  }

  async function rejectDeposit(dep: Deposit) {
    try {
      await updateDoc(doc(db, "payments", dep.id), {
        status: "rejected",
        rejectReason: rejectReason[dep.id] || "",
      });
      await addDoc(collection(db, "notifications"), {
        uid: dep.user,
        title: "❌ Deposit Rejected",
        message: `Your deposit of ₹${dep.amount} was rejected. ${rejectReason[dep.id] ? `Reason: ${rejectReason[dep.id]}` : ""}`,
        read: false,
        timestamp: new Date(),
      });
      showToast("Deposit rejected");
    } catch {
      showToast("Error", "error");
    }
  }

  async function fakePayment() {
    const amt = Number.parseFloat(fakeAmt);
    if (!fakeUid.trim() || !Number.isFinite(amt) || amt <= 0) {
      showToast("Fill UID and amount", "error");
      return;
    }
    try {
      const wSnap = await getDoc(doc(db, "wallet", fakeUid.trim()));
      const cur = wSnap.exists() ? (wSnap.data().coins ?? 0) : 0;
      await setDoc(doc(db, "wallet", fakeUid.trim()), { coins: cur + amt });
      await addDoc(collection(db, "payments"), {
        user: fakeUid.trim(),
        amount: amt,
        utr: `TEST-${Date.now()}`,
        status: "approved",
        isTest: true,
        timestamp: new Date(),
      });
      showToast(`[TEST] ₹${amt} added to ${fakeUid} wallet`);
      setFakeUid("");
      setFakeAmt("");
    } catch {
      showToast("Error", "error");
    }
  }

  const pending = deposits.filter((d) => d.status === "pending");
  const recent = deposits.filter((d) => d.status !== "pending").slice(0, 20);

  return (
    <div>
      {/* Fake payment simulation */}
      <div
        style={{
          background: "rgba(99,102,241,0.08)",
          border: "1px solid rgba(99,102,241,0.3)",
          borderRadius: 12,
          padding: 14,
          marginBottom: 16,
        }}
      >
        <SectionTitle>🧪 Test Payment Simulation</SectionTitle>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <AdminInput
            value={fakeUid}
            onChange={(e: any) => setFakeUid(e.target.value)}
            placeholder="Player UID"
            style={{ flex: 1 }}
          />
          <AdminInput
            value={fakeAmt}
            onChange={(e: any) => setFakeAmt(e.target.value)}
            placeholder="₹ Amount"
            type="number"
            style={{ flex: 1 }}
          />
        </div>
        <AdminBtn
          onClick={fakePayment}
          color="blue"
          size="sm"
          data-ocid="admin.deposits.fake_payment_button"
        >
          🧪 TEST — Add to Wallet
        </AdminBtn>
        <div
          style={{
            fontSize: "0.68rem",
            color: "rgba(255,255,255,0.35)",
            fontFamily: "Rajdhani, sans-serif",
            marginTop: 6,
          }}
        >
          TEST badge applied — does not deduct from admin
        </div>
      </div>

      <SectionTitle>⏳ Pending Deposits ({pending.length})</SectionTitle>
      {pending.length === 0 && (
        <div
          style={{
            color: "rgba(255,255,255,0.35)",
            fontFamily: "Rajdhani, sans-serif",
            fontSize: "0.85rem",
            marginBottom: 12,
          }}
        >
          No pending deposits 🎉
        </div>
      )}
      {pending.map((dep) => (
        <div
          key={dep.id}
          data-ocid={`admin.deposits.deposit_card.${dep.id}`}
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(234,179,8,0.4)",
            borderRadius: 12,
            padding: 12,
            marginBottom: 8,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: 8,
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: "Rajdhani, sans-serif",
                  fontWeight: 700,
                  color: "white",
                  fontSize: "0.9rem",
                }}
              >
                {dep.user}
              </div>
              <div
                style={{
                  fontSize: "0.8rem",
                  color: "#00c864",
                  fontFamily: "Orbitron, sans-serif",
                  fontWeight: 700,
                }}
              >
                ₹{dep.amount}
              </div>
              <div
                style={{
                  fontSize: "0.7rem",
                  color: "rgba(255,255,255,0.4)",
                  fontFamily: "Rajdhani, sans-serif",
                }}
              >
                UTR: {dep.utr || "—"} · {fmtTime(dep.timestamp)}
              </div>
            </div>
            <span className="status-badge status-pending">Pending</span>
          </div>
          <AdminInput
            value={rejectReason[dep.id] || ""}
            onChange={(e: any) =>
              setRejectReason((p) => ({ ...p, [dep.id]: e.target.value }))
            }
            placeholder="Reject reason (optional)"
            style={{ marginBottom: 8 }}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <AdminBtn
              onClick={() => approveDeposit(dep)}
              color="green"
              size="sm"
              data-ocid={`admin.deposits.approve.${dep.id}`}
            >
              ✅ Approve
            </AdminBtn>
            <AdminBtn
              onClick={() => rejectDeposit(dep)}
              color="red"
              size="sm"
              data-ocid={`admin.deposits.reject.${dep.id}`}
            >
              ❌ Reject
            </AdminBtn>
          </div>
        </div>
      ))}

      {recent.length > 0 && (
        <>
          <SectionTitle>📋 Recent ({recent.length})</SectionTitle>
          {recent.map((dep) => (
            <div
              key={dep.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "8px 12px",
                background: "rgba(255,255,255,0.02)",
                borderRadius: 8,
                marginBottom: 6,
              }}
            >
              <div>
                <span
                  style={{
                    fontFamily: "Rajdhani, sans-serif",
                    fontSize: "0.85rem",
                    color: "white",
                  }}
                >
                  {dep.user}
                </span>
                <span
                  style={{
                    fontSize: "0.7rem",
                    color: "rgba(255,255,255,0.35)",
                    fontFamily: "Rajdhani, sans-serif",
                    marginLeft: 8,
                  }}
                >
                  {fmtTime(dep.timestamp)}
                </span>
                {(dep as any).isTest && (
                  <span
                    style={{
                      fontSize: "0.6rem",
                      background: "rgba(99,102,241,0.3)",
                      color: "#818cf8",
                      borderRadius: 4,
                      padding: "1px 5px",
                      marginLeft: 6,
                      fontFamily: "Rajdhani, sans-serif",
                    }}
                  >
                    TEST
                  </span>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    fontFamily: "Orbitron, sans-serif",
                    fontSize: "0.82rem",
                    color: "#00c864",
                  }}
                >
                  ₹{dep.amount}
                </span>
                <span className={`status-badge status-${dep.status}`}>
                  {dep.status}
                </span>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ─── Withdrawals Tab ──────────────────────────────────────────────────────────
function WithdrawalsTab({
  showToast,
}: { showToast: (m: string, t?: "success" | "error") => void }) {
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({});

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "withdraw"), orderBy("timestamp", "desc")),
      (snap) =>
        setWithdrawals(
          snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Withdrawal[],
        ),
    );
    return () => unsub();
  }, []);

  async function approveWithdrawal(w: Withdrawal) {
    try {
      await updateDoc(doc(db, "withdraw", w.id), { status: "approved" });
      await addDoc(collection(db, "notifications"), {
        uid: w.user,
        title: "✅ Withdrawal Approved!",
        message: `Your withdrawal of ₹${w.final || w.amount} has been processed.`,
        read: false,
        timestamp: new Date(),
      });
      showToast(`Withdrawal approved for ${w.user} ✅`);
    } catch {
      showToast("Error", "error");
    }
  }

  async function rejectWithdrawal(w: Withdrawal) {
    const reason = rejectReason[w.id] || "Admin review";
    try {
      await updateDoc(doc(db, "withdraw", w.id), {
        status: "rejected",
        rejectReason: reason,
      });
      // Refund coins
      const wSnap = await getDoc(doc(db, "wallet", w.user));
      const cur = wSnap.exists() ? (wSnap.data().coins ?? 0) : 0;
      await setDoc(doc(db, "wallet", w.user), { coins: cur + w.amount });
      await addDoc(collection(db, "notifications"), {
        uid: w.user,
        title: "❌ Withdrawal Rejected",
        message: `Withdrawal of ₹${w.amount} rejected. Reason: ${reason}. Coins refunded.`,
        read: false,
        timestamp: new Date(),
      });
      showToast("Rejected & coins refunded");
    } catch {
      showToast("Error", "error");
    }
  }

  const pending = withdrawals.filter((w) => w.status === "pending");
  const recent = withdrawals.filter((w) => w.status !== "pending").slice(0, 20);

  const avgApprovalTime = (() => {
    const approved = withdrawals.filter((w) => w.status === "approved");
    if (approved.length === 0) return null;
    return `~${Math.round(approved.length / 2)}hr avg`;
  })();

  return (
    <div>
      <div
        style={{
          background: "rgba(255,107,0,0.06)",
          border: "1px solid rgba(255,107,0,0.2)",
          borderRadius: 10,
          padding: "10px 14px",
          marginBottom: 14,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <div
            style={{
              fontSize: "0.7rem",
              color: "rgba(255,255,255,0.45)",
              fontFamily: "Rajdhani, sans-serif",
              textTransform: "uppercase",
            }}
          >
            Service Charge
          </div>
          <div
            style={{
              fontFamily: "Orbitron, sans-serif",
              fontSize: "0.85rem",
              color: "#f59e0b",
            }}
          >
            5% deducted on all withdrawals
          </div>
        </div>
        {avgApprovalTime && (
          <div style={{ textAlign: "right" }}>
            <div
              style={{
                fontSize: "0.7rem",
                color: "rgba(255,255,255,0.45)",
                fontFamily: "Rajdhani, sans-serif",
              }}
            >
              Avg Approval
            </div>
            <div
              style={{
                fontFamily: "Rajdhani, sans-serif",
                color: "rgba(255,255,255,0.7)",
                fontWeight: 700,
                fontSize: "0.82rem",
              }}
            >
              {avgApprovalTime}
            </div>
          </div>
        )}
      </div>

      <SectionTitle>⏳ Pending Withdrawals ({pending.length})</SectionTitle>
      {pending.length === 0 && (
        <div
          style={{
            color: "rgba(255,255,255,0.35)",
            fontFamily: "Rajdhani, sans-serif",
            fontSize: "0.85rem",
            marginBottom: 12,
          }}
        >
          No pending withdrawals 🎉
        </div>
      )}
      {pending.map((w) => (
        <div
          key={w.id}
          data-ocid={`admin.withdrawals.withdrawal_card.${w.id}`}
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(234,179,8,0.35)",
            borderRadius: 12,
            padding: 12,
            marginBottom: 8,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: 8,
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: "Rajdhani, sans-serif",
                  fontWeight: 700,
                  color: "white",
                  fontSize: "0.9rem",
                }}
              >
                {w.user}
              </div>
              <div
                style={{
                  fontSize: "0.82rem",
                  color: "#ef4444",
                  fontFamily: "Orbitron, sans-serif",
                  fontWeight: 700,
                }}
              >
                ₹{w.amount} → ₹{w.final || Math.floor(w.amount * 0.95)} after 5%
              </div>
              <div
                style={{
                  fontSize: "0.7rem",
                  color: "rgba(255,255,255,0.4)",
                  fontFamily: "Rajdhani, sans-serif",
                }}
              >
                UPI: {w.upiId || "—"} · {fmtTime(w.timestamp)}
              </div>
            </div>
            <span className="status-badge status-pending">Pending</span>
          </div>
          <AdminInput
            value={rejectReason[w.id] || ""}
            onChange={(e: any) =>
              setRejectReason((p) => ({ ...p, [w.id]: e.target.value }))
            }
            placeholder="Reject reason (optional)"
            style={{ marginBottom: 8 }}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <AdminBtn
              onClick={() => approveWithdrawal(w)}
              color="green"
              size="sm"
              data-ocid={`admin.withdrawals.approve.${w.id}`}
            >
              ✅ Approve
            </AdminBtn>
            <AdminBtn
              onClick={() => rejectWithdrawal(w)}
              color="red"
              size="sm"
              data-ocid={`admin.withdrawals.reject.${w.id}`}
            >
              ❌ Reject & Refund
            </AdminBtn>
          </div>
        </div>
      ))}

      {recent.length > 0 && (
        <>
          <SectionTitle>📋 Recent ({recent.length})</SectionTitle>
          {recent.map((w) => (
            <div
              key={w.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "8px 12px",
                background: "rgba(255,255,255,0.02)",
                borderRadius: 8,
                marginBottom: 6,
              }}
            >
              <div>
                <span
                  style={{
                    fontFamily: "Rajdhani, sans-serif",
                    fontSize: "0.85rem",
                    color: "white",
                  }}
                >
                  {w.user}
                </span>
                <span
                  style={{
                    fontSize: "0.7rem",
                    color: "rgba(255,255,255,0.35)",
                    fontFamily: "Rajdhani, sans-serif",
                    marginLeft: 8,
                  }}
                >
                  {fmtTime(w.timestamp)}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    fontFamily: "Orbitron, sans-serif",
                    fontSize: "0.82rem",
                    color: "#ef4444",
                  }}
                >
                  ₹{w.amount}
                </span>
                <span className={`status-badge status-${w.status}`}>
                  {w.status}
                </span>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ─── Revenue Tab ──────────────────────────────────────────────────────────────
function RevenueTab() {
  const [data, setData] = useState({
    collected: 0,
    prizesOut: 0,
    users: 0,
    deposited: 0,
    played: 0,
    withdrew: 0,
    topSpenders: [] as { uid: string; total: number }[],
    netCashToday: 0,
    modeRevenue: {} as Record<string, number>,
    chartData: [] as { label: string; value: number }[],
  });

  useEffect(() => {
    loadRevenue();
  }, []);

  async function loadRevenue() {
    try {
      const [depSnap, matchSnap, withdrawSnap, userSnap] = await Promise.all([
        getDocs(
          query(collection(db, "payments"), where("status", "==", "approved")),
        ),
        getDocs(
          query(collection(db, "matches"), where("status", "==", "completed")),
        ),
        getDocs(
          query(collection(db, "withdraw"), where("status", "==", "approved")),
        ),
        getDocs(collection(db, "users")),
      ]);

      const totalCollected = depSnap.docs.reduce(
        (s, d) => s + (d.data().amount || 0),
        0,
      );
      const totalPrizes = matchSnap.docs.reduce(
        (s, d) => s + (d.data().prizeAwarded || 0),
        0,
      );

      // Mode revenue
      const modeMap: Record<string, number> = {};
      for (const d of matchSnap.docs) {
        const mode = d.data().mode || "Unknown";
        const fee = d.data().entryFee || 0;
        const players = (d.data().players || []).length;
        modeMap[mode] = (modeMap[mode] || 0) + fee * players * 0.1;
      }

      // Top spenders
      const spenderMap: Record<string, number> = {};
      for (const d of depSnap.docs) {
        const u = d.data().user;
        if (u) spenderMap[u] = (spenderMap[u] || 0) + (d.data().amount || 0);
      }
      const topSpenders = Object.entries(spenderMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([uid, total]) => ({ uid, total }));

      // Today's net cash
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayDep = depSnap.docs
        .filter((d) => {
          try {
            const ts = d.data().timestamp;
            const dt = ts?.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
            return dt >= today;
          } catch {
            return false;
          }
        })
        .reduce((s, d) => s + (d.data().amount || 0), 0);
      const todayWith = withdrawSnap.docs
        .filter((d) => {
          try {
            const ts = d.data().timestamp;
            const dt = ts?.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
            return dt >= today;
          } catch {
            return false;
          }
        })
        .reduce((s, d) => s + (d.data().amount || 0), 0);

      // Chart - last 7 days revenue (entry fee × 10% admin cut)
      const days: { label: string; value: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        d.setHours(0, 0, 0, 0);
        const de = new Date(d);
        de.setHours(23, 59, 59, 999);
        const dayProfit = matchSnap.docs
          .filter((doc) => {
            try {
              const ts = doc.data().timestamp;
              const dt = ts?.seconds
                ? new Date(ts.seconds * 1000)
                : new Date(ts);
              return dt >= d && dt <= de;
            } catch {
              return false;
            }
          })
          .reduce((s, doc) => {
            const fee = doc.data().entryFee || 0;
            const players = (doc.data().players || []).length;
            return s + fee * players * 0.1;
          }, 0);
        days.push({
          label: d.toLocaleDateString("en", { weekday: "short" }).slice(0, 3),
          value: dayProfit,
        });
      }

      // Conversion funnel
      const usersWithDep = new Set(depSnap.docs.map((d) => d.data().user)).size;
      const usersPlayed = new Set(
        matchSnap.docs.flatMap((d) => d.data().players || []),
      ).size;
      const usersWithdrew = new Set(withdrawSnap.docs.map((d) => d.data().user))
        .size;

      setData({
        collected: totalCollected,
        prizesOut: totalPrizes,
        users: userSnap.size,
        deposited: usersWithDep,
        played: usersPlayed,
        withdrew: usersWithdrew,
        topSpenders,
        netCashToday: todayDep - todayWith,
        modeRevenue: modeMap,
        chartData: days,
      });
    } catch {
      /* silent */
    }
  }

  const netProfit = data.collected - data.prizesOut;

  return (
    <div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
          marginBottom: 16,
        }}
      >
        <div
          style={{
            background: "rgba(0,200,100,0.08)",
            border: "1px solid rgba(0,200,100,0.4)",
            borderRadius: 12,
            padding: "14px",
            gridColumn: "span 2",
          }}
        >
          <div
            style={{
              fontSize: "0.65rem",
              color: "rgba(255,255,255,0.45)",
              fontFamily: "Rajdhani, sans-serif",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
            }}
          >
            Total Collected
          </div>
          <div
            style={{
              fontFamily: "Orbitron, sans-serif",
              fontSize: "1.6rem",
              fontWeight: 900,
              color: "#00c864",
            }}
          >
            ₹{data.collected}
          </div>
          <div
            style={{
              fontSize: "0.7rem",
              color: "rgba(0,200,100,0.6)",
              fontFamily: "Rajdhani, sans-serif",
              marginTop: 2,
            }}
          >
            All approved deposits
          </div>
        </div>
        <StatWidget
          icon="🏆"
          label="Prizes Paid Out"
          value={`₹${data.prizesOut}`}
          color="#ff6b00"
        />
        <div
          style={{
            background: "rgba(0,200,100,0.06)",
            border: "2px solid #00c864",
            borderRadius: 12,
            padding: "12px 14px",
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          <div
            style={{
              fontSize: "0.7rem",
              color: "rgba(0,200,100,0.7)",
              fontFamily: "Rajdhani, sans-serif",
              textTransform: "uppercase",
            }}
          >
            Net Platform Profit
          </div>
          <div
            style={{
              fontFamily: "Orbitron, sans-serif",
              fontSize: "1.1rem",
              fontWeight: 700,
              color: "#00c864",
            }}
          >
            ₹{Math.max(0, netProfit)}
          </div>
          <div
            style={{
              fontSize: "0.62rem",
              color: "rgba(255,255,255,0.3)",
              fontFamily: "Rajdhani, sans-serif",
            }}
          >
            Always 10% of every match
          </div>
        </div>
        <StatWidget
          icon="📈"
          label="Today Net Cash"
          value={`₹${data.netCashToday}`}
          color={data.netCashToday >= 0 ? "#00c864" : "#ef4444"}
        />
      </div>

      {/* 10% Commission note */}
      <div
        style={{
          background: "rgba(255,107,0,0.06)",
          border: "1px solid rgba(255,107,0,0.2)",
          borderRadius: 10,
          padding: "10px 14px",
          marginBottom: 14,
        }}
      >
        <div
          style={{
            fontFamily: "Rajdhani, sans-serif",
            fontSize: "0.82rem",
            color: "rgba(255,255,255,0.6)",
          }}
        >
          💡 <strong style={{ color: "white" }}>10% Admin Commission</strong> is
          auto-deducted from every match prize pool before payout. Winner always
          gets 90%.
        </div>
      </div>

      {/* 7-day chart */}
      {data.chartData.length > 0 && (
        <div
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,107,0,0.2)",
            borderRadius: 12,
            padding: 14,
            marginBottom: 14,
          }}
        >
          <SectionTitle>7-Day Profit (10% commissions)</SectionTitle>
          <BarChart data={data.chartData} color="#00c864" />
        </div>
      )}

      {/* Mode Revenue */}
      {Object.keys(data.modeRevenue).length > 0 && (
        <div
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,107,0,0.2)",
            borderRadius: 12,
            padding: 14,
            marginBottom: 14,
          }}
        >
          <SectionTitle>Revenue by Game Mode</SectionTitle>
          {Object.entries(data.modeRevenue)
            .sort((a, b) => b[1] - a[1])
            .map(([mode, rev]) => (
              <div
                key={mode}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "6px 0",
                  borderBottom: "1px solid rgba(255,255,255,0.04)",
                  fontFamily: "Rajdhani, sans-serif",
                }}
              >
                <span
                  style={{
                    color: "rgba(255,255,255,0.7)",
                    fontSize: "0.85rem",
                  }}
                >
                  {mode}
                </span>
                <span style={{ color: "#00c864", fontWeight: 700 }}>
                  ₹{rev.toFixed(0)}
                </span>
              </div>
            ))}
        </div>
      )}

      {/* Conversion Funnel */}
      <div
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,107,0,0.2)",
          borderRadius: 12,
          padding: 14,
          marginBottom: 14,
        }}
      >
        <SectionTitle>Conversion Funnel</SectionTitle>
        {[
          { label: "Total Signups", value: data.users, pct: 100 },
          {
            label: "Made Deposit",
            value: data.deposited,
            pct: data.users
              ? Math.round((data.deposited / data.users) * 100)
              : 0,
          },
          {
            label: "Played Match",
            value: data.played,
            pct: data.users ? Math.round((data.played / data.users) * 100) : 0,
          },
          {
            label: "Requested Withdrawal",
            value: data.withdrew,
            pct: data.users
              ? Math.round((data.withdrew / data.users) * 100)
              : 0,
          },
        ].map((row) => (
          <div
            key={row.label}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "6px 0",
              borderBottom: "1px solid rgba(255,255,255,0.04)",
            }}
          >
            <span
              style={{
                fontFamily: "Rajdhani, sans-serif",
                fontSize: "0.85rem",
                color: "rgba(255,255,255,0.7)",
              }}
            >
              {row.label}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  width: 60,
                  height: 6,
                  background: "rgba(255,255,255,0.1)",
                  borderRadius: 3,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${row.pct}%`,
                    height: "100%",
                    background: "#ff6b00",
                    borderRadius: 3,
                  }}
                />
              </div>
              <span
                style={{
                  fontFamily: "Orbitron, sans-serif",
                  fontSize: "0.75rem",
                  color: "white",
                  minWidth: 40,
                  textAlign: "right",
                }}
              >
                {row.value}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Top Spenders */}
      {data.topSpenders.length > 0 && (
        <div
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,107,0,0.2)",
            borderRadius: 12,
            padding: 14,
          }}
        >
          <SectionTitle>🏅 Top 5 Spenders</SectionTitle>
          {data.topSpenders.map((s, i) => (
            <div
              key={s.uid}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "6px 0",
                borderBottom: "1px solid rgba(255,255,255,0.04)",
              }}
            >
              <span
                style={{
                  fontFamily: "Rajdhani, sans-serif",
                  fontSize: "0.85rem",
                  color: "rgba(255,255,255,0.7)",
                }}
              >
                {i + 1}. {s.uid}
              </span>
              <span
                style={{
                  fontFamily: "Orbitron, sans-serif",
                  fontSize: "0.8rem",
                  color: "#ffd700",
                }}
              >
                ₹{s.total}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Announcements Tab ────────────────────────────────────────────────────────
function AnnouncementsTab({
  showToast,
}: { showToast: (m: string, t?: "success" | "error") => void }) {
  const [text, setText] = useState("");
  const [category, setCategory] = useState("General");
  const [pinned, setPinned] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [preview, setPreview] = useState(false);
  const [recent, setRecent] = useState<any[]>([]);

  const templates = [
    {
      label: "Deposit Approved",
      text: "✅ Your deposit has been approved! Coins added to wallet.",
    },
    {
      label: "Match Starting",
      text: "🔥 Your match is starting soon! Check Room ID in Match History.",
    },
    {
      label: "Winner Announced",
      text: "🏆 Match completed! Winner has been declared. Check notifications.",
    },
  ];

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "messages"), orderBy("timestamp", "desc")),
      (snap) => {
        setRecent(
          snap.docs.slice(0, 20).map((d) => ({ id: d.id, ...d.data() })),
        );
      },
    );
    return () => unsub();
  }, []);

  async function sendAnnouncement() {
    if (!text.trim()) {
      showToast("Type a message first", "error");
      return;
    }
    try {
      await addDoc(collection(db, "messages"), {
        text: text.trim(),
        category,
        pinned,
        imageUrl: imageUrl.trim() || null,
        senderId: "admin",
        senderName: "MR.SONIC FF Admin",
        timestamp: new Date(),
        time: new Date().toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        date: new Date().toLocaleDateString("en-IN"),
      });
      showToast("Announcement sent to all players 📢");
      setText("");
      setImageUrl("");
      setPinned(false);
      setPreview(false);
    } catch {
      showToast("Error sending", "error");
    }
  }

  return (
    <div>
      {/* Templates */}
      <div style={{ marginBottom: 12 }}>
        <SectionTitle>Quick Templates</SectionTitle>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {templates.map((t) => (
            <button
              key={t.label}
              type="button"
              onClick={() => setText(t.text)}
              style={{
                background: "rgba(255,107,0,0.1)",
                border: "1px solid rgba(255,107,0,0.3)",
                borderRadius: 8,
                padding: "5px 10px",
                color: "white",
                fontFamily: "Rajdhani, sans-serif",
                fontSize: "0.75rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div
        style={{
          background: "rgba(255,107,0,0.06)",
          border: "1px solid rgba(255,107,0,0.25)",
          borderRadius: 12,
          padding: 14,
          marginBottom: 14,
        }}
      >
        <SectionTitle>📢 New Announcement</SectionTitle>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type your announcement..."
          rows={3}
          data-ocid="admin.announcements.message_input"
          style={{
            width: "100%",
            padding: "10px 12px",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,107,0,0.3)",
            borderRadius: 8,
            color: "white",
            fontFamily: "Rajdhani, sans-serif",
            fontSize: "0.9rem",
            resize: "none",
            outline: "none",
            marginBottom: 8,
          }}
        />
        {/* Emoji picker */}
        <div
          style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}
        >
          {EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setText((p) => p + e)}
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "none",
                borderRadius: 6,
                padding: "4px 7px",
                fontSize: "0.9rem",
                cursor: "pointer",
              }}
            >
              {e}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <AdminSelect
            value={category}
            onChange={setCategory}
            options={["General", "Match Info", "Payment", "Alert"].map((v) => ({
              value: v,
              label: v,
            }))}
            style={{ flex: 1 }}
          />
        </div>
        <AdminInput
          value={imageUrl}
          onChange={(e: any) => setImageUrl(e.target.value)}
          placeholder="Image URL (optional)"
          style={{ marginBottom: 8 }}
        />
        <div
          style={{
            display: "flex",
            gap: 10,
            marginBottom: 10,
            alignItems: "center",
          }}
        >
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: "0.82rem",
              color: "rgba(255,255,255,0.65)",
              fontFamily: "Rajdhani, sans-serif",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={pinned}
              onChange={(e) => setPinned(e.target.checked)}
            />
            Pin to top
          </label>
          <AdminBtn
            onClick={() => setPreview((p) => !p)}
            color="ghost"
            size="sm"
          >
            👁 Preview
          </AdminBtn>
        </div>

        {preview && text && (
          <div
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,107,0,0.3)",
              borderRadius: 12,
              padding: 12,
              marginBottom: 10,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg,#ff6b00,#cc5500)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.9rem",
                }}
              >
                🎮
              </div>
              <div>
                <div
                  style={{
                    fontFamily: "Rajdhani, sans-serif",
                    fontWeight: 700,
                    fontSize: "0.85rem",
                    color: "white",
                  }}
                >
                  MR.SONIC FF Admin
                </div>
                <span
                  style={{
                    fontSize: "0.65rem",
                    background: "rgba(255,107,0,0.2)",
                    color: "#ff9a00",
                    borderRadius: 4,
                    padding: "1px 5px",
                    fontFamily: "Rajdhani, sans-serif",
                  }}
                >
                  {category}
                </span>
              </div>
              {pinned && (
                <span
                  style={{
                    marginLeft: "auto",
                    fontSize: "0.7rem",
                    color: "#ffd700",
                  }}
                >
                  📌 Pinned
                </span>
              )}
            </div>
            {imageUrl && (
              <img
                src={imageUrl}
                alt=""
                style={{
                  width: "100%",
                  borderRadius: 8,
                  marginBottom: 8,
                  maxHeight: 120,
                  objectFit: "cover",
                }}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            )}
            <div
              style={{
                fontFamily: "Rajdhani, sans-serif",
                fontSize: "0.88rem",
                color: "rgba(255,255,255,0.85)",
              }}
            >
              {text}
            </div>
          </div>
        )}

        <AdminBtn
          onClick={sendAnnouncement}
          color="orange"
          size="lg"
          data-ocid="admin.announcements.send_button"
        >
          📢 SEND TO ALL PLAYERS
        </AdminBtn>
      </div>

      {/* Recent */}
      <SectionTitle>📋 Recent Announcements</SectionTitle>
      {recent.length === 0 && (
        <div
          style={{
            color: "rgba(255,255,255,0.35)",
            fontFamily: "Rajdhani, sans-serif",
            fontSize: "0.85rem",
          }}
        >
          No announcements yet
        </div>
      )}
      {recent.map((msg) => (
        <div
          key={msg.id}
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,107,0,0.18)",
            borderRadius: 10,
            padding: "10px 12px",
            marginBottom: 6,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 4,
            }}
          >
            <span
              style={{
                fontSize: "0.65rem",
                background: "rgba(255,107,0,0.15)",
                color: "#ff9a00",
                borderRadius: 4,
                padding: "1px 5px",
                fontFamily: "Rajdhani, sans-serif",
              }}
            >
              {msg.category || "General"}
            </span>
            <span
              style={{
                fontSize: "0.65rem",
                color: "rgba(255,255,255,0.3)",
                fontFamily: "Rajdhani, sans-serif",
              }}
            >
              {msg.time} {msg.date}
            </span>
          </div>
          <div
            style={{
              fontFamily: "Rajdhani, sans-serif",
              fontSize: "0.85rem",
              color: "rgba(255,255,255,0.75)",
            }}
          >
            {msg.text}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Message Box Tab ──────────────────────────────────────────────────────────
function MessageBoxTab({
  showToast,
}: { showToast: (m: string, t?: "success" | "error") => void }) {
  const [targetUid, setTargetUid] = useState("");
  const [message, setMessage] = useState("");
  const [recentDMs, setRecentDMs] = useState<any[]>([]);
  const [userSuggestions, setUserSuggestions] = useState<
    { uid: string; name: string; phone: string }[]
  >([]);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "directMessages"), orderBy("timestamp", "desc")),
      (snap) => {
        setRecentDMs(
          snap.docs.slice(0, 30).map((d) => ({ id: d.id, ...d.data() })),
        );
      },
    );
    loadUsers();
    return () => unsub();
  }, []);

  async function loadUsers() {
    try {
      const snap = await getDocs(collection(db, "users"));
      setUserSuggestions(
        snap.docs
          .filter((d) => d.id !== "admin")
          .map((d) => ({
            uid: d.id,
            name: d.data().displayName || d.id,
            phone: d.data().phone || "",
          })),
      );
    } catch {}
  }

  async function sendMessage() {
    if (!targetUid.trim() || !message.trim()) {
      showToast("Select player and type message", "error");
      return;
    }
    try {
      await addDoc(collection(db, "directMessages"), {
        toUid: targetUid.trim(),
        fromUid: "admin",
        message: message.trim(),
        timestamp: new Date(),
        read: false,
      });
      await addDoc(collection(db, "notifications"), {
        uid: targetUid.trim(),
        title: "📨 Message from Admin",
        message: message.trim(),
        read: false,
        timestamp: new Date(),
      });
      showToast(`Message sent to ${targetUid} 📨`);
      setMessage("");
    } catch {
      showToast("Error", "error");
    }
  }

  return (
    <div>
      <div
        style={{
          background: "rgba(99,102,241,0.06)",
          border: "1px solid rgba(99,102,241,0.3)",
          borderRadius: 12,
          padding: 14,
          marginBottom: 16,
        }}
      >
        <SectionTitle>📨 Send Direct Message</SectionTitle>
        <div style={{ marginBottom: 8 }}>
          <AdminInput
            value={targetUid}
            onChange={(e: any) => setTargetUid(e.target.value)}
            placeholder="Player UID"
            style={{ marginBottom: 6 }}
          />
          {/* Player suggestions */}
          {targetUid && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {userSuggestions
                .filter(
                  (u) =>
                    u.uid.includes(targetUid) ||
                    u.name.toLowerCase().includes(targetUid.toLowerCase()),
                )
                .slice(0, 4)
                .map((u) => (
                  <button
                    key={u.uid}
                    type="button"
                    onClick={() => setTargetUid(u.uid)}
                    style={{
                      background: "rgba(99,102,241,0.15)",
                      border: "1px solid rgba(99,102,241,0.3)",
                      borderRadius: 6,
                      padding: "4px 10px",
                      color: "white",
                      fontFamily: "Rajdhani, sans-serif",
                      fontSize: "0.75rem",
                      cursor: "pointer",
                    }}
                  >
                    {u.name} ({u.uid}){" "}
                    <span style={{ color: "#ff9a00" }}>📱 {u.phone}</span>
                  </button>
                ))}
            </div>
          )}
        </div>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type your message..."
          rows={3}
          data-ocid="admin.messagebox.message_input"
          style={{
            width: "100%",
            padding: "10px 12px",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(99,102,241,0.3)",
            borderRadius: 8,
            color: "white",
            fontFamily: "Rajdhani, sans-serif",
            fontSize: "0.9rem",
            resize: "none",
            outline: "none",
            marginBottom: 8,
          }}
        />
        <AdminBtn
          onClick={sendMessage}
          color="blue"
          size="lg"
          data-ocid="admin.messagebox.send_button"
        >
          📨 Send Message
        </AdminBtn>
      </div>

      <SectionTitle>📋 Recent DMs ({recentDMs.length})</SectionTitle>
      {recentDMs.length === 0 && (
        <div
          style={{
            color: "rgba(255,255,255,0.35)",
            fontFamily: "Rajdhani, sans-serif",
            fontSize: "0.85rem",
          }}
        >
          No messages yet
        </div>
      )}
      {recentDMs.map((dm) => (
        <div
          key={dm.id}
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(99,102,241,0.2)",
            borderRadius: 10,
            padding: "10px 12px",
            marginBottom: 6,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 4,
            }}
          >
            <span
              style={{
                fontFamily: "Rajdhani, sans-serif",
                fontWeight: 700,
                fontSize: "0.85rem",
                color: "#818cf8",
              }}
            >
              → {dm.toUid}
            </span>
            <span
              style={{
                fontSize: "0.65rem",
                color: "rgba(255,255,255,0.3)",
                fontFamily: "Rajdhani, sans-serif",
              }}
            >
              {fmtTime(dm.timestamp)}
            </span>
          </div>
          <div
            style={{
              fontFamily: "Rajdhani, sans-serif",
              fontSize: "0.85rem",
              color: "rgba(255,255,255,0.7)",
            }}
          >
            {dm.message}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Reports Tab ──────────────────────────────────────────────────────────────
function ReportsTab({
  showToast,
}: { showToast: (m: string, t?: "success" | "error") => void }) {
  const [reports, setReports] = useState<Report[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "reports"), (snap) => {
      setReports(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Report[]);
    });
    return () => unsub();
  }, []);

  // Group by reported UID to count reports
  const reportCounts: Record<string, number> = {};
  for (const r of reports) {
    reportCounts[r.reportedUid] = (reportCounts[r.reportedUid] || 0) + 1;
  }

  async function banReported(r: Report) {
    try {
      await updateDoc(doc(db, "users", r.reportedUid), {
        blocked: true,
        banReason: `Reported by ${r.reporterUid}: ${r.reason}`,
      });
      await addDoc(collection(db, "notifications"), {
        uid: r.reportedUid,
        title: "🚫 Account Banned",
        message: `Your account was banned. Reason: ${r.reason}`,
        read: false,
        timestamp: new Date(),
      });
      showToast(`${r.reportedUid} banned`);
    } catch {
      showToast("Error", "error");
    }
  }

  async function dismissReport(id: string) {
    try {
      await deleteDoc(doc(db, "reports", id));
      showToast("Report dismissed");
    } catch {
      showToast("Error", "error");
    }
  }

  return (
    <div>
      <div
        style={{
          background: "rgba(239,68,68,0.06)",
          border: "1px solid rgba(239,68,68,0.2)",
          borderRadius: 10,
          padding: "10px 14px",
          marginBottom: 14,
        }}
      >
        <div
          style={{
            fontFamily: "Rajdhani, sans-serif",
            fontSize: "0.82rem",
            color: "rgba(255,255,255,0.6)",
          }}
        >
          ⚠️{" "}
          <strong style={{ color: "white" }}>
            Auto-flag threshold: 5 reports.
          </strong>{" "}
          Users with 5+ reports are highlighted in red.
        </div>
      </div>

      <SectionTitle>🚩 Player Reports ({reports.length})</SectionTitle>
      {reports.length === 0 && (
        <div
          style={{
            color: "rgba(255,255,255,0.35)",
            fontFamily: "Rajdhani, sans-serif",
            fontSize: "0.85rem",
          }}
        >
          No reports 🎉
        </div>
      )}
      {reports.map((r) => {
        const count = reportCounts[r.reportedUid] || 0;
        const isAutoFlag = count >= 5;
        return (
          <div
            key={r.id}
            data-ocid={`admin.reports.report_card.${r.id}`}
            style={{
              background: isAutoFlag
                ? "rgba(239,68,68,0.08)"
                : "rgba(255,255,255,0.03)",
              border: `1px solid ${isAutoFlag ? "rgba(239,68,68,0.5)" : "rgba(255,107,0,0.2)"}`,
              borderRadius: 12,
              padding: 12,
              marginBottom: 8,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: 8,
              }}
            >
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    marginBottom: 3,
                  }}
                >
                  <span
                    style={{
                      fontFamily: "Rajdhani, sans-serif",
                      fontWeight: 700,
                      color: "white",
                      fontSize: "0.9rem",
                    }}
                  >
                    Reported: {r.reportedUid}
                  </span>
                  {isAutoFlag && (
                    <span
                      style={{
                        fontSize: "0.6rem",
                        background: "rgba(239,68,68,0.3)",
                        color: "#ef4444",
                        borderRadius: 4,
                        padding: "1px 5px",
                        fontFamily: "Rajdhani, sans-serif",
                      }}
                    >
                      ⚠️ AUTO-FLAG
                    </span>
                  )}
                </div>
                <div
                  style={{
                    fontSize: "0.75rem",
                    color: "rgba(255,255,255,0.5)",
                    fontFamily: "Rajdhani, sans-serif",
                  }}
                >
                  Reporter: {r.reporterUid} · {fmtTime(r.timestamp)}
                </div>
                <div
                  style={{
                    fontSize: "0.82rem",
                    color: "rgba(255,255,255,0.7)",
                    fontFamily: "Rajdhani, sans-serif",
                    marginTop: 4,
                  }}
                >
                  📋 {r.reason}
                </div>
                <div
                  style={{
                    fontSize: "0.7rem",
                    color: isAutoFlag ? "#ef4444" : "rgba(255,255,255,0.35)",
                    fontFamily: "Rajdhani, sans-serif",
                    marginTop: 2,
                  }}
                >
                  Total reports on this user: {count}{" "}
                  {isAutoFlag
                    ? "(auto-flag at 5)"
                    : `(auto-flag at ${5 - count} more)`}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <AdminBtn
                onClick={() => banReported(r)}
                color="red"
                size="sm"
                data-ocid={`admin.reports.ban.${r.id}`}
              >
                🚫 Ban User
              </AdminBtn>
              <AdminBtn
                onClick={() => dismissReport(r.id)}
                color="ghost"
                size="sm"
                data-ocid={`admin.reports.dismiss.${r.id}`}
              >
                ✓ Dismiss
              </AdminBtn>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main AdminView ───────────────────────────────────────────────────────────
export function AdminView({
  user,
  onNavigate,
}: { user: any; onNavigate: (view: string) => void }) {
  const [activeTab, setActiveTab] = useState<AdminTab>("dashboard");
  const [toast, setToast] = useState<{
    msg: string;
    type: "success" | "error";
  } | null>(null);

  // Guard: access denied
  if (!user || (user.isAdmin !== true && user.uid !== "admin")) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a1a",
          padding: 24,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: "3rem", marginBottom: 16 }}>🚫</div>
        <div
          style={{
            fontFamily: "Orbitron, sans-serif",
            fontSize: "1rem",
            color: "#ef4444",
            marginBottom: 8,
          }}
        >
          ACCESS DENIED
        </div>
        <div
          style={{
            fontFamily: "Rajdhani, sans-serif",
            color: "rgba(255,255,255,0.5)",
            fontSize: "0.85rem",
            marginBottom: 24,
          }}
        >
          Admin privileges required
        </div>
        <button
          type="button"
          onClick={() => onNavigate("dashboard")}
          style={{
            padding: "10px 24px",
            background: "linear-gradient(135deg,#ff6b00,#cc5500)",
            border: "none",
            borderRadius: 10,
            color: "white",
            fontFamily: "Orbitron, sans-serif",
            fontSize: "0.78rem",
            cursor: "pointer",
          }}
        >
          ← Go Back
        </button>
      </div>
    );
  }

  function showToast(msg: string, type: "success" | "error" = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  const TABS: { id: AdminTab; label: string; icon: string }[] = [
    { id: "dashboard", label: "Dashboard", icon: "📊" },
    { id: "users", label: "Users", icon: "👥" },
    { id: "matches", label: "Matches", icon: "⚔️" },
    { id: "deposits", label: "Deposits", icon: "📥" },
    { id: "withdrawals", label: "Withdrawals", icon: "📤" },
    { id: "revenue", label: "Revenue", icon: "💰" },
    { id: "announcements", label: "Announcements", icon: "📢" },
    { id: "messagebox", label: "Message Box", icon: "📨" },
    { id: "reports", label: "Reports", icon: "🚩" },
  ];

  return (
    <div
      data-ocid="admin.panel"
      style={{
        minHeight: "100vh",
        background: "#0a0a1a",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            style={{
              position: "fixed",
              top: 70,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 9999,
              background:
                toast.type === "success"
                  ? "rgba(20,50,30,0.97)"
                  : "rgba(50,15,15,0.97)",
              border:
                toast.type === "success"
                  ? "1px solid rgba(34,197,94,0.5)"
                  : "1px solid rgba(239,68,68,0.5)",
              color: "white",
              padding: "11px 22px",
              borderRadius: 12,
              fontFamily: "Rajdhani, sans-serif",
              fontWeight: 700,
              fontSize: "0.9rem",
              maxWidth: "90%",
              textAlign: "center",
              backdropFilter: "blur(16px)",
            }}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Admin Header */}
      <div
        style={{
          background:
            "linear-gradient(135deg, rgba(255,107,0,0.15), rgba(10,10,26,0.95))",
          borderBottom: "2px solid #ff6b00",
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}
      >
        <button
          type="button"
          onClick={() => onNavigate("admin-dashboard")}
          style={{
            background: "rgba(255,107,0,0.15)",
            border: "1px solid rgba(255,107,0,0.3)",
            borderRadius: 8,
            padding: "6px 10px",
            color: "white",
            cursor: "pointer",
            fontSize: "0.85rem",
          }}
        >
          ←
        </button>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontFamily: "Orbitron, sans-serif",
              fontSize: "0.82rem",
              fontWeight: 700,
              color: "white",
              letterSpacing: "0.05em",
            }}
          >
            🔐 ADMIN PANEL ⚡
          </div>
          <div
            style={{
              fontSize: "0.65rem",
              color: "rgba(255,107,0,0.7)",
              fontFamily: "Rajdhani, sans-serif",
            }}
          >
            MR.SONIC FF — Full Control
          </div>
        </div>
        <button
          type="button"
          onClick={() => onNavigate("dashboard")}
          data-ocid="admin.panel.exit_button"
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 8,
            padding: "6px 12px",
            color: "rgba(255,255,255,0.6)",
            fontFamily: "Rajdhani, sans-serif",
            fontSize: "0.78rem",
            cursor: "pointer",
          }}
        >
          Exit
        </button>
      </div>

      {/* Tab Bar */}
      <div
        style={{
          display: "flex",
          gap: 6,
          padding: "10px 14px",
          overflowX: "auto",
          borderBottom: "1px solid rgba(255,107,0,0.15)",
          WebkitOverflowScrolling: "touch",
          background: "rgba(10,10,26,0.8)",
          position: "sticky",
          top: 55,
          zIndex: 40,
        }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            data-ocid={`admin.tabs.${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            style={{
              whiteSpace: "nowrap",
              padding: "7px 14px",
              background:
                activeTab === tab.id
                  ? "rgba(255,107,0,0.2)"
                  : "rgba(255,255,255,0.05)",
              border: `1px solid ${activeTab === tab.id ? "#ff6b00" : "rgba(255,107,0,0.2)"}`,
              borderRadius: 20,
              color:
                activeTab === tab.id ? "#ffffff" : "rgba(255,255,255,0.55)",
              fontSize: "0.75rem",
              fontFamily: "Rajdhani, sans-serif",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s",
              flexShrink: 0,
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
          padding: "14px 14px 40px",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === "dashboard" && (
              <DashboardTab showToast={showToast} />
            )}
            {activeTab === "users" && <UsersTab showToast={showToast} />}
            {activeTab === "matches" && <MatchesTab showToast={showToast} />}
            {activeTab === "deposits" && <DepositsTab showToast={showToast} />}
            {activeTab === "withdrawals" && (
              <WithdrawalsTab showToast={showToast} />
            )}
            {activeTab === "revenue" && <RevenueTab />}
            {activeTab === "announcements" && (
              <AnnouncementsTab showToast={showToast} />
            )}
            {activeTab === "messagebox" && (
              <MessageBoxTab showToast={showToast} />
            )}
            {activeTab === "reports" && <ReportsTab showToast={showToast} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

export default AdminView;
