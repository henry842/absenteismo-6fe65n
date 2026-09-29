// Geração dos arquivos Excel oficiais (.xlsx de verdade, via ExcelJS) e leitura/verificação deles.
// Cada base tem: aba de dados (cabeçalho técnico estável, rótulos pt/zh na nota do cabeçalho, tipos corretos,
// datas reais, filtro, painel congelado, larguras, listas de validação, colunas técnicas ocultas),
// aba _META (schema, versões, hash do conteúdo, origem da gravação) e aba DICIONARIO.
(typeof module === 'object' ? require('../modulo') : C3BModulo)('excel/escritor', ['core/util', 'core/dicionario'], (U, D) => {
  'use strict';

  const obterExcelJS = x => x || (typeof ExcelJS !== 'undefined' ? ExcelJS : require('exceljs'));
  const VERDE = 'FF0B5D3B', VERDE_CLARO = 'FFE5F6EE';
  const dataParaExcel = s => { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null; };

  // Hash do conteúdo (independe de estilos e de datas de gravação): serve para detectar alteração externa
  function hashConteudo(schemaId, registros) {
    const campos = D.camposSaida(schemaId).map(c => c.field_id).filter(f => !['updated_at', 'created_at'].includes(f));
    const linhas = registros.map(r => campos.map(f => r[f] ?? '').join('\u001f')).sort();
    return U.hashCurto(schemaId + '\u001e' + linhas.join('\u001e'), 16);
  }

  function valorParaCelula(campo, v) {
    if (v == null || v === '') return null;
    if (campo.data_type === 'data') return dataParaExcel(v) || String(v);
    if (campo.data_type === 'datahora') { const d = new Date(v); return isNaN(d) ? String(v) : d; }
    if (campo.data_type === 'numero') return typeof v === 'number' ? v : Number(v);
    return String(v); // matrícula, IDs e textos ficam como texto
  }

  function adicionarMeta(wb, meta) {
    const ws = wb.addWorksheet('_META');
    ws.columns = [{ header: 'chave', key: 'k', width: 26 }, { header: 'valor', key: 'v', width: 60 }];
    for (const [k, v] of Object.entries(meta)) ws.addRow({ k, v: v == null ? '' : String(v) });
    ws.getRow(1).font = { bold: true };
    return ws;
  }
  function adicionarDicionario(wb, schemaId) {
    const ws = wb.addWorksheet('DICIONARIO');
    ws.columns = [['field_id', 22], ['label_pt', 30], ['label_zh', 18], ['tipo', 12], ['obrigatorio', 12], ['recomendado', 13], ['valores_permitidos', 40], ['descricao', 70]]
      .map(([k, w]) => ({ header: k, key: k, width: w }));
    for (const c of D.camposSaida(schemaId)) ws.addRow({ field_id: c.field_id, label_pt: c.label_pt, label_zh: c.label_zh, tipo: c.data_type,
      obrigatorio: c.required ? 'SIM' : 'NAO', recomendado: c.recommended ? 'SIM' : 'NAO',
      valores_permitidos: c.allowed_values ? D.valoresEnum(c.allowed_values).map(x => x.codigo).join(', ') : '', descricao: c.description });
    estilizarCabecalho(ws.getRow(1));
    ws.views = [{ state: 'frozen', ySplit: 1 }];
  }
  function estilizarCabecalho(row) {
    row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: VERDE } };
    row.alignment = { vertical: 'middle' };
    row.height = 22;
  }

  // Aba de dados de um schema
  function adicionarDados(wb, schemaId, registros, { valoresEnum = {} } = {}) {
    const s = D.schema(schemaId), campos = D.camposSaida(schemaId);
    const ws = wb.addWorksheet(s.aba);
    ws.columns = campos.map(c => ({ header: c.field_id, key: c.field_id, hidden: !!c.tecnico,
      style: c.data_type === 'data' ? { numFmt: 'dd/mm/yyyy' } : c.data_type === 'datahora' ? { numFmt: 'dd/mm/yyyy hh:mm' } : c.data_type === 'numero' ? {} : { numFmt: '@' } }));
    for (const r of registros) ws.addRow(campos.map(c => valorParaCelula(c, r[c.field_id])));
    const cab = ws.getRow(1);
    estilizarCabecalho(cab);
    campos.forEach((c, i) => {
      cab.getCell(i + 1).note = { texts: [{ text: `${c.label_pt}\n${c.label_zh}${c.required ? '\nObrigatório' : ''}${c.description ? '\n' + c.description : ''}` }] };
      const maior = Math.max(c.field_id.length, ...registros.slice(0, 500).map(r => String(r[c.field_id] ?? '').length));
      ws.getColumn(i + 1).width = Math.min(60, Math.max(10, maior + 2));
      if (c.required) cab.getCell(i + 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF06452C' } };
    });
    ws.views = [{ state: 'frozen', ySplit: 1, xSplit: 1 }];
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: campos.length } };
    // Listas de validação nas colunas de valores permitidos (até 2000 linhas além dos dados)
    const ate = registros.length + 2000;
    campos.forEach((c, i) => {
      if (!c.allowed_values) return;
      const codigos = (valoresEnum[c.allowed_values] || D.valoresEnum(c.allowed_values)).map(x => x.codigo);
      const lista = codigos.join(',');
      if (lista.length > 250) return;
      const letra = ws.getColumn(i + 1).letter;
      ws.dataValidations.add(`${letra}2:${letra}${ate}`, { type: 'list', allowBlank: true, formulae: [`"${lista},UNKNOWN"`], showErrorMessage: true, errorStyle: 'warning', errorTitle: c.label_pt, error: `Use um destes: ${lista}` });
    });
    // Linhas zebradas leves para leitura do líder
    for (let r = 2; r <= registros.length + 1; r += 2) ws.getRow(r).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: VERDE_CLARO } };
    return ws;
  }

  // meta: { installation_id, data_version, import_batch_id, updated_by, change_id, sync_origin, restored_from }
  async function gerarBaseOficial(schemaId, registros, meta = {}, { ExcelJS: lib = null, valoresEnum = {} } = {}) {
    const s = D.schema(schemaId);
    if (schemaId === 'MANIFEST' || schemaId === 'CONFIG') throw new Error('Use gerarManifesto / gerarConfiguracoes para ' + schemaId);
    const wb = new (obterExcelJS(lib)).Workbook();
    wb.creator = D.SYSTEM_VERSION; wb.created = U.relogio.agora();
    adicionarDados(wb, schemaId, registros, { valoresEnum });
    adicionarMeta(wb, metaPadrao(s, registros.length, hashConteudo(schemaId, registros), meta));
    adicionarDicionario(wb, schemaId);
    wb.getWorksheet('_META').state = 'hidden';
    return new Uint8Array(await wb.xlsx.writeBuffer());
  }
  function metaPadrao(s, n, hash, meta) {
    return { base_id: s.id, base_numero: s.base, base_name: s.nome_pt, schema_id: s.id, schema_version: D.SCHEMA_VERSION, data_version: meta.data_version || 1,
      record_count: n, content_hash: hash, updated_at: U.agoraISO(), updated_by: meta.updated_by || 'padronizador', installation_id: meta.installation_id || '',
      import_batch_id: meta.import_batch_id || '', change_id: meta.change_id || `CHG-${U.hashCurto(s.id + hash + U.agoraISO(), 10)}`,
      sync_origin: meta.sync_origin || 'PADRONIZADOR', master_mode: s.master_mode, restored_from: meta.restored_from || '', system_version: D.SYSTEM_VERSION };
  }

  // Manifesto: dados da instalação + tabela de arquivos
  async function gerarManifesto(manifesto, arquivos, { ExcelJS: lib = null, data_version = 1 } = {}) {
    const wb = new (obterExcelJS(lib)).Workbook();
    const s = D.schema('MANIFEST');
    const ws = wb.addWorksheet('MANIFESTO');
    ws.columns = [{ header: 'campo', key: 'campo', width: 22 }, { header: 'rotulo', key: 'rotulo', width: 26 }, { header: 'valor', key: 'valor', width: 50 }];
    for (const c of s.campos) ws.addRow({ campo: c.field_id, rotulo: `${c.label_pt} / ${c.label_zh}`, valor: manifesto[c.field_id] ?? '' });
    estilizarCabecalho(ws.getRow(1)); ws.views = [{ state: 'frozen', ySplit: 1 }];
    const wa = wb.addWorksheet('ARQUIVOS');
    wa.columns = s.tabelaArquivos.map(k => ({ header: k, key: k, width: k === 'file_name' ? 42 : k === 'hash' ? 24 : 18 }));
    for (const a of arquivos) wa.addRow(Object.fromEntries(s.tabelaArquivos.map(k => [k, a[k] == null ? '' : typeof a[k] === 'boolean' ? (a[k] ? 'SIM' : 'NAO') : a[k]])));
    estilizarCabecalho(wa.getRow(1)); wa.views = [{ state: 'frozen', ySplit: 1 }];
    wa.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: s.tabelaArquivos.length } };
    const wn = wb.addWorksheet('NIVEIS');
    wn.columns = ['codigo', 'nome_pt', 'nome_zh', 'definicao_pt', 'definicao_zh'].map(k => ({ header: k, key: k, width: k.startsWith('def') ? 70 : 20 }));
    for (const n of D.NIVEIS) wn.addRow(n);
    estilizarCabecalho(wn.getRow(1));
    adicionarMeta(wb, metaPadrao(s, arquivos.length, U.hashCurto(JSON.stringify([manifesto.installation_id, arquivos.map(a => a.file_name + a.hash)]), 16), { data_version, installation_id: manifesto.installation_id })).state = 'hidden';
    return new Uint8Array(await wb.xlsx.writeBuffer());
  }

  // Configurações: uma aba por assunto (GERAL, MODELOS, TURNOS, SKILL_LEVELS, ALIASES, IMPORT_PROFILES...)
  async function gerarConfiguracoes(abas, { ExcelJS: lib = null, data_version = 1, installation_id = '' } = {}) {
    const wb = new (obterExcelJS(lib)).Workbook();
    const def = D.schema('CONFIG').abas;
    for (const [nome, colunas] of Object.entries(def)) {
      const ws = wb.addWorksheet(nome);
      ws.columns = colunas.map(k => ({ header: k, key: k, width: Math.max(14, k.length + 4), style: { numFmt: '@' } }));
      for (const linha of abas[nome] || []) ws.addRow(Object.fromEntries(colunas.map(k => [k, linha[k] == null ? '' : typeof linha[k] === 'object' ? JSON.stringify(linha[k]) : String(linha[k])])));
      estilizarCabecalho(ws.getRow(1)); ws.views = [{ state: 'frozen', ySplit: 1 }];
    }
    const conteudo = U.hashCurto(JSON.stringify(abas), 16);
    adicionarMeta(wb, metaPadrao(D.schema('CONFIG'), Object.values(abas).reduce((t, a) => t + (a || []).length, 0), conteudo, { data_version, installation_id })).state = 'hidden';
    return new Uint8Array(await wb.xlsx.writeBuffer());
  }

  // ---------- leitura dos arquivos oficiais ----------
  function valorLido(campo, v) {
    v = U.valorCelula(v);
    if (v == null || v === '') return null;
    if (campo && campo.data_type === 'data') return v instanceof Date ? v.toISOString().slice(0, 10) : String(v);
    if (campo && campo.data_type === 'datahora') return v instanceof Date ? v.toISOString() : String(v);
    if (campo && campo.data_type === 'numero') return typeof v === 'number' ? v : Number(v);
    return v instanceof Date ? v.toISOString() : String(v);
  }
  async function lerMeta(wb) {
    const ws = wb.getWorksheet('_META');
    if (!ws) return null;
    const meta = {};
    ws.eachRow((row, i) => { if (i > 1) meta[String(U.valorCelula(row.getCell(1).value))] = U.valorCelula(row.getCell(2).value) ?? ''; });
    return meta;
  }
  // Lê um arquivo oficial: descobre o schema pelo _META (não depende do nome do arquivo)
  async function lerArquivoOficial(bytes, { ExcelJS: lib = null } = {}) {
    const wb = new (obterExcelJS(lib)).Workbook();
    const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    await wb.xlsx.load(u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength));
    const meta = await lerMeta(wb);
    if (!meta || !meta.schema_id) return { reconhecido: false, abas: wb.worksheets.map(w => w.name) };
    const schemaId = meta.schema_id;
    if (schemaId === 'MANIFEST') return { reconhecido: true, schemaId, meta, ...lerManifesto(wb) };
    if (schemaId === 'CONFIG') return { reconhecido: true, schemaId, meta, abas: lerAbasConfig(wb) };
    const s = D.schema(schemaId);
    const ws = wb.getWorksheet(s.aba);
    if (!ws) return { reconhecido: true, schemaId, meta, erro: `Aba ${s.aba} não encontrada`, registros: [], cabecalhos: [] };
    const cabecalhos = [];
    ws.getRow(1).eachCell({ includeEmpty: true }, (c, i) => { cabecalhos[i - 1] = String(U.valorCelula(c.value) ?? ''); });
    const campos = cabecalhos.map(h => D.campo(schemaId, h));
    const registros = [];
    ws.eachRow((row, i) => {
      if (i === 1) return;
      const r = {}; let algum = false;
      cabecalhos.forEach((h, c) => { const v = valorLido(campos[c], row.getCell(c + 1).value); if (v != null) algum = true; r[h] = v; });
      if (algum) registros.push(r);
    });
    return { reconhecido: true, schemaId, meta, cabecalhos, registros };
  }
  function lerManifesto(wb) {
    const manifesto = {};
    const ws = wb.getWorksheet('MANIFESTO');
    if (ws) ws.eachRow((row, i) => { if (i > 1) manifesto[String(U.valorCelula(row.getCell(1).value))] = U.valorCelula(row.getCell(3).value) ?? ''; });
    const arquivos = [];
    const wa = wb.getWorksheet('ARQUIVOS');
    if (wa) {
      const cab = []; wa.getRow(1).eachCell((c, i) => { cab[i - 1] = String(U.valorCelula(c.value)); });
      wa.eachRow((row, i) => { if (i === 1) return; const a = {}; cab.forEach((k, c) => { a[k] = U.valorCelula(row.getCell(c + 1).value) ?? ''; }); arquivos.push(a); });
    }
    return { manifesto, arquivos };
  }
  function lerAbasConfig(wb) {
    const abas = {};
    for (const ws of wb.worksheets) {
      if (ws.name === '_META') continue;
      const cab = []; ws.getRow(1).eachCell((c, i) => { cab[i - 1] = String(U.valorCelula(c.value)); });
      abas[ws.name] = [];
      ws.eachRow((row, i) => { if (i === 1) return; const l = {}; cab.forEach((k, c) => { l[k] = U.valorCelula(row.getCell(c + 1).value) ?? ''; }); abas[ws.name].push(l); });
    }
    return abas;
  }

  // Reabre o arquivo gerado e confere cabeçalhos, quantidade, IDs e conteúdo campo a campo.
  async function verificarArquivo(bytes, schemaId, registrosEsperados, opcoes = {}) {
    const checks = [];
    const ok = (nome, cond, detalhe) => { checks.push({ nome, ok: !!cond, detalhe }); return !!cond; };
    let lido;
    try { lido = await lerArquivoOficial(bytes, opcoes); } catch (e) { ok('Reabrir o arquivo', false, e.message); return { ok: false, checks }; }
    ok('Reabrir o arquivo', true, `${bytes.length} bytes`);
    ok('Schema no _META', lido.reconhecido && lido.schemaId === schemaId, `${lido.schemaId || '(sem _META)'}`);
    if (schemaId === 'MANIFEST' || schemaId === 'CONFIG') return { ok: checks.every(c => c.ok), checks, lido };
    const esperado = D.camposSaida(schemaId).map(c => c.field_id);
    ok('Cabeçalhos', JSON.stringify(lido.cabecalhos) === JSON.stringify(esperado), lido.cabecalhos.join(','));
    ok('Quantidade de registros', lido.registros.length === registrosEsperados.length, `${lido.registros.length} de ${registrosEsperados.length}`);
    const chave = D.schema(schemaId).chave[0];
    const ids = lido.registros.map(r => r[chave]);
    ok('IDs preenchidos e únicos', ids.every(Boolean) && new Set(ids).size === ids.length, `${new Set(ids).size} IDs`);
    const esp = new Map(registrosEsperados.map(r => [r[chave], r]));
    const diferencas = [];
    for (const r of lido.registros) {
      const e = esp.get(r[chave]);
      if (!e) { diferencas.push(`${r[chave]} não esperado`); continue; }
      for (const f of esperado) {
        if (['updated_at', 'created_at'].includes(f)) continue;
        const a = e[f] == null || e[f] === '' ? null : String(e[f]), b = r[f] == null ? null : String(r[f]);
        if (a !== b && !(typeof e[f] === 'number' && Number(b) === e[f])) diferencas.push(`${r[chave]}.${f}: esperado ${a} lido ${b}`);
      }
      if (diferencas.length > 20) break;
    }
    ok('Conteúdo igual ao gerado', !diferencas.length, diferencas.slice(0, 5).join('; ') || 'todos os campos conferem');
    ok('Hash do conteúdo', lido.meta.content_hash === hashConteudo(schemaId, lido.registros), lido.meta.content_hash);
    return { ok: checks.every(c => c.ok), checks, lido };
  }

  return { gerarBaseOficial, gerarManifesto, gerarConfiguracoes, lerArquivoOficial, verificarArquivo, hashConteudo };
}, typeof module === 'object' ? module : null);
