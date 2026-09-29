// Legendas em mandarim dos microvídeos. A chave é o texto em português usado em cenas.js.
// Os nomes de botões e telas ficam também em português entre aspas, porque o app aparece em português.
module.exports = {
  // aberturas e encerramentos
  'Absenteísmo dos times': '班组缺勤管理',
  'Visão geral e acesso': '总览与登录',
  'Entrar na conta, sincronização e as 5 etapas do app': '登录账号、数据同步以及应用的5个模块',
  'Passo 1 · Colar mensagens': '第1步 · 粘贴消息',
  'Importar do WhatsApp sem digitar nada': '从WhatsApp导入，无需手动录入',
  'Colar mensagens': '粘贴消息',
  'Passo 2 · Conferência': '第2步 · 核对',
  'O app confere as contas e aponta o que precisa corrigir': '应用自动核对人数，并指出需要修改的地方',
  'Conferência': '核对',
  'Passo 3 · Fechamento do dia': '第3步 · 当日汇总',
  'Números do dia, quem falta mandar e os textos prontos': '当日数据、未提交的班组以及现成的汇报文字',
  'Fechamento do dia': '当日汇总',
  'Histórico · Buscar pessoa': '历史记录 · 查找人员',
  'Todas as ausências de alguém em segundos': '几秒钟查到某人的全部缺勤记录',
  'Buscar pessoa': '查找人员',
  'Histórico · Período e análises': '历史记录 · 时间段分析',
  'Tendência, reincidência e resumo para o WhatsApp': '趋势、重复缺勤以及发到WhatsApp的总结',
  'Período e análises': '时间段分析',
  'Ajustes · Times, meta e modelo': '设置 · 班组、目标和消息模板',
  'Deixar o app com a cara da sua operação': '让应用符合你的生产实际',
  'Times, meta e modelo': '班组、目标和消息模板',
  'Ajustes · Regras, Excel e backup': '设置 · 规则、Excel和备份',
  'O que conta no %, o que o app aprendeu e onde os dados ficam': '哪些原因计入缺勤率、应用学到了什么、数据保存在哪里',
  'Regras, Excel e backup': '规则、Excel和备份',
  'No celular': '手机端',
  'O mesmo app, no bolso do líder': '同一个应用，装在班组长口袋里',

  // 1 · visão geral
  'O app junta as mensagens de absenteísmo que os líderes mandam no WhatsApp e fecha o dia em poucos minutos.': '应用汇总各班组长在WhatsApp群里发的缺勤消息，几分钟就能完成当天的统计。',
  'Cada líder de área entra com a própria conta. Os dados ficam iguais no celular e no computador.': '每位区域负责人用自己的账号登录，手机和电脑上的数据保持一致。',
  'No topo: a data de hoje, o estado da sincronização e o arquivo Excel.': '顶部显示：今天的日期、同步状态和Excel文件状态。',
  '“Sincronizado” quer dizer que celular e computador estão com os mesmos dados. Sem internet, tudo fica salvo no aparelho e sobe sozinho depois.': '“Sincronizado”（已同步）表示手机和电脑的数据一致。没有网络时，数据先保存在本机，联网后自动上传。',
  'O Excel pode ser atualizado sozinho a cada gravação (configura em Ajustes).': '每次保存后，Excel文件可以自动更新（在“Ajustes”设置中配置）。',
  'No menu da conta: sincronizar agora ou sair.': '账号菜单里可以：立即同步，或退出登录。',
  'O trabalho do dia segue 3 passos: 1 Colar mensagens · 2 Conferência · 3 Fechamento do dia.': '每天的工作分3步：1 粘贴消息 · 2 核对 · 3 当日汇总。',
  'E ainda tem Histórico (análises de qualquer período) e Ajustes (times, meta, Excel e backup).': '另外还有“Histórico”历史记录（任意时间段分析）和“Ajustes”设置（班组、目标、Excel和备份）。',
  'A tela inicial já mostra: times esperados, última leitura, o que falta conferir e o total do dia.': '首页直接显示：应提交的班组数、最近一次读取、待核对的消息和当天总人数。',

  // 2 · colar
  'No grupo do WhatsApp, selecione as mensagens de absenteísmo dos times e copie.': '在WhatsApp群里，选中各班组的缺勤消息并复制。',
  'Depois é só colar no campo “Mensagens brutas”. Pode colar várias de uma vez, do jeito que vieram.': '然后粘贴到“Mensagens brutas”（原始消息）框里。可以一次粘贴多条，保持原样即可。',
  'Enquanto você cola, o app já mostra o que entendeu: 5 mensagens, os times reconhecidos e quantas precisam de revisão.': '粘贴的同时，应用已经显示识别结果：5条消息、识别出的班组，以及需要复核的数量。',
  'Ele lê data, time, turno, total, presentes, ausentes, e cada pessoa com matrícula e motivo, mesmo com formatos diferentes.': '它能读取日期、班组、班次、总人数、出勤、缺勤，以及每个人的工号和原因，即使消息格式不同也可以。',
  'O modelo recomendado fica aqui (e em Ajustes, pronto para mandar aos líderes).': '推荐的消息模板在这里（“Ajustes”里也有，可以直接发给班组长）。',
  'Clique em “Ler mensagens” para ir à conferência.': '点击“Ler mensagens”（读取消息），进入核对。',
  'Pronto: as 5 mensagens viraram cartões para revisar no passo 2.': '完成：5条消息变成了卡片，在第2步中核对。',

  // 3 · conferência
  'Cada time vira um cartão com uma cor: verde (tudo certo), amarelo (dê uma olhada) ou vermelho (a conta não fecha).': '每个班组是一张卡片：绿色（全部正确）、黄色（请看一下）、红色（人数对不上）。',
  '“Gravar todos” grava verdes e amarelos. Os vermelhos ficam de fora até serem corrigidos.': '“Gravar todos”（全部保存）会保存绿色和黄色的卡片，红色的要改正后才能保存。',
  'No C2B, o líder escreveu “faltou sem avisar”. O app não conhecia esse motivo, então a conta de faltas não fechou.': 'C2B的班组长写的是“faltou sem avisar”（没请假就缺勤）。应用还不认识这个原因，所以缺勤人数对不上。',
  'Corrigindo o motivo aqui mesmo, o cartão fica verde. E o app aprende: da próxima vez ele acerta sozinho.': '直接在这里改正原因，卡片就变绿了。应用还会学习：下次它会自动识别。',
  'No C3B: 40 pessoas e 37 presentes dão 3 ausentes, mas a mensagem lista só 2 nomes.': 'C3B：总共40人、出勤37人，应该缺勤3人，但消息里只列了2个名字。',
  'Conferindo com o líder, eram 38 presentes. É só corrigir o número.': '和班组长确认后，实际出勤是38人。直接改数字就行。',
  'A conta fechou e o cartão ficou verde.': '人数对上了，卡片变成绿色。',
  'No C7B, o motivo escrito foi “busquei o filho na escola”. Dá para escolher o motivo certo na lista.': 'C7B写的原因是“busquei o filho na escola”（去学校接孩子）。可以在列表里选择正确的原因。',
  'A coluna “Escrito pelo líder” guarda o texto original, para conferência.': '“Escrito pelo líder”（班组长原文）这一列保留原始文字，方便核对。',
  'E “Ver mensagem original” mostra a mensagem exatamente como veio do WhatsApp.': '“Ver mensagem original”（查看原始消息）显示WhatsApp里的原始消息。',
  'Se faltou alguém na lista, “Adicionar pessoa”. Se a mensagem veio repetida, “Descartar”.': '名单里漏了人，点“Adicionar pessoa”（添加人员）；消息重复了，点“Descartar”（丢弃）。',
  'Tudo verde: agora “Gravar todos (5)”.': '全部变绿：现在点“Gravar todos (5)”（全部保存）。',
  'Os 5 times foram gravados e o app já abriu o Fechamento do dia.': '5个班组已保存，应用自动打开了当日汇总。',

  // 4 · fechamento
  'Os números do dia: times recebidos, total de pessoas, presentes, ausentes e o % de absenteísmo com a meta.': '当日数据：已提交的班组、总人数、出勤、缺勤，以及缺勤率和目标对比。',
  '“Quem já mandou”: 5 de 6 times. O C9B aparece como pendente.': '“Quem já mandou”（已提交）：6个班组中5个已提交，C9B显示为待提交。',
  'Um clique copia a cobrança para colar no grupo e lembrar quem ainda não mandou.': '一键复制催报消息，发到群里提醒还没提交的班组。',
  'Por time: total, presentes, ausentes e %. A coluna “Antes” compara com o último envio do time (subiu ↑ ou desceu ↓).': '按班组：总人数、出勤、缺勤和百分比。“Antes”（上次）一列与该班组上次提交对比（↑上升，↓下降）。',
  'Time acima da meta fica em vermelho.': '超过目标的班组显示为红色。',
  'Por motivo: atestado, atraso, falta... Férias e afastamento aparecem, mas não contam no %.': '按原因：病假、迟到、缺勤……休假和长期病假会显示，但不计入缺勤率。',
  'A lista de quem faltou, com time, matrícula e motivo.': '缺勤人员名单，包括班组、工号和原因。',
  'O texto para o superior sai pronto, com todos os times juntos, no modelo da chefia.': '给上级的汇报文字自动生成，所有班组汇总在一起，符合领导要求的格式。',
  'Antes de mandar, ele avisa o que falta revisar (aqui: o C9B ainda não mandou).': '发送前，它会提示还需要检查的地方（这里：C9B还没提交）。',
  '“Incluir nomes” liga ou desliga os nomes das pessoas no texto.': '“Incluir nomes”（包含姓名）可以选择文字里是否显示人员姓名。',
  'Ao copiar com pendências, ele pede confirmação. Depois é só colar na conversa com o superior.': '有未完成事项时复制，会先请你确认。然后直接粘贴到和上级的对话里。',
  'E o resumo para o grupo dos líderes, com o % de cada time.': '还有发给班组长群的总结，包含每个班组的缺勤率。',
  'Também dá para imprimir ou salvar em PDF.': '也可以打印或保存为PDF。',
  'Para ver outro dia, é só trocar a data.': '想看其他日期，改一下日期就行。',

  // 5 · buscar pessoa
  'Digite o nome ou a matrícula.': '输入姓名或工号。',
  'Aparecem todas as ausências da pessoa: data, dia da semana, time e motivo. Aqui dá para ver que ele falta às segundas.': '显示此人的全部缺勤记录：日期、星期、班组和原因。这里可以看出他经常在周一缺勤。',
  'Funciona com a matrícula também.': '用工号也可以查找。',

  // 6 · período
  'Escolha as datas ou use os atalhos: esta semana, semana passada, este mês, mês passado, últimos 30 dias.': '选择日期，或使用快捷按钮：本周、上周、本月、上月、最近30天。',
  'O absenteísmo do período, com a meta e o total de ausências.': '该时间段的缺勤率、目标和缺勤总次数。',
  'A evolução dia a dia, com a linha da meta. Os pontos acima da meta ficam em vermelho.': '每天的变化趋势，带目标线。超过目标的点显示为红色。',
  'Dá para ver o gráfico de um time só.': '也可以只看一个班组的图表。',
  'A tabela mostra o % de cada time em cada dia, e o total do período.': '表格显示每个班组每天的缺勤率，以及整个时间段的合计。',
  'Quem faltou mais de uma vez no período, com os motivos.': '该时间段内缺勤不止一次的人员及原因。',
  'Os principais motivos do período.': '该时间段的主要缺勤原因。',
  'Em qual dia da semana se falta mais.': '一周中哪一天缺勤最多。',
  'E o alerta de quem teve 3 ou mais ausências em 30 dias, com o padrão de dia (ex.: “quase sempre na segunda”). Vale uma conversa do líder.': '30天内缺勤3次及以上的人员预警，并显示规律（例如“quase sempre na segunda”，几乎都在周一）。班组长应该和他谈一谈。',
  'Tudo isso vira um resumo pronto para copiar no WhatsApp, ou para imprimir em PDF.': '所有内容生成一份现成的总结，可以复制到WhatsApp，或打印成PDF。',

  // 7 · ajustes 1
  'Times esperados: a lista dos times que mandam todo dia. É ela que mostra quem ainda não mandou.': '“Times esperados”（应提交班组）：每天需要提交的班组名单，用它来显示谁还没提交。',
  'Dá para digitar um por linha ou preencher com os times que já foram lançados.': '可以每行输入一个，也可以用已录入过的班组自动填充。',
  'O nome da área vai no título do texto para o superior. A meta de absenteísmo pinta de vermelho quem passar dela.': '区域名称会出现在给上级的汇报标题中。超过缺勤率目标的班组会标成红色。',
  'O modelo de mensagem para os líderes: escolha o time e copie. Quem usa o modelo, o app lê sem nenhum aviso.': '给班组长的消息模板：选择班组并复制。使用这个模板发送，应用读取时不会有任何提示。',

  // 8 · ajustes 2
  'Marque os motivos que não entram no % de absenteísmo (ex.: férias e afastamento). A pessoa continua na lista.': '勾选不计入缺勤率的原因（例如休假和长期病假）。人员仍会显示在名单里。',
  'Motivos aprendidos: cada correção feita na conferência fica guardada aqui. Se alguma estiver errada, clique em “Esquecer”.': '“Motivos aprendidos”（已学习的原因）：核对时的每次修改都会保存在这里。如果有错，点“Esquecer”（忘记）。',
  'Arquivo Excel: escolha uma vez onde salvar. Depois, a cada gravação, a planilha é atualizada sozinha.': 'Excel文件：只需选择一次保存位置。之后每次保存，表格都会自动更新。',
  'Pronto: o Excel ficou ligado e já foi salvo. Ele também serve de backup.': '完成：Excel已关联并已保存，它也可以作为备份。',
  'Os dados ficam na conta e no aparelho. Aqui você baixa um backup, restaura (do backup ou do Excel) e exporta planilhas CSV.': '数据保存在账号和本机中。这里可以下载备份、恢复数据（从备份或Excel），以及导出CSV表格。',
  '“Apagar todos os dados” pede duas confirmações, e o Excel fica guardado como backup.': '“Apagar todos os dados”（删除全部数据）需要确认两次，Excel文件会保留作为备份。',

  // 9 · celular
  'No celular o app funciona igual, e pode ser instalado na tela inicial.': '手机上功能完全一样，还可以添加到主屏幕。',
  'Fechamento do dia na palma da mão.': '当日汇总，掌上就能完成。',
  'Copia o texto e cola direto no WhatsApp.': '复制文字，直接粘贴到WhatsApp。',
  'E o histórico também, com gráfico e alertas.': '历史记录也一样，有图表和预警。',
};
