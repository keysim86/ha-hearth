// Ciepło → Kocioł. Strona główna dla domu: stan kotła, ciepła woda, ciśnienie i program jednym rzutem oka, termostaty.
// Strony tylko dla administratora HA: Program tygodnia (harmonogramy sterownika przez ebusd — odczyt MQTT wymaga
// administratora) i Serwis (podzespoły, parametry, temperatury z 24 h, nastawy). Gaz jest w Zużycie → Gaz.

import { html, nothing, type TemplateResult } from "lit";
import { f1, num, round } from "../format";
import { multiLine } from "../svg";
import { entityName, roll, st, timeSel, type Ctx } from "./common";
import { gasToday, gasView } from "./gas";
import { boilerState } from "./house";
import { DAY_PL, DAY_SHORT, toMin, type Circuit, type Slot } from "../data/ebusd";

// Nazwy trybów jak w polskim interfejsie HA.
const HVAC: Record<string, string> = { off: "Wyłączony", heat: "Grzanie", auto: "Automatyczny", heat_cool: "Grzanie/chłodzenie", cool: "Chłodzenie", dry: "Osuszanie", fan_only: "Tylko wentylator", eco: "Eko", electric: "Grzałka", gas: "Gaz", performance: "Wydajny", heat_pump: "Pompa ciepła", high_demand: "Duży pobór" };
// Sterownik Vaillant przez ebusd: heat_cool = tryb ręczny (stała temperatura dzienna), auto = harmonogram.
const EBUSD_MODES: Record<string, string> = { heat_cool: "Dzień (ręczny)", auto: "Harmonogram", off: "Wyłączony" };
const PRESET: Record<string, string> = { none: "Normalnie", boost: "Szybko", eco: "Eko", away: "Poza domem", comfort: "Komfort", home: "W domu", sleep: "Noc", activity: "Aktywność" };
const SF: Record<string, string> = { veto: "Veto", party: "Impreza", onedayaway: "Dzień poza domem", onedayathome: "Dzień w domu", ventilation: "Wietrzenie", holiday: "Urlop", hwcboost: "Szybka CWU" };

/** Link do innej strony panelu (np. Zużycie → Gaz); brak, gdy tej strony nie ma. */
export interface PageLink { href: string; go: (e: MouseEvent) => void }

function indicator(ctx: Ctx, id: string | null | undefined, label: string, onText = "pracuje", offText = "nie") {
  if (!id || !ctx.hass.states[id]) return nothing;
  const on = st(ctx, id) === "on";
  return html`<span class="ind ${on ? "on" : ""}"><i></i>${label}<small>${on ? onText : offText}</small></span>`;
}

const val = (ctx: Ctx, id: string | null | undefined) => (id ? num(st(ctx, id)) : null);

/** Ciśnienie wody w instalacji: klasa koloru i zdanie, co z tym zrobić. */
export function pressureInfo(p: number | null): { cls: string; note: string } {
  if (p === null) return { cls: "", note: "brak odczytu" };
  if (p < 1) return { cls: "crit", note: "za niskie — uzupełnij wodę" };
  if (p > 2.5) return { cls: "crit", note: "za wysokie — sprawdź kocioł" };
  if (p < 1.2) return { cls: "warn", note: "niskie — wkrótce uzupełnij wodę" };
  if (p > 2.2) return { cls: "warn", note: "wysokie" };
  return { cls: "ok", note: "w normie · 1,0–2,5" };
}

/** Koniec Veto ze sterownika („01.01.2019” i „00:00” znaczą brak). */
function vetoEnd(ctx: Ctx): string {
  return [st(ctx, ctx.opts.veto_end_date), st(ctx, ctx.opts.veto_end_time)?.slice(0, 5)].filter((x) => x && !/^01\.01\.2019$|^00:00$/.test(x)).join(" ");
}

/** Program strefy na teraz z harmonogramu sterownika: przedział dzienny albo temperatura obniżona do następnego. */
function programNow(ctx: Ctx): { value: string; sub: string } | null {
  const week = ctx.timers?.week("zone");
  if (!week) return null;
  const slots = week[(new Date().getDay() + 6) % 7] ?? [];
  const now = ctx.nowMinute;
  const setback = num(ctx.timers?.value("NightTemp")?.replace(",", "."));
  const low = setback !== null ? `${f1(setback)}°` : "obniżona";
  const cur = slots.find((s) => toMin(s.from) <= now && now < toMin(s.to));
  if (cur) return { value: cur.temp !== null ? `${f1(cur.temp)}°` : "dzień", sub: `dzień do ${cur.to}, potem ${low}` };
  const next = slots.find((s) => toMin(s.from) > now);
  return { value: low, sub: `obniżona · ${next ? `od ${next.from}${next.temp !== null ? ` ${f1(next.temp)}°` : ""}` : "do jutra"}` };
}

/** Komórka „Program”: Veto, tryb ręczny, wyłączone albo przedział z harmonogramu. */
function programCell(ctx: Ctx): { value: string; sub: string } | null {
  const id = ctx.opts.climate_heating;
  const c = id ? ctx.hass.states[id] : undefined;
  if (!c) return programNow(ctx);
  const target = num(c.attributes.temperature);
  const sf = st(ctx, ctx.opts.boiler_sf_mode);
  if (sf && sf !== "auto" && sf !== "unknown" && sf !== "unavailable") {
    const end = sf === "veto" ? vetoEnd(ctx) : "";
    return { value: target !== null ? `${f1(target)}°` : SF[sf] ?? sf, sub: `${SF[sf] ?? sf}${end ? ` do ${end}` : ""}, potem harmonogram` };
  }
  if (c.state === "off") return { value: "wyłączone", sub: "ogrzewanie wyłączone w sterowniku" };
  if (c.state === "heat_cool" && ctx.opts.ebusd_zone_topic) return { value: target !== null ? `${f1(target)}°` : "dzień", sub: "dzień ręcznie, bez harmonogramu" };
  return programNow(ctx) ?? (target !== null ? { value: `${f1(target)}°`, sub: (ctx.opts.ebusd_zone_topic ? EBUSD_MODES[c.state] : undefined) ?? HVAC[c.state] ?? c.state } : null);
}

/** Strona główna: cztery odpowiedzi (czy grzeje, czy jest ciepła woda, czy ciśnienie w normie, jaki program) i zdanie pod spodem. */
function summary(ctx: Ctx, gasLink?: PageLink): TemplateResult | typeof nothing {
  const o = ctx.opts;
  const b = boilerState(ctx);
  const cells: TemplateResult[] = [];
  const cell = (label: string, value: string, sub: string, cls = "") =>
    html`<div class="hcell ${cls}"><span class="hlabel">${label}</span><span class="hval">${roll(value)}</span><span class="hsub">${sub}</span></div>`;
  const flow = val(ctx, o.boiler_flow_temperature), mod = val(ctx, o.boiler_modulation);
  if (b)
    cells.push(cell("Kocioł", b.text, [b.burning ? `płomień${mod !== null ? ` · moc ${round(mod)}%` : ""}` : "palnik wyłączony", flow !== null ? `zasilanie ${f1(flow)}°` : ""].filter(Boolean).join(" · "), b.burning ? "burn" : ""));
  const dhw = val(ctx, o.dhw_temperature) ?? (o.climate_dhw ? num(ctx.hass.states[o.climate_dhw]?.attributes.current_temperature) : null);
  const dhwTarget = val(ctx, o.dhw_target) ?? (o.climate_dhw ? num(ctx.hass.states[o.climate_dhw]?.attributes.temperature) : null);
  if (dhw !== null) {
    const boost = o.climate_dhw ? ctx.hass.states[o.climate_dhw]?.attributes.preset_mode === "boost" : false;
    const how = st(ctx, o.boiler_dhw_demand) === "on" ? "podgrzewa się" : boost ? "podgrzewanie jednorazowe"
      : dhwTarget === null ? "" : dhw >= dhwTarget - 3 ? "gotowa" : "chłodniejsza od celu";
    cells.push(cell("Ciepła woda", `${f1(dhw)}°`, [dhwTarget !== null ? `cel ${f1(dhwTarget)}°` : "", how].filter(Boolean).join(" · ")));
  }
  const p = val(ctx, o.boiler_pressure);
  if (o.boiler_pressure) {
    const pi = pressureInfo(p);
    cells.push(cell("Ciśnienie wody", p === null ? "—" : `${f1(p)} bar`, pi.note, pi.cls === "ok" ? "" : pi.cls));
  }
  const prog = programCell(ctx);
  if (prog) cells.push(cell("Program", prog.value, prog.sub));
  if (!cells.length) return nothing;
  const out = val(ctx, o.boiler_outdoor), outAvg = val(ctx, o.boiler_outdoor_avg);
  const gas = gasLink ? gasToday(ctx) : null;
  const why = [
    out !== null ? html`<span>Na zewnątrz ${f1(out)} °C${outAvg !== null ? ` (średnia ${f1(outAvg)} °C)` : ""}</span>` : nothing,
    gas && gasLink ? html`<a href=${gasLink.href} @click=${gasLink.go}>Gaz dziś ${f1(gas.value)} ${gas.unit} ›</a>` : nothing,
  ].filter((x) => x !== nothing);
  return html`<section class="sec"><h2>Kocioł</h2>
    <div class="house bsum">${cells}</div>
    ${why.length ? html`<div class="bwhy">${why}</div>` : nothing}
  </section>`;
}

/** Serwis: podzespoły, parametry pracy, temperatury instalacji i ich przebieg z 24 h. */
function service(ctx: Ctx): TemplateResult | typeof nothing {
  const o = ctx.opts;
  const b = boilerState(ctx);
  if (!b) return nothing;
  const pressure = val(ctx, o.boiler_pressure);
  const pCls = pressureInfo(pressure).cls;
  const flow = val(ctx, o.boiler_flow_temperature), ret = val(ctx, o.boiler_return_temperature), target = val(ctx, o.boiler_flow_target);
  const out = val(ctx, o.boiler_outdoor), outAvg = val(ctx, o.boiler_outdoor_avg);
  const tile = (label: string, v: number | null, sub: string) =>
    v === null ? nothing : html`<div class="hcell"><span class="hlabel">${label}</span><span class="hval">${f1(v)}<span class="u">°C</span></span><span class="hsub">${sub}</span></div>`;
  return html`<section class="sec"><h2>Praca kotła <small>tylko administrator</small></h2>
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
        ${o.boiler_modulation ? html`<div class="row"><span>Moc palnika</span><b>${round(val(ctx, o.boiler_modulation))}%</b></div>` : nothing}
        ${o.boiler_fan_speed ? html`<div class="row"><span>Wentylator</span><b>${round(val(ctx, o.boiler_fan_speed))} obr./min</b></div>` : nothing}
        ${o.boiler_pressure ? html`<div class="row"><span>Ciśnienie wody</span><b class="volt ${pCls}">${f1(pressure)} bar</b></div>` : nothing}
        ${o.boiler_heat_curve ? html`<div class="row"><span>Krzywa grzewcza</span><b>${num(st(ctx, o.boiler_heat_curve))?.toLocaleString("pl-PL") ?? "—"}</b></div>` : nothing}
      </div>
    </div>
    <div class="house">
      ${tile("Zasilanie", flow, target !== null ? `cel ${f1(target)} °C` : "")}
      ${tile("Powrót", ret, flow !== null && ret !== null ? `różnica ${f1(flow - ret)} °C` : "")}
      ${tile("Na zewnątrz (kocioł)", out, outAvg !== null ? `średnia ${f1(outAvg)} °C` : "")}
      ${tile("Ciepła woda", val(ctx, o.dhw_temperature), o.dhw_target ? `cel ${f1(val(ctx, o.dhw_target))} °C` : "")}
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
  // Ciepła woda: „boost” to jednorazowe podgrzanie zasobnika.
  const dhw = water || id === ctx.opts.climate_dhw;
  const presetLabel = (m: string) => (dhw && m === "boost" ? "Podgrzej teraz" : PRESET[m] ?? m);
  // Tryb specjalny sterownika (ebusd): Veto z godziną końca, inne tryby nazwą.
  const heating = id === ctx.opts.climate_heating;
  const sf = heating ? st(ctx, ctx.opts.boiler_sf_mode) : undefined;
  const veto = sf === "veto";
  const end = veto ? vetoEnd(ctx) : "";
  const ebusd = heating && Boolean(ctx.opts.ebusd_zone_topic);
  const vetoHours = ctx.opts.boiler_settings?.find((e) => /veto.*duration|veto.*czas/i.test(e));
  return html`<div class="ocell thermo ${veto ? "veto" : ""}">
    <span class="hlabel">${title}</span>
    <div class="orow"><span class="hval big">${f1(now)}<span class="u">°C</span></span>
      <span class="step"><button type="button" aria-label="${title}: cel niżej" @click=${() => ctx.actions.stepTarget(id, -(num(a.target_temp_step) ?? 0.5))}>−</button>
        <output>${f1(target)}°</output>
        <button type="button" aria-label="${title}: cel wyżej" @click=${() => ctx.actions.stepTarget(id, num(a.target_temp_step) ?? 0.5)}>+</button></span></div>
    <span class="hsub">teraz · cel ${f1(target)} °C${a.hvac_action ? ` · ${a.hvac_action === "heating" ? "grzeje" : a.hvac_action === "idle" ? "czeka" : a.hvac_action}` : ""}</span>
    ${sf && sf !== "auto" && sf !== "unknown" && sf !== "unavailable"
      ? html`<div class="vetobar"><b><svg class="lock" viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="7" width="10" height="7.5" rx="1.5" fill="currentColor"></rect><path d="M5.2 7V5a2.8 2.8 0 0 1 5.6 0v2" fill="none" stroke="currentColor" stroke-width="1.6"></path></svg>${SF[sf] ?? sf}${end ? ` do ${end}` : ""}</b>
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
          @click=${() => ctx.actions.call("climate", "set_preset_mode", { entity_id: id, preset_mode: m })}>${presetLabel(m)}</button>`)}</div>`
      : nothing}
  </div>`;
}

function settings(ctx: Ctx): TemplateResult | typeof nothing {
  const ids = (ctx.opts.boiler_settings ?? []).filter((id) => ctx.hass.states[id]);
  if (!ids.length) return nothing;
  return html`<section class="sec"><h2>Nastawy</h2><div class="ocell list">
    ${ids.map((id) => {
      const a = ctx.hass.states[id].attributes;
      const v = ctx.pending.get(id) ?? num(st(ctx, id));
      const step = num(a.step) ?? 1;
      const digits = String(step).includes(".") ? String(step).split(".")[1].length : 0;
      return html`<div class="prof setrow"><span class="pl">${entityName(ctx.hass, id)}<small>${a.min ?? "—"}–${a.max ?? "—"} ${a.unit_of_measurement ?? ""}</small></span>
        <span class="step"><button type="button" aria-label="${entityName(ctx.hass, id)}: mniej" @click=${() => ctx.actions.stepNumber(id, -step)}>−</button>
          <output>${v === null ? "—" : v.toLocaleString("pl-PL", { minimumFractionDigits: digits, maximumFractionDigits: digits })}${a.unit_of_measurement ? ` ${a.unit_of_measurement}` : ""}</output>
          <button type="button" aria-label="${entityName(ctx.hass, id)}: więcej" @click=${() => ctx.actions.stepNumber(id, step)}>+</button></span></div>`;
    })}
  </div></section>`;
}

const EMPTY = html`<div class="empty">Brak danych kotła. Wskaż encje w opcjach Hearth (sekcja Kocioł) — np. z ebusd.</div>`;

/**
 * page: undefined = strona główna, "program" = harmonogramy, "serwis" = parametry i nastawy.
 * gasLink: Zużycie → Gaz istnieje — tu tylko zdanie z linkiem; bez niego wykresy gazu zostają na stronie głównej.
 */
export function boilerView(ctx: Ctx, page?: string, gasLink?: PageLink): TemplateResult {
  const o = ctx.opts;
  if (page === "program") {
    const s = schedules(ctx);
    return s === nothing ? html`<div class="empty">Sterownik nie podał jeszcze harmonogramów (ebusd przez MQTT). Zajrzyj za chwilę.</div>` : html`${s}`;
  }
  if (page === "serwis") {
    const parts = [service(ctx), settings(ctx)];
    return parts.every((p) => p === nothing) ? EMPTY : html`${parts}`;
  }
  const thermos = [thermostat(ctx, o.climate_heating, "Ogrzewanie"), thermostat(ctx, o.climate_dhw, "Ciepła woda", o.dhw_temperature)];
  const parts = [summary(ctx, gasLink), thermos.some((t) => t !== nothing) ? html`<section class="sec"><h2>Sterowanie</h2><div class="cards two">${thermos}</div></section>` : nothing, gasLink ? nothing : gasView(ctx)];
  return parts.every((p) => p === nothing) ? EMPTY : html`${parts}`;
}

// ---- harmonogramy sterownika (ebusd) ----

export interface SchedEdit {
  circuit: Circuit;
  day: number;
  slots: Slot[];
  error?: string;
}

const CIRCUITS: Array<[Circuit, string, boolean]> = [["zone", "Ogrzewanie", true], ["hwc", "Ciepła woda", true], ["cc", "Cyrkulacja", false]];

export function schedules(ctx: Ctx): TemplateResult | typeof nothing {
  const t = ctx.timers;
  if (!t) return nothing;
  const available = CIRCUITS.filter(([c]) => t.week(c));
  if (!available.length)
    return t.connected ? nothing : html`<section class="sec"><h2>Harmonogramy</h2><div class="empty">Harmonogramy ze sterownika czytam przez MQTT — wymaga konta administratora HA.</div></section>`;
  const circuit = (available.find(([c]) => c === ctx.ui.sched)?.[0] ?? available[0][0]) as Circuit;
  const withTemp = CIRCUITS.find(([c]) => c === circuit)![2];
  const week = t.week(circuit)!;
  const edit = ctx.sched?.circuit === circuit ? ctx.sched : null;
  const setback = circuit === "zone" ? t.value("NightTemp") : null;
  const pct = (m: number) => `${((m / 1440) * 100).toFixed(2)}%`;
  const label = (s: Slot) => `${s.from}–${s.to}${s.temp !== null && withTemp ? ` ${f1(s.temp)}°` : ""}`;
  return html`<section class="sec"><h2>Harmonogramy <small>sterownik przez ebusd</small></h2>
    <div class="seg2" role="tablist" aria-label="Obwód">${available.map(
      ([c, name]) => html`<button type="button" role="tab" aria-selected=${c === circuit ? "true" : "false"} class=${c === circuit ? "on" : ""}
        @click=${() => { ctx.actions.setUi("sched", c); ctx.actions.schedClose(); }}>${name}</button>`,
    )}</div>
    <div class="ocell week">
      ${week.map((slots, d) => html`<button type="button" class="wday ${edit?.day === d ? "sel" : ""}" @click=${() => ctx.actions.schedOpen(circuit, d, slots)}>
        <b>${DAY_SHORT[d]}</b>
        <span class="wbar">${slots.map((s) => html`<i style="left:${pct(toMin(s.from))};width:${pct(toMin(s.to) - toMin(s.from))}" title=${label(s)}></i>`)}
          ${[6, 12, 18].map((h) => html`<em style="left:${pct(h * 60)}"></em>`)}</span>
        <span class="wtxt">${slots.length ? slots.map(label).join(" · ") : "wyłączone cały dzień"}</span>
      </button>`)}
      <div class="wday wscale" aria-hidden="true"><span></span><span class="wticks">${[0, 6, 12, 18, 24].map((h) => html`<em style="left:${pct(h * 60)}">${h}</em>`)}</span><span></span></div>
      <span class="hsub">${circuit === "zone"
        ? `W przedziałach temperatura z przedziału, poza nimi obniżona${setback ? ` (${setback.replace(".", ",")} °C)` : ""}.`
        : circuit === "hwc" ? "W przedziałach zasobnik jest grzany do temperatury z przedziału." : "W przedziałach pracuje pompa cyrkulacji."} Kliknij dzień, żeby zmienić.</span>
    </div>
    ${edit ? editor(ctx, edit, withTemp) : nothing}
  </section>`;
}


function editor(ctx: Ctx, e: SchedEdit, withTemp: boolean): TemplateResult {
  const upd = (i: number, k: keyof Slot, v: string) => {
    const slots = e.slots.map((s, j) => (j === i ? { ...s, [k]: k === "temp" ? parseFloat(v.replace(",", ".")) : v } : s));
    ctx.actions.schedEdit(slots);
  };
  const add = () => {
    const last = e.slots[e.slots.length - 1];
    const start = last ? Math.min(toMin(last.to) + 60, 22 * 60) : 6 * 60;
    const hm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
    ctx.actions.schedEdit([...e.slots, { from: hm(start), to: hm(Math.min(start + 120, 1440 - 10)), temp: last?.temp ?? (e.circuit === "hwc" ? 45 : 21) }]);
  };
  const tmin = e.circuit === "hwc" ? 35 : 5, tmax = e.circuit === "hwc" ? 70 : 30;
  return html`<div class="ocell sched">
    <div class="dhead"><h3>${DAY_PL[e.day]} — ${CIRCUITS.find(([c]) => c === e.circuit)![1].toLowerCase()}</h3>
      <button class="btn" type="button" @click=${() => ctx.actions.schedClose()}>Anuluj</button></div>
    ${e.slots.map((s, i) => html`<div class="srow">
      <span class="snum">${i + 1}.</span>
      <label>od ${timeSel(s.from, `Przedział ${i + 1} od`, (v) => upd(i, "from", v))}</label>
      <label>do ${timeSel(s.to, `Przedział ${i + 1} do`, (v) => upd(i, "to", v))}</label>
      ${withTemp
        ? html`<label><input type="number" min=${tmin} max=${tmax} step="0.5" .value=${String(s.temp ?? "")} @change=${(ev: Event) => upd(i, "temp", (ev.target as HTMLInputElement).value)} /> °C</label>`
        : nothing}
      <button class="btn" type="button" ?disabled=${e.slots.length <= 1} @click=${() => ctx.actions.schedEdit(e.slots.filter((_, j) => j !== i))} aria-label="Usuń przedział ${i + 1}">Usuń</button>
    </div>`)}
    <div class="acts">
      <button class="btn" type="button" ?disabled=${e.slots.length >= 3} @click=${add}>+ Dodaj przedział</button>
    </div>
    ${e.error ? html`<div class="serr" role="alert">${e.error}</div>` : nothing}
    <div class="acts">
      <span class="hsub">Zapisz dla:</span>
      <button class="btn hot" type="button" @click=${() => ctx.actions.schedSave([e.day])}>${DAY_PL[e.day]}</button>
      <button class="btn" type="button" @click=${() => ctx.actions.schedSave([0, 1, 2, 3, 4])}>Dni robocze</button>
      <button class="btn" type="button" @click=${() => ctx.actions.schedSave([5, 6])}>Weekend</button>
      <button class="btn" type="button" @click=${() => ctx.actions.schedSave([0, 1, 2, 3, 4, 5, 6])}>Cały tydzień</button>
    </div>
    <span class="hsub">Godziny co 10 minut, najwyżej 3 przedziały. Zapis trafia do sterownika przez ebusd; po kilku sekundach tydzień odświeży się odczytem ze sterownika.</span>
  </div>`;
}
