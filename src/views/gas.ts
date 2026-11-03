// Gaz: dziś i w miesiącu, ostatnie 30 dni, 12 miesięcy i lata. Strona Zużycie → Gaz (dawniej na zakładce Kocioł;
// bez zakładki Energia zostaje tam). Źródła: opcja gas, a bez niej źródła gazu z panelu Energia HA.

import { html, nothing, type TemplateResult } from "lit";
import { energyPrefs, sourcesOf } from "../data/energy";
import { daysAgo, monthsAgo, startOfDay, startOfMonth, sumSince } from "../data/stats";
import { f1 } from "../format";
import { bars, type Bar } from "../svg";
import { entityName, unitOf, type Ctx } from "./common";
import { MONTH_NAMES } from "./energy";

const MONTHS = ["sty", "lut", "mar", "kwi", "maj", "cze", "lip", "sie", "wrz", "paź", "lis", "gru"];
const DAYS = ["nd", "pn", "wt", "śr", "cz", "pt", "sb"];

export function gasIds(ctx: Ctx): string[] {
  return ctx.opts.gas?.length ? ctx.opts.gas : sourcesOf(energyPrefs(ctx.hass, ctx.refresh), "gas");
}

/** Początek okna dziennego: 30 dni albo od początku miesiąca (wspólny klucz pamięci statystyk). */
const dayFrom = () => new Date(Math.min(daysAgo(29).getTime(), startOfMonth().getTime()));

/** Gaz od północy, wszystkie źródła razem. */
export function gasToday(ctx: Ctx): { value: number; unit: string } | null {
  const ids = gasIds(ctx);
  if (!ids.length) return null;
  const day = ctx.stats.get(ctx.hass, ids, "day", dayFrom(), ctx.refresh);
  const t0 = startOfDay().getTime();
  return { value: ids.reduce((a, id) => a + sumSince(day[id], t0), 0), unit: unitOf(ctx.hass, ids[0]) || "m³" };
}

export function gasView(ctx: Ctx): TemplateResult | typeof nothing {
  const ids = gasIds(ctx);
  if (!ids.length) return nothing;
  const day = ctx.stats.get(ctx.hass, ids, "day", dayFrom(), ctx.refresh);
  const month = ctx.stats.get(ctx.hass, ids, "month", monthsAgo(11), ctx.refresh);
  const names = ids.map((id) => String(ctx.hass.states[id]?.attributes.friendly_name ?? entityName(ctx.hass, id)));
  let p = names[0] ?? "";
  for (const n of names) while (!n.startsWith(p)) p = p.slice(0, -1);
  p = names.length > 1 ? p.slice(0, p.lastIndexOf(" ") + 1) : "";
  const label = (i: number) => names[i].slice(p.length) || names[i];
  const unit = unitOf(ctx.hass, ids[0]) || "m³";
  const colors = ["var(--ember)", "var(--bath)", "var(--frost)"];
  const pick = (rows: typeof day, start: number) => ids.map((id) => Math.max(0, (rows[id] ?? []).find((x) => x.start === start)?.change ?? 0));
  const dayBars: Bar[] = [...Array(30).keys()].reverse().map((k) => {
    const d = daysAgo(k);
    return { label: `${d.getDate()}`, title: `${DAYS[d.getDay()]} ${d.getDate()}.${String(d.getMonth() + 1).padStart(2, "0")}${k === 0 ? " (dziś)" : ""}`, values: pick(day, d.getTime()), now: k === 0 };
  });
  const monthBars: Bar[] = [...Array(12).keys()].reverse().map((k) => {
    const d = monthsAgo(k);
    return { label: MONTHS[d.getMonth()], title: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}${k === 0 ? " (do dziś)" : ""}`, values: pick(month, d.getTime()), now: k === 0 };
  });
  const seriesNames = ids.map((_, i) => label(i).charAt(0).toUpperCase() + label(i).slice(1));
  // Lata: okres roczny ze statystyk (dane są od początku zapisu statystyk w HA).
  const yearStart = new Date(new Date().getFullYear() - 9, 0, 1);
  const year = ctx.stats.get(ctx.hass, ids, "year", yearStart, ctx.refresh);
  const years = [...new Set(ids.flatMap((id) => (year[id] ?? []).map((x) => new Date(x.start).getFullYear())))].sort();
  const yearBars: Bar[] = years.map((y) => ({
    label: String(y),
    title: `${y}${y === new Date().getFullYear() ? " (do dziś)" : ""}`,
    values: ids.map((id) => Math.max(0, (year[id] ?? []).filter((x) => new Date(x.start).getFullYear() === y).reduce((a, x) => a + (x.change ?? 0), 0))),
    now: y === new Date().getFullYear(),
  }));
  const t0 = startOfDay().getTime(), m0 = startOfMonth().getTime();
  return html`<section class="sec"><h2>Gaz</h2>
    <div class="house">
      ${ids.map((id, i) => html`<div class="hcell"><span class="hlabel"><i class="swatch" style="background:${colors[i % 3]}"></i>${label(i)}</span>
        <span class="hval">${f1(sumSince(day[id], t0))}<span class="u"> ${unit}</span></span>
        <span class="hsub">dziś · w miesiącu ${f1(sumSince(day[id], m0))} ${unit}</span></div>`)}
    </div>
    <div class="cards two">
      <div class="ocell"><span class="hlabel">Ostatnie 30 dni</span>${bars(dayBars, colors, { unit, every: 3, names: seriesNames, valueLabels: "dense" })}</div>
      <div class="ocell"><span class="hlabel">Ostatnie 12 miesięcy</span>${bars(monthBars, colors, { unit, every: 1, digits: 0, names: seriesNames, valueLabels: true })}</div>
    </div>
    ${yearBars.length
      ? html`<div class="ocell"><span class="hlabel">Po latach <small>od początku statystyk w HA</small></span>${bars(yearBars, colors, { unit, every: 1, digits: 0, names: seriesNames, valueLabels: true, height: 120 })}</div>`
      : nothing}
  </section>`;
}
