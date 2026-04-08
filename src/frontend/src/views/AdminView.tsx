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
  updateDoc,
} from "../firebase";

interface AdminViewProps {
  onNavigate: (v: string) => void;
  logout: () => void;
  showToast: (msg: string, type?: "success" | "error") => void;
  setIsLoading: (v: boolean) => void;
  broadcastMessages: any[];
}

export default function AdminView({
  onNavigate: _onNavigate,
  logout,
  showToast,
  setIsLoading: _setIsLoading,
  broadcastMessages,
}: AdminViewProps) {
  const [activeTab, setActiveTab] = useState("matches");
  const [matches, setMatches] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [expandedMatch, setExpandedMatch] = useState<string | null>(null);
  const [newMatch, setNewMatch] = useState({
    mode: "br-solo",
    modeName: "BR Solo",
    entryFee: "20",
    prizePool: "35",
    maxPlayers: "12",
    scheduledTime: "",
    customTitle: "",
    voiceLink: "",
  });
  const [announceText, setAnnounceText] = useState("");
  const [announceCategory, setAnnounceCategory] = useState("General");
  const [announceImageUrl, setAnnounceImageUrl] = useState("");
  const [announcePinned, setAnnouncePinned] = useState(false);
  const [revenue, setRevenue] = useState({
    totalCollected: 0,
    prizesPaid: 0,
    withdrawalsTotal: 0,
  });

  const MODES = [
    { id: "br-solo", name: "BR Solo" },
    { id: "br-duo", name: "BR Duo" },
    { id: "br-squad", name: "BR Squad" },
    { id: "clash", name: "Clash Squad" },
    { id: "1v1", name: "1v1 Match" },
    { id: "highstakes", name: "High Stakes" },
  ];

  useEffect(() => {
    if (!db) return;
    const unsub1 = onSnapshot(
      query(collection(db, "matches"), orderBy("createdAt", "desc")),
      (snap) => setMatches(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      () => {},
    );
    const unsub2 = onSnapshot(
      query(collection(db, "users"), orderBy("coins", "desc")),
      (snap) =>
        setUsers(
          snap.docs
            .filter((d) => d.id !== "admin")
            .map((d) => ({ id: d.id, ...d.data() })),
        ),
      () => {},
    );
    const unsub3 = onSnapshot(
      query(collection(db, "payments"), orderBy("timestamp", "desc")),
      (snap) => setPayments(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      () => {},
    );
    const unsub4 = onSnapshot(
      query(collection(db, "withdrawals"), orderBy("timestamp", "desc")),
      (snap) =>
        setWithdrawals(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      () => {},
    );
    return () => {
      unsub1();
      unsub2();
      unsub3();
      unsub4();
    };
  }, []);

  useEffect(() => {
    const totalDeposits = payments
      .filter((p) => p.status === "approved")
      .reduce((s, p) => s + (p.amount || 0), 0);
    const totalPrizes = matches.reduce((s, m) => s + (m.prizeAwarded || 0), 0);
    const totalWd = withdrawals
      .filter((w) => w.status === "approved")
      .reduce((s, w) => s + (w.final || 0), 0);
    setRevenue({
      totalCollected: totalDeposits,
      prizesPaid: totalPrizes,
      withdrawalsTotal: totalWd,
    });
  }, [payments, matches, withdrawals]);

  const handleCreateMatch = async () => {
    if (!newMatch.entryFee || !newMatch.prizePool) {
      showToast("Fill entry fee and prize pool", "error");
      return;
    }
    try {
      await addDoc(collection(db, "matches"), {
        mode: newMatch.mode,
        modeName: newMatch.modeName,
        entryFee: Number(newMatch.entryFee),
        prizePool: Number(newMatch.prizePool),
        maxPlayers: Number(newMatch.maxPlayers) || 12,
        scheduledTime: newMatch.scheduledTime,
        customTitle: newMatch.customTitle,
        voiceLink: newMatch.voiceLink,
        joinedPlayers: [],
        teamA: [],
        teamB: [],
        status: "open",
        isVisible: true,
        createdAt: Date.now(),
      });
      showToast("Match created! ✅", "success");
      setNewMatch({
        mode: "br-solo",
        modeName: "BR Solo",
        entryFee: "20",
        prizePool: "35",
        maxPlayers: "12",
        scheduledTime: "",
        customTitle: "",
        voiceLink: "",
      });
    } catch (_) {
      showToast("Failed to create match", "error");
    }
  };

  const handleAssignRoom = async (
    matchId: string,
    roomId: string,
    roomPass: string,
  ) => {
    if (!roomId) {
      showToast("Enter Room ID", "error");
      return;
    }
    try {
      await updateDoc(doc(db, "matches", matchId), {
        roomId,
        roomPass,
        status: "active",
      });
      showToast("Room ID assigned! ✅", "success");
    } catch (_) {
      showToast("Failed", "error");
    }
  };

  const handleDeclareWinner = async (
    matchId: string,
    winnerUid: string,
    match: any,
  ) => {
    if (!winnerUid) {
      showToast("Select winner", "error");
      return;
    }
    try {
      const adminCommission = Math.ceil(match.prizePool * 0.1);
      const winnerPrize = match.prizePool - adminCommission;
      const walletRef = doc(db, "wallet", winnerUid);
      const walletSnap = await getDoc(walletRef);
      const currentCoins = walletSnap.exists()
        ? walletSnap.data().coins || 0
        : 0;
      await Promise.all([
        setDoc(walletRef, { coins: currentCoins + winnerPrize }),
        updateDoc(doc(db, "matches", matchId), {
          winner: winnerUid,
          prizeAwarded: winnerPrize,
          status: "completed",
        }),
        addDoc(collection(db, "transactions"), {
          uid: winnerUid,
          type: "prize",
          amount: winnerPrize,
          matchId,
          timestamp: new Date(),
        }),
        addDoc(collection(db, "notifications"), {
          uid: winnerUid,
          title: "🏆 You Won!",
          message: `Congratulations! You won ₹${winnerPrize} in the match.`,
          read: false,
          timestamp: new Date(),
        }),
        addDoc(collection(db, "activity"), {
          text: `${winnerUid} won ₹${winnerPrize} in ${match.modeName}!`,
          type: "win",
          timestamp: new Date(),
        }),
      ]);
      showToast(
        `Winner declared! ₹${winnerPrize} credited. Profit: ₹${adminCommission}`,
        "success",
      );
    } catch (_) {
      showToast("Failed", "error");
    }
  };

  const handleApprovePayment = async (
    paymentId: string,
    userId: string,
    amount: number,
  ) => {
    try {
      const walletRef = doc(db, "wallet", userId);
      const walletSnap = await getDoc(walletRef);
      const currentCoins = walletSnap.exists()
        ? walletSnap.data().coins || 0
        : 0;
      await Promise.all([
        setDoc(walletRef, { coins: currentCoins + amount }),
        updateDoc(doc(db, "payments", paymentId), { status: "approved" }),
        addDoc(collection(db, "transactions"), {
          uid: userId,
          type: "deposit",
          amount,
          timestamp: new Date(),
        }),
        addDoc(collection(db, "notifications"), {
          uid: userId,
          title: "💰 Deposit Approved!",
          message: `₹${amount} added to wallet.`,
          read: false,
          timestamp: new Date(),
        }),
      ]);
      showToast(`₹${amount} approved for ${userId}`, "success");
    } catch (_) {
      showToast("Failed", "error");
    }
  };

  const handleApproveWithdrawal = async (
    withdrawalId: string,
    userId: string,
    amount: number,
  ) => {
    try {
      const walletRef = doc(db, "wallet", userId);
      const walletSnap = await getDoc(walletRef);
      const currentCoins = walletSnap.exists()
        ? walletSnap.data().coins || 0
        : 0;
      if (currentCoins < amount) {
        showToast("Insufficient user balance!", "error");
        return;
      }
      await Promise.all([
        setDoc(walletRef, { coins: currentCoins - amount }),
        updateDoc(doc(db, "withdrawals", withdrawalId), { status: "approved" }),
        addDoc(collection(db, "transactions"), {
          uid: userId,
          type: "withdrawal",
          amount: -amount,
          timestamp: new Date(),
        }),
        addDoc(collection(db, "notifications"), {
          uid: userId,
          title: "💸 Withdrawal Approved!",
          message: `₹${amount} withdrawal processed.`,
          read: false,
          timestamp: new Date(),
        }),
      ]);
      showToast(`Withdrawal approved for ${userId}`, "success");
    } catch (_) {
      showToast("Failed", "error");
    }
  };

  const handleBanUser = async (uid: string, ban: boolean) => {
    try {
      await updateDoc(doc(db, "users", uid), {
        blocked: ban,
        banReason: ban ? "Banned by admin" : "",
      });
      showToast(ban ? `${uid} banned` : `${uid} unbanned`, "success");
    } catch (_) {
      showToast("Failed", "error");
    }
  };

  const handleSendAnnouncement = async () => {
    if (!announceText.trim()) {
      showToast("Enter message", "error");
      return;
    }
    try {
      await addDoc(collection(db, "messages"), {
        text: announceText.trim(),
        category: announceCategory,
        imageUrl: announceImageUrl.trim() || null,
        pinned: announcePinned,
        senderName: "Admin",
        timestamp: new Date(),
        sentAt: Date.now(),
      });
      setAnnounceText("");
      setAnnounceImageUrl("");
      setAnnouncePinned(false);
      showToast("Announcement sent! ✅", "success");
    } catch (_) {
      showToast("Failed", "error");
    }
  };

  const handleDirectMessage = async (uid: string, message: string) => {
    if (!message.trim()) return;
    try {
      await addDoc(collection(db, "notifications"), {
        uid,
        title: "📩 Message from Admin",
        message: message.trim(),
        read: false,
        timestamp: new Date(),
      });
      showToast(`Message sent to ${uid}`, "success");
    } catch (_) {
      showToast("Failed", "error");
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      !searchQuery ||
      u.id.includes(searchQuery) ||
      (u.displayName || "").toLowerCase().includes(searchQuery.toLowerCase()),
  );
  const adminTabs = [
    { id: "matches", label: "🎮 Matches" },
    { id: "players", label: "👥 Players" },
    { id: "revenue", label: "💰 Revenue" },
    { id: "announce", label: "📢 Announce" },
    { id: "wallets", label: "💳 Wallets" },
  ];

  return (
    <div className="admin-panel">
      <div className="admin-header">
        <div className="admin-title">🔐 ADMIN PANEL</div>
        <button
          type="button"
          onClick={logout}
          style={{
            padding: "6px 12px",
            background: "rgba(239,68,68,0.15)",
            border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: 8,
            color: "#ef4444",
            fontFamily: "Rajdhani, sans-serif",
            fontSize: "0.8rem",
            cursor: "pointer",
          }}
        >
          Logout
        </button>
      </div>

      <div className="admin-nav">
        {adminTabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`admin-tab ${activeTab === t.id ? "active" : ""}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="admin-content" style={{ paddingBottom: 80 }}>
        {activeTab === "matches" && (
          <div>
            <div
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,107,0,0.2)",
                borderRadius: 14,
                padding: 16,
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  fontFamily: "Orbitron, sans-serif",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  color: "#fff",
                  marginBottom: 12,
                }}
              >
                ➕ Create Match
              </div>
              <select
                className="admin-select"
                value={newMatch.mode}
                onChange={(e) => {
                  const m = MODES.find((md) => md.id === e.target.value);
                  setNewMatch({
                    ...newMatch,
                    mode: e.target.value,
                    modeName: m?.name ?? e.target.value,
                  });
                }}
              >
                {MODES.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
              <input
                className="admin-input"
                placeholder="Custom title (optional)"
                value={newMatch.customTitle}
                onChange={(e) =>
                  setNewMatch({ ...newMatch, customTitle: e.target.value })
                }
              />
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 8,
                }}
              >
                <input
                  className="admin-input"
                  type="number"
                  placeholder="Entry Fee (₹)"
                  value={newMatch.entryFee}
                  onChange={(e) =>
                    setNewMatch({ ...newMatch, entryFee: e.target.value })
                  }
                  style={{ marginBottom: 0 }}
                />
                <input
                  className="admin-input"
                  type="number"
                  placeholder="Prize Pool (₹)"
                  value={newMatch.prizePool}
                  onChange={(e) =>
                    setNewMatch({ ...newMatch, prizePool: e.target.value })
                  }
                  style={{ marginBottom: 0 }}
                />
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 8,
                  marginTop: 8,
                }}
              >
                <input
                  className="admin-input"
                  type="number"
                  placeholder="Max Players"
                  value={newMatch.maxPlayers}
                  onChange={(e) =>
                    setNewMatch({ ...newMatch, maxPlayers: e.target.value })
                  }
                  style={{ marginBottom: 0 }}
                />
                <input
                  className="admin-input"
                  placeholder="Time (e.g. 5:00 PM)"
                  value={newMatch.scheduledTime}
                  onChange={(e) =>
                    setNewMatch({ ...newMatch, scheduledTime: e.target.value })
                  }
                  style={{ marginBottom: 0 }}
                />
              </div>
              <input
                className="admin-input"
                style={{ marginTop: 8 }}
                placeholder="Voice channel link (optional)"
                value={newMatch.voiceLink}
                onChange={(e) =>
                  setNewMatch({ ...newMatch, voiceLink: e.target.value })
                }
              />
              <button
                type="button"
                onClick={handleCreateMatch}
                className="fire-btn"
                style={{ marginTop: 8 }}
              >
                CREATE MATCH ⚡
              </button>
            </div>

            <div
              style={{
                fontFamily: "Orbitron, sans-serif",
                fontSize: "0.8rem",
                color: "#fff",
                marginBottom: 10,
              }}
            >
              Active Matches (
              {matches.filter((m) => m.status !== "completed").length})
            </div>
            {matches.map((match) => {
              const isExpanded = expandedMatch === match.id;
              const players = [
                ...(match.joinedPlayers ?? []),
                ...(match.teamA ?? []),
                ...(match.teamB ?? []),
              ].filter((v, i, a) => a.indexOf(v) === i);
              return (
                <div key={match.id} className="match-admin-card">
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
                          fontFamily: "Orbitron, sans-serif",
                          fontSize: "0.8rem",
                          fontWeight: 700,
                          color: "#fff",
                        }}
                      >
                        {match.customTitle || match.modeName}{" "}
                        <span className={`status-badge status-${match.status}`}>
                          {match.status}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: "0.72rem",
                          color: "rgba(255,255,255,0.5)",
                          fontFamily: "Rajdhani, sans-serif",
                          marginTop: 2,
                        }}
                      >
                        Entry: ₹{match.entryFee} | Prize: ₹{match.prizePool} |
                        Players: {players.length}/{match.maxPlayers}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedMatch(isExpanded ? null : match.id)
                      }
                      style={{
                        padding: "4px 10px",
                        background: "rgba(255,107,0,0.1)",
                        border: "1px solid rgba(255,107,0,0.25)",
                        borderRadius: 6,
                        color: "#fff",
                        fontSize: "0.7rem",
                        cursor: "pointer",
                      }}
                    >
                      {isExpanded ? "Close" : "Manage"}
                    </button>
                  </div>
                  {players.length > 0 && (
                    <div
                      style={{
                        display: "flex",
                        gap: 6,
                        flexWrap: "wrap",
                        marginBottom: 8,
                      }}
                    >
                      {players.map((p: string, pi: number) => (
                        <span
                          key={`${match.id}-${p}`}
                          style={{
                            fontSize: "0.65rem",
                            background:
                              pi === 0
                                ? "rgba(255,107,0,0.25)"
                                : "rgba(255,255,255,0.08)",
                            border: `1px solid ${pi === 0 ? "rgba(255,107,0,0.5)" : "rgba(255,255,255,0.15)"}`,
                            borderRadius: 20,
                            padding: "2px 8px",
                            color:
                              pi === 0 ? "#ff9a00" : "rgba(255,255,255,0.8)",
                            fontFamily: "Rajdhani, sans-serif",
                          }}
                        >
                          {pi + 1}. {p}
                        </span>
                      ))}
                    </div>
                  )}
                  {isExpanded && (
                    <MatchManagePanel
                      match={match}
                      players={players}
                      onAssignRoom={handleAssignRoom}
                      onDeclareWinner={handleDeclareWinner}
                      showToast={showToast}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {activeTab === "players" && (
          <div>
            <input
              className="admin-input"
              placeholder="🔍 Search by UID or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-ocid="admin.player_search.input"
            />
            {filteredUsers.map((user) => {
              const isExpanded = expandedUser === user.id;
              return (
                <button
                  type="button"
                  key={user.id}
                  className="user-admin-card"
                  onClick={() => setExpandedUser(isExpanded ? null : user.id)}
                  style={{ width: "100%", textAlign: "left" }}
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
                          fontFamily: "Rajdhani, sans-serif",
                          fontSize: "0.9rem",
                          fontWeight: 600,
                          color: "#fff",
                        }}
                      >
                        {user.displayName}{" "}
                        <span
                          style={{
                            color: "rgba(255,255,255,0.4)",
                            fontSize: "0.75rem",
                          }}
                        >
                          @{user.id}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: "0.72rem",
                          color: "rgba(255,255,255,0.5)",
                          marginTop: 2,
                        }}
                      >
                        🪙 {user.coins} · 🏆 {user.wins} wins · 🎮{" "}
                        {user.matchesPlayed} matches
                      </div>
                    </div>
                    <span
                      className={`status-badge ${user.blocked ? "status-rejected" : "status-approved"}`}
                    >
                      {user.blocked ? "BANNED" : "ACTIVE"}
                    </span>
                  </div>
                  {isExpanded && (
                    <AdminUserPanel
                      user={user}
                      onBan={handleBanUser}
                      onMessage={handleDirectMessage}
                      showToast={showToast}
                    />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {activeTab === "revenue" && (
          <div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
                marginBottom: 16,
              }}
            >
              {[
                {
                  label: "Total Collected",
                  value: `₹${revenue.totalCollected}`,
                  color: "#3b82f6",
                  icon: "💰",
                },
                {
                  label: "Prizes Paid",
                  value: `₹${revenue.prizesPaid}`,
                  color: "#f59e0b",
                  icon: "🏆",
                },
                {
                  label: "Withdrawals",
                  value: `₹${revenue.withdrawalsTotal}`,
                  color: "#ef4444",
                  icon: "💸",
                },
                {
                  label: "Net Profit",
                  value: `₹${revenue.totalCollected - revenue.prizesPaid - revenue.withdrawalsTotal}`,
                  color: "#22c55e",
                  icon: "📈",
                },
              ].map((s) => (
                <div
                  key={s.label}
                  style={{
                    background: `${s.color}11`,
                    border: `1px solid ${s.color}33`,
                    borderRadius: 12,
                    padding: "14px 12px",
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: "1.4rem", marginBottom: 4 }}>
                    {s.icon}
                  </div>
                  <div
                    style={{
                      fontFamily: "Orbitron, sans-serif",
                      fontWeight: 700,
                      fontSize: "1rem",
                      color: s.color,
                    }}
                  >
                    {s.value}
                  </div>
                  <div
                    style={{
                      fontSize: "0.65rem",
                      color: "rgba(255,255,255,0.4)",
                      fontFamily: "Rajdhani, sans-serif",
                      textTransform: "uppercase",
                      marginTop: 2,
                    }}
                  >
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
            <div
              style={{
                background: "rgba(34,197,94,0.05)",
                border: "1px solid rgba(34,197,94,0.2)",
                borderRadius: 12,
                padding: "12px 14px",
                marginBottom: 16,
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontFamily: "Orbitron, sans-serif",
                  fontSize: "0.8rem",
                  color: "#22c55e",
                  marginBottom: 4,
                }}
              >
                Admin Profit ✅ (Always Green)
              </div>
              <div
                style={{
                  fontFamily: "Orbitron, sans-serif",
                  fontWeight: 900,
                  fontSize: "1.5rem",
                  color: "#22c55e",
                }}
              >
                ₹
                {Math.max(
                  0,
                  revenue.totalCollected -
                    revenue.prizesPaid -
                    revenue.withdrawalsTotal,
                )}
              </div>
              <div
                style={{
                  fontSize: "0.7rem",
                  color: "rgba(255,255,255,0.4)",
                  fontFamily: "Rajdhani, sans-serif",
                  marginTop: 4,
                }}
              >
                10% commission auto-deducted from every prize
              </div>
            </div>
            <div
              style={{
                fontFamily: "Orbitron, sans-serif",
                fontSize: "0.8rem",
                color: "#fff",
                marginBottom: 10,
              }}
            >
              Pending Deposits
            </div>
            {payments
              .filter((p) => p.status === "pending")
              .map((payment) => (
                <div
                  key={payment.id}
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(234,179,8,0.25)",
                    borderRadius: 10,
                    padding: "12px 14px",
                    marginBottom: 8,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontFamily: "Rajdhani, sans-serif",
                        fontWeight: 600,
                        color: "#fff",
                        fontSize: "0.85rem",
                      }}
                    >
                      @{payment.user} — ₹{payment.amount}
                    </div>
                    <div
                      style={{
                        fontSize: "0.7rem",
                        color: "rgba(255,255,255,0.4)",
                      }}
                    >
                      UTR: {payment.utr}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      type="button"
                      onClick={() =>
                        handleApprovePayment(
                          payment.id,
                          payment.user,
                          payment.amount,
                        )
                      }
                      data-ocid="admin.approve_deposit.button"
                      style={{
                        padding: "5px 12px",
                        background: "rgba(34,197,94,0.15)",
                        border: "1px solid rgba(34,197,94,0.4)",
                        borderRadius: 6,
                        color: "#22c55e",
                        fontSize: "0.72rem",
                        cursor: "pointer",
                      }}
                    >
                      ✓ Approve
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateDoc(doc(db, "payments", payment.id), {
                          status: "rejected",
                        })
                      }
                      style={{
                        padding: "5px 12px",
                        background: "rgba(239,68,68,0.1)",
                        border: "1px solid rgba(239,68,68,0.3)",
                        borderRadius: 6,
                        color: "#ef4444",
                        fontSize: "0.72rem",
                        cursor: "pointer",
                      }}
                    >
                      ✗ Reject
                    </button>
                  </div>
                </div>
              ))}
            <div
              style={{
                fontFamily: "Orbitron, sans-serif",
                fontSize: "0.8rem",
                color: "#fff",
                marginBottom: 10,
                marginTop: 16,
              }}
            >
              Pending Withdrawals
            </div>
            {withdrawals
              .filter((w) => w.status === "pending")
              .map((w) => (
                <div
                  key={w.id}
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(239,68,68,0.2)",
                    borderRadius: 10,
                    padding: "12px 14px",
                    marginBottom: 8,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontFamily: "Rajdhani, sans-serif",
                        fontWeight: 600,
                        color: "#fff",
                        fontSize: "0.85rem",
                      }}
                    >
                      @{w.user} — ₹{w.amount} (net: ₹{w.final})
                    </div>
                    <div
                      style={{
                        fontSize: "0.7rem",
                        color: "rgba(255,255,255,0.4)",
                      }}
                    >
                      UPI: {w.upiId}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      handleApproveWithdrawal(w.id, w.user, w.amount)
                    }
                    data-ocid="admin.approve_withdrawal.button"
                    style={{
                      padding: "5px 12px",
                      background: "rgba(34,197,94,0.15)",
                      border: "1px solid rgba(34,197,94,0.4)",
                      borderRadius: 6,
                      color: "#22c55e",
                      fontSize: "0.72rem",
                      cursor: "pointer",
                    }}
                  >
                    ✓ Pay
                  </button>
                </div>
              ))}
          </div>
        )}

        {activeTab === "announce" && (
          <div>
            <div
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,107,0,0.2)",
                borderRadius: 14,
                padding: 16,
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  fontFamily: "Orbitron, sans-serif",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  color: "#fff",
                  marginBottom: 12,
                }}
              >
                📢 Send Announcement
              </div>
              <select
                className="admin-select"
                value={announceCategory}
                onChange={(e) => setAnnounceCategory(e.target.value)}
              >
                {["General", "Match Info", "Payment", "Alert"].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <textarea
                className="admin-input"
                placeholder="Message text..."
                value={announceText}
                onChange={(e) => setAnnounceText(e.target.value)}
                rows={3}
                style={{ resize: "none" }}
                data-ocid="admin.announce_text.input"
              />
              <input
                className="admin-input"
                placeholder="Image URL (optional)"
                value={announceImageUrl}
                onChange={(e) => setAnnounceImageUrl(e.target.value)}
              />
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontFamily: "Rajdhani, sans-serif",
                  fontSize: "0.82rem",
                  color: "rgba(255,255,255,0.7)",
                  cursor: "pointer",
                  marginBottom: 10,
                }}
              >
                <input
                  type="checkbox"
                  checked={announcePinned}
                  onChange={(e) => setAnnouncePinned(e.target.checked)}
                />
                Pin this announcement
              </label>
              <button
                type="button"
                onClick={handleSendAnnouncement}
                className="fire-btn"
                data-ocid="admin.announce_send.button"
              >
                📢 SEND TO ALL USERS
              </button>
            </div>
            <div
              style={{
                fontFamily: "Orbitron, sans-serif",
                fontSize: "0.8rem",
                color: "#fff",
                marginBottom: 10,
              }}
            >
              Recent ({broadcastMessages.length})
            </div>
            {broadcastMessages.slice(0, 5).map((msg) => (
              <div key={msg.id} className="announcement-card">
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
                      fontFamily: "Orbitron, sans-serif",
                      color: "#ff9a00",
                    }}
                  >
                    {msg.category}
                  </span>
                  {msg.pinned && (
                    <span className="badge" style={{ fontSize: "0.6rem" }}>
                      📌 PINNED
                    </span>
                  )}
                </div>
                <div
                  style={{
                    fontFamily: "Rajdhani, sans-serif",
                    fontSize: "0.85rem",
                    color: "rgba(255,255,255,0.8)",
                  }}
                >
                  {msg.text}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "wallets" && (
          <div>
            <div
              style={{
                background: "rgba(251,191,36,0.08)",
                border: "1px solid rgba(251,191,36,0.25)",
                borderRadius: 12,
                padding: "12px 14px",
                marginBottom: 16,
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontFamily: "Orbitron, sans-serif",
                  fontSize: "0.75rem",
                  color: "#fbbf24",
                  marginBottom: 4,
                }}
              >
                Total Coins in Circulation
              </div>
              <div
                style={{
                  fontFamily: "Orbitron, sans-serif",
                  fontWeight: 900,
                  fontSize: "1.5rem",
                  color: "#fbbf24",
                }}
              >
                🪙{" "}
                {users
                  .reduce((sum, u) => sum + (u.coins || 0), 0)
                  .toLocaleString()}
              </div>
            </div>
            {users.map((user) => (
              <div
                key={user.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 14px",
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 10,
                  marginBottom: 8,
                }}
              >
                <div>
                  <div
                    style={{
                      fontFamily: "Rajdhani, sans-serif",
                      fontWeight: 600,
                      fontSize: "0.85rem",
                      color: "#fff",
                    }}
                  >
                    {user.displayName}
                  </div>
                  <div
                    style={{
                      fontSize: "0.68rem",
                      color: "rgba(255,255,255,0.4)",
                    }}
                  >
                    @{user.id}
                  </div>
                </div>
                <div
                  style={{
                    fontFamily: "Orbitron, sans-serif",
                    fontWeight: 700,
                    fontSize: "0.9rem",
                    color: "#fbbf24",
                  }}
                >
                  🪙 {user.coins}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MatchManagePanel({
  match,
  players,
  onAssignRoom,
  onDeclareWinner,
  showToast: _showToast,
}: any) {
  const [roomId, setRoomId] = useState(match.roomId ?? "");
  const [roomPass, setRoomPass] = useState(match.roomPass ?? "");
  const [winner, setWinner] = useState("");

  return (
    <div
      style={{
        marginTop: 12,
        paddingTop: 12,
        borderTop: "1px solid rgba(255,107,0,0.15)",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 8,
          marginBottom: 10,
        }}
      >
        <input
          className="admin-input"
          placeholder="Room ID"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          style={{ marginBottom: 0 }}
        />
        <input
          className="admin-input"
          placeholder="Password"
          value={roomPass}
          onChange={(e) => setRoomPass(e.target.value)}
          style={{ marginBottom: 0 }}
        />
      </div>
      <button
        type="button"
        onClick={() => onAssignRoom(match.id, roomId, roomPass)}
        style={{
          width: "100%",
          padding: "9px",
          background: "rgba(255,107,0,0.15)",
          border: "1px solid rgba(255,107,0,0.35)",
          borderRadius: 8,
          color: "#fff",
          fontFamily: "Rajdhani, sans-serif",
          fontWeight: 700,
          cursor: "pointer",
          marginBottom: 12,
          fontSize: "0.82rem",
        }}
      >
        🏠 ASSIGN ROOM ID
      </button>
      {players.length > 0 && match.status !== "completed" && (
        <div>
          <div
            style={{
              fontFamily: "Orbitron, sans-serif",
              fontSize: "0.72rem",
              color: "rgba(255,255,255,0.5)",
              marginBottom: 6,
            }}
          >
            DECLARE WINNER
          </div>
          <select
            className="admin-select"
            value={winner}
            onChange={(e) => setWinner(e.target.value)}
            style={{ marginBottom: 8 }}
            data-ocid="admin.winner_select"
          >
            <option value="">-- Select Winner --</option>
            {players.map((p: string) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => onDeclareWinner(match.id, winner, match)}
            data-ocid="admin.declare_winner.button"
            style={{
              width: "100%",
              padding: "9px",
              background: "rgba(251,191,36,0.15)",
              border: "1px solid rgba(251,191,36,0.35)",
              borderRadius: 8,
              color: "#fbbf24",
              fontFamily: "Rajdhani, sans-serif",
              fontWeight: 700,
              cursor: "pointer",
              fontSize: "0.82rem",
            }}
          >
            🏆 DECLARE WINNER (One-Click)
          </button>
        </div>
      )}
    </div>
  );
}

function AdminUserPanel({
  user,
  onBan,
  onMessage,
  showToast: _showToast,
}: any) {
  const [dmMsg, setDmMsg] = useState("");
  return (
    <div
      style={{
        marginTop: 10,
        paddingTop: 10,
        borderTop: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 8,
          marginBottom: 10,
          fontSize: "0.72rem",
          color: "rgba(255,255,255,0.5)",
          fontFamily: "Rajdhani, sans-serif",
        }}
      >
        <div>
          📞 Phone:{" "}
          <span style={{ color: "#ff9a00" }}>{user.phone || "N/A"}</span>
        </div>
        <div>
          🎯 Kills: <span style={{ color: "#fff" }}>{user.kills ?? 0}</span>
        </div>
        <div>
          📅 Age:{" "}
          <span style={{ color: "#fff" }}>
            {user.createdAt
              ? `${Math.floor((Date.now() - user.createdAt) / 86400000)}d`
              : "?"}
          </span>
        </div>
        <div>
          🛡️ VIP: <span style={{ color: "#fff" }}>{user.vipTier || "None"}</span>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <button
          type="button"
          onClick={() => onBan(user.id, !user.blocked)}
          data-ocid="admin.ban.button"
          style={{
            flex: 1,
            padding: "7px",
            background: user.blocked
              ? "rgba(34,197,94,0.12)"
              : "rgba(239,68,68,0.12)",
            border: `1px solid ${user.blocked ? "rgba(34,197,94,0.4)" : "rgba(239,68,68,0.4)"}`,
            borderRadius: 6,
            color: user.blocked ? "#22c55e" : "#ef4444",
            fontFamily: "Rajdhani, sans-serif",
            fontSize: "0.75rem",
            cursor: "pointer",
            fontWeight: 700,
          }}
        >
          {user.blocked ? "✓ Unban" : "⛔ Ban"}
        </button>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          className="admin-input"
          placeholder="Send direct message..."
          value={dmMsg}
          onChange={(e) => setDmMsg(e.target.value)}
          style={{ flex: 1, marginBottom: 0, fontSize: "0.82rem" }}
          data-ocid="admin.dm.input"
        />
        <button
          type="button"
          onClick={() => {
            onMessage(user.id, dmMsg);
            setDmMsg("");
          }}
          style={{
            padding: "6px 12px",
            background: "rgba(255,107,0,0.15)",
            border: "1px solid rgba(255,107,0,0.3)",
            borderRadius: 6,
            color: "#ff9a00",
            fontSize: "0.75rem",
            cursor: "pointer",
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
