// Tela Dicionário: todos os campos de todos os schemas (rótulos pt/zh, tipo, obrigatoriedade, valores,
// aliases, onde é usado), níveis i/I/L/U, listas de valores, modelos e aliases do usuário.
// Líder: só consulta. Implantador: cria valores, modelos e aliases (gravados em 07_Configuracoes).
(function () {
  'use strict';
  const { $, $$, esc, S, D } = UI;
  const f = { texto: '', schema: '', aba: 'campos' };

  function motor() { return S.importacao.motorDoPacote(UI.pacote()); }
  function persistir(m) {
    const c = UI.pacote().config;
    c.aliases = m.listar(); c.modelosExtras = m.modelosExtras(); c.valoresExtras = m.valoresExtras();
    UI.salvarProjeto();
  }

  function render() {
    const el = $('#telaDicionario');
    const abas = [['campos', 'Campos'], ['niveis', 'Níveis i/I/L/U'], ['valores', 'Listas de valores'], ['modelos', 'Modelos'], ['aliases', 'Aliases'], ['bases', 'Bases e regras']];
    el.innerHTML = `<div class="telaHead"><div><h2>Dicionário de Dados C3B <small>数据字典 · schema ${esc(D.SCHEMA_VERSION)}</small></h2>
      <div class="sub">É a única fonte das regras: o mapeamento, a normalização, a validação e os arquivos gerados leem daqui. ${UI.ehImplantador() ? 'No modo Implantador você pode acrescentar valores, modelos e aliases.' : 'Modo Líder: somente consulta.'}</div></div></div>
      <div class="btnRow" style="margin:0 0 12px">${abas.map(([k, r]) => `<button class="btn sm ${f.aba === k ? 'primary' : ''}" data-dic-aba="${k}">${r}</button>`).join('')}</div>
      <div class="panel bloco">${({ campos, niveis, valores, modelos, aliases, bases })[f.aba]()}</div>`;
    ligar();
  }

  function campos() {
    const linhas = D.linhasDicionario().filter(l => (!f.schema || l.schema === f.schema) && (!f.texto || UI.U.dobrar(Object.values(l).join(' ')).includes(UI.U.dobrar(f.texto))));
    return `<div class="linhaForm"><label class="campo"><b>Procurar</b><input class="input" id="dicTexto" value="${esc(f.texto)}" placeholder="campo, rótulo, alias, 中文…"/></label>
      <label class="campo"><b>Base</b><select class="select" id="dicSchema"><option value="">todas</option>${D.SCHEMAS.map(s => `<option value="${s.id}" ${f.schema === s.id ? 'selected' : ''}>${s.base} ${esc(s.nome_pt)}</option>`).join('')}</select></label>
      <button class="btn sm" id="dicExportar">⇩ Exportar dicionário (.xlsx)</button></div>
      <div class="tabelaWrap" style="max-height:600px"><table class="table dados"><thead><tr><th>Campo</th><th>Base</th><th>Rótulo</th><th>中文</th><th>Tipo</th><th>Obrig.</th><th>Valores permitidos</th><th>Origem</th><th>Aliases de cabeçalho</th><th>Descrição</th></tr></thead><tbody>
      ${linhas.map(l => `<tr class="usoCampo" data-campo="${esc(l.field_id)}" style="cursor:pointer" title="clique para ver onde é usado"><td class="mono">${esc(l.field_id)}</td><td>${esc(D.schema(l.schema).base)}</td><td>${esc(l.label_pt)}</td><td>${esc(l.label_zh)}</td><td>${esc(l.data_type)}</td>
        <td>${l.required ? UI.tag('obrigatório', 'erro') : l.recommended ? UI.tag('recomendado', 'aviso') : ''}</td><td class="quebra" style="max-width:220px">${esc(l.allowed_values)}</td><td>${esc({ arquivo: 'planilha', gerado: 'gerado', entrada: 'referência' }[l.origem] || l.origem)}</td>
        <td class="quebra" style="max-width:240px;color:#9fb3aa">${esc(l.aliases)}</td><td class="quebra" style="max-width:280px">${esc(l.description)}</td></tr>`).join('')}</tbody></table></div>
      <small style="color:#8fa39a">${linhas.length} campo(s).</small>`;
  }

  function niveis() {
    return `<div class="grid4">${D.NIVEIS.map(n => `<div class="panel bloco" style="margin:0"><div style="font-size:42px;font-weight:900;color:var(--mint);font-family:Georgia,serif">${esc(n.codigo)}</div>
      <b>${esc(n.nome_pt)}</b><div style="color:#8fa39a">${esc(n.nome_zh)}</div><p style="font-size:12px;line-height:1.5">${esc(n.definicao_pt)}</p><p style="font-size:12px;color:#9fb3aa">${esc(n.definicao_zh)}</p></div>`).join('')}</div>
      <div class="banner info" style="margin-top:12px">Os códigos diferenciam maiúsculas: <b>i</b> (treinamento) ≠ <b>I</b> (independente). "l" e "u" minúsculos são lidos como L e U, mas pedem confirmação.</div>`;
  }

  function valores() {
    const m = motor();
    return Object.keys(D.ENUMS).map(nome => `<details class="maisInfo" ${nome === f.enumAberto ? 'open' : ''}><summary>${esc(nome)} (${m.valores(nome).length})</summary>
      <table class="table"><thead><tr><th>Código</th><th>Português</th><th>中文</th><th>Aliases reconhecidos</th></tr></thead><tbody>
      ${m.valores(nome).map(v => `<tr><td class="mono">${esc(v.codigo)}${v.extra ? ' ' + UI.tag('criado aqui', 'info') : ''}</td><td>${esc(v.pt)}</td><td>${esc(v.zh || '')}</td><td style="color:#9fb3aa;white-space:normal">${esc((v.aliases || []).join(', '))}</td></tr>`).join('')}</tbody></table>
      ${nome === 'SKILL_LEVEL' ? '' : `<div class="linhaForm so-implantador"><input class="input novoCod" data-enum="${nome}" placeholder="código (ex.: TURNO_4)"/><input class="input novoPt" data-enum="${nome}" placeholder="nome em português"/><input class="input novoZh" data-enum="${nome}" placeholder="中文"/><button class="btn sm criarValor" data-enum="${nome}">Criar valor</button></div>`}</details>`).join('');
  }

  function modelos() {
    const m = motor();
    return `<table class="table"><thead><tr><th>Modelo</th><th>Aliases</th><th></th></tr></thead><tbody>${m.modelos().map(x => `<tr><td class="mono">${esc(x.model_id)}</td><td>${esc((x.aliases || []).join(', '))}</td><td>${D.MODELOS.some(b => b.model_id === x.model_id) ? UI.tag('padrão', 'neutro') : UI.tag('adicionado', 'info')}</td></tr>`).join('')}</tbody></table>
      <div class="linhaForm so-implantador"><input class="input" id="novoModelo" placeholder="código do modelo (ex.: SA8H)"/><input class="input" id="novoModeloAliases" placeholder="outras grafias, separadas por vírgula"/><button class="btn sm" id="criarModelo">Adicionar modelo</button></div>
      <small style="color:#8fa39a">Modelo desconhecido numa planilha fica UNKNOWN (nunca é inventado). Depois de adicionado aqui, reprocesse a importação.</small>`;
  }

  function aliases() {
    const lista = UI.pacote().config.aliases || [];
    const entidades = ['MODELO', 'OPERACAO'].concat(Object.keys(D.ENUMS));
    return `<div class="linhaForm so-implantador"><label class="campo"><b>Tipo</b><select class="select" id="alEnt">${entidades.map(e => `<option>${e}</option>`).join('')}</select></label>
      <label class="campo"><b>Como aparece na planilha</b><input class="input" id="alOrig" placeholder="ex.: 2T"/></label><label class="campo"><b>Valor oficial</b><input class="input" id="alNovo" placeholder="ex.: TURNO_2"/></label><button class="btn sm" id="alCriar">Criar alias</button></div>
      ${lista.length ? `<table class="table"><thead><tr><th>ID</th><th>Tipo</th><th>Original</th><th>Oficial</th><th>Criado por</th><th>Em</th><th>Ativo</th><th></th></tr></thead><tbody>
      ${lista.map(a => `<tr><td class="mono">${esc(a.alias_id)}</td><td>${esc(a.entity_type)}</td><td class="mono">${esc(a.original_value)}</td><td class="mono" style="color:#7dffc0">${esc(a.normalized_value)}</td><td>${esc(a.created_by)}</td><td>${UI.dataHora(a.created_at)}</td>
        <td>${a.active === false ? UI.tag('inativo', 'neutro') : UI.tag('ativo', 'ok')}</td><td class="so-implantador"><button class="btn sm alAtivo" data-id="${esc(a.alias_id)}" data-ativo="${a.active === false ? 1 : 0}">${a.active === false ? 'Reativar' : 'Desativar'}</button> <button class="btn sm alEditar" data-id="${esc(a.alias_id)}">Editar</button></td></tr>`).join('')}</tbody></table>`
        : UI.vazio('Nenhum alias criado ainda.', 'Aliases nascem das decisões na Normalização (opção "criar alias") ou aqui.')}`;
  }

  function bases() {
    return `<table class="table"><thead><tr><th>Base</th><th>Arquivo</th><th>Aba</th><th>Chave</th><th>Obrigatória</th><th>Modo de sincronização</th></tr></thead><tbody>
      ${D.SCHEMAS.map(s => `<tr><td>${s.base} ${esc(s.nome_pt)} <span style="color:#8fa39a">${esc(s.nome_zh)}</span></td><td class="mono">${esc(s.arquivo)}</td><td class="mono">${esc(s.aba || '')}</td><td class="mono">${esc((s.chave || []).join(', '))}</td><td>${s.obrigatoria ? 'sim' : 'não'}</td><td class="mono">${esc((UI.pacote().config.sync || {})[s.id] || s.master_mode)}</td></tr>`).join('')}</tbody></table>
      <h3 style="margin-top:16px">Relações (integridade)</h3>${D.RELACOES.map(r => `<div class="mono" style="margin:3px 0">${r.de}.${r.campo} → ${r.para}.${r.campoPara} ${UI.tagSev(r.severidade)}</div>`).join('')}
      <h3 style="margin-top:16px">Dados que o C3B não usa (minimização)</h3><div style="font-size:12px;color:#b6c6bf">Colunas reconhecidas como ${D.NAO_UTILIZADOS.map(n => `<b>${esc(n.tipo)}</b>`).join(', ')} são detectadas e ficam de fora por padrão. O C3B só precisa do mínimo para matriz de habilidades, cobertura e revezamento.</div>`;
  }

  async function exportar() {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('DICIONARIO');
    const cols = ['field_id', 'schema', 'label_pt', 'label_zh', 'data_type', 'required', 'recommended', 'allowed_values', 'description', 'example', 'aliases', 'validation_rule', 'origem'];
    ws.addRow(cols); D.linhasDicionario().forEach(l => ws.addRow(cols.map(c => (typeof l[c] === 'boolean' ? (l[c] ? 'SIM' : 'NAO') : l[c]))));
    ws.getRow(1).font = { bold: true }; ws.views = [{ state: 'frozen', ySplit: 1 }];
    const wn = wb.addWorksheet('NIVEIS'); wn.addRow(['codigo', 'nome_pt', 'nome_zh', 'definicao_pt', 'definicao_zh']); D.NIVEIS.forEach(n => wn.addRow([n.codigo, n.nome_pt, n.nome_zh, n.definicao_pt, n.definicao_zh]));
    UI.baixar(new Uint8Array(await wb.xlsx.writeBuffer()), `Dicionario_C3B_v${D.SCHEMA_VERSION}.xlsx`);
  }

  function ligar() {
    $$('[data-dic-aba]').forEach(b => b.onclick = () => { f.aba = b.dataset.dicAba; render(); });
    const t = $('#dicTexto'); if (t) t.onchange = () => { f.texto = t.value; render(); };
    const sc = $('#dicSchema'); if (sc) sc.onchange = () => { f.schema = sc.value; render(); };
    const ex = $('#dicExportar'); if (ex) ex.onclick = () => exportar().catch(e => UI.erro(e, 'Exportar'));
    $$('.usoCampo').forEach(tr => tr.onclick = () => UI.modal(`<h3>Onde "${esc(tr.dataset.campo)}" é usado</h3><ul>${D.usosDoCampo(tr.dataset.campo).map(u => `<li>${esc(u)}</li>`).join('')}</ul><div class="modalActions"><button class="btn" data-fechar>Fechar</button></div>`));
    $$('.criarValor').forEach(b => b.onclick = () => {
      const e = b.dataset.enum, cod = $(`.novoCod[data-enum="${e}"]`).value.trim();
      try {
        if (!cod) throw new Error('Informe o código.');
        const m = motor(); const c = m.adicionarValor(e, cod, $(`.novoPt[data-enum="${e}"]`).value.trim(), $(`.novoZh[data-enum="${e}"]`).value.trim());
        persistir(m); UI.pacote().config.decisoes.push({ tipo: 'VALOR_CRIADO', detalhe: `${e}: ${c}`, decidido_por: UI.usuario(), decidido_em: S.util.agoraISO() });
        f.enumAberto = e; UI.toast(`Valor ${c} criado em ${e}.`); render();
      } catch (err) { UI.erro(err, 'Criar valor'); }
    });
    const cm = $('#criarModelo'); if (cm) cm.onclick = () => {
      try {
        const m = motor(); const id = m.adicionarModelo($('#novoModelo').value, $('#novoModeloAliases').value.split(',').map(x => x.trim()).filter(Boolean), UI.usuario());
        persistir(m); UI.toast(`Modelo ${id} adicionado.`); render();
      } catch (err) { UI.erro(err, 'Modelo'); }
    };
    const ac = $('#alCriar'); if (ac) ac.onclick = () => {
      try {
        const ent = $('#alEnt').value, orig = $('#alOrig').value.trim(), novo = $('#alNovo').value.trim();
        if (!orig || !novo) throw new Error('Preencha o valor original e o oficial.');
        const m = motor();
        if (ent === 'MODELO' && !m.modelos().some(x => x.model_id === novo)) throw new Error(`Modelo ${novo} não existe. Adicione-o na aba Modelos primeiro.`);
        if (D.ENUMS[ent] && !m.valores(ent).some(v => v.codigo === novo)) throw new Error(`"${novo}" não é um valor oficial de ${ent}. Valores: ${m.valores(ent).map(v => v.codigo).join(', ')}`);
        const a = m.adicionar(ent, orig, novo, UI.usuario()); persistir(m); UI.toast(`Alias ${a.alias_id} criado.`); render();
      } catch (err) { UI.erro(err, 'Alias'); }
    };
    $$('.alAtivo').forEach(b => b.onclick = () => { const m = motor(); m.definirAtivo(b.dataset.id, b.dataset.ativo === '1'); persistir(m); render(); });
    $$('.alEditar').forEach(b => b.onclick = () => {
      const a = UI.pacote().config.aliases.find(x => x.alias_id === b.dataset.id);
      UI.modal(`<h3>Editar ${esc(a.alias_id)}</h3><label class="campo"><b>Original</b><input class="input" id="edOrig" value="${esc(a.original_value)}"/></label><label class="campo"><b>Valor oficial</b><input class="input" id="edNovo" value="${esc(a.normalized_value)}"/></label>
        <div class="modalActions"><button class="btn" data-fechar>Cancelar</button><button class="btn primary" id="edOk">Salvar</button></div>`, (box, fechar) => {
        box.querySelector('#edOk').onclick = () => { const m = motor(); m.editar(a.alias_id, { original_value: box.querySelector('#edOrig').value.trim(), normalized_value: box.querySelector('#edNovo').value.trim(), updated_at: S.util.agoraISO() }); persistir(m); fechar(); render(); };
      });
    });
  }

  UI.telas.dicionario = { render };
})();
