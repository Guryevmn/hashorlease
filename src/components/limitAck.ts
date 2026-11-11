// «Resume tomorrow» / «Dismiss» on the limit banner: we remember in the browser that the banner was already seen today (UTC).

const KEY = "hol.limitAck.v1";
const today = () => new Date().toISOString().slice(0, 10);

export function acknowledgeLimit(): void {
  try {
    window.localStorage.setItem(KEY, today());
  } catch {
    /* storage unavailable */
  }
}

export function limitAcknowledged(): boolean {
  try {
    return window.localStorage.getItem(KEY) === today();
  } catch {
    return false;
  }
}
