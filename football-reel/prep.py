"""Extracts clip frames (1080x1920, 30fps) and writes captions.js from the timeline."""
import json, subprocess, os, shutil
from timeline import SEGS
FPS = 30
for c in ['f1', 'f3', 'f4', 'f5', 'f6', 'f7']:
    shutil.rmtree(f'frames/{c}', ignore_errors=True); os.makedirs(f'frames/{c}')
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', f'clips/{c}.mp4', '-vf',
                    f'fps={FPS},scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920', '-q:v', '3', f'frames/{c}/%04d.jpg'], check=True)
caps = []
for a, b, at, text in SEGS:
    words = text.split(); tot = sum(len(w) for w in words); span = b - a
    groups, cur = [], []
    for w in words:
        cur.append(w)
        if len(cur) == 4 or sum(len(x) for x in cur) > 20: groups.append(cur); cur = []
    if cur: groups.append(cur)
    t = at
    for g in groups:
        ws = []
        for w in g: ws.append({'t': w, 's': round(t, 3)}); t += span * len(w) / tot
        caps.append({'s': ws[0]['s'], 'e': round(t + .25, 3), 'w': ws})
for i in range(len(caps) - 1):
    caps[i]['e'] = min(caps[i]['e'], caps[i + 1]['s'])
open('captions.js', 'w').write('window.CAPS=' + json.dumps(caps, ensure_ascii=False) + ';')
print(len(caps), 'captions')
