// DFB Typo-Pattern — Figma plugin main thread.
// The pattern is computed in the UI (same engine as the web tool); this file
// only places the result on the canvas.

figma.showUI(__html__, { width: 1280, height: 820, title: 'DFB Typo-Pattern' });

const notice = (text) => { figma.notify(text, { timeout: 6000 }); figma.ui.postMessage({ type: 'notice', text }); };

figma.ui.onmessage = async (msg) => {
  try {
    if (msg.type === 'insert-svg') insertSvg(msg);
    else if (msg.type === 'insert-text') await insertText(msg.model, msg.variable);
  } catch (e) {
    notice('Fehler: ' + (e && e.message ? e.message : e));
  }
};

function place(node) {
  const c = figma.viewport.center;
  node.x = Math.round(c.x - node.width / 2);
  node.y = Math.round(c.y - node.height / 2);
  figma.currentPage.appendChild(node);
  figma.currentPage.selection = [node];
  figma.viewport.scrollAndZoomIntoView([node]);
}

// Outlines: exact weights, scalable, recolour via the fill of the paths.
function insertSvg({ svg, name }) {
  const node = figma.createNodeFromSvg(svg);
  node.name = name;
  node.fills = [];           // no background
  node.clipsContent = true;
  place(node);
  notice('Muster als Pfade eingefügt.');
}

// Live text: one text layer per row, every word/letter set to its weight.
// variable = true: exact weights through FLOAT variables bound to fontWeight
// (needs a Figma version that supports binding font weight on variable fonts).
// Otherwise (or if binding fails) each unit snaps to the nearest named style.
async function insertText(model, variable) {
  const fonts = await figma.listAvailableFontsAsync();
  const styles = fonts.map((f) => f.fontName).filter((f) => /dfb\s*sans\s*var/i.test(f.family));
  const italic = styles.filter((f) => /italic/i.test(f.style));
  const usable = italic.length ? italic : styles;
  if (!usable.length) {
    notice('DFB SANS VAR ist in Figma nicht verfügbar. Bitte die Schrift installieren (oder als Team-Schrift hochladen) — oder „Einfügen: Pfade“ verwenden.');
    return;
  }
  const named = usable.map((f) => ({ fontName: f, wght: styleWeight(f.style) })).filter((s) => s.wght != null);
  const nearest = (w) => named.reduce((a, b) => (Math.abs(b.wght - w) < Math.abs(a.wght - w) ? b : a));
  await Promise.all(named.map((s) => figma.loadFontAsync(s.fontName)));

  const rgb = hexToRgb(model.color);
  const frame = figma.createFrame();
  frame.name = model.name + ' (Text)';
  frame.resize(model.width, model.height);
  frame.fills = [];
  frame.clipsContent = true;

  const weightVar = variable ? await weightVariables() : null;
  let bindFailed = false;

  for (const [i, line] of model.lines.entries()) {
    // Build the row string and the weight of every character range.
    let s = '';
    const ranges = [];
    line.runs.forEach((r, ri) => {
      if (ri) s += ' ';
      if (r.weight != null) { ranges.push([s.length, s.length + r.text.length, r.weight]); s += r.text; }
      else for (const g of r.glyphs) { ranges.push([s.length, s.length + g.chars.length, g.weight]); s += g.chars; }
    });
    if (!s) continue;
    const t = figma.createText();
    t.name = 'Zeile ' + String(i + 1).padStart(2, '0');
    t.fontName = nearest(ranges[0][2]).fontName;
    t.characters = s;
    t.fontSize = model.fontSize;
    t.letterSpacing = { unit: 'PERCENT', value: model.tracking * 100 };
    t.lineHeight = { unit: 'PERCENT', value: model.lineHeight * 100 };
    t.textAutoResize = 'WIDTH_AND_HEIGHT';
    t.fills = [{ type: 'SOLID', color: rgb }];
    for (const [a, b, w] of ranges) {
      if (a === b) continue;
      t.setRangeFontName(a, b, nearest(w).fontName);
      if (weightVar && !bindFailed) {
        try { t.setRangeBoundVariable(a, b, 'fontWeight', await weightVar(w)); }
        catch (e) { bindFailed = true; }
      }
    }
    t.x = line.runs.length ? line.runs[0].x : 0;
    t.y = line.top;
    frame.appendChild(t);
  }
  place(frame);
  if (!variable) notice('Als Text eingefügt — Gewichte auf die 4 Schnitte gerundet (Light/Regular/Bold/Black).');
  else if (bindFailed) notice('Als Text eingefügt, aber diese Figma-Version kann das Schriftgewicht nicht an Variablen binden — Gewichte auf die 4 Schnitte gerundet. Für stufenlose Gewichte „Einfügen: Pfade“ verwenden.');
  else notice('Als Text eingefügt — stufenlose Gewichte über Variablen (Sammlung „DFB Pattern Gewichte“, in 5er-Schritten).');
}

// FLOAT variables for weights, rounded to 5 wght units to keep the list short.
async function weightVariables() {
  const NAME = 'DFB Pattern Gewichte';
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const col = collections.find((c) => c.name === NAME) || figma.variables.createVariableCollection(NAME);
  const mode = col.modes[0].modeId;
  const existing = new Map();
  for (const id of col.variableIds) {
    const v = await figma.variables.getVariableByIdAsync(id);
    if (v) existing.set(v.name, v);
  }
  return async (w) => {
    const r = Math.round(w / 5) * 5;
    const key = 'wght/' + r;
    let v = existing.get(key);
    if (!v) {
      v = figma.variables.createVariable(key, col, 'FLOAT');
      v.setValueForMode(mode, r);
      v.scopes = ['FONT_WEIGHT'];
      existing.set(key, v);
    }
    return v;
  };
}

function styleWeight(style) {
  const s = style.toLowerCase();
  if (s.includes('black')) return 925;
  if (s.includes('bold')) return 650;
  if (s.includes('light')) return 145;
  if (s.includes('regular') || s === 'italic') return 400;
  return null;
}

function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}
