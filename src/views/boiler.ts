// Zakładka Kocioł: stan i podzespoły, temperatury z 24 h, termostaty ogrzewania i ciepłej wody, gaz, ustawienia.

import { html, nothing, type TemplateResult } from "lit";
import { energyPrefs, sourcesOf } from "../data/energy";
import { daysAgo, monthsAgo, startOfDay, startOfMonth, sumSince } from "../data/stats";
import { f1, num, round } from "../format";
import { bars, multiLine, type Bar } from "../svg";
import { entityName, st, unitOf, type Ctx } from "./common";
import { MONTH_NAMES } from "./energy";
import { boilerState } from "./house";

const MONTHS = ["sty", "lut", "mar", "kwi", "maj", "cze", "lip", "sie", "wrz", "paź", "lis", "gru"];
// Nazwy trybów jak w polskim interfejsie HA.
const HVAC: Record<string, string> = { off: "Wyłączony", heat: "Grzanie", auto: "Automatyczny", heat_cool: "Grzanie/chłodzenie", cool: "Chłodzenie", dry: "Osuszanie", fan_only: "Tylko wentylator", eco: "Eko", electric: "Grzałka", gas: "Gaz", performance: "Wydajny", heat_pump: "Pompa ciepła", high_demand: "Duży pobór" };
// Sterownik Vaillant przez ebusd: heat_cool = tryb ręczny (stała temperatura dzienna), auto = harmonogram.
const EBUSD_MODES: Record<string, string> = { heat_cool: "Dzień (ręczny)", auto: "Harmonogram", off: "Wyłączony" };
const PRESET: Record<string, string> = { none: "Normalnie", boost: "Szybko", eco: "Eko", away: "Poza domem", comfort: "Komfort", home: "W domu", sleep: "Noc", activity: "Aktywność" };

function indicator(ctx: Ctx, id: string | null | undefined, label: string, onText = "pracuje", offText = "nie") {
  if (!id || !ctx.hass.states[id]) return nothing;
  const on = st(ctx, id) === "on";
  return html`<span class="ind ${on ? "on" : ""}"><i></i>${label}<small>${on ? onText : offText}</small></span>`;
}

function status(ctx: Ctx): TemplateResult | typeof nothing {
  const o = ctx.opts;
  const b = boilerState(ctx);
  if (!b) return nothing;
  const val = (id: string | null | undefined, digits = 1) => (id ? num(st(ctx, id)) : null);
  const pressure = val(o.boiler_pressure);
  const pCls = pressure === null ? "" : pressure < 1 || pressure > 2.5 ? "crit" : pressure < 1.2 || pressure > 2.2 ? "warn" : "ok";
  const flow = val(o.boiler_flow_temperature), ret = val(o.boiler_return_temperature), target = val(o.boiler_flow_target);
  const out = val(o.boiler_outdoor), outAvg = val(o.boiler_outdoor_avg);
  const tile = (label: string, v: number | null, sub: string) =>
    v === null ? nothing : html`<div class="hcell"><span class="hlabel">${label}</span><span class="hval">${f1(v)}<span class="u">°C</span></span><span class="hsub">${sub}</span></div>`;
  return html`<section class="sec"><h2>Kocioł</h2>
    <div class="cards two">
      <div class="ocell boilerhero ${b.burning ? "burn" : ""}">
        <span class="hlabel">Stan</span>
        <div class="orow"><span class="hval big">${b.text}</span><span class="hsub">${b.sub}</span></div>
        <div class="inds">
          ${indicator(ctx, o.boiler_flame, "Płomień", "pali się", "zgaszony")}
          ${indicator(ctx, o.boiler_ignition, "Zapłon", "trwa", "—")}
          ${indicator(ctx, o.boiler_pump, "Pompa", "pracuje", "stoi")}
          ${indicator(ctx, o.boiler_dhw_demand, "Ciepła woda", "potrzebna", "nie")}
        </div>
      </div>
      <div class="ocell">
        <span class="hlabel">Parametry</span>
        ${o.boiler_modulation ? html`<div class="row"><span>Moc palnika</span><b>${round(val(o.boiler_modulation))}%</b></div>` : nothing}
        ${o.boiler_fan_speed ? html`<div class="row"><span>Wentylator</span><b>${round(val(o.boiler_fan_speed))} obr./min</b></div>` : nothing}
        ${o.boiler_pressure ? html`<div class="row"><span>Ciśnienie wody</span><b class="volt ${pCls}">${f1(pressure)} bar</b></div>` : nothing}
        ${o.boiler_heat_curve ? html`<div class="row"><span>Krzywa grzewcza</span><b>${num(st(ctx, o.boiler_heat_curve))?.toLocaleString("pl-PL") ?? "—"}</b></div>` : nothing}
      </div>
    </div>
    <div class="house">
      ${tile("Zasilanie", flow, target !== null ? `cel ${f1(target)} °C` : "")}
      ${tile("Powrót", ret, flow !== null && ret !== null ? `różnica ${f1(flow - ret)} °C` : "")}
      ${tile("Na zewnątrz (kocioł)", out, outAvg !== null ? `średnia ${f1(outAvg)} °C` : "")}
      ${tile("Ciepła woda", val(o.dhw_temperature), o.dhw_target ? `cel ${f1(val(o.dhw_target))} °C` : "")}
    </div>
    ${multiLine(
      [
        { name: "zasilanie", color: "var(--ember)", points: ctx.hist.series(ctx.hass, o.boiler_flow_temperature ?? undefined) },
        { name: "cel zasilania", color: "var(--ember)", dashed: true, points: ctx.hist.series(ctx.hass, o.boiler_flow_target ?? undefined) },
        { name: "powrót", color: "var(--frost)", points: ctx.hist.series(ctx.hass, o.boiler_return_temperature ?? undefined) },
        { name: "na zewnątrz", color: "var(--muted)", points: ctx.hist.series(ctx.hass, o.boiler_outdoor ?? undefined) },
        { name: "ciepła woda", color: "var(--bath)", points: ctx.hist.series(ctx.hass, o.dhw_temperature ?? undefined) },
      ],
      { unit: "°" },
    )}
  </section>`;
}

function thermostat(ctx: Ctx, id: string | null | undefined, title: string, current?: string | null): TemplateResult | typeof nothing {
  if (!id || !ctx.hass.states[id]) return nothing;
  const c = ctx.hass.states[id];
  const a = c.attributes;
  const target = ctx.pending.get(`${id}#t`) ?? num(a.temperature);
  const now = current ? num(st(ctx, current)) : num(a.current_temperature);
  const modes: string[] = a.hvac_modes ?? a.operation_list ?? [];
  const presets: string[] = a.preset_modes ?? [];
  const water = id.startsWith("water_heater.");
  // Tryb specjalny sterownika (ebusd): Veto z godziną końca, inne tryby nazwą.
  const heating = id === ctx.opts.climate_heating;
  const sf = heating ? st(ctx, ctx.opts.boiler_sf_mode) : undefined;
  const veto = sf === "veto";
  const vetoEnd = [st(ctx, ctx.opts.veto_end_date), st(ctx, ctx.opts.veto_end_time)?.slice(0, 5)].filter((x) => x && !/^01\.01\.2019$|^00:00$/.test(x)).join(" ");
  const SF: Record<string, string> = { veto: "Veto", party: "Impreza", onedayaway: "Dzień poza domem", onedayathome: "Dzień w domu", ventilation: "Wietrzenie", holiday: "Urlop", hwcboost: "Szybka CWU" };
  const ebusd = heating && Boolean(ctx.opts.ebusd_zone_topic);
  const vetoHours = ctx.opts.boiler_settings?.find((e) => /veto.*duration|veto.*czas/i.test(e));
  return html`<div class="ocell thermo ${veto ? "veto" : ""}">
    <span class="hlabel">${title}</span>
    <div class="orow"><span class="hval big">${f1(now)}<span class="u">°C</span></span>
      <span class="step"><button type="button" aria-label="${title}: cel niżej" @click=${() => ctx.actions.stepTarget(id, -(num(a.target_temp_step) ?? 0.5))}>−</button>
        <output>${f1(target)}°</output>
        <button type="button" aria-label="${title}: cel wyżej" @click=${() => ctx.actions.stepTarget(id, num(a.target_temp_step) ?? 0.5)}>+</button></span></div>
    <span class="hsub">teraz · cel ${f1(target)} °C${a.hvac_action ? ` · ${a.hvac_action === "heating" ? "grzeje" : a.hvac_action === "idle" ? "czeka" : a.hvac_action}` : ""}</span>
    ${sf && sf !== "auto"
      ? html`<div class="vetobar"><b><svg class="lock" viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="7" width="10" height="7.5" rx="1.5" fill="currentColor"></rect><path d="M5.2 7V5a2.8 2.8 0 0 1 5.6 0v2" fill="none" stroke="currentColor" stroke-width="1.6"></path></svg>${SF[sf] ?? sf}${vetoEnd ? ` do ${vetoEnd}` : ""}</b>
          ${veto ? html`<button class="btn" type="button" @click=${() => ctx.actions.endVeto()}>Zakończ Veto</button>` : nothing}</div>`
      : nothing}
    ${ebusd && c.state !== "heat_cool" && c.state !== "off"
      ? html`<span class="hsub">W trybie Auto −/+ włącza Veto${vetoHours && num(st(ctx, vetoHours)) !== null ? ` na ${round(num(st(ctx, vetoHours)))} h` : ""} — potem wraca harmonogram.</span>`
      : nothing}
    ${modes.length
      ? html`<div class="chips">${modes.map((m) => html`<button type="button" class="mchip ${(water ? a.operation_mode : c.state) === m ? "on" : ""}"
          @click=${() => ctx.actions.setHvac(id, m)}>${(ebusd ? EBUSD_MODES[m] : undefined) ?? HVAC[m] ?? m}</button>`)}</div>`
      : nothing}
    ${presets.length
      ? html`<div class="chips">${presets.map((m) => html`<button type="button" class="mchip ${a.preset_mode === m ? "on" : ""}"
          @click=${() => ctx.actions.call("climate", "set_preset_mode", { entity_id: id, preset_mode: m })}>${PRESET[m] ?? m}</button>`)}</div>`
      : nothing}
  </div>`;
}

function gas(ctx: Ctx): TemplateResult | typeof nothing {
  const ids = ctx.opts.gas?.length ? ctx.opts.gas : sourcesOf(energyPrefs(ctx.hass, ctx.refresh), "gas");
  if (!ids.length) return nothing;
  const from = Math.min(daysAgo(29).getTime(), startOfMonth().getTime());
  const day = ctx.stats.get(ctx.hass, ids, "day", new Date(from), ctx.refresh);
  const month = ctx.stats.get(ctx.hass, ids, "month", monthsAgo(11), ctx.refresh);
  const names = ids.map((id) => String(ctx.hass.states[id]?.attributes.friendly_name ?? entityName(ctx.hass, id)));
  let p = names[0] ?? "";
  for (const n of names) while (!n.startsWith(p)) p = p.slice(0, -1);
  p = names.length > 1 ? p.slice(0, p.lastIndexOf(" ") + 1) : "";
  const label = (i: number) => names[i].slice(p.length) || names[i];
  const unit = unitOf(ctx.hass, ids[0]) || "m³";
  const colors = ["var(--ember)", "var(--bath)", "var(--frost)"];
  const pick = (rows: typeof day, start: number) => ids.map((id) => Math.max(0, (rows[id] ?? []).find((x) => x.start === start)?.change ?? 0));
  const DAYS = ["nd", "pn", "wt", "śr", "cz", "pt", "sb"];
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
      ${ids.map((id, i) => html`<div class="hcell"><span class="hlabel"><i class="sw" style="background:${colors[i % 3]}"></i>${label(i)}</span>
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

function settings(ctx: Ctx): TemplateResult | typeof nothing {
  const ids = (ctx.opts.boiler_settings ?? []).filter((id) => ctx.hass.states[id]);
  if (!ids.length) return nothing;
  return html`<section class="sec"><h2>Ustawienia</h2><div class="ocell list">
    ${ids.map((id) => {
      const a = ctx.hass.states[id].attributes;
      const v = ctx.pending.get(id) ?? num(st(ctx, id));
      const step = num(a.step) ?? 1;
      const digits = String(step).includes(".") ? String(step).split(".")[1].length : 0;
      return html`<div class="prof setrow"><span class="pl">${entityName(ctx.hass, id)}<small>${a.min ?? "—"}–${a.max ?? "—"} ${a.unit_of_measurement ?? ""}</small></span>
        <span class="step"><button type="button" aria-label="mniej" @click=${() => ctx.actions.stepNumber(id, -step)}>−</button>
          <output>${v === null ? "—" : v.toLocaleString("pl-PL", { minimumFractionDigits: digits, maximumFractionDigits: digits })}${a.unit_of_measurement ? ` ${a.unit_of_measurement}` : ""}</output>
          <button type="button" aria-label="więcej" @click=${() => ctx.actions.stepNumber(id, step)}>+</button></span></div>`;
    })}
  </div></section>`;
}

export function boilerView(ctx: Ctx): TemplateResult {
  const o = ctx.opts;
  const thermos = [thermostat(ctx, o.climate_heating, "Ogrzewanie"), thermostat(ctx, o.climate_dhw, "Ciepła woda", o.dhw_temperature)];
  const parts = [status(ctx), thermos.some((t) => t !== nothing) ? html`<section class="sec"><h2>Sterowanie</h2><div class="cards two">${thermos}</div></section>` : nothing, gas(ctx), settings(ctx)];
  return parts.every((p) => p === nothing)
    ? html`<div class="empty">Brak danych kotła. Wskaż encje w opcjach Hearth (sekcja Kocioł) — np. z ebusd.</div>`
    : html`${parts}`;
}
