// 给宣传片合成配乐和音效（纯代码，不用任何音频素材）：node scripts/promo-audio.mjs sfx.json out.wav
import { readFileSync, writeFileSync } from 'node:fs';

const [, , inFile, outFile] = process.argv;
const { duration, sfx, cuts } = JSON.parse(readFileSync(inFile, 'utf8'));
const SR = 44100;
const N = Math.ceil((duration + 0.5) * SR);
const L = new Float32Array(N);
const R = new Float32Array(N);
const wetL = new Float32Array(N);
const wetR = new Float32Array(N);
const TAU = Math.PI * 2;
const midi = (m) => 440 * 2 ** ((m - 69) / 12);
let seed = 12345;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

// 把一段声音加进总线。fn(t, i) 返回采样；pan -1..1；send 送去混响的量
function add(start, length, fn, { gain = 1, pan = 0, send = 0.15 } = {}) {
  const s0 = Math.max(0, Math.round(start * SR));
  const len = Math.min(N - s0, Math.round(length * SR));
  const gl = gain * Math.cos(((pan + 1) * Math.PI) / 4);
  const gr = gain * Math.sin(((pan + 1) * Math.PI) / 4);
  for (let i = 0; i < len; i++) {
    const v = fn(i / SR, i);
    L[s0 + i] += v * gl; R[s0 + i] += v * gr;
    wetL[s0 + i] += v * gl * send; wetR[s0 + i] += v * gr * send;
  }
}
const env = (t, a, d) => (t < a ? t / a : Math.exp(-(t - a) / d));

// 乐器
const mallet = (start, note, gain = 0.2, pan = 0) => { const f = midi(note); add(start, 1.4, (t) => (Math.sin(TAU * f * t) + 0.45 * Math.sin(TAU * f * 4 * t) * Math.exp(-t * 18) + 0.2 * Math.sin(TAU * f * 2 * t) * Math.exp(-t * 6)) * env(t, 0.004, 0.28), { gain, pan, send: 0.3 }); };
const bell = (start, note, gain = 0.12, pan = 0) => { const f = midi(note); add(start, 2.2, (t) => (Math.sin(TAU * f * t) + 0.5 * Math.sin(TAU * f * 2.76 * t) * Math.exp(-t * 5) + 0.25 * Math.sin(TAU * f * 5.4 * t) * Math.exp(-t * 9)) * env(t, 0.002, 0.55), { gain, pan, send: 0.5 }); };
const bass = (start, note, len = 0.42, gain = 0.3) => { const f = midi(note); add(start, len + 0.1, (t) => (Math.sin(TAU * f * t) + 0.3 * Math.sin(TAU * f * 2 * t)) * Math.min(1, t / 0.01) * (t > len ? Math.max(0, 1 - (t - len) / 0.1) : 1) * Math.exp(-t * 2.2), { gain, send: 0.02 }); };
const pad = (start, notes, len, gain = 0.045) => { for (const [k, n] of notes.entries()) { const f = midi(n); add(start, len + 0.6, (t) => (Math.sin(TAU * f * t) + 0.3 * Math.sin(TAU * f * 2 * t + 1) + 0.15 * Math.sin(TAU * f * 3 * t)) * Math.min(1, t / 0.35) * (t > len ? Math.max(0, 1 - (t - len) / 0.6) : 1) * (1 + 0.12 * Math.sin(TAU * 4.5 * t)), { gain, pan: (k - 1) * 0.5, send: 0.4 }); } };
// 拨弦（Karplus-Strong），像尤克里里
function pluck(start, note, gain = 0.16, pan = 0, decay = 0.994) {
  const period = Math.round(SR / midi(note));
  const line = new Float32Array(period);
  for (let i = 0; i < period; i++) line[i] = (rnd() * 2 - 1) * (i < period / 2 ? 1 : 0.6);
  let idx = 0; let prev = 0;
  add(start, 1.1, () => { const v = line[idx]; const out = (v + prev) * 0.5 * decay; prev = v; line[idx] = out; idx = (idx + 1) % period; return out; }, { gain, pan, send: 0.2 });
}
const strum = (start, notes, gain = 0.1) => notes.forEach((n, k) => pluck(start + k * 0.014, n, gain, (k - 1.5) * 0.3));
const kick = (start, gain = 0.5) => add(start, 0.25, (t) => Math.sin(TAU * (48 * t + (70 / 28) * (1 - Math.exp(-t * 28)))) * Math.exp(-t * 14), { gain, send: 0.02 });
function noise(start, len, gain, { hp = 0, lp = 1, shape = (t) => Math.exp(-t * 30), pan = 0, send = 0.15, sweep = null } = {}) {
  let low = 0; let low2 = 0;
  add(start, len, (t) => { const x = rnd() * 2 - 1; const c = sweep ? sweep(t) : lp; low += c * (x - low); low2 += hp * (low - low2); return (low - (hp ? low2 : 0)) * shape(t); }, { gain, pan, send });
}
const shaker = (start, gain = 0.05) => noise(start, 0.07, gain, { lp: 0.9, hp: 0.5, shape: (t) => env(t, 0.004, 0.02), pan: 0.3 });
const snap = (start, gain = 0.12) => { noise(start, 0.12, gain, { lp: 0.5, hp: 0.25, shape: (t) => env(t, 0.001, 0.035), pan: -0.2, send: 0.3 }); };
const tone = (start, freq, len, gain = 0.1, { type = 'sine', pan = 0, send = 0.25, to = null } = {}) => add(start, len + 0.05, (t) => {
  const f = to ? freq + (to - freq) * Math.min(1, t / len) : freq;
  const ph = to ? TAU * (freq * t + ((to - freq) * Math.min(t, len) ** 2) / (2 * len)) : TAU * f * t;
  const w = type === 'tri' ? (2 / Math.PI) * Math.asin(Math.sin(ph)) : Math.sin(ph);
  return w * Math.min(1, t / 0.006) * Math.exp(-t * (4 / len));
}, { gain, pan, send });

// ---------- 配乐：120 BPM，C 大调，I–vi–IV–V ----------
const BEAT = 0.5;
const BAR = 2;
const CHORDS = [
  { root: 36, tones: [60, 64, 67, 72] }, // C
  { root: 33, tones: [57, 60, 64, 69] }, // Am
  { root: 29, tones: [57, 60, 65, 69] }, // F
  { root: 31, tones: [59, 62, 67, 71] }, // G
];
// 旋律（八分音符，0 = 休止），五声音阶，四小节一句
const TUNE_A = [76, 0, 79, 76, 72, 0, 74, 76, 81, 0, 79, 76, 72, 0, 0, 0, 77, 0, 81, 77, 72, 0, 74, 77, 79, 0, 74, 79, 83, 0, 79, 0];
const TUNE_B = [84, 0, 79, 81, 79, 0, 76, 0, 81, 0, 84, 81, 76, 0, 72, 0, 77, 0, 81, 84, 81, 0, 77, 0, 79, 83, 86, 0, 83, 0, 79, 0];
const TUNE_C = [72, 76, 79, 84, 79, 76, 79, 0, 72, 76, 81, 84, 81, 76, 81, 0, 72, 77, 81, 84, 81, 77, 81, 0, 74, 79, 83, 86, 83, 79, 86, 0];
const bars = Math.ceil(duration / BAR);
const section = (t) => (t < cuts.play ? 'intro' : t < cuts.mech ? 'a' : t < cuts.tools ? 'b' : t < cuts.friends ? 'c' : t < cuts.more ? 'a' : t < cuts.end ? 'b' : 'end');
for (let b = 0; b < bars; b++) {
  const t = b * BAR;
  if (t >= duration - 0.2) break;
  const ch = CHORDS[b % 4];
  const sec = section(t + 0.01);
  const last = t + BAR >= duration - 1.2;
  pad(t, ch.tones.slice(0, 3), BAR, sec === 'intro' ? 0.06 : 0.04);
  if (last) { strum(t, [48, 55, 60, 64, 67, 72], 0.14); [72, 76, 79, 84, 88].forEach((n, k) => bell(t + k * 0.12, n, 0.1, (k - 2) * 0.3)); bass(t, 36, 1.6, 0.3); kick(t, 0.4); break; }
  const tune = sec === 'intro' ? TUNE_A : sec === 'b' ? TUNE_B : sec === 'c' ? TUNE_C : sec === 'end' ? TUNE_B : TUNE_A;
  for (let e = 0; e < 8; e++) {
    const te = t + e * BEAT / 2 + (e % 2 ? 0.018 : 0); // 一点点摇摆
    const note = tune[(b % 4) * 8 + e];
    if (note) { if (sec === 'intro') bell(te, note, 0.085, 0.2); else { mallet(te, note, 0.17, 0.15); if (sec === 'c' || sec === 'end') bell(te, note + 12, 0.03, -0.3); } }
    if (sec !== 'intro') shaker(te, e % 2 ? 0.055 : 0.03);
  }
  if (sec === 'intro') { if (b > 0) { pluck(t, ch.tones[0], 0.1, -0.3); pluck(t + BEAT, ch.tones[2], 0.08, 0.3); pluck(t + BEAT * 2, ch.tones[1], 0.08, -0.1); pluck(t + BEAT * 3, ch.tones[2], 0.08, 0.3); } bass(t, ch.root + 12, 1.2, 0.16); continue; }
  kick(t, 0.5); kick(t + BEAT * 2, 0.42); if (b % 2) kick(t + BEAT * 3.5, 0.25);
  snap(t + BEAT, 0.1); snap(t + BEAT * 3, 0.12);
  bass(t, ch.root, 0.4); bass(t + BEAT * 1.5, ch.root + 7, 0.22, 0.2); bass(t + BEAT * 2, ch.root, 0.4, 0.26); bass(t + BEAT * 3, ch.root + (b % 4 === 3 ? 2 : 7), 0.3, 0.2);
  strum(t + BEAT * 0.5, ch.tones, 0.075); strum(t + BEAT * 1.5, ch.tones, 0.095); strum(t + BEAT * 2.5, ch.tones, 0.075); strum(t + BEAT * 3.5, ch.tones.slice().reverse(), 0.095);
}

// ---------- 音效 ----------
const FX = {
  step: (t) => tone(t, 620, 0.05, 0.035, { type: 'tri', send: 0.05 }),
  slide: (t) => noise(t, 0.4, 0.06, { sweep: (x) => 0.15 + 0.6 * Math.min(1, x / 0.3), hp: 0.3, shape: (x) => Math.sin(Math.PI * Math.min(1, x / 0.4)) }),
  pickup: (t) => { tone(t, 660, 0.12, 0.09); tone(t + 0.08, 990, 0.18, 0.09); },
  deliver: (t) => { tone(t, 523, 0.18, 0.1); tone(t + 0.1, 659, 0.18, 0.1); tone(t + 0.2, 784, 0.34, 0.11); bell(t + 0.2, 91, 0.05); },
  open: (t) => { tone(t, 440, 0.1, 0.09); tone(t + 0.07, 587, 0.1, 0.09); tone(t + 0.14, 880, 0.22, 0.09); },
  splash: (t) => { noise(t, 0.45, 0.16, { lp: 0.25, shape: (x) => env(x, 0.01, 0.12) }); tone(t, 500, 0.25, 0.07, { to: 180 }); },
  portal: (t) => [67, 72, 76, 79, 84, 88].forEach((n, k) => bell(t + k * 0.055, n, 0.06, (k - 2.5) * 0.25)),
  star: (t) => [84, 88, 91].forEach((n, k) => bell(t + k * 0.08, n, 0.06)),
  tool: (t) => { tone(t, 880, 0.1, 0.08, { type: 'tri' }); tone(t + 0.07, 1175, 0.1, 0.08, { type: 'tri' }); tone(t + 0.14, 1480, 0.26, 0.08, { type: 'tri' }); },
  pop: (t) => tone(t, 520, 0.09, 0.08, { to: 980, send: 0.15 }),
  tick: (t) => tone(t, 1250, 0.04, 0.045, { type: 'tri', send: 0.1 }),
  thud: (t) => { tone(t, 150, 0.16, 0.2, { to: 70, send: 0.05 }); noise(t, 0.06, 0.05, { lp: 0.2 }); },
  jump: (t) => tone(t, 320, 0.3, 0.09, { to: 820 }),
  chime: (t) => [84, 91, 96].forEach((n, k) => bell(t + k * 0.07, n, 0.07, (k - 1) * 0.4)),
  whoosh: (t) => noise(t, 0.75, 0.2, { sweep: (x) => 0.04 + 0.5 * Math.sin(Math.PI * Math.min(1, x / 0.7)) ** 2, hp: 0.05, shape: (x) => Math.sin(Math.PI * Math.min(1, x / 0.75)) ** 1.5, send: 0.3 }),
  swap: (t) => noise(t, 0.3, 0.09, { sweep: (x) => 0.08 + 0.5 * Math.min(1, x / 0.25), hp: 0.1, shape: (x) => Math.sin(Math.PI * Math.min(1, x / 0.3)) }),
  win: (t) => [72, 76, 79, 84, 79, 84, 88].forEach((n, k) => { bell(t + k * 0.1, n, 0.085, (k - 3) * 0.2); mallet(t + k * 0.1, n - 12, 0.09); }),
};
for (const { t, name } of sfx) FX[name]?.(t);

// ---------- 混响（几条反馈延迟）+ 淡出 + 归一化 ----------
function reverb(buf, taps) {
  const out = new Float32Array(N);
  for (const [delay, fb] of taps) {
    const d = Math.round(delay * SR);
    const line = new Float32Array(N);
    let lp = 0;
    for (let i = 0; i < N; i++) { const echo = i >= d ? line[i - d] : 0; lp += 0.45 * (echo - lp); line[i] = buf[i] + lp * fb; out[i] += lp; }
  }
  return out;
}
const revL = reverb(wetL, [[0.0437, 0.72], [0.0611, 0.68], [0.0893, 0.62], [0.25, 0.3]]);
const revR = reverb(wetR, [[0.0471, 0.72], [0.0673, 0.68], [0.0837, 0.62], [0.375, 0.28]]);
let peak = 0;
for (let i = 0; i < N; i++) {
  const t = i / SR;
  const fade = Math.min(1, t / 0.05) * Math.min(1, Math.max(0, (duration - t) / 1.1));
  L[i] = Math.tanh((L[i] + revL[i] * 0.5) * 1.5) * fade;
  R[i] = Math.tanh((R[i] + revR[i] * 0.5) * 1.5) * fade;
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
}
const norm = 0.92 / (peak || 1);
const pcm = Buffer.alloc(44 + N * 4);
pcm.write('RIFF', 0); pcm.writeUInt32LE(36 + N * 4, 4); pcm.write('WAVEfmt ', 8); pcm.writeUInt32LE(16, 16); pcm.writeUInt16LE(1, 20); pcm.writeUInt16LE(2, 22);
pcm.writeUInt32LE(SR, 24); pcm.writeUInt32LE(SR * 4, 28); pcm.writeUInt16LE(4, 32); pcm.writeUInt16LE(16, 34); pcm.write('data', 36); pcm.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) { pcm.writeInt16LE(Math.round(L[i] * norm * 32767), 44 + i * 4); pcm.writeInt16LE(Math.round(R[i] * norm * 32767), 46 + i * 4); }
writeFileSync(outFile, pcm);
console.log(`配乐：${outFile}（${duration}s，${sfx.length} 个音效）`);
