# Absenteísmo dos times: resumo de todas as funcionalidades

App para o líder de área juntar as mensagens de absenteísmo que os líderes de time mandam no WhatsApp, conferir as contas e fechar o dia em poucos minutos. Funciona no computador e no celular (pode ser instalado na tela inicial) e continua funcionando sem internet.

O trabalho do dia tem **3 passos**: **1. Colar mensagens → 2. Conferência → 3. Fechamento do dia**. Além deles, há o **Histórico** e os **Ajustes**.

---

## Acesso, sincronização e segurança

- **Conta própria:** entrar, criar conta e "Esqueci a senha" (com link por e-mail para criar uma senha nova).
- **Sincronização entre aparelhos:** o que é gravado no computador aparece no celular e vice-versa. O botão do topo mostra o estado ("Sincronizado 08:10", "Enviando…", "Sem internet").
- **Sem internet:** tudo fica salvo no aparelho e sobe sozinho quando a internet volta. Depois do primeiro acesso, o app abre até offline.
- **Menu da conta:** "Sincronizar agora" e "Sair desta conta".
- **Segurança:** cada conta só lê e grava os próprios registros (regra no banco). Todo dado que entra (do aparelho, de backup ou da nuvem) passa por uma limpeza antes de ser usado, e a página bloqueia scripts de fora.

## 1. Colar mensagens

- Cole as mensagens do grupo **como vieram**, uma ou várias de uma vez. O app tira sozinho o prefixo do WhatsApp (data, hora e nome de quem mandou), os asteriscos e a formatação.
- **Entende formatos diferentes:** o modelo recomendado (`*Absenteísmo C7B 25/09/2026*`, total, presentes, nome/matrícula/motivo) e o formato longo ("Efetivo previsto", "Atestados médicos: 2", "ID 1234567"…).
- **Prévia enquanto cola:** quantas mensagens, quais times foram reconhecidos, quantas precisam de revisão e quantas pessoas há nas mensagens.
- **O que ele lê:** time, data (ou a data do WhatsApp, se faltar), turno, total de pessoas, presentes, ausentes, contagem por motivo e cada pessoa ausente com nome, matrícula e motivo.
- **Motivos reconhecidos:** Atestado médico, Atraso roteiro, Atraso motivo pessoal, Atraso sem justificativa, Sem justificativa, Afastamento INSS, Turno ADM, Férias e Outros. Reconhece variações ("atestado", "consulta", "ônibus atrasou", "falta sem justificativa"…).
- **Cartões de apoio:** números do dia (times esperados, última leitura, o que falta conferir, total já gravado), "Como funciona?", exemplo de mensagem e "Colar exemplo" para testar.

## 2. Conferência

Cada mensagem vira um cartão colorido: **verde** (tudo certo), **amarelo** (dê uma olhada) ou **vermelho** (a conta não fecha).

**O que ele confere sozinho:**
- conta que não fecha (total − presentes ≠ número de nomes);
- cabeçalho diferente da lista (ex.: "Sem justificativa: 1", mas ninguém na lista com esse motivo);
- presentes maior que o total; falta do total ou dos presentes;
- time sem nome, incompleto ou fora da lista de times esperados;
- mensagem sem data;
- pessoa sem matrícula, sem nome ou sem motivo; motivo não reconhecido;
- matrícula repetida na mesma mensagem, ou já ausente em outro time no mesmo dia;
- nome diferente do que já estava cadastrado para aquela matrícula; pessoa que costuma ser de outro time;
- total de pessoas muito diferente do normal do time (erro de digitação?);
- time já lançado naquele dia (se gravar, substitui);
- **reincidência:** "3ª ausência em 30 dias", com as datas anteriores.

**O que dá para fazer no cartão:** corrigir time, data ("Usar hoje"), turno, total e presentes; corrigir nome, matrícula e motivo de cada pessoa; adicionar ou remover pessoa; ver a mensagem original; descartar a mensagem.

- **Aprende motivos:** quando você corrige um motivo que ele não conhecia ("faltou sem avisar" → Sem justificativa), da próxima vez ele acerta sozinho.
- **Gravar um por um** ou **"Gravar todos"**, que grava verdes e amarelos (mostra os avisos para confirmar) e deixa os vermelhos de fora. Ao terminar, abre o Fechamento do dia.

## 3. Fechamento do dia

- **Números do dia:** times recebidos (ex.: 5/6, com barra de progresso), total de pessoas, presentes, ausentes e **% de absenteísmo com a meta**.
- **Quem já mandou:** chips verdes para os times que mandaram e "pendente" para os que faltam, mais o botão **"Copiar cobrança para quem não mandou"**.
- **Por time:** total, presentes, ausentes, **"Antes"** (compara com o último envio do time: ↑ subiu, ↓ desceu, = igual) e %, com barra. Time acima da meta fica em vermelho. Dá para apagar um lançamento.
- **Por motivo:** quantidade de cada motivo, com a etiqueta "não conta no %" nos que não entram na porcentagem.
- **Quem faltou:** lista com time, nome, matrícula e motivo.
- **Texto para o superior:** fechamento de todos os times no modelo da chefia (nome da área, efetivo, cada motivo, total presente e, se quiser, os nomes com ID e equipe). Antes de copiar, mostra o que falta revisar (time pendente, ausente sem nome, pessoa sem matrícula, motivo "Outros"). Tem a opção "Incluir nomes".
- **Resumo para o grupo:** % de cada time para mandar aos líderes, com ⚠️ em quem passou da meta, e a opção "Incluir nomes".
- **Imprimir / PDF** e **troca de data** para ver qualquer dia.

## Histórico

- **Buscar pessoa:** por nome ou matrícula. Mostra todas as ausências com data, dia da semana, time e motivo.
- **Período:** datas livres ou atalhos (esta semana, semana passada, este mês, mês passado, últimos 30 dias). Mostra o absenteísmo do período, a meta e o total de ausências.
- **Evolução:** gráfico dia a dia com a linha da meta (pontos acima em vermelho), geral ou por time.
- **Absenteísmo por time:** tabela time × dia, mais o total do período.
- **Faltou mais de uma vez:** pessoas com mais de uma ausência no período, com os motivos.
- **Por motivo** e **por dia da semana** (marca o dia em que mais se falta).
- **Atenção: 3 ou mais ausências em 30 dias**, com as datas e o padrão ("quase sempre na segunda"). Vale uma conversa do líder.
- **Resumo do período para o WhatsApp** (copiar) e **Imprimir / PDF**.

## Ajustes

- **Times esperados por dia:** um por linha, ou "Preencher com os times já lançados". É essa lista que mostra quem ainda não mandou.
- **Área e meta:** o nome da área vai no título do texto para o superior. A meta (%) pinta de vermelho quem passar dela.
- **Modelo de mensagem para os líderes:** escolha o time, veja a prévia e copie para mandar no grupo. Quem usa o modelo, o app lê sem avisos.
- **Motivos que NÃO contam no %:** ex.: Férias e Afastamento INSS. A pessoa continua na lista.
- **Motivos aprendidos:** lista do que o app aprendeu com as correções, com o botão "Esquecer".
- **Arquivo Excel:** escolha uma vez onde salvar. A cada gravação, a planilha é atualizada sozinha (Edge e Chrome). Também há "Salvar Excel agora" e "Baixar uma cópia". O Excel serve de backup.
- **Guardar e levar os dados:** baixar backup, restaurar (do backup ou do Excel do sistema), planilha de ausências (CSV), planilha de totais por time (CSV) e "Apagar todos os dados", com duas confirmações. O Excel fica como backup.

## Celular

- Layout próprio para celular e tablet, com tabelas que rolam para o lado e campos de data que funcionam no iPhone.
- Pode ser instalado como app na tela inicial.

---

## Microvídeos

Nove vídeos curtos (1080p, com legenda em português) mostrando o app sendo usado de verdade, com dados fictícios:

| # | Vídeo | O que mostra |
|---|---|---|
| 1 | Visão geral e acesso | Login, sincronização, Excel, menu da conta, as 5 etapas e a tela inicial |
| 2 | Colar mensagens | Colar 5 mensagens do WhatsApp, prévia do que foi entendido, "Ler mensagens" |
| 3 | Conferência | Cartões verde/amarelo/vermelho, corrigir motivo e conta, mensagem original, "Gravar todos" |
| 4 | Fechamento do dia | Números, quem falta, cobrança, por time/motivo, texto para o superior, resumo, PDF |
| 5 | Histórico: buscar pessoa | Busca por nome e por matrícula |
| 6 | Histórico: período | Atalhos, gráfico com meta, tabela por time, reincidência, dia da semana, resumo |
| 7 | Ajustes: times, meta e modelo | Times esperados, área e meta, modelo de mensagem para os líderes |
| 8 | Ajustes: regras, Excel e backup | Motivos que não contam, motivos aprendidos, Excel automático, backup e CSV |
| 9 | No celular | Fechamento, texto para o superior e histórico no celular |

Os vídeos são gerados por `video/demo/gravar_demo.js`, que roda o app num servidor local com o Supabase simulado e dados fictícios (`video/demo/dados.js`).
