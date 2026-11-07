"""Gimli reel mix: narration + reused thriller score (offset so the heroic part lands on the rescue) + SFX."""
import subprocess, numpy as np
from scipy.io import wavfile
SR = 44100; T = 58.5; N = int(T * SR)
def load(n):
    raw = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', f'sfx/{n}.mp3', '-f', 's16le', '-ac', '2', '-ar', str(SR), '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.int16).reshape(-1, 2).astype(np.float32) / 32768
out = np.zeros((N, 2), np.float32)
def add(x, t, g):
    i = int(t * SR); j = min(N, i + len(x)); out[i:j] += x[: j - i] * g
EV = [('alarm', .3, .6), ('alarm', 2.3, .5), ('enginesdie', 3.5, .8), ('ksrtc_boom', 3.84, .6),
      ('ksrtc_gasp', 5.2, .5), ('ksrtc_heartbeat', 6.5, .5), ('ksrtc_whoosh', 7.6, .4),
      ('chime', 11.3, .5), ('alarm', 14.8, .5), ('enginesdie', 15.6, .5), ('wind', 15.8, .7), ('wind', 21.8, .5),
      ('ksrtc_heartbeat', 22.4, .6), ('ksrtc_whoosh', 25.3, .4), ('ksrtc_whoosh', 28.4, .5),
      ('racecars', 30.5, .7), ('crowdscream', 33.4, .8), ('wind', 35.8, .5), ('ksrtc_heartbeat', 36.5, .6),
      ('touchdown', 39.6, .9), ('ksrtc_grind', 40.6, .9), ('ksrtc_boom', 40.8, .7), ('ksrtc_cheer', 44.7, .9),
      ('ksrtc_whoosh', 48.9, .4), ('ksrtc_boom', 50.9, .4), ('ksrtc_whoosh', 52.7, .4)]
for n, t, g in EV: add(load(n), t, g * .8)
m = load('ksrtc_music')[int(4.4 * SR):]; m = np.pad(m, ((0, max(0, N - len(m))), (0, 0)))[:N]
fade = np.ones(N, np.float32); k = int(55.0 * SR); fade[k:] = np.linspace(1, 0, N - k)
out += m * .42 * fade[:, None]
add(load('narration'), 0.0, 1.0)
out[-int(.8 * SR):] *= np.linspace(1, 0, int(.8 * SR))[:, None]
out /= max(1e-9, np.abs(out).max()) / .95
wavfile.write('mix.wav', SR, (out * 32767).astype(np.int16)); print('mixed')
