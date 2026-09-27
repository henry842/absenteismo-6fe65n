// Tela Configurações: modo de uso, destino dos arquivos (Downloads / pasta escolhida / Bridge local / memória),
// instalação (criar, abrir, diagnosticar), perfis de importação, sincronização (master_mode),
// conflitos em 3 vias (última gravação × arquivo atual × Padronizador) e observabilidade.
(function () {
  'use strict';
  const { $, $$, esc, num, S, D, U } = UI;
  const A = () => S.armazenamento;
  const conf = { resultado: null, decisoes: {}, semelhantes: true };

  UI.definirModo = async (modo) => {
    UI.estado.modo = modo;
    document.body.classList.toggle('modo-lider', modo === 'LIDER');
    $('#nomeModo').textContent = modo === 'LIDER' ? 'Líder' : 'Administrador';
    $('#descModo').textContent = modo === 'LIDER' ? 'Modo simples · 班组长' : 'Implantador / Admin';
    $('#avatarModo').textContent = modo === 'LIDER' ? 'LD' : 'C3';
    await UI.prefs({ modo });
  };

  // Troca de armazenamento. tipo: download | fsaccess | bridge | memory
  UI.usarArmazenamento = async (tipo, opcoes = {}) => {
    if (tipo === 'fsaccess') {
      let h = opcoes.handle;
      if (!h) {
        if (!window.showDirectoryPicker) throw new Error('Este navegador não permite escolher pastas (use Chrome ou Edge). Use "Downloads" ou o Bridge local.');
        h = await window.showDirectoryPicker({ id: 'c3b-bases', mode: 'readwrite' });
      }
      if (h.queryPermission && (await h.queryPermission({ mode: 'readwrite' })) !== 'granted') {
        if (!h.requestPermission || (await h.requestPermission({ mode: 'readwrite' })) !== 'granted') throw new Error('Permissão de gravação na pasta negada.');
      }
      UI.estado.storage = A().FileSystemAccessAdapter(h);
      await UI.guardar('fsHandle', h).catch(() => {});
    } else if (tipo === 'bridge') {
      const b = A().LocalBridgeAdapter({ url: opcoes.url, token: opcoes.token });
      await b.ping();
      UI.estado.storage = b;
    } else if (tipo === 'memory') UI.estado.storage = A().MemoryAdapter();
    else UI.estado.storage = A().BrowserDownloadAdapter();
    await UI.prefs({ armazenamento: tipo, bridgeUrl: opcoes.url || UI.estado.prefs.bridgeUrl, bridgeToken: tipo === 'bridge' ? opcoes.token : UI.estado.prefs.bridgeToken });
    return UI.estado.storage;
  };

  function render() {
    const el = $('#telaConfig');
    const st = UI.storage();
    const p = UI.pacote();
    const prefs = UI.estado.prefs;
    el.innerHTML = `<div class="telaHead"><div><h2>Configurações <small>设置</small></h2>
      <div class="sub">Onde as bases ficam, quem está usando, a instalação atual e as regras de sincronização.</div></div></div>
      <div class="grid2">
        <div class="panel bloco"><h3>Modo de uso<small>使用模式</small></h3>
          <div class="btnRow"><button class="btn ${UI.estado.modo === 'LIDER' ? 'primary' : ''}" data-modo="LIDER">Líder (simples)</button><button class="btn ${UI.estado.modo === 'IMPLANTADOR' ? 'primary' : ''}" data-modo="IMPLANTADOR">Implantador / Admin</button></div>
          <small style="color:#8fa39a">Líder vê o essencial e não altera Dicionário, perfis ou bloqueios. Implantador vê regras, IDs técnicos, observabilidade e decisões administrativas.</small>
          <label class="campo" style="margin-top:10px"><b>Seu nome (fica nos logs)</b><input class="input" id="cfgUsuario" value="${esc(prefs.usuario || '')}" placeholder="ex.: Henry"/></label>
        </div>
        <div class="panel bloco"><h3>Onde gravar as bases<small>存储位置</small></h3>
          <div class="integrCard"><b>Atual: ${esc(st.nome)}</b><small>${esc(st.descricaoDestino)}</small></div>
          <div class="btnRow" style="flex-wrap:wrap">
            <button class="btn sm ${st.id === 'download' ? 'primary' : ''}" data-st="download">Downloads do navegador</button>
            <button class="btn sm ${st.id === 'fsaccess' ? 'primary' : ''}" data-st="fsaccess">Escolher pasta… (Chrome/Edge)</button>
            <button class="btn sm ${st.id === 'memory' ? 'primary' : ''} so-implantador" data-st="memory">Memória (simulação)</button>
          </div>
          <div class="linhaForm"><label class="campo"><b>Bridge local: endereço</b><input class="input" id="brUrl" value="${esc(prefs.bridgeUrl || 'http://127.0.0.1:47833')}"/></label>
            <label class="campo"><b>Token</b><input class="input" id="brToken" type="password" value="${esc(prefs.bridgeToken || '')}"/></label><button class="btn sm ${st.id === 'bridge' ? 'primary' : ''}" id="brConectar">Testar e usar</button></div>
          <small style="color:#8fa39a">Bridge: <span class="mono">node bridge/server.js &lt;pasta&gt;</span> mostra o token. Só aceita conexões de 127.0.0.1.</small>
          <label class="campo" style="margin-top:10px"><b>Subpasta do pacote (dentro do destino)</b><input class="input" id="cfgRaiz" value="${esc(UI.estado.raiz)}" placeholder="vazio = na própria pasta"/></label>
        </div>
      </div>
      <div class="panel bloco" id="blocoDiagnostico"><h3>Instalação e diagnóstico<small>安装与诊断 · ${esc(p.manifesto.installation_id)}</small></h3>
        <div style="font-size:12px;color:#b6c6bf;margin-bottom:8px">Projeto atual: <b>${esc(p.manifesto.empresa || '(sem empresa)')}</b> · ${esc([p.manifesto.unidade, p.manifesto.area, p.manifesto.equipe].filter(Boolean).join(' · ') || 'sem unidade/equipe')} · ${num(Object.values(p.bases).reduce((t, b) => t + b.length, 0))} registros${UI.estado.exemplo ? ' · <b>EXEMPLO</b>' : ''}</div>
        <div class="btnRow" style="flex-wrap:wrap">
          <button class="btn primary" id="diagRodar" ${st.suportaLeitura ? '' : 'disabled'}>⚕ Diagnosticar pasta</button>
          <button class="btn" id="instAbrir" ${st.suportaLeitura ? '' : 'disabled'}>Abrir instalação da pasta</button>
          <button class="btn so-implantador" id="instCriar">✚ Criar nova instalação vazia</button>
          <button class="btn" data-ir-tela="nova">Nova implantação guiada (sem planilha)</button>
        </div>
        ${st.suportaLeitura ? '' : '<div class="banner info" style="margin-top:8px">Para diagnosticar ou abrir uma instalação existente, escolha uma pasta ou conecte o Bridge: no modo Downloads o navegador não consegue ler arquivos da pasta.</div>'}
        ${diagnosticoHTML()}
      </div>
      <div class="grid2">
        <div class="panel bloco so-implantador"><h3>Perfis de importação (${(p.config.perfis || []).length})<small>导入配置</small></h3>${perfisHTML(p)}</div>
        <div class="panel bloco"><h3>Sincronização futura (master_mode)<small>同步模式</small></h3>
          <table class="table"><tbody>${D.SCHEMAS.map(s => `<tr><td>${s.base} ${esc(s.nome_pt)}</td><td>${UI.ehImplantador() && s.master_mode !== 'APPEND_ONLY' && s.master_mode !== 'C3B_MASTER' ? `<select class="select syncModo" data-schema="${s.id}">${['BIDIRECTIONAL', 'EXCEL_MASTER', 'C3B_MASTER', 'ADMIN_ONLY'].map(m => `<option ${(p.config.sync[s.id] || s.master_mode) === m ? 'selected' : ''}>${m}</option>`).join('')}</select>` : `<span class="mono">${esc(p.config.sync[s.id] || s.master_mode)}</span>`}</td></tr>`).join('')}</tbody></table>
          <small style="color:#8fa39a">BIDIRECTIONAL: Excel e C3B podem mudar, conflitos vão para decisão. APPEND_ONLY (Histórico): só acrescenta. Salvo em 07_Configuracoes › SYNC_SETTINGS.</small></div>
      </div>
      <div class="panel bloco"><h3>Conflitos (3 vias)<small>冲突处理</small></h3>${conflitosHTML(st)}</div>
      <div class="panel bloco so-implantador"><h3>Observabilidade<small>运行指标</small></h3>
        ${UI.estado.observabilidade.length ? `<div class="tabelaWrap" style="max-height:300px"><table class="table dados"><thead><tr><th>Quando</th><th>Etapa</th><th>Arquivo / aba</th><th>Tempo</th><th>Linhas</th><th>Avisos</th><th>Erros</th><th>Memória</th></tr></thead><tbody>
          ${UI.estado.observabilidade.map(o => `<tr><td>${UI.dataHora(o.em)}</td><td>${esc(o.etapa)}</td><td>${esc([o.arquivo, o.aba, o.lote, o.modo].filter(Boolean).join(' · '))}</td><td>${o.tempo_ms != null ? num(o.tempo_ms) + ' ms' : ''}</td><td>${o.linhas ?? ''}</td><td>${o.avisos ?? ''}</td><td>${o.erros ?? ''}</td><td>${esc(o.memoria)}</td></tr>`).join('')}</tbody></table></div>` : UI.vazio('Nenhuma medição ainda.', 'Aparecem aqui os tempos de análise, normalização, commit e geração.')}
        <div class="btnRow"><button class="btn sm perigo" id="limparLocal">Apagar projeto salvo neste navegador</button></div></div>`;
    ligar(p, st);
  }

  function diagnosticoHTML() {
    const d = UI.estado.diagnostico;
    if (!d) return '';
    const cor = { AUSENTE: 'erro', PARCIAL: 'aviso', COM_AVISOS: 'aviso', BLOQUEADO: 'bloq', VALIDO: 'ok', NAO_INICIADO: 'neutro' };
    return `<div style="margin-top:12px">${d.reconhecida ? `<div class="banner ok">Instalação C3B reconhecida: ${esc(d.installation_id)} · ${esc(d.manifesto.empresa || '')} ${esc(d.manifesto.unidade || '')}</div>` : '<div class="banner">Nenhum Manifesto C3B nesta pasta: não há instalação reconhecida (ou o 00_Manifesto_C3B.xlsx sumiu).</div>'}
      <div style="font-size:14px;margin:8px 0">Saúde do pacote: <b>${d.saude.nota == null ? '—' : d.saude.nota + '%'}</b>${d.saude.obrigatoriasAusentes ? ` · ${d.saude.obrigatoriasAusentes} base(s) obrigatória(s) ausente(s)` : ''}</div>
      ${d.bases.map(b => `<div class="statusBase"><b>${b.base}</b><span>${esc(b.nome)}<div class="mono" style="color:#8fa39a">${esc(b.arquivo || b.arquivoEsperado)}</div></span><span>${UI.tag({ AUSENTE: 'Ausente', PARCIAL: 'Parcial', COM_AVISOS: 'Com avisos', BLOQUEADO: 'Bloqueado', VALIDO: 'Válido', NAO_INICIADO: 'Não iniciado' }[b.status] || b.status, cor[b.status])}</span>
        <span>${b.encontrado ? `v${b.dataVersion}${b.registros != null ? ' · ' + num(b.registros) + ' reg.' : ''}${b.nota != null ? ' · ' + b.nota + '%' : ''}` : 'não encontrado'}</span><span>${b.alertas.map(a => `<div style="color:${a.nivel === 'erro' ? '#ff8a8a' : '#ffd66e'}">• ${esc(a.texto)}</div>`).join('')}${b.coberturaPessoas ? `<div style="color:#8fa39a">${esc(b.coberturaPessoas)}</div>` : ''}</span></div>`).join('')}
      ${d.naoReconhecidos.length ? `<div style="font-size:12px;margin-top:8px">Planilhas na pasta que não são bases oficiais: ${d.naoReconhecidos.map(esc).join(', ')} <button class="btn sm" id="diagPadronizar">Padronizar uma delas</button></div>` : ''}
      ${d.erros.length ? `<div class="banner erro" style="margin-top:8px">Não foi possível ler: ${d.erros.map(e => esc(e.arquivo + ' (' + e.erro + ')')).join('; ')}</div>` : ''}
      <div class="btnRow"><button class="btn primary" id="diagCarregar">Carregar no Padronizador e corrigir pendências</button>${d.ausentes.length ? `<button class="btn" id="diagAusentes">Gerar as ${d.ausentes.length} base(s) ausente(s)</button>` : ''}</div></div>`;
  }

  function perfisHTML(p) {
    const lista = p.config.perfis || [];
    return `${lista.length ? `<table class="table"><thead><tr><th>Perfil</th><th>Base</th><th>Aba</th><th>Versão</th><th></th></tr></thead><tbody>${lista.map(x => `<tr><td>${esc(x.profile_name)}<div class="mono" style="color:#8fa39a">${esc(x.profile_id)}</div></td><td>${esc(UI.nomeSchema(x.schema))}</td><td>${esc(x.sheet_name_pattern || '')}</td><td>v${x.version || 1}</td>
      <td><button class="btn sm pfAcao" data-acao="renomear" data-id="${esc(x.profile_id)}">Renomear</button> <button class="btn sm pfAcao" data-acao="duplicar" data-id="${esc(x.profile_id)}">Duplicar</button> <button class="btn sm pfAcao" data-acao="exportar" data-id="${esc(x.profile_id)}">⇩</button> <button class="btn sm perigo pfAcao" data-acao="excluir" data-id="${esc(x.profile_id)}">✕</button></td></tr>`).join('')}</tbody></table>`
      : UI.vazio('Nenhum perfil.', 'Salve um perfil na tela Mapeamento depois de conferir as colunas.')}
      <div class="linhaForm"><label class="btn sm" for="pfArquivo">Importar perfil (.json)</label><input type="file" id="pfArquivo" accept=".json" hidden/>${lista.length ? '<button class="btn sm" id="pfExportarTodos">Exportar todos</button>' : ''}</div>`;
  }

  function conflitosHTML(st) {
    if (!st.suportaLeitura) return '<div style="font-size:12px;color:#8fa39a">Compara a última gravação feita por este navegador com o arquivo que está na pasta hoje e com o que está no Padronizador. Precisa de pasta escolhida ou Bridge.</div>';
    const r = conf.resultado;
    return `<div class="btnRow"><button class="btn" id="cfDetectar">Procurar conflitos</button></div>
      <small style="color:#8fa39a">Conflito = desde a última gravação, o arquivo e o Padronizador mudaram o mesmo campo para valores diferentes. Nunca vale "a última gravação vence" em silêncio.</small>
      ${r ? (r.semBase ? `<div class="banner" style="margin-top:8px">${esc(r.semBase)}</div>` : r.total ? `<div style="margin-top:10px"><label style="font-size:12px"><input type="checkbox" id="cfSemelhantes" ${conf.semelhantes ? 'checked' : ''}/> aplicar a mesma escolha a conflitos iguais (mesmo campo e mesmos valores)</label>
        <div class="tabelaWrap" style="max-height:360px;margin-top:6px"><table class="table dados"><thead><tr><th>Base</th><th>Registro</th><th>Campo</th><th>Antes</th><th>No arquivo</th><th>No Padronizador</th><th>Ficar com</th></tr></thead><tbody>
        ${Object.entries(r.porBase).flatMap(([b, x]) => x.conflitos.map(c => `<tr><td>${esc(D.schema(b).base)}</td><td class="mono">${esc(c.chave)}</td><td>${esc(c.campo)}</td><td>${esc(c.base ?? '—')}</td><td style="color:#ffd9a6">${esc(c.excel ?? '—')}</td><td style="color:#7dffc0">${esc(c.sistema ?? '—')}</td>
          <td><select class="select cfEscolha" data-id="${c.conflito_id}" data-base="${b}"><option value="">— decidir —</option><option value="EXCEL" ${conf.decisoes[c.conflito_id] === 'EXCEL' ? 'selected' : ''}>Arquivo</option><option value="SISTEMA" ${conf.decisoes[c.conflito_id] === 'SISTEMA' ? 'selected' : ''}>Padronizador</option></select></td></tr>`)).join('')}</tbody></table></div>
        <div class="btnRow"><button class="btn primary" id="cfAplicar">Aplicar decisões</button></div></div>`
        : `<div class="banner ok" style="margin-top:8px">Nenhum conflito. ${r.mesclados ? `${r.mesclados} mudança(s) feitas só no arquivo podem ser trazidas sem conflito.` : ''} ${r.mesclados ? '<button class="btn sm" id="cfTrazer">Trazer mudanças do arquivo</button>' : ''}</div>`) : ''}`;
  }

  async function detectarConflitos(p, st) {
    const snap = await UI.ler('snapshot:' + p.manifesto.installation_id);
    if (!snap) { conf.resultado = { semBase: 'Não há registro da última gravação feita por este navegador para esta instalação. Gere as bases uma vez; depois disso, mudanças feitas no Excel poderão ser comparadas.' }; return; }
    const c = await S.loadInstallation(st, UI.estado.raiz, UI.opcoesExcel());
    const porBase = {};
    let total = 0, mesclados = 0;
    for (const b of ['PEOPLE', 'OPERATIONS', 'SKILLS', 'HISTORY', 'TRAINING', 'ATTENDANCE']) {
      const chave = D.schema(b).chave[0];
      const excel = c.achados[b] ? c.achados[b].registros : snap[b] || [];
      const r = S.detectConflicts(snap[b] || [], excel, p.bases[b], chave);
      const mudouExcel = S.compareVersions(snap[b] || [], excel, chave);
      mesclados += mudouExcel.adicionados.length + mudouExcel.alterados.length;
      porBase[b] = { ...r, chave };
      total += r.conflitos.length;
    }
    conf.resultado = { porBase, total, mesclados };
    conf.decisoes = {};
  }

  function aplicarConflitos(p) {
    let aplicadas = 0, pendentes = 0;
    for (const [b, x] of Object.entries(conf.resultado.porBase)) {
      const decisoes = Object.fromEntries(x.conflitos.filter(c => conf.decisoes[c.conflito_id]).map(c => [c.conflito_id, conf.decisoes[c.conflito_id]]));
      const r = S.resolveConflicts(x.mesclado, x.conflitos, decisoes, x.chave, { aplicarSemelhantes: conf.semelhantes });
      pendentes += r.pendentes.length; aplicadas += r.aplicadas;
      if (!r.pendentes.length) p.bases[b] = r.registros;
    }
    if (pendentes) throw new Error(`${pendentes} conflito(s) ainda sem decisão. Nada foi aplicado nas bases com pendências.`);
    p.config.decisoes.push({ tipo: 'CONFLITOS_RESOLVIDOS', detalhe: `${aplicadas} conflito(s)`, decidido_por: UI.usuario(), decidido_em: U.agoraISO() });
    return aplicadas;
  }

  function ligar(p, st) {
    $$('[data-ir-tela]').forEach(b => b.onclick = () => UI.ir(b.dataset.irTela));
    $$('[data-modo]').forEach(b => b.onclick = async () => { await UI.definirModo(b.dataset.modo); render(); });
    $('#cfgUsuario').onchange = e => UI.prefs({ usuario: e.target.value.trim() });
    $('#cfgRaiz').onchange = async e => {
      try { const r = e.target.value.trim() ? U.caminhoSeguro(e.target.value.trim()) : ''; UI.estado.raiz = r; await UI.prefs({ raiz: r }); UI.toast(`Subpasta: ${r || '(raiz)'}`); render(); }
      catch (err) { UI.erro(err, 'Subpasta'); e.target.value = UI.estado.raiz; }
    };
    $$('[data-st]').forEach(b => b.onclick = async () => {
      try { const s = await UI.usarArmazenamento(b.dataset.st); UI.estado.diagnostico = null; conf.resultado = null; UI.toast(`Destino: ${s.nome}`); render(); UI.telas.inicio.painel(); }
      catch (e) { if (e.name !== 'AbortError') UI.erro(e, 'Armazenamento'); }
    });
    $('#brConectar').onclick = async () => {
      try { await UI.usarArmazenamento('bridge', { url: $('#brUrl').value.trim(), token: $('#brToken').value.trim() }); UI.toast('Bridge conectado.'); render(); UI.telas.inicio.painel(); }
      catch (e) { UI.erro(e, 'Bridge'); }
    };
    $('#diagRodar').onclick = async () => {
      const t0 = performance.now();
      try { UI.estado.diagnostico = await S.diagnoseInstallation(st, UI.estado.raiz, UI.opcoesExcel()); UI.medir('Diagnóstico', { tempo_ms: Math.round(performance.now() - t0) }); render(); }
      catch (e) { UI.erro(e, 'Diagnóstico'); }
    };
    $('#instAbrir').onclick = async () => {
      try {
        const c = await S.loadInstallation(st, UI.estado.raiz, UI.opcoesExcel());
        if (!c.achados.MANIFEST && !Object.keys(c.achados).length) throw new Error('Nenhuma base oficial C3B encontrada nesta pasta.');
        UI.estado.pacote = c.pacote; UI.estado.exemplo = false; UI.banner(''); UI.salvarProjeto();
        await UI.guardar('snapshot:' + c.pacote.manifesto.installation_id, JSON.parse(JSON.stringify(c.pacote.bases)));
        UI.toast(`Instalação aberta: ${Object.keys(c.achados).length} arquivo(s) reconhecido(s).`); render(); UI.telas.inicio.painel();
      } catch (e) { UI.erro(e, 'Abrir instalação'); }
    };
    $('#instCriar').onclick = () => UI.modal(`<h3>Nova instalação C3B</h3><div class="grid2">${[['empresa', 'Empresa'], ['unidade', 'Unidade'], ['area', 'Área'], ['secao', 'Seção'], ['equipe', 'Equipe'], ['lider', 'Líder'], ['supervisor', 'Supervisor'], ['turno_padrao', 'Turno padrão']].map(([k, r]) => `<label class="campo"><b>${r}</b><input class="input" data-meta="${k}"/></label>`).join('')}</div>
      <div class="banner" style="margin-top:10px">Cria os 8 arquivos (bases vazias com cabeçalhos, Configurações e Manifesto) em: ${esc(st.descricaoDestino)}${UI.estado.raiz ? ' / ' + esc(UI.estado.raiz) : ''}. Arquivos já existentes vão para BACKUP antes.</div>
      <div class="modalActions"><button class="btn" data-fechar>Cancelar</button><button class="btn primary" id="instOk">Criar</button></div>`, (box, fechar) => {
      box.querySelector('#instOk').onclick = async () => {
        const meta = {}; box.querySelectorAll('[data-meta]').forEach(i => { meta[i.dataset.meta] = i.value.trim(); });
        if (!meta.empresa) { UI.toast('Informe ao menos a empresa.', true); return; }
        try {
          const r = await S.createInstallation(st, UI.estado.raiz, meta, { usuario: UI.usuario(), ExcelJS: window.ExcelJS });
          if (!r.ok) throw new Error(r.erro || 'falha ao gravar');
          UI.estado.pacote = r.pacote; UI.estado.exemplo = false; UI.banner(''); UI.salvarProjeto();
          UI.estado.geracao = { ...r, em: U.agoraISO(), mensagem: `Instalação ${r.pacote.manifesto.installation_id} criada.` };
          await UI.guardar('snapshot:' + r.pacote.manifesto.installation_id, JSON.parse(JSON.stringify(r.pacote.bases)));
          fechar(); UI.toast(`Instalação ${r.pacote.manifesto.installation_id} criada.`); render(); UI.telas.inicio.painel();
        } catch (e) { UI.erro(e, 'Criar instalação'); }
      };
    });
    const dc = $('#diagCarregar'); if (dc) dc.onclick = () => { UI.estado.pacote = UI.estado.diagnostico.pacote; UI.estado.exemplo = false; UI.salvarProjeto(); UI.ir('geracao'); };
    const da = $('#diagAusentes'); if (da) da.onclick = async () => {
      try {
        UI.estado.pacote = UI.estado.diagnostico.pacote;
        const bases = UI.estado.diagnostico.ausentes.filter(b => !['MANIFEST', 'CONFIG'].includes(b));
        const r = await S.writePackage(st, UI.estado.raiz, UI.estado.pacote, { modo: 'ATUALIZAR', bases, usuario: UI.usuario(), ExcelJS: window.ExcelJS });
        UI.estado.geracao = { ...r, em: U.agoraISO(), mensagem: r.ok ? `${r.resultados.length} base(s) ausente(s) gerada(s).` : r.erro };
        UI.toast(UI.estado.geracao.mensagem, !r.ok);
        UI.estado.diagnostico = await S.diagnoseInstallation(st, UI.estado.raiz, UI.opcoesExcel()); render();
      } catch (e) { UI.erro(e, 'Gerar ausentes'); }
    };
    const dp = $('#diagPadronizar'); if (dp) dp.onclick = () => { UI.ir('inicio'); UI.telas.inicio.abrirModal(); };
    $$('.syncModo').forEach(s => s.onchange = () => { p.config.sync[s.dataset.schema] = s.value; p.config.decisoes.push({ tipo: 'SYNC_MASTER_MODE', detalhe: `${s.dataset.schema} → ${s.value}`, decidido_por: UI.usuario(), decidido_em: U.agoraISO() }); UI.salvarProjeto(); UI.toast('Modo de sincronização atualizado (vai para 07_Configuracoes na próxima geração).'); });
    const api = () => S.perfis.criarPerfis(p.config.perfis || []);
    $$('.pfAcao').forEach(b => b.onclick = async () => {
      const a = api(), id = b.dataset.id;
      try {
        if (b.dataset.acao === 'exportar') { UI.baixar(new TextEncoder().encode(a.exportar(id)), `perfil_${id}.json`, 'application/json'); return; }
        if (b.dataset.acao === 'duplicar') a.duplicar(id);
        if (b.dataset.acao === 'excluir') { if (!(await UI.confirmar('Excluir perfil?', esc(a.obter(id).profile_name), { perigo: true, botao: 'Excluir' }))) return; a.excluir(id); }
        if (b.dataset.acao === 'renomear') { const n = prompt('Novo nome do perfil:', a.obter(id).profile_name); if (!n) return; a.editar(id, { profile_name: n.trim() }); }
        p.config.perfis = a.listar(); UI.salvarProjeto(); render();
      } catch (e) { UI.erro(e, 'Perfil'); }
    });
    $('#pfArquivo').onchange = async e => {
      const f = e.target.files[0]; if (!f) return;
      try { const a = api(); const novos = a.importar(await f.text()); p.config.perfis = a.listar(); UI.salvarProjeto(); UI.toast(`${novos.length} perfil(is) importado(s).`); render(); }
      catch (err) { UI.erro(err, 'Importar perfil'); }
    };
    const pt = $('#pfExportarTodos'); if (pt) pt.onclick = () => UI.baixar(new TextEncoder().encode(api().exportar()), 'perfis_C3B.json', 'application/json');
    const cd = $('#cfDetectar'); if (cd) cd.onclick = async () => { try { await detectarConflitos(p, st); render(); } catch (e) { UI.erro(e, 'Conflitos'); } };
    const cs = $('#cfSemelhantes'); if (cs) cs.onchange = () => { conf.semelhantes = cs.checked; };
    $$('.cfEscolha').forEach(s => s.onchange = () => {
      conf.decisoes[s.dataset.id] = s.value || undefined;
      if (conf.semelhantes && s.value) {
        const lista = conf.resultado.porBase[s.dataset.base].conflitos, c = lista.find(x => x.conflito_id === s.dataset.id);
        for (const o of lista) if (!conf.decisoes[o.conflito_id] && o.campo === c.campo && String(o.excel) === String(c.excel) && String(o.sistema) === String(c.sistema)) conf.decisoes[o.conflito_id] = s.value;
        render();
      }
    });
    const ca = $('#cfAplicar'); if (ca) ca.onclick = () => { try { const n = aplicarConflitos(p); conf.resultado = null; UI.salvarProjeto(); UI.toast(`${n} conflito(s) resolvido(s). Gere as bases para gravar.`); render(); } catch (e) { UI.erro(e, 'Conflitos'); } };
    const ct = $('#cfTrazer'); if (ct) ct.onclick = () => {
      for (const [b, x] of Object.entries(conf.resultado.porBase)) p.bases[b] = x.mesclado;
      conf.resultado = null; UI.salvarProjeto(); UI.toast('Mudanças do arquivo trazidas para o Padronizador.'); render();
    };
    $('#limparLocal').onclick = async () => {
      if (!(await UI.confirmar('Apagar o projeto salvo neste navegador?', 'Os arquivos já gravados na pasta não são afetados.', { perigo: true, botao: 'Apagar' }))) return;
      await UI.guardar('pacote', null); UI.estado.pacote = null; UI.estado.sessao = null; UI.toast('Projeto local apagado.'); render(); UI.telas.inicio.painel();
    };
  }

  UI.telas.config = { render };
})();
