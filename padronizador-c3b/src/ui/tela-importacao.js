// Tela Importação: arquivo lido, abas encontradas, schema de cada aba, cabeçalho, amostra, perfis compatíveis.
(function () {
  'use strict';
  const { $, $$, esc, num, S, D } = UI;
  const IMP = () => S.importacao;
  const perfilAplicado = {};

  function render() {
    const el = $('#telaImportacao');
    const s = UI.estado.sessao;
    const cab = `<div class="telaHead"><div><h2>1. Importação <small>导入 · escolha o que importar</small></h2>
      <div class="sub">Marque as abas que viram bases oficiais. O Padronizador sugere o tipo de cada aba pelos nomes das colunas e pelos valores; você confirma.</div></div>
      <div class="btnRow" style="margin:0"><button class="btn primary" id="novaImp">⇧ Selecionar arquivo</button></div></div>`;
    if (!s) { el.innerHTML = cab + `<div class="panel bloco">${UI.vazio('Nenhum arquivo carregado.', 'Clique em "Selecionar arquivo" ou arraste uma planilha. Sem planilha? Use "Nova Implantação" na tela Início.')}</div>`; ligar(); return; }
    const a = s.analise ? s.analise.arquivo : {};
    const selecionadas = s.abas.filter(x => x.selecionada);
    el.innerHTML = cab + `
      ${s.modo !== 'IMPORTACAO' ? `<div class="banner info"><b>${s.modo === 'ANALISE' ? 'Modo "Analisar sem alterar nada"' : 'Modo "Simular padronização"'}</b> — nenhuma base será alterada nesta sessão.</div>` : ''}
      <div class="grid4">
        <div class="panel bloco"><h3>Arquivo<small>文件</small></h3><div class="mono" style="word-break:break-all">${esc(a.nome || s.lote.arquivo && s.lote.arquivo.nome)}</div>
          <div style="margin-top:8px;font-size:12px;color:#b6c6bf">${a.tamanho != null ? (a.tamanho / 1024).toFixed(1) + ' KB · ' : ''}.${esc(a.extensao || a.formato)}${a.codificacao ? ' · ' + esc(a.codificacao) + ' · separador "' + esc(a.separador === '\t' ? 'TAB' : a.separador) + '"' : ''}</div>
          ${a.modificado ? `<div style="font-size:11px;color:#8fa39a;margin-top:4px">Modificado em ${UI.dataHora(a.modificado)}</div>` : ''}
          <div class="so-implantador mono" style="font-size:10px;color:#6f877d;margin-top:6px">SHA-256 ${esc((a.hash || '').slice(0, 24))}…</div></div>
        <div class="panel bloco"><h3>Abas<small>工作表</small></h3><b style="font-size:26px">${num(s.abas.filter(x => !x.virtual).length)}</b><div style="font-size:12px;color:#b6c6bf">${num(selecionadas.length)} marcada(s) para importar</div></div>
        <div class="panel bloco"><h3>Lote<small>批次</small></h3><div class="mono">${esc(s.lote.import_batch_id)}</div><div style="margin-top:6px">${UI.tag(s.lote.estado, s.lote.estado === 'FAILED' ? 'erro' : 'info')}</div></div>
        <div class="panel bloco"><h3>Próximo passo<small>下一步</small></h3>
          <button class="btn primary" id="irMapear" ${selecionadas.length ? '' : 'disabled'}>◎ Mapear ${selecionadas.length} aba(s)</button>${s.byd && !selecionadas.length ? '<div style="font-size:11px;color:#7dffc0;margin-top:6px">Matriz BYD: veja o painel abaixo.</div>' : ''}
          <button class="btn sm fantasma" id="cancelarSessao" style="margin-top:8px">Cancelar esta importação</button></div>
      </div>
      ${UI.painelBYD ? UI.painelBYD.html(s) : ''}
      <div class="panel bloco"><h3>Abas encontradas<small>检测到的工作表</small></h3><div class="abasLista">${s.abas.map((x, i) => itemAba(x, i)).join('')}</div></div>`;
    ligar();
  }

  function itemAba(x, i) {
    const det = (x.deteccao && x.deteccao.ranking || []).slice(0, 3);
    const perfil = x.perfilCompativel;
    const cabTxt = x.cabecalho && x.cabecalho.linha >= 0 ? `linha ${x.cabecalho.linhas.map(r => r + 1).join('+')}` : 'não encontrado';
    const opcoesSchema = D.SCHEMAS.filter(s => s.importavel).map(s => `<option value="${s.id}" ${x.schema === s.id ? 'selected' : ''}>${esc(s.base + ' ' + s.nome_pt)}</option>`).join('');
    return `<div class="abaItem ${x.virtual ? 'virtual' : ''} ${!x.selecionada ? 'ignorada' : ''}" data-aba="${esc(x.nome)}">
      <input type="checkbox" class="selAba" data-i="${i}" ${x.selecionada ? 'checked' : ''} ${x.consumidaPor ? 'disabled' : ''}/>
      <div><b>${esc(x.nome)}</b> ${x.virtual ? UI.tag('gerada a partir de formato legado', 'ok') : ''} ${!x.visivel ? UI.tag('oculta') : ''}
        <div style="font-size:11px;color:#8fa39a;margin-top:3px">${num(x.linhas)} linhas × ${num(x.colunas)} colunas · ${esc(x.dimensao || '')}${x.formulas ? ` · ${x.formulas} fórmula(s) (lidas só como valores)` : ''}${x.mescladas ? ` · ${x.mescladas} célula(s) mesclada(s)` : ''}${x.tabelas && x.tabelas.length ? ' · tabela(s): ' + esc(x.tabelas.join(', ')) : ''}</div>
        ${x.consumidaPor ? `<div style="font-size:11px;color:#7dffc0;margin-top:3px">Incluída em "${esc(x.consumidaPor)}"</div>` : ''}
        ${x.motivoIgnorada ? `<div style="font-size:11px;color:#ffd66e;margin-top:3px">${esc(x.motivoIgnorada)}</div>` : ''}
        ${x.legado ? x.legado.avisos.map(t => `<div style="font-size:11px;color:#ffd66e;margin-top:3px">⚠ ${esc(t)}</div>`).join('') + `<div class="so-implantador mono" style="font-size:10px;color:#6f877d;margin-top:3px">layout ${esc(JSON.stringify(x.legado.layout))}</div>` : ''}</div>
      <div><label class="campo"><b>Representa</b><select class="select selSchema" data-i="${i}" ${x.consumidaPor ? 'disabled' : ''}><option value="">— não importar —</option>${opcoesSchema}</select></label>
        <div style="font-size:10px;color:#8fa39a;margin-top:4px">${det.map(d => `${esc(d.nome)} ${Math.round(d.nota * 100)}%`).join(' · ')}</div></div>
      <div><label class="campo"><b>Cabeçalho</b><span style="display:flex;gap:6px;align-items:center"><input class="input linhaCab" data-i="${i}" style="width:90px" value="${x.cabecalho && x.cabecalho.linha >= 0 ? x.cabecalho.linhas.map(r => r + 1).join('+') : ''}" title="Linha(s) do cabeçalho, ex.: 3 ou 1+2"/>
        <small>${esc(cabTxt)}${x.cabecalho && x.cabecalho.escolhidoPeloUsuario ? ' (sua escolha)' : ` · ${Math.round((x.cabecalho ? x.cabecalho.confianca : 0) * 100)}%`}</small></span></label></div>
      <div>${perfil ? `<div class="banner ok" style="margin:0;padding:8px">Perfil compatível: <b>${esc(perfil.perfil.profile_name)}</b> · ${Math.round(perfil.compatibilidade * 100)}%
          <div style="margin-top:6px"><button class="btn sm primary aplicarPerfil" data-i="${i}">${perfilAplicado[x.nome] ? '✓ Aplicado' : 'Aplicar perfil'}</button> <button class="btn sm verAmostra" data-i="${i}">Revisar</button></div></div>`
        : `<button class="btn sm verAmostra" data-i="${i}">Ver amostra</button>`}</div>
      <div class="amostra" id="amostra-${i}" style="grid-column:1/-1;display:none"></div>
    </div>`;
  }

  function amostraHTML(x) {
    const linhas = x.amostra || [];
    if (!linhas.length) return UI.vazio('Aba vazia.');
    const larg = Math.max(...linhas.map(l => l.length));
    const cabs = new Set((x.cabecalho && x.cabecalho.linhas) || []);
    return `<div class="tabelaWrap" style="max-height:260px"><table class="table dados"><thead><tr><th>#</th>${Array.from({ length: larg }, (_, c) => `<th>${esc(C3B['excel/leitor'].letraColuna(c))}${x.tipos && x.tipos[c] ? `<br><small style="color:#8fa39a">${esc(x.tipos[c].tipo)}</small>` : ''}</th>`).join('')}</tr></thead>
      <tbody>${linhas.map((l, r) => `<tr style="${cabs.has(r) ? 'background:#10301f' : ''}"><td>${r + 1}${cabs.has(r) ? ' ◎' : ''}</td>${Array.from({ length: larg }, (_, c) => `<td>${esc(l[c])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
      <small style="color:#8fa39a">Primeiras ${linhas.length} linhas. ◎ = linha de cabeçalho.</small>`;
  }

  function ligar() {
    const s = UI.estado.sessao;
    const b = $('#novaImp'); if (b) b.onclick = () => UI.telas.inicio.abrirModal();
    if (!s) return;
    if (UI.painelBYD) UI.painelBYD.ligar(s);
    $$('.selAba').forEach(c => c.onchange = () => { const x = s.abas[+c.dataset.i]; x.selecionada = c.checked; if (c.checked && !x.schema) x.schema = x.schemaSugerido; render(); });
    $$('.selSchema').forEach(c => c.onchange = () => { const x = s.abas[+c.dataset.i]; x.schema = c.value || null; x.selecionada = !!c.value; delete s.trabalhos[x.nome]; render(); });
    $$('.linhaCab').forEach(c => c.onchange = () => {
      const x = s.abas[+c.dataset.i];
      const linhas = c.value.split(/[+,; ]+/).map(Number).filter(n => n >= 1);
      if (!linhas.length) { UI.toast('Informe a linha do cabeçalho, ex.: 3 ou 1+2.', true); return; }
      S.importacao.definirCabecalho(s, x.nome, linhas);
      const aba = s.analise.abas.find(a => a.nome === x.nome);
      x.deteccao = C3B['core/perfis'].detectarSchema(aba, x.cabecalho, { motor: s.motor, perfis: UI.pacote().config.perfis });
      UI.toast(`Cabeçalho da aba "${x.nome}" definido na linha ${linhas.join('+')}.`); render();
    });
    $$('.verAmostra').forEach(c => c.onclick = () => { const box = $('#amostra-' + c.dataset.i); box.style.display = box.style.display === 'none' ? 'block' : 'none'; if (box.style.display === 'block') box.innerHTML = amostraHTML(s.abas[+c.dataset.i]); });
    $$('.aplicarPerfil').forEach(c => c.onclick = () => { const x = s.abas[+c.dataset.i]; perfilAplicado[x.nome] = x.perfilCompativel.perfil; x.schema = x.perfilCompativel.perfil.schema; x.selecionada = true; UI.toast(`Perfil "${x.perfilCompativel.perfil.profile_name}" será aplicado no mapeamento.`); render(); });
    $('#irMapear').onclick = () => {
      try {
        for (const x of s.abas.filter(a => a.selecionada)) {
          if (!x.schema) throw new Error(`Escolha o que a aba "${x.nome}" representa.`);
          if (!s.trabalhos[x.nome] || s.trabalhos[x.nome].schema !== x.schema) {
            S.importacao.mapear(s, x.nome, x.schema, { perfil: perfilAplicado[x.nome] || null });
            if (x.sugestoesValorFixo) s.trabalhos[x.nome].sugestoesValorFixo = x.sugestoesValorFixo;
          }
        }
        for (const nome of Object.keys(s.trabalhos)) if (!s.abas.find(a => a.nome === nome && a.selecionada)) delete s.trabalhos[nome];
        UI.estado.abaAtiva = s.abas.find(a => a.selecionada).nome;
        UI.ir('mapeamento');
      } catch (e) { UI.erro(e, 'Mapeamento'); }
    };
    $('#cancelarSessao').onclick = async () => {
      if (!(await UI.confirmar('Cancelar importação', 'A sessão será descartada. Nada foi gravado nas bases.'))) return;
      S.importacao.cancelar(s); S.importacao.encerrarSemGravar(s); UI.estado.sessao = null; UI.salvarProjeto(); UI.toast('Importação cancelada. Nenhuma base foi alterada.'); render();
    };
  }

  UI.telas.importacao = { render };
})();
