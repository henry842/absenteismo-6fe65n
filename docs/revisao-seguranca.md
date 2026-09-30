# Revisão de segurança e integridade — 30/09/2026

Checklist de 100 erros comuns aplicado ao sistema de absenteísmo (página em GitHub Pages + Supabase).
Legenda: ✅ já estava protegido · 🔧 corrigido nesta revisão · ⚙️ depende de ação no painel do Supabase · ➖ não se aplica.

## Arquitetura (o que foi revisado)

- **Página** (`index.html`, `app.js`, `leitor.js`, `excel.js`, `sincronia.js`): roda no navegador, guarda no aparelho e sincroniza com a conta.
- **Banco** (Supabase, projeto `absenteismo`): tabelas `registros` (usada por esta página), `perfis`, `funcionarios`,
  `lancamentos`, `envios`, `parametros`, `textos_editados`, `auditoria`, `convites`. Migrações em `supabase/migrations/`.
- **Função** `admin-lideres` (cria/redefine/desativa logins de líder, com a chave de serviço): `supabase/functions/admin-lideres/`.
- A página dos líderes que usa `lancamentos`/`envios` **não está neste repositório** e não foi revisada.

## Resultado por item

| # | Item | Estado | Como |
|---|---|---|---|
| 1 | "Funciona" ≠ "seguro" | 🔧 | Esta revisão: banco, função e página conferidos item a item, com testes. |
| 2–4 | Chave/senha de banco/.env no front | ✅ | Só a chave **publicável** do Supabase está no front (feita para ser pública). Chave de serviço só na função, no servidor. Nenhum `.env` no repositório. |
| 5–9 | Autenticação e permissão de verdade | ✅ | Login do Supabase; **RLS em todas as tabelas**; papel (supervisor/líder) vem da tabela `perfis`, lida no servidor — nada de `isAdmin` no navegador. |
| 10, 53 | IDOR / confiar no ID do cliente | ✅ | RLS: `auth.uid() = user_id` em ler, criar, alterar e apagar. Testado: supervisor vê só os próprios registros (0 de outros). |
| 11 | IDs sequenciais | ✅ | Contas e registros com UUID; chave do lançamento só vale dentro da conta. |
| 12, 15 | SQL / Command injection | ✅ | Só a API do Supabase (consultas parametrizadas); nenhum comando de sistema. |
| 13, 55 | XSS | ✅ | Todo texto vindo do WhatsApp passa por `esc()` antes de ir para a tela; CSP bloqueia script de fora. Conferido linha a linha. |
| 14, 28–30 | CSRF / cookies | ➖ | Sessão vai no cabeçalho `Authorization` (não em cookie), então CSRF não se aplica. |
| 16 | Path traversal | ➖ | Não há servidor de arquivos. (No Padronizador, o Bridge local tem teste de path traversal.) |
| 17–19 | Upload sem validação / tamanho | 🔧 | Backup até 20 MB e só JSON/Excel do próprio sistema; tudo passa pela limpeza `sanearBase`. **Novo:** proteção contra "zip bomba" no Excel (limite ao descompactar, por arquivo e total). |
| 20–22 | Senha em texto / hash fraco | ✅ | Senhas ficam no Supabase Auth (bcrypt). O sistema nunca vê nem guarda senha. |
| 23–27 | JWT / sessão | ✅ | JWT do Supabase expira em 1 h e é renovado; "Sair" revoga a sessão e limpa o aparelho (inclusive a lixeira). Líder desativado perde acesso na hora (RLS confere `ativo`) e a conta é bloqueada. |
| 31–32 | Rate limit / força bruta | ✅🔧 | Limites do Supabase Auth no servidor. **Novo:** depois de 3 senhas erradas a tela espera (15 s, 30 s… até 5 min). |
| 33–35 | Recuperação de senha | ✅ | Link do Supabase: uso único e com validade. |
| 36 | Revelar se o e-mail existe | 🔧 | Mensagens de "esqueci a senha" e "criar conta" agora são iguais exista ou não a conta. |
| 37–38 | Senha padrão / troca inicial | ✅⚙️ | Senhas dos líderes são aleatórias (12 caracteres, sorteio sem viés). Obrigar a troca no 1º acesso precisa ser feito na página dos líderes (fora deste repositório). |
| 39 | MFA | ⚙️ | Não implementado. Recomendado para os supervisores (veem dados de saúde — atestados). Dá para fazer com o TOTP do Supabase. |
| 40–42 | Papéis e privilégios | ✅ | Supervisor e líder com regras diferentes; líder só vê o próprio time e só mexe nos últimos 7 dias. A função de admin confere "supervisor ativo" no servidor. |
| 43–47 | Banco exposto / regras abertas | ✅ | RLS ligado em tudo, sem `true` liberado; `anon` sem acesso; `convites` fechado para todos. |
| 48–49 | CORS | ✅ | A função só responde CORS para o site do sistema; e a proteção de verdade é o login + papel, não o CORS. |
| 50–51, 56 | Mass assignment / JSON sem schema | ✅ | `user_id` e `atualizado_em` são do servidor (RLS + trigger); formato da chave, tamanho do JSON e limite de 20 mil registros por conta no banco; a página limpa tudo que recebe (datas, números, motivos da lista). |
| 52, 57–58 | Cálculo no front / regra duplicada | ✅ | Os números são do próprio supervisor (não dão acesso a nada); a regra fica num lugar só (`leitor.js`), coberta por testes. |
| 59–62 | Schema sem migração | 🔧 | As 8 migrações aplicadas no Supabase **não estavam no repositório**: agora estão em `supabase/migrations/` (sem IDs de contas), mais a nova. |
| 63–64 | Excluir de vez / sem soft delete | 🔧 | **Lixeira** (Histórico): apagado, "apagar tudo", substituído por correção, trocado por backup e perdido em conflito ficam 30 dias com **Restaurar**. "Apagar tudo" exige digitar APAGAR. No servidor, a auditoria guarda o "antes". |
| 65–67 | Auditoria: quem, quando, o quê | 🔧 | Já havia auditoria em `lancamentos`, `envios`, `perfis`… **Novo:** também em `registros` (a tabela desta página), cada lançamento guarda `confirmadoPor`, e a função `admin-lideres` registra **qual supervisor** criou/redefiniu/desativou cada login (nunca a senha). |
| 68–71 | Logs / stack trace / erro interno | 🔧 | Login e função de admin não mostram mais o texto interno do servidor; o detalhe fica só no log. Nada de senha ou token em log. |
| 72–75 | Backup | 🔧⚙️ | Backup JSON e Excel já existiam. **Novo:** Ajustes mostra quando foi o último backup e avisa depois de 7 dias; restaurar é testado nos testes automáticos. Guarde o arquivo fora do aparelho. |
| 76–79 | Constraints / UNIQUE / FK | ✅ | Chaves primárias, `unique` (usuário, um líder por time, uma situação por pessoa/dia), FKs com `on delete cascade` onde faz sentido, `check` de tamanho/formato. |
| 80 | Dinheiro em float | ➖ | Sem valores monetários. |
| 81–83 | Fuso / datas em texto | ✅ | Datas guardadas como `AAAA-MM-DD`; "hoje" é a data local; hora de alteração vem do servidor. Leitura do WhatsApp é sempre dia/mês. |
| 84 | Concorrência | 🔧 | Dois aparelhos mudando o mesmo lançamento: vale o deste, e a versão do outro vai para a Lixeira com aviso (antes sumia sem ninguém ver). |
| 85–87 | Transação / duplo clique / idempotência | ✅ | Cada lançamento é um `upsert` por chave (repetir não duplica); botões de gravar/entrar ficam travados durante a operação. |
| 88 | Sucesso antes do servidor | ✅ | O aviso diz "gravado" (no aparelho) e o selo de sincronização mostra "Sincronizando… / Sincronizado / Não sincronizou". |
| 89–93 | Erros engolidos / validação removida / `any` | ✅ | `catch` vazios só onde é esperado (armazenamento cheio, sem internet) e comentados; nenhuma validação removida. |
| 94–97 | Dependências | ✅ | Uma dependência no front (supabase-js 2.57.4) com versão fixa e **SRI** (hash); CDN permitido na CSP. |
| 98 | Dev/homologação/produção | ⚙️ | Um projeto Supabase só. Os testes usam cliente falso (não tocam o banco). Para mudanças grandes, crie um 2º projeto grátis para testar. |
| 99 | Dados reais em desenvolvimento | ✅ | Testes e exemplos só com nomes e matrículas inventados; as mensagens reais coladas viraram fixtures anonimizadas. |
| 100 | Revisão humana | ⚙️ | Este documento é o ponto de partida: leia a tabela, confira as ações abaixo e revise a página dos líderes, que não está aqui. |

## O que ainda depende de você (painel do Supabase)

1. **Authentication → Providers → Email**: senha mínima **8** caracteres, com letras e números.
2. **Authentication → Password security**: ligar **Leaked password protection** (bloqueia senhas vazadas; exige plano Pro).
3. **MFA (TOTP) para supervisores** — recomendado; posso implementar se quiser.
4. **Backups do banco**: no plano grátis não há backup automático para baixar; mantenha o backup semanal pelo app
   (ou o plano Pro, com backups diários/PITR).
5. **Troca de senha no 1º acesso do líder**: fazer na página dos líderes.

## Mudanças aplicadas no servidor nesta revisão

- Migração `20260930120000_auditoria_registros_e_search_path` (aplicada): auditoria da tabela `registros`
  (o cadastro de pessoas só registra o tamanho, para não duplicar dados pessoais) e `search_path` vazio
  nas funções `papel_atual`, `time_atual` e `salvar_horario_turno`. Conferido depois: RLS continua
  funcionando e a auditoria registra usuário, chave, antes e depois.
- Função `admin-lideres` versão 4 (publicada): auditoria de quem fez cada ação e mensagens de erro sem detalhe interno.
- Avisos que continuam no painel e são intencionais: `papel_atual`/`time_atual` podem ser chamadas por quem está
  logado (devolvem só o próprio papel/time e são usadas pelas regras de acesso); `salvar_horario_turno` é
  chamada pelo líder de propósito.
