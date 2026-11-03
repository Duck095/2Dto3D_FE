import { useEffect, useRef } from 'react';

/* ─── Shape definitions — Pocket Joy palette ────────────────────────── */
const SHAPES = [
  { id: 0, type: 'sphere', color: '#FFD6E5', size: 60, x: 12, y: 18, vx: 0.3, vy: 0.15, spin: 0, dSpin: 0.8 },
  { id: 1, type: 'diamond', color: '#DCD1FF', size: 55, x: 75, y: 12, vx: -0.2, vy: 0.2, spin: 45, dSpin: 0.5 },
  { id: 2, type: 'cube', color: '#D3F4E8', size: 46, x: 88, y: 70, vx: -0.3, vy: -0.2, spin: 20, dSpin: 0.6 },
  { id: 3, type: 'triangle', color: '#FFE8B3', size: 52, x: 20, y: 75, vx: 0.25, vy: -0.15, spin: 0, dSpin: 0.9 },
  { id: 4, type: 'hexagon', color: '#FFD6E5', size: 58, x: 50, y: 8, vx: -0.15, vy: 0.3, spin: 0, dSpin: 0.4 },
  { id: 5, type: 'ring', color: '#DCD1FF', size: 65, x: 5, y: 50, vx: 0.2, vy: 0.1, spin: 0, dSpin: 0.45 },
  { id: 6, type: 'star', color: '#D3F4E8', size: 50, x: 92, y: 35, vx: -0.2, vy: 0.25, spin: 0, dSpin: 1 },
  { id: 7, type: 'capsule', color: '#FFE8B3', size: 44, x: 60, y: 85, vx: 0.1, vy: -0.3, spin: 30, dSpin: 0.5 },
];

function getClipPath(type) {
  switch (type) {
    case 'triangle': return 'polygon(50% 0%, 0% 100%, 100% 100%)';
    case 'diamond': return 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)';
    case 'hexagon': return 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)';
    case 'star': return 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)';
    default: return 'none';
  }
}

function getBorderRadius(type) {
  switch (type) {
    case 'sphere': return '50%';
    case 'cube': return '12%';
    case 'ring': return '50%';
    case 'capsule': return '999px';
    default: return '0';
  }
}

function ShapeDiv({ type, color, size }) {
  const isRing = type === 'ring';
  const isCapsule = type === 'capsule';
  const w = isCapsule ? size * 0.55 : size;
  const h = isCapsule ? size * 1.2 : size;
  const clipPath = getClipPath(type);
  const borderRadius = getBorderRadius(type);

  if (isRing) {
    return (
      <div style={{
        width: size, height: size,
        borderRadius: '50%',
        border: `${size * 0.13}px solid ${color}`,
        opacity: 0.3,
        flexShrink: 0,
        filter: 'blur(1.5px)',
      }} />
    );
  }

  return (
    <div style={{
      width: w,
      height: h,
      background: `linear-gradient(135deg, ${color}44, ${color}18)`,
      clipPath: clipPath !== 'none' ? clipPath : undefined,
      borderRadius: clipPath === 'none' ? borderRadius : undefined,
      opacity: 0.3,
      flexShrink: 0,
      filter: 'blur(0.8px)',
    }} />
  );
}

/* ─── Main component ─────────────────────────────────────────────────── */
export default function FloatingShapes() {
  // One ref per shape for the DOM element
  const refs = useRef(SHAPES.map(() => null));

  // Physics state (no React state — pure mutable refs for performance)
  const state = useRef(
    SHAPES.map((s, i) => ({
      x: (s.x / 100) * window.innerWidth,
      y: (s.y / 100) * window.innerHeight,
      vx: s.vx,
      vy: s.vy,
      spin: s.spin,
      dSpin: s.dSpin,
      // Each shape has its own wander angle that drifts at a unique rate
      wanderAngle: (i * 137.5 * Math.PI) / 180,  // distributed angle spread so none start the same
      wanderRate: 0.005 + i * 0.0031,            // different drift speed per shape
      speed: 0.35 + (i % 3) * 0.15,         // different cruise speed per shape
    }))
  );

  const mouse = useRef({ x: -9999, y: -9999 });
  const animId = useRef(null);

  useEffect(() => {
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onMouseMove = (e) => {
      mouse.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener('mousemove', onMouseMove);

    const onResize = () => { }; // no-op – shapes now roam freely
    window.addEventListener('resize', onResize);

    const REPEL_RADIUS = 130;  // px – mouse影響範囲
    const REPEL_FORCE = 0.55;
    const DAMPING = 0.94;

    function positionShapes() {
      state.current.forEach((shape, i) => {
        const el = refs.current[i];
        if (el) {
          const size = SHAPES[i].size;
          el.style.transform = `translate(${shape.x - size / 2}px, ${shape.y - size / 2}px) rotate(${shape.spin}deg)`;
        }
      });
    }

    function tick() {
      const shapes = state.current;
      const mx = mouse.current.x;
      const my = mouse.current.y;
      const W = window.innerWidth;
      const H = window.innerHeight;

      shapes.forEach((s, i) => {
        const el = refs.current[i];
        if (!el) return;

        // ── Independent wander: each shape slowly rotates its own heading ──
        s.wanderAngle += s.wanderRate + Math.sin(s.wanderAngle * 0.3) * 0.002;
        s.vx += Math.cos(s.wanderAngle) * s.speed * 0.08;
        s.vy += Math.sin(s.wanderAngle) * s.speed * 0.08;

        // ── Magnetic repulsion from mouse ──────────────────────────────────
        const dx = s.x - mx;
        const dy = s.y - my;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < REPEL_RADIUS && dist > 1) {
          const strength = (1 - dist / REPEL_RADIUS) ** 2 * REPEL_FORCE;
          s.vx += (dx / dist) * strength * 8;
          s.vy += (dy / dist) * strength * 8;
        }

        // ── Speed cap so shapes don't fly off ──────────────────────────────
        const spd = Math.sqrt(s.vx * s.vx + s.vy * s.vy);
        const MAX_SPEED = 3.5;
        if (spd > MAX_SPEED) {
          s.vx = (s.vx / spd) * MAX_SPEED;
          s.vy = (s.vy / spd) * MAX_SPEED;
        }

        // ── Damping ────────────────────────────────────────────────────────
        s.vx *= DAMPING;
        s.vy *= DAMPING;

        // ── Integrate ──────────────────────────────────────────────────────
        s.x += s.vx;
        s.y += s.vy;

        // ── Wrap around edges (toroidal) ───────────────────────────────────
        const sz = SHAPES[i].size;
        const pad = sz * 0.5;
        if (s.x < -pad) s.x = W + pad;
        if (s.x > W + pad) s.x = -pad;
        if (s.y < -pad) s.y = H + pad;
        if (s.y > H + pad) s.y = -pad;

        // ── Spin ───────────────────────────────────────────────────────────
        s.spin += s.dSpin;

        // ── Apply to DOM ───────────────────────────────────────────────────
        el.style.transform = `translate(${s.x - sz / 2}px, ${s.y - sz / 2}px) rotate(${s.spin}deg)`;
      });

      animId.current = requestAnimationFrame(tick);
    }

    function syncMotionPreference() {
      cancelAnimationFrame(animId.current);
      if (motionPreference.matches) {
        positionShapes();
        return;
      }
      animId.current = requestAnimationFrame(tick);
    }

    motionPreference.addEventListener('change', syncMotionPreference);
    syncMotionPreference();

    return () => {
      cancelAnimationFrame(animId.current);
      motionPreference.removeEventListener('change', syncMotionPreference);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      {SHAPES.map((shape, i) => (
        <div
          key={shape.id}
          ref={el => refs.current[i] = el}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: shape.size,
            height: shape.size,
            willChange: 'transform',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            filter: `blur(2px) drop-shadow(0 4px 16px ${shape.color}22)`,
          }}
        >
          <ShapeDiv type={shape.type} color={shape.color} size={shape.size} />
        </div>
      ))}
    </div>
  );
}
