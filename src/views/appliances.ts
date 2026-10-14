// Zakładka AGD: karta na urządzenie wykrywana po integracji — lodówka (Home Connect), zmywarka (hOn),
// uzdatniacz wody (EcoWater), frytkownica (Tuya Local); inne urządzenia tych integracji dostają prostą kartę z odczytami.

import { html, nothing, type TemplateResult } from "lit";
import { duration, f1, num, round } from "../format";
import { sumPeriods } from "../history";
import { areaOf } from "../model";
import { activity } from "../svg";
import type { Hass, Options } from "../types";
import { cleanName, entityName, since, sinceLabel, st, valueText, type Ctx } from "./common";

const PLATFORMS = ["home_connect", "hon", "ecowater_softener", "tuya_local"];
const bulb = html`<svg class="chipico" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a7 7 0 0 0-4 12.7V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.3A7 7 0 0 0 12 2Zm-3 18h6v1a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1Z"></path></svg>`;

interface Appliance {
  device: string;
  name: string;
  area?: string;
  ents: string[];
  kind: "fridge" | "dishwasher" | "softener" | "airfryer" | "other";
}

const tk = (h: Hass, e: string) => h.entities[e]?.translation_key ?? "";

function discover(h: Hass, skip: Set<string>): Appliance[] {
  const byDevice = new Map<string, string[]>();
  for (const e of Object.values(h.entities)) {
    if (!e.device_id || !PLATFORMS.includes(e.platform ?? "") || e.hidden || !h.states[e.entity_id] || skip.has(e.device_id)) continue;
    if (!byDevice.has(e.device_id)) byDevice.set(e.device_id, []);
    byDevice.get(e.device_id)!.push(e.entity_id);
  }
  const out: Appliance[] = [];
  for (const [device, ents] of byDevice) {
    const d = h.devices[device];
    const platform = h.entities[ents[0]]?.platform;
    const keys = ents.map((e) => tk(h, e));
    const kind: Appliance["kind"] = keys.some((k) => /^(refrigerator|freezer)_setpoint_temperature$/.test(k))
      ? "fridge"
      : platform === "hon" && keys.includes("programs_dw")
        ? "dishwasher"
        : platform === "ecowater_softener"
          ? "softener"
          : platform === "tuya_local" && ents.some((e) => /^switch\..*_cooking$/.test(e)) && ents.some((e) => /^sensor\..*_time_remaining$/.test(e))
            ? "airfryer"
            : "other";
    out.push({ device, name: cleanName(d?.name_by_user || d?.name || ents[0]), area: areaOf(h, ents[0]), ents, kind });
  }
  const order = { fridge: 0, dishwasher: 1, airfryer: 2, softener: 3, other: 4 };
  return out.sort((a, b) => order[a.kind] - order[b.kind] || a.name.localeCompare(b.name, "pl"));
}

const usable = (h: Hass, id?: string) => Boolean(id && h.states[id] && !["unavailable", "unknown"].includes(h.states[id].state));
const dmy = (s?: string) => {
  const t = Date.parse(s ?? "");
  if (!Number.isFinite(t)) return "—";
  const d = new Date(t);
  return `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
};

function head(ctx: Ctx, a: Appliance, chip: string, color: string): TemplateResult {
  const area = a.area ? ctx.hass.areas[a.area]?.name : undefined;
  return html`<div class="orow"><span class="hlabel">${a.name}${area ? html` <small>· ${area}</small>` : nothing}</span>
    <span class="lvl" style="background:color-mix(in srgb, ${color} 16%, transparent);color:${color}">${chip}</span></div>`;
}

function stepper(ctx: Ctx, id: string, label: string, unit = "°"): TemplateResult {
  const a = ctx.hass.states[id]?.attributes ?? {};
  const v = ctx.pending.get(id) ?? num(st(ctx, id));
  const step = num(a.step) ?? 1;
  return html`<span class="step">
    <button type="button" aria-label="${label}: mniej" @click=${() => ctx.actions.stepNumber(id, -step)}>−</button>
    <output>${v === null ? "—" : `${round(v)}${unit}`}</output>
    <button type="button" aria-label="${label}: więcej" @click=${() => ctx.actions.stepNumber(id, step)}>+</button>
  </span>`;
}

// ---- lodówka (Home Connect) ----

const ALARMS: Record<string, string> = {
  freezer_temperature_alarm: "za ciepło w zamrażarce",
  freezer_door_alarm: "drzwi zamrażarki otwarte za długo",
  refrigerator_door_alarm: "drzwi chłodziarki otwarte za długo",
  refrigerator_temperature_alarm: "za ciepło w chłodziarce",
};
const MODES: Array<[string, string, boolean?]> = [
  ["refrigerator_super_mode", "Super chłodzenie"],
  ["freezer_super_mode", "Super zamrażanie"],
  ["eco_mode", "Eco"],
  ["fresh_mode", "Świeżość"],
  // Tryby, które mocno zmieniają pracę lodówki — z potwierdzeniem (urlopowy podnosi temperaturę chłodziarki).
  ["vacation_mode", "Urlopowy", true],
  ["sabbath_mode", "Szabatowy", true],
];

function fridge(ctx: Ctx, a: Appliance): TemplateResult {
  const h = ctx.hass;
  const by = (key: string) => a.ents.find((e) => tk(h, e) === key);
  const power = by("power");
  const online = a.ents.find((e) => h.states[e].attributes.device_class === "connectivity");
  const offline = online ? st(ctx, online) === "off" : false;
  const off = usable(h, power) && st(ctx, power) === "off";
  const alarms = Object.entries(ALARMS).filter(([k]) => st(ctx, by(k)) === "present");
  const chip = offline ? "brak łączności" : off ? "wyłączona" : alarms.length ? "alarm" : "działa";
  const color = offline || alarms.length ? "var(--crit)" : off ? "var(--muted)" : "var(--ok)";
  const compartment = (label: string, setpoint?: string, door?: string) => {
    if (!setpoint && !door) return nothing;
    const open = st(ctx, door) === "on";
    return html`<div class="agdtemp">
      <span class="hsub">${label}</span>
      ${setpoint ? stepper(ctx, setpoint, `Temperatura: ${label.toLowerCase()}`) : nothing}
      ${door ? html`<span class=${open ? "hsub alarm" : "hsub"}>drzwi ${open ? "otwarte" : "zamknięte"} · ${sinceLabel(ctx, h.states[door].last_changed)}</span>` : nothing}
    </div>`;
  };
  const modes = MODES.map(([k, label, confirm]) => [by(k), label, confirm] as const).filter(([id]) => usable(h, id));
  const lights = a.ents.filter((e) => e.startsWith("light.") && usable(h, e));
  return html`<div class="ocell agd">
    ${head(ctx, a, chip, color)}
    ${alarms.length
      ? html`<div class="chips">${alarms.map(([k, text]) => html`<button type="button" class="mchip alarmchip" @click=${() => ctx.actions.moreInfo(by(k)!)}>⚠ ${text}</button>`)}</div>`
      : nothing}
    <div class="agdtemps">
      ${compartment("Chłodziarka", by("refrigerator_setpoint_temperature"), by("refrigerator_door"))}
      ${compartment("Zamrażarka", by("freezer_setpoint_temperature"), by("freezer_door"))}
    </div>
    ${modes.length
      ? html`<span class="hlabel">Tryby</span><div class="chips">${modes.map(([id, label, confirm]) => html`<button type="button"
          class="mchip ${st(ctx, id) === "on" ? "on" : ""}" aria-pressed=${st(ctx, id) === "on" ? "true" : "false"}
          @click=${() => (!confirm || st(ctx, id) === "on" || window.confirm(`Włączyć tryb ${label.toLowerCase()}?`)) && ctx.actions.toggleEntity(id!)}>${label}</button>`)}</div>`
      : nothing}
    ${lights.length
      ? html`<span class="hlabel">Światło</span><div class="chips">${lights.map((id) => html`<button type="button" class="mchip ${st(ctx, id) === "on" ? "on" : ""}"
          aria-pressed=${st(ctx, id) === "on" ? "true" : "false"} @click=${() => ctx.actions.toggleEntity(id)}>${bulb}${entityName(h, id).replace(a.name, "").trim() || "Światło"}</button>`)}</div>`
      : nothing}
    ${power ? html`<span class="hsub">Zasilanie: ${off ? "wyłączone" : "włączone"} — włączanie i wyłączanie tylko w aplikacji producenta albo w HA, nie stąd.</span>` : nothing}
  </div>`;
}

// ---- zmywarka (hOn) ----

function dishwasher(ctx: Ctx, a: Appliance): TemplateResult {
  const h = ctx.hass;
  const end = (suffix: string, domain = "sensor") => a.ents.find((e) => e.startsWith(`${domain}.`) && e.endsWith(suffix));
  const remaining = num(st(ctx, end("_remaining_time")));
  const powerId = a.ents.find((e) => e.startsWith("binary_sensor.") && h.states[e].attributes.device_class === "power");
  const running = (remaining ?? 0) > 0 && st(ctx, powerId) !== "off";
  const program = st(ctx, a.ents.find((e) => tk(h, e) === "programs_dw"));
  const programName = program && !["unknown", "unavailable"].includes(program)
    ? program.replace(/^iot_/, "").replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())
    : null;
  const errorId = a.ents.find((e) => tk(h, e) === "error") ?? end("_error");
  const error = st(ctx, errorId);
  const hasError = Boolean(error && !["00", "0", "unknown", "unavailable"].includes(error));
  const salt = end("_salt", "binary_sensor"), rinse = end("_rinse_aid", "binary_sensor");
  const door = a.ents.find((e) => e.startsWith("binary_sensor.") && h.states[e].attributes.device_class === "door");
  const endAt = Date.parse(st(ctx, end("_end_time")) ?? "");
  const delay = num(st(ctx, end("_delay_time")));
  const chip = hasError ? "błąd" : running ? "pracuje" : st(ctx, powerId) === "on" ? "włączona" : "wyłączona";
  const color = hasError ? "var(--crit)" : running ? "var(--ok)" : "var(--muted)";
  const supply = (id: string | undefined, label: string) =>
    usable(h, id) ? html`<div class="row"><span>${label}</span><b class=${st(ctx, id) === "on" ? "alarm" : ""}>${st(ctx, id) === "on" ? "uzupełnij" : "OK"}</b></div>` : nothing;
  const water = num(st(ctx, end("_current_water_used"))), kwh = num(st(ctx, end("_current_electricity_used")));
  return html`<div class="ocell agd">
    ${head(ctx, a, chip, color)}
    ${running
      ? html`<div class="orow"><span class="hval big">${Math.floor(remaining! / 60)}:${String(Math.round(remaining! % 60)).padStart(2, "0")}</span>
          <span class="hsub">do końca${Number.isFinite(endAt) ? ` · koniec o ${ctx.clock.hm(endAt)}` : ""}</span></div>
          ${programName ? html`<span class="hsub">Program: <b>${programName}</b></span>` : nothing}
          ${water !== null || kwh !== null ? html`<span class="hsub">Teraz zużyto: ${water !== null ? `${f1(water)} L` : ""}${water !== null && kwh !== null ? " · " : ""}${kwh !== null ? `${f1(kwh)} kWh` : ""}</span>` : nothing}`
      : html`<span class="hsub">${programName ? html`Ostatni program: <b>${programName}</b>` : "Nie pracuje."}${delay && delay > 0 ? ` · start opóźniony o ${round(delay)} min` : ""}</span>`}
    ${hasError ? html`<div class="row"><span>Błąd urządzenia</span><b class="alarm">kod ${error}</b></div>` : nothing}
    ${supply(salt, "Sól")}
    ${supply(rinse, "Nabłyszczacz")}
    ${usable(h, door) ? html`<div class="row"><span>Drzwi</span><b>${st(ctx, door) === "on" ? "otwarte" : "zamknięte"}</b></div>` : nothing}
    ${usable(h, end("_total_programs")) ? html`<div class="row"><span>Programów łącznie</span><b>${round(num(st(ctx, end("_total_programs"))))}</b></div>` : nothing}
  </div>`;
}

// ---- uzdatniacz wody (EcoWater) ----

function softener(ctx: Ctx, a: Appliance): TemplateResult {
  const h = ctx.hass;
  const end = (suffix: string) => a.ents.find((e) => e.endsWith(suffix));
  const salt = num(st(ctx, end("_salt_level_percentage")));
  const days = num(st(ctx, end("_days_until_out_of_salt")));
  const saltColor = salt === null ? "var(--muted)" : salt < 20 ? "var(--crit)" : salt < 40 ? "var(--warn)" : "var(--ok)";
  const enabled = st(ctx, end("_recharge_enabled"));
  const regenOff = enabled !== undefined && !["True", "true", "on", "unknown", "unavailable"].includes(enabled);
  const status = st(ctx, end("_recharge_status"));
  const flow = num(st(ctx, end("_water_flow")));
  const last = end("_last_recharge_date");
  const sinceDays = num(st(ctx, end("_days_since_last_recharge")));
  const chip = regenOff ? "regeneracja wyłączona" : salt !== null && salt < 20 ? "mało soli" : flow && flow > 0 ? "płynie woda" : "w porządku";
  const color = regenOff || (salt !== null && salt < 20) ? "var(--warn)" : flow && flow > 0 ? "var(--frost)" : "var(--ok)";
  const v = (suffix: string) => (usable(h, end(suffix)) ? valueText(h, end(suffix), 1) : "—");
  const title = /uzdatniacz|zmiękczacz|softener/i.test(a.name) ? a : { ...a, name: `Uzdatniacz ${a.name}` };
  return html`<div class="ocell agd">
    ${head(ctx, title, chip, color)}
    <span class="hlabel">Sól</span>
    <div class="orow"><span class="hval big" style="color:${saltColor}">${salt === null ? "—" : `${round(salt)}%`}</span>
      <span class="hsub">${days !== null ? `wystarczy na ${round(days)} dni` : ""}${usable(h, end("_out_of_salt_date")) ? ` · do ${dmy(st(ctx, end("_out_of_salt_date")))}` : ""}${usable(h, end("_salt_type")) ? ` · ${st(ctx, end("_salt_type"))}` : ""}</span></div>
    ${salt !== null ? html`<span class="pmbar"><i style="width:${Math.max(0, Math.min(100, salt)).toFixed(0)}%;background:${saltColor}"></i></span>` : nothing}
    <span class="hlabel">Woda</span>
    <div class="row"><span>Dziś</span><b>${v("_water_used_today")}</b></div>
    <div class="row"><span>Średnio na dzień</span><b>${v("_average_water_used_per_day")}</b></div>
    <div class="row"><span>Przepływ teraz</span><b>${flow !== null && flow > 0 ? `${f1(flow)} L/min` : "nie płynie"}</b></div>
    <div class="row"><span>Zapas miękkiej wody do regeneracji</span><b>${v("_water_available")}</b></div>
    <span class="hlabel">Regeneracja</span>
    <div class="row"><span>Ostatnia</span><b>${usable(h, last) ? `${dmy(st(ctx, last))}${sinceDays !== null ? ` (${sinceDays === 0 ? "dziś" : sinceDays === 1 ? "wczoraj" : `${round(sinceDays)} dni temu`})` : ""}` : "—"}</b></div>
    ${regenOff ? html`<div class="row"><span>Automatyczna regeneracja</span><b class="alarm">wyłączona</b></div>` : nothing}
    ${status && !["None", "none", "unknown", "unavailable"].includes(status) ? html`<div class="row"><span>Stan</span><b>${status}</b></div>` : nothing}
    ${usable(h, end("_rock_removed")) ? html`<div class="row"><span>Usunięty kamień</span><b>${v("_rock_removed")}${usable(h, end("_average_rock_removed_per_day")) ? html` <small>· ${f1(num(st(ctx, end("_average_rock_removed_per_day"))))} kg/dzień</small>` : nothing}</b></div>` : nothing}
  </div>`;
}

// ---- frytkownica (Tuya Local; profil gotzejensen_af850t_airfryer z ha-package) ----

const FRYER_STATE: Record<string, string> = { sleep: "czuwanie", standby: "czuwanie", cooking: "gotuje", working: "gotuje", pause: "pauza", done: "gotowe", finish: "gotowe", keep_warm: "podtrzymanie", preheat: "nagrzewanie" };

function airfryer(ctx: Ctx, a: Appliance): TemplateResult {
  const h = ctx.hass;
  const end = (re: RegExp) => a.ents.find((e) => re.test(e));
  const power = end(/^switch\..*_power$/), cooking = end(/^switch\..*_cooking$/);
  const temp = end(/^number\..*_temperature$/), time = end(/^number\..*_cooking_time$/);
  const remain = num(st(ctx, end(/^sensor\..*_time_remaining$/)));
  const status = st(ctx, end(/^sensor\..*_status$/));
  const problem = st(ctx, a.ents.find((e) => e.startsWith("binary_sensor.") && h.states[e].attributes.device_class === "problem")) === "on";
  const on = st(ctx, power) === "on", cooks = st(ctx, cooking) === "on";
  const offline = a.ents.every((e) => h.states[e].state === "unavailable");
  const chip = offline ? "niedostępna" : problem ? "usterka" : cooks ? "gotuje" : on ? "włączona" : "wyłączona";
  const color = offline || problem ? "var(--crit)" : cooks ? "var(--ok)" : "var(--muted)";
  return html`<div class="ocell agd">
    ${head(ctx, a, chip, color)}
    ${cooks && remain !== null
      ? html`<div class="orow"><span class="hval big">${round(remain)} min</span><span class="hsub">do końca · koniec ok. ${ctx.clock.hm(Date.now() + remain * 60e3)}</span></div>`
      : html`<span class="hsub">${status ? `Stan: ${FRYER_STATE[status] ?? status}` : ""}</span>`}
    <div class="agdtemps">
      ${temp ? html`<div class="agdtemp"><span class="hsub">Temperatura</span>${stepper(ctx, temp, "Temperatura")}</div>` : nothing}
      ${time ? html`<div class="agdtemp"><span class="hsub">Czas</span>${stepper(ctx, time, "Czas", " min")}</div>` : nothing}
    </div>
    <div class="acts">
      ${cooking ? html`<button class="btn ${cooks ? "" : "hot"}" type="button" ?disabled=${offline || (!on && !cooks)} @click=${() => ctx.actions.toggleEntity(cooking)}>${cooks ? "Zatrzymaj" : "Start"}</button>` : nothing}
      ${power ? html`<button class="btn" type="button" ?disabled=${offline} @click=${() => (!cooks || window.confirm("Wyłączyć frytkownicę w trakcie pracy?")) && ctx.actions.toggleEntity(power)}>${on ? "Wyłącz" : "Włącz"}</button>` : nothing}
    </div>
    ${problem ? html`<div class="row"><span>Usterka urządzenia</span><b class="alarm">tak</b></div>` : nothing}
  </div>`;
}

// ---- sprzęt znany tylko z gniazdka z pomiarem (opcja „Pralki, suszarki i inne z gniazdka”) ----

type Plug = NonNullable<Options["appliance_plugs"]>[number];
const PLUG_WORK = 5; // W — powyżej tego gniazdko uznajemy za pracujące, gdy nie ma flagi cyklu

function plugCard(ctx: Ctx, p: Plug): TemplateResult {
  const h = ctx.hass;
  const w = num(st(ctx, p.power));
  const flag = p.running ? st(ctx, p.running) : undefined;
  const flagKnown = flag === "on" || flag === "off";
  const running = flagKnown ? flag === "on" : (w ?? 0) > PLUG_WORK;
  const cycle = running && p.energy && p.energy_start ? (num(st(ctx, p.energy)) ?? NaN) - (num(st(ctx, p.energy_start)) ?? NaN) : NaN;
  const periods = ctx.hist.periods(h, p.power, (v) => (num(v) ?? 0) > PLUG_WORK);
  const worked = sumPeriods(periods);
  // Czasy z historii mocy, nie z flagi cyklu: flaga dostaje nowy czas zmiany przy każdym restarcie HA.
  const last = periods.length ? periods[periods.length - 1] : null;
  const ongoing = last !== null && Date.now() - last[1] < 90e3;
  const flagT = p.running && h.states[p.running] ? Date.parse(h.states[p.running].last_changed) : NaN;
  const changed = running ? (ongoing ? last![0] : flagT) : last && !ongoing ? last[1] : NaN;
  const offline = !h.states[p.power] || ["unavailable", "unknown"].includes(h.states[p.power].state);
  const chip = running ? "pracuje" : offline ? "brak odczytu" : "wolna";
  const color = running ? "var(--ok)" : offline ? "var(--warn)" : "var(--muted)";
  const a: Appliance = { device: p.power, name: p.name, area: areaOf(h, p.power), ents: [], kind: "other" };
  return html`<div class="ocell agd">
    ${head(ctx, a, chip, color)}
    ${running
      ? html`<div class="orow"><span class="hval big">${Number.isFinite(changed) ? duration(Date.now() - changed) : "—"}</span>
          <span class="hsub">${Number.isFinite(changed) ? `od ${ctx.clock.hm(changed)}` : ""}${w !== null ? ` · teraz ${round(w)} W` : ""}</span></div>
          ${Number.isFinite(cycle) && cycle >= 0 ? html`<span class="hsub">Ten cykl: <b>${f1(cycle)} kWh</b></span>` : nothing}`
      : html`<span class="hsub">${Number.isFinite(changed) ? `Ostatnio pracowała do ${ctx.clock.hm(changed)} (${since(changed)} temu)` : offline ? "Gniazdko nie podaje mocy." : "Nie pracowała w ostatnich 24 h."}</span>`}
    <span class="hlabel">Praca w ostatnich 24 h <small>· ${worked > 0 ? duration(worked) : "brak"}</small></span>
    ${activity(periods)}
    <div class="tticks"><span>−24 h</span><span>−18</span><span>−12</span><span>−6</span><span>teraz</span></div>
  </div>`;
}

// ---- pozostałe urządzenia wspieranych integracji ----

function other(ctx: Ctx, a: Appliance): TemplateResult {
  const h = ctx.hass;
  const rows = a.ents.filter((e) => /^(sensor|binary_sensor)\./.test(e) && !h.entities[e]?.entity_category && usable(h, e)).slice(0, 12);
  const updated = Math.max(...a.ents.map((e) => Date.parse(h.states[e].last_updated)).filter(Number.isFinite));
  return html`<div class="ocell agd">
    ${head(ctx, a, Number.isFinite(updated) ? `${since(updated)} temu` : "—", "var(--muted)")}
    ${rows.map((e) => html`<div class="row"><span>${entityName(h, e).replace(a.name, "").trim() || entityName(h, e)}</span><b>${valueText(h, e)}</b></div>`)}
  </div>`;
}

export function appliancesView(ctx: Ctx): TemplateResult {
  const list = discover(ctx.hass, new Set(ctx.opts.appliances_exclude ?? []));
  const plugs = (ctx.opts.appliance_plugs ?? []).filter((p) => p.power && ctx.hass.states[p.power]);
  if (!list.length && !plugs.length)
    return html`<div class="empty">Nie znalazłem sprzętu AGD. Zakładka pokazuje urządzenia z integracji Home Connect (Bosch, Siemens), hOn (Haier, Candy), EcoWater i Tuya Local.</div>`;
  const view = { fridge, dishwasher, softener, airfryer, other };
  return html`<section class="sec"><div class="cards agds">${list.map((a) => view[a.kind](ctx, a))}${plugs.map((p) => plugCard(ctx, p))}</div></section>`;
}
