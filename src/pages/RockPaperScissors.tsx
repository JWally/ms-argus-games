import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MutableRefObject,
  type ReactElement,
} from 'react';
import { BackLink, CrtOverlay, GameDivider } from '../components/GameShell';
import {
  CHOICES,
  TOTAL_ROUNDS,
  type Choice,
  type GameState,
  type Mode,
  type Outcome,
  computeAiChoice,
  computeCoachSuggestion,
  createGame,
  finalizeRound,
  getRecord,
  recordCoachRound,
  saveResult,
} from '../games/rps/engine';

const LABEL: Record<Choice, string> = { rock: 'ROCK', paper: 'PAPER', scissors: 'SCISSORS' };
type Phase = 'idle' | 'locked' | 'thinking' | 'result';
const PEEK_MS = 2000;

// ─── SVG icons ────────────────────────────────────────────────────────────────

const ICONS: Record<Choice, ReactElement> = {
  rock: (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-7 w-7 sm:h-8 sm:w-8"
    >
      <polygon points="16,2 23,5 28,11 27,21 21,29 11,29 5,21 4,11 9,5" />
      <path d="M10,11 L17,8" strokeWidth="0.8" opacity="0.4" />
      <path d="M22,10 L26,16" strokeWidth="0.8" opacity="0.4" />
    </svg>
  ),
  paper: (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      className="h-7 w-7 sm:h-8 sm:w-8"
    >
      <path d="M7,3 L22,3 L25,6 L25,29 L7,29 Z" />
      <path d="M22,3 L22,6 L25,6" strokeWidth="1" opacity="0.55" />
      <line x1="11" y1="12" x2="21" y2="12" strokeWidth="1" opacity="0.5" />
      <line x1="11" y1="17" x2="21" y2="17" strokeWidth="1" opacity="0.5" />
      <line x1="11" y1="22" x2="17" y2="22" strokeWidth="1" opacity="0.5" />
    </svg>
  ),
  scissors: (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      className="h-7 w-7 sm:h-8 sm:w-8"
    >
      <line x1="6" y1="4" x2="26" y2="28" />
      <line x1="26" y1="4" x2="6" y2="28" />
      <circle cx="16" cy="16" r="2.5" strokeWidth="1.2" />
      <circle cx="7.5" cy="26.5" r="3.5" strokeWidth="1.2" />
      <circle cx="24.5" cy="26.5" r="3.5" strokeWidth="1.2" />
    </svg>
  ),
};

const LOCK_ICON = (
  <svg
    viewBox="0 0 32 32"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    className="h-7 w-7 sm:h-8 sm:w-8"
  >
    <path d="M10,14 L10,11 A6,6 0 0,1 22,11 L22,14" />
    <rect x="6" y="14" width="20" height="14" rx="1" />
    <circle cx="16" cy="21" r="2.5" strokeWidth="1.2" />
    <line x1="16" y1="23.5" x2="16" y2="26" />
  </svg>
);

// ─── Canvas draw helpers ──────────────────────────────────────────────────────

function drawChoiceIcon(
  ctx: CanvasRenderingContext2D,
  choice: Choice,
  pos: { cx: number; cy: number },
  size: number,
  color: string
) {
  const { cx, cy } = pos;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (choice === 'rock') {
    const pts: [number, number][] = [
      [0, -1],
      [0.55, -0.82],
      [1, -0.2],
      [0.88, 0.55],
      [0.25, 1],
      [-0.45, 0.95],
      [-1, 0.3],
      [-0.85, -0.5],
    ];
    ctx.shadowBlur = 10;
    ctx.beginPath();
    pts.forEach(([px, py], i) => {
      const x = cx + px * size,
        y = cy + py * size;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 0.8;
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.moveTo(cx - 0.3 * size, cy - 0.25 * size);
    ctx.lineTo(cx + 0.25 * size, cy - 0.55 * size);
    ctx.moveTo(cx + 0.5 * size, cy - 0.1 * size);
    ctx.lineTo(cx + 0.75 * size, cy + 0.3 * size);
    ctx.stroke();
  } else if (choice === 'paper') {
    const w = size * 0.78,
      h = size * 1.05,
      fold = size * 0.26;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(cx - w / 2, cy - h / 2);
    ctx.lineTo(cx + w / 2 - fold, cy - h / 2);
    ctx.lineTo(cx + w / 2, cy - h / 2 + fold);
    ctx.lineTo(cx + w / 2, cy + h / 2);
    ctx.lineTo(cx - w / 2, cy + h / 2);
    ctx.closePath();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    ctx.moveTo(cx + w / 2 - fold, cy - h / 2);
    ctx.lineTo(cx + w / 2 - fold, cy - h / 2 + fold);
    ctx.lineTo(cx + w / 2, cy - h / 2 + fold);
    ctx.stroke();
    ctx.lineWidth = 0.9;
    ctx.globalAlpha = 0.4;
    for (const dy of [-0.18, 0.08, 0.34]) {
      ctx.beginPath();
      ctx.moveTo(cx - w / 2 + size * 0.14, cy + dy * h);
      ctx.lineTo(cx + w / 2 - size * 0.22, cy + dy * h);
      ctx.stroke();
    }
  } else {
    const b = size * 0.88;
    ctx.shadowBlur = 10;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - b * 0.55, cy - b * 0.7);
    ctx.lineTo(cx + b * 0.55, cy + b * 0.7);
    ctx.moveTo(cx + b * 0.55, cy - b * 0.7);
    ctx.lineTo(cx - b * 0.55, cy + b * 0.7);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.13, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.arc(cx - b * 0.42, cy + b * 0.62, size * 0.19, 0, Math.PI * 2);
    ctx.arc(cx + b * 0.42, cy + b * 0.62, size * 0.19, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawLockIcon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  color: string
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.arc(cx, cy - size * 0.18, size * 0.36, Math.PI, 0);
  ctx.stroke();
  const bw = size * 0.72,
    bh = size * 0.56;
  ctx.shadowBlur = 6;
  ctx.strokeRect(cx - bw / 2, cy + size * 0.04, bw, bh);
  ctx.shadowBlur = 0;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy + size * 0.25, size * 0.1, 0, Math.PI * 2);
  ctx.moveTo(cx, cy + size * 0.36);
  ctx.lineTo(cx, cy + size * 0.5);
  ctx.stroke();
  ctx.restore();
}

// ─── Tutorial modal ───────────────────────────────────────────────────────────

const TUTORIAL_KEY = 'rps-tutorial-v2';

function HowToPlay({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full overflow-y-auto sm:max-w-md"
        style={{
          background: '#040e07',
          border: '1px solid #1a6632',
          borderRadius: '2px 2px 0 0',
          boxShadow: '0 0 40px #22c55e22, inset 0 0 40px #00000060',
          animation: 'modal-in 0.25s ease',
          maxHeight: '92dvh',
          padding: 'clamp(1rem, 4vw, 1.75rem)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle on mobile */}
        <div className="mb-4 flex justify-center sm:hidden">
          <div style={{ width: 40, height: 4, borderRadius: 2, background: '#1a6632' }} />
        </div>

        <h2
          className="text-center font-mono font-bold tracking-[0.25em]"
          style={{
            fontSize: 'clamp(13px, 3.5vw, 16px)',
            color: '#4ade80',
            textShadow: '0 0 10px #22c55e, 0 0 30px #22c55e66',
          }}
        >
          OPERATIONAL BRIEFING
        </h2>
        <div
          className="mt-1 text-center font-mono tracking-[0.25em]"
          style={{ fontSize: 'clamp(10px, 2.5vw, 12px)', color: '#166534' }}
        >
          ROCK · PAPER · SCISSORS
        </div>

        <div
          className="my-4 h-px"
          style={{
            background:
              'linear-gradient(to right, transparent, #1a6632 20%, #22c55e 50%, #1a6632 80%, transparent)',
            boxShadow: '0 0 4px #22c55e44',
          }}
        />

        <div className="space-y-4">
          {/* Section 1 */}
          <div className="flex items-start gap-3">
            <span
              className="flex shrink-0 items-center justify-center font-mono font-bold"
              style={{
                width: 28,
                height: 28,
                background: '#0a2a14',
                border: '1px solid #1a6632',
                borderRadius: '2px',
                color: '#4ade80',
                fontSize: 13,
              }}
            >
              1
            </span>
            <div className="flex-1">
              <div
                className="font-mono font-bold tracking-[0.12em]"
                style={{ fontSize: 'clamp(11px, 3vw, 13px)', color: '#4ade80' }}
              >
                STANDARD COMBAT
              </div>
              <p
                className="mt-1.5 leading-relaxed"
                style={{ fontSize: 'clamp(12px, 3.2vw, 14px)', color: '#86efac' }}
              >
                Best of {TOTAL_ROUNDS} rounds against the AI. The system{' '}
                <span style={{ color: '#4ade80' }}>studies your patterns</span> — if you keep
                throwing rock, it learns. Draws don&apos;t count toward the score. Outwit the
                pattern engine to win the series.
              </p>
            </div>
          </div>

          <div className="h-px" style={{ background: '#0f2a18' }} />

          {/* Section 2 */}
          <div className="flex items-start gap-3">
            <span
              className="flex shrink-0 items-center justify-center font-mono font-bold"
              style={{
                width: 28,
                height: 28,
                background: '#0a2a14',
                border: '1px solid #1a6632',
                borderRadius: '2px',
                color: '#4ade80',
                fontSize: 13,
              }}
            >
              2
            </span>
            <div className="flex-1">
              <div
                className="font-mono font-bold tracking-[0.12em]"
                style={{ fontSize: 'clamp(11px, 3vw, 13px)', color: '#f87171' }}
              >
                SNEAK PEEK — PROVING FAIRNESS
              </div>
              <p
                className="mt-1.5 leading-relaxed"
                style={{ fontSize: 'clamp(12px, 3.2vw, 14px)', color: '#86efac' }}
              >
                Each round the AI{' '}
                <span style={{ color: '#4ade80' }}>locks in its choice before you do</span>. Once
                locked, hit{' '}
                <span
                  className="inline-block px-1.5 py-0.5 font-mono font-bold"
                  style={{
                    background: '#1c0607',
                    border: '1px solid #7f1d1d',
                    color: '#f87171',
                    borderRadius: '2px',
                    fontSize: 'clamp(10px, 2.5vw, 12px)',
                  }}
                >
                  PEEK
                </span>{' '}
                to reveal the AI&apos;s committed move for 2 seconds. Think of your move first, then
                peek — this proves the AI <span style={{ color: '#f87171' }}>cannot cheat</span> by
                changing its answer after seeing yours.
              </p>
            </div>
          </div>

          <div className="h-px" style={{ background: '#0f2a18' }} />

          {/* Section 3 */}
          <div className="flex items-start gap-3">
            <span
              className="flex shrink-0 items-center justify-center font-mono font-bold"
              style={{
                width: 28,
                height: 28,
                background: '#0a2a14',
                border: '1px solid #1a6632',
                borderRadius: '2px',
                color: '#4ade80',
                fontSize: 13,
              }}
            >
              3
            </span>
            <div className="flex-1">
              <div
                className="font-mono font-bold tracking-[0.12em]"
                style={{ fontSize: 'clamp(11px, 3vw, 13px)', color: '#22d3ee' }}
              >
                CYBORG MODE — CRUSH YOUR FRIENDS
              </div>
              <p
                className="mt-1.5 leading-relaxed italic"
                style={{ fontSize: 'clamp(11px, 2.8vw, 13px)', color: '#22d3ee', opacity: 0.85 }}
              >
                &quot;What is best in life? To crush your enemies, see them driven before you, and
                hear the lamentations of their women.&quot; — Conan
              </p>
              <p
                className="mt-2 leading-relaxed"
                style={{ fontSize: 'clamp(12px, 3.2vw, 14px)', color: '#86efac' }}
              >
                Hand your phone to a friend and{' '}
                <span style={{ color: '#22d3ee' }}>enter whatever they throw</span>. The AI reads
                their patterns and{' '}
                <span style={{ color: '#22d3ee' }}>tells you exactly what to play</span> to beat
                them. After {TOTAL_ROUNDS} rounds you&apos;ll know if the machine had their number.
              </p>
            </div>
          </div>
        </div>

        <div
          className="my-4 h-px"
          style={{
            background:
              'linear-gradient(to right, transparent, #1a6632 20%, #22c55e 50%, #1a6632 80%, transparent)',
            boxShadow: '0 0 4px #22c55e44',
          }}
        />

        <button
          onClick={onClose}
          className="w-full font-mono font-bold tracking-[0.2em] transition-all hover:scale-105 active:scale-95"
          style={{
            padding: 'clamp(10px, 3vw, 14px)',
            fontSize: 'clamp(12px, 3.2vw, 14px)',
            background: '#040e07',
            border: '1px solid #22c55e',
            color: '#4ade80',
            boxShadow: '0 0 10px #22c55e44',
            borderRadius: '2px',
          }}
        >
          BEGIN ENGAGEMENT
        </button>
      </div>

      <style>{`
        @keyframes modal-in {
          0%   { opacity: 0; transform: translateY(20px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @media (min-width: 640px) {
          @keyframes modal-in {
            0%   { opacity: 0; transform: scale(0.93) translateY(10px); }
            100% { opacity: 1; transform: scale(1) translateY(0); }
          }
        }
      `}</style>
    </div>
  );
}

// ─── Matrix rain canvas ───────────────────────────────────────────────────────

const RAIN_CHARS = '01アイウエオカキクケ0123456789ABCDEFabcdef∆∑∏Ωβγφ#@!%&<>'.split('');

interface RainState {
  phase: Phase;
  outcome: Outcome | null;
  humanChoice: Choice | null;
  aiChoice: Choice | null;
  lockedAiChoice: Choice | null;
  suggestion: Choice | null;
  winStreak: number;
  mode: Mode;
  peeking: boolean;
  peekStartTime: number;
}

function useMatrixRain(active: boolean, stateRef: MutableRefObject<RainState>) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number>(0);
  const dropsRef = useRef<number[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    if (!active) {
      cancelAnimationFrame(frameRef.current);
      return;
    }

    const W = 400,
      H = 260,
      fs = 11;
    const cols = Math.floor(W / fs);
    if (dropsRef.current.length !== cols) {
      dropsRef.current = Array.from({ length: cols }, () => -Math.random() * (H / fs));
    }
    ctx.clearRect(0, 0, W, H);
    let lastT = 0;

    function draw(t: number) {
      if (t - lastT < 50) {
        frameRef.current = requestAnimationFrame(draw);
        return;
      }
      lastT = t;

      const {
        phase,
        outcome,
        humanChoice,
        aiChoice,
        lockedAiChoice,
        suggestion,
        winStreak,
        mode,
        peeking,
        peekStartTime,
      } = stateRef.current;

      const isWin = outcome === 'win';
      const isLose = outcome === 'lose';
      const streaking = isWin && winStreak >= 2;
      const isLocked = phase === 'locked';

      // Green palette to match Battleship theme
      const headClr = isLose
        ? '#fca5a5'
        : streaking
          ? '#fde68a'
          : isWin
            ? '#86efac'
            : peeking
              ? '#fca5a5'
              : '#4ade80';
      const bodyClr1 = isLose
        ? '#ef4444'
        : streaking
          ? '#f59e0b'
          : isWin
            ? '#22c55e'
            : peeking
              ? '#dc2626'
              : '#16a34a';
      const bodyClr2 = isLose
        ? '#b91c1c'
        : streaking
          ? '#d97706'
          : isWin
            ? '#166534'
            : peeking
              ? '#b91c1c'
              : '#14532d';
      const speed = phase === 'result' || isLocked ? 0.4 : 0.72;

      // Use green-tinted fade to match #030c06 background
      ctx.fillStyle = `rgba(3,12,6,${phase === 'result' || isLocked ? 0.12 : 0.18})`;
      ctx.fillRect(0, 0, W, H);
      ctx.font = `${fs}px 'Courier New', monospace`;

      const drops = dropsRef.current;
      for (let i = 0; i < cols; i++) {
        const y = Math.floor(drops[i]) * fs;
        if (y < -fs) {
          drops[i] += speed;
          continue;
        }
        const bright = Math.random() > 0.88;
        ctx.globalAlpha = bright ? 1 : 0.28 + Math.random() * 0.38;
        ctx.fillStyle = bright ? headClr : Math.random() > 0.5 ? bodyClr1 : bodyClr2;
        if (y >= 0)
          ctx.fillText(RAIN_CHARS[Math.floor(Math.random() * RAIN_CHARS.length)], i * fs + 1, y);
        drops[i] += speed + Math.random() * 0.25;
        if (y > H + fs && Math.random() > 0.96) drops[i] = -Math.random() * 18;
      }
      ctx.globalAlpha = 1;

      // ── CYBORG IDLE overlay — show suggestion before opponent throws ─────────
      if (phase === 'idle' && mode === 'coach' && suggestion) {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.font = 'bold 10px monospace';
        ctx.fillStyle = '#22d3ee';
        ctx.shadowColor = '#22d3ee';
        ctx.shadowBlur = 8;
        ctx.fillText('▶  PLAY THIS  ◀', W / 2, 28);
        ctx.shadowBlur = 0;
        ctx.shadowColor = '#22c55e';
        ctx.shadowBlur = 22;
        drawChoiceIcon(ctx, suggestion, { cx: W / 2, cy: H / 2 - 12 }, 48, '#4ade80');
        ctx.shadowBlur = 0;
        ctx.font = 'bold 17px monospace';
        ctx.fillStyle = '#4ade80';
        ctx.shadowColor = '#22c55e';
        ctx.shadowBlur = 12;
        ctx.fillText(LABEL[suggestion], W / 2, H / 2 + 56);
        ctx.shadowBlur = 0;
        ctx.font = '9px monospace';
        ctx.fillStyle = '#1a5a2a';
        ctx.fillText("then enter opponent's throw below", W / 2, H / 2 + 76);
        ctx.restore();
      }

      // ── LOCKED overlay ──────────────────────────────────────────────────────
      if (isLocked) {
        ctx.save();
        ctx.textAlign = 'center';
        if (peeking && lockedAiChoice) {
          const progress = Math.max(0, 1 - (Date.now() - peekStartTime) / PEEK_MS);
          ctx.font = 'bold 10px monospace';
          ctx.fillStyle = '#f87171';
          ctx.shadowColor = '#ef4444';
          ctx.shadowBlur = 8;
          ctx.fillText('// ACCESSING SEALED DATA //', W / 2, 26);
          ctx.shadowBlur = 20;
          drawChoiceIcon(ctx, lockedAiChoice, { cx: W / 2, cy: H / 2 - 8 }, 38, '#f87171');
          ctx.shadowBlur = 0;
          ctx.font = 'bold 13px monospace';
          ctx.fillStyle = '#f87171';
          ctx.shadowColor = '#f87171';
          ctx.shadowBlur = 10;
          ctx.fillText(LABEL[lockedAiChoice], W / 2, H / 2 + 52);
          ctx.shadowBlur = 0;
          ctx.globalAlpha = 0.25;
          ctx.fillStyle = '#1f0a0a';
          ctx.fillRect(24, H - 14, W - 48, 3);
          ctx.globalAlpha = 1;
          ctx.fillStyle = '#ef4444';
          ctx.shadowColor = '#ef4444';
          ctx.shadowBlur = 5;
          ctx.fillRect(24, H - 14, (W - 48) * progress, 3);
          ctx.shadowBlur = 0;
          ctx.restore();
        } else {
          const scanY = ((Date.now() % 2400) / 2400) * H;
          ctx.globalAlpha = 0.06;
          ctx.fillStyle = '#4ade80';
          ctx.fillRect(0, scanY - 10, W, 20);
          ctx.globalAlpha = 1;
          drawLockIcon(ctx, W / 2, H / 2 - 22, 32, '#4ade80');
          ctx.font = 'bold 11px monospace';
          ctx.fillStyle = '#4ade80';
          ctx.shadowColor = '#22c55e';
          ctx.shadowBlur = 10;
          ctx.fillText('SYSTEM HAS COMMITTED', W / 2, H / 2 + 34);
          ctx.shadowBlur = 0;
          ctx.font = '9px monospace';
          ctx.fillStyle = '#1a4a2a';
          ctx.fillText('select your move below', W / 2, H / 2 + 52);
          ctx.restore();
        }
      }

      // ── RESULT overlay ──────────────────────────────────────────────────────
      if (phase === 'result') {
        if (mode === 'vs-ai' && outcome) {
          const txtClr = streaking ? '#fcd34d' : isWin ? '#4ade80' : isLose ? '#f87171' : '#9ca3af';
          const big = isWin ? 'PLAYER WINS' : isLose ? 'SYSTEM WINS' : 'DRAW';
          ctx.save();
          ctx.textAlign = 'center';
          if (streaking) {
            ctx.font = 'bold 11px monospace';
            ctx.fillStyle = '#fcd34d';
            ctx.shadowColor = '#f59e0b';
            ctx.shadowBlur = 10;
            ctx.globalAlpha = 0.9;
            ctx.fillText(`◆  ${winStreak}x STREAK`, W / 2, 24);
            ctx.globalAlpha = 1;
            ctx.shadowBlur = 0;
          }
          ctx.font = `bold ${isWin || isLose ? 26 : 34}px monospace`;
          ctx.fillStyle = txtClr;
          ctx.shadowColor = txtClr;
          ctx.shadowBlur = 22;
          ctx.fillText(big, W / 2, 72);
          ctx.shadowBlur = 0;
          ctx.strokeStyle = 'rgba(255,255,255,0.05)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(24, 84);
          ctx.lineTo(376, 84);
          ctx.stroke();
          if (humanChoice && aiChoice) {
            ctx.shadowBlur = 14;
            drawChoiceIcon(
              ctx,
              humanChoice,
              { cx: W / 2 - 62, cy: H / 2 + 30 },
              26,
              isWin ? txtClr : '#374151'
            );
            drawChoiceIcon(
              ctx,
              aiChoice,
              { cx: W / 2 + 62, cy: H / 2 + 30 },
              26,
              isLose ? txtClr : '#374151'
            );
            ctx.shadowBlur = 0;
            ctx.font = 'bold 9px monospace';
            ctx.fillStyle = '#1a3a2a';
            ctx.fillText('VS', W / 2, H / 2 + 34);
            ctx.font = '8px monospace';
            ctx.fillStyle = '#1a3a2a';
            ctx.fillText('PLAYER', W / 2 - 62, H / 2 + 64);
            ctx.fillText('SYSTEM', W / 2 + 62, H / 2 + 64);
          }
          ctx.restore();
        }
        if (mode === 'coach' && suggestion) {
          // Result: show outcome + CYBORG (suggestion) vs HUMAN (opponent throw)
          const coachOutcome = humanChoice
            ? suggestion === humanChoice
              ? 'tie'
              : (CHOICES.indexOf(suggestion) + 1) % 3 === CHOICES.indexOf(humanChoice)
                ? 'win'
                : 'lose'
            : null;
          const resClr =
            coachOutcome === 'win' ? '#4ade80' : coachOutcome === 'lose' ? '#f87171' : '#9ca3af';
          ctx.save();
          ctx.textAlign = 'center';
          ctx.font = `bold 24px monospace`;
          ctx.fillStyle = resClr;
          ctx.shadowColor = resClr;
          ctx.shadowBlur = 20;
          ctx.fillText(
            coachOutcome === 'win'
              ? 'CYBORG WINS'
              : coachOutcome === 'lose'
                ? 'HUMAN WINS'
                : 'DRAW',
            W / 2,
            60
          );
          ctx.shadowBlur = 0;
          ctx.strokeStyle = 'rgba(255,255,255,0.05)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(24, 72);
          ctx.lineTo(376, 72);
          ctx.stroke();
          ctx.shadowBlur = 14;
          drawChoiceIcon(ctx, suggestion, { cx: W / 2 - 62, cy: H / 2 + 24 }, 28, '#4ade80');
          if (humanChoice)
            drawChoiceIcon(ctx, humanChoice, { cx: W / 2 + 62, cy: H / 2 + 24 }, 28, '#f87171');
          ctx.shadowBlur = 0;
          ctx.font = 'bold 9px monospace';
          ctx.fillStyle = '#1a3a2a';
          ctx.fillText('VS', W / 2, H / 2 + 28);
          ctx.font = '8px monospace';
          ctx.fillStyle = '#1a5a2a';
          ctx.fillText('CYBORG', W / 2 - 62, H / 2 + 58);
          ctx.fillStyle = '#5a1a1a';
          ctx.fillText('HUMAN', W / 2 + 62, H / 2 + 58);
          ctx.restore();
        }
      }
      frameRef.current = requestAnimationFrame(draw);
    }

    frameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frameRef.current);
  }, [active, stateRef]);

  return canvasRef;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function statusMsg(
  phase: Phase,
  outcome: Outcome | null,
  mode: Mode,
  seriesOver: boolean,
  seriesWinner: GameState['seriesWinner']
): string {
  if (seriesOver) {
    if (mode === 'coach') return 'CYBORG SESSION COMPLETE';
    if (seriesWinner === 'human') return 'SERIES VICTORY — PLAYER WINS';
    if (seriesWinner === 'ai') return 'SERIES DEFEAT — SYSTEM WINS';
    return 'SERIES CONCLUDED — DRAW';
  }
  if (phase === 'idle')
    return mode === 'coach' ? "PLAY THE SUGGESTION · ENTER OPPONENT'S THROW" : 'AI DECIDING...';
  if (phase === 'locked') return 'AI LOCKED IN. YOUR MOVE';
  if (phase === 'thinking')
    return mode === 'vs-ai' ? 'COMPARING MOVES...' : 'READING THEIR PATTERNS...';
  if (phase === 'result') {
    if (mode === 'coach')
      return outcome === 'win'
        ? 'CYBORG WINS THIS ROUND'
        : outcome === 'lose'
          ? 'HUMAN WINS THIS ROUND'
          : 'DRAW — NO ROUND COUNTED';
    if (outcome === 'win') return 'HUMAN WINS THIS ROUND';
    if (outcome === 'lose') return 'AI WINS THIS ROUND';
    return 'DRAW — NO ROUND COUNTED';
  }
  return '';
}

export default function RockPaperScissors() {
  const [showModal, setShowModal] = useState(() => !localStorage.getItem(TUTORIAL_KEY));
  const [mode, setMode] = useState<Mode>('vs-ai');
  const [game, setGame] = useState<GameState>(() => createGame('vs-ai'));
  const [phase, setPhase] = useState<Phase>('idle');
  const [roundChoice, setRoundChoice] = useState<Choice | null>(null);
  const [aiChoice, setAiChoice] = useState<Choice | null>(null);
  const [lockedAiChoice, setLockedAiChoice] = useState<Choice | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [suggestion, setSuggestion] = useState<Choice | null>(null);
  const [winStreak, setWinStreak] = useState(0);
  const [peeking, setPeeking] = useState(false);
  const [peekStartTime, setPeekStartTime] = useState(0);
  const [blinkOn, setBlinkOn] = useState(true);

  const closeModal = useCallback(() => {
    localStorage.setItem(TUTORIAL_KEY, '1');
    setShowModal(false);
  }, []);

  const record = getRecord();
  const thinkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resultTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const peekTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedRef = useRef(false);

  const rainStateRef = useRef<RainState>({
    phase,
    outcome,
    humanChoice: roundChoice,
    aiChoice,
    lockedAiChoice,
    suggestion,
    winStreak,
    mode,
    peeking,
    peekStartTime,
  });
  useLayoutEffect(() => {
    rainStateRef.current = {
      phase,
      outcome,
      humanChoice: roundChoice,
      aiChoice,
      lockedAiChoice,
      suggestion,
      winStreak,
      mode,
      peeking,
      peekStartTime,
    };
  });

  // Canvas is active whenever not idle; in cyborg mode also active at idle so suggestion shows
  const canvasRef = useMatrixRain(
    phase !== 'idle' || (mode === 'coach' && !game.seriesOver),
    rainStateRef
  );

  // Blinking cursor
  useEffect(() => {
    const t = setInterval(() => setBlinkOn((v) => !v), 530);
    return () => clearInterval(t);
  }, []);

  const clearTimers = useCallback(() => {
    if (thinkTimer.current) clearTimeout(thinkTimer.current);
    if (resultTimer.current) clearTimeout(resultTimer.current);
    if (peekTimer.current) clearTimeout(peekTimer.current);
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  useEffect(() => {
    if (game.seriesOver && game.seriesWinner && !savedRef.current && mode === 'vs-ai') {
      savedRef.current = true;
      saveResult(game.seriesWinner);
    }
  }, [game.seriesOver, game.seriesWinner, mode]);

  // Auto-lock AI when idle (vs-ai) — no ENGAGE button needed
  useEffect(() => {
    if (phase !== 'idle' || game.seriesOver || mode !== 'vs-ai') return;
    const t = setTimeout(() => {
      setLockedAiChoice(computeAiChoice(game.rounds));
      setPhase('locked');
      setPeeking(false);
    }, 500);
    return () => clearTimeout(t);
  }, [phase, game.seriesOver, game.rounds, mode]);

  // Pre-compute cyborg suggestion at start of each round (idle phase)
  useEffect(() => {
    if (phase !== 'idle' || game.seriesOver || mode !== 'coach') return;
    const t = setTimeout(() => setSuggestion(computeCoachSuggestion(game.rounds)), 0);
    return () => clearTimeout(t);
  }, [phase, game.seriesOver, game.rounds, mode]);

  const handleChoice = useCallback(
    (choice: Choice) => {
      if (mode === 'vs-ai') {
        if (phase !== 'locked' || !lockedAiChoice) return;
        clearTimers();
        setRoundChoice(choice);
        setPeeking(false);
        setPhase('thinking');
        thinkTimer.current = setTimeout(() => {
          const { newState, outcome: out } = finalizeRound(game, choice, lockedAiChoice);
          setAiChoice(lockedAiChoice);
          setOutcome(out);
          setGame(newState);
          setWinStreak((prev) => (out === 'win' ? prev + 1 : 0));
          setLockedAiChoice(null);
          setPhase('result');
          resultTimer.current = setTimeout(() => {
            setPhase('idle');
            setRoundChoice(null);
            setAiChoice(null);
            setOutcome(null);
          }, 2100);
        }, 650);
      } else {
        // Cyborg mode: suggestion already pre-computed at idle; user enters opponent's throw
        if (phase !== 'idle' || !suggestion) return;
        const committedSuggestion = suggestion; // capture before clearing
        clearTimers();
        setRoundChoice(choice); // opponent's throw
        setPhase('thinking');
        thinkTimer.current = setTimeout(() => {
          // Score committed suggestion vs what opponent actually threw
          setGame((prev) => recordCoachRound(prev, choice, committedSuggestion));
          setPhase('result');
          resultTimer.current = setTimeout(() => {
            // suggestion cleared here; useEffect recomputes for next round
            setPhase('idle');
            setRoundChoice(null);
            setSuggestion(null);
            setOutcome(null);
          }, 2000);
        }, 700);
      }
    },
    [phase, game, mode, lockedAiChoice, suggestion, clearTimers]
  );

  const handlePeek = useCallback(() => {
    if (peeking || phase !== 'locked') return;
    if (peekTimer.current) clearTimeout(peekTimer.current);
    setPeekStartTime(Date.now());
    setPeeking(true);
    peekTimer.current = setTimeout(() => setPeeking(false), PEEK_MS);
  }, [peeking, phase]);

  const restart = useCallback(() => {
    clearTimers();
    savedRef.current = false;
    setGame(createGame(mode));
    setPhase('idle');
    setRoundChoice(null);
    setAiChoice(null);
    setLockedAiChoice(null);
    setOutcome(null);
    setSuggestion(null);
    setWinStreak(0);
    setPeeking(false);
  }, [mode, clearTimers]);

  const toggleMode = useCallback(() => {
    const next: Mode = mode === 'vs-ai' ? 'coach' : 'vs-ai';
    clearTimers();
    savedRef.current = false;
    setMode(next);
    setGame(createGame(next));
    setPhase('idle');
    setRoundChoice(null);
    setAiChoice(null);
    setLockedAiChoice(null);
    setOutcome(null);
    setSuggestion(null);
    setWinStreak(0);
    setPeeking(false);
  }, [mode, clearTimers]);

  const streaking = phase === 'result' && outcome === 'win' && winStreak >= 2;
  const showChoiceButtons =
    mode === 'coach' ? phase === 'idle' && !!suggestion : phase === 'locked';
  const isOver = game.seriesOver;
  const msg = statusMsg(phase, outcome, mode, isOver, game.seriesWinner);

  // Glow frame color shifts with outcome
  const frameGlow = streaking
    ? winStreak >= 3
      ? '#d97706'
      : '#22c55e'
    : phase === 'result' && outcome === 'lose'
      ? '#dc2626'
      : '#22c55e';

  // Shared choice-button row style
  const btnRow =
    'group relative flex w-full items-center gap-0 bg-transparent py-[16px] sm:py-[20px] pl-0 pr-5 transition-colors duration-150';

  return (
    <div
      className="flex min-h-screen flex-col items-center px-3 pb-12 pt-4"
      style={{ background: '#030c06', color: '#4ade80' }}
    >
      {showModal && <HowToPlay onClose={closeModal} />}

      <CrtOverlay />

      {/* Back link */}
      <div className="mb-3 w-full max-w-lg flex items-center justify-between">
        <BackLink />
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowModal(true)}
            className="rounded px-2 py-1 text-xs font-bold tracking-widest transition-all hover:scale-105"
            style={{
              background: '#040e07',
              border: '1px solid #0f3018',
              color: '#1a6632',
              boxShadow: '0 0 6px #22c55e11',
            }}
          >
            ?
          </button>
          <button
            onClick={toggleMode}
            className="rounded px-3 py-1 text-xs font-bold tracking-widest transition-all hover:scale-105"
            style={{
              background: '#040e07',
              border: '1px solid #0f3018',
              color: '#1a6632',
              boxShadow: '0 0 6px #22c55e11',
            }}
          >
            {mode === 'vs-ai' ? '[ CYBORG MODE ]' : '[ VS SYSTEM ]'}
          </button>
        </div>
      </div>

      {/* Title */}
      <div className="mb-1 text-center">
        <h1
          className="font-display text-base tracking-[0.2em] sm:text-2xl sm:tracking-[0.3em] whitespace-nowrap"
          style={{
            color: '#4ade80',
            textShadow: '0 0 10px #22c55e, 0 0 30px #22c55e66, 0 0 60px #22c55e33',
          }}
        >
          ROCK.PAPER.SCISSORS
        </h1>
        <div className="mt-1 text-xs tracking-[0.3em]" style={{ color: '#166534' }}>
          {mode === 'vs-ai'
            ? 'PATTERN ANALYSIS COMBAT'
            : 'CYBORG SUBSYSTEM v1.4 · USE AI TO CRUSH YOUR FRIENDS'}
        </div>
      </div>

      {/* Divider */}
      <GameDivider className="my-2 max-w-lg" />

      {/* Status bar */}
      <div
        className="mb-2 w-full max-w-lg rounded px-3 py-2"
        style={{
          background: '#040e07',
          border: '1px solid #0f3018',
          boxShadow: 'inset 0 0 20px #00000060',
        }}
      >
        <div className="flex items-center gap-2">
          <div
            className="h-2 w-2 flex-shrink-0 rounded-full"
            style={{
              background: isOver
                ? game.seriesWinner === 'human'
                  ? '#22c55e'
                  : game.seriesWinner === 'ai'
                    ? '#dc2626'
                    : '#9ca3af'
                : phase === 'thinking'
                  ? '#f59e0b'
                  : phase === 'result' && outcome === 'lose'
                    ? '#dc2626'
                    : '#22c55e',
              boxShadow: isOver
                ? game.seriesWinner === 'human'
                  ? '0 0 6px #22c55e'
                  : game.seriesWinner === 'ai'
                    ? '0 0 6px #dc2626'
                    : 'none'
                : phase === 'thinking'
                  ? '0 0 6px #f59e0b'
                  : phase === 'result' && outcome === 'lose'
                    ? '0 0 6px #dc2626'
                    : '0 0 6px #22c55e',
            }}
          />
          <span
            className="font-mono text-xs tracking-wider"
            style={{
              color: isOver
                ? game.seriesWinner === 'human'
                  ? '#4ade80'
                  : game.seriesWinner === 'ai'
                    ? '#dc2626'
                    : '#9ca3af'
                : phase === 'result' && outcome === 'lose'
                  ? '#f87171'
                  : streaking
                    ? '#fcd34d'
                    : '#86efac',
              textShadow: isOver && game.seriesWinner === 'human' ? '0 0 6px #22c55e' : undefined,
            }}
          >
            {msg}
            {!isOver && phase !== 'thinking' && <span style={{ opacity: blinkOn ? 1 : 0 }}>_</span>}
          </span>
          {!isOver && (
            <span className="ml-auto font-mono text-xs" style={{ color: '#1a5c2a' }}>
              RND {String(Math.min(game.rounds.length + 1, TOTAL_ROUNDS)).padStart(2, '0')} /{' '}
              {TOTAL_ROUNDS}
            </span>
          )}
        </div>
      </div>

      {/* HUD scoreboard */}
      <div
        className="w-full max-w-lg"
        style={{
          background: '#040e07',
          border: '1px solid #0f2a18',
          boxShadow: 'inset 0 0 12px #00000050',
        }}
      >
        <div className="flex items-center px-4 py-2.5">
          <div className="flex-1 text-left">
            <div className="font-mono text-sm tracking-[0.25em]" style={{ color: '#4ade80' }}>
              {mode === 'coach' ? 'CYBORG' : 'HUMAN'}
            </div>
            <div
              className="font-mono text-2xl leading-none tabular-nums"
              style={{ color: '#4ade80', textShadow: '0 0 12px #22c55e88' }}
            >
              {String(game.humanScore).padStart(2, '0')}
            </div>
          </div>
          <div className="flex flex-col items-center gap-0.5 px-4">
            <div className="font-mono text-sm tracking-[0.2em]" style={{ color: '#1a6632' }}>
              {mode === 'coach' ? 'RND' : 'VS'}
            </div>
            <div className="font-mono text-xs tabular-nums" style={{ color: '#4ade80' }}>
              {String(Math.min(game.rounds.length + 1, TOTAL_ROUNDS)).padStart(2, '0')}
              <span style={{ color: '#1a6632' }}> / </span>
              {TOTAL_ROUNDS}
            </div>
          </div>
          <div className="flex-1 text-right">
            <div className="font-mono text-sm tracking-[0.25em]" style={{ color: '#f87171' }}>
              {mode === 'coach' ? 'HUMAN' : 'AI'}
            </div>
            <div
              className="font-mono text-2xl leading-none tabular-nums"
              style={{ color: '#f87171', textShadow: '0 0 12px #dc262688' }}
            >
              {mode === 'coach'
                ? String(game.rounds.length - game.humanScore).padStart(2, '0')
                : String(game.aiScore).padStart(2, '0')}
            </div>
          </div>
        </div>
      </div>

      {/* Canvas — glow frame */}
      <div
        className="relative w-full max-w-lg"
        style={{
          padding: '2px',
          background: 'linear-gradient(135deg, #0f3a1a, #071510, #0f3a1a)',
          boxShadow: `0 0 20px ${frameGlow}33, inset 0 0 20px #00000066`,
          transition: 'box-shadow 0.4s ease',
        }}
      >
        {/* Scan line */}
        <div
          className="pointer-events-none absolute inset-x-0 z-10"
          style={{
            height: '2px',
            background: `linear-gradient(to right, transparent, ${frameGlow}44 20%, ${frameGlow}88 50%, ${frameGlow}44 80%, transparent)`,
            animation: 'rps-scan 3.5s linear infinite',
          }}
        />
        {/* Corner brackets */}
        <div className="pointer-events-none absolute inset-0 z-20">
          <div
            className="absolute left-0 top-0 h-3 w-3"
            style={{
              borderLeft: `1px solid ${frameGlow}88`,
              borderTop: `1px solid ${frameGlow}88`,
            }}
          />
          <div
            className="absolute right-0 top-0 h-3 w-3"
            style={{
              borderRight: `1px solid ${frameGlow}88`,
              borderTop: `1px solid ${frameGlow}88`,
            }}
          />
          <div
            className="absolute bottom-0 left-0 h-3 w-3"
            style={{
              borderBottom: `1px solid ${frameGlow}88`,
              borderLeft: `1px solid ${frameGlow}88`,
            }}
          />
          <div
            className="absolute bottom-0 right-0 h-3 w-3"
            style={{
              borderBottom: `1px solid ${frameGlow}88`,
              borderRight: `1px solid ${frameGlow}88`,
            }}
          />
        </div>
        {/* Scanline overlay */}
        <div
          className="pointer-events-none absolute inset-0 z-10"
          style={{
            backgroundImage:
              'repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.08) 2px,rgba(0,0,0,0.08) 4px)',
          }}
        />
        <canvas
          ref={canvasRef}
          width={400}
          height={260}
          className="w-full"
          style={{
            display: 'block',
            opacity: phase === 'idle' ? 0 : 1,
            transition: 'opacity 0.6s ease-out',
          }}
        />
      </div>

      {/* Choice + Peek buttons */}
      {showChoiceButtons && !isOver && (
        <div
          className="w-full max-w-lg"
          style={{ background: '#040e07', border: '1px solid #0f2a18' }}
        >
          {/* Peek (vs-ai locked) */}
          {mode === 'vs-ai' && phase === 'locked' && (
            <button
              onClick={handlePeek}
              disabled={peeking}
              className={`${btnRow} hover:bg-red-950/20 disabled:opacity-40`}
              style={{ borderBottom: '1px solid #0f2a18' }}
            >
              <div
                className="mr-4 w-px self-stretch transition-colors"
                style={{ background: peeking ? '#7f1d1d' : '#dc262644' }}
              />
              <span className="mr-3 w-5 text-center font-mono text-xs" style={{ color: '#7f1d1d' }}>
                !
              </span>
              <span
                style={{ color: peeking ? '#7f1d1d' : '#dc262666' }}
                className="transition-colors group-hover:!text-red-400"
              >
                {LOCK_ICON}
              </span>
              <span
                className="ml-4 flex-1 font-mono text-[13px] sm:text-[15px] tracking-[0.18em] transition-colors"
                style={{ color: '#dc262666' }}
                data-hover="#f87171"
              >
                {peeking ? 'RESEALING...' : 'PEEK'}
              </span>
              <span
                className="font-mono text-xs opacity-0 transition-opacity group-hover:opacity-100"
                style={{ color: '#dc2626' }}
              >
                ▷
              </span>
            </button>
          )}

          {/* R/P/S choices */}
          {CHOICES.map((c, i) => (
            <button
              key={c}
              onClick={() => handleChoice(c)}
              className={`${btnRow} hover:bg-[#061a0c]`}
              style={{
                borderTop:
                  i > 0 || (mode === 'vs-ai' && phase === 'locked')
                    ? '1px solid #0f2a18'
                    : undefined,
              }}
            >
              <div className="mr-4 w-px self-stretch bg-[#22c55e33] transition-colors group-hover:bg-[#22c55e99]" />
              <span
                className="mr-3 w-5 text-center font-mono text-xs sm:text-[12px]"
                style={{ color: '#4ade80' }}
              >
                0{i + 1}
              </span>
              <span className="transition-colors" style={{ color: '#4ade80' }} data-hover="#86efac">
                {ICONS[c]}
              </span>
              <span
                className="ml-4 flex-1 font-mono text-[13px] sm:text-[15px] tracking-[0.18em] transition-colors"
                style={{ color: '#86efac' }}
              >
                {LABEL[c]}
              </span>
              {mode === 'coach' && (
                <span className="font-mono text-sm tracking-wider" style={{ color: '#1a5c2a' }}>
                  OPPONENT
                </span>
              )}
              <span
                className="font-mono text-xs opacity-0 transition-opacity group-hover:opacity-100"
                style={{ color: '#22c55e88' }}
              >
                ▷
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Series over */}
      {isOver && (
        <div
          className="w-full max-w-lg rounded p-6 text-center"
          style={{
            background:
              game.seriesWinner === 'human'
                ? '#030f06'
                : game.seriesWinner === 'ai'
                  ? '#0c0303'
                  : '#050a06',
            border: `1px solid ${game.seriesWinner === 'human' ? '#1a6632' : game.seriesWinner === 'ai' ? '#7f1d1d' : '#1a3a2a'}`,
            boxShadow:
              game.seriesWinner === 'human'
                ? '0 0 40px #22c55e22, inset 0 0 40px #00000060'
                : game.seriesWinner === 'ai'
                  ? '0 0 40px #dc262622, inset 0 0 40px #00000060'
                  : 'inset 0 0 40px #00000060',
            animation:
              game.seriesWinner === 'human'
                ? 'rps-victory 0.8s ease-out'
                : game.seriesWinner === 'ai'
                  ? 'rps-defeat 0.7s ease-out'
                  : undefined,
          }}
        >
          {mode === 'vs-ai' ? (
            <>
              <div
                className="font-display text-3xl tracking-widest"
                style={{
                  color:
                    game.seriesWinner === 'human'
                      ? '#4ade80'
                      : game.seriesWinner === 'ai'
                        ? '#dc2626'
                        : '#9ca3af',
                  textShadow:
                    game.seriesWinner === 'human'
                      ? '0 0 20px #22c55e, 0 0 60px #22c55e66'
                      : game.seriesWinner === 'ai'
                        ? '0 0 20px #dc2626, 0 0 60px #dc262666'
                        : undefined,
                }}
              >
                {game.seriesWinner === 'human'
                  ? 'VICTORY'
                  : game.seriesWinner === 'ai'
                    ? 'DEFEAT'
                    : 'DRAW'}
              </div>
              <div
                className="mt-1 text-xs tracking-[0.3em]"
                style={{
                  color:
                    game.seriesWinner === 'human'
                      ? '#166534'
                      : game.seriesWinner === 'ai'
                        ? '#7f1d1d'
                        : '#374151',
                }}
              >
                {game.seriesWinner === 'human'
                  ? 'HUMAN WINS THE SERIES'
                  : game.seriesWinner === 'ai'
                    ? 'AI WINS THE SERIES'
                    : 'SERIES CONCLUDED — EVEN MATCH'}
              </div>
              <div className="mt-4 flex justify-center gap-8">
                <div>
                  <div className="text-2xl font-bold" style={{ color: '#4ade80' }}>
                    {String(game.humanScore).padStart(2, '0')}
                  </div>
                  <div className="text-xs tracking-widest" style={{ color: '#4ade80' }}>
                    HUMAN
                  </div>
                </div>
                <div style={{ color: '#0f3018' }} className="text-2xl font-bold self-center">
                  —
                </div>
                <div>
                  <div className="text-2xl font-bold" style={{ color: '#f87171' }}>
                    {String(game.aiScore).padStart(2, '0')}
                  </div>
                  <div className="text-xs tracking-widest" style={{ color: '#f87171' }}>
                    AI
                  </div>
                </div>
              </div>
              <div className="mt-2 text-xs tracking-[0.2em]" style={{ color: '#1a3a2a' }}>
                RECORD&nbsp;&nbsp;{record.wins}W / {record.losses}L
              </div>
            </>
          ) : (
            <>
              <div
                className="font-display text-3xl tracking-widest"
                style={{
                  color: game.humanScore >= 8 ? '#4ade80' : '#f87171',
                  textShadow:
                    game.humanScore >= 8
                      ? '0 0 20px #22c55e, 0 0 60px #22c55e66'
                      : '0 0 20px #dc2626, 0 0 60px #dc262666',
                }}
              >
                {game.humanScore >= 11
                  ? 'DOMINATED'
                  : game.humanScore >= 8
                    ? 'CRUSHED'
                    : game.humanScore >= 5
                      ? 'CONTESTED'
                      : 'OUTWITTED'}
              </div>
              <div
                className="mt-1 text-xs tracking-[0.3em]"
                style={{ color: game.humanScore >= 8 ? '#166534' : '#7f1d1d' }}
              >
                {game.humanScore >= 8
                  ? 'YOUR FRIEND NEVER SAW IT COMING'
                  : 'THE MACHINE NEEDS MORE DATA'}
              </div>
              <div className="mt-4 flex justify-center gap-8">
                <div>
                  <div className="text-3xl font-bold tabular-nums" style={{ color: '#4ade80' }}>
                    {String(game.humanScore).padStart(2, '0')}
                  </div>
                  <div className="text-xs tracking-widest" style={{ color: '#166534' }}>
                    AI CORRECT
                  </div>
                </div>
                <div className="self-center text-xl font-bold" style={{ color: '#0f3018' }}>
                  —
                </div>
                <div>
                  <div className="text-3xl font-bold tabular-nums" style={{ color: '#f87171' }}>
                    {String(game.rounds.length - game.humanScore).padStart(2, '0')}
                  </div>
                  <div className="text-xs tracking-widest" style={{ color: '#7f1d1d' }}>
                    AI WRONG
                  </div>
                </div>
              </div>
              <div className="mt-2 text-xs tracking-[0.3em]" style={{ color: '#1a6632' }}>
                AI ACCURACY&nbsp;&nbsp;{Math.round((game.humanScore / TOTAL_ROUNDS) * 100)}%
              </div>
            </>
          )}

          <div
            className="my-4 h-px"
            style={{
              background: `linear-gradient(to right, transparent, ${game.seriesWinner === 'ai' ? '#7f1d1d' : '#1a6632'} 20%, ${game.seriesWinner === 'ai' ? '#dc2626' : '#22c55e'} 50%, ${game.seriesWinner === 'ai' ? '#7f1d1d' : '#1a6632'} 80%, transparent)`,
            }}
          />

          <button
            onClick={restart}
            className="rounded px-8 py-2.5 text-xs font-bold tracking-[0.2em] transition-all hover:scale-105"
            style={{
              background: '#040e07',
              border: '1px solid #22c55e',
              color: '#4ade80',
              boxShadow: '0 0 10px #22c55e44',
            }}
          >
            NEW ENGAGEMENT
          </button>
        </div>
      )}

      {/* W/L record (idle, not over) */}
      {!isOver && mode === 'vs-ai' && (record.wins > 0 || record.losses > 0) && (
        <p className="mt-3 font-mono text-xs tracking-[0.2em]" style={{ color: '#0f3018' }}>
          RECORD&nbsp;&nbsp;{record.wins}W / {record.losses}L
        </p>
      )}

      <style>{`
        @keyframes rps-scan {
          0%   { top: -2px; opacity: 0; }
          5%   { opacity: 1; }
          95%  { opacity: 1; }
          100% { top: calc(100% + 2px); opacity: 0; }
        }
        @keyframes rps-victory {
          0%   { transform: scale(0.92) rotate(-1deg); filter: brightness(0.6); }
          15%  { transform: scale(1.06) rotate(1.5deg); filter: brightness(2.2); }
          30%  { transform: scale(0.97) rotate(-1deg); filter: brightness(1.4); }
          45%  { transform: scale(1.04) rotate(0.8deg); filter: brightness(1.8); }
          60%  { transform: scale(0.99) rotate(-0.4deg); filter: brightness(1.2); }
          100% { transform: scale(1) rotate(0deg); filter: brightness(1); }
        }
        @keyframes rps-defeat {
          0%   { transform: translate(0,0) rotate(0deg); filter: brightness(1); }
          10%  { transform: translate(-8px,2px) rotate(-2deg); filter: brightness(1.8) saturate(2); }
          25%  { transform: translate(8px,-2px) rotate(2deg); }
          40%  { transform: translate(-5px,1px) rotate(-1.5deg); filter: brightness(1.3); }
          60%  { transform: translate(5px,0) rotate(1deg); }
          80%  { transform: translate(-2px,0) rotate(-0.5deg); }
          100% { transform: translate(0,0) rotate(0deg); filter: brightness(1); }
        }
      `}</style>
    </div>
  );
}
