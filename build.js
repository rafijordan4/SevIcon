// Concatenates src/*.js into a single main.js (Acode loads one file). Run: node build.js
const fs = require('fs'), path = require('path');
const read = f => fs.readFileSync(path.join(__dirname, 'src', f), 'utf8').replace(/^if \(typeof module[^\n]*\n/gm, '');
const core = require('./src/core.js');
const out = '/* SevIcon ' + core.VERSION + ' - built by build.js from src/. Do not edit by hand. */\n(function () {\n' + ['zip.js', 'core.js', 'ui.js', 'entry.js'].map(read).join('\n') + '\n})();\n';
fs.writeFileSync(path.join(__dirname, 'main.js'), out);
fs.mkdirSync(path.join(__dirname, 'assets'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'assets/sevicon-logo.svg'), core.LOGO_SVG + '\n');
console.log('built main.js', out.length, 'bytes');
