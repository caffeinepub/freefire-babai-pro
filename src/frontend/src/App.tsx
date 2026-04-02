import { useCallback, useEffect, useRef, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
type GameState = "idle" | "running" | "crashed" | "cashout";
type MultiplierColor = "safe" | "warning" | "danger";

interface Point {
  x: number; // SVG viewport units
  y: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────
// SVG viewBox dimensions — we work in these units so math is clean
const VW = 400;
const VH = 280;

// The curve origin — bottom-left
const ORIGIN_X = 28;
const ORIGIN_Y = VH - 30;

// Maximum travel the tip can reach (in SVG units)
const MAX_X = VW - 20;
const MAX_Y = 24; // top of canvas

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getMultiplierColor(value: number): MultiplierColor {
  if (value < 2) return "safe";
  if (value < 4) return "warning";
  return "danger";
}

function formatMultiplier(value: number): string {
  return `${value.toFixed(2)}x`;
}

function formatCurrency(amount: number): string {
  return `₹${amount.toFixed(2)}`;
}

/**
 * Maps a multiplier value to an SVG tip point along the exponential curve.
 * Uses a sqrt-based curve so early growth is fast (like the real Aviator).
 */
function multiplierToPoint(m: number, crashPoint: number): Point {
  // progress 0→1 over the full run
  const raw = Math.min((m - 1) / (crashPoint - 1 + 0.001), 1);
  // shape: sqrt makes early portion steeper, matching Aviator's curve feel
  const tX = raw;
  const tY = raw ** 0.55; // curves upward faster than linear
  return {
    x: ORIGIN_X + tX * (MAX_X - ORIGIN_X),
    y: ORIGIN_Y - tY * (ORIGIN_Y - MAX_Y),
  };
}

/**
 * Build a smooth SVG path string from an array of points using
 * cardinal spline — same effect as the real Aviator growing curve.
 */
function buildPath(points: Point[]): string {
  if (points.length < 2) return "";
  const d = points
    .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
    .join(" ");
  return d;
}

/**
 * Build the filled-area path: curve + close to bottom
 */
function buildAreaPath(points: Point[]): string {
  if (points.length < 2) return "";
  const stroke = buildPath(points);
  const last = points[points.length - 1];
  return `${stroke} L ${last.x} ${ORIGIN_Y} L ${ORIGIN_X} ${ORIGIN_Y} Z`;
}

// ─── PlaneIcon ────────────────────────────────────────────────────────────────
function PlaneIcon({
  color,
  animClass,
  angle,
}: {
  color: MultiplierColor;
  animClass: string;
  angle: number;
}) {
  const glowColor =
    color === "safe"
      ? "oklch(0.75 0.22 150)"
      : color === "warning"
        ? "oklch(0.78 0.18 75)"
        : "oklch(0.60 0.25 25)";

  return (
    <span
      className={animClass}
      style={{
        fontSize: "2rem",
        display: "inline-block",
        transform: `rotate(${angle}deg)`,
        filter: `drop-shadow(0 0 10px ${glowColor}) drop-shadow(0 0 20px ${glowColor})`,
        lineHeight: 1,
      }}
      role="img"
      aria-label="rocket"
    >
      🚀
    </span>
  );
}

// ─── HistoryPill ──────────────────────────────────────────────────────────────
function HistoryPill({ value, isNew }: { value: number; isNew: boolean }) {
  const color = getMultiplierColor(value);
  const colorMap: Record<MultiplierColor, string> = {
    safe: "pill-safe",
    warning: "pill-warn",
    danger: "pill-danger",
  };
  return (
    <span className={`pill ${colorMap[color]} ${isNew ? "pill-new" : ""}`}>
      {formatMultiplier(value)}
    </span>
  );
}

// ─── Y-axis labels ────────────────────────────────────────────────────────────
function AxisLabels({ crashPoint }: { crashPoint: number }) {
  // show labels at 1x, 2x, 3x, etc up to crashPoint
  const max = Math.ceil(crashPoint);
  const labels: Array<{ v: number; y: number }> = [];
  for (let v = 1; v <= max; v++) {
    if (v === 1) continue; // skip origin
    const pt = multiplierToPoint(v, crashPoint);
    labels.push({ v, y: pt.y });
  }
  return (
    <>
      {labels.map(({ v, y }) => (
        <text
          key={v}
          x={ORIGIN_X - 4}
          y={y + 4}
          textAnchor="end"
          fontSize="9"
          fill="oklch(0.45 0.04 255)"
          fontFamily="'Bricolage Grotesque', sans-serif"
        >
          {v}x
        </text>
      ))}
      {/* horizontal dashed guide lines */}
      {labels.map(({ v, y }) => (
        <line
          key={`h-${v}`}
          x1={ORIGIN_X}
          y1={y}
          x2={MAX_X}
          y2={y}
          stroke="oklch(0.22 0.04 255 / 0.5)"
          strokeWidth="0.5"
          strokeDasharray="4 4"
        />
      ))}
    </>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [multiplier, setMultiplier] = useState<number>(1.0);
  const [gameState, setGameState] = useState<GameState>("idle");
  const [cashOutValue, setCashOutValue] = useState<number | null>(null);
  const [history, setHistory] = useState<number[]>([
    8.42, 1.23, 3.77, 2.01, 5.6, 1.87, 4.32, 1.45, 9.1, 2.68,
  ]);
  const [betAmount, setBetAmount] = useState<string>("100");
  // The live growing curve — array of SVG points
  const [curvePoints, setCurvePoints] = useState<Point[]>([]);
  const [planeAngle, setPlaneAngle] = useState<number>(-45);
  const [tipPoint, setTipPoint] = useState<Point>({ x: ORIGIN_X, y: ORIGIN_Y });
  const [shaking, setShaking] = useState<boolean>(false);
  const [showCrashFlash, setShowCrashFlash] = useState<boolean>(false);
  const [showCashoutFlash, setShowCashoutFlash] = useState<boolean>(false);
  const [newestHistoryIndex, setNewestHistoryIndex] = useState<number>(-1);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const crashPointRef = useRef<number>(3.0);
  const multiplierRef = useRef<number>(1.0);
  const prevTipRef = useRef<Point>({ x: ORIGIN_X, y: ORIGIN_Y });
  const historyScrollRef = useRef<HTMLDivElement>(null);
  const gameAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const scrollHistoryToStart = useCallback(() => {
    requestAnimationFrame(() => {
      historyScrollRef.current?.scrollTo({ left: 0, behavior: "smooth" });
    });
  }, []);

  const stopInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startGame = useCallback(() => {
    if (gameState === "running") return;

    const cp = Number.parseFloat((Math.random() * 5.5 + 1.2).toFixed(2));
    crashPointRef.current = cp;
    multiplierRef.current = 1.0;

    const origin: Point = { x: ORIGIN_X, y: ORIGIN_Y };
    prevTipRef.current = origin;

    setMultiplier(1.0);
    setCashOutValue(null);
    setCurvePoints([origin]);
    setTipPoint(origin);
    setPlaneAngle(-45);
    setShaking(false);
    setShowCrashFlash(false);
    setShowCashoutFlash(false);
    setGameState("running");

    intervalRef.current = setInterval(() => {
      multiplierRef.current = Number.parseFloat(
        (multiplierRef.current + 0.05).toFixed(2),
      );
      const current = multiplierRef.current;
      const cp2 = crashPointRef.current;

      const newTip = multiplierToPoint(current, cp2);
      const prev = prevTipRef.current;

      // Compute angle from previous tip to current tip (for rocket orientation)
      const dx = newTip.x - prev.x;
      const dy = newTip.y - prev.y; // negative = going up
      const angleDeg = Math.atan2(dy, dx) * (180 / Math.PI);

      prevTipRef.current = newTip;

      setCurvePoints((pts) => [...pts, newTip]);
      setTipPoint(newTip);
      setPlaneAngle(angleDeg);
      setMultiplier(current);

      if (current >= cp2) {
        stopInterval();
        const finalMult = multiplierRef.current;

        setGameState("crashed");
        setShaking(true);
        setShowCrashFlash(true);
        setHistory((prev2) => [finalMult, ...prev2].slice(0, 10));
        setNewestHistoryIndex(0);
        scrollHistoryToStart();

        setTimeout(() => setShaking(false), 700);
        setTimeout(() => setShowCrashFlash(false), 1000);
        setTimeout(() => setNewestHistoryIndex(-1), 600);
      }
    }, 100);
  }, [gameState, stopInterval, scrollHistoryToStart]);

  const cashOut = useCallback(() => {
    if (gameState !== "running") return;
    stopInterval();
    const current = multiplierRef.current;
    const bet = Number.parseFloat(betAmount) || 0;
    const win = Number.parseFloat((bet * current).toFixed(2));

    setCashOutValue(win);
    setShowCashoutFlash(true);
    setGameState("cashout");
    setHistory((prev) => [current, ...prev].slice(0, 10));
    setNewestHistoryIndex(0);
    scrollHistoryToStart();

    setTimeout(() => setShowCashoutFlash(false), 700);
    setTimeout(() => setNewestHistoryIndex(-1), 600);
  }, [gameState, stopInterval, betAmount, scrollHistoryToStart]);

  // Derived values
  const color = getMultiplierColor(multiplier);
  const bet = Number.parseFloat(betAmount) || 0;
  const potentialWin = Number.parseFloat((bet * multiplier).toFixed(2));

  const strokeColor =
    color === "safe"
      ? "oklch(0.75 0.22 150)"
      : color === "warning"
        ? "oklch(0.78 0.18 75)"
        : "oklch(0.60 0.25 25)";

  const fillColorStop =
    color === "safe"
      ? "oklch(0.75 0.22 150 / 0.18)"
      : color === "warning"
        ? "oklch(0.78 0.18 75 / 0.18)"
        : "oklch(0.60 0.25 25 / 0.18)";

  const multiplierColorClass: Record<MultiplierColor, string> = {
    safe: "text-safe",
    warning: "text-warn",
    danger: "text-danger",
  };
  const multiplierGlowClass: Record<MultiplierColor, string> = {
    safe: "glow-safe",
    warning: "glow-warning",
    danger: "glow-danger",
  };

  // Convert SVG point to percentage for plane positioning
  const planePctX = (tipPoint.x / VW) * 100;
  const planePctY = (tipPoint.y / VH) * 100;

  const crashPoint = crashPointRef.current;

  return (
    <div
      className={`aviator-root${shaking ? " screen-shake" : ""}`}
      ref={gameAreaRef}
    >
      {/* Flash overlays */}
      {showCrashFlash && (
        <div
          className="flash-overlay crash-flash"
          style={{ background: "oklch(0.60 0.25 25 / 0.55)" }}
        />
      )}
      {showCashoutFlash && (
        <div
          className="flash-overlay cashout-flash"
          style={{ background: "oklch(0.75 0.22 150 / 0.30)" }}
        />
      )}

      {/* ══ Header ══════════════════════════════════════════ */}
      <header className="av-header">
        <div className="av-brand">
          <span className="av-brand-icon" role="img" aria-label="plane">
            ✈️
          </span>
          <span className="av-brand-name">AVIATOR</span>
          <span className="av-badge">DEMO</span>
        </div>
        <div className="av-status">
          {gameState === "running" && (
            <span className="status-live">⬤ LIVE</span>
          )}
          {gameState === "crashed" && (
            <span className="status-crashed">⬤ CRASHED</span>
          )}
          {gameState === "cashout" && <span className="status-won">⬤ WON</span>}
          {gameState === "idle" && (
            <span className="status-idle">⬤ WAITING</span>
          )}
        </div>
      </header>

      {/* ══ History Bar ════════════════════════════════════ */}
      <div className="av-history-bar">
        <div
          ref={historyScrollRef}
          className="av-history-scroll history-scroll"
          data-ocid="history.list"
        >
          {history.map((val, idx) => (
            <HistoryPill
              // biome-ignore lint/suspicious/noArrayIndexKey: positional order is stable
              key={`hist-${idx}`}
              value={val}
              isNew={idx === newestHistoryIndex}
            />
          ))}
        </div>
      </div>

      {/* ══ Game Canvas ════════════════════════════════════ */}
      <div className="av-canvas" data-ocid="game.canvas_target">
        {/* Corner vignette */}
        <div className="av-vignette" />

        {/* ── SVG Graph ────────────────────────────────────── */}
        <svg
          aria-hidden="true"
          className="av-graph"
          viewBox={`0 0 ${VW} ${VH}`}
          preserveAspectRatio="none"
        >
          <defs>
            {/* Curve stroke gradient */}
            <linearGradient id="curveGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={strokeColor} stopOpacity="0.3" />
              <stop offset="100%" stopColor={strokeColor} stopOpacity="1" />
            </linearGradient>
            {/* Area fill gradient */}
            <linearGradient id="areaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={fillColorStop} />
              <stop offset="100%" stopColor="oklch(0.10 0.02 255 / 0)" />
            </linearGradient>
            {/* Glow filter for the curve */}
            <filter id="curveGlow" x="-10%" y="-40%" width="120%" height="180%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Axis lines */}
          <line
            x1={ORIGIN_X}
            y1={ORIGIN_Y}
            x2={ORIGIN_X}
            y2={MAX_Y - 4}
            stroke="oklch(0.28 0.04 255)"
            strokeWidth="1"
          />
          <line
            x1={ORIGIN_X}
            y1={ORIGIN_Y}
            x2={MAX_X}
            y2={ORIGIN_Y}
            stroke="oklch(0.28 0.04 255)"
            strokeWidth="1"
          />

          {/* Y-axis labels & guide lines (visible when running/ended) */}
          {(gameState === "running" ||
            gameState === "crashed" ||
            gameState === "cashout") && <AxisLabels crashPoint={crashPoint} />}

          {/* Area fill */}
          {curvePoints.length > 1 && (
            <path
              d={buildAreaPath(curvePoints)}
              fill="url(#areaGrad)"
              stroke="none"
            />
          )}

          {/* Main curve stroke */}
          {curvePoints.length > 1 && (
            <path
              d={buildPath(curvePoints)}
              fill="none"
              stroke="url(#curveGrad)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#curveGlow)"
            />
          )}

          {/* Tip glow dot */}
          {gameState === "running" && (
            <circle
              cx={tipPoint.x}
              cy={tipPoint.y}
              r="5"
              fill={strokeColor}
              opacity="0.9"
              filter="url(#curveGlow)"
            />
          )}
        </svg>

        {/* ── Plane ─────────────────────────────────────────── */}
        {(gameState === "running" || gameState === "crashed") && (
          <div
            className="av-plane"
            style={{
              left: `${planePctX}%`,
              top: `${planePctY}%`,
            }}
          >
            <PlaneIcon
              color={color}
              animClass={
                gameState === "crashed" ? "plane-crash" : "plane-float"
              }
              angle={gameState === "crashed" ? 30 : planeAngle}
            />
          </div>
        )}

        {/* ── Multiplier Display (upper area, not blocking the curve) ── */}
        <div className="av-multiplier-area">
          {gameState === "idle" && (
            <div className="waiting-pulse av-idle-msg">
              <div className="av-idle-title">PLACE YOUR BET</div>
              <div className="av-idle-sub">Press FLY to launch</div>
            </div>
          )}

          {gameState === "running" && (
            <div className="av-live-mult">
              <div
                className={`av-mult-value ${multiplierColorClass[color]} ${multiplierGlowClass[color]}`}
                data-ocid="game.multiplier_display"
              >
                {formatMultiplier(multiplier)}
              </div>
              {bet > 0 && (
                <div className="av-win-preview">₹{potentialWin.toFixed(2)}</div>
              )}
            </div>
          )}

          {gameState === "crashed" && (
            <div className="av-crash-msg" data-ocid="game.crashed_display">
              <div className="av-crash-label">FLEW AWAY</div>
              <div className="av-crash-value">
                {formatMultiplier(multiplier)}
              </div>
            </div>
          )}

          {gameState === "cashout" && cashOutValue !== null && (
            <div
              className="av-cashout-msg win-bounce"
              data-ocid="game.cashout_display"
            >
              <div className="av-cashout-label">CASHED OUT</div>
              <div className="av-cashout-value">
                {formatCurrency(cashOutValue)}
              </div>
              <div className="av-cashout-at">
                at {formatMultiplier(multiplier)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ══ Controls Panel ════════════════════════════════ */}
      <div className="av-controls" data-ocid="controls.panel">
        {/* Bet card */}
        <div className="av-bet-card">
          <div className="av-bet-label">BET AMOUNT</div>
          <div className="av-bet-input-row">
            <div className="av-input-wrap">
              <span className="av-currency">₹</span>
              <input
                type="number"
                min="1"
                value={betAmount}
                onChange={(e) => setBetAmount(e.target.value)}
                disabled={gameState === "running"}
                placeholder="0.00"
                className="av-input bet-input"
                data-ocid="bet.input"
              />
            </div>
            <div className="av-quick-bets">
              {["50", "200", "500"].map((amt) => (
                <button
                  type="button"
                  key={amt}
                  onClick={() => setBetAmount(amt)}
                  disabled={gameState === "running"}
                  className="av-quick-btn"
                >
                  +{amt}
                </button>
              ))}
            </div>
          </div>

          {gameState === "running" && bet > 0 && (
            <div className="av-pot-win">
              <span className="av-pot-label">POTENTIAL WIN</span>
              <span className={`av-pot-value ${multiplierColorClass[color]}`}>
                {formatCurrency(potentialWin)}
              </span>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="av-actions">
          <button
            type="button"
            onClick={startGame}
            disabled={gameState === "running"}
            className="btn-start av-btn"
            data-ocid="game.start_button"
          >
            {gameState === "idle"
              ? "🚀 FLY!"
              : gameState === "running"
                ? "FLYING..."
                : "🚀 FLY AGAIN"}
          </button>
          <button
            type="button"
            onClick={cashOut}
            disabled={gameState !== "running"}
            className="btn-cashout av-btn"
            data-ocid="game.cashout_button"
          >
            {gameState === "running"
              ? `💰 CASH OUT · ${formatMultiplier(multiplier)}`
              : "CASH OUT"}
          </button>
        </div>
      </div>

      {/* ══ Footer ════════════════════════════════════════ */}
      <footer className="av-footer">
        © {new Date().getFullYear()}.{" "}
        <a
          href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Built with ❤️ using caffeine.ai
        </a>
      </footer>
    </div>
  );
}
