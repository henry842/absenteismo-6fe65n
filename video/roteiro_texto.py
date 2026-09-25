"""Gera roteiro_PT.md e roteiro_ZH.md a partir de roteiro.json (texto para narrar no HeyGen)."""
import json

R = json.load(open('roteiro.json', encoding='utf-8'))
NOMES = {
    1: ('Início · Central de Comando', '首页 · 指挥中心'), 2: ('Registrar Habilidade', '登记技能'),
    3: ('Matriz de Habilidades', '技能矩阵'), 4: ('Presença / Faltas', '出勤/缺勤'),
    5: ('Revezamento de Operações', '工序轮岗'), 6: ('Perfil do Operador', '操作员档案'),
    7: ('Centro de Treinamento', '培训中心'), 8: ('Estações / Operações', '工位/工序'),
    9: ('Indicadores', '指标'), 10: ('Central de Alertas', '预警中心'),
    11: ('Histórico e Auditoria', '历史与审计'), 12: ('Relatórios', '报表'),
    13: ('Importar / Exportar', '导入/导出'), 14: ('Configurações', '设置'),
    15: ('Modelos de Carro', '车型'), 16: ('Aprovações e Validações', '审批与确认'),
    17: ('Permissões e Acessos', '权限与访问'), 18: ('Integrações e Sincronização', '集成与同步'),
    19: ('Processos / Falhas', '流程/故障'), 20: ('Pendências', '待办事项'),
}
for lang, k, titulo, dica in (
        ('pt', 0, 'Roteiro de narração — Português', 'Leia na ordem. Deixe ~1 s de pausa entre as falas.'),
        ('zh', 1, '旁白脚本 — 中文', '请按顺序朗读，每句之间停顿约1秒。')):
    linhas, tela = [f'# {titulo}', '', dica, ''], None
    for it in R:
        if it['alvo'] in ('intro', 'final'):
            linhas += ['## ' + ('Abertura' if it['alvo'] == 'intro' else 'Fechamento') if lang == 'pt'
                       else '## ' + ('开场' if it['alvo'] == 'intro' else '结尾'), '']
            tela = None
        elif it['tela'] != tela:
            tela = it['tela']
            linhas += [f"## {NOMES[tela][k]} (tela {tela})" if lang == 'pt' else f"## {NOMES[tela][k]}（第{tela}页）", '']
        linhas += [f"**{it['id']}** — {it[lang]}", '']
    open(f'roteiro_{lang.upper()}.md', 'w', encoding='utf-8').write('\n'.join(linhas))
print('ok')
