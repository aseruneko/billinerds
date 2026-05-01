const BGM_VOLUME_KEY = "billinard-bgm-volume";
const SFX_VOLUME_KEY = "billinard-sfx-volume";

export const DEFAULT_BGM_VOLUME = 0.1;
export const DEFAULT_SFX_VOLUME = 0.4;

export function getBgmVolume(): number {
  return readVolume(BGM_VOLUME_KEY, DEFAULT_BGM_VOLUME);
}

export function setBgmVolume(value: number) {
  localStorage.setItem(BGM_VOLUME_KEY, String(clampVolume(value)));
}

export function getSfxVolume(): number {
  return readVolume(SFX_VOLUME_KEY, DEFAULT_SFX_VOLUME);
}

export function setSfxVolume(value: number) {
  localStorage.setItem(SFX_VOLUME_KEY, String(clampVolume(value)));
}

function readVolume(key: string, fallback: number): number {
  const storedValue = localStorage.getItem(key);
  if (storedValue === null) return fallback;

  const value = Number(storedValue);
  return Number.isFinite(value) ? clampVolume(value) : fallback;
}

function clampVolume(value: number): number {
  return Math.max(0, Math.min(1, value));
}
