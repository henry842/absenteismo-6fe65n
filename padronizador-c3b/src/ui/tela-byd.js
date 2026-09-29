// Painel "Matriz BYD" (dentro da tela Importação): resultado real do perfil BYD_SKILL_MATRIX_V1 —
// nível (marcador 1), designação (formas ○ △ do Excel), cor do bloco, datas, pendências e a Base Operacional.
(function () {
  'use strict';
  const { $, $$, esc, num, S } = UI;
  const f = { sheet: '', status: '', texto: '', pessoa: '' };
  // Camada de Ajustes Manuais: a tela mostra sempre o VALOR EFETIVO (Matriz importada + ajustes ativos); a origem nunca é editada
  const estadoAjustes = s => (s.pacote.config.ajustes = s.pacote.config.ajustes || S.ajustes.novoEstado());
  const efetivo = s => S.ajustes.aplicar(s.byd, estadoAjustes(s));
  const ROT = { TITULAR: ['○ Titular', 'ok'], EM_TREINAMENTO: ['△ Em treinamento', 'aviso'], FUTURO_TITULAR: ['○△ Futuro titular', 'info'], SEM_DESIGNACAO: ['Sem designação', 'neutro'] };

  const CAT = { CONFIGURACAO_PENDENTE: ['Configuração pendente', 'aviso'], PROBLEMA_DE_DADOS: ['Problema de dados', 'erro'], AVISO: ['Aviso', 'info'], INFORMACAO: ['Informação técnica', 'neutro'] };

  function html(s) {
    const b = s.byd;
    if (!b) return '';
    const ef = efetivo(s), estado = estadoAjustes(s), rec = S.ajustes.reconciliar(b, estado);
    const nAtivos = S.ajustes.ativos(estado).length;
    const pessoasLista = ef.pessoas.filter(p => !f.pessoa || UI.U.dobrar(`${p.nome} ${p.source_nome} ${p.matricula || ''} ${p.employee_id}`).includes(UI.U.dobrar(f.pessoa)));
    const lista = ef.habilidadesAtuais.filter(r => (!f.sheet || r.sheet === f.sheet) && (!f.status || r.assignment_status === f.status) && (!f.texto || UI.U.dobrar(`${r.nome} ${r.nome_na_matriz} ${r.station_code} ${r.descricao_pt} ${r.descricao_zh}`).includes(UI.U.dobrar(f.texto))));
    const porCat = {};
    for (const p of b.pendencias) { (porCat[p.categoria] = porCat[p.categoria] || {}); (porCat[p.categoria][p.codigo] = porCat[p.categoria][p.codigo] || []).push(p); }
    const validacaoOk = b.validacaoFinal.every(v => v.ok);
    return `<div class="panel bloco" id="painelBYD"><h3>Matriz de Habilidades BYD detectada<small>技能矩阵 · perfil ${esc(b.perfil)} · ${esc(b.arquivo)}</small></h3>
      <div class="sub" style="font-size:12px;color:#b6c6bf;margin-bottom:8px">Duas informações independentes por pessoa × operação: <b>nível</b> (só o marcador válido da Matriz: 1 = L; os níveis i/I/L/U não mudam) e <b>designação</b>, lida das formas desenhadas no Excel — ○ titular, △ em treinamento, ○+△ futuro titular. A cor da célula não conta: L verde, amarelo ou de outra cor é simplesmente L.</div>
      <div class="tabelaWrap"><table class="table"><thead><tr><th>Aba (modelo)</th><th>Pessoas</th><th>Operações</th><th>Nível L</th><th>○ Titulares</th><th>△ Em treinamento</th><th>○△ Futuros titulares</th><th>Com data</th><th>Problemas de dados</th></tr></thead><tbody>
        ${ef.resumo.map(r => `<tr><td><b>${esc(r.sheet)}</b>${r.ajustes_ativos ? ' ' + UI.tag(`${r.ajustes_ativos} ajustado(s)`, 'info') : ''}</td><td>${r.pessoas}</td><td>${r.operacoes}</td><td>${r.nivel_L}</td><td class="ok">${r.titulares}</td><td class="warn">${r.em_treinamento}</td><td>${r.futuros_titulares}</td><td>${r.com_data}</td><td>${r.problemas_de_dados}</td></tr>`).join('')}</tbody></table></div>
      ${nAtivos ? `<small style="color:#8fa39a">Valores efetivos: Matriz importada + ${nAtivos} ajuste(s) manual(is) ativo(s). A Matriz e a base importada não foram alteradas.</small>` : ''}
      ${rec.length ? `<div class="panel bloco" style="margin-top:10px;border-color:#7a6320" id="bydReconciliar"><h3>Ajustes manuais para revisar (${rec.length})<small>a Matriz foi relida · nada muda sem sua decisão</small></h3>
        ${rec.map(x => `<div class="parDup" data-rec="${esc(x.override_id)}"><div>${UI.tag(x.situacao === 'NAO_MAIS_NECESSARIO' ? 'Não é mais necessário' : x.situacao === 'ORFAO' ? 'Sem alvo na Matriz' : 'Matriz mudou', x.situacao === 'NAO_MAIS_NECESSARIO' ? 'ok' : 'aviso')} ${esc(x.mensagem)}
          <small style="display:block;color:#8fa39a">${esc(x.override.employee_id)}${x.override.operation_id ? ' · ' + esc(x.override.operation_id) : ''} · motivo: ${esc(x.override.reason || '—')} · ${esc(x.override.created_by || '')}</small></div>
          <div class="btnRow" style="margin:6px 0 0"><button class="btn sm primary bydRec" data-id="${esc(x.override_id)}" data-escolha="ENCERRAR">Encerrar ajuste</button><button class="btn sm bydRec" data-id="${esc(x.override_id)}" data-escolha="MANTER">Manter ajuste</button></div></div>`).join('')}</div>` : ''}
      ${b.pessoasParecidas.length ? `<div class="panel bloco" style="margin-top:10px;border-color:#7a6320"><h3>Possível mesma pessoa (${b.pessoasParecidas.length})<small>疑似同一人 · nada é unido sem sua confirmação</small></h3>
        ${b.pessoasParecidas.map((p, i) => `<div class="parDup" data-par="${i}"><div class="grid2"><div><b>${esc(p.a.nome)}</b><div style="color:#8fa39a;font-size:11px">abas ${esc(p.a.abas.join(', '))}</div></div><div><b>${esc(p.b.nome)}</b><div style="color:#8fa39a;font-size:11px">abas ${esc(p.b.abas.join(', '))}</div></div></div>
          <div style="margin:6px 0;font-size:12px">Nomes ${p.similaridade}% parecidos.</div>
          <div class="linhaForm"><label class="campo"><b>Nome que fica</b><select class="select bydCanonico" data-par="${i}">${[p.a.nome, p.b.nome].map(n => `<option ${n === p.sugestao_canonico ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
            <button class="btn sm primary bydPessoa" data-par="${i}" data-escolha="MESMA">✓ Mesma pessoa</button><button class="btn sm bydPessoa" data-par="${i}" data-escolha="DIFERENTES">Pessoas diferentes</button></div></div>`).join('')}
        <small style="color:#8fa39a">"Mesma pessoa" grava um alias PESSOA (vale nas próximas importações) e recalcula tudo: pessoas, habilidades, matriz, treinamentos e origem passam a usar um único employee_id.</small></div>` : ''}
      <details class="maisInfo" ${validacaoOk ? '' : 'open'}><summary>${validacaoOk ? '✓' : '⚠'} Validação final da importação</summary>
        <div class="checklist">${b.validacaoFinal.map(v => `<div><span class="${v.ok ? 'v' : 'x'}">${v.ok ? '✓' : '✕'}</span><span>${esc(v.item)}: <b>${esc(v.obtido)}</b>${v.esperado != null ? ` (esperado ${esc(v.esperado)})` : ''}<small>${esc(v.detalhe || '')}</small></span></div>`).join('')}</div></details>
      <div class="btnRow"><button class="btn primary" id="bydGerar">▦ Gerar Base Operacional BYD (.xlsx)</button><button class="btn" id="bydPend">⇩ Pendências (.xlsx)</button>
        <button class="btn fantasma" id="bydCarregarAjustes">⇧ Trazer ajustes de uma Base Operacional anterior</button><input type="file" id="bydArqAjustes" accept=".xlsx" hidden/>
        <small style="color:#8fa39a;align-self:center">PESSOAS, HABILIDADES_ATUAIS (valor efetivo), MATRIZ_LONGA, TREINAMENTOS, AJUSTES_MANUAIS, LOG_AJUSTES, HISTORICO_OFICIAL, ORIGEM_MAPEAMENTO, PENDENCIAS, VALIDACAO — o arquivo é reaberto e conferido depois de gerado. Não edite a Base Operacional à mão: use o perfil da pessoa.</small></div>
      <div id="bydResultado"></div>
      <h3 style="margin-top:14px">Pessoas (${ef.pessoas.length})<small>人员 · abra o perfil para editar, corrigir ou remover habilidades (vira ajuste manual, com desfazer)</small></h3>
      <div class="linhaForm"><label class="campo"><b>Procurar pessoa</b><input class="input" id="bydPessoaTexto" value="${esc(f.pessoa)}" placeholder="nome, matrícula ou ID"/></label></div>
      <div class="tabelaWrap" style="max-height:260px"><table class="table" id="bydPessoas"><thead><tr><th>Pessoa</th><th>Matrícula</th><th>Função</th><th>Abas</th><th>Ajustes</th><th></th></tr></thead><tbody>
        ${pessoasLista.map(p => `<tr><td>${esc(p.nome)}${p.nome !== p.source_nome ? ` <small style="color:#8fa39a">(Matriz: ${esc(p.source_nome)})</small>` : ''}<div class="mono" style="font-size:10px;color:#8fa39a">${esc(p.employee_id)}</div></td><td>${esc(p.matricula || '—')}</td><td>${esc(p.funcao || '—')}</td><td>${esc(p.abas || '')}</td>
          <td>${(() => { const n = S.ajustes.ativos(estado).filter(o => o.employee_id === p.source_employee_id).length; return n ? UI.tag(`${n} ativo(s)`, 'info') : ''; })()}</td><td><button class="btn sm bydPerfil" data-emp="${esc(p.source_employee_id)}">Abrir perfil</button></td></tr>`).join('')}</tbody></table></div>
      <h3 style="margin-top:14px">Habilidades atuais (${num(b.habilidadesAtuais.length)})<small>当前技能 · blocos com nível, forma ou data</small></h3>
      <div class="linhaForm"><label class="campo"><b>Aba</b><select class="select" id="bydSheet"><option value="">todas</option>${b.resumo.map(r => `<option ${f.sheet === r.sheet ? 'selected' : ''}>${esc(r.sheet)}</option>`).join('')}</select></label>
        <label class="campo"><b>Designação</b><select class="select" id="bydStatus"><option value="">todas</option>${Object.entries(ROT).map(([k, [t]]) => `<option value="${k}" ${f.status === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <label class="campo"><b>Procurar</b><input class="input" id="bydTexto" value="${esc(f.texto)}" placeholder="pessoa, estação, operação"/></label></div>
      <div class="tabelaWrap" style="max-height:460px"><table class="table dados"><thead><tr><th>Aba</th><th>Pessoa</th><th>Operação</th><th>Nível</th><th>Designação</th><th>Datas</th><th>Revisar</th><th>Ajuste</th><th class="so-implantador">Origem</th></tr></thead><tbody>
        ${lista.slice(0, 300).map(r => `<tr${r.desconsiderado ? ' style="opacity:.6"' : ''}><td>${esc(r.sheet)}</td><td><a href="#" class="bydPerfil" data-emp="${esc(r.source_employee_id)}">${esc(r.nome)}</a>${r.nome_na_matriz && UI.U.dobrar(r.nome_na_matriz) !== UI.U.dobrar(r.nome) ? ` <small style="color:#ffd66e" title="grafia na Matriz">(${esc(r.nome_na_matriz)})</small>` : ''}${r.papel ? ` <small style="color:#8fa39a">${esc(r.papel)}</small>` : ''}</td>
          <td class="quebra" style="max-width:340px"><b class="mono">${esc(r.station_code || '')}</b> ${esc(r.descricao_pt || '')}<div style="color:#8fa39a">${esc(r.descricao_zh || '')}</div></td>
          <td>${['i', 'I', 'L', 'U'].includes(r.skill_level) ? UI.tag(r.skill_level, r.skill_level === 'L' ? 'ok' : 'info') : `<span style="color:#8fa39a">${r.desconsiderado ? 'desconsiderado' : 'não identificado'}</span>`}</td>
          <td>${UI.tag(...ROT[r.assignment_status])}</td><td>${esc(r.first_date || '')}${r.latest_date && r.latest_date !== r.first_date ? ' → ' + esc(r.latest_date) : ''}</td>
          <td>${r.review_flags ? UI.tag(r.review_flags, 'aviso') : ''}</td>
          <td>${r.override_ids ? `${UI.tag(r.desconsiderado ? 'removido do C3B' : r.origem_efetiva === 'AJUSTE' ? 'adicionado' : 'ajustado', r.desconsiderado ? 'aviso' : 'info')}<div style="font-size:10px;color:#8fa39a">fonte: ${esc(r.source_skill_level)} / ${esc(r.source_assignment_status)}</div>` : ''}</td>
          <td class="so-implantador mono quebra" style="font-size:10px;max-width:280px">${esc(r.source_block)}${r.skill_level === 'L' ? ' · L ' + esc(r.source_l_cell) : ''}${r.source_circle_anchor ? '<br>○ ' + esc(r.source_circle_anchor) : ''}${r.source_triangle_anchor ? '<br>△ ' + esc(r.source_triangle_anchor) : ''}</td></tr>`).join('')}</tbody></table></div>
      ${lista.length > 300 ? `<small style="color:#8fa39a">Mostrando 300 de ${num(lista.length)}. A Base Operacional traz todas.</small>` : ''}
      <h3 style="margin-top:14px">Pendências (${b.pendencias.length})<small>待处理 · nada foi corrigido automaticamente</small></h3>
      ${Object.keys(CAT).filter(c => porCat[c]).map(c => `<div style="margin:8px 0"><b>${UI.tag(CAT[c][0], CAT[c][1])}</b> ${Object.values(porCat[c]).reduce((t, x) => t + x.length, 0)}
        ${Object.entries(porCat[c]).map(([cod, ps]) => `<details class="maisInfo" style="margin-left:14px"><summary>${esc(cod)} (${ps.length})</summary>${ps.slice(0, 60).map(p => `<div class="issue ${p.severidade}">${esc(p.mensagem)}</div>`).join('')}${ps.length > 60 ? `<small>… e mais ${ps.length - 60}.</small>` : ''}</details>`).join('')}</div>`).join('')}
    </div>`;
  }

  async function gerar(s) {
    const b = s.byd, st = UI.storage();
    const out = $('#bydResultado');
    out.innerHTML = '<div class="banner info">Gerando e conferindo…</div>';
    try {
      const t0 = performance.now();
      const op = { ExcelJS: window.ExcelJS, origem_hash: b.hash_origem, ajustes: estadoAjustes(s), config: s.pacote.config };
      const bytes = await S.byd.gerarBaseOperacional(b, op);
      const v = await S.byd.verificarBaseOperacional(bytes, b, op);
      if (!v.ok) throw new Error('o arquivo gerado não passou na conferência: ' + v.checks.filter(c => !c.ok).map(c => `${c.nome} (${c.detalhe})`).join('; '));
      const nome = `Base_Operacional_BYD__${S.util.carimbo()}.xlsx`;
      let onde, relido = null;
      if (st.suportaDiretorios && st.id !== 'download') {
        const dir = S.util.caminhoSeguro(UI.estado.raiz, 'EXPORTACOES');
        await st.createDirectory(dir); await st.writeFile(S.util.caminhoSeguro(dir, nome), bytes);
        relido = (await S.byd.verificarBaseOperacional(await st.readFile(S.util.caminhoSeguro(dir, nome)), b, op)).ok;
        onde = `${st.nome}: ${dir}/${nome}`;
      } else { UI.baixar(bytes, nome); onde = 'downloads do navegador'; }
      UI.medir('Base Operacional BYD', { arquivo: b.arquivo, tempo_ms: Math.round(performance.now() - t0), linhas: b.registros.length });
      out.innerHTML = `<div class="banner ok">✓ ${esc(nome)} gerada em ${esc(onde)} (${num(bytes.length)} bytes).<div class="checklist" style="margin-top:6px">${v.checks.map(c => `<div><span class="${c.ok ? 'v' : 'x'}">${c.ok ? '✓' : '✕'}</span><span>${esc(c.nome)}<small>${esc(c.detalhe)}</small></span></div>`).join('')}
        ${relido !== null ? `<div><span class="${relido ? 'v' : 'x'}">${relido ? '✓' : '✕'}</span><span>Relido do destino e conferido</span></div>` : '<div><span class="p">–</span><span>Releitura no destino<small>não é possível no modo downloads; conferido em memória antes de baixar</small></span></div>'}</div></div>`;
      UI.toast(`Base Operacional BYD gerada (${num(b.habilidadesAtuais.length)} habilidades atuais).`);
    } catch (e) { out.innerHTML = `<div class="banner erro">✕ ${esc(e.message)}</div>`; UI.erro(e, 'Base Operacional BYD'); }
  }

  function ligar(s) {
    if (!s || !s.byd) return;
    const re = () => UI.telas.importacao.render();
    $('#bydSheet').onchange = e => { f.sheet = e.target.value; re(); };
    $('#bydStatus').onchange = e => { f.status = e.target.value; re(); };
    $('#bydTexto').onchange = e => { f.texto = e.target.value; re(); };
    $('#bydGerar').onclick = () => gerar(s);
    $('#bydPessoaTexto').onchange = e => { f.pessoa = e.target.value; re(); };
    $$('.bydPerfil').forEach(el => el.onclick = ev => { ev.preventDefault(); UI.perfilBYD.abrir(s, el.dataset.emp); });
    $$('.bydRec').forEach(btn => btn.onclick = () => {
      const estado = estadoAjustes(s), id = btn.dataset.id, x = S.ajustes.reconciliar(s.byd, estado).find(y => y.override_id === id);
      try {
        if (btn.dataset.escolha === 'ENCERRAR') { S.ajustes.encerrar(estado, id, { por: UI.usuario(), motivo: x ? x.situacao : '' }); UI.toast(`${id} encerrado: vale o valor da Matriz.`); }
        else { S.ajustes.manter(estado, id, x ? x.fonte_atual : null, { por: UI.usuario() }); UI.toast(`${id} mantido: continua valendo o ajuste.`); }
        UI.salvarProjeto(); re();
      } catch (e) { UI.erro(e, 'Ajustes'); }
    });
    $('#bydCarregarAjustes').onclick = () => $('#bydArqAjustes').click();
    $('#bydArqAjustes').onchange = async e => {
      const arq = e.target.files[0];
      if (!arq) return;
      try {
        const lido = await S.byd.lerAjustesDaBase(new Uint8Array(await arq.arrayBuffer()), { ExcelJS: window.ExcelJS });
        // não mistura dois históricos de ajustes: só traz para um projeto que ainda não tem ajustes
        if (estadoAjustes(s).overrides.length) throw new Error('Este projeto já tem ajustes próprios; para não misturar históricos, nada foi importado.');
        s.pacote.config.ajustes = lido;
        UI.salvarProjeto();
        UI.toast(`${lido.overrides.length} ajuste(s) trazido(s) de ${arq.name} (${S.ajustes.ativos(lido).length} ativo(s)). Confira a revisão abaixo.`);
        re();
      } catch (err) { UI.erro(err, 'Ajustes'); }
    };
    $$('.bydPessoa').forEach(btn => btn.onclick = async () => {
      const i = +btn.dataset.par, par = s.byd.pessoasParecidas[i];
      const canonico = $(`.bydCanonico[data-par="${i}"]`).value;
      try {
        await S.importacao.decidirPessoaBYD(s, i, btn.dataset.escolha, { canonico });
        UI.salvarProjeto();
        UI.toast(btn.dataset.escolha === 'MESMA' ? `Unificado: "${par.a.nome}" e "${par.b.nome}" → ${canonico}. Alias gravado; base recalculada.` : 'Registrado: pessoas diferentes (não será perguntado de novo).');
        re();
      } catch (e) { UI.erro(e, 'Pessoas'); }
    });
    $('#bydPend').onclick = async () => {
      const iss = s.byd.pendencias.map(p => ({ severidade: p.severidade, schema: p.sheet || '', linha: null, campo: p.cell || '', valor: p.employee_id || '', mensagem: `[${(CAT[p.categoria] || [p.categoria])[0]}] ${p.mensagem}`, comoResolver: '', codigo: p.codigo }));
      UI.baixar(await S.relatorios.exportarErros(iss, { ...UI.opcoesExcel(), apenas: ['INFO', 'WARNING', 'ERROR', 'BLOCKING'] }), `PENDENCIAS_MATRIZ_BYD_${S.util.carimbo()}.xlsx`);
    };
  }

  UI.painelBYD = { html, ligar };
})();
