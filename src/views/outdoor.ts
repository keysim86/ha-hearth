// Rząd „Na zewnątrz”: temperatura, ciśnienie, słońce i światło, jakość powietrza.

import { html, nothing, type TemplateResult } from "lit";
import { f1, num, round } from "../format";
import { line, sunArc } from "../svg";
import { st, type Ctx } from "./common";

// Indeks GIOŚ (µg/m³): bardzo dobry, dobry, umiarkowany, dostateczny, zły, bardzo zły.
const GIOS: Record<"pm25" | "pm10", number[]> = { pm25: [13, 35, 55, 75, 110], pm10: [20, 50, 80, 110, 150] };
const LEVELS: Array<[string, string]> = [
  ["bardzo dobry", "var(--ok)"],
  ["dobry", "var(--ok)"],
  ["umiarkowany", "var(--warn)"],
  ["dostateczny", "var(--warn)"],
  ["zły", "var(--crit)"],
  ["bardzo zły", "var(--crit)"],
];
const AQI: Record<string, [string, string]> = {
  very_low: ["bardzo niski", "var(--ok)"],
  low: ["niski", "var(--ok)"],
  medium: ["średni", "var(--warn)"],
  high: ["wysoki", "var(--crit)"],
  very_high: ["bardzo wysoki", "var(--crit)"],
};
const aqiFromValue = (v: number) => ["very_low", "low", "medium", "high", "very_high"][[25, 50, 75, 100].filter((g) => v > g).length];

const unit = (ctx: Ctx, id: string) => ctx.hass.states[id]?.attributes.unit_of_measurement ?? "";

function cell(label: string, body: TemplateResult, sub: TemplateResult | string | typeof nothing, chart: unknown = nothing) {
  return html`<div class="ocell"><span class="hlabel">${label}</span>${body}${sub === nothing ? nothing : html`<span class="hsub">${sub}</span>`}${chart}</div>`;
}

function pmRow(key: "pm25" | "pm10", name: string, v: number | null) {
  if (v === null) return nothing;
  const [lvl, col] = LEVELS[GIOS[key].filter((g) => v > g).length];
  return html`<div class="pmrow"><span>${name}</span>
    <div class="pmbar"><i style="width:${Math.min(100, (v / GIOS[key][2]) * 100).toFixed(0)}%;background:${col}"></i></div>
    <span><b>${f1(v)}</b> · ${lvl}</span></div>`;
}

export function outdoor(ctx: Ctx): TemplateResult | typeof nothing {
  const o = ctx.opts, h = ctx.hass, cells: TemplateResult[] = [];
  const hist = (id?: string | null) => (id ? ctx.hist.series(h, id) : []);

  if (o.outdoor_temperature) {
    const t = num(st(ctx, o.outdoor_temperature)), w = num(st(ctx, o.outdoor_humidity));
    cells.push(cell("Na zewnątrz",
      html`<div class="orow"><span class="hval">${f1(t)}<span class="u">°C</span></span>${w === null ? nothing : html`<span class="hsub">wilgotność ${round(w)}%</span>`}</div>`,
      "ostatnie 24 h", line(hist(o.outdoor_temperature), "var(--frost)")));
  }
  if (o.outdoor_pressure) {
    const p = num(st(ctx, o.outdoor_pressure));
    const series = hist(o.outdoor_pressure).filter(([t]) => t <= Date.now() - 3 * 3600e3);
    const before = series.length ? num(series[series.length - 1][1]) : null;
    const d = p !== null && before !== null ? p - before : null;
    const trend = d === null ? nothing
      : Math.abs(d) < 1 ? html`<span class="trend" style="color:var(--muted)">→ stałe (3 h)</span>`
      : d > 0 ? html`<span class="trend" style="color:var(--ok)">↑ rośnie ${f1(d)} / 3 h</span>`
      : html`<span class="trend" style="color:var(--warn)">↓ spada ${f1(-d)} / 3 h</span>`;
    cells.push(cell("Ciśnienie",
      html`<div class="orow"><span class="hval">${round(p)}<span class="u"> ${unit(ctx, o.outdoor_pressure)}</span></span>${trend}</div>`,
      "ostatnie 24 h", line(hist(o.outdoor_pressure), "var(--muted)", { min: 4 })));
  }
  if (o.outdoor_illuminance || h.states["sun.sun"]) {
    const lux = o.outdoor_illuminance ? num(st(ctx, o.outdoor_illuminance)) : null;
    const sun = h.states["sun.sun"];
    let frac: number | null = null, txt = "";
    if (sun) {
      const rise = Date.parse(sun.attributes.next_rising), set = Date.parse(sun.attributes.next_setting);
      if (sun.state === "above_horizon") {
        const riseToday = rise - 864e5;
        frac = Math.max(0, Math.min(1, (Date.now() - riseToday) / (set - riseToday)));
        txt = `zachód ${ctx.clock.hm(set)}`;
      } else {
        const len = set - rise > 0 ? set - rise : set + 864e5 - rise;
        txt = `wschód ${ctx.clock.hm(rise)}, zachód ${ctx.clock.hm(set)} · dzień ${Math.floor(len / 3600e3)} h ${Math.round((len % 3600e3) / 60000)} min`;
      }
    }
    const max = o.outdoor_illuminance ? Math.max(0, ...hist(o.outdoor_illuminance).filter(([t]) => t >= Date.now() - 864e5).map(([, v]) => num(v) ?? 0)) : null;
    const word = lux === null ? "" : lux < 10 ? "ciemno" : lux < 1000 ? "półmrok" : lux < 10000 ? "pochmurno" : lux < 40000 ? "jasno" : "pełne słońce";
    cells.push(cell("Słońce i światło",
      html`<div class="orow"><span class="hval">${lux === null ? (sun?.state === "above_horizon" ? "dzień" : "noc") : round(lux)}${lux === null ? nothing : html`<span class="u"> lx</span>`}</span><span class="hsub">${word}</span></div>`,
      `${txt}${max !== null ? ` · max 24 h ${round(max)} lx` : ""}`, sun ? sunArc(frac) : nothing));
  }
  if (o.outdoor_aqi || o.outdoor_pm25 || o.outdoor_pm10) {
    const aqi = num(st(ctx, o.outdoor_aqi));
    const lvlKey = st(ctx, o.outdoor_aqi_level) ?? (aqi !== null ? aqiFromValue(aqi) : undefined);
    const [lvl, col] = (lvlKey && AQI[lvlKey]) || [lvlKey ?? "", "var(--muted)"];
    cells.push(cell("Powietrze",
      html`<div class="orow"><span class="hval">${aqi === null ? "—" : round(aqi)}<span class="u"> CAQI</span></span>${lvl ? html`<span class="lvl" style="background:color-mix(in srgb, ${col} 18%, transparent);color:${col}">${lvl}</span>` : nothing}</div>`,
      html`${pmRow("pm25", "PM2,5", num(st(ctx, o.outdoor_pm25)))}${pmRow("pm10", "PM10", num(st(ctx, o.outdoor_pm10)))}`,
      o.outdoor_pm25 ? line(hist(o.outdoor_pm25), "var(--warn)", { lo: 0, hi: 35, marks: [[13, "var(--ok)"], [35, "var(--warn)"]] }) : nothing));
  }
  return cells.length ? html`<section class="outdoor" aria-label="Na zewnątrz">${cells}</section>` : nothing;
}
