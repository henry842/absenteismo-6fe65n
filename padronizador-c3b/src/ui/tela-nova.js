// Nova Implantação (sem planilha): implantação → pessoas → catálogo de operações → carga inicial da matriz
// → validar → gerar. Cada passo usa a mesma normalização/validação da importação (mesmas regras e log).
(function () {
  'use strict';
  const { $, $$, esc, num, S, D, U } = UI;
  const PASSOS = ['Implantação', 'Pessoas', 'Operações', 'Matriz inicial', 'Validar', 'Gerar'];
  const w = { passo: 0, linhasPessoas: [], linhasOps: [], sessao: null, marcaP: new Set(), marcaO: new Set() };

  const novaLinhaPessoa = () => ({ matricula: '', nome: '', funcao: 'OPERADOR_PRODUCAO', turno: (UI.pacote().manifesto.turno_padrao || ''), status: 'ATIVO', equipe: UI.pacote().manifesto.equipe || '' });
  const novaLinhaOp = () => ({ modelo: (UI.pacote().config.modelosExtras[0] || {}).model_id || '', estacao: '', lado: '', posicao: '', codigo_operacao: '', descricao_pt: '', descricao_zh: '', torque: '', takt_seconds: '' });

  function render() {
    const el = $('#telaNova');
    el.innerHTML = `<div class="telaHead"><div><h2>Nova Implantação <small>新建部署 · sem planilha</small></h2>
      <div class="sub">Para quem ainda não tem planilha: cadastre a equipe, o catálogo de operações e o nível atual de cada pessoa. Tudo passa pelas mesmas regras da importação e gera as bases oficiais no final.</div></div></div>
      <div class="passosWizard">${PASSOS.map((p, i) => `<span class="${i === w.passo ? 'ativo' : i < w.passo ? 'feito' : ''}" data-passo="${i}">${i < w.passo ? '✓ ' : ''}${i + 1}. ${p}</span>`).join('')}</div>
      <div class="panel bloco">${[passoImplantacao, passoPessoas, passoOperacoes, passoMatriz, passoValidar, passoGerar][w.passo]()}</div>`;
    ligar();
  }

  function passoImplantacao() {
    const m = UI.pacote().manifesto;
    const motor = S.importacao.motorDoPacote(UI.pacote());
    const escolhidos = new Set((UI.pacote().config.modelosExtras || []).map(x => x.model_id));
    return `<h3>1. Dados da implantação<small>部署信息</small></h3><div class="grid4">${[['empresa', 'Empresa *'], ['unidade', 'Unidade'], ['area', 'Área'], ['secao', 'Seção'], ['equipe', 'Equipe *'], ['lider', 'Líder'], ['supervisor', 'Supervisor']].map(([k, r]) => `<label class="campo"><b>${r}</b><input class="input wzMeta" data-k="${k}" value="${esc(m[k] || '')}"/></label>`).join('')}
      <label class="campo"><b>Turno padrão</b><select class="select wzMeta" data-k="turno_padrao"><option value="">—</option>${motor.valores('TURNO').map(t => `<option value="${t.codigo}" ${m.turno_padrao === t.codigo ? 'selected' : ''}>${esc(t.pt)}</option>`).join('')}</select></label></div>
      <h3 style="margin-top:14px">Modelos desta linha</h3><div class="btnRow">${D.MODELOS.map(x => `<label style="font-size:13px"><input type="checkbox" class="wzModelo" value="${x.model_id}" ${escolhidos.has(x.model_id) ? 'checked' : ''}/> ${x.model_id}</label>`).join('')}
        <input class="input" id="wzModeloNovo" placeholder="outro modelo (ex.: SA8H)" style="width:180px"/></div>
      ${Object.values(UI.pacote().bases).some(b => b.length) ? `<div class="banner">O projeto aberto já tem ${num(Object.values(UI.pacote().bases).reduce((t, b) => t + b.length, 0))} registro(s). <label><input type="checkbox" id="wzNovoProjeto"/> começar um projeto novo (o atual continua salvo nos arquivos já gerados)</label></div>` : ''}
      <div class="btnRow"><button class="btn primary" id="wzP1">Continuar →</button></div>`;
  }

  function tabelaEdicao(linhas, colunas, cls) {
    return `<div class="tabelaWrap" style="max-height:380px"><table class="table dados"><thead><tr>${colunas.map(c => `<th>${esc(c.rot)}</th>`).join('')}<th></th></tr></thead><tbody>
      ${linhas.map((l, i) => `<tr>${colunas.map(c => `<td>${c.opcoes ? `<select class="select ${cls}" data-i="${i}" data-k="${c.k}"><option value="">—</option>${c.opcoes.map(o => `<option value="${esc(o.codigo)}" ${l[c.k] === o.codigo ? 'selected' : ''}>${esc(o.rot)}</option>`).join('')}</select>` : `<input class="input ${cls}" data-i="${i}" data-k="${c.k}" value="${esc(l[c.k])}" style="width:${c.w || 120}px"/>`}</td>`).join('')}
        <td><button class="btn sm fantasma ${cls}Del" data-i="${i}">✕</button></td></tr>`).join('')}</tbody></table></div>`;
  }

  function resultadoSessao() {
    const s = w.sessao;
    if (!s) return '';
    const t = Object.values(s.trabalhos)[0];
    if (!t || !t.resultado) return '';
    const iss = t.resultado.issues.filter(i => i.severidade !== 'INFO');
    return `<div style="margin-top:10px">${iss.length ? iss.slice(0, 40).map(i => `<div class="issue ${i.severidade}">${UI.tagSev(i.severidade)} ${esc(i.mensagem)}<small>${esc(i.comoResolver || '')}</small></div>`).join('') : '<div class="banner ok">Sem pendências.</div>'}</div>`;
  }

  function passoPessoas() {
    const motor = S.importacao.motorDoPacote(UI.pacote());
    const col = [{ k: 'matricula', rot: 'Matrícula *', w: 100 }, { k: 'nome', rot: 'Nome *', w: 200 }, { k: 'funcao', rot: 'Função', opcoes: motor.valores('FUNCAO').map(v => ({ codigo: v.codigo, rot: v.pt })) },
      { k: 'turno', rot: 'Turno', opcoes: motor.valores('TURNO').map(v => ({ codigo: v.codigo, rot: v.pt })) }, { k: 'status', rot: 'Status *', opcoes: motor.valores('STATUS_PESSOA').map(v => ({ codigo: v.codigo, rot: v.pt })) }, { k: 'equipe', rot: 'Equipe *', w: 100 }];
    const ja = UI.pacote().bases.PEOPLE;
    return `<h3>2. Pessoas da equipe<small>人员 · ${ja.length} no pacote</small></h3>
      ${tabelaEdicao(w.linhasPessoas, col, 'wzPes')}
      <div class="btnRow"><button class="btn sm" id="wzPesMais">+ Linha</button><button class="btn sm" id="wzPesMais10">+ 10 linhas</button></div>
      <details class="maisInfo"><summary>Colar do Excel (copie as colunas Matrícula, Nome, Função, Turno…)</summary><textarea class="input" id="wzPesCola" rows="5" style="width:100%" placeholder="Matrícula&#9;Nome&#9;Função&#9;Turno"></textarea><button class="btn sm" id="wzPesColar">Ler texto colado</button></details>
      ${resultadoSessao()}
      ${ja.length ? `<details class="maisInfo"><summary>Já no pacote (${ja.length})</summary>${ja.slice(0, 200).map(p => `<div class="mono">${esc(p.matricula)} · ${esc(p.nome)} · ${esc(p.funcao || '')} · ${esc(p.turno || '')}</div>`).join('')}</details>` : ''}
      <div class="btnRow"><button class="btn" data-wz="0">← Voltar</button><button class="btn" id="wzPesValidar">Validar linhas</button><button class="btn primary" id="wzPesAdd">Adicionar ao pacote</button><button class="btn" data-wz="2">Pular →</button></div>`;
  }

  function passoOperacoes() {
    const motor = S.importacao.motorDoPacote(UI.pacote());
    const modelos = (UI.pacote().config.modelosExtras.length ? UI.pacote().config.modelosExtras : motor.modelos()).map(m => ({ codigo: m.model_id, rot: m.model_id }));
    const col = [{ k: 'modelo', rot: 'Modelo *', opcoes: modelos }, { k: 'estacao', rot: 'Estação * (C16L1)', w: 90 }, { k: 'lado', rot: 'Lado', opcoes: motor.valores('LADO').map(v => ({ codigo: v.codigo, rot: v.codigo })) }, { k: 'posicao', rot: 'Pos.', w: 50 },
      { k: 'codigo_operacao', rot: 'Código', w: 80 }, { k: 'descricao_pt', rot: 'Descrição *', w: 220 }, { k: 'descricao_zh', rot: '工序', w: 140 }, { k: 'torque', rot: 'Torque', w: 60 }, { k: 'takt_seconds', rot: 'Takt (s)', w: 60 }];
    const ja = UI.pacote().bases.OPERATIONS;
    return `<h3>3. Catálogo de operações<small>工序目录 · ${ja.length} no pacote</small></h3>
      ${tabelaEdicao(w.linhasOps, col, 'wzOp')}
      <div class="btnRow"><button class="btn sm" id="wzOpMais">+ Linha</button><button class="btn sm" id="wzOpMais10">+ 10 linhas</button></div>
      <details class="maisInfo"><summary>Colar do Excel</summary><textarea class="input" id="wzOpCola" rows="5" style="width:100%" placeholder="Modelo&#9;Estação&#9;Código&#9;Descrição"></textarea><button class="btn sm" id="wzOpColar">Ler texto colado</button></details>
      ${resultadoSessao()}
      ${ja.length ? `<details class="maisInfo"><summary>Já no pacote (${ja.length})</summary>${ja.slice(0, 200).map(o => `<div class="mono">${esc(o.operation_id)} · ${esc(o.descricao_pt || '')}</div>`).join('')}</details>` : ''}
      <div class="btnRow"><button class="btn" data-wz="1">← Voltar</button><button class="btn" id="wzOpValidar">Validar linhas</button><button class="btn primary" id="wzOpAdd">Adicionar ao pacote</button><button class="btn" data-wz="3">Pular →</button></div>`;
  }

  function passoMatriz() {
    const p = UI.pacote();
    if (!p.bases.PEOPLE.length || !p.bases.OPERATIONS.length) return `<h3>4. Matriz inicial</h3>${UI.vazio('Precisa de pessoas e operações no pacote.', 'Volte aos passos 2 e 3.')}<div class="btnRow"><button class="btn" data-wz="2">← Voltar</button><button class="btn" data-wz="4">Pular →</button></div>`;
    const nivel = (e, o) => { const s = p.bases.SKILLS.find(x => x.employee_id === e && x.operation_id === o); return s ? s.skill_level : ''; };
    const ops = p.bases.OPERATIONS.slice(0, 40), pes = p.bases.PEOPLE.slice(0, 80);
    return `<h3>4. Carga inicial da matriz<small>初始技能矩阵 · cada marcação vira registro na Matriz e evento CARGA_INICIAL no Histórico</small></h3>
      <div class="linhaForm"><label class="campo"><b>Nível</b><select class="select" id="wzNivel">${D.NIVEIS.map(n => `<option value="${n.codigo}">${n.codigo} · ${esc(n.nome_pt)}</option>`).join('')}</select></label>
        <label class="campo"><b>Titularidade</b><select class="select" id="wzTit"><option value="">—</option>${D.ENUMS.TITULARIDADE.map(t => `<option value="${t.codigo}">${esc(t.pt)}</option>`).join('')}</select></label>
        <label class="campo"><b>Data da habilidade *</b><input class="input" type="date" id="wzData" value="${U.agoraISO().slice(0, 10)}"/></label>
        <button class="btn primary" id="wzMarcar">Aplicar às ${w.marcaP.size} pessoa(s) × ${w.marcaO.size} operação(ões) marcadas</button></div>
      <div class="tabelaWrap" style="max-height:460px"><table class="table dados"><thead><tr><th><input type="checkbox" id="wzTodasP"/> Pessoa</th>${ops.map(o => `<th title="${esc(o.descricao_pt || '')}"><label><input type="checkbox" class="wzMarcaO" value="${esc(o.operation_id)}" ${w.marcaO.has(o.operation_id) ? 'checked' : ''}/> ${esc(o.operation_id)}</label></th>`).join('')}</tr></thead><tbody>
      ${pes.map(pp => `<tr><td><label><input type="checkbox" class="wzMarcaP" value="${esc(pp.employee_id)}" ${w.marcaP.has(pp.employee_id) ? 'checked' : ''}/> ${esc(pp.nome)}</label></td>${ops.map(o => `<td style="text-align:center;font-weight:800;color:var(--mint)">${esc(nivel(pp.employee_id, o.operation_id))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
      ${p.bases.OPERATIONS.length > 40 || p.bases.PEOPLE.length > 80 ? '<small style="color:#8fa39a">Mostrando 80 pessoas × 40 operações.</small>' : ''}
      <div style="font-size:12px;color:#9fb3aa;margin-top:6px">Matriz: ${num(p.bases.SKILLS.length)} registro(s) · Histórico: ${num(p.bases.HISTORY.length)} evento(s)</div>
      <div class="btnRow"><button class="btn" data-wz="2">← Voltar</button><button class="btn primary" data-wz="4">Validar →</button></div>`;
  }

  function passoValidar() {
    const p = UI.pacote();
    const issues = S.validatePackage(p.bases);
    const linhas = ['PEOPLE', 'OPERATIONS', 'SKILLS', 'HISTORY'].map(b => { const q = S.calculateQualityScore(b, p.bases[b], { issues, bases: p.bases }); return `<div class="qualidadeLinha"><span>${esc(UI.nomeSchema(b))} (${p.bases[b].length})</span><div class="barra"><i style="width:${q.nota || 0}%"></i></div><b>${q.nota == null ? esc(q.rotulo) : q.nota + '%'}</b></div>`; }).join('');
    return `<h3>5. Validar o pacote<small>校验</small></h3>${linhas}
      ${issues.length ? issues.slice(0, 50).map(i => `<div class="issue ${i.severidade}">${UI.tagSev(i.severidade)} ${esc(i.mensagem)}</div>`).join('') : '<div class="banner ok" style="margin-top:10px">Nenhuma referência quebrada entre as bases.</div>'}
      <div class="btnRow"><button class="btn" data-wz="3">← Voltar</button><button class="btn primary" data-wz="5" ${issues.some(i => i.severidade === 'BLOCKING') ? 'disabled' : ''}>Gerar →</button></div>`;
  }

  function passoGerar() {
    const st = UI.storage();
    return `<h3>6. Gerar as bases oficiais<small>生成</small></h3>
      <div class="integrCard"><b>${esc(st.nome)}</b><small>${esc(st.descricaoDestino)}</small></div>
      <div class="btnRow"><button class="btn" data-wz="4">← Voltar</button><button class="btn" data-ir-tela="config">Trocar destino</button><button class="btn primary" id="wzGerar">▦ Gerar pacote completo</button></div>
      ${UI.estado.geracao ? `<div class="banner ${UI.estado.geracao.ok ? 'ok' : 'erro'}">${esc(UI.estado.geracao.mensagem)} <button class="btn sm" data-ir-tela="geracao">Ver checklist</button></div>` : ''}`;
  }

  // Envia linhas para a mesma normalização/validação da importação
  async function processarLinhas(schema, linhas, confirmar) {
    const cheias = linhas.filter(l => Object.entries(l).some(([k, v]) => v !== '' && v != null && !['funcao', 'status', 'turno', 'equipe', 'modelo', 'lado'].includes(k)));
    if (!cheias.length) throw new Error('Preencha pelo menos uma linha.');
    const s = S.cadastro.sessaoManual({ pacote: UI.pacote(), schemaId: schema, linhas: cheias, usuario: UI.usuario() });
    await S.importacao.processar(s, 'CADASTRO_MANUAL');
    w.sessao = s;
    if (!confirmar) return null;
    const r = S.importacao.confirmar(s, {});
    UI.salvarProjeto();
    return r;
  }
  async function processarColado(schema, texto) {
    if (!texto.trim()) throw new Error('Cole as linhas copiadas do Excel.');
    const s = S.cadastro.sessaoColada({ pacote: UI.pacote(), texto, schemaId: schema, usuario: UI.usuario() });
    UI.estado.sessao = s; UI.estado.abaAtiva = null;
    S.importacao.mapear(s, 'COLADO', schema);
    UI.toast('Texto lido. Confira o mapeamento das colunas.');
    UI.ir('mapeamento');
  }

  function ligarTabela(cls, linhas, nova) {
    $$('.' + cls).forEach(i => i.onchange = () => { linhas[+i.dataset.i][i.dataset.k] = i.value.trim(); });
    $$('.' + cls + 'Del').forEach(b => b.onclick = () => { linhas.splice(+b.dataset.i, 1); render(); });
  }

  function ligar() {
    $$('[data-ir-tela]').forEach(b => b.onclick = () => UI.ir(b.dataset.irTela));
    $$('[data-wz]').forEach(b => b.onclick = () => { w.passo = +b.dataset.wz; w.sessao = null; render(); });
    $$('.passosWizard [data-passo]').forEach(s => s.onclick = () => { if (+s.dataset.passo <= w.passo) { w.passo = +s.dataset.passo; w.sessao = null; render(); } });
    const p1 = $('#wzP1'); if (p1) p1.onclick = async () => {
      const meta = {}; $$('.wzMeta').forEach(i => { meta[i.dataset.k] = i.value.trim(); });
      if (!meta.empresa || !meta.equipe) { UI.toast('Informe empresa e equipe.', true); return; }
      const modelos = $$('.wzModelo').filter(c => c.checked).map(c => c.value);
      const novo = $('#wzModeloNovo').value.trim();
      if (($('#wzNovoProjeto') || {}).checked || !UI.estado.pacote || UI.estado.exemplo) {
        UI.estado.pacote = S.createPackage({ ...meta }, UI.usuario()); UI.estado.exemplo = false; UI.banner('');
      } else Object.assign(UI.pacote().manifesto, meta, { updated_at: U.agoraISO() });
      const p = UI.pacote(), motor = S.importacao.motorDoPacote(p);
      if (novo) modelos.push(motor.adicionarModelo(novo, [], UI.usuario()));
      p.config.modelosExtras = motor.modelos().filter(m => modelos.includes(m.model_id)).map(m => ({ model_id: m.model_id, nome: m.nome || m.model_id, aliases: m.aliases || [] }));
      p.config.geral.modelos_da_linha = modelos.join(',');
      UI.salvarProjeto();
      if (!w.linhasPessoas.length) w.linhasPessoas = Array.from({ length: 5 }, novaLinhaPessoa);
      w.passo = 1; render();
    };
    ligarTabela('wzPes', w.linhasPessoas);
    ligarTabela('wzOp', w.linhasOps);
    const b = (id, fn) => { const e = $(id); if (e) e.onclick = async () => { try { await fn(); } catch (err) { UI.erro(err, 'Nova implantação'); render(); } }; };
    b('#wzPesMais', () => { w.linhasPessoas.push(novaLinhaPessoa()); render(); });
    b('#wzPesMais10', () => { for (let i = 0; i < 10; i++) w.linhasPessoas.push(novaLinhaPessoa()); render(); });
    b('#wzPesValidar', async () => { await processarLinhas('PEOPLE', w.linhasPessoas, false); render(); });
    b('#wzPesAdd', async () => {
      await processarLinhas('PEOPLE', w.linhasPessoas, false);
      const t = w.sessao.trabalhos.CADASTRO_MANUAL;
      if (t.resultado.issues.some(i => i.severidade === 'ERROR' || i.severidade === 'BLOCKING')) { UI.toast('Corrija os erros antes de adicionar.', true); render(); return; }
      const r = S.importacao.confirmar(w.sessao, {}); UI.salvarProjeto();
      UI.toast(`${r.previa.porBase.PEOPLE.adicionados} pessoa(s) adicionada(s), ${r.previa.porBase.PEOPLE.alterados} atualizada(s).`);
      w.linhasPessoas = []; w.sessao = null; if (!w.linhasOps.length) w.linhasOps = Array.from({ length: 5 }, novaLinhaOp); w.passo = 2; render();
    });
    b('#wzPesColar', () => processarColado('PEOPLE', $('#wzPesCola').value));
    b('#wzOpMais', () => { w.linhasOps.push(novaLinhaOp()); render(); });
    b('#wzOpMais10', () => { for (let i = 0; i < 10; i++) w.linhasOps.push(novaLinhaOp()); render(); });
    b('#wzOpValidar', async () => { await processarLinhas('OPERATIONS', w.linhasOps, false); render(); });
    b('#wzOpAdd', async () => {
      await processarLinhas('OPERATIONS', w.linhasOps, false);
      const t = w.sessao.trabalhos.CADASTRO_MANUAL;
      if (t.resultado.issues.some(i => i.severidade === 'ERROR' || i.severidade === 'BLOCKING')) { UI.toast('Corrija os erros antes de adicionar.', true); render(); return; }
      const r = S.importacao.confirmar(w.sessao, {}); UI.salvarProjeto();
      UI.toast(`${r.previa.porBase.OPERATIONS.adicionados} operação(ões) adicionada(s).`);
      w.linhasOps = []; w.sessao = null; w.passo = 3; render();
    });
    b('#wzOpColar', () => processarColado('OPERATIONS', $('#wzOpCola').value));
    $$('.wzMarcaP').forEach(c => c.onchange = () => { c.checked ? w.marcaP.add(c.value) : w.marcaP.delete(c.value); const x = $('#wzMarcar'); if (x) x.textContent = `Aplicar às ${w.marcaP.size} pessoa(s) × ${w.marcaO.size} operação(ões) marcadas`; });
    $$('.wzMarcaO').forEach(c => c.onchange = () => { c.checked ? w.marcaO.add(c.value) : w.marcaO.delete(c.value); const x = $('#wzMarcar'); if (x) x.textContent = `Aplicar às ${w.marcaP.size} pessoa(s) × ${w.marcaO.size} operação(ões) marcadas`; });
    const tp = $('#wzTodasP'); if (tp) tp.onchange = () => { $$('.wzMarcaP').forEach(c => { c.checked = tp.checked; tp.checked ? w.marcaP.add(c.value) : w.marcaP.delete(c.value); }); render(); };
    b('#wzMarcar', () => {
      if (!w.marcaP.size || !w.marcaO.size) throw new Error('Marque ao menos uma pessoa e uma operação.');
      const r = S.cadastro.marcarMatriz(UI.pacote(), { employee_ids: [...w.marcaP], operation_ids: [...w.marcaO], nivel: $('#wzNivel').value, titularidade: $('#wzTit').value || null, data: $('#wzData').value, responsavel: UI.usuario() });
      UI.salvarProjeto(); UI.toast(`Matriz: ${r.novos} novo(s), ${r.alterados} atualizado(s), ${r.eventos} evento(s) no histórico.`); render();
    });
    b('#wzGerar', async () => {
      const st = UI.storage(), p = UI.pacote();
      const r = await S.writePackage(st, UI.estado.raiz, p, { modo: 'COMPLETO', usuario: UI.usuario(), ExcelJS: window.ExcelJS });
      UI.estado.geracao = { ...r, em: U.agoraISO(), mensagem: r.ok ? `Pacote gerado: ${r.resultados.length} bases + Configurações + Manifesto (${st.nome}).` : r.erro };
      if (r.ok) await UI.guardar('snapshot:' + p.manifesto.installation_id, JSON.parse(JSON.stringify(p.bases)));
      UI.salvarProjeto(); UI.toast(UI.estado.geracao.mensagem, !r.ok); render(); UI.telas.inicio.painel();
    });
  }

  UI.telas.nova = { render };
})();
