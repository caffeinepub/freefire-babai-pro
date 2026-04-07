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
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "../firebase";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function timeAgo(ts: any): string {
  if (!ts) return "";
  const d =
    ts?.toDate?.() ??
    (typeof ts === "number" ? new Date(ts) : new Date(String(ts)));
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} mins ago`;
  if (diff < 86400) {
    const h = d.getHours();
    const m = d.getMinutes();
    return `Today ${h}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
  }
  return d.toLocaleDateString();
}

function getNextSunday6PM(): Date {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const daysUntil = day === 0 ? 7 : 7 - day;
  const next = new Date(now);
  next.setDate(now.getDate() + daysUntil);
  next.setHours(18, 0, 0, 0);
  return next;
}

function useCountdown(target: Date) {
  const [diff, setDiff] = useState(Math.max(0, target.getTime() - Date.now()));
  useEffect(() => {
    const id = setInterval(() => {
      setDiff(Math.max(0, target.getTime() - Date.now()));
    }, 1000);
    return () => clearInterval(id);
  }, [target]);
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  return { days, hours, mins, secs };
}

// ─── Category badge ────────────────────────────────────────────────────────────
const CAT_COLORS: Record<string, { bg: string; color: string }> = {
  General: { bg: "rgba(99,102,241,0.15)", color: "#818cf8" },
  "Match Info": { bg: "rgba(255,107,0,0.15)", color: "#ff9a00" },
  Payment: { bg: "rgba(0,200,100,0.15)", color: "#00c864" },
  Alert: { bg: "rgba(239,68,68,0.15)", color: "#ef4444" },
};

function CategoryBadge({ cat }: { cat: string }) {
  const c = CAT_COLORS[cat] ?? CAT_COLORS.General;
  return (
    <span
      style={{
        fontSize: "0.6rem",
        fontFamily: "Rajdhani, sans-serif",
        fontWeight: 700,
        padding: "2px 7px",
        borderRadius: 20,
        letterSpacing: "0.06em",
        background: c.bg,
        color: c.color,
        border: `1px solid ${c.color}50`,
        textTransform: "uppercase",
      }}
    >
      {cat}
    </span>
  );
}

// ─── Reaction Button ────────────────────────────────────────────────────────
function ReactionBtn({
  emoji,
  count,
  active,
  onClick,
}: {
  emoji: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        padding: "3px 8px",
        borderRadius: 20,
        cursor: "pointer",
        background: active ? "rgba(255,107,0,0.18)" : "rgba(255,255,255,0.05)",
        border: `1px solid ${active ? "rgba(255,107,0,0.5)" : "rgba(255,255,255,0.12)"}`,
        fontSize: "0.75rem",
        color: "rgba(255,255,255,0.75)",
        fontFamily: "Rajdhani, sans-serif",
        fontWeight: 600,
        transition: "all 0.15s",
      }}
    >
      {emoji} <span>{count}</span>
    </button>
  );
}

// ─── MessagesView ─────────────────────────────────────────────────────────────
export function MessagesView({
  user,
  onNavigate: _onNavigate,
}: { user: any; onNavigate: (v: string) => void }) {
  const [tab, setTab] = useState<"announce" | "global">("announce");
  const [messages, setMessages] = useState<any[]>([]);
  const [globalMsgs, setGlobalMsgs] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [sending, setSending] = useState(false);
  const [newToast, setNewToast] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const isFirstLoad = useRef(true);

  // Announcements listener
  useEffect(() => {
    let unsub: (() => void) | null = null;
    const setup = async () => {
      await initFirebase();
      const q = query(
        collection(db, "messages"),
        orderBy("timestamp", "desc"),
        limit(80),
      );
      unsub = onSnapshot(q, (snap: any) => {
        const docs = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
        // Pinned first, then rest by time
        const pinned = docs.filter((m: any) => m.isPinned);
        const rest = docs.filter((m: any) => !m.isPinned);
        setMessages([...pinned, ...rest]);
        if (!isFirstLoad.current) {
          for (const change of snap.docChanges()) {
            if (change.type === "added") {
              const txt = change.doc.data().text || "";
              setNewToast(txt.length > 70 ? `${txt.slice(0, 70)}...` : txt);
              setTimeout(() => setNewToast(null), 4000);
            }
          }
        }
        isFirstLoad.current = false;
      });
    };
    setup();
    return () => {
      if (unsub) unsub();
    };
  }, []);

  // Global chat listener
  useEffect(() => {
    let unsub: (() => void) | null = null;
    const setup = async () => {
      await initFirebase();
      const q = query(
        collection(db, "globalChat"),
        orderBy("timestamp", "asc"),
        limit(100),
      );
      unsub = onSnapshot(q, (snap: any) => {
        setGlobalMsgs(snap.docs.map((d: any) => ({ id: d.id, ...d.data() })));
        setTimeout(
          () => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }),
          50,
        );
      });
    };
    setup();
    return () => {
      if (unsub) unsub();
    };
  }, []);

  const sendGlobalMsg = async () => {
    const text = chatInput.trim();
    // Strip phone numbers before storing
    const sanitized = text
      .replace(/\d{10}/g, "**")
      .replace(/\+91\d{10}/g, "**");
    if (!sanitized || sending) return;
    setSending(true);
    try {
      await addDoc(collection(db, "globalChat"), {
        text: sanitized,
        uid: user?.uid ?? "unknown",
        displayName: user?.displayName ?? "Player",
        timestamp: new Date(),
      });
      setChatInput("");
    } catch (_) {}
    setSending(false);
  };

  const handleReact = async (
    msgId: string,
    emoji: "fire" | "heart" | "thumbs",
  ) => {
    try {
      const ref = doc(db, "messages", msgId);
      const snap = await getDoc(ref);
      if (!snap.exists()) return;
      const data = snap.data();
      const field = `reactions_${emoji}`;
      const current = data[field] ?? 0;
      await updateDoc(ref, { [field]: current + 1 });
    } catch (_) {}
  };

  const filteredMsgs = messages.filter(
    (m) => !search || m.text?.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <motion.div
      className="main-content"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Toast */}
      <AnimatePresence>
        {newToast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            style={{
              position: "fixed",
              top: 62,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 300,
              background: "rgba(20,10,0,0.95)",
              border: "1px solid rgba(255,107,0,0.4)",
              borderRadius: 12,
              padding: "10px 18px",
              maxWidth: 320,
              width: "90%",
              backdropFilter: "blur(10px)",
            }}
          >
            <div
              style={{
                fontSize: "0.72rem",
                color: "#ff9a00",
                fontWeight: 700,
                marginBottom: 2,
                fontFamily: "Orbitron, sans-serif",
              }}
            >
              📢 New Announcement from Admin!
            </div>
            <div
              style={{
                fontSize: "0.82rem",
                color: "rgba(255,255,255,0.85)",
                fontFamily: "Rajdhani, sans-serif",
              }}
            >
              {newToast}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div style={{ marginBottom: 14 }}>
        <div className="flex-between" style={{ marginBottom: 12 }}>
          <div>
            <div
              style={{
                fontFamily: "Orbitron, sans-serif",
                fontSize: "0.95rem",
                fontWeight: 700,
                color: "#fff",
              }}
            >
              📢 Messages
            </div>
            <div
              style={{
                fontSize: "0.72rem",
                color: "rgba(255,255,255,0.4)",
                fontFamily: "Rajdhani, sans-serif",
              }}
            >
              MR.SONIC FF Broadcasts
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {(["announce", "global"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`admin-tab ${tab === t ? "active" : ""}`}
              style={{ flex: 1 }}
            >
              {t === "announce" ? "📢 Announcements" : "💬 Global Chat"}
            </button>
          ))}
        </div>
      </div>

      {/* Announcements Tab */}
      {tab === "announce" && (
        <div>
          {/* Search */}
          <div style={{ marginBottom: 12 }}>
            <input
              className="fire-input"
              placeholder="🔍 Search messages..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-ocid="messages.search.input"
            />
          </div>

          {filteredMsgs.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📭</div>
              <div className="empty-state-text">No announcements yet</div>
            </div>
          ) : (
            filteredMsgs.map((msg, i) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                style={{
                  background: msg.isPinned
                    ? "linear-gradient(135deg, rgba(255,215,0,0.07), rgba(10,10,26,0.6))"
                    : "linear-gradient(135deg, rgba(255,107,0,0.06), rgba(10,10,26,0.55))",
                  border: `1px solid ${msg.isPinned ? "rgba(255,215,0,0.3)" : "rgba(255,107,0,0.25)"}`,
                  borderRadius: 14,
                  padding: "12px 14px",
                  marginBottom: 10,
                }}
              >
                {/* Header row */}
                <div className="flex-between" style={{ marginBottom: 8 }}>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    {/* MR.SONIC FF Brand */}
                    <div
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: "50%",
                        background: "linear-gradient(135deg, #ff6b00, #cc5500)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        color: "white",
                        flexShrink: 0,
                        border: "1.5px solid rgba(255,107,0,0.5)",
                      }}
                    >
                      🎮
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: "0.78rem",
                          fontFamily: "Orbitron, sans-serif",
                          fontWeight: 700,
                          color: "#ff9a00",
                        }}
                      >
                        MR.SONIC FF
                      </div>
                      <div
                        style={{
                          fontSize: "0.65rem",
                          color: "rgba(255,255,255,0.35)",
                          fontFamily: "Rajdhani, sans-serif",
                        }}
                      >
                        Admin Broadcast
                      </div>
                    </div>
                  </div>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    {msg.isPinned && (
                      <span
                        style={{
                          fontSize: "0.6rem",
                          padding: "2px 7px",
                          borderRadius: 20,
                          background: "rgba(255,215,0,0.15)",
                          color: "#ffd700",
                          border: "1px solid rgba(255,215,0,0.4)",
                          fontWeight: 700,
                          fontFamily: "Rajdhani, sans-serif",
                          letterSpacing: "0.05em",
                        }}
                      >
                        PINNED 📌
                      </span>
                    )}
                    {msg.category && <CategoryBadge cat={msg.category} />}
                  </div>
                </div>

                {/* Message text */}
                <div
                  style={{
                    fontSize: "0.9rem",
                    color: "rgba(255,255,255,0.88)",
                    fontFamily: "Rajdhani, sans-serif",
                    lineHeight: 1.5,
                    marginBottom: 8,
                  }}
                >
                  {msg.text}
                </div>

                {/* Image */}
                {msg.imageUrl && (
                  <img
                    src={msg.imageUrl}
                    alt="announcement"
                    style={{
                      width: "100%",
                      borderRadius: 10,
                      marginBottom: 8,
                      maxHeight: 200,
                      objectFit: "cover",
                    }}
                  />
                )}

                {/* Timestamp + reactions */}
                <div className="flex-between" style={{ marginTop: 6 }}>
                  <div
                    style={{
                      fontSize: "0.68rem",
                      color: "rgba(255,255,255,0.3)",
                      fontFamily: "Rajdhani, sans-serif",
                    }}
                  >
                    {timeAgo(msg.timestamp)}
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <ReactionBtn
                      emoji="🔥"
                      count={msg.reactions_fire ?? 0}
                      active={false}
                      onClick={() => handleReact(msg.id, "fire")}
                    />
                    <ReactionBtn
                      emoji="❤️"
                      count={msg.reactions_heart ?? 0}
                      active={false}
                      onClick={() => handleReact(msg.id, "heart")}
                    />
                    <ReactionBtn
                      emoji="👍"
                      count={msg.reactions_thumbs ?? 0}
                      active={false}
                      onClick={() => handleReact(msg.id, "thumbs")}
                    />
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      )}

      {/* Global Chat Tab */}
      {tab === "global" && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            height: "calc(100vh - 200px)",
          }}
        >
          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", paddingBottom: 8 }}>
            {globalMsgs.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">💬</div>
                <div className="empty-state-text">No messages yet. Say hi!</div>
              </div>
            ) : (
              globalMsgs.map((msg) => {
                const isMe = msg.uid === user?.uid;
                return (
                  <div
                    key={msg.id}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: isMe ? "flex-end" : "flex-start",
                      marginBottom: 10,
                    }}
                  >
                    {!isMe && (
                      <div
                        style={{
                          fontSize: "0.7rem",
                          color: "#ff9a00",
                          fontFamily: "Orbitron, sans-serif",
                          marginBottom: 3,
                          paddingLeft: 4,
                        }}
                      >
                        {msg.displayName ?? msg.uid}
                      </div>
                    )}
                    <div
                      style={{
                        maxWidth: "78%",
                        background: isMe
                          ? "linear-gradient(135deg, rgba(255,107,0,0.28), rgba(204,85,0,0.22))"
                          : "rgba(255,255,255,0.06)",
                        border: `1px solid ${isMe ? "rgba(255,107,0,0.35)" : "rgba(255,255,255,0.1)"}`,
                        borderRadius: isMe
                          ? "14px 14px 4px 14px"
                          : "14px 14px 14px 4px",
                        padding: "9px 13px",
                        fontFamily: "Rajdhani, sans-serif",
                        fontSize: "0.9rem",
                        color: "white",
                        lineHeight: 1.4,
                      }}
                    >
                      {msg.text}
                    </div>
                    <div
                      style={{
                        fontSize: "0.62rem",
                        color: "rgba(255,255,255,0.25)",
                        marginTop: 3,
                        paddingRight: 2,
                      }}
                    >
                      {timeAgo(msg.timestamp)}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="chat-input-row" style={{ paddingTop: 8 }}>
            <input
              className="fire-input"
              style={{ flex: 1, marginBottom: 0 }}
              placeholder="Type a message..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendGlobalMsg()}
              data-ocid="global_chat.message.input"
            />
            <button
              type="button"
              className="fire-btn"
              onClick={sendGlobalMsg}
              disabled={sending || !chatInput.trim()}
              style={{ width: "auto", padding: "12px 18px", marginBottom: 0 }}
              data-ocid="global_chat.send.button"
            >
              ➤
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ─── TournamentView ───────────────────────────────────────────────────────────
export function TournamentView({
  user,
  onNavigate: _onNavigate,
}: { user: any; onNavigate: (v: string) => void }) {
  const [activeTournament, setActiveTournament] = useState<any>(null);
  const [pastTournaments, setPastTournaments] = useState<any[]>([]);
  const [tournamentChat, setTournamentChat] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [showRules, setShowRules] = useState(false);
  const [showRegModal, setShowRegModal] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [expandedPast, setExpandedPast] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const { days, hours, mins, secs } = useCountdown(getNextSunday6PM());

  // Load tournaments
  useEffect(() => {
    const load = async () => {
      await initFirebase();
      // Active tournament
      try {
        const q = query(
          collection(db, "tournaments"),
          where("status", "in", ["active", "open", "in-progress"]),
          limit(1),
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          const t = { id: snap.docs[0].id, ...snap.docs[0].data() };
          setActiveTournament(t);
          setIsRegistered((t as any).registeredPlayers?.includes(user?.uid));
        }
      } catch (_) {}

      // Past tournaments
      try {
        const q2 = query(
          collection(db, "tournaments"),
          where("status", "==", "completed"),
          orderBy("createdAt", "desc"),
          limit(10),
        );
        const snap2 = await getDocs(q2);
        setPastTournaments(
          snap2.docs.map((d: any) => ({ id: d.id, ...d.data() })),
        );
      } catch (_) {}
    };
    load();
  }, [user]);

  // Tournament chat
  useEffect(() => {
    let unsub: (() => void) | null = null;
    if (!activeTournament?.id) return;
    const setup = async () => {
      await initFirebase();
      const q = query(
        collection(db, "tournamentChat"),
        where("tournamentId", "==", activeTournament.id),
        orderBy("timestamp", "asc"),
        limit(80),
      );
      unsub = onSnapshot(q, (snap: any) => {
        setTournamentChat(
          snap.docs.map((d: any) => ({ id: d.id, ...d.data() })),
        );
        setTimeout(
          () => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }),
          50,
        );
      });
    };
    setup();
    return () => {
      if (unsub) unsub();
    };
  }, [activeTournament?.id]);

  const handleRegister = async () => {
    if (!activeTournament || isRegistered) return;
    try {
      const ref = doc(db, "tournaments", activeTournament.id);
      const snap = await getDoc(ref);
      if (!snap.exists()) return;
      const data = snap.data();
      const players = data.registeredPlayers ?? [];
      if (players.includes(user?.uid)) {
        setIsRegistered(true);
        setShowRegModal(false);
        return;
      }

      // Deduct entry fee from wallet
      const entryFee = activeTournament.entryFee ?? 0;
      if (entryFee > 0) {
        const walletRef = doc(db, "wallet", user?.uid);
        const walletSnap = await getDoc(walletRef);
        const coins = walletSnap.exists() ? (walletSnap.data().coins ?? 0) : 0;
        if (coins < entryFee) {
          setShowRegModal(false);
          return;
        }
        await updateDoc(walletRef, { coins: coins - entryFee });
      }

      await updateDoc(ref, { registeredPlayers: [...players, user?.uid] });
      setActiveTournament({
        ...activeTournament,
        registeredPlayers: [...players, user?.uid],
      });
      setIsRegistered(true);
      setShowRegModal(false);
    } catch (_) {}
  };

  const sendTournamentMsg = async () => {
    const text = chatInput.trim();
    if (!text || !activeTournament) return;
    try {
      await addDoc(collection(db, "tournamentChat"), {
        text,
        uid: user?.uid ?? "unknown",
        displayName: user?.displayName ?? "Player",
        tournamentId: activeTournament.id,
        timestamp: new Date(),
      });
      setChatInput("");
    } catch (_) {}
  };

  const shareLink = () => {
    const text = `🏆 MR.SONIC FF Tournament!\n${activeTournament?.name ?? "Tournament"}\nEntry: ₹${activeTournament?.entryFee ?? 0} | Prize: ₹${activeTournament?.prizePool ?? 0}\nJoin Now! 🔥`;
    navigator.clipboard.writeText(text).catch(() => {});
  };

  const StatusBadge = ({ status }: { status: string }) => {
    const cfg: Record<string, { bg: string; color: string; label: string }> = {
      open: { bg: "rgba(0,200,100,0.15)", color: "#00c864", label: "OPEN" },
      active: {
        bg: "rgba(255,107,0,0.15)",
        color: "#ff9a00",
        label: "IN PROGRESS",
      },
      "in-progress": {
        bg: "rgba(255,107,0,0.15)",
        color: "#ff9a00",
        label: "IN PROGRESS",
      },
      completed: {
        bg: "rgba(107,114,128,0.15)",
        color: "#9ca3af",
        label: "COMPLETED",
      },
    };
    const s = cfg[status] ?? cfg.open;
    return (
      <span
        style={{
          fontSize: "0.6rem",
          padding: "2px 8px",
          borderRadius: 20,
          fontWeight: 700,
          letterSpacing: "0.06em",
          fontFamily: "Rajdhani, sans-serif",
          background: s.bg,
          color: s.color,
          border: `1px solid ${s.color}50`,
        }}
      >
        {s.label}
      </span>
    );
  };

  return (
    <motion.div
      className="main-content"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Registration Modal */}
      <AnimatePresence>
        {showRegModal && activeTournament && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowRegModal(false)}
          >
            <motion.div
              className="modal-sheet"
              initial={{ y: 60 }}
              animate={{ y: 0 }}
              exit={{ y: 60 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-handle" />
              <div className="modal-title">Tournament Registration</div>
              <div style={{ textAlign: "center", marginBottom: 16 }}>
                <div
                  style={{
                    fontSize: "0.9rem",
                    color: "rgba(255,255,255,0.7)",
                    fontFamily: "Rajdhani, sans-serif",
                    marginBottom: 8,
                  }}
                >
                  {activeTournament.name}
                </div>
                <div
                  style={{
                    fontFamily: "Orbitron, sans-serif",
                    fontSize: "1.2rem",
                    fontWeight: 700,
                    color: "#ff9a00",
                  }}
                >
                  Entry Fee: ₹{activeTournament.entryFee ?? 0}
                </div>
                <div
                  style={{
                    fontSize: "0.8rem",
                    color: "rgba(255,255,255,0.4)",
                    marginTop: 4,
                    fontFamily: "Rajdhani, sans-serif",
                  }}
                >
                  Will be deducted from your wallet
                </div>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  type="button"
                  className="fire-btn fire-btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => setShowRegModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="fire-btn"
                  style={{ flex: 1 }}
                  onClick={handleRegister}
                  data-ocid="tournament.register.confirm.button"
                >
                  Confirm
                </button>
              </div>
            </motion.div>
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
          >
            <motion.div
              className="modal-sheet"
              initial={{ y: 60 }}
              animate={{ y: 0 }}
              exit={{ y: 60 }}
              onClick={(e) => e.stopPropagation()}
              style={{ maxHeight: "70vh" }}
            >
              <div className="modal-handle" />
              <div className="modal-title">📜 Tournament Rules</div>
              <ul className="rules-list" style={{ marginBottom: 16 }}>
                {[
                  "Registration fee is non-refundable once paid.",
                  "All players must be online 10 mins before start.",
                  "Room ID and Password will be sent after all slots fill.",
                  "Any form of cheating results in immediate disqualification.",
                  "Admin's decision on match results is final.",
                  "Prize is credited within 24 hours of result declaration.",
                  "Only one account per player is allowed.",
                  "Harassment or toxic behavior will result in permanent ban.",
                ].map((r, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: static list, order never changes
                  <li key={i}>
                    <span className="rules-num">{i + 1}.</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="fire-btn"
                onClick={() => setShowRules(false)}
              >
                Got It
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Arena Header */}
      <div
        style={{
          background:
            "linear-gradient(135deg, rgba(255,215,0,0.08), rgba(255,107,0,0.06), rgba(10,10,26,0.8))",
          border: "1px solid rgba(255,215,0,0.3)",
          borderRadius: 16,
          padding: "16px 18px",
          marginBottom: 14,
          boxShadow: "0 0 28px rgba(255,215,0,0.08)",
          animation: "pulse-glow 3s ease-in-out infinite",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 16,
            background:
              "linear-gradient(135deg, transparent, rgba(255,215,0,0.03))",
          }}
        />
        <div
          style={{
            fontFamily: "Orbitron, sans-serif",
            fontSize: "1.1rem",
            fontWeight: 900,
            background: "linear-gradient(135deg, #ffd700, #ff9a00, #ff6b00)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            letterSpacing: "0.1em",
            marginBottom: 4,
          }}
        >
          🏟️ TOURNAMENT ARENA
        </div>
        <div
          style={{
            fontSize: "0.78rem",
            color: "rgba(255,255,255,0.45)",
            fontFamily: "Rajdhani, sans-serif",
          }}
        >
          Compete. Dominate. Win Real Cash.
        </div>
      </div>

      {/* Countdown */}
      <div
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,107,0,0.2)",
          borderRadius: 14,
          padding: "18px 16px",
          marginBottom: 14,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: "0.7rem",
            color: "rgba(255,255,255,0.4)",
            fontFamily: "Rajdhani, sans-serif",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            marginBottom: 10,
          }}
        >
          ⏱️ Next Tournament
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>
          {[
            { val: days, label: "Days" },
            { val: hours, label: "Hrs" },
            { val: mins, label: "Min" },
            { val: secs, label: "Sec" },
          ].map(({ val, label }) => (
            <div key={label} style={{ textAlign: "center" }}>
              <div
                style={{
                  fontFamily: "Orbitron, sans-serif",
                  fontSize: "1.6rem",
                  fontWeight: 900,
                  color: "#ff9a00",
                  minWidth: 44,
                  background: "rgba(255,107,0,0.1)",
                  border: "1px solid rgba(255,107,0,0.25)",
                  borderRadius: 10,
                  padding: "6px 8px",
                  animation: "livePulse 2s ease-in-out infinite",
                }}
              >
                {String(val).padStart(2, "0")}
              </div>
              <div
                style={{
                  fontSize: "0.6rem",
                  color: "rgba(255,255,255,0.35)",
                  fontFamily: "Rajdhani, sans-serif",
                  marginTop: 4,
                }}
              >
                {label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Active Tournament */}
      {activeTournament ? (
        <div
          style={{
            background:
              "linear-gradient(135deg, rgba(255,107,0,0.08), rgba(10,10,26,0.7))",
            border: "1px solid rgba(255,107,0,0.3)",
            borderRadius: 16,
            padding: "16px",
            marginBottom: 14,
          }}
        >
          <div className="flex-between" style={{ marginBottom: 10 }}>
            <div
              style={{
                fontFamily: "Orbitron, sans-serif",
                fontSize: "0.9rem",
                fontWeight: 700,
                color: "#fff",
              }}
            >
              {activeTournament.name ?? "🏆 Active Tournament"}
            </div>
            <StatusBadge status={activeTournament.status} />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
              marginBottom: 12,
            }}
          >
            {[
              { label: "Entry Fee", val: `₹${activeTournament.entryFee ?? 0}` },
              {
                label: "Prize Pool",
                val: `₹${activeTournament.prizePool ?? 0}`,
              },
              {
                label: "Players",
                val: `${(activeTournament.registeredPlayers ?? []).length}/${activeTournament.maxPlayers ?? "∞"}`,
              },
              { label: "Mode", val: activeTournament.mode ?? "BR" },
            ].map(({ label, val }) => (
              <div key={label} className="stat-box">
                <div className="stat-value" style={{ fontSize: "0.9rem" }}>
                  {val}
                </div>
                <div className="stat-label">{label}</div>
              </div>
            ))}
          </div>

          {/* Bracket if available */}
          {activeTournament.bracket &&
            Array.isArray(activeTournament.bracket) &&
            activeTournament.bracket.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div className="section-label" style={{ marginBottom: 8 }}>
                  🥊 Match Bracket
                </div>
                {activeTournament.bracket.map((match: any, i: number) => (
                  <div
                    key={match.id ?? match.player1 ?? i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 6,
                      background: "rgba(255,255,255,0.03)",
                      borderRadius: 8,
                      padding: "8px 10px",
                      border: "1px solid rgba(255,255,255,0.07)",
                    }}
                  >
                    <div
                      style={{
                        flex: 1,
                        textAlign: "center",
                        fontFamily: "Rajdhani, sans-serif",
                        fontSize: "0.85rem",
                        color:
                          match.winner === match.player1
                            ? "#ffd700"
                            : "rgba(255,255,255,0.7)",
                        fontWeight: match.winner === match.player1 ? 700 : 400,
                      }}
                    >
                      {match.player1 ?? "TBD"}
                    </div>
                    <div
                      style={{
                        fontSize: "0.65rem",
                        color: "rgba(255,255,255,0.3)",
                        fontFamily: "Orbitron, sans-serif",
                      }}
                    >
                      VS
                    </div>
                    <div
                      style={{
                        flex: 1,
                        textAlign: "center",
                        fontFamily: "Rajdhani, sans-serif",
                        fontSize: "0.85rem",
                        color:
                          match.winner === match.player2
                            ? "#ffd700"
                            : "rgba(255,255,255,0.7)",
                        fontWeight: match.winner === match.player2 ? 700 : 400,
                      }}
                    >
                      {match.player2 ?? "TBD"}
                    </div>
                  </div>
                ))}
              </div>
            )}

          {/* Actions */}
          <div style={{ display: "flex", gap: 8 }}>
            {!isRegistered && activeTournament.status === "open" ? (
              <button
                type="button"
                className="fire-btn"
                style={{ flex: 1 }}
                onClick={() => setShowRegModal(true)}
                data-ocid="tournament.register.button"
              >
                🎯 REGISTER
              </button>
            ) : isRegistered ? (
              <div
                style={{
                  flex: 1,
                  textAlign: "center",
                  padding: "10px",
                  borderRadius: 10,
                  fontFamily: "Orbitron, sans-serif",
                  fontSize: "0.72rem",
                  background: "rgba(0,200,100,0.1)",
                  border: "1px solid rgba(0,200,100,0.3)",
                  color: "#00c864",
                  fontWeight: 700,
                }}
              >
                ✅ REGISTERED
              </div>
            ) : null}
            <button
              type="button"
              className="fire-btn fire-btn-secondary"
              style={{ flex: 1 }}
              onClick={() => setShowRules(true)}
              data-ocid="tournament.rules.button"
            >
              📜 Rules
            </button>
            <button
              type="button"
              className="fire-btn fire-btn-secondary"
              onClick={shareLink}
              style={{ padding: "12px 14px" }}
              data-ocid="tournament.share.button"
            >
              📤
            </button>
          </div>
        </div>
      ) : (
        <div
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,107,0,0.15)",
            borderRadius: 14,
            padding: "24px 16px",
            textAlign: "center",
            marginBottom: 14,
          }}
        >
          <div style={{ fontSize: "2rem", marginBottom: 8 }}>🏟️</div>
          <div
            style={{
              fontFamily: "Orbitron, sans-serif",
              fontSize: "0.82rem",
              color: "rgba(255,255,255,0.5)",
            }}
          >
            No Active Tournament
          </div>
          <div
            style={{
              fontSize: "0.75rem",
              color: "rgba(255,255,255,0.3)",
              fontFamily: "Rajdhani, sans-serif",
              marginTop: 4,
            }}
          >
            Watch this space — next tournament starts Sunday 6PM!
          </div>
        </div>
      )}

      {/* Tournament Chat */}
      {activeTournament && isRegistered && (
        <div
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,107,0,0.15)",
            borderRadius: 14,
            padding: "14px",
            marginBottom: 14,
          }}
        >
          <div className="section-label" style={{ marginBottom: 10 }}>
            💬 Tournament Chat
          </div>
          <div style={{ height: 160, overflowY: "auto", marginBottom: 10 }}>
            {tournamentChat.map((msg) => {
              const isMe = msg.uid === user?.uid;
              return (
                <div
                  key={msg.id}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: isMe ? "flex-end" : "flex-start",
                    marginBottom: 8,
                  }}
                >
                  {!isMe && (
                    <div
                      style={{
                        fontSize: "0.65rem",
                        color: "#ff9a00",
                        fontFamily: "Orbitron, sans-serif",
                        marginBottom: 2,
                        paddingLeft: 4,
                      }}
                    >
                      {msg.displayName}
                    </div>
                  )}
                  <div
                    style={{
                      maxWidth: "78%",
                      background: isMe
                        ? "rgba(255,107,0,0.2)"
                        : "rgba(255,255,255,0.06)",
                      border: `1px solid ${isMe ? "rgba(255,107,0,0.3)" : "rgba(255,255,255,0.08)"}`,
                      borderRadius: isMe
                        ? "12px 12px 4px 12px"
                        : "12px 12px 12px 4px",
                      padding: "7px 11px",
                      fontFamily: "Rajdhani, sans-serif",
                      fontSize: "0.85rem",
                      color: "white",
                    }}
                  >
                    {msg.text}
                  </div>
                </div>
              );
            })}
            <div ref={chatEndRef} />
          </div>
          <div className="chat-input-row">
            <input
              className="fire-input"
              style={{ flex: 1, marginBottom: 0, padding: "9px 12px" }}
              placeholder="Chat with tournament players..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendTournamentMsg()}
              data-ocid="tournament.chat.input"
            />
            <button
              type="button"
              className="fire-btn"
              onClick={sendTournamentMsg}
              style={{ width: "auto", padding: "9px 16px", marginBottom: 0 }}
              data-ocid="tournament.chat.send.button"
            >
              ➤
            </button>
          </div>
        </div>
      )}

      {/* Past Tournaments */}
      {pastTournaments.length > 0 && (
        <div>
          <div className="section-label" style={{ marginBottom: 10 }}>
            📁 Past Tournaments
          </div>
          {pastTournaments.map((t) => (
            // biome-ignore lint/a11y/useKeyWithClickEvents: non-interactive expand toggle
            <div
              key={t.id}
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 12,
                padding: "12px 14px",
                marginBottom: 8,
                cursor: "pointer",
              }}
              onClick={() =>
                setExpandedPast(expandedPast === t.id ? null : t.id)
              }
              data-ocid="tournament.past.row"
            >
              <div className="flex-between">
                <div>
                  <div
                    style={{
                      fontFamily: "Rajdhani, sans-serif",
                      fontSize: "0.9rem",
                      fontWeight: 600,
                      color: "white",
                    }}
                  >
                    {t.name ?? "Tournament"}
                  </div>
                  <div
                    style={{
                      fontSize: "0.7rem",
                      color: "rgba(255,255,255,0.35)",
                      fontFamily: "Rajdhani, sans-serif",
                    }}
                  >
                    {t.createdAt ? timeAgo(t.createdAt) : ""}
                  </div>
                </div>
                <div
                  style={{
                    fontSize: "0.65rem",
                    color: "#9ca3af",
                    fontFamily: "Rajdhani, sans-serif",
                    fontWeight: 700,
                  }}
                >
                  COMPLETED
                </div>
              </div>
              {expandedPast === t.id && (
                <div
                  style={{
                    marginTop: 10,
                    paddingTop: 10,
                    borderTop: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                    {t.winner && (
                      <div>
                        <span
                          style={{
                            color: "rgba(255,255,255,0.4)",
                            fontSize: "0.72rem",
                            fontFamily: "Rajdhani, sans-serif",
                          }}
                        >
                          🏆 Winner:{" "}
                        </span>
                        <span
                          style={{
                            color: "#ffd700",
                            fontSize: "0.82rem",
                            fontFamily: "Rajdhani, sans-serif",
                            fontWeight: 700,
                          }}
                        >
                          {t.winner}
                        </span>
                      </div>
                    )}
                    {t.prizePool && (
                      <div>
                        <span
                          style={{
                            color: "rgba(255,255,255,0.4)",
                            fontSize: "0.72rem",
                            fontFamily: "Rajdhani, sans-serif",
                          }}
                        >
                          💰 Prize:{" "}
                        </span>
                        <span
                          style={{
                            color: "#00c864",
                            fontSize: "0.82rem",
                            fontFamily: "Rajdhani, sans-serif",
                            fontWeight: 700,
                          }}
                        >
                          ₹{t.prizePool}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

// ─── ClanView ─────────────────────────────────────────────────────────────────
export function ClanView({
  user,
  onNavigate: _onNavigate,
}: { user: any; onNavigate: (v: string) => void }) {
  const [userClan, setUserClan] = useState<any>(null);
  const [allClans, setAllClans] = useState<any[]>([]);
  const [clanChat, setClanChat] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [newClanName, setNewClanName] = useState("");
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const loadClans = useCallback(async () => {
    await initFirebase();
    setLoading(true);
    try {
      // Check if user is in a clan
      if (user?.clanId) {
        const clanRef = doc(db, "clans", user.clanId);
        const clanSnap = await getDoc(clanRef);
        if (clanSnap.exists()) {
          // Load member details
          const clanData = { id: clanSnap.id, ...clanSnap.data() };
          const members = (clanData as any).members ?? [];
          const memberDocs = await Promise.all(
            members
              .slice(0, 20)
              .map((uid: string) =>
                getDoc(doc(db, "users", uid)).catch(() => null),
              ),
          );
          (clanData as any).memberDetails = memberDocs
            .filter(Boolean)
            .filter((d: any) => d.exists())
            .map((d: any) => ({ uid: d.id, ...d.data() }));
          setUserClan(clanData);
        }
      } else {
        // Load all clans
        const q = query(
          collection(db, "clans"),
          orderBy("createdAt", "desc"),
          limit(20),
        );
        const snap = await getDocs(q);
        setAllClans(snap.docs.map((d: any) => ({ id: d.id, ...d.data() })));
      }
    } catch (_) {}
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadClans();
  }, [loadClans]);

  // Clan chat listener
  useEffect(() => {
    if (!user?.clanId) return;
    let unsub: (() => void) | null = null;
    const setup = async () => {
      await initFirebase();
      const q = query(
        collection(db, "clanChat"),
        where("clanId", "==", user.clanId),
        orderBy("timestamp", "asc"),
        limit(100),
      );
      unsub = onSnapshot(q, (snap: any) => {
        setClanChat(snap.docs.map((d: any) => ({ id: d.id, ...d.data() })));
        setTimeout(
          () => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }),
          50,
        );
      });
    };
    setup();
    return () => {
      if (unsub) unsub();
    };
  }, [user?.clanId]);

  const createClan = async () => {
    if (!newClanName.trim() || creating) return;
    setCreating(true);
    try {
      const clanId = `clan_${Date.now()}`;
      await setDoc(doc(db, "clans", clanId), {
        name: newClanName.trim(),
        leader: user?.uid,
        members: [user?.uid],
        createdAt: new Date(),
        wins: 0,
      });
      await updateDoc(doc(db, "users", user?.uid), { clanId });
      // Update local user state by reloading
      await loadClans();
    } catch (_) {}
    setCreating(false);
  };

  const joinClan = async (clanId: string) => {
    try {
      const ref = doc(db, "clans", clanId);
      const snap = await getDoc(ref);
      if (!snap.exists()) return;
      const data = snap.data();
      const members = data.members ?? [];
      if (members.includes(user?.uid)) return;
      await updateDoc(ref, { members: [...members, user?.uid] });
      await updateDoc(doc(db, "users", user?.uid), { clanId });
      await loadClans();
    } catch (_) {}
  };

  const leaveClan = async () => {
    if (!userClan) return;
    try {
      const ref = doc(db, "clans", userClan.id);
      const snap = await getDoc(ref);
      if (!snap.exists()) return;
      const members = (snap.data().members ?? []).filter(
        (m: string) => m !== user?.uid,
      );
      if (members.length === 0) {
        await deleteDoc(ref);
      } else {
        const newLeader =
          snap.data().leader === user?.uid ? members[0] : snap.data().leader;
        await updateDoc(ref, { members, leader: newLeader });
      }
      await updateDoc(doc(db, "users", user?.uid), { clanId: null });
      setUserClan(null);
      setShowLeaveConfirm(false);
      await loadClans();
    } catch (_) {}
  };

  const sendClanMsg = async () => {
    const text = chatInput.trim();
    if (!text || !user?.clanId) return;
    try {
      await addDoc(collection(db, "clanChat"), {
        text,
        uid: user?.uid ?? "unknown",
        displayName: user?.displayName ?? "Player",
        clanId: user.clanId,
        timestamp: new Date(),
      });
      setChatInput("");
    } catch (_) {}
  };

  if (loading) {
    return (
      <motion.div
        className="main-content"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div style={{ display: "flex", gap: 8, flexDirection: "column" }}>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                height: 72,
                borderRadius: 12,
                background: "rgba(255,255,255,0.04)",
                animation: "livePulse 1.5s infinite",
              }}
            />
          ))}
        </div>
      </motion.div>
    );
  }

  // User is IN a clan
  if (userClan) {
    const isLeader = userClan.leader === user?.uid;
    return (
      <motion.div
        className="main-content"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Leave Confirm Modal */}
        <AnimatePresence>
          {showLeaveConfirm && (
            <motion.div
              className="modal-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLeaveConfirm(false)}
            >
              <motion.div
                className="modal-sheet"
                initial={{ y: 60 }}
                animate={{ y: 0 }}
                exit={{ y: 60 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="modal-handle" />
                <div className="modal-title">Leave Clan?</div>
                <div
                  style={{
                    textAlign: "center",
                    color: "rgba(255,255,255,0.6)",
                    fontFamily: "Rajdhani, sans-serif",
                    fontSize: "0.9rem",
                    marginBottom: 20,
                  }}
                >
                  {isLeader && (userClan.members?.length ?? 0) > 1
                    ? "As leader, leaving will transfer leadership to another member."
                    : "Are you sure you want to leave this clan?"}
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    type="button"
                    className="fire-btn fire-btn-secondary"
                    style={{ flex: 1 }}
                    onClick={() => setShowLeaveConfirm(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="fire-btn fire-btn-danger"
                    style={{ flex: 1 }}
                    onClick={leaveClan}
                    data-ocid="clan.leave.confirm.button"
                  >
                    Leave
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Clan Header */}
        <div
          style={{
            background:
              "linear-gradient(135deg, rgba(255,107,0,0.1), rgba(10,10,26,0.7))",
            border: "1px solid rgba(255,107,0,0.3)",
            borderRadius: 16,
            padding: "16px",
            marginBottom: 14,
          }}
        >
          <div className="flex-between" style={{ marginBottom: 8 }}>
            <div>
              <div
                style={{
                  fontFamily: "Orbitron, sans-serif",
                  fontSize: "1rem",
                  fontWeight: 700,
                  color: "#fff",
                  marginBottom: 4,
                }}
              >
                🛡️ {userClan.name}
              </div>
              <div
                style={{
                  fontSize: "0.72rem",
                  color: "rgba(255,255,255,0.4)",
                  fontFamily: "Rajdhani, sans-serif",
                }}
              >
                {(userClan.members ?? []).length} members · {userClan.wins ?? 0}{" "}
                wins
              </div>
            </div>
            {isLeader && (
              <span
                style={{
                  fontSize: "0.65rem",
                  padding: "3px 10px",
                  borderRadius: 20,
                  background: "rgba(255,215,0,0.15)",
                  color: "#ffd700",
                  border: "1px solid rgba(255,215,0,0.4)",
                  fontWeight: 700,
                  fontFamily: "Rajdhani, sans-serif",
                }}
              >
                👑 LEADER
              </span>
            )}
          </div>
          <button
            type="button"
            className="fire-btn fire-btn-danger"
            style={{ width: "auto", padding: "8px 16px", fontSize: "0.72rem" }}
            onClick={() => setShowLeaveConfirm(true)}
            data-ocid="clan.leave.button"
          >
            Leave Clan
          </button>
        </div>

        {/* Members */}
        <div className="section-label" style={{ marginBottom: 10 }}>
          👥 Members
        </div>
        <div style={{ marginBottom: 14 }}>
          {(userClan.memberDetails ?? []).map((m: any) => (
            <div
              key={m.uid}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 14px",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,107,0,0.15)",
                borderRadius: 12,
                marginBottom: 6,
              }}
              data-ocid="clan.member.row"
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #ff6b00, #cc5500)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "Orbitron, sans-serif",
                  fontWeight: 700,
                  color: "white",
                  fontSize: "0.8rem",
                  flexShrink: 0,
                }}
              >
                {(m.displayName ?? m.uid).charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontFamily: "Rajdhani, sans-serif",
                    fontSize: "0.9rem",
                    fontWeight: 600,
                    color: "white",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {m.displayName ?? m.uid}
                  {m.uid === userClan.leader && (
                    <span style={{ fontSize: "0.6rem", color: "#ffd700" }}>
                      👑
                    </span>
                  )}
                </div>
                <div
                  style={{
                    fontSize: "0.7rem",
                    color: "rgba(255,255,255,0.35)",
                    fontFamily: "Rajdhani, sans-serif",
                  }}
                >
                  {m.wins ?? 0} wins · {m.kills ?? 0} kills
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Clan Chat */}
        <div className="section-label" style={{ marginBottom: 10 }}>
          💬 Clan Chat
        </div>
        <div
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,107,0,0.15)",
            borderRadius: 14,
            padding: 14,
            marginBottom: 14,
          }}
        >
          <div style={{ height: 200, overflowY: "auto", marginBottom: 10 }}>
            {clanChat.length === 0 ? (
              <div className="empty-state" style={{ padding: "20px 0" }}>
                <div style={{ fontSize: "1.5rem" }}>💬</div>
                <div
                  className="empty-state-text"
                  style={{ fontSize: "0.8rem" }}
                >
                  No messages yet. Start the conversation!
                </div>
              </div>
            ) : (
              clanChat.map((msg) => {
                const isMe = msg.uid === user?.uid;
                return (
                  <div
                    key={msg.id}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: isMe ? "flex-end" : "flex-start",
                      marginBottom: 8,
                    }}
                  >
                    {!isMe && (
                      <div
                        style={{
                          fontSize: "0.65rem",
                          color: "#ff9a00",
                          fontFamily: "Orbitron, sans-serif",
                          marginBottom: 2,
                          paddingLeft: 4,
                        }}
                      >
                        {msg.displayName}
                      </div>
                    )}
                    <div
                      style={{
                        maxWidth: "78%",
                        background: isMe
                          ? "rgba(255,107,0,0.2)"
                          : "rgba(255,255,255,0.06)",
                        border: `1px solid ${isMe ? "rgba(255,107,0,0.3)" : "rgba(255,255,255,0.08)"}`,
                        borderRadius: isMe
                          ? "12px 12px 4px 12px"
                          : "12px 12px 12px 4px",
                        padding: "7px 11px",
                        fontFamily: "Rajdhani, sans-serif",
                        fontSize: "0.85rem",
                        color: "white",
                      }}
                    >
                      {msg.text}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={chatEndRef} />
          </div>
          <div className="chat-input-row">
            <input
              className="fire-input"
              style={{ flex: 1, marginBottom: 0, padding: "9px 12px" }}
              placeholder="Message your clan..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendClanMsg()}
              data-ocid="clan.chat.input"
            />
            <button
              type="button"
              className="fire-btn"
              onClick={sendClanMsg}
              style={{ width: "auto", padding: "9px 16px", marginBottom: 0 }}
              data-ocid="clan.chat.send.button"
            >
              ➤
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  // User NOT in a clan
  return (
    <motion.div
      className="main-content"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            fontFamily: "Orbitron, sans-serif",
            fontSize: "0.95rem",
            fontWeight: 700,
            color: "#fff",
            marginBottom: 4,
          }}
        >
          🛡️ Clans
        </div>
        <div
          style={{
            fontSize: "0.75rem",
            color: "rgba(255,255,255,0.4)",
            fontFamily: "Rajdhani, sans-serif",
          }}
        >
          Join or create a clan to team up
        </div>
      </div>

      {/* Create Clan */}
      <div
        style={{
          background:
            "linear-gradient(135deg, rgba(255,107,0,0.08), rgba(10,10,26,0.6))",
          border: "1px solid rgba(255,107,0,0.25)",
          borderRadius: 14,
          padding: "14px",
          marginBottom: 16,
        }}
      >
        <div className="section-label" style={{ marginBottom: 10 }}>
          ⚔️ Create a Clan
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            className="fire-input"
            style={{ flex: 1, marginBottom: 0 }}
            placeholder="Clan name..."
            value={newClanName}
            onChange={(e) => setNewClanName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createClan()}
            data-ocid="clan.create.name.input"
          />
          <button
            type="button"
            className="fire-btn"
            onClick={createClan}
            disabled={creating || !newClanName.trim()}
            style={{ width: "auto", padding: "12px 20px" }}
            data-ocid="clan.create.button"
          >
            {creating ? "..." : "Create"}
          </button>
        </div>
      </div>

      {/* Browse Clans */}
      <div className="section-label" style={{ marginBottom: 10 }}>
        🔍 Browse Clans
      </div>
      {allClans.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🛡️</div>
          <div className="empty-state-text">
            No clans yet. Be the first to create one!
          </div>
        </div>
      ) : (
        allClans.map((clan) => (
          <div
            key={clan.id}
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,107,0,0.18)",
              borderRadius: 14,
              padding: "12px 14px",
              marginBottom: 8,
            }}
            data-ocid="clan.browse.row"
          >
            <div className="flex-between">
              <div>
                <div
                  style={{
                    fontFamily: "Rajdhani, sans-serif",
                    fontSize: "0.95rem",
                    fontWeight: 600,
                    color: "white",
                  }}
                >
                  🛡️ {clan.name}
                </div>
                <div
                  style={{
                    fontSize: "0.72rem",
                    color: "rgba(255,255,255,0.35)",
                    fontFamily: "Rajdhani, sans-serif",
                    marginTop: 2,
                  }}
                >
                  {(clan.members ?? []).length} members · Leader: {clan.leader}
                </div>
              </div>
              <button
                type="button"
                className="fire-btn"
                style={{
                  width: "auto",
                  padding: "8px 16px",
                  fontSize: "0.72rem",
                }}
                onClick={() => joinClan(clan.id)}
                data-ocid="clan.join.button"
              >
                Join
              </button>
            </div>
          </div>
        ))
      )}
    </motion.div>
  );
}
