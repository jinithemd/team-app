"""Extract slowed clip frames and build word-synced captions for the Gimli reel."""
import json, subprocess, os, shutil
FPS = 30
CLIPS = {'g1': 4.7, 'g2': 5.4, 'g3': 5.3}     # target durations (clips are 4s, slowed to fit the narration)
shutil.rmtree('frames', ignore_errors=True)
for c, d in CLIPS.items():
    os.makedirs(f'frames/{c}')
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', f'clips/{c}.mp4', '-vf',
                    f'setpts={d/4:.4f}*PTS,fps={FPS},scale=1080:1920', '-q:v', '3', f'frames/{c}/%04d.jpg'], check=True)
    print(c, len(os.listdir(f'frames/{c}')), 'frames')
W = json.load(open('words.json')); W = W['words'] if isinstance(W, dict) else W
words = [w for w in W if w.get('type', 'word') == 'word' and not w['text'].startswith('[')]
caps, cur = [], []
for w in words:
    cur.append(w)
    if len(cur) == 3 or w['text'][-1] in '.!?,' or sum(len(x['text']) for x in cur) > 24:
        caps.append(cur); cur = []
if cur: caps.append(cur)
out = []
for i, c in enumerate(caps):
    nxt = caps[i + 1][0]['start'] if i + 1 < len(caps) else c[-1]['end'] + .4
    e = nxt if nxt - c[-1]['end'] < .6 else c[-1]['end'] + .3
    out.append({'s': round(c[0]['start'] - .05, 3), 'e': round(e - .05, 3), 'w': [{'t': x['text'], 's': x['start']} for x in c]})
open('captions.js', 'w').write('window.CAPS=' + json.dumps(out, ensure_ascii=False) + ';')
print(len(out), 'caption chunks')
