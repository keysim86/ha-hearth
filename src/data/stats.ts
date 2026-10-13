// Statystyki długoterminowe z rekordera (zmiana na godzinę / dzień / miesiąc) — źródło wykresów zużycia.

import type { Hass } from "../types";

export type Period = "hour" | "day" | "month";
export interface StatPoint {
  start: number;
  change: number | null;
}
interface Raw {
  start: number | string;
  change?: number | null;
}

const TTL = 10 * 60e3;

export class StatsStore {
  private cache = new Map<string, { at: number; data: Record<string, StatPoint[]> }>();
  private loading = new Set<string>();

  /** Dane z pamięci od razu (mogą być puste); brakujące albo stare pobiera w tle i woła `fresh`. */
  get(hass: Hass, ids: string[], period: Period, start: Date, fresh: () => void): Record<string, StatPoint[]> {
    const list = [...new Set(ids.filter(Boolean))].sort();
    if (!list.length) return {};
    const key = `${period}|${start.toISOString().slice(0, 13)}|${list.join(",")}`;
    const hit = this.cache.get(key);
    if ((!hit || Date.now() - hit.at > TTL) && !this.loading.has(key)) {
      this.loading.add(key);
      hass
        .callWS<Record<string, Raw[]>>({
          type: "recorder/statistics_during_period",
          start_time: start.toISOString(),
          statistic_ids: list,
          period,
          types: ["change"],
        })
        .then((r) => {
          const data: Record<string, StatPoint[]> = {};
          for (const [id, rows] of Object.entries(r ?? {}))
            data[id] = rows.map((x) => ({ start: typeof x.start === "number" ? x.start : Date.parse(x.start), change: x.change ?? null }));
          this.cache.set(key, { at: Date.now(), data });
          fresh();
        })
        .catch(() => this.cache.set(key, { at: Date.now(), data: hit?.data ?? {} }))
        .finally(() => this.loading.delete(key));
    }
    return hit?.data ?? {};
  }
}

/** Suma zmian od `from` (np. początek dnia). Ujemne zmiany pomijamy: to zerowanie licznika (np. dobowego albo
 *  kosztu przy zmianie taryfy), a nie ujemne zużycie. */
export const sumSince = (pts: StatPoint[] | undefined, from: number) =>
  (pts ?? []).filter((p) => p.start >= from).reduce((s, p) => s + Math.max(0, p.change ?? 0), 0);

export function startOfDay(d = new Date()): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function startOfMonth(d = new Date()): Date {
  const x = startOfDay(d);
  x.setDate(1);
  return x;
}

export function daysAgo(n: number): Date {
  const x = startOfDay();
  x.setDate(x.getDate() - n);
  return x;
}

export function monthsAgo(n: number): Date {
  const x = startOfMonth();
  x.setMonth(x.getMonth() - n);
  return x;
}
