// Painel "Matriz BYD" (dentro da tela Importação): resultado real do perfil BYD_SKILL_MATRIX_V1 —
// nível (marcador 1), designação (formas ○ △ do Excel), cor do bloco, datas, pendências e a Base Operacional.
(function () {
  'use strict';
  const { $, $$, esc, num, S } = UI;
  const f = { sheet: '', status: '', texto: '' };
  const ROT = { TITULAR: ['○ Titular', 'ok'], EM_TREINAMENTO: ['△ Em treinamento', 'aviso'], FUTURO_TITULAR: ['○△ Futuro titular', 'info'], SEM_DESIGNACAO: ['Sem designação', 'neutro'] };
  const chip = r => r.fill_rgb && r.fill_state !== 'NONE' ? `<span title="${esc(r.fill_rgb)} · ${esc(r.fill_source)}" style="display:inline-block;width:12px;height:12px;border-radius:3px;border:1px solid #445;vertical-align:middle;background:#${esc(r.fill_rgb.slice(-6))}"></span> ${esc(r.fill_state)}` : '<span style="color:#56685f">—</span>';

  function html(s) {
    const b = s.byd;
    if (!b) return '';
    const lista = b.habilidadesAtuais.filter(r => (!f.sheet || r.sheet === f.sheet) && (!f.status || r.assignment_status === f.status) && (!f.texto || UI.U.dobrar(`${r.nome} ${r.station_code} ${r.descricao_pt} ${r.descricao_zh}`).includes(UI.U.dobrar(f.texto))));
    const grupos = {};
    for (const p of b.pendencias) { const k = `${p.severidade}|${p.codigo}`; (grupos[k] = grupos[k] || []).push(p); }
    const ordemSev = { BLOCKING: 0, ERROR: 1, WARNING: 2, INFO: 3 };
    return `<div class="panel bloco" id="painelBYD"><h3>Matriz de Habilidades BYD detectada<small>技能矩阵 · perfil ${esc(b.perfil)} · ${esc(b.arquivo)}</small></h3>
      <div class="sub" style="font-size:12px;color:#b6c6bf;margin-bottom:8px">Duas informações independentes por pessoa × operação: <b>nível</b> (marcador oculto 1 = L; os níveis i/I/L/U não mudam) e <b>designação</b>, lida das formas desenhadas no Excel — ○ operador atual, △ programado para treinamento, ○+△ futuro titular. A cor do bloco é preservada como está, sem significado atribuído. Datas não definem designação.</div>
      <div class="tabelaWrap"><table class="table"><thead><tr><th>Aba (modelo)</th><th>Pessoas</th><th>Operações</th><th>Nível L</th><th>○ Titulares</th><th>△ Em treinamento</th><th>○△ Futuros titulares</th><th>Verde</th><th>Amarelo</th><th>Outra cor</th><th>Com data</th><th>Pendências</th></tr></thead><tbody>
        ${b.resumo.map(r => `<tr><td><b>${esc(r.sheet)}</b></td><td>${r.operadores}</td><td>${r.operacoes}</td><td>${r.nivel_L}</td><td class="ok">${r.titulares}</td><td class="warn">${r.em_treinamento}</td><td>${r.futuros_titulares}</td><td>${r.fill_green}</td><td>${r.fill_yellow}</td><td>${r.fill_other}</td><td>${r.com_data}</td><td>${r.pendencias}</td></tr>`).join('')}</tbody></table></div>
      <div class="btnRow"><button class="btn primary" id="bydGerar">▦ Gerar Base Operacional BYD (.xlsx)</button><button class="btn" id="bydPend">⇩ Pendências (.xlsx)</button>
        <small style="color:#8fa39a;align-self:center">HABILIDADES_ATUAIS, MATRIZ_LONGA, ORIGEM_MAPEAMENTO (células e formas), PENDENCIAS — o arquivo é reaberto e conferido depois de gerado.</small></div>
      <div id="bydResultado"></div>
      <h3 style="margin-top:14px">Habilidades atuais (${num(b.habilidadesAtuais.length)})<small>当前技能 · blocos com nível, forma, data ou cor</small></h3>
      <div class="linhaForm"><label class="campo"><b>Aba</b><select class="select" id="bydSheet"><option value="">todas</option>${b.resumo.map(r => `<option ${f.sheet === r.sheet ? 'selected' : ''}>${esc(r.sheet)}</option>`).join('')}</select></label>
        <label class="campo"><b>Designação</b><select class="select" id="bydStatus"><option value="">todas</option>${Object.entries(ROT).map(([k, [t]]) => `<option value="${k}" ${f.status === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <label class="campo"><b>Procurar</b><input class="input" id="bydTexto" value="${esc(f.texto)}" placeholder="pessoa, estação, operação"/></label></div>
      <div class="tabelaWrap" style="max-height:460px"><table class="table dados"><thead><tr><th>Aba</th><th>Pessoa</th><th>Operação</th><th>Nível</th><th>Designação</th><th>Cor</th><th>Datas</th><th>Revisar</th><th class="so-implantador">Origem</th></tr></thead><tbody>
        ${lista.slice(0, 300).map(r => `<tr><td>${esc(r.sheet)}</td><td>${esc(r.nome)}${r.papel ? ` <small style="color:#8fa39a">${esc(r.papel)}</small>` : ''}</td>
          <td class="quebra" style="max-width:340px"><b class="mono">${esc(r.station_code || '')}</b> ${esc(r.descricao_pt || '')}<div style="color:#8fa39a">${esc(r.descricao_zh || '')}</div></td>
          <td>${r.skill_level === 'L' ? UI.tag('L', 'ok') : '<span style="color:#8fa39a">não identificado</span>'}</td>
          <td>${UI.tag(...ROT[r.assignment_status])}</td><td>${chip(r)}</td><td>${esc(r.first_date || '')}${r.latest_date && r.latest_date !== r.first_date ? ' → ' + esc(r.latest_date) : ''}</td>
          <td>${r.review_flags ? UI.tag(r.review_flags, 'aviso') : ''}</td>
          <td class="so-implantador mono quebra" style="font-size:10px;max-width:280px">${esc(r.source_block)}${r.skill_level === 'L' ? ' · L ' + esc(r.source_l_cell) : ''}${r.source_circle_anchor ? '<br>○ ' + esc(r.source_circle_anchor) : ''}${r.source_triangle_anchor ? '<br>△ ' + esc(r.source_triangle_anchor) : ''}</td></tr>`).join('')}</tbody></table></div>
      ${lista.length > 300 ? `<small style="color:#8fa39a">Mostrando 300 de ${num(lista.length)}. A Base Operacional traz todas.</small>` : ''}
      <h3 style="margin-top:14px">Pendências (${b.pendencias.length})<small>待处理 · nada foi corrigido automaticamente</small></h3>
      ${Object.entries(grupos).sort((a, b2) => ordemSev[a[0].split('|')[0]] - ordemSev[b2[0].split('|')[0]]).map(([k, ps]) => `<details class="maisInfo"><summary>${UI.tagSev(k.split('|')[0])} ${esc(k.split('|')[1])} (${ps.length})</summary>
        ${ps.slice(0, 60).map(p => `<div class="issue ${p.severidade}">${esc(p.mensagem)}</div>`).join('')}${ps.length > 60 ? `<small>… e mais ${ps.length - 60}.</small>` : ''}</details>`).join('')}
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
    $('#bydPend').onclick = async () => {
      const iss = s.byd.pendencias.map(p => ({ severidade: p.severidade, schema: p.sheet || '', linha: null, campo: p.cell || '', valor: p.employee_id || '', mensagem: p.mensagem, comoResolver: '', codigo: p.codigo }));
      UI.baixar(await S.relatorios.exportarErros(iss, { ...UI.opcoesExcel(), apenas: ['INFO', 'WARNING', 'ERROR', 'BLOCKING'] }), `PENDENCIAS_MATRIZ_BYD_${S.util.carimbo()}.xlsx`);
    };
  }

  UI.painelBYD = { html, ligar };
})();
