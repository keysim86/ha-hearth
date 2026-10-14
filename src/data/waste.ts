// Harmonogram odpadów z kalendarza (np. Waste Collection Schedule): frakcja = tytuł zdarzenia, najbliższy termin.
// Frakcja bez terminu w kalendarzu (np. wielkogabarytowe poza zbiórką) po prostu się nie pojawia.

import type { Hass } from "../types";

export interface WasteEvent {
  name: string;
  date: Date;
}

const cache = new Map<string, { at: number; events: WasteEvent[] }>();
const loading = new Set<string>();

function parseStart(start: string | { date?: string; dateTime?: string }): Date | null {
  const s = typeof start === "string" ? start : start.date ?? start.dateTime ?? "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

/** Zdarzenia z najbliższych 120 dni (z pamięci; pobiera w tle co 30 min i woła `fresh`). */
export function wasteEvents(hass: Hass, calendars: string[], fresh: () => void): WasteEvent[] | null {
  const key = [...calendars].sort().join(",");
  if (!key) return null;
  const hit = cache.get(key);
  if ((!hit || Date.now() - hit.at > 30 * 60e3) && !loading.has(key)) {
    loading.add(key);
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    hass
      .callWS<{ response: Record<string, { events: Array<{ summary: string; start: string }> }> }>({
        type: "call_service",
        domain: "calendar",
        service: "get_events",
        service_data: { start_date_time: start.toISOString(), end_date_time: new Date(start.getTime() + 120 * 864e5).toISOString() },
        target: { entity_id: calendars },
        return_response: true,
      })
      .then((r) => {
        const events: WasteEvent[] = [];
        for (const cal of Object.values(r?.response ?? {}))
          for (const e of cal.events ?? []) {
            const date = parseStart(e.start);
            // Jedno zdarzenie bywa kilkoma frakcjami naraz („Zmieszane, Szkło”).
            if (date) for (const name of String(e.summary).split(/\s*,\s*/)) if (name) events.push({ name, date });
          }
        cache.set(key, { at: Date.now(), events });
        fresh();
      })
      .catch(() => cache.set(key, { at: Date.now(), events: hit?.events ?? [] }))
      .finally(() => loading.delete(key));
  }
  return hit?.events ?? null;
}

/** „biodegradowalne” -> „bio”: porównanie bez polskich znaków po pierwszych literach pierwszego słowa. */
export const stem = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ł/g, "l")
    .replace(/[^a-z0-9 _]/g, "")
    .trim()
    .split(/[\s_]+/)[0]
    .slice(0, 3);
