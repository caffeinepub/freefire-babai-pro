import { motion } from "motion/react";
import { useEffect, useState } from "react";
import {
  addDoc,
  collection,
  db,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "../firebase";

// ─── Shared: Particle Canvas ─────────────────────────────────────────────────
function useAuthParticles() {
  useEffect(() => {
    const existing = document.getElementById("authParticlesCanvas");
    if (existing) existing.remove();
    const canvas = document.createElement("canvas");
    canvas.id = "authParticlesCanvas";
    canvas.style.cssText =
      "position:fixed;top:0;left:0;width:100%;height:100%;z-index:0;pointer-events:none;";
    document.body.appendChild(canvas);
    const ctx = canvas.getContext("2d")!;
    let raf: number;
    const particles: {
      x: number;
      y: number;
      r: number;
      speed: number;
      opacity: number;
      color: string;
    }[] = [];
    const colors = [
      "rgba(180,80,0,",
      "rgba(100,60,0,",
      "rgba(255,107,0,",
      "rgba(140,50,0,",
    ];
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);
    for (let i = 0; i < 45; i++) {
      particles.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        r: 0.8 + Math.random() * 2.2,
        speed: 0.3 + Math.random() * 0.7,
        opacity: 0.08 + Math.random() * 0.22,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `${p.color}${p.opacity})`;
        ctx.fill();
        p.y -= p.speed;
        p.x += (Math.random() - 0.5) * 0.3;
        if (p.y < -10) {
          p.y = canvas.height + 10;
          p.x = Math.random() * canvas.width;
        }
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      const el = document.getElementById("authParticlesCanvas");
      if (el) el.remove();
    };
  }, []);
}

// ─── Shared: Footer ───────────────────────────────────────────────────────────
function AuthFooter() {
  const year = new Date().getFullYear();
  const utm = `https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`;
  return (
    <div className="footer-text" style={{ marginTop: 12 }}>
      © {year}. Built with ❤️ using{" "}
      <a href={utm} target="_blank" rel="noopener noreferrer">
        caffeine.ai
      </a>
    </div>
  );
}

// ─── Shared: Password Strength Meter ─────────────────────────────────────────
function PasswordStrength({ password }: { password: string }) {
  const getStrength = (
    p: string,
  ): { label: string; color: string; width: string } => {
    if (p.length === 0) return { label: "", color: "transparent", width: "0%" };
    let score = 0;
    if (p.length >= 6) score++;
    if (p.length >= 10) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/[0-9]/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;
    if (score <= 1) return { label: "Weak", color: "#ef4444", width: "33%" };
    if (score <= 3) return { label: "Medium", color: "#f59e0b", width: "66%" };
    return { label: "Strong", color: "#00c864", width: "100%" };
  };
  const s = getStrength(password);
  if (!s.label) return null;
  return (
    <div style={{ marginTop: 4 }}>
      <div
        style={{
          height: 3,
          background: "rgba(255,255,255,0.1)",
          borderRadius: 2,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: s.width,
            background: s.color,
            borderRadius: 2,
            transition: "width 0.3s, background 0.3s",
          }}
        />
      </div>
      <span
        style={{
          fontSize: "0.65rem",
          color: s.color,
          fontFamily: "Rajdhani, sans-serif",
          fontWeight: 700,
          letterSpacing: "0.05em",
          marginTop: 2,
          display: "block",
        }}
      >
        {s.label}
      </span>
    </div>
  );
}

// ─── Shared: DHURANDAR-FF Header Block ───────────────────────────────────────
function DhurandarHeader({ tagline }: { tagline: string }) {
  return (
    <>
      <motion.span
        className="dhurandar-title"
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, type: "spring" }}
      >
        DHURANDAR-FF
      </motion.span>
      <motion.div
        className="dhurandar-tagline"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.4 }}
      >
        {tagline}
      </motion.div>
    </>
  );
}

// ─── SplashView ───────────────────────────────────────────────────────────────
export function SplashView({ onComplete }: { onComplete: () => void }) {
  useEffect(() => {
    const t = setTimeout(onComplete, 2500);
    return () => clearTimeout(t);
  }, [onComplete]);

  return (
    <motion.div
      className="splash-screen"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      style={{ position: "relative", zIndex: 1 }}
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        style={{ textAlign: "center" }}
      >
        {/* Fire emoji with 3D float */}
        <motion.div
          animate={{ y: [0, -12, 0], rotateY: [0, 15, 0, -15, 0] }}
          transition={{
            duration: 3,
            repeat: Number.POSITIVE_INFINITY,
            ease: "easeInOut",
          }}
          style={{
            fontSize: "4.5rem",
            display: "block",
            marginBottom: 12,
            filter: "drop-shadow(0 0 24px rgba(255,107,0,0.8))",
            transformStyle: "preserve-3d",
          }}
        >
          🔥
        </motion.div>

        {/* MR.SONIC FF title with neonFlicker */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          style={{
            fontFamily: "Orbitron, sans-serif",
            fontSize: "clamp(1.4rem, 7vw, 2.2rem)",
            fontWeight: 900,
            letterSpacing: "0.08em",
            color: "#ffffff",
            textTransform: "uppercase",
            animation: "neonFlicker 4s ease-in-out infinite",
            marginBottom: 6,
          }}
        >
          MR.SONIC FF
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.4 }}
          style={{
            fontFamily: "Rajdhani, sans-serif",
            fontSize: "0.82rem",
            color: "#ff6b00",
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            marginBottom: 24,
          }}
        >
          Free Fire Tournament Platform
        </motion.div>

        <motion.span
          className="dhurandar-title"
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.35, duration: 0.5, type: "spring" }}
          style={{ display: "block", marginBottom: 24 }}
        >
          DHURANDAR-FF
        </motion.span>
      </motion.div>

      {/* Loading spinner */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div className="spinner" />
        {/* Progress bar */}
        <div
          style={{
            width: 220,
            height: 3,
            background: "rgba(255,107,0,0.15)",
            borderRadius: 2,
            overflow: "hidden",
          }}
        >
          <motion.div
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: 2.3, ease: "easeInOut" }}
            style={{
              height: "100%",
              background: "linear-gradient(90deg, #ff6b00, #ffaa00)",
              borderRadius: 2,
            }}
          />
        </div>
        <p
          style={{
            color: "rgba(255,255,255,0.4)",
            fontSize: "0.72rem",
            fontFamily: "Rajdhani, sans-serif",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          Loading...
        </p>
      </div>
    </motion.div>
  );
}

// ─── LoginView ────────────────────────────────────────────────────────────────
export function LoginView({
  onLogin,
  onNavigate,
}: {
  onLogin: (user: Record<string, unknown>) => void;
  onNavigate: (view: string) => void;
}) {
  const [uid, setUid] = useState("");
  const [pass, setPass] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  useAuthParticles();

  const handleLogin = async () => {
    if (!uid.trim() || !pass.trim()) {
      setError("Please enter UID and password");
      return;
    }
    setError("");
    setIsLoading(true);
    try {
      // Auto-create admin if not exists
      if (uid.trim() === "admin") {
        const adminRef = doc(db, "users", "admin");
        const adminSnap = await getDoc(adminRef);
        if (!adminSnap.exists()) {
          await setDoc(adminRef, {
            uid: "admin",
            pass: "admin123",
            displayName: "Admin",
            role: "admin",
            isAdmin: true,
            walletBalance: 0,
            coins: 0,
            wins: 0,
            kills: 0,
            matchesPlayed: 0,
            blocked: false,
          });
          await setDoc(doc(db, "wallet", "admin"), { coins: 0 });
        }
      }
      const ref = doc(db, "users", uid.trim());
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        setError("User not found. Check your UID.");
        return;
      }
      const data = snap.data() as Record<string, unknown>;
      if (data.pass !== pass) {
        setError("Wrong password");
        return;
      }
      if (data.blocked) {
        onNavigate("blocked");
        return;
      }
      localStorage.setItem("ff_session_uid", uid.trim());
      onLogin(data);
    } catch (_) {
      setError("Network error. Try again.");
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
      style={{ zIndex: 1 }}
    >
      <div className="auth-watermark">MR.SONIC FF</div>

      <DhurandarHeader tagline="⚔ The #1 Free Fire Tournament Platform ⚔" />

      <motion.div
        className="auth-form"
        initial={{ opacity: 0, y: 40, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{
          delay: 0.15,
          duration: 0.5,
          type: "spring",
          stiffness: 120,
        }}
        style={{ position: "relative", zIndex: 1 }}
      >
        {/* Create Account — primary CTA */}
        <motion.button
          type="button"
          className="create-account-cta"
          onClick={() => onNavigate("signup")}
          data-ocid="login.create_account.button"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          whileTap={{ scale: 0.97 }}
        >
          🆕 CREATE ACCOUNT — JOIN THE BATTLE
        </motion.button>

        {/* Divider */}
        <motion.div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            margin: "2px 0",
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35, duration: 0.3 }}
        >
          <div
            style={{ flex: 1, height: 1, background: "rgba(255,107,0,0.2)" }}
          />
          <span
            style={{
              color: "var(--muted)",
              fontSize: "0.72rem",
              fontFamily: "Rajdhani, sans-serif",
              letterSpacing: "0.1em",
            }}
          >
            OR LOGIN
          </span>
          <div
            style={{ flex: 1, height: 1, background: "rgba(255,107,0,0.2)" }}
          />
        </motion.div>

        {/* UID field */}
        <motion.div
          className="field-group"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.4 }}
        >
          <div className="field-label">Player UID</div>
          <input
            className="fire-input"
            placeholder="Enter UID"
            value={uid}
            onChange={(e) => setUid(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            data-ocid="login.input"
            autoComplete="username"
          />
        </motion.div>

        {/* Password field */}
        <motion.div
          className="field-group"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.4 }}
        >
          <div className="field-label">Password</div>
          <div style={{ position: "relative" }}>
            <input
              className="fire-input"
              type={showPass ? "text" : "password"}
              placeholder="Password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              data-ocid="login.input"
              autoComplete="current-password"
              style={{ paddingRight: 44 }}
            />
            <button
              type="button"
              onClick={() => setShowPass((v) => !v)}
              aria-label={showPass ? "Hide password" : "Show password"}
              style={{
                position: "absolute",
                right: 12,
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                color: "rgba(255,255,255,0.45)",
                cursor: "pointer",
                fontSize: "1rem",
                lineHeight: 1,
                padding: 4,
              }}
            >
              {showPass ? "🙈" : "👁️"}
            </button>
          </div>
        </motion.div>

        {/* Error */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              background: "rgba(239,68,68,0.12)",
              border: "1px solid rgba(239,68,68,0.35)",
              borderRadius: 8,
              padding: "8px 12px",
              fontSize: "0.8rem",
              color: "#ef4444",
              fontFamily: "Rajdhani, sans-serif",
              textAlign: "center",
            }}
          >
            {error}
          </motion.div>
        )}

        {/* Login button */}
        <motion.button
          type="button"
          className="fire-btn"
          onClick={handleLogin}
          disabled={isLoading}
          data-ocid="login.submit_button"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.4 }}
          whileTap={{ scale: 0.98 }}
          style={{ opacity: isLoading ? 0.7 : 1 }}
        >
          {isLoading ? "Logging in..." : "LOGIN ⚡"}
        </motion.button>

        {/* Forgot password */}
        <motion.div
          style={{ textAlign: "center" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.4 }}
        >
          <button
            type="button"
            className="auth-link"
            onClick={() => onNavigate("forgot-password")}
            data-ocid="login.forgot.link"
            style={{ color: "#ff6b00" }}
          >
            Forgot Password?
          </button>
        </motion.div>
      </motion.div>

      <AuthFooter />
    </motion.div>
  );
}

// ─── SignupView ───────────────────────────────────────────────────────────────
export function SignupView({
  onNavigate,
}: { onNavigate: (view: string) => void }) {
  const [uid, setUid] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [pass, setPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  useAuthParticles();

  const handleRegister = async () => {
    setError("");
    if (!uid.trim() || !name.trim() || !pass || !confirmPass) {
      setError("Please fill all required fields");
      return;
    }
    if (pass !== confirmPass) {
      setError("Passwords do not match");
      return;
    }
    if (pass.length < 4) {
      setError("Password must be at least 4 characters");
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(uid.trim())) {
      setError("UID can only contain letters, numbers, and underscores");
      return;
    }
    if (uid.trim() === "admin") {
      setError("UID 'admin' is reserved");
      return;
    }
    setIsLoading(true);
    try {
      // Check UID uniqueness
      const q = query(collection(db, "users"), where("uid", "==", uid.trim()));
      const snap = await getDocs(q);
      if (!snap.empty) {
        setError("UID already taken. Choose a different one.");
        return;
      }
      const ref = doc(db, "users", uid.trim());
      const directSnap = await getDoc(ref);
      if (directSnap.exists()) {
        setError("UID already taken. Choose a different one.");
        return;
      }

      // Handle referral
      const refCode = new URLSearchParams(window.location.search).get("ref");
      let referrerBonus = false;
      if (refCode && refCode !== uid.trim()) {
        try {
          const refSnap = await getDoc(doc(db, "users", refCode));
          if (refSnap.exists()) referrerBonus = true;
        } catch (_) {}
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
          coins: 10,
          blocked: false,
          createdAt: Date.now(),
        }),
        setDoc(doc(db, "wallet", uid.trim()), { coins: 10 }),
      ]);

      // Credit referrer if valid
      if (referrerBonus && refCode) {
        try {
          const refWalletSnap = await getDoc(doc(db, "wallet", refCode));
          const refCoins = refWalletSnap.exists()
            ? (refWalletSnap.data().coins as number) || 0
            : 0;
          await setDoc(doc(db, "wallet", refCode), { coins: refCoins + 10 });
          await addDoc(collection(db, "notifications"), {
            uid: refCode,
            title: "🔗 Referral Bonus!",
            message: `Your friend ${uid.trim()} joined using your referral! +10 coins credited.`,
            read: false,
            timestamp: serverTimestamp ? serverTimestamp() : new Date(),
          });
        } catch (_) {}
      }

      setSuccess("Account created! You can login now.");
      setTimeout(() => onNavigate("login"), 1500);
    } catch (_) {
      setError("Error creating account. Try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const fields = [
    {
      label: "Full Name *",
      value: name,
      setter: setName,
      placeholder: "Your in-game name",
      type: "text",
      ocid: "signup.name.input",
      delay: 0.3,
    },
    {
      label: "Player UID *",
      value: uid,
      setter: setUid,
      placeholder: "Choose a unique UID (letters, numbers, _)",
      type: "text",
      ocid: "signup.uid.input",
      delay: 0.38,
    },
    {
      label: "Phone Number",
      value: phone,
      setter: setPhone,
      placeholder: "10-digit mobile number",
      type: "tel",
      ocid: "signup.phone.input",
      delay: 0.46,
    },
  ];

  return (
    <motion.div
      className="auth-page"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      style={{ zIndex: 1 }}
    >
      <div className="auth-watermark">MR.SONIC FF</div>

      <DhurandarHeader tagline="⚔ Create Your Warrior Profile ⚔" />

      <motion.div
        className="auth-form"
        initial={{ opacity: 0, y: 40, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{
          delay: 0.15,
          duration: 0.5,
          type: "spring",
          stiffness: 120,
        }}
        style={{ position: "relative", zIndex: 1 }}
      >
        <div
          style={{
            fontFamily: "Orbitron, sans-serif",
            fontSize: "0.9rem",
            fontWeight: 700,
            color: "#ffffff",
            textAlign: "center",
            marginBottom: 4,
            letterSpacing: "0.05em",
          }}
        >
          Create Account
        </div>

        {fields.map(
          ({ label, value, setter, placeholder, type, ocid, delay }) => (
            <motion.div
              key={ocid}
              className="field-group"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay, duration: 0.4 }}
            >
              <div className="field-label">{label}</div>
              <input
                className="fire-input"
                type={type}
                placeholder={placeholder}
                value={value}
                onChange={(e) => setter(e.target.value)}
                data-ocid={ocid}
              />
            </motion.div>
          ),
        )}

        {/* Password */}
        <motion.div
          className="field-group"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.54, duration: 0.4 }}
        >
          <div className="field-label">Password *</div>
          <input
            className="fire-input"
            type="password"
            placeholder="Create a strong password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            data-ocid="signup.password.input"
            autoComplete="new-password"
          />
          <PasswordStrength password={pass} />
        </motion.div>

        {/* Confirm Password */}
        <motion.div
          className="field-group"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.62, duration: 0.4 }}
        >
          <div className="field-label">Confirm Password *</div>
          <input
            className="fire-input"
            type="password"
            placeholder="Re-enter password"
            value={confirmPass}
            onChange={(e) => setConfirmPass(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleRegister()}
            data-ocid="signup.confirm_password.input"
            autoComplete="new-password"
          />
          {confirmPass && pass !== confirmPass && (
            <span
              style={{
                fontSize: "0.65rem",
                color: "#ef4444",
                fontFamily: "Rajdhani, sans-serif",
                marginTop: 2,
                display: "block",
              }}
            >
              Passwords don't match
            </span>
          )}
        </motion.div>

        {/* Error */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              background: "rgba(239,68,68,0.12)",
              border: "1px solid rgba(239,68,68,0.35)",
              borderRadius: 8,
              padding: "8px 12px",
              fontSize: "0.8rem",
              color: "#ef4444",
              fontFamily: "Rajdhani, sans-serif",
              textAlign: "center",
            }}
          >
            {error}
          </motion.div>
        )}

        {/* Success */}
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              background: "rgba(0,200,100,0.12)",
              border: "1px solid rgba(0,200,100,0.35)",
              borderRadius: 8,
              padding: "8px 12px",
              fontSize: "0.8rem",
              color: "#00c864",
              fontFamily: "Rajdhani, sans-serif",
              textAlign: "center",
            }}
          >
            {success}
          </motion.div>
        )}

        {/* Register button */}
        <motion.button
          type="button"
          className="fire-btn fire-btn-success"
          onClick={handleRegister}
          disabled={isLoading}
          data-ocid="signup.submit_button"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.4 }}
          whileTap={{ scale: 0.98 }}
          style={{ opacity: isLoading ? 0.7 : 1 }}
        >
          {isLoading ? "Creating account..." : "REGISTER 🎮"}
        </motion.button>

        {/* Login link */}
        <motion.div
          style={{ textAlign: "center" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.78, duration: 0.4 }}
        >
          <button
            type="button"
            className="auth-link"
            onClick={() => onNavigate("login")}
            data-ocid="signup.login.link"
            style={{ color: "#ff6b00" }}
          >
            Already have account? Login
          </button>
        </motion.div>
      </motion.div>

      <AuthFooter />
    </motion.div>
  );
}

// ─── ForgotPasswordView ───────────────────────────────────────────────────────
export function ForgotPasswordView({
  onNavigate,
}: {
  onNavigate: (view: string) => void;
}) {
  const [uid, setUid] = useState("");
  useAuthParticles();

  const waLink = `https://wa.me/917013256124?text=${encodeURIComponent(
    `Hello Admin, I forgot my password. My UID is: ${uid || "[Enter your UID]"}. Please help me reset it.`,
  )}`;

  return (
    <motion.div
      className="auth-page"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      style={{ zIndex: 1 }}
    >
      <div className="auth-watermark">MR.SONIC FF</div>

      <DhurandarHeader tagline="🔑 Password Recovery" />

      <motion.div
        className="auth-form"
        initial={{ opacity: 0, y: 40, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{
          delay: 0.15,
          duration: 0.5,
          type: "spring",
          stiffness: 120,
        }}
        style={{ position: "relative", zIndex: 1 }}
      >
        <div
          style={{
            fontFamily: "Orbitron, sans-serif",
            fontSize: "0.9rem",
            fontWeight: 700,
            color: "#ffffff",
            textAlign: "center",
            marginBottom: 4,
            letterSpacing: "0.05em",
          }}
        >
          Forgot Password?
        </div>

        <motion.div
          className="field-group"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
        >
          <div className="field-label">Your Player UID</div>
          <input
            className="fire-input"
            placeholder="Enter your UID"
            value={uid}
            onChange={(e) => setUid(e.target.value)}
            data-ocid="forgot.uid.input"
          />
          <p
            style={{
              fontSize: "0.75rem",
              color: "rgba(255,255,255,0.4)",
              fontFamily: "Rajdhani, sans-serif",
              marginTop: 4,
            }}
          >
            Enter your UID above, then contact admin via WhatsApp to reset your
            password.
          </p>
        </motion.div>

        {/* Admin contact box */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.4 }}
          style={{
            background:
              "linear-gradient(135deg, rgba(0,200,100,0.08), rgba(10,10,26,0.8))",
            border: "1px solid rgba(0,200,100,0.3)",
            borderRadius: 12,
            padding: "14px 16px",
          }}
        >
          <div
            style={{
              fontFamily: "Rajdhani, sans-serif",
              fontSize: "0.78rem",
              color: "rgba(255,255,255,0.55)",
              marginBottom: 10,
              lineHeight: 1.5,
            }}
          >
            📞 <strong style={{ color: "#00c864" }}>Contact Admin</strong> for
            password reset. Our support is available daily.
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "0.65rem",
                  fontFamily: "Orbitron, sans-serif",
                  color: "rgba(255,255,255,0.4)",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                }}
              >
                WhatsApp
              </div>
              <div
                style={{
                  fontFamily: "Orbitron, sans-serif",
                  fontSize: "0.9rem",
                  fontWeight: 700,
                  color: "#ffffff",
                }}
              >
                7013256124
              </div>
            </div>
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              data-ocid="forgot.wa.link"
              style={{
                padding: "8px 14px",
                background: "linear-gradient(135deg, #00c864, #00a050)",
                color: "white",
                fontFamily: "Orbitron, sans-serif",
                fontSize: "0.65rem",
                fontWeight: 700,
                borderRadius: 8,
                letterSpacing: "0.05em",
                textDecoration: "none",
                display: "inline-block",
                boxShadow: "0 4px 14px rgba(0,200,100,0.35)",
              }}
            >
              💬 CHAT
            </a>
          </div>
        </motion.div>

        {/* Back to login */}
        <motion.div
          style={{ textAlign: "center" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.4 }}
        >
          <button
            type="button"
            className="auth-link"
            onClick={() => onNavigate("login")}
            data-ocid="forgot.back.link"
            style={{ color: "#ff6b00" }}
          >
            ← Back to Login
          </button>
        </motion.div>
      </motion.div>

      <AuthFooter />
    </motion.div>
  );
}

// ─── BlockedView ──────────────────────────────────────────────────────────────
export function BlockedView({
  banReason,
  onNavigate,
}: {
  banReason: string;
  onNavigate: (view: string) => void;
}) {
  const waLink = `https://wa.me/917013256124?text=${encodeURIComponent("Hello Admin, my account has been suspended. Please help me.")}`;

  return (
    <motion.div
      className="blocked-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Big warning icon */}
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, type: "spring" }}
        style={{ fontSize: "5rem", marginBottom: 16 }}
      >
        🚫
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        style={{
          fontFamily: "Orbitron, sans-serif",
          fontSize: "1.2rem",
          fontWeight: 900,
          color: "#ff6b00",
          letterSpacing: "0.06em",
          marginBottom: 12,
          textAlign: "center",
        }}
      >
        Account Suspended
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        style={{
          background: "rgba(239,68,68,0.1)",
          border: "1px solid rgba(239,68,68,0.3)",
          borderRadius: 12,
          padding: "14px 18px",
          maxWidth: 340,
          width: "90%",
          marginBottom: 24,
        }}
      >
        <div
          style={{
            fontSize: "0.72rem",
            fontFamily: "Orbitron, sans-serif",
            color: "rgba(255,255,255,0.4)",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            marginBottom: 6,
          }}
        >
          Reason
        </div>
        <div
          style={{
            fontFamily: "Rajdhani, sans-serif",
            fontSize: "0.9rem",
            color: "rgba(255,255,255,0.8)",
            lineHeight: 1.5,
          }}
        >
          {banReason ||
            "Your account has been suspended. Please contact admin for more information."}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          width: "90%",
          maxWidth: 340,
        }}
      >
        <a
          href={waLink}
          target="_blank"
          rel="noopener noreferrer"
          data-ocid="blocked.wa.button"
          style={{
            display: "block",
            textAlign: "center",
            padding: "13px 20px",
            background: "linear-gradient(135deg, #00c864, #00a050)",
            color: "white",
            fontFamily: "Orbitron, sans-serif",
            fontSize: "0.75rem",
            fontWeight: 700,
            borderRadius: 10,
            textDecoration: "none",
            letterSpacing: "0.05em",
            boxShadow: "0 4px 16px rgba(0,200,100,0.35)",
          }}
        >
          💬 Contact Admin on WhatsApp
        </a>
        <button
          type="button"
          onClick={() => onNavigate("login")}
          data-ocid="blocked.back.button"
          style={{
            padding: "11px 20px",
            background: "rgba(255,107,0,0.1)",
            border: "1px solid rgba(255,107,0,0.25)",
            borderRadius: 10,
            color: "rgba(255,255,255,0.6)",
            fontFamily: "Rajdhani, sans-serif",
            fontSize: "0.85rem",
            fontWeight: 600,
            cursor: "pointer",
            letterSpacing: "0.03em",
          }}
        >
          ← Back to Login
        </button>
      </motion.div>
    </motion.div>
  );
}
