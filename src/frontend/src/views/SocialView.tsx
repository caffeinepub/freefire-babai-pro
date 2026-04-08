// @ts-nocheck
/* eslint-disable */
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import {
  addDoc,
  collection,
  db,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "../firebase";

interface UserData {
  uid: string;
  displayName: string;
  wins: number;
  kills: number;
  matchesPlayed: number;
  coins: number;
  clanId?: string;
}

interface SocialViewProps {
  currentUser: string;
  userData: UserData;
  onNavigate: (v: string) => void;
  showToast: (msg: string, type?: "success" | "error") => void;
}

export default function SocialView({
  currentUser,
  userData,
  onNavigate: _onNavigate,
  showToast,
}: SocialViewProps) {
  const [activeTab, setActiveTab] = useState("pvp");
  const [pvpChallenges, setPvpChallenges] = useState<any[]>([]);
  const [globalMessages, setGlobalMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [opponentUid, setOpponentUid] = useState("");
  const [betAmount, setBetAmount] = useState(10);
  const [friends, setFriends] = useState<any[]>([]);
  const [friendInput, setFriendInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  const tabs = [
    { id: "pvp", label: "⚔️ PvP" },
    { id: "friends", label: "👥 Friends" },
    { id: "global", label: "💬 Global" },
    { id: "clans", label: "🛡️ Clans" },
  ];

  useEffect(() => {
    if (!db) return;
    const q = query(
      collection(db, "challenges"),
      where("status", "in", ["pending", "accepted"]),
      orderBy("createdAt", "desc"),
    );
    const unsub = onSnapshot(
      q,
      (snap) =>
        setPvpChallenges(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      () => {},
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!db || activeTab !== "global") return;
    const q = query(collection(db, "globalChat"), orderBy("timestamp", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setGlobalMessages(
          snap.docs
            .slice(0, 50)
            .reverse()
            .map((d) => ({ id: d.id, ...d.data() })),
        );
        setTimeout(
          () => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }),
          100,
        );
      },
      () => {},
    );
    return () => unsub();
  }, [activeTab]);

  useEffect(() => {
    if (!db) return;
    const q = query(collection(db, "friends"), where("uid", "==", currentUser));
    const unsub = onSnapshot(
      q,
      (snap) => setFriends(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      () => {},
    );
    return () => unsub();
  }, [currentUser]);

  const handleSendChallenge = async () => {
    if (!opponentUid.trim()) {
      showToast("Enter opponent UID", "error");
      return;
    }
    if (opponentUid === currentUser) {
      showToast("Cannot challenge yourself!", "error");
      return;
    }
    if (userData.coins < betAmount) {
      showToast("Insufficient coins!", "error");
      return;
    }
    try {
      await addDoc(collection(db, "challenges"), {
        challenger: currentUser,
        opponent: opponentUid.trim(),
        amount: betAmount,
        status: "pending",
        createdAt: Date.now(),
        challengerName: userData.displayName,
      });
      setOpponentUid("");
      showToast("Challenge sent! ⚔️", "success");
    } catch (_) {
      showToast("Failed", "error");
    }
  };

  const handleAcceptChallenge = async (challengeId: string) => {
    try {
      await updateDoc(doc(db, "challenges", challengeId), {
        status: "accepted",
      });
      showToast("Challenge accepted!", "success");
    } catch (_) {
      showToast("Failed", "error");
    }
  };

  const handleRejectChallenge = async (challengeId: string) => {
    try {
      await updateDoc(doc(db, "challenges", challengeId), {
        status: "rejected",
      });
    } catch (_) {}
  };

  const handleSendGlobalMessage = async () => {
    if (!chatInput.trim()) return;
    if (chatInput.length > 200) {
      showToast("Message too long", "error");
      return;
    }
    try {
      await addDoc(collection(db, "globalChat"), {
        uid: currentUser,
        name: userData.displayName,
        text: chatInput.trim(),
        timestamp: serverTimestamp ? serverTimestamp() : new Date(),
      });
      setChatInput("");
    } catch (_) {
      showToast("Failed to send", "error");
    }
  };

  const handleAddFriend = async () => {
    if (!friendInput.trim() || friendInput === currentUser) {
      showToast("Invalid UID", "error");
      return;
    }
    try {
      const friendSnap = await getDoc(doc(db, "users", friendInput.trim()));
      if (!friendSnap.exists()) {
        showToast("User not found", "error");
        return;
      }
      await addDoc(collection(db, "friends"), {
        uid: currentUser,
        friendUid: friendInput.trim(),
        friendName: friendSnap.data().displayName,
        addedAt: Date.now(),
      });
      setFriendInput("");
      showToast("Friend added! 🤝", "success");
    } catch (_) {
      showToast("Failed", "error");
    }
  };

  const myPendingChallenges = pvpChallenges.filter(
    (c) => c.opponent === currentUser && c.status === "pending",
  );
  const myActiveChallenges = pvpChallenges.filter(
    (c) =>
      (c.challenger === currentUser || c.opponent === currentUser) &&
      c.status === "accepted",
  );
  const publicChallenges = pvpChallenges
    .filter(
      (c) =>
        c.challenger !== currentUser &&
        c.opponent !== currentUser &&
        c.status === "pending",
    )
    .slice(0, 5);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="main-content"
      data-ocid="social.section"
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
        ⚔️ SOCIAL
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

      {activeTab === "pvp" && (
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
              ⚔️ Send Challenge
            </div>
            <div className="field-group" style={{ marginBottom: 10 }}>
              <div className="field-label">Opponent UID</div>
              <input
                className="fire-input"
                placeholder="Enter opponent UID"
                value={opponentUid}
                onChange={(e) => setOpponentUid(e.target.value)}
                data-ocid="social.pvp_opponent.input"
              />
            </div>
            <div className="field-group" style={{ marginBottom: 12 }}>
              <div className="field-label">Bet Amount</div>
              <div style={{ display: "flex", gap: 8 }}>
                {[10, 20, 50].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setBetAmount(amt)}
                    style={{
                      flex: 1,
                      padding: "8px",
                      background:
                        betAmount === amt
                          ? "rgba(255,107,0,0.2)"
                          : "rgba(255,255,255,0.05)",
                      border: `1px solid ${betAmount === amt ? "#ff6b00" : "rgba(255,255,255,0.1)"}`,
                      borderRadius: 8,
                      color: "#fff",
                      fontFamily: "Orbitron, sans-serif",
                      fontSize: "0.75rem",
                      cursor: "pointer",
                    }}
                  >
                    {amt} 🪙
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={handleSendChallenge}
              className="fire-btn"
              data-ocid="social.pvp_challenge.button"
            >
              ⚔️ SEND CHALLENGE
            </button>
          </div>

          {myPendingChallenges.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div className="section-label" style={{ marginBottom: 8 }}>
                📬 Incoming Challenges
              </div>
              {myPendingChallenges.map((c) => (
                <div
                  key={c.id}
                  data-ocid="social.challenge_row"
                  style={{
                    background: "rgba(255,107,0,0.08)",
                    border: "1px solid rgba(255,107,0,0.3)",
                    borderRadius: 12,
                    padding: "12px 14px",
                    marginBottom: 10,
                  }}
                >
                  <div
                    style={{
                      fontFamily: "Rajdhani, sans-serif",
                      fontWeight: 600,
                      color: "#fff",
                      marginBottom: 8,
                    }}
                  >
                    {c.challengerName || c.challenger} challenged you for{" "}
                    <span style={{ color: "#fbbf24" }}>{c.amount} 🪙</span>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => handleAcceptChallenge(c.id)}
                      className="fire-btn fire-btn-success"
                      style={{ flex: 1, padding: "8px", fontSize: "0.78rem" }}
                    >
                      ✅ Accept
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRejectChallenge(c.id)}
                      className="fire-btn fire-btn-danger"
                      style={{ flex: 1, padding: "8px", fontSize: "0.78rem" }}
                    >
                      ❌ Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {myActiveChallenges.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div className="section-label" style={{ marginBottom: 8 }}>
                ⚡ Active Challenges
              </div>
              {myActiveChallenges.map((c) => (
                <div
                  key={c.id}
                  style={{
                    background: "rgba(34,197,94,0.08)",
                    border: "1px solid rgba(34,197,94,0.25)",
                    borderRadius: 12,
                    padding: "12px 14px",
                    marginBottom: 10,
                  }}
                >
                  <div
                    style={{
                      fontFamily: "Rajdhani, sans-serif",
                      fontSize: "0.85rem",
                      color: "#fff",
                    }}
                  >
                    <span style={{ color: "#fbbf24" }}>{c.challenger}</span> vs{" "}
                    <span style={{ color: "#3b82f6" }}>{c.opponent}</span>
                  </div>
                  <div
                    style={{
                      fontSize: "0.72rem",
                      color: "rgba(255,255,255,0.5)",
                      marginTop: 4,
                    }}
                  >
                    Bet: {c.amount} 🪙
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="section-label" style={{ marginBottom: 8 }}>
            🌐 Public Challenges
          </div>
          {publicChallenges.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">⚔️</div>
              <div className="empty-state-text">No public challenges</div>
            </div>
          ) : (
            publicChallenges.map((c) => (
              <div
                key={c.id}
                data-ocid="social.challenge_row"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 12,
                  padding: "10px 14px",
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
                      fontSize: "0.82rem",
                      color: "#fff",
                    }}
                  >
                    {c.challengerName || c.challenger} is looking for a battle
                  </div>
                  <div
                    style={{
                      fontSize: "0.68rem",
                      color: "rgba(255,255,255,0.4)",
                    }}
                  >
                    Bet: {c.amount} 🪙
                  </div>
                </div>
                <span className="badge badge-waiting">OPEN</span>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === "friends" && (
        <div>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <input
              className="fire-input"
              placeholder="Add friend by UID"
              value={friendInput}
              onChange={(e) => setFriendInput(e.target.value)}
              style={{ flex: 1 }}
              data-ocid="social.add_friend.input"
            />
            <button
              type="button"
              onClick={handleAddFriend}
              style={{
                padding: "0 16px",
                background: "rgba(255,107,0,0.15)",
                border: "1px solid rgba(255,107,0,0.35)",
                borderRadius: 10,
                color: "#fff",
                fontFamily: "Orbitron, sans-serif",
                fontSize: "0.7rem",
                cursor: "pointer",
              }}
            >
              Add +
            </button>
          </div>
          {friends.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">👥</div>
              <div className="empty-state-text">No friends yet</div>
            </div>
          ) : (
            friends.map((f) => (
              <div
                key={f.id}
                data-ocid="social.friend_row"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 14px",
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 12,
                  marginBottom: 8,
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    background: "linear-gradient(135deg,#ff6b00,#cc5500)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: "Orbitron, sans-serif",
                    fontWeight: 700,
                    fontSize: "0.8rem",
                    color: "#fff",
                    flexShrink: 0,
                  }}
                >
                  {(f.friendName || f.friendUid || "?")[0].toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontFamily: "Rajdhani, sans-serif",
                      fontWeight: 600,
                      color: "#fff",
                      fontSize: "0.9rem",
                    }}
                  >
                    {f.friendName || f.friendUid}
                  </div>
                  <div
                    style={{
                      fontSize: "0.68rem",
                      color: "rgba(255,255,255,0.4)",
                    }}
                  >
                    @{f.friendUid}
                  </div>
                </div>
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "#22c55e",
                    boxShadow: "0 0 6px #22c55e",
                  }}
                />
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === "global" && (
        <div>
          <div
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,107,0,0.15)",
              borderRadius: 14,
              padding: "12px",
              marginBottom: 12,
              height: 350,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {globalMessages.length === 0 ? (
              <div
                style={{
                  margin: "auto",
                  textAlign: "center",
                  color: "rgba(255,255,255,0.3)",
                  fontFamily: "Rajdhani, sans-serif",
                }}
              >
                <div style={{ fontSize: "2rem", marginBottom: 8 }}>💬</div>Be
                the first!
              </div>
            ) : (
              globalMessages.map((msg) => {
                const isMe = msg.uid === currentUser;
                return (
                  <div
                    key={msg.id}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: isMe ? "flex-end" : "flex-start",
                    }}
                  >
                    {!isMe && (
                      <div
                        style={{
                          fontSize: "0.65rem",
                          color: "#ff9a00",
                          fontFamily: "Rajdhani, sans-serif",
                          marginBottom: 2,
                          marginLeft: 4,
                        }}
                      >
                        {msg.name}
                      </div>
                    )}
                    <div
                      className={`chat-bubble ${isMe ? "sent" : "received"}`}
                    >
                      {msg.text}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={chatEndRef} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              className="fire-input"
              placeholder="Send a message..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendGlobalMessage()}
              style={{ flex: 1 }}
              data-ocid="social.global_chat.input"
              maxLength={200}
            />
            <button
              type="button"
              onClick={handleSendGlobalMessage}
              style={{
                padding: "0 16px",
                background: "linear-gradient(135deg,#ff6b00,#cc5500)",
                border: "none",
                borderRadius: 10,
                color: "#fff",
                fontFamily: "Orbitron, sans-serif",
                fontSize: "0.72rem",
                cursor: "pointer",
              }}
            >
              Send
            </button>
          </div>
        </div>
      )}

      {activeTab === "clans" && (
        <div style={{ textAlign: "center", padding: "40px 20px" }}>
          <div style={{ fontSize: "3rem", marginBottom: 12 }}>🛡️</div>
          <div
            style={{
              fontFamily: "Orbitron, sans-serif",
              fontSize: "0.9rem",
              fontWeight: 700,
              color: "#fff",
              marginBottom: 8,
            }}
          >
            Clan System
          </div>
          <div
            style={{
              fontFamily: "Rajdhani, sans-serif",
              fontSize: "0.85rem",
              color: "rgba(255,255,255,0.5)",
              marginBottom: 20,
            }}
          >
            {userData.clanId
              ? `Clan: ${userData.clanId}`
              : "You are not in any clan yet"}
          </div>
          <button
            type="button"
            data-ocid="social.create_clan.button"
            className="fire-btn"
            style={{ marginBottom: 10 }}
          >
            🛡️ Create Clan
          </button>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <input
              className="fire-input"
              placeholder="Enter clan code"
              style={{ flex: 1, maxWidth: 200 }}
            />
            <button
              type="button"
              className="fire-btn fire-btn-secondary"
              style={{ padding: "12px 16px" }}
            >
              Join
            </button>
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
