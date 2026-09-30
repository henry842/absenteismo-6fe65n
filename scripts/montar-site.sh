#!/usr/bin/env bash
# Monta a pasta dist/ que o Cloudflare Pages publica: só os arquivos do site de absenteísmo.
# Testes, vídeos, documentos, o Padronizador e o código do banco NÃO vão para o ar.
# Cloudflare Pages: comando de build "bash scripts/montar-site.sh", pasta de saída "dist".
set -euo pipefail
cd "$(dirname "$0")/.."
ARQUIVOS=(index.html app.js leitor.js excel.js sincronia.js config.js sw.js manifest.webmanifest
          icone-192.png icone-512.png icone-maskable-512.png apple-touch-icon.png)
rm -rf dist && mkdir dist
for a in "${ARQUIVOS[@]}"; do
  [ -f "$a" ] || { echo "Falta o arquivo $a" >&2; exit 1; }
  cp "$a" dist/
done
cp cloudflare/_headers dist/_headers
# Confere se todo arquivo local que a página e o service worker pedem está na pasta
for ref in $(grep -oE '(src|href)="[^":]+"' index.html | sed -E 's/.*="([^"]+)"/\1/'; grep -oE "'\./[^']+'" sw.js | tr -d "'" | sed 's#^\./##' | grep -v '^$'); do
  [ -f "dist/$ref" ] || { echo "index.html ou sw.js pede $ref, que não está em dist/" >&2; exit 1; }
done
echo "dist/ pronto: $(ls dist | wc -l) arquivos"
