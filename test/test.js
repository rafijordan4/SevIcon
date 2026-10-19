const assert = require('assert'), fs = require('fs'), path = require('path'), cp = require('child_process'), os = require('os');
const Core = require('../src/core.js'), Zip = require('../src/zip.js');
let pass = 0, fail = 0; const queue = [];
const test = (n, f) => queue.push([n, f]);
const mem = (init) => { let v = init || null; return { get: async () => v, set: async (s) => { v = s; }, peek: () => v }; };
const mk = async (a) => { const e = Core.createEngine(a || mem()); await e.load(); return e; };
const rejects = async (p, code) => { try { await p; } catch (e) { assert.strictEqual(e.code, code, 'expected ' + code + ' got ' + e.code + ': ' + e.message); return; } assert.fail('expected rejection ' + code); };
const throwsCode = (f, code) => { try { f(); } catch (e) { assert.strictEqual(e.code, code, e.message); return; } assert.fail('expected throw ' + code); };
const zipOf = (files) => Zip.write(files.map(([n, d]) => ({ name: n, data: typeof d === 'string' ? Buffer.from(d) : d })));
const manifest = (o) => JSON.stringify(Object.assign({ format: 'sevicon-pack', formatVersion: 1, name: 'T', icons: [], assignments: {} }, o));
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><rect width="8" height="8" fill="red"/></svg>';

test('plugin.json valid and referenced files exist', () => {
  const m = JSON.parse(fs.readFileSync(path.join(__dirname, '../plugin.json'), 'utf8'));
  ['id', 'name', 'main', 'version', 'icon', 'readme', 'files'].forEach(k => assert.ok(m[k], k));
  assert.match(m.id, /^[a-z0-9.\-_]+$/); assert.match(m.version, /^\d+\.\d+\.\d+$/);
  [m.main, m.icon, m.readme].concat(m.files).forEach(f => assert.ok(fs.existsSync(path.join(__dirname, '..', f)), f));
  assert.strictEqual(m.version, Core.VERSION);
});
test('registry: unique ids, every built-in SVG passes validation, required icons present', () => {
  const ids = Core.ICONS.map(i => i.id); assert.strictEqual(new Set(ids).size, ids.length);
  Core.ICONS.forEach(i => Core.validateSvgText(Core.iconSvg(i)));
  ['html','css','javascript','typescript','json','python','java','c','cpp','csharp','php','ruby','go','rust','kotlin','swift','dart','shell','markdown','yaml','xml','sql','react','vue','svelte','nodejs','npm','git','docker','image','audio','video','font','archive','file','folder'].forEach(i => assert.ok(ids.includes(i), i));
  Core.TARGETS.forEach(t => assert.ok(ids.includes(t.defaultIcon), t.id));
});
test('extension matching is case-insensitive, names and fallback work', async () => {
  const e = await mk();
  assert.strictEqual(e.resolve('app.JS').targetId, 'javascript'); assert.strictEqual(e.resolve('/a/b/Index.HtMl').targetId, 'html');
  assert.strictEqual(e.resolve('package.json').targetId, 'npm'); assert.strictEqual(e.resolve('Dockerfile').targetId, 'docker');
  assert.strictEqual(e.resolve('.gitignore').targetId, 'git');
  const u = e.resolve('weird.zzz'); assert.strictEqual(u.fallback, true); assert.strictEqual(u.iconId, 'file');
  assert.strictEqual(e.resolve('src', { isFolder: true }).targetId, 'folder'); assert.strictEqual(e.resolve('src', { isFolder: true, open: true }).targetId, 'folder-open');
});
test('default pack is read-only; assign/reset work on a copy', async () => {
  const e = await mk();
  assert.throws(() => e.assign('python', 'java'), /read-only/);
  const p = await e.duplicatePack('default', 'Mine', { activate: true });
  await e.assign('python', 'java'); assert.strictEqual(e.resolve('a.py').iconId, 'java'); assert.strictEqual(e.stats().customized, 1);
  await e.assign('python', 'python'); assert.strictEqual(e.stats().customized, 0);
  await e.assign('python', 'go'); await e.resetTarget('python'); assert.strictEqual(e.resolve('a.py').iconId, 'python');
  assert.strictEqual(e.state.packs.default.assignments.python, undefined);
  throwsCode(() => e.assign('python', 'nope'), 'NO_ICON'); throwsCode(() => e.assign('nope', 'go'), 'NO_TARGET');
});
test('custom extension: add, assign, duplicates and bad input rejected, remove', async () => {
  const e = await mk(); await e.duplicatePack('default', 'M', { activate: true });
  const t = await e.addCustomTarget('.ABC', 'rust'); assert.strictEqual(t.id, 'custom-abc'); assert.strictEqual(e.resolve('x.abc').iconId, 'rust');
  assert.strictEqual(e.resolve('X.AbC').targetId, 'custom-abc');
  await rejects(e.addCustomTarget('abc'), 'EXT_EXISTS');
  try { await e.addCustomTarget('js'); assert.fail('x'); } catch (x) { assert.strictEqual(x.code, 'EXT_EXISTS'); }
  try { await e.addCustomTarget('a/b'); assert.fail('x'); } catch (x) { assert.strictEqual(x.code, 'BAD_EXT'); }
  await e.removeCustomTarget('custom-abc'); assert.strictEqual(e.resolve('x.abc').fallback, true);
});
test('missing icon falls back to generic file icon', async () => {
  const e = await mk(); await e.duplicatePack('default', 'M', { activate: true });
  const id = await e.addIconFromFile('mine.svg', Buffer.from(SVG)); await e.assign('python', id);
  delete e.state.packs[e.state.activePack].icons[id];
  assert.strictEqual(e.iconIdFor('python'), 'python'); const r = e.resolve('a.py'); assert.ok(r.uri.startsWith('data:image/svg+xml'));
  assert.ok(e.iconUri('does-not-exist').startsWith('data:'));
});
test('SVG/image validation rejects unsafe content and accepts safe', () => {
  Core.validateSvgText(SVG);
  ['<svg><script>alert(1)</script></svg>', '<svg onload="x()"></svg>', '<svg><a href="javascript:x"/></svg>', '<svg><image href="http://e.com/a.png"/></svg>', '<svg><foreignObject/></svg>', '<svg style="fill:url(https://e.com/x)"></svg>', '<!DOCTYPE s [<!ENTITY a "b">]><svg/>', 'not svg'].forEach(s => throwsCode(() => Core.validateSvgText(s), s === 'not svg' ? 'BAD_SVG' : 'UNSAFE_SVG'));
  Core.validateSvgText('<svg><use href="#a"/><image href="data:image/png;base64,AAAA"/></svg>');
});
test('imported icon limits and magic bytes', async () => {
  const e = await mk(); await e.duplicatePack('default', 'M', { activate: true });
  try { await e.addIconFromFile('a.png', Buffer.from('not a png')); assert.fail('x'); } catch (x) { assert.strictEqual(x.code, 'BAD_IMAGE'); }
  try { await e.addIconFromFile('a.svg', Buffer.from('<svg>' + 'x'.repeat(110 * 1024) + '</svg>')); assert.fail('x'); } catch (x) { assert.strictEqual(x.code, 'TOO_BIG'); }
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(50)]);
  const id = await e.addIconFromFile('Logo One.png', png); assert.strictEqual(id, 'u-logo-one'); assert.ok(e.iconUri(id).startsWith('data:image/png;base64,'));
  await e.assign('python', id); await e.removeIcon(id); assert.strictEqual(e.iconIdFor('python'), 'python');
});
test('pack create/rename/duplicate/delete/activate/reset', async () => {
  const e = await mk(); const a = await e.createPack('Alpha'); const b = await e.duplicatePack(a.id, 'Beta');
  await e.setActivePack(a.id); await e.assign('go', 'rust'); await e.renamePack(a.id, 'Alpha2'); assert.strictEqual(e.state.packs[a.id].name, 'Alpha2');
  try { await e.renamePack(a.id, 'beta'); assert.fail('x'); } catch (x) { assert.strictEqual(x.code, 'NAME_EXISTS'); }
  await e.resetPack(a.id); assert.deepStrictEqual(e.state.packs[a.id].assignments, {});
  await e.deletePack(a.id); assert.strictEqual(e.state.activePack, 'default'); throwsCode(() => e.deletePack('default'), 'BUILTIN_PACK');
  assert.strictEqual(e.packs().length, 2);
});
test('export/import round trip preserves assignments and icons; never overwrites', async () => {
  const e = await mk(); const p = await e.duplicatePack('default', 'Round', { activate: true });
  const id = await e.addIconFromFile('mine.svg', Buffer.from(SVG)); await e.assign('python', id); await e.assign('go', 'rust');
  const z = e.exportPack(p.id); const before = JSON.stringify(e.state.packs.round);
  const r = await e.importPack(z); assert.strictEqual(r.warnings.length, 0); assert.notStrictEqual(r.pack.id, p.id);
  assert.deepStrictEqual(r.pack.assignments, p.assignments); assert.ok(r.pack.icons[id]); assert.strictEqual(JSON.stringify(e.state.packs.round), before);
  await e.setActivePack(r.pack.id); assert.strictEqual(e.resolve('a.go').iconId, 'rust');
});
test('import accepts a single wrapper folder (SevIcon-Pack/manifest.json)', async () => {
  const e = await mk(); const r = await e.importPack(zipOf([['SevIcon-Pack/manifest.json', manifest({ name: 'Wrapped' })]])); assert.strictEqual(r.pack.name, 'Wrapped');
});
test('import rejects malformed/unsafe archives', async () => {
  const e = await mk();
  await rejects(e.importPack(new Uint8Array([1, 2, 3])), 'ZIP_INVALID');
  await rejects(e.importPack(zipOf([['icons/a.svg', SVG]])), 'NO_MANIFEST');
  await rejects(e.importPack(zipOf([['manifest.json', '{bad']])), 'BAD_MANIFEST');
  await rejects(e.importPack(zipOf([['manifest.json', '[]']])), 'BAD_MANIFEST');
  await rejects(e.importPack(zipOf([['manifest.json', manifest({ format: 'x' })]])), 'BAD_MANIFEST');
  await rejects(e.importPack(zipOf([['manifest.json', manifest({ formatVersion: 9 })]])), 'NEWER_FORMAT');
  await rejects(e.importPack(zipOf([['manifest.json', manifest({ name: '  ' })]])), 'BAD_MANIFEST');
  await rejects(e.importPack(zipOf([['manifest.json', manifest()], ['../evil.svg', SVG]])), 'UNSAFE_PATH');
  await rejects(e.importPack(zipOf([['manifest.json', manifest()], ['/abs.svg', SVG]])), 'UNSAFE_PATH');
  await rejects(e.importPack(zipOf([['manifest.json', manifest()], ['icons\\x.svg', SVG]])), 'UNSAFE_PATH');
  await rejects(e.importPack(zipOf([['manifest.json', manifest()], ['icons/run.js', 'alert(1)']])), 'UNSAFE_PATH');
  await rejects(e.importPack(new Uint8Array(6 * 1024 * 1024)), 'TOO_BIG');
  assert.strictEqual(e.packs().length, 1);
});
test('import skips bad icons with warnings (unsafe svg, missing file, bad assignment)', async () => {
  const e = await mk();
  const m = manifest({ icons: [{ id: 'good', name: 'Good', file: 'icons/good.svg', mime: 'image/svg+xml' }, { id: 'evil', name: 'Evil', file: 'icons/evil.svg' }, { id: 'gone', name: 'G', file: 'icons/gone.svg' }], assignments: { python: 'good', go: 'evil', js: 'java', 'bad key!': 'good' } });
  const r = await e.importPack(zipOf([['manifest.json', m], ['icons/good.svg', SVG], ['icons/evil.svg', '<svg><script>1</script></svg>']]));
  assert.deepStrictEqual(Object.keys(r.pack.icons), ['good']); assert.deepStrictEqual(r.pack.assignments, { python: 'good', js: 'java' }); assert.ok(r.warnings.length >= 4);
});
test('import reads real DEFLATE zips and rejects corrupted data', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sv-')); const f = path.join(tmp, 'p.zip');
  cp.execFileSync('python3', ['-c', `import zipfile,sys,json
z=zipfile.ZipFile(sys.argv[1],'w',zipfile.ZIP_DEFLATED)
z.writestr('manifest.json',json.dumps({"format":"sevicon-pack","formatVersion":1,"name":"Py","icons":[{"id":"a","name":"A","file":"icons/a.svg"}],"assignments":{"python":"a"}}))
z.writestr('icons/a.svg','<svg xmlns="http://www.w3.org/2000/svg">'+'<g/>'*200+'</svg>')
z.close()`, f]);
  const e = await mk(); const bytes = new Uint8Array(fs.readFileSync(f)); const r = await e.importPack(bytes); assert.strictEqual(r.pack.assignments.python, 'a');
  const bad = bytes.slice(); bad[52] ^= 0xff; bad[53] ^= 0xff; bad[54] ^= 0xff; await e.importPack(bad).then(() => assert.fail('expected failure'), () => {});
});
test('storage restoration, migration keeps data, corrupt data falls back safely', async () => {
  const a = mem(); const e = await mk(a); await e.duplicatePack('default', 'Keep', { activate: true }); await e.assign('go', 'rust'); await e.addCustomTarget('qq'); await e.setSetting('theme', 'light'); await e.setSetting('iconSize', 48);
  const e2 = await mk(mem(a.peek())); assert.strictEqual(e2.state.settings.theme, 'light'); assert.strictEqual(e2.state.settings.iconSize, 48); assert.strictEqual(e2.resolve('a.go').iconId, 'rust'); assert.strictEqual(e2.resolve('x.qq').targetId, 'custom-qq'); assert.strictEqual(e2.state.activePack, 'keep');
  const old = JSON.stringify({ schema: 0, activePack: 'x', settings: { theme: 'light' }, packs: { x: { name: 'Old', icons: {}, assignments: { go: 'rust' } } } });
  const e3 = await mk(mem(old)); assert.strictEqual(e3.state.settings.theme, 'light'); assert.strictEqual(e3.state.settings.iconSize, 32); assert.strictEqual(e3.state.packs.x.assignments.go, 'rust'); assert.ok(e3.state.packs.default.builtin); assert.strictEqual(e3.state.schema, Core.SCHEMA);
  const e4 = await mk(mem('{{garbage')); assert.strictEqual(e4.state.activePack, 'default'); assert.strictEqual(e4.packs().length, 1);
  const e5 = await mk({ get: async () => { throw new Error('io'); }, set: async () => {} }); assert.strictEqual(e5.packs().length, 1);
});
test('settings validation, export/import, reset and restore defaults', async () => {
  const e = await mk(); throwsCode(() => e.setSetting('theme', 'pink'), 'BAD_SETTING'); throwsCode(() => e.setSetting('iconSize', 99), 'BAD_SETTING'); throwsCode(() => e.setSetting('evil', 1), 'BAD_SETTING');
  await e.setSetting('theme', 'light'); const x = e.exportSettings(); await e.resetSettings(); assert.strictEqual(e.state.settings.theme, 'dark');
  await e.importSettings(x); assert.strictEqual(e.state.settings.theme, 'light'); throwsCode(() => e.importSettings('nope'), 'BAD_SETTINGS_FILE');
  await e.duplicatePack('default', 'Z'); await e.restoreDefaults(); assert.strictEqual(e.packs().length, 1);
});
test('search, category filter and real stats', async () => {
  const e = await mk(); assert.ok(e.search('pyth').some(i => i.id === 'python')); assert.strictEqual(e.search('zzzzzz').length, 0);
  assert.ok(e.search('', 'folder').every(i => i.category === 'folder')); assert.strictEqual(e.search('', 'all').length, e.library().length);
  assert.strictEqual(e.stats().icons, Core.ICONS.length); assert.strictEqual(e.stats().customized, 0);
});
test('native CSS generator is data-URI only (no remote URLs)', async () => {
  const e = await mk(); const css = e.nativeCss(); assert.ok(css.includes('.file_type_js')); assert.ok(!/url\("https?:/.test(css));
});
test('built main.js loads; plugin init registers the command and unmount removes it (stubbed acode)', async () => {
  assert.ok(fs.readFileSync(path.join(__dirname, '../main.js'), 'utf8').includes('SevIcon ' + Core.VERSION));
  const calls = { cmds: {}, init: null, unmount: null, removed: [] };
  global.acode = { setPluginInit: (id, f) => { calls.init = f; }, setPluginUnmount: (id, f) => { calls.unmount = f; }, require: () => undefined, addIcon() {} };
  global.editorManager = { editor: { commands: { addCommand: c => { calls.cmds[c.name] = c; }, removeCommand: n => { calls.removed.push(n); delete calls.cmds[n]; } } } };
  const store = {}; global.localStorage = { getItem: k => store[k] || null, setItem: (k, v) => { store[k] = v; } };
  delete require.cache[require.resolve('../main.js')]; require('../main.js');
  assert.ok(calls.init && calls.unmount); await calls.init('file:///x/', {}, {});
  assert.ok(calls.cmds['sevicon-open']); calls.unmount(); assert.deepStrictEqual(calls.removed, ['sevicon-open']);
  delete global.acode; delete global.editorManager; delete global.localStorage;
});
(async () => {
  for (const [n, f] of queue) { try { await f(); pass++; console.log('PASS  ' + n); } catch (e) { fail++; console.log('FAIL  ' + n + '\n      ' + (e.stack || e).toString().split('\n').slice(0, 3).join('\n      ')); } }
  console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
