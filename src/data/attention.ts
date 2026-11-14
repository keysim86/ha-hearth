// „Wymaga uwagi”: odłożone i zrobione sprawy wspólne dla całego domu — stan w HA (custom_components/hearth/attention.py),
// subskrypcja WebSocket „hearth/attention/subscribe” w każdym otwartym panelu. Kliknięcie w jednej przeglądarce chowa
// sprawę we wszystkich. Bez komend po stronie HA (np. nowy plik panelu przy starej integracji przed restartem)
// hidden zostaje null, a widok wraca do pamięci urządzenia (ctx.ui.attn).

import type { Hass } from "../types";

interface Conn {
  subscribeMessage<T>(cb: (msg: T) => void, msg: Record<string, unknown>): Promise<() => void>;
}

export class AttentionSync {
  /** Klucz sprawy → do kiedy schowana (ms); null = brak wspólnego stanu. */
  hidden: Record<string, number> | null = null;
  private conn?: Conn;
  private unsub?: () => void;
  private hass?: Hass;

  /** Raz na połączenie (biblioteka HA sama odnawia subskrypcję po zerwaniu); migrate = wpisy z pamięci urządzenia. */
  connect(hass: Hass & { connection?: Conn }, changed: () => void, migrate: () => Record<string, number>) {
    this.hass = hass;
    const conn = hass.connection;
    if (!conn || conn === this.conn) return;
    this.disconnect();
    this.conn = conn;
    let first = true;
    conn
      .subscribeMessage<{ hidden: Record<string, number> }>((m) => {
        if (this.conn !== conn) return;
        this.hidden = m.hidden ?? {};
        // Pierwsze zdarzenie = stan z HA; dopiero wtedy przenosimy wpisy z pamięci urządzenia.
        if (first) {
          first = false;
          const now = Date.now();
          for (const [key, until] of Object.entries(migrate()))
            if (typeof until === "number" && until > now && !((this.hidden[key] ?? 0) >= until)) this.hide(key, until);
        }
        changed();
      }, { type: "hearth/attention/subscribe" })
      .then((unsub) => {
        if (this.conn !== conn) return unsub();
        this.unsub = unsub;
      })
      .catch(() => {
        // Integracja bez tych komend albo konto bez dostępu — zostaje pamięć urządzenia.
        if (this.conn === conn) this.hidden = null;
        changed();
      });
  }

  disconnect() {
    this.unsub?.();
    this.unsub = undefined;
    this.conn = undefined;
    this.hidden = null;
  }

  hide(key: string, until: number) {
    if (!this.hidden) return;
    this.hidden = { ...this.hidden, [key]: Math.round(until) };
    this.send({ type: "hearth/attention/hide", key, until: Math.round(until) });
  }

  forget(keys: string[]) {
    if (!this.hidden || !keys.length) return;
    const next = { ...this.hidden };
    for (const k of keys) delete next[k];
    this.hidden = next;
    this.send({ type: "hearth/attention/forget", keys });
  }

  reset() {
    if (!this.hidden) return;
    this.hidden = {};
    this.send({ type: "hearth/attention/reset" });
  }

  // Odpowiedź serwera i tak przychodzi zdarzeniem subskrypcji; błąd zapisu wraca przy następnym zdarzeniu.
  private send(msg: Record<string, unknown>) {
    this.hass?.callWS(msg).catch(() => undefined);
  }
}
