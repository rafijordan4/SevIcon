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
