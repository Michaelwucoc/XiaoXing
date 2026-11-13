// 朗读文字（浏览器自带语音，可在设置里打开）。
export function speak(text, enabled) {
  try {
    if (!enabled || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/[「」“”]/g, ''));
    u.lang = 'zh-CN';
    u.rate = 0.9;
    u.pitch = 1.1;
    const voice = window.speechSynthesis.getVoices().find((v) => v.lang?.startsWith('zh'));
    if (voice) u.voice = voice;
    window.speechSynthesis.speak(u);
  } catch { /* 不支持语音时静默 */ }
}
