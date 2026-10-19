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
if (typeof module !== 'undefined' && module.exports) module.exports = Zip;
