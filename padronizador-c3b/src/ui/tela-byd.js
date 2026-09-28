// Painel "Matriz BYD" (dentro da tela Importação): resultado real do perfil BYD_SKILL_MATRIX_V1 —
// nível (marcador 1), designação (formas ○ △ do Excel), cor do bloco, datas, pendências e a Base Operacional.
(function () {
  'use strict';
  const { $, $$, esc, num, S } = UI;
  const f = { sheet: '', status: '', texto: '' };
  const ROT = { TITULAR: ['○ Titular', 'ok'], EM_TREINAMENTO: ['△ Em treinamento', 'aviso'], FUTURO_TITULAR: ['○△ Futuro titular', 'info'], SEM_DESIGNACAO: ['Sem designação', 'neutro'] };

  const CAT = { CONFIGURACAO_PENDENTE: ['Configuração pendente', 'aviso'], PROBLEMA_DE_DADOS: ['Problema de dados', 'erro'], AVISO: ['Aviso', 'info'], INFORMACAO: ['Informação técnica', 'neutro'] };

  function html(s) {
    const b = s.byd;
    if (!b) return '';
    const lista = b.habilidadesAtuais.filter(r => (!f.sheet || r.sheet === f.sheet) && (!f.status || r.assignment_status === f.status) && (!f.texto || UI.U.dobrar(`${r.nome} ${r.nome_na_matriz} ${r.station_code} ${r.descricao_pt} ${r.descricao_zh}`).includes(UI.U.dobrar(f.texto))));
    const porCat = {};
    for (const p of b.pendencias) { (porCat[p.categoria] = porCat[p.categoria] || {}); (porCat[p.categoria][p.codigo] = porCat[p.categoria][p.codigo] || []).push(p); }
    const validacaoOk = b.validacaoFinal.every(v => v.ok);
    return `<div class="panel bloco" id="painelBYD"><h3>Matriz de Habilidades BYD detectada<small>技能矩阵 · perfil ${esc(b.perfil)} · ${esc(b.arquivo)}</small></h3>
      <div class="sub" style="font-size:12px;color:#b6c6bf;margin-bottom:8px">Duas informações independentes por pessoa × operação: <b>nível</b> (só o marcador válido da Matriz: 1 = L; os níveis i/I/L/U não mudam) e <b>designação</b>, lida das formas desenhadas no Excel — ○ titular, △ em treinamento, ○+△ futuro titular. A cor da célula não conta: L verde, amarelo ou de outra cor é simplesmente L.</div>
      <div class="tabelaWrap"><table class="table"><thead><tr><th>Aba (modelo)</th><th>Pessoas</th><th>Operações</th><th>Nível L</th><th>○ Titulares</th><th>△ Em treinamento</th><th>○△ Futuros titulares</th><th>Com data</th><th>Problemas de dados</th></tr></thead><tbody>
        ${b.resumo.map(r => `<tr><td><b>${esc(r.sheet)}</b></td><td>${r.pessoas}</td><td>${r.operacoes}</td><td>${r.nivel_L}</td><td class="ok">${r.titulares}</td><td class="warn">${r.em_treinamento}</td><td>${r.futuros_titulares}</td><td>${r.com_data}</td><td>${r.problemas_de_dados}</td></tr>`).join('')}</tbody></table></div>
      ${b.pessoasParecidas.length ? `<div class="panel bloco" style="margin-top:10px;border-color:#7a6320"><h3>Possível mesma pessoa (${b.pessoasParecidas.length})<small>疑似同一人 · nada é unido sem sua confirmação</small></h3>
        ${b.pessoasParecidas.map((p, i) => `<div class="parDup" data-par="${i}"><div class="grid2"><div><b>${esc(p.a.nome)}</b><div style="color:#8fa39a;font-size:11px">abas ${esc(p.a.abas.join(', '))}</div></div><div><b>${esc(p.b.nome)}</b><div style="color:#8fa39a;font-size:11px">abas ${esc(p.b.abas.join(', '))}</div></div></div>
          <div style="margin:6px 0;font-size:12px">Nomes ${p.similaridade}% parecidos.</div>
          <div class="linhaForm"><label class="campo"><b>Nome que fica</b><select class="select bydCanonico" data-par="${i}">${[p.a.nome, p.b.nome].map(n => `<option ${n === p.sugestao_canonico ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
            <button class="btn sm primary bydPessoa" data-par="${i}" data-escolha="MESMA">✓ Mesma pessoa</button><button class="btn sm bydPessoa" data-par="${i}" data-escolha="DIFERENTES">Pessoas diferentes</button></div></div>`).join('')}
        <small style="color:#8fa39a">"Mesma pessoa" grava um alias PESSOA (vale nas próximas importações) e recalcula tudo: pessoas, habilidades, matriz, treinamentos e origem passam a usar um único employee_id.</small></div>` : ''}
      <details class="maisInfo" ${validacaoOk ? '' : 'open'}><summary>${validacaoOk ? '✓' : '⚠'} Validação final da importação</summary>
        <div class="checklist">${b.validacaoFinal.map(v => `<div><span class="${v.ok ? 'v' : 'x'}">${v.ok ? '✓' : '✕'}</span><span>${esc(v.item)}: <b>${esc(v.obtido)}</b>${v.esperado != null ? ` (esperado ${esc(v.esperado)})` : ''}<small>${esc(v.detalhe || '')}</small></span></div>`).join('')}</div></details>
      <div class="btnRow"><button class="btn primary" id="bydGerar">▦ Gerar Base Operacional BYD (.xlsx)</button><button class="btn" id="bydPend">⇩ Pendências (.xlsx)</button>
        <small style="color:#8fa39a;align-self:center">PESSOAS, HABILIDADES_ATUAIS, MATRIZ_LONGA, TREINAMENTOS, ORIGEM_MAPEAMENTO, PENDENCIAS, VALIDACAO — o arquivo é reaberto e conferido depois de gerado.</small></div>
      <div id="bydResultado"></div>
      <h3 style="margin-top:14px">Habilidades atuais (${num(b.habilidadesAtuais.length)})<small>当前技能 · blocos com nível, forma ou data</small></h3>
      <div class="linhaForm"><label class="campo"><b>Aba</b><select class="select" id="bydSheet"><option value="">todas</option>${b.resumo.map(r => `<option ${f.sheet === r.sheet ? 'selected' : ''}>${esc(r.sheet)}</option>`).join('')}</select></label>
        <label class="campo"><b>Designação</b><select class="select" id="bydStatus"><option value="">todas</option>${Object.entries(ROT).map(([k, [t]]) => `<option value="${k}" ${f.status === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <label class="campo"><b>Procurar</b><input class="input" id="bydTexto" value="${esc(f.texto)}" placeholder="pessoa, estação, operação"/></label></div>
      <div class="tabelaWrap" style="max-height:460px"><table class="table dados"><thead><tr><th>Aba</th><th>Pessoa</th><th>Operação</th><th>Nível</th><th>Designação</th><th>Datas</th><th>Revisar</th><th class="so-implantador">Origem</th></tr></thead><tbody>
        ${lista.slice(0, 300).map(r => `<tr><td>${esc(r.sheet)}</td><td>${esc(r.nome)}${r.nome_na_matriz && UI.U.dobrar(r.nome_na_matriz) !== UI.U.dobrar(r.nome) ? ` <small style="color:#ffd66e" title="grafia na Matriz">(${esc(r.nome_na_matriz)})</small>` : ''}${r.papel ? ` <small style="color:#8fa39a">${esc(r.papel)}</small>` : ''}</td>
          <td class="quebra" style="max-width:340px"><b class="mono">${esc(r.station_code || '')}</b> ${esc(r.descricao_pt || '')}<div style="color:#8fa39a">${esc(r.descricao_zh || '')}</div></td>
          <td>${r.skill_level === 'L' ? UI.tag('L', 'ok') : '<span style="color:#8fa39a">não identificado</span>'}</td>
          <td>${UI.tag(...ROT[r.assignment_status])}</td><td>${esc(r.first_date || '')}${r.latest_date && r.latest_date !== r.first_date ? ' → ' + esc(r.latest_date) : ''}</td>
          <td>${r.review_flags ? UI.tag(r.review_flags, 'aviso') : ''}</td>
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
      const bytes = await S.byd.gerarBaseOperacional(b, { ExcelJS: window.ExcelJS, origem_hash: b.hash_origem });
      const v = await S.byd.verificarBaseOperacional(bytes, b, { ExcelJS: window.ExcelJS });
      if (!v.ok) throw new Error('o arquivo gerado não passou na conferência: ' + v.checks.filter(c => !c.ok).map(c => `${c.nome} (${c.detalhe})`).join('; '));
      const nome = `Base_Operacional_BYD__${S.util.carimbo()}.xlsx`;
      let onde, relido = null;
      if (st.suportaDiretorios && st.id !== 'download') {
        const dir = S.util.caminhoSeguro(UI.estado.raiz, 'EXPORTACOES');
        await st.createDirectory(dir); await st.writeFile(S.util.caminhoSeguro(dir, nome), bytes);
        relido = (await S.byd.verificarBaseOperacional(await st.readFile(S.util.caminhoSeguro(dir, nome)), b, { ExcelJS: window.ExcelJS })).ok;
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
