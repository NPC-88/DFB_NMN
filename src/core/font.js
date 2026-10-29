// Variable-font adapter around a fontkit font: advances, kerning and glyph
// outlines at any weight. The engine only talks to this interface, so the
// font library can be swapped without touching the layout.
//
// Weights are rounded to whole wght units (the font runs 75..1000), which is
// far finer than the eye can see and keeps the instance cache small.

export function createVarFont(fkFont, { features = ['kern'] } = {}) {
  const axis = fkFont.variationAxes && fkFont.variationAxes.wght;
  if (!axis) throw new Error('Font has no wght axis: ' + fkFont.familyName);
  const upm = fkFont.unitsPerEm;
  const instances = new Map();   // wght -> fontkit instance
  const pathCache = new Map();   // `${gid}@${wght}` -> commands
  const advCache = new Map();    // `${gid}@${wght}` -> advance
  const runCache = new Map();    // `${text}@${wght}` -> run

  const clampW = (w) => Math.round(Math.min(axis.max, Math.max(axis.min, w)));

  function instance(w) {
    let f = instances.get(w);
    if (!f) { f = fkFont.getVariation({ wght: w }); instances.set(w, f); }
    return f;
  }

  // fontkit leaves empty glyphs (space, nbsp…) at their default advance; apply
  // the gvar phantom-point deltas ourselves so word spaces vary with weight too.
  function advance(gid, w) {
    const key = gid + '@' + w;
    let a = advCache.get(key);
    if (a === undefined) {
      const f = instance(w);
      const g = f.getGlyph(gid);
      a = g.advanceWidth;
      if (!g.path.commands.length && f._variationProcessor) {
        const base = fkFont.getGlyph(gid).advanceWidth;
        const pt = (x) => ({ x, y: 0, onCurve: true, endContour: false, copy() { return pt(this.x); } });
        const pp = [pt(0), pt(base), pt(0), pt(0)];
        f._variationProcessor.transformPoints(gid, pp);
        a = pp[1].x - pp[0].x;
      }
      advCache.set(key, a);
    }
    return a;
  }

  // Shape a string at one weight: glyph ids, advances (incl. kerning), chars.
  function run(text, wght) {
    const w = clampW(wght);
    const key = text + '@' + w;
    let r = runCache.get(key);
    if (!r) {
      const f = instance(w);
      const lay = f.layout(text, features);
      r = lay.glyphs.map((g, i) => {
        const pos = lay.positions[i];
        const kern = pos.xAdvance - g.advanceWidth;   // GPOS adjustment only
        return {
          id: g.id,
          chars: String.fromCodePoint(...(g.codePoints || [])),
          advance: advance(g.id, w) + kern,
          xOffset: pos.xOffset, yOffset: pos.yOffset,
        };
      });
      if (runCache.size > 20000) runCache.clear();
      runCache.set(key, r);
    }
    return r;
  }

  // Glyph outline commands in font units (y up), at a weight.
  function outline(gid, wght) {
    const w = clampW(wght);
    const key = gid + '@' + w;
    let c = pathCache.get(key);
    if (!c) {
      c = instance(w).getGlyph(gid).path.commands.map((cmd) => ({ command: cmd.command, args: cmd.args.slice() }));
      if (pathCache.size > 60000) pathCache.clear();
      pathCache.set(key, c);
    }
    return c;
  }

  return {
    family: fkFont.familyName,
    familyCSS: (fkFont.getName && fkFont.getName('preferredFamily')) || 'DFB SANS VAR',
    postscriptName: fkFont.postscriptName,
    unitsPerEm: upm,
    capHeight: fkFont.capHeight,
    ascent: fkFont.ascent,
    descent: fkFont.descent,
    axis: { min: axis.min, max: axis.max, default: axis.default },
    namedInstances: namedInstances(fkFont),
    clampWeight: clampW,
    run,
    outline,
    advance,
  };
}

// fontkit's namedVariations throws when an instance points at a standard name
// id (this font names its Regular via id 17, preferredSubfamily); read fvar directly.
function namedInstances(fkFont) {
  const axes = fkFont.fvar ? fkFont.fvar.axis.map((a) => a.axisTag.trim()) : [];
  return (fkFont.fvar ? fkFont.fvar.instance : []).map((inst) => {
    const name = (inst.name && inst.name.en) ||
      (inst.nameID === 17 && fkFont.getName('preferredSubfamily')) ||
      (inst.nameID === 2 && fkFont.getName('fontSubfamily')) || `wght ${inst.coord[0]}`;
    return { name, wght: inst.coord[axes.indexOf('wght')] };
  });
}
