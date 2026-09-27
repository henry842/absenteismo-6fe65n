# Relatório de testes — Padronizador C3B

Gerado por `npm run relatorio` em 2026-09-27T22:55:42.856Z (Node v22.22.2).
Cada linha só é PASS se todos os testes que a comprovam passaram nesta execução.

```
Funcionalidade                              Resultado  (testes)
XLSX import                                 PASS       (2)
XLSM import (sem executar macro)            PASS       (1)
CSV import                                  PASS       (2)
.xls antigo recusado com orientação         PASS       (1)
Formato pelo conteúdo, não pelo nome        PASS       (1)
Header detection                            PASS       (2)
Header mapping                              PASS       (3)
Correção manual de mapeamento (UI)          PASS       (1)
Station parser                              PASS       (1)
Model parser                                PASS       (1)
Normalização segura (nunca inventa)         PASS       (2)
Aliases                                     PASS       (4)
Skill levels i/I/L/U                        PASS       (1)
Stable IDs                                  PASS       (1)
Quality score                               PASS       (2)
Duplicate detection                         PASS       (3)
Integrity validation                        PASS       (2)
Profiles                                    PASS       (1)
Seven independent schemas                   PASS       (2)
XLSX export                                 PASS       (2)
Reopen generated workbook                   PASS       (3)
Manifest                                    PASS       (1)
Installation from scratch                   PASS       (1)
Installation diagnosis                      PASS       (2)
Generate missing bases                      PASS       (1)
Backup                                      PASS       (1)
Rollback                                    PASS       (1)
Conflict detection                          PASS       (1)
Diff / soft delete                          PASS       (1)
Matrix + History (append-only, idempotent)  PASS       (2)
Analysis / simulation modes                 PASS       (1)
Cancellation                                PASS       (1)
Legacy: history one sheet per person        PASS       (1)
Legacy: planning matrix                     PASS       (1)
Legacy: rotation control                    PASS       (1)
LGPD minimization                           PASS       (2)
Path traversal blocked                      PASS       (3)
Local bridge                                PASS       (1)
Configuration persistence                   PASS       (2)
Chinese text preservation                   PASS       (3)
Accents (Windows-1252)                      PASS       (1)
Leading-zero matricula                      PASS       (2)
Manual creation                             PASS       (2)
Mass edit with preview                      PASS       (1)
Audit report (.xlsx)                        PASS       (1)
Large file (5,000 rows)                     PASS       (1)
E2E 20 steps                                PASS       (1)
UI end to end (browser, file://)            PASS       (1)
```

Testes executados (inclui subtestes): 93 · PASS 93 · FAILED 0 · SKIPPED 0

## Todos os testes

- ✓ aliases: turno, função e status viram o código oficial
- ✓ aliases: valor desconhecido fica UNKNOWN; similaridade só sugere, não aplica
- ✓ aliases do usuário têm prioridade e podem ser desativados
- ✓ nível de habilidade diferencia i (treinamento) de I (independente)
- ✓ modelos: grafias diferentes → código; desconhecido → UNKNOWN; admin pode adicionar
- ✓ estações: variações de escrita
- ✓ matrícula é sempre texto e preserva zeros à esquerda
- ✓ datas: ISO, dd/mm, serial do Excel, formato chinês e ambiguidade
- ✓ números: unidade, vírgula decimal; vazio é null e não 0
- ✓ texto: acentos e chinês preservados na comparação
- ✓ IDs estáveis e determinísticos
- ✓ Quality Score: reprodutível, com os pesos documentados e sem nota para base vazia
- ✓ duplicidade de operações: pontuação por componente e limites
- ✓ integridade referencial: referência inexistente é BLOCKING
- ✓ Matriz + Histórico: registrar atualiza a matriz e acrescenta evento; repetir não duplica
- ✓ conflitos 3 vias: campo mudado nos dois lados vira conflito; um lado só é mesclado
- ✓ comparação de versões e soft delete (nunca apaga)
- ✓ LGPD: CPF, telefone, endereço e nascimento são reconhecidos como não utilizados
- ✓ caminhos: bloqueia path traversal e limpa caracteres proibidos
- ✓ dicionário: 7 bases + manifesto, cada uma com arquivo e chave
- ✓ XLSX: abas, mescladas, fórmulas, cabeçalho em outra linha e hash
- ✓ XLSX: número com formato 000000 vira matrícula "000777"
- ✓ XLSM: lido como dados; a macro não é executada nem copiada
- ✓ CSV Windows-1252 com ponto e vírgula: acentos preservados
- ✓ CSV UTF-8 com BOM, aspas e quebra de linha dentro do campo
- ✓ .xls antigo e arquivo vazio são recusados com orientação
- ✓ não confia no nome: .csv que na verdade é xlsx é lido pelo conteúdo
- ✓ planilha não padronizada: schema, cabeçalho, mapeamento e colunas LGPD
- ✓ mapeamento com confiança: ≥95% automático, 80–94% revisar
- ✓ nunca inventa: desconhecido fica UNKNOWN/vazio e gera aviso
- ✓ de/para: corrigir com alias muda os dados e vale para a próxima importação
- ✓ legado: histórico com uma aba por colaborador (Modelo/Exemplo ignorados)
- ✓ legado: planejamento em matriz (pessoas nas colunas), inclusive variante sem coordenadas fixas
- ✓ legado: controle de revezamento — escala/revezamento não viram base
- ✓ operações: estação parseada, IDs estáveis, modelo desconhecido sem ID e par duplicado
- ✓ modos: ANALISE e SIMULACAO nunca alteram as bases
- ✓ cancelamento durante a análise
- ✓ arquivo grande (5.000 linhas) é processado em lotes
- ✓ as 7 bases são independentes: Matriz, Treinamentos e Presença importadas de CSV e ligadas ao Cadastro
- ✓ gera .xlsx oficial e verifica relendo (matrícula texto, datas, chinês, _META, DICIONARIO)
- ✓ leitor independente (openpyxl) abre o arquivo gerado
- ✓ instalação: cria os 8 arquivos e pastas, relê e verifica cada um
- ✓ regravar: faz backup antes, versão sobe, backups nunca sobrescritos, log em LOGS
- ✓ rollback: restaura versão antiga como nova versão, com backup do atual
- ✓ diagnóstico: base ausente, arquivo renomeado, alteração fora do Padronizador e planilha estranha
- ✓ segurança: não grava sobre outra instalação; histórico só de acréscimo; bloqueios exigem motivo
- ✓ storage confinado: NodeFsAdapter não sai da pasta
- ✓ configurações: aliases, perfis, modelos, valores e master_mode sobrevivem a gravar e reabrir
- ✓ perfis: criar, editar (versão), duplicar, excluir, exportar/importar e compatibilidade
- ✓ edição em massa com prévia e log; carga inicial da matriz gera histórico
- ✓ relatório da importação é um .xlsx com as abas de auditoria
- ✓ configuração ⇄ abas é reversível
- ✓ sem token → 401
- ✓ origem externa → 403
- ✓ path traversal é recusado
- ✓ ping e operações básicas
- ✓ instalação completa gravada pelo bridge e diagnosticada
- ✓ bridge: segurança e contrato do StorageAdapter
- ✓ 1. importar planilha não padronizada
- ✓ 2. detectar aba
- ✓ 3. detectar schema
- ✓ 4. mapear cabeçalhos
- ✓ 5. normalizar valores
- ✓ 6. encontrar campo desconhecido
- ✓ 7. solicitar decisão
- ✓ 8. salvar alias
- ✓ 9. detectar duplicidade
- ✓ 10. resolver
- ✓ 11. calcular Quality Score
- ✓ 12. validar referências
- ✓ 13. gerar XLSX
- ✓ 14. reabrir XLSX
- ✓ 15. validar conteúdo
- ✓ 16. gerar Manifesto
- ✓ 17. fechar
- ✓ 18. abrir novamente
- ✓ 19. reconhecer instalação
- ✓ 20. mostrar diagnóstico correto
- ✓ E2E: planilha não padronizada → bases oficiais → reabrir → diagnóstico
- ✓ interface original preservada (hero, 9 botões, bilíngue)
- ✓ armazenamento em memória
- ✓ seleciona XLSX real, detecta aba e cabeçalho
- ✓ mapeamento: mostra confiança, LGPD e permite corrigir
- ✓ normalização: decisão no de/para muda o dado
- ✓ validação: nota, pendências e confirmação
- ✓ geração: checklist só com etapas reais
- ✓ diagnóstico reconhece a instalação
- ✓ histórico: versões e restauração
- ✓ dicionário: alias criado na normalização aparece
- ✓ modo Líder esconde controles administrativos
- ✓ Nova Implantação sem planilha até gerar
- ✓ sem erros no console
- ✓ interface: fluxo completo no navegador
