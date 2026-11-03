// Prognoza pogody: Open-Meteo (model ECMWF) dla lokalizacji domu z ustawień HA — bez klucza API.

export interface DayForecast {
  date: string;
  code: number;
  tmax: number;
  tmin: number;
  rain: number;
  rainProb: number | null;
  wind: number;
}

/** Warunki teraz (Open-Meteo „current”): kod WMO, dzień/noc, zachmurzenie %, opad mm, wiatr km/h. */
export interface NowWeather {
  code: number;
  isDay: boolean;
  cloud: number;
  precip: number;
  wind: number;
}

let cache: { key: string; at: number; days: DayForecast[]; now: NowWeather | null } | null = null;
let loading = false;

export function forecast(lat: number | undefined, lon: number | undefined, fresh: () => void): DayForecast[] | null {
  if (lat === undefined || lon === undefined) return null;
  const key = `${lat.toFixed(3)},${lon.toFixed(3)}`;
  if ((!cache || cache.key !== key || Date.now() - cache.at > 30 * 60e3) && !loading) {
    loading = true;
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&timezone=auto&forecast_days=14&models=ecmwf_ifs025` +
      "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max" +
      "&current=weather_code,is_day,cloud_cover,precipitation,wind_speed_10m";
    fetch(url)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((j) => {
        const d = j.daily;
        cache = {
          key,
          at: Date.now(),
          days: d.time.map((date: string, i: number) => ({
            date,
            code: d.weather_code[i],
            tmax: d.temperature_2m_max[i],
            tmin: d.temperature_2m_min[i],
            rain: d.precipitation_sum[i] ?? 0,
            rainProb: d.precipitation_probability_max?.[i] ?? null,
            wind: d.wind_speed_10m_max[i],
          })),
          now: j.current
            ? { code: j.current.weather_code, isDay: j.current.is_day === 1, cloud: j.current.cloud_cover ?? 0, precip: j.current.precipitation ?? 0, wind: j.current.wind_speed_10m ?? 0 }
            : null,
        };
        fresh();
      })
      .catch(() => (cache = { key, at: Date.now(), days: cache?.days ?? [], now: cache?.now ?? null }))
      .finally(() => (loading = false));
  }
  return cache?.days ?? null;
}

/** Warunki teraz (ta sama pamięć i odświeżanie co prognoza). */
export function nowWeather(lat: number | undefined, lon: number | undefined, fresh: () => void): NowWeather | null {
  forecast(lat, lon, fresh);
  return cache?.now ?? null;
}

/** Kody pogody WMO -> opis po polsku i rodzaj ikony. */
export function wmo(code: number): [string, "sun" | "partly" | "cloud" | "fog" | "rain" | "snow" | "storm"] {
  if (code === 0) return ["bezchmurnie", "sun"];
  if (code <= 2) return ["częściowe zachmurzenie", "partly"];
  if (code === 3) return ["pochmurno", "cloud"];
  if (code <= 48) return ["mgła", "fog"];
  if (code <= 57) return ["mżawka", "rain"];
  if (code <= 67) return ["deszcz", "rain"];
  if (code <= 77) return ["śnieg", "snow"];
  if (code <= 82) return ["przelotny deszcz", "rain"];
  if (code <= 86) return ["przelotny śnieg", "snow"];
  return ["burza", "storm"];
}
