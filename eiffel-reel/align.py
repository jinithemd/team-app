"""Splits the narration script into caption chunks and times them against the pauses in narration.mp3."""
import re, json, subprocess
TEXT = open('narration_ml.txt').read()
TEXT = re.sub(r'\[[^\]]+\]', '', TEXT)
chunks = [c.strip() for c in re.findall(r'[^.!?…:]+[.!?…:]+["”]?|[^.!?…:]+$', TEXT.replace('\n', ' ')) if c.strip()]
log = subprocess.run(['ffmpeg', '-i', 'sfx/narration.mp3', '-af', 'silencedetect=noise=-35dB:d=0.3', '-f', 'null', '-'], capture_output=True, text=True).stderr
ss = [float(x) for x in re.findall(r'silence_start: ([\d.]+)', log)]; se = [float(x) for x in re.findall(r'silence_end: ([\d.]+)', log)]
dur = float(re.search(r'Duration: (\d+):(\d+):([\d.]+)', log).groups()[2]) + 60 * int(re.search(r'Duration: (\d+):(\d+)', log).group(2))
segs = []; t = 0.0
for a, b in zip(ss, se): segs.append((t, a)); t = b
segs.append((t, dur - 0.1))
speech = sum(b - a for a, b in segs)
def speech_to_time(f):  # fraction of total speech -> wall time
    left = f * speech
    for a, b in segs:
        if left <= b - a: return a + left
        left -= b - a
    return segs[-1][1]
rate = speech / sum(len(re.sub(r'\s', '', c)) for c in chunks)
L = [len(re.sub(r'\s', '', c)) * rate for c in chunks]
n, m = len(chunks), len(segs); INF = 1e18
D = [[INF] * (m + 1) for _ in range(n + 1)]; P = [[None] * (m + 1) for _ in range(n + 1)]; D[0][0] = 0
for i in range(n + 1):
    for k in range(m + 1):
        if D[i][k] >= INF: continue
        for a in range(1, 4):          # a chunks
            for b in range(1, 4):      # b segments
                if (a > 1 and b > 1) or i + a > n or k + b > m: continue
                want = sum(L[i:i + a]); got = segs[k + b - 1][1] - segs[k][0]
                c = D[i][k] + (want - got) ** 2 + 0.3 * (a + b - 2)
                if c < D[i + a][k + b]: D[i + a][k + b] = c; P[i + a][k + b] = (i, k)
out = []; i, k = n, m; groups = []
while (i, k) != (0, 0):
    pi, pk = P[i][k]; groups.append((pi, i, pk, k)); i, k = pi, pk
for ci, cj, sk, sl in reversed(groups):
    t0, t1 = segs[sk][0], segs[sl - 1][1]
    if cj - ci == 1: out.append({'t0': round(t0, 2), 't1': round(t1, 2), 'text': chunks[ci]})
    else:
        tot = sum(L[ci:cj]); t = t0
        for c in range(ci, cj):
            d = (t1 - t0) * L[c] / tot; out.append({'t0': round(t, 2), 't1': round(t + d, 2), 'text': chunks[c]}); t += d
json.dump(out, open('lines.json', 'w'), ensure_ascii=False, indent=0)
for o in out: print(o['t0'], o['t1'], o['text'])
print('dur', dur, 'chunks', len(chunks), 'segs', len(segs))
