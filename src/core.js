/* SevIcon core: icon registry, engine, validation, packs, persistence model. No DOM access. */
const Core = (function () {
  'use strict';
  const _Zip = (typeof Zip !== 'undefined') ? Zip : require('./zip.js');
  const VERSION = '1.0.0', SCHEMA = 1;
  const LIMITS = { svg: 100 * 1024, raster: 200 * 1024, zipTotal: 5 * 1024 * 1024, entries: 400, manifest: 200 * 1024, icons: 300, packs: 30, name: 40, customTargets: 200 };
  const ID_RE = /^[a-z0-9][a-z0-9_-]{0,47}$/, EXT_RE = /^[a-z0-9][a-z0-9_+-]{0,15}$/, KEY_RE = /^[a-z0-9][a-z0-9_+.-]{0,60}$/;
  const THEMES = ['dark', 'light'], SIZES = [24, 32, 40, 48], TABS = ['overview', 'languages', 'filetypes', 'folders', 'library', 'packs', 'settings'];
  const enc = new TextEncoder(), dec = new TextDecoder('utf-8');
  function E(code, msg) { const e = new Error(msg); e.code = code; return e; }

  const LOGO_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128" fill="none" stroke="#ffffff" stroke-linecap="round" stroke-linejoin="round"><path d="M30 10h46l26 26v82H30z" stroke-width="7"/><path d="M76 10v26h26" stroke-width="7"/><path d="M46 52h38L62 98" stroke-width="9"/><path d="M51 88l11 11 11-11" stroke-width="7"/></svg>';

  const CATEGORIES = [
    { id: 'language', name: 'Languages' }, { id: 'web', name: 'Web' }, { id: 'data', name: 'Data & Config' },
    { id: 'media', name: 'Media' }, { id: 'archive', name: 'Archives' }, { id: 'tool', name: 'Tools' },
    { id: 'generic', name: 'Generic' }, { id: 'folder', name: 'Folders' }, { id: 'custom', name: 'Imported' }
  ];
  const catIds = CATEGORIES.map(function (c) { return c.id; });

  /* ---------- built-in icons (original, generated SVG; no third-party artwork) ---------- */
  const B = function (id, name, cat, label, color, dark) { return { id: id, name: name, category: cat, kind: 'badge', label: label, color: color, dark: !!dark }; };
  const S = function (id, name, cat, shape, color) { return { id: id, name: name, category: cat, kind: 'shape', shape: shape, color: color }; };
  const BASE = [
    B('html', 'HTML', 'web', 'HT', '#e4572e'), B('css', 'CSS', 'web', 'CS', '#2f7fd8'), B('javascript', 'JavaScript', 'language', 'JS', '#f2d024', true),
    B('typescript', 'TypeScript', 'language', 'TS', '#3178c6'), B('json', 'JSON', 'data', '{}', '#8a8f98'), B('python', 'Python', 'language', 'Py', '#3d7ab5'),
    B('java', 'Java', 'language', 'Ja', '#d4572b'), B('c', 'C', 'language', 'C', '#5668b8'), B('cpp', 'C++', 'language', 'C+', '#4a5fb0'),
    B('csharp', 'C#', 'language', 'C#', '#7b4fb5'), B('php', 'PHP', 'language', 'PHP', '#7a7fb8'), B('ruby', 'Ruby', 'language', 'Rb', '#c43b3b'),
    B('go', 'Go', 'language', 'Go', '#2fb4c8'), B('rust', 'Rust', 'language', 'Rs', '#b5603a'), B('kotlin', 'Kotlin', 'language', 'Kt', '#8a5cf0'),
    B('swift', 'Swift', 'language', 'Sw', '#f0713b'), B('dart', 'Dart', 'language', 'Da', '#2a9fd6'), B('shell', 'Shell', 'language', '$_', '#3f4650'),
    B('markdown', 'Markdown', 'data', 'MD', '#4b5563'), B('yaml', 'YAML', 'data', 'YM', '#b0504f'), B('xml', 'XML', 'data', '<>', '#e08a2e'),
    B('sql', 'SQL', 'language', 'SQ', '#2d8f85'), B('react', 'React', 'web', 'Rx', '#2bb6d6', true), B('vue', 'Vue', 'web', 'Vu', '#3fa877'),
    B('svelte', 'Svelte', 'web', 'Sv', '#e0502f'), B('nodejs', 'Node.js', 'tool', 'No', '#4a9b4a'), B('npm', 'npm', 'tool', 'np', '#c23a3a'),
    B('git', 'Git', 'tool', 'Gt', '#e0572f'), B('docker', 'Docker', 'tool', 'Dk', '#2d8ad8'), B('font', 'Fonts', 'media', 'Aa', '#6b5fc7'),
    B('archive', 'Archives', 'archive', 'Zp', '#a8793a'), B('config', 'Config', 'data', 'cf', '#6b7280'), B('text', 'Text', 'generic', 'Tx', '#7a8594'),
    S('image', 'Images', 'media', 'image', '#3aa86b'), S('audio', 'Audio', 'media', 'audio', '#c2437a'), S('video', 'Video', 'media', 'video', '#7a4fd0'),
    S('file', 'Generic file', 'generic', 'file', '#9aa4b2'), S('folder', 'Generic folder', 'folder', 'folder', '#7c6cf0'), S('folder-open', 'Open folder', 'folder', 'folder-open', '#7c6cf0')
  ];
  const ICONS = []; BASE.forEach(function (d) {
    ICONS.push(d);
    if (d.kind === 'badge') ICONS.push(Object.assign({}, d, { id: d.id + '-round', name: d.name + ' (round)', round: true }));
  });
  const ICON_MAP = {}; ICONS.forEach(function (d) { ICON_MAP[d.id] = d; });
  const esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  const wrap = function (b) { return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">' + b + '</svg>'; };
  const SHAPES = {
    file: function (c) { return '<path d="M7 3h12l6 6v20H7z" fill="' + c + '"/><path d="M19 3v6h6z" fill="#fff" fill-opacity=".45"/>'; },
    folder: function (c) { return '<path d="M3 8a2 2 0 0 1 2-2h7l3 3h12a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill="' + c + '"/>'; },
    'folder-open': function (c) { return '<path d="M3 8a2 2 0 0 1 2-2h7l3 3h11a2 2 0 0 1 2 2v3H3z" fill="' + c + '" fill-opacity=".7"/><path d="M5 27l3-12h22l-3 12z" fill="' + c + '"/>'; },
    image: function (c) { return '<rect x="1" y="1" width="30" height="30" rx="7" fill="' + c + '"/><path d="M6 24l7-9 5 6 3-4 5 7z" fill="#fff"/><circle cx="21" cy="10" r="2.5" fill="#fff"/>'; },
    audio: function (c) { return '<rect x="1" y="1" width="30" height="30" rx="7" fill="' + c + '"/><path d="M14 8v11.2a3 3 0 1 0 2 2.8V13l7-1.5v6.7a3 3 0 1 0 2 2.8V7z" fill="#fff"/>'; },
    video: function (c) { return '<rect x="1" y="1" width="30" height="30" rx="7" fill="' + c + '"/><path d="M12 9l11 7-11 7z" fill="#fff"/>'; }
  };
  function iconSvg(d) {
    if (d.kind === 'shape') return wrap(SHAPES[d.shape](d.color));
    const bg = d.round ? '<circle cx="16" cy="16" r="15" fill="' + d.color + '"/>' : '<rect x="1" y="1" width="30" height="30" rx="7" fill="' + d.color + '"/>';
    const fs = d.label.length > 2 ? 10 : d.label.length === 2 ? 13 : 16;
    return wrap(bg + '<text x="16" y="' + (16 + fs * 0.36) + '" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="' + fs + '" fill="' + (d.dark ? '#111' : '#fff') + '">' + esc(d.label) + '</text>');
  }

  /* ---------- assignable targets ---------- */
  const T = function (id, name, cat, exts, def, names) { return { id: id, name: name, kind: 'file', category: cat, extensions: exts, names: names || [], defaultIcon: def }; };
  const TARGETS = [
    T('javascript', 'JavaScript', 'language', ['js', 'mjs', 'cjs'], 'javascript'), T('typescript', 'TypeScript', 'language', ['ts', 'mts', 'cts'], 'typescript'),
    T('react', 'React (JSX/TSX)', 'language', ['jsx', 'tsx'], 'react'), T('python', 'Python', 'language', ['py', 'pyw'], 'python'), T('java', 'Java', 'language', ['java'], 'java'),
    T('c', 'C', 'language', ['c', 'h'], 'c'), T('cpp', 'C++', 'language', ['cpp', 'cc', 'cxx', 'hpp', 'hh'], 'cpp'), T('csharp', 'C#', 'language', ['cs'], 'csharp'),
    T('php', 'PHP', 'language', ['php'], 'php'), T('ruby', 'Ruby', 'language', ['rb'], 'ruby'), T('go', 'Go', 'language', ['go'], 'go'), T('rust', 'Rust', 'language', ['rs'], 'rust'),
    T('kotlin', 'Kotlin', 'language', ['kt', 'kts'], 'kotlin'), T('swift', 'Swift', 'language', ['swift'], 'swift'), T('dart', 'Dart', 'language', ['dart'], 'dart'),
    T('shell', 'Shell', 'language', ['sh', 'bash', 'zsh'], 'shell'), T('sql', 'SQL', 'language', ['sql'], 'sql'), T('vue', 'Vue', 'language', ['vue'], 'vue'), T('svelte', 'Svelte', 'language', ['svelte'], 'svelte'),
    T('html', 'HTML', 'file', ['html', 'htm'], 'html'), T('css', 'CSS / SCSS', 'file', ['css', 'scss', 'sass', 'less'], 'css'), T('json', 'JSON', 'file', ['json', 'jsonc'], 'json', []),
    T('markdown', 'Markdown', 'file', ['md', 'markdown'], 'markdown'), T('yaml', 'YAML', 'file', ['yml', 'yaml'], 'yaml'), T('xml', 'XML', 'file', ['xml', 'xsd', 'xsl'], 'xml'),
    T('image', 'Images', 'file', ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico', 'svg'], 'image'), T('audio', 'Audio', 'file', ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac'], 'audio'),
    T('video', 'Video', 'file', ['mp4', 'mkv', 'webm', 'avi', 'mov'], 'video'), T('font', 'Fonts', 'file', ['ttf', 'otf', 'woff', 'woff2'], 'font'),
    T('archive', 'Archives', 'file', ['zip', 'rar', '7z', 'tar', 'gz'], 'archive'), T('config', 'Config', 'file', ['ini', 'conf', 'toml', 'env', 'cfg'], 'config'),
    T('text', 'Text / Log', 'file', ['txt', 'log'], 'text'), T('npm', 'npm (package.json)', 'file', [], 'npm', ['package.json', 'package-lock.json', '.npmrc']),
    T('docker', 'Docker', 'file', [], 'docker', ['dockerfile', 'docker-compose.yml', '.dockerignore']), T('git', 'Git', 'file', [], 'git', ['.gitignore', '.gitattributes', '.gitmodules']),
    { id: 'folder', name: 'Folder (closed)', kind: 'folder', category: 'folder', extensions: [], names: [], defaultIcon: 'folder' },
    { id: 'folder-open', name: 'Folder (open)', kind: 'folder', category: 'folder', extensions: [], names: [], defaultIcon: 'folder-open' }
  ];

  /* ---------- validation ---------- */
  function sanitizeName(s) { return String(s == null ? '' : s).replace(/[\u0000-\u001f<>:"\/\\|?*]/g, '').replace(/\s+/g, ' ').trim().slice(0, LIMITS.name); }
  function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'x'; }
  function normExt(s) { const x = String(s == null ? '' : s).trim().toLowerCase().replace(/^\.+/, ''); if (!EXT_RE.test(x)) throw E('BAD_EXT', 'Use 1-16 letters, digits, "_", "+" or "-" for the extension (e.g. abc).'); return x; }
  function validateSvgText(t) {
    if (typeof t !== 'string' || !/<svg[\s>\/]/i.test(t)) throw E('BAD_SVG', 'This file is not a valid SVG.');
    if (enc.encode(t).length > LIMITS.svg) throw E('TOO_BIG', 'SVG is larger than ' + (LIMITS.svg / 1024) + ' KB.');
    const bad = [/<script/i, /\bon[a-z]+\s*=/i, /javascript:/i, /<foreignObject/i, /<(iframe|embed|object|audio|video|link|meta)\b/i, /<!ENTITY/i, /@import/i, /url\(\s*['"]?\s*(?:https?:|\/\/|file:|ftp:)/i];
    for (const r of bad) if (r.test(t)) throw E('UNSAFE_SVG', 'This SVG contains scripts or external content and was rejected.');
    const refs = t.match(/(?:xlink:)?href\s*=\s*["'][^"']*["']/gi) || [];
    for (const r of refs) { const v = r.replace(/^[^=]*=\s*["']|["']$/g, '').trim(); if (!(v.charAt(0) === '#' || /^data:image\/(png|jpeg|webp|gif);base64,/i.test(v))) throw E('UNSAFE_SVG', 'This SVG references external files and was rejected.'); }
    return true;
  }
  function detectMime(filename, bytes) {
    const ext = (String(filename).split('.').pop() || '').toLowerCase();
    if (ext === 'svg') return 'image/svg+xml';
    if (ext === 'png' && bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return 'image/png';
    if (ext === 'webp' && bytes.length > 12 && String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]) === 'RIFF' && String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]) === 'WEBP') return 'image/webp';
    return null;
  }
  function checkIconBytes(filename, bytes) {
    const mime = detectMime(filename, bytes);
    if (!mime) throw E('BAD_IMAGE', 'Unsupported or corrupted image. Use SVG, PNG or WebP.');
    if (mime === 'image/svg+xml') { const t = dec.decode(bytes); validateSvgText(t); return { mime: mime, data: t }; }
    if (bytes.length > LIMITS.raster) throw E('TOO_BIG', 'Image is larger than ' + (LIMITS.raster / 1024) + ' KB.');
    return { mime: mime, data: bytesToB64(bytes) };
  }
  function bytesToB64(b) { let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); }
  function b64ToBytes(s) { const bin = atob(s), o = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) o[i] = bin.charCodeAt(i); return o; }
  function dataUri(src) {
    if (src.mime === 'image/svg+xml') return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(src.data)));
    return 'data:' + src.mime + ';base64,' + src.data;
  }
  function checkPath(name) {
    if (name === 'manifest.json') return name;
    if (/\\|^\/|\.\.|[\u0000-\u001f:]/.test(name) || name.length > 120 || !/^icons\/[A-Za-z0-9][A-Za-z0-9._-]{0,60}\.(svg|png|webp)$/i.test(name)) throw E('UNSAFE_PATH', 'The ZIP contains an unsafe or unsupported file path: ' + name.slice(0, 40));
    return name;
  }
  function validateManifest(m) {
    if (!m || typeof m !== 'object' || Array.isArray(m)) throw E('BAD_MANIFEST', 'manifest.json must be a JSON object.');
    if (m.format !== 'sevicon-pack') throw E('BAD_MANIFEST', 'manifest.json is not a SevIcon pack (format must be "sevicon-pack").');
    if (!Number.isInteger(m.formatVersion) || m.formatVersion < 1) throw E('BAD_MANIFEST', 'manifest.json has an invalid formatVersion.');
    if (m.formatVersion > 1) throw E('NEWER_FORMAT', 'This pack needs a newer SevIcon version.');
    if (!sanitizeName(m.name)) throw E('BAD_MANIFEST', 'manifest.json needs a pack name.');
    if (!Array.isArray(m.icons) || m.icons.length > LIMITS.icons) throw E('BAD_MANIFEST', 'manifest.json "icons" must be a list of at most ' + LIMITS.icons + ' items.');
    if (m.assignments != null && (typeof m.assignments !== 'object' || Array.isArray(m.assignments))) throw E('BAD_MANIFEST', '"assignments" must be an object.');
    return true;
  }

  /* ---------- state ---------- */
  function defaultSettings() { return { theme: 'dark', iconSize: 32, nativeCss: false, lastTab: 'overview' }; }
  function defaultState() { return { schema: SCHEMA, activePack: 'default', packs: { default: { id: 'default', name: 'SevIcon Default', builtin: true, icons: {}, assignments: {} } }, customTargets: [], recent: [], settings: defaultSettings() }; }
  function migrate(raw) {
    const d = defaultState(); let p = null;
    if (typeof raw === 'string' && raw) { try { p = JSON.parse(raw); } catch (e) { p = null; } }
    if (!p || typeof p !== 'object' || Array.isArray(p)) return d;
    const s = Object.assign({}, d, p);
    s.schema = SCHEMA;
    s.settings = Object.assign(defaultSettings(), p.settings && typeof p.settings === 'object' ? p.settings : {});
    s.packs = (p.packs && typeof p.packs === 'object') ? p.packs : {};
    s.packs.default = Object.assign({ id: 'default', name: 'SevIcon Default', builtin: true, icons: {}, assignments: {} }, s.packs.default, { builtin: true });
    Object.keys(s.packs).forEach(function (k) { const pk = s.packs[k]; if (!pk || typeof pk !== 'object') { delete s.packs[k]; return; } pk.id = k; pk.icons = pk.icons && typeof pk.icons === 'object' ? pk.icons : {}; pk.assignments = pk.assignments && typeof pk.assignments === 'object' ? pk.assignments : {}; pk.name = sanitizeName(pk.name) || k; });
    if (!s.packs[s.activePack]) s.activePack = 'default';
    s.customTargets = Array.isArray(p.customTargets) ? p.customTargets.filter(function (t) { return t && EXT_RE.test(String(t.extensions && t.extensions[0])); }) : [];
    s.recent = Array.isArray(p.recent) ? p.recent.slice(0, 10) : [];
    return s;
  }

  /* ---------- engine ---------- */
  function createEngine(adapter) {
    let st = defaultState(); const subs = new Set(); let idx = null;
    const err = E;
    function notify() { idx = null; subs.forEach(function (f) { try { f(); } catch (e) {} }); }
    function persist() { notify(); return Promise.resolve(adapter.set(JSON.stringify(st))).catch(function () {}); }
    async function load() { let raw = null; try { raw = await adapter.get(); } catch (e) {} st = migrate(raw); notify(); return st; }
    const activePack = function () { return st.packs[st.activePack]; };
    const getPack = function (id) { const p = st.packs[id]; if (!p) throw err('NO_PACK', 'That icon pack no longer exists.'); return p; };
    const editable = function (id) { const p = getPack(id || st.activePack); if (p.builtin) throw err('BUILTIN_PACK', 'The default pack is read-only. Duplicate it to make changes.'); return p; };
    const targets = function () { return TARGETS.concat(st.customTargets); };
    const target = function (id) { const t = targets().find(function (x) { return x.id === id; }); if (!t) throw err('NO_TARGET', 'Unknown file type.'); return t; };
    function sourceOf(pack, id) { if (pack.icons[id]) return pack.icons[id]; const d = ICON_MAP[id]; return d ? { mime: 'image/svg+xml', data: iconSvg(d), name: d.name, category: d.category } : null; }
    function iconName(id, packId) { const s = sourceOf(getPack(packId || st.activePack), id); return s ? (s.name || id) : 'Missing icon'; }
    function library(packId) {
      const p = getPack(packId || st.activePack); const out = ICONS.map(function (d) { return { id: d.id, name: d.name, category: d.category, builtin: true }; });
      Object.keys(p.icons).forEach(function (k) { const i = p.icons[k]; const ex = out.findIndex(function (o) { return o.id === k; }); const row = { id: k, name: i.name || k, category: catIds.indexOf(i.category) >= 0 ? i.category : 'custom', builtin: false }; if (ex >= 0) out[ex] = row; else out.push(row); });
      return out;
    }
    function search(query, cat, packId) {
      const q = String(query || '').trim().toLowerCase();
      return library(packId).filter(function (i) { return (!cat || cat === 'all' || i.category === cat) && (!q || i.name.toLowerCase().indexOf(q) >= 0 || i.id.indexOf(q) >= 0); });
    }
    function iconIdFor(targetId, packId) { const p = getPack(packId || st.activePack); const t = target(targetId); const a = p.assignments[targetId]; return (a && sourceOf(p, a)) ? a : t.defaultIcon; }
    function iconUri(id, packId) {
      const p = getPack(packId || st.activePack); let s = sourceOf(p, id);
      if (!s) s = sourceOf(p, 'file');
      return dataUri(s);
    }
    function buildIndex() {
      const ext = {}, names = {};
      targets().forEach(function (t) { t.extensions.forEach(function (x) { ext[x] = t.id; }); (t.names || []).forEach(function (n) { names[n] = t.id; }); });
      idx = { ext: ext, names: names }; return idx;
    }
    function resolve(filename, opt) {
      opt = opt || {}; const ix = idx || buildIndex(); let tid;
      if (opt.isFolder) tid = opt.open ? 'folder-open' : 'folder';
      else { const base = String(filename || '').split(/[\\/]/).pop().toLowerCase(); tid = ix.names[base]; if (!tid) { const i = base.lastIndexOf('.'); if (i > 0 || (i === 0 && false)) tid = ix.ext[base.slice(i + 1)]; } }
      if (!tid) return { targetId: null, iconId: 'file', uri: iconUri('file'), fallback: true };
      const p = activePack(); const a = p.assignments[tid]; const t = target(tid);
      const iid = (a && sourceOf(p, a)) ? a : t.defaultIcon;
      const ok = !!sourceOf(p, iid);
      return { targetId: tid, iconId: ok ? iid : 'file', uri: iconUri(ok ? iid : 'file'), fallback: !ok };
    }
    function isCustomized(tid) { const a = activePack().assignments[tid]; return !!a && a !== target(tid).defaultIcon; }
    function assign(tid, iid) {
      const p = editable(); const t = target(tid);
      if (!sourceOf(p, iid)) throw err('NO_ICON', 'That icon is not available in this pack.');
      if (iid === t.defaultIcon) delete p.assignments[tid]; else p.assignments[tid] = iid;
      st.recent = [{ targetId: tid, iconId: iid, t: Date.now() }].concat(st.recent.filter(function (r) { return r.targetId !== tid; })).slice(0, 10);
      return persist();
    }
    function resetTarget(tid) { const p = editable(); target(tid); delete p.assignments[tid]; return persist(); }
    function resetPack(id) { const p = editable(id); p.assignments = {}; return persist(); }
    async function addCustomTarget(extRaw, iconId) {
      const ext = normExt(extRaw);
      if (targets().some(function (t) { return t.extensions.indexOf(ext) >= 0; })) throw err('EXT_EXISTS', '.' + ext + ' already has an icon entry. Edit it instead.');
      if (st.customTargets.length >= LIMITS.customTargets) throw err('TOO_MANY', 'Too many custom extensions.');
      const t = { id: 'custom-' + ext, name: '.' + ext, kind: 'file', category: 'file', extensions: [ext], names: [], defaultIcon: 'file', custom: true };
      st.customTargets.push(t);
      if (iconId && !activePack().builtin) { const p = activePack(); if (sourceOf(p, iconId)) p.assignments[t.id] = iconId; }
      await persist(); return t;
    }
    function removeCustomTarget(tid) {
      const i = st.customTargets.findIndex(function (t) { return t.id === tid; }); if (i < 0) throw err('NO_TARGET', 'Only custom extensions can be removed.');
      st.customTargets.splice(i, 1); Object.keys(st.packs).forEach(function (k) { delete st.packs[k].assignments[tid]; });
      st.recent = st.recent.filter(function (r) { return r.targetId !== tid; }); return persist();
    }
    function addIconFromFile(filename, bytes, displayName, packId) {
      const p = editable(packId); if (Object.keys(p.icons).length >= LIMITS.icons) throw err('TOO_MANY', 'This pack has too many icons.');
      const r = checkIconBytes(filename, bytes);
      const name = sanitizeName(displayName || String(filename).replace(/\.[^.]+$/, '')) || 'Icon';
      let id = 'u-' + slug(name), n = 2; while (p.icons[id] || ICON_MAP[id]) id = 'u-' + slug(name) + '-' + n++;
      p.icons[id] = { name: name, category: 'custom', mime: r.mime, data: r.data };
      return persist().then(function () { return id; });
    }
    function removeIcon(id, packId) {
      const p = editable(packId); if (!p.icons[id]) throw err('NO_ICON', 'Only imported icons can be deleted.');
      delete p.icons[id]; Object.keys(p.assignments).forEach(function (k) { if (p.assignments[k] === id) delete p.assignments[k]; });
      return persist();
    }
    function uniqueName(name) { const base = sanitizeName(name) || 'My Pack'; let n = base, i = 2; const used = Object.keys(st.packs).map(function (k) { return st.packs[k].name.toLowerCase(); }); while (used.indexOf(n.toLowerCase()) >= 0) n = (base + ' ' + i++).slice(0, LIMITS.name + 4); return n; }
    function uniquePackId(name) { let id = slug(name), n = 2; if (id === 'default') id = 'pack'; const b = id; while (st.packs[id]) id = b + '-' + n++; return id; }
    function newPack(name, src) {
      if (Object.keys(st.packs).length >= LIMITS.packs) throw err('TOO_MANY', 'Too many packs. Delete one first.');
      const nm = uniqueName(name); const id = uniquePackId(nm);
      st.packs[id] = { id: id, name: nm, builtin: false, icons: src ? JSON.parse(JSON.stringify(src.icons)) : {}, assignments: src ? JSON.parse(JSON.stringify(src.assignments)) : {} };
      return st.packs[id];
    }
    function createPack(name) { const p = newPack(name || 'My Pack'); return persist().then(function () { return p; }); }
    function duplicatePack(id, name, o) { const s = getPack(id); const p = newPack(name || (s.name + ' copy'), s); if (o && o.activate) st.activePack = p.id; return persist().then(function () { return p; }); }
    function renamePack(id, name) { const p = editable(id); const n = sanitizeName(name); if (!n) throw err('BAD_NAME', 'Enter a pack name.'); if (Object.keys(st.packs).some(function (k) { return k !== id && st.packs[k].name.toLowerCase() === n.toLowerCase(); })) throw err('NAME_EXISTS', 'Another pack already uses that name.'); p.name = n; return persist(); }
    function deletePack(id) { const p = editable(id); delete st.packs[p.id]; if (st.activePack === id) st.activePack = 'default'; return persist(); }
    function setActivePack(id) { getPack(id); st.activePack = id; return persist(); }
    function exportPack(id) {
      const p = getPack(id); const ids = new Set(Object.keys(p.icons));
      Object.keys(p.assignments).forEach(function (k) { const v = p.assignments[k]; if (!p.icons[v] && ICON_MAP[v]) ids.add(v); });
      const icons = [], files = [];
      ids.forEach(function (iid) {
        const s = sourceOf(p, iid); const ext = s.mime === 'image/svg+xml' ? 'svg' : s.mime === 'image/png' ? 'png' : 'webp';
        const file = 'icons/' + iid + '.' + ext;
        icons.push({ id: iid, name: s.name || iid, category: s.category || 'custom', file: file, mime: s.mime });
        files.push({ name: file, data: s.mime === 'image/svg+xml' ? enc.encode(s.data) : b64ToBytes(s.data) });
      });
      const manifest = { format: 'sevicon-pack', formatVersion: 1, name: p.name, version: '1.0.0', generator: 'SevIcon ' + VERSION, assignments: p.assignments, icons: icons };
      files.unshift({ name: 'manifest.json', data: enc.encode(JSON.stringify(manifest, null, 2)) });
      return _Zip.write(files);
    }
    async function importPack(bytes) {
      if (!(bytes instanceof Uint8Array)) throw err('BAD_ZIP', 'Could not read the file.');
      if (bytes.length > LIMITS.zipTotal) throw err('TOO_BIG', 'ZIP is larger than ' + (LIMITS.zipTotal / 1048576) + ' MB.');
      const entries = await _Zip.read(bytes, { maxEntries: LIMITS.entries, maxTotal: LIMITS.zipTotal });
      let prefix = ''; if (!entries.some(function (e) { return e.name === 'manifest.json'; })) { const m = entries.find(function (e) { return /^[A-Za-z0-9._ -]{1,60}\/manifest\.json$/.test(e.name) && e.name.indexOf('..') < 0; }); if (m) prefix = m.name.slice(0, m.name.indexOf('/') + 1); }
      const files = new Map();
      entries.forEach(function (e) {
        let n = e.name; if (/^__MACOSX\//.test(n) || /(^|\/)\.DS_Store$/.test(n)) return;
        if (prefix) { if (n.indexOf(prefix) !== 0) throw err('UNSAFE_PATH', 'The ZIP has files outside the pack folder.'); n = n.slice(prefix.length); }
        checkPath(n); if (files.has(n)) throw err('UNSAFE_PATH', 'The ZIP has duplicate file paths.'); files.set(n, e.data);
      });
      const mb = files.get('manifest.json'); if (!mb) throw err('NO_MANIFEST', 'manifest.json is missing from the ZIP.');
      if (mb.length > LIMITS.manifest) throw err('BAD_MANIFEST', 'manifest.json is too large.');
      let m; try { m = JSON.parse(dec.decode(mb)); } catch (e) { throw err('BAD_MANIFEST', 'manifest.json is not valid JSON.'); }
      validateManifest(m);
      const icons = {}, warnings = [];
      m.icons.forEach(function (ic) {
        try {
          if (!ic || !ID_RE.test(String(ic.id))) throw err('BAD_MANIFEST', 'invalid icon id');
          const f = String(ic.file); checkPath(f); const data = files.get(f); if (!data) throw err('BAD_MANIFEST', 'missing file ' + f);
          const r = checkIconBytes(f, data); if (ic.mime && ic.mime !== r.mime) throw err('BAD_IMAGE', 'type mismatch');
          icons[ic.id] = { name: sanitizeName(ic.name) || ic.id, category: catIds.indexOf(ic.category) >= 0 ? ic.category : 'custom', mime: r.mime, data: r.data };
        } catch (e) { warnings.push('Skipped icon "' + String(ic && ic.id).slice(0, 30) + '": ' + e.message); }
      });
      const asg = {}; const a = m.assignments || {};
      Object.keys(a).forEach(function (k) { if (KEY_RE.test(k) && typeof a[k] === 'string' && (icons[a[k]] || ICON_MAP[a[k]])) asg[k] = a[k]; else warnings.push('Skipped assignment "' + k.slice(0, 30) + '".'); });
      const p = newPack(sanitizeName(m.name)); p.icons = icons; p.assignments = asg;
      await persist(); return { pack: p, warnings: warnings };
    }
    function setSetting(k, v) {
      if (k === 'theme' && THEMES.indexOf(v) < 0) throw err('BAD_SETTING', 'Unknown theme.');
      else if (k === 'iconSize' && SIZES.indexOf(v) < 0) throw err('BAD_SETTING', 'Unsupported icon size.');
      else if (k === 'nativeCss' && typeof v !== 'boolean') throw err('BAD_SETTING', 'Invalid value.');
      else if (k === 'lastTab' && TABS.indexOf(v) < 0) throw err('BAD_SETTING', 'Unknown tab.');
      else if (['theme', 'iconSize', 'nativeCss', 'lastTab'].indexOf(k) < 0) throw err('BAD_SETTING', 'Unknown setting.');
      st.settings[k] = v; return persist();
    }
    function resetSettings() { st.settings = defaultSettings(); return persist(); }
    function restoreDefaults() { st = defaultState(); return persist(); }
    function exportSettings() { return JSON.stringify({ format: 'sevicon-settings', formatVersion: 1, settings: st.settings }, null, 2); }
    function importSettings(text) {
      let o; try { o = JSON.parse(text); } catch (e) { throw err('BAD_SETTINGS_FILE', 'That file is not valid JSON.'); }
      if (!o || o.format !== 'sevicon-settings' || !o.settings) throw err('BAD_SETTINGS_FILE', 'That is not a SevIcon settings file.');
      const n = Object.assign({}, st.settings); Object.keys(o.settings).forEach(function (k) { if (k === 'lastTab') return; const bak = st.settings[k]; try { setSettingNoSave(n, k, o.settings[k]); } catch (e) {} });
      st.settings = n; return persist();
    }
    function setSettingNoSave(n, k, v) { if ((k === 'theme' && THEMES.indexOf(v) >= 0) || (k === 'iconSize' && SIZES.indexOf(v) >= 0) || (k === 'nativeCss' && typeof v === 'boolean')) n[k] = v; else throw err('BAD_SETTING', 'x'); }
    function stats() {
      const p = activePack(); const own = Object.keys(p.assignments).filter(function (k) { try { return isCustomized(k); } catch (e) { return false; } });
      return { icons: library().length, customized: own.length, customTypes: st.customTargets.length, packs: Object.keys(st.packs).length, activePack: p.name, recent: st.recent.slice() };
    }
    function nativeCss() {
      const rules = []; const p = activePack();
      targets().forEach(function (t) { if (!t.extensions.length) return; const iid = iconIdFor(t.id); const u = iconUri(iid, p.id);
        const sel = t.extensions.map(function (x) { return '.file_type_' + x; }).join(','); rules.push(sel + '{background-image:url("' + u + '")!important;background-size:contain!important;background-repeat:no-repeat!important;background-position:center!important}'); });
      return rules.join('\n');
    }
    return { load: load, subscribe: function (f) { subs.add(f); return function () { subs.delete(f); }; }, get state() { return st; }, targets: targets, target: target, library: library, search: search, categories: CATEGORIES,
      activePack: activePack, packs: function () { return Object.keys(st.packs).map(function (k) { return st.packs[k]; }); }, iconUri: iconUri, iconName: iconName, iconIdFor: iconIdFor, resolve: resolve, isCustomized: isCustomized,
      assign: assign, resetTarget: resetTarget, resetPack: resetPack, addCustomTarget: addCustomTarget, removeCustomTarget: removeCustomTarget, addIconFromFile: addIconFromFile, removeIcon: removeIcon,
      createPack: createPack, duplicatePack: duplicatePack, renamePack: renamePack, deletePack: deletePack, setActivePack: setActivePack, exportPack: exportPack, importPack: importPack,
      setSetting: setSetting, resetSettings: resetSettings, restoreDefaults: restoreDefaults, exportSettings: exportSettings, importSettings: importSettings, stats: stats, nativeCss: nativeCss };
  }
  return { VERSION: VERSION, SCHEMA: SCHEMA, LIMITS: LIMITS, LOGO_SVG: LOGO_SVG, ICONS: ICONS, TARGETS: TARGETS, CATEGORIES: CATEGORIES, TABS: TABS, THEMES: THEMES, SIZES: SIZES,
    createEngine: createEngine, validateSvgText: validateSvgText, validateManifest: validateManifest, checkPath: checkPath, normExt: normExt, iconSvg: iconSvg, migrate: migrate, dataUri: dataUri, sanitizeName: sanitizeName, bytesToB64: bytesToB64 };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = Core;
