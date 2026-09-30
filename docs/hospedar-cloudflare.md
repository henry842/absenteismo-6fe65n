# Hospedar no Cloudflare Pages com Cloudflare Access (login antes de abrir o site)

Resultado: o sistema fica em `https://<nome>.pages.dev` e **ninguém vê nem a tela de login** sem antes provar
que é um dos e-mails liberados (código PIN que chega no e-mail). Depois disso continua valendo o login
do próprio sistema (Supabase). São duas travas: a do Cloudflare (quem pode abrir o site) e a do sistema
(quem pode ver os dados).

Tudo é grátis: Cloudflare Pages grátis e Cloudflare Zero Trust grátis até 50 usuários.

---

## 1. Publicar no Cloudflare Pages (uns 5 minutos)

1. Entre em <https://dash.cloudflare.com> (crie a conta se não tiver).
2. **Workers & Pages → Create → Pages → Connect to Git**.
3. Autorize o GitHub e escolha o repositório **henry842/absenteismo-6fe65n**.
4. Preencha:
   | Campo | Valor |
   |---|---|
   | Project name | `absenteismo-c3` (vira o endereço `absenteismo-c3.pages.dev`; se estiver ocupado, escolha outro) |
   | Production branch | `main` |
   | Framework preset | None |
   | Build command | `bash scripts/montar-site.sh` |
   | Build output directory | `dist` |
5. **Save and Deploy**. Em 1 minuto o site está no ar.

O script publica **só** os arquivos do site (13 arquivos). Testes, vídeos, documentos, o Padronizador e o
código do banco não vão para o ar. O arquivo `_headers` faz o Cloudflare mandar os cabeçalhos de segurança
(o site não abre dentro de outro site, etc.). A cada merge no `main`, o Cloudflare publica sozinho.

## 2. Proteger com Cloudflare Access

1. No painel do Cloudflare, abra **Zero Trust** (menu da esquerda).
   Na primeira vez ele pede um nome de equipe (ex.: `absenteismo-c3`) e o plano: escolha **Free**
   (pode pedir um cartão, mas o plano Free é US$ 0).
2. **Access → Applications → Add an application → Self-hosted**.
3. Configure:
   - **Application name**: Absenteísmo
   - **Session duration**: `1 week` (quanto tempo vale o PIN antes de pedir de novo; use `24 hours` se preferir mais rigor)
   - **Application domain**: `absenteismo-c3.pages.dev`
   - Clique em **Add domain** e adicione também `*.absenteismo-c3.pages.dev`
     (**importante**: são os endereços de pré-visualização que o Pages cria a cada mudança; sem isso eles ficam abertos).
4. **Policies → Add a policy**:
   - Policy name: Pessoas autorizadas · Action: **Allow**
   - **Include** → escolha um dos dois:
     - **Emails**: digite cada e-mail permitido (até 50), ou
     - **Emails ending in**: `@suaempresa.com.br` (qualquer e-mail da empresa)
5. **Login methods**: deixe **One-time PIN** marcado.
6. Salve.

Teste numa janela anônima: abrir `https://absenteismo-c3.pages.dev` deve mostrar a tela do Cloudflare
pedindo o e-mail; o PIN chega no e-mail; depois aparece o sistema.
Com um e-mail que não está na lista, o Cloudflare **não** envia PIN e o site não abre.

## 3. Avisar o Supabase do endereço novo

Sem isso, os links de "esqueci a senha" continuam apontando para o endereço antigo.

1. <https://supabase.com/dashboard> → projeto **absenteismo** → **Authentication → URL Configuration**.
2. **Site URL**: `https://absenteismo-c3.pages.dev`
3. **Redirect URLs → Add URL**: `https://absenteismo-c3.pages.dev/**`

## 4. Mudar de endereço sem perder nada

Os dados ficam na conta (Supabase) e voltam sozinhos ao entrar no endereço novo. Só o que ainda **não subiu**
fica preso no endereço antigo. Então, em cada aparelho:

1. Abra o endereço antigo uma última vez e espere o selo ficar **"Sincronizado"** (nada "p/ enviar").
2. Abra o endereço novo, passe pelo PIN do Cloudflare e entre com a mesma conta.
3. No celular, remova o atalho antigo da tela inicial e adicione o novo ("Adicionar à tela de início").
4. Se usava o arquivo Excel automático, escolha o arquivo de novo em **Ajustes** (a permissão é por endereço).

## 5. Desligar o endereço antigo (GitHub Pages)

Enquanto o GitHub Pages estiver ligado, o endereço antigo continua abrindo **sem** o Cloudflare Access.
Depois de todos migrarem:

1. GitHub → repositório **absenteismo-6fe65n** → **Settings → Pages**.
2. Em **Build and deployment → Source**, escolha **None** (ou clique em **Unpublish site**).

## Observações

- **Link de nova senha**: se ao clicar no link do e-mail aparecer primeiro a tela do Cloudflare, passe pelo PIN e,
  se o sistema não abrir direto na troca de senha, peça o link de novo — com o Cloudflare já liberado ele funciona.
- **Página dos líderes / função admin-lideres**: se a página que cria logins de líder também for para o Cloudflare,
  me diga o endereço final para eu liberar esse endereço na função (hoje ela só aceita chamadas do `henry842.github.io`).
- **Domínio próprio** (ex.: `absenteismo.suaempresa.com.br`): Pages → Custom domains; depois adicione esse domínio
  também na aplicação do Access e no Supabase (passos 2 e 3).
