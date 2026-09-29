"""Junta o vídeo gravado com a narração e gera as legendas.

Uso: python3 montar.py <pt|zh>
Entradas: rascunho_<lang>_sem_audio.mp4, tempos_<lang>.json, roteiro.json
          audio/<lang>/<id>.wav (opcional; se faltar, sai só o vídeo com legenda .srt)
Saída:    saida/C3B_apresentacao_<LANG>.mp4 e .srt
"""
import json, os, subprocess, sys
import imageio_ffmpeg

FF = imageio_ffmpeg.get_ffmpeg_exe()
lang = sys.argv[1] if len(sys.argv) > 1 else 'pt'
roteiro = {i['id']: i for i in json.load(open('roteiro.json', encoding='utf-8'))}
tempos = json.load(open(f'tempos_{lang}.json'))
os.makedirs('saida', exist_ok=True)
nome = f'saida/C3B_apresentacao_{lang.upper()}'

def ts(s):
    ms = int(round(s * 1000))
    h, ms = divmod(ms, 3_600_000); m, ms = divmod(ms, 60_000); sec, ms = divmod(ms, 1000)
    return f'{h:02}:{m:02}:{sec:02},{ms:03}'

with open(nome + '.srt', 'w', encoding='utf-8') as f:
    for n, it in enumerate(tempos['itens'], 1):
        f.write(f"{n}\n{ts(it['ini'])} --> {ts(it['ini'] + it['dur'] - 0.15)}\n{roteiro[it['id']][lang]}\n\n")

audios = [(it, f"audio/{lang}/{it['id']}.wav") for it in tempos['itens']]
tem_audio = all(os.path.exists(a) for _, a in audios)
cmd = [FF, '-hide_banner', '-loglevel', 'error', '-y', '-i', f'rascunho_{lang}_sem_audio.mp4']
if tem_audio:
    for _, a in audios:
        cmd += ['-i', a]
    parts = [f"[{k + 1}:a]aresample=48000,adelay={int(it['ini'] * 1000)}:all=1[a{k}]" for k, (it, _) in enumerate(audios)]
    mix = ''.join(f'[a{k}]' for k in range(len(audios)))
    filt = ';'.join(parts) + f';{mix}amix=inputs={len(audios)}:normalize=0,loudnorm=I=-16:TP=-1.5[voz]'
    cmd += ['-filter_complex', filt, '-map', '0:v', '-map', '[voz]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest']
else:
    print('Sem narração: gerando só o vídeo + .srt')
    cmd += ['-c', 'copy']
subprocess.run(cmd + ['-movflags', '+faststart', nome + '.mp4'], check=True)
print('ok', nome + '.mp4', 'com voz' if tem_audio else 'sem voz')
