// Zakładka Zdrowie: statystyki z rekordera (średnia / min / max / stan) i obliczenia przeniesione ze starej karty
// zdrowia — dzienne serie, bilanse, BMI, kategorie, odczyty ciśnienia, siatki centylowe WHO.

import type { Hass, HassEntity } from "../types";

export type RowPeriod = "5minute" | "hour" | "day";
export interface Row {
  t: number;
  mean: number | null;
  min: number | null;
  max: number | null;
  state: number | null;
}
interface Raw {
  start: number | string;
  mean?: number | null;
  min?: number | null;
  max?: number | null;
  state?: number | null;
}

const TTL = 10 * 60e3;
const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Statystyki z rekordera jako wiersze (czas w ms). Wagę ze skali w gramach albo funtach HA odda w kilogramach. */
export async function fetchRows(hass: Hass, ids: string[], period: RowPeriod, start: Date, end?: Date): Promise<Record<string, Row[]>> {
  const r = await hass.callWS<Record<string, Raw[]>>({
    type: "recorder/statistics_during_period",
    start_time: start.toISOString(),
    ...(end ? { end_time: end.toISOString() } : {}),
    statistic_ids: ids,
    period,
    units: { mass: "kg" },
    types: ["mean", "min", "max", "state"],
  });
  const data: Record<string, Row[]> = {};
  for (const [id, rows] of Object.entries(r ?? {}))
    data[id] = rows.map((x) => ({
      t: typeof x.start === "number" ? (x.start < 1e12 ? x.start * 1000 : x.start) : Date.parse(x.start),
      mean: n(x.mean), min: n(x.min), max: n(x.max), state: n(x.state),
    }));
  return data;
}

export class RowsStore {
  private cache = new Map<string, { at: number; data: Record<string, Row[]> }>();
  private loading = new Set<string>();

  /** Dane z pamięci od razu (mogą być puste); brakujące albo stare pobiera w tle i woła `fresh`. */
  get(hass: Hass, ids: Array<string | undefined>, period: RowPeriod, start: Date, fresh: () => void): Record<string, Row[]> {
    const list = [...new Set(ids.filter((x): x is string => Boolean(x)))].sort();
    if (!list.length) return {};
    const key = `${period}|${start.toISOString().slice(0, 13)}|${list.join(",")}`;
    const hit = this.cache.get(key);
    if ((!hit || Date.now() - hit.at > TTL) && !this.loading.has(key)) {
      this.loading.add(key);
      fetchRows(hass, list, period, start)
        .then((data) => {
          this.cache.set(key, { at: Date.now(), data });
          fresh();
        })
        .catch(() => this.cache.set(key, { at: Date.now(), data: hit?.data ?? {} }))
        .finally(() => this.loading.delete(key));
    }
    return hit?.data ?? {};
  }

  /** Czy dane dla klucza już są (żeby odróżnić „ładuję” od „brak danych”). */
  has(ids: Array<string | undefined>, period: RowPeriod, start: Date): boolean {
    const list = [...new Set(ids.filter((x): x is string => Boolean(x)))].sort();
    return this.cache.has(`${period}|${start.toISOString().slice(0, 13)}|${list.join(",")}`);
  }
}

export type Daily = Array<[string, number]>;

/** Dzień w strefie przeglądarki jako „RRRR-MM-DD”. */
export const dayKey = (t: number) => new Date(t).toLocaleDateString("sv-SE");
export const dayStart = (d: string) => new Date(`${d}T00:00:00`).getTime();
const value = (r: Row) => r.mean ?? r.state;
const r2 = (v: number) => Math.round(v * 100) / 100;

/** Ostatnia wartość doby (czujnik trzyma wynik do kolejnego pomiaru, więc koniec doby = ostatni pomiar tego dnia).
 *  Odczyty poza (0, max] pomijamy: aplikacja potrafi chwilowo podać gramy jako kilogramy. */
export function dailyLast(rows: Row[] | undefined, max = 400): Daily {
  const m = new Map<string, number>();
  for (const r of rows ?? []) {
    const v = value(r);
    if (v === null || v <= 0 || v > max) continue;
    m.set(dayKey(r.t), r2(v));
  }
  return [...m].sort((a, b) => a[0].localeCompare(b[0]));
}

/** Średnia doby (skład ciała, ciśnienie na wykresie); filtr jak wyżej, ale na poziomie godziny. */
export function dailyAvg(rows: Row[] | undefined, max = Infinity): Daily {
  const m = new Map<string, number[]>();
  for (const r of rows ?? []) {
    const v = value(r);
    if (v === null || v <= 0 || v > max) continue;
    const d = dayKey(r.t);
    if (!m.has(d)) m.set(d, []);
    m.get(d)!.push(v);
  }
  return [...m].sort((a, b) => a[0].localeCompare(b[0])).map(([d, vs]) => [d, Math.round((vs.reduce((a, b) => a + b, 0) / vs.length) * 10) / 10]);
}

/** Łączy serię długoterminową (godzinową) z krótkoterminową (5 min) i bieżącym stanem — świeższe wygrywa. */
export function mergeDaily(...parts: Daily[]): Daily {
  const m = new Map<string, number>();
  for (const p of parts) for (const [d, v] of p) m.set(d, v);
  return [...m].sort((a, b) => a[0].localeCompare(b[0]));
}

/** Wynik doby licznika zerowanego o północy (kroki, kalorie): stan z ostatniego kubełka doby, nie maksimum —
 *  licznik trzyma wczorajszy wynik, aż telefon przyśle pierwszy odczyt nowej doby. */
export function dailyCounter(rows: Row[] | undefined): Daily {
  const m = new Map<string, [number, number]>();
  for (const r of rows ?? []) {
    const v = r.state ?? r.mean;
    if (v === null) continue;
    const d = dayKey(r.t);
    if (!m.has(d) || r.t >= m.get(d)![0]) m.set(d, [r.t, v]);
  }
  return [...m].sort((a, b) => a[0].localeCompare(b[0])).map(([d, [, v]]) => [d, Math.round(v)]);
}

/** Wartość licznika na dziś; gdy ostatnia zmiana była przed północą, dziś jeszcze nic nie przyszło (= 0). */
export function counterToday(s: HassEntity | undefined): number | null {
  if (!s) return null;
  const v = parseFloat(s.state);
  if (!Number.isFinite(v)) return null;
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const changed = Date.parse(s.last_changed);
  if (Number.isFinite(changed) && changed < midnight.getTime()) return 0;
  return Math.round(v);
}

export function withToday(data: Daily, v: number | null): Daily {
  if (v === null) return data;
  const today = dayKey(Date.now());
  const out = data.filter(([d]) => d !== today);
  out.push([today, v]);
  return out;
}

export interface Balance {
  key: string;
  from: number;
  to: number;
  diff: number;
  partial: boolean;
}

/** Bilans okresów: ostatni pomiar poprzedniego okresu → ostatni pomiar bieżącego (najnowsze pierwsze). */
function balances(daily: Daily, keyOf: (d: string) => string, keep: number): Balance[] {
  const last = new Map<string, number>();
  for (const [d, v] of daily) last.set(keyOf(d), v);
  const keys = [...last.keys()].sort();
  return keys
    .slice(-keep - 1)
    .map((k, i, arr) => (i === 0 ? null : { key: k, from: last.get(arr[i - 1])!, to: last.get(k)!, diff: r2(last.get(k)! - last.get(arr[i - 1])!), partial: i === arr.length - 1 }))
    .filter((x): x is Balance => x !== null)
    .reverse();
}

export function weekKey(d: string): string {
  const x = new Date(`${d}T12:00:00`);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x.toLocaleDateString("sv-SE");
}
export const monthlyBalances = (daily: Daily) => balances(daily, (d) => d.slice(0, 7), 12);
export const weeklyBalances = (daily: Daily) => balances(daily, weekKey, 16);

/** Średnia z miesiąca (wykres „Waga” i „BMI” w bilansach). */
export function monthlyAvg(daily: Daily): Daily {
  const m = new Map<string, number[]>();
  for (const [d, v] of daily) {
    const k = d.slice(0, 7);
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(v);
  }
  return [...m].sort((a, b) => a[0].localeCompare(b[0])).map(([k, vs]) => [k, r2(vs.reduce((a, b) => a + b, 0) / vs.length)]);
}

/** Dzień ostatniej zmiany wartości (seria dzienna trzyma ten sam wynik między pomiarami). */
export function lastChangeDay(daily: Daily): string | null {
  if (!daily.length) return null;
  for (let i = daily.length - 1; i > 0; i--) if (Math.abs(daily[i][1] - daily[i - 1][1]) > 0.01) return daily[i][0];
  return daily[0][0];
}

/** Chwila ostatniej faktycznej zmiany w statystykach; `strict` = null, gdy w oknie nie było zmiany. */
export function lastChangeAt(rows: Row[] | undefined, strict = false): number | null {
  const list = rows ?? [];
  if (strict ? list.length < 2 : !list.length) return null;
  const v = (r: Row) => r.state ?? r.mean;
  let last = v(list[list.length - 1]);
  if (last === null) return null;
  for (let i = list.length - 2; i >= 0; i--) {
    const x = v(list[i]);
    if (x === null) continue;
    if (Math.abs(x - last) > 0.01) return list[i + 1].t;
    last = x;
  }
  return strict ? null : list[0].t;
}

// ---- BMI i skład ciała ----

export const bmi = (kg: number, cm: number) => Math.round((kg / (cm / 100) ** 2) * 10) / 10;

export interface Cat {
  label: string;
  color: string;
}
export const BMI_CATS: Array<[number, Cat]> = [
  [18.5, { label: "Niedowaga", color: "var(--frost)" }],
  [25, { label: "Norma", color: "var(--ok)" }],
  [30, { label: "Nadwaga", color: "var(--warn)" }],
  [35, { label: "Otyłość I°", color: "var(--crit)" }],
  [40, { label: "Otyłość II°", color: "#a32d2d" }],
  [Infinity, { label: "Otyłość III°", color: "#701515" }],
];
export const bmiCat = (b: number): Cat => BMI_CATS.find(([lim]) => b < lim)![1];

/** Progi tkanki tłuszczowej wg American Council on Exercise — tylko do koloru kafelka, bez diagnoz. */
export function fatCat(pct: number, gender: string): Cat {
  const m = gender !== "female";
  if (pct < (m ? 6 : 14)) return { label: "Niezbędny", color: "var(--frost)" };
  if (pct < (m ? 14 : 21)) return { label: "Sportowy", color: "var(--ok)" };
  if (pct < (m ? 18 : 25)) return { label: "Fitness", color: "var(--ok)" };
  if (pct < (m ? 25 : 32)) return { label: "Przeciętny", color: "var(--warn)" };
  return { label: "Powyżej normy", color: "var(--crit)" };
}

// ---- ciśnienie ----

/** Odczyty z kubełków godzinowych: stabilna godzina = jedna wartość, godzina z pomiarem = obie skrajne; powtórzenia
 *  pod rząd zwinięte. Średnia i min/max liczone są wtedy z POMIARÓW, a nie z czasu wyświetlania wyniku. */
export function readings(rows: Row[] | undefined, fromDay: string): number[] {
  const out: number[] = [];
  let prev: number | null = null;
  for (const r of rows ?? []) {
    if (dayKey(r.t) < fromDay) continue;
    const cands = r.min !== null && r.max !== null && r.min !== r.max ? [r.min, r.max] : [r.mean ?? r.min ?? r.state];
    for (const c of cands) {
      if (c === null) continue;
      const z = Math.round(c * 10) / 10;
      if (prev === null || z !== prev) out.push(z);
      prev = z;
    }
  }
  return out;
}

export interface BpReading {
  t: number;
  sys: number;
  dia: number;
  pul: number | null;
}

/** Pomiary do raportu: godziny, w których zmieniła się wartość, sparowane skurczowe / rozkurczowe / tętno (±1 h). */
export function bpReadings(sys: Row[], dia: Row[], pul: Row[], exclude: string[]): BpReading[] {
  const changes = (rows: Row[]) => {
    const out: Array<{ t: number; v: number }> = [];
    let prev: number | null = null;
    for (const r of rows) {
      const v = value(r);
      if (v === null) continue;
      const c = Math.round(v);
      if (prev === null || c !== prev) out.push({ t: r.t, v: c });
      prev = c;
    }
    return out;
  };
  const s = changes(sys), d = changes(dia), p = changes(pul);
  const near = (list: Array<{ t: number; v: number }>, t: number) =>
    list.reduce<{ t: number; v: number } | null>((b, x) => (!b || Math.abs(x.t - t) < Math.abs(b.t - t) ? x : b), null);
  const H = 3600e3;
  let out: BpReading[] = [];
  for (const x of s) {
    const dd = near(d, x.t), pp = near(p, x.t);
    if (dd && Math.abs(dd.t - x.t) <= H) out.push({ t: x.t, sys: x.v, dia: dd.v, pul: pp && Math.abs(pp.t - x.t) <= H ? pp.v : null });
  }
  out = out.filter((m, i) => i === 0 || m.sys !== out[i - 1].sys || m.dia !== out[i - 1].dia || m.pul !== out[i - 1].pul);
  const skip = new Set(exclude.map((e) => e.trim().slice(0, 16)));
  const pad = (v: number) => String(v).padStart(2, "0");
  const label = (t: number) => {
    const x = new Date(t);
    return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())} ${pad(x.getHours())}:${pad(x.getMinutes())}`;
  };
  return skip.size ? out.filter((m) => !skip.has(label(m.t))) : out;
}

/** Klasyfikacja ESH (jak w raporcie starej karty). */
export function bpClass(s: number, d: number): string {
  if (s < 120 && d < 80) return "Optymalne";
  if (s < 130 && d < 85) return "Prawidłowe";
  if (s < 140 && d < 90) return "Wysokie prawidłowe";
  if (s < 160 && d < 100) return "Nadciśnienie I°";
  if (s < 180 && d < 110) return "Nadciśnienie II°";
  return "Nadciśnienie III°";
}

/** Poziom alertu: z czujnika kategorii (gdy jest) albo z wartości. */
export function bpLevel(category: string | null, s: number | null, d: number | null): "ok" | "warn" | "crit" {
  if (category) {
    const c = category.toLowerCase();
    if (/wysok|high|nadci/.test(c) && !/prawid/.test(c)) return "crit";
    if (/podwy|elevated|pre|wysokie prawid/.test(c)) return "warn";
    return "ok";
  }
  if (s === null || d === null) return "ok";
  if (s >= 140 || d >= 90) return "crit";
  if (s >= 130 || d >= 80) return "warn";
  return "ok";
}

// ---- siatki centylowe WHO 2007: [wzrost P10, P50, P90, BMI P5, P85, P95] ----

const WHO: Record<"male" | "female", Record<number, number[]>> = {
  male: {
    2: [82.5, 87.1, 91.8, 13.8, 17.1, 18.3], 3: [89.0, 94.2, 99.4, 13.5, 16.7, 17.9], 4: [95.0, 100.3, 105.7, 13.2, 16.3, 17.6],
    5: [105.8, 110.0, 115.4, 13.0, 15.7, 16.9], 6: [111.5, 116.0, 121.5, 12.9, 16.0, 17.5], 7: [117.0, 121.7, 127.3, 13.0, 16.5, 18.4],
    8: [122.2, 127.3, 133.1, 13.2, 17.3, 19.6], 9: [126.9, 132.6, 138.5, 13.5, 18.2, 20.9], 10: [131.3, 137.8, 143.6, 13.9, 19.2, 22.2],
    11: [135.8, 143.5, 149.2, 14.4, 20.1, 23.2], 12: [141.0, 149.7, 155.7, 14.8, 21.1, 24.3], 13: [148.0, 156.5, 163.0, 15.3, 21.8, 25.1],
    14: [154.7, 163.2, 170.5, 15.8, 22.5, 25.9], 15: [160.7, 169.0, 177.0, 16.3, 23.2, 26.6], 16: [164.7, 173.3, 181.7, 16.8, 23.8, 27.2],
    17: [166.9, 175.9, 184.4, 17.2, 24.3, 27.7], 18: [167.9, 177.2, 185.8, 17.6, 24.8, 28.1],
  },
  female: {
    2: [81.5, 86.4, 91.3, 13.6, 17.0, 18.1], 3: [88.3, 93.9, 99.4, 13.2, 16.5, 17.7], 4: [94.4, 100.3, 106.1, 13.0, 16.1, 17.4],
    5: [104.9, 109.4, 114.0, 12.7, 15.3, 16.6], 6: [110.8, 115.1, 120.2, 12.6, 15.6, 17.1], 7: [116.3, 120.6, 126.1, 12.7, 16.2, 18.0],
    8: [121.6, 126.0, 132.1, 13.0, 17.0, 19.4], 9: [126.6, 131.2, 137.9, 13.3, 18.1, 20.9], 10: [131.7, 136.5, 143.7, 13.7, 19.2, 22.4],
    11: [137.4, 142.5, 150.2, 14.2, 20.3, 23.8], 12: [143.5, 149.0, 157.4, 14.7, 21.3, 25.0], 13: [149.0, 154.6, 163.5, 15.1, 22.1, 25.9],
    14: [153.0, 158.7, 167.9, 15.5, 22.7, 26.6], 15: [154.8, 161.2, 170.0, 15.9, 23.2, 27.1], 16: [155.8, 162.5, 171.4, 16.2, 23.6, 27.5],
    17: [156.2, 163.1, 172.1, 16.5, 23.9, 27.7], 18: [156.5, 163.4, 172.4, 16.7, 24.1, 27.9],
  },
};

export interface Centiles {
  hP10: number;
  hP50: number;
  hP90: number;
  bP5: number;
  bP85: number;
  bP95: number;
}

export function centiles(age: number, gender: string): Centiles {
  const t = WHO[gender === "male" ? "male" : "female"];
  const a = Math.max(2, Math.min(18, age));
  const lo = Math.floor(a), hi = Math.min(18, lo + 1), f = a - lo;
  const ip = (i: number) => Math.round((t[lo][i] + (t[hi][i] - t[lo][i]) * f) * 10) / 10;
  return { hP10: ip(0), hP50: ip(1), hP90: ip(2), bP5: ip(3), bP85: ip(4), bP95: ip(5) };
}

export const ageYears = (birth: string, at: number = Date.now()) => (at - Date.parse(`${birth}T00:00:00`)) / (365.25 * 864e5);

export function childBmiCat(b: number, c: Centiles): Cat {
  if (b < c.bP5) return { label: "Niedowaga", color: "var(--bath)" };
  if (b < c.bP85) return { label: "Norma", color: "var(--ok)" };
  if (b < c.bP95) return { label: "Nadwaga", color: "var(--warn)" };
  return { label: "Otyłość", color: "var(--crit)" };
}

export function childHeightCat(h: number, c: Centiles): Cat {
  if (h < c.hP10) return { label: "Niski", color: "var(--crit)" };
  if (h < c.hP90) return { label: "Średnio-wysoki", color: "var(--ok)" };
  return { label: "Bardzo wysoki", color: "var(--frost)" };
}

// ---- pomiary ciała ----

export const MEASUREMENTS: Array<{ key: import("../types").Measurement; label: string; min: number; max: number; color: string }> = [
  { key: "neck", label: "Szyja", min: 20, max: 80, color: "#e24b4a" },
  { key: "chest", label: "Klatka", min: 40, max: 160, color: "#3b8bd4" },
  { key: "abdomen", label: "Brzuch", min: 40, max: 200, color: "#f39c12" },
  { key: "waist", label: "Talia", min: 40, max: 180, color: "#1d9e75" },
  { key: "hips", label: "Biodra", min: 40, max: 180, color: "#9b59b6" },
  { key: "thigh", label: "Udo", min: 20, max: 100, color: "#e67e22" },
  { key: "calf", label: "Łydka", min: 20, max: 80, color: "#16a085" },
  { key: "biceps", label: "Biceps", min: 10, max: 80, color: "#e91e8c" },
];
