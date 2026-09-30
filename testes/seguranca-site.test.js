// Guarda-costas da segurança do site: se alguém (ou eu) fizer uma mudança descuidada, estes testes falham.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..');
const ler = f => fs.readFileSync(path.join(RAIZ, f), 'utf8');
const html = ler('index.html');
const FONTES = ['app.js', 'painel.js', 'acesso.js', 'lideres.js', 'leitor.js', 'excel.js', 'sincronia.js', 'sw.js', 'config.js'];

test('a política de segurança do navegador (CSP) é restrita', () => {
  const csp = (html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/) || [])[1];
  assert.ok(csp, 'CSP ausente');
  const regra = nome => (csp.split(';').map(s => s.trim()).find(s => s.startsWith(nome + ' ')) || '');
  assert.match(regra('default-src'), /^default-src 'self'$/);
  assert.match(regra('object-src'), /'none'/);
  assert.match(regra('base-uri'), /'self'/);
  assert.match(regra('form-action'), /'self'/);
  assert.doesNotMatch(regra('script-src'), /unsafe-inline|unsafe-eval|\*/);      // nenhum script inline ou eval
  assert.match(regra('script-src'), /^script-src 'self' https:\/\/cdn\.jsdelivr\.net$/);
  assert.doesNotMatch(regra('connect-src'), /\*(?!\.supabase)/);
  assert.match(regra('connect-src'), /ztmwsvfqlozilwnqkrom\.supabase\.co/);       // só o banco deste projeto
});

test('não há script inline nem manipulador de evento no HTML; o script de fora tem integridade', () => {
  const scripts = html.match(/<script\b[^>]*>/g) || [];
  assert.ok(scripts.length >= 6);
  for (const s of scripts) assert.match(s, /\bsrc="/, 'script inline: ' + s);
  const externo = scripts.find(s => /src="https:/.test(s));
  assert.match(externo, /integrity="sha384-[A-Za-z0-9+/=]+"/);
  assert.match(externo, /crossorigin="anonymous"/);
  assert.doesNotMatch(html.replace(/<style[\s\S]*?<\/style>/g, ''), /\son(click|load|error|change|input|submit|mouseover|focus)\s*=/i);
  assert.match(html, /<meta name="referrer" content="no-referrer">/);
  assert.match(html, /<meta name="robots" content="noindex, nofollow">/);
});

test('nada de eval, Function, document.write nem chaves secretas no código', () => {
  for (const f of FONTES) {
    const c = ler(f).replace(/\/\/.*$/gm, '');
    assert.doesNotMatch(c, /\beval\s*\(/, f);
    assert.doesNotMatch(c, /new Function\s*\(/, f);
    assert.doesNotMatch(c, /document\.write\s*\(/, f);
    assert.doesNotMatch(c, /service_role|sb_secret|SERVICE_ROLE/i, f);
    assert.doesNotMatch(c, /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\./, f);   // nenhum JWT colado no código
  }
  // a única chave no código é a pública do Supabase (a segurança está nas regras do banco)
  assert.match(ler('config.js'), /sb_publishable_/);
});

test('todo window.open sai isolado (noopener) do sistema', () => {
  let total = 0;
  for (const f of ['app.js', 'painel.js']) {
    const usos = ler(f).split(/\r?\n/).filter(l => /window\.open\(/.test(l));
    total += usos.length;
    for (const u of usos) assert.match(u, /noopener,noreferrer/, u.trim());
  }
  assert.ok(total > 0);
});

test('dado de usuário só vai para a tela por esc() ou textContent (varredura de app.js e painel.js)', () => {
  // Campos que vêm de pessoas: nomes, matrículas, justificativas, motivos escritos, nomes de arquivo, mensagens de erro.
  const CAMPOS = /\b(nome|justificativa|matricula|cargo|motivoOriginal|usuario|arquivo|email|erro)\b/;
  // Usos revisados, que não montam HTML: textos de confirm()/aviso(), textContent, title, contas e nomes fixos do sistema.
  const REVISADOS = [
    /confirm\(/, /\baviso\(/, /ctx\.aviso\(/, /\.textContent/, /\.dataset\./, /partes\.push/, /Salvo em|salvar em|Excel/,
    /tem problema na conta/, /s\.nome/, /texto\.length/, /info\.erro/, /perfil\.usuario/, /\$\{nome\} adicionado/,
    /est\.credenciais\.map\(c =>/, /perfil\.nome \?/, /esc\(/,
    /'Editar' : 'Justificar'/,   // só escolhe entre dois textos fixos
  ];
  const problemas = [];
  for (const f of ['app.js', 'painel.js']) {
    ler(f).split(/\r?\n/).forEach((linha, i) => {
      const re = /\$\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g; let m;
      while ((m = re.exec(linha))) {
        if (!CAMPOS.test(m[1]) || /esc\(/.test(m[1])) continue;
        if (REVISADOS.some(r => r.test(linha))) continue;
        problemas.push(`${f}:${i + 1}: ${linha.trim().slice(0, 120)}`);
      }
    });
  }
  assert.deepEqual(problemas, [], 'campo de usuário sem esc():\n' + problemas.join('\n'));
});

test('sair da conta apaga o que ficou neste aparelho', () => {
  const p = ler('painel.js');
  assert.match(p, /function limparDadosLocais\(\)/);
  assert.match(p, /function sair\(\)[\s\S]{0,400}limparDadosLocais\(\)/);
  assert.match(ler('app.js'), /window\.Painel\.sair\(\)/);
});

test('o Excel/backup que entra passa pela limpeza e por limites de tamanho', () => {
  const x = ler('excel.js');
  assert.match(x, /LIMITE_ARQUIVO/); assert.match(x, /LIMITE_TOTAL/); assert.match(x, /MAX_ENTRADAS/);
  const app = ler('app.js');
  assert.match(app, /arq\.size > 20 \* 1024 \* 1024/);
  assert.match(app, /base = completar\(b\)/);
});

test('a tela de acesso (troca de senha) nunca monta HTML com dados vindos do servidor', () => {
  const a = ler('acesso.js').replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(a, /innerHTML|outerHTML|insertAdjacentHTML|document\.write/);
  assert.match(a, /textContent/);
});

test('não existe criação de conta pelo site e o texto técnico do servidor não vai para a tela de login', () => {
  const app = ler('app.js');
  assert.doesNotMatch(app, /auth\.signUp\(/);
  assert.doesNotMatch(html, /lnkModo|Criar conta/);
  assert.doesNotMatch(app, /'Não deu certo: ' \+/);
  assert.match(app, /function traduzirErro[\s\S]{0,1400}Não foi possível concluir/);
});

test('o supervisor sai sozinho por inatividade e o líder cria a própria senha', () => {
  const app = ler('app.js');
  assert.match(app, /deveSairPorInatividade/);
  assert.match(app, /trocar_senha === true/);
});

test('nenhum dado real de funcionário nos arquivos de teste e documentação (só nomes e matrículas inventados)', () => {
  // as matrículas reais da fábrica começam com "91" + 5 dígitos; os testes usam a série 1000xxx
  const alvos = [
    ...fs.readdirSync(path.join(RAIZ, 'testes')).filter(f => /\.(js|txt|md)$/.test(f)).map(f => path.join('testes', f)),
    ...fs.readdirSync(path.join(RAIZ, 'docs')).filter(f => /\.md$/.test(f)).map(f => path.join('docs', f)),
  ];
  for (const f of alvos) assert.doesNotMatch(fs.readFileSync(path.join(RAIZ, f), 'utf8'), /\b91\d{5}\b/, f);
});
