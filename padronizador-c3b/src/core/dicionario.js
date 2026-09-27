// Dicionário de Dados C3B: os schemas oficiais, cada campo (rótulos pt/zh, tipo, obrigatoriedade,
// valores permitidos, aliases de cabeçalho, regra de validação, sensibilidade) e as definições
// centrais (níveis i/I/L/U, master_mode, relações entre bases). É a única fonte dessas regras:
// mapeamento, normalização, validação, geração do Excel e a tela do Dicionário leem daqui.
(typeof module === 'object' ? require('../modulo') : C3BModulo)('core/dicionario', [], () => {
  'use strict';

  const SCHEMA_VERSION = '1.0.0';

  // ---------- níveis de habilidade (sensível a maiúsculas: i ≠ I) ----------
  const NIVEIS = [
    { codigo: 'i', ordem: 1, nome_pt: 'Fase de treinamento', nome_zh: '培训阶段',
      definicao_pt: 'Em treinamento. Ainda não atende ao ritmo de produção (takt).',
      definicao_zh: '处于培训阶段，尚未达到生产节拍要求。' },
    { codigo: 'I', ordem: 2, nome_pt: 'Fase independente', nome_zh: '独立阶段',
      definicao_pt: 'Executa garantindo segurança e qualidade dentro do takt e identifica problemas do posto.',
      definicao_zh: '能在节拍内保证安全和质量独立作业，并能识别工位问题。' },
    { codigo: 'L', ordem: 3, nome_pt: 'Fase de trabalho / proficiência', nome_zh: '熟练阶段',
      definicao_pt: 'Executa com autonomia e trata corretamente as anomalias comuns do posto.',
      definicao_zh: '能自主作业，并正确处理工位常见异常。' },
    { codigo: 'U', ordem: 4, nome_pt: 'Fase de orientação', nome_zh: '指导阶段',
      definicao_pt: 'Tem capacidade de orientar e treinar outras pessoas, conforme os requisitos aplicáveis.',
      definicao_zh: '具备按要求指导和培训他人的能力。' },
  ];

  // ---------- valores permitidos (enums) ----------
  // Cada valor: código oficial, rótulos e aliases conhecidos. Aliases do usuário ficam em core/aliases.
  const ENUMS = {
    SKILL_LEVEL: NIVEIS.map(n => ({ codigo: n.codigo, pt: n.nome_pt, zh: n.nome_zh, aliases: [] })),
    STATUS_PESSOA: [
      { codigo: 'ATIVO', pt: 'Ativo', zh: '在职', aliases: ['ativo', 'atv', 'trabalhando', 'em atividade', 'ativa', '在职', '在岗'] },
      { codigo: 'INATIVO', pt: 'Inativo', zh: '停用', aliases: ['inativo', 'inativa', 'inat'] },
      { codigo: 'AFASTADO', pt: 'Afastado', zh: '休假/停工', aliases: ['afastado', 'afastada', 'afastamento', 'inss', 'licenca'] },
      { codigo: 'FERIAS', pt: 'Férias', zh: '休年假', aliases: ['ferias', 'de ferias'] },
      { codigo: 'DESLIGADO', pt: 'Desligado', zh: '离职', aliases: ['desligado', 'desligada', 'demitido', 'demitida', '离职'] },
    ],
    FUNCAO: [
      { codigo: 'OPERADOR_PRODUCAO', pt: 'Operador de Produção', zh: '生产操作员', aliases: ['operador producao', 'op prod', 'op producao', 'operador', 'operador de producao', 'operadora de producao', 'operador prod', 'operadora', '操作员', '生产操作员'] },
      { codigo: 'LIDER', pt: 'Líder', zh: '班组长', aliases: ['lider', 'lider de equipe', 'lider de producao', 'team leader', '班组长', '班长'] },
      { codigo: 'SUPERVISOR', pt: 'Supervisor', zh: '主管', aliases: ['supervisor', 'supervisora', '主管'] },
      { codigo: 'MONITOR', pt: 'Monitor', zh: '监督员', aliases: ['monitor', 'monitora'] },
      { codigo: 'INSPETOR_QUALIDADE', pt: 'Inspetor de Qualidade', zh: '质检员', aliases: ['inspetor', 'inspetor qualidade', 'inspetor de qualidade', 'qualidade', '质检员'] },
      { codigo: 'MANUTENCAO', pt: 'Manutenção', zh: '维修', aliases: ['manutencao', 'mecanico', 'mecanico manutencao', 'eletricista'] },
      { codigo: 'INSTRUTOR', pt: 'Instrutor', zh: '培训师', aliases: ['instrutor', 'instrutora', 'treinador', '培训师'] },
      { codigo: 'ABASTECEDOR', pt: 'Abastecedor', zh: '物料员', aliases: ['abastecedor', 'abastecimento', 'logistica', 'operador logistica'] },
    ],
    TURNO: [
      { codigo: 'TURNO_1', pt: '1º Turno', zh: '一班', aliases: ['1', 't1', '1t', '1 turno', 'primeiro turno', '1o turno', 'turno 1', 'turno1', '一班', '早班'] },
      { codigo: 'TURNO_2', pt: '2º Turno', zh: '二班', aliases: ['2', 't2', '2t', '2 turno', 'segundo turno', '2o turno', 'turno 2', 'turno2', '二班', '中班'] },
      { codigo: 'TURNO_3', pt: '3º Turno', zh: '三班', aliases: ['3', 't3', '3t', '3 turno', 'terceiro turno', '3o turno', 'turno 3', 'turno3', '三班', '夜班'] },
      { codigo: 'ADMINISTRATIVO', pt: 'Administrativo', zh: '行政班', aliases: ['adm', 'administrativo', 'turno adm', 'comercial', '行政班'] },
      { codigo: 'TURNO_A', pt: 'Turno A', zh: 'A班', aliases: ['a', 'turno a', 'a班'] },
      { codigo: 'TURNO_B', pt: 'Turno B', zh: 'B班', aliases: ['b', 'turno b', 'b班'] },
      { codigo: 'TURNO_C', pt: 'Turno C', zh: 'C班', aliases: ['c', 'turno c', 'c班'] },
    ],
    LADO: [
      { codigo: 'L', pt: 'Esquerdo', zh: '左', aliases: ['l', 'esquerda', 'esquerdo', 'esq', 'left', 'lh', '左'] },
      { codigo: 'R', pt: 'Direito', zh: '右', aliases: ['r', 'direita', 'direito', 'dir', 'right', 'rh', '右'] },
      { codigo: 'C', pt: 'Centro', zh: '中', aliases: ['c', 'centro', 'central', 'center', '中'] },
      { codigo: 'FR', pt: 'Frente direita', zh: '前右', aliases: ['fr'] },
      { codigo: 'FL', pt: 'Frente esquerda', zh: '前左', aliases: ['fl'] },
      { codigo: 'FZ', pt: 'Frente (FZ)', zh: '前部', aliases: ['fz'] },
      { codigo: 'RR', pt: 'Traseira direita', zh: '后右', aliases: ['rr'] },
      { codigo: 'RL', pt: 'Traseira esquerda', zh: '后左', aliases: ['rl'] },
    ],
    TITULARIDADE: [
      { codigo: 'TITULAR', pt: 'Titular', zh: '正式在岗', aliases: ['titular', 'sim', 's', 'x', 'o', '○', 'yes', '正式'] },
      { codigo: 'FUTURO_TITULAR', pt: 'Futuro titular', zh: '预备在岗', aliases: ['futuro titular', 'vai ser titular', 'sera titular', 'reserva', '△○', '预备'] },
      { codigo: 'NAO_TITULAR', pt: 'Não titular', zh: '非在岗', aliases: ['nao titular', 'nao', 'n', 'no', '-'] },
    ],
    CERTIFICACAO: [
      { codigo: 'CERTIFICADO', pt: 'Certificado (liberado)', zh: '已认证', aliases: ['certificado', 'liberado', 'verde', 'verde liberado', 'ok', 'aprovado', '已认证'] },
      { codigo: 'PENDENTE', pt: 'Pendente', zh: '待认证', aliases: ['pendente', 'amarelo', 'em avaliacao', 'aguardando', '待认证'] },
      { codigo: 'VENCIDO', pt: 'Vencido', zh: '已过期', aliases: ['vencido', 'vermelho', 'expirado', 'bloqueado'] },
      { codigo: 'NAO_REQUERIDO', pt: 'Não requerido', zh: '无需认证', aliases: ['nao requerido', 'nao se aplica', 'na', 'n a'] },
    ],
    STATUS_REGISTRO: [
      { codigo: 'ATIVO', pt: 'Ativo', zh: '有效', aliases: ['ativo', 'ativa', 'valido', 'sim'] },
      { codigo: 'INATIVO', pt: 'Inativo', zh: '无效', aliases: ['inativo', 'inativa', 'nao'] },
    ],
    TIPO_EVENTO: [
      { codigo: 'NOVA_HABILIDADE', pt: 'Nova habilidade', zh: '新增技能', aliases: ['nova', 'nova habilidade', 'inclusao'] },
      { codigo: 'MUDANCA_NIVEL', pt: 'Mudança de nível', zh: '等级变更', aliases: ['mudanca de nivel', 'alteracao de nivel', 'promocao', 'evolucao'] },
      { codigo: 'MUDANCA_TITULARIDADE', pt: 'Mudança de titularidade', zh: '在岗变更', aliases: ['mudanca de titularidade', 'titularidade'] },
      { codigo: 'AVALIACAO', pt: 'Avaliação', zh: '评估', aliases: ['avaliacao', 'reavaliacao', 'auditoria'] },
      { codigo: 'REMOCAO', pt: 'Remoção', zh: '移除', aliases: ['remocao', 'retirada', 'exclusao'] },
      { codigo: 'CARGA_INICIAL', pt: 'Carga inicial', zh: '初始导入', aliases: ['carga inicial', 'importacao inicial'] },
    ],
    STATUS_TREINAMENTO: [
      { codigo: 'PLANEJADO', pt: 'Planejado', zh: '已计划', aliases: ['planejado', 'planejada', 'previsto', 'programado', '计划', '已计划'] },
      { codigo: 'EM_TREINAMENTO', pt: 'Em treinamento', zh: '培训中', aliases: ['em treinamento', 'em andamento', 'treinando', 'iniciado', '培训中'] },
      { codigo: 'PRONTO_AVALIACAO', pt: 'Pronto para avaliação', zh: '待评估', aliases: ['pronto para avaliacao', 'pronto avaliacao', 'avaliar', '待评估'] },
      { codigo: 'AGUARDANDO_VALIDACAO', pt: 'Aguardando validação', zh: '待确认', aliases: ['aguardando validacao', 'validacao', 'aguardando aprovacao', '待确认'] },
      { codigo: 'CONCLUIDO', pt: 'Concluído', zh: '已完成', aliases: ['concluido', 'concluida', 'finalizado', 'ok', 'feito', '完成', '已完成'] },
      { codigo: 'CANCELADO', pt: 'Cancelado', zh: '已取消', aliases: ['cancelado', 'cancelada', '取消'] },
    ],
    PRIORIDADE: [
      { codigo: 'ALTA', pt: 'Alta', zh: '高', aliases: ['alta', 'urgente', 'critica', '高'] },
      { codigo: 'MEDIA', pt: 'Média', zh: '中', aliases: ['media', 'normal', '中'] },
      { codigo: 'BAIXA', pt: 'Baixa', zh: '低', aliases: ['baixa', '低'] },
    ],
    STATUS_PRESENCA: [
      { codigo: 'PRESENTE', pt: 'Presente', zh: '出勤', aliases: ['presente', 'p', 'ok', '出勤'] },
      { codigo: 'AUSENTE', pt: 'Ausente', zh: '缺勤', aliases: ['ausente', 'falta', 'faltou', 'f', '缺勤'] },
      { codigo: 'ATESTADO', pt: 'Atestado', zh: '病假', aliases: ['atestado', 'atestado medico', 'am', '病假'] },
      { codigo: 'FERIAS', pt: 'Férias', zh: '休年假', aliases: ['ferias', 'fe'] },
      { codigo: 'FOLGA', pt: 'Folga', zh: '休息', aliases: ['folga', 'dsr', 'compensacao', '休息'] },
      { codigo: 'EMPRESTADO', pt: 'Emprestado', zh: '借出', aliases: ['emprestado', 'emprestada', 'cedido', '借出'] },
      { codigo: 'RECEBIDO_EMPRESTIMO', pt: 'Recebido de empréstimo', zh: '借入', aliases: ['recebido', 'recebido emprestimo', 'emprestimo recebido', '借入'] },
      { codigo: 'TREINAMENTO', pt: 'Em treinamento', zh: '培训', aliases: ['treinamento', 'curso', '培训'] },
      { codigo: 'OUTRO', pt: 'Outro', zh: '其他', aliases: ['outro', 'outros'] },
    ],
    DIFICULDADE: [
      { codigo: 'BAIXA', pt: 'Baixa', zh: '低', aliases: ['baixa', 'facil', 'leve', '1', '低'] },
      { codigo: 'MEDIA', pt: 'Média', zh: '中', aliases: ['media', 'moderada', '2', '中'] },
      { codigo: 'ALTA', pt: 'Alta', zh: '高', aliases: ['alta', 'dificil', 'pesada', '3', '高'] },
      { codigo: 'MUITO_ALTA', pt: 'Muito alta', zh: '很高', aliases: ['muito alta', 'critica', '4', '很高'] },
    ],
    BOOLEANO: [
      { codigo: 'SIM', pt: 'Sim', zh: '是', aliases: ['sim', 's', 'x', 'true', 'verdadeiro', 'yes', 'y', '1', 'ativa', 'ativo', '是'] },
      { codigo: 'NAO', pt: 'Não', zh: '否', aliases: ['nao', 'n', 'false', 'falso', 'no', '0', 'inativa', 'inativo', '否'] },
    ],
  };

  // ---------- modelos conhecidos (admin pode acrescentar em Configurações > MODELOS) ----------
  const MODELOS = [
    { model_id: 'SA6H', nome: 'SA6H', aliases: ['sa6h', 'sa 6h', 'sa-6h', 'sa 6 h'] },
    { model_id: 'SA2H', nome: 'SA2H', aliases: ['sa2h', 'sa 2h', 'sa-2h', 'sa 2 h'] },
    { model_id: 'C3BH', nome: 'C3BH', aliases: ['c3bh', 'c3b h', 'c3b-h'] },
  ];

  // ---------- campos que o C3B não usa (minimização / LGPD) ----------
  // Detectados e deixados de fora por padrão. A política pode ser ajustada no futuro.
  const NAO_UTILIZADOS = [
    { tipo: 'CPF', padroes: ['cpf', 'c p f'] },
    { tipo: 'RG', padroes: ['rg', 'identidade', 'documento identidade'] },
    { tipo: 'TELEFONE', padroes: ['telefone', 'celular', 'fone', 'whatsapp', 'contato telefonico', '电话', '手机'] },
    { tipo: 'ENDERECO', padroes: ['endereco', 'rua', 'bairro', 'cep', 'logradouro', '地址'] },
    { tipo: 'NASCIMENTO', padroes: ['data nascimento', 'nascimento', 'data de nascimento', 'aniversario', 'dt nasc', '出生日期'] },
    { tipo: 'EMAIL_PESSOAL', padroes: ['email pessoal', 'e mail pessoal'] },
    { tipo: 'SALARIO', padroes: ['salario', 'remuneracao'] },
    { tipo: 'DOCUMENTOS', padroes: ['pis', 'cnh', 'ctps', 'titulo eleitor', 'nome da mae', 'nome do pai'] },
  ];

  // ---------- catálogo de campos ----------
  // tipos: id | texto | enum | data | datahora | numero | inteiro | booleano | matricula
  // origem: 'gerado' (o Padronizador cria) | 'arquivo' | 'entrada' (só ajuda a resolver referências; não vai para a base)
  const F = (field_id, label_pt, label_zh, data_type, extra = {}) => ({
    field_id, label_pt, label_zh, data_type, required: false, recommended: false, allowed_values: null,
    description: '', example: '', aliases: [], validation_rule: '', sensitive: false, editable: true, origem: 'arquivo', ...extra,
  });
  const META = [
    F('updated_at', 'Atualizado em', '更新时间', 'datahora', { origem: 'gerado', editable: false, description: 'Quando o registro foi gravado pelo Padronizador.', tecnico: true }),
    F('updated_by', 'Atualizado por', '更新人', 'texto', { origem: 'gerado', editable: false, description: 'Quem executou a gravação.', tecnico: true }),
    F('source', 'Origem', '来源', 'texto', { origem: 'gerado', editable: false, description: 'Arquivo, aba e linha de onde veio o dado, ou "CADASTRO_MANUAL".', tecnico: true }),
  ];
  const REF_PESSOA = [
    F('ref_matricula', 'Matrícula (referência)', '工号（引用）', 'matricula', { origem: 'entrada', aliases: ['matricula', 'matr', 'registro', 're', 'cod func', 'chapa', '工号', '员工编号', 'id colaborador'], description: 'Usada para achar o employee_id no Cadastro.' }),
    F('ref_nome', 'Nome (referência)', '姓名（引用）', 'texto', { origem: 'entrada', aliases: ['nome', 'colaborador', 'funcionario', 'operador', 'nome completo', '姓名', '员工'], description: 'Usado para conferir a pessoa (nunca como chave).' }),
  ];
  const REF_OPERACAO = [
    F('ref_modelo', 'Modelo (referência)', '车型（引用）', 'texto', { origem: 'entrada', aliases: ['modelo', 'model', 'veiculo', '车型'] }),
    F('ref_estacao', 'Estação (referência)', '工位（引用）', 'texto', { origem: 'entrada', aliases: ['estacao', 'posto', 'station', '工位'] }),
    F('ref_codigo_operacao', 'Código da operação (referência)', '工序号（引用）', 'texto', { origem: 'entrada', aliases: ['codigo operacao', 'cod op', 'codigo', 'operacao codigo', '工序号'] }),
    F('ref_descricao', 'Descrição da operação (referência)', '工序（引用）', 'texto', { origem: 'entrada', aliases: ['operacao', 'descricao', 'descricao operacao', 'atividade', '工序', '工序名称'] }),
  ];

  const SCHEMAS = [
    {
      id: 'MANIFEST', base: '00', nome_pt: 'Manifesto', nome_zh: '清单', arquivo: '00_Manifesto_C3B.xlsx', aba: 'MANIFESTO',
      master_mode: 'C3B_MASTER', obrigatoria: true, chave: ['installation_id'], importavel: false,
      campos: [
        F('installation_id', 'ID da instalação', '安装ID', 'id', { required: true, origem: 'gerado', editable: false, example: 'C3B-INST-7F3A92C1D0' }),
        F('schema_version', 'Versão do schema', '模式版本', 'texto', { required: true, origem: 'gerado', editable: false, example: SCHEMA_VERSION }),
        F('system_version', 'Versão do Padronizador', '系统版本', 'texto', { required: true, origem: 'gerado', editable: false }),
        F('empresa', 'Empresa', '公司', 'texto', { required: true, example: 'BYD' }),
        F('unidade', 'Unidade', '工厂', 'texto', { required: true, example: 'Camaçari' }),
        F('area', 'Área', '区域', 'texto', { recommended: true, example: 'Chassis' }),
        F('secao', 'Seção', '工段', 'texto', { recommended: true }),
        F('equipe', 'Equipe', '班组', 'texto', { required: true, example: 'C3B' }),
        F('lider', 'Líder', '班组长', 'texto', { recommended: true }),
        F('supervisor', 'Supervisor', '主管', 'texto', { recommended: true }),
        F('turno_padrao', 'Turno padrão', '默认班次', 'enum', { allowed_values: 'TURNO', recommended: true }),
        F('created_at', 'Criado em', '创建时间', 'datahora', { origem: 'gerado', editable: false }),
        F('updated_at', 'Atualizado em', '更新时间', 'datahora', { origem: 'gerado', editable: false }),
        F('created_by', 'Criado por', '创建人', 'texto', { origem: 'gerado', editable: false }),
      ],
      tabelaArquivos: ['base_id', 'base_name', 'file_name', 'schema_version', 'data_version', 'required', 'status', 'record_count', 'last_validated_at', 'hash'],
    },
    {
      id: 'PEOPLE', base: '01', nome_pt: 'Cadastro da Equipe', nome_zh: '团队名册', arquivo: '01_Cadastro_Equipe_C3B.xlsx', aba: 'CADASTRO',
      master_mode: 'BIDIRECTIONAL', obrigatoria: true, chave: ['employee_id'], importavel: true, dicasAba: ['operadores', 'colaboradores', 'funcionarios', 'equipe', 'cadastro', 'pessoas', '人员', '员工'],
      campos: [
        F('employee_id', 'ID do colaborador', '员工ID', 'id', { required: true, origem: 'gerado', editable: false, example: 'EMP-9165559', validation_rule: '^EMP-[A-Z0-9-]+$', description: 'Gerado a partir da matrícula: EMP-<matrícula>. Nunca muda depois de criado.' }),
        F('matricula', 'Matrícula', '工号', 'matricula', { required: true, example: '001234', validation_rule: 'texto; zeros à esquerda preservados', description: 'Registro funcional. Sempre texto: 001234 continua 001234.', aliases: ['matricula', 'matr', 'matric', 'registro', 'registro funcionario', 'cod func', 'codigo funcionario', 're', 'chapa', 'n registro', 'numero registro', 'id funcionario', '工号', '员工编号', '员工号'] }),
        F('nome', 'Nome', '姓名', 'texto', { required: true, example: 'João da Silva', aliases: ['nome', 'nome funcionario', 'nome completo', 'funcionario', 'nome colaborador', 'nome func', 'colaborador', 'operador', 'nome do operador', 'nome do colaborador', '姓名', '名字', '员工姓名'] }),
        F('funcao', 'Função', '职务', 'enum', { recommended: true, allowed_values: 'FUNCAO', aliases: ['funcao', 'cargo', 'ocupacao', 'funcao cargo', 'posicao', '职务', '职位', '岗位'] }),
        F('equipe', 'Equipe', '班组', 'texto', { required: true, example: 'C3B', aliases: ['equipe', 'time', 'grupo', 'celula', 'linha', 'setor', '班组', '团队'] }),
        F('turno', 'Turno', '班次', 'enum', { recommended: true, allowed_values: 'TURNO', aliases: ['turno', 'shift', 'horario', '班次'] }),
        F('status', 'Status', '状态', 'enum', { required: true, allowed_values: 'STATUS_PESSOA', aliases: ['status', 'situacao', 'situacao funcional', '状态'] }),
        F('data_integracao', 'Data de integração', '入职日期', 'data', { recommended: true, aliases: ['data integracao', 'integracao', 'data admissao', 'admissao', 'data de entrada', '入职日期'] }),
        F('observacao', 'Observação', '备注', 'texto', { aliases: ['observacao', 'obs', 'observacoes', 'comentario', '备注'] }),
        ...META,
      ],
    },
    {
      id: 'OPERATIONS', base: '02', nome_pt: 'Catálogo de Operações', nome_zh: '工序目录', arquivo: '02_Catalogo_Operacoes_C3B.xlsx', aba: 'OPERACOES',
      master_mode: 'EXCEL_MASTER', admin_only: true, obrigatoria: true, chave: ['operation_id'], importavel: true, dicasAba: ['operacoes', 'operações', 'catalogo', 'processos', 'postos', '工序'],
      campos: [
        F('operation_id', 'ID da operação', '工序ID', 'id', { required: true, origem: 'gerado', editable: false, example: 'SA6H-C16-L1-001', description: 'modelo-estação-lado+posição-sequência. A sequência é guardada: renomear "C16 L1" para "C16-L1" não cria operação nova.' }),
        F('model_id', 'ID do modelo', '车型ID', 'id', { required: true, origem: 'gerado', editable: false, example: 'SA6H' }),
        F('modelo', 'Modelo', '车型', 'texto', { required: true, aliases: ['modelo', 'model', 'veiculo', 'carro', 'projeto', '车型'] }),
        F('station_id', 'ID da estação', '工位ID', 'id', { required: true, origem: 'gerado', editable: false, example: 'SA6H-C16' }),
        F('estacao', 'Estação', '工位', 'texto', { required: true, example: 'C16', aliases: ['estacao', 'posto', 'station', 'estacao posto', 'posto de trabalho', '工位', '工位号'] }),
        F('lado', 'Lado', '方位', 'enum', { recommended: true, allowed_values: 'LADO', aliases: ['lado', 'side', 'lh rh', '方位', '左右'] }),
        F('posicao', 'Posição', '位置', 'texto', { aliases: ['posicao', 'pos', 'position', '位置'] }),
        F('codigo_operacao', 'Código da operação', '工序号', 'texto', { recommended: true, aliases: ['codigo operacao', 'cod op', 'codigo', 'cod operacao', 'numero operacao', 'op', '工序号', '工序编号'] }),
        F('descricao_pt', 'Descrição (português)', '描述（葡语）', 'texto', { required: true, aliases: ['descricao', 'descricao operacao', 'operacao', 'atividade', 'tarefa', 'descricao pt', 'nome operacao', 'elemento de trabalho'] }),
        F('descricao_zh', 'Descrição (chinês)', '描述（中文）', 'texto', { aliases: ['descricao chines', 'descricao zh', 'chines', '中文描述', '工序名称', '作业内容', '工序'] }),
        F('torque', 'Torque', '扭矩', 'numero', { aliases: ['torque', 'torque nm', 'nm', '扭矩'], description: 'Número em N·m. Vazio quando não informado (nunca 0).' }),
        F('soquete', 'Soquete', '套筒', 'texto', { aliases: ['soquete', 'socket', 'ferramenta soquete', 'bocal', '套筒'] }),
        F('takt_seconds', 'Takt (segundos)', '节拍（秒）', 'numero', { aliases: ['takt', 'takt time', 'tempo takt', 'tempo ciclo', 'ct', 'takt s', '节拍'] }),
        F('dificuldade', 'Dificuldade / esforço físico', '难度/体力', 'enum', { allowed_values: 'DIFICULDADE', aliases: ['dificuldade', 'esforco fisico', 'esforco', 'ergonomia', '难度'] }),
        F('nivel_minimo', 'Nível mínimo exigido', '最低等级', 'enum', { allowed_values: 'SKILL_LEVEL', aliases: ['nivel minimo', 'nivel exigido', 'nivel requerido', '最低等级'] }),
        F('grupo_revezamento', 'Grupo de revezamento', '轮岗组', 'texto', { aliases: ['grupo revezamento', 'grupo rodizio', 'rodizio', '轮岗组'] }),
        F('ativa', 'Ativa', '启用', 'booleano', { recommended: true, allowed_values: 'BOOLEANO', aliases: ['ativa', 'ativo', 'em uso'], description: 'SIM/NÃO. Sem informação fica vazio (desconhecido); o implantador pode definir um valor fixo no mapeamento, e a decisão fica no log.' }),
        F('observacao', 'Observação', '备注', 'texto', { aliases: ['observacao', 'obs', '备注'] }),
        F('peca', 'Peça', '零件', 'texto', { aliases: ['peca', 'part', 'componente', '零件'] }),
        F('quantidade', 'Quantidade', '数量', 'numero', { aliases: ['quantidade', 'qtd', 'qtde', '数量'] }),
        F('codigo_sap', 'Código SAP', 'SAP编码', 'texto', { aliases: ['codigo sap', 'sap', 'part number', 'pn'] }),
        F('ferramenta', 'Ferramenta', '工具', 'texto', { aliases: ['ferramenta', 'parafusadeira', 'tool', '工具'] }),
        F('risco', 'Risco', '风险', 'texto', { aliases: ['risco', 'risk', '风险'] }),
        F('imagem', 'Imagem', '图片', 'texto', { aliases: ['imagem', 'foto', 'image', '图片'] }),
        ...META,
      ],
    },
    {
      id: 'SKILLS', base: '03', nome_pt: 'Matriz de Habilidades', nome_zh: '技能矩阵', arquivo: '03_Matriz_Habilidades_C3B.xlsx', aba: 'MATRIZ',
      master_mode: 'BIDIRECTIONAL', obrigatoria: true, chave: ['skill_record_id'], importavel: true, dicasAba: ['matriz', 'habilidades', 'skills', 'qualificacao', '技能'],
      campos: [
        F('skill_record_id', 'ID da habilidade', '技能记录ID', 'id', { required: true, origem: 'gerado', editable: false, example: 'SKL-EMP-9165559-SA6H-C16-L1-001', description: 'Uma linha por pessoa × operação.' }),
        F('employee_id', 'ID do colaborador', '员工ID', 'id', { required: true, origem: 'gerado', editable: false }),
        F('operation_id', 'ID da operação', '工序ID', 'id', { required: true, origem: 'gerado', editable: false }),
        F('skill_level', 'Nível de habilidade', '技能等级', 'enum', { required: true, recommended: true, allowed_values: 'SKILL_LEVEL', aliases: ['nivel', 'nivel habilidade', 'nivel de habilidade', 'skill', 'skill level', 'habilidade', '技能等级', '等级'], description: 'i, I, L ou U. Diferencia maiúscula de minúscula (i ≠ I).' }),
        F('titularidade', 'Titularidade', '在岗身份', 'enum', { recommended: true, allowed_values: 'TITULARIDADE', aliases: ['titularidade', 'titular', 'posto titular', '在岗'] }),
        F('certificacao', 'Certificação', '认证', 'enum', { allowed_values: 'CERTIFICACAO', aliases: ['certificacao', 'certificado', 'cert', '认证'] }),
        F('skill_date', 'Data da habilidade', '技能日期', 'data', { recommended: true, aliases: ['data habilidade', 'data', 'data registro', 'data da habilidade', '日期'] }),
        F('last_evaluation_date', 'Última avaliação', '最近评估日期', 'data', { aliases: ['ultima avaliacao', 'data avaliacao', 'avaliacao', '评估日期'] }),
        F('status', 'Status', '状态', 'enum', { required: true, allowed_values: 'STATUS_REGISTRO', aliases: ['status', 'situacao'] }),
        ...META,
      ],
      entrada: [...REF_PESSOA, ...REF_OPERACAO],
    },
    {
      id: 'HISTORY', base: '04', nome_pt: 'Histórico de Habilidades', nome_zh: '技能历史', arquivo: '04_Historico_Habilidades_C3B.xlsx', aba: 'HISTORICO',
      master_mode: 'APPEND_ONLY', obrigatoria: true, chave: ['event_id'], importavel: true, dicasAba: ['historico', 'history', 'ficha', '历史'],
      campos: [
        F('event_id', 'ID do evento', '事件ID', 'id', { required: true, origem: 'gerado', editable: false, example: 'EVT-20260927-3F9A1C07B2', description: 'EVT-<data>-<hash do conteúdo>: reler a mesma planilha não duplica o evento.' }),
        F('employee_id', 'ID do colaborador', '员工ID', 'id', { required: true, origem: 'gerado', editable: false }),
        F('operation_id', 'ID da operação', '工序ID', 'id', { required: true, origem: 'gerado', editable: false }),
        F('event_type', 'Tipo de evento', '事件类型', 'enum', { required: true, allowed_values: 'TIPO_EVENTO', aliases: ['tipo', 'tipo evento', 'evento', '事件类型'] }),
        F('previous_level', 'Nível anterior', '原等级', 'enum', { allowed_values: 'SKILL_LEVEL', aliases: ['nivel anterior', 'de', 'antes', '原等级'] }),
        F('new_level', 'Nível novo', '新等级', 'enum', { recommended: true, allowed_values: 'SKILL_LEVEL', aliases: ['nivel novo', 'novo nivel', 'para', 'nivel', 'nivel atual', '新等级', '等级'] }),
        F('previous_titularity', 'Titularidade anterior', '原在岗身份', 'enum', { allowed_values: 'TITULARIDADE' }),
        F('new_titularity', 'Titularidade nova', '新在岗身份', 'enum', { allowed_values: 'TITULARIDADE', aliases: ['titularidade', 'titular'] }),
        F('event_date', 'Data do evento', '事件日期', 'data', { required: true, aliases: ['data', 'data evento', 'data da avaliacao', 'data do treinamento', '日期'] }),
        F('responsible_id', 'ID do responsável', '负责人ID', 'id', { aliases: ['matricula responsavel', 'id responsavel'] }),
        F('responsible_name', 'Responsável', '负责人', 'texto', { aliases: ['responsavel', 'avaliador', 'instrutor', 'treinador', 'lider', '负责人', '评估人'] }),
        F('observation', 'Observação', '备注', 'texto', { aliases: ['observacao', 'obs', '备注'] }),
        F('source', 'Origem', '来源', 'texto', { origem: 'gerado', editable: false, tecnico: true }),
        F('import_batch_id', 'Lote de importação', '导入批次', 'id', { origem: 'gerado', editable: false, tecnico: true }),
        F('created_at', 'Criado em', '创建时间', 'datahora', { origem: 'gerado', editable: false, tecnico: true }),
      ],
      entrada: [...REF_PESSOA, ...REF_OPERACAO],
    },
    {
      id: 'TRAINING', base: '05', nome_pt: 'Planejamento de Treinamentos', nome_zh: '培训计划', arquivo: '05_Planejamento_Treinamentos_C3B.xlsx', aba: 'TREINAMENTOS',
      master_mode: 'BIDIRECTIONAL', obrigatoria: true, chave: ['training_id'], importavel: true, dicasAba: ['treinamento', 'planejamento', 'training', '训练', '培训'],
      campos: [
        F('training_id', 'ID do treinamento', '培训ID', 'id', { required: true, origem: 'gerado', editable: false, example: 'TRN-5A1C09E2F4' }),
        F('employee_id', 'ID do colaborador', '员工ID', 'id', { required: true, origem: 'gerado', editable: false }),
        F('operation_id', 'ID da operação', '工序ID', 'id', { required: true, origem: 'gerado', editable: false }),
        F('model_id', 'ID do modelo', '车型ID', 'id', { origem: 'gerado', editable: false }),
        F('station_id', 'ID da estação', '工位ID', 'id', { origem: 'gerado', editable: false }),
        F('current_level', 'Nível atual', '当前等级', 'enum', { allowed_values: 'SKILL_LEVEL', aliases: ['nivel atual', 'atual', '当前等级'] }),
        F('target_level', 'Nível alvo', '目标等级', 'enum', { recommended: true, allowed_values: 'SKILL_LEVEL', aliases: ['nivel alvo', 'meta', 'nivel meta', 'objetivo', '目标等级', '目标'] }),
        F('trainer_id', 'Instrutor', '培训师', 'texto', { aliases: ['instrutor', 'treinador', 'trainer', 'multiplicador', '培训师'] }),
        F('planned_date', 'Data planejada', '计划日期', 'data', { recommended: true, aliases: ['data planejada', 'previsto', 'data prevista', 'planejado para', '计划日期'] }),
        F('start_date', 'Início', '开始日期', 'data', { aliases: ['inicio', 'data inicio', '开始日期'] }),
        F('evaluation_date', 'Avaliação', '评估日期', 'data', { aliases: ['avaliacao', 'data avaliacao', '评估日期'] }),
        F('completion_date', 'Conclusão', '完成日期', 'data', { aliases: ['conclusao', 'data conclusao', 'termino', '完成日期'] }),
        F('status', 'Status', '状态', 'enum', { required: true, allowed_values: 'STATUS_TREINAMENTO', aliases: ['status', 'situacao', '状态'] }),
        F('progress', 'Progresso (%)', '进度', 'numero', { aliases: ['progresso', 'andamento', 'percentual', '进度'] }),
        F('priority', 'Prioridade', '优先级', 'enum', { allowed_values: 'PRIORIDADE', aliases: ['prioridade', '优先级'] }),
        F('observation', 'Observação', '备注', 'texto', { aliases: ['observacao', 'obs', '备注'] }),
        F('updated_at', 'Atualizado em', '更新时间', 'datahora', { origem: 'gerado', editable: false, tecnico: true }),
        F('updated_by', 'Atualizado por', '更新人', 'texto', { origem: 'gerado', editable: false, tecnico: true }),
      ],
      entrada: [...REF_PESSOA, ...REF_OPERACAO],
    },
    {
      id: 'ATTENDANCE', base: '06', nome_pt: 'Presença e Movimentações', nome_zh: '出勤与调动', arquivo: '06_Presenca_Movimentacoes_C3B.xlsx', aba: 'PRESENCA',
      master_mode: 'BIDIRECTIONAL', obrigatoria: false, chave: ['attendance_id'], importavel: true, dicasAba: ['presenca', 'frequencia', 'faltas', 'escala', 'ponto', '出勤'],
      campos: [
        F('attendance_id', 'ID do registro', '出勤ID', 'id', { required: true, origem: 'gerado', editable: false, example: 'ATT-20260927-EMP-9165559-TURNO_2' }),
        F('date', 'Data', '日期', 'data', { required: true, aliases: ['data', 'dia', '日期'] }),
        F('shift', 'Turno', '班次', 'enum', { recommended: true, allowed_values: 'TURNO', aliases: ['turno', 'shift', '班次'] }),
        F('employee_id', 'ID do colaborador', '员工ID', 'id', { required: true, origem: 'gerado', editable: false }),
        F('status', 'Status', '状态', 'enum', { required: true, allowed_values: 'STATUS_PRESENCA', aliases: ['status', 'presenca', 'situacao', '状态'] }),
        F('absence_reason', 'Motivo da ausência', '缺勤原因', 'texto', { aliases: ['motivo', 'motivo falta', 'motivo ausencia', 'justificativa', '原因'] }),
        F('planned_station_id', 'Estação prevista', '计划工位', 'texto', { aliases: ['estacao prevista', 'posto previsto'] }),
        F('actual_station_id', 'Estação real', '实际工位', 'texto', { aliases: ['estacao real', 'posto real', 'posto atual'] }),
        F('loan_origin_team', 'Equipe de origem (empréstimo)', '借出班组', 'texto', { aliases: ['equipe origem', 'origem'] }),
        F('loan_destination_team', 'Equipe de destino (empréstimo)', '借入班组', 'texto', { aliases: ['equipe destino', 'destino'] }),
        F('start_time', 'Hora início', '开始时间', 'texto', { aliases: ['hora inicio', 'entrada'] }),
        F('end_time', 'Hora fim', '结束时间', 'texto', { aliases: ['hora fim', 'saida'] }),
        F('observation', 'Observação', '备注', 'texto', { aliases: ['observacao', 'obs', '备注'] }),
        ...META,
      ],
      entrada: [...REF_PESSOA],
    },
    {
      id: 'CONFIG', base: '07', nome_pt: 'Configurações', nome_zh: '配置', arquivo: '07_Configuracoes_C3B.xlsx', aba: 'GERAL',
      master_mode: 'ADMIN_ONLY', obrigatoria: true, chave: [], importavel: false, campos: [],
      abas: {
        GERAL: ['chave', 'valor', 'descricao'],
        MODELOS: ['model_id', 'nome', 'aliases', 'ativo'],
        TURNOS: ['codigo', 'nome_pt', 'nome_zh', 'aliases'],
        SKILL_LEVELS: ['codigo', 'ordem', 'nome_pt', 'nome_zh', 'definicao_pt', 'definicao_zh'],
        ALIASES: ['alias_id', 'entity_type', 'original_value', 'normalized_value', 'created_at', 'created_by', 'active'],
        IMPORT_PROFILES: ['profile_id', 'profile_name', 'schema', 'sheet_name_pattern', 'header_row', 'column_mapping', 'normalization_rules', 'fixed_values', 'created_at', 'updated_at', 'version'],
        VALIDATION_RULES: ['rule_id', 'schema', 'field', 'severity', 'description'],
        COVERAGE_RULES: ['rule_id', 'descricao', 'valor'],
        SYNC_SETTINGS: ['schema', 'base_id', 'master_mode', 'descricao'],
        DECISOES: ['decision_id', 'tipo', 'detalhe', 'decidido_por', 'decidido_em'],
      },
    },
  ];

  const porId = Object.fromEntries(SCHEMAS.map(s => [s.id, s]));
  const schema = id => { const s = porId[id]; if (!s) throw new Error('Schema desconhecido: ' + id); return s; };
  const campo = (schemaId, fieldId) => schema(schemaId).campos.concat(schema(schemaId).entrada || []).find(c => c.field_id === fieldId) || null;
  const camposSaida = schemaId => schema(schemaId).campos;
  // Campos que podem receber uma coluna do arquivo (exclui os gerados pelo Padronizador)
  const camposMapeaveis = schemaId => schema(schemaId).campos.filter(c => c.origem === 'arquivo').concat(schema(schemaId).entrada || []);
  const valoresEnum = nome => ENUMS[nome] || [];
  const ehNivel = v => NIVEIS.some(n => n.codigo === v);

  // Relações entre bases (integridade referencial). BLOCKING: impede a geração oficial.
  const RELACOES = [
    { de: 'SKILLS', campo: 'employee_id', para: 'PEOPLE', campoPara: 'employee_id', severidade: 'BLOCKING' },
    { de: 'SKILLS', campo: 'operation_id', para: 'OPERATIONS', campoPara: 'operation_id', severidade: 'BLOCKING' },
    { de: 'HISTORY', campo: 'employee_id', para: 'PEOPLE', campoPara: 'employee_id', severidade: 'BLOCKING' },
    { de: 'HISTORY', campo: 'operation_id', para: 'OPERATIONS', campoPara: 'operation_id', severidade: 'BLOCKING' },
    { de: 'TRAINING', campo: 'employee_id', para: 'PEOPLE', campoPara: 'employee_id', severidade: 'BLOCKING' },
    { de: 'TRAINING', campo: 'operation_id', para: 'OPERATIONS', campoPara: 'operation_id', severidade: 'BLOCKING' },
    { de: 'ATTENDANCE', campo: 'employee_id', para: 'PEOPLE', campoPara: 'employee_id', severidade: 'BLOCKING' },
  ];

  // Linhas do dicionário completo (tela do Dicionário e aba DICIONARIO de cada arquivo)
  function linhasDicionario() {
    return SCHEMAS.flatMap(s => s.campos.concat(s.entrada || []).map(c => ({
      field_id: c.field_id, schema: s.id, label_pt: c.label_pt, label_zh: c.label_zh, data_type: c.data_type,
      required: c.required, recommended: c.recommended,
      allowed_values: c.allowed_values ? valoresEnum(c.allowed_values).map(v => v.codigo).join(',') : '',
      enum: c.allowed_values || '', description: c.description, example: c.example, aliases: c.aliases.join(' | '),
      validation_rule: c.validation_rule, sensitive: c.sensitive, editable: c.editable, origem: c.origem,
    })));
  }
  // Onde cada campo é usado (tela do Dicionário)
  function usosDoCampo(fieldId) {
    const usos = SCHEMAS.filter(s => s.campos.concat(s.entrada || []).some(c => c.field_id === fieldId)).map(s => `${s.base} ${s.nome_pt}`);
    for (const r of RELACOES) if (r.campo === fieldId) usos.push(`Relação ${r.de}.${r.campo} → ${r.para}.${r.campoPara}`);
    return usos;
  }

  return {
    SCHEMA_VERSION, SYSTEM_VERSION: 'Padronizador C3B 1.0.0', NIVEIS, ENUMS, MODELOS, NAO_UTILIZADOS, SCHEMAS, RELACOES,
    schema, campo, camposSaida, camposMapeaveis, valoresEnum, ehNivel, linhasDicionario, usosDoCampo,
  };
}, typeof module === 'object' ? module : null);
