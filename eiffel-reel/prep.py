"""Extracts clip frames (1080x1920, 30fps) and builds captions.js from lines.json with per-word timing."""
import json, subprocess, os, shutil, re
FPS = 30
for c in ['e1', 'e2', 'e3']:
    if not os.path.exists(f'clips/{c}.mp4'): print('missing', c); continue
    shutil.rmtree(f'frames/{c}', ignore_errors=True); os.makedirs(f'frames/{c}')
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', f'clips/{c}.mp4', '-vf',
                    f'fps={FPS},scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920', '-q:v', '3', f'frames/{c}/%04d.jpg'], check=True)
    print(c, len(os.listdir(f'frames/{c}')), 'frames')
lines = json.load(open('lines.json'))
caps = []
for ln in lines:
    words = ln['text'].split()
    # break long lines into chunks of <= 4 words / ~26 chars
    groups, cur = [], []
    for w in words:
        cur.append(w)
        if len(cur) == 4 or sum(len(x) for x in cur) > 24: groups.append(cur); cur = []
    if cur: groups.append(cur)
    tot = sum(len(w) for w in words); t = ln['t0']; span = ln['t1'] - ln['t0']
    for g in groups:
        ws = []
        for w in g:
            ws.append({'t': w, 's': round(t, 3)}); t += span * len(w) / tot
        caps.append({'s': ws[0]['s'], 'e': round(t, 3), 'w': ws})
for i in range(len(caps) - 1):   # hold a caption through short pauses
    if caps[i + 1]['s'] - caps[i]['e'] < .6: caps[i]['e'] = caps[i + 1]['s']
open('captions.js', 'w').write('window.CAPS=' + json.dumps(caps, ensure_ascii=False) + ';')
print(len(caps), 'caption chunks')
