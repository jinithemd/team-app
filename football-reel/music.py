"""Synthesises a fun chenda-and-funk groove (120 BPM) for the football reel: build, a sneaky drop for the gag, big finish."""
import numpy as np
from scipy.signal import butter, sosfilt
from scipy.io import wavfile
SR = 44100; T = 41.0; N = int(T * SR); rng = np.random.default_rng(3)
out = np.zeros((N, 2), np.float32)
def lp(x, f): return sosfilt(butter(2, f, 'lowpass', fs=SR, output='sos'), x)
def bp(x, a, b): return sosfilt(butter(2, [a, b], 'bandpass', fs=SR, output='sos'), x)
def add(x, t, g, pan=0.):
    i = int(t * SR); j = min(N, i + len(x))
    if i >= N or j <= i: return
    s = x[: j - i] * g; out[i:j, 0] += s * (1 - max(0, pan)); out[i:j, 1] += s * (1 + min(0, pan))
def ts(d): return np.arange(int(d * SR)) / SR
def kick(): t = ts(.3); return np.sin(2 * np.pi * (120 * np.exp(-t * 20) + 48) * t) * np.exp(-t * 8)
def clap(): t = ts(.18); return bp(rng.standard_normal(len(t)), 900, 4000) * (np.exp(-t * 30) + .5 * np.exp(-np.maximum(t - .012, 0) * 30) * (t > .012))
def chenda(f=220, d=.16): t = ts(d); return (np.sin(2 * np.pi * f * t * (1 + .3 * np.exp(-t * 40))) * .7 + bp(rng.standard_normal(len(t)), 1500, 6000) * .5) * np.exp(-t * 28)
def hat(): t = ts(.05); return bp(rng.standard_normal(len(t)), 6000, 12000) * np.exp(-t * 90) * .5
def bass(f, d): t = ts(d); x = 2 * ((f * t) % 1) - 1; return lp(x, 500) * np.minimum(1, t * 200) * np.exp(-t * 3)
def pluck(f, d=.22): t = ts(d); return (np.sign(np.sin(2 * np.pi * f * t)) * .5 + np.sin(4 * np.pi * f * t) * .3) * np.exp(-t * 12)
beat = .5; bars = int(T / (4 * beat)) + 1
BASS = [65.41, 65.41, 77.78, 87.31, 98.0, 87.31, 77.78, 58.27]   # C minor pentatonic-ish walk
HOOK = [523.25, 0, 622.25, 698.46, 0, 783.99, 698.46, 622.25, 523.25, 0, 466.16, 523.25, 0, 0, 392.0, 0]
for b in range(bars):
    for s in range(16):   # 16th-note grid
        t = b * 2 + s * beat / 4
        if t >= T - .2: break
        gag = 24.5 <= t < 30.55            # sneaky section: no kick/clap, staccato bass only
        final = t >= 30.55
        lvl = .6 if t < 4 else .85 if t < 21.5 else 1.0
        if 24.2 <= t < 24.6: continue      # tiny silence before the whistle
        if s % 4 == 0 and not gag: add(kick(), t, .9 * lvl)
        if s in (4, 12) and not gag: add(clap(), t, .45 * lvl, .1)
        if s % 2 == 0: add(hat(), t, (.25 if not gag else .15) * lvl, -.3)
        if not gag and (s in (3, 6, 10, 11, 14) or (final and s % 2 == 1)): add(chenda(260 if s % 3 else 200), t, .35 * lvl, .25)
        if s % 2 == 0:
            f = BASS[(b * 8 + s // 2) % 8]
            add(bass(f, beat / 2 * (0.5 if gag else .95)), t, .55 * lvl)
        if t >= 4 and not gag and HOOK[s] and (b % 2 == 0 or final): add(pluck(HOOK[s] * (1.0 if not final else 1.0)), t, .14 * lvl, -.15)
        if gag and s in (0, 6, 10): add(pluck(BASS[s % 8] * 4, .15), t, .12, .2)
# chenda roll into the final section and a big hit on the win
for k in range(16): add(chenda(240 + 10 * k, .12), 29.75 + k * .05, .25 + .03 * k, .2)
add(kick(), 30.6, 1.3); add(clap(), 30.6, .8)
out[int((T - 1.5) * SR):] *= np.linspace(1, 0, N - int((T - 1.5) * SR))[:, None]
out /= np.abs(out).max() / .9
wavfile.write('sfx/music.wav', SR, (out * 32767).astype(np.int16)); print('music', T)
