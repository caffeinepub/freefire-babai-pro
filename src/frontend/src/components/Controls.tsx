import type React from "react";
import { useCallback, useEffect, useRef } from "react";
import type { InputState } from "../game/physics";

interface Props {
  inputRef: React.MutableRefObject<InputState>;
}

export default function Controls({ inputRef }: Props) {
  const isMobile = typeof window !== "undefined" && "ontouchstart" in window;

  const setKey = useCallback(
    (key: keyof InputState, val: boolean) => {
      inputRef.current[key] = val;
    },
    [inputRef],
  );

  const dpadHandler = useCallback(
    (dir: "left" | "right" | "up" | "down" | "none", active: boolean) => {
      if (dir === "left") setKey("left", active);
      if (dir === "right") setKey("right", active);
      if (dir === "up") setKey("up", active);
      if (dir === "down") setKey("down", active);
      if (dir === "none" && !active) {
        setKey("left", false);
        setKey("right", false);
        setKey("up", false);
        setKey("down", false);
      }
    },
    [setKey],
  );

  const touchMove = useCallback(
    (e: React.TouchEvent, padCenterX: number, padCenterY: number) => {
      e.preventDefault();
      const t = e.touches[0];
      const dx = t.clientX - padCenterX;
      const dy = t.clientY - padCenterY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 15) {
        setKey("left", false);
        setKey("right", false);
        setKey("up", false);
        setKey("down", false);
      } else {
        setKey("left", dx < -15);
        setKey("right", dx > 15);
        setKey("up", dy < -15);
        setKey("down", dy > 15);
      }
    },
    [setKey],
  );

  const dpadRef = useRef<HTMLDivElement>(null);
  const padCenter = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!dpadRef.current) return;
    const rect = dpadRef.current.getBoundingClientRect();
    padCenter.current = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
  }, []);

  if (!isMobile) {
    return (
      <div className="sfr-kb-hints">
        <div>WASD / Arrows: Move</div>
        <div>SPACE: Shoot</div>
        <div>E: Enter/Exit Vehicle</div>
        <div>1/2/3: Weapons</div>
        <div>Shift: Sprint</div>
      </div>
    );
  }

  return (
    <>
      {/* D-Pad */}
      <div
        ref={dpadRef}
        className="sfr-dpad"
        onTouchStart={(e) => {
          const rect = dpadRef.current?.getBoundingClientRect();
          if (rect) {
            padCenter.current = {
              x: rect.left + rect.width / 2,
              y: rect.top + rect.height / 2,
            };
          }
          touchMove(e, padCenter.current.x, padCenter.current.y);
        }}
        onTouchMove={(e) =>
          touchMove(e, padCenter.current.x, padCenter.current.y)
        }
        onTouchEnd={() => {
          setKey("left", false);
          setKey("right", false);
          setKey("up", false);
          setKey("down", false);
        }}
        onTouchCancel={() => {
          setKey("left", false);
          setKey("right", false);
          setKey("up", false);
          setKey("down", false);
        }}
      >
        <div className="sfr-dpad-grid">
          <div />
          <button
            data-ocid="game.up_button"
            type="button"
            className="sfr-dpad-btn"
            onTouchStart={(e) => {
              e.stopPropagation();
              dpadHandler("up", true);
            }}
            onTouchEnd={() => dpadHandler("up", false)}
          >
            ▲
          </button>
          <div />
          <button
            data-ocid="game.left_button"
            type="button"
            className="sfr-dpad-btn"
            onTouchStart={(e) => {
              e.stopPropagation();
              dpadHandler("left", true);
            }}
            onTouchEnd={() => dpadHandler("left", false)}
          >
            ◀
          </button>
          <div className="sfr-dpad-center" />
          <button
            data-ocid="game.right_button"
            type="button"
            className="sfr-dpad-btn"
            onTouchStart={(e) => {
              e.stopPropagation();
              dpadHandler("right", true);
            }}
            onTouchEnd={() => dpadHandler("right", false)}
          >
            ▶
          </button>
          <div />
          <button
            data-ocid="game.down_button"
            type="button"
            className="sfr-dpad-btn"
            onTouchStart={(e) => {
              e.stopPropagation();
              dpadHandler("down", true);
            }}
            onTouchEnd={() => dpadHandler("down", false)}
          >
            ▼
          </button>
          <div />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="sfr-action-btns">
        <button
          data-ocid="game.jump_button"
          type="button"
          className="sfr-act-btn sfr-act-jump"
          onTouchStart={(e) => {
            e.preventDefault();
            setKey("up", true);
          }}
          onTouchEnd={() => setKey("up", false)}
        >
          JUMP
        </button>
        <button
          data-ocid="game.attack_button"
          type="button"
          className="sfr-act-btn sfr-act-attack"
          onTouchStart={(e) => {
            e.preventDefault();
            setKey("shoot", true);
          }}
          onTouchEnd={() => setKey("shoot", false)}
        >
          FIRE
        </button>
        <button
          data-ocid="game.interact_button"
          type="button"
          className="sfr-act-btn sfr-act-interact"
          onTouchStart={(e) => {
            e.preventDefault();
            setKey("interact", true);
          }}
          onTouchEnd={() => setKey("interact", false)}
        >
          ENTER
        </button>
        <button
          data-ocid="game.slot_button"
          type="button"
          className="sfr-act-btn sfr-act-slot"
          onTouchStart={(e) => {
            e.preventDefault();
            setKey("slot1", true);
          }}
          onTouchEnd={() => setKey("slot1", false)}
        >
          🔁
        </button>
      </div>
    </>
  );
}
