// Copia a biblioteca ExcelJS (versão do package.json) para vendor/, usada pela página no navegador.
const fs = require('fs'), path = require('path');
const raiz = path.join(__dirname, '..');
fs.mkdirSync(path.join(raiz, 'vendor'), { recursive: true });
fs.copyFileSync(path.join(raiz, 'node_modules/exceljs/dist/exceljs.min.js'), path.join(raiz, 'vendor/exceljs.min.js'));
fs.copyFileSync(path.join(raiz, 'node_modules/exceljs/LICENSE'), path.join(raiz, 'vendor/EXCELJS-LICENSE'));
console.log('vendor/exceljs.min.js atualizado');
