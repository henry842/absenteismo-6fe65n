// Perfil da pessoa (Matriz BYD + Ajustes Manuais C3B). Nada aqui edita a base importada: cada mudança vira um
// ajuste (override) com valor original, novo valor, motivo, responsável e data — e pode ser desfeita.
//   🟢 Ajuste local: só corrige a Base Operacional/C3B.
//   🔵 Alteração oficial (nível/designação/remoção): também vira evento no Histórico oficial, pendente na Matriz.
(function () {
  'use strict';
  const { $, esc, S } = UI;
  const AJ = () => S.ajustes;
  const ROT_DES = { TITULAR: '○ Titular', EM_TREINAMENTO: '△ Em treinamento', FUTURO_TITULAR: '○△ Futuro titular', SEM_DESIGNACAO: 'Sem designação' };
  const ROT_NIV = { i: 'i · treinamento', I: 'I · independente', L: 'L · proficiente', U: 'U · orientação', NAO_IDENTIFICADO: 'não identificado', SEM_REGISTRO: 'sem registro' };
  const estadoDe = s => (s.pacote.config.ajustes = s.pacote.config.ajustes || AJ().novoEstado());
  const temInfo = x => !x.desconsiderado && (['i', 'I', 'L', 'U'].includes(x.skill_level) || x.assignment_status !== 'SEM_DESIGNACAO' || x.dates_raw || x.unrecognized_values);

  let ctx = null;   // { s, emp (employee_id de origem), forma }

  function abrir(s, emp) { ctx = { s, emp, forma: null }; desenhar(); }

  function desenhar() {
    const { s, emp } = ctx;
    const estado = estadoDe(s);
    const ef = AJ().aplicar(s.byd, estado);
    const p = ef.pessoas.find(x => x.source_employee_id === emp);
    if (!p) { UI.toast('Pessoa não encontrada.', true); return; }
    const habs = ef.registros.filter(x => x.source_employee_id === emp && (temInfo(x) || x.override_ids)).sort((a, b) => `${a.sheet}${a.station_code}`.localeCompare(`${b.sheet}${b.station_code}`));
    const ativosP = AJ().ativos(estado).filter(o => o.employee_id === emp);
    const aj = campo => ativosP.find(o => o.entity_type === 'PERSON' && o.field === campo);
    const campoHTML = (campo, rot) => {
      const o = aj(campo);
      const fonte = campo === 'nome' ? p.source_nome : campo === 'funcao' ? p.papel : campo === 'matricula' ? (s.byd.pessoas.find(x => x.employee_id === emp) || {}).matricula : null;
      return `<div style="margin:5px 0"><span style="color:#8fa39a;display:inline-block;width:92px">${rot}</span> <b>${esc(p[campo] ?? '—')}</b>
        ${o ? ` ${UI.tag('ajustado ' + o.override_id, 'info')} <small style="color:#8fa39a">fonte: ${esc(fonte ?? '—')}</small> <button class="btn sm fantasma" data-desfazer="${o.override_id}">Desfazer</button>` : ''}</div>`;
    };
    const cartao = x => {
      const ids = (x.override_ids || '').split(',').filter(Boolean);
      const orig = x.origem_efetiva === 'AJUSTE' ? 'Ajuste manual' : x.origem_efetiva === 'MATRIZ+AJUSTE' ? `Matriz ${x.sheet} + ajuste` : `Matriz ${x.sheet}`;
      const pendOficial = estadoDe(ctx.s).historico_oficial.some(h => ids.includes(h.override_id) && h.status_matriz === 'PENDENTE_NA_MATRIZ');
      const mudou = ids.length && (x.source_skill_level !== x.skill_level || x.source_assignment_status !== x.assignment_status || x.desconsiderado || x.source_operation_id !== x.operation_id);
      return `<div class="parDup" style="${x.desconsiderado ? 'opacity:.7;border-style:dashed' : ''}"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap">
        <div><b>${esc(x.model_id)} • ${esc(x.station_code || x.operation_id)}</b> <span style="color:#8fa39a">${esc(x.descricao_pt || '')}</span>
          <div style="margin-top:4px">Nível: <b>${esc(ROT_NIV[x.skill_level] || x.skill_level)}</b> · Designação: <b>${esc(ROT_DES[x.assignment_status] || x.assignment_status)}</b>${x.desconsiderado ? ' ' + UI.tag('desconsiderado no C3B', 'aviso') : ''}${pendOficial ? ' ' + UI.tag('🔵 oficial · pendente na Matriz', 'info') : ''}${x.observacao ? `<div style="color:#b6c6bf">Obs.: ${esc(x.observacao)}</div>` : ''}</div>
          ${mudou ? `<div style="font-size:11px;margin-top:3px;color:#ffd66e">Fonte original: ${esc(x.source_skill_level)} / ${esc(x.source_assignment_status)}${x.source_operation_id && x.source_operation_id !== x.operation_id ? ` em ${esc(x.source_operation_id)}` : ''} · Ajuste: ${esc(ids.join(', '))} · Valor efetivo no C3B: ${esc(x.skill_level)} / ${esc(x.assignment_status)}</div>` : ''}
          <div style="font-size:11px;color:#8fa39a">Origem: ${esc(orig)} · Última atualização: ${esc(x.ultima_atualizacao || '—')}</div></div>
        <div class="btnRow" style="margin:0;align-self:flex-start"><button class="btn sm" data-hab="corrigir" data-op="${esc(x.operation_id)}">Corrigir</button>
          ${!x.desconsiderado ? `<button class="btn sm aviso" data-hab="remover" data-op="${esc(x.operation_id)}">Remover do C3B</button>` : ''}
          ${x.source_block ? `<button class="btn sm fantasma" data-hab="matriz" data-op="${esc(x.operation_id)}">Ver na Matriz</button>` : ''}
          <button class="btn sm fantasma" data-hab="historico" data-op="${esc(x.operation_id)}">Ver histórico</button></div></div></div>`;
    };
    UI.modal(`<h3 style="margin-bottom:2px">${esc(p.nome)}</h3>
      <div class="mono" style="color:#8fa39a">${esc(p.employee_id)}${p.employee_id !== p.source_employee_id ? ` (origem ${esc(p.source_employee_id)})` : ''} · ${esc(p.abas)}${p.nomes_na_matriz && p.nomes_na_matriz.includes('|') ? ` · na Matriz: ${esc(p.nomes_na_matriz)}` : ''}</div>
      <div class="grid2" style="margin-top:10px"><div>${campoHTML('matricula', 'Matrícula')}${campoHTML('funcao', 'Função')}${campoHTML('turno', 'Turno')}${campoHTML('status', 'Status')}</div>
        <div>${campoHTML('nome', 'Nome')}${campoHTML('observacao', 'Observação')}${p.configuracao_pendente ? `<div style="font-size:11px;color:#ffd66e;margin-top:6px">Na Matriz faltava: ${esc(p.configuracao_pendente)}</div>` : ''}</div></div>
      <div class="btnRow" style="flex-wrap:wrap"><button class="btn sm" data-acao="editarPessoa">Editar pessoa</button><button class="btn sm primary" data-acao="adicionarHab">+ Adicionar habilidade</button>
        <button class="btn sm" data-acao="designacao">Alterar designação</button><button class="btn sm" data-acao="observacao">Adicionar observação</button><button class="btn sm fantasma" data-acao="historico">Histórico de alterações</button></div>
      <div id="perfilForm">${ctx.forma ? ctx.forma.html : ''}</div>
      <h3 style="margin-top:12px">Habilidades (${habs.filter(x => !x.desconsiderado).length})</h3>
      <div style="max-height:46vh;overflow:auto">${habs.map(cartao).join('') || UI.vazio('Sem habilidades registradas.')}</div>
      <small style="color:#8fa39a">Ajustes não alteram a Matriz nem apagam a origem: ficam em AJUSTES_MANUAIS e são reaplicados a cada leitura da Matriz.</small>
      <div class="modalActions"><button class="btn" data-fechar>Fechar</button></div>`, (box, fechar) => {
      box.querySelectorAll('[data-fechar]').forEach(b => b.onclick = () => { ctx = null; fechar(); UI.telas.importacao.render(); });
      box.querySelectorAll('[data-desfazer]').forEach(b => b.onclick = () => desfazer(b.dataset.desfazer));
      box.querySelectorAll('[data-acao]').forEach(b => b.onclick = () => abrirForma(b.dataset.acao, null, ef, p));
      box.querySelectorAll('[data-hab]').forEach(b => b.onclick = () => acaoHabilidade(b.dataset.hab, b.dataset.op, ef));
      if (ctx.forma && ctx.forma.ligar) ctx.forma.ligar(box);
    });
  }

  const opcoes = (lista, sel) => lista.map(([v, t]) => `<option value="${esc(v)}" ${v === sel ? 'selected' : ''}>${esc(t)}</option>`).join('');
  const motivoHTML = '<label class="campo"><b>Motivo (obrigatório, fica registrado)</b><input class="input" id="fMotivo" placeholder="ex.: Registro incorreto / Avaliação corrigida"/></label>';
  const escopoHTML = `<label class="campo"><b>Tipo de mudança</b><select class="select" id="fEscopo"><option value="LOCAL">🟢 Ajuste local (só no C3B)</option><option value="OFICIAL">🔵 Alteração oficial (Histórico + Matriz oficial)</option></select></label>`;
  const operacoesOpc = () => opcoes(ctx.s.byd.operacoes.map(o => [o.operation_id, `${o.model_id} • ${o.station_code || '—'} · ${o.descricao_pt || o.descricao_zh || ''}`]));

  function abrirForma(tipo, op, ef, p) {
    const s = ctx.s, m = s.motor;
    const valoresEnum = en => m.valores(en).map(v => [v.codigo, `${v.pt} (${v.codigo})`]);
    let html = '', salvar;
    if (tipo === 'editarPessoa') {
      html = `<div class="linhaForm"><label class="campo"><b>Campo</b><select class="select" id="fCampo">${opcoes([['matricula', 'Matrícula'], ['funcao', 'Função'], ['turno', 'Turno'], ['status', 'Status'], ['nome', 'Nome']])}</select></label>
        <label class="campo"><b>Novo valor</b><span id="fValorBox"><input class="input" id="fValor"/></span></label>${motivoHTML}<button class="btn sm primary" id="fSalvar">Salvar ajuste</button><button class="btn sm fantasma" id="fCancelar">Cancelar</button></div>`;
      salvar = box => criar({ tipo: 'PESSOA', field: box.querySelector('#fCampo').value, new_value: box.querySelector('#fValor').value });
      ctx.forma = { html: `<div class="panel bloco" style="margin-top:8px">${html}</div>`, ligar: box => {
        const troca = () => { const c = box.querySelector('#fCampo').value, en = { funcao: 'FUNCAO', turno: 'TURNO', status: 'STATUS_PESSOA' }[c];
          box.querySelector('#fValorBox').innerHTML = en ? `<select class="select" id="fValor">${opcoes(valoresEnum(en), p[c])}</select>` : `<input class="input" id="fValor" value="${esc(p[c] ?? '')}"/>`; };
        box.querySelector('#fCampo').onchange = troca; troca(); ligarBotoes(box, salvar); } };
    } else if (tipo === 'observacao') {
      ctx.forma = { html: `<div class="panel bloco" style="margin-top:8px"><div class="linhaForm"><label class="campo" style="flex:1"><b>Observação da pessoa</b><input class="input" id="fValor" value="${esc(p.observacao || '')}"/></label>${motivoHTML}<button class="btn sm primary" id="fSalvar">Salvar</button><button class="btn sm fantasma" id="fCancelar">Cancelar</button></div></div>`,
        ligar: box => ligarBotoes(box, bx => criar({ tipo: 'PESSOA', field: 'observacao', new_value: bx.querySelector('#fValor').value })) };
    } else if (tipo === 'adicionarHab' || tipo === 'designacao' || tipo === 'corrigir') {
      const atual = op ? ef.registros.find(x => x.source_employee_id === ctx.emp && x.operation_id === op) : null;
      const opSel = op ? `<b>${esc(atual.model_id)} • ${esc(atual.station_code || op)}</b><input type="hidden" id="fOp" value="${esc(op)}"/>` : `<select class="select" id="fOp">${operacoesOpc()}</select>`;
      const campos = tipo === 'designacao' ? [['assignment_status', 'Designação']] : tipo === 'adicionarHab' ? [['skill_level', 'Nível'], ['assignment_status', 'Designação']]
        : [['skill_level', 'Nível'], ['assignment_status', 'Designação'], ['operation_id', 'Operação vinculada (corrigir)'], ['observacao', 'Observação']];
      ctx.forma = { html: `<div class="panel bloco" style="margin-top:8px"><div class="linhaForm"><label class="campo"><b>Operação</b>${opSel}</label>
        <label class="campo"><b>O que muda</b><select class="select" id="fCampo">${opcoes(campos)}</select></label><label class="campo"><b>Novo valor</b><span id="fValorBox"></span></label>
        ${escopoHTML}${motivoHTML}<button class="btn sm primary" id="fSalvar">Salvar</button><button class="btn sm fantasma" id="fCancelar">Cancelar</button></div>
        <small style="color:#8fa39a">🔵 Alteração oficial é para mudança real de certificação (ex.: I → L): registra no Histórico oficial e fica pendente até a Matriz oficial ser atualizada.</small></div>`,
        ligar: box => {
          const troca = () => {
            const c = box.querySelector('#fCampo').value;
            const cur = atual ? atual[c] : null;
            box.querySelector('#fValorBox').innerHTML = c === 'skill_level' ? `<select class="select" id="fValor">${opcoes(AJ().NIVEIS.map(n => [n, ROT_NIV[n]]), cur === 'NAO_IDENTIFICADO' || !cur ? 'L' : cur)}</select>`
              : c === 'assignment_status' ? `<select class="select" id="fValor">${opcoes(AJ().DESIGNACOES.map(n => [n, ROT_DES[n]]), cur || 'TITULAR')}</select>`
              : c === 'operation_id' ? `<select class="select" id="fValor">${operacoesOpc()}</select>` : `<input class="input" id="fValor" value="${esc(cur || '')}"/>`;
            const esc2 = box.querySelector('#fEscopo'); esc2.disabled = !['skill_level', 'assignment_status'].includes(c); if (esc2.disabled) esc2.value = 'LOCAL';
          };
          box.querySelector('#fCampo').onchange = troca; troca();
          ligarBotoes(box, bx => criar({ tipo: 'HABILIDADE', operation_id: bx.querySelector('#fOp').value, field: bx.querySelector('#fCampo').value, new_value: bx.querySelector('#fValor').value, scope: bx.querySelector('#fEscopo').value }));
        } };
    } else if (tipo === 'historico') {
      mostrarHistorico(null); return;
    }
    desenhar();
  }
  function ligarBotoes(box, salvar) {
    box.querySelector('#fCancelar').onclick = () => { ctx.forma = null; desenhar(); };
    box.querySelector('#fSalvar').onclick = () => salvar(box);
  }
  function criar(d) {
    const s = ctx.s;
    try {
      const reason = ($('#fMotivo') || {}).value;
      const o = AJ().criarAjuste(estadoDe(s), s.byd, { ...d, employee_id: ctx.emp, reason, created_by: UI.usuario() }, { motor: s.motor });
      UI.salvarProjeto();
      UI.toast(`${o.override_id}: ${o.scope === 'OFICIAL' ? 'alteração oficial registrada (pendente na Matriz)' : 'ajuste salvo'}.`);
      ctx.forma = null; desenhar();
    } catch (e) { aviso(e, 'Ajuste'); }
  }
  // Validação recusada (motivo vazio, nível inválido…) é mensagem para o usuário, não falha do sistema
  const aviso = (e, contexto) => (e instanceof TypeError || e instanceof ReferenceError ? UI.erro(e, contexto) : UI.toast(`${contexto}: ${e.message}`, true));
  function desfazer(id) {
    try { AJ().desfazer(estadoDe(ctx.s), id, { por: UI.usuario() }); UI.salvarProjeto(); UI.toast(`${id} desfeito: volta a valer o valor anterior.`); desenhar(); }
    catch (e) { UI.erro(e, 'Desfazer'); }
  }

  function acaoHabilidade(acao, op, ef) {
    const x = ef.registros.find(r => r.source_employee_id === ctx.emp && r.operation_id === op);
    if (acao === 'corrigir') return abrirForma('corrigir', op, ef);
    if (acao === 'historico') return mostrarHistorico(op);
    if (acao === 'matriz') {
      const origem = ctx.s.byd.origem.filter(o => o.employee_id === x.source_employee_id && o.operation_id === (x.source_operation_id || op) && !['OPERATOR_NAME', 'OPERATION_LABEL'].includes(o.purpose));
      ctx.forma = { html: `<div class="panel bloco" style="margin-top:8px"><b>Na Matriz oficial</b><div class="mono" style="font-size:11px;margin-top:6px">Bloco: ${esc(x.source_block)}<br>Marcador de nível: ${esc(x.source_l_cell || '—')} (valor "${esc(x.l_marker_raw ?? 'vazio')}")<br>
        ○: ${esc(x.source_circle_anchor || '—')}<br>△: ${esc(x.source_triangle_anchor || '—')}<br>Datas: ${esc(x.dates_raw || '—')}</div>
        <div style="font-size:11px;margin-top:6px">${origem.map(o => `${esc(o.purpose)} · ${esc(o.cell || o.anchor_a1 || '')}${o.dedup ? ' (duplicata)' : ''}`).join('<br>')}</div>
        <button class="btn sm fantasma" id="fCancelar">Fechar</button></div>`, ligar: box => { box.querySelector('#fCancelar').onclick = () => { ctx.forma = null; desenhar(); }; } };
      return desenhar();
    }
    if (acao === 'remover') {
      ctx.forma = { html: `<div class="panel bloco" style="margin-top:8px;border-color:#7a6320"><b>${x.source_block ? 'Este registro veio da Matriz oficial.' : 'Este registro foi criado por ajuste.'}</b> Deseja:
        <div style="margin:8px 0"><label style="display:block"><input type="radio" name="fRem" value="LOCAL" checked/> Desconsiderar somente no C3B</label>
        ${x.source_block ? '<label style="display:block"><input type="radio" name="fRem" value="OFICIAL"/> Corrigir também na Matriz oficial (vira alteração oficial pendente)</label>' : ''}</div>
        ${motivoHTML}<div class="btnRow"><button class="btn sm aviso" id="fSalvar">Remover do C3B</button><button class="btn sm fantasma" id="fCancelar">Cancelar</button></div>
        <small style="color:#8fa39a">Nada é apagado: a origem continua registrada e o ajuste pode ser desfeito.</small></div>`,
        ligar: box => ligarBotoes(box, bx => criar({ tipo: 'HABILIDADE', operation_id: op, field: 'registro', scope: bx.querySelector('input[name="fRem"]:checked').value })) };
      return desenhar();
    }
  }

  function mostrarHistorico(op) {
    const estado = estadoDe(ctx.s);
    const log = AJ().historico(estado, ctx.emp).filter(l => !op || l.operation_id === op).slice().reverse();
    const ativos = new Set(AJ().ativos(estado).map(o => o.override_id));
    const hof = estado.historico_oficial.filter(h => h.employee_id === ctx.emp && (!op || h.operation_id === op));
    ctx.forma = { html: `<div class="panel bloco" style="margin-top:8px"><b>Histórico de alterações${op ? ' · ' + esc(op) : ''}</b>
      ${log.length ? log.map(l => `<div class="issue ${l.evento === 'CRIADO' ? 'INFO' : 'WARNING'}"><b>${esc(UI.dataHora(l.em))}</b> · ${esc(l.evento)} · ${esc(l.field)}${l.operation_id ? ' · ' + esc(l.operation_id) : ''}: ${esc(l.de ?? '—')} → ${esc(l.para ?? '—')} · ${esc(l.por)}${l.scope === 'OFICIAL' ? ' ' + UI.tag('oficial', 'info') : ''}
        <small>${esc(l.override_id)}${l.motivo ? ' · ' + esc(l.motivo) : ''}</small>${l.evento === 'CRIADO' && ativos.has(l.override_id) ? ` <button class="btn sm fantasma" data-desfazer="${l.override_id}">Desfazer</button>` : ''}</div>`).join('') : '<div style="color:#8fa39a">Nenhuma alteração ainda.</div>'}
      ${hof.length ? `<b style="display:block;margin-top:8px">Histórico oficial</b>${hof.map(h => `<div class="issue INFO">${esc(h.event_id)} · ${esc(h.event_type)} · ${esc(h.previous_value ?? '—')} → ${esc(h.new_value ?? '—')} · ${esc(h.status_matriz)}<small>${esc(h.alvo_matriz || '')}</small></div>`).join('')}` : ''}
      <button class="btn sm fantasma" id="fCancelar">Fechar</button></div>`, ligar: box => { box.querySelector('#fCancelar').onclick = () => { ctx.forma = null; desenhar(); }; } };
    desenhar();
  }

  UI.perfilBYD = { abrir };
})();
