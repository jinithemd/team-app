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
 ('laugh', 18.4, .95, None, .3), ('engine', 19.6, .55, None, 0),
 ('pedalfail', 21.8, 1.0, None, .3), ('boom', 22.9, .9, None, 0), ('heartbeat', 23.0, .9, None, 0),
 ('heartbeat', 25.3, .75, None, 0), ('engine', 25.4, .55, None, 0),
 ('engine', 27.8, .7, None, 0), ('screech', 28.4, .8, None, 0), ('screech', 30.6, .7, None, 0),
 ('gear', 33.4, .95, None, .2),
 ('engine', 36.9, .5, None, 0), ('bushorn', 37.0, .9, None, .2), ('bump', 37.8, 1.0, None, .3), ('boom', 37.8, .6, None, 0), ('grind', 38.3, .9, None, .2),
 ('heartbeat', 43.0, .8, None, 0), ('pebble', 44.0, .9, None, .3), ('cheer', 45.8, 1.0, None, .3),
 ('bushorn', 51.4, .8, None, 0),
 ('whoosh', 52.7, .6, None, 0), ('boom', 52.8, .5, None, 0),
]
for e in EVENTS: add(*e)
m = load('music'); m = np.pad(m, ((0, max(0, N - len(m))), (0, 0)))[:N]
# smooth the duck envelope
k = int(.08 * SR); d = np.convolve(duck, np.ones(k) / k, 'same')
mix = out + m * .62 * d[:, None]
mix[-int(1.0 * SR):] *= np.linspace(1, 0, int(1.0 * SR))[:, None]
mix /= max(1e-9, np.abs(mix).max()) / .95
wavfile.write('final_mix.wav', SR, (mix * 32767).astype(np.int16)); print('mixed', T, 's')
