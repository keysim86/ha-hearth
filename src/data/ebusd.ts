// Programy czasowe sterownika Vaillant (VRC720) przez ebusd/MQTT:
//   <baza><obwód>Timer_<Dzień><nr> = "HH:MM;HH:MM[;temp]"   (odczyt jednego przedziału)
//   <baza><obwód>Timer_Timeframes    = "2;2;2;2;2;2;2"        (liczba przedziałów pn–nd)
//   <baza><obwód>Timer_<Dzień>/set   = "nr;liczba;HH:MM;HH:MM[;temp]"  (zapis jednego przedziału)
// Obwody: Z1 (ogrzewanie strefy), Hwc (ciepła woda), Cc (cyrkulacja, bez temperatury).

import type { Hass } from "../types";

export type Circuit = "zone" | "hwc" | "cc";
export const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
export const DAY_PL = ["Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota", "Niedziela"];
export const DAY_SHORT = ["pn", "wt", "śr", "cz", "pt", "sb", "nd"];

export interface Slot {
  from: string;
  to: string;
  temp: number | null;
}

interface Conn {
  subscribeMessage(cb: (msg: { topic: string; payload: string }) => void, msg: Record<string, unknown>): Promise<() => void>;
}

/** Z tematu strefy („ebusd/ctlv2/Z1”) baza („ebusd/ctlv2/”) i prefiksy obwodów. */
export function circuits(zoneTopic: string) {
  const m = /^(.*\/)([^/]+)$/.exec(zoneTopic.replace(/\/+$/, ""));
  if (!m) return null;
  return { base: m[1], prefix: { zone: m[2], hwc: "Hwc", cc: "Cc" } as Record<Circuit, string> };
}

export class EbusdTimers {
  values = new Map<string, string>();
  private unsub?: () => void;
  private base = "";

  /** Subskrypcja tematów sterownika (ebusd publikuje je jako zachowane, więc stan przychodzi od razu). */
  async connect(hass: Hass & { connection?: Conn }, base: string, changed: () => void) {
    if (this.base === base && this.unsub) return;
    this.disconnect();
    this.base = base;
    if (!hass.connection) return;
    try {
      this.unsub = await hass.connection.subscribeMessage(
        (m) => {
          this.values.set(m.topic, String(m.payload));
          changed();
        },
        { type: "mqtt/subscribe", topic: `${base}+` },
      );
    } catch {
      this.unsub = undefined; // np. konto bez uprawnień administratora — harmonogramy tylko do odczytu niedostępne
    }
  }

  disconnect() {
    this.unsub?.();
    this.unsub = undefined;
  }

  get connected() {
    return Boolean(this.unsub);
  }

  week(base: string, prefix: string): Slot[][] | null {
    const frames = this.values.get(`${base}${prefix}Timer_Timeframes`);
    if (!frames) return null;
    const counts = frames.split(";").map((x) => parseInt(x, 10) || 0);
    return DAYS.map((d, i) => {
      const out: Slot[] = [];
      for (let k = 0; k < (counts[i] ?? 0); k++) {
        const v = this.values.get(`${base}${prefix}Timer_${d}${k}`);
        if (!v) continue;
        const [from, to, temp] = v.split(";");
        out.push({ from: from.slice(0, 5), to: to.slice(0, 5), temp: temp !== undefined ? parseFloat(temp) : null });
      }
      return out;
    });
  }
}

export const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

/** Błąd w przedziałach dnia (kolejność, nakładanie, krok 10 min) albo null. */
export function validate(slots: Slot[], withTemp: boolean): string | null {
  if (slots.length > 3) return "Sterownik przyjmuje najwyżej 3 przedziały na dzień.";
  let prev = -1;
  for (const s of slots) {
    if (!/^\d{2}:\d{2}$/.test(s.from) || !/^(\d{2}:\d{2}|24:00)$/.test(s.to)) return "Podaj godziny w formacie GG:MM.";
    const a = toMin(s.from), b = toMin(s.to);
    if (a % 10 || b % 10) return "Godziny tylko co 10 minut (sterownik).";
    if (b <= a) return "Koniec przedziału musi być po początku.";
    if (a < prev) return "Przedziały nachodzą na siebie albo są nie po kolei.";
    if (withTemp && (s.temp === null || !Number.isFinite(s.temp))) return "Podaj temperaturę.";
    prev = b;
  }
  return null;
}

/** Wywołania mqtt.publish zapisujące dzień: każdy przedział osobno, z liczbą przedziałów. */
export function writes(base: string, prefix: string, day: (typeof DAYS)[number], slots: Slot[], withTemp: boolean) {
  const topic = `${base}${prefix}Timer_${day}/set`;
  return slots.map((s, i) => ({
    topic,
    payload: [i, slots.length, s.from, s.to, ...(withTemp ? [(s.temp ?? 0).toFixed(1)] : [])].join(";"),
  }));
}
