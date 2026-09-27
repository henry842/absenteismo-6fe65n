// Tela Normalização: de/para real (valor original → valor padrão C3B) tirado do log de transformações.
// Cada decisão (Confirmar, Corrigir, Ignorar, Criar alias) muda os dados: a aba é reprocessada na hora.
// Também mostra os pares de operações parecidas (decisão humana) e as linhas ignoradas.
(function () {
  'use strict';
  const { $, $$, esc, num, S, D, U } = UI;
  const REL = () => S.relatorios;
  const filtro = { aba: '', campo: '', texto: '' };

  // Campo do log → campo onde a decisão é aplicada na normalização
  const campoDecisao = (schema, campo) => (schema === 'OPERATIONS' && campo === 'model_id' ? 'modelo' : campo);

  function pessoasDisponiveis(s) {
    const daSessao = Object.values(s.trabalhos).filter(t => t.schema === 'PEOPLE' && t.resultado).flatMap(t => t.resultado.oficiais).filter(p => p.employee_id);
    const m = new Map(s.pacote.bases.PEOPLE.concat(daSessao).map(p => [p.employee_id, p]));
    return [...m.values()].sort((a, b) => String(a.nome).localeCompare(String(b.nome)));
  }
  function operacoesDisponiveis(s) {
    const daSessao = Object.values(s.trabalhos).filter(t => t.schema === 'OPERATIONS' && t.resultado).flatMap(t => t.resultado.oficiais).filter(o => o.operation_id);
    const m = new Map(s.pacote.bases.OPERATIONS.concat(daSessao).map(o => [o.operation_id, o]));
    return [...m.values()].sort((a, b) => a.operation_id.localeCompare(b.operation_id));
  }

  // Valor que "Confirmar" aplicaria: a interpretação feita (nunca UNKNOWN) ou a sugestão por similaridade
  const sugerido = g => (g.sugerido && g.sugerido !== 'UNKNOWN' ? g.sugerido : g.sugestao || null);

  // Controle de correção conforme o tipo do campo
  function controle(s, t, g, i) {
    const campo = campoDecisao(t.schema, g.campo);
    const c = D.campo(t.schema, campo);
    const atual = sugerido(g) || '';
    if (g.campo === 'employee_id') return `<select class="select corr" data-i="${i}"><option value="">— escolha a pessoa —</option>${pessoasDisponiveis(s).map(p => `<option value="${esc(p.employee_id)}">${esc(p.nome)} · ${esc(p.matricula)}</option>`).join('')}</select>`;
    if (g.campo === 'operation_id') return `<select class="select corr" data-i="${i}"><option value="">— escolha a operação —</option>${operacoesDisponiveis(s).map(o => `<option value="${esc(o.operation_id)}" ${o.operation_id === g.sugestao ? 'selected' : ''}>${esc(o.operation_id)} · ${esc(o.descricao_pt || o.descricao_zh || '')}</option>`).join('')}</select>`;
    if (campo === 'modelo') return `<select class="select corr" data-i="${i}"><option value="">— modelo —</option>${s.motor.modelos().map(m => `<option value="${esc(m.model_id)}">${esc(m.model_id)}</option>`).join('')}</select>`;
    if (c && c.allowed_values) return `<select class="select corr" data-i="${i}"><option value="">— valor oficial —</option>${s.motor.valores(c.allowed_values).map(v => `<option value="${esc(v.codigo)}" ${v.codigo === (g.sugestao || atual) ? 'selected' : ''}>${esc(v.codigo)} · ${esc(v.pt)}</option>`).join('')}</select>`;
    const ph = c && c.data_type === 'data' ? 'AAAA-MM-DD' : c && c.data_type === 'numero' ? 'número' : campo === 'estacao' ? 'ex.: C20L1' : 'valor correto';
    return `<input class="input corr" data-i="${i}" placeholder="${ph}" value="${esc(c && c.data_type === 'data' ? atual : '')}" style="width:150px"/>`;
  }

  function grupos(s) {
    const lista = [];
    for (const t of Object.values(s.trabalhos)) {
      if (!t.resultado) continue;
      const log = t.resultado.log.map(l => ({ aba: t.aba, ...l }));
      for (const g of REL().naoReconhecidos(log)) {
        const detalhe = t.resultado.registros.find(r => r._linha === g.linhas[0]);
        const d = detalhe && detalhe.detalhes[g.campo];
        lista.push({ ...g, schema: t.schema, sugestao: d && (d.sugestao || null), candidatos: d && d.candidatos });
      }
    }
    return lista;
  }
  function conversoes(s) {
    const g = new Map();
    for (const t of Object.values(s.trabalhos)) {
      if (!t.resultado) continue;
      for (const l of t.resultado.log) {
        if (l.status !== 'OK' || l.original_value == null || String(l.original_value) === String(l.normalized_value)) continue;
        const k = `${t.aba}|${l.field}|${l.original_value}|${l.normalized_value}`;
        if (!g.has(k)) g.set(k, { aba: t.aba, campo: l.field, original: l.original_value, novo: l.normalized_value, regra: l.rule, confianca: l.confidence, decisao: l.decision, n: 0 });
        g.get(k).n++;
      }
    }
    return [...g.values()].sort((a, b) => b.n - a.n);
  }

  function render() {
    const el = $('#telaNormalizacao');
    const s = UI.estado.sessao;
    const head = `<div class="telaHead"><div><h2>3. Normalização <small>数据标准化 · de/para</small></h2>
      <div class="sub">Aqui aparece tudo o que o Padronizador <b>não</b> conseguiu decidir sozinho. Valores não reconhecidos ficam UNKNOWN ou vazios até você decidir: confirmar a sugestão, corrigir, ignorar ou criar um alias (regra que vale para as próximas importações).</div></div></div>`;
    const processados = s ? Object.values(s.trabalhos).filter(t => t.resultado) : [];
    if (!s || !processados.length) { el.innerHTML = head + `<div class="panel bloco">${UI.vazio('Nada normalizado ainda.', 'Confira o Mapeamento e clique em "Normalizar e validar".')}</div>`; return; }
    const todos = grupos(s);
    const lista = todos.filter(g => (!filtro.aba || g.aba === filtro.aba) && (!filtro.campo || g.campo === filtro.campo) && (!filtro.texto || U.dobrar(g.original).includes(U.dobrar(filtro.texto))));
    const conv = conversoes(s);
    const dups = processados.filter(t => t.resultado.duplicidades && t.resultado.duplicidades.length);
    const ign = processados.flatMap(t => t.resultado.ignoradas.map(i => ({ aba: t.aba, ...i })));
    const campos = [...new Set(todos.map(g => g.campo))];
    UI.estado.gruposDepara = lista;
    el.innerHTML = head + `
      <div class="grid4" style="margin-bottom:12px">
        <div class="panel bloco"><h3>${num(processados.reduce((t, x) => t + x.resultado.registros.length, 0))}</h3><small>registros normalizados em ${processados.length} aba(s)</small></div>
        <div class="panel bloco"><h3 style="color:${todos.length ? '#ffd66e' : '#5cff9e'}">${num(todos.length)}</h3><small>valores para decidir (${num(todos.reduce((t, g) => t + g.ocorrencias, 0))} ocorrências)</small></div>
        <div class="panel bloco"><h3>${num(conv.reduce((t, c) => t + c.n, 0))}</h3><small>conversões automáticas (${num(conv.length)} regras aplicadas)</small></div>
        <div class="panel bloco"><h3 style="color:${dups.length ? '#ffd66e' : '#5cff9e'}">${num(dups.reduce((t, x) => t + x.resultado.duplicidades.length, 0))}</h3><small>pares de operações parecidas</small></div>
      </div>
      <div class="panel bloco"><h3>Valores a decidir<small>待确认的值 · original → padrão C3B</small></h3>
        <div class="linhaForm">
          <label class="campo"><b>Aba</b><select class="select" id="fAba"><option value="">todas</option>${processados.map(t => `<option ${filtro.aba === t.aba ? 'selected' : ''}>${esc(t.aba)}</option>`).join('')}</select></label>
          <label class="campo"><b>Campo</b><select class="select" id="fCampo"><option value="">todos</option>${campos.map(c => `<option ${filtro.campo === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
          <label class="campo"><b>Procurar valor</b><input class="input" id="fTexto" value="${esc(filtro.texto)}"/></label>
          <button class="btn sm" id="expNaoRec">⇩ Exportar não reconhecidos (.xlsx)</button>
        </div>
        ${lista.length ? `<div class="tabelaWrap" style="max-height:560px">${lista.slice(0, 300).map((g, i) => linhaDepara(s, g, i)).join('')}</div>${lista.length > 300 ? `<small style="color:#8fa39a">Mostrando 300 de ${lista.length}. Use os filtros.</small>` : ''}`
          : UI.vazio(todos.length ? 'Nada com esse filtro.' : 'Nenhum valor pendente.', todos.length ? '' : 'Todos os valores foram reconhecidos ou decididos.')}
      </div>
      ${dups.length ? `<div class="panel bloco"><h3>Operações parecidas<small>疑似重复工序 · nunca unidas sozinhas</small></h3>${dups.map(t => t.resultado.duplicidades.map((p, i) => parHTML(t, p, i)).join('')).join('')}</div>` : ''}
      <div class="grid2">
        <div class="panel bloco"><h3>Conversões automáticas<small>自动转换 · para conferência</small></h3>
          ${conv.length ? `<div class="tabelaWrap" style="max-height:320px"><table class="table dados"><thead><tr><th>Aba</th><th>Campo</th><th>Original</th><th>Padrão C3B</th><th>Regra</th><th>Qtd</th></tr></thead><tbody>
            ${conv.slice(0, 200).map(c => `<tr><td>${esc(c.aba)}</td><td>${esc(c.campo)}</td><td class="mono">${esc(c.original)}</td><td class="mono" style="color:#7dffc0">${esc(c.novo)}</td><td class="mono">${esc(c.regra)}</td><td>${c.n}</td></tr>`).join('')}</tbody></table></div>` : UI.vazio('Nenhuma conversão.')}
        </div>
        <div class="panel bloco"><h3>Linhas ignoradas<small>忽略的行</small></h3>
          ${ign.filter(i => i.motivo !== 'linha vazia').length ? ign.filter(i => i.motivo !== 'linha vazia').slice(0, 100).map(i => `<div style="font-size:12px;margin:4px 0">${esc(i.aba)} · linha ${i.linha}: ${esc(i.motivo)}</div>`).join('') : '<div style="font-size:12px;color:#8fa39a">Nenhuma linha com dados foi ignorada.</div>'}
          <small style="color:#8fa39a">${num(ign.filter(i => i.motivo === 'linha vazia').length)} linha(s) vazia(s) puladas.</small>
        </div>
      </div>
      <div class="panel bloco"><h3>Resultado por aba<small>标准化结果预览</small></h3>${UI.abasTrabalho(s, 'normalizacao')}${previaRegistros(s)}</div>
      <div class="btnRow"><button class="btn" data-ir-tela="mapeamento">← Mapeamento</button><button class="btn" id="reprocessar">↻ Reprocessar todas as abas</button><button class="btn primary" data-ir-tela="validacao">Validação →</button></div>`;
    ligar(s);
  }

  function linhaDepara(s, g, i) {
    const t = s.trabalhos[g.aba];
    const valorConfirmar = sugerido(g);
    const podeConfirmar = !!valorConfirmar;
    const podeAlias = !['employee_id', 'operation_id', 'estacao'].includes(g.campo) && (() => { const c = D.campo(t.schema, campoDecisao(t.schema, g.campo)); return c && (c.allowed_values || c.field_id === 'modelo'); })();
    const status = { UNKNOWN: ['não reconhecido', 'aviso'], NAO_RESOLVIDO: ['sem correspondência', 'erro'], NAO_RESOLVIDO_PESSOA: ['pessoa não achada', 'erro'], AMBIGUO: ['ambíguo', 'aviso'], REVISAR: ['confirmar', 'aviso'] }[g.status] || [g.status, 'neutro'];
    return `<div class="depara" data-i="${i}">
      <div><span class="orig">${esc(g.original)}</span><div style="color:#8fa39a;font-size:10px">${esc(g.aba)} · ${esc(g.campo)} · ${g.ocorrencias}× · linhas ${esc(g.linhas.slice(0, 6).join(', '))}${g.linhas.length > 6 ? '…' : ''}</div></div>
      <div>→</div>
      <div>${podeConfirmar ? `<span class="novo">${esc(valorConfirmar)}</span> ${g.confianca != null ? UI.conf(g.confianca) : ''}` : '<span style="color:#ff8a8a">UNKNOWN / vazio</span>'}<div>${UI.tag(status[0], status[1])} <span class="so-implantador mono" style="color:#8fa39a">${esc(g.regra)}</span></div></div>
      <div>${controle(s, t, g, i)}</div>
      <div class="btnRow" style="margin:0;gap:5px">
        ${podeConfirmar ? `<button class="btn sm primary acaoDp" data-acao="CONFIRMAR" data-i="${i}">✓ Confirmar</button>` : ''}
        <button class="btn sm acaoDp" data-acao="CORRIGIR" data-i="${i}">Corrigir</button>
        <button class="btn sm fantasma acaoDp" data-acao="IGNORAR" data-i="${i}">Ignorar</button>
        ${podeAlias ? `<label style="font-size:11px;color:#9fb3aa;display:flex;gap:4px;align-items:center"><input type="checkbox" class="aliasDp" data-i="${i}"/> criar alias</label>` : ''}
      </div></div>`;
  }

  function parHTML(t, p, i) {
    const nomes = { modelo: 'Modelo', estacao: 'Estação', lado: 'Lado', posicao: 'Posição', codigo: 'Código', descricao: 'Descrição', caracteristicas: 'Torque / soquete' };
    const op = o => `<div style="font-size:12px"><b class="mono">${esc(o.operation_id || '(sem ID)')}</b>${o._existente ? ' ' + UI.tag('já no catálogo', 'info') : ''}<br>${esc(o.codigo_operacao || '—')} · ${esc(o.descricao_pt || '')} ${o.descricao_zh ? '· ' + esc(o.descricao_zh) : ''}<br><span style="color:#8fa39a">${esc(o.model_id)} ${esc(o.estacao)}${esc(o.lado || '')}${esc(o.posicao || '')} · torque ${o.torque ?? '—'} · soquete ${esc(o.soquete || '—')}</span></div>`;
    return `<div class="parDup"><div class="grid2">${op(p.a)}${op(p.b)}</div>
      <div style="margin:8px 0;font-size:13px">Similaridade geral: <b style="color:${p.geral >= 90 ? '#ffd66e' : '#cfe0d9'}">${p.geral}%</b>${p.bloqueios.length ? ` <span style="color:#8fa39a;font-size:11px">(limitada: ${esc(p.bloqueios.join(', '))})</span>` : ''}</div>
      ${Object.entries(p.componentes).filter(([, v]) => v != null).map(([k, v]) => `<div class="comp"><span>${nomes[k] || k}</span><div class="barra"><i style="width:${v}%"></i></div><b>${v}%</b></div>`).join('')}
      <div class="btnRow" style="margin-top:8px"><button class="btn sm primary dupAcao" data-aba="${esc(t.aba)}" data-i="${i}" data-escolha="MESMA">São a mesma operação</button>
        <button class="btn sm dupAcao" data-aba="${esc(t.aba)}" data-i="${i}" data-escolha="DIFERENTES">São diferentes</button>
        <button class="btn sm fantasma dupAcao" data-aba="${esc(t.aba)}" data-i="${i}" data-escolha="DEPOIS">Revisar depois</button></div></div>`;
  }

  function previaRegistros(s) {
    const t = s.trabalhos[UI.estado.abaAtiva] || Object.values(s.trabalhos).find(x => x.resultado);
    if (!t || !t.resultado) return UI.vazio('Esta aba ainda não foi processada.');
    const campos = D.camposSaida(t.schema).filter(c => !c.tecnico);
    const regs = t.resultado.oficiais.slice(0, 100);
    const cel = v => v == null ? '<span style="color:#56685f">—</span>' : v === 'UNKNOWN' ? '<span style="color:#ffd66e">UNKNOWN</span>' : esc(v);
    return `<div style="font-size:12px;color:#9fb3aa;margin-bottom:6px">${esc(t.aba)} → ${esc(UI.nomeSchema(t.schema))}: ${num(t.resultado.oficiais.length)} registro(s) · qualidade ${t.resultado.qualidade.nota ?? '—'}${t.resultado.qualidade.nota != null ? '%' : ''} · ${t.resultado.tempo_ms} ms</div>
      <div class="tabelaWrap" style="max-height:360px"><table class="table dados"><thead><tr><th>Linha</th>${campos.map(c => `<th title="${esc(c.field_id)}">${esc(c.label_pt)}</th>`).join('')}</tr></thead><tbody>
      ${regs.map((r, i) => `<tr><td>${t.resultado.registros[i] ? t.resultado.registros[i]._linha : ''}</td>${campos.map(c => `<td>${cel(r[c.field_id])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
      ${t.resultado.oficiais.length > 100 ? `<small style="color:#8fa39a">Mostrando 100 de ${num(t.resultado.oficiais.length)}.</small>` : ''}`;
  }

  // Reprocessa na ordem das bases (Cadastro antes das referências)
  async function reprocessar(s, abas = null) {
    const ordem = Object.values(s.trabalhos).filter(t => !abas || abas.includes(t.aba)).sort((a, b) => S.importacao.ORDEM.indexOf(a.schema) - S.importacao.ORDEM.indexOf(b.schema));
    for (const t of ordem) await S.importacao.processar(s, t.aba);
  }
  // Uma decisão na aba X pode mudar as referências das abas que dependem dela
  const dependentes = (s, aba) => {
    const schema = s.trabalhos[aba].schema;
    return Object.values(s.trabalhos).filter(t => t.aba === aba || (['PEOPLE', 'OPERATIONS'].includes(schema) && !['PEOPLE', 'OPERATIONS'].includes(t.schema))).map(t => t.aba);
  };

  function valorCorrigido(s, g, i) {
    const t = s.trabalhos[g.aba];
    const ctrl = $(`.corr[data-i="${i}"]`);
    const bruto = ctrl ? ctrl.value.trim() : '';
    if (!bruto) throw new Error('Escolha ou digite o valor correto antes de clicar em Corrigir.');
    const campo = campoDecisao(t.schema, g.campo);
    if (['employee_id', 'operation_id', 'modelo'].includes(campo)) return bruto;
    const c = D.campo(t.schema, campo);
    if (!c) return bruto;
    if (campo === 'estacao') {
      const e = C3B['core/parsers'].parseEstacao(bruto);
      if (!e.station_base) throw new Error(`"${bruto}" não é uma estação válida (ex.: C16L1, C18 FR1).`);
      return bruto;
    }
    if (c.allowed_values) return bruto;
    const n = C3B['core/normalizar'].normalizarValor(c, bruto, { motor: s.motor, formatoColuna: 'DMY' });
    if (n.status !== 'OK' || n.normalizado == null) throw new Error(`"${bruto}" não é válido para ${c.label_pt}${c.data_type === 'data' ? ' (use AAAA-MM-DD)' : ''}.`);
    return n.normalizado;
  }

  function ligar(s) {
    UI.ligarAbas('normalizacao');
    $$('[data-ir-tela]').forEach(b => b.onclick = () => UI.ir(b.dataset.irTela));
    $('#fAba').onchange = e => { filtro.aba = e.target.value; render(); };
    $('#fCampo').onchange = e => { filtro.campo = e.target.value; render(); };
    $('#fTexto').onchange = e => { filtro.texto = e.target.value; render(); };
    $('#expNaoRec').onclick = async () => {
      const linhas = UI.estado.gruposDepara.map(g => ({ aba: g.aba, campo: g.campo, original: g.original, motivo: `${g.status} (${g.regra})${g.sugestao ? ' · sugestão ' + g.sugestao : ''}`, ocorrencias: g.ocorrencias }));
      for (const t of Object.values(s.trabalhos)) for (const m of t.mapeamento) if (!m.campo) linhas.push({ aba: t.aba, campo: '(coluna)', original: m.cabecalho, motivo: m.decisao === 'NAO_UTILIZADO' ? `não utilizada (${m.tipoNaoUtilizado})` : 'coluna não mapeada', ocorrencias: '' });
      UI.baixar(await S.relatorios.exportarNaoMapeados(linhas, UI.opcoesExcel()), `NAO_MAPEADOS_${s.lote.import_batch_id}.xlsx`);
    };
    $$('.acaoDp').forEach(b => b.onclick = async () => {
      const i = +b.dataset.i, g = UI.estado.gruposDepara[i], acao = b.dataset.acao;
      const t = s.trabalhos[g.aba];
      try {
        const valor = acao === 'CONFIRMAR' ? sugerido(g) : acao === 'CORRIGIR' ? valorCorrigido(s, g, i) : null;
        const alias = !!($(`.aliasDp[data-i="${i}"]`) || {}).checked;
        const campo = campoDecisao(t.schema, g.campo);
        S.importacao.decidirValor(s, g.aba, campo, g.original, { acao, valor, criarAlias: alias && acao !== 'IGNORAR' });
        b.disabled = true;
        await reprocessar(s, dependentes(s, g.aba));
        UI.salvarProjeto();
        UI.toast(`${acao === 'IGNORAR' ? 'Ignorado' : acao === 'CONFIRMAR' ? 'Confirmado' : 'Corrigido'}: "${g.original}"${valor ? ' → ' + valor : ''} (${g.ocorrencias} ocorrência(s))${alias ? ' · alias criado' : ''}.`);
        render();
      } catch (e) { UI.erro(e, 'Decisão'); }
    });
    $$('.dupAcao').forEach(b => b.onclick = async () => {
      try {
        const r = S.importacao.decidirDuplicidade(s, b.dataset.aba, +b.dataset.i, b.dataset.escolha);
        if (b.dataset.escolha === 'MESMA') await reprocessar(s, dependentes(s, b.dataset.aba).filter(a => a !== b.dataset.aba));
        UI.salvarProjeto();
        UI.toast(b.dataset.escolha === 'MESMA' ? `Unificadas: ${r.removida} passa a usar ${r.mantida} (alias gravado).` : b.dataset.escolha === 'DIFERENTES' ? 'Registrado: são operações diferentes.' : 'Deixado para revisar depois.');
        render();
      } catch (e) { UI.erro(e, 'Duplicidade'); }
    });
    $('#reprocessar').onclick = async () => { try { await reprocessar(s); UI.toast('Abas reprocessadas.'); render(); } catch (e) { UI.erro(e, 'Reprocessar'); } };
  }

  UI.telas.normalizacao = { render, reprocessar };
})();
