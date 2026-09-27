// StorageAdapter: onde as bases são lidas e gravadas. Contrato comum:
//   listFiles(dir) → [{ nome, tipo: 'arquivo'|'pasta', tamanho, modificado }]
//   readFile(caminho) → Uint8Array          writeFile(caminho, bytes) → { caminho, bytes }
//   createDirectory(caminho)                 fileExists(caminho) → boolean
//   getMetadata(caminho) → { tamanho, modificado } | null
//   backupFile(caminho, destino) → { caminho }
// Propriedades: id, nome, suportaDiretorios, suportaLeitura, descricaoDestino (texto honesto para o usuário).
// Todo caminho passa por U.caminhoSeguro (sem "..", sem caracteres proibidos): impede path traversal.
(typeof module === 'object' ? require('../modulo') : C3BModulo)('storage/adaptadores', ['core/util'], (U) => {
  'use strict';

  const partes = c => U.caminhoSeguro(c).split('/').filter(Boolean);
  const dirDe = c => partes(c).slice(0, -1).join('/');
  const nomeDe = c => partes(c).slice(-1)[0];

  // ---------- memória (testes, simulação) ----------
  function MemoryAdapter() {
    const arquivos = new Map(), pastas = new Set(['']);
    const agora = () => U.relogio.agora().toISOString();
    return {
      id: 'memory', nome: 'Memória (simulação)', suportaDiretorios: true, suportaLeitura: true,
      descricaoDestino: 'Memória do navegador (simulação: nada é gravado em disco).',
      async listFiles(dir = '') {
        const d = dir ? U.caminhoSeguro(dir) : '';
        const out = [];
        for (const [c, a] of arquivos) if (dirDe(c) === d) out.push({ nome: nomeDe(c), tipo: 'arquivo', tamanho: a.bytes.length, modificado: a.modificado });
        for (const p of pastas) if (p && dirDe(p) === d) out.push({ nome: nomeDe(p), tipo: 'pasta' });
        return out;
      },
      async readFile(c) { const a = arquivos.get(U.caminhoSeguro(c)); if (!a) throw new Error('Arquivo não encontrado: ' + c); return a.bytes.slice(); },
      async writeFile(c, bytes) {
        const k = U.caminhoSeguro(c);
        if (dirDe(k) && !pastas.has(dirDe(k))) throw new Error('Pasta não existe: ' + dirDe(k));
        arquivos.set(k, { bytes: new Uint8Array(bytes), modificado: agora() }); return { caminho: k, bytes: bytes.length };
      },
      async createDirectory(c) { const ps = partes(c); for (let i = 1; i <= ps.length; i++) pastas.add(ps.slice(0, i).join('/')); },
      async fileExists(c) { const k = U.caminhoSeguro(c); return arquivos.has(k) || pastas.has(k); },
      async getMetadata(c) { const a = arquivos.get(U.caminhoSeguro(c)); return a ? { tamanho: a.bytes.length, modificado: a.modificado } : null; },
      async backupFile(c, destino) { const b = await this.readFile(c); await this.writeFile(destino, b); return { caminho: U.caminhoSeguro(destino) }; },
    };
  }

  // ---------- disco local via Node (bridge e testes) ----------
  function NodeFsAdapter(raiz) {
    const fs = require('fs'), path = require('path');
    const base = path.resolve(raiz);
    const abs = c => {
      const alvo = path.resolve(base, U.caminhoSeguro(c || '.') || '.');
      if (alvo !== base && !alvo.startsWith(base + path.sep)) throw new Error('Caminho fora da pasta permitida: ' + c);
      return alvo;
    };
    const absDir = c => (c ? abs(c) : base);
    return {
      id: 'nodefs', nome: 'Pasta local', suportaDiretorios: true, suportaLeitura: true, raiz: base,
      descricaoDestino: `Pasta ${base}`,
      async listFiles(dir = '') {
        const d = absDir(dir);
        if (!fs.existsSync(d)) return [];
        return fs.readdirSync(d, { withFileTypes: true }).map(e => {
          const st = fs.statSync(path.join(d, e.name));
          return { nome: e.name, tipo: e.isDirectory() ? 'pasta' : 'arquivo', tamanho: st.size, modificado: st.mtime.toISOString() };
        });
      },
      async readFile(c) { return new Uint8Array(fs.readFileSync(abs(c))); },
      async writeFile(c, bytes) {
        const alvo = abs(c);
        if (!fs.existsSync(path.dirname(alvo))) throw new Error('Pasta não existe: ' + path.relative(base, path.dirname(alvo)));
        const tmp = alvo + '.gravando';
        fs.writeFileSync(tmp, Buffer.from(bytes)); fs.renameSync(tmp, alvo); // gravação atômica
        return { caminho: path.relative(base, alvo).split(path.sep).join('/'), bytes: bytes.length };
      },
      async createDirectory(c) { fs.mkdirSync(abs(c), { recursive: true }); },
      async fileExists(c) { return fs.existsSync(abs(c)); },
      async getMetadata(c) { const a = abs(c); if (!fs.existsSync(a)) return null; const st = fs.statSync(a); return { tamanho: st.size, modificado: st.mtime.toISOString() }; },
      async backupFile(c, destino) { fs.copyFileSync(abs(c), abs(destino)); return { caminho: U.caminhoSeguro(destino) }; },
    };
  }

  // ---------- navegador: downloads (fallback) ----------
  function BrowserDownloadAdapter() {
    return {
      id: 'download', nome: 'Downloads do navegador', suportaDiretorios: false, suportaLeitura: false,
      descricaoDestino: 'O navegador salvará na pasta de downloads configurada nele (não é possível escolher subpastas nem criar backups automáticos).',
      async listFiles() { return []; },
      async readFile(c) { throw new Error('O modo "Downloads do navegador" não lê arquivos. Para diagnosticar ou atualizar bases existentes, escolha uma pasta (Chrome/Edge) ou use o Bridge local.'); },
      async writeFile(c, bytes) {
        const nome = nomeDe(c);
        const url = URL.createObjectURL(new Blob([bytes], { type: /\.xlsx$/i.test(nome) ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/octet-stream' }));
        const a = document.createElement('a'); a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 30000);
        return { caminho: nome, bytes: bytes.length, download: true };
      },
      async createDirectory() { /* downloads não têm subpastas */ },
      async fileExists() { return false; },
      async getMetadata() { return null; },
      async backupFile() { throw new Error('Backup automático não é possível no modo Downloads.'); },
    };
  }

  // ---------- navegador: pasta escolhida pelo usuário (File System Access API, Chrome/Edge) ----------
  function FileSystemAccessAdapter(raizHandle) {
    async function pasta(caminho, criar = false) {
      let h = raizHandle;
      for (const p of caminho ? partes(caminho) : []) h = await h.getDirectoryHandle(p, { create: criar });
      return h;
    }
    async function arquivo(c, criar = false) { const d = await pasta(dirDe(c), false); return d.getFileHandle(nomeDe(c), { create: criar }); }
    return {
      id: 'fsaccess', nome: 'Pasta escolhida', suportaDiretorios: true, suportaLeitura: true, handle: raizHandle,
      descricaoDestino: `Pasta "${raizHandle.name}" escolhida por você (os arquivos são gravados nela de verdade).`,
      async listFiles(dir = '') {
        const d = await pasta(dir).catch(() => null); if (!d) return [];
        const out = [];
        for await (const [nome, h] of d.entries()) {
          if (h.kind === 'file') { const f = await h.getFile(); out.push({ nome, tipo: 'arquivo', tamanho: f.size, modificado: new Date(f.lastModified).toISOString() }); }
          else out.push({ nome, tipo: 'pasta' });
        }
        return out;
      },
      async readFile(c) { const f = await (await arquivo(c)).getFile(); return new Uint8Array(await f.arrayBuffer()); },
      async writeFile(c, bytes) { const h = await arquivo(c, true); const w = await h.createWritable(); await w.write(bytes); await w.close(); return { caminho: U.caminhoSeguro(c), bytes: bytes.length }; },
      async createDirectory(c) { await pasta(c, true); },
      async fileExists(c) { try { await arquivo(c); return true; } catch (e) { try { await pasta(c); return true; } catch (e2) { return false; } } },
      async getMetadata(c) { try { const f = await (await arquivo(c)).getFile(); return { tamanho: f.size, modificado: new Date(f.lastModified).toISOString() }; } catch (e) { return null; } },
      async backupFile(c, destino) { const b = await this.readFile(c); await this.writeFile(destino, b); return { caminho: U.caminhoSeguro(destino) }; },
    };
  }

  // ---------- Bridge local (bridge/server.js): contrato preparado para o futuro Bridge C3B ----------
  function LocalBridgeAdapter({ url = 'http://127.0.0.1:47833', token = '' } = {}) {
    const chamar = async (metodo, rota, params = {}, corpo) => {
      const q = new URLSearchParams(params).toString();
      const r = await fetch(`${url}${rota}${q ? '?' + q : ''}`, { method: metodo, headers: { 'X-C3B-Token': token, ...(corpo ? { 'Content-Type': 'application/octet-stream' } : {}) }, body: corpo });
      if (!r.ok) { let msg = r.statusText; try { msg = (await r.json()).erro || msg; } catch (e) { /* sem corpo */ } throw new Error(`Bridge: ${msg}`); }
      return r;
    };
    return {
      id: 'bridge', nome: 'Bridge local C3B', suportaDiretorios: true, suportaLeitura: true, url,
      descricaoDestino: `Bridge local em ${url} (grava na pasta configurada no bridge).`,
      async ping() { return (await chamar('GET', '/ping')).json(); },
      async listFiles(dir = '') { return (await chamar('GET', '/files', { dir })).json(); },
      async readFile(c) { return new Uint8Array(await (await chamar('GET', '/file', { path: c })).arrayBuffer()); },
      async writeFile(c, bytes) { return (await chamar('PUT', '/file', { path: c }, bytes)).json(); },
      async createDirectory(c) { await chamar('POST', '/dir', { path: c }); },
      async fileExists(c) { return (await (await chamar('GET', '/exists', { path: c })).json()).existe; },
      async getMetadata(c) { return (await chamar('GET', '/meta', { path: c })).json(); },
      async backupFile(c, destino) { return (await chamar('POST', '/backup', { path: c, dest: destino })).json(); },
    };
  }

  return { MemoryAdapter, NodeFsAdapter, BrowserDownloadAdapter, FileSystemAccessAdapter, LocalBridgeAdapter };
}, typeof module === 'object' ? module : null);
