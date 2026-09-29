// Roteiro dos microvídeos do app de absenteísmo. Cada cena começa com o app aberto num estado:
// 'deslogado', 'historico' (5 semanas gravadas até 24/09) ou 'dia-gravado' (histórico + 25/09 de 5 times).
const C = t => `.cartao:has(h3:has-text("${t}"))`;
const MSG = t => `.cartao.msg:has(h3.titulo-msg:has-text("${t}"))`;

module.exports = [
  {
    id: '01-visao-geral-e-acesso', estado: 'deslogado',
    async rodar(h) {
      await h.titulo('1 de 9', 'Visão geral e acesso', 'Entrar na conta, sincronização e as 5 etapas do app');
      await h.leg('O app junta as mensagens de absenteísmo que os líderes mandam no WhatsApp e fecha o dia em poucos minutos.', { ms: 4200 });
      await h.leg('Cada líder de área entra com a própria conta. Os dados ficam iguais no celular e no computador.', { ms: 1200 });
      await h.dest('#telaLogin .cartao');
      await h.digitar('#loginEmail', 'lider.demo@exemplo.com', 35);
      await h.digitar('#loginSenha', '••••••••', 70);
      await h.dest(null);
      await h.clicar('#btnEntrar', { depois: 1600 });
      await h.leg('No topo: a data de hoje, o estado da sincronização e o arquivo Excel.', { ms: 400 });
      await h.dest('header .envolve', 4); await h.esperar(2600);
      await h.dest('#estadoSinc'); await h.leg('“Sincronizado” quer dizer que celular e computador estão com os mesmos dados. Sem internet, tudo fica salvo no aparelho e sobe sozinho depois.', { ms: 5200 });
      await h.dest('#estadoExcel'); await h.leg('O Excel pode ser atualizado sozinho a cada gravação (configura em Ajustes).', { ms: 3600 });
      await h.dest(null);
      await h.clicar('#btnUsuario', { depois: 600 });
      await h.dest('#menuUsuario'); await h.leg('No menu da conta: sincronizar agora ou sair.', { ms: 3200 });
      await h.clicar('#btnUsuario', { depois: 400 }); await h.dest(null);
      await h.dest('#abas'); await h.leg('O trabalho do dia segue 3 passos: 1 Colar mensagens · 2 Conferência · 3 Fechamento do dia.', { ms: 4600 });
      await h.leg('E ainda tem Histórico (análises de qualquer período) e Ajustes (times, meta, Excel e backup).', { ms: 4200 });
      await h.dest('#numerosColar'); await h.leg('A tela inicial já mostra: times esperados, última leitura, o que falta conferir e o total do dia.', { ms: 4600 });
      await h.fim('Visão geral e acesso');
    },
  },
  {
    id: '02-colar-mensagens', estado: 'historico',
    async rodar(h) {
      await h.titulo('2 de 9', 'Passo 1 · Colar mensagens', 'Importar do WhatsApp sem digitar nada');
      await h.leg('No grupo do WhatsApp, selecione as mensagens de absenteísmo dos times e copie.', { ms: 3600 });
      await h.rolar(C('Mensagens brutas'), 'start');
      await h.leg('Depois é só colar no campo “Mensagens brutas”. Pode colar várias de uma vez, do jeito que vieram.', { ms: 800 });
      await h.colar('#entrada', await h.page.evaluate(() => window.__mensagensDoDia('2026-09-25')));
      await h.leg('Enquanto você cola, o app já mostra o que entendeu: 5 mensagens, os times reconhecidos e quantas precisam de revisão.', { ms: 300 });
      await h.rolar(C('Resumo da importação'), 'center');
      await h.dest(C('Resumo da importação')); await h.esperar(5200);
      await h.dest(C('O que o sistema identifica')); await h.leg('Ele lê data, time, turno, total, presentes, ausentes, e cada pessoa com matrícula e motivo, mesmo com formatos diferentes.', { ms: 5600 });
      await h.dest(C('Exemplo de mensagem')); await h.leg('O modelo recomendado fica aqui (e em Ajustes, pronto para mandar aos líderes).', { ms: 3800 });
      await h.dest(null);
      await h.rolar('#btnLer');
      await h.leg('Clique em “Ler mensagens” para ir à conferência.', { ms: 300 });
      await h.clicar('#btnLer', { depois: 1800 });
      await h.leg('Pronto: as 5 mensagens viraram cartões para revisar no passo 2.', { ms: 3400 });
      await h.fim('Colar mensagens');
    },
  },
  {
    id: '03-conferencia', estado: 'historico',
    async rodar(h) {
      await h.page.fill('#entrada', await h.page.evaluate(() => window.__mensagensDoDia('2026-09-25')));
      await h.page.click('#btnLer'); await h.esperar(900); await h.page.evaluate(() => window.scrollTo(0, 0));
      await h.titulo('3 de 9', 'Passo 2 · Conferência', 'O app confere as contas e aponta o que precisa corrigir');
      await h.leg('Cada time vira um cartão com uma cor: verde (tudo certo), amarelo (dê uma olhada) ou vermelho (a conta não fecha).', { ms: 5200 });
      await h.dest('#btnConfirmarVerdes'); await h.leg('“Gravar todos” grava verdes e amarelos. Os vermelhos ficam de fora até serem corrigidos.', { ms: 4400 });
      await h.dest(null);
      await h.rolar(MSG('C2B'), 'start');
      await h.dest(`${MSG('C2B')} .avisos`); await h.leg('No C2B, o líder escreveu “faltou sem avisar”. O app não conhecia esse motivo, então a conta de faltas não fechou.', { ms: 5200 });
      await h.dest(null);
      await h.escolher(`${MSG('C2B')} tr:has(input[value="Karina Veloso"]) select`, 'Sem justificativa');
      await h.leg('Corrigindo o motivo aqui mesmo, o cartão fica verde. E o app aprende: da próxima vez ele acerta sozinho.', { ms: 4600 });
      await h.rolar(MSG('C3B'), 'start');
      await h.dest(`${MSG('C3B')} .avisos`); await h.leg('No C3B: 40 pessoas e 37 presentes dão 3 ausentes, mas a mensagem lista só 2 nomes.', { ms: 4600 });
      await h.dest(null);
      await h.leg('Conferindo com o líder, eram 38 presentes. É só corrigir o número.', { ms: 400 });
      await h.limparEDigitar(`${MSG('C3B')} [data-campo="presentes"]`, '38');
      await h.dest(MSG('C3B')); await h.leg('A conta fechou e o cartão ficou verde.', { ms: 3000 }); await h.dest(null);
      await h.rolar(MSG('C7B'), 'start');
      await h.dest(`${MSG('C7B')} .avisos`); await h.leg('No C7B, o motivo escrito foi “busquei o filho na escola”. Dá para escolher o motivo certo na lista.', { ms: 4400 });
      await h.dest(null);
      await h.escolher(`${MSG('C7B')} tr:has(input[value="Igor Tavares"]) select`, 'Atraso motivo pessoal');
      await h.leg('A coluna “Escrito pelo líder” guarda o texto original, para conferência.', { ms: 3600 });
      await h.clicar(`${MSG('C7B')} details.original summary`, { depois: 900 });
      await h.leg('E “Ver mensagem original” mostra a mensagem exatamente como veio do WhatsApp.', { ms: 3600 });
      await h.dest(`${MSG('C7B')} [data-acao="addPessoa"]`); await h.leg('Se faltou alguém na lista, “Adicionar pessoa”. Se a mensagem veio repetida, “Descartar”.', { ms: 4200 });
      await h.dest(null);
      await h.topo();
      await h.dest('#btnConfirmarVerdes'); await h.leg('Tudo verde: agora “Gravar todos (5)”.', { ms: 2400 }); await h.dest(null);
      await h.clicar('#btnConfirmarVerdes', { depois: 1800 });
      await h.leg('Os 5 times foram gravados e o app já abriu o Fechamento do dia.', { ms: 3600 });
      await h.fim('Conferência');
    },
  },
  {
    id: '04-fechamento-do-dia', estado: 'dia-gravado',
    async rodar(h) {
      await h.page.click('[data-aba="dia"]'); await h.esperar(600);
      await h.titulo('4 de 9', 'Passo 3 · Fechamento do dia', 'Números do dia, quem falta mandar e os textos prontos');
      await h.dest('.kpis'); await h.leg('Os números do dia: times recebidos, total de pessoas, presentes, ausentes e o % de absenteísmo com a meta.', { ms: 5200 });
      await h.dest('.cartao:has(.mandou)'); await h.leg('“Quem já mandou”: 5 de 6 times. O C9B aparece como pendente.', { ms: 4200 });
      await h.clicar('#btnCobranca', { depois: 900 });
      await h.leg('Um clique copia a cobrança para colar no grupo e lembrar quem ainda não mandou.', { ms: 3800 });
      await h.rolar(C('Por time'), 'start'); await h.dest(C('Por time'));
      await h.leg('Por time: total, presentes, ausentes e %. A coluna “Antes” compara com o último envio do time (subiu ↑ ou desceu ↓).', { ms: 5600 });
      await h.leg('Time acima da meta fica em vermelho.', { ms: 3000 });
      await h.dest(C('Por motivo')); await h.leg('Por motivo: atestado, atraso, falta... Férias e afastamento aparecem, mas não contam no %.', { ms: 4800 });
      await h.rolar(C('Quem faltou'), 'start'); await h.dest(C('Quem faltou')); await h.leg('A lista de quem faltou, com time, matrícula e motivo.', { ms: 3600 });
      await h.rolar(C('Texto para o superior'), 'start'); await h.dest(C('Texto para o superior'));
      await h.leg('O texto para o superior sai pronto, com todos os times juntos, no modelo da chefia.', { ms: 4400 });
      await h.dest(`${C('Texto para o superior')} .caixa-aviso`); await h.leg('Antes de mandar, ele avisa o que falta revisar (aqui: o C9B ainda não mandou).', { ms: 4200 });
      await h.dest(null);
      await h.clicar('#nomesSuperior', { depois: 900 }); await h.leg('“Incluir nomes” liga ou desliga os nomes das pessoas no texto.', { ms: 3200 });
      await h.clicar('#nomesSuperior', { depois: 700 });
      await h.clicar('#btnCopiarSuperior', { depois: 1200 });
      await h.leg('Ao copiar com pendências, ele pede confirmação. Depois é só colar na conversa com o superior.', { ms: 4600 });
      await h.rolar(C('Resumo para o grupo'), 'start'); await h.dest(C('Resumo para o grupo'));
      await h.leg('E o resumo para o grupo dos líderes, com o % de cada time.', { ms: 3600 }); await h.dest(null);
      await h.clicar('#btnCopiar', { depois: 1200 });
      await h.clicar('#btnImprimirDia', { depois: 900 });
      await h.leg('Também dá para imprimir ou salvar em PDF.', { ms: 3800 });
      await h.topo(); await h.dest('.datas');
      await h.leg('Para ver outro dia, é só trocar a data.', { ms: 3000 });
      await h.fim('Fechamento do dia');
    },
  },
  {
    id: '05-historico-buscar-pessoa', estado: 'dia-gravado',
    async rodar(h) {
      await h.page.click('[data-aba="historico"]'); await h.esperar(600);
      await h.titulo('5 de 9', 'Histórico · Buscar pessoa', 'Todas as ausências de alguém em segundos');
      await h.dest(C('Buscar pessoa')); await h.leg('Digite o nome ou a matrícula.', { ms: 1600 });
      await h.digitar('#buscaPessoa', 'Rafael', 110);
      await h.dest(null); await h.rolar('#resultadoBusca', 'center');
      await h.dest('#resultadoBusca'); await h.leg('Aparecem todas as ausências da pessoa: data, dia da semana, time e motivo. Aqui dá para ver que ele falta às segundas.', { ms: 6000 });
      await h.dest(null); await h.topo();
      await h.leg('Funciona com a matrícula também.', { ms: 400 });
      await h.limparEDigitar('#buscaPessoa', await h.page.evaluate(() => window.__matricula('Bianca Moura')), 90);
      await h.rolar('#resultadoBusca', 'center'); await h.dest('#resultadoBusca'); await h.esperar(4200);
      await h.fim('Buscar pessoa');
    },
  },
  {
    id: '06-historico-periodo', estado: 'dia-gravado',
    async rodar(h) {
      await h.page.click('[data-aba="historico"]'); await h.esperar(600);
      await h.titulo('6 de 9', 'Histórico · Período e análises', 'Tendência, reincidência e resumo para o WhatsApp');
      await h.rolar(C('Período e filtros'), 'start');
      await h.dest(C('Período e filtros')); await h.leg('Escolha as datas ou use os atalhos: esta semana, semana passada, este mês, mês passado, últimos 30 dias.', { ms: 1200 });
      await h.clicar('[data-periodo="30"]', { depois: 1000 });
      await h.dest('#faixaPeriodo'); await h.leg('O absenteísmo do período, com a meta e o total de ausências.', { ms: 3600 });
      await h.rolar(C('Evolução'), 'start'); await h.dest(C('Evolução'));
      await h.leg('A evolução dia a dia, com a linha da meta. Os pontos acima da meta ficam em vermelho.', { ms: 4600 });
      await h.escolher('#serieGrafico', 'C3B'); await h.dest(C('Evolução'));
      await h.leg('Dá para ver o gráfico de um time só.', { ms: 3200 });
      await h.rolar(C('Absenteísmo por time'), 'start'); await h.dest(C('Absenteísmo por time'));
      await h.leg('A tabela mostra o % de cada time em cada dia, e o total do período.', { ms: 4200 });
      await h.rolar(C('Faltou mais de uma vez'), 'start'); await h.dest(C('Faltou mais de uma vez'));
      await h.leg('Quem faltou mais de uma vez no período, com os motivos.', { ms: 3800 });
      await h.dest(C('Por motivo')); await h.leg('Os principais motivos do período.', { ms: 3000 });
      await h.rolar(C('Por dia da semana'), 'start'); await h.dest(C('Por dia da semana'));
      await h.leg('Em qual dia da semana se falta mais.', { ms: 3400 });
      await h.dest(C('3 ou mais ausências')); await h.leg('E o alerta de quem teve 3 ou mais ausências em 30 dias, com o padrão de dia (ex.: “quase sempre na segunda”). Vale uma conversa do líder.', { ms: 6200 });
      await h.rolar(C('Resumo do período'), 'start'); await h.dest(C('Resumo do período'));
      await h.leg('Tudo isso vira um resumo pronto para copiar no WhatsApp, ou para imprimir em PDF.', { ms: 1200 });
      await h.clicar('#btnCopiarPeriodo', { depois: 2400 });
      await h.fim('Período e análises');
    },
  },
  {
    id: '07-ajustes-times-meta-modelo', estado: 'dia-gravado',
    async rodar(h) {
      await h.page.click('[data-aba="ajustes"]'); await h.esperar(600);
      await h.titulo('7 de 9', 'Ajustes · Times, meta e modelo', 'Deixar o app com a cara da sua operação');
      await h.dest(C('Times esperados')); await h.leg('Times esperados: a lista dos times que mandam todo dia. É ela que mostra quem ainda não mandou.', { ms: 4600 });
      await h.clicar('#btnTimesDosLancamentos', { depois: 900 });
      await h.leg('Dá para digitar um por linha ou preencher com os times que já foram lançados.', { ms: 3600 });
      await h.rolar(C('Área e meta'), 'center'); await h.dest(C('Área e meta'));
      await h.leg('O nome da área vai no título do texto para o superior. A meta de absenteísmo pinta de vermelho quem passar dela.', { ms: 1000 });
      await h.limparEDigitar('#cfgMeta', '2.5', 150);
      await h.clicar(`${C('Área e meta')} button`, { depois: 1400 });
      await h.rolar(C('Modelo de mensagem'), 'center'); await h.dest(C('Modelo de mensagem'));
      await h.leg('O modelo de mensagem para os líderes: escolha o time e copie. Quem usa o modelo, o app lê sem nenhum aviso.', { ms: 800 });
      await h.escolher('#modeloTime', 'C9B');
      await h.clicar('#btnCopiarModelo', { depois: 2600 });
      await h.fim('Times, meta e modelo');
    },
  },
  {
    id: '08-ajustes-regras-excel-backup', estado: 'dia-gravado',
    async rodar(h) {
      await h.page.click('[data-aba="ajustes"]'); await h.esperar(600);
      await h.titulo('8 de 9', 'Ajustes · Regras, Excel e backup', 'O que conta no %, o que o app aprendeu e onde os dados ficam');
      await h.rolar(C('NÃO contam'), 'center'); await h.dest(C('NÃO contam'));
      await h.leg('Marque os motivos que não entram no % de absenteísmo (ex.: férias e afastamento). A pessoa continua na lista.', { ms: 5000 });
      await h.rolar(C('Motivos aprendidos'), 'center'); await h.dest(C('Motivos aprendidos'));
      await h.leg('Motivos aprendidos: cada correção feita na conferência fica guardada aqui. Se alguma estiver errada, clique em “Esquecer”.', { ms: 5400 });
      await h.rolar(C('Arquivo Excel'), 'center'); await h.dest(C('Arquivo Excel'));
      await h.leg('Arquivo Excel: escolha uma vez onde salvar. Depois, a cada gravação, a planilha é atualizada sozinha.', { ms: 800 });
      await h.clicar('#btnEscolherExcel', { depois: 1400 });
      await h.dest('#infoExcel'); await h.leg('Pronto: o Excel ficou ligado e já foi salvo. Ele também serve de backup.', { ms: 1800 });
      await h.dest(null); await h.topo(); await h.dest('#estadoExcel'); await h.esperar(2600);
      await h.rolar(C('Guardar e levar'), 'center'); await h.dest(C('Guardar e levar'));
      await h.leg('Os dados ficam na conta e no aparelho. Aqui você baixa um backup, restaura (do backup ou do Excel) e exporta planilhas CSV.', { ms: 1200 });
      await h.clicar('#btnCsvAusencias', { depois: 1600 });
      await h.dest('#btnApagarTudo'); await h.leg('“Apagar todos os dados” pede duas confirmações, e o Excel fica guardado como backup.', { ms: 4400 });
      await h.fim('Regras, Excel e backup');
    },
  },
  {
    id: '09-no-celular', estado: 'dia-gravado', movel: true,
    async rodar(h) {
      await h.titulo('9 de 9', 'No celular', 'O mesmo app, no bolso do líder', 2400);
      await h.leg('No celular o app funciona igual, e pode ser instalado na tela inicial.', { ms: 3600, topo: true });
      await h.clicar('[data-aba="dia"]', { depois: 1000 }); await h.esconderCursor();
      await h.leg('Fechamento do dia na palma da mão.', { ms: 400, topo: true });
      await h.page.evaluate(() => window.scrollBy({ top: 520, behavior: 'smooth' })); await h.esperar(2200);
      await h.page.evaluate(() => window.scrollBy({ top: 700, behavior: 'smooth' })); await h.esperar(2200);
      await h.rolar(C('Texto para o superior'), 'start');
      await h.leg('Copia o texto e cola direto no WhatsApp.', { ms: 400, topo: true });
      await h.clicar('#btnCopiarSuperior', { depois: 3600 });
      await h.clicar('[data-aba="historico"]', { depois: 1000 }); await h.esconderCursor();
      await h.rolar(C('Evolução'), 'start');
      await h.leg('E o histórico também, com gráfico e alertas.', { ms: 3600, topo: true });
      await h.fim('No celular');
    },
  },
];
