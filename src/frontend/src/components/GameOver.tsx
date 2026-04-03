import React, { useEffect, useRef } from "react";
import { SoundEngine } from "../game/soundEngine";

interface Props {
  winner: string;
  onPlayAgain: () => void;
  onLobby: () => void;
}

interface Confetti {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  rotation: number;
  rotSpeed: number;
  size: number;
}

export default function GameOver({ winner, onPlayAgain, onLobby }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const confettiRef = useRef<Confetti[]>([]);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    SoundEngine.victory();
    const colors = [
      "#58d3ff",
      "#ff4444",
      "#44ff88",
      "#ffdd44",
      "#cc44ff",
      "#ff8800",
    ];
    confettiRef.current = Array.from({ length: 120 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * -200,
      vx: (Math.random() - 0.5) * 4,
      vy: Math.random() * 3 + 1,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.15,
      size: Math.random() * 10 + 5,
    }));

    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const loop = () => {
      rafRef.current = requestAnimationFrame(loop);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const c of confettiRef.current) {
        c.x += c.vx;
        c.y += c.vy;
        c.rotation += c.rotSpeed;
        if (c.y > canvas.height + 20) {
          c.y = -20;
          c.x = Math.random() * canvas.width;
        }
        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.rotate(c.rotation);
        ctx.fillStyle = c.color;
        ctx.globalAlpha = 0.85;
        ctx.fillRect(-c.size / 2, -c.size / 3, c.size, c.size * 0.6);
        ctx.restore();
      }
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <div className="sfr-gameover">
      <canvas ref={canvasRef} className="sfr-confetti-canvas" />
      <div className="sfr-gameover-content">
        <div className="sfr-gameover-trophy">🏆</div>
        <div className="sfr-gameover-title">VICTORY!</div>
        <div className="sfr-gameover-winner">{winner}</div>
        <div className="sfr-gameover-sub">is the last one standing</div>
        <div className="sfr-gameover-actions">
          <button
            data-ocid="gameover.play_again_button"
            type="button"
            className="sfr-btn sfr-btn--primary"
            onClick={onPlayAgain}
          >
            PLAY AGAIN
          </button>
          <button
            data-ocid="gameover.lobby_button"
            type="button"
            className="sfr-btn sfr-btn--secondary"
            onClick={onLobby}
          >
            BACK TO LOBBY
          </button>
        </div>
      </div>
    </div>
  );
}
