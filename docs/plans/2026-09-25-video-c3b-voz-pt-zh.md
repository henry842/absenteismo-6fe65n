# Vídeo de apresentação do C3B com a voz do Henry (PT-BR e Mandarim) — Plano

> **Para quem for executar:** siga as tarefas na ordem. Cada tarefa termina com uma verificação. Não avance se a verificação falhar.

**Objetivo:** gerar dois vídeos (português e mandarim) que mostram as telas principais do C3B — Início, Registrar Habilidade e Revezamento — destacando cada área enquanto a narração, com a voz do próprio Henry, explica rapidamente a função e a importância de cada uma.

**Arquitetura:** o arquivo `C3B_Todas_as_Telas.html` é aberto no Chromium (Playwright) em 1920×1080. Um script percorre as telas (`#tela-1`, `#tela-2`, `#tela-5`), aplica um destaque (moldura + escurecimento do resto + zoom leve) em cada área e grava a tela. A narração é gerada por clonagem de voz a partir de uma amostra de áudio do Henry, uma frase por destaque. A duração de cada destaque vem da duração do áudio daquela frase, por isso o vídeo em mandarim tem o seu próprio tempo e não é uma dublagem forçada em cima do tempo do português. No fim, o ffmpeg junta vídeo, voz, trilha opcional e legendas.

**Ferramentas:** Playwright 1.56 + Chromium (já instalados), Python 3, `imageio-ffmpeg` (ffmpeg completo via PyPI), clonagem de voz com **XTTS-v2** (fala português e chinês com a mesma voz a partir de ~1 min de amostra) **ou** ElevenLabs (alternativa paga, ver "Bloqueios").

---

## Situação em 25/09/2026

- **Pronto:** roteiro nas duas línguas (`video/roteiro.json`), gravador das telas com destaques, cursor e legenda (`video/gravar.js`) e montagem com narração e `.srt` (`video/montar.py`). Os rascunhos **sem voz** já foram gerados (PT com 3 min 27 s e ZH com 3 min 12 s, com tempos estimados pelo tamanho do texto) e todos os 22 destaques foram conferidos quadro a quadro.
- **Recebido:** amostra de voz do Henry (mensagem do WhatsApp com 14 s). Dá para clonar, porque o XTTS-v2 aceita a partir de ~6 s, mas 1 a 3 min deixam a voz bem mais parecida.
- **Falta:** gerar a narração com a voz clonada (Tarefas 1 a 3). Isso está bloqueado pelos itens 2 e 3 abaixo. Depois de gerar a voz, basta rodar de novo `gravar.js` (que passa a usar os tempos reais dos áudios) e `montar.py`.

## Bloqueios

1. ~~**Amostra da voz.**~~ Recebida (14 s). Opcional: mandar 1 a 3 min de fala contínua, em lugar silencioso, para melhorar a semelhança. Não precisa gravar nada em chinês.
2. **Acesso à rede para o modelo de voz.** Este ambiente bloqueia `huggingface.co`, de onde vêm os pesos do XTTS-v2, e também `api.elevenlabs.io`. Libere em: menu do ambiente na barra de título da sessão → **Edit** → **Network access** → adicionar `huggingface.co` e `cdn-lfs.huggingface.co` (ou `api.elevenlabs.io`) aos domínios permitidos, ou escolher um nível de acesso mais amplo. O PyPI já funciona.
3. **Autorização para baixar e rodar o modelo de voz.** As permissões automáticas da sessão bloquearam o download de modelos de código aberto de terceiros (tentativa com Kokoro + kNN-VC pelo GitHub). O Henry precisa autorizar isso explicitamente no chat, ou adicionar uma regra de permissão nas configurações.
4. **Licença (decidir):** o XTTS-v2 usa a Coqui Public Model License, que é **não comercial**. Um vídeo feito para a empresa pode contar como uso comercial. Na dúvida, use o **ElevenLabs** (Voice Cloning + modelo multilíngue, fala PT e ZH), cuja licença paga cobre esse uso.
5. **Caminho sem mudar nada no ambiente:** o próprio Henry clona a voz no site do ElevenLabs (Instant Voice Clone com a amostra), gera as falas do roteiro em PT e em ZH e envia os áudios aqui. Pode ser um arquivo por fala (`0.mp3`, `1a.mp3`, …) ou um arquivo por língua com uma pausa de ~1 s entre as falas, que é cortado pelos silêncios.

---

## Roteiro (fonte única para as duas línguas)

Os IDs abaixo (`0`, `1a`, …) ligam cada frase ao destaque correspondente (22 frases). Ritmo rápido: cada frase dura de 4 a 12 s. Total estimado: **~3 min 20 s** em PT e **~3 min 10 s** em ZH; com a voz gerada em velocidade 1,1, fica perto de 3 min.

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

## Estrutura de arquivos (`video/` no repositório)

Só os scripts e o roteiro vão para o Git. As entradas e tudo o que é gerado ficam fora, pelo `.gitignore`: o HTML tem 8 MB, a voz é dado pessoal e os vídeos são grandes.

```
video/
  roteiro.json                       # tabela acima: id, tela, alvo (seletores), zoom, clique, pt, zh
  gravar.js                          # node gravar.js <pt|zh> → frames_<lang>/ + tempos_<lang>.json
  montar.py                          # python3 montar.py <pt|zh> → saida/C3B_apresentacao_<LANG>.mp4 + .srt
  voz.py                             # (a fazer, Tarefa 3) clonagem → audio/<lang>/<id>.wav + duracoes.json
  entrada/C3B_Todas_as_Telas.html    # não versionado (ou variável C3B_HTML)
  entrada/voz_henry.wav              # não versionado: amostra do Henry
  audio/<lang>/<id>.wav              # não versionado
  audio/<lang>/duracoes.json         # {id: segundos}; se existir, gravar.js usa estes tempos
  saida/                             # não versionado
```

**Como rodar** (a partir de `video/`):

```bash
node gravar.js pt        # grava as telas (tempos reais se audio/pt/duracoes.json existir)
(cd frames_pt && ffmpeg -f concat -safe 0 -i lista.txt -vf "fps=30,format=yuv420p" \
   -c:v libx264 -crf 18 -movflags +faststart ../rascunho_pt_sem_audio.mp4)
python3 montar.py pt     # junta a narração (se houver) e gera o .srt
```

---

## Tarefa 1: Preparar o ambiente

- [x] `pip install imageio-ffmpeg pillow` (ffmpeg completo com libx264; o ffmpeg que vem com o Playwright não abre `.ogg` nem codifica H.264)
- [x] Converter a amostra: `ffmpeg -i WhatsApp_Ptt_….ogg -ac 1 -ar 24000 voz_henry.wav` (14,4 s; volume médio de -18 dB e sem silêncios longos, então não precisa de corte)
- [ ] `pip install coqui-tts` e baixar os pesos do XTTS-v2 (depende dos bloqueios 2 e 3), **ou** `pip install elevenlabs` com a chave de API

**Verificação:** `python -c "from TTS.api import TTS; TTS('tts_models/multilingual/multi-dataset/xtts_v2')"` carrega sem erro.

## Tarefa 2: Teste de voz (antes de gerar tudo)

- [ ] Gerar só as frases `0` e `3e` em PT e em ZH com a voz clonada.
- [ ] **Enviar esses 4 áudios curtos para o Henry aprovar** a semelhança da voz, o ritmo e a pronúncia do chinês.
- [ ] Ajustar se precisar: trocar o trecho de referência, `temperature` (0,6 a 0,75), `speed` (1,05 a 1,15 para ficar "rápido") e a grafia fonética de códigos.

**Verificação:** Henry aprova as amostras. Sem aprovação, não seguir.

## Tarefa 3: Gerar toda a narração

- [ ] `voz.py` lê `roteiro.json` e gera `audio/pt/<id>.wav` e `audio/zh/<id>.wav` (língua `pt` e `zh-cn` no XTTS), usando a mesma amostra de referência nas duas línguas.
- [ ] Normalizar o volume (`loudnorm` em -16 LUFS), cortar os silêncios das pontas e adicionar 0,35 s de pausa no fim de cada frase.
- [ ] Salvar `audio/<lang>/duracoes.json` = `{id: segundos}` (já com a pausa).
- [ ] Se os áudios vierem do ElevenLabs em um arquivo por língua: cortar pelos 21 maiores silêncios (`silencedetect`) e conferir se saíram 22 pedaços na ordem do roteiro.

**Verificação:** 22 arquivos por língua; nenhum com mais de 15 s; ouvir `2c` e `3e` inteiros (as frases mais longas) para conferir cortes e alucinações do modelo.

## Tarefa 4: Gravar a tela com os destaques

- [x] `gravar.js`: Chromium (Playwright) em 1920×1080, gravado pelo *screencast* do DevTools em JPEG 92 (fica mais nítido que o `recordVideo`, que usa VP8 com bitrate baixo); abre `file://…/C3B_Todas_as_Telas.html#tela-N`.
- [x] Destaque: alvo achado pelo seletor + texto do título (`section.card` que contém "Cobertura por Modelo", `article.kpi` etc.); moldura verde `#1ccc61` com escurecimento de 55% fora do alvo e transição de 0,55 s.
- [x] Zoom leve só em `2b`, `2c` (1,05) e `3e` (1,08). Em `1b` foi tirado porque a faixa de indicadores saía da tela.
- [x] Cursor falso que "clica" em "Ver na Matriz" (`2b`), "Salvar" (`2g`), "Gerar automaticamente" (`3a`) e "Alocar" (`3e`).
- [x] `1f` passa o destaque pelos três cards, um de cada vez.
- [x] Legenda gravada na própria tela, que sobe para o topo quando o destaque está embaixo. Em ZH usa a fonte WenQuanYi Zen Hei, já instalada.
- [x] Cartela com logo C3B + "Central de Habilidades · BYD Camaçari" / "技能管理中心 · 比亚迪卡马萨里" na abertura e no fechamento; *fade* verde entre as telas.
- [x] Tempo de cada destaque = `audio/<lang>/duracoes.json`; sem esse arquivo, estimado pelo texto (PT 2,6 palavras/s, ZH 4,3 caracteres/s).
- [x] Grava `tempos_<lang>.json` com o início real de cada fala, que o `montar.py` usa para posicionar a voz.

**Verificação:** feita. Um quadro por destaque nas duas línguas, e a moldura está na área certa em todos os 22.

## Tarefa 5: Montar o vídeo final

- [x] `montar.py`: posiciona cada áudio no início real da sua fala (`adelay`), mixa, normaliza em -16 LUFS e junta ao vídeo (H.264 1080p 30 fps + AAC 192 kbps).
- [x] Gera `.srt` a partir do roteiro e dos tempos.
- [ ] Opcional: trilha instrumental baixa (-26 dB, com *ducking* sob a voz). Só com trilha livre de direitos que o Henry envie ou autorize.
- [ ] Rodar de novo `gravar.js` + `montar.py` depois da Tarefa 3, com os tempos reais.

**Verificação:** `ffprobe` mostra 1920×1080, as durações de vídeo e áudio batem (±0,1 s) e a sincronia confere nos pontos `1b`, `2d` e `3e`.

## Tarefa 6: Entrega

- [x] Rascunhos sem voz (`C3B_apresentacao_PT.mp4` / `_ZH.mp4` + `.srt`) enviados ao Henry pelo chat para aprovar o visual.
- [ ] Enviar a versão final com voz.
- [ ] Não publicar em nenhum lugar externo sem pedido explícito, porque o vídeo contém a voz clonada do Henry.

---

## O que eu preciso de você para terminar

1. **Escolher o caminho da voz:**
   - **(a) XTTS-v2 aqui na sessão:** liberar `huggingface.co` e `cdn-lfs.huggingface.co` na rede do ambiente **e** autorizar no chat o download e a execução do modelo de voz. Uso não comercial.
   - **(b) ElevenLabs aqui na sessão:** liberar `api.elevenlabs.io`, cadastrar a chave de API como segredo do ambiente e autorizar o uso.
   - **(c) ElevenLabs por sua conta:** você gera os áudios no site com as falas do roteiro e me envia. Não precisa mudar nada no ambiente.
2. (Opcional) Uma amostra de voz maior (1 a 3 min) para a clonagem ficar mais parecida.
3. (Opcional) Ajustes no roteiro ou no visual dos rascunhos, e se quer música de fundo.
