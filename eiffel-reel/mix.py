"""Eiffel reel mix: narration on top, sneaky jazz underneath (ducked under the voice), SFX on the visual hits."""
import subprocess, numpy as np
from scipy.io import wavfile
SR = 44100; T = 83.0; N = int(T * SR)
def load(n):
    raw = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', f'sfx/{n}.mp3', '-f', 's16le', '-ac', '2', '-ar', str(SR), '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.int16).reshape(-1, 2).astype(np.float32) / 32768
out = np.zeros((N, 2), np.float32)
def add(x, t, g, buf=out):
    i = int(t * SR); j = min(N, i + len(x)); buf[i:j] += x[: j - i] * g
EV = [('stamp', .9, 1), ('kaching', 1.0, .7), ('gasp', 3.3, .4), ('stamp', 3.6, 1), ('laugh', 4.5, .35),
      ('whoosh', 5.9, .4), ('newspaper', 7.95, .8), ('kaching', 11.7, .6),
      ('whoosh', 14.15, .4), ('twinkle', 14.4, .7), ('twinkle', 15.9, .7), ('stamp', 18.45, .9),
      ('whoosh', 19.65, .4), ('whoosh', 23.8, .4), ('boom', 24.3, .5), ('stamp', 27.0, 1),
      ('whoosh', 30.0, .4), ('kaching', 30.4, .5), ('kaching', 35.4, .6), ('stamp', 39.9, .9), ('laugh', 40.3, .5),
      ('train', 42.35, .8), ('whoosh', 46.75, .4), ('gasp', 47.2, .4),
      ('bell', 50.45, .8), ('stamp', 53.05, .9), ('police', 54.9, .7), ('whoosh', 57.2, .5),
      ('whoosh', 58.95, .4), ('boom', 61.7, .6), ('whoosh', 64.05, .4), ('whoosh', 66.65, .4), ('gasp', 70.1, .5),
      ('kaching', 71.3, .7), ('twinkle', 74.35, .7), ('stamp', 74.45, .8), ('laugh', 74.9, .55),
      ('whoosh', 75.85, .4), ('twinkle', 76.9, .6), ('twinkle', 80.55, .6)]
for n, t, g in EV: add(load(n), t, g * .75)
vo = np.zeros((N, 2), np.float32); add(load('narration'), 0.0, 1.0, vo)
env = np.abs(vo).mean(1); k = int(.25 * SR); c = np.concatenate([[0], np.cumsum(env)]); env = (c[np.minimum(np.arange(N) + k // 2, N)] - c[np.maximum(np.arange(N) - k // 2, 0)]) / k; speak = np.clip(env / (env.max() * .25), 0, 1)
m = load('music'); m = np.pad(m, ((0, max(0, N - len(m))), (0, 0)))[:N]
duck = 1 - .5 * speak
fade = np.ones(N, np.float32); fade[:int(.5 * SR)] = np.linspace(0, 1, int(.5 * SR)); f0 = int(80.8 * SR); fade[f0:] = np.linspace(1, 0, N - f0)
out = out * (1 - .3 * speak[:, None]) + m * .5 * (duck * fade)[:, None] + vo * 1.25
out[-int(.6 * SR):] *= np.linspace(1, 0, int(.6 * SR))[:, None]
out /= max(1e-9, np.abs(out).max()) / .95
wavfile.write('mix.wav', SR, (out * 32767).astype(np.int16)); print('mixed', T)
