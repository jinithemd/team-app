"""Mixes the ElevenLabs music + sound effects onto the 60s edit timeline."""
import subprocess, numpy as np
from scipy.io import wavfile
SR = 44100; T = 60.0; N = int(T * SR)
def load(name):
    raw = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', f'sfx/{name}.mp3', '-f', 's16le', '-ac', '2', '-ar', str(SR), '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.int16).reshape(-1, 2).astype(np.float32) / 32768
out = np.zeros((N, 2), np.float32); duck = np.ones(N, np.float32)
def add(name, t, g, cut=None, dk=0.0):
    x = load(name);  x = x[: int(cut * SR)] if cut else x
    i = int(t * SR); j = min(N, i + len(x)); out[i:j] += x[: j - i] * g
    if dk: duck[i:j] = np.minimum(duck[i:j], 1 - dk)
EVENTS = [
 ('boom', 0.0, .9, None, .3), ('screech', 0.1, .5, None, 0),
 ('whoosh', 1.75, .8, None, 0), ('whoosh', 2.6, .6, None, 0),
 ('engine', 2.8, .55, None, 0), ('suvhorn', 3.6, .7, None, 0),
 ('suvhorn', 6.8, .9, None, .2),
 ('whoosh', 9.65, .4, None, 0),
 ('engine', 12.7, .7, None, 0), ('screech', 13.9, .9, None, .2), ('airbrake', 14.2, .9, None, .3), ('boom', 14.2, .7, None, 0), ('gasp', 14.5, .9, None, 0),
 ('laugh', 19.6, .9, None, .3), ('engine', 19.6, .55, None, 0),
 ('pedalfail', 21.8, 1.0, None, .3), ('boom', 22.9, .9, None, 0), ('heartbeat', 23.0, .9, None, 0),
 ('heartbeat', 25.3, .75, None, 0), ('engine', 25.4, .55, None, 0),
 ('engine', 27.8, .7, None, 0), ('screech', 28.4, .8, None, 0), ('screech', 30.6, .7, None, 0),
 ('gear', 33.4, .95, None, .2),
 ('engine', 36.9, .5, None, 0), ('bushorn', 37.0, .9, None, .2), ('bump', 37.8, 1.0, None, .3), ('boom', 37.8, .6, None, 0), ('grind', 38.3, .9, None, .2),
 ('heartbeat', 43.0, .8, None, 0), ('pebble', 44.0, .9, None, .3), ('cheer', 46.4, 1.0, None, .3),
 ('bushorn', 51.4, .8, None, 0),
 ('whoosh', 52.7, .6, None, 0), ('boom', 52.8, .5, None, 0),
]
for e in EVENTS: add(*e)
# narration: (source start, source end, place at video time)
NARR = [(0.00, 2.43, 0.0), (2.78, 6.64, 3.0), (7.00, 11.68, 8.2), (12.02, 15.03, 12.6), (15.30, 16.49, 18.3), (16.84, 19.88, 21.9),
        (20.19, 22.97, 25.5), (23.25, 25.48, 33.6), (25.66, 28.30, 37.3), (28.58, 30.56, 44.3), (30.86, 32.54, 50.6), (32.92, 35.08, 54.2)]
nar = load('narration'); vo = np.zeros((N, 2), np.float32); speak = np.zeros(N, np.float32)
for a, b, at in NARR:
    x = nar[int(a * SR): int(b * SR)]; i = int(at * SR); j = min(N, i + len(x)); vo[i:j] += x[: j - i]; speak[i:j] = 1
k2 = int(.25 * SR); speak = np.clip(np.convolve(speak, np.ones(k2) / k2, 'same') * 1.5, 0, 1)
out *= (1 - .45 * speak)[:, None]          # effects step back under the voice
duck = np.minimum(duck, 1 - .55 * speak)   # music ducks deeper
m = load('music'); m = np.pad(m, ((0, max(0, N - len(m))), (0, 0)))[:N]
# smooth the duck envelope
k = int(.08 * SR); d = np.convolve(duck, np.ones(k) / k, 'same')
mix = out + m * .62 * d[:, None] + vo * 1.25
mix[-int(1.0 * SR):] *= np.linspace(1, 0, int(1.0 * SR))[:, None]
mix /= max(1e-9, np.abs(mix).max()) / .95
wavfile.write('narrated_mix.wav', SR, (mix * 32767).astype(np.int16)); print('mixed', T, 's')
