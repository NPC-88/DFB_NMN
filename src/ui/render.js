// Draw a layout model straight onto a 2D canvas (animation preview and video
// frames): glyph outlines from the font. `k` scales frame pixels to canvas pixels.

export function drawModel(ctx, model, font, { color, background, k = 1 }) {
  const { width, height } = model;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, width * k, height * k);
  ctx.clip();
  ctx.fillStyle = color;
  const s = model.scale * k;
  // One small filled shape per glyph (cached per glyph and weight): much faster
  // to rasterise than one path holding the whole pattern.
  for (const line of model.lines) {
    for (const run of line.runs) {
      for (const g of run.glyphs) {
        const path = glyphPath(font, g.id, g.weight);
        if (!path) continue;
        ctx.setTransform(s, 0, 0, s, g.x * k, (line.baseline - g.dy) * k);
        ctx.fill(path);
      }
    }
  }
  ctx.restore();
}

const paths = new Map();
function glyphPath(font, id, weight) {
  const key = id + '@' + weight;
  let p = paths.get(key);
  if (p === undefined) {
    const cmds = font.outline(id, weight);
    p = null;
    if (cmds.length) {
      p = new Path2D();
      for (const { command, args: a } of cmds) {
        switch (command) {
          case 'moveTo': p.moveTo(a[0], -a[1]); break;
          case 'lineTo': p.lineTo(a[0], -a[1]); break;
          case 'quadraticCurveTo': p.quadraticCurveTo(a[0], -a[1], a[2], -a[3]); break;
          case 'bezierCurveTo': p.bezierCurveTo(a[0], -a[1], a[2], -a[3], a[4], -a[5]); break;
          case 'closePath': p.closePath(); break;
        }
      }
    }
    if (paths.size > 40000) paths.clear();
    paths.set(key, p);
  }
  return p;
}

// Small grayscale picture of a gradient (dark = heavy) into a canvas.
export function drawField(canvas, grid, cols, rows) {
  canvas.width = cols; canvas.height = rows;
  const c = canvas.getContext('2d');
  const img = c.createImageData(cols, rows);
  for (let i = 0; i < grid.length; i++) {
    const g = Math.round((1 - grid[i]) * 255);
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = g;
    img.data[i * 4 + 3] = 255;
  }
  c.putImageData(img, 0, 0);
}
