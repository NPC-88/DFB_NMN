// Gradient field: a value 0..1 at every point of the composition, generated
// in the tool (no image upload). Pure math, no DOM. 1 = heaviest, 0 = lightest.
//
// Four ways to build the gradient position t (0..1):
//   waves       repeating soft bands along a direction, gently bent (first version)
//   ramp        one gradient along a direction, gently bent (first version)
//   parametric  linear or radial between two handles A → B (like Figma), bent
//               by a sine (HUK "Wellen")
//   points      soft blobs around points you place, move and resize (HUK "Controls")
// Then, for every mode:
//   stops       a Figma-style stop bar maps t to the value (where it turns
//               black, plateaus, several steps…); smooth between stops
//   contrast / offset   as in HUK

const TAU = Math.PI * 2;

export const FIELD_DEFAULTS = {
  mode: 'waves',
  // waves + ramp
  angle: 90,          // degrees, direction the gradient runs (90 = top → bottom)
  bands: 1.5,         // waves across the frame
  phase: 0,           // shifts the waves, 0..1 = one wave
  wobble: 0.08,       // bend amount
  wobbleFreq: 1,      // bends across the frame
  wobblePhase: 0,     // shifts the bends, 0..1 (animated by "Fließen")
  // parametric
  type: 'linear',     // 'linear' | 'radial'
  a: { x: 0.15, y: 0.2 },   // start (linear) / centre (radial), 0..1 of the frame
  b: { x: 0.85, y: 0.8 },   // end (linear) / edge (radial)
  waves: 0,           // 0..1 → 0..20 sine bends across the gradient
  bend: 0.1,          // bend strength (fraction of the gradient length)
  // points
  size: 0.5,
  points: [
    { x: 0.3, y: 0.35, r: 0.18 },
    { x: 0.7, y: 0.65, r: 0.22 },
  ],
  // all modes
  stops: [{ pos: 0, value: 0 }, { pos: 1, value: 1 }],
  contrast: 0,        // 0..1 → ×1..×4
  offset: 0.5,        // 0..1 → lighter..heavier, 0.5 = neutral
};

export function createField(params, width, height) {
  const p = { ...FIELD_DEFAULTS, ...params };
  const map = stopMap(p.stops);
  const contrast = 1 + 3 * p.contrast;
  const offset = -1 + 2 * p.offset;
  const finish = (t) => clamp01((map(clamp01(t)) + offset - 0.5) * contrast + 0.5);
  const position = positionFn(p, width, height);
  return (x, y) => finish(position(x, y));
}

function positionFn(p, width, height) {
  if (p.mode === 'points') {
    const aspect = width / height;
    const strength = 2 * p.size;
    const pts = (p.points || []).filter((q) => q && q.r > 0.001);
    return (x, y) => {
      const u = x / width, v = y / height;
      let f = 0;
      for (const q of pts) {
        const dx = (u - q.x) * aspect, dy = v - q.y;
        f += (q.r * q.r) / (dx * dx + dy * dy + 0.001);
      }
      return smoothstep(f * strength);
    };
  }

  if (p.mode === 'parametric') {
    // Work in pixels so angles and circles are true on any format.
    const ax = p.a.x * width, ay = p.a.y * height, bx = p.b.x * width, by = p.b.y * height;
    const dx = bx - ax, dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;
    const waves = 20 * p.waves;
    const bendAt = (across) => (waves ? Math.sin(across * waves * Math.PI) * p.bend : 0);
    if (p.type === 'radial') {
      return (x, y) => {
        const rx = x - ax, ry = y - ay;
        const d = Math.hypot(rx, ry) / len;
        const ang = Math.atan2(ry, rx) / Math.PI;           // −1..1 around the centre
        return d + bendAt(ang);
      };
    }
    return (x, y) => {
      const rx = x - ax, ry = y - ay;
      const along = (rx * ux + ry * uy) / len;
      const across = (-rx * uy + ry * ux) / len;
      return along + bendAt(across);
    };
  }

  // waves / ramp: along a direction through the frame centre
  const a = (p.angle * Math.PI) / 180;
  const ux = Math.cos(a), uy = Math.sin(a);
  const vx = -uy, vy = ux;
  const extU = Math.abs(width * ux) + Math.abs(height * uy) || 1;
  const extV = Math.abs(width * vx) + Math.abs(height * vy) || 1;
  const cx = width / 2, cy = height / 2;
  return (x, y) => {
    const dx = x - cx, dy = y - cy;
    let d = (dx * ux + dy * uy) / extU;                  // −0.5..0.5
    const across = (dx * vx + dy * vy) / extV;
    if (p.wobble) d += p.wobble * Math.sin(TAU * (p.wobbleFreq * (across + 0.5) + p.wobblePhase));
    if (p.mode === 'ramp') return d + 0.5;
    return 0.5 - 0.5 * Math.cos(TAU * (d * p.bands + p.phase));
  };
}

// Stops → a smooth curve through every stop (monotone cubic, so it never
// overshoots: two stops give a straight gradient, more stops stay soft).
export function stopMap(stops) {
  const s = (stops && stops.length ? stops : FIELD_DEFAULTS.stops)
    .map((q) => ({ pos: clamp01(q.pos), value: clamp01(q.value) }))
    .sort((m, n) => m.pos - n.pos)
    .filter((q, i, arr) => i === 0 || q.pos > arr[i - 1].pos + 1e-6);
  const n = s.length;
  if (n === 1) return () => s[0].value;
  const d = [], m = new Array(n);
  for (let i = 0; i < n - 1; i++) d.push((s[i + 1].value - s[i].value) / (s[i + 1].pos - s[i].pos));
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {                      // Fritsch–Carlson limiter
    if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], h = a * a + b * b;
    if (h > 9) { const k = 3 / Math.sqrt(h); m[i] = k * a * d[i]; m[i + 1] = k * b * d[i]; }
  }
  return (t) => {
    if (t <= s[0].pos) return s[0].value;
    if (t >= s[n - 1].pos) return s[n - 1].value;
    let i = 0;
    while (t > s[i + 1].pos) i++;
    const hh = s[i + 1].pos - s[i].pos, k = (t - s[i].pos) / hh;
    const k2 = k * k, k3 = k2 * k;
    return clamp01((2 * k3 - 3 * k2 + 1) * s[i].value + (k3 - 2 * k2 + k) * hh * m[i]
      + (-2 * k3 + 3 * k2) * s[i + 1].value + (k3 - k2) * hh * m[i + 1]);
  };
}

const smoothstep = (t) => { t = clamp01(t); return t * t * (3 - 2 * t); };
export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
