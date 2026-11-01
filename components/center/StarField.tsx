"use client";

import { useEffect, useRef } from "react";

// The landing's moving background: particles that gather into an eight-pointed star (two squares,
// a rosette and two rings), turn in 3D, tilt towards the pointer and scatter away from it.
// Colours come from the centre's palette (--accent / --accent-2), so it follows the chosen theme
// and dark mode. Plain 2D canvas, paused off-screen, still for prefers-reduced-motion.

type P = { x: number; y: number; z: number; sx: number; sy: number; sz: number; c: number; s: number; d: number };

function sample(n: number): Pick<P, "x" | "y" | "z" | "c" | "s">[] {
  const out: Pick<P, "x" | "y" | "z" | "c" | "s">[] = [];
  const add = (x: number, y: number, z: number, c: number) => out.push({ x, y, z, c, s: Math.random() });
  const j = () => (Math.random() - 0.5) * 0.012;
  const line = (ax: number, ay: number, bx: number, by: number, k: number, c: number, z: number) => {
    for (let i = 0; i < k; i++) {
      const t = Math.random();
      add(ax + (bx - ax) * t + j(), ay + (by - ay) * t + j(), z + j() * 3, c);
    }
  };
  const square = (r: number, rot: number, k: number, c: number, z: number) => {
    for (let i = 0; i < 4; i++) {
      const a1 = rot + (i * Math.PI) / 2, a2 = a1 + Math.PI / 2;
      line(Math.cos(a1) * r, Math.sin(a1) * r, Math.cos(a2) * r, Math.sin(a2) * r, k, c, z);
    }
  };
  const ring = (r: number, k: number, c: number, z: number) => {
    for (let i = 0; i < k; i++) {
      const a = Math.random() * Math.PI * 2, rr = r + j();
      add(Math.cos(a) * rr, Math.sin(a) * rr, z + j() * 3, c);
    }
  };
  const u = n / 6000;
  // Layers sit at different depths so the 3D turn reads as a sculpture, not a flat drawing.
  square(0.95, Math.PI / 4, 420 * u, 0, -0.12);
  square(0.95, 0, 420 * u, 0, 0.12);
  square(0.48, Math.PI / 8, 220 * u, 1, -0.05);
  square(0.48, Math.PI / 8 + Math.PI / 4, 220 * u, 1, 0.05);
  ring(0.67, 700 * u, 1, 0);
  ring(0.22, 260 * u, 0, 0.2);
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 + Math.PI / 8;
    line(Math.cos(a) * 0.22, Math.sin(a) * 0.22, Math.cos(a) * 0.67, Math.sin(a) * 0.67, 70 * u, 0, 0.1);
  }
  return out;
}

/** "#2f3e9e" / "rgb(47 62 158)" → "47,62,158" (via the canvas colour parser). */
function rgb(ctx: CanvasRenderingContext2D, css: string, fallback: string): string {
  ctx.fillStyle = fallback;
  ctx.fillStyle = css.trim() || fallback;
  const v = String(ctx.fillStyle);
  if (v.startsWith("#")) {
    const n = parseInt(v.slice(1, 7), 16);
    return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
  }
  const m = v.match(/[\d.]+/g);
  return m ? m.slice(0, 3).join(",") : "47,62,158";
}

export default function StarField({ className = "", density = 1 }: { className?: string; density?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const small = innerWidth < 700;
    const pts: P[] = sample((small ? 2200 : 4200) * density).map((p) => {
      const a = Math.random() * Math.PI * 2, r = 1.4 + Math.random() * 1.6;
      return { ...p, sx: Math.cos(a) * r, sy: Math.sin(a) * r, sz: (Math.random() - 0.5) * 2, d: Math.random() * 0.5 };
    });

    let colors = ["47,62,158", "184,146,90"];
    const readColors = () => {
      const cs = getComputedStyle(canvas);
      colors = [rgb(ctx, cs.getPropertyValue("--accent"), "#2f3e9e"), rgb(ctx, cs.getPropertyValue("--accent-2"), "#b8925a")];
    };
    // The palette can change after mount (the centre's own colours are applied in an effect).
    const mo = new MutationObserver(readColors);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-palette", "data-theme", "style"] });
    const dark = matchMedia("(prefers-color-scheme: dark)");
    dark.addEventListener("change", readColors);

    let w = 0, h = 0, cx = 0, cy = 0, R = 0, dpr = 1;
    const resize = () => {
      dpr = Math.min(devicePixelRatio, 2);
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      cx = w / 2; cy = h / 2;
      R = Math.min(w, h) * 0.42;
      readColors();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // Pointer: scatter nearby particles and tilt the star towards it.
    let mx = -9999, my = -9999, tx = 0, ty = 0, tiltX = 0, tiltY = 0;
    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      mx = e.clientX - r.left; my = e.clientY - r.top;
      tx = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (innerWidth / 2)));
      ty = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (innerHeight / 2)));
    };
    const onLeave = () => { mx = my = -9999; tx = ty = 0; };
    addEventListener("pointermove", onMove);
    document.addEventListener("pointerleave", onLeave);

    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(canvas);

    const t0 = performance.now();
    let raf = 0;
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      if (!visible || !w) return;
      const t = (now - t0) / 1000;
      const mix = reduce ? 1 : Math.min(1, Math.max(0, (t - 0.2) / 2.4));
      tiltX += (ty * 0.45 - tiltX) * 0.05;
      tiltY += (tx * 0.55 - tiltY) * 0.05;
      const spin = reduce ? 0 : t * 0.08;
      // Slow 3D sway on top of the pointer tilt.
      const ax = reduce ? 0 : Math.sin(t * 0.35) * 0.35 + tiltX;
      const ay = reduce ? 0 : Math.cos(t * 0.28) * 0.45 + tiltY;
      const cz = Math.cos(spin), sz = Math.sin(spin);
      const cxr = Math.cos(ax), sxr = Math.sin(ax), cyr = Math.cos(ay), syr = Math.sin(ay);
      const persp = 2.6;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      for (const p of pts) {
        const m = Math.min(1, Math.max(0, mix * 1.6 - p.d));
        const e = 1 - Math.pow(1 - m, 4);
        let x = p.sx + (p.x - p.sx) * e, y = p.sy + (p.y - p.sy) * e, z = p.sz + (p.z - p.sz) * e;
        // spin in-plane, then tilt around X and Y
        let x1 = x * cz - y * sz, y1 = x * sz + y * cz;
        const y2 = y1 * cxr - z * sxr, z2 = y1 * sxr + z * cxr;
        x = x1 * cyr + z2 * syr; z = -x1 * syr + z2 * cyr; y = y2;
        const k = persp / (persp + z);
        x1 = cx + x * R * k + Math.sin(t * 0.7 + p.s * 40) * 1.2;
        y1 = cy + y * R * k + Math.cos(t * 0.6 + p.s * 30) * 1.2;
        const dx = x1 - mx, dy = y1 - my, dd = dx * dx + dy * dy;
        if (dd < 8000) {
          const f = (1 - dd / 8000) * 20, l = Math.sqrt(dd) || 1;
          x1 += (dx / l) * f; y1 += (dy / l) * f;
        }
        const tw = 0.6 + 0.4 * Math.sin(t * 2 + p.s * 60);
        const depth = Math.min(1, Math.max(0.25, k - 0.35)); // nearer = stronger
        ctx.fillStyle = `rgba(${colors[p.c]},${(0.25 + 0.55 * tw) * depth})`;
        const s = (p.c === 0 ? 1.7 : 1.4) * k;
        ctx.fillRect(x1 - s / 2, y1 - s / 2, s, s);
      }
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      mo.disconnect();
      dark.removeEventListener("change", readColors);
      removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
    };
  }, [density]);

  return <canvas ref={ref} className={className} aria-hidden="true" />;
}
