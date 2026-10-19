/* SevIcon 1.0.0 - built by build.js from src/. Do not edit by hand. */
(function () {
/* SevIcon - minimal ZIP reader/writer (store on write; stored+deflate on read). */
const Zip = (function () {
  'use strict';
  function err(code, msg) { const e = new Error(msg); e.code = code; return e; }
  const T = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; T[n] = c >>> 0; }
  function crc32(b) { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = T[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function concat(list) {
    let n = 0; for (const p of list) n += p.length;
    const out = new Uint8Array(n); let o = 0;
    for (const p of list) { out.set(p, o); o += p.length; }
    return out;
  }
  function write(files) {
    const enc = new TextEncoder(); const parts = []; const cd = []; let off = 0;
    for (const f of files) {
      const nm = enc.encode(f.name), crc = crc32(f.data), sz = f.data.length;
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true);
      lh.setUint16(12, 0x21, true); lh.setUint32(14, crc, true); lh.setUint32(18, sz, true);
      lh.setUint32(22, sz, true); lh.setUint16(26, nm.length, true);
      parts.push(new Uint8Array(lh.buffer), nm, f.data);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true);
      ch.setUint16(8, 0x0800, true); ch.setUint16(14, 0x21, true); ch.setUint32(16, crc, true);
      ch.setUint32(20, sz, true); ch.setUint32(24, sz, true); ch.setUint16(28, nm.length, true);
      ch.setUint32(42, off, true);
      cd.push(new Uint8Array(ch.buffer), nm);
      off += 30 + nm.length + sz;
    }
    let cdSize = 0; for (const p of cd) cdSize += p.length;
    const e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true);
    e.setUint32(12, cdSize, true); e.setUint32(16, off, true);
    return concat(parts.concat(cd, [new Uint8Array(e.buffer)]));
  }
  async function inflate(raw, usz) {
    if (typeof DecompressionStream === 'undefined') throw err('ZIP_UNSUPPORTED', 'This device cannot read compressed ZIP entries. Re-zip the pack using "store" (no compression).');
    const ds = new DecompressionStream('deflate-raw');
    const w = ds.writable.getWriter();
    w.write(raw).catch(function () {}); w.close().catch(function () {});
    const r = ds.readable.getReader(); const out = new Uint8Array(usz); let len = 0;
    for (;;) {
      const x = await r.read(); if (x.done) break;
      if (len + x.value.length > usz) { try { r.cancel(); } catch (e) {} throw err('ZIP_BOMB', 'ZIP entry is larger than declared.'); }
      out.set(x.value, len); len += x.value.length;
    }
    if (len !== usz) throw err('ZIP_INVALID', 'ZIP entry size mismatch.');
    return out;
  }
  async function read(bytes, opt) {
    const maxEntries = (opt && opt.maxEntries) || 400, maxTotal = (opt && opt.maxTotal) || 5 * 1024 * 1024;
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let e = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 65535); i--) if (dv.getUint32(i, true) === 0x06054b50) { e = i; break; }
    if (e < 0) throw err('ZIP_INVALID', 'This is not a valid ZIP file.');
    const n = dv.getUint16(e + 10, true), cdSize = dv.getUint32(e + 12, true), cdOff = dv.getUint32(e + 16, true);
    if (n === 0xFFFF || cdOff === 0xFFFFFFFF) throw err('ZIP_UNSUPPORTED', 'ZIP64 archives are not supported.');
    if (n > maxEntries) throw err('ZIP_TOO_MANY', 'ZIP contains too many files (max ' + maxEntries + ').');
    if (cdOff + cdSize > e) throw err('ZIP_INVALID', 'ZIP directory is corrupted.');
    let p = cdOff, total = 0; const out = []; const td = new TextDecoder();
    for (let i = 0; i < n; i++) {
      if (p + 46 > bytes.length || dv.getUint32(p, true) !== 0x02014b50) throw err('ZIP_INVALID', 'ZIP directory is corrupted.');
      const flags = dv.getUint16(p + 8, true), method = dv.getUint16(p + 10, true), crc = dv.getUint32(p + 16, true);
      const csz = dv.getUint32(p + 20, true), usz = dv.getUint32(p + 24, true);
      const nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lo = dv.getUint32(p + 42, true);
      const name = td.decode(bytes.subarray(p + 46, p + 46 + nl)); p += 46 + nl + xl + cl;
      if (flags & 1) throw err('ZIP_ENCRYPTED', 'Encrypted ZIP files are not supported.');
      if (name.endsWith('/')) continue;
      total += usz; if (total > maxTotal) throw err('ZIP_TOO_LARGE', 'ZIP content is too large.');
      if (lo + 30 > bytes.length || dv.getUint32(lo, true) !== 0x04034b50) throw err('ZIP_INVALID', 'ZIP entry is corrupted.');
      const ds = lo + 30 + dv.getUint16(lo + 26, true) + dv.getUint16(lo + 28, true);
      if (ds + csz > bytes.length) throw err('ZIP_INVALID', 'ZIP entry is truncated.');
      const raw = bytes.subarray(ds, ds + csz); let data;
      if (method === 0) { if (csz !== usz) throw err('ZIP_INVALID', 'ZIP entry size mismatch.'); data = raw.slice(); }
      else if (method === 8) data = await inflate(raw, usz);
      else throw err('ZIP_UNSUPPORTED', 'Unsupported ZIP compression method.');
      if (crc32(data) !== crc) throw err('ZIP_INVALID', 'ZIP entry checksum mismatch.');
      out.push({ name: name, data: data });
    }
    return out;
  }
  return { write: write, read: read, crc32: crc32, err: err };
})();

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

/* SevIcon entry: Acode integration. Every Acode API call is feature-detected; see README for what is verified. */
(function () {
  'use strict';
  if (typeof acode === 'undefined') return;
  const PLUGIN_ID = 'com.sevicon.acode', CMD = 'sevicon-open', KEY = 'sevicon:state:v1';
  let engine = null, app = null, page = null, overlay = null, nativeStyle = null, unsubNative = null, cacheUrl = null, baseUrl = '', disposed = false;
  const safe = function (fn, dflt) { try { return fn(); } catch (e) { return dflt; } };
  const req = function (n) { return safe(function () { return acode.require(n); }); };
  const dlg = function (n) { return req(n); };

  function fsOp(url) { const f = acode.fsOperation || req('fsOperation'); return f ? f(url) : null; }
  const adapter = {
    async get() {
      let v = safe(function () { return localStorage.getItem(KEY); }, null);
      if (!v && cacheUrl) { v = await safe(function () { return fsOp(cacheUrl).readFile('utf8'); }, Promise.resolve(null)).then(function (x) { return typeof x === 'string' ? x : (x ? new TextDecoder().decode(x) : null); }).catch(function () { return null; }); }
      return v || null;
    },
    async set(text) {
      safe(function () { localStorage.setItem(KEY, text); });
      if (cacheUrl) await Promise.resolve(safe(function () { return fsOp(cacheUrl).writeFile(text); })).catch(function () {});
    }
  };

  const host = {
    toast: function (m) { const t = dlg('toast'); if (typeof t === 'function') t(m, 3000); else if (typeof window.toast === 'function') window.toast(m, 3000); },
    async confirm(title, msg, single) {
      const c = req('confirm'); if (c && !single) return !!(await c(title, msg));
      const a = req('alert'); if (single && a) { await a(title, msg); return true; }
      return window.confirm(title + '\n\n' + msg);
    },
    async prompt(title, label, value) {
      const p = req('prompt'); if (p) { const r = await p(title + ' - ' + label, value || '', 'text'); return r == null ? null : String(r); }
      return window.prompt(title + ' - ' + label, value || '');
    },
    pickFile: function (accept) {
      return new Promise(function (resolve) {
        const i = document.createElement('input'); i.type = 'file'; i.accept = accept; i.style.display = 'none'; document.body.appendChild(i);
        let done = false; const fin = function (v) { if (done) return; done = true; i.remove(); resolve(v); };
        i.addEventListener('change', function () { const f = i.files && i.files[0]; if (!f) return fin(null); if (f.size > Core.LIMITS.zipTotal) { host.toast('That file is too large.'); return fin(null); } f.arrayBuffer().then(function (b) { fin({ name: f.name, bytes: new Uint8Array(b) }); }, function () { host.toast('Could not read that file.'); fin(null); }); });
        i.addEventListener('cancel', function () { fin(null); }); i.click();
      });
    },
    async saveFile(name, bytes, mime) {
      const fb = req('fileBrowser');
      if (typeof fb === 'function') {
        try { const r = await fb('folder', 'Choose where to save ' + name); const url = r && (r.url || r); if (url) { const fs = fsOp(url); await fs.createFile(name, bytes); return true; } return false; } catch (e) { /* fall through to download */ }
      }
      try { const u = URL.createObjectURL(new Blob([bytes], { type: mime })); const a = document.createElement('a'); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 4000); return true; }
      catch (e) { host.toast('Could not save the file on this device.'); return false; }
    }
  };

  function applyNative() {
    if (!engine) return;
    if (engine.state.settings.nativeCss) { if (!nativeStyle) { nativeStyle = document.createElement('style'); nativeStyle.id = 'sevicon-native'; document.head.appendChild(nativeStyle); } nativeStyle.textContent = engine.nativeCss(); }
    else if (nativeStyle) { nativeStyle.remove(); nativeStyle = null; }
  }
  function closeUI() {
    if (page) { const p = page; page = null; safe(function () { p.hide(); }); }
    if (overlay) { overlay.remove(); overlay = null; }
    if (app) { app.destroy(); app = null; }
  }
  function openUI() {
    if (disposed || !engine) return;
    if (app) { if (overlay) return; closeUI(); }
    const Page = req('page') || req('WCPage');
    if (typeof Page === 'function') {
      try {
        page = Page('SevIcon'); app = SevUI.create(engine, Object.assign({}, host, { close: null }));
        app.el.style.position = 'relative'; app.el.style.minHeight = '100%';
        page.body = app.el; page.onhide = function () { if (page) { page = null; if (app) { app.destroy(); app = null; } } }; page.show(); return;
      } catch (e) { closeUI(); }
    }
    overlay = document.createElement('div'); overlay.id = 'sevicon-overlay'; overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:#0d0d12';
    app = SevUI.create(engine, Object.assign({}, host, { close: closeUI })); overlay.appendChild(app.el); document.body.appendChild(overlay);
  }

  acode.setPluginInit(PLUGIN_ID, async function (base, $page, opts) {
    baseUrl = base || ''; cacheUrl = opts && opts.cacheFileUrl;
    engine = Core.createEngine(adapter); await engine.load();
    unsubNative = engine.subscribe(applyNative); applyNative();
    safe(function () { editorManager.editor.commands.addCommand({ name: CMD, description: 'SevIcon: Open icon customizer', bindKey: null, exec: openUI }); });
    safe(function () { acode.addIcon('sevicon', baseUrl + 'icon.png'); });
    safe(function () { const sb = req('sidebarApps'); if (sb && sb.add) sb.add('sevicon', 'sevicon-app', 'SevIcon', function (c) { const b = document.createElement('button'); b.textContent = 'Open SevIcon'; b.style.cssText = 'margin:12px;padding:12px 16px;border-radius:10px;border:0;background:#8b6cf6;color:#fff;font:inherit'; b.onclick = openUI; c.appendChild(b); }); });
  });
  acode.setPluginUnmount(PLUGIN_ID, function () {
    disposed = true; closeUI();
    safe(function () { editorManager.editor.commands.removeCommand(CMD); });
    if (unsubNative) unsubNative(); if (nativeStyle) { nativeStyle.remove(); nativeStyle = null; }
    safe(function () { const sb = req('sidebarApps'); if (sb && sb.remove) sb.remove('sevicon-app'); });
    engine = null;
  });
})();

})();
