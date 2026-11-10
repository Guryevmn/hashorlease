// «Resume tomorrow» / «Dismiss» у баннера лимита: помним в браузере, что сегодня (UTC) баннер уже видели.

const KEY = "hol.limitAck.v1";
const today = () => new Date().toISOString().slice(0, 10);

export function acknowledgeLimit(): void {
  try {
    window.localStorage.setItem(KEY, today());
  } catch {
    /* хранилище недоступно */
  }
}

export function limitAcknowledged(): boolean {
  try {
    return window.localStorage.getItem(KEY) === today();
  } catch {
    return false;
  }
}
