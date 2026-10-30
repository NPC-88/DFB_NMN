// DFB icon set (assets/icons, from DFB_Icons.zip, black SVGs drawn in
// currentColor). flip.svg and rotate.svg are drawn to match: the set has no
// equivalent. Bundled as text by esbuild (loader .svg → text).
import add from '../../assets/icons/add.svg';
import remove from '../../assets/icons/remove.svg';
import close from '../../assets/icons/close.svg';
import chevron from '../../assets/icons/arrow-dropdown-down.svg';
import download from '../../assets/icons/download.svg';
import edit from '../../assets/icons/edit.svg';
import trash from '../../assets/icons/delete-2.svg';
import share from '../../assets/icons/share.svg';
import reset from '../../assets/icons/reload.svg';
import undo from '../../assets/icons/return.svg';
import fit from '../../assets/icons/fullscreen.svg';
import zoomIn from '../../assets/icons/zoom-in.svg';
import zoomOut from '../../assets/icons/zoom-out.svg';
import save from '../../assets/icons/save.svg';
import library from '../../assets/icons/library.svg';
import tool from '../../assets/icons/settings.svg';
import success from '../../assets/icons/check-circle.svg';
import error from '../../assets/icons/attention.svg';
import info from '../../assets/icons/information.svg';
import flip from '../../assets/icons/flip.svg';
import rotate from '../../assets/icons/rotate.svg';

const ICONS = { add, remove, close, chevron, download, edit, trash, share, reset, undo, redo: undo, fit, zoomIn, zoomOut, save, library, tool, success, error, info, flip, rotate };

// <span class="icon">…svg…</span>; redo is undo mirrored.
export function icon(name, size = 20) {
  const s = document.createElement('span');
  s.className = 'icon' + (name === 'redo' ? ' mirror' : '');
  s.setAttribute('aria-hidden', 'true');
  s.innerHTML = (ICONS[name] || '').replace('<svg ', `<svg width="${size}" height="${size}" `).replace(/ width="24" height="24"/, '');
  return s;
}

// Fill every [data-icon] placeholder in static markup.
export function hydrateIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach((n) => {
    if (n.querySelector('.icon')) return;
    n.prepend(icon(n.dataset.icon, +(n.dataset.iconSize || 20)));
  });
}
