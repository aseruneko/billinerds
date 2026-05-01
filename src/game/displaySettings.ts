const HIDE_CUE_HP_BAR_KEY = "billinard-hide-cue-hp-bar";

export function isCueHpBarHidden(): boolean {
  return localStorage.getItem(HIDE_CUE_HP_BAR_KEY) === "true";
}

export function setCueHpBarHidden(hidden: boolean) {
  localStorage.setItem(HIDE_CUE_HP_BAR_KEY, String(hidden));
}
