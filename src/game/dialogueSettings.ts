const SKIP_DIALOGUE_KEY = "billinard-skip-dialogue";

export function isDialogueSkipEnabled(): boolean {
  return localStorage.getItem(SKIP_DIALOGUE_KEY) === "true";
}

export function setDialogueSkipEnabled(enabled: boolean) {
  localStorage.setItem(SKIP_DIALOGUE_KEY, String(enabled));
}
