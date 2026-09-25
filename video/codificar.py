"""Transforma os quadros do screencast em vídeo H.264 a 30 fps exatos.

Uso: python3 codificar.py <pt|zh>
Lê frames_<lang>/quadros.json (gerado por gravar.js) e escreve rascunho_<lang>_sem_audio.mp4.
Para cada instante k/30 s usa o último quadro capturado até ali, então a duração do vídeo
bate com tempos_<lang>.json (o concat do ffmpeg arredonda a duração de cada quadro e acumula desvio).
"""
import json, os, subprocess, sys
import imageio_ffmpeg

lang = sys.argv[1] if len(sys.argv) > 1 else 'pt'
FPS = 30
pasta = f'frames_{lang}'
q = json.load(open(os.path.join(pasta, 'quadros.json')))
quadros, ini, fim = q['quadros'], q['inicio'], q['fim']
total = int((fim - ini) * FPS)
ff = subprocess.Popen([imageio_ffmpeg.get_ffmpeg_exe(), '-hide_banner', '-loglevel', 'error', '-y',
                       '-f', 'image2pipe', '-framerate', str(FPS), '-c:v', 'mjpeg', '-i', '-',
                       '-vf', 'format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', '25',
                       '-tune', 'stillimage', '-r', str(FPS), '-movflags', '+faststart',
                       f'rascunho_{lang}_sem_audio.mp4'], stdin=subprocess.PIPE)
j, atual, cache = 0, None, None
for k in range(total):
    t = ini + k / FPS
    while j + 1 < len(quadros) and quadros[j + 1][0] <= t:
        j += 1
    if quadros[j][1] != atual:
        atual = quadros[j][1]
        cache = open(os.path.join(pasta, atual), 'rb').read()
    ff.stdin.write(cache)
ff.stdin.close()
if ff.wait():
    sys.exit('ffmpeg falhou')
print(f'{lang}: {total} quadros, {total / FPS:.2f} s')
