/* SevIcon UI: builds the panel with plain DOM. Needs a host object (dialogs/files) supplied by entry.js. */
const SevUI = (function () {
  'use strict';
  const CSS = '.sv{--bg:#0d0d12;--sf:#17171f;--sf2:#20202b;--tx:#f4f4f8;--mu:#a3a3b5;--ac:#8b6cf6;--ac2:#4f8ef7;--bd:#2c2c3a;--ic:32px;position:absolute;inset:0;overflow-y:auto;overflow-x:hidden;background:var(--bg);color:var(--tx);font:14px/1.4 system-ui,sans-serif;-webkit-overflow-scrolling:touch}' +
    '.sv[data-theme=light]{--bg:#f5f5fa;--sf:#fff;--sf2:#ececf4;--tx:#15151c;--mu:#555568;--bd:#d6d6e2}' +
    '.sv *{box-sizing:border-box}.sv .wrap{max-width:720px;margin:0 auto;padding:12px 12px 40px}' +
    '.sv header{display:flex;align-items:center;gap:10px;padding:8px 0 12px}.sv header img{width:36px;height:36px;border-radius:8px;background:linear-gradient(135deg,var(--ac),var(--ac2));padding:5px}' +
    '.sv header .t{flex:1;min-width:0}.sv header h1{margin:0;font-size:18px}.sv header small{color:var(--mu);display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '.sv nav{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px}' +
    '.sv button,.sv select,.sv input[type=text]{font:inherit;color:var(--tx);background:var(--sf2);border:1px solid var(--bd);border-radius:10px;padding:0 12px;min-height:44px}' +
    '.sv button{display:inline-flex;align-items:center;gap:6px;cursor:pointer}.sv button:focus-visible,.sv input:focus-visible,.sv select:focus-visible{outline:2px solid var(--ac2);outline-offset:1px}' +
    '.sv button.on{background:var(--ac);border-color:var(--ac);color:#fff}.sv button.pri{background:linear-gradient(135deg,var(--ac),var(--ac2));border-color:transparent;color:#fff}' +
    '.sv button.dng{border-color:#b04050;color:#ff8a98}.sv button:disabled{opacity:.5}.sv nav button{min-height:40px;padding:0 10px;font-size:13px}' +
    '.sv svg.i{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;flex:none}' +
    '.sv .card{background:var(--sf);border:1px solid var(--bd);border-radius:14px;padding:12px;margin-bottom:10px}.sv h2{font-size:15px;margin:2px 0 10px}' +
    '.sv .stats{display:grid;grid-template-columns:1fr 1fr;gap:8px}.sv .stat b{display:block;font-size:22px}.sv .stat span{color:var(--mu);font-size:12px}' +
    '.sv .row{display:flex;align-items:center;gap:10px;padding:8px 0;border-top:1px solid var(--bd)}.sv .row:first-child{border-top:0}.sv .row .g{flex:1;min-width:0}' +
    '.sv .row .g div{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.sv .mu{color:var(--mu);font-size:12px}' +
    '.sv img.ic{width:var(--ic);height:var(--ic);object-fit:contain;flex:none}.sv .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(84px,1fr));gap:8px;margin-top:10px}' +
    '.sv .tile{flex-direction:column;justify-content:center;gap:4px;padding:8px 4px;min-height:84px;font-size:11px;text-align:center;overflow:hidden}.sv .tile span{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '.sv .tile.sel{border-color:var(--ac);box-shadow:inset 0 0 0 2px var(--ac)}.sv .bar{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}.sv input[type=text]{width:100%}' +
    '.sv .tag{font-size:11px;padding:1px 7px;border-radius:99px;background:var(--sf2);color:var(--mu);margin-left:6px}.sv .tag.a{background:var(--ac);color:#fff}' +
    '.sv .big{display:flex;align-items:center;gap:16px;justify-content:center;padding:8px}.sv .big img{width:64px;height:64px}.sv .note{border-left:3px solid var(--ac2);padding:6px 10px;color:var(--mu);font-size:12px;margin:8px 0}' +
    '.sv .lab{display:block;color:var(--mu);font-size:12px;margin:10px 0 4px}';
  const P = {
    home: '<path d="M3 11l9-8 9 8v10H3z"/>', code: '<path d="M8 7l-5 5 5 5M16 7l5 5-5 5"/>', file: '<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4"/>', folder: '<path d="M3 6h7l2 2h9v11H3z"/>',
    grid: '<path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"/>', box: '<path d="M3 8l9-5 9 5v8l-9 5-9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>', plus: '<path d="M12 5v14M5 12h14"/>',
    up: '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>', down: '<path d="M12 4v12M7 11l5 5 5-5M4 20h16"/>', trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>', edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>', check: '<path d="M5 12l5 5 9-10"/>', copy: '<path d="M8 8h11v12H8zM5 16V4h11"/>', undo: '<path d="M9 7L4 12l5 5M4 12h10a6 6 0 0 1 0 12"/>'
  };
  const ico = function (n) { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('class', 'i'); s.setAttribute('aria-hidden', 'true'); s.innerHTML = P[n]; return s; };
  function h(tag, props) {
    const el = document.createElement(tag), kids = Array.prototype.slice.call(arguments, 2);
    for (const k in (props || {})) { const v = props[k]; if (v == null || v === false) continue; if (k === 'class') el.className = v; else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v); else el.setAttribute(k, v === true ? '' : v); }
    (function add(list) { list.forEach(function (c) { if (Array.isArray(c)) add(c); else if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c))); }); })(kids);
    return el;
  }
  const btn = function (label, icon, cls, onclick, extra) { return h('button', Object.assign({ type: 'button', class: cls || '', onclick: onclick }, extra || {}), icon ? ico(icon) : null, label); };
  const NAV = [['overview', 'Overview', 'home'], ['languages', 'Languages', 'code'], ['filetypes', 'File Types', 'file'], ['folders', 'Folders', 'folder'], ['library', 'Icon Library', 'grid'], ['packs', 'My Packs', 'box'], ['settings', 'Settings', 'gear']];

  function create(engine, host) {
    const ui = { tab: engine.state.settings.lastTab || 'overview', editing: null, pending: null, libSel: null, libTarget: '', q: '', cat: 'all' };
    const root = h('div', { class: 'sv', role: 'application', 'aria-label': 'SevIcon' });
    const style = h('style'); style.textContent = CSS; const wrap = h('div', { class: 'wrap' }); root.append(style, wrap);
    let timer = null, dead = false;
    const fallbackUri = function () { return engine.iconUri('file'); };
    const img = function (uri, name) { const i = h('img', { class: 'ic', src: uri, alt: name || '', loading: 'lazy' }); i.onerror = function () { i.onerror = null; i.src = fallbackUri(); }; return i; };
    const guard = function (fn) { return function () { try { const r = fn.apply(null, arguments); if (r && r.catch) r.catch(fail); } catch (e) { fail(e); } }; };
    function fail(e) { host.toast(e && e.message ? e.message : 'Something went wrong. Try again.'); }
    const go = function (t) { ui.tab = t; ui.editing = null; ui.pending = null; ui.libSel = null; engine.setSetting('lastTab', t); };

    async function ensureEditable() {
      if (!engine.activePack().builtin) return true;
      if (!(await host.confirm('Create an editable pack', 'The default pack is read-only. Create a copy named "My Icons" and make it active?'))) return false;
      await engine.duplicatePack('default', 'My Icons', { activate: true }); return true;
    }
    function gridWidget(o) { // searchable, filterable icon grid
      const box = h('div'), grid = h('div', { class: 'grid', role: 'listbox', 'aria-label': 'Icons' }), chips = h('div', { class: 'bar' });
      const input = h('input', { type: 'text', placeholder: 'Search icons', 'aria-label': 'Search icons', value: ui.q });
      function draw() {
        grid.textContent = ''; chips.textContent = '';
        [{ id: 'all', name: 'All' }].concat(engine.categories).forEach(function (c) { chips.append(btn(c.name, null, ui.cat === c.id ? 'on' : '', function () { ui.cat = c.id; draw(); }, { 'aria-pressed': String(ui.cat === c.id) })); });
        const items = engine.search(ui.q, ui.cat); if (!items.length) grid.append(h('p', { class: 'mu' }, 'No icons match. Clear the search or pick another category.'));
        items.forEach(function (it) { const sel = o.selected() === it.id; grid.append(h('button', { type: 'button', class: 'tile' + (sel ? ' sel' : ''), role: 'option', 'aria-selected': String(sel), 'aria-label': it.name, onclick: function () { o.pick(it.id); draw(); } }, img(engine.iconUri(it.id), it.name), h('span', null, it.name))); });
      }
      input.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(function () { ui.q = input.value; draw(); }, 200); });
      draw(); box.append(input, chips, grid); return box;
    }
    function editor() {
      const t = engine.target(ui.editing), cur = engine.iconIdFor(t.id), nxt = ui.pending || cur;
      const box = h('div', { class: 'card' }, h('h2', null, 'Customize: ' + t.name), h('p', { class: 'mu' }, t.extensions.length ? t.extensions.map(function (x) { return '.' + x; }).join(' ') : (t.names.join(', ') || t.kind)));
      box.append(h('div', { class: 'big' }, h('div', { class: 'mu' }, 'Current', h('br'), img(engine.iconUri(cur), engine.iconName(cur)), h('br'), engine.iconName(cur)), h('div', { class: 'mu' }, 'New', h('br'), img(engine.iconUri(nxt), engine.iconName(nxt)), h('br'), engine.iconName(nxt))));
      box.append(gridWidget({ selected: function () { return ui.pending || cur; }, pick: function (id) { ui.pending = id; paintPreview(); } }));
      const pv = box.querySelector('.big'); function paintPreview() { const n = ui.pending || cur; pv.lastChild.replaceChildren('New', h('br'), img(engine.iconUri(n), engine.iconName(n)), h('br'), engine.iconName(n)); }
      const bar = h('div', { class: 'bar' },
        btn('Apply', 'check', 'pri', guard(async function () { if (!ui.pending || ui.pending === cur) { host.toast('Pick a different icon first.'); return; } if (!(await ensureEditable())) return; await engine.assign(t.id, ui.pending); ui.editing = null; ui.pending = null; render(); host.toast('Icon applied in SevIcon.'); })),
        btn('Cancel', 'x', '', function () { ui.editing = null; ui.pending = null; render(); }),
        btn('Reset', 'undo', '', guard(async function () { if (engine.activePack().builtin) { host.toast('Nothing to reset in the read-only default pack.'); return; } if (!(await host.confirm('Reset icon', 'Restore the default icon for ' + t.name + '?'))) return; await engine.resetTarget(t.id); ui.editing = null; ui.pending = null; render(); })));
      if (t.custom) bar.append(btn('Remove extension', 'trash', 'dng', guard(async function () { if (!(await host.confirm('Remove extension', 'Remove ' + t.name + ' from SevIcon?'))) return; await engine.removeCustomTarget(t.id); ui.editing = null; render(); })));
      box.append(bar); return box;
    }
    function targetList(kind) {
      const list = engine.targets().filter(function (t) { return kind === 'language' ? t.category === 'language' : kind === 'folder' ? t.kind === 'folder' : (t.kind === 'file' && t.category !== 'language'); });
      const card = h('div', { class: 'card' }, h('h2', null, kind === 'language' ? 'Programming languages' : kind === 'folder' ? 'Folders' : 'File types'));
      if (kind === 'language') card.append(h('p', { class: 'note' }, 'Icons only. Changing an icon never changes syntax highlighting or language detection.'));
      if (kind === 'folder') card.append(h('p', { class: 'note' }, 'Folder icons are shown in SevIcon\u2019s own preview. Native file-browser folders only change if the experimental option in Settings works on your Acode version.'));
      list.forEach(function (t) { const cur = engine.iconIdFor(t.id); card.append(h('div', { class: 'row' }, img(engine.iconUri(cur), engine.iconName(cur)), h('div', { class: 'g' }, h('div', null, t.name, engine.isCustomized(t.id) ? h('span', { class: 'tag a' }, 'custom') : null), h('div', { class: 'mu' }, engine.iconName(cur) + (t.extensions.length ? ' \u00b7 ' + t.extensions.map(function (x) { return '.' + x; }).join(' ') : ''))), btn('Edit', 'edit', '', function () { ui.editing = t.id; ui.pending = null; render(); }, { 'aria-label': 'Edit icon for ' + t.name }))); });
      const out = [card];
      if (kind === 'file') {
        const inp = h('input', { type: 'text', placeholder: 'Extension, e.g. abc', 'aria-label': 'New extension', autocapitalize: 'off', autocomplete: 'off' });
        out.unshift(h('div', { class: 'card' }, h('h2', null, 'Add custom extension'), inp, h('div', { class: 'bar' }, btn('Add extension', 'plus', 'pri', guard(async function () { const t = await engine.addCustomTarget(inp.value); ui.editing = t.id; render(); host.toast('Added .' + t.extensions[0]); })))));
      }
      return out;
    }
    function overview() {
      const s = engine.stats(), rec = h('div');
      const stat = function (b, l) { return h('div', { class: 'card stat' }, h('b', null, String(b)), h('span', null, l)); };
      s.recent.forEach(function (r) { try { const t = engine.target(r.targetId); rec.append(h('div', { class: 'row' }, img(engine.iconUri(r.iconId), engine.iconName(r.iconId)), h('div', { class: 'g' }, h('div', null, t.name), h('div', { class: 'mu' }, engine.iconName(r.iconId))))); } catch (e) {} });
      if (!rec.children.length) rec.append(h('p', { class: 'mu' }, 'No customizations yet.'));
      return [h('div', { class: 'stats' }, stat(s.icons, 'Icons available'), stat(s.customized, 'Customized types'), stat(s.customTypes, 'Custom extensions'), stat(s.packs, 'Packs')),
        h('div', { class: 'card' }, h('h2', null, 'Active pack: ' + s.activePack), h('div', { class: 'bar' }, btn('Customize an icon', 'edit', 'pri', function () { go('languages'); }), btn('Import pack', 'up', '', guard(importPack)), btn('Export pack', 'down', '', guard(function () { return exportPack(engine.activePack().id); })))),
        h('div', { class: 'card' }, h('h2', null, 'Recently customized'), rec)];
    }
    function library() {
      const box = h('div', { class: 'card' }, h('h2', null, 'Icon library'));
      const detail = h('div');
      box.append(h('div', { class: 'bar' }, btn('Import icon file', 'up', '', guard(async function () {
        if (!(await ensureEditable())) return; const f = await host.pickFile('.svg,.png,.webp,image/svg+xml,image/png,image/webp'); if (!f) return;
        const id = await engine.addIconFromFile(f.name, f.bytes); ui.libSel = id; render(); host.toast('Icon imported.'); })), h('span', { class: 'mu' }, 'SVG \u2264 100 KB, PNG/WebP \u2264 200 KB')));
      box.append(gridWidget({ selected: function () { return ui.libSel; }, pick: function (id) { ui.libSel = id; paintDetail(); } }), detail);
      function paintDetail() {
        detail.textContent = ''; if (!ui.libSel) return; const id = ui.libSel, lib = engine.library().find(function (i) { return i.id === id; }); if (!lib) return;
        const sel = h('select', { 'aria-label': 'Assign to' }, h('option', { value: '' }, 'Choose file type\u2026'), engine.targets().map(function (t) { return h('option', { value: t.id, selected: ui.libTarget === t.id }, t.name); }));
        const msg = h('p', { class: 'mu' });
        const upd = function () { ui.libTarget = sel.value; if (!sel.value) { msg.textContent = ''; return; } msg.textContent = 'Current: ' + engine.iconName(engine.iconIdFor(sel.value)) + '  \u2192  New: ' + lib.name; };
        sel.addEventListener('change', upd);
        detail.append(h('div', { class: 'card' }, h('div', { class: 'big' }, img(engine.iconUri(id), lib.name), h('div', null, h('b', null, lib.name), h('div', { class: 'mu' }, 'Category: ' + lib.category))), h('label', { class: 'lab' }, 'Assign to'), sel, msg,
          h('div', { class: 'bar' }, btn('Apply', 'check', 'pri', guard(async function () { if (!sel.value) { host.toast('Choose a file type first.'); return; } if (!(await ensureEditable())) return; await engine.assign(sel.value, id); host.toast('Icon applied in SevIcon.'); })),
            btn('Cancel', 'x', '', function () { ui.libSel = null; render(); }),
            lib.builtin ? null : btn('Delete icon', 'trash', 'dng', guard(async function () { if (!(await host.confirm('Delete icon', 'Delete "' + lib.name + '" from this pack? Assignments using it will be reset.'))) return; await engine.removeIcon(id); ui.libSel = null; render(); })))));
        upd();
      }
      paintDetail(); return box;
    }
    async function importPack() {
      const f = await host.pickFile('.zip,application/zip'); if (!f) return;
      const r = await engine.importPack(f.bytes); host.toast('Imported "' + r.pack.name + '"' + (r.warnings.length ? ' with ' + r.warnings.length + ' warning(s)' : '') + '. Existing packs were not changed.');
      if (r.warnings.length) host.confirm('Import warnings', r.warnings.slice(0, 8).join('\n'), true);
    }
    async function exportPack(id) { const p = engine.state.packs[id]; const ok = await host.saveFile(p.name.replace(/[^A-Za-z0-9._-]+/g, '_') + '.sevicon.zip', engine.exportPack(id), 'application/zip'); if (ok) host.toast('Pack exported.'); }
    function packs() {
      const card = h('div', { class: 'card' }, h('h2', null, 'My packs'), h('div', { class: 'bar' }, btn('New pack', 'plus', 'pri', guard(async function () { const n = await host.prompt('New pack', 'Pack name', 'My Pack'); if (n == null) return; await engine.createPack(n); })), btn('Import ZIP', 'up', '', guard(importPack))));
      engine.packs().forEach(function (p) {
        const act = engine.state.activePack === p.id; const n = Object.keys(p.icons).length;
        const bar = h('div', { class: 'bar' });
        if (!act) bar.append(btn('Activate', 'check', 'pri', guard(function () { return engine.setActivePack(p.id); })));
        bar.append(btn('Duplicate', 'copy', '', guard(async function () { await engine.duplicatePack(p.id); host.toast('Pack duplicated.'); })), btn('Export', 'down', '', guard(function () { return exportPack(p.id); })));
        if (!p.builtin) bar.append(btn('Rename', 'edit', '', guard(async function () { const nn = await host.prompt('Rename pack', 'Pack name', p.name); if (nn == null) return; await engine.renamePack(p.id, nn); })),
          btn('Reset', 'undo', '', guard(async function () { if (!(await host.confirm('Reset pack', 'Clear all icon assignments in "' + p.name + '"? Imported icons are kept.'))) return; await engine.resetPack(p.id); })),
          btn('Delete', 'trash', 'dng', guard(async function () { if (!(await host.confirm('Delete pack', 'Delete "' + p.name + '"? This cannot be undone.'))) return; await engine.deletePack(p.id); })));
        card.append(h('div', { class: 'card' }, h('b', null, p.name, p.builtin ? h('span', { class: 'tag' }, 'built-in') : null, act ? h('span', { class: 'tag a' }, 'active') : null), h('div', { class: 'mu' }, Object.keys(p.assignments).length + ' assignments \u00b7 ' + n + ' imported icons'), bar));
      });
      return card;
    }
    function settings() {
      const st = engine.state.settings;
      const sel = function (label, opts, val, on) { return [h('label', { class: 'lab' }, label), h('select', { 'aria-label': label, onchange: function (e) { guard(function () { return on(e.target.value); })(); } }, opts.map(function (o) { return h('option', { value: String(o[0]), selected: String(o[0]) === String(val) }, o[1]); }))]; };
      const card = h('div', { class: 'card' }, h('h2', null, 'Settings'),
        sel('Theme', [['dark', 'Dark'], ['light', 'Light']], st.theme, function (v) { return engine.setSetting('theme', v); }),
        sel('Icon size in SevIcon', Core.SIZES.map(function (s) { return [s, s + ' px']; }), st.iconSize, function (v) { return engine.setSetting('iconSize', Number(v)); }),
        sel('Active icon pack', engine.packs().map(function (p) { return [p.id, p.name]; }), engine.state.activePack, function (v) { return engine.setActivePack(v); }),
        h('label', { class: 'lab' }, 'Experimental: also try to restyle Acode\u2019s own file list'),
        btn(st.nativeCss ? 'Turn off native styling' : 'Turn on native styling', null, st.nativeCss ? 'on' : '', guard(function () { return engine.setSetting('nativeCss', !st.nativeCss); }), { 'aria-pressed': String(!!st.nativeCss) }),
        h('p', { class: 'note' }, 'This injects CSS that targets Acode\u2019s internal file-type class names. It is not an official API and has not been verified on every Acode version; it may do nothing. Turn it off if the file list looks wrong.'),
        h('div', { class: 'bar' },
          btn('Export settings', 'down', '', guard(async function () { const ok = await host.saveFile('sevicon-settings.json', new TextEncoder().encode(engine.exportSettings()), 'application/json'); if (ok) host.toast('Settings exported.'); })),
          btn('Import settings', 'up', '', guard(async function () { const f = await host.pickFile('.json,application/json'); if (!f) return; await engine.importSettings(new TextDecoder().decode(f.bytes)); host.toast('Settings imported.'); })),
          btn('Reset settings', 'undo', '', guard(async function () { if (await host.confirm('Reset settings', 'Reset theme and interface options? Your packs and icons are kept.')) await engine.resetSettings(); })),
          btn('Restore defaults', 'trash', 'dng', guard(async function () { if (await host.confirm('Restore defaults', 'This deletes ALL packs, imported icons, custom extensions and settings. Export your packs first. Continue?')) await engine.restoreDefaults(); }))));
      const about = h('div', { class: 'card' }, h('h2', null, 'About SevIcon'), h('p', null, 'Version ' + Core.VERSION + ' \u00b7 data stays on this device, no network or telemetry.'),
        h('p', { class: 'note' }, 'Limitation: Acode has no documented public API to replace its built-in file icons or to add a tab beside file tabs. SevIcon opens as its own page, and customized icons are rendered in SevIcon\u2019s panel. The native-styling toggle above is a best-effort experiment.'));
      return [card, about];
    }
    function render() {
      if (dead) return; const s = engine.state.settings; root.setAttribute('data-theme', s.theme); root.style.setProperty('--ic', s.iconSize + 'px');
      const top = root.scrollTop; wrap.textContent = '';
      const logo = h('img', { src: 'data:image/svg+xml;base64,' + btoa(Core.LOGO_SVG), alt: 'SevIcon logo' });
      wrap.append(h('header', null, logo, h('div', { class: 't' }, h('h1', null, 'SevIcon'), h('small', null, 'Pack: ' + engine.activePack().name)), btn('Settings', 'gear', ui.tab === 'settings' ? 'on' : '', function () { go('settings'); }, { 'aria-label': 'Settings' }), host.close ? btn('Close', 'x', '', function () { host.close(); }, { 'aria-label': 'Close SevIcon' }) : null));
      wrap.append(h('nav', { 'aria-label': 'Sections' }, NAV.map(function (n) { return btn(n[1], n[2], ui.tab === n[0] ? 'on' : '', function () { go(n[0]); }, { 'aria-current': ui.tab === n[0] ? 'page' : null }); })));
      try {
        if (ui.editing) wrap.append(editor());
        else if (ui.tab === 'overview') wrap.append.apply(wrap, overview());
        else if (ui.tab === 'languages') wrap.append.apply(wrap, targetList('language'));
        else if (ui.tab === 'filetypes') wrap.append.apply(wrap, targetList('file'));
        else if (ui.tab === 'folders') wrap.append.apply(wrap, targetList('folder'));
        else if (ui.tab === 'library') wrap.append(library());
        else if (ui.tab === 'packs') wrap.append(packs());
        else wrap.append.apply(wrap, settings());
      } catch (e) { wrap.append(h('div', { class: 'card' }, 'This section failed to load: ' + e.message)); }
      root.scrollTop = top;
    }
    const unsub = engine.subscribe(render); render();
    return { el: root, render: render, destroy: function () { dead = true; clearTimeout(timer); unsub(); root.remove(); }, _ui: ui };
  }
  return { create: create };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = SevUI;
