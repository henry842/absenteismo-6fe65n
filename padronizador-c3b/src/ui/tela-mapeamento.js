// Tela Mapeamento: coluna do arquivo → campo do padrão C3B, com confiança e motivo; correção manual;
// campos obrigatórios sem coluna (valor fixo decidido pelo usuário); colunas não utilizadas (LGPD); perfis.
(function () {
  'use strict';
  const { $, $$, esc, num, S, D } = UI;

  function abaAtual(s) {
    const nomes = Object.keys(s.trabalhos);
    if (!nomes.includes(UI.estado.abaAtiva)) UI.estado.abaAtiva = nomes[0];
    return s.trabalhos[UI.estado.abaAtiva];
  }
  UI.abasTrabalho = (s, tela) => `<div class="btnRow" style="margin:0 0 12px">${Object.values(s.trabalhos).map(t => `<button class="btn sm ${t.aba === UI.estado.abaAtiva ? 'primary' : ''}" data-trocar-aba="${esc(t.aba)}">${esc(t.aba)} → ${esc(UI.nomeSchema(t.schema))}${t.resultado ? ' ✓' : ''}</button>`).join('')}</div>`;
  UI.ligarAbas = (tela) => $$('[data-trocar-aba]').forEach(b => b.onclick = () => { UI.estado.abaAtiva = b.dataset.trocarAba; UI.telas[tela].render(); });

  function render() {
    const el = $('#telaMapeamento');
    const s = UI.estado.sessao;
    const head = `<div class="telaHead"><div><h2>2. Mapeamento de Campos <small>字段映射 · confira cada coluna</small></h2>
      <div class="sub">Cada coluna da planilha é ligada a um campo do padrão C3B. Acima de 95% entra sozinho; entre 80% e 94% aparece com ⚠ para você conferir; abaixo de 80% não é ligado. Você pode trocar qualquer escolha.</div></div></div>`;
    if (!s || !Object.keys(s.trabalhos).length) { el.innerHTML = head + `<div class="panel bloco">${UI.vazio('Nada para mapear.', 'Escolha as abas na tela Importação.')}</div>`; return; }
    const t = abaAtual(s);
    const campos = D.camposMapeaveis(t.schema);
    const usados = new Set(t.mapeamento.filter(m => m.campo).map(m => m.campo));
    const faltam = C3B['core/mapeamento'].camposFaltando(t.mapeamento, t.schema, t.valoresFixos);
    const naoUsadas = t.mapeamento.filter(m => m.decisao === 'NAO_UTILIZADO');
    const revisar = t.mapeamento.filter(m => m.decisao === 'REVISAR').length;
    const opcoes = sel => `<option value="">— não usar —</option>` + campos.map(c => `<option value="${c.field_id}" ${sel === c.field_id ? 'selected' : ''}>${esc(c.label_pt)}${c.required ? ' *' : ''}${UI.ehImplantador() ? ' · ' + c.field_id : ''}</option>`).join('');
    const linhas = t.mapeamento.filter(m => m.decisao !== 'NAO_UTILIZADO').map(m => {
      const col = t.colunas.find(c => c.indice === m.indice);
      const amostra = col.amostra.slice(0, 3).map(v => esc(v instanceof Date ? v.toISOString().slice(0, 10) : v)).join(' · ');
      return `<tr><td><b>${esc(m.cabecalho || `(coluna ${m.indice + 1} sem nome)`)}</b><div style="color:#8fa39a;font-size:10px">${amostra}${col.vazias ? ` · ${col.vazias} vazia(s)` : ''}</div></td>
        <td>→</td><td><select class="select selCampo" data-indice="${m.indice}" style="min-width:220px">${opcoes(m.campo)}</select></td>
        <td>${m.campo ? UI.conf(m.confianca) : UI.tag(m.decisao === 'IGNORADO' ? 'não usar' : 'não ligado')}</td>
        <td class="quebra" style="font-size:11px;color:#b6c6bf">${esc({ AUTO: 'Automático', REVISAR: 'Revisar', PERFIL: 'Perfil', USUARIO: 'Sua escolha', NAO_MAPEADO: '', IGNORADO: 'Desmarcado' }[m.decisao] || '')}
          <span class="so-implantador"> · ${esc(m.motivos.join('; '))}${m.alternativas.length > 1 ? ` · outras: ${esc(m.alternativas.slice(1).map(a => a.campo + ' ' + Math.round(a.confianca * 100) + '%').join(', '))}` : ''}</span></td></tr>`;
    }).join('');
    el.innerHTML = head + UI.abasTrabalho(s, 'mapeamento') + `
      <div class="grid3" style="margin-bottom:12px">
        <div class="panel bloco"><h3>Resumo<small>摘要</small></h3><div class="resumoLinhas">
          <div class="ok">✓ ${usados.size} coluna(s) ligada(s)</div>${revisar ? `<div class="aviso">⚠ ${revisar} para conferir</div>` : ''}
          ${faltam.length ? `<div class="erro">✕ ${faltam.length} campo(s) obrigatório(s) sem coluna</div>` : '<div class="ok">✓ todos os obrigatórios têm coluna</div>'}
          ${naoUsadas.length ? `<div>ⓘ ${naoUsadas.length} coluna(s) não utilizada(s) pelo C3B</div>` : ''}</div></div>
        <div class="panel bloco"><h3>Obrigatórios sem coluna<small>必填字段</small></h3>${valoresFixosHTML(t, faltam)}</div>
        <div class="panel bloco"><h3>Não utilizadas pelo schema<small>最小化原则</small></h3>${naoUsadas.length ? naoUsadas.map(m => `<div style="font-size:12px;margin:5px 0">☐ <b>${esc(m.cabecalho)}</b> ${UI.tag(m.tipoNaoUtilizado)}<div style="color:#8fa39a;font-size:11px">Fica de fora por padrão (o C3B não usa esse dado).</div></div>`).join('') : '<div style="font-size:12px;color:#8fa39a">Nenhuma coluna com dado pessoal desnecessário.</div>'}</div>
      </div>
      <div class="panel bloco"><h3>Colunas da aba "${esc(t.aba)}"<small>列映射</small></h3>
        <div class="tabelaWrap"><table class="table dados"><thead><tr><th>Coluna do arquivo</th><th></th><th>Campo C3B</th><th>Confiança</th><th>Origem</th></tr></thead><tbody>${linhas}</tbody></table></div></div>
      <div class="panel bloco so-implantador"><h3>Perfil de importação<small>导入配置</small></h3>
        <div class="linhaForm"><label class="campo"><b>Salvar este mapeamento como perfil</b><input class="input" id="nomePerfil" placeholder="ex.: Planilha BYD Chassis V1" style="min-width:280px"/></label><button class="btn" id="salvarPerfil">Salvar perfil</button></div>
        <small style="color:#8fa39a">Na próxima vez que chegar um arquivo parecido, o Padronizador mostra "Perfil compatível encontrado".</small></div>
      <div class="btnRow"><button class="btn" data-ir-tela="importacao">← Voltar</button><button class="btn primary" id="processar">⚙ Normalizar e validar ${Object.keys(s.trabalhos).length} aba(s)</button></div>
      <div class="progressoImport" id="progProcessar"><div class="bar"><i id="progProcessarBar"></i></div><small id="progProcessarTxt"></small><button class="btn sm" id="cancelarProc" style="margin-top:8px">Cancelar</button></div>`;
    ligar(t);
  }

  function valoresFixosHTML(t, faltam) {
    const sug = t.sugestoesValorFixo || {};
    const fixos = Object.entries(t.valoresFixos);
    const campos = [...new Set(faltam.concat(Object.keys(sug)).concat(fixos.map(f => f[0])))];
    if (!campos.length) return '<div style="font-size:12px;color:#8fa39a">Nada pendente.</div>';
    return campos.map(f => {
      const c = D.campo(t.schema, f);
      const vals = c && c.allowed_values ? UI.estado.sessao.motor.valores(c.allowed_values) : null;
      const atual = t.valoresFixos[f] || '';
      const ctrl = vals ? `<select class="select valorFixo" data-campo="${f}"><option value="">— deixar vazio —</option>${vals.map(v => `<option value="${esc(v.codigo)}" ${atual === v.codigo ? 'selected' : ''}>${esc(v.pt)} (${esc(v.codigo)})</option>`).join('')}</select>`
        : `<input class="input valorFixo" data-campo="${f}" value="${esc(atual)}" placeholder="valor para todas as linhas"/>`;
      return `<label class="campo" style="margin:6px 0"><b>${esc(c ? c.label_pt : f)}${c && c.required ? ' *' : ''}</b>${ctrl}
        ${sug[f] && !atual ? `<small style="color:#ffd66e">Sugestão pelo formato do arquivo: <b>${esc(sug[f])}</b> <button class="btn sm aplicarSug" data-campo="${f}" data-valor="${esc(sug[f])}">Usar</button></small>` : ''}
        <small>Valor fixo é uma decisão sua: vale para todas as linhas (e para as células vazias da coluna) e fica registrado no log.</small></label>`;
    }).join('');
  }

  let tokenProc = null;
  function ligar(t) {
    const s = UI.estado.sessao;
    UI.ligarAbas('mapeamento');
    $$('[data-ir-tela]').forEach(b => b.onclick = () => UI.ir(b.dataset.irTela));
    $$('.selCampo').forEach(sel => sel.onchange = () => { S.importacao.corrigirMapeamento(s, t.aba, +sel.dataset.indice, sel.value || null); render(); });
    $$('.valorFixo').forEach(inp => inp.onchange = () => { S.importacao.definirValorFixo(s, t.aba, inp.dataset.campo, inp.value); render(); });
    $$('.aplicarSug').forEach(b => b.onclick = () => { S.importacao.definirValorFixo(s, t.aba, b.dataset.campo, b.dataset.valor); render(); });
    const sp = $('#salvarPerfil');
    if (sp) sp.onclick = () => {
      const nome = $('#nomePerfil').value.trim();
      if (!nome) { UI.toast('Dê um nome ao perfil.', true); return; }
      const pacote = UI.pacote();
      const api = S.perfis.criarPerfis(pacote.config.perfis);
      const info = s.abas.find(a => a.nome === t.aba);
      const regras = {};
      for (const [campo, dec] of Object.entries(t.decisoes || {})) { regras[campo] = {}; for (const [orig, d] of Object.entries(dec)) regras[campo][orig] = d.acao === 'IGNORAR' ? '__IGNORAR__' : d.valor; }
      const p = api.criar(S.perfis.perfilDoMapeamento(nome, t.schema, info, info.cabecalho, t.mapeamento, t.valoresFixos, regras));
      pacote.config.perfis = api.listar(); UI.salvarProjeto();
      UI.toast(`Perfil "${p.profile_name}" salvo (${p.profile_id}).`);
    };
    $('#processar').onclick = async () => {
      tokenProc = s.token;
      $('#progProcessar').classList.add('show'); $('#processar').disabled = true;
      const trabalhos = Object.values(s.trabalhos).sort((a, b) => S.importacao.ORDEM.indexOf(a.schema) - S.importacao.ORDEM.indexOf(b.schema));
      try {
        for (const [i, tr] of trabalhos.entries()) {
          const t0 = performance.now();
          const r = await S.importacao.processar(s, tr.aba, { progresso: p => { $('#progProcessarBar').style.width = Math.round((i + p / 100) / trabalhos.length * 100) + '%'; $('#progProcessarTxt').textContent = `${tr.aba}: ${p}%`; } });
          UI.medir('Normalização e validação', { arquivo: s.lote.arquivo && s.lote.arquivo.nome, aba: tr.aba, schema: tr.schema, tempo_ms: Math.round(performance.now() - t0), linhas: r.registros.length + r.ignoradas.length,
            avisos: r.issues.filter(x => x.severidade === 'WARNING').length, erros: r.issues.filter(x => x.severidade === 'ERROR' || x.severidade === 'BLOCKING').length });
        }
        UI.ir('normalizacao');
      } catch (e) {
        if (e.name === 'Cancelado') { UI.toast('Processamento cancelado. Nada foi aplicado.'); s.token = S.util.tokenCancelamento(); }
        else UI.erro(e, 'Processamento');
        render();
      }
    };
    const c = $('#cancelarProc'); if (c) c.onclick = () => tokenProc && tokenProc.cancelar();
  }

  UI.telas.mapeamento = { render };
})();
