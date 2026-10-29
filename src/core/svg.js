// SVG export of a layout model. No background — only the pattern in one colour.
//
// mode 'outlines': every word is one <path> (glyphs outlined at their exact
//                  weight), grouped per row. Scales anywhere, needs no font.
// mode 'text':     live <text>, one <tspan> per unit with its wght. Editable,
//                  but only renders right where DFB SANS VAR is installed and
//                  the app honours font-variation-settings.
// mode 'both':     outlines visible + the live text as a hidden layer.

export function toSVG(model, font, { color = '#000000', mode = 'outlines', clip = true, title = 'DFB Pattern', precision = 2 } = {}) {
  const { width, height } = model;
  const ids = uniqueIds();
  const out = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`);
  out.push(`<title>${esc(title)}</title>`);
  if (clip) out.push(`<defs><clipPath id="frame"><rect width="${width}" height="${height}"/></clipPath></defs>`);
  const clipAttr = clip ? ' clip-path="url(#frame)"' : '';

  if (mode === 'outlines' || mode === 'both') {
    out.push(`<g id="${ids('Muster')}" fill="${color}"${clipAttr}>`);
    model.lines.forEach((line, li) => {
      out.push(`<g id="${ids('Zeile_' + pad(li + 1))}">`);
      for (const run of line.runs) {
        const d = runPath(run, line.baseline, model.scale, font, precision);
        if (d) out.push(`<path id="${ids(layerName(run))}" d="${d}"/>`);
      }
      out.push('</g>');
    });
    out.push('</g>');
  }

  if (mode === 'text' || mode === 'both') {
    const hidden = mode === 'both' ? ' display="none"' : '';
    out.push(`<g id="${ids('Text_editierbar')}" fill="${color}"${clipAttr}${hidden}>`);
    model.lines.forEach((line, li) => {
      out.push(`<text id="${ids('Text_Zeile_' + pad(li + 1))}" xml:space="preserve" font-family="${esc(font.familyCSS)}, '${esc(font.family)}'" font-style="italic" font-size="${num(model.fontSize, 3)}" y="${num(line.baseline, precision)}">`);
      for (const run of line.runs) {
        // justified rows: every character gets its own x
        const oneCharGlyphs = run.glyphs.every((g) => [...g.chars].length === 1);
        if (run.weight != null && oneCharGlyphs) {
          out.push(tspan(run.glyphs.map((g) => g.chars).join(''), run.glyphs.map((g) => num(g.x, precision)).join(' '), run.weight));
        } else {
          for (const g of run.glyphs) out.push(tspan(g.chars, num(g.x, precision), g.weight));
        }
      }
      out.push('</text>');
    });
    out.push('</g>');
  }

  out.push('</svg>');
  return out.join('\n');
}

// One path for a whole word: every glyph transformed into frame pixels.
export function runPath(run, baseline, scale, font, precision = 2) {
  const parts = [];
  for (const g of run.glyphs) {
    const cmds = font.outline(g.id, g.weight);
    if (!cmds.length) continue;
    const ox = g.x, oy = baseline - g.dy;
    const X = (v) => num(ox + v * scale, precision);
    const Y = (v) => num(oy - v * scale, precision);
    for (const { command, args } of cmds) {
      switch (command) {
        case 'moveTo': parts.push('M' + X(args[0]) + ' ' + Y(args[1])); break;
        case 'lineTo': parts.push('L' + X(args[0]) + ' ' + Y(args[1])); break;
        case 'quadraticCurveTo': parts.push('Q' + X(args[0]) + ' ' + Y(args[1]) + ' ' + X(args[2]) + ' ' + Y(args[3])); break;
        case 'bezierCurveTo': parts.push('C' + X(args[0]) + ' ' + Y(args[1]) + ' ' + X(args[2]) + ' ' + Y(args[3]) + ' ' + X(args[4]) + ' ' + Y(args[5])); break;
        case 'closePath': parts.push('Z'); break;
      }
    }
  }
  return parts.join('');
}

function tspan(text, xs, weight) {
  const w = Math.round(weight);
  return `<tspan x="${xs}" font-weight="${w}" style="font-variation-settings:'wght' ${w}">${esc(text)}</tspan>`;
}

// Layer names: the word and its weight (or weight range for letter mode).
function layerName(run) {
  if (run.weight != null) return `${run.text}_${Math.round(run.weight)}`;
  const ws = run.glyphs.map((g) => g.weight);
  return `${run.text}_${Math.min(...ws)}-${Math.max(...ws)}`;
}

// XML ids must be unique NCNames; Figma and Illustrator show them as layer names.
function uniqueIds() {
  const seen = new Map();
  return (raw) => {
    let id = String(raw).normalize('NFC').replace(/[^\p{L}\p{N}_.-]+/gu, '_').replace(/^[^\p{L}_]/u, '_$&') || '_';
    const n = seen.get(id) || 0;
    seen.set(id, n + 1);
    return n ? `${id}_${n + 1}` : id;
  };
}

const pad = (n) => String(n).padStart(2, '0');
function num(v, p) { const s = v.toFixed(p); return s.includes('.') ? s.replace(/\.?0+$/, '') || '0' : s; }
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
