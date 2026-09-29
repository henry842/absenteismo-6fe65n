// Tela Histórico: lotes de importação (relatório, log de transformações, pendências), log de gravações,
// decisões registradas e versões dos arquivos (listar, comparar, restaurar com backup antes).
(function () {
  'use strict';
  const { $, $$, esc, num, S, D } = UI;
  const v = { base: 'PEOPLE', lista: null, marcadas: [], comparacao: null, carregando: false };

  function render() {
    const el = $('#telaHistorico');
    const p = UI.pacote();
    const lotes = p.lotes.slice().reverse();
    const st = UI.storage();
    el.innerHTML = `<div class="telaHead"><div><h2>Histórico <small>历史记录 · auditoria</small></h2>
      <div class="sub">Tudo o que foi importado, decidido e gravado fica registrado: arquivo de origem, quem executou, o que mudou e por quê.</div></div></div>
      <div class="panel bloco"><h3>Importações (${lotes.length})<small>导入批次</small></h3>
        ${lotes.length ? `<div class="tabelaWrap"><table class="table dados"><thead><tr><th>Lote</th><th>Arquivo</th><th>Modo</th><th>Estado</th><th>Abas</th><th>Importados</th><th>Pendências</th><th>Por</th><th>Quando</th><th></th></tr></thead><tbody>
        ${lotes.map((l, i) => { const sev = (l.issues || []).reduce((c, x) => (c[x.severidade] = (c[x.severidade] || 0) + 1, c), {});
          return `<tr><td class="mono">${esc(l.import_batch_id)}</td><td>${esc(l.arquivo ? l.arquivo.nome : '—')}</td><td>${esc(l.modo)}</td><td>${UI.tag(l.estado, l.estado === 'COMPLETED' ? 'ok' : l.estado === 'FAILED' ? 'erro' : 'neutro')}</td>
          <td>${(l.abas || []).map(a => esc(a.aba + '→' + a.schema)).join('<br>')}</td><td>${num((l.abas || []).reduce((t, a) => t + a.importados, 0))}</td>
          <td>${sev.BLOCKING ? UI.tagSev('BLOCKING') + sev.BLOCKING + ' ' : ''}${sev.ERROR ? UI.tagSev('ERROR') + sev.ERROR + ' ' : ''}${sev.WARNING ? UI.tagSev('WARNING') + sev.WARNING : ''}</td>
          <td>${esc(l.executado_por)}</td><td>${UI.dataHora(l.finalizado_em || l.iniciado_em)}</td>
          <td><button class="btn sm relLote" data-i="${p.lotes.length - 1 - i}">⇩ Relatório</button> <button class="btn sm logLote" data-i="${p.lotes.length - 1 - i}">Transformações</button></td></tr>`; }).join('')}</tbody></table></div>`
        : UI.vazio('Nenhuma importação registrada.')}</div>
      <div class="panel bloco"><h3>Versões dos arquivos<small>版本 · 对比 · 恢复</small></h3>${versoesHTML(st)}</div>
      <div class="grid2">
        <div class="panel bloco"><h3>Gravações e edições (${p.logs.length})<small>写入日志</small></h3>
          ${p.logs.length ? `<div style="max-height:360px;overflow:auto">${p.logs.slice().reverse().slice(0, 200).map(l => `<div class="issue INFO"><b>${esc(l.acao)}</b> · ${esc(l.schema || '')} ${l.data_version ? 'v' + l.data_version : ''} · ${UI.dataHora(l.em)} · ${esc(l.usuario || '')}
            <small>${l.acao === 'GRAVAR_BASE' ? `${esc(l.arquivo)}${l.backup ? ' · backup ' + esc(l.backup) : ''}${l.comparacao ? ` · +${l.comparacao.adicionados} / ~${l.comparacao.alterados} / =${l.comparacao.inalterados} / ausentes ${l.comparacao.ausentes}` : ''}${l.override ? ' · liberado: ' + esc(l.override.motivo) : ''}<span class="so-implantador"> · sha256 ${esc(String(l.hash || '').slice(0, 16))}…</span>`
              : l.acao === 'EDICAO_EM_MASSA' ? `${esc(l.registro)} · ${esc(l.campo)}: ${esc(l.de ?? '—')} → ${esc(l.para)}` : esc(JSON.stringify(l).slice(0, 200))}</small></div>`).join('')}</div>` : UI.vazio('Nada gravado ainda.')}</div>
        <div class="panel bloco"><h3>Decisões registradas (${p.config.decisoes.length})<small>决策记录</small></h3>
          ${p.config.decisoes.length ? `<div style="max-height:360px;overflow:auto">${p.config.decisoes.slice().reverse().map(d => `<div class="issue ${d.tipo === 'LIBERACAO_BLOQUEIO' ? 'WARNING' : 'INFO'}"><b>${esc(d.tipo)}</b> · ${esc(d.decidido_por)} · ${UI.dataHora(d.decidido_em)}<small>${esc(d.detalhe)}</small></div>`).join('')}</div>` : UI.vazio('Nenhuma decisão ainda.')}</div>
      </div>`;
    ligar(p, st);
  }

  function versoesHTML(st) {
    if (!st.suportaLeitura) return `<div class="banner info">Versões e restauração precisam ler a pasta das bases. No modo "Downloads do navegador" isso não é possível: escolha uma pasta (Chrome/Edge) ou conecte o Bridge local em Configurações.</div>`;
    const bases = ['PEOPLE', 'OPERATIONS', 'SKILLS', 'HISTORY', 'TRAINING', 'ATTENDANCE'];
    return `<div class="linhaForm"><label class="campo"><b>Base</b><select class="select" id="verBase">${bases.map(b => `<option value="${b}" ${v.base === b ? 'selected' : ''}>${esc(UI.nomeSchema(b))}</option>`).join('')}</select></label>
      <button class="btn sm" id="verListar">${v.carregando ? 'Lendo…' : 'Listar versões'}</button>
      <button class="btn sm" id="verComparar" ${v.marcadas.length === 2 ? '' : 'disabled'}>Comparar 2 marcadas</button></div>
      ${v.lista ? (v.lista.length ? `<table class="table"><thead><tr><th></th><th>Versão</th><th>Arquivo</th><th>Data do backup</th><th>Tamanho</th><th></th></tr></thead><tbody>
        ${v.lista.map((x, i) => `<tr><td><input type="checkbox" class="verMarcar" data-i="${i}" ${v.marcadas.includes(i) ? 'checked' : ''}/></td><td>v${x.versao ?? '?'} ${x.atual ? UI.tag('atual', 'ok') : ''}</td><td class="mono">${esc(x.arquivo)}</td>
          <td>${x.carimbo ? esc(x.carimbo.replace(/^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})$/, '$3/$2/$1 $4:$5:$6')) : '—'}</td><td>${x.tamanho ? num(x.tamanho) + ' B' : ''}</td>
          <td>${!x.atual ? `<button class="btn sm aviso so-implantador verRestaurar" data-i="${i}">Restaurar esta versão</button>` : ''}</td></tr>`).join('')}</tbody></table>` : UI.vazio('Nenhuma versão encontrada para esta base.')) : ''}
      ${v.comparacao ? comparacaoHTML(v.comparacao) : ''}`;
  }

  function comparacaoHTML(c) {
    return `<div class="banner info" style="margin-top:10px">v${esc(c.versaoA)} → v${esc(c.versaoB)}: <b>${c.adicionados.length}</b> adicionados · <b>${c.alterados.length}</b> alterados · <b>${c.inalterados.length}</b> iguais · <b>${c.ausentesNoNovo.length}</b> removidos</div>
      ${c.alterados.length ? `<div class="tabelaWrap" style="max-height:260px"><table class="table dados"><thead><tr><th>Registro</th><th>Campo</th><th>v${esc(c.versaoA)}</th><th>v${esc(c.versaoB)}</th></tr></thead><tbody>
      ${c.alterados.slice(0, 200).flatMap(a => a.campos.map(f => `<tr><td class="mono">${esc(a.chave)}</td><td>${esc(f)}</td><td style="color:#ffd9a6">${esc(a.antes[f])}</td><td style="color:#7dffc0">${esc(a.depois[f])}</td></tr>`)).join('')}</tbody></table></div>` : ''}`;
  }

  function ligar(p, st) {
    $$('.relLote').forEach(b => b.onclick = async () => {
      const l = p.lotes[+b.dataset.i];
      try { UI.baixar(await S.relatorios.relatorioImportacao(l, UI.opcoesExcel()), `RELATORIO_${l.import_batch_id}.xlsx`); } catch (e) { UI.erro(e, 'Relatório'); }
    });
    $$('.logLote').forEach(b => b.onclick = () => {
      const l = p.lotes[+b.dataset.i], log = l.log || [];
      UI.modal(`<h3>Transformações · ${esc(l.import_batch_id)} (${log.length})</h3>
        <div class="tabelaWrap" style="max-height:60vh"><table class="table dados"><thead><tr><th>Aba</th><th>Linha</th><th>Campo</th><th>Original</th><th>Padrão C3B</th><th>Regra</th><th>Confiança</th><th>Decisão</th></tr></thead><tbody>
        ${log.slice(0, 1000).map(x => `<tr><td>${esc(x.aba)}</td><td>${x.row_id}</td><td>${esc(x.field)}</td><td class="mono">${esc(x.original_value)}</td><td class="mono" style="color:#7dffc0">${esc(x.normalized_value ?? '—')}</td><td class="mono">${esc(x.rule)}</td><td>${Math.round((x.confidence ?? 1) * 100)}%</td><td>${esc(x.decision)}</td></tr>`).join('')}</tbody></table></div>
        ${log.length > 1000 ? '<small>Mostrando 1000. O relatório .xlsx traz todas.</small>' : ''}<div class="modalActions"><button class="btn" data-fechar>Fechar</button></div>`);
    });
    if (!st.suportaLeitura) return;
    $('#verBase').onchange = e => { v.base = e.target.value; v.lista = null; v.marcadas = []; v.comparacao = null; render(); };
    $('#verListar').onclick = async () => {
      v.carregando = true; render();
      try { v.lista = await S.listVersions(st, UI.estado.raiz, v.base, UI.opcoesExcel()); v.marcadas = []; v.comparacao = null; }
      catch (e) { UI.erro(e, 'Versões'); } finally { v.carregando = false; render(); }
    };
    $$('.verMarcar').forEach(c => c.onchange = () => { const i = +c.dataset.i; v.marcadas = c.checked ? v.marcadas.concat(i).slice(-2) : v.marcadas.filter(x => x !== i); render(); });
    $('#verComparar').onclick = async () => {
      try { const [a, b] = v.marcadas.slice().sort((x, y) => x - y).map(i => v.lista[i]); v.comparacao = await S.compareFiles(st, a.arquivo, b.arquivo, UI.opcoesExcel()); render(); }
      catch (e) { UI.erro(e, 'Comparar'); }
    };
    $$('.verRestaurar').forEach(b => b.onclick = async () => {
      const x = v.lista[+b.dataset.i];
      if (!(await UI.confirmar(`Restaurar ${UI.nomeSchema(v.base)} v${x.versao}?`, 'Antes de restaurar, o arquivo atual vai para BACKUP. A versão antiga é gravada como uma NOVA versão (nada é apagado), com "restored_from" no _META.', { botao: 'Restaurar' }))) return;
      try {
        const r = await S.restoreVersion(st, UI.estado.raiz, p, v.base, x.arquivo, { usuario: UI.usuario(), ExcelJS: window.ExcelJS });
        if (!r.ok) throw new Error(r.erro);
        UI.salvarProjeto(); UI.toast(`Restaurada a v${r.restauradaDe} como v${r.dataVersion}. Backup do anterior: ${r.backup || '—'}.`);
        v.lista = await S.listVersions(st, UI.estado.raiz, v.base, UI.opcoesExcel()); render();
      } catch (e) { UI.erro(e, 'Restaurar'); }
    });
  }

  UI.telas.historico = { render };
})();
