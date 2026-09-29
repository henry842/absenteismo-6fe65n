// Validação: gera a lista de pendências com severidade (INFO, WARNING, ERROR, BLOCKING), explicando
// linha, campo, valor, motivo e como resolver. BLOCKING impede a geração oficial até ser resolvido
// ou até uma decisão administrativa explícita e registrada.
(typeof module === 'object' ? require('../modulo') : C3BModulo)('core/validar', ['core/util', 'core/dicionario', 'core/pessoas'], (U, D, PS) => {
  'use strict';

  const SEV = ['INFO', 'WARNING', 'ERROR', 'BLOCKING'];
  let seq = 0;
  // Toda pendência leva a categoria: Configuração pendente / Problema de dados / Aviso / Informação técnica
  const novo = (o) => ({ issue_id: `ISS-${String(++seq).padStart(5, '0')}`, ...o, categoria: PS.categoriaDe(o.codigo, { campo: o.campo, severidade: o.severidade }) });

  // registros: saída de normalizarAba (com detalhes). mapeamento: para avisar colunas ignoradas (LGPD).
  function validarDataset(schemaId, registros, { mapeamento = [], ignoradas = [] } = {}) {
    const s = D.schema(schemaId);
    const campos = D.camposSaida(schemaId);
    const issues = [];
    const add = (sev, reg, campo, valor, mensagem, comoResolver, codigo) =>
      issues.push(novo({ severidade: sev, schema: schemaId, linha: reg ? reg._linha : null, registro: reg ? chaveDo(schemaId, reg) : null, campo, valor: valor ?? null, mensagem, comoResolver, codigo }));

    for (const m of mapeamento) if (m.decisao === 'NAO_UTILIZADO')
      add('INFO', null, m.cabecalho, null, `Coluna "${m.cabecalho}" (${m.tipoNaoUtilizado}) foi ignorada: o C3B não usa esse dado.`, 'Nada a fazer. Política de minimização de dados.', 'LGPD_IGNORADO');
    for (const i of ignoradas) if (i.motivo !== 'linha vazia') add('INFO', { _linha: i.linha }, null, null, `Linha ${i.linha} ignorada: ${i.motivo}.`, 'Nada a fazer.', 'LINHA_IGNORADA');

    for (const reg of registros) {
      const v = reg.valores, det = reg.detalhes;
      for (const c of campos) {
        const f = c.field_id, val = v[f], d = det[f] || {};
        const rot = `${c.label_pt}`;
        // Sem matrícula no Cadastro: a mensagem do employee_id já explica; não repete
        if (schemaId === 'PEOPLE' && f === 'matricula' && !v.employee_id && !(det[f] && det[f].original)) continue;
        // Sem operation_id a mensagem dele já explica o que falta; não repete para model_id/station_id
        if (schemaId === 'OPERATIONS' && ['station_id', 'model_id'].includes(f) && !v.operation_id) continue;
        if (/^(training_id|skill_record_id|event_id|attendance_id)$/.test(f) && (!v.employee_id || !v.operation_id && f !== 'attendance_id')) continue;
        if (f === 'employee_id' && det.employee_id && det.employee_id.status === 'NAO_RESOLVIDO_PESSOA') continue;
        if (c.required && (val == null || val === '')) {
          const msg = mensagemObrigatorio(schemaId, f, reg);
          add(msg.sev || 'ERROR', reg, f, d.original, msg.texto, msg.como, 'OBRIGATORIO_VAZIO');
          continue;
        }
        if (val === 'UNKNOWN') {
          add('WARNING', reg, f, d.original, `Linha ${reg._linha} · ${rot}: valor "${d.original}" não reconhecido. Revisão necessária.` + (d.sugestao ? ` Parece "${d.sugestao}".` : ''),
            'Na Normalização, corrija o valor ou crie um alias para ele.', 'VALOR_NAO_RECONHECIDO');
          continue;
        }
        if (d.status === 'AMBIGUO') add('WARNING', reg, f, d.original, `Linha ${reg._linha} · ${rot}: data "${d.original}" é ambígua (dia/mês ou mês/dia). Assumido ${val}.`, 'Confirme a data na Normalização ou corrija na planilha usando AAAA-MM-DD.', 'DATA_AMBIGUA');
        if (d.status === 'REVISAR') add('WARNING', reg, f, d.original, `Linha ${reg._linha} · ${rot}: "${d.original}" interpretado como "${d.normalizado}" (${Math.round((d.confianca || 0) * 100)}%). Confirme.`, 'Confirme ou corrija na Normalização.', 'CONFIRMAR_INTERPRETACAO');
        if (d.status === 'UNKNOWN' && val == null && d.original != null) add('WARNING', reg, f, d.original, `Linha ${reg._linha} · ${rot}: "${d.original}" não pôde ser lido (${d.regra}). Ficou vazio.`, 'Corrija o valor na planilha ou na Normalização.', 'VALOR_INVALIDO');
        if (c.recommended && (val == null || val === '') && !c.required) add('WARNING', reg, f, null, `Linha ${reg._linha} · ${rot} não informado.`, 'Preencha se souber; não impede a geração.', 'RECOMENDADO_VAZIO');
        if (d.avisoNumero) add('WARNING', reg, f, d.original, `Linha ${reg._linha} · Matrícula "${d.original}" estava gravada como número no Excel. Zeros à esquerda podem ter se perdido no arquivo de origem.`, 'Confira a matrícula; na planilha, formate a coluna como Texto.', 'MATRICULA_NUMERO');
      }
      if (reg.conflitoLado) add('WARNING', reg, 'lado', reg.conflitoLado.coluna, `Linha ${reg._linha}: a coluna Lado diz "${reg.conflitoLado.coluna}", mas a estação indica "${reg.conflitoLado.estacao}". Usado o da coluna Lado.`, 'Confira qual lado está certo.', 'LADO_DIVERGENTE');
      for (const [f, d] of Object.entries(det)) if (d.status === 'NAO_RESOLVIDO_PESSOA')
        add('ERROR', reg, 'employee_id', d.original, `Linha ${reg._linha}: pessoa "${d.original}" sem matrícula e ${d.regra === 'REF_NOME_AMBIGUO' ? 'com mais de uma pessoa com esse nome' : 'não encontrada pelo nome'} no Cadastro.`, 'Mapeie a coluna de matrícula ou corrija o nome na Normalização.', 'PESSOA_NAO_RESOLVIDA');
      for (const [f, d] of Object.entries(det)) if (d.status === 'NAO_RESOLVIDO')
        add('ERROR', reg, f, d.original, `Linha ${reg._linha}: operação "${d.original}" não encontrada no Catálogo de Operações` + (d.sugestao ? ` (parecida com ${d.sugestao}).` : '.'), 'Importe/atualize o Catálogo (02) antes, ou escolha a operação certa na Normalização.', 'OPERACAO_NAO_RESOLVIDA');
    }
    // Duplicidades pela chave
    const chave = s.chave[0];
    if (chave) {
      const vistos = new Map();
      for (const reg of registros) {
        const k = reg.valores[chave];
        if (!k) continue;
        if (vistos.has(k)) {
          const sev = schemaId === 'HISTORY' ? 'INFO' : 'ERROR';
          add(sev, reg, chave, k, schemaId === 'HISTORY' ? `Linha ${reg._linha}: evento idêntico ao da linha ${vistos.get(k)._linha} (mesma pessoa, operação, data e níveis). Será gravado uma vez só.`
            : `Linha ${reg._linha}: ${chave} "${k}" repete a linha ${vistos.get(k)._linha}` + (schemaId === 'PEOPLE' ? ` (matrícula ${reg.valores.matricula} duplicada).` : '.'),
            schemaId === 'HISTORY' ? 'Nada a fazer.' : 'Remova a linha repetida ou corrija a matrícula/identificação.', 'DUPLICADO');
        } else vistos.set(k, reg);
      }
    }
    if (schemaId === 'PEOPLE') {
      const porNome = new Map();
      for (const reg of registros) {
        const n = U.dobrar(reg.valores.nome); if (!n) continue;
        if (porNome.has(n) && porNome.get(n).valores.matricula !== reg.valores.matricula)
          add('WARNING', reg, 'nome', reg.valores.nome, `Linha ${reg._linha}: "${reg.valores.nome}" aparece também na linha ${porNome.get(n)._linha} com outra matrícula.`, 'Confira se são pessoas diferentes (homônimos) ou erro de matrícula.', 'POSSIVEL_DUPLICIDADE');
        else porNome.set(n, reg);
      }
    }
    if (schemaId === 'OPERATIONS') {
      const semTakt = registros.filter(r => r.valores.takt_seconds == null).length;
      if (semTakt) add('INFO', null, 'takt_seconds', null, `${semTakt} operação(ões) sem takt.`, 'Preencha o takt quando souber; o C3B usa para o revezamento.', 'SEM_TAKT');
    }
    return issues;
  }

  function mensagemObrigatorio(schemaId, f, reg) {
    const L = `Linha ${reg._linha}`;
    const det = reg.detalhes;
    if (f === 'employee_id' && schemaId === 'PEOPLE') return { texto: `${L} · Campo: Matrícula · Valor: vazio. A matrícula é obrigatória para gerar o employee_id.`, como: 'Preencha a matrícula na planilha ou no cadastro manual.' };
    if (f === 'employee_id') return { texto: `${L} · Sem matrícula para identificar a pessoa.`, como: 'Mapeie a coluna de matrícula (ou preencha a matrícula).' };
    if (f === 'operation_id' && schemaId === 'OPERATIONS') {
      const falta = [!reg.valores.model_id || reg.valores.model_id === 'UNKNOWN' ? 'modelo' : null, !reg.valores.estacao || reg.valores.estacao === 'UNKNOWN' ? 'estação' : null].filter(Boolean);
      return { texto: `${L} · Não foi possível criar o operation_id: falta ${falta.join(' e ') || 'identificação'} válido(a).`, como: 'Informe modelo e estação (ex.: SA6H, C16 L1). Modelos novos podem ser cadastrados em Configurações.' };
    }
    if (f === 'operation_id') return { texto: `${L} · Operação não identificada.`, como: 'Mapeie estação/código/descrição da operação e confira o Catálogo de Operações.' };
    if (/_id$/.test(f)) return { texto: `${L} · ${f} não pôde ser gerado (faltam dados de identificação).`, como: 'Preencha os campos obrigatórios desta linha.' };
    const c = D.campo(schemaId, f);
    const orig = det[f] && det[f].original;
    return { texto: `${L} · Campo: ${c ? c.label_pt : f} · Valor: ${orig ? `"${orig}" inválido` : 'vazio'}. Campo obrigatório.`, como: orig ? 'Corrija o valor na Normalização.' : 'Preencha na planilha, defina um valor fixo no Mapeamento ou edite em massa.' };
  }
  const chaveDo = (schemaId, reg) => { const k = D.schema(schemaId).chave[0]; return k && reg.valores ? reg.valores[k] : null; };

  // Integridade referencial entre as bases do pacote. bases: { PEOPLE: [registrosOficiais], ... }
  function validarPacote(bases) {
    const issues = [];
    for (const r of D.RELACOES) {
      const origem = bases[r.de] || [], destino = bases[r.para];
      if (!origem.length) continue;
      const existentes = new Set((destino || []).map(x => x[r.campoPara]));
      const quebradas = origem.filter(x => x[r.campo] && !existentes.has(x[r.campo]));
      const porValor = new Map();
      for (const x of quebradas) porValor.set(x[r.campo], (porValor.get(x[r.campo]) || 0) + 1);
      for (const [valor, n] of porValor)
        issues.push(novo({ severidade: r.severidade, schema: r.de, linha: null, registro: null, campo: r.campo, valor,
          mensagem: `${D.schema(r.de).nome_pt}: ${n} registro(s) apontam para ${r.campo} "${valor}", que não existe em ${D.schema(r.para).nome_pt}.`,
          comoResolver: `Inclua ${valor} na base ${D.schema(r.para).base} (${D.schema(r.para).nome_pt}) ou corrija a referência.`, codigo: 'REFERENCIA_QUEBRADA' }));
    }
    return issues;
  }

  const contar = issues => Object.fromEntries(SEV.map(s => [s, issues.filter(i => i.severidade === s).length]));
  return { validarDataset, validarPacote, contar, SEV };
}, typeof module === 'object' ? module : null);
