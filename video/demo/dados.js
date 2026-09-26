// Gera dados FICTÍCIOS de absenteísmo (nomes e matrículas inventados) usando o próprio leitor do app.
// Uso na página: window.__gerarDemo({ ate: '2026-09-24', semanas: 5 }) → base pronta para o localStorage.
window.__matricula = n => String(3000000 + [...n].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 900000, 7));
window.__gerarDemo = function ({ ate, semanas }) {
  const L = window.Leitor;
  let s = 42;
  const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
  const PRIMEIROS = ['Ana', 'Bruno', 'Camila', 'Diego', 'Elaine', 'Fábio', 'Gabriela', 'Henrique', 'Isabela', 'Jonas', 'Karina', 'Leandro',
    'Marcela', 'Nelson', 'Olívia', 'Paulo', 'Renata', 'Sérgio', 'Tatiane', 'Vítor', 'Bianca', 'Caio', 'Débora', 'Eduardo', 'Flávia', 'Gustavo',
    'Helena', 'Igor', 'Juliana', 'Lucas', 'Mariana', 'Otávio', 'Patrícia', 'Rodrigo', 'Sabrina', 'Tiago', 'Vanessa', 'Wagner', 'Aline', 'César'];
  const SOBRENOMES = ['Ribeiro', 'Cardoso', 'Duarte', 'Fonseca', 'Prado', 'Teixeira', 'Lins', 'Batista', 'Rocha', 'Macedo', 'Veloso', 'Pires',
    'Antunes', 'Queiroz', 'Barros', 'Mendes', 'Siqueira', 'Brandão', 'Falcão', 'Leite', 'Campos', 'Rezende', 'Vidal', 'Tavares', 'Freitas'];
  const EFETIVO = { C1B: 46, C2B: 52, C3B: 40, C5B: 48, C7B: 44, C9B: 38 };
  const FIXOS = { C1B: ['Camila Duarte'], C2B: ['Jonas Macedo', 'Karina Veloso'], C3B: ['Rafael Nogueira', 'Paulo Mendes'],
    C5B: ['Bianca Moura'], C7B: ['Igor Tavares', 'Mariana Coelho'], C9B: [] };
  const TIMES = {};
  Object.keys(EFETIVO).forEach((time, k) => {
    const nomes = FIXOS[time].slice();
    for (let i = 0; nomes.length < 16; i++) {
      const n = PRIMEIROS[(k * 7 + i * 3) % PRIMEIROS.length] + ' ' + SOBRENOMES[(k * 5 + i * 7) % SOBRENOMES.length];
      if (!nomes.includes(n)) nomes.push(n);
    }
    TIMES[time] = { efetivo: EFETIVO[time], nomes };
  });
  const matricula = window.__matricula;
  const MOTIVOS = ['Atestado médico', 'Atestado médico', 'Atestado médico', 'Sem justificativa', 'Atraso roteiro', 'Atraso motivo pessoal', 'Férias', 'Afastamento INSS'];
  const iso = d => d.toISOString().slice(0, 10);
  const br = d => iso(d).split('-').reverse().join('/');
  const fim = new Date(ate + 'T12:00:00Z');
  const ini = new Date(fim); ini.setUTCDate(ini.getUTCDate() - semanas * 7 + 1);
  let base = L.baseVazia();
  base.config.times = Object.keys(TIMES);
  base.config.area = 'SUB MONTAGEM TURNO B';
  base.config.meta = 0.03;
  base.config.naoContam = ['Férias', 'Afastamento INSS'];
  for (const d = new Date(ini); d <= fim; d.setUTCDate(d.getUTCDate() + 1)) {
    const dia = d.getUTCDay(); if (dia === 0 || dia === 6) continue;
    for (const [time, t] of Object.entries(TIMES)) {
      const aus = [];
      const r = rnd(); const n = r < 0.5 ? 0 : r < 0.9 ? 1 : 2;
      if (time === 'C3B' && dia === 1) aus.push(['Rafael Nogueira', 'Sem justificativa']);   // padrão de segunda-feira
      if (time === 'C5B' && rnd() < 0.18) aus.push(['Bianca Moura', 'Atestado médico']);
      while (aus.length < n) {
        const nome = t.nomes[Math.floor(rnd() * t.nomes.length)];
        if (!aus.some(a => a[0] === nome)) aus.push([nome, MOTIVOS[Math.floor(rnd() * MOTIVOS.length)]]);
      }
      const txt = [`*Absenteísmo ${time} ${br(d)}*`, '*Turno:* Turno B', '', `*Total de pessoas:* ${t.efetivo}`,
        `*Presentes:* ${t.efetivo - aus.length}`, `*Ausentes:* ${aus.length}`, '']
        .concat(aus.flatMap(([nome, mot]) => [`*Nome:* ${nome}`, `*Matrícula:* ${matricula(nome)}`, `*Motivo:* ${mot}`, ''])).join('\n');
      const [m] = L.lerMensagens(txt, { ano: d.getUTCFullYear(), apelidos: {} });
      base = L.gravar(base, m);
    }
  }
  return base;
};
// Mensagens do dia para colar na demonstração (5 de 6 times; C9B fica pendente).
window.__mensagensDoDia = function (data) {
  const br = data.split('-').reverse().join('/');
  const M = window.__matricula;
  return [
    `[${br}, 07:41:12] ~Líder C1B: *Absenteísmo C1B ${br}*\n*Turno:* Turno B\n\n*Total de pessoas:* 46\n*Presentes:* 45\n*Ausentes:* 1\n\n*Nome:* Camila Duarte\n*Matrícula:* ${M('Camila Duarte')}\n*Motivo:* Atestado médico`,
    `[${br}, 07:44:03] ~Líder C2B: ABSENTEÍSMO C2B ${br}\n- Efetivo previsto: 52 colaboradores\n- Atestados médicos: 1\n- Faltas sem justificativa: 1\n- Total presente: 50 colaboradores\n\nJonas Macedo\nID ${M('Jonas Macedo')}\nMotivo: atestado\n\nKarina Veloso\nID: ${M('Karina Veloso')}\nMotivo: faltou sem avisar`,
    `[${br}, 07:52:47] ~Líder C3B: *Absenteísmo C3B ${br}*\n*Turno:* Turno B\n\n*Total de pessoas:* 40\n*Presentes:* 37\n*Ausentes:* 2\n\n*Nome:* Rafael Nogueira\n*Matrícula:* ${M('Rafael Nogueira')}\n*Motivo:* Sem justificativa\n\n*Nome:* Paulo Mendes\n*Matrícula:* ${M('Paulo Mendes')}\n*Motivo:* Atraso roteiro`,
    `[${br}, 07:58:30] ~Líder C5B: *Absenteísmo C5B ${br}*\n*Turno:* Turno B\n\n*Total de pessoas:* 48\n*Presentes:* 47\n*Ausentes:* 1\n\n*Nome:* Bianca Moura\n*Matrícula:* ${M('Bianca Moura')}\n*Motivo:* Atestado médico`,
    `[${br}, 08:03:15] ~Líder C7B: *Absenteísmo C7B ${br}*\n*Turno:* Turno B\n\n*Total de pessoas:* 44\n*Presentes:* 42\n*Ausentes:* 2\n\n*Nome:* Igor Tavares\n*Matrícula:* ${M('Igor Tavares')}\n*Motivo:* busquei o filho na escola\n\n*Nome:* Mariana Coelho\n*Matrícula:* ${M('Mariana Coelho')}\n*Motivo:* Férias`,
  ].join('\n\n');
};
