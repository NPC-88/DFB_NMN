// Gradient field: a value 0..1 at every point of the composition, generated
// in the tool (no image upload). Pure math, no DOM.
//
// Two modes, ported from the HUK pattern generator (huk-pattern-tool.vercel.app,
// pages "Parametric" and "Controls") so the team gets the same handles:
//   parametric: a straight gradient (rotate) bent by a sine (waves), blended
//               toward a radial gradient (curve)
//   points:     soft blobs around draggable points (metaballs)
// Both then pass through brightness (offset) and contrast.
// Value 1 = heaviest weight, 0 = lightest.

export const FIELD_DEFAULTS = {
  mode: 'parametric',      // 'parametric' | 'points'
  waves: 0.4,              // 0..1 → 1..20 sine bends (HUK u_Param1)
  curve: 0.5,              // 0..1 → straight .. 60 % radial (HUK u_Param2)
  rotate: 0.2,             // 0..1 → 0..360° (HUK u_Param3)
  size: 0.5,               // points mode: blob strength 0..1 → 0..2 (HUK u_Param1 in Controls)
  points: [
    { x: 0.25, y: 0.3, r: 0.18 },
    { x: 0.7, y: 0.65, r: 0.22 },
  ],
  contrast: 0,             // 0..1 → ×1..×4 (HUK u_Param4)
  offset: 0.5,             // 0..1 → −1..+1 lighter/heavier (HUK u_Param6; 0.5 = neutral)
};

export function createField(params, width, height) {
  const p = { ...FIELD_DEFAULTS, ...params };
  const contrast = 1 + 3 * p.contrast;
  const offset = -1 + 2 * p.offset;
  // HUK's parametric gradient runs about −0.6..0.6; lift it by 0.5 so the
  // neutral offset spreads it over the whole weight range instead of half.
  const base = p.mode === 'points' ? 0 : 0.5;
  const finish = (g) => clamp01((g + base + offset - 0.5) * contrast + 0.5);

  if (p.mode === 'points') {
    const aspect = width / height;
    const strength = 2 * p.size;
    const pts = (p.points || []).filter((q) => q && q.r > 0.001);
    return (x, y) => {
      const u = x / width, v = y / height;            // top-left origin, as HUK Controls
      let f = 0;
      for (const q of pts) {
        const dx = (u - q.x) * aspect, dy = v - q.y;
        f += (q.r * q.r) / (dx * dx + dy * dy + 0.001);
      }
      return finish(smoothstep(f * strength));
    };
  }

  const waves = 1 + 19 * p.waves;
  const curve = 0.6 * p.curve;
  const a = 2 * Math.PI * p.rotate;
  const c = Math.cos(a), s = Math.sin(a);
  return (x, y) => {
    const ux = x / width - 0.5, uy = (1 - y / height) - 0.5;   // GL-style uv, y up
    const rx = ux * c + uy * s, ry = -ux * s + uy * c;         // uv * rot(a)
    let d = rx;
    d += (Math.hypot(rx, ry) - d) * curve;
    d += Math.sin((ry + 0.5) * waves) * 0.1;
    return finish(d);
  };
}

const smoothstep = (t) => { t = clamp01(t); return t * t * (3 - 2 * t); };
export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
