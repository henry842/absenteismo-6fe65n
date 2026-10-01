// Endereço do banco (Supabase) e chave pública. A chave pode ficar no código:
// quem protege os dados é a regra do banco (cada conta só lê e grava os próprios registros).
window.CONFIG = {
  supabaseUrl: 'https://ztmwsvfqlozilwnqkrom.supabase.co',
  supabaseChave: 'sb_publishable_qnrqdMMClkJOjZaB0gOjVw_PwslhOin',
  // Mostrada na tela de login e no menu, para saber se o aparelho está com a versão mais nova (o número é o mesmo do cache do sw.js)
  versao: 'v18 · 30/09/2026',
};
