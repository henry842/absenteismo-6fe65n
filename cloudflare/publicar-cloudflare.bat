@echo off
rem Publica o sistema na Cloudflare Pages: roda os testes, monta a pasta dist e envia.
rem Antes da primeira vez, faça o login uma vez:  npx wrangler login
cd /d "%~dp0.."
call node --test testes/*.test.js
if errorlevel 1 (
  echo.
  echo Os testes falharam. Nada foi publicado.
  exit /b 1
)
call node cloudflare/montar.js
if errorlevel 1 exit /b 1
rem A versão do Wrangler fica fixa de propósito: uma versão nova não muda o que é publicado sem você saber.
call npx --yes wrangler@4.144.0 pages deploy dist --project-name absenteismo-times --branch main --commit-dirty=true
