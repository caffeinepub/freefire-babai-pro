import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import {
  ArrowLeft,
  Bell,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Edit3,
  Flag,
  History,
  Home,
  LogOut,
  MessageSquare,
  Moon,
  Sun,
  Swords,
  Trophy,
  User,
  Users,
  Wallet,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { db } from "./firebase";

// ─── Types ────────────────────────────────────────────────────────────────────
type View =
  | "splash"
  | "login"
  | "signup"
  | "forgot-password"
  | "blocked"
  | "dashboard"
  | "profile"
  | "profile-edit"
  | "deposit-history"
  | "withdraw-history"
  | "match-history"
  | "leaderboard"
  | "notifications"
  | "chat-support"
  | "report-problem"
  | "admin-dashboard"
  | "admin-users"
  | "admin-matches"
  | "admin-payments"
  | "admin-withdrawals"
  | "admin-announcements"
  | "admin-complaints"
  | "admin-chat"
  | "admin-logs";

type NavTab = "home" | "matches" | "leaderboard" | "notifications" | "profile";

interface UserData {
  uid: string;
  pass: string;
  displayName: string;
  phone: string;
  inGameName?: string;
  wins: number;
  kills: number;
  matchesPlayed: number;
  coins: number;
  blocked: boolean;
}

interface MatchData {
  id: string;
  player: string;
  mode: string;
  status: string;
  entryFee: number;
  prizePool: number;
  roomId: string;
  roomPass: string;
  timestamp: unknown;
  startedAt?: number;
  players?: string[];
  maxPlayers?: number;
}

interface PaymentData {
  id: string;
  user: string;
  utr: string;
  amount: number;
  status: string;
}

interface WithdrawData {
  id: string;
  user: string;
  amount: number;
  final: number;
  status: string;
}

interface NotifData {
  id: string;
  uid: string;
  title: string;
  message: string;
  timestamp: unknown;
  read: boolean;
}

interface LeaderboardEntry {
  uid: string;
  displayName: string;
  coins: number;
  wins: number;
}

const GAME_MODES = [
  {
    id: "1v1",
    maxPlayers: 2,
    label: "1v1 Match",
    emoji: "⚔️",
    entryFee: 25,
    prizePool: 40,
    desc: "Solo vs Solo",
    poster: "/assets/generated/poster-1v1.dim_320x180.jpg",
  },
  {
    id: "2v2",
    maxPlayers: 4,
    label: "2v2 Match",
    emoji: "🤝",
    entryFee: 50,
    prizePool: 90,
    desc: "Duo Battle",
    poster: "/assets/generated/poster-2v2.dim_320x180.jpg",
  },
  {
    id: "squad",
    maxPlayers: 8,
    label: "Squad 4v4",
    emoji: "🛡️",
    entryFee: 100,
    prizePool: 360,
    desc: "4-Player War",
    poster: "/assets/generated/poster-squad-4v4.dim_320x180.jpg",
    isSquadMode: true,
  },
  {
    id: "clash",
    maxPlayers: 8,
    label: "Clash Squad",
    emoji: "💥",
    entryFee: 25,
    prizePool: 200,
    desc: "4v4 Squad Battle",
    poster: "/assets/generated/poster-clash.dim_320x180.jpg",
    isSquadMode: true,
  },
  {
    id: "br-solo",
    maxPlayers: 12,
    label: "BR Solo",
    emoji: "🎯",
    entryFee: 20,
    prizePool: 35,
    perKill: 3,
    winnerBonus: 20,
    desc: "Battle Royale Solo",
    poster: "/assets/generated/poster-br-solo.dim_320x180.jpg",
  },
  {
    id: "br-duo",
    maxPlayers: 12,
    label: "BR Duo",
    emoji: "🎮",
    entryFee: 40,
    prizePool: 70,
    perKill: 5,
    winnerBonus: 30,
    desc: "Battle Royale Duo",
    poster: "/assets/generated/poster-br-duo.dim_320x180.jpg",
  },
  {
    id: "br-squad",
    maxPlayers: 12,
    label: "BR Squad",
    emoji: "🏆",
    entryFee: 80,
    prizePool: 300,
    perKill: 6,
    winnerBonus: 80,
    desc: "Battle Royale Squad",
    poster: "/assets/generated/poster-br-squad.dim_320x180.jpg",
  },
  {
    id: "highstakes",
    maxPlayers: 2,
    label: "High Stakes",
    emoji: "💎",
    entryFee: 200,
    prizePool: 360,
    desc: "Big Money Match",
    poster: "/assets/generated/poster-highstakes.dim_320x180.jpg",
  },
];

// ─── Loading Overlay ──────────────────────────────────────────────────────────
function LoadingOverlay() {
  return (
    <div className="loading-overlay" data-ocid="app.loading_state">
      <div>
        <div className="spinner" style={{ margin: "0 auto 16px" }} />
        <p
          style={{
            color: "rgba(255,255,255,0.6)",
            fontSize: "0.85rem",
            textAlign: "center",
            margin: 0,
            fontFamily: "Rajdhani, sans-serif",
          }}
        >
          Loading...
        </p>
      </div>
    </div>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────
function Footer() {
  const year = new Date().getFullYear();
  const utm = `https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`;
  return (
    <div className="footer-text">
      © {year}. Built with ❤️ using{" "}
      <a href={utm} target="_blank" rel="noopener noreferrer">
        caffeine.ai
      </a>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [view, setView] = useState<View>("splash");
  const [activeTab, setActiveTab] = useState<NavTab>("home");
  const [isLoading, setIsLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [liveCount, setLiveCount] = useState(0);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [coins, setCoins] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [toast, setToast] = useState<{
    msg: string;
    type: "success" | "error";
  } | null>(null);
  const [selectedMode, setSelectedMode] = useState<
    (typeof GAME_MODES)[0] | null
  >(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const notifPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Theme init
  useEffect(() => {
    const saved = localStorage.getItem("ff_darkmode");
    const isDark = saved === null ? true : saved === "true";
    setDarkMode(isDark);
    document.body.classList.toggle("light-mode", !isDark);
  }, []);

  // ── Online/offline
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // ── Splash
  useEffect(() => {
    // Auto-create admin account if not exists
    const seedAdmin = async () => {
      try {
        const adminRef = doc(db, "users", "admin");
        const adminSnap = await getDoc(adminRef);
        if (!adminSnap.exists()) {
          await setDoc(adminRef, {
            uid: "admin",
            pass: "admin123",
            displayName: "Admin",
            role: "admin",
          });
          await setDoc(doc(db, "wallet", "admin"), { coins: 0 });
        }
      } catch (_e) {
        /* silent */
      }
    };
    seedAdmin();
    const t = setTimeout(() => setView("login"), 2500);
    return () => clearTimeout(t);
  }, []);

  // ── Toast helper
  const showToast = useCallback(
    (msg: string, type: "success" | "error" = "success") => {
      setToast({ msg, type });
      setTimeout(() => setToast(null), 3000);
    },
    [],
  );

  // ── Toggle theme
  const toggleTheme = () => {
    const next = !darkMode;
    setDarkMode(next);
    document.body.classList.toggle("light-mode", !next);
    localStorage.setItem("ff_darkmode", String(next));
  };

  // ── Load wallet
  const loadWallet = useCallback(async (uid: string) => {
    try {
      const snap = await getDoc(doc(db, "wallet", uid));
      if (snap.exists()) setCoins(snap.data().coins ?? 0);
    } catch (_) {
      /* ignore */
    }
  }, []);

  // ── Load unread notifications
  const loadUnread = useCallback(async (uid: string) => {
    try {
      const q = query(
        collection(db, "notifications"),
        where("uid", "==", uid),
        where("read", "==", false),
      );
      const snap = await getDocs(q);
      setUnreadCount(snap.size);
    } catch (_) {
      /* ignore */
    }
  }, []);

  // ── Live player count poll
  const loadLiveCount = useCallback(async () => {
    try {
      const q = query(
        collection(db, "matches"),
        where("status", "==", "waiting"),
      );
      const snap = await getDocs(q);
      setLiveCount(snap.size);
    } catch (_) {
      /* ignore */
    }
  }, []);

  // ── Push notification poll for live match
  const pollMatchNotif = useCallback(async (uid: string) => {
    try {
      const q = query(
        collection(db, "matches"),
        where("player", "==", uid),
        where("status", "==", "live"),
      );
      const snap = await getDocs(q);
      if (!snap.empty && Notification.permission === "granted") {
        new Notification("🔥 Match Started!", {
          body: "Check Room ID and Password in Match History",
        });
      }
    } catch (_) {
      /* ignore */
    }
  }, []);

  // ── After login setup
  const setupAfterLogin = useCallback(
    (uid: string, data: UserData) => {
      setCurrentUser(uid);
      setUserData(data);
      setCoins(data.coins ?? 0);
      loadWallet(uid);
      loadUnread(uid);
      loadLiveCount();

      // Request push permission
      if ("Notification" in window) Notification.requestPermission();

      // Wallet refresh every 3s
      const walletInterval = setInterval(() => loadWallet(uid), 3000);
      // Live count refresh every 15s
      const liveInterval = setInterval(loadLiveCount, 15000);
      // Push notif poll every 30s
      const notifInterval = setInterval(() => pollMatchNotif(uid), 30000);

      pollRef.current = walletInterval;
      notifPollRef.current = notifInterval;

      // Store live interval
      (window as unknown as Record<string, unknown>).__liveInterval =
        liveInterval;
    },
    [loadWallet, loadUnread, loadLiveCount, pollMatchNotif],
  );

  // ── Cleanup on logout
  const logout = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (notifPollRef.current) clearInterval(notifPollRef.current);
    const li = (window as unknown as Record<string, unknown>).__liveInterval;
    if (typeof li === "number") clearInterval(li as number);
    setCurrentUser(null);
    setUserData(null);
    setCoins(0);
    setView("login");
    setActiveTab("home");
  }, []);

  // ── Navigate via bottom tab
  const goTab = (tab: NavTab) => {
    setActiveTab(tab);
    const map: Record<NavTab, View> = {
      home: "dashboard",
      matches: "match-history",
      leaderboard: "leaderboard",
      notifications: "notifications",
      profile: "profile",
    };
    setView(map[tab]);
    if (tab === "notifications" && currentUser) {
      // Mark all read
      setTimeout(async () => {
        try {
          const q = query(
            collection(db, "notifications"),
            where("uid", "==", currentUser),
            where("read", "==", false),
          );
          const snap = await getDocs(q);
          await Promise.all(
            snap.docs.map((d) => updateDoc(d.ref, { read: true })),
          );
          setUnreadCount(0);
        } catch (_) {
          /* ignore */
        }
      }, 500);
    }
  };

  const isLoggedIn = !!currentUser;
  const isAdminView = view.startsWith("admin-");
  const showNav = isLoggedIn && view !== "blocked" && !isAdminView;

  return (
    <div className="app-container">
      {isLoading && <LoadingOverlay />}

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            data-ocid="app.toast"
            style={{
              position: "fixed",
              top: 70,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 90,
              background:
                toast.type === "success"
                  ? "rgba(34,197,94,0.95)"
                  : "rgba(239,68,68,0.95)",
              color: "white",
              padding: "10px 20px",
              borderRadius: 10,
              fontFamily: "Rajdhani, sans-serif",
              fontWeight: 700,
              fontSize: "0.9rem",
              maxWidth: "90%",
              textAlign: "center",
              boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
            }}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Match Join Modal */}
      <AnimatePresence>
        {selectedMode && (
          <MatchJoinModal
            mode={selectedMode}
            currentUser={currentUser!}
            coins={coins}
            onClose={() => setSelectedMode(null)}
            onJoined={() => {
              setSelectedMode(null);
              loadWallet(currentUser!);
              showToast("Joined match! Waiting for opponent...");
            }}
            setIsLoading={setIsLoading}
            showToast={showToast}
          />
        )}
      </AnimatePresence>

      {/* Header */}
      {isLoggedIn && view !== "blocked" && !isAdminView && (
        <header className="app-header">
          <span className="app-title">🎮 MR.SONIC FF</span>
          <div className="header-actions">
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div className={`online-dot ${!isOnline ? "offline-dot" : ""}`} />
              <span className="player-count">
                {isOnline ? `👥 ${liveCount}` : "Offline"}
              </span>
            </div>
            <button
              type="button"
              className="icon-btn"
              onClick={toggleTheme}
              data-ocid="app.toggle"
            >
              {darkMode ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button
              type="button"
              className="icon-btn"
              onClick={() => goTab("notifications")}
              data-ocid="notifications.open_modal_button"
            >
              <Bell size={16} />
              {unreadCount > 0 && (
                <span className="notification-badge">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
          </div>
        </header>
      )}

      {/* Views */}
      <AnimatePresence mode="wait">
        {view === "splash" && <SplashView key="splash" />}
        {view === "login" && (
          <LoginView
            key="login"
            setView={setView}
            setIsLoading={setIsLoading}
            setupAfterLogin={setupAfterLogin}
            showToast={showToast}
          />
        )}
        {view === "signup" && (
          <SignupView
            key="signup"
            setView={setView}
            setIsLoading={setIsLoading}
            showToast={showToast}
          />
        )}
        {view === "forgot-password" && (
          <ForgotPasswordView
            key="forgot"
            setView={setView}
            setIsLoading={setIsLoading}
            showToast={showToast}
          />
        )}
        {view === "blocked" && <BlockedView key="blocked" logout={logout} />}
        {view === "dashboard" && currentUser && userData && (
          <DashboardView
            key="dashboard"
            currentUser={currentUser}
            userData={userData}
            coins={coins}
            setView={setView}
            setIsLoading={setIsLoading}
            showToast={showToast}
            setSelectedMode={setSelectedMode}
            loadWallet={loadWallet}
          />
        )}
        {view === "match-history" && currentUser && (
          <MatchHistoryView
            key="matches"
            currentUser={currentUser}
            coins={coins}
            setView={setView}
            setIsLoading={setIsLoading}
            showToast={showToast}
          />
        )}
        {view === "leaderboard" && currentUser && (
          <LeaderboardView
            key="leaderboard"
            currentUser={currentUser}
            setIsLoading={setIsLoading}
          />
        )}
        {view === "notifications" && currentUser && (
          <NotificationsView
            key="notifications"
            currentUser={currentUser}
            setIsLoading={setIsLoading}
          />
        )}
        {view === "profile" && currentUser && userData && (
          <ProfileView
            key="profile"
            userData={userData}
            coins={coins}
            setView={setView}
            logout={logout}
          />
        )}
        {view === "profile-edit" && currentUser && userData && (
          <ProfileEditView
            key="profile-edit"
            currentUser={currentUser}
            userData={userData}
            setUserData={setUserData}
            setView={setView}
            setIsLoading={setIsLoading}
            showToast={showToast}
          />
        )}
        {view === "deposit-history" && currentUser && (
          <DepositHistoryView
            key="deposit-history"
            currentUser={currentUser}
            setView={setView}
            setIsLoading={setIsLoading}
          />
        )}
        {view === "withdraw-history" && currentUser && (
          <WithdrawHistoryView
            key="withdraw-history"
            currentUser={currentUser}
            setView={setView}
            setIsLoading={setIsLoading}
          />
        )}
        {view === "chat-support" && currentUser && (
          <ChatSupportView
            key="chat-support"
            currentUser={currentUser}
            setView={setView}
            setIsLoading={setIsLoading}
            showToast={showToast}
          />
        )}
        {view === "report-problem" && currentUser && (
          <ReportProblemView
            key="report"
            currentUser={currentUser}
            setView={setView}
            setIsLoading={setIsLoading}
            showToast={showToast}
          />
        )}
        {isAdminView && currentUser && (
          <AdminLayout
            key={view}
            view={view as AdminView}
            setView={setView}
            logout={logout}
            showToast={showToast}
            setIsLoading={setIsLoading}
          />
        )}
      </AnimatePresence>

      {/* Bottom Nav */}
      {showNav && (
        <nav className="bottom-nav" data-ocid="app.panel">
          {(
            [
              {
                tab: "home" as NavTab,
                icon: <Home size={20} />,
                label: "Home",
              },
              {
                tab: "matches" as NavTab,
                icon: <Swords size={20} />,
                label: "Matches",
              },
              {
                tab: "leaderboard" as NavTab,
                icon: <Trophy size={20} />,
                label: "Ranks",
              },
              {
                tab: "notifications" as NavTab,
                icon: <Bell size={20} />,
                label: "Alerts",
              },
              {
                tab: "profile" as NavTab,
                icon: <User size={20} />,
                label: "Profile",
              },
            ] as const
          ).map(({ tab, icon, label }) => (
            <button
              type="button"
              key={tab}
              className={`nav-item ${activeTab === tab ? "active" : ""}`}
              onClick={() => goTab(tab)}
              data-ocid={`nav.${tab}.link`}
            >
              <span style={{ position: "relative" }}>
                {icon}
                {tab === "notifications" && unreadCount > 0 && (
                  <span
                    className="notification-badge"
                    style={{ fontSize: "0.55rem" }}
                  >
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </span>
              <span>{label}</span>
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}

// ─── Splash ───────────────────────────────────────────────────────────────────
function SplashView() {
  return (
    <motion.div
      className="splash-screen"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <img
          src="/assets/generated/mrsonicff-logo.dim_480x160.png"
          alt="MR.SONIC FF"
          style={{ width: 280, maxWidth: "80vw", marginBottom: 8 }}
        />
        <div
          style={{
            fontFamily: "Orbitron, sans-serif",
            fontSize: "0.75rem",
            color: "rgba(255,183,77,0.7)",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
          }}
        >
          The #1 Free Fire Tournament
        </div>
      </motion.div>
      <div className="spinner" />
    </motion.div>
  );
}

// ─── Login ────────────────────────────────────────────────────────────────────
function LoginView({
  setView,
  setIsLoading,
  setupAfterLogin,
  showToast,
}: {
  setView: (v: View) => void;
  setIsLoading: (v: boolean) => void;
  setupAfterLogin: (uid: string, data: UserData) => void;
  showToast: (msg: string, type?: "success" | "error") => void;
}) {
  const [uid, setUid] = useState("");
  const [pass, setPass] = useState("");

  const login = async () => {
    if (!uid.trim() || !pass.trim()) {
      showToast("Please enter UID and password", "error");
      return;
    }
    setIsLoading(true);
    try {
      const ref = doc(db, "users", uid.trim());
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        showToast("User not found. Check your UID.", "error");
        return;
      }
      const data = snap.data() as UserData;
      if (data.pass !== pass) {
        showToast("Wrong password", "error");
        return;
      }
      if (data.blocked) {
        setView("blocked");
        return;
      }
      setupAfterLogin(uid.trim(), data);
      setView(uid.trim() === "admin" ? "admin-dashboard" : "dashboard");
    } catch (_e) {
      showToast("Network error. Try again.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      className="auth-page"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <img
        src="/assets/generated/mrsonicff-logo.dim_480x160.png"
        alt="MR.SONIC FF"
        style={{ width: 220, marginBottom: 4 }}
      />
      <div className="auth-subtitle">The #1 Free Fire Tournament Platform</div>
      <div className="auth-form">
        <div className="field-group">
          <div className="field-label">Player UID</div>
          <input
            className="fire-input"
            placeholder="Enter your UID"
            value={uid}
            onChange={(e) => setUid(e.target.value)}
            data-ocid="login.input"
          />
        </div>
        <div className="field-group">
          <div className="field-label">Password</div>
          <input
            className="fire-input"
            type="password"
            placeholder="Enter password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && login()}
            data-ocid="login.input"
          />
        </div>
        <button
          type="button"
          className="fire-btn"
          onClick={login}
          data-ocid="login.submit_button"
        >
          Login
        </button>
        <div
          style={{
            textAlign: "center",
            display: "flex",
            gap: 16,
            justifyContent: "center",
          }}
        >
          <button
            type="button"
            className="auth-link"
            onClick={() => setView("signup")}
            data-ocid="login.signup.link"
          >
            Create Account
          </button>
          <button
            type="button"
            className="auth-link"
            onClick={() => setView("forgot-password")}
            data-ocid="login.forgot.link"
          >
            Forgot Password
          </button>
        </div>
      </div>
      <Footer />
    </motion.div>
  );
}

// ─── Signup ───────────────────────────────────────────────────────────────────
function SignupView({
  setView,
  setIsLoading,
  showToast,
}: {
  setView: (v: View) => void;
  setIsLoading: (v: boolean) => void;
  showToast: (msg: string, type?: "success" | "error") => void;
}) {
  const [uid, setUid] = useState("");
  const [pass, setPass] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const createUser = async () => {
    if (!uid.trim() || !pass.trim() || !name.trim()) {
      showToast("Fill all required fields", "error");
      return;
    }
    setIsLoading(true);
    try {
      const ref = doc(db, "users", uid.trim());
      const snap = await getDoc(ref);
      if (snap.exists()) {
        showToast("UID already taken", "error");
        return;
      }
      await Promise.all([
        setDoc(ref, {
          uid: uid.trim(),
          pass,
          displayName: name.trim(),
          phone: phone.trim(),
          wins: 0,
          kills: 0,
          matchesPlayed: 0,
          coins: 0,
          blocked: false,
        }),
        setDoc(doc(db, "wallet", uid.trim()), { coins: 0 }),
      ]);
      showToast("Account created! You can login now.");
      setView("login");
    } catch (_) {
      showToast("Error creating account", "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      className="auth-page"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <div className="auth-logo">🔥 JOIN THE BATTLE</div>
      <div className="auth-subtitle">Create your warrior profile</div>
      <div className="auth-form">
        <div className="field-group">
          <div className="field-label">Player UID *</div>
          <input
            className="fire-input"
            placeholder="Choose a unique UID"
            value={uid}
            onChange={(e) => setUid(e.target.value)}
            data-ocid="signup.input"
          />
        </div>
        <div className="field-group">
          <div className="field-label">Password *</div>
          <input
            className="fire-input"
            type="password"
            placeholder="Create a strong password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            data-ocid="signup.input"
          />
        </div>
        <div className="field-group">
          <div className="field-label">Display Name *</div>
          <input
            className="fire-input"
            placeholder="Your in-game name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            data-ocid="signup.input"
          />
        </div>
        <div className="field-group">
          <div className="field-label">Phone Number</div>
          <input
            className="fire-input"
            placeholder="+91 XXXXXXXXXX"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            data-ocid="signup.input"
          />
        </div>
        <button
          type="button"
          className="fire-btn"
          onClick={createUser}
          data-ocid="signup.submit_button"
        >
          Create Account
        </button>
        <div style={{ textAlign: "center" }}>
          <button
            type="button"
            className="auth-link"
            onClick={() => setView("login")}
            data-ocid="signup.login.link"
          >
            Already have an account? Login
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Forgot Password ──────────────────────────────────────────────────────────
function ForgotPasswordView({
  setView,
  setIsLoading,
  showToast,
}: {
  setView: (v: View) => void;
  setIsLoading: (v: boolean) => void;
  showToast: (msg: string, type?: "success" | "error") => void;
}) {
  const [step, setStep] = useState<"find" | "reset">("find");
  const [uid, setUid] = useState("");
  const [phone, setPhone] = useState("");
  const [newPass, setNewPass] = useState("");

  const findUser = async () => {
    if (!uid.trim()) {
      showToast("Enter UID", "error");
      return;
    }
    setIsLoading(true);
    try {
      const snap = await getDoc(doc(db, "users", uid.trim()));
      if (!snap.exists()) {
        showToast("User not found", "error");
        return;
      }
      const data = snap.data() as UserData;
      const ph = data.phone || "";
      const hint = ph.length >= 4 ? `****${ph.slice(-4)}` : "(none)";
      setPhone(hint);
      setStep("reset");
    } catch (_) {
      showToast("Error fetching user", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const resetPass = async () => {
    if (!newPass.trim()) {
      showToast("Enter new password", "error");
      return;
    }
    setIsLoading(true);
    try {
      await updateDoc(doc(db, "users", uid.trim()), { pass: newPass });
      showToast("Password updated!");
      setView("login");
    } catch (_) {
      showToast("Error updating password", "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      className="auth-page"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <div className="auth-logo">🔐 RESET PASSWORD</div>
      <div className="auth-subtitle">
        {step === "find"
          ? "Enter your UID to recover account"
          : `Phone hint: ${phone}`}
      </div>
      <div className="auth-form">
        {step === "find" ? (
          <>
            <div className="field-group">
              <div className="field-label">Your UID</div>
              <input
                className="fire-input"
                placeholder="Enter UID"
                value={uid}
                onChange={(e) => setUid(e.target.value)}
                data-ocid="forgot.input"
              />
            </div>
            <button
              type="button"
              className="fire-btn"
              onClick={findUser}
              data-ocid="forgot.submit_button"
            >
              Find Account
            </button>
          </>
        ) : (
          <>
            <div className="field-group">
              <div className="field-label">New Password</div>
              <input
                className="fire-input"
                type="password"
                placeholder="Enter new password"
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                data-ocid="forgot.input"
              />
            </div>
            <button
              type="button"
              className="fire-btn"
              onClick={resetPass}
              data-ocid="forgot.submit_button"
            >
              Update Password
            </button>
          </>
        )}
        <div style={{ textAlign: "center" }}>
          <button
            type="button"
            className="auth-link"
            onClick={() => setView("login")}
            data-ocid="forgot.login.link"
          >
            Back to Login
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Blocked ──────────────────────────────────────────────────────────────────
function BlockedView({ logout }: { logout: () => void }) {
  return (
    <motion.div
      className="blocked-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      data-ocid="blocked.panel"
    >
      <div style={{ fontSize: "4rem", marginBottom: 20 }}>🚫</div>
      <div
        style={{
          fontFamily: "Orbitron, sans-serif",
          fontSize: "1.1rem",
          color: "#ef4444",
          marginBottom: 12,
        }}
      >
        ACCOUNT BLOCKED
      </div>
      <div
        style={{
          color: "rgba(255,255,255,0.6)",
          fontSize: "0.9rem",
          marginBottom: 32,
          maxWidth: 300,
        }}
      >
        Your account has been blocked. Please contact support for assistance.
      </div>
      <button
        type="button"
        className="fire-btn fire-btn-danger"
        style={{ width: "auto", padding: "12px 32px" }}
        onClick={logout}
        data-ocid="blocked.button"
      >
        Logout
      </button>
    </motion.div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function DashboardView({
  currentUser,
  userData,
  coins,
  setView,
  setIsLoading,
  showToast,
  setSelectedMode,
  loadWallet,
}: {
  currentUser: string;
  userData: UserData;
  coins: number;
  setView: (v: View) => void;
  setIsLoading: (v: boolean) => void;
  showToast: (msg: string, type?: "success" | "error") => void;
  setSelectedMode: (m: (typeof GAME_MODES)[0] | null) => void;
  loadWallet: (uid: string) => void;
}) {
  const [utr, setUtr] = useState("");
  const [depositAmt, setDepositAmt] = useState("");
  const [withdrawAmt, setWithdrawAmt] = useState("");
  const [adminOpen, setAdminOpen] = useState(false);
  const [pendingPayments, setPendingPayments] = useState<PaymentData[]>([]);
  const [pendingWithdraws, setPendingWithdraws] = useState<WithdrawData[]>([]);
  const isAdmin = currentUser === "admin";
  const [activeMatches, setActiveMatches] = useState<MatchData[]>([]);
  const [showRoomMap, setShowRoomMap] = useState<Record<string, boolean>>({});
  const [modeOccupancy, setModeOccupancy] = useState<
    Record<
      string,
      { count: number; maxPlayers: number; firstPlayerName: string }
    >
  >({});

  // Load occupancy for all modes (admin rooms)
  useEffect(() => {
    const loadOccupancy = async () => {
      try {
        const snap = await getDocs(
          query(
            collection(db, "matches"),
            where("player", "==", "admin"),
            where("status", "in", ["waiting", "live", "full"]),
          ),
        );
        const occ: Record<
          string,
          { count: number; maxPlayers: number; firstPlayerName: string }
        > = {};
        await Promise.all(
          snap.docs.map(async (d) => {
            const data = d.data();
            const players: string[] = data.players || [];
            let firstName = "";
            if (players.length > 0) {
              try {
                const uSnap = await getDoc(doc(db, "users", players[0]));
                firstName = uSnap.exists()
                  ? uSnap.data().inGameName ||
                    uSnap.data().displayName ||
                    players[0]
                  : players[0];
              } catch (_) {
                firstName = players[0];
              }
            }
            occ[data.mode] = {
              count: players.length,
              maxPlayers: data.maxPlayers || 2,
              firstPlayerName: firstName,
            };
          }),
        );
        setModeOccupancy(occ);
      } catch (_) {
        /* ignore */
      }
    };
    loadOccupancy();
    const interval = setInterval(loadOccupancy, 8000);
    return () => clearInterval(interval);
  }, []);
  const copyText = (text: string) => {
    navigator.clipboard.writeText(text).then(() => showToast("Copied! ✅"));
  };

  useEffect(() => {
    if (!currentUser) return;
    // Query player's own match docs (player == currentUser)
    const q = query(
      collection(db, "matches"),
      where("player", "==", currentUser),
      where("status", "in", ["waiting", "live", "full"]),
    );
    const unsub = onSnapshot(q, async (snap) => {
      const matches = snap.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as MatchData,
      );
      // For matches with a roomRef, merge roomId/roomPass from the admin room doc
      const enriched = await Promise.all(
        matches.map(async (m) => {
          if ((m as any).roomRef) {
            try {
              const refSnap = await getDoc(
                doc(db, "matches", (m as any).roomRef),
              );
              if (refSnap.exists()) {
                const refData = refSnap.data();
                return {
                  ...m,
                  roomId: refData.roomId || "",
                  roomPass: refData.roomPass || "",
                };
              }
            } catch (_) {
              /* ignore */
            }
          }
          return m;
        }),
      );
      setActiveMatches(enriched);
    });
    return () => unsub();
  }, [currentUser]);

  const loadAdmin = useCallback(async () => {
    const [pSnap, wSnap] = await Promise.all([
      getDocs(
        query(collection(db, "payments"), where("status", "==", "Pending")),
      ),
      getDocs(
        query(collection(db, "withdraw"), where("status", "==", "Pending")),
      ),
    ]);
    setPendingPayments(
      pSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as PaymentData),
    );
    setPendingWithdraws(
      wSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as WithdrawData),
    );
  }, []);

  useEffect(() => {
    if (isAdmin && adminOpen) loadAdmin();
  }, [isAdmin, adminOpen, loadAdmin]);

  const submitUTR = async () => {
    const dAmt = Number(depositAmt);
    if (!dAmt || dAmt < 30) {
      showToast("Minimum deposit amount is ₹30", "error");
      return;
    }
    if (!utr.trim()) {
      showToast("Enter UTR number", "error");
      return;
    }
    setIsLoading(true);
    try {
      await addDoc(collection(db, "payments"), {
        user: currentUser,
        utr: utr.trim(),
        amount: dAmt,
        status: "Pending",
      });
      showToast("Payment submitted!");
      setUtr("");
      setDepositAmt("");
    } catch (_) {
      showToast("Submission failed", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const requestWithdraw = async () => {
    const amt = Number(withdrawAmt);
    if (!amt || amt < 100) {
      showToast("Minimum withdrawal ₹100", "error");
      return;
    }
    if (amt > coins) {
      showToast("Insufficient balance", "error");
      return;
    }
    setIsLoading(true);
    try {
      const charge = Math.floor(amt * 0.09);
      await Promise.all([
        addDoc(collection(db, "withdraw"), {
          user: currentUser,
          amount: amt,
          final: amt - charge,
          status: "Pending",
        }),
        setDoc(doc(db, "wallet", currentUser), { coins: coins - amt }),
      ]);
      showToast(`Withdrawal requested. You'll receive ₹${amt - charge}`);
      setWithdrawAmt("");
      loadWallet(currentUser);
    } catch (_) {
      showToast("Withdrawal failed", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const approvePayment = async (id: string, user: string, amount: number) => {
    setIsLoading(true);
    try {
      const wSnap = await getDoc(doc(db, "wallet", user));
      const cur = wSnap.exists() ? (wSnap.data().coins ?? 0) : 0;
      await Promise.all([
        updateDoc(doc(db, "payments", id), { status: "Approved" }),
        setDoc(doc(db, "wallet", user), { coins: cur + amount }),
      ]);
      showToast("Payment approved!");
      loadAdmin();
    } catch (_) {
      showToast("Error", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const approveWithdraw = async (id: string) => {
    await updateDoc(doc(db, "withdraw", id), { status: "Approved" });
    showToast("Withdrawal approved!");
    loadAdmin();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="main-content"
      data-ocid="dashboard.section"
    >
      {/* Welcome card */}
      <div className="welcome-card">
        <div>
          <div className="welcome-name">
            {userData.displayName || currentUser}
          </div>
          <div className="welcome-coins">
            Balance: <span>₹{coins}</span>
          </div>
        </div>
        <div
          className="avatar-circle"
          style={{ width: 48, height: 48, fontSize: "1.1rem" }}
        >
          {(userData.displayName || currentUser)[0].toUpperCase()}
        </div>
      </div>

      {/* Admin Button - Only for admin */}
      {isAdmin && (
        <button
          type="button"
          onClick={() => setView("admin-dashboard")}
          data-ocid="admin.open_button"
          style={{
            width: "100%",
            padding: "14px 20px",
            marginBottom: 16,
            borderRadius: 14,
            border: "2px solid #ff6b00",
            background: "linear-gradient(135deg, #ff6b00 0%, #ff6b00 100%)",
            color: "#1a1a1a",
            fontFamily: '"Orbitron", sans-serif',
            fontWeight: 700,
            fontSize: "1rem",
            letterSpacing: "0.08em",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            boxShadow:
              "0 0 24px rgba(255, 215, 0, 0.6), 0 4px 16px rgba(255, 165, 0, 0.4)",
            textShadow: "none",
          }}
        >
          <span style={{ fontSize: "1.3rem" }}>🔐</span>
          ADMIN PANEL
          <span style={{ fontSize: "1.1rem" }}>⚡</span>
        </button>
      )}

      {/* Hero banner */}
      <div
        style={{
          position: "relative",
          borderRadius: 16,
          overflow: "hidden",
          marginBottom: 16,
          border: "1px solid rgba(255,140,0,0.3)",
          boxShadow:
            "0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,140,0,0.08)",
        }}
      >
        <img
          src="/assets/generated/brand-hero-banner.dim_480x200.jpg"
          alt="MR.SONIC FF Tournament"
          style={{
            width: "100%",
            height: 140,
            objectFit: "cover",
            display: "block",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(135deg, rgba(8,12,20,0.65) 0%, rgba(255,107,0,0.18) 100%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: 16,
            left: 16,
          }}
        >
          <div
            style={{
              fontFamily: "Orbitron, sans-serif",
              fontSize: "1.15rem",
              fontWeight: 900,
              color: "#fff",
              textShadow: "0 0 20px rgba(255,107,0,0.9)",
              letterSpacing: "0.05em",
            }}
          >
            🏆 TOURNAMENT ARENA
          </div>
          <div
            style={{
              fontSize: "0.78rem",
              color: "rgba(255,200,120,0.92)",
              marginTop: 5,
              fontWeight: 600,
              letterSpacing: "0.02em",
            }}
          >
            Join & Win Real Cash Prizes
          </div>
        </div>
        <div
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            background: "rgba(255,107,0,0.15)",
            border: "1px solid rgba(255,107,0,0.4)",
            color: "#ff6b00",
            fontSize: "0.65rem",
            fontWeight: 700,
            fontFamily: "Orbitron, sans-serif",
            padding: "4px 10px",
            borderRadius: 20,
            backdropFilter: "blur(6px)",
            letterSpacing: "0.06em",
            boxShadow: "0 0 12px rgba(255,107,0,0.2)",
            animation: "live-pulse 1.8s infinite",
          }}
        >
          ● LIVE
        </div>
      </div>

      {/* Quick actions */}
      <div className="section-label">Quick Actions</div>
      <div className="quick-grid">
        {[
          {
            icon: <Swords size={22} />,
            label: "Join Match",
            action: () => setView("match-history"),
          },
          {
            icon: <History size={22} />,
            label: "History",
            action: () => setView("match-history"),
          },
          {
            icon: <Trophy size={22} />,
            label: "Leaderboard",
            action: () => setView("leaderboard"),
          },
          {
            icon: <Wallet size={22} />,
            label: "Wallet",
            action: () => setView("deposit-history"),
          },
        ].map((item) => (
          <button
            type="button"
            key={item.label}
            className="quick-btn"
            onClick={item.action}
            data-ocid="dashboard.primary_button"
          >
            <span style={{ color: "var(--accent)" }}>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </div>

      {/* Active Matches on Dashboard */}
      {activeMatches.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div className="section-label">🎮 Your Active Matches</div>
          {activeMatches.map((m) => (
            <div key={m.id} className="list-item" style={{ marginBottom: 10 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 6,
                }}
              >
                <span
                  style={{
                    fontFamily: "Orbitron, sans-serif",
                    fontWeight: 700,
                    color: "var(--accent)",
                    fontSize: "0.88rem",
                  }}
                >
                  {m.mode?.toUpperCase()}
                </span>
                <span
                  className={`badge ${m.status === "live" ? "badge-success" : "badge-warning"}`}
                >
                  {m.status}
                </span>
              </div>
              {m.status === "live" && <LiveTimer startedAt={m.startedAt} />}

              {/* ── Room ID & Password — Always Visible ── */}
              <div style={{ marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() =>
                    setShowRoomMap((prev) => ({
                      ...prev,
                      [m.id]: !prev[m.id],
                    }))
                  }
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    background: m.roomId
                      ? "linear-gradient(135deg, #ff6b00, #ff9a00)"
                      : "rgba(255,107,0,0.25)",
                    border: "2px solid #ffb347",
                    borderRadius: 10,
                    color: "#fff",
                    fontFamily: "Orbitron, sans-serif",
                    fontWeight: 800,
                    fontSize: "0.8rem",
                    letterSpacing: "0.06em",
                    cursor: "pointer",
                    boxShadow: m.roomId
                      ? "0 0 16px rgba(255,107,0,0.6), 0 0 6px rgba(255,107,0,0.3)"
                      : "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                  data-ocid="dashboard.primary_button"
                >
                  🔑{" "}
                  {showRoomMap[m.id]
                    ? "HIDE ROOM INFO"
                    : "VIEW ROOM ID & PASSWORD"}
                </button>

                {showRoomMap[m.id] && (
                  <div
                    style={{
                      marginTop: 10,
                      background: "linear-gradient(135deg, #0e1420, #0d1a3a)",
                      border: "2px solid rgba(255,107,0,0.6)",
                      borderRadius: 12,
                      padding: "14px 12px",
                      boxShadow: "0 0 18px rgba(255,107,0,0.3)",
                    }}
                  >
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 10,
                      }}
                    >
                      <div
                        style={{
                          background: "rgba(255,107,0,0.1)",
                          border: "1.5px solid rgba(255,107,0,0.5)",
                          borderRadius: 8,
                          padding: "10px 10px 8px",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "0.6rem",
                            color: "#ff9a00",
                            fontFamily: "Orbitron, sans-serif",
                            letterSpacing: 1,
                            marginBottom: 4,
                            textTransform: "uppercase",
                          }}
                        >
                          Room ID
                        </div>
                        <div
                          style={{
                            fontWeight: 800,
                            fontSize: "1rem",
                            color: m.roomId ? "#fff" : "#f59e0b",
                            letterSpacing: "0.08em",
                            marginBottom: 6,
                          }}
                        >
                          {m.roomId || "⏳ Pending..."}
                        </div>
                        {m.roomId && (
                          <button
                            type="button"
                            onClick={() => copyText(m.roomId)}
                            style={{
                              background: "var(--accent)",
                              color: "#fff",
                              border: "none",
                              borderRadius: 5,
                              padding: "4px 10px",
                              fontSize: "0.68rem",
                              fontWeight: 700,
                              cursor: "pointer",
                              letterSpacing: "0.04em",
                            }}
                          >
                            📋 COPY
                          </button>
                        )}
                      </div>
                      <div
                        style={{
                          background: "rgba(255,107,0,0.1)",
                          border: "1.5px solid rgba(255,107,0,0.5)",
                          borderRadius: 8,
                          padding: "10px 10px 8px",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "0.6rem",
                            color: "#ff9a00",
                            fontFamily: "Orbitron, sans-serif",
                            letterSpacing: 1,
                            marginBottom: 4,
                            textTransform: "uppercase",
                          }}
                        >
                          Password
                        </div>
                        <div
                          style={{
                            fontWeight: 800,
                            fontSize: "1rem",
                            color: m.roomPass ? "#fff" : "#f59e0b",
                            letterSpacing: "0.08em",
                            marginBottom: 6,
                          }}
                        >
                          {m.roomPass || "⏳ Pending..."}
                        </div>
                        {m.roomPass && (
                          <button
                            type="button"
                            onClick={() => copyText(m.roomPass)}
                            style={{
                              background: "var(--accent)",
                              color: "#fff",
                              border: "none",
                              borderRadius: 5,
                              padding: "4px 10px",
                              fontSize: "0.68rem",
                              fontWeight: 700,
                              cursor: "pointer",
                              letterSpacing: "0.04em",
                            }}
                          >
                            📋 COPY
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Game modes */}
      <div className="section-label">Game Modes</div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 10,
          marginBottom: 16,
        }}
      >
        {GAME_MODES.map((mode) => (
          <button
            type="button"
            key={mode.id}
            className="mode-card"
            onClick={() => setSelectedMode(mode)}
            data-ocid="dashboard.primary_button"
            style={{ padding: 0, overflow: "hidden" }}
          >
            <div
              style={{
                position: "relative",
                height: 80,
                overflow: "hidden",
                borderRadius: "13px 13px 0 0",
              }}
            >
              {(mode as typeof mode & { poster?: string }).poster ? (
                <img
                  src={(mode as typeof mode & { poster?: string }).poster}
                  alt={mode.label}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                  }}
                />
              ) : (
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    background: "linear-gradient(135deg, #1a0e00, #0e1420)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "2rem",
                  }}
                >
                  {mode.emoji}
                </div>
              )}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background:
                    "linear-gradient(to bottom, transparent 30%, rgba(8,12,20,0.92) 100%)",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  top: 5,
                  right: 5,
                  background: "rgba(255,107,0,0.85)",
                  color: "white",
                  fontSize: "0.58rem",
                  fontWeight: 700,
                  fontFamily: "Orbitron, sans-serif",
                  padding: "2px 6px",
                  borderRadius: 12,
                  backdropFilter: "blur(4px)",
                  letterSpacing: "0.04em",
                }}
              >
                ₹{mode.entryFee}
              </div>
              <div
                style={{
                  position: "absolute",
                  bottom: 4,
                  left: 0,
                  right: 0,
                  textAlign: "center",
                  fontSize: "0.85rem",
                }}
              >
                {mode.emoji}
              </div>
            </div>
            <div
              style={{
                padding: "7px 7px 10px",
                background:
                  "linear-gradient(180deg, rgba(8,12,20,0.95) 0%, rgba(14,20,32,1) 100%)",
              }}
            >
              <div
                className="mode-title"
                style={{
                  fontSize: "0.68rem",
                  letterSpacing: "0.05em",
                  textShadow: "0 0 8px rgba(255,107,0,0.6)",
                }}
              >
                {mode.label}
              </div>
              <div className="mode-stat">
                <span
                  style={{
                    color: "rgba(180,180,180,0.7)",
                    fontSize: "0.55rem",
                  }}
                >
                  PRIZE{" "}
                </span>
                <span style={{ color: "#4ade80", fontWeight: 800 }}>
                  ₹{mode.prizePool}
                </span>
              </div>
              {(mode as any).perKill && (
                <div className="mode-stat" style={{ fontSize: "0.58rem" }}>
                  <span
                    style={{
                      color: "rgba(180,180,180,0.7)",
                      fontSize: "0.52rem",
                    }}
                  >
                    KILL{" "}
                  </span>
                  <span style={{ color: "#ff9a00" }}>
                    ₹{(mode as any).perKill}
                  </span>
                </div>
              )}
              {(mode as any).winnerBonus && (
                <div className="mode-stat" style={{ fontSize: "0.58rem" }}>
                  Win{" "}
                  <span style={{ color: "#ff6b00" }}>
                    +₹{(mode as any).winnerBonus}
                  </span>
                </div>
              )}
              {(() => {
                const occ = modeOccupancy[mode.id];
                if (!occ)
                  return (
                    <div
                      style={{
                        fontSize: "0.58rem",
                        color: "rgba(100,200,100,0.8)",
                        marginTop: 3,
                        fontWeight: 600,
                      }}
                    >
                      🟢 Open
                    </div>
                  );
                const isFull = occ.count >= occ.maxPlayers;
                return (
                  <div style={{ marginTop: 3 }}>
                    <div
                      style={{
                        fontSize: "0.55rem",
                        color: isFull ? "#f87171" : "#ff9a00",
                        fontWeight: 700,
                      }}
                    >
                      👥 {occ.count}/{occ.maxPlayers} {isFull ? "🔒FULL" : ""}
                    </div>
                    {occ.count > 0 && !isFull && occ.firstPlayerName && (
                      <div
                        style={{
                          fontSize: "0.5rem",
                          color: "rgba(255,200,100,0.9)",
                          marginTop: 1,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        P1: {occ.firstPlayerName}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </button>
        ))}
      </div>

      {/* Payment */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="section-label">💸 Deposit Payment</div>

        {/* UPI & WhatsApp Payment Info Box */}
        <div
          style={{
            background:
              "linear-gradient(135deg, #0e1420 0%, #121929 40%, #0d1a3a 100%)",
            border: "2px solid #ff6b00",
            borderRadius: 16,
            padding: "18px 16px",
            marginBottom: 14,
            boxShadow:
              "0 0 24px rgba(255,107,0,0.35), 0 0 8px rgba(255,107,0,0.2)",
            position: "relative" as const,
            overflow: "hidden",
          }}
        >
          {/* Glow top accent */}
          <div
            style={{
              position: "absolute" as const,
              top: 0,
              left: 0,
              right: 0,
              height: 3,
              background: "linear-gradient(90deg, #ff6b00, #ff6b00, #ff6b00)",
              borderRadius: "16px 16px 0 0",
            }}
          />

          <div style={{ textAlign: "center" as const, marginBottom: 12 }}>
            <span
              style={{
                fontSize: "0.7rem",
                fontFamily: "Orbitron, sans-serif",
                letterSpacing: 2,
                color: "#ff6b00",
                textTransform: "uppercase" as const,
                opacity: 0.9,
              }}
            >
              💳 Payment Details
            </span>
          </div>

          {/* UPI Box */}
          <div
            style={{
              background: "rgba(255,107,0,0.12)",
              border: "1.5px solid rgba(255,107,0,0.6)",
              borderRadius: 10,
              padding: "10px 14px",
              marginBottom: 10,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <span style={{ fontSize: "1.4rem" }}>📲</span>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: "0.65rem",
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
                  fontSize: "1rem",
                  fontWeight: 700,
                  fontFamily: "Orbitron, sans-serif",
                  color: "#fff",
                  letterSpacing: 1,
                  textShadow: "0 0 10px rgba(255,107,0,0.8)",
                }}
              >
                8247835354@ibl
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText("8247835354@ibl");
                showToast("UPI ID copied! 📋", "success");
              }}
              style={{
                background: "rgba(255,107,0,0.2)",
                border: "1px solid rgba(255,107,0,0.6)",
                borderRadius: 6,
                padding: "6px 10px",
                cursor: "pointer",
                color: "#ffb347",
                fontSize: "0.75rem",
                fontWeight: 700,
                letterSpacing: 0.5,
              }}
            >
              📋 COPY
            </button>
          </div>

          {/* WhatsApp Box */}
          <a
            href="https://wa.me/917013256124"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              background: "rgba(255,107,0,0.12)",
              border: "1.5px solid rgba(255,107,0,0.5)",
              borderRadius: 10,
              padding: "10px 14px",
              display: "flex",
              alignItems: "center",
              gap: 10,
              textDecoration: "none",
              cursor: "pointer",
            }}
          >
            <span style={{ fontSize: "1.4rem" }}>💬</span>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: "0.65rem",
                  color: "#ff6b00",
                  fontFamily: "Rajdhani, sans-serif",
                  letterSpacing: 1,
                  marginBottom: 2,
                }}
              >
                WhatsApp Support
              </div>
              <div
                style={{
                  fontSize: "1rem",
                  fontWeight: 700,
                  fontFamily: "Orbitron, sans-serif",
                  color: "#fff",
                  letterSpacing: 1,
                  textShadow: "0 0 10px rgba(255,107,0,0.7)",
                }}
              >
                7013256124
              </div>
            </div>
            <span
              style={{ fontSize: "0.75rem", color: "#ff6b00", fontWeight: 700 }}
            >
              TAP →
            </span>
          </a>

          <div
            style={{
              textAlign: "center" as const,
              marginTop: 10,
              fontSize: "0.7rem",
              color: "rgba(255,255,255,0.5)",
              fontFamily: "Rajdhani, sans-serif",
            }}
          >
            Pay via UPI → Submit UTR below
          </div>
        </div>

        <div className="field-group">
          <div
            style={{
              marginBottom: 6,
              fontSize: "0.78rem",
              color: "#ff9500",
              fontFamily: "Rajdhani, sans-serif",
              fontWeight: 700,
              letterSpacing: 0.5,
            }}
          >
            💡 Minimum deposit amount:{" "}
            <span
              style={{
                color: "#fff",
                background: "rgba(255,149,0,0.18)",
                borderRadius: 4,
                padding: "1px 7px",
                border: "1px solid #ff9500",
              }}
            >
              ₹30
            </span>
          </div>
          <input
            className="fire-input"
            type="number"
            min={30}
            placeholder="Enter Amount (Min ₹30)"
            value={depositAmt}
            onChange={(e) => setDepositAmt(e.target.value)}
            data-ocid="deposit.amount_input"
          />
        </div>
        <div className="field-group">
          <input
            className="fire-input"
            placeholder="Enter UTR / Transaction ID"
            value={utr}
            onChange={(e) => setUtr(e.target.value)}
            data-ocid="deposit.input"
          />
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            className="fire-btn"
            onClick={submitUTR}
            data-ocid="deposit.submit_button"
          >
            Submit UTR
          </button>
          <button
            type="button"
            className="fire-btn fire-btn-secondary"
            style={{ flex: 0.6 }}
            onClick={() => setView("deposit-history")}
            data-ocid="deposit.secondary_button"
          >
            History
          </button>
        </div>
      </div>

      {/* Withdraw */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="section-label">💰 Withdraw Coins</div>
        <div
          style={{ fontSize: "0.8rem", color: "var(--muted)", marginBottom: 8 }}
        >
          9% fee deducted. Min ₹100.
        </div>
        <div className="field-group">
          <input
            className="fire-input"
            type="number"
            placeholder="Amount (min ₹100)"
            value={withdrawAmt}
            onChange={(e) => setWithdrawAmt(e.target.value)}
            data-ocid="withdraw.input"
          />
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            className="fire-btn"
            onClick={requestWithdraw}
            data-ocid="withdraw.submit_button"
          >
            Withdraw
          </button>
          <button
            type="button"
            className="fire-btn fire-btn-secondary"
            style={{ flex: 0.6 }}
            onClick={() => setView("withdraw-history")}
            data-ocid="withdraw.secondary_button"
          >
            History
          </button>
        </div>
      </div>

      {/* More links */}
      <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
        <button
          type="button"
          className="fire-btn fire-btn-secondary"
          onClick={() => setView("chat-support")}
          data-ocid="support.button"
        >
          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              justifyContent: "center",
            }}
          >
            <MessageSquare size={16} /> Chat Support
          </span>
        </button>
        <button
          type="button"
          className="fire-btn fire-btn-secondary"
          onClick={() => setView("report-problem")}
          data-ocid="report.button"
        >
          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              justifyContent: "center",
            }}
          >
            <Flag size={16} /> Report
          </span>
        </button>
      </div>

      {/* Admin Panel */}
      {isAdmin && (
        <div className="admin-panel" data-ocid="admin.panel">
          <button
            type="button"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: 0,
            }}
            onClick={() => setAdminOpen(!adminOpen)}
            data-ocid="admin.toggle"
          >
            <div className="admin-title">🔐 Admin Panel</div>
            {adminOpen ? (
              <ChevronUp size={18} color="#ef4444" />
            ) : (
              <ChevronDown size={18} color="#ef4444" />
            )}
          </button>
          {adminOpen && (
            <div>
              <div className="section-label" style={{ marginTop: 12 }}>
                Pending Payments ({pendingPayments.length})
              </div>
              {pendingPayments.length === 0 ? (
                <div style={{ color: "var(--muted)", fontSize: "0.8rem" }}>
                  No pending payments
                </div>
              ) : (
                pendingPayments.map((p, i) => (
                  <div
                    key={p.id}
                    className="list-item"
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                    data-ocid={`admin.payment.item.${i + 1}`}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "0.85rem" }}>
                        {p.user}
                      </div>
                      <div
                        style={{ color: "var(--muted)", fontSize: "0.75rem" }}
                      >
                        UTR: {p.utr} | ₹{p.amount}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="fire-btn"
                      style={{
                        width: "auto",
                        padding: "6px 14px",
                        fontSize: "0.8rem",
                      }}
                      onClick={() => approvePayment(p.id, p.user, p.amount)}
                      data-ocid="admin.confirm_button"
                    >
                      <Check size={14} />
                    </button>
                  </div>
                ))
              )}
              <div className="section-label" style={{ marginTop: 12 }}>
                Pending Withdrawals ({pendingWithdraws.length})
              </div>
              {pendingWithdraws.length === 0 ? (
                <div style={{ color: "var(--muted)", fontSize: "0.8rem" }}>
                  No pending withdrawals
                </div>
              ) : (
                pendingWithdraws.map((w, i) => (
                  <div
                    key={w.id}
                    className="list-item"
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                    data-ocid={`admin.withdraw.item.${i + 1}`}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "0.85rem" }}>
                        {w.user}
                      </div>
                      <div
                        style={{ color: "var(--muted)", fontSize: "0.75rem" }}
                      >
                        ₹{w.amount} → ₹{w.final}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="fire-btn"
                      style={{
                        width: "auto",
                        padding: "6px 14px",
                        fontSize: "0.8rem",
                      }}
                      onClick={() => approveWithdraw(w.id)}
                      data-ocid="admin.confirm_button"
                    >
                      <Check size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      <Footer />
    </motion.div>
  );
}

// ─── Match Join Modal ─────────────────────────────────────────────────────────
function MatchJoinModal({
  mode,
  currentUser,
  coins,
  onClose,
  onJoined,
  setIsLoading,
  showToast,
}: {
  mode: (typeof GAME_MODES)[0];
  currentUser: string;
  coins: number;
  onClose: () => void;
  onJoined: () => void;
  setIsLoading: (v: boolean) => void;
  showToast: (msg: string, type?: "success" | "error") => void;
}) {
  const isTeamMode = mode.id === "clash" || mode.id === "squad";
  const isClash = isTeamMode;
  const [joinedPlayers, setJoinedPlayers] = useState<
    { uid: string; name: string }[]
  >([]);
  const [roomSlots, setRoomSlots] = useState({
    count: 0,
    max: mode.maxPlayers ?? 2,
  });
  const [selectedTeam, setSelectedTeam] = useState<"A" | "B" | null>(null);
  const [teamAPlayers, setTeamAPlayers] = useState<
    { uid: string; name: string }[]
  >([]);
  const [teamBPlayers, setTeamBPlayers] = useState<
    { uid: string; name: string }[]
  >([]);
  const [_adminRoomId, setAdminRoomId] = useState<string | null>(null);
  const [liveEntryFee, setLiveEntryFee] = useState(mode.entryFee);

  useEffect(() => {
    // Load live entry fee from Firestore settings for team modes
    if (isTeamMode) {
      const settingsKey = mode.id === "squad" ? "squad4v4" : "clashSquad";
      getDoc(doc(db, "settings", settingsKey))
        .then((snap) => {
          if (snap.exists()) {
            const data = snap.data();
            if (data.entryPerHead) setLiveEntryFee(data.entryPerHead);
          }
        })
        .catch(() => {});
    }
  }, [isTeamMode, mode.id]);

  useEffect(() => {
    (async () => {
      try {
        const roomQ = query(
          collection(db, "matches"),
          where("mode", "==", mode.id),
          where("status", "in", ["waiting", "full"]),
          where("player", "==", "admin"),
        );
        const roomSnap = await getDocs(roomQ);
        if (!roomSnap.empty) {
          const roomData = roomSnap.docs[0].data();
          const players: string[] = roomData.players || [];
          setAdminRoomId(roomSnap.docs[0].id);
          setRoomSlots({
            count: players.length,
            max: (roomData.maxPlayers || mode.maxPlayers) ?? 2,
          });
          if (isClash) {
            // Load team A and B separately
            const teamA: string[] = roomData.teamA || [];
            const teamB: string[] = roomData.teamB || [];
            const resolveNames = async (uids: string[]) =>
              Promise.all(
                uids.map(async (uid) => {
                  try {
                    const uSnap = await getDoc(doc(db, "users", uid));
                    return {
                      uid,
                      name: uSnap.exists()
                        ? uSnap.data().inGameName ||
                          uSnap.data().displayName ||
                          uid
                        : uid,
                    };
                  } catch (_) {
                    return { uid, name: uid };
                  }
                }),
              );
            setTeamAPlayers(await resolveNames(teamA));
            setTeamBPlayers(await resolveNames(teamB));
            if (roomData.entryFee) setLiveEntryFee(roomData.entryFee);
          } else {
            const names = await Promise.all(
              players.map(async (uid: string) => {
                try {
                  const uSnap = await getDoc(doc(db, "users", uid));
                  const name = uSnap.exists()
                    ? uSnap.data().inGameName || uSnap.data().displayName || uid
                    : uid;
                  return { uid, name };
                } catch (_) {
                  return { uid, name: uid };
                }
              }),
            );
            setJoinedPlayers(names);
          }
        }
      } catch (_) {
        /* ignore */
      }
    })();
  }, [mode.id, mode.maxPlayers, isClash]);

  const join = async () => {
    const fee = isClash ? liveEntryFee : mode.entryFee;
    if (coins < fee) {
      showToast(`Insufficient balance. Need ₹${fee}`, "error");
      return;
    }
    if (isClash && !selectedTeam) {
      showToast("Please select Team A or Team B first!", "error");
      return;
    }
    setIsLoading(true);
    try {
      if (isClash) {
        // Clash Squad team-based join
        const roomQ = query(
          collection(db, "matches"),
          where("mode", "==", mode.id),
          where("status", "==", "waiting"),
          where("player", "==", "admin"),
        );
        const roomSnap = await getDocs(roomQ);
        if (roomSnap.empty) {
          showToast(
            "No room open right now. Wait for admin to create one.",
            "error",
          );
          setIsLoading(false);
          return;
        }
        const roomDoc = roomSnap.docs[0];
        const roomData = roomDoc.data();
        const teamKey = selectedTeam === "A" ? "teamA" : "teamB";
        const existingTeam: string[] = roomData[teamKey] || [];
        if (existingTeam.includes(currentUser)) {
          showToast("Already joined this team!", "error");
          setIsLoading(false);
          return;
        }
        if (existingTeam.length >= 4) {
          showToast(
            `Team ${selectedTeam} is full! Choose the other team.`,
            "error",
          );
          setIsLoading(false);
          return;
        }
        const updatedTeam = [...existingTeam, currentUser];
        const allPlayers: string[] = [...(roomData.players || []), currentUser];
        const isFull = allPlayers.length >= (roomData.maxPlayers || 8);
        const isFirstInTeam = updatedTeam.length === 1;
        await Promise.all([
          updateDoc(doc(db, "matches", roomDoc.id), {
            [teamKey]: updatedTeam,
            players: allPlayers,
            ...(isFirstInTeam && selectedTeam === "A"
              ? { teamALeader: currentUser }
              : {}),
            ...(isFirstInTeam && selectedTeam === "B"
              ? { teamBLeader: currentUser }
              : {}),
            ...(isFull ? { status: "full" } : {}),
          }),
          addDoc(collection(db, "matches"), {
            player: currentUser,
            mode: mode.id,
            status: "waiting",
            entryFee: fee,
            prizePool: roomData.prizePool || mode.prizePool,
            roomId: roomData.roomId || "",
            roomPass: roomData.roomPass || "",
            timestamp: new Date(),
            roomRef: roomDoc.id,
            team: selectedTeam,
          }),
          setDoc(doc(db, "wallet", currentUser), { coins: coins - fee }),
        ]);
        if (isFull) showToast("🔒 Room is now full! Match starting soon.");
      } else {
        // Non-clash join logic
        const roomQ = query(
          collection(db, "matches"),
          where("mode", "==", mode.id),
          where("status", "==", "waiting"),
          where("player", "==", "admin"),
        );
        const roomSnap = await getDocs(roomQ);
        const maxP = mode.maxPlayers ?? 2;

        if (!roomSnap.empty) {
          const roomDoc = roomSnap.docs[0];
          const roomData = roomDoc.data();
          const existingPlayers: string[] = roomData.players ?? [];
          if (existingPlayers.includes(currentUser)) {
            showToast("Already joined this room", "error");
            setIsLoading(false);
            return;
          }
          const updatedPlayers = [...existingPlayers, currentUser];
          const isFull = updatedPlayers.length >= maxP;
          await Promise.all([
            updateDoc(doc(db, "matches", roomDoc.id), {
              players: updatedPlayers,
              ...(isFull ? { status: "full" } : {}),
            }),
            addDoc(collection(db, "matches"), {
              player: currentUser,
              mode: mode.id,
              status: "waiting",
              entryFee: mode.entryFee,
              prizePool: mode.prizePool,
              roomId: roomData.roomId || "",
              roomPass: roomData.roomPass || "",
              timestamp: new Date(),
              roomRef: roomDoc.id,
            }),
            setDoc(doc(db, "wallet", currentUser), {
              coins: coins - mode.entryFee,
            }),
          ]);
          if (isFull) showToast("🔒 Room is now full! Match starting soon.");
        } else {
          await Promise.all([
            addDoc(collection(db, "matches"), {
              player: currentUser,
              mode: mode.id,
              status: "waiting",
              entryFee: mode.entryFee,
              prizePool: mode.prizePool,
              roomId: "",
              roomPass: "",
              timestamp: new Date(),
            }),
            setDoc(doc(db, "wallet", currentUser), {
              coins: coins - mode.entryFee,
            }),
          ]);
        }
      }
      // Save join notification
      try {
        const fee2 = isClash ? liveEntryFee : mode.entryFee;
        const teamLabel = isClash ? ` (Team ${selectedTeam})` : "";
        await addDoc(collection(db, "notifications"), {
          uid: currentUser,
          title: "✅ Match Joined!",
          message: `You joined ${mode.label}${teamLabel}. Entry fee ₹${fee2} deducted. Waiting for Room ID & Password.`,
          read: false,
          timestamp: new Date(),
        });
      } catch (_) {
        /* ignore notification error */
      }
      onJoined();
    } catch (_) {
      showToast("Failed to join match", "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      className="modal-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      data-ocid="match.modal"
    >
      <motion.div
        className="modal-sheet"
        initial={{ y: 200 }}
        animate={{ y: 0 }}
        exit={{ y: 200 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ fontSize: "2.5rem" }}>{mode.emoji}</div>
          <div
            style={{
              fontFamily: "Orbitron, sans-serif",
              fontSize: "1.3rem",
              fontWeight: 700,
              color: "var(--accent)",
            }}
          >
            {mode.label}
          </div>
          <div style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
            {mode.desc}
          </div>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
            marginBottom: 20,
          }}
        >
          <div className="stat-box">
            <div className="stat-value">
              ₹{isClash ? liveEntryFee : mode.entryFee}
            </div>
            <div className="stat-label">
              {isClash ? "Per Player" : "Entry Fee"}
            </div>
          </div>
          <div className="stat-box">
            <div className="stat-value" style={{ color: "var(--success)" }}>
              ₹{mode.prizePool}
            </div>
            <div className="stat-label">Prize Pool</div>
          </div>
          {isClash && (
            <div className="stat-box" style={{ gridColumn: "span 2" }}>
              <div
                className="stat-value"
                style={{ color: "#ff9a00", fontSize: "0.85rem" }}
              >
                4 players/team × ₹{liveEntryFee} = ₹{liveEntryFee * 4} total
                entry
              </div>
              <div className="stat-label">Squad Entry</div>
            </div>
          )}
          {(mode as any).perKill && (
            <div className="stat-box">
              <div className="stat-value" style={{ color: "#ff9a00" }}>
                ₹{(mode as any).perKill}
              </div>
              <div className="stat-label">Per Kill</div>
            </div>
          )}
          {(mode as any).winnerBonus && (
            <div className="stat-box">
              <div className="stat-value" style={{ color: "#ff6b00" }}>
                ₹{(mode as any).winnerBonus}
              </div>
              <div className="stat-label">Winner Bonus</div>
            </div>
          )}
        </div>

        {/* Clash Squad Team Selection */}
        {isClash && (
          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                fontSize: "0.78rem",
                fontWeight: 700,
                color: "#ff9a00",
                fontFamily: "Orbitron, sans-serif",
                marginBottom: 10,
                textAlign: "center",
              }}
            >
              ⚔️ SELECT YOUR TEAM
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
                marginBottom: 10,
              }}
            >
              {/* Team A */}
              <button
                type="button"
                onClick={() =>
                  teamAPlayers.length < 4 ? setSelectedTeam("A") : undefined
                }
                style={{
                  border: `2px solid ${selectedTeam === "A" ? "#22c55e" : "rgba(34,197,94,0.3)"}`,
                  borderRadius: 12,
                  padding: "10px 8px",
                  cursor: teamAPlayers.length < 4 ? "pointer" : "not-allowed",
                  background:
                    selectedTeam === "A"
                      ? "rgba(34,197,94,0.15)"
                      : "rgba(34,197,94,0.04)",
                  transition: "all 0.2s",
                  opacity: teamAPlayers.length >= 4 ? 0.5 : 1,
                }}
              >
                <div
                  style={{
                    fontSize: "0.8rem",
                    fontWeight: 800,
                    color: "#22c55e",
                    marginBottom: 4,
                  }}
                >
                  {selectedTeam === "A" ? "✅ " : ""}TEAM A
                </div>
                <div
                  style={{
                    fontSize: "0.65rem",
                    color: "var(--muted)",
                    marginBottom: 4,
                  }}
                >
                  {teamAPlayers.length}/4 players
                </div>
                {teamAPlayers.length === 0 ? (
                  <div
                    style={{
                      fontSize: "0.62rem",
                      color: "rgba(34,197,94,0.6)",
                    }}
                  >
                    Empty — join first!
                  </div>
                ) : (
                  teamAPlayers.map((p, idx) => (
                    <div
                      key={p.uid}
                      style={{
                        fontSize: "0.62rem",
                        color: "#fff",
                        padding: "1px 0",
                      }}
                    >
                      {idx === 0 ? "👑 " : "• "}
                      {p.name}
                    </div>
                  ))
                )}
                {teamAPlayers.length >= 4 && (
                  <div
                    style={{
                      fontSize: "0.62rem",
                      color: "#f87171",
                      marginTop: 4,
                    }}
                  >
                    🔒 FULL
                  </div>
                )}
              </button>
              {/* Team B */}
              <button
                type="button"
                onClick={() =>
                  teamBPlayers.length < 4 ? setSelectedTeam("B") : undefined
                }
                style={{
                  border: `2px solid ${selectedTeam === "B" ? "#f87171" : "rgba(239,68,68,0.3)"}`,
                  borderRadius: 12,
                  padding: "10px 8px",
                  cursor: teamBPlayers.length < 4 ? "pointer" : "not-allowed",
                  background:
                    selectedTeam === "B"
                      ? "rgba(239,68,68,0.15)"
                      : "rgba(239,68,68,0.04)",
                  transition: "all 0.2s",
                  opacity: teamBPlayers.length >= 4 ? 0.5 : 1,
                  textAlign: "left",
                  width: "100%",
                }}
              >
                <div
                  style={{
                    fontSize: "0.8rem",
                    fontWeight: 800,
                    color: "#f87171",
                    marginBottom: 4,
                  }}
                >
                  {selectedTeam === "B" ? "✅ " : ""}TEAM B
                </div>
                <div
                  style={{
                    fontSize: "0.65rem",
                    color: "var(--muted)",
                    marginBottom: 4,
                  }}
                >
                  {teamBPlayers.length}/4 players
                </div>
                {teamBPlayers.length === 0 ? (
                  <div
                    style={{
                      fontSize: "0.62rem",
                      color: "rgba(239,68,68,0.6)",
                    }}
                  >
                    Empty — join first!
                  </div>
                ) : (
                  teamBPlayers.map((p, idx) => (
                    <div
                      key={p.uid}
                      style={{
                        fontSize: "0.62rem",
                        color: "#fff",
                        padding: "1px 0",
                      }}
                    >
                      {idx === 0 ? "👑 " : "• "}
                      {p.name}
                    </div>
                  ))
                )}
                {teamBPlayers.length >= 4 && (
                  <div
                    style={{
                      fontSize: "0.62rem",
                      color: "#f87171",
                      marginTop: 4,
                    }}
                  >
                    🔒 FULL
                  </div>
                )}
              </button>
            </div>
            {!selectedTeam && (
              <div
                style={{
                  fontSize: "0.72rem",
                  color: "#ff9a00",
                  textAlign: "center",
                  padding: "6px",
                  background: "rgba(255,107,0,0.08)",
                  borderRadius: 8,
                }}
              >
                👆 Tap a team to select it before joining
              </div>
            )}
            {selectedTeam && (
              <div
                style={{
                  fontSize: "0.72rem",
                  color: "#22c55e",
                  textAlign: "center",
                  padding: "6px",
                  background: "rgba(34,197,94,0.08)",
                  borderRadius: 8,
                }}
              >
                ✅ You selected Team {selectedTeam} — Pay ₹{liveEntryFee} to
                join
              </div>
            )}
          </div>
        )}

        {/* Non-clash slot occupancy display */}
        {!isClash && (
          <div
            style={{
              marginBottom: 14,
              background: "rgba(255,107,0,0.08)",
              border: "1.5px solid rgba(255,107,0,0.3)",
              borderRadius: 12,
              padding: "10px 12px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: joinedPlayers.length > 0 ? 8 : 0,
              }}
            >
              <span
                style={{
                  fontSize: "0.75rem",
                  color: "#ff9a00",
                  fontFamily: "Orbitron, sans-serif",
                  fontWeight: 700,
                }}
              >
                👥 PLAYERS JOINED
              </span>
              <span
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  color:
                    roomSlots.count >= roomSlots.max
                      ? "#f87171"
                      : "var(--success)",
                }}
              >
                {roomSlots.count}/{roomSlots.max}{" "}
                {roomSlots.count >= roomSlots.max ? "🔒 FULL" : "🟢 OPEN"}
              </span>
            </div>
            {joinedPlayers.length === 0 ? (
              <div
                style={{
                  fontSize: "0.72rem",
                  color: "var(--muted)",
                  textAlign: "center",
                  paddingTop: 4,
                }}
              >
                No players yet — be the first!
              </div>
            ) : (
              joinedPlayers.map((p, i) => (
                <div
                  key={p.uid}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "5px 8px",
                    background: "rgba(255,255,255,0.05)",
                    borderRadius: 8,
                    marginBottom: 4,
                  }}
                >
                  <span
                    style={{
                      color: "#f59e0b",
                      fontWeight: 700,
                      fontSize: "0.7rem",
                      minWidth: 22,
                    }}
                  >
                    #{i + 1}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontSize: "0.78rem",
                        fontWeight: 700,
                        color: "#fff",
                      }}
                    >
                      {p.name}
                    </div>
                    <div style={{ fontSize: "0.62rem", color: "var(--muted)" }}>
                      UID: {p.uid}
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: "0.65rem",
                      color: "#ff6b00",
                      fontFamily: "Orbitron, sans-serif",
                    }}
                  >
                    IN ROOM
                  </span>
                </div>
              ))
            )}
          </div>
        )}
        <div
          style={{
            fontSize: "0.8rem",
            color: "var(--muted)",
            textAlign: "center",
            marginBottom: 16,
          }}
        >
          Your balance:{" "}
          <strong style={{ color: "var(--text)" }}>₹{coins}</strong>
          {coins < (isClash ? liveEntryFee : mode.entryFee) && (
            <span style={{ color: "var(--danger)" }}> (Insufficient)</span>
          )}
        </div>
        <button
          type="button"
          className="fire-btn"
          onClick={join}
          disabled={
            coins < (isClash ? liveEntryFee : mode.entryFee) ||
            (isClash
              ? teamAPlayers.length >= 4 && teamBPlayers.length >= 4
              : roomSlots.count >= roomSlots.max) ||
            (isClash && !selectedTeam)
          }
          data-ocid="match.confirm_button"
        >
          {isClash && teamAPlayers.length >= 4 && teamBPlayers.length >= 4
            ? "🔒 Room Full"
            : isClash && !selectedTeam
              ? "Select a Team First"
              : !isClash && roomSlots.count >= roomSlots.max
                ? "🔒 Room Full"
                : isClash
                  ? `Join Team ${selectedTeam} — ₹${liveEntryFee}`
                  : `Confirm Join — ₹${mode.entryFee}`}
        </button>
        <button
          type="button"
          className="fire-btn fire-btn-secondary"
          style={{ marginTop: 10 }}
          onClick={onClose}
          data-ocid="match.cancel_button"
        >
          Cancel
        </button>
      </motion.div>
    </motion.div>
  );
}

// ─── Schedule Section ─────────────────────────────────────────────────────────
function ScheduleSection() {
  // Generate time slots 5:00 PM to 11:00 PM with 15-min match + 15-min break
  const slots: { matchTime: string; breakEnd: string; slotIndex: number }[] =
    [];
  let hour = 17; // 5 PM
  let minute = 0;
  let idx = 1;
  while (hour < 23) {
    const _matchH = hour.toString().padStart(2, "0");
    const _matchM = minute.toString().padStart(2, "0");
    const ampm = hour < 12 ? "AM" : "PM";
    const displayH = hour > 12 ? hour - 12 : hour;
    const matchDisplay = `${displayH}:${minute.toString().padStart(2, "0")} ${ampm}`;

    // Break ends 15 mins after match slot (match duration assumed 15 mins, break 15 mins)
    let bMin = minute + 15;
    let bHour = hour;
    if (bMin >= 60) {
      bMin -= 60;
      bHour++;
    }
    const breakAmpm = bHour < 12 ? "AM" : "PM";
    const breakDisplayH = bHour > 12 ? bHour - 12 : bHour;
    const breakDisplay = `${breakDisplayH}:${bMin.toString().padStart(2, "0")} ${breakAmpm}`;

    // Next slot is 30 mins later (15 match + 15 break)
    minute += 30;
    if (minute >= 60) {
      minute -= 60;
      hour++;
    }

    if (bHour < 23 || (bHour === 23 && bMin === 0)) {
      slots.push({
        matchTime: matchDisplay,
        breakEnd: breakDisplay,
        slotIndex: idx++,
      });
    }
  }

  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();

  const getSlotStatus = (matchDisplay: string) => {
    const parts = matchDisplay.match(/(\d+):(\d+)\s+(AM|PM)/);
    if (!parts) return "upcoming";
    let h = Number.parseInt(parts[1]);
    const m = Number.parseInt(parts[2]);
    const ap = parts[3];
    if (ap === "PM" && h !== 12) h += 12;
    if (ap === "AM" && h === 12) h = 0;
    const slotStart = h * 60 + m;
    const slotEnd = slotStart + 15;
    if (nowMins >= slotStart && nowMins < slotEnd) return "live";
    if (nowMins >= slotEnd && nowMins < slotEnd + 15) return "break";
    if (nowMins < slotStart) return "upcoming";
    return "done";
  };

  return (
    <div
      style={{
        background:
          "linear-gradient(135deg, rgba(255,107,0,0.08) 0%, rgba(0,0,0,0.4) 100%)",
        border: "1px solid rgba(255,107,0,0.3)",
        borderRadius: 16,
        padding: "20px 16px",
        marginBottom: 20,
      }}
      data-ocid="schedule.section"
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 16,
        }}
      >
        <span style={{ fontSize: "1.4rem" }}>📅</span>
        <div>
          <div
            style={{
              fontFamily: "Orbitron, sans-serif",
              fontWeight: 700,
              color: "var(--accent)",
              fontSize: "1rem",
            }}
          >
            DAILY MATCH SCHEDULE
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
            5:00 PM – 11:00 PM • 15 min match + 15 min break
          </div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {slots.map((slot) => {
          const status = getSlotStatus(slot.matchTime);
          return (
            <div
              key={slot.slotIndex}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                background:
                  status === "live"
                    ? "rgba(255,107,0,0.18)"
                    : status === "break"
                      ? "rgba(255,200,0,0.08)"
                      : status === "done"
                        ? "rgba(255,255,255,0.03)"
                        : "rgba(255,255,255,0.05)",
                border:
                  status === "live"
                    ? "1px solid rgba(255,107,0,0.7)"
                    : status === "break"
                      ? "1px solid rgba(255,200,0,0.3)"
                      : "1px solid rgba(255,255,255,0.08)",
                borderRadius: 10,
                padding: "10px 14px",
                opacity: status === "done" ? 0.5 : 1,
              }}
            >
              <div
                style={{
                  minWidth: 28,
                  height: 28,
                  borderRadius: "50%",
                  background:
                    status === "live"
                      ? "var(--accent)"
                      : status === "done"
                        ? "rgba(255,255,255,0.1)"
                        : "rgba(255,107,0,0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "Orbitron, sans-serif",
                  fontWeight: 700,
                  fontSize: "0.7rem",
                  color: status === "live" ? "#fff" : "var(--muted)",
                  flexShrink: 0,
                }}
              >
                {slot.slotIndex}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{
                      fontFamily: "Rajdhani, sans-serif",
                      fontWeight: 700,
                      color:
                        status === "live" ? "var(--accent)" : "var(--text)",
                      fontSize: "0.95rem",
                    }}
                  >
                    {slot.matchTime}
                  </span>
                  {status === "live" && (
                    <span
                      style={{
                        background: "var(--accent)",
                        color: "#fff",
                        fontSize: "0.6rem",
                        fontWeight: 700,
                        padding: "2px 7px",
                        borderRadius: 20,
                        fontFamily: "Orbitron, sans-serif",
                        animation: "pulse 1.5s infinite",
                      }}
                    >
                      LIVE
                    </span>
                  )}
                  {status === "break" && (
                    <span
                      style={{
                        background: "rgba(255,200,0,0.2)",
                        color: "#ffd700",
                        fontSize: "0.6rem",
                        fontWeight: 700,
                        padding: "2px 7px",
                        borderRadius: 20,
                        fontFamily: "Orbitron, sans-serif",
                      }}
                    >
                      BREAK
                    </span>
                  )}
                  {status === "done" && (
                    <span
                      style={{
                        background: "rgba(255,255,255,0.08)",
                        color: "var(--muted)",
                        fontSize: "0.6rem",
                        fontWeight: 700,
                        padding: "2px 7px",
                        borderRadius: 20,
                        fontFamily: "Rajdhani, sans-serif",
                      }}
                    >
                      DONE
                    </span>
                  )}
                </div>
                <div
                  style={{
                    fontSize: "0.72rem",
                    color: "var(--muted)",
                    marginTop: 2,
                  }}
                >
                  {status === "break"
                    ? `⏸ Break until ${slot.breakEnd}`
                    : `⏱ Match ends • Break until ${slot.breakEnd}`}
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div
                  style={{
                    fontSize: "0.65rem",
                    color: "var(--muted)",
                    fontFamily: "Rajdhani",
                  }}
                >
                  ALL MODES
                </div>
                <div
                  style={{
                    fontSize: "0.7rem",
                    color: status === "live" ? "var(--accent)" : "var(--muted)",
                    fontWeight: 700,
                  }}
                >
                  15 MIN
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div
        style={{
          marginTop: 12,
          padding: "8px 12px",
          background: "rgba(255,107,0,0.06)",
          borderRadius: 8,
          fontSize: "0.72rem",
          color: "var(--muted)",
          textAlign: "center",
        }}
      >
        ⚠️ All game modes run simultaneously • After every match, 15 min break
        before next slot
      </div>
    </div>
  );
}

// ─── Match History ────────────────────────────────────────────────────────────
function MatchHistoryView({
  currentUser,
  coins: _coins,
  setView,
  setIsLoading,
  showToast,
}: {
  currentUser: string;
  coins?: number;
  setView: (v: View) => void;
  setIsLoading: (v: boolean) => void;
  showToast: (msg: string, type?: "success" | "error") => void;
}) {
  const [matches, setMatches] = useState<MatchData[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const q = query(
        collection(db, "matches"),
        where("player", "==", currentUser),
      );
      const snap = await getDocs(q);
      setMatches(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as MatchData)
          .reverse(),
      );
      setLoaded(true);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser, setIsLoading]);

  useEffect(() => {
    load();
  }, [load]);

  const cancelMatch = async (id: string) => {
    setIsLoading(true);
    try {
      const matchSnap = await getDoc(doc(db, "matches", id));
      const matchData = matchSnap.exists() ? matchSnap.data() : null;
      const refundAmount = matchData?.entryFee ?? 0;
      const walletSnap = await getDoc(doc(db, "wallet", currentUser));
      const currentCoins = walletSnap.exists()
        ? (walletSnap.data().coins ?? 0)
        : 0;
      await Promise.all([
        deleteDoc(doc(db, "matches", id)),
        ...(refundAmount > 0
          ? [
              setDoc(doc(db, "wallet", currentUser), {
                coins: currentCoins + refundAmount,
              }),
            ]
          : []),
      ]);
      showToast(`Match cancelled. ₹${refundAmount} refunded to wallet! 💰`);
      load();
    } catch (_) {
      showToast("Error cancelling", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text).then(() => showToast("Copied!"));
  };

  const statusClass = (s: string) =>
    s === "live"
      ? "badge-live"
      : s === "completed"
        ? "badge-completed"
        : s === "full"
          ? "badge-full"
          : "badge-waiting";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="main-content"
      data-ocid="matches.section"
    >
      <button
        type="button"
        className="back-btn"
        onClick={() => setView("dashboard")}
        data-ocid="matches.back.button"
      >
        <ArrowLeft size={16} /> Back
      </button>
      <h2 className="view-title">⚔️ Match History</h2>
      <ScheduleSection />
      {loaded && matches.length === 0 ? (
        <div className="empty-state" data-ocid="matches.empty_state">
          <div className="empty-state-icon">🎮</div>
          <div>No matches yet. Join a game mode from the dashboard!</div>
        </div>
      ) : (
        matches.map((m, i) => (
          <div
            key={m.id}
            className="list-item"
            data-ocid={`matches.item.${i + 1}`}
          >
            <div className="flex-between" style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    fontFamily: "Orbitron, sans-serif",
                    fontWeight: 700,
                    color: "var(--accent)",
                    fontSize: "0.9rem",
                  }}
                >
                  {m.mode?.toUpperCase()}
                </span>
                <span className={`badge ${statusClass(m.status)}`}>
                  {m.status}
                </span>
              </div>
              <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                ₹{m.entryFee} / 🏆₹{m.prizePool}
              </div>
            </div>
            {(m.status === "live" || m.status === "waiting") && (
              <div style={{ marginBottom: 8 }}>
                {m.status === "live" && <LiveTimer startedAt={m.startedAt} />}
                {
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 8,
                      marginBottom: 8,
                      marginTop: 8,
                    }}
                  >
                    <div className="room-info-box">
                      <div className="room-info-label">Room ID</div>
                      <div className="room-info-value">
                        {m.roomId || "Pending"}
                      </div>
                      {m.roomId && (
                        <button
                          type="button"
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            color: "var(--muted)",
                            marginTop: 4,
                          }}
                          onClick={() => copyText(m.roomId)}
                          data-ocid="matches.secondary_button"
                        >
                          <Copy size={12} />
                        </button>
                      )}
                    </div>
                    <div className="room-info-box">
                      <div className="room-info-label">Password</div>
                      <div className="room-info-value">
                        {m.roomPass || "Pending"}
                      </div>
                      {m.roomPass && (
                        <button
                          type="button"
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            color: "var(--muted)",
                            marginTop: 4,
                          }}
                          onClick={() => copyText(m.roomPass)}
                          data-ocid="matches.secondary_button"
                        >
                          <Copy size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                }
              </div>
            )}
            {m.status === "waiting" && (
              <button
                type="button"
                className="fire-btn fire-btn-danger"
                style={{
                  padding: "8px 16px",
                  width: "auto",
                  fontSize: "0.8rem",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
                onClick={() => cancelMatch(m.id)}
                data-ocid="matches.delete_button"
              >
                <X size={14} /> Cancel Match
              </button>
            )}
          </div>
        ))
      )}
      <Footer />
    </motion.div>
  );
}

// ─── Leaderboard ──────────────────────────────────────────────────────────────
function LeaderboardView({
  currentUser,
  setIsLoading,
}: { currentUser: string; setIsLoading: (v: boolean) => void }) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      try {
        const snap = await getDocs(collection(db, "users"));
        const all = snap.docs.map((d) => {
          const data = d.data();
          return {
            uid: data.uid || d.id,
            displayName: data.displayName || d.id,
            coins: data.coins || 0,
            wins: data.wins || 0,
          };
        });
        all.sort((a, b) => b.coins - a.coins);
        setEntries(all.slice(0, 20));
      } finally {
        setIsLoading(false);
      }
    })();
  }, [setIsLoading]);

  const rankClass = (i: number) =>
    i === 0 ? "gold" : i === 1 ? "silver" : i === 2 ? "bronze" : "";
  const rankEmoji = (i: number) =>
    i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : String(i + 1);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="main-content"
      data-ocid="leaderboard.section"
    >
      <h2 className="view-title">🏆 Leaderboard</h2>
      {entries.length === 0 ? (
        <div className="empty-state" data-ocid="leaderboard.empty_state">
          <div className="empty-state-icon">🏆</div>
          <div>No players yet. Be the first!</div>
        </div>
      ) : (
        <div>
          {entries.map((e, i) => (
            <div
              key={e.uid}
              className={`leaderboard-row ${e.uid === currentUser ? "current" : ""}`}
              data-ocid={`leaderboard.item.${i + 1}`}
            >
              <div className={`rank-badge ${rankClass(i)}`}>{rankEmoji(i)}</div>
              <div
                className="avatar-circle"
                style={{ width: 36, height: 36, fontSize: "0.85rem" }}
              >
                {(e.displayName || e.uid)[0].toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>
                  {e.displayName || e.uid}
                  {e.uid === currentUser && (
                    <span
                      style={{
                        color: "var(--accent)",
                        fontSize: "0.7rem",
                        marginLeft: 6,
                      }}
                    >
                      (You)
                    </span>
                  )}
                </div>
                <div style={{ color: "var(--muted)", fontSize: "0.75rem" }}>
                  {e.wins} wins
                </div>
              </div>
              <div
                style={{
                  fontFamily: "Orbitron, sans-serif",
                  fontWeight: 700,
                  color: "var(--accent)",
                  fontSize: "0.9rem",
                }}
              >
                ₹{e.coins}
              </div>
            </div>
          ))}
        </div>
      )}
      <Footer />
    </motion.div>
  );
}

// ─── Notifications ────────────────────────────────────────────────────────────
function NotificationsView({
  currentUser,
  setIsLoading,
}: { currentUser: string; setIsLoading: (v: boolean) => void }) {
  const [notifs, setNotifs] = useState<NotifData[]>([]);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      try {
        const q = query(
          collection(db, "notifications"),
          where("uid", "==", currentUser),
        );
        const snap = await getDocs(q);
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as NotifData)
          .reverse();
        setNotifs(list);
        // Mark all read
        await Promise.all(
          snap.docs
            .filter((d) => !d.data().read)
            .map((d) => updateDoc(d.ref, { read: true })),
        );
      } finally {
        setIsLoading(false);
      }
    })();
  }, [currentUser, setIsLoading]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="main-content"
      data-ocid="notifications.section"
    >
      <h2 className="view-title">🔔 Notifications</h2>
      {notifs.length === 0 ? (
        <div className="empty-state" data-ocid="notifications.empty_state">
          <div className="empty-state-icon">🔔</div>
          <div>No notifications yet</div>
        </div>
      ) : (
        notifs.map((n, i) => (
          <div
            key={n.id}
            className={`notif-item ${!n.read ? "unread" : ""}`}
            data-ocid={`notifications.item.${i + 1}`}
          >
            <div>
              <Bell
                size={18}
                color={n.read ? "var(--muted)" : "var(--accent)"}
              />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>
                {n.title}
              </div>
              <div
                style={{
                  color: "var(--muted)",
                  fontSize: "0.8rem",
                  marginTop: 2,
                }}
              >
                {n.message}
              </div>
            </div>
            {!n.read && (
              <span
                className="badge badge-pending"
                style={{ fontSize: "0.6rem" }}
              >
                NEW
              </span>
            )}
          </div>
        ))
      )}
      <Footer />
    </motion.div>
  );
}

// ─── Profile ──────────────────────────────────────────────────────────────────
function ProfileView({
  userData,
  coins,
  setView,
  logout,
}: {
  userData: UserData;
  coins: number;
  setView: (v: View) => void;
  logout: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="main-content"
      data-ocid="profile.section"
    >
      <div className="profile-header">
        <div
          className="avatar-circle"
          style={{ width: 80, height: 80, fontSize: "2rem" }}
        >
          {(userData.displayName || userData.uid)[0].toUpperCase()}
        </div>
        <div>
          <div className="profile-name">
            {userData.displayName || userData.uid}
          </div>
          <div className="profile-uid">UID: {userData.uid}</div>
          {userData.phone && (
            <div className="profile-uid">📱 {userData.phone}</div>
          )}
          {userData.inGameName && (
            <div className="profile-uid">🎮 {userData.inGameName}</div>
          )}
        </div>
      </div>

      <div className="stat-grid" style={{ marginBottom: 16 }}>
        {[
          { value: coins, label: "Coins" },
          { value: userData.wins, label: "Wins" },
          { value: userData.kills, label: "Kills" },
          { value: userData.matchesPlayed, label: "Matches" },
        ].map((s) => (
          <div key={s.label} className="stat-box">
            <div className="stat-value">₹{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <button
          type="button"
          className="fire-btn"
          onClick={() => setView("profile-edit")}
          data-ocid="profile.edit_button"
        >
          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              justifyContent: "center",
            }}
          >
            <Edit3 size={16} /> Edit Profile
          </span>
        </button>
        <button
          type="button"
          className="fire-btn fire-btn-secondary"
          onClick={() => setView("deposit-history")}
          data-ocid="profile.secondary_button"
        >
          Deposit History
        </button>
        <button
          type="button"
          className="fire-btn fire-btn-secondary"
          onClick={() => setView("withdraw-history")}
          data-ocid="profile.secondary_button"
        >
          Withdraw History
        </button>
        <button
          type="button"
          className="fire-btn fire-btn-secondary"
          onClick={() => setView("match-history")}
          data-ocid="profile.secondary_button"
        >
          Match History
        </button>
        <button
          type="button"
          className="fire-btn fire-btn-danger"
          onClick={logout}
          data-ocid="profile.delete_button"
        >
          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              justifyContent: "center",
            }}
          >
            <LogOut size={16} /> Logout
          </span>
        </button>
      </div>

      <Footer />
    </motion.div>
  );
}

// ─── Profile Edit ─────────────────────────────────────────────────────────────
function ProfileEditView({
  currentUser,
  userData,
  setUserData,
  setView,
  setIsLoading,
  showToast,
}: {
  currentUser: string;
  userData: UserData;
  setUserData: (d: UserData) => void;
  setView: (v: View) => void;
  setIsLoading: (v: boolean) => void;
  showToast: (msg: string, type?: "success" | "error") => void;
}) {
  const [name, setName] = useState(userData.displayName || "");
  const [phone, setPhone] = useState(userData.phone || "");
  const [inGame, setInGame] = useState(userData.inGameName || "");

  const save = async () => {
    setIsLoading(true);
    try {
      await updateDoc(doc(db, "users", currentUser), {
        displayName: name,
        phone,
        inGameName: inGame,
      });
      setUserData({
        ...userData,
        displayName: name,
        phone,
        inGameName: inGame,
      });
      showToast("Profile updated!");
      setView("profile");
    } catch (_) {
      showToast("Update failed", "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="main-content"
      data-ocid="profile-edit.section"
    >
      <button
        type="button"
        className="back-btn"
        onClick={() => setView("profile")}
        data-ocid="profile-edit.back.button"
      >
        <ArrowLeft size={16} /> Back
      </button>
      <h2 className="view-title">✏️ Edit Profile</h2>
      <div className="auth-form">
        <div className="field-group">
          <div className="field-label">Display Name</div>
          <input
            className="fire-input"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            data-ocid="profile-edit.input"
          />
        </div>
        <div className="field-group">
          <div className="field-label">Phone Number</div>
          <input
            className="fire-input"
            placeholder="+91 XXXXXXXXXX"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            data-ocid="profile-edit.input"
          />
        </div>
        <div className="field-group">
          <div className="field-label">In-Game Name</div>
          <input
            className="fire-input"
            placeholder="Your in-game name"
            value={inGame}
            onChange={(e) => setInGame(e.target.value)}
            data-ocid="profile-edit.input"
          />
        </div>
        <button
          type="button"
          className="fire-btn"
          onClick={save}
          data-ocid="profile-edit.save_button"
        >
          Save Changes
        </button>
        <button
          type="button"
          className="fire-btn fire-btn-secondary"
          onClick={() => setView("profile")}
          data-ocid="profile-edit.cancel_button"
        >
          Cancel
        </button>
      </div>
    </motion.div>
  );
}

// ─── Deposit History ──────────────────────────────────────────────────────────
function DepositHistoryView({
  currentUser,
  setView,
  setIsLoading,
}: {
  currentUser: string;
  setView: (v: View) => void;
  setIsLoading: (v: boolean) => void;
}) {
  const [payments, setPayments] = useState<PaymentData[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      try {
        const q = query(
          collection(db, "payments"),
          where("user", "==", currentUser),
        );
        const snap = await getDocs(q);
        setPayments(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() }) as PaymentData)
            .reverse(),
        );
        setLoaded(true);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [currentUser, setIsLoading]);

  const badgeClass = (s: string) =>
    s === "Approved"
      ? "badge-approved"
      : s === "Pending"
        ? "badge-pending"
        : "badge-rejected";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="main-content"
      data-ocid="deposit.section"
    >
      <button
        type="button"
        className="back-btn"
        onClick={() => setView("dashboard")}
        data-ocid="deposit.back.button"
      >
        <ArrowLeft size={16} /> Back
      </button>
      <h2 className="view-title">💸 Deposit History</h2>
      {loaded && payments.length === 0 ? (
        <div className="empty-state" data-ocid="deposit.empty_state">
          <div className="empty-state-icon">💸</div>
          <div>No deposits yet</div>
        </div>
      ) : (
        payments.map((p, i) => (
          <div
            key={p.id}
            className="list-item flex-between"
            data-ocid={`deposit.item.${i + 1}`}
          >
            <div>
              <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>
                ₹{p.amount}
              </div>
              <div style={{ color: "var(--muted)", fontSize: "0.75rem" }}>
                UTR: {p.utr}
              </div>
            </div>
            <span className={`badge ${badgeClass(p.status)}`}>{p.status}</span>
          </div>
        ))
      )}
      <Footer />
    </motion.div>
  );
}

// ─── Withdraw History ─────────────────────────────────────────────────────────
function WithdrawHistoryView({
  currentUser,
  setView,
  setIsLoading,
}: {
  currentUser: string;
  setView: (v: View) => void;
  setIsLoading: (v: boolean) => void;
}) {
  const [withdraws, setWithdraws] = useState<WithdrawData[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      try {
        const q = query(
          collection(db, "withdraw"),
          where("user", "==", currentUser),
        );
        const snap = await getDocs(q);
        setWithdraws(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() }) as WithdrawData)
            .reverse(),
        );
        setLoaded(true);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [currentUser, setIsLoading]);

  const badgeClass = (s: string) =>
    s === "Approved"
      ? "badge-approved"
      : s === "Pending"
        ? "badge-pending"
        : "badge-rejected";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="main-content"
      data-ocid="withdraw.section"
    >
      <button
        type="button"
        className="back-btn"
        onClick={() => setView("dashboard")}
        data-ocid="withdraw.back.button"
      >
        <ArrowLeft size={16} /> Back
      </button>
      <h2 className="view-title">💰 Withdraw History</h2>
      {loaded && withdraws.length === 0 ? (
        <div className="empty-state" data-ocid="withdraw.empty_state">
          <div className="empty-state-icon">💰</div>
          <div>No withdrawals yet</div>
        </div>
      ) : (
        withdraws.map((w, i) => (
          <div
            key={w.id}
            className="list-item flex-between"
            data-ocid={`withdraw.item.${i + 1}`}
          >
            <div>
              <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>
                ₹{w.amount} → ₹{w.final}
              </div>
              <div style={{ color: "var(--muted)", fontSize: "0.75rem" }}>
                After 9% fee
              </div>
            </div>
            <span className={`badge ${badgeClass(w.status)}`}>{w.status}</span>
          </div>
        ))
      )}
      <Footer />
    </motion.div>
  );
}

// ─── Chat Support ─────────────────────────────────────────────────────────────
function ChatSupportView({
  currentUser,
  setView,
  setIsLoading,
  showToast,
}: {
  currentUser: string;
  setView: (v: View) => void;
  setIsLoading: (v: boolean) => void;
  showToast: (msg: string, type?: "success" | "error") => void;
}) {
  const [messages, setMessages] = useState<
    { id: number; text: string; sent: boolean }[]
  >([
    {
      id: 0,
      text: "👋 Hello! How can we help you today? Type your message below.",
      sent: false,
    },
  ]);
  const [input, setInput] = useState("");

  const send = async () => {
    if (!input.trim()) return;
    const text = input.trim();
    setMessages((prev) => [...prev, { id: prev.length, text, sent: true }]);
    setInput("");
    setIsLoading(true);
    try {
      await addDoc(collection(db, "support"), {
        uid: currentUser,
        message: text,
        timestamp: new Date(),
      });
      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            id: prev.length,
            text: "✅ Message received! Our team will respond within 24 hours.",
            sent: false,
          },
        ]);
      }, 800);
    } catch (_) {
      showToast("Failed to send message", "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="main-content"
      data-ocid="chat.section"
    >
      <button
        type="button"
        className="back-btn"
        onClick={() => setView("dashboard")}
        data-ocid="chat.back.button"
      >
        <ArrowLeft size={16} /> Back
      </button>
      <h2 className="view-title">💬 Chat Support</h2>
      <div style={{ minHeight: 200, marginBottom: 16 }}>
        {messages.map((m) => (
          <div
            key={m.id}
            style={{
              display: "flex",
              justifyContent: m.sent ? "flex-end" : "flex-start",
              marginBottom: 10,
            }}
          >
            {m.sent ? (
              <div className="chat-bubble-sent">{m.text}</div>
            ) : (
              <div
                style={{
                  background: "var(--card-bg)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "14px 14px 14px 4px",
                  padding: "10px 14px",
                  maxWidth: "80%",
                  fontSize: "0.9rem",
                  color: "var(--text)",
                }}
              >
                {m.text}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="chat-input-row">
        <input
          className="fire-input"
          placeholder="Type your message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          style={{ flex: 1 }}
          data-ocid="chat.input"
        />
        <button
          type="button"
          className="fire-btn"
          style={{ width: "auto", padding: "12px 20px" }}
          onClick={send}
          data-ocid="chat.submit_button"
        >
          Send
        </button>
      </div>
    </motion.div>
  );
}

// ─── Report Problem ───────────────────────────────────────────────────────────
function ReportProblemView({
  currentUser,
  setView,
  setIsLoading,
  showToast,
}: {
  currentUser: string;
  setView: (v: View) => void;
  setIsLoading: (v: boolean) => void;
  showToast: (msg: string, type?: "success" | "error") => void;
}) {
  const [category, setCategory] = useState("Bug");
  const [desc, setDesc] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const submit = async () => {
    if (!desc.trim()) {
      showToast("Please describe the issue", "error");
      return;
    }
    setIsLoading(true);
    try {
      await addDoc(collection(db, "reports"), {
        uid: currentUser,
        category,
        description: desc,
        timestamp: new Date(),
        status: "Open",
      });
      setSubmitted(true);
      showToast("Report submitted!");
    } catch (_) {
      showToast("Submission failed", "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="main-content"
      data-ocid="report.section"
    >
      <button
        type="button"
        className="back-btn"
        onClick={() => setView("dashboard")}
        data-ocid="report.back.button"
      >
        <ArrowLeft size={16} /> Back
      </button>
      <h2 className="view-title">🚩 Report Problem</h2>
      {submitted ? (
        <div
          style={{ textAlign: "center", padding: "40px 20px" }}
          data-ocid="report.success_state"
        >
          <div style={{ fontSize: "3rem", marginBottom: 16 }}>✅</div>
          <div
            style={{
              fontFamily: "Orbitron, sans-serif",
              color: "var(--success)",
              marginBottom: 8,
            }}
          >
            Report Submitted!
          </div>
          <div
            style={{
              color: "var(--muted)",
              fontSize: "0.85rem",
              marginBottom: 24,
            }}
          >
            We'll review your report within 48 hours.
          </div>
          <button
            type="button"
            className="fire-btn"
            onClick={() => setView("dashboard")}
            data-ocid="report.primary_button"
          >
            Back to Home
          </button>
        </div>
      ) : (
        <div className="auth-form">
          <div className="field-group">
            <div className="field-label">Issue Category</div>
            <select
              className="fire-input"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              data-ocid="report.select"
            >
              {[
                "Bug",
                "Cheater",
                "Payment Issue",
                "Match Problem",
                "Other",
              ].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="field-group">
            <div className="field-label">Description</div>
            <textarea
              className="fire-input"
              placeholder="Describe the issue in detail..."
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              rows={5}
              style={{ resize: "vertical", fontFamily: "Rajdhani, sans-serif" }}
              data-ocid="report.textarea"
            />
          </div>
          <button
            type="button"
            className="fire-btn"
            onClick={submit}
            data-ocid="report.submit_button"
          >
            Submit Report
          </button>
          <button
            type="button"
            className="fire-btn fire-btn-secondary"
            onClick={() => setView("dashboard")}
            data-ocid="report.cancel_button"
          >
            Cancel
          </button>
        </div>
      )}
    </motion.div>
  );
}

// ─── Live Timer ───────────────────────────────────────────────────────────────
function LiveTimer({ startedAt }: { startedAt?: number }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startedAt) return;
    const update = () =>
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  if (!startedAt) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: "0.82rem",
          color: "#22c55e",
        }}
      >
        <span className="pulse-dot" />🕐 Room is Live!
      </div>
    );
  }

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        fontSize: "0.82rem",
        color: "#22c55e",
        fontWeight: 700,
      }}
    >
      <span className="pulse-dot" />🕐 Room Live: {mins}m {secs}s ago
    </div>
  );
}

// ─── Admin Types ──────────────────────────────────────────────────────────────
type AdminView =
  | "admin-dashboard"
  | "admin-users"
  | "admin-matches"
  | "admin-payments"
  | "admin-withdrawals"
  | "admin-announcements"
  | "admin-complaints"
  | "admin-chat"
  | "admin-logs";

interface AdminLogEntry {
  id: string;
  action: string;
  target: string;
  adminUid: string;
  timestamp: unknown;
}
interface AdminMatchData extends MatchData {
  winner?: string;
  teamA?: string[];
  teamB?: string[];
  teamALeader?: string;
  teamBLeader?: string;
  squadEntryTotal?: number;
}

async function logAdminAction(action: string, target = "") {
  try {
    await addDoc(collection(db, "admin_logs"), {
      action,
      target,
      adminUid: "admin",
      timestamp: new Date(),
    });
  } catch (_) {
    /* ignore */
  }
}

// ─── Admin Layout ─────────────────────────────────────────────────────────────
function AdminLayout({
  view,
  setView,
  logout,
  showToast,
  setIsLoading,
}: {
  view: AdminView;
  setView: (v: View) => void;
  logout: () => void;
  showToast: (msg: string, type?: "success" | "error") => void;
  setIsLoading: (v: boolean) => void;
}) {
  const tabs: { id: AdminView; label: string; emoji: string }[] = [
    { id: "admin-dashboard", label: "Dashboard", emoji: "📊" },
    { id: "admin-users", label: "Users", emoji: "👥" },
    { id: "admin-matches", label: "Matches", emoji: "⚔️" },
    { id: "admin-payments", label: "Payments", emoji: "💸" },
    { id: "admin-withdrawals", label: "Withdrawals", emoji: "💰" },
    { id: "admin-announcements", label: "Announce", emoji: "📢" },
    { id: "admin-complaints", label: "Complaints", emoji: "🚩" },
    { id: "admin-chat", label: "Chat", emoji: "💬" },
    { id: "admin-logs", label: "Logs", emoji: "📋" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{ minHeight: "100vh", background: "var(--bg)" }}
    >
      {/* Admin top bar */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 60,
          background: "var(--card-bg)",
          borderBottom: "1px solid var(--border-color)",
          padding: "10px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span
          style={{
            fontFamily: "Orbitron, sans-serif",
            fontSize: "0.95rem",
            fontWeight: 900,
            color: "var(--accent)",
          }}
        >
          🔐 ADMIN PANEL
        </span>
        <button
          type="button"
          className="fire-btn fire-btn-danger"
          style={{ width: "auto", padding: "6px 14px", fontSize: "0.8rem" }}
          onClick={logout}
          data-ocid="admin.logout.button"
        >
          <LogOut size={14} /> Logout
        </button>
      </div>

      {/* Horizontal scroll tabs */}
      <div
        style={{
          display: "flex",
          overflowX: "auto",
          gap: 4,
          padding: "8px 12px",
          background: "var(--card-bg)",
          borderBottom: "1px solid var(--border-color)",
          scrollbarWidth: "none",
        }}
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setView(t.id)}
            data-ocid={`admin.${t.id.replace("admin-", "")}.tab`}
            style={{
              flexShrink: 0,
              padding: "6px 12px",
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
              background: view === t.id ? "var(--accent)" : "transparent",
              color: view === t.id ? "white" : "var(--muted)",
              fontFamily: "Rajdhani, sans-serif",
              fontWeight: 700,
              fontSize: "0.78rem",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            {t.emoji} {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: "16px", paddingBottom: 40 }}>
        {view === "admin-dashboard" && (
          <AdminDashboardView
            setView={setView}
            showToast={showToast}
            setIsLoading={setIsLoading}
          />
        )}
        {view === "admin-users" && (
          <AdminUsersView showToast={showToast} setIsLoading={setIsLoading} />
        )}
        {view === "admin-matches" && (
          <AdminMatchesView showToast={showToast} setIsLoading={setIsLoading} />
        )}
        {view === "admin-payments" && (
          <AdminPaymentsView
            showToast={showToast}
            setIsLoading={setIsLoading}
          />
        )}
        {view === "admin-withdrawals" && (
          <AdminWithdrawalsView
            showToast={showToast}
            setIsLoading={setIsLoading}
          />
        )}
        {view === "admin-announcements" && (
          <AdminAnnouncementsView
            showToast={showToast}
            setIsLoading={setIsLoading}
          />
        )}
        {view === "admin-complaints" && (
          <AdminComplaintsView
            showToast={showToast}
            setIsLoading={setIsLoading}
          />
        )}
        {view === "admin-chat" && (
          <AdminChatView showToast={showToast} setIsLoading={setIsLoading} />
        )}
        {view === "admin-logs" && <AdminLogsView setIsLoading={setIsLoading} />}
      </div>
    </motion.div>
  );
}

// ─── Admin Dashboard ──────────────────────────────────────────────────────────
function AdminDashboardView({
  setView,
  showToast: _showToast,
  setIsLoading,
}: {
  setView: (v: View) => void;
  showToast: (msg: string, type?: "success" | "error") => void;
  setIsLoading: (v: boolean) => void;
}) {
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    totalDeposits: 0,
    totalWithdrawals: 0,
    pendingPayments: 0,
    pendingWithdrawals: 0,
  });

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      try {
        const [usersSnap, paymentsSnap, withdrawsSnap] = await Promise.all([
          getDocs(collection(db, "users")),
          getDocs(collection(db, "payments")),
          getDocs(collection(db, "withdraw")),
        ]);
        const totalDeposits = paymentsSnap.docs
          .filter((d) => d.data().status === "Approved")
          .reduce((sum, d) => sum + (d.data().amount || 0), 0);
        const totalWithdrawals = withdrawsSnap.docs
          .filter((d) => d.data().status === "Approved")
          .reduce((sum, d) => sum + (d.data().amount || 0), 0);
        const pendingPayments = paymentsSnap.docs.filter(
          (d) => d.data().status === "Pending",
        ).length;
        const pendingWithdrawals = withdrawsSnap.docs.filter(
          (d) => d.data().status === "Pending",
        ).length;
        setStats({
          totalUsers: usersSnap.size,
          activeUsers: usersSnap.docs.filter((d) => !d.data().blocked).length,
          totalDeposits,
          totalWithdrawals,
          pendingPayments,
          pendingWithdrawals,
        });
      } finally {
        setIsLoading(false);
      }
    })();
  }, [setIsLoading]);

  const profit = Math.floor(stats.totalDeposits * 0.09);

  const statCards = [
    {
      label: "Total Users",
      value: stats.totalUsers,
      color: "var(--accent)",
      icon: "👥",
    },
    {
      label: "Active Users",
      value: stats.activeUsers,
      color: "#22c55e",
      icon: "✅",
    },
    {
      label: "Total Deposits",
      value: `₹${stats.totalDeposits}`,
      color: "#3b82f6",
      icon: "💸",
    },
    {
      label: "Total Withdrawals",
      value: `₹${stats.totalWithdrawals}`,
      color: "#f59e0b",
      icon: "💰",
    },
    { label: "Profit (9%)", value: `₹${profit}`, color: "#22c55e", icon: "📈" },
    {
      label: "Pending Payments",
      value: stats.pendingPayments,
      color: "#ef4444",
      icon: "⏳",
    },
    {
      label: "Pending Withdrawals",
      value: stats.pendingWithdrawals,
      color: "#f97316",
      icon: "⏳",
    },
  ];

  const quickNav: { label: string; view: AdminView; emoji: string }[] = [
    { label: "Manage Users", view: "admin-users", emoji: "👥" },
    { label: "Manage Matches", view: "admin-matches", emoji: "⚔️" },
    { label: "Approve Payments", view: "admin-payments", emoji: "💸" },
    { label: "Approve Withdrawals", view: "admin-withdrawals", emoji: "💰" },
    { label: "Send Announcement", view: "admin-announcements", emoji: "📢" },
    { label: "View Complaints", view: "admin-complaints", emoji: "🚩" },
    { label: "Chat Support", view: "admin-chat", emoji: "💬" },
    { label: "Activity Logs", view: "admin-logs", emoji: "📋" },
  ];

  return (
    <div data-ocid="admin.dashboard.section">
      <h2 className="view-title">📊 Admin Dashboard</h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
          marginBottom: 20,
        }}
      >
        {statCards.map((s) => (
          <div key={s.label} className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "1.5rem" }}>{s.icon}</div>
            <div
              style={{
                fontFamily: "Orbitron, sans-serif",
                fontSize: "1.2rem",
                fontWeight: 900,
                color: s.color,
              }}
            >
              {s.value}
            </div>
            <div
              style={{
                color: "var(--muted)",
                fontSize: "0.75rem",
                marginTop: 2,
              }}
            >
              {s.label}
            </div>
          </div>
        ))}
      </div>
      <div className="section-label">Quick Navigation</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {quickNav.map((n) => (
          <button
            key={n.view}
            type="button"
            className="quick-btn"
            onClick={() => setView(n.view)}
            data-ocid={`admin.nav.${n.view.replace("admin-", "")}.button`}
          >
            <span style={{ fontSize: "1.2rem" }}>{n.emoji}</span>
            <span style={{ fontSize: "0.82rem" }}>{n.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Admin Users ──────────────────────────────────────────────────────────────
function AdminUsersView({
  showToast,
  setIsLoading,
}: {
  showToast: (msg: string, type?: "success" | "error") => void;
  setIsLoading: (v: boolean) => void;
}) {
  const [users, setUsers] = useState<UserData[]>([]);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [coinsInput, setCoinsInput] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const snap = await getDocs(collection(db, "users"));
      setUsers(snap.docs.map((d) => ({ ...d.data() }) as UserData));
    } finally {
      setIsLoading(false);
    }
  }, [setIsLoading]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = users.filter(
    (u) =>
      u.uid.toLowerCase().includes(search.toLowerCase()) ||
      (u.displayName || "").toLowerCase().includes(search.toLowerCase()),
  );

  // Detect duplicate phones
  const phoneCounts: Record<string, number> = {};
  for (const u of users) {
    if (u.phone) phoneCounts[u.phone] = (phoneCounts[u.phone] || 0) + 1;
  }

  const addCoins = async (uid: string, amount: number) => {
    setIsLoading(true);
    try {
      const snap = await getDoc(doc(db, "wallet", uid));
      const cur = snap.exists() ? snap.data().coins || 0 : 0;
      await setDoc(doc(db, "wallet", uid), { coins: cur + amount });
      await logAdminAction(`Added ₹${amount} coins`, uid);
      showToast(`Added ₹${amount} to ${uid}`);
      load();
    } catch (_) {
      showToast("Error", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const removeCoins = async (uid: string, amount: number) => {
    setIsLoading(true);
    try {
      const snap = await getDoc(doc(db, "wallet", uid));
      const cur = snap.exists() ? snap.data().coins || 0 : 0;
      await setDoc(doc(db, "wallet", uid), {
        coins: Math.max(0, cur - amount),
      });
      await logAdminAction(`Removed ₹${amount} coins`, uid);
      showToast(`Removed ₹${amount} from ${uid}`);
      load();
    } catch (_) {
      showToast("Error", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleBlock = async (u: UserData) => {
    setIsLoading(true);
    try {
      await updateDoc(doc(db, "users", u.uid), { blocked: !u.blocked });
      await logAdminAction(
        `${u.blocked ? "Unblocked" : "Blocked"} user`,
        u.uid,
      );
      showToast(u.blocked ? "User unblocked" : "User blocked");
      load();
    } catch (_) {
      showToast("Error", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const deleteUser = async (uid: string) => {
    if (!window.confirm(`Delete user ${uid}?`)) return;
    setIsLoading(true);
    try {
      await Promise.all([
        deleteDoc(doc(db, "users", uid)),
        deleteDoc(doc(db, "wallet", uid)),
      ]);
      await logAdminAction("Deleted user account", uid);
      showToast("User deleted");
      load();
    } catch (_) {
      showToast("Error", "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div data-ocid="admin.users.section">
      <h2 className="view-title">👥 Users ({users.length})</h2>
      <input
        className="fire-input"
        placeholder="Search by UID or name..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ marginBottom: 12 }}
        data-ocid="admin.users.search_input"
      />
      {filtered.map((u, i) => (
        <div
          key={u.uid}
          className="card"
          style={{ marginBottom: 8 }}
          data-ocid={`admin.users.item.${i + 1}`}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: 6,
            }}
          >
            <div>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: "0.9rem",
                  color: "var(--accent)",
                }}
              >
                {u.uid}
              </div>
              <div style={{ color: "var(--muted)", fontSize: "0.78rem" }}>
                {u.displayName} | {u.phone}
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  marginTop: 4,
                  flexWrap: "wrap",
                }}
              >
                <span className="badge badge-waiting">💰 {u.coins || 0}</span>
                {u.blocked && (
                  <span className="badge badge-rejected">BLOCKED</span>
                )}
                {u.phone && phoneCounts[u.phone] > 1 && (
                  <span
                    className="badge"
                    style={{
                      background: "#ef4444",
                      color: "white",
                      fontSize: "0.6rem",
                    }}
                  >
                    ⚠️ Dup Phone
                  </span>
                )}
              </div>
            </div>
            <button
              type="button"
              className="fire-btn fire-btn-secondary"
              style={{
                width: "auto",
                padding: "4px 10px",
                fontSize: "0.75rem",
              }}
              onClick={() => setExpanded(expanded === u.uid ? null : u.uid)}
              data-ocid={`admin.users.edit_button.${i + 1}`}
            >
              {expanded === u.uid ? (
                <ChevronUp size={14} />
              ) : (
                <ChevronDown size={14} />
              )}
            </button>
          </div>
          {expanded === u.uid && (
            <div
              style={{
                borderTop: "1px solid var(--border-color)",
                paddingTop: 10,
              }}
            >
              <div
                style={{
                  color: "var(--muted)",
                  fontSize: "0.75rem",
                  marginBottom: 8,
                }}
              >
                Wins: {u.wins} | Kills: {u.kills} | Matches: {u.matchesPlayed}
              </div>
              <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                <input
                  className="fire-input"
                  type="number"
                  placeholder="Coins"
                  value={coinsInput[u.uid] || ""}
                  onChange={(e) =>
                    setCoinsInput((prev) => ({
                      ...prev,
                      [u.uid]: e.target.value,
                    }))
                  }
                  style={{ flex: 1 }}
                  data-ocid={`admin.users.coins.input.${i + 1}`}
                />
                <button
                  type="button"
                  className="fire-btn fire-btn-success"
                  style={{
                    width: "auto",
                    padding: "6px 12px",
                    fontSize: "0.75rem",
                  }}
                  onClick={() =>
                    addCoins(u.uid, Number(coinsInput[u.uid] || 0))
                  }
                  data-ocid={`admin.users.add.button.${i + 1}`}
                >
                  +Add
                </button>
                <button
                  type="button"
                  className="fire-btn fire-btn-danger"
                  style={{
                    width: "auto",
                    padding: "6px 12px",
                    fontSize: "0.75rem",
                  }}
                  onClick={() =>
                    removeCoins(u.uid, Number(coinsInput[u.uid] || 0))
                  }
                  data-ocid={`admin.users.remove.button.${i + 1}`}
                >
                  -Remove
                </button>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  type="button"
                  className={`fire-btn ${u.blocked ? "fire-btn-success" : "fire-btn-warning"}`}
                  style={{ fontSize: "0.78rem" }}
                  onClick={() => toggleBlock(u)}
                  data-ocid={`admin.users.block.toggle.${i + 1}`}
                >
                  {u.blocked ? "✅ Unblock" : "🚫 Block"}
                </button>
                <button
                  type="button"
                  className="fire-btn fire-btn-danger"
                  style={{ fontSize: "0.78rem" }}
                  onClick={() => deleteUser(u.uid)}
                  data-ocid={`admin.users.delete_button.${i + 1}`}
                >
                  🗑️ Delete
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
      {filtered.length === 0 && (
        <div className="empty-state" data-ocid="admin.users.empty_state">
          <div className="empty-state-icon">👥</div>
          <div>No users found</div>
        </div>
      )}
    </div>
  );
}

// ─── Admin Matches ────────────────────────────────────────────────────────────
function AdminMatchesView({
  showToast,
  setIsLoading,
}: {
  showToast: (msg: string, type?: "success" | "error") => void;
  setIsLoading: (v: boolean) => void;
}) {
  const [matches, setMatches] = useState<AdminMatchData[]>([]);
  const [filter, setFilter] = useState<
    "all" | "waiting" | "live" | "completed"
  >("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [roomInputs, setRoomInputs] = useState<
    Record<string, { roomId: string; roomPass: string }>
  >({});
  const [winnerInput, setWinnerInput] = useState<Record<string, string>>({});
  const [killInputs, setKillInputs] = useState<
    Record<string, Record<string, string>>
  >({}); // matchId -> {uid: killCount}
  const [_creating, setCreating] = useState(false);
  const [newMode, setNewMode] = useState(GAME_MODES[0].id);
  const [clashEntryTotal, setClashEntryTotal] = useState(100);
  const [clashPrizePool, setClashPrizePool] = useState(200);
  const [squadEntryTotal, setSquadEntryTotal] = useState(400);
  const [squadPrizePool, setSquadPrizePool] = useState(720);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const snap = await getDocs(collection(db, "matches"));
      setMatches(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as AdminMatchData)
          .reverse(),
      );
    } finally {
      setIsLoading(false);
    }
  }, [setIsLoading]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered =
    filter === "all" ? matches : matches.filter((m) => m.status === filter);

  const createMatch = async () => {
    const mode = GAME_MODES.find((m) => m.id === newMode)!;
    const isTeamMode = mode.id === "clash" || mode.id === "squad";
    const isClash = mode.id === "clash";
    const isSquad = mode.id === "squad";
    const entryTotal = isClash
      ? clashEntryTotal
      : isSquad
        ? squadEntryTotal
        : 0;
    const perHeadFee = isTeamMode ? Math.round(entryTotal / 4) : mode.entryFee;
    const prize = isClash
      ? clashPrizePool
      : isSquad
        ? squadPrizePool
        : mode.prizePool;
    setIsLoading(true);
    try {
      await addDoc(collection(db, "matches"), {
        player: "admin",
        mode: mode.id,
        status: "waiting",
        entryFee: perHeadFee,
        prizePool: prize,
        squadEntryTotal: isTeamMode ? entryTotal : undefined,
        roomId: "",
        roomPass: "",
        timestamp: new Date(),
        players: [],
        maxPlayers: mode.maxPlayers ?? 2,
        ...(isTeamMode
          ? { teamA: [], teamB: [], teamALeader: "", teamBLeader: "" }
          : {}),
      });
      // Save clash squad settings to Firestore for users to see
      if (isTeamMode) {
        const settingsKey = isSquad ? "squad4v4" : "clashSquad";
        await setDoc(doc(db, "settings", settingsKey), {
          entryPerHead: perHeadFee,
          prizePool: prize,
          squadEntryTotal: entryTotal,
        });
      }
      await logAdminAction("Created match", mode.id);
      showToast("Match created!");
      setCreating(false);
      load();
    } catch (_) {
      showToast("Error", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const assignRoom = async (id: string) => {
    const inp = roomInputs[id] || { roomId: "", roomPass: "" };
    setIsLoading(true);
    try {
      // Get admin room data to know the mode
      const adminRoomSnap = await getDoc(doc(db, "matches", id));
      const adminRoomMode = adminRoomSnap.exists()
        ? adminRoomSnap.data().mode
        : null;
      // Update admin room doc
      await updateDoc(doc(db, "matches", id), {
        roomId: inp.roomId,
        roomPass: inp.roomPass,
      });
      // Update player match docs that reference this admin room (by roomRef)
      const playerMatchQ = query(
        collection(db, "matches"),
        where("roomRef", "==", id),
      );
      const playerMatchSnap = await getDocs(playerMatchQ);
      const refUpdates = playerMatchSnap.docs.map((pd) =>
        updateDoc(doc(db, "matches", pd.id), {
          roomId: inp.roomId,
          roomPass: inp.roomPass,
        }),
      );
      // Also update player match docs for the same mode (no roomRef — joined before admin created room)
      let modeUpdates: Promise<void>[] = [];
      if (adminRoomMode) {
        const byModeQ = query(
          collection(db, "matches"),
          where("mode", "==", adminRoomMode),
          where("status", "in", ["waiting", "live", "full"]),
        );
        const byModeSnap = await getDocs(byModeQ);
        modeUpdates = byModeSnap.docs
          .filter((pd) => pd.data().player !== "admin" && !pd.data().roomRef)
          .map((pd) =>
            updateDoc(doc(db, "matches", pd.id), {
              roomId: inp.roomId,
              roomPass: inp.roomPass,
              roomRef: id,
            }),
          );
      }
      await Promise.all([...refUpdates, ...modeUpdates]);
      await logAdminAction("Assigned room", id);
      showToast("Room assigned! Players notified.");
      load();
    } catch (_) {
      showToast("Error", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const startMatch = async (id: string) => {
    setIsLoading(true);
    try {
      await updateDoc(doc(db, "matches", id), {
        status: "live",
        startedAt: Date.now(),
      });
      await logAdminAction("Started match", id);
      showToast("Match started!");
      load();
    } catch (_) {
      showToast("Error", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const endMatch = async (id: string) => {
    setIsLoading(true);
    try {
      await updateDoc(doc(db, "matches", id), { status: "completed" });
      await logAdminAction("Ended match", id);
      showToast("Match ended!");
      load();
    } catch (_) {
      showToast("Error", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const selectWinner = async (m: AdminMatchData) => {
    const winner = winnerInput[m.id];
    if (!winner) {
      showToast("Enter winner UID", "error");
      return;
    }
    setIsLoading(true);
    try {
      const modeData = GAME_MODES.find((gm) => gm.id === m.mode);
      const perKill = (modeData as any)?.perKill || 0;
      const winnerBonus = (modeData as any)?.winnerBonus || 0;
      const matchKills = killInputs[m.id] || {};

      // Award kill coins to all players who have kills entered
      const killOps: Promise<unknown>[] = [];
      for (const [uid, killStr] of Object.entries(matchKills)) {
        const kills = Number.parseInt(killStr as string) || 0;
        if (kills > 0 && perKill > 0) {
          const wSnap = await getDoc(doc(db, "wallet", uid));
          const cur = wSnap.exists() ? wSnap.data().coins || 0 : 0;
          const earned = kills * perKill;
          killOps.push(setDoc(doc(db, "wallet", uid), { coins: cur + earned }));
          const uSnap = await getDoc(doc(db, "users", uid));
          if (uSnap.exists()) {
            killOps.push(
              updateDoc(doc(db, "users", uid), {
                kills: (uSnap.data().kills || 0) + kills,
              }),
            );
          }
        }
      }
      await Promise.all(killOps);

      const winnerPrize = winnerBonus > 0 ? winnerBonus : m.prizePool;
      const snap = await getDoc(doc(db, "wallet", winner));
      const cur = snap.exists() ? snap.data().coins || 0 : 0;
      const winnerSnap = await getDoc(doc(db, "users", winner));
      await Promise.all([
        setDoc(doc(db, "wallet", winner), { coins: cur + winnerPrize }),
        updateDoc(doc(db, "matches", m.id), { winner, status: "completed" }),
        ...(winnerSnap.exists()
          ? [
              updateDoc(doc(db, "users", winner), {
                wins: (winnerSnap.data().wins || 0) + 1,
              }),
            ]
          : []),
      ]);
      await logAdminAction(`Awarded prize ₹${winnerPrize}`, winner);
      showToast(`🏆 Prize ₹${winnerPrize} awarded to ${winner}!`);
      load();
    } catch (_) {
      showToast("Error", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const selectTeamWinner = async (m: AdminMatchData, team: "A" | "B") => {
    setIsLoading(true);
    try {
      const winningTeam = team === "A" ? m.teamA || [] : m.teamB || [];
      const teamLeader = winningTeam[0];
      if (!teamLeader) {
        showToast("No players in winning team", "error");
        setIsLoading(false);
        return;
      }
      const prize = m.prizePool || 200;
      const snap = await getDoc(doc(db, "wallet", teamLeader));
      const cur = snap.exists() ? snap.data().coins || 0 : 0;
      const leaderSnap = await getDoc(doc(db, "users", teamLeader));
      await Promise.all([
        setDoc(doc(db, "wallet", teamLeader), { coins: cur + prize }),
        updateDoc(doc(db, "matches", m.id), {
          winner: `Team ${team} (Leader: ${teamLeader})`,
          status: "completed",
        }),
        ...(leaderSnap.exists()
          ? [
              updateDoc(doc(db, "users", teamLeader), {
                wins: (leaderSnap.data().wins || 0) + 1,
              }),
            ]
          : []),
      ]);
      // Notify all winning team members
      const notifOps = winningTeam.map((uid: string) =>
        addDoc(collection(db, "notifications"), {
          uid,
          title: "🏆 You Won!",
          message: `Your team won Clash Squad! Prize ₹${prize} credited to team leader (${teamLeader}).`,
          read: false,
          timestamp: new Date(),
        }).catch(() => {}),
      );
      await Promise.all(notifOps);
      await logAdminAction(
        `Team ${team} won Clash Squad, prize ₹${prize} to ${teamLeader}`,
        m.id,
      );
      showToast(
        `🏆 Team ${team} wins! ₹${prize} awarded to leader ${teamLeader}!`,
      );
      load();
    } catch (_) {
      showToast("Error", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const cancelMatch = async (id: string) => {
    if (
      !window.confirm(
        "Cancel this match? Entry fee will be refunded to player.",
      )
    )
      return;
    setIsLoading(true);
    try {
      const matchSnap = await getDoc(doc(db, "matches", id));
      const matchData = matchSnap.exists() ? matchSnap.data() : null;
      const player = matchData?.player;
      const refundAmount = matchData?.entryFee ?? 0;
      const ops: Promise<unknown>[] = [
        deleteDoc(doc(db, "matches", id)),
        logAdminAction(`Cancelled match (refunded ₹${refundAmount})`, id),
      ];
      if (player && refundAmount > 0) {
        const wSnap = await getDoc(doc(db, "wallet", player));
        const cur = wSnap.exists() ? (wSnap.data().coins ?? 0) : 0;
        ops.push(
          setDoc(doc(db, "wallet", player), { coins: cur + refundAmount }),
        );
      }
      await Promise.all(ops);
      showToast(
        `Match cancelled. ₹${refundAmount} refunded to ${player ?? "player"}.`,
      );
      load();
    } catch (_) {
      showToast("Error", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const statusClass = (s: string) =>
    s === "live"
      ? "badge-live"
      : s === "completed"
        ? "badge-completed"
        : s === "full"
          ? "badge-full"
          : "badge-waiting";

  return (
    <div data-ocid="admin.matches.section">
      {/* ─── CREATE ROOM BOX ──────────────────────────────────────────── */}
      <div
        data-ocid="admin.matches.create_room_box"
        style={{
          background:
            "linear-gradient(135deg, rgba(255,100,0,0.12) 0%, rgba(255,60,0,0.06) 100%)",
          border: "2px solid var(--accent)",
          borderRadius: 16,
          padding: "20px 18px",
          marginBottom: 18,
          boxShadow:
            "0 0 24px rgba(255,100,0,0.25), 0 4px 12px rgba(0,0,0,0.3)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 14,
          }}
        >
          <span style={{ fontSize: "1.5rem" }}>🏠</span>
          <div>
            <div
              style={{
                fontWeight: 800,
                fontSize: "1.05rem",
                color: "var(--accent)",
                letterSpacing: 1,
                fontFamily: "Orbitron, sans-serif",
              }}
            >
              CREATE ROOM
            </div>
            <div
              style={{
                fontSize: "0.72rem",
                color: "var(--muted)",
                marginTop: 2,
              }}
            >
              Select game mode and create a new match room
            </div>
          </div>
        </div>

        <select
          className="fire-input"
          value={newMode}
          onChange={(e) => setNewMode(e.target.value)}
          style={{
            marginBottom: 12,
            appearance: "auto",
            fontSize: "0.9rem",
            fontWeight: 600,
          }}
          data-ocid="admin.matches.select"
        >
          {GAME_MODES.map((m) => (
            <option key={m.id} value={m.id}>
              {m.emoji} {m.label} — Entry ₹{m.entryFee} | Prize ₹{m.prizePool}
            </option>
          ))}
        </select>

        {/* Clash Squad dynamic fee inputs */}
        {newMode === "clash" && (
          <div style={{ marginBottom: 12 }}>
            <div
              style={{
                fontSize: "0.78rem",
                color: "#ff9a00",
                fontWeight: 700,
                marginBottom: 6,
                fontFamily: "Orbitron, sans-serif",
              }}
            >
              ⚙️ CLASH SQUAD SETTINGS
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: "0.7rem",
                    color: "var(--muted)",
                    marginBottom: 3,
                  }}
                >
                  Total Squad Entry (₹)
                </div>
                <input
                  className="fire-input"
                  type="number"
                  min="1"
                  value={clashEntryTotal}
                  onChange={(e) =>
                    setClashEntryTotal(Number(e.target.value) || 100)
                  }
                  placeholder="e.g. 100"
                />
                <div
                  style={{
                    fontSize: "0.65rem",
                    color: "#ff9a00",
                    marginTop: 2,
                  }}
                >
                  Per player: ₹{Math.round(clashEntryTotal / 4)}
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: "0.7rem",
                    color: "var(--muted)",
                    marginBottom: 3,
                  }}
                >
                  Prize Pool (₹)
                </div>
                <input
                  className="fire-input"
                  type="number"
                  min="1"
                  value={clashPrizePool}
                  onChange={(e) =>
                    setClashPrizePool(Number(e.target.value) || 200)
                  }
                  placeholder="e.g. 200"
                />
              </div>
            </div>
            <div
              style={{
                background: "rgba(255,107,0,0.1)",
                border: "1px solid rgba(255,107,0,0.3)",
                borderRadius: 8,
                padding: "8px 10px",
                fontSize: "0.72rem",
                color: "#ff9a00",
              }}
            >
              4 players per team × ₹{Math.round(clashEntryTotal / 4)} = ₹
              {clashEntryTotal} total entry | Prize: ₹{clashPrizePool}
            </div>
          </div>
        )}
        {/* Squad 4v4 dynamic fee inputs */}
        {newMode === "squad" && (
          <div style={{ marginBottom: 12 }}>
            <div
              style={{
                fontSize: "0.78rem",
                color: "#ff9a00",
                fontWeight: 700,
                marginBottom: 6,
                fontFamily: "Orbitron, sans-serif",
              }}
            >
              ⚙️ SQUAD 4v4 SETTINGS
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: "0.7rem",
                    color: "var(--muted)",
                    marginBottom: 3,
                  }}
                >
                  Total Squad Entry (₹)
                </div>
                <input
                  className="fire-input"
                  type="number"
                  min="1"
                  value={squadEntryTotal}
                  onChange={(e) =>
                    setSquadEntryTotal(Number(e.target.value) || 400)
                  }
                  placeholder="e.g. 400"
                />
                <div
                  style={{
                    fontSize: "0.65rem",
                    color: "#ff9a00",
                    marginTop: 2,
                  }}
                >
                  Per player: ₹{Math.round(squadEntryTotal / 4)}
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: "0.7rem",
                    color: "var(--muted)",
                    marginBottom: 3,
                  }}
                >
                  Prize Pool (₹)
                </div>
                <input
                  className="fire-input"
                  type="number"
                  min="1"
                  value={squadPrizePool}
                  onChange={(e) =>
                    setSquadPrizePool(Number(e.target.value) || 720)
                  }
                  placeholder="e.g. 720"
                />
              </div>
            </div>
            <div
              style={{
                background: "rgba(255,107,0,0.1)",
                border: "1px solid rgba(255,107,0,0.3)",
                borderRadius: 8,
                padding: "8px 10px",
                fontSize: "0.72rem",
                color: "#ff9a00",
              }}
            >
              4 players per team × ₹{Math.round(squadEntryTotal / 4)} = ₹
              {squadEntryTotal} total entry | Prize: ₹{squadPrizePool}
            </div>
          </div>
        )}
        {/* Show selected mode info */}
        {(() => {
          const sel = GAME_MODES.find((m) => m.id === newMode);
          if (!sel) return null;
          const isTeamMode2 = newMode === "clash" || newMode === "squad";
          const entryTotalDisp =
            newMode === "clash"
              ? clashEntryTotal
              : newMode === "squad"
                ? squadEntryTotal
                : 0;
          const dispFee = isTeamMode2
            ? Math.round(entryTotalDisp / 4)
            : sel.entryFee;
          const dispPrize =
            newMode === "clash"
              ? clashPrizePool
              : newMode === "squad"
                ? squadPrizePool
                : sel.prizePool;
          return (
            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                marginBottom: 12,
              }}
            >
              {[
                {
                  label: "Entry/Player",
                  val: `₹${dispFee}`,
                  color: "#f87171",
                },
                {
                  label: "Prize Pool",
                  val: `₹${dispPrize}`,
                  color: "#22c55e",
                },
                {
                  label: "Max Players",
                  val: `${(sel as any).maxPlayers ?? 2}`,
                  color: "var(--accent)",
                },
                ...((sel as any).perKill
                  ? [
                      {
                        label: "Per Kill",
                        val: `₹${(sel as any).perKill}`,
                        color: "#ff9a00",
                      },
                    ]
                  : []),
              ].map((item) => (
                <div
                  key={item.label}
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    borderRadius: 8,
                    padding: "4px 10px",
                    fontSize: "0.75rem",
                    color: item.color,
                    fontWeight: 700,
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}
                >
                  {item.label}: {item.val}
                </div>
              ))}
            </div>
          );
        })()}

        <button
          type="button"
          className="fire-btn"
          onClick={createMatch}
          data-ocid="admin.matches.confirm_button"
          style={{
            background: "linear-gradient(90deg, #ff6600, #ff3300)",
            fontFamily: "Orbitron, sans-serif",
            fontWeight: 800,
            fontSize: "1rem",
            letterSpacing: 1,
            boxShadow: "0 0 16px rgba(255,100,0,0.5)",
            border: "none",
          }}
        >
          🚀 CREATE ROOM
        </button>
      </div>

      <h2 className="view-title" style={{ marginBottom: 10 }}>
        ⚔️ All Matches
      </h2>

      <div
        style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}
      >
        {(["all", "waiting", "live", "completed"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            data-ocid={`admin.matches.${f}.tab`}
            style={
              {
                padding: "4px 12px",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: "0.8rem",
                background: filter === f ? "var(--accent)" : "var(--card-bg)",
                color: filter === f ? "white" : "var(--muted)",
                border: "1px solid var(--border-color)",
              } as React.CSSProperties
            }
          >
            {f.toUpperCase()} (
            {filter === f
              ? filtered.length
              : matches.filter((m) => f === "all" || m.status === f).length}
            )
          </button>
        ))}
      </div>

      {filtered.map((m, i) => (
        <div
          key={m.id}
          className="card"
          style={{
            marginBottom: 8,
            borderLeft: m.status === "live" ? "3px solid #22c55e" : undefined,
          }}
          data-ocid={`admin.matches.item.${i + 1}`}
        >
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
                  fontWeight: 700,
                  fontSize: "0.9rem",
                  color: "var(--accent)",
                }}
              >
                {m.mode?.toUpperCase()}
              </div>
              <div style={{ color: "var(--muted)", fontSize: "0.75rem" }}>
                {m.player} | ₹{m.entryFee} / 🏆₹{m.prizePool}
                {m.winner && (
                  <span style={{ color: "#22c55e" }}> | 🏆 {m.winner}</span>
                )}
              </div>
              {m.maxPlayers && (
                <div style={{ fontSize: "0.72rem", marginTop: 2 }}>
                  <span
                    style={{
                      color:
                        (m.players?.length ?? 0) >= m.maxPlayers
                          ? "#f87171"
                          : "var(--success)",
                    }}
                  >
                    👥 {m.players?.length ?? 0}/{m.maxPlayers} players
                    {(m.players?.length ?? 0) >= m.maxPlayers
                      ? " — 🔒 FULL"
                      : ""}
                  </span>
                </div>
              )}
              {m.players && m.players.length > 0 && (
                <div
                  style={{
                    marginTop: 6,
                    padding: "8px 10px",
                    background: "rgba(255,107,0,0.08)",
                    borderRadius: 8,
                    border: "1px solid rgba(255,107,0,0.25)",
                  }}
                >
                  <div
                    style={{
                      fontSize: "0.7rem",
                      color: "#ff9a00",
                      fontWeight: 700,
                      marginBottom: 4,
                    }}
                  >
                    👤 Joined Players:
                  </div>
                  {m.players.map((uid: string, idx: number) => (
                    <div
                      key={uid}
                      style={{
                        fontSize: "0.75rem",
                        color: "#fff",
                        padding: "3px 6px",
                        marginBottom: 2,
                        background: "rgba(255,255,255,0.06)",
                        borderRadius: 5,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <span
                        style={{
                          color: "#f59e0b",
                          fontWeight: 700,
                          minWidth: 18,
                        }}
                      >
                        #{idx + 1}
                      </span>
                      <span
                        style={{
                          fontFamily: "Rajdhani, sans-serif",
                          fontWeight: 600,
                        }}
                      >
                        {uid}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span className={`badge ${statusClass(m.status)}`}>
                {m.status}
              </span>
              <button
                type="button"
                className="fire-btn fire-btn-secondary"
                style={{
                  width: "auto",
                  padding: "4px 8px",
                  fontSize: "0.75rem",
                }}
                onClick={() => setExpanded(expanded === m.id ? null : m.id)}
                data-ocid={`admin.matches.edit_button.${i + 1}`}
              >
                {expanded === m.id ? "▲" : "▼"}
              </button>
            </div>
          </div>
          {m.status === "live" && m.startedAt && (
            <div style={{ marginTop: 4 }}>
              <LiveTimer startedAt={m.startedAt} />
            </div>
          )}
          {expanded === m.id && (
            <div
              style={{
                borderTop: "1px solid var(--border-color)",
                paddingTop: 10,
                marginTop: 8,
              }}
            >
              {/* Assign Room */}
              <div style={{ marginBottom: 8 }}>
                <div
                  style={{
                    fontSize: "0.78rem",
                    color: "var(--muted)",
                    marginBottom: 4,
                  }}
                >
                  Assign Room
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <input
                    className="fire-input"
                    placeholder="Room ID"
                    value={roomInputs[m.id]?.roomId || m.roomId || ""}
                    onChange={(e) =>
                      setRoomInputs((prev) => ({
                        ...prev,
                        [m.id]: { ...prev[m.id], roomId: e.target.value },
                      }))
                    }
                    data-ocid={`admin.matches.roomid.input.${i + 1}`}
                  />
                  <input
                    className="fire-input"
                    placeholder="Password"
                    value={roomInputs[m.id]?.roomPass || m.roomPass || ""}
                    onChange={(e) =>
                      setRoomInputs((prev) => ({
                        ...prev,
                        [m.id]: { ...prev[m.id], roomPass: e.target.value },
                      }))
                    }
                    data-ocid={`admin.matches.roompass.input.${i + 1}`}
                  />
                  <button
                    type="button"
                    className="fire-btn"
                    style={{
                      width: "auto",
                      padding: "6px 12px",
                      fontSize: "0.78rem",
                    }}
                    onClick={() => assignRoom(m.id)}
                    data-ocid={`admin.matches.assign.button.${i + 1}`}
                  >
                    Assign
                  </button>
                </div>
              </div>
              {/* Match actions */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {m.status === "waiting" && (
                  <button
                    type="button"
                    className="fire-btn fire-btn-success"
                    style={{ fontSize: "0.78rem" }}
                    onClick={() => startMatch(m.id)}
                    data-ocid={`admin.matches.start.button.${i + 1}`}
                  >
                    ▶ Start
                  </button>
                )}
                {m.status === "live" && (
                  <button
                    type="button"
                    className="fire-btn fire-btn-warning"
                    style={{ fontSize: "0.78rem" }}
                    onClick={() => endMatch(m.id)}
                    data-ocid={`admin.matches.end.button.${i + 1}`}
                  >
                    ⏹ End
                  </button>
                )}
                <button
                  type="button"
                  className="fire-btn fire-btn-danger"
                  style={{ fontSize: "0.78rem" }}
                  onClick={() => cancelMatch(m.id)}
                  data-ocid={`admin.matches.delete_button.${i + 1}`}
                >
                  ✕ Cancel
                </button>
              </div>
              {/* Per-kill tracking for BR modes */}
              {GAME_MODES.find((gm) => gm.id === m.mode) &&
                (GAME_MODES.find((gm) => gm.id === m.mode) as any).perKill >
                  0 &&
                m.players &&
                m.players.length > 0 && (
                  <div
                    style={{
                      marginTop: 8,
                      padding: "10px",
                      background: "rgba(255,107,0,0.08)",
                      borderRadius: 8,
                      border: "1px solid rgba(255,107,0,0.3)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "0.78rem",
                        color: "#ffb347",
                        marginBottom: 6,
                        fontWeight: 700,
                      }}
                    >
                      🎯 Kill Tracker — ₹
                      {
                        (GAME_MODES.find((gm) => gm.id === m.mode) as any)
                          .perKill
                      }
                      /kill
                    </div>
                    {m.players.map((uid: string) => (
                      <div
                        key={uid}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          marginBottom: 4,
                        }}
                      >
                        <span
                          style={{
                            fontSize: "0.75rem",
                            color: "var(--muted)",
                            minWidth: 70,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {uid}
                        </span>
                        <input
                          className="fire-input"
                          type="number"
                          min="0"
                          placeholder="Kills"
                          value={killInputs[m.id]?.[uid] || ""}
                          onChange={(e) =>
                            setKillInputs((prev) => ({
                              ...prev,
                              [m.id]: { ...prev[m.id], [uid]: e.target.value },
                            }))
                          }
                          style={{
                            width: 70,
                            padding: "4px 8px",
                            fontSize: "0.8rem",
                          }}
                        />
                        {killInputs[m.id]?.[uid] &&
                          Number.parseInt(killInputs[m.id][uid]) > 0 && (
                            <span
                              style={{ fontSize: "0.75rem", color: "#22c55e" }}
                            >
                              +₹
                              {Number.parseInt(killInputs[m.id][uid]) *
                                (
                                  GAME_MODES.find(
                                    (gm) => gm.id === m.mode,
                                  ) as any
                                ).perKill}
                            </span>
                          )}
                      </div>
                    ))}
                  </div>
                )}
              {/* Select Winner - Clash Squad team-based */}
              {m.mode === "clash" || m.mode === "squad" ? (
                <div style={{ marginTop: 8 }}>
                  <div
                    style={{
                      fontSize: "0.78rem",
                      color: "#ff9a00",
                      fontWeight: 700,
                      marginBottom: 8,
                      fontFamily: "Orbitron, sans-serif",
                    }}
                  >
                    🏆 ANNOUNCE WINNER TEAM
                  </div>
                  {/* Team A Slots */}
                  <div
                    style={{
                      background: "rgba(34,197,94,0.08)",
                      border: "1.5px solid rgba(34,197,94,0.4)",
                      borderRadius: 10,
                      padding: "8px 10px",
                      marginBottom: 8,
                    }}
                  >
                    <div
                      style={{
                        fontSize: "0.72rem",
                        color: "#22c55e",
                        fontWeight: 700,
                        marginBottom: 4,
                      }}
                    >
                      🟢 TEAM A ({(m.teamA || []).length}/4 players)
                    </div>
                    {(m.teamA || []).length === 0 ? (
                      <div
                        style={{ fontSize: "0.68rem", color: "var(--muted)" }}
                      >
                        No players yet
                      </div>
                    ) : (
                      (m.teamA || []).map((uid: string, idx: number) => (
                        <div
                          key={uid}
                          style={{
                            fontSize: "0.7rem",
                            color: "#fff",
                            padding: "2px 0",
                          }}
                        >
                          {idx === 0 ? "👑" : "  "} #{idx + 1} {uid}
                        </div>
                      ))
                    )}
                    <button
                      type="button"
                      className="fire-btn fire-btn-success"
                      style={{
                        width: "100%",
                        marginTop: 8,
                        fontSize: "0.78rem",
                        padding: "6px",
                      }}
                      onClick={() => selectTeamWinner(m, "A")}
                      disabled={(m.teamA || []).length === 0}
                    >
                      🏆 Team A Wins — ₹{m.prizePool} to Leader
                    </button>
                  </div>
                  {/* Team B Slots */}
                  <div
                    style={{
                      background: "rgba(239,68,68,0.08)",
                      border: "1.5px solid rgba(239,68,68,0.4)",
                      borderRadius: 10,
                      padding: "8px 10px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "0.72rem",
                        color: "#f87171",
                        fontWeight: 700,
                        marginBottom: 4,
                      }}
                    >
                      🔴 TEAM B ({(m.teamB || []).length}/4 players)
                    </div>
                    {(m.teamB || []).length === 0 ? (
                      <div
                        style={{ fontSize: "0.68rem", color: "var(--muted)" }}
                      >
                        No players yet
                      </div>
                    ) : (
                      (m.teamB || []).map((uid: string, idx: number) => (
                        <div
                          key={uid}
                          style={{
                            fontSize: "0.7rem",
                            color: "#fff",
                            padding: "2px 0",
                          }}
                        >
                          {idx === 0 ? "👑" : "  "} #{idx + 1} {uid}
                        </div>
                      ))
                    )}
                    <button
                      type="button"
                      className="fire-btn fire-btn-danger"
                      style={{
                        width: "100%",
                        marginTop: 8,
                        fontSize: "0.78rem",
                        padding: "6px",
                      }}
                      onClick={() => selectTeamWinner(m, "B")}
                      disabled={(m.teamB || []).length === 0}
                    >
                      🏆 Team B Wins — ₹{m.prizePool} to Leader
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ marginTop: 8 }}>
                  <div
                    style={{
                      fontSize: "0.78rem",
                      color: "var(--muted)",
                      marginBottom: 4,
                    }}
                  >
                    {GAME_MODES.find((gm) => gm.id === m.mode) &&
                    (GAME_MODES.find((gm) => gm.id === m.mode) as any)
                      .winnerBonus > 0
                      ? `Award Winner Bonus (₹${(GAME_MODES.find((gm) => gm.id === m.mode) as any).winnerBonus}) + Kill Coins`
                      : "Award Prize"}
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <input
                      className="fire-input"
                      placeholder="Winner UID"
                      value={winnerInput[m.id] || ""}
                      onChange={(e) =>
                        setWinnerInput((prev) => ({
                          ...prev,
                          [m.id]: e.target.value,
                        }))
                      }
                      data-ocid={`admin.matches.winner.input.${i + 1}`}
                    />
                    <button
                      type="button"
                      className="fire-btn fire-btn-success"
                      style={{
                        width: "auto",
                        padding: "6px 12px",
                        fontSize: "0.78rem",
                      }}
                      onClick={() => selectWinner(m)}
                      data-ocid={`admin.matches.award.button.${i + 1}`}
                    >
                      🏆 Award
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
      {filtered.length === 0 && (
        <div className="empty-state" data-ocid="admin.matches.empty_state">
          <div className="empty-state-icon">⚔️</div>
          <div>No matches</div>
        </div>
      )}
    </div>
  );
}

// ─── Admin Payments ───────────────────────────────────────────────────────────
function AdminPaymentsView({
  showToast,
  setIsLoading,
}: {
  showToast: (msg: string, type?: "success" | "error") => void;
  setIsLoading: (v: boolean) => void;
}) {
  const [payments, setPayments] = useState<PaymentData[]>([]);
  const [filter, setFilter] = useState<"Pending" | "Approved" | "Rejected">(
    "Pending",
  );

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const snap = await getDocs(collection(db, "payments"));
      setPayments(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as PaymentData)
          .reverse(),
      );
    } finally {
      setIsLoading(false);
    }
  }, [setIsLoading]);

  useEffect(() => {
    load();
  }, [load]);

  const approve = async (p: PaymentData) => {
    setIsLoading(true);
    try {
      const snap = await getDoc(doc(db, "wallet", p.user));
      const cur = snap.exists() ? snap.data().coins || 0 : 0;
      await Promise.all([
        updateDoc(doc(db, "payments", p.id), { status: "Approved" }),
        setDoc(doc(db, "wallet", p.user), { coins: cur + p.amount }),
      ]);
      await logAdminAction(`Approved payment ₹${p.amount}`, p.user);
      showToast("Payment approved!");
      load();
    } catch (_) {
      showToast("Error", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const reject = async (id: string, user: string) => {
    setIsLoading(true);
    try {
      await updateDoc(doc(db, "payments", id), { status: "Rejected" });
      await logAdminAction("Rejected payment", user);
      showToast("Payment rejected");
      load();
    } catch (_) {
      showToast("Error", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const filtered = payments.filter((p) => p.status === filter);
  const badgeClass = (s: string) =>
    s === "Approved"
      ? "badge-approved"
      : s === "Pending"
        ? "badge-pending"
        : "badge-rejected";

  return (
    <div data-ocid="admin.payments.section">
      <h2 className="view-title">💸 Payments</h2>
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {(["Pending", "Approved", "Rejected"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            data-ocid={`admin.payments.${f.toLowerCase()}.tab`}
            style={
              {
                padding: "4px 12px",
                borderRadius: 6,
                border: "1px solid var(--border-color)",
                cursor: "pointer",
                fontSize: "0.8rem",
                background: filter === f ? "var(--accent)" : "var(--card-bg)",
                color: filter === f ? "white" : "var(--muted)",
              } as React.CSSProperties
            }
          >
            {f} ({payments.filter((p) => p.status === f).length})
          </button>
        ))}
      </div>
      {filtered.map((p, i) => (
        <div
          key={p.id}
          className="card"
          style={{ marginBottom: 8 }}
          data-ocid={`admin.payments.item.${i + 1}`}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>
                {p.user}
              </div>
              <div style={{ color: "var(--muted)", fontSize: "0.75rem" }}>
                UTR: {p.utr} | ₹{p.amount}
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span className={`badge ${badgeClass(p.status)}`}>
                {p.status}
              </span>
              {p.status === "Pending" && (
                <>
                  <button
                    type="button"
                    className="fire-btn fire-btn-success"
                    style={{
                      width: "auto",
                      padding: "5px 10px",
                      fontSize: "0.75rem",
                    }}
                    onClick={() => approve(p)}
                    data-ocid={`admin.payments.confirm_button.${i + 1}`}
                  >
                    ✓ Approve
                  </button>
                  <button
                    type="button"
                    className="fire-btn fire-btn-danger"
                    style={{
                      width: "auto",
                      padding: "5px 10px",
                      fontSize: "0.75rem",
                    }}
                    onClick={() => reject(p.id, p.user)}
                    data-ocid={`admin.payments.delete_button.${i + 1}`}
                  >
                    ✕ Reject
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      ))}
      {filtered.length === 0 && (
        <div className="empty-state" data-ocid="admin.payments.empty_state">
          <div className="empty-state-icon">💸</div>
          <div>No {filter.toLowerCase()} payments</div>
        </div>
      )}
    </div>
  );
}

// ─── Admin Withdrawals ────────────────────────────────────────────────────────
function AdminWithdrawalsView({
  showToast,
  setIsLoading,
}: {
  showToast: (msg: string, type?: "success" | "error") => void;
  setIsLoading: (v: boolean) => void;
}) {
  const [withdraws, setWithdraws] = useState<WithdrawData[]>([]);
  const [filter, setFilter] = useState<"Pending" | "Approved" | "Rejected">(
    "Pending",
  );

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const snap = await getDocs(collection(db, "withdraw"));
      setWithdraws(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as WithdrawData)
          .reverse(),
      );
    } finally {
      setIsLoading(false);
    }
  }, [setIsLoading]);

  useEffect(() => {
    load();
  }, [load]);

  const approve = async (id: string, user: string) => {
    setIsLoading(true);
    try {
      await updateDoc(doc(db, "withdraw", id), { status: "Approved" });
      await logAdminAction("Approved withdrawal", user);
      showToast("Withdrawal approved!");
      load();
    } catch (_) {
      showToast("Error", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const reject = async (id: string, user: string) => {
    setIsLoading(true);
    try {
      await updateDoc(doc(db, "withdraw", id), { status: "Rejected" });
      await logAdminAction("Rejected withdrawal", user);
      showToast("Withdrawal rejected");
      load();
    } catch (_) {
      showToast("Error", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const filtered = withdraws.filter((w) => w.status === filter);
  const badgeClass = (s: string) =>
    s === "Approved"
      ? "badge-approved"
      : s === "Pending"
        ? "badge-pending"
        : "badge-rejected";

  return (
    <div data-ocid="admin.withdrawals.section">
      <h2 className="view-title">💰 Withdrawals</h2>
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {(["Pending", "Approved", "Rejected"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            data-ocid={`admin.withdrawals.${f.toLowerCase()}.tab`}
            style={
              {
                padding: "4px 12px",
                borderRadius: 6,
                border: "1px solid var(--border-color)",
                cursor: "pointer",
                fontSize: "0.8rem",
                background: filter === f ? "var(--accent)" : "var(--card-bg)",
                color: filter === f ? "white" : "var(--muted)",
              } as React.CSSProperties
            }
          >
            {f} ({withdraws.filter((w) => w.status === f).length})
          </button>
        ))}
      </div>
      {filtered.map((w, i) => (
        <div
          key={w.id}
          className="card"
          style={{ marginBottom: 8 }}
          data-ocid={`admin.withdrawals.item.${i + 1}`}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>
                {w.user}
              </div>
              <div style={{ color: "var(--muted)", fontSize: "0.75rem" }}>
                ₹{w.amount} → ₹{w.final} (after fee)
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span className={`badge ${badgeClass(w.status)}`}>
                {w.status}
              </span>
              {w.status === "Pending" && (
                <>
                  <button
                    type="button"
                    className="fire-btn fire-btn-success"
                    style={{
                      width: "auto",
                      padding: "5px 10px",
                      fontSize: "0.75rem",
                    }}
                    onClick={() => approve(w.id, w.user)}
                    data-ocid={`admin.withdrawals.confirm_button.${i + 1}`}
                  >
                    ✓ Approve
                  </button>
                  <button
                    type="button"
                    className="fire-btn fire-btn-danger"
                    style={{
                      width: "auto",
                      padding: "5px 10px",
                      fontSize: "0.75rem",
                    }}
                    onClick={() => reject(w.id, w.user)}
                    data-ocid={`admin.withdrawals.delete_button.${i + 1}`}
                  >
                    ✕ Reject
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      ))}
      {filtered.length === 0 && (
        <div className="empty-state" data-ocid="admin.withdrawals.empty_state">
          <div className="empty-state-icon">💰</div>
          <div>No {filter.toLowerCase()} withdrawals</div>
        </div>
      )}
    </div>
  );
}

// ─── Admin Announcements ──────────────────────────────────────────────────────
function AdminAnnouncementsView({
  showToast,
  setIsLoading,
}: {
  showToast: (msg: string, type?: "success" | "error") => void;
  setIsLoading: (v: boolean) => void;
}) {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [recents, setRecents] = useState<
    { id: string; title: string; message: string; timestamp: unknown }[]
  >([]);

  const load = useCallback(async () => {
    try {
      const q = query(
        collection(db, "notifications"),
        where("uid", "==", "ALL"),
        orderBy("timestamp", "desc"),
      );
      const snap = await getDocs(q);
      setRecents(
        snap.docs.map(
          (d) =>
            ({ id: d.id, ...d.data() }) as {
              id: string;
              title: string;
              message: string;
              timestamp: unknown;
            },
        ),
      );
    } catch (_) {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const send = async () => {
    if (!title.trim() || !message.trim()) {
      showToast("Fill title and message", "error");
      return;
    }
    setIsLoading(true);
    try {
      const usersSnap = await getDocs(collection(db, "users"));
      const batch: Promise<unknown>[] = usersSnap.docs.map((d) =>
        addDoc(collection(db, "notifications"), {
          uid: d.id,
          title: title.trim(),
          message: message.trim(),
          read: false,
          timestamp: new Date(),
        }),
      );
      // Also store as global
      batch.push(
        addDoc(collection(db, "notifications"), {
          uid: "ALL",
          title: title.trim(),
          message: message.trim(),
          read: true,
          timestamp: new Date(),
        }),
      );
      await Promise.all(batch);
      await logAdminAction("Sent announcement", title);
      showToast(`Announcement sent to ${usersSnap.size} users!`);
      setTitle("");
      setMessage("");
      load();
    } catch (_) {
      showToast("Error sending", "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div data-ocid="admin.announcements.section">
      <h2 className="view-title">📢 Announcements</h2>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="field-group">
          <div className="field-label">Title</div>
          <input
            className="fire-input"
            placeholder="Announcement title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            data-ocid="admin.announcements.input"
          />
        </div>
        <div className="field-group">
          <div className="field-label">Message</div>
          <textarea
            className="fire-input"
            placeholder="Write your announcement..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            style={{ resize: "vertical", fontFamily: "Rajdhani, sans-serif" }}
            data-ocid="admin.announcements.textarea"
          />
        </div>
        <button
          type="button"
          className="fire-btn"
          onClick={send}
          data-ocid="admin.announcements.submit_button"
        >
          📢 Send to All Users
        </button>
      </div>
      {recents.length > 0 && (
        <>
          <div className="section-label">Recent Announcements</div>
          {recents.map((r, i) => (
            <div
              key={r.id}
              className="list-item"
              data-ocid={`admin.announcements.item.${i + 1}`}
            >
              <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>
                {r.title}
              </div>
              <div style={{ color: "var(--muted)", fontSize: "0.78rem" }}>
                {r.message}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ─── Admin Complaints ─────────────────────────────────────────────────────────
function AdminComplaintsView({
  showToast,
  setIsLoading,
}: {
  showToast: (msg: string, type?: "success" | "error") => void;
  setIsLoading: (v: boolean) => void;
}) {
  const [reports, setReports] = useState<
    {
      id: string;
      uid: string;
      category: string;
      description: string;
      status: string;
      timestamp: unknown;
    }[]
  >([]);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const snap = await getDocs(collection(db, "reports"));
      setReports(
        snap.docs
          .map(
            (d) =>
              ({ id: d.id, ...d.data() }) as {
                id: string;
                uid: string;
                category: string;
                description: string;
                status: string;
                timestamp: unknown;
              },
          )
          .reverse(),
      );
    } finally {
      setIsLoading(false);
    }
  }, [setIsLoading]);

  useEffect(() => {
    load();
  }, [load]);

  const resolve = async (id: string) => {
    await updateDoc(doc(db, "reports", id), { status: "resolved" });
    await logAdminAction("Resolved complaint", id);
    showToast("Marked resolved");
    load();
  };

  const del = async (id: string) => {
    await deleteDoc(doc(db, "reports", id));
    await logAdminAction("Deleted complaint", id);
    showToast("Deleted");
    load();
  };

  return (
    <div data-ocid="admin.complaints.section">
      <h2 className="view-title">🚩 Complaints</h2>
      {reports.length === 0 ? (
        <div className="empty-state" data-ocid="admin.complaints.empty_state">
          <div className="empty-state-icon">🚩</div>
          <div>No complaints</div>
        </div>
      ) : (
        reports.map((r, i) => (
          <div
            key={r.id}
            className="card"
            style={{ marginBottom: 8 }}
            data-ocid={`admin.complaints.item.${i + 1}`}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 4,
              }}
            >
              <div style={{ fontWeight: 700, fontSize: "0.85rem" }}>
                {r.uid}
              </div>
              <span
                className={`badge ${r.status === "resolved" ? "badge-approved" : "badge-pending"}`}
              >
                {r.status}
              </span>
            </div>
            <div
              style={{
                fontSize: "0.78rem",
                color: "var(--accent)",
                marginBottom: 4,
              }}
            >
              📂 {r.category}
            </div>
            <div
              style={{
                color: "var(--muted)",
                fontSize: "0.8rem",
                marginBottom: 8,
              }}
            >
              {r.description}
            </div>
            {r.status !== "resolved" && (
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  type="button"
                  className="fire-btn fire-btn-success"
                  style={{ fontSize: "0.78rem" }}
                  onClick={() => resolve(r.id)}
                  data-ocid={`admin.complaints.confirm_button.${i + 1}`}
                >
                  ✓ Resolve
                </button>
                <button
                  type="button"
                  className="fire-btn fire-btn-danger"
                  style={{ fontSize: "0.78rem" }}
                  onClick={() => del(r.id)}
                  data-ocid={`admin.complaints.delete_button.${i + 1}`}
                >
                  🗑️ Delete
                </button>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

// ─── Admin Chat ───────────────────────────────────────────────────────────────
interface SupportMsg {
  id: string;
  uid: string;
  message: string;
  sender: string;
  timestamp: unknown;
}

function AdminChatView({
  showToast,
  setIsLoading,
}: {
  showToast: (msg: string, type?: "success" | "error") => void;
  setIsLoading: (v: boolean) => void;
}) {
  const [chats, setChats] = useState<SupportMsg[]>([]);
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [reply, setReply] = useState("");

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const snap = await getDocs(collection(db, "support"));
      setChats(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as SupportMsg));
    } finally {
      setIsLoading(false);
    }
  }, [setIsLoading]);

  useEffect(() => {
    load();
  }, [load]);

  // unique users
  const userList = [...new Set(chats.map((c) => c.uid))];
  const thread = selectedUid
    ? chats
        .filter((c) => c.uid === selectedUid)
        .sort((a, b) => {
          const ta = (a.timestamp as { seconds?: number })?.seconds || 0;
          const tb = (b.timestamp as { seconds?: number })?.seconds || 0;
          return ta - tb;
        })
    : [];

  const sendReply = async () => {
    if (!reply.trim() || !selectedUid) return;
    setIsLoading(true);
    try {
      await addDoc(collection(db, "support"), {
        uid: selectedUid,
        message: reply.trim(),
        sender: "admin",
        timestamp: new Date(),
      });
      await logAdminAction("Replied to chat", selectedUid);
      showToast("Reply sent!");
      setReply("");
      load();
    } catch (_) {
      showToast("Error", "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div data-ocid="admin.chat.section">
      <h2 className="view-title">💬 Support Chats</h2>
      {!selectedUid ? (
        <>
          {userList.length === 0 ? (
            <div className="empty-state" data-ocid="admin.chat.empty_state">
              <div className="empty-state-icon">💬</div>
              <div>No support chats</div>
            </div>
          ) : (
            userList.map((uid, i) => (
              <button
                key={uid}
                type="button"
                className="list-item"
                style={{
                  cursor: "pointer",
                  background: "none",
                  border: "none",
                  width: "100%",
                  textAlign: "left" as const,
                }}
                onClick={() => setSelectedUid(uid)}
                data-ocid={`admin.chat.item.${i + 1}`}
              >
                <div
                  className="avatar-circle"
                  style={{ width: 36, height: 36, fontSize: "0.85rem" }}
                >
                  {uid[0].toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>
                    {uid}
                  </div>
                  <div style={{ color: "var(--muted)", fontSize: "0.75rem" }}>
                    {chats.filter((c) => c.uid === uid).length} messages
                  </div>
                </div>
                <span style={{ color: "var(--accent)", fontSize: "0.8rem" }}>
                  View →
                </span>
              </button>
            ))
          )}
        </>
      ) : (
        <>
          <button
            type="button"
            className="back-btn"
            onClick={() => setSelectedUid(null)}
            style={{ marginBottom: 12 }}
            data-ocid="admin.chat.back.button"
          >
            <ArrowLeft size={14} /> Back to list
          </button>
          <div
            style={{ fontWeight: 700, marginBottom: 8, color: "var(--accent)" }}
          >
            Chat with: {selectedUid}
          </div>
          <div style={{ minHeight: 200, marginBottom: 12 }}>
            {thread.map((m) => (
              <div
                key={m.id}
                style={{
                  display: "flex",
                  justifyContent:
                    m.sender === "admin" ? "flex-end" : "flex-start",
                  marginBottom: 8,
                }}
              >
                {m.sender === "admin" ? (
                  <div
                    className="chat-bubble-sent"
                    style={{
                      background: "linear-gradient(135deg, #1d4ed8, #3b82f6)",
                    }}
                  >
                    {m.message}
                  </div>
                ) : (
                  <div
                    style={{
                      background: "var(--card-bg)",
                      border: "1px solid var(--border-color)",
                      borderRadius: "12px 12px 12px 4px",
                      padding: "8px 12px",
                      maxWidth: "75%",
                      fontSize: "0.85rem",
                      color: "var(--text)",
                    }}
                  >
                    {m.message}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="chat-input-row">
            <input
              className="fire-input"
              placeholder="Type reply..."
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendReply()}
              style={{ flex: 1 }}
              data-ocid="admin.chat.input"
            />
            <button
              type="button"
              className="fire-btn"
              style={{ width: "auto", padding: "10px 18px" }}
              onClick={sendReply}
              data-ocid="admin.chat.submit_button"
            >
              Send
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Admin Logs ───────────────────────────────────────────────────────────────
function AdminLogsView({
  setIsLoading,
}: { setIsLoading: (v: boolean) => void }) {
  const [logs, setLogs] = useState<AdminLogEntry[]>([]);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      try {
        const q = query(
          collection(db, "admin_logs"),
          orderBy("timestamp", "desc"),
        );
        const snap = await getDocs(q);
        setLogs(
          snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AdminLogEntry),
        );
      } catch (_) {
        /* ignore */
      } finally {
        setIsLoading(false);
      }
    })();
  }, [setIsLoading]);

  const fmt = (ts: unknown): string => {
    if (!ts) return "";
    const s = (ts as { seconds?: number })?.seconds;
    if (s) return new Date(s * 1000).toLocaleString();
    if (ts instanceof Date) return ts.toLocaleString();
    return "";
  };

  return (
    <div data-ocid="admin.logs.section">
      <h2 className="view-title">📋 Activity Logs</h2>
      {logs.length === 0 ? (
        <div className="empty-state" data-ocid="admin.logs.empty_state">
          <div className="empty-state-icon">📋</div>
          <div>No activity logs yet</div>
        </div>
      ) : (
        logs.map((l, i) => (
          <div
            key={l.id}
            className="list-item"
            data-ocid={`admin.logs.item.${i + 1}`}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: "0.85rem" }}>
                {l.action}
              </div>
              {l.target && (
                <div style={{ color: "var(--muted)", fontSize: "0.75rem" }}>
                  Target: {l.target}
                </div>
              )}
            </div>
            <div
              style={{
                color: "var(--muted)",
                fontSize: "0.7rem",
                textAlign: "right",
              }}
            >
              {fmt(l.timestamp)}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
