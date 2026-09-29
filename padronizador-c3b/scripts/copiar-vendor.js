// Copia as bibliotecas (versões do package.json) para vendor/, usadas pela página no navegador.
const fs = require('fs'), path = require('path');
const raiz = path.join(__dirname, '..');
fs.mkdirSync(path.join(raiz, 'vendor'), { recursive: true });
const copiar = (de, para) => fs.copyFileSync(path.join(raiz, de), path.join(raiz, para));
copiar('node_modules/exceljs/dist/exceljs.min.js', 'vendor/exceljs.min.js');
copiar('node_modules/exceljs/LICENSE', 'vendor/EXCELJS-LICENSE');
copiar('node_modules/jszip/dist/jszip.min.js', 'vendor/jszip.min.js');
copiar('node_modules/jszip/LICENSE.markdown', 'vendor/JSZIP-LICENSE.md');
console.log('vendor/ atualizado: exceljs.min.js, jszip.min.js');
