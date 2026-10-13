// Historia 24 h z rekordera HA (jedno zapytanie na wszystkie encje, odświeżane co 5 minut).

import type { Hass } from "./types";

export type Point = [number, string];
const DAY = 24 * 3600e3;

interface Minimal {
  s: string;
  lu?: number;
  lc?: number;
}

export class HistoryStore {
  private data = new Map<string, Point[]>();
  private ids = "";
  private loadedAt = 0;
  private loading?: Promise<void>;

  /** Zwraca true, gdy pobrano nowe dane (trzeba przerysować). */
  async ensure(hass: Hass, ids: string[]): Promise<boolean> {
    const key = [...new Set(ids)].sort().join(",");
    if (!key) return false;
    if (key === this.ids && Date.now() - this.loadedAt < 5 * 60e3) return false;
    if (this.loading) {
      await this.loading;
      return false;
    }
    this.loading = this.load(hass, key.split(","));
    try {
      await this.loading;
      this.ids = key;
      return true;
    } finally {
      this.loading = undefined;
    }
  }

  private async load(hass: Hass, ids: string[]) {
    const r = await hass.callWS<Record<string, Minimal[]>>({
      type: "history/history_during_period",
      start_time: new Date(Date.now() - DAY).toISOString(),
      entity_ids: ids,
      minimal_response: true,
      no_attributes: true,
      significant_changes_only: false,
    });
    this.data.clear();
    for (const [id, list] of Object.entries(r)) {
      this.data.set(id, list.map((x) => [((x.lu ?? x.lc) ?? 0) * 1000, x.s]));
    }
    this.loadedAt = Date.now();
  }

  /** Punkty z ostatnich 24 h + bieżący stan na końcu. */
  series(hass: Hass, id: string | undefined): Point[] {
    if (!id) return [];
    const pts = [...(this.data.get(id) ?? [])];
    const now = hass.states[id];
    if (now && (!pts.length || pts[pts.length - 1][1] !== now.state)) pts.push([Date.parse(now.last_changed), now.state]);
    return pts;
  }

  /** Odcinki czasu w ostatnich 24 h, gdy warunek był spełniony. */
  periods(hass: Hass, id: string | undefined, cond: (v: string) => boolean): Array<[number, number]> {
    const t1 = Date.now(), t0 = t1 - DAY;
    const out: Array<[number, number]> = [];
    let from: number | null = null;
    for (const [t, v] of this.series(hass, id)) {
      const tt = Math.max(t, t0);
      if (cond(v) && from === null) from = tt;
      if (!cond(v) && from !== null) {
        out.push([from, tt]);
        from = null;
      }
    }
    if (from !== null) out.push([from, t1]);
    return out.filter(([, b]) => b > t0);
  }
}

export const sumPeriods = (p: Array<[number, number]>) => p.reduce((s, [a, b]) => s + (b - a), 0);
