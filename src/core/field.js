// Wave field: a smooth value 0..1 at every point of the composition.
// Generated from parameters (no gradient image needed). Pure math, no DOM.
//
// Coordinates are pixels in the composition (x right, y down). The field is
// built along a direction (angle): `d` is the position along that direction,
// normalised so 0..1 spans the frame. Optional bend (wobble) and radial blend
// (curve) shape it; `bands` turns it into repeating waves.

const TAU = Math.PI * 2;

export const FIELD_DEFAULTS = {
  shape: 'waves',      // 'waves' (repeating bands) | 'ramp' (one gradient from less to more)
  waveform: 'sine',    // 'sine' (soft) | 'triangle' (linear rise and fall)
  angle: 90,           // direction the weight changes along, degrees (0 = left→right, 90 = top→bottom)
  bands: 1.5,          // waves across the frame (shape 'waves')
  phase: 0,            // shifts the waves along the direction, 0..1 = one wave
  wobble: 0.08,        // how much the bands bend (fraction of the frame)
  wobbleFreq: 1,       // bends across the frame
  wobblePhase: 0,      // shifts the bends, 0..1
  curve: 0,            // 0 = straight bands, 1 = circular around the centre
  cx: 0.5, cy: 0.5,    // centre for curve and rotation, 0..1 of the frame
  contrast: 0,         // 0 = smooth, 1 = hard: pushes values toward the extremes
  offset: 0,           // -1..1: shifts the whole field lighter/heavier
};

export function createField(params, width, height) {
  const p = { ...FIELD_DEFAULTS, ...params };
  const a = (p.angle * Math.PI) / 180;
  const ux = Math.cos(a), uy = Math.sin(a);         // along the direction
  const vx = -uy, vy = ux;                           // across it
  const extU = Math.abs(width * ux) + Math.abs(height * uy) || 1;
  const extV = Math.abs(width * vx) + Math.abs(height * vy) || 1;
  const cx = p.cx * width, cy = p.cy * height;
  const radius = Math.hypot(width, height) / 2 || 1;

  return function sample(x, y) {
    const dx = x - cx, dy = y - cy;
    const along = (dx * ux + dy * uy) / extU;        // -0.5..0.5
    const across = (dx * vx + dy * vy) / extV;       // -0.5..0.5
    let d = along;
    if (p.curve) d = d + (Math.hypot(dx, dy) / radius - 0.5 - d) * p.curve;
    if (p.wobble) d += p.wobble * Math.sin(TAU * (p.wobbleFreq * (across + 0.5) + p.wobblePhase));

    let v;
    if (p.shape === 'ramp') {
      v = d + 0.5;
    } else {
      const t = d * p.bands + p.phase;
      v = p.waveform === 'triangle'
        ? 1 - Math.abs(((t % 1) + 1) % 1 * 2 - 1)
        : 0.5 - 0.5 * Math.cos(TAU * t);
    }
    return shape01(v, p.contrast, p.offset);
  };
}

// Contrast via a symmetric gain curve (keeps 0, 0.5, 1 fixed), then offset.
function shape01(v, contrast, offset) {
  v = clamp01(v);
  if (contrast > 0) {
    const k = 1 + contrast * 7;
    v = v < 0.5 ? 0.5 * Math.pow(2 * v, k) : 1 - 0.5 * Math.pow(2 * (1 - v), k);
  }
  return clamp01(v + offset);
}

export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
