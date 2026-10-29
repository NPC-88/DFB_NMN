// Wave library: save settings you like, reload them, share them.
//   - "Meine": saved in this browser (localStorage)
//   - "Team":  library.json next to the page (curated in the repository, the
//              same for everyone who opens the GitHub link)
//   - share links carry the settings in the URL (#p=…); export/import as JSON
//     moves a whole library between people.

import { panel, el } from './controls.js';

const KEY = 'dfb-pattern-library-v1';

export function createLibrary({ host, onLoad, current, flash }) {
  const box = panel('Bibliothek', true);
  const form = el('div', { class: 'lib-save' });
  const name = el('input', { type: 'text', id: 'lib-name', placeholder: 'Name, z. B. Hymne weich', 'aria-label': 'Name' });
  const save = el('button', { type: 'button', class: 'primary' }, 'Speichern');
  form.append(name, save);
  const mineHead = el('h3', {}, 'Meine');
  const mine = el('ul', { class: 'lib-list' });
  const teamHead = el('h3', {}, 'Team');
  const team = el('ul', { class: 'lib-list' });
  const tools = el('div', { class: 'lib-tools' });
  const share = el('button', { type: 'button' }, 'Link kopieren');
  const exp = el('button', { type: 'button' }, 'Exportieren');
  const impLabel = el('label', { class: 'button' }, 'Importieren');
  const imp = el('input', { type: 'file', accept: '.json,application/json', hidden: '' });
  impLabel.append(imp);
  tools.append(share, exp, impLabel);
  box.body.append(form, mineHead, mine, teamHead, team, tools);

  let items = read();
  let teamItems = [];

  save.addEventListener('click', () => {
    const n = name.value.trim() || 'Muster ' + (items.length + 1);
    items = [{ id: Date.now().toString(36), name: n, created: new Date().toISOString(), settings: current() }, ...items];
    write(items);
    name.value = '';
    draw();
    flash('Gespeichert: ' + n);
  });

  share.addEventListener('click', async () => {
    const url = location.href.split('#')[0] + encodeShare(current());
    try { await navigator.clipboard.writeText(url); flash('Link kopiert — wer ihn öffnet, sieht genau dieses Muster.'); }
    catch { history.replaceState(null, '', encodeShare(current())); flash('Link steht jetzt in der Adresszeile.'); }
  });

  exp.addEventListener('click', async () => {
    const data = JSON.stringify({ format: 'dfb-pattern-library', version: 1, items }, null, 2);
    flash(await host.save({ filename: 'dfb-pattern-bibliothek.json', data }));
  });

  imp.addEventListener('change', async () => {
    const f = imp.files && imp.files[0];
    imp.value = '';
    if (!f) return;
    try {
      const got = parseLibrary(JSON.parse(await f.text()));
      const known = new Set(items.map((i) => i.id));
      items = [...got.filter((i) => !known.has(i.id)), ...items];
      write(items);
      draw();
      flash(`${got.length} Muster importiert.`);
    } catch (e) {
      flash('Diese Datei ist keine Muster-Bibliothek.');
    }
  });

  if (host.libraryURL) {
    fetch(host.libraryURL, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { teamItems = j ? parseLibrary(j) : []; draw(); })
      .catch(() => draw());
  }

  function draw() {
    list(mine, items, true);
    list(team, teamItems, false);
    mineHead.hidden = false;
    teamHead.hidden = team.hidden = !teamItems.length;
    if (!items.length) mine.append(el('li', { class: 'empty' }, 'Noch nichts gespeichert. Gefällt dir ein Muster, gib ihm einen Namen und speichere es.'));
  }

  function list(ul, arr, removable) {
    ul.innerHTML = '';
    for (const it of arr) {
      const li = el('li');
      const open = el('button', { type: 'button', class: 'lib-item', title: 'Laden' }, it.name);
      open.addEventListener('click', () => { onLoad(it.settings); flash('Geladen: ' + it.name); });
      li.append(open);
      if (removable) {
        const del = el('button', { type: 'button', class: 'lib-del', title: 'Löschen', 'aria-label': 'Löschen: ' + it.name }, '×');
        del.addEventListener('click', () => {
          if (del.dataset.armed) { items = items.filter((x) => x.id !== it.id); write(items); draw(); }
          else { del.dataset.armed = '1'; del.textContent = 'Löschen?'; setTimeout(() => { delete del.dataset.armed; del.textContent = '×'; }, 2500); }
        });
        li.append(del);
      }
      ul.append(li);
    }
  }

  draw();
  return { node: box.node };
}

function parseLibrary(j) {
  const arr = Array.isArray(j) ? j : j && j.items;
  if (!Array.isArray(arr)) throw new Error('no items');
  return arr.filter((i) => i && i.settings && i.settings.params).map((i, k) => ({
    id: String(i.id || 'imp' + k + Date.now().toString(36)), name: String(i.name || 'Muster'), created: i.created, settings: i.settings,
  }));
}

function read() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } }
function write(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* storage blocked: list lives for this visit only */ } }

export function encodeShare(settings) {
  const bytes = new TextEncoder().encode(JSON.stringify(settings));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return '#p=' + btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeShare(hash) {
  const m = /[#&]p=([\w-]+)/.exec(hash || '');
  if (!m) return null;
  try {
    const bin = atob(m[1].replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
  } catch { return null; }
}
