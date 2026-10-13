// Ustawienia panelu Energia w HA: źródła (sieć, gaz, woda) i urządzenia — z nich zakładki Energia, Kocioł i Liczniki.

import type { Hass } from "../types";

export interface EnergySource {
  type: "grid" | "gas" | "water" | "solar" | "battery";
  stat_energy_from?: string;
  stat_energy_to?: string;
  stat_cost?: string | null;
  entity_energy_price?: string | null;
  // starszy format: źródło sieci z listą przepływów
  flow_from?: Array<{ stat_energy_from: string; stat_cost?: string | null; entity_energy_price?: string | null }>;
}

export interface EnergyPrefs {
  energy_sources: EnergySource[];
  device_consumption: Array<{ stat_consumption: string; name?: string; stat_rate?: string }>;
}

let cache: { at: number; prefs: EnergyPrefs | null } | null = null;
let loading: Promise<void> | null = null;

/** Ustawienia z pamięci; pierwsze wywołanie pobiera je w tle i woła `fresh`. */
export function energyPrefs(hass: Hass, fresh: () => void): EnergyPrefs | null {
  if ((!cache || Date.now() - cache.at > 30 * 60e3) && !loading) {
    loading = hass
      .callWS<EnergyPrefs>({ type: "energy/get_prefs" })
      .then((p) => {
        cache = { at: Date.now(), prefs: p };
        fresh();
      })
      .catch(() => {
        cache = { at: Date.now(), prefs: null };
      })
      .finally(() => (loading = null));
  }
  return cache?.prefs ?? null;
}

export interface GridSource {
  stat: string;
  price?: string | null;
}

export function gridSources(p: EnergyPrefs | null): GridSource[] {
  const out: GridSource[] = [];
  for (const s of p?.energy_sources ?? []) {
    if (s.type !== "grid") continue;
    if (s.stat_energy_from) out.push({ stat: s.stat_energy_from, price: s.entity_energy_price });
    for (const f of s.flow_from ?? []) out.push({ stat: f.stat_energy_from, price: f.entity_energy_price });
  }
  return out;
}

export const sourcesOf = (p: EnergyPrefs | null, type: "gas" | "water") =>
  (p?.energy_sources ?? []).filter((s) => s.type === type && s.stat_energy_from).map((s) => s.stat_energy_from as string);
