import { useCallback, useEffect, useRef, useState } from "react";
import {
  isMuted,
  playCashout,
  playDragonHit,
  playGameStart,
  playHoverTile,
  playTileFlip,
  setMuted,
} from "./sounds";

// ─── Types ────────────────────────────────────────────────────────────────────
type GameState = "idle" | "playing" | "won" | "lost";

type DragonCount = 3 | 5 | 7 | 10;

interface TileState {
  index: number;
  revealed: boolean;
  isDragon: boolean;
  isHit: boolean;
}

interface LiveBetEntry {
  id: number;
  name: string;
  bet: number;
  dragons: DragonCount;
  result: string;
  won: boolean;
}

// ─── Constants ───────────────────────────────────────────────────────────────
const TOTAL_TILES = 25;
const DRAGON_OPTIONS: DragonCount[] = [3, 5, 7, 10];
const QUICK_BETS = [30, 50, 100, 200, 500];
const MIN_BET = 30;
const MIN_WITHDRAW = 100;
const DEMO_TOPUP = 500;

const PLAYER_NAMES = [
  "Shadow_X",
  "DrakeX99",
  "VortexKing",
  "Phantom77",
  "NovaStrike",
  "IronWolf",
  "StormRider",
  "GhostFire",
  "BladeX21",
  "DarkMage",
  "CryptoKing",
  "SkyHunter",
  "NightOwl",
  "TigerClaws",
  "RubyBlaze",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function generateDragonPositions(count: DragonCount): Set<number> {
  const positions = new Set<number>();
  while (positions.size < count) {
    positions.add(Math.floor(Math.random() * TOTAL_TILES));
  }
  return positions;
}

function tileLabel(index: number): string {
  const row = String.fromCharCode(65 + Math.floor(index / 5));
  const col = (index % 5) + 1;
  return `${row}${col}`;
}

function calcMultiplier(
  prev: number,
  totalTiles: number,
  safeFound: number,
  dragons: number,
): number {
  const remaining = totalTiles - safeFound;
  const safeTilesLeft = remaining - dragons;
  if (safeTilesLeft <= 0) return prev;
  return prev * (remaining / safeTilesLeft);
}

function formatCurrency(n: number): string {
  return `₹${n.toFixed(0)}`;
}

function randomBetween(a: number, b: number): number {
  return Math.floor(Math.random() * (b - a + 1)) + a;
}

function safeParseFloat(val: string): number {
  return Number.parseFloat(val);
}

function safeIsNaN(val: number): boolean {
  return Number.isNaN(val);
}

// ─── Live Bet Row ───────────────────────────────────────────────────────────
function LiveBetRow({ entry, isNew }: { entry: LiveBetEntry; isNew: boolean }) {
  return (
    <div className={`dm-live-row${isNew ? " dm-live-row--new" : ""}`}>
      <span className="dm-live-name">{entry.name}</span>
      <span className="dm-live-bet">{formatCurrency(entry.bet)}</span>
      <span className="dm-live-dragons">{entry.dragons}🐉</span>
      <span
        className={`dm-live-result${entry.won ? " dm-live-result--win" : " dm-live-result--loss"}`}
      >
        {entry.result}
      </span>
    </div>
  );
}

// ─── Tile Component ───────────────────────────────────────────────────────────
function GameTile({
  tile,
  gameState,
  onClick,
  onHover,
}: {
  tile: TileState;
  gameState: GameState;
  onClick: () => void;
  onHover: () => void;
}) {
  const clickable = gameState === "playing" && !tile.revealed;

  let cls = "dm-tile";
  if (tile.revealed) {
    if (tile.isDragon) {
      cls += tile.isHit ? " dm-tile--dragon-hit" : " dm-tile--dragon";
    } else {
      cls += " dm-tile--gem";
    }
  } else {
    cls += " dm-tile--hidden";
    if (clickable) cls += " dm-tile--clickable";
  }

  return (
    <button
      type="button"
      className={cls}
      onClick={clickable ? onClick : undefined}
      onMouseEnter={clickable ? onHover : undefined}
      disabled={!clickable}
      aria-label={`Tile ${tileLabel(tile.index)}`}
      data-ocid={`tile.item.${tile.index + 1}`}
    >
      {tile.revealed ? (
        tile.isDragon ? (
          <span className="dm-tile-icon dm-tile-dragon-icon">
            {tile.isHit ? "💥" : "🐉"}
          </span>
        ) : (
          <span className="dm-tile-icon dm-tile-gem-icon">💎</span>
        )
      ) : (
        <span className="dm-tile-label">{tileLabel(tile.index)}</span>
      )}
    </button>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [balance, setBalance] = useState<number>(() => {
    const saved = localStorage.getItem("dm_balance");
    return saved ? safeParseFloat(saved) : 500;
  });

  const [gameState, setGameState] = useState<GameState>("idle");
  const [betAmount, setBetAmount] = useState<number>(50);
  const [betInput, setBetInput] = useState<string>("50");
  const [dragonCount, setDragonCount] = useState<DragonCount>(5);
  const [tiles, setTiles] = useState<TileState[]>(
    Array.from({ length: TOTAL_TILES }, (_, i) => ({
      index: i,
      revealed: false,
      isDragon: false,
      isHit: false,
    })),
  );
  const [gemsFound, setGemsFound] = useState<number>(0);
  const [multiplier, setMultiplier] = useState<number>(1.0);
  const [currentWin, setCurrentWin] = useState<number>(0);
  const [resultMsg, setResultMsg] = useState<string>("");
  const [betError, setBetError] = useState<string>("");
  const [mute, setMuteState] = useState<boolean>(false);

  const [liveBets, setLiveBets] = useState<LiveBetEntry[]>(() => {
    const initial: LiveBetEntry[] = [];
    for (let i = 0; i < 6; i++) {
      initial.push(generateFakeBet(i));
    }
    return initial;
  });
  const [newestBetId, setNewestBetId] = useState<number>(-1);
  const liveBetIdRef = useRef<number>(100);

  const [showWithdraw, setShowWithdraw] = useState<boolean>(false);
  const [withdrawAmount, setWithdrawAmount] = useState<string>("");
  const [withdrawMsg, setWithdrawMsg] = useState<string>("");

  useEffect(() => {
    localStorage.setItem("dm_balance", balance.toString());
  }, [balance]);

  useEffect(() => {
    const interval = setInterval(
      () => {
        const newId = ++liveBetIdRef.current;
        const newBet = generateFakeBet(newId);
        setLiveBets((prev) => [newBet, ...prev.slice(0, 7)]);
        setNewestBetId(newId);
      },
      randomBetween(2800, 4500),
    );
    return () => clearInterval(interval);
  }, []);

  function generateFakeBet(id: number): LiveBetEntry {
    const won = Math.random() > 0.45;
    const dc =
      DRAGON_OPTIONS[Math.floor(Math.random() * DRAGON_OPTIONS.length)];
    const bet = QUICK_BETS[Math.floor(Math.random() * QUICK_BETS.length)];
    const multi = (1 + Math.random() * 8).toFixed(2);
    return {
      id,
      name: `${PLAYER_NAMES[Math.floor(Math.random() * PLAYER_NAMES.length)]}_${randomBetween(10, 99)}`,
      bet,
      dragons: dc,
      result: won ? `${multi}x` : "🐉 Hit",
      won,
    };
  }

  const toggleMute = useCallback(() => {
    setMuteState((prev) => {
      setMuted(!prev);
      return !prev;
    });
  }, []);

  function parseBet(val: string): number | null {
    const n = safeParseFloat(val);
    if (safeIsNaN(n) || n < MIN_BET) return null;
    if (n > balance) return null;
    return n;
  }

  function handleBetInput(val: string) {
    setBetInput(val);
    const n = safeParseFloat(val);
    if (!safeIsNaN(n) && n >= MIN_BET && n <= balance) {
      setBetAmount(n);
      setBetError("");
    }
  }

  function handleQuickBet(amount: number) {
    if (gameState !== "idle") return;
    const clamped = Math.min(amount, balance);
    setBetAmount(clamped);
    setBetInput(clamped.toString());
    setBetError("");
  }

  function handleStartGame() {
    const bet = parseBet(betInput);
    if (bet === null) {
      if (safeParseFloat(betInput) < MIN_BET) {
        setBetError(`Minimum bet is ${formatCurrency(MIN_BET)}`);
      } else {
        setBetError("Insufficient balance");
      }
      return;
    }
    setBetError("");

    const positions = generateDragonPositions(dragonCount);

    const freshTiles: TileState[] = Array.from(
      { length: TOTAL_TILES },
      (_, i) => ({
        index: i,
        revealed: false,
        isDragon: positions.has(i),
        isHit: false,
      }),
    );

    setTiles(freshTiles);
    setGemsFound(0);
    setMultiplier(1.0);
    setCurrentWin(bet);
    setBetAmount(bet);
    setBalance((prev) => prev - bet);
    setGameState("playing");
    setResultMsg("");
    playGameStart();
  }

  function handleTileClick(tileIndex: number) {
    if (gameState !== "playing") return;
    const tile = tiles[tileIndex];
    if (tile.revealed) return;

    if (tile.isDragon) {
      playDragonHit();
      setTiles((prev) =>
        prev.map((t) => {
          if (t.index === tileIndex)
            return { ...t, revealed: true, isHit: true };
          if (t.isDragon) return { ...t, revealed: true };
          return t;
        }),
      );
      setGameState("lost");
      setResultMsg("YOU HIT A DRAGON! 🐉");
    } else {
      playTileFlip();
      const newGemsFound = gemsFound + 1;
      const newMult = calcMultiplier(
        multiplier,
        TOTAL_TILES,
        gemsFound,
        dragonCount,
      );
      const newWin = betAmount * newMult;

      setTiles((prev) =>
        prev.map((t) => (t.index === tileIndex ? { ...t, revealed: true } : t)),
      );
      setGemsFound(newGemsFound);
      setMultiplier(newMult);
      setCurrentWin(newWin);

      const safeTiles = TOTAL_TILES - dragonCount;
      if (newGemsFound >= safeTiles) {
        playCashout();
        setBalance((prev) => prev + newWin);
        setTiles((prev) =>
          prev.map((t) => (t.isDragon ? { ...t, revealed: true } : t)),
        );
        setGameState("won");
        setResultMsg(`ALL GEMS FOUND! 💎 +${formatCurrency(newWin)}`);
      }
    }
  }

  function handleCashout() {
    if (gameState !== "playing") return;
    playCashout();
    setBalance((prev) => prev + currentWin);
    setTiles((prev) =>
      prev.map((t) => (t.isDragon ? { ...t, revealed: true } : t)),
    );
    setGameState("won");
    setResultMsg(`CASHED OUT! 💎 +${formatCurrency(currentWin)}`);
  }

  function handlePlayAgain() {
    setGameState("idle");
    setTiles(
      Array.from({ length: TOTAL_TILES }, (_, i) => ({
        index: i,
        revealed: false,
        isDragon: false,
        isHit: false,
      })),
    );
    setGemsFound(0);
    setMultiplier(1.0);
    setCurrentWin(0);
    setResultMsg("");
  }

  function handleTopUp() {
    setBalance((prev) => prev + DEMO_TOPUP);
  }

  function handleWithdraw() {
    const amt = safeParseFloat(withdrawAmount);
    if (safeIsNaN(amt) || amt < MIN_WITHDRAW) {
      setWithdrawMsg(`Minimum withdrawal is ${formatCurrency(MIN_WITHDRAW)}`);
      return;
    }
    if (amt > balance) {
      setWithdrawMsg("Insufficient balance");
      return;
    }
    setBalance((prev) => prev - amt);
    setWithdrawMsg(
      `Withdrawal of ${formatCurrency(amt)} requested! (Demo mode)`,
    );
    setWithdrawAmount("");
  }

  function closeWithdraw() {
    setShowWithdraw(false);
    setWithdrawMsg("");
  }

  const isPlaying = gameState === "playing";

  return (
    <div className="dm-root">
      <div className="dm-bg-glow" aria-hidden="true" />
      <div className="dm-bg-smoke" aria-hidden="true" />

      {/* HEADER */}
      <header className="dm-header">
        <div className="dm-brand">
          <span className="dm-brand-dragon">🐉</span>
          <span className="dm-brand-text">DRAGON MINE</span>
        </div>
        <div className="dm-header-right">
          <button
            type="button"
            className="dm-wallet-pill"
            onClick={() => setShowWithdraw(true)}
            data-ocid="wallet.button"
          >
            <span className="dm-wallet-icon">💰</span>
            <span className="dm-wallet-balance">{formatCurrency(balance)}</span>
          </button>
          <button
            type="button"
            className="dm-mute-btn"
            onClick={toggleMute}
            aria-label={mute ? "Unmute" : "Mute"}
            data-ocid="mute.toggle"
          >
            {mute ? "🔇" : "🔊"}
          </button>
        </div>
      </header>

      {/* MAIN */}
      <main className="dm-main">
        {/* LEFT PANEL */}
        <aside className="dm-panel dm-controls-panel">
          <div className="dm-panel-inner">
            {/* Balance */}
            <div className="dm-balance-display">
              <span className="dm-balance-label">YOUR BALANCE</span>
              <span className="dm-balance-value">
                {formatCurrency(balance)}
              </span>
              <button
                type="button"
                className="dm-topup-btn"
                onClick={handleTopUp}
                data-ocid="topup.button"
              >
                + TOP UP ₹500
              </button>
            </div>

            {/* Bet amount */}
            <div className="dm-section">
              <span className="dm-section-label" id="bet-label">
                BET AMOUNT
              </span>
              <div className="dm-bet-row">
                <button
                  type="button"
                  className="dm-stepper-btn"
                  onClick={() =>
                    handleBetInput(Math.max(MIN_BET, betAmount - 10).toString())
                  }
                  disabled={isPlaying}
                  data-ocid="bet.minus_button"
                >
                  −
                </button>
                <input
                  className="dm-bet-input"
                  type="number"
                  value={betInput}
                  onChange={(e) => handleBetInput(e.target.value)}
                  disabled={isPlaying}
                  min={MIN_BET}
                  aria-labelledby="bet-label"
                  data-ocid="bet.input"
                />
                <button
                  type="button"
                  className="dm-stepper-btn"
                  onClick={() =>
                    handleBetInput(Math.min(balance, betAmount + 10).toString())
                  }
                  disabled={isPlaying}
                  data-ocid="bet.plus_button"
                >
                  +
                </button>
              </div>
              {betError && (
                <p className="dm-error-msg" data-ocid="bet.error_state">
                  {betError}
                </p>
              )}

              <div className="dm-quick-bets">
                {QUICK_BETS.map((qb, qi) => (
                  <button
                    type="button"
                    key={qb}
                    className={`dm-quick-bet${betAmount === qb ? " dm-quick-bet--active" : ""}`}
                    onClick={() => handleQuickBet(qb)}
                    disabled={isPlaying}
                    data-ocid={`bet.item.${qi + 1}`}
                  >
                    ₹{qb}
                  </button>
                ))}
              </div>
            </div>

            {/* Dragon count */}
            <div className="dm-section">
              <span className="dm-section-label">DRAGONS IN MINE</span>
              <div className="dm-dragon-selector">
                {DRAGON_OPTIONS.map((dc, di) => (
                  <button
                    type="button"
                    key={dc}
                    className={`dm-dragon-opt${dragonCount === dc ? " dm-dragon-opt--active" : ""}`}
                    onClick={() => !isPlaying && setDragonCount(dc)}
                    disabled={isPlaying}
                    data-ocid={`dragons.item.${di + 1}`}
                  >
                    {dc}
                  </button>
                ))}
              </div>
              <p className="dm-dragon-hint">
                {dragonCount} dragons hidden in {TOTAL_TILES} tiles
              </p>
            </div>

            {/* Start */}
            {gameState === "idle" && (
              <button
                type="button"
                className="dm-start-btn"
                onClick={handleStartGame}
                data-ocid="game.primary_button"
              >
                ⚔️ START GAME
              </button>
            )}

            {/* Cashout */}
            {isPlaying && (
              <button
                type="button"
                className="dm-cashout-btn"
                onClick={handleCashout}
                data-ocid="game.cashout_button"
              >
                <span className="dm-cashout-label">💎 CASH OUT</span>
                <span className="dm-cashout-amount">
                  {formatCurrency(currentWin)}
                </span>
              </button>
            )}

            {/* Play again */}
            {(gameState === "won" || gameState === "lost") && (
              <button
                type="button"
                className="dm-again-btn"
                onClick={handlePlayAgain}
                data-ocid="game.secondary_button"
              >
                🔄 PLAY AGAIN
              </button>
            )}
          </div>
        </aside>

        {/* CENTER — Game Board */}
        <section className="dm-panel dm-board-panel">
          {/* Stats */}
          <div className="dm-stats">
            <div className="dm-stat">
              <span className="dm-stat-label">GEMS FOUND</span>
              <span className="dm-stat-value dm-stat-gems">{gemsFound}</span>
            </div>
            <div className="dm-stat">
              <span className="dm-stat-label">MULTIPLIER</span>
              <span
                className={`dm-stat-value dm-stat-mult${multiplier >= 3 ? " dm-stat-mult--hot" : ""}`}
              >
                {multiplier.toFixed(2)}x
              </span>
            </div>
            <div className="dm-stat">
              <span className="dm-stat-label">CURRENT WIN</span>
              <span className="dm-stat-value dm-stat-win">
                {formatCurrency(currentWin)}
              </span>
            </div>
          </div>

          {/* Result banner */}
          {resultMsg && (
            <div
              className={`dm-result-banner${gameState === "lost" ? " dm-result-banner--loss" : " dm-result-banner--win"}`}
              data-ocid="game.success_state"
            >
              {resultMsg}
            </div>
          )}

          {/* Grid */}
          <div className="dm-grid" data-ocid="game.canvas_target">
            {tiles.map((tile) => (
              <GameTile
                key={tile.index}
                tile={tile}
                gameState={gameState}
                onClick={() => handleTileClick(tile.index)}
                onHover={() => playHoverTile()}
              />
            ))}
          </div>
        </section>
      </main>

      {/* LIVE BETS */}
      <section className="dm-live-section">
        <div className="dm-section-header">
          <span className="dm-live-dot" />
          <h2 className="dm-section-title">LIVE BETS</h2>
        </div>
        <div className="dm-live-table">
          <div className="dm-live-header-row">
            <span>PLAYER</span>
            <span>BET</span>
            <span>DRAGONS</span>
            <span>RESULT</span>
          </div>
          {liveBets.slice(0, 7).map((entry) => (
            <LiveBetRow
              key={entry.id}
              entry={entry}
              isNew={entry.id === newestBetId}
            />
          ))}
        </div>
      </section>

      {/* HOW TO PLAY */}
      <section className="dm-how-section">
        <h2 className="dm-section-title">HOW TO PLAY</h2>
        <div className="dm-how-cards">
          <div className="dm-how-card">
            <span className="dm-how-num">1</span>
            <span className="dm-how-icon">🎯</span>
            <h3 className="dm-how-title">Set Bet &amp; Dragons</h3>
            <p className="dm-how-desc">
              Choose your bet amount (min ₹30) and how many dragons lurk in the
              mine.
            </p>
          </div>
          <div className="dm-how-card">
            <span className="dm-how-num">2</span>
            <span className="dm-how-icon">💎</span>
            <h3 className="dm-how-title">Click Tiles for Gems</h3>
            <p className="dm-how-desc">
              Each safe tile reveals a gem and raises your multiplier. More
              dragons = faster rise.
            </p>
          </div>
          <div className="dm-how-card">
            <span className="dm-how-num">3</span>
            <span className="dm-how-icon">💰</span>
            <h3 className="dm-how-title">Cash Out to Win</h3>
            <p className="dm-how-desc">
              Cash out anytime after your first gem. Hit a dragon and lose it
              all!
            </p>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="dm-footer">
        <p>
          © {new Date().getFullYear()}. Built with ❤️ using{" "}
          <a
            href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="dm-footer-link"
          >
            caffeine.ai
          </a>
        </p>
        <p className="dm-footer-demo">
          Demo mode — Min bet ₹{MIN_BET} · Min withdrawal ₹{MIN_WITHDRAW}
        </p>
      </footer>

      {/* WITHDRAW MODAL */}
      {showWithdraw && (
        <div className="dm-modal-overlay" data-ocid="withdraw.modal">
          <dialog className="dm-modal" open aria-label="Withdraw funds">
            <h2 className="dm-modal-title">💸 WITHDRAW</h2>
            <p className="dm-modal-balance">
              Balance: <strong>{formatCurrency(balance)}</strong>
            </p>
            <p className="dm-modal-note">
              Minimum withdrawal: {formatCurrency(MIN_WITHDRAW)}
            </p>
            <input
              className="dm-modal-input"
              type="number"
              placeholder={`Amount (min ₹${MIN_WITHDRAW})`}
              value={withdrawAmount}
              onChange={(e) => {
                setWithdrawAmount(e.target.value);
                setWithdrawMsg("");
              }}
              aria-label="Withdrawal amount"
              data-ocid="withdraw.input"
            />
            {withdrawMsg && (
              <p
                className={`dm-modal-msg${withdrawMsg.includes("requested") ? " dm-modal-msg--ok" : " dm-modal-msg--err"}`}
                data-ocid="withdraw.success_state"
              >
                {withdrawMsg}
              </p>
            )}
            <div className="dm-modal-actions">
              <button
                type="button"
                className="dm-modal-cancel"
                onClick={closeWithdraw}
                data-ocid="withdraw.cancel_button"
              >
                Cancel
              </button>
              <button
                type="button"
                className="dm-modal-confirm"
                onClick={handleWithdraw}
                data-ocid="withdraw.confirm_button"
              >
                Withdraw
              </button>
            </div>
          </dialog>
        </div>
      )}
    </div>
  );
}
