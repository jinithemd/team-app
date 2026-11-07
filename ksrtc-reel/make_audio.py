"""Builds the sound track for the KSRTC reel from shots.json: a beat that builds tension,
cuts to silence at the cliff, then turns happy for the rescue; plus horns, engine, screeches."""
import json, numpy as np
from scipy.signal import butter, sosfilt
from scipy.io import wavfile

SR = 44100
shots = json.load(open('shots.json'))
T = shots[-1]['start'] + shots[-1]['d'] + 0.5
N = int(T * SR)
out = np.zeros((N, 2))
rng = np.random.default_rng(7)

def bp(x, lo, hi): return sosfilt(butter(2, [lo, hi], 'bandpass', fs=SR, output='sos'), x)
def lp(x, f): return sosfilt(butter(2, f, 'lowpass', fs=SR, output='sos'), x)
def hp(x, f): return sosfilt(butter(2, f, 'highpass', fs=SR, output='sos'), x)
def env(n, a=0.005, r=0.1):
    e = np.ones(n); na = max(1, int(a * SR)); nr = max(1, int(r * SR))
    e[:na] = np.linspace(0, 1, na); e[-nr:] *= np.linspace(1, 0, nr); return e
def add(sig, t, gain=1.0, pan=0.0):
    i = int(t * SR); j = min(N, i + len(sig))
    if i >= N or j <= i: return
    s = sig[: j - i] * gain
    out[i:j, 0] += s * (1 - max(0, pan)); out[i:j, 1] += s * (1 + min(0, pan))
def tone(f, dur, kind='sine'):
    t = np.arange(int(dur * SR)) / SR; ph = 2 * np.pi * np.cumsum(np.broadcast_to(f, t.shape)) / SR if np.ndim(f) else 2 * np.pi * f * t
    if kind == 'sine': return np.sin(ph)
    if kind == 'square': return np.sign(np.sin(ph))
    if kind == 'saw': return 2 * ((ph / (2 * np.pi)) % 1) - 1
def noise(dur): return rng.standard_normal(int(dur * SR))

# ---------- sound effects ----------
def horn_car(): x = (tone(440, .22, 'square') + tone(554, .22, 'square')) * .5; return lp(x, 3000) * env(len(x), .005, .03)
def horn_long(): x = (tone(440, .9, 'square') + tone(554, .9, 'square')) * .5; return lp(x, 3000) * env(len(x), .01, .05)
def horn_bus(): x = (tone(196, .7, 'saw') + tone(247, .7, 'saw') + tone(294, .7, 'saw')) / 3; return lp(x, 2200) * env(len(x), .02, .1)
def horn_lorry(): x = (tone(123, 1.1, 'saw') + tone(155, 1.1, 'saw')) / 2; return lp(x, 1500) * env(len(x), .03, .15)
def rev():
    d = .9; t = np.arange(int(d * SR)) / SR; f = 70 + 160 * (t / d) ** .7
    x = tone(f, d, 'saw') + .5 * tone(f * 2, d, 'saw'); return lp(x, 1200) * env(len(x), .02, .2) * .8
def screech(d=1.0):
    x = bp(noise(d), 2500, 4200) * (0.6 + 0.4 * np.sin(2 * np.pi * 23 * np.arange(int(d * SR)) / SR))
    return x * env(len(x), .02, .25) * 2.5
def squeak(): return screech(.45) * .7
def airbrake(): x = hp(noise(.7), 2500) * np.exp(-np.arange(int(.7 * SR)) / SR * 5); return x * 1.4
def whoosh():
    d = .6; x = noise(d); t = np.arange(len(x)) / SR
    y = np.concatenate([bp(x[i:i + 2205], 300 + 3000 * (i / len(x)), 700 + 3200 * (i / len(x))) for i in range(0, len(x), 2205)])[:len(x)]
    return y * np.sin(np.pi * t / d) ** 2 * 2
def thud(): t = np.arange(int(.35 * SR)) / SR; return np.sin(2 * np.pi * (90 - 50 * t) * t) * np.exp(-t * 14) * 1.2
def heart():
    t = np.arange(int(.5 * SR)) / SR; b = lambda o: np.where(t > o, np.sin(2 * np.pi * 55 * (t - o)) * np.exp(-(t - o) * 18), 0)
    return (b(0) + .7 * b(.18)) * 1.6
def creak(): t = np.arange(int(1.2 * SR)) / SR; return lp(tone(280 + 60 * np.sin(2 * np.pi * 3 * t), 1.2, 'saw'), 1400) * env(int(1.2 * SR), .1, .3) * .35
def heave(): return lp(noise(.4), 800) * env(int(.4 * SR), .05, .2) * 1.2 + tone(180, .4) * env(int(.4 * SR), .02, .3) * .2
def pop_s(): t = np.arange(int(.25 * SR)) / SR; return np.sin(2 * np.pi * (300 + 900 * t) * t) * np.exp(-t * 18)
def ding(): t = np.arange(int(1.2 * SR)) / SR; return (np.sin(2 * np.pi * 1318 * t) + .5 * np.sin(2 * np.pi * 1976 * t)) * np.exp(-t * 3) * .5
def engine_bus(): t = np.arange(int(2.5 * SR)) / SR; return lp(tone(48 + 4 * np.sin(2 * np.pi * .7 * t), 2.5, 'saw'), 300) * env(int(2.5 * SR), .3, .6) * .5
FX = {'horn_car': horn_car, 'horn_long': horn_long, 'horn_bus': horn_bus, 'horn_lorry': horn_lorry, 'rev': rev,
      'screech': screech, 'screech_long': lambda: screech(2.2), 'squeak': squeak, 'airbrake': airbrake, 'whoosh': whoosh,
      'thud': thud, 'heart': heart, 'creak': creak, 'heave': heave, 'pop': pop_s, 'ding': ding, 'engine_bus_on': engine_bus}
GAIN = {'horn_car': .5, 'horn_long': .45, 'horn_bus': .6, 'horn_lorry': .7, 'rev': .5, 'screech': .5, 'screech_long': .55, 'squeak': .5,
        'airbrake': .5, 'whoosh': .45, 'thud': .8, 'heart': .9, 'creak': .6, 'heave': .7, 'pop': .5, 'ding': .6, 'engine_bus_on': .5}

for s in shots:
    for tt, name in s['sfx']:
        add(FX[name](), s['start'] + tt, GAIN[name], pan=(rng.random() - .5) * .4)
    # a soft whoosh on every cut keeps the pace audible
    if s['start'] > 0: add(whoosh()[: int(.25 * SR)], s['start'] - .12, .12)

# ---------- music ----------
start_of = lambda typ, phase=None: next(s['start'] for s in shots if s['type'] == typ and (phase is None or s['p'].get('phase') == phase))
t_skid, t_rescue = start_of('cliff', 'skid'), start_of('cliff', 'rescue')
bpm = 112; beat = 60 / bpm
def kick(): t = np.arange(int(.3 * SR)) / SR; return np.sin(2 * np.pi * (110 * np.exp(-t * 18) + 45) * t) * np.exp(-t * 9)
def hat(): return hp(noise(.05), 7000) * np.exp(-np.arange(int(.05 * SR)) / SR * 80) * .5
def snare(): x = bp(noise(.2), 1500, 5000) * np.exp(-np.arange(int(.2 * SR)) / SR * 20); return x + tone(190, .2) * np.exp(-np.arange(int(.2 * SR)) / SR * 25) * .5
tense_notes = [55.0, 55.0, 65.41, 55.0, 49.0, 55.0, 61.74, 58.27]   # A minor-ish bass line
t = 0.0; k = 0
while t < t_skid - .05:
    lvl = .55 if t < 10 else .8 if t < 28 else 1.0
    add(kick(), t, .9 * lvl)
    if k % 2 == 1: add(snare(), t, .35 * lvl)
    for h in range(2 if t < 10 else 4): add(hat(), t + h * beat / (2 if t < 10 else 4), .25 * lvl)
    n = tense_notes[k % 8] * (1 if t < 28 else 1.0)
    b = lp(tone(n, beat * .9, 'saw'), 600) * env(int(beat * .9 * SR), .01, .1); add(b, t, .35 * lvl)
    if t >= 18:   # rising string pad
        d = beat; f = 220 * 2 ** ((t - 18) / 24 / 1.2); pad = lp(tone(f, d, 'saw') + tone(f * 1.5, d, 'saw'), 1800) * env(int(d * SR), .05, .05); add(pad, t, .06 * lvl, pan=.3)
    t += beat; k += 1
# happy rescue / ending groove: bright major arpeggio
happy = [261.63, 329.63, 392.0, 523.25, 392.0, 329.63, 293.66, 349.23, 440.0, 587.33, 440.0, 349.23]
t = t_rescue + .3; k = 0
while t < T - .6:
    n = happy[k % len(happy)]; x = (tone(n, .22) + .3 * tone(n * 2, .22)) * np.exp(-np.arange(int(.22 * SR)) / SR * 9)
    add(x, t, .22, pan=.2 if k % 2 else -.2)
    if k % 4 == 0: add(kick(), t, .6)
    if k % 4 == 2: add(snare(), t, .25)
    t += beat / 2; k += 1

# soft fade at the very end
out[-int(.8 * SR):] *= np.linspace(1, 0, int(.8 * SR))[:, None]
out /= max(1e-9, np.abs(out).max()) / 0.9
wavfile.write('soundtrack.wav', SR, (out * 32767).astype(np.int16))
print('soundtrack', round(T, 2), 's; skid at', t_skid, 'rescue at', t_rescue)
