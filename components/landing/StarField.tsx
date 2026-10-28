"use client";

import { useEffect, useRef } from "react";

// Gold particles that gather into an eight-pointed star (two squares, a rosette and two rings),
// drift away from the pointer and slowly turn. Plain 2D canvas, paused when off-screen, and a
// still star for prefers-reduced-motion.

type P = { x: number; y: number; sx: number; sy: number; c: number; s: number; d: number };

const COLORS = ["246,227,161", "212,175,55", "47,191,138"];

function sample(n: number): Omit<P, "sx" | "sy" | "d">[] {
  const out: Omit<P, "sx" | "sy" | "d">[] = [];
  const add = (x: number, y: number, c: number) => out.push({ x, y, c, s: Math.random() });
  const line = (ax: number, ay: number, bx: number, by: number, k: number, c: number) => {
    for (let i = 0; i < k; i++) {
      const t = Math.random();
      add(ax + (bx - ax) * t + (Math.random() - 0.5) * 0.012, ay + (by - ay) * t + (Math.random() - 0.5) * 0.012, c);
    }
  };
  const square = (r: number, rot: number, k: number, c: number) => {
    for (let i = 0; i < 4; i++) {
      const a1 = rot + (i * Math.PI) / 2, a2 = a1 + Math.PI / 2;
      line(Math.cos(a1) * r, Math.sin(a1) * r, Math.cos(a2) * r, Math.sin(a2) * r, k, c);
    }
  };
  const ring = (r: number, k: number, c: number) => {
    for (let i = 0; i < k; i++) {
      const a = Math.random() * Math.PI * 2, rr = r + (Math.random() - 0.5) * 0.012;
      add(Math.cos(a) * rr, Math.sin(a) * rr, c);
    }
  };
  const u = n / 6000;
  square(0.95, Math.PI / 4, 420 * u, 0);
  square(0.95, 0, 420 * u, 0);
  square(0.48, Math.PI / 8, 220 * u, 1);
  square(0.48, Math.PI / 8 + Math.PI / 4, 220 * u, 1);
  ring(0.67, 700 * u, 1);
  ring(0.22, 260 * u, 2);
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 + Math.PI / 8;
    line(Math.cos(a) * 0.22, Math.sin(a) * 0.22, Math.cos(a) * 0.67, Math.sin(a) * 0.67, 70 * u, 2);
  }
  return out;
}

export default function StarField({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const small = innerWidth < 700;
    const pts: P[] = sample(small ? 2600 : 5200).map((p) => {
      const a = Math.random() * Math.PI * 2, r = 1.4 + Math.random() * 1.6;
      return { ...p, sx: Math.cos(a) * r, sy: Math.sin(a) * r, d: Math.random() * 0.5 };
    });
    let w = 0, h = 0, cx = 0, cy = 0, R = 0, dpr = 1;
    const resize = () => {
      dpr = Math.min(devicePixelRatio, 2);
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      const wide = w > 1000;
      cx = wide ? w * 0.27 : w / 2;
      cy = wide ? h * 0.5 : h * 0.22;
      R = wide ? Math.min(h * 0.36, w * 0.21) : Math.min(w * 0.36, h * 0.16);
    };
    resize();
    addEventListener("resize", resize);

    let mx = -9999, my = -9999;
    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      mx = e.clientX - r.left; my = e.clientY - r.top;
    };
    addEventListener("pointermove", onMove);

    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(canvas);

    const t0 = performance.now();
    let raf = 0;
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      if (!visible) return;
      const t = (now - t0) / 1000;
      const mix = reduce ? 1 : Math.min(1, Math.max(0, (t - 0.3) / 2.6));
      const rot = reduce ? 0 : t * 0.05;
      const cos = Math.cos(rot), sin = Math.sin(rot);
      const fade = Math.max(0, 1 - scrollY / (h * 0.9));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";
      for (const p of pts) {
        const m = Math.min(1, Math.max(0, mix * 1.6 - p.d));
        const e = 1 - Math.pow(1 - m, 4);
        const px = p.sx + (p.x - p.sx) * e, py = p.sy + (p.y - p.sy) * e;
        let x = cx + (px * cos - py * sin) * R + Math.sin(t * 0.7 + p.s * 40) * 1.5;
        let y = cy + (px * sin + py * cos) * R + Math.cos(t * 0.6 + p.s * 30) * 1.5;
        const dx = x - mx, dy = y - my, dd = dx * dx + dy * dy;
        if (dd < 9000) {
          const f = (1 - dd / 9000) * 22, l = Math.sqrt(dd) || 1;
          x += (dx / l) * f; y += (dy / l) * f;
        }
        const tw = 0.55 + 0.45 * Math.sin(t * 2 + p.s * 60);
        ctx.fillStyle = `rgba(${COLORS[p.c]},${(0.35 + 0.5 * tw) * fade})`;
        const s = p.c === 0 ? 1.6 : 1.3;
        ctx.fillRect(x - s / 2, y - s / 2, s, s);
      }
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      removeEventListener("resize", resize);
      removeEventListener("pointermove", onMove);
    };
  }, []);

  return <canvas ref={ref} className={className} aria-hidden="true" />;
}
