// Utilitários puros: texto, similaridade, datas, números, hash e relógio.
(typeof module === 'object' ? require('../modulo') : C3BModulo)('core/util', [], () => {
  'use strict';

  // ---------- relógio (injetável nos testes) ----------
  const relogio = { agora: () => new Date() };
  const agoraISO = () => relogio.agora().toISOString();
  const carimbo = (d = relogio.agora()) => d.toISOString().replace(/[-:T]/g, '').slice(0, 14).replace(/(\d{8})(\d{6})/, '$1_$2'); // 20260927_182230

  // ---------- texto ----------
  const CJK = /[㐀-鿿豈-﫿]/;
  // minúsculas, sem acento, sem pontuação, espaços simples (preserva chinês)
  function dobrar(s) {
    return String(s == null ? '' : s)
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[º°ª]/g, ' ')
      .replace(/[^a-z0-9㐀-鿿豈-﫿]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  const tokens = s => dobrar(s).split(' ').filter(Boolean);
  const vazio = v => v == null || (typeof v === 'string' && v.trim() === '');

  function levenshtein(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    let ant = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const at = [i];
      for (let j = 1; j <= b.length; j++)
        at[j] = Math.min(ant[j] + 1, at[j - 1] + 1, ant[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      ant = at;
    }
    return ant[b.length];
  }
  function jaroWinkler(a, b) {
    if (a === b) return 1;
    if (!a || !b) return 0;
    const dist = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
    const ma = new Array(a.length).fill(false), mb = new Array(b.length).fill(false);
    let m = 0;
    for (let i = 0; i < a.length; i++)
      for (let j = Math.max(0, i - dist); j < Math.min(b.length, i + dist + 1); j++)
        if (!mb[j] && a[i] === b[j]) { ma[i] = mb[j] = true; m++; break; }
    if (!m) return 0;
    let t = 0, k = 0;
    for (let i = 0; i < a.length; i++) if (ma[i]) { while (!mb[k]) k++; if (a[i] !== b[k]) t++; k++; }
    const jaro = (m / a.length + m / b.length + (m - t / 2) / m) / 3;
    let p = 0; while (p < 4 && a[p] === b[p]) p++;
    return jaro + p * 0.1 * (1 - jaro);
  }
  // 0..1: combina Jaro-Winkler, Levenshtein e sobreposição de palavras (ordem não importa)
  function similaridade(x, y) {
    const a = dobrar(x), b = dobrar(y);
    if (!a || !b) return 0;
    if (a === b) return 1;
    const lev = 1 - levenshtein(a, b) / Math.max(a.length, b.length);
    const ta = new Set(a.split(' ')), tb = new Set(b.split(' '));
    const inter = [...ta].filter(t => tb.has(t)).length;
    const dice = (2 * inter) / (ta.size + tb.size);
    const semEspaco = a.replace(/ /g, '') === b.replace(/ /g, '') ? 1 : 0;
    return Math.max(jaroWinkler(a, b) * 0.9, lev, dice, semEspaco);
  }

  // ---------- valores de célula ----------
  // Converte o que vem do ExcelJS (richText, fórmula, hyperlink, erro) em valor simples. Nunca executa nada.
  function valorCelula(v) {
    if (v == null) return null;
    if (v instanceof Date) return v;
    if (typeof v === 'object') {
      if (Array.isArray(v.richText)) return v.richText.map(r => r.text).join('');
      if ('formula' in v || 'sharedFormula' in v) return valorCelula(v.result === undefined ? null : v.result);
      if ('hyperlink' in v) return v.text != null ? valorCelula(v.text) : v.hyperlink;
      if ('error' in v) return null;
      if ('text' in v) return v.text;
      return null;
    }
    return v;
  }
  const texto = v => { const x = valorCelula(v); return x == null ? '' : x instanceof Date ? x.toISOString() : String(x).trim(); };

  // ---------- números ----------
  // "25 N·m", "25,5", "1.234,5" → número; guarda a unidade. Vazio → null (nunca 0).
  function parseNumero(v) {
    const x = valorCelula(v);
    if (x == null || x === '') return { valor: null, status: 'VAZIO' };
    if (typeof x === 'number') return { valor: x, status: 'OK' };
    const s = String(x).trim();
    const m = s.match(/^[^\d-]*(-?\d{1,3}(?:\.\d{3})+(?:,\d+)?|-?\d+(?:[.,]\d+)?)\s*(.*)$/);
    if (!m) return { valor: null, status: 'INVALIDO', original: s };
    let n = m[1];
    n = /\.\d{3}(,|$)/.test(n) && n.includes(',') ? n.replace(/\./g, '').replace(',', '.') : n.replace(',', '.');
    const valor = Number(n);
    if (!isFinite(valor)) return { valor: null, status: 'INVALIDO', original: s };
    return { valor, status: 'OK', unidade: m[2] ? m[2].trim() : '' };
  }

  // ---------- datas ----------
  const pad = n => String(n).padStart(2, '0');
  const iso = (a, m, d) => `${a}-${pad(m)}-${pad(d)}`;
  function dataValida(a, m, d) {
    if (m < 1 || m > 12 || d < 1 || d > 31) return false;
    const x = new Date(Date.UTC(a, m - 1, d));
    return x.getUTCFullYear() === a && x.getUTCMonth() === m - 1 && x.getUTCDate() === d;
  }
  const serialParaData = n => new Date(Math.round((n - 25569) * 86400000)); // base 1900 do Excel
  // Descobre se a coluna usa dia/mês ou mês/dia olhando valores que não deixam dúvida
  function formatoDatasColuna(valores) {
    let dmy = 0, mdy = 0;
    for (const v of valores) {
      const m = String(valorCelula(v) ?? '').trim().match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
      if (!m) continue;
      if (+m[1] > 12 && +m[2] <= 12) dmy++;
      else if (+m[2] > 12 && +m[1] <= 12) mdy++;
    }
    return dmy && !mdy ? 'DMY' : mdy && !dmy ? 'MDY' : dmy && mdy ? 'MISTO' : 'INDEFINIDO';
  }
  // Resultado: { valor: 'AAAA-MM-DD' | null, status: OK | VAZIO | AMBIGUO | INVALIDO, regra }
  // numeroEhData: só trata número como data serial do Excel quando o campo é de data.
  function parseData(v, { formatoColuna = 'INDEFINIDO', numeroEhData = true } = {}) {
    const x = valorCelula(v);
    if (x == null || x === '') return { valor: null, status: 'VAZIO' };
    if (x instanceof Date) {
      if (isNaN(x)) return { valor: null, status: 'INVALIDO', regra: 'DATE_INVALIDA' };
      return { valor: x.toISOString().slice(0, 10), status: 'OK', regra: 'DATE_WORKBOOK' };
    }
    if (typeof x === 'number') {
      if (numeroEhData && x > 20000 && x < 80000) return { valor: serialParaData(x).toISOString().slice(0, 10), status: 'OK', regra: 'EXCEL_SERIAL' };
      return { valor: null, status: 'INVALIDO', regra: 'NUMERO_NAO_E_DATA' };
    }
    const s = String(x).trim();
    let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ]\d{1,2}:\d{2}.*)?$/);
    if (m) return dataValida(+m[1], +m[2], +m[3]) ? { valor: iso(+m[1], +m[2], +m[3]), status: 'OK', regra: 'ISO' } : { valor: null, status: 'INVALIDO', regra: 'ISO' };
    m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})(?:\s+\d{1,2}:\d{2}.*)?$/);
    if (m) {
      let [p1, p2, a] = [+m[1], +m[2], +m[3]];
      if (m[3].length === 2) a += a < 70 ? 2000 : 1900;
      const podeDMY = dataValida(a, p2, p1), podeMDY = dataValida(a, p1, p2);
      if (formatoColuna === 'MDY' && podeMDY) return { valor: iso(a, p1, p2), status: 'OK', regra: 'MM/DD/AAAA (coluna)' };
      if (podeDMY && (!podeMDY || p1 === p2 || formatoColuna === 'DMY'))
        return { valor: iso(a, p2, p1), status: 'OK', regra: 'DD/MM/AAAA' };
      if (podeDMY && podeMDY) return { valor: iso(a, p2, p1), status: 'AMBIGUO', regra: 'DD/MM/AAAA (assumido)' };
      if (podeMDY) return { valor: iso(a, p1, p2), status: 'AMBIGUO', regra: 'MM/DD/AAAA (dia > 12)' };
      return { valor: null, status: 'INVALIDO', regra: 'DD/MM/AAAA' };
    }
    m = s.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日$/);
    if (m && dataValida(+m[1], +m[2], +m[3])) return { valor: iso(+m[1], +m[2], +m[3]), status: 'OK', regra: 'DATA_CHINESA' };
    return { valor: null, status: 'INVALIDO', regra: 'FORMATO_DESCONHECIDO' };
  }

  // ---------- hash ----------
  // FNV-1a de 64 bits em duas metades: estável e síncrono, para IDs determinísticos
  function hashCurto(s, tam = 10) {
    let h1 = 0x811c9dc5, h2 = 0x01000193 ^ 0x5bd1e995;
    const str = String(s);
    for (let i = 0; i < str.length; i++) {
      const c = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
      h2 = Math.imul(h2 ^ c, 0x5bd1e995) >>> 0;
    }
    return (h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0')).slice(0, tam).toUpperCase();
  }
  // SHA-256 do conteúdo do arquivo (navegador ou Node)
  async function sha256(dados) {
    const bytes = typeof dados === 'string' ? new TextEncoder().encode(dados) : dados instanceof ArrayBuffer ? new Uint8Array(dados) : dados;
    const c = (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.subtle) ? globalThis.crypto.subtle : null;
    if (c) {
      const h = await c.digest('SHA-256', bytes);
      return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('');
    }
    return require('crypto').createHash('sha256').update(bytes).digest('hex');
  }

  // ---------- nomes de arquivo seguros ----------
  // Sem barras, sem "..", sem caracteres proibidos no Windows; impede path traversal.
  function nomeSeguro(nome) {
    const s = String(nome || '').normalize('NFC')
      .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
      .replace(/^\.+/, '_')
      .replace(/\s+/g, ' ').trim()
      .slice(0, 180);
    if (!s || s === '.' || s === '..') throw new Error('Nome de arquivo inválido: ' + JSON.stringify(nome));
    return s;
  }
  function caminhoSeguro(...partes) {
    const segs = partes.flatMap(p => String(p).split(/[\\/]+/)).filter(p => p !== '' && p !== '.');
    if (segs.some(p => p === '..')) throw new Error('Caminho não permitido (contém ".."): ' + partes.join('/'));
    return segs.map(nomeSeguro).join('/');
  }

  // Pausa cooperativa: deixa a interface respirar entre lotes de linhas
  const respirar = () => new Promise(r => setTimeout(r, 0));
  class Cancelado extends Error { constructor() { super('Processamento cancelado pelo usuário.'); this.name = 'Cancelado'; } }
  function tokenCancelamento() {
    const t = { cancelado: false, cancelar() { t.cancelado = true; }, verificar() { if (t.cancelado) throw new Cancelado(); } };
    return t;
  }

  return {
    relogio, agoraISO, carimbo, CJK, dobrar, tokens, vazio, levenshtein, jaroWinkler, similaridade,
    valorCelula, texto, parseNumero, parseData, formatoDatasColuna, serialParaData, hashCurto, sha256,
    nomeSeguro, caminhoSeguro, respirar, Cancelado, tokenCancelamento,
  };
}, typeof module === 'object' ? module : null);
