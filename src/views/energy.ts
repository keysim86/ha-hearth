// Zakładka Energia: moc chwilowa i fazy, zużycie dziś / w miesiącu ze źródeł panelu Energia HA, odbiorniki.

import { html, nothing, type TemplateResult } from "lit";
import { energyPrefs, gridSources } from "../data/energy";
import { daysAgo, monthsAgo, startOfDay, startOfMonth, sumSince, type StatPoint } from "../data/stats";
import { f1, num, round } from "../format";
import { bars, boltIcon, line, type Bar } from "../svg";
import { cleanName, deviceName, entityName, st, unitOf, type Ctx } from "./common";

const MONTHS = ["sty", "lut", "mar", "kwi", "maj", "cze", "lip", "sie", "wrz", "paź", "lis", "gru"];
const ZONE_COLORS = ["var(--ember)", "var(--frost)", "var(--bath)", "var(--ok)", "var(--warn)", "var(--air)"];

/** Moc w W niezależnie od jednostki czujnika (W / kW). */
export function watts(ctx: Ctx, id?: string | null): number | null {
  const v = num(st(ctx, id));
  if (v === null) return null;
  return /^kW$/i.test(unitOf(ctx.hass, id)) ? v * 1000 : v;
}

export const fmtW = (w: number | null) => (w === null ? "—" : Math.abs(w) >= 1000 ? `${f1(w / 1000)} kW` : `${Math.round(w)} W`);

/** Wspólny początek nazw (np. „Zużycie energii G13s ”) do odcięcia. */
function commonPrefix(names: string[]): string {
  if (names.length < 2) return "";
  let p = names[0];
  for (const n of names) while (!n.startsWith(p)) p = p.slice(0, -1);
  return p.slice(0, p.lastIndexOf(" ") + 1);
}

function byDay(points: Record<string, StatPoint[]>, ids: string[]): Map<number, number[]> {
  const out = new Map<number, number[]>();
  ids.forEach((id, k) => {
    for (const p of points[id] ?? []) {
      if (!out.has(p.start)) out.set(p.start, ids.map(() => 0));
      out.get(p.start)![k] += Math.max(0, p.change ?? 0);
    }
  });
  return out;
}

function live(ctx: Ctx): TemplateResult | typeof nothing {
  const o = ctx.opts;
  const phasesP = o.phase_power ?? [], phasesU = o.phase_voltage ?? [];
  if (!o.power_total && !phasesP.length && !phasesU.length) return nothing;
  const total = watts(ctx, o.power_total);
  const n = Math.max(phasesP.length, phasesU.length);
  const phase = [...Array(n).keys()].map((i) => ({ p: watts(ctx, phasesP[i]), u: num(st(ctx, phasesU[i])) }));
  const maxP = Math.max(5750, ...phase.map((x) => x.p ?? 0));
  const uCls = (u: number | null) => (u === null ? "" : u < 207 || u > 253 ? "crit" : u < 220 || u > 245 ? "warn" : "ok");
  return html`<section class="sec"><h2>Teraz</h2><div class="cards two">
    ${o.power_total
      ? html`<div class="ocell"><span class="hlabel">Moc całkowita</span>
          <div class="orow"><span class="hval big">${fmtW(total)}</span><span class="hsub">${boltIcon}</span></div>
          <span class="hsub">ostatnie 24 h</span>${line(ctx.hist.series(ctx.hass, o.power_total), "var(--ember)", { lo: 0 })}</div>`
      : nothing}
    ${n
      ? html`<div class="ocell"><span class="hlabel">Fazy</span>
          ${phase.map((x, i) => html`<div class="phase">
            <b>L${i + 1}</b>
            <div class="pmbar"><i style="width:${Math.min(100, ((x.p ?? 0) / maxP) * 100).toFixed(0)}%;background:var(--ember)"></i></div>
            <span>${fmtW(x.p)}</span>
            <span class="volt ${uCls(x.u)}">${x.u === null ? "—" : `${round(x.u)} V`}</span>
          </div>`)}
          <span class="hsub">Napięcie: norma 230 V ±10% (207–253 V).</span></div>`
      : nothing}
  </div></section>`;
}

function usage(ctx: Ctx): TemplateResult | typeof nothing {
  const prefs = energyPrefs(ctx.hass, ctx.refresh);
  const grid = gridSources(prefs);
  if (!grid.length) return nothing;
  const ids = grid.map((g) => g.stat);
  const costIds = ids.map((id) => `${id}_cost`).filter((id) => ctx.hass.states[id]);
  const from = Math.min(daysAgo(29).getTime(), startOfMonth().getTime());
  const day = ctx.stats.get(ctx.hass, [...ids, ...costIds], "day", new Date(from), ctx.refresh);
  const month = ctx.stats.get(ctx.hass, ids, "month", monthsAgo(11), ctx.refresh);
  const t0 = startOfDay().getTime(), m0 = startOfMonth().getTime();
  const names = ids.map((id) => String(ctx.hass.states[id]?.attributes.friendly_name ?? id));
  const prefix = commonPrefix(names);
  const parts = ids.map((id, i) => ({ name: names[i].slice(prefix.length) || names[i], today: sumSince(day[id], t0), month: sumSince(day[id], m0) }));
  const today = parts.reduce((s, p) => s + p.today, 0), monthSum = parts.reduce((s, p) => s + p.month, 0);
  const cost = (since: number) => costIds.reduce((s, id) => s + sumSince(day[id], since), 0);
  const currency = costIds.length ? unitOf(ctx.hass, costIds[0]) || "zł" : "";
  const price = grid.find((g) => g.price)?.price;
  const chips = (key: "today" | "month") =>
    parts.filter((p) => p[key] > 0.005).sort((a, b) => b[key] - a[key]).map((p) => html`<span class="zchip">${p.name} <b>${f1(p[key])}</b></span>`);
  const days = byDay(day, ids);
  const dayBars: Bar[] = [...Array(30).keys()].reverse().map((k) => {
    const d = daysAgo(k);
    return { label: `${d.getDate()}`, values: [(days.get(d.getTime()) ?? []).reduce((a, b) => a + b, 0)], now: k === 0 };
  });
  const months = byDay(month, ids);
  const monthBars: Bar[] = [...Array(12).keys()].reverse().map((k) => {
    const d = monthsAgo(k);
    return { label: MONTHS[d.getMonth()], values: [(months.get(d.getTime()) ?? []).reduce((a, b) => a + b, 0)], now: k === 0 };
  });
  const tariff = ctx.opts.tariff ? st(ctx, ctx.opts.tariff) : undefined;
  return html`<section class="sec"><h2>Zużycie prądu <small>z panelu Energia</small></h2>
    <div class="cards two">
      <div class="ocell"><span class="hlabel">Dziś</span>
        <div class="orow"><span class="hval big">${f1(today)}<span class="u"> kWh</span></span>${costIds.length ? html`<span class="hsub">≈ ${f1(cost(t0))} ${currency}</span>` : nothing}</div>
        <div class="zchips">${chips("today")}</div>
        <span class="hsub">${tariff ? `strefa teraz: ${tariff.toLowerCase()}` : ""}${price && num(st(ctx, price)) !== null ? `${tariff ? " · " : ""}cena ${num(st(ctx, price))!.toLocaleString("pl-PL", { maximumFractionDigits: 4 })} ${unitOf(ctx.hass, price)}` : ""}</span>
      </div>
      <div class="ocell"><span class="hlabel">Ten miesiąc</span>
        <div class="orow"><span class="hval big">${round(monthSum)}<span class="u"> kWh</span></span>${costIds.length ? html`<span class="hsub">≈ ${round(cost(m0))} ${currency}</span>` : nothing}</div>
        <div class="zchips">${chips("month")}</div>
      </div>
    </div>
    <div class="cards two">
      <div class="ocell"><span class="hlabel">Ostatnie 30 dni</span>${bars(dayBars, [ZONE_COLORS[0]], { unit: "kWh", every: 5 })}</div>
      <div class="ocell"><span class="hlabel">Ostatnie 12 miesięcy</span>${bars(monthBars, [ZONE_COLORS[1]], { unit: "kWh", every: 1, digits: 0 })}</div>
    </div>
  </section>`;
}

interface Consumer {
  name: string;
  power?: string;
  energy?: string;
}

function consumersList(ctx: Ctx): Consumer[] {
  const h = ctx.hass;
  const sameDevice = (id: string, test: (e: string) => boolean) => {
    const d = h.entities[id]?.device_id;
    return d ? Object.values(h.entities).find((e) => e.device_id === d && e.entity_id.startsWith("sensor.") && test(e.entity_id))?.entity_id : undefined;
  };
  const isPower = (e: string) => h.states[e]?.attributes.device_class === "power" || /^k?W$/.test(unitOf(h, e));
  const isEnergy = (e: string) => h.states[e]?.attributes.device_class === "energy" || /^[kM]?Wh$/.test(unitOf(h, e));
  if (ctx.opts.consumers?.length)
    return ctx.opts.consumers.map((p) => ({ name: cleanName(deviceName(h, p) ?? entityName(h, p)), power: p, energy: sameDevice(p, isEnergy) }));
  const prefs = energyPrefs(h, ctx.refresh);
  return (prefs?.device_consumption ?? []).map((d) => ({
    name: d.name || cleanName(deviceName(h, d.stat_consumption) || entityName(h, d.stat_consumption)),
    energy: d.stat_consumption,
    power: d.stat_rate || sameDevice(d.stat_consumption, isPower),
  }));
}

function consumers(ctx: Ctx): TemplateResult | typeof nothing {
  const list = consumersList(ctx);
  if (!list.length) return nothing;
  const today = ctx.stats.get(ctx.hass, list.map((c) => c.energy ?? "").filter(Boolean), "day", startOfDay(), ctx.refresh);
  const rows = list
    .map((c) => ({ ...c, w: watts(ctx, c.power), kwh: c.energy ? sumSince(today[c.energy], startOfDay().getTime()) : null }))
    .sort((a, b) => (b.w ?? -1) - (a.w ?? -1) || (b.kwh ?? 0) - (a.kwh ?? 0));
  const max = Math.max(100, ...rows.map((r) => r.w ?? 0));
  const row = (r: (typeof rows)[number]) => html`<div class="crow">
    <span class="cname">${r.name}</span>
    <div class="pmbar"><i style="width:${Math.min(100, ((r.w ?? 0) / max) * 100).toFixed(1)}%;background:var(--ember)"></i></div>
    <b>${fmtW(r.w)}</b>
    <span class="ckwh">${r.kwh === null ? "" : `${f1(r.kwh)} kWh dziś`}</span>
  </div>`;
  const active = rows.filter((r) => (r.w ?? 0) >= 1), idle = rows.filter((r) => (r.w ?? 0) < 1);
  return html`<section class="sec"><h2>Odbiorniki <small>${active.length} z ${rows.length} pobiera prąd</small></h2>
    <div class="ocell list">${active.map(row)}
      ${idle.length ? html`<details><summary>Pozostałe (${idle.length}) — bez poboru</summary>${idle.map(row)}</details>` : nothing}
    </div></section>`;
}

export function energyView(ctx: Ctx): TemplateResult {
  const parts = [live(ctx), usage(ctx), consumers(ctx)];
  return parts.every((p) => p === nothing)
    ? html`<div class="empty">Brak danych o energii. Dodaj sieć i urządzenia w panelu Energia HA albo czujnik mocy w opcjach Hearth (sekcja Energia).</div>`
    : html`${parts}`;
}
