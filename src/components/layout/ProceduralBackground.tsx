import { useEffect, useRef } from "react";
import { useBackground, type ProceduralKind } from "@/contexts/BackgroundContext";

function readAccent(): { r: number; g: number; b: number } {
  const root = getComputedStyle(document.documentElement);
  const accent = root.getPropertyValue("--color-accent").trim() || "#10b981";
  const hex = accent.startsWith("#") ? accent.slice(1) : "10b981";
  const full = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex.padEnd(6, "0").slice(0, 6);
  const n = parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

type Node = { x: number; y: number; vx: number; vy: number; r: number };
type Particle = { x: number; y: number; z: number; s: number };
type RainRipple = {
  x: number;
  y: number;
  born: number;
  life: number;
  maxRad: number;
  rings: number;
};

function paintNeural(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  nodes: Node[],
  accent: { r: number; g: number; b: number },
) {
  ctx.clearRect(0, 0, w, h);
  const { r, g, b } = accent;
  for (const n of nodes) {
    n.x += n.vx;
    n.y += n.vy;
    if (n.x < 0 || n.x > w) n.vx *= -1;
    if (n.y < 0 || n.y > h) n.vy *= -1;
  }
  const maxDist = Math.min(w, h) * 0.22;
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const c = nodes[j];
      const d = Math.hypot(a.x - c.x, a.y - c.y);
      if (d > maxDist) continue;
      const alpha = (1 - d / maxDist) * 0.45;
      ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(c.x, c.y);
      ctx.stroke();
    }
  }
  for (const n of nodes) {
    const pulse = 0.55 + 0.45 * Math.sin(t * 0.002 + n.x * 0.01);
    ctx.fillStyle = `rgba(${r},${g},${b},${0.35 + pulse * 0.4})`;
    ctx.beginPath();
    ctx.arc(n.x, n.y, n.r * pulse, 0, Math.PI * 2);
    ctx.fill();
  }
}

function paintAurora(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  accent: { r: number; g: number; b: number },
) {
  ctx.clearRect(0, 0, w, h);
  const { r, g, b } = accent;
  for (let band = 0; band < 5; band++) {
    ctx.beginPath();
    const baseY = h * (0.25 + band * 0.12);
    for (let x = 0; x <= w; x += 8) {
      const y =
        baseY +
        Math.sin(x * 0.004 + t * 0.0008 + band) * 40 +
        Math.sin(x * 0.01 + t * 0.0012 + band * 2) * 18;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    const alpha = 0.08 + band * 0.02;
    const gr = ctx.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, `rgba(${r},${Math.min(255, g + 40)},${b},${alpha})`);
    gr.addColorStop(0.5, `rgba(${Math.min(255, r + 30)},${g},${Math.min(255, b + 50)},${alpha * 0.5})`);
    gr.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gr;
    ctx.fill();
  }
}

function paintLattice(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  accent: { r: number; g: number; b: number },
) {
  ctx.clearRect(0, 0, w, h);
  const { r, g, b } = accent;
  const step = 48;
  const warp = (x: number, y: number) => ({
    x: x + Math.sin(y * 0.02 + t * 0.0007) * 14,
    y: y + Math.cos(x * 0.02 + t * 0.0006) * 14,
  });
  ctx.strokeStyle = `rgba(${r},${g},${b},0.18)`;
  ctx.lineWidth = 1;
  for (let y = -step; y < h + step; y += step) {
    ctx.beginPath();
    for (let x = -step; x < w + step; x += step) {
      const p = warp(x, y);
      if (x === -step) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  }
  for (let x = -step; x < w + step; x += step) {
    ctx.beginPath();
    for (let y = -step; y < h + step; y += step) {
      const p = warp(x, y);
      if (y === -step) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  }
}

function paintBloom(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  particles: Particle[],
  accent: { r: number; g: number; b: number },
) {
  ctx.clearRect(0, 0, w, h);
  const { r, g, b } = accent;
  const cx = w / 2;
  const cy = h / 2;
  for (const p of particles) {
    p.z -= 0.35 + p.s * 0.15;
    if (p.z <= 1) {
      p.z = 80 + Math.random() * 40;
      p.x = (Math.random() - 0.5) * w;
      p.y = (Math.random() - 0.5) * h;
    }
    const k = 120 / p.z;
    const sx = cx + p.x * k;
    const sy = cy + p.y * k + Math.sin(t * 0.001 + p.x) * 4;
    const size = (1 - p.z / 120) * 3.5 * p.s;
    const alpha = Math.max(0, 1 - p.z / 120) * 0.7;
    ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
    ctx.beginPath();
    ctx.arc(sx, sy, Math.max(0.4, size), 0, Math.PI * 2);
    ctx.fill();
  }
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(w, h) * 0.45);
  glow.addColorStop(0, `rgba(${r},${g},${b},0.12)`);
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
}

/** Raindrop ripples — spawn at random points, expand & fade */
function paintRipple(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  ripples: RainRipple[],
  accent: { r: number; g: number; b: number },
  lastSpawn: { t: number },
) {
  ctx.clearRect(0, 0, w, h);
  const { r, g, b } = accent;

  // Spawn like rain — irregular intervals, random positions
  const since = t - lastSpawn.t;
  const due = 90 + Math.random() * 220;
  if (since > due && ripples.length < 28) {
    lastSpawn.t = t;
    const burst = 1 + (Math.random() < 0.35 ? 1 : 0) + (Math.random() < 0.12 ? 1 : 0);
    for (let i = 0; i < burst; i++) {
      ripples.push({
        x: Math.random() * w,
        y: Math.random() * h,
        born: t,
        life: 900 + Math.random() * 1100,
        maxRad: 28 + Math.random() * 70,
        rings: 2 + Math.floor(Math.random() * 2),
      });
    }
  }

  for (let i = ripples.length - 1; i >= 0; i--) {
    const drop = ripples[i];
    const age = t - drop.born;
    if (age > drop.life) {
      ripples.splice(i, 1);
      continue;
    }
    const progress = age / drop.life;

    for (let ring = 0; ring < drop.rings; ring++) {
      const lag = ring * 0.14;
      const p = Math.max(0, Math.min(1, (progress - lag) / (1 - lag)));
      if (p <= 0) continue;
      const rad = drop.maxRad * (1 - Math.pow(1 - p, 1.4));
      const alpha = (1 - p) * (0.14 - ring * 0.035);
      if (alpha <= 0.008) continue;
      ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`;
      ctx.lineWidth = Math.max(0.45, 1.05 * (1 - p));
      ctx.beginPath();
      ctx.ellipse(drop.x, drop.y, rad, rad * 0.55, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Tiny impact flash at birth
    if (progress < 0.08) {
      const flash = (1 - progress / 0.08) * 0.18;
      ctx.fillStyle = `rgba(${r},${g},${b},${flash})`;
      ctx.beginPath();
      ctx.ellipse(drop.x, drop.y, 2.2, 1.2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

export function ProceduralBackground() {
  const { backgroundMeta, isProcedural } = useBackground();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const kind = backgroundMeta.procedural as ProceduralKind | undefined;

  useEffect(() => {
    if (!isProcedural || !kind) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let running = true;
    const nodes: Node[] = [];
    const particles: Particle[] = [];
    const ripples: RainRipple[] = [];
    const lastSpawn = { t: 0 };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      nodes.length = 0;
      const count = Math.floor((w * h) / 18000);
      for (let i = 0; i < Math.max(28, Math.min(70, count)); i++) {
        nodes.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.35,
          vy: (Math.random() - 0.5) * 0.35,
          r: 1.5 + Math.random() * 2.2,
        });
      }

      particles.length = 0;
      for (let i = 0; i < 120; i++) {
        particles.push({
          x: (Math.random() - 0.5) * w,
          y: (Math.random() - 0.5) * h,
          z: Math.random() * 120,
          s: 0.5 + Math.random(),
        });
      }

      ripples.length = 0;
      lastSpawn.t = 0;
    };

    resize();
    window.addEventListener("resize", resize);

    const tick = (t: number) => {
      if (!running) return;
      const w = window.innerWidth;
      const h = window.innerHeight;
      const accent = readAccent();
      switch (kind) {
        case "neural":
          paintNeural(ctx, w, h, t, nodes, accent);
          break;
        case "aurora":
          paintAurora(ctx, w, h, t, accent);
          break;
        case "lattice":
          paintLattice(ctx, w, h, t, accent);
          break;
        case "bloom":
          paintBloom(ctx, w, h, t, particles, accent);
          break;
        case "ripple":
          paintRipple(ctx, w, h, t, ripples, accent, lastSpawn);
          break;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [isProcedural, kind]);

  if (!isProcedural || !kind) return null;

  return (
    <div className="atmo atmo-live-bg atmo-procedural" aria-hidden>
      <canvas ref={canvasRef} className="atmo-procedural-canvas" />
      <div className="atmo-live-scrim" />
    </div>
  );
}

export function OrbsBackground() {
  const { backgroundMeta } = useBackground();
  if (!backgroundMeta.orbs) return null;
  return (
    <div className="atmo atmo-live-bg atmo-orbs" aria-hidden>
      <div className="sky">
        <div className="orb o1" />
        <div className="orb o2" />
        <div className="orb o3" />
      </div>
      <div className="atmo-live-scrim" />
    </div>
  );
}
