// Carregador mínimo de módulos: o mesmo arquivo roda no navegador (script comum, sem build,
// funciona até abrindo o HTML direto do disco) e no Node (require), onde rodam os testes.
// Cabeçalho de cada módulo:
//   (typeof module === 'object' ? require('../modulo') : C3BModulo)('core/nome', ['core/dep'], (dep) => api,
//     typeof module === 'object' ? module : null);
(function (raiz) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    const path = require('path');
    module.exports = function registrar(nome, deps, fabrica, mod) {
      const api = fabrica(...deps.map(d => require(path.join(__dirname, d + '.js'))));
      if (mod) mod.exports = api;
      return api;
    };
    return;
  }
  const registro = raiz.C3B = raiz.C3B || {};
  raiz.C3BModulo = function (nome, deps, fabrica) {
    const faltando = deps.filter(d => !(d in registro));
    if (faltando.length) throw new Error(`Módulo ${nome}: carregue antes ${faltando.join(', ')}`);
    registro[nome] = fabrica(...deps.map(d => registro[d]));
    return registro[nome];
  };
})(typeof self !== 'undefined' ? self : globalThis);
