"""Edit list for the Brake Failure reel: extracts frames for each clip segment and writes edl.js."""
import json, subprocess, os, shutil
FPS = 30
SEG = [  # kind, source, in-point, duration, shake
 ('clip', 'k07', 0.5, 1.8, 1.0),          # teaser: screaming driver
 ('card', '10 മിനിറ്റ് മുമ്പ്...', 0, 0.9, 0),
 ('clip', 'k01', 0.0, 4.0, 0),
 ('clip', 'k02', 0.5, 3.0, 0),
 ('clip', 'k03', 0.5, 3.0, 0),
 ('clip', 'k04', 0.0, 5.6, 0),
 ('clip', 'k05', 0.3, 3.5, 0),
 ('clip', 'k06', 0.3, 3.5, .4),
 ('speedo', '', 0, 2.5, .5),
 ('clip', 'k07', 0.0, 5.5, .8),
 ('clip', 'k08', 0.3, 3.5, 0),
 ('clip', 'k09', 0.0, 6.0, .3),
 ('clip', 'k10', 0.0, 6.0, 0),
 ('clip', 'k11', 0.0, 4.0, 0),
 ('end', '', 0, 7.2, 0),
]
shutil.rmtree('frames', ignore_errors=True); os.makedirs('frames')
t = 0; edl = []
for i, (kind, src, tin, d, sh) in enumerate(SEG):
    e = {'i': i, 'kind': kind, 'start': round(t, 3), 'd': d, 'shake': sh, 'src': src}
    if kind == 'clip':
        out = f'frames/s{i:02d}'; os.makedirs(out)
        subprocess.run(['ffmpeg', '-loglevel', 'error', '-ss', str(tin), '-t', str(d), '-i', f'clips/{src}.mp4',
                        '-vf', f'fps={FPS},scale=1080:608', '-q:v', '3', f'{out}/%04d.jpg'], check=True)
        e['n'] = len(os.listdir(out))
    edl.append(e); t += d
open('edl.js', 'w').write('window.EDL=' + json.dumps(edl, ensure_ascii=False) + ';window.TOTAL=' + str(round(t, 3)) + ';')
for e in edl: print(f"{e['start']:6.2f} {e['kind']:6} {e['src']} {e['d']}")
print('total', round(t, 2))
