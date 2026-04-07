import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import {
  addDoc,
  collection,
  db,
  onSnapshot,
  orderBy,
  query,
  where,
} from "../firebase";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Transaction {
  id: string;
  type: string;
  amount: number;
  status: string;
  createdAt: number;
  note?: string;
  upiRef?: string;
  upiId?: string;
}

interface WalletViewProps {
  user: {
    uid?: string;
    walletBalance?: number;
    coins?: number;
    totalDeposited?: number;
  } | null;
  onNavigate: (view: string) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getVipTier(
  total: number,
): { label: string; color: string; icon: string } | null {
  if (total >= 5000) return { label: "GOLD VIP", color: "#ffd700", icon: "👑" };
  if (total >= 2000)
    return { label: "SILVER VIP", color: "#c0c0c0", icon: "🥈" };
  if (total >= 500)
    return { label: "BRONZE VIP", color: "#cd7f32", icon: "🥉" };
  return null;
}

function txIcon(type: string): string {
  switch (type) {
    case "deposit":
      return "💰";
    case "withdrawal":
      return "💸";
    case "prize":
      return "🏆";
    case "coins":
      return "🪙";
    default:
      return "📋";
  }
}

function txLabel(type: string): string {
  switch (type) {
    case "deposit":
      return "Deposit";
    case "withdrawal":
      return "Withdrawal";
    case "prize":
      return "Prize Won";
    case "coins":
      return "Coins";
    default:
      return type;
  }
}

function formatDate(ts: number): string {
  if (!ts) return "";
  const d = new Date(ts);
  return `${d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} ${d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}`;
}

// ─── Animated Counter ─────────────────────────────────────────────────────────
function AnimatedNumber({
  value,
  decimals = 0,
}: { value: number; decimals?: number }) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef<number>(0);
  const startRef = useRef<number>(0);
  const startValRef = useRef<number>(0);
  const displayRef = useRef<number>(0);
  const DURATION = 900;

  // keep ref in sync so the effect closure can read latest display
  displayRef.current = display;

  useEffect(() => {
    startRef.current = performance.now();
    startValRef.current = displayRef.current;
    const animate = (now: number) => {
      const elapsed = now - startRef.current;
      const progress = Math.min(elapsed / DURATION, 1);
      const rem = 1 - progress;
      const eased = 1 - rem ** 3;
      setDisplay(startValRef.current + (value - startValRef.current) * eased);
      if (progress < 1) rafRef.current = requestAnimationFrame(animate);
    };
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value]);

  const formatted =
    decimals > 0
      ? display.toFixed(decimals)
      : Math.floor(display).toLocaleString("en-IN");

  return <>{formatted}</>;
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ msg, visible }: { msg: string; visible: boolean }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 30 }}
          style={{
            position: "fixed",
            bottom: 90,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 9999,
            background: "linear-gradient(135deg,#ff6b00,#cc5500)",
            color: "white",
            padding: "10px 22px",
            borderRadius: 30,
            fontFamily: "Rajdhani,sans-serif",
            fontWeight: 700,
            fontSize: "0.9rem",
            boxShadow: "0 4px 20px rgba(255,107,0,0.5)",
            whiteSpace: "nowrap",
          }}
        >
          {msg}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Tab Pill ─────────────────────────────────────────────────────────────────
function TabPill({
  label,
  active,
  onClick,
}: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "6px 14px",
        borderRadius: 20,
        border: active ? "1px solid #ff6b00" : "1px solid rgba(255,107,0,0.2)",
        background: active ? "rgba(255,107,0,0.2)" : "rgba(255,255,255,0.04)",
        color: active ? "#ffffff" : "rgba(255,255,255,0.5)",
        fontFamily: "Rajdhani,sans-serif",
        fontWeight: 700,
        fontSize: "0.78rem",
        cursor: "pointer",
        whiteSpace: "nowrap",
        transition: "all 0.2s",
        letterSpacing: "0.03em",
      }}
    >
      {label}
    </button>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; border: string; color: string }> =
    {
      pending: {
        bg: "rgba(234,179,8,0.12)",
        border: "rgba(234,179,8,0.4)",
        color: "#eab308",
      },
      approved: {
        bg: "rgba(0,200,100,0.12)",
        border: "rgba(0,200,100,0.4)",
        color: "#00c864",
      },
      rejected: {
        bg: "rgba(239,68,68,0.12)",
        border: "rgba(239,68,68,0.4)",
        color: "#ef4444",
      },
    };
  const s = styles[status] ?? styles.pending;
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 20,
        background: s.bg,
        border: `1px solid ${s.border}`,
        color: s.color,
        fontFamily: "Rajdhani,sans-serif",
        fontWeight: 700,
        fontSize: "0.62rem",
        textTransform: "uppercase",
        letterSpacing: "0.05em",
      }}
    >
      {status}
    </span>
  );
}

// ─── Field Group ─────────────────────────────────────────────────────────────
function FieldGroup({
  id,
  label,
  children,
  hint,
  hintColor = "#ff6b00",
}: {
  id: string;
  label: string;
  children: React.ReactNode;
  hint?: React.ReactNode;
  hintColor?: string;
}) {
  return (
    <div className="field-group" style={{ marginBottom: 10 }}>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      {children}
      {hint && (
        <p
          style={{
            fontFamily: "Rajdhani,sans-serif",
            fontSize: "0.75rem",
            color: hintColor,
            marginTop: 4,
          }}
        >
          {hint}
        </p>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function WalletView({ user }: WalletViewProps) {
  const uid = user?.uid ?? "";
  const walletBalance = user?.walletBalance ?? 0;
  const coins = user?.coins ?? 0;
  const coinValue = coins * 0.2;
  const totalDeposited = user?.totalDeposited ?? 0;
  const vip = getVipTier(totalDeposited);

  // UI state
  const [section, setSection] = useState<"deposit" | "withdraw">("deposit");
  const [txTab, setTxTab] = useState<
    "all" | "deposit" | "withdrawal" | "prize"
  >("all");
  const [toastMsg, setToastMsg] = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const [txList, setTxList] = useState<Transaction[]>([]);
  const [txLimit, setTxLimit] = useState(10);
  const [pendingWithdrawal, setPendingWithdrawal] = useState(false);

  // Deposit form
  const [depAmount, setDepAmount] = useState("");
  const [depRef, setDepRef] = useState("");
  const [depLoading, setDepLoading] = useState(false);
  const [depSuccess, setDepSuccess] = useState(false);

  // Withdrawal form
  const [wdAmount, setWdAmount] = useState("");
  const [wdUpi, setWdUpi] = useState("");
  const [wdPin, setWdPin] = useState("");
  const [wdLoading, setWdLoading] = useState(false);
  const [wdSuccess, setWdSuccess] = useState(false);
  const [wdError, setWdError] = useState("");

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 3000);
  };

  // ── Real-time transactions ─────────────────────────────────────────────────
  useEffect(() => {
    if (!uid || !db) return;
    const q = query(
      collection(db, "transactions"),
      where("uid", "==", uid),
      orderBy("createdAt", "desc"),
    );
    type SnapType = {
      docs?: { id: string; data: () => Record<string, unknown> }[];
    };
    const unsub = onSnapshot(q, (snap: SnapType) => {
      const rows: Transaction[] = [];
      for (const d of snap.docs ?? []) {
        rows.push({ id: d.id, ...(d.data() as Omit<Transaction, "id">) });
      }
      setTxList(rows);
      const hasPending = rows.some(
        (r) => r.type === "withdrawal" && r.status === "pending",
      );
      setPendingWithdrawal(hasPending);
    });
    return unsub;
  }, [uid]);

  // ── Deposit submit ─────────────────────────────────────────────────────────
  const submitDeposit = async () => {
    const amt = Number(depAmount);
    if (amt < 30) {
      showToast("⚠️ Minimum deposit is ₹30");
      return;
    }
    setDepLoading(true);
    try {
      await addDoc(collection(db, "transactions"), {
        uid,
        type: "deposit",
        amount: amt,
        status: "pending",
        upiRef: depRef.trim() || "",
        createdAt: Date.now(),
        note: `Deposit ₹${amt} — UPI ref: ${depRef || "—"}`,
      });
      setDepSuccess(true);
      setDepAmount("");
      setDepRef("");
      setTimeout(() => setDepSuccess(false), 5000);
    } catch {
      showToast("❌ Failed to submit. Try again.");
    }
    setDepLoading(false);
  };

  // ── Withdrawal submit ──────────────────────────────────────────────────────
  const submitWithdrawal = async () => {
    setWdError("");
    const amt = Number(wdAmount);
    if (amt < 100) {
      setWdError("Minimum withdrawal is ₹100");
      return;
    }
    if (amt > walletBalance) {
      setWdError("Insufficient wallet balance");
      return;
    }
    if (!wdUpi.trim()) {
      setWdError("Enter your UPI ID");
      return;
    }
    if (amt > 200 && wdPin.length < 6) {
      setWdError("Enter your 6-digit transaction PIN");
      return;
    }
    if (pendingWithdrawal) {
      setWdError("You have a pending withdrawal. Wait for approval.");
      return;
    }

    const charge = Math.round(amt * 0.05);
    const receive = amt - charge;
    setWdLoading(true);
    try {
      await addDoc(collection(db, "transactions"), {
        uid,
        type: "withdrawal",
        amount: amt,
        chargeAmount: charge,
        receiveAmount: receive,
        upiId: wdUpi.trim(),
        status: "pending",
        createdAt: Date.now(),
        note: `Withdrawal ₹${amt} → UPI: ${wdUpi.trim()} (5% fee: ₹${charge}, receive ₹${receive})`,
      });
      setWdSuccess(true);
      setWdAmount("");
      setWdUpi("");
      setWdPin("");
      setTimeout(() => setWdSuccess(false), 5000);
    } catch {
      setWdError("Failed to submit. Please try again.");
    }
    setWdLoading(false);
  };

  const filteredTx =
    txTab === "all" ? txList : txList.filter((t) => t.type === txTab);
  const wdAmountNum = Number(wdAmount);
  const wdReceive =
    wdAmountNum > 0 ? wdAmountNum - Math.round(wdAmountNum * 0.05) : 0;
  const showPinField = wdAmountNum > 200;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="main-content" data-ocid="wallet-view">
      {/* ── Balance Card ─────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        style={{
          background:
            "linear-gradient(135deg, #1a0800 0%, #2d1200 40%, #1a0800 100%)",
          border: "1px solid rgba(255,107,0,0.4)",
          borderRadius: 20,
          padding: "22px 20px",
          marginBottom: 14,
          position: "relative",
          overflow: "hidden",
          boxShadow:
            "0 0 30px rgba(255,107,0,0.15), inset 0 1px 0 rgba(255,255,255,0.05)",
        }}
        data-ocid="balance-card"
      >
        {/* radial glow */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background:
              "radial-gradient(ellipse at 50% 0%, rgba(255,107,0,0.18) 0%, transparent 70%)",
          }}
        />

        {vip && (
          <div
            style={{
              position: "absolute",
              top: 14,
              right: 16,
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "3px 10px",
              borderRadius: 20,
              background: `${vip.color}22`,
              border: `1px solid ${vip.color}66`,
              fontFamily: "Orbitron,sans-serif",
              fontSize: "0.6rem",
              fontWeight: 700,
              color: vip.color,
              letterSpacing: "0.06em",
            }}
          >
            {vip.icon} {vip.label}
          </div>
        )}

        <p
          style={{
            fontFamily: "Rajdhani,sans-serif",
            fontSize: "0.75rem",
            color: "rgba(255,255,255,0.45)",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            marginBottom: 6,
          }}
        >
          WALLET BALANCE
        </p>
        <div
          style={{
            fontFamily: "Orbitron,sans-serif",
            fontSize: "2.4rem",
            fontWeight: 900,
            background: "linear-gradient(135deg,#ff6b00,#ffaa00,#ff6b00)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            lineHeight: 1.1,
            marginBottom: 6,
          }}
        >
          ₹<AnimatedNumber value={walletBalance} />
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 16,
          }}
        >
          <span
            style={{
              fontFamily: "Rajdhani,sans-serif",
              fontSize: "0.9rem",
              color: "rgba(255,255,255,0.6)",
            }}
          >
            🪙{" "}
            <span
              style={{
                color: "#ffffff",
                fontWeight: 700,
                fontFamily: "Orbitron,sans-serif",
                fontSize: "0.88rem",
              }}
            >
              <AnimatedNumber value={coins} />
            </span>{" "}
            Coins
          </span>
          <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.75rem" }}>
            ≈
          </span>
          <span
            style={{
              fontFamily: "Rajdhani,sans-serif",
              fontSize: "0.85rem",
              color: "rgba(255,255,255,0.5)",
            }}
          >
            ₹<AnimatedNumber value={coinValue} decimals={2} />
          </span>
        </div>
        <p
          style={{
            fontFamily: "Rajdhani,sans-serif",
            fontSize: "0.7rem",
            color: "rgba(255,107,0,0.7)",
            marginBottom: 18,
          }}
        >
          💡 100 coins = ₹20 real money
        </p>

        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}
        >
          <button
            type="button"
            className="fire-btn"
            onClick={() => setSection("deposit")}
            data-ocid="add-money-btn"
            style={{ fontSize: "0.72rem", padding: "12px 8px" }}
          >
            ➕ ADD MONEY
          </button>
          <button
            type="button"
            className="fire-btn fire-btn-secondary"
            onClick={() => setSection("withdraw")}
            data-ocid="withdraw-btn"
            style={{ fontSize: "0.72rem", padding: "12px 8px" }}
          >
            💸 WITHDRAW
          </button>
        </div>
      </motion.div>

      {/* ── UPI Payment Info Box ──────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="upi-box"
        data-ocid="upi-info-box"
      >
        <p
          style={{
            fontFamily: "Orbitron,sans-serif",
            fontSize: "0.7rem",
            fontWeight: 700,
            color: "#ff6b00",
            letterSpacing: "0.1em",
            marginBottom: 12,
          }}
        >
          💳 PAYMENT INFO
        </p>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            marginBottom: 10,
          }}
        >
          <div>
            <p className="upi-label">UPI ID</p>
            <p className="upi-value">8247835354@ibl</p>
          </div>
          <button
            type="button"
            className="copy-btn"
            data-ocid="copy-upi-btn"
            onClick={() => {
              navigator.clipboard.writeText("8247835354@ibl").catch(() => {});
              showToast("📋 Copied!");
            }}
          >
            📋 Copy
          </button>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            marginBottom: 10,
          }}
        >
          <div>
            <p className="upi-label">WhatsApp</p>
            <p className="upi-value">7013256124</p>
          </div>
          <a
            href="https://wa.me/917013256124"
            target="_blank"
            rel="noopener noreferrer"
            data-ocid="whatsapp-btn"
          >
            <button type="button" className="wa-btn">
              💬 Chat
            </button>
          </a>
        </div>

        <p
          style={{
            fontFamily: "Rajdhani,sans-serif",
            fontSize: "0.78rem",
            color: "rgba(255,255,255,0.45)",
            lineHeight: 1.4,
          }}
        >
          Send payment screenshot after transfer for faster approval.
        </p>
      </motion.div>

      {/* ── Section Switcher ──────────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 8,
          marginBottom: 14,
        }}
      >
        {(["deposit", "withdraw"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              setSection(s);
              setDepSuccess(false);
              setWdSuccess(false);
              setWdError("");
            }}
            style={{
              padding: "10px 0",
              borderRadius: 12,
              border:
                section === s
                  ? "1px solid #ff6b00"
                  : "1px solid rgba(255,107,0,0.2)",
              background:
                section === s
                  ? "rgba(255,107,0,0.18)"
                  : "rgba(255,255,255,0.03)",
              color: section === s ? "#ffffff" : "rgba(255,255,255,0.45)",
              fontFamily: "Orbitron,sans-serif",
              fontSize: "0.72rem",
              fontWeight: 700,
              cursor: "pointer",
              transition: "all 0.2s",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            {s === "deposit" ? "💰 Add Money" : "💸 Withdraw"}
          </button>
        ))}
      </div>

      {/* ── Deposit / Withdraw Sections ───────────────────────────────── */}
      <AnimatePresence mode="wait">
        {section === "deposit" && (
          <motion.div
            key="deposit"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.25 }}
            className="card card-glow"
            data-ocid="deposit-section"
          >
            <p className="section-label" style={{ marginBottom: 14 }}>
              Add Money to Wallet
            </p>

            {depSuccess ? (
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                style={{
                  textAlign: "center",
                  padding: "20px 0",
                  background: "rgba(0,200,100,0.08)",
                  borderRadius: 12,
                  border: "1px solid rgba(0,200,100,0.3)",
                }}
              >
                <div style={{ fontSize: "2.2rem", marginBottom: 8 }}>✅</div>
                <p
                  style={{
                    fontFamily: "Orbitron,sans-serif",
                    fontSize: "0.85rem",
                    fontWeight: 700,
                    color: "#00c864",
                    marginBottom: 6,
                  }}
                >
                  Deposit Request Submitted!
                </p>
                <p
                  style={{
                    fontFamily: "Rajdhani,sans-serif",
                    fontSize: "0.8rem",
                    color: "rgba(255,255,255,0.5)",
                    lineHeight: 1.5,
                  }}
                >
                  Admin will approve within 1 hour. You'll receive a
                  notification once approved.
                </p>
              </motion.div>
            ) : (
              <>
                <FieldGroup
                  id="dep-amount"
                  label="Amount (₹)"
                  hint="⚠️ Minimum deposit: ₹30"
                >
                  <input
                    id="dep-amount"
                    type="number"
                    className="fire-input"
                    placeholder="Enter amount"
                    min={30}
                    value={depAmount}
                    onChange={(e) => setDepAmount(e.target.value)}
                    data-ocid="deposit-amount-input"
                  />
                </FieldGroup>

                <FieldGroup
                  id="dep-ref"
                  label="UPI Reference (optional)"
                  hint={undefined}
                >
                  <input
                    id="dep-ref"
                    type="text"
                    className="fire-input"
                    placeholder="e.g. UTR123456789"
                    value={depRef}
                    onChange={(e) => setDepRef(e.target.value)}
                    data-ocid="deposit-ref-input"
                  />
                </FieldGroup>

                <div
                  style={{
                    background: "rgba(255,107,0,0.06)",
                    borderRadius: 10,
                    border: "1px solid rgba(255,107,0,0.2)",
                    padding: "10px 12px",
                    marginBottom: 14,
                    fontFamily: "Rajdhani,sans-serif",
                    fontSize: "0.8rem",
                    color: "rgba(255,255,255,0.55)",
                    lineHeight: 1.6,
                  }}
                >
                  Send ₹{depAmount || "X"} to UPI:{" "}
                  <strong style={{ color: "#ff6b00" }}>8247835354@ibl</strong>,
                  then submit here. Admin will approve within 1 hour.
                </div>

                <button
                  type="button"
                  className="fire-btn"
                  onClick={submitDeposit}
                  disabled={depLoading}
                  data-ocid="deposit-submit-btn"
                  style={{ opacity: depLoading ? 0.6 : 1 }}
                >
                  {depLoading ? "⏳ Submitting..." : "SUBMIT DEPOSIT REQUEST"}
                </button>
              </>
            )}
          </motion.div>
        )}

        {section === "withdraw" && (
          <motion.div
            key="withdraw"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25 }}
            className="card card-glow"
            data-ocid="withdraw-section"
          >
            <p className="section-label" style={{ marginBottom: 14 }}>
              Withdraw Earnings
            </p>

            {pendingWithdrawal && (
              <div
                style={{
                  background: "rgba(234,179,8,0.1)",
                  border: "1px solid rgba(234,179,8,0.4)",
                  borderRadius: 10,
                  padding: "10px 12px",
                  marginBottom: 12,
                  fontFamily: "Rajdhani,sans-serif",
                  fontSize: "0.82rem",
                  color: "#eab308",
                }}
              >
                ⏳ Previous withdrawal pending. Wait for admin approval.
              </div>
            )}

            {wdSuccess ? (
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                style={{
                  textAlign: "center",
                  padding: "20px 0",
                  background: "rgba(0,200,100,0.08)",
                  borderRadius: 12,
                  border: "1px solid rgba(0,200,100,0.3)",
                }}
              >
                <div style={{ fontSize: "2.2rem", marginBottom: 8 }}>✅</div>
                <p
                  style={{
                    fontFamily: "Orbitron,sans-serif",
                    fontSize: "0.85rem",
                    fontWeight: 700,
                    color: "#00c864",
                    marginBottom: 6,
                  }}
                >
                  Withdrawal Requested!
                </p>
                <p
                  style={{
                    fontFamily: "Rajdhani,sans-serif",
                    fontSize: "0.8rem",
                    color: "rgba(255,255,255,0.5)",
                    lineHeight: 1.5,
                  }}
                >
                  Admin will process within 24–48 hours. Amount will be sent to
                  your UPI.
                </p>
              </motion.div>
            ) : (
              <>
                <FieldGroup
                  id="wd-amount"
                  label="Amount (₹)"
                  hint={
                    wdAmountNum > 0 ? (
                      <>
                        ⚠️ Min ₹100 · 5% fee · You'll receive{" "}
                        <strong style={{ color: "#00c864" }}>
                          ₹{wdReceive}
                        </strong>
                      </>
                    ) : (
                      "⚠️ Minimum withdrawal: ₹100"
                    )
                  }
                >
                  <input
                    id="wd-amount"
                    type="number"
                    className="fire-input"
                    placeholder="Min ₹100"
                    min={100}
                    max={walletBalance}
                    value={wdAmount}
                    onChange={(e) => {
                      setWdAmount(e.target.value);
                      setWdError("");
                    }}
                    data-ocid="withdraw-amount-input"
                  />
                </FieldGroup>

                <FieldGroup id="wd-upi" label="Your UPI ID" hint={undefined}>
                  <input
                    id="wd-upi"
                    type="text"
                    className="fire-input"
                    placeholder="e.g. yourname@upi"
                    value={wdUpi}
                    onChange={(e) => {
                      setWdUpi(e.target.value);
                      setWdError("");
                    }}
                    data-ocid="withdraw-upi-input"
                  />
                </FieldGroup>

                {showPinField && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    style={{ overflow: "hidden" }}
                  >
                    <FieldGroup
                      id="wd-pin"
                      label="Transaction PIN (6-digit)"
                      hint="Required for withdrawals above ₹200"
                      hintColor="rgba(255,255,255,0.35)"
                    >
                      <input
                        id="wd-pin"
                        type="password"
                        className="fire-input"
                        placeholder="••••••"
                        maxLength={6}
                        value={wdPin}
                        onChange={(e) =>
                          setWdPin(e.target.value.replace(/\D/g, ""))
                        }
                        data-ocid="withdraw-pin-input"
                      />
                    </FieldGroup>
                  </motion.div>
                )}

                {wdError && (
                  <p
                    style={{
                      fontFamily: "Rajdhani,sans-serif",
                      fontSize: "0.8rem",
                      color: "#ef4444",
                      marginBottom: 10,
                    }}
                  >
                    ❌ {wdError}
                  </p>
                )}

                <button
                  type="button"
                  className="fire-btn"
                  onClick={submitWithdrawal}
                  disabled={wdLoading || pendingWithdrawal}
                  data-ocid="withdraw-submit-btn"
                  style={{ opacity: wdLoading || pendingWithdrawal ? 0.6 : 1 }}
                >
                  {wdLoading
                    ? "⏳ Processing..."
                    : wdAmountNum > 0
                      ? `WITHDRAW ₹${wdAmountNum}`
                      : "WITHDRAW"}
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Coin Conversion Info ──────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.35 }}
        style={{
          background:
            "linear-gradient(135deg, rgba(255,107,0,0.06), rgba(10,10,26,0.8))",
          border: "1px solid rgba(255,107,0,0.2)",
          borderRadius: 12,
          padding: "12px 16px",
          marginBottom: 14,
          display: "flex",
          gap: 12,
          alignItems: "flex-start",
        }}
        data-ocid="coin-info-card"
      >
        <span style={{ fontSize: "1.4rem", lineHeight: 1 }}>💡</span>
        <div>
          <p
            style={{
              fontFamily: "Orbitron,sans-serif",
              fontSize: "0.72rem",
              fontWeight: 700,
              color: "#ff6b00",
              marginBottom: 4,
            }}
          >
            100 coins = ₹20 real money
          </p>
          <p
            style={{
              fontFamily: "Rajdhani,sans-serif",
              fontSize: "0.78rem",
              color: "rgba(255,255,255,0.5)",
              lineHeight: 1.5,
            }}
          >
            Earn coins by completing missions, achievements, and winning
            matches. Redeem coins in your next withdrawal request.
          </p>
        </div>
      </motion.div>

      {/* ── Transaction History ───────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.35 }}
        data-ocid="tx-history"
      >
        <p className="section-label" style={{ marginBottom: 10 }}>
          Transaction History
        </p>

        <div
          style={{
            display: "flex",
            gap: 6,
            marginBottom: 14,
            overflowX: "auto",
            paddingBottom: 2,
          }}
        >
          {(["all", "deposit", "withdrawal", "prize"] as const).map((t) => (
            <TabPill
              key={t}
              label={
                t === "all"
                  ? "All"
                  : t === "deposit"
                    ? "Deposits"
                    : t === "withdrawal"
                      ? "Withdrawals"
                      : "Prizes"
              }
              active={txTab === t}
              onClick={() => setTxTab(t)}
            />
          ))}
        </div>

        <div className="card" style={{ padding: 0 }}>
          {filteredTx.length === 0 ? (
            <div className="empty-state" style={{ padding: "32px 20px" }}>
              <div className="empty-state-icon">📭</div>
              <p className="empty-state-text">No transactions yet</p>
            </div>
          ) : (
            <>
              {filteredTx.slice(0, txLimit).map((tx, i) => (
                <motion.div
                  key={tx.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "11px 14px",
                    borderBottom:
                      i < Math.min(filteredTx.length, txLimit) - 1
                        ? "1px solid rgba(255,255,255,0.05)"
                        : "none",
                  }}
                  data-ocid={`tx-row-${tx.id}`}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      background: "rgba(255,107,0,0.1)",
                      border: "1px solid rgba(255,107,0,0.2)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "1rem",
                      flexShrink: 0,
                    }}
                  >
                    {txIcon(tx.type)}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        fontFamily: "Rajdhani,sans-serif",
                        fontSize: "0.88rem",
                        fontWeight: 600,
                        color: "white",
                        marginBottom: 2,
                      }}
                    >
                      {txLabel(tx.type)}
                    </p>
                    {tx.note && (
                      <p
                        style={{
                          fontFamily: "Rajdhani,sans-serif",
                          fontSize: "0.7rem",
                          color: "rgba(255,255,255,0.35)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {tx.note}
                      </p>
                    )}
                    <p
                      style={{
                        fontFamily: "Rajdhani,sans-serif",
                        fontSize: "0.68rem",
                        color: "rgba(255,255,255,0.3)",
                        marginTop: 2,
                      }}
                    >
                      {formatDate(tx.createdAt)}
                    </p>
                  </div>

                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <p
                      style={{
                        fontFamily: "Orbitron,sans-serif",
                        fontSize: "0.82rem",
                        fontWeight: 700,
                        color:
                          tx.type === "deposit" ||
                          tx.type === "prize" ||
                          tx.type === "coins"
                            ? "#00c864"
                            : "#ef4444",
                        marginBottom: 4,
                      }}
                    >
                      {tx.type === "deposit" ||
                      tx.type === "prize" ||
                      tx.type === "coins"
                        ? "+"
                        : "−"}
                      ₹{tx.amount}
                    </p>
                    <StatusBadge status={tx.status} />
                  </div>
                </motion.div>
              ))}

              {filteredTx.length > txLimit && (
                <button
                  type="button"
                  onClick={() => setTxLimit((l) => l + 10)}
                  data-ocid="load-more-btn"
                  style={{
                    width: "100%",
                    padding: "10px",
                    background: "transparent",
                    border: "none",
                    borderTop: "1px solid rgba(255,255,255,0.05)",
                    color: "rgba(255,107,0,0.7)",
                    fontFamily: "Rajdhani,sans-serif",
                    fontWeight: 700,
                    fontSize: "0.82rem",
                    cursor: "pointer",
                    letterSpacing: "0.05em",
                  }}
                >
                  Load More ↓
                </button>
              )}
            </>
          )}
        </div>
      </motion.div>

      <Toast msg={toastMsg} visible={toastVisible} />
    </div>
  );
}
