"""Football reel mix: narration segments + dialogue placed on the edit, synth groove ducked under voices, SFX on the hits."""
import subprocess, numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt
from timeline import SEGS, DIALOG, TOTAL
SR = 44100; N = int(TOTAL * SR)
def load(n, ext='mp3'):
    raw = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', f'sfx/{n}.{ext}', '-f', 's16le', '-ac', '2', '-ar', str(SR), '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.int16).reshape(-1, 2).astype(np.float32) / 32768
def add(buf, x, t, g):
    i = int(t * SR); j = min(N, i + len(x)); buf[i:j] += x[: j - i] * g
fx = np.zeros((N, 2), np.float32); vo = np.zeros((N, 2), np.float32)
nar = load('narration')
for a, b, at, _ in SEGS:
    piece = nar[int(a * SR):int(b * SR)].copy(); f = int(.01 * SR); piece[:f] *= np.linspace(0, 1, f)[:, None]; piece[-f:] *= np.linspace(1, 0, f)[:, None]
    add(vo, piece, at, 1.0)
for who, at, _ in DIALOG: add(vo, load(who), at, 1.1)
# soften the voices: roll off harsh highs and tame peaks so they sit gently on the music
vo = sosfilt(butter(2, 4200, 'lowpass', fs=SR, output='sos'), vo, axis=0).astype(np.float32)
vo = np.tanh(vo * 1.6) / 1.6
EV = [('ring', .1, .5), ('whoosh', 4.1, .4), ('stamp', 7.6, .8), ('kaching', 7.7, .5), ('whoosh', 9.1, .4), ('twinkle', 10.4, .5),
      ('whoosh', 11.9, .4), ('pay', 13.0, .6), ('notif', 13.4, .7), ('whoosh', 15.1, .4), ('ring', 15.3, .5), ('stamp', 16.4, .9),
      ('whoosh', 17.6, .4), ('whistle', 18.0, .25), ('whoosh', 21.4, .5), ('twinkle', 22.5, .6), ('whoosh', 23.0, .4),
      ('whistle', 23.9, .8), ('cheer', 24.6, .9), ('cheer', 27.6, .6),
      ('whoosh', 30.5, .4), ('twinkle', 31.5, .6), ('twinkle', 32.4, .5)]
for n, t, g in EV: add(fx, load(n), t, g * .75)
env = np.abs(vo).mean(1); k = int(.2 * SR); c = np.concatenate([[0], np.cumsum(env)])
idx = np.arange(N); env = (c[np.minimum(idx + k // 2, N)] - c[np.maximum(idx - k // 2, 0)]) / k
speak = np.clip(env / (env.max() * .25), 0, 1)
m = load('music', 'wav'); m = np.pad(m, ((0, max(0, N - len(m))), (0, 0)))[:N]
out = fx * (1 - .1 * speak[:, None]) + m * .75 * (1 - .25 * speak)[:, None] + vo * .8
out[-int(.5 * SR):] *= np.linspace(1, 0, int(.5 * SR))[:, None]
out /= max(1e-9, np.abs(out).max()) / .95
vr = np.sqrt((vo[speak > .5] ** 2).mean()) * .8; mr = np.sqrt((m ** 2).mean()) * .75; print('voice/music dB', round(20 * np.log10(vr / mr), 1))
wavfile.write('mix.wav', SR, (out * 32767).astype(np.int16)); print('mixed', TOTAL)
