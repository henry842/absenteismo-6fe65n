# Padronizador Inteligente de Dados C3B

Lê planilhas quaisquer (XLSX, XLSM, CSV) e gera o **Pacote Oficial de Bases C3B** em Excel: 7 bases + Manifesto,
com mapeamento assistido, normalização rastreável, validação, Quality Score, backup, versões e diagnóstico.

> Qualquer equipe pode entregar os dados que possui. O Padronizador identifica a estrutura, converte nomenclaturas,
> valida referências, aponta ambiguidades e gera as bases Excel oficiais. **Nenhuma informação operacional crítica é
> inventada** — o que não é reconhecido fica `UNKNOWN` ou vazio até uma decisão humana, e toda transformação fica no log.

A interface é a do protótipo `C3B_Padronizador_Interface.html` (tema verde escuro, hero, 9 botões, painéis, pt/中文),
preservada e ligada às funções reais.

---

## Como executar

**Sem instalar nada:** abra `index.html` no Chrome ou Edge (duplo clique). Funciona direto do disco (`file://`),
sem servidor e sem internet. A biblioteca de Excel já está em `vendor/`.

Onde os arquivos são gravados (Configurações › Onde gravar as bases):

| Destino | Lê a pasta? | Backup / versões / diagnóstico | Navegador |
|---|---|---|---|
| **Downloads do navegador** (padrão) | não | não (o navegador não deixa reler os downloads) | todos |
| **Escolher pasta…** (File System Access) | sim | sim | Chrome, Edge |
| **Bridge local** (`bridge/server.js`) | sim | sim | todos |
| Memória (simulação, modo Implantador) | sim | sim, só nesta aba | todos |

Bridge local (grava numa pasta do computador, só aceita 127.0.0.1 e exige token):

```bash
cd padronizador-c3b
npm install
node bridge/server.js "C:/Dados/C3B"        # mostra a URL e o token; cole em Configurações
```

Opcional, servir por HTTP: `npx http-server -p 8080` e abrir `http://127.0.0.1:8080/index.html`.

## Dependências

| Pacote | Versão | Licença | Uso |
|---|---|---|---|
| [ExcelJS](https://github.com/exceljs/exceljs) | 4.4.0 | MIT | ler e gravar .xlsx/.xlsm (navegador: `vendor/exceljs.min.js`; Node: `node_modules`) |
| [JSZip](https://stuk.github.io/jszip/) | 3.10.2 | MIT (ou GPLv3) | abrir o .xlsx como ZIP para ler as formas ○ △ (`xl/drawings/*.xml`) da Matriz BYD (navegador: `vendor/jszip.min.js`) |

Só para desenvolvimento/testes (não são necessários para usar a ferramenta):

- Node.js ≥ 18 (testado com 22) — testes e Bridge.
- Playwright + Chromium — teste da interface (`tests/06-interface.test.js`); se não houver, o teste é pulado e aparece como SKIPPED.
- Python 3 + openpyxl — leitor independente que reabre os .xlsx gerados; se não houver, o teste é pulado.

SheetJS (xlsx) **não** é usado: a versão do npm (0.18.5) tem vulnerabilidades conhecidas e a versão corrigida só é
distribuída pelo CDN deles. Consequência: `.xls` (Excel 97-2003) não é lido — veja Limitações.

`npm run vendor` recopia ExcelJS e JSZip de `node_modules` para `vendor/`.

## Como rodar os testes

```bash
cd padronizador-c3b
npm install
npm test             # todos (≈ 20 s), inclusive o navegador se o Playwright estiver instalado
npm run relatorio    # roda tudo e gera RELATORIO_TESTES.md (tabela Funcionalidade → PASS/FAILED)
C3B_MATRIZ_REAL=/caminho/Matriz.xlsx npm test   # inclui o teste com a Matriz BYD real
npm run fixtures     # recria as planilhas de teste em tests/fixtures/
```

## Arquitetura

```
index.html              interface (markup original + seções das telas)
src/modulo.js           carregador duplo: o mesmo arquivo roda no navegador (sem build) e no Node (require)
src/core/               regras puras, sem DOM
  dicionario.js           schemas, campos (pt/zh, tipo, obrigatório, aliases), níveis i/I/L/U, relações, master_mode
  aliases.js              motor de aliases (usuário > embutido > sugestão por similaridade > UNKNOWN)
  parsers.js              estação (C16L, C16 L1, C16-L1, FR1, "Esquerda"...), matrícula (sempre texto)
  ids.js                  IDs estáveis (EMP-, SA6H-C16-L1-001, SKL-, EVT-, TRN-, ATT-, IMPORT-, C3B-INST-)
  mapeamento.js           detecção de cabeçalho (1 ou 2 linhas), coluna → campo com confiança e motivo, LGPD
  perfis.js               detecção do tipo de aba, perfis de importação (CRUD, exportar/importar, compatibilidade)
  normalizar.js           aplica mapeamento, valores fixos e decisões; log de cada transformação
  validar.js              pendências INFO / WARNING / ERROR / BLOCKING com "como resolver"
  qualidade.js            Quality Score (pesos abaixo), status da base e do pacote
  duplicidades.js         operações parecidas campo a campo; decisão humana MESMA / DIFERENTES / DEPOIS
  historico.js            Matriz + Histórico (append-only, idempotente)
  conflitos.js            conflitos em 3 vias, comparação de versões, soft delete
  auditoria.js            lote de importação e seus estados
src/excel/              leitura (leitor.js, csv.js), formatos legados (legado.js), geração e verificação (escritor.js),
                        Matriz BYD: formas (byd_drawings.js), perfil BYD_SKILL_MATRIX_V1 (byd_matriz.js), Base Operacional (byd_base.js)
src/storage/            StorageAdapter: Memory, NodeFs, BrowserDownload, FileSystemAccess, LocalBridge
src/features/           instalação (pipeline de gravação, backup, versões, diagnóstico), importação, cadastro, relatórios
src/servicos.js         API pública (window.C3B.servicos no navegador, require() no Node)
src/ui/                 telas (uma por arquivo) + estado.js + app.js
bridge/server.js        Bridge local (Node, 127.0.0.1, token)
tests/                  testes automatizados + fixtures sintéticas
```

**Fluxo de dados:** arquivo → `analyzeWorkbook` (abas, células, mescladas, fórmulas só como valor) →
`detectHeader` / `detectSchema` → `mapColumns` → `normalizeDataset` (+ decisões do usuário) → `validateDataset` →
prévia do commit (novos / alterados / iguais / ausentes) → commit no pacote em memória → `writePackage`
(por arquivo: ler atual → comparar → validar → backup → gerar → gravar → reler e verificar → log;
Configurações e Manifesto por último, com os hashes).

**API para o C3B principal** (`src/servicos.js`): `analyzeWorkbook`, `detectHeader`, `detectSchema`, `mapColumns`,
`normalizeDataset`, `validateDataset`, `validatePackage`, `calculateQualityScore`, `generateOfficialWorkbook`,
`verifyWorkbook`, `readOfficialWorkbook`, `createInstallation`, `loadInstallation`, `diagnoseInstallation`,
`writePackage`, `listVersions`, `restoreVersion`, `compareVersions`, `compareFiles`, `detectConflicts`,
`resolveConflicts`, `registerSkill`, além de `importacao`, `cadastro`, `relatorios`, `armazenamento`, `dicionario`,
`aliases`, `perfis`. Nenhuma regra depende do HTML.

## Matriz de Habilidades BYD (perfil `BYD_SKILL_MATRIX_V1`)

Planilha "Planejamento de Treinamento de Habilidades" da BYD (uma aba por modelo: EQE, HA2H, SA6H, SC3H…). É detectada
automaticamente na importação e aparece no painel **Matriz BYD** da tela Importação.

| Dimensão | Fonte no Excel | Valores |
|---|---|---|
| `skill_level` | marcador numérico oculto **1** (fonte branca) na célula início+2/início+2 do bloco; posição confirmada pela fórmula da linha "Número L proficiente" (`=SUM(E11+E15+…)`) | `L` · `NAO_IDENTIFICADO` (os níveis oficiais i/I/L/U não mudam) |
| `assignment_status` | **formas** do Excel em `xl/drawings/drawingN.xml` (não são valores de célula): `prst="ellipse"` = ○, `prst="triangle"` = △, ligadas ao bloco pela âncora (centro entre `from` e `to`, 0-based) | ○ só → `TITULAR` · △ só → `EM_TREINAMENTO` · ○+△ → `FUTURO_TITULAR` · nenhuma → `SEM_DESIGNACAO` |
| `is_current_operator` / `is_training_planned` / `is_future_holder` | ○ / △ / ○+△ | booleanos |
| `fill_state` / `fill_rgb` | cor real da célula do marcador (inclusive cor de tema + tint) | `GREEN` (FF92D050) · `YELLOW` (FFFFFF00) · `OTHER` · `NONE` — sem significado de negócio atribuído |
| `dates_raw` / `first_date` / `latest_date` | coluna Dia/Mês do bloco (texto como "12/08/2026\n14/08/2026") | datas **não** definem designação |

- As duas dimensões são independentes: L não implica titular e titular não implica L.
- Formas sobrepostas do mesmo tipo no mesmo bloco (duas elipses em AO46) contam **uma vez**; as duas ficam na origem, uma marcada `DUPLICATA_SOBREPOSTA`.
- Formas abaixo da grade (a legenda ○ △ da própria planilha) são ignoradas e registradas como `LEGEND_SHAPE_IGNORED`; a aba "Exemplo 范例" é ignorada.
- Pendências, sem correção automática: ○ sem L, △ com L, ○+△+L, valor sem regra dentro do bloco (ex.: "c"), forma fora da grade, data inválida, total de L diferente do resultado salvo da fórmula (resultado desatualizado), matrícula ausente.
- A Matriz não tem matrícula: sem Cadastro (01) com o mesmo nome, o `employee_id` é provisório (`EMP-SEMMATR-<hash do nome>`, status `SEM_MATRICULA`).

**Base Operacional BYD** (botão no painel; `src/excel/byd_base.js`), reaberta e conferida depois de gerada:
`RESUMO`, `OPERADORES`, `OPERACOES`, `HABILIDADES_ATUAIS` (blocos com nível, forma, data ou cor: skill_level, assignment_status,
has_circle, has_triangle, is_current_operator, is_training_planned, is_future_holder, fill_state, fill_rgb, datas,
source_block, source_l_cell, source_circle_anchor, source_triangle_anchor…), `MATRIZ_LONGA` (todas as combinações pessoa × operação),
`ORIGEM_MAPEAMENTO` (cada célula e cada forma usada: purpose `CURRENT_OPERATOR_MARKER` / `TRAINING_MARKER` / `L_MARKER` / `FILL` /
`DATE_CELL`…, sheet, drawing_file, shape_name, anchor_from_row/col, anchor_to_row/col), `PENDENCIAS`, `REGRAS`, `_META`.

Resultado no arquivo de referência (teste `08-matriz-byd-real`):

| Aba | Pessoas | Operações | Nível L | ○ Titulares | △ Em treinamento | ○△ Futuros titulares | Verde | Amarelo |
|---|---|---|---|---|---|---|---|---|
| EQE | 41 | 21 | 202 | 22 | 6 | 0 | 121 | 18 |
| HA2H | 41 | 33 | 212 | 31 | 0 | 3 | 93 | 19 |
| SA6H | 41 | 37 | 205 | 32 | 1 | 7 | 74 | 20 |
| SC3H | 38 | 32 | 0 | 0 | 0 | 0 | 0 | 0 |

O total de L lido confere com a fórmula da própria planilha em HA2H, SA6H e SC3H. Em EQE, uma pessoa tem 6 marcadores
e a fórmula referencia exatamente essas 6 células, mas o resultado salvo no arquivo é 4 (planilha salva sem recalcular);
isso aparece como pendência `TOTAL_L_DIFERENTE`.

## Schemas (Pacote Oficial de Bases C3B, schema 1.0.0)

| Base | Arquivo | Aba | Chave | master_mode | Obrigatórios |
|---|---|---|---|---|---|
| 00 Manifesto (清单) | `00_Manifesto_C3B.xlsx` | MANIFESTO | `installation_id` | C3B_MASTER | installation_id, schema_version, system_version, empresa, unidade, equipe |
| 01 Cadastro da Equipe (团队名册) | `01_Cadastro_Equipe_C3B.xlsx` | CADASTRO | `employee_id` | BIDIRECTIONAL | employee_id, matricula, nome, equipe, status |
| 02 Catálogo de Operações (工序目录) | `02_Catalogo_Operacoes_C3B.xlsx` | OPERACOES | `operation_id` | EXCEL_MASTER | operation_id, model_id, modelo, station_id, estacao, descricao_pt |
| 03 Matriz de Habilidades (技能矩阵) | `03_Matriz_Habilidades_C3B.xlsx` | MATRIZ | `skill_record_id` | BIDIRECTIONAL | skill_record_id, employee_id, operation_id, skill_level, status |
| 04 Histórico de Habilidades (技能历史) | `04_Historico_Habilidades_C3B.xlsx` | HISTORICO | `event_id` | APPEND_ONLY | event_id, employee_id, operation_id, event_type, event_date |
| 05 Planejamento de Treinamentos (培训计划) | `05_Planejamento_Treinamentos_C3B.xlsx` | TREINAMENTOS | `training_id` | BIDIRECTIONAL | training_id, employee_id, operation_id, status |
| 06 Presença e Movimentações (出勤与调动) | `06_Presenca_Movimentacoes_C3B.xlsx` | PRESENCA | `attendance_id` | BIDIRECTIONAL | attendance_id, date, employee_id, status |
| 07 Configurações (配置) | `07_Configuracoes_C3B.xlsx` | GERAL, MODELOS, TURNOS, SKILL_LEVELS, ALIASES, IMPORT_PROFILES, VALIDATION_RULES, COVERAGE_RULES, SYNC_SETTINGS, DECISOES | — | ADMIN_ONLY | — |

O dicionário completo (cada campo com rótulo pt/zh, tipo, valores permitidos, aliases de cabeçalho, descrição e onde é
usado) está na tela **Dicionário**, na aba `DICIONARIO` de cada arquivo gerado e em `src/core/dicionario.js`.
Integridade: Matriz, Histórico, Treinamentos e Presença → `employee_id` do Cadastro; Matriz, Histórico e Treinamentos →
`operation_id` do Catálogo. Referência inexistente é **BLOCKING**.

Níveis (diferenciam maiúscula): **i** fase de treinamento (ainda não atende ao takt) · **I** fase independente
(segurança e qualidade dentro do takt, identifica problemas) · **L** proficiência (autonomia, trata anomalias comuns) ·
**U** orientação (orienta e treina outras pessoas).

Cada arquivo gerado tem: cabeçalhos técnicos com nota pt/zh, matrícula formatada como texto, datas como data,
listas de validação, painel congelado, filtro, colunas técnicas ocultas, aba `_META` oculta (schema, data_version,
installation_id, content_hash, import_batch_id, sync_origin, restored_from) e aba `DICIONARIO`.

## Regras principais

- **Mapeamento:** ≥ 95% entra automático; 80–94% entra marcado para revisar; < 80% não é ligado. Campos críticos
  (matrícula, estação, nível…) também precisam que os valores da coluna tenham a cara do campo.
- **Normalização:** nunca inventa. Enum não reconhecido → `UNKNOWN`; número/data inválidos → vazio com aviso;
  similaridade só sugere. Data dd/mm × mm/dd ambígua é marcada para confirmar.
- **Quality Score (0–100, só dos dados):** obrigatórios 25 · IDs válidos 20 · valores reconhecidos 15 ·
  duplicidades 15 · integridade 15 · recomendados 5 · ambiguidades 5. Base vazia = "Não iniciado" (sem nota).
- **Importação:** estados DRAFT → ANALYZING → MAPPED → VALIDATED → READY → COMMITTING → COMPLETED (ou FAILED /
  CANCELLED). Modos **Analisar sem alterar nada** e **Simular** nunca alteram as bases.
- **Gravação:** backup antes de sobrescrever (`BACKUP/<arquivo>__AAAAMMDD_HHMMSS__vN.xlsx`, nunca sobrescreve um
  backup); restauração grava a versão antiga como nova versão; o Histórico é só de acréscimo; não grava numa pasta
  que tem outra instalação; registros ausentes no arquivo novo são mantidos ou desativados, nunca apagados.

## Segurança e privacidade

- Macros/VBA de `.xlsm` **não são executados** nem copiados: o arquivo é lido só como dados. Fórmulas são lidas pelo
  valor calculado.
- O formato é decidido pelo conteúdo do arquivo, não pelo nome. Nomes de arquivo e caminhos passam por
  `caminhoSeguro` (bloqueia `..`, caracteres proibidos). O NodeFsAdapter e o Bridge não saem da pasta configurada.
- Bridge: só escuta em 127.0.0.1, exige o cabeçalho `X-C3B-Token`, recusa origens que não sejam localhost/arquivo.
- Página com Content-Security-Policy restrita (só scripts locais; rede só para 127.0.0.1/localhost).
- Minimização (LGPD): colunas reconhecidas como CPF, RG, telefone, endereço, data de nascimento, e-mail pessoal,
  salário e documentos ficam de fora por padrão e aparecem na lista "não utilizadas".
- Nenhum caminho de usuário fixo no código (`C:\Users\...`): o destino é escolhido pelo usuário.

## Mocks removidos do protótipo

| No protótipo | Agora |
|---|---|
| "Arquivos Recentes" fixos (Equipe_C3_Setembro.xlsx, Planilha_Lider_TurnoB.xlsx, Treinamento_Habilidades.csv, Copia_Revezamento.xlsx — todos "Processado") | lotes reais do projeto, com estado e contagens reais |
| Barras de qualidade fixas (87–96%) e medidor que virava 94% depois de um timer | Quality Score calculado das bases (vazio = "—") |
| Barra de progresso animada por `setInterval` ao clicar em "Analisar" | progresso real da leitura/normalização, com cancelamento |
| "Resumo da Última Importação" com números fixos | contagens da sessão/lote real |
| "Pasta C3B (OneDrive) — Conectado" | destino real escolhido (Downloads / pasta / Bridge / memória), com texto honesto |
| "Carregar Exemplo" só animava a barra | gera uma planilha fictícia marcada EXEMPLO e a processa pelo fluxo real; nada entra no projeto |
| Botões de navegação sem telas (só abriam o modal) | 9 telas funcionais + Nova Implantação |

## Limitações reais

| Item | Situação |
|---|---|
| `.xls` (Excel 97-2003) | **NOT IMPLEMENTED** — recusado com a orientação "Salvar como .xlsx". |
| Planilhas reais citadas na especificação | **Não foram fornecidas.** Os testes usam fixtures sintéticas (`tests/fixtures/`) que reproduzem as estruturas descritas (mescladas, fórmulas, cabeçalho em 2 linhas, pt/zh, uma aba por colaborador, planejamento em matriz, revezamento). Arquivos reais podem ter variações ainda não vistas. |
| Validação no Excel da Microsoft / LibreOffice | Não executada (ambiente sem Excel e sem LibreOffice Calc). Os arquivos foram reabertos pelo ExcelJS e por um leitor independente (Python/openpyxl). |
| Processamento em segundo plano | **PARTIAL** — não usa Web Worker; processa em lotes de 300 linhas cedendo a vez à interface, com progresso e cancelamento. Testado com 5.000 linhas; limite de 60 MB por arquivo. |
| Tabelas do Excel (ListObject) | Não são criadas; os arquivos usam filtro, painel congelado e validação de dados. |
| Modo "Downloads do navegador" | Não consegue ler a pasta: sem backup automático, versões, diagnóstico ou conflitos nesse modo (a tela diz isso). Use pasta escolhida (Chrome/Edge) ou o Bridge. |
| Pasta escolhida (File System Access) | Só Chrome/Edge; após recarregar, o navegador pode pedir a permissão de novo ("Reconectar pasta"). |
| Conflitos em 3 vias | A "versão base" é o retrato da última gravação guardado **neste navegador** (IndexedDB). Em outro computador sem esse retrato, só dá para comparar arquivo × Padronizador. |
| Sincronização com o C3B principal | **NOT IMPLEMENTED** (fora do escopo desta entrega): existem os contratos — API em `servicos.js`, `master_mode` por base, `LocalBridgeAdapter`, `_META` com `data_version`/`sync_origin` —, mas não há servidor de sincronização. |
| Usuários / permissões | Líder × Implantador é um modo de tela, não controle de acesso. O nome do usuário nos logs é o informado em Configurações. |
| Matriz BYD → bases oficiais 01/03 | **PARTIAL** — a Matriz gera a Base Operacional BYD, mas não alimenta sozinha o Cadastro (01) e a Matriz (03) do pacote: ela não tem matrícula (IDs provisórios) e os modelos EQE/HA2H/SC3H vêm do nome da aba. |
| Matriz BYD: outras formas | Só `ellipse` (e `flowChartConnector`) e `triangle` são marcadores. Formas em grupo usam a âncora do grupo; `absoluteAnchor` não tem célula e é ignorada. Os valores "c" e "ASS" encontrados em blocos não têm regra definida: ficam preservados como pendência. |
| Matriz BYD: arquivo real nos testes | O arquivo real tem nomes de pessoas e não fica no repositório; o teste `08` roda com `C3B_MATRIZ_REAL=<caminho>`. Sem a variável ele aparece como SKIPPED, nunca como PASS. |
| Duplicidade por similaridade | Só para operações. Pessoas são deduplicadas pela matrícula (repetição = erro; fica a primeira). |
| Tradução | Rótulos principais em pt e 中文; textos longos de ajuda e mensagens de validação só em português. |
| Arquivo protegido por senha | Não é aberto (mensagem de erro com orientação). |

## Testes executados

`npm test` — 120 testes (com subtestes, inclusive o arquivo real da Matriz BYD via `C3B_MATRIZ_REAL`), todos PASS na última execução; detalhes e tabela Funcionalidade →
Resultado em [`RELATORIO_TESTES.md`](RELATORIO_TESTES.md) (gerado por `npm run relatorio`, a partir do resultado
real de cada teste).

| Arquivo | O que cobre |
|---|---|
| `01-nucleo.test.js` | aliases, níveis i/I/L/U, modelos, estações, matrícula, datas, números, acentos/chinês, IDs, Quality Score, duplicidades, integridade, Matriz+Histórico, conflitos, diff/soft delete, LGPD, path traversal, dicionário |
| `02-leitura-normalizacao.test.js` | XLSX (mescladas, fórmulas, formato 000000), XLSM sem macro, CSV Windows-1252 e UTF-8/BOM, .xls recusado, formato pelo conteúdo, cabeçalho, mapeamento, UNKNOWN, de/para com alias persistente, formatos legados, operações e unificação, modos análise/simulação, cancelamento, 5.000 linhas, as 7 bases |
| `03-escrita-instalacao.test.js` | geração e verificação, reabertura por openpyxl, instalação do zero, backup, versões, rollback, diagnóstico, gerar ausentes, proteção contra outra instalação, histórico só de acréscimo, bloqueio com motivo, storage confinado, persistência das configurações, perfis, edição em massa, carga inicial da matriz, relatório .xlsx |
| `04-bridge.test.js` | token, origem, path traversal, contrato do StorageAdapter, instalação completa pelo Bridge |
| `05-e2e.test.js` | cenário obrigatório de 20 passos (seção 79), em disco real |
| `06-interface.test.js` | a página aberta via `file://` no Chromium: arquivo real selecionado, abas, cabeçalho, correção de mapeamento, perfil, de/para, validação, confirmação, geração com checklist, backup, diagnóstico, restauração, alias no Dicionário, modo Líder, Nova Implantação, painel da Matriz BYD e Base Operacional; sem erros no console |
| `07-matriz-byd.test.js` | fixture com a mesma estrutura da Matriz real (`tests/fixtures/gerar-matriz-byd.js`, formas gravadas no drawing): os 10 casos obrigatórios (○ → TITULAR, △ → EM_TREINAMENTO, ○+△ → FUTURO_TITULAR, ○○ sobrepostas → um titular, 1 → L, △ sem 1 → sem L, GREEN, YELLOW, origem da forma, Base Operacional reaberta) + validações, layout, Cadastro, importação e openpyxl |
| `08-matriz-byd-real.test.js` | o arquivo de referência real (com `C3B_MATRIZ_REAL`): SA6H C9 = FUTURO_TITULAR (△ E9:E10 + ○ E11), AO46 duplicada = um titular, contagens por aba, L × fórmula da planilha, cores, legenda ignorada, Base Operacional e arquivo original intacto |

## Critérios de aceite (seção 80)

| # | Critério | Estado | Evidência |
|---|---|---|---|
| 1 | Selecionar um XLSX real | PASS | `06-interface` (setInputFiles com .xlsx) |
| 2 | Conteúdo real aparece | PASS | `06-interface`, tela Importação com abas/linhas/amostra |
| 3 | Selecionar aba | PASS | `02` legado/revezamento, `06-interface` |
| 4 | Cabeçalho detectado ou escolhido | PASS | `02` planilha não padronizada (linha 4); campo "Cabeçalho" editável na tela |
| 5 | Mapeamento calculado | PASS | `02` mapeamento com confiança |
| 6 | Corrigir mapeamento | PASS | `06-interface` |
| 7 | Normalizações reais | PASS | `02`, `05` passo 5 |
| 8 | Nada inventado para desconhecido | PASS | `02` nunca inventa, `01` aliases |
| 9 | Quality Score depende dos dados | PASS | `01` Quality Score |
| 10 | Duplicidades calculadas | PASS | `01`, `05` passo 9 |
| 11 | Unificação altera os dados | PASS | `02` operações, `05` passo 10 |
| 12 | Aliases persistidos | PASS | `02` de/para, `03` configurações, `05` passo 18 |
| 13 | Perfis salvos e reaplicados | PASS | `03` perfis (perfil compatível encontrado na nova importação) |
| 14 | Sete bases com schema independente | PASS | `02` as 7 bases, `01` dicionário |
| 15 | Integridade entre arquivos | PASS | `01`, `05` passo 12 |
| 16 | XLSX real gerado | PASS | `03`, `05` |
| 17 | XLSX reabre sem erro | PASS | `03` (ExcelJS e openpyxl), `05` passo 14 |
| 18 | Instalação do zero | PASS | `03` instalação, `06` Nova Implantação |
| 19 | Manifesto criado | PASS | `05` passo 16 |
| 20 | Gerar bases ausentes | PASS | `03` diagnóstico |
| 21 | Diagnosticar pasta existente | PASS | `03`, `05` passo 20, `06` |
| 22 | Backup antes de sobrescrever | PASS | `03` regravar |
| 23 | Rollback | PASS | `03` rollback, `06` restauração |
| 24 | Alterações auditáveis | PASS | log de transformações, `LOGS/`, lotes, DECISOES; `03` relatório |
| 25 | Conflitos detectados | PASS | `01` conflitos 3 vias (na interface depende do retrato da última gravação — ver Limitações) |
| 26 | Modo simulação | PASS | `02` modos |
| 27 | Modo somente análise | PASS | `02` modos |
| 28 | Interface atual preservada | PASS | `06` (hero, 9 botões, bilíngue); CSS original em `src/ui/base.css` idêntico ao do protótipo (só as imagens embutidas viraram arquivos em `assets/`) |
| 29 | Chinês e português preservados | PASS | `01`, `02`, `03` (openpyxl lê 王伟) |
| 30 | Testes automatizados passam | PASS | `npm test`; `RELATORIO_TESTES.md` |
