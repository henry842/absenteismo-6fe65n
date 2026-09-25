# Vídeo de apresentação do C3B com a voz do Henry (PT-BR e Mandarim) — Plano

> **Para quem for executar:** siga as tarefas na ordem. Cada tarefa termina com uma verificação. Não avance se a verificação falhar.

**Objetivo:** gerar dois vídeos (português e mandarim) que mostram as telas principais do C3B — Início, Registrar Habilidade e Revezamento — destacando cada área enquanto a narração, com a voz do próprio Henry, explica rapidamente a função e a importância de cada uma.

**Arquitetura:** o arquivo `C3B_Todas_as_Telas.html` é aberto no Chromium (Playwright) em 1920×1080. Um script percorre as telas (`#tela-1`, `#tela-2`, `#tela-5`), aplica um destaque (moldura + escurecimento do resto + zoom leve) em cada área e grava a tela. A narração é gerada por clonagem de voz a partir de uma amostra de áudio do Henry, uma frase por destaque. A duração de cada destaque vem da duração do áudio daquela frase, por isso o vídeo em mandarim tem o seu próprio tempo e não é uma dublagem forçada em cima do tempo do português. No fim, o ffmpeg junta vídeo, voz, trilha opcional e legendas.

**Ferramentas:** Playwright 1.56 + Chromium (já instalados), Python 3, `imageio-ffmpeg` (ffmpeg completo via PyPI), clonagem de voz com **XTTS-v2** (fala português e chinês com a mesma voz a partir de ~1 min de amostra) **ou** ElevenLabs (alternativa paga, ver "Bloqueios").

---

## Bloqueios (resolver antes de começar)

1. **Amostra da voz — obrigatória.** Só recebi o arquivo HTML. Não recebi nenhum áudio, e eu não escuto a mensagem de voz que você gravou (chega para mim só o texto transcrito). Preciso de um arquivo de áudio seu:
   - 1 a 3 minutos falando naturalmente em português, no mesmo tom que você quer no vídeo;
   - ambiente silencioso, sem música, só a sua voz;
   - `.wav`, `.mp3` ou `.m4a` (uma mensagem de voz do WhatsApp exportada serve).
   - Não precisa gravar nada em chinês: o modelo usa o timbre do português para falar mandarim.
2. **Acesso à rede para o modelo de voz.** Este ambiente bloqueia `huggingface.co`, de onde vêm os pesos do XTTS-v2. Libere em: menu do ambiente na barra de título da sessão → **Edit** → **Network access** → adicionar `huggingface.co` e `cdn-lfs.huggingface.co` aos domínios permitidos (ou escolher um nível de acesso mais amplo). O PyPI já funciona.
3. **Licença (decidir):** o XTTS-v2 usa a Coqui Public Model License, que é **não comercial**. Para um vídeo interno de demonstração isso costuma bastar. Se o vídeo for usado comercialmente ou publicado pela empresa, use o **ElevenLabs** (Voice Cloning + modelo multilíngue, fala PT e ZH). Nesse caso preciso de uma chave de API da sua conta, cadastrada como segredo do ambiente, e o domínio `api.elevenlabs.io` liberado.

---

## Roteiro (fonte única para as duas línguas)

Os IDs abaixo (`0`, `1a`, …) ligam cada frase ao destaque correspondente. Ritmo rápido: cada frase dura de 4 a 9 s. Total estimado: **~2 min 30 s** em PT e **~2 min 10 s** em ZH.

### Cena 0 — Abertura (tela 1, visão geral, zoom lento)

| ID | Destaque | PT-BR | 中文 |
|---|---|---|---|
| 0 | Tela inteira + logo C3B | Este é o C3B, a Central de Habilidades da BYD Camaçari. Em poucos minutos, vou mostrar as principais funções do sistema e por que ele facilita o dia a dia da produção. | 这是C3B——比亚迪卡马萨里的技能管理中心。接下来几分钟，我将为大家介绍系统的主要功能，以及它如何让生产现场的日常工作更轻松。 |

### Cena 1 — Início / Central de Comando (`#tela-1`)

| ID | Destaque | PT-BR | 中文 |
|---|---|---|---|
| 1a | Filtros: Modelo, Estação, Turno, Data | Na tela de Início, a Central de Comando, você escolhe o modelo, a estação, o turno e a data, e já tem a visão geral da operação. | 在"首页"，也就是指挥中心，您可以选择车型、工位、班次和日期，快速掌握整体运营情况。 |
| 1b | Os 6 indicadores do topo | No topo ficam os números principais: pessoas presentes, postos cobertos, postos descobertos, treinamentos em andamento, faltas do dia e pessoas emprestadas. | 页面顶部显示关键数据：出勤人数、已覆盖岗位、空缺岗位、进行中的培训、今日缺勤以及借调人员。 |
| 1c | Card "Cobertura por Modelo" | Em Cobertura por Modelo, você vê o percentual de postos cobertos em cada modelo. | "车型覆盖率"显示每个车型的岗位覆盖百分比。 |
| 1d | Card "Nível de Qualificação" | O Nível de Qualificação mostra quantas pessoas estão proficientes, em treinamento, no nível inicial ou sem qualificação. | "资质等级"显示有多少人达到熟练、正在培训、处于初级或尚无资质。 |
| 1e | Card "Postos Críticos" | Os Postos Críticos mostram onde existe risco, como uma inspeção com apenas um operador L. | "关键岗位"提示风险所在，例如某项检测工序只有一名熟练操作员。 |
| 1f | "Alertas e Pendências" → "Próximos Treinamentos" → "Movimentação de Pessoas" (o destaque passa pelos três) | Mais abaixo, os alertas e pendências, os próximos treinamentos e a movimentação de pessoas: quem está disponível, em treinamento, alocado ou emprestado. | 下方还有预警与待办事项、即将开始的培训，以及人员动态——谁可用、谁在培训、谁已分配、谁被借调。 |
| 1g | Os 3 botões: Gerar Revezamento, Resolver Postos Descobertos, Registrar Habilidade | E, com um clique, você gera o revezamento, resolve os postos descobertos ou registra uma nova habilidade. | 只需一键，就可以生成轮岗安排、处理空缺岗位，或登记新的技能。 |

### Cena 2 — Registrar Habilidade (`#tela-2`)

| ID | Destaque | PT-BR | 中文 |
|---|---|---|---|
| 2a | Barra de etapas 1-2-3 | Em Registrar Habilidade, o processo segue três etapas: seleção, confirmação e gravação. | 在"登记技能"中，流程分为三步：选择、确认、保存。 |
| 2b | Card "Dados da Habilidade" + botão "Ver na Matriz" | Primeiro, os dados da habilidade: você escolhe a linha, a estação e a pessoa. O sistema já preenche a operação automaticamente de acordo com o posto, e você pode conferir tudo direto na matriz. | 首先填写技能信息：选择产线、工位和人员。系统会根据岗位自动带出对应的工序，您也可以直接在矩阵中查看。 |
| 2c | Card "Definições" | Nas Definições, você informa o nível de proficiência, a titularidade (se a pessoa é titular, se vai ser titular ou se está em treinamento), a certificação e a data da habilidade. | 在"定义"部分，填写熟练等级、在岗身份——是正式在岗、即将在岗，还是正在培训——以及认证状态和技能日期。 |
| 2d | Card "Registro no Histórico" | Tudo isso é gravado na matriz oficial da empresa e também no histórico de habilidades. Assim a matriz e o histórico ficam sempre atualizados, sem ninguém precisar ir e voltar para conferir. | 所有信息都会写入公司官方的技能矩阵，同时记录到技能历史中。这样矩阵和历史始终保持最新，不需要来回核对。 |
| 2e | Card "Prévia na Matriz" | Ao lado, a Prévia na Matriz mostra como o registro vai aparecer, pessoa por pessoa, operação por operação. | 旁边的"矩阵预览"会按人员、按工序显示这条记录在矩阵中的样子。 |
| 2f | Card "Marcações recentes" | Em Marcações Recentes, você acompanha os últimos registros, com o nível, a data e a hora. | 在"最近记录"中，可以查看最新登记的技能，包括等级、日期和时间。 |
| 2g | Card "Conferir e salvar" + botão Salvar | No final, é só conferir o resumo e salvar. | 最后，核对摘要，点击保存即可。 |

### Cena 3 — Revezamento de Operações (`#tela-5`)

| ID | Destaque | PT-BR | 中文 |
|---|---|---|---|
| 3a | Barra de filtros + "Gerar automaticamente" | No Revezamento de Operações, você escolhe a data, o turno, o modelo e a equipe, e o sistema pode gerar a alocação automaticamente. | 在"工序轮岗"中，选择日期、班次、车型和班组，系统可以自动生成人员分配。 |
| 3b | 4 indicadores + "Lógica de substituição" | O painel mostra os operadores alocados, as estações cobertas, as estações em atenção e os postos críticos. | 看板显示已分配操作员、已覆盖工位、需关注工位和关键岗位。 |
| 3c | Coluna "Disponíveis" | À esquerda, os operadores disponíveis, aptos para o turno, com as estações que cada um domina. | 左侧是本班次可用、具备资质的操作员，以及每个人掌握的工位。 |
| 3d | Coluna "Alocados" | No centro, os operadores alocados em cada estação e operação, com o nível de cada um. Para alocar, é só arrastar. | 中间是各工位、各工序已分配的操作员及其等级，只需拖动即可完成分配。 |
| 3e | Coluna "Problemas", zoom no card "C16R-06 · Verificação final" e nos botões "Alocar" | À direita, os problemas. Por exemplo: C16R-06, Verificação final. Motivo: sem operador alocado. Ou seja, o sistema avisa na hora quando uma estação ou operação fica sem operador, e já sugere substitutos aptos para alocar com um clique. | 右侧是问题列表。例如：C16R-06，最终检查——原因：未分配操作员。也就是说，一旦某个工位或工序缺人，系统会立即提示，并推荐合格的替补人员，一键即可分配。 |
| 3f | Botões "Salvar" e "Publicar" | Depois, é só salvar e publicar o revezamento. | 最后，保存并发布轮岗安排。 |

### Cena 4 — Fechamento (tela 1, afastando o zoom + logo)

| ID | Destaque | PT-BR | 中文 |
|---|---|---|---|
| 4 | Tela inteira, logo C3B e BYD | Com o C3B, a fábrica tem uma visão única de pessoas, habilidades e postos: menos tempo conferindo planilhas, menos posto descoberto e decisões mais rápidas e seguras. | 有了C3B，工厂可以在一个平台上统一管理人员、技能和岗位：减少核对表格的时间，减少空缺岗位，让决策更快、更可靠。 |

**Pronúncia:** códigos como `C16R-06`, `L`, `SA6H` ficam como estão nas duas línguas. No mandarim, se o modelo ler "C16R" de forma estranha, trocar só no texto falado (não na legenda) por "C十六R"; o mesmo vale para "BYD" → "比亚迪".

---

## Estrutura de arquivos (pasta de trabalho, fora do app)

```
video-c3b/
  entrada/C3B_Todas_as_Telas.html
  entrada/voz_henry.wav              # amostra enviada pelo Henry
  roteiro.json                       # tabela acima: id, tela, alvo, pt, zh
  1_voz.py                           # clonagem → audio/<lang>/<id>.wav + duracoes.json
  2_gravar.js                        # Playwright: destaques cronometrados → tela_<lang>.webm
  3_montar.py                        # ffmpeg: vídeo + narração + legendas → final
  saida/C3B_apresentacao_PT.mp4
  saida/C3B_apresentacao_ZH.mp4
  saida/*.srt
```

---

## Tarefa 1: Preparar o ambiente

- [ ] `pip install imageio-ffmpeg coqui-tts` (ou `elevenlabs`, se esta for a opção escolhida)
- [ ] Baixar os pesos do XTTS-v2 (só funciona depois de liberar o `huggingface.co`)
- [ ] Converter a amostra: `ffmpeg -i voz_henry.* -ac 1 -ar 24000 voz_henry.wav`; cortar silêncios e ruídos; deixar de 30 a 90 s de fala limpa.

**Verificação:** `python -c "from TTS.api import TTS; TTS('tts_models/multilingual/multi-dataset/xtts_v2')"` carrega sem erro, e `ffmpeg -version` responde.

## Tarefa 2: Teste de voz (antes de gerar tudo)

- [ ] Gerar só as frases `0` e `3e` em PT e em ZH com a voz clonada.
- [ ] **Enviar esses 4 áudios curtos para o Henry aprovar** a semelhança da voz, o ritmo e a pronúncia do chinês.
- [ ] Ajustar se precisar: trocar o trecho de referência, `temperature` (0,6 a 0,75), `speed` (1,05 a 1,15 para ficar "rápido") e a grafia fonética de códigos.

**Verificação:** Henry aprova as amostras. Sem aprovação, não seguir.

## Tarefa 3: Gerar toda a narração

- [ ] `1_voz.py` lê `roteiro.json` e gera `audio/pt/<id>.wav` e `audio/zh/<id>.wav` (língua `pt` e `zh-cn` no XTTS), usando a mesma amostra de referência nas duas línguas.
- [ ] Normalizar o volume (`loudnorm` em -16 LUFS), cortar os silêncios das pontas e adicionar 0,35 s de pausa no fim de cada frase.
- [ ] Salvar `duracoes.json` = `{lang: {id: segundos}}`.

**Verificação:** 21 arquivos por língua; nenhum com mais de 12 s; ouvir `2c` e `3e` inteiros (as frases mais longas) para conferir cortes e alucinações do modelo.

## Tarefa 4: Gravar a tela com os destaques

- [ ] `2_gravar.js`: Playwright com `recordVideo` em 1920×1080 e `deviceScaleFactor: 1`; abre `file://…/C3B_Todas_as_Telas.html#tela-N`.
- [ ] Injetar CSS/JS de destaque:
  - alvo encontrado pelo texto do título (`.card` que contém "Cobertura por Modelo", o bloco `.kpi` de cada indicador etc.);
  - moldura verde `#1ccc61` de 3 px com cantos arredondados, escurecimento de 55% fora do alvo (máscara com recorte) e transição de 400 ms;
  - zoom leve (`transform: scale(1.0 → 1.08)` centrado no alvo) só em `1b`, `2b`, `2c` e `3e`;
  - um cursor falso que "clica" em "Ver na Matriz" (`2b`), "Gerar automaticamente" (`3a`) e "Alocar" (`3e`), sem sair da tela;
  - rolagem suave em `#tela-5` para mostrar a coluna Problemas inteira em `3e`.
- [ ] Tempo de cada destaque = `duracoes.json[lang][id]` (gravar uma vez por língua). Transição entre telas: *fade* de 0,5 s.
- [ ] Na abertura e no fechamento, cartela com o logo C3B e o título "Central de Habilidades · BYD Camaçari" (em ZH: "技能管理中心 · 比亚迪卡马萨里").

**Verificação:** extrair 1 quadro por destaque (`ffmpeg -ss … -frames:v 1`) e conferir se a moldura está na área certa em todos os 21.

## Tarefa 5: Montar o vídeo final

- [ ] `3_montar.py`: concatenar os áudios na ordem, com os mesmos tempos da gravação; opcional: trilha instrumental baixa (-26 dB, com *ducking* sob a voz). Só usar trilha livre de direitos, que você envie ou autorize.
- [ ] Gerar `.srt` a partir do roteiro e dos tempos. PT com legenda em português. ZH com legenda em chinês simplificado (fonte Noto Sans CJK, instalada via pacote `fonts-noto-cjk` ou baixada do PyPI).
- [ ] Exportar H.264 1080p, 30 fps, AAC 192 kbps: `C3B_apresentacao_PT.mp4` e `C3B_apresentacao_ZH.mp4`, com os `.srt` separados também.

**Verificação:** `ffprobe` mostra 1920×1080, as durações de vídeo e áudio batem (±0,1 s) e a sincronia confere nos pontos `1b`, `2d` e `3e`.

## Tarefa 6: Entrega

- [ ] Enviar os dois MP4 e os dois SRT para o Henry pelo chat.
- [ ] Não publicar em nenhum lugar externo sem pedido explícito, porque o vídeo contém a voz clonada do Henry.
- [ ] Guardar `roteiro.json` e os scripts para refazer o vídeo quando as telas mudarem.

---

## O que eu preciso de você para executar

1. **O arquivo de áudio com a sua voz** (1 a 3 min, ver "Bloqueios").
2. **Liberar `huggingface.co`** na rede do ambiente, **ou** escolher o ElevenLabs e cadastrar a chave de API.
3. (Opcional) Aprovar ou ajustar o roteiro acima, e dizer se quer música de fundo e legenda gravada no vídeo.
