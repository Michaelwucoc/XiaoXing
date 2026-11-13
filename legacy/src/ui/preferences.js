const STORAGE_KEY = 'different-orbits.preferences.v1';
export function loadPreferences(storage, reducedMotion = false) {
  const defaults = { sound: false, reduced: reducedMotion, largeText: false, tilt: true, mode: 'duo', completed: [] };
  try {
    const saved = JSON.parse(storage?.getItem(STORAGE_KEY) || 'null');
    if (!saved || typeof saved !== 'object') return defaults;
    for (const key of ['sound', 'reduced', 'largeText', 'tilt']) if (typeof saved[key] === 'boolean') defaults[key] = saved[key];
    if (['solo', 'duo'].includes(saved.mode)) defaults.mode = saved.mode;
    if (Array.isArray(saved.completed)) defaults.completed = [...new Set(saved.completed.filter((id) => ['transfer', 'reserve', 'bypass'].includes(id)))];
  } catch { /* Storage can be unavailable in private or restricted browsing. */ }
  return defaults;
}
export function savePreferences(storage, preferences) {
  try { storage?.setItem(STORAGE_KEY, JSON.stringify(preferences)); return true; }
  catch { return false; }
}
