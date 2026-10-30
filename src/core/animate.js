// Animation of the gradient: moments (keyframes) and "Fließen" (flow).
//   const anim = { moments: [{ field, hold? }], durations: [s…], easing, loop, flow, flowSpeed, length }
//   fieldAt(base, anim, t) → the gradient (field params) at time t (seconds)
// Only the gradient moves; text, format and type stay as in the base params.
// Pure math, no DOM.

export const ANIM_DEFAULTS = {
  moments: [],          // [{ field }] — snapshots of params.field
  durations: [],        // seconds from moment i to the next (the last one leads back to the first)
  easing: 'smooth',     // 'smooth' | 'linear'
  loop: 'loop',         // 'loop' (… → last → first) | 'pingpong' (… → last → … → first)
  flow: false,          // endless drift on top of the moments
  flowTurns: 1,         // drift cycles per loop
  length: 8,            // seconds, used when there are fewer than two moments
  fps: 25,
};

const TAU = Math.PI * 2;
const lerp = (a, b, k) => a + (b - a) * k;
const ease = (k, kind) => (kind === 'linear' ? k : k * k * (3 - 2 * k));

// Total loop length in seconds.
export function animLength(anim) {
  const a = { ...ANIM_DEFAULTS, ...anim };
  const n = a.moments.length;
  if (n < 2) return a.length;
  const d = (i) => Math.max(0.1, a.durations[i] ?? 2);
  if (a.loop === 'pingpong') { let s = 0; for (let i = 0; i < n - 1; i++) s += d(i); return 2 * s; }
  let s = 0; for (let i = 0; i < n; i++) s += d(i); return s;
}

// Gradient at time t (wraps around the loop).
export function fieldAt(baseField, anim, t) {
  const a = { ...ANIM_DEFAULTS, ...anim };
  const L = animLength(a);
  const u = ((t % L) + L) % L;
  let f = baseField;
  const n = a.moments.length;
  if (n === 1) f = a.moments[0].field;
  if (n >= 2) {
    const d = (i) => Math.max(0.1, a.durations[i] ?? 2);
    // sequence of segments [from, to, duration]
    const segs = [];
    if (a.loop === 'pingpong') {
      for (let i = 0; i < n - 1; i++) segs.push([i, i + 1, d(i)]);
      for (let i = n - 1; i > 0; i--) segs.push([i, i - 1, d(i - 1)]);
    } else {
      for (let i = 0; i < n; i++) segs.push([i, (i + 1) % n, d(i)]);
    }
    let acc = 0, seg = segs[segs.length - 1], k = 1;
    for (const sg of segs) {
      if (u <= acc + sg[2]) { seg = sg; k = (u - acc) / sg[2]; break; }
      acc += sg[2];
    }
    f = blendField(a.moments[seg[0]].field, a.moments[seg[1]].field, ease(Math.min(1, Math.max(0, k)), a.easing));
  }
  if (a.flow) f = flowField(f, (u / L) * a.flowTurns);
  return f;
}

// Blend two gradients. Numbers blend, angles take the short way round,
// points/stops are matched by index (extra ones grow from / shrink to nothing).
// The mode and the parametric type cannot blend: they switch halfway.
export function blendField(A, B, k) {
  const out = { ...(k < 0.5 ? A : B) };
  for (const key of ['bands', 'phase', 'wobble', 'wobbleFreq', 'wobblePhase', 'waves', 'bend', 'size', 'contrast', 'offset']) {
    if (typeof A[key] === 'number' && typeof B[key] === 'number') out[key] = lerp(A[key], B[key], k);
  }
  if (typeof A.angle === 'number' && typeof B.angle === 'number') {
    let d = ((B.angle - A.angle) % 360 + 540) % 360 - 180;
    out.angle = (A.angle + d * k + 360) % 360;
  }
  for (const key of ['a', 'b']) if (A[key] && B[key]) out[key] = { x: lerp(A[key].x, B[key].x, k), y: lerp(A[key].y, B[key].y, k) };
  if (A.points && B.points) {
    const m = Math.max(A.points.length, B.points.length);
    out.points = [];
    for (let i = 0; i < m; i++) {
      const p = A.points[i], q = B.points[i];
      if (p && q) out.points.push({ x: lerp(p.x, q.x, k), y: lerp(p.y, q.y, k), r: lerp(p.r, q.r, k) });
      else if (p) out.points.push({ ...p, r: p.r * (1 - k) });
      else out.points.push({ ...q, r: q.r * k });
    }
  }
  if (A.stops && B.stops) {
    // sample both curves on the union of stop positions and blend the values
    const pos = [...new Set([...A.stops, ...B.stops].map((s) => +s.pos.toFixed(4)))].sort((x, y) => x - y);
    const at = (stops, t) => {
      const s = [...stops].sort((x, y) => x.pos - y.pos);
      if (t <= s[0].pos) return s[0].value;
      for (let i = 1; i < s.length; i++) if (t <= s[i].pos) {
        const span = s[i].pos - s[i - 1].pos;
        return lerp(s[i - 1].value, s[i].value, span > 0 ? (t - s[i - 1].pos) / span : 1);
      }
      return s[s.length - 1].value;
    };
    out.stops = pos.map((t) => ({ pos: t, value: lerp(at(A.stops, t), at(B.stops, t), k) }));
  }
  return out;
}

// Fließen: c = 0..1 per cycle, seamless at c = 1.
//   waves: the bands travel one wave; Verlauf: the bends travel;
//   Parametrisch: the gradient turns once around the centre; Punkte: points orbit the centre.
export function flowField(f, c) {
  const out = { ...f };
  const turn = (q, ang) => {
    const dx = q.x - 0.5, dy = q.y - 0.5, cs = Math.cos(ang), sn = Math.sin(ang);
    return { ...q, x: 0.5 + dx * cs - dy * sn, y: 0.5 + dx * sn + dy * cs };
  };
  if (f.mode === 'waves') out.phase = (f.phase || 0) + c;
  else if (f.mode === 'ramp') out.wobblePhase = (f.wobblePhase || 0) + c;
  else if (f.mode === 'parametric') { out.a = turn(f.a, TAU * c); out.b = turn(f.b, TAU * c); }
  else if (f.mode === 'points') out.points = (f.points || []).map((q) => turn(q, TAU * c));
  return out;
}
