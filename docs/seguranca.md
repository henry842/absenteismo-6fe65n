# Segurança do sistema: os 99 erros, um por um

Última revisão: 30/09/2026. Nenhum sistema é "100% seguro"; isto mostra o que foi verificado, o que foi corrigido e o que ainda depende de uma decisão ou de uma ação sua.

Legenda: ✅ resolvido e verificado · ⏳ falta uma ação sua · ⚠️ limite real ou decisão sua · ➖ não se aplica a este sistema

## Situação em 30/09/2026
No ar: site novo (Cloudflare e GitHub Pages), função de administração e migração de segurança do banco (bloqueio de e-mail nos logins de líder, sessões, senha própria do líder).
**Decisão do usuário (30/09/2026): o segundo passo dos supervisores (código do celular) foi retirado.** O site e a função de administração já não usam; a regra do banco também já foi desfeita.

## O que ainda depende de você
1. ✅ O SQL que remove a regra do segundo passo no banco já foi rodado e conferido.
2. ⚠️ No painel do Supabase (Authentication): tamanho mínimo de senha **4** (decisão do usuário em 30/09/2026; o padrão do Supabase é 6 e, se ele não aceitar menos que isso, o mínimo real é 6); validade do código/link de recuperação **até 1 hora**; conferir a validade do token de acesso (padrão 1 hora).
3. ⚠️ **Backup:** o plano grátis do Supabase não faz cópia automática. Ou passar para o plano com backup diário, ou baixar o backup em Ajustes toda semana (o sistema avisa).
4. ⚠️ **Item 99 (revisão humana):** peça a alguém de TI/segurança para ler `banco/estado-atual.sql` (regras de acesso) e decidir a política de dados de saúde (atestados): quem vê, por quanto tempo guarda. Isso é LGPD e não é decisão de programa.
5. Avisar os líderes: no próximo acesso cada um vai criar a própria senha.

## Item a item

| Itens | Risco | Situação | Como está |
|---|---|---|---|
| 1, 2, 3 | Chave/senha no site, .env público | ✅ | O site só tem a chave **pública** do Supabase (feita para ficar no navegador; quem protege é o banco). Chave secreta e senha de banco não existem no código (teste automático confere). Pasta publicada leva só 15 arquivos. Histórico do Git sem segredos (verificado). |
| 4, 5, 6, 7, 8 | Proteger só no site; localStorage; "isAdmin" no navegador | ✅ | Toda regra vale no **banco** (RLS). O papel (líder/supervisor) vem da tabela `perfis` no servidor; nada do navegador decide. Mexer no localStorage só muda a tela, o banco recusa. |
| 9, 10, 52 | Trocar o ID e ver dado alheio | ✅ | Líder só lê/grava o **próprio time** (regra por linha). IDs de lançamento e funcionário são UUID aleatórios. O banco decide pelo login, não pelo ID enviado. |
| 11 | SQL Injection | ✅ | Não existe SQL montado com texto de usuário. O site usa a API do Supabase (parametrizada); nenhum filtro com texto livre (verificado por busca no código). |
| 12, 54 | XSS | ✅ | Todo dado de pessoa entra na tela por `esc()`/`textContent`; teste automático varre o código; política de segurança do navegador (CSP) sem script inline. **Ataque simulado** com nomes/justificativas maliciosos, nas telas de líder e supervisor: nada executou. |
| 13 | CSRF | ➖ | O sistema não usa cookie de sessão (o token vai em cabeçalho), então CSRF clássico não existe. |
| 14, 15 | Injeção de comando; acesso a pastas | ➖ | Não há servidor executando comandos nem lendo arquivos. O leitor de planilha trabalha só em memória. |
| 16, 17, 18 | Upload de arquivo | ✅ | O site só **lê** planilhas no navegador da própria pessoa. Recusa por conteúdo, não por extensão (testado com executável e PDF renomeados), com limites de tamanho (5/20/30 MB, 80 MB descompactado). |
| 19, 20, 21 | Hash de senha | ✅ | O Supabase guarda senha com bcrypt. O sistema nunca guarda nem registra senha (a gerada aparece uma vez na tela). |
| 22, 23, 24 | JWT | ✅ | Emitido e assinado pelo Supabase, com validade e renovação. Só carrega id/e-mail/papel de login, nunca dado de saúde. (Conferir a validade no painel: item 4 acima.) |
| 25 | Sessão viva depois do logout | ✅ | Sair encerra a sessão. Ao **redefinir a senha ou desativar** um líder, as sessões abertas dele são derrubadas. Desativar já corta o acesso no ato, pela regra do banco. |
| 26 | Sessão que nunca expira | ✅/⚠️ | **Supervisor** sai sozinho após 30 min parado (sem perder nada pendente). **Líder** mantém a sessão (precisa para trabalhar sem internet); se perder o celular, o supervisor desativa o login e o acesso acaba na hora. Limite total de tempo de sessão é recurso pago do Supabase. |
| 27, 28, 29 | Cookies | ➖/⚠️ | Sem cookies. O token fica no armazenamento do navegador (jeito do Supabase): quem consegue rodar script na página o lê. Por isso a defesa é o XSS bloqueado + CSP estrita (itens 12 e 54). |
| 30, 31 | Limite de tentativas / força bruta | ⚠️ | Login: limites padrão do Supabase Auth (não confirmei o valor no seu projeto). Senhas de líder têm 12 caracteres aleatórios e cada líder passa a ter a própria. O supervisor entra só com a senha (peça que use uma senha forte e só sua). Escrita no banco tem tetos (500 lançamentos/time/dia etc.). **Não há captcha**: se quiser, dá para ligar o Turnstile da Cloudflare no login. |
| 32 | Recuperação de senha insegura | ✅ (era grave) | Os logins de líder usam e-mail **inventado** num domínio que **ninguém registrou** (`absenteismo.app`). Qualquer pessoa poderia registrar o domínio, pedir "esqueci a senha" pela API pública e tomar a conta do líder. Agora o banco bloqueia todo envio de e-mail e toda troca de e-mail para esses logins (teste embutido na migração passou). Há duas barreiras: o Supabase já recusava endereço de domínio sem servidor de e-mail, e o banco passa a recusar mesmo que alguém registre o domínio e configure e-mail. |
| 33, 34 | Token de recuperação reutilizável / eterno | ✅ | Do Supabase: uso único e com validade (conferir validade: item 4). |
| 35 | Revelar se o e-mail existe | ✅ | Login errado: "Usuário ou senha errados". "Esqueci a senha": mesma resposta exista a conta ou não. |
| 36 | Senha padrão para todos | ✅ | Cada líder recebe senha aleatória própria. |
| 37 | Senha inicial vira permanente | ✅ | O líder é obrigado a criar a própria senha (mín. 4 por decisão do usuário; recusa o usuário dentro da senha e as óbvias como 1234, 0000 e "senha") no próximo acesso online. Os 10 líderes já criados estão marcados. |
| 38 | MFA | ⚠️ decisão sua | O segundo passo (código do celular) foi **retirado** a pedido do usuário em 30/09/2026. Supervisores entram só com a senha, e eles veem os dados de saúde de todos os times: por isso a senha forte, a saída automática após 30 min parado e o registro de alterações ficam ainda mais importantes. Dá para religar no futuro. |
| 39, 40 | Papéis | ⚠️ | Hoje são dois: líder (só o time) e supervisor (tudo). Não existe papel "só leitura" para um chefe que apenas consulta. Se surgir essa necessidade, precisa criar. |
| 41 | Acesso administrativo demais | ✅ | A chave de administração só existe dentro da função no servidor, que só um supervisor logado aciona. O site usa só a chave pública. |
| 42, 43, 44, 45, 46 | Banco exposto / RLS | ✅ | RLS ligado nas 9 tabelas; nenhuma regra aberta a `anon`/`public` (a tabela de convites nega tudo). Regras testadas com ataques (líder de outro time, virar supervisor, falsificar autor, datas fora da janela). Firebase: ➖. |
| 47, 48 | CORS | ✅ | A função de administração só aceita 4 origens conhecidas. CORS não é usado como proteção: quem protege é o login + RLS. |
| 49, 50 | Campos que o usuário não deveria mandar | ✅ | Autor e time são amarrados ao login no banco; o papel só muda por função de administração. Ninguém manda "role". |
| 51 | Confiar em cálculo do site | ⚠️ | Totais são calculados no navegador a partir das linhas guardadas. Um líder pode informar um total de pessoas errado do **próprio** time (limitado a 0–1000, e fica na auditoria). Risco aceito. |
| 53, 55 | Validar no servidor; JSON sem forma | ✅/⚠️ | Tamanhos, formatos, horários e tipos são conferidos no banco. Só a base antiga do WhatsApp (`registros`) e a auditoria são JSON livre, com teto de tamanho (100/500 KB). |
| 56, 57, 58 | Regra duplicada; campos inventados | ✅ | Regras de negócio num lugar só (`lideres.js`, `leitor.js`) com 120 testes. Colunas conferidas contra o banco real. |
| 59, 60, 61 | Migrações | ✅ | Todas as mudanças do banco foram migrações versionadas no Supabase (9). Agora o projeto também guarda `banco/migracoes/` e um retrato completo `banco/estado-atual.sql`. |
| 62, 63 | Excluir sem volta | ✅/⚠️ | Funcionário e login são **desativados** (não apagados). Lançamento apagado pelo líder some, mas o conteúdo fica na auditoria. |
| 64, 65, 66 | Auditoria | ✅ | Tabela `auditoria` escrita só por gatilho: quem, o quê, quando, antes e depois. Só supervisor lê e ninguém edita. Mudanças feitas direto no painel do Supabase aparecem como "sistema". |
| 67, 68, 69, 70 | Logs e mensagens de erro | ✅ | A tela mostra mensagens simples (o texto técnico do servidor não vai mais para a tela). Nada de senha/token em log. O console só recebe mensagens curtas de erro, sem dados de pessoas. |
| 71, 72, 73, 74 | Backup | ⚠️ | **Plano grátis sem backup automático.** Existe exportação completa (Excel/JSON/CSV) e lembrete a cada 7 dias. **Restaurar** os lançamentos dos líderes a partir do backup **não existe** (o arquivo guarda, mas restaura só a base antiga): não testei restauração porque a função não existe. Recomendo o plano com backup diário. |
| 75, 76, 77, 78 | Restrições, únicos, chaves | ✅/⚠️ | Muitas restrições e únicos (pessoa por dia, um líder por time, usuário). Matrícula não é única de propósito (há repetidas/em branco no cadastro real; a tela Equipe sinaliza). Lançamento não aponta para funcionário por chave: o histórico sobrevive a mudanças no cadastro. |
| 79, 80, 81, 82 | Dinheiro, fuso, datas | ✅/⚠️ | Sem dinheiro. Datas são do tipo `date`. O "hoje" vem do relógio do aparelho; o banco só aceita de 7 dias atrás até amanhã. Um celular com relógio errado ainda pode lançar no dia errado dentro dessa janela. |
| 83, 84 | Concorrência e transações | ⚠️ | Vale a última gravação. Cada time tem um líder e a mesma pessoa não entra duas vezes no dia. A importação do cadastro roda em blocos e avisa se algum falhou (não é tudo-ou-nada). |
| 85, 86, 87, 88 | Clique duplo, repetição, "sucesso" falso, erro engolido | ✅ | Banco impede duplicata; envio do dia é sobrescrito, não duplicado; lançamento sem internet mostra "guardado neste aparelho"; nenhum erro do servidor é ignorado (só falha de armazenamento local). |
| 89, 90, 91, 92 | IA mexendo em validação, TypeScript | ➖/✅ | JavaScript puro sem etapa de build; sem `any`/`ts-ignore`. Os 120 testes travam as validações. |
| 93, 94, 95, 96 | Dependências | ✅ | Uma só (a biblioteca do Supabase), em versão exata e com hash de integridade. Wrangler e a função de administração também com versão fixa. |
| 97 | Ambientes separados | ⚠️ | Existe um só projeto Supabase (produção). Testes usam um simulador local e blocos que se desfazem; a migração nova tem teste embutido. Ideal: um projeto de teste separado. |
| 98 | Dados reais em desenvolvimento | ✅ | Achei um nome e matrículas **reais** num arquivo de teste meu (nunca foi enviado ao GitHub). Troquei por dados inventados e criei teste que trava. A planilha real fica fora do Git. Atenção: os commits locais antigos ainda contêm esse nome (ver "Antes de enviar ao GitHub"). |
| 99 | Revisão humana | ⚠️ | Não substituível. Ver item 6 da lista de cima. |

## Outros achados desta revisão
- **Domínio inventado dos logins de líder é livre para registro** (item 32 acima). Grave; correção pronta na migração.
- **Nome e matrícula reais em teste** (item 98). Corrigido; o histórico local ainda tem.
- **Arquivo de configuração automático do Wrangler** (`wrangler.jsonc`) publicaria a **pasta inteira**, com planilhas e testes. Foi apagado antes de qualquer envio; a publicação usa uma pasta com só 15 arquivos.
- **"Criar conta" e cadastro público:** removidos do site e bloqueados no banco.
- **Repositório do GitHub é público:** nada que dê acesso está lá, mas por isso nenhum dado real pode entrar nele.

## Histórico do GitHub
Os commits locais antigos foram reunidos num só antes do envio, sem os dados reais. O nome do item 98 **não foi enviado** ao GitHub; ele só existe no registro interno do Git deste computador, que não é publicado.

## Como conferir
`node --test testes/*.test.js` (121 testes, incluindo os de segurança do site). A troca de senha e a saída por inatividade foram testadas no navegador com um Supabase simulado.
