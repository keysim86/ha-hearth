// Żywe niebo (wygląd Neon): pora dnia ze słońca (sun.sun) i pogoda — z encji pogody HA (opcja „pogoda”), a bez niej
// z bieżących warunków Open-Meteo dla lokalizacji domu. Niebo rysuje CSS (data-phase, data-wx na .sky);
// ruch tylko z efektami (atrybut fx) i bez prefers-reduced-motion.

import { nowWeather } from "./data/weather";
import { num } from "./format";
import type { Hass, Options } from "./types";

export type Phase = "night" | "twilight" | "day";
export type Wx = "" | "rain" | "pour" | "storm" | "snow" | "sleet" | "fog" | "cloud" | "partly";

/** Noc poniżej −6° (zmierzch cywilny), świt / zmierzch do 6°, potem dzień. */
export function skyPhase(hass: Hass): Phase {
  const sun = hass.states["sun.sun"];
  const el = num(sun?.attributes.elevation);
  if (el === null) return sun?.state === "above_horizon" ? "day" : "night";
  return el >= 6 ? "day" : el >= -6 ? "twilight" : "night";
}

// Stany encji pogody HA (weather.*).
const HA_WX: Record<string, Wx> = {
  rainy: "rain", pouring: "pour", "lightning-rainy": "storm", lightning: "storm", snowy: "snow", "snowy-rainy": "sleet",
  hail: "sleet", fog: "fog", cloudy: "cloud", partlycloudy: "partly", windy: "cloud", "windy-variant": "cloud",
  sunny: "", "clear-night": "", exceptional: "",
};

/** Kod WMO (Open-Meteo) → rodzaj nieba. */
export function wmoWx(code: number): Wx {
  if (code >= 95) return "storm";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if (code === 56 || code === 57 || code === 66 || code === 67) return "sleet";
  if (code === 65 || code === 82) return "pour";
  if ((code >= 51 && code <= 63) || code === 80 || code === 81) return "rain";
  if (code === 45 || code === 48) return "fog";
  if (code === 3) return "cloud";
  if (code === 1 || code === 2) return "partly";
  return "";
}

export function skyWeather(hass: Hass, opts: Options, fresh: () => void): Wx {
  const id = opts.weather;
  const state = id ? hass.states[id]?.state : undefined;
  if (state && state in HA_WX) return HA_WX[state];
  const now = nowWeather(hass.config?.latitude, hass.config?.longitude, fresh);
  return now ? wmoWx(now.code) : "";
}
