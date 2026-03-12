// ── Confetti celebration effect ──────────────────────────────────────
// Call `launchConfetti()` to spray confetti from the top of the screen.
// Renders onto a full-screen canvas overlay that auto-cleans up.

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  color: string;
  size: number;
  life: number;
}

const COLORS = [
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#fff',
];

export function launchConfetti(duration = 2000): void {
  const canvas = document.createElement('canvas');
  canvas.style.cssText =
    'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9999';
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const particles: Particle[] = [];
  const startTime = Date.now();

  // Spawn particles in bursts
  function spawn() {
    const count = 15;
    for (let i = 0; i < count; i++) {
      particles.push({
        x: canvas.width * (0.2 + Math.random() * 0.6),
        y: -10,
        vx: (Math.random() - 0.5) * 8,
        vy: Math.random() * 4 + 2,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 12,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        size: Math.random() * 6 + 4,
        life: 1,
      });
    }
  }

  let spawnTimer = 0;

  function frame() {
    const elapsed = Date.now() - startTime;
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Spawn new particles during the burst phase
    spawnTimer++;
    if (elapsed < duration * 0.6 && spawnTimer % 3 === 0) {
      spawn();
    }

    // Update and draw
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.vy += 0.12; // gravity
      p.y += p.vy;
      p.vx *= 0.99;
      p.rotation += p.rotationSpeed;
      p.life -= 0.008;

      if (p.life <= 0 || p.y > canvas.height + 20) {
        particles.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.globalAlpha = Math.min(1, p.life);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
    }

    if (elapsed < duration || particles.length > 0) {
      requestAnimationFrame(frame);
    } else {
      canvas.remove();
    }
  }

  spawn();
  requestAnimationFrame(frame);
}
