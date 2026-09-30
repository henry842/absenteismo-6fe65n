# Sistema na Cloudflare, com acesso só para quem você liberar

## Publicar uma atualização
Dê dois cliques em `cloudflare/publicar-cloudflare.bat`. Ele roda os testes, monta a pasta `dist/` (só os arquivos do site) e envia para a Cloudflare Pages.
Se os testes falharem, nada é publicado.

Primeira vez no computador: `npx wrangler login` (abre o navegador; entre na sua conta da Cloudflare e clique em Permitir).

## Cloudflare Access: NÃO usado neste sistema
Decisão de 30/09/2026: os líderes entram com usuário e senha gerados pelo supervisor, sem e-mail. O Access exige e-mail com código para cada pessoa, então **não crie uma aplicação do Access cobrindo o site**, senão os líderes ficam trancados do lado de fora. A proteção real está no login do Supabase (regras por time). Os passos abaixo só servem se um dia cada líder tiver um e-mail próprio.

### (Opcional) Proteger com o Cloudflare Access
1. Entre em https://one.dash.cloudflare.com e abra **Zero Trust**. Na primeira vez ele pede um nome de equipe e o plano **Free** (até 50 usuários, sem custo; a Cloudflare pode pedir um cartão só para cadastro).
2. **Access > Applications > Add an application > Self-hosted**.
3. Nome: `Absenteísmo dos times`. Em **Session Duration** escolha 1 mês (o líder digita o PIN uma vez por mês por aparelho).
4. Destinos (Add public hostname), com o caminho em branco, **os dois**:
   - `absenteismo-times.pages.dev` (o endereço do sistema)
   - `*.absenteismo-times.pages.dev` (cada publicação também cria um endereço temporário, como `5626a2a5.absenteismo-times.pages.dev`; sem este, ele ficaria aberto)
5. Política: **Allow**, regra **Emails**, e digite um e-mail por linha: os dois supervisores e o e-mail de cada líder. Método de login: **One-time PIN**.
6. Salve. Abra o site numa janela anônima: deve pedir o e-mail e mandar um código de 6 dígitos.

## Depois de publicar, no Supabase (Authentication > URL Configuration)
- **Site URL** e **Redirect URLs**: acrescente o endereço novo do site. Sem isso, o e-mail de "esqueci a senha" do supervisor volta para o endereço antigo.

## Site antigo do GitHub
O endereço antigo (`henry842.github.io/...`) continua no ar e recebe as mesmas atualizações quando você envia ao GitHub. Se preferir ficar com um endereço só, desligue-o em Settings > Pages > **Unpublish site**.

## Endereço atual
https://absenteismo-times.pages.dev (projeto `absenteismo-times` na sua conta da Cloudflare). A função `admin-lideres` do Supabase já aceita esse endereço.
