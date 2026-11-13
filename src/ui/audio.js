// 柔和的合成音效（不加载任何音频文件）。音量默认较低，可在设置里关闭。
export function createAudio(getSettings) {
  let ctx = null;
  const ensure = () => {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  };
  function tone(freq, start, length, { type = 'sine', gain = 0.12 } = {}) {
    const c = ensure();
    const volume = getSettings().volume ?? 0.6;
    const osc = c.createOscillator();
    const amp = c.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    const t = c.currentTime + start;
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(gain * volume, t + 0.015);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + length);
    osc.connect(amp).connect(c.destination);
    osc.start(t);
    osc.stop(t + length + 0.05);
  }
  const sounds = {
    step: () => tone(520, 0, 0.06, { type: 'triangle', gain: 0.035 }),
    bump: () => tone(180, 0, 0.09, { type: 'sine', gain: 0.07 }),
    pickup: () => { tone(660, 0, 0.12); tone(990, 0.08, 0.16); },
    deliver: () => { tone(523, 0, 0.18); tone(659, 0.1, 0.18); tone(784, 0.2, 0.3); },
    wrong: () => { tone(392, 0, 0.14, { gain: 0.07 }); tone(349, 0.12, 0.18, { gain: 0.07 }); },
    open: () => { tone(440, 0, 0.1); tone(587, 0.07, 0.1); tone(880, 0.14, 0.2); },
    star: () => { tone(1046, 0, 0.12, { gain: 0.08 }); tone(1318, 0.08, 0.12, { gain: 0.08 }); tone(1568, 0.16, 0.22, { gain: 0.08 }); },
    win: () => [523, 659, 784, 1046, 784, 1046].forEach((f, i) => tone(f, i * 0.12, 0.3, { gain: 0.1 })),
    tap: () => tone(760, 0, 0.05, { type: 'triangle', gain: 0.05 }),
    portal: () => [392, 523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.05, 0.22, { gain: 0.06 })),
    chest: () => { tone(587, 0, 0.12); tone(784, 0.09, 0.12); tone(1175, 0.18, 0.3); },
    tool: () => { tone(880, 0, 0.1, { type: 'triangle' }); tone(1175, 0.07, 0.1, { type: 'triangle' }); tone(1480, 0.14, 0.24, { type: 'triangle' }); },
    sticker: () => [659, 784, 988, 1318].forEach((f, i) => tone(f, i * 0.09, 0.26, { gain: 0.09 })),
  };

  // 背景音乐：很轻的五声音阶小旋律，默认关闭，可在设置里打开。
  const SCALE = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25];
  const TUNE = [0, 2, 4, 2, 3, 4, 5, -1, 4, 3, 2, 0, 1, 2, 0, -1, 2, 4, 5, 4, 7, 5, 4, -1, 3, 2, 1, 2, 0, -1, -1, -1];
  let musicTimer = null;
  let beat = 0;
  function tick() {
    const note = TUNE[beat % TUNE.length];
    if (note >= 0) tone(SCALE[note], 0, 0.9, { gain: 0.028 });
    if (beat % 4 === 0) tone(SCALE[[0, 3, 4, 3][Math.floor(beat / 4) % 4]] / 2, 0, 1.6, { gain: 0.03 });
    beat++;
  }
  function syncMusic() {
    const on = Boolean(getSettings().music && getSettings().sound);
    if (on && !musicTimer) { try { ensure(); musicTimer = setInterval(() => { try { tick(); } catch { /* 忽略 */ } }, 420); } catch { /* 还没有用户手势时不能出声 */ } }
    if (!on && musicTimer) { clearInterval(musicTimer); musicTimer = null; }
  }
  return {
    syncMusic,
    play(name) {
      if (!getSettings().sound) return;
      try { sounds[name]?.(); } catch { /* 声音只是锦上添花，失败不影响游戏 */ }
    },
  };
}
