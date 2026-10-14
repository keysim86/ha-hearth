// Zakładki Auta i Roboty: dane z urządzenia lokalizatora (auto) albo kosiarki / odkurzacza.

import { html, nothing, type TemplateResult } from "lit";
import { num, round } from "../format";
import { camImg } from "./cameras";
import { cleanName, deviceEntities, deviceName, entityName, since, sinceLabel, st, valueText, type Ctx } from "./common";

const find = (ctx: Ctx, ids: string[], re: RegExp, cls?: string) =>
  ids.find((e) => (!cls || ctx.hass.states[e]?.attributes.device_class === cls) && re.test(`${e} ${ctx.hass.states[e]?.attributes.friendly_name ?? ""}`));

export function vehicleList(ctx: Ctx): string[] {
  const h = ctx.hass;
  if (ctx.opts.vehicles?.length) return ctx.opts.vehicles.filter((v) => h.states[v]);
  return Object.keys(h.states).filter((t) => {
    if (!t.startsWith("device_tracker.")) return false;
    const ents = deviceEntities(h, h.entities[t]?.device_id, ["sensor"]);
    return ents.some((e) => /przebieg|odometer|mileage|licznik_kilometr|zasieg|range|autonomia/i.test(e));
  });
}

export function carsView(ctx: Ctx): TemplateResult {
  const h = ctx.hass;
  const cars = vehicleList(ctx);
  if (!cars.length) return html`<div class="empty">Nie znalazłem aut. Wskaż lokalizatory aut w opcjach Hearth (sekcja Auta i Roboty).</div>`;
  return html`<section class="sec"><div class="cards two">${cars.map((t) => {
    const ents = deviceEntities(h, h.entities[t]?.device_id);
    const sensors = ents.filter((e) => e.startsWith("sensor."));
    const fuel = sensors.find((e) => /paliw|fuel/i.test(e) && !/zasieg|zasięg|range|autonomia|cena|price/i.test(e));
    const range = find(ctx, sensors, /zasieg|zasięg|range|autonomia/i);
    const odo = find(ctx, sensors, /przebieg|odometer|mileage|licznik_kilometr/i);
    const batt = sensors.find((e) => h.states[e].attributes.device_class === "battery");
    const updated = sensors.find((e) => h.states[e].attributes.device_class === "timestamp" && /ostatni|last|aktywno/i.test(e));
    const lock = ents.find((e) => e.startsWith("lock.")) ?? ents.find((e) => e.startsWith("binary_sensor.") && h.states[e].attributes.device_class === "lock");
    const lockState = lock ? st(ctx, lock) : undefined;
    const locked = !lock || lockState === "unavailable" || lockState === "unknown" ? null : lock.startsWith("lock.") ? lockState === "locked" : lockState === "off";
    const doors = ents.filter((e) => e.startsWith("binary_sensor.") && ["door", "opening", "window"].includes(h.states[e].attributes.device_class) && st(ctx, e) === "on");
    const fuelPct = fuel && h.states[fuel].attributes.unit_of_measurement === "%" ? num(st(ctx, fuel)) : null;
    const s = h.states[t];
    const where = s.state === "home" ? "w domu" : s.state === "not_home" ? "poza domem" : s.state === "unavailable" || s.state === "unknown" ? "brak danych" : s.state;
    return html`<div class="ocell car">
      <div class="orow"><span class="hlabel">${cleanName(deviceName(h, t) ?? entityName(h, t))}</span>
        ${locked !== null ? html`<span class="lvl" style="background:color-mix(in srgb, ${locked ? "var(--ok)" : "var(--warn)"} 18%, transparent);color:${locked ? "var(--ok)" : "var(--warn)"}">${locked ? "zamknięte" : "otwarte"}</span>` : nothing}</div>
      <div class="orow"><span class="hval big">${valueText(h, fuel, 0)}</span><span class="hsub">${range ? `zasięg ${valueText(h, range, 0)}` : ""}</span></div>
      ${fuelPct !== null ? html`<div class="pmbar"><i style="width:${fuelPct}%;background:${fuelPct < 15 ? "var(--crit)" : fuelPct < 30 ? "var(--warn)" : "var(--ok)"}"></i></div>` : nothing}
      <div class="row"><span>Przebieg</span><b>${valueText(h, odo, 0)}</b></div>
      ${batt ? html`<div class="row"><span>Akumulator</span><b>${valueText(h, batt, 0)}</b></div>` : nothing}
      ${doors.length ? html`<div class="row"><span>Otwarte</span><b style="color:var(--warn)">${doors.map((d) => entityName(h, d)).join(", ")}</b></div>` : nothing}
      <div class="row"><span>Gdzie</span><b>${where}</b></div>
      <span class="hsub">${updated && Date.parse(st(ctx, updated) ?? "") ? `dane sprzed ${since(Date.parse(st(ctx, updated)!))}` : `stan ${sinceLabel(ctx, s.last_changed)}`}</span>
      <div class="acts">
        <button class="btn" type="button" @click=${() => ctx.actions.openPerson(t)}>Mapa</button>
        ${lock && lock.startsWith("lock.") && locked !== null
          ? html`<button class="btn ${locked ? "" : "hot"}" type="button" @click=${() => ctx.actions.call("lock", locked ? "unlock" : "lock", { entity_id: lock })}>${locked ? "Otwórz" : "Zamknij"}</button>`
          : nothing}
      </div>
    </div>`;
  })}</div></section>`;
}

// Częste stany tekstowe czujników robotów.
const ENUM_PL: Record<string, string> = {
  charging: "ładuje", not_charging: "nie ładuje", charging_completed: "naładowana", charged: "naładowana", discharging: "rozładowuje",
  no_error: "brak", none: "brak", ok: "brak", idle: "czeka", docked: "w stacji", mowing: "kosi", cleaning: "sprząta", paused: "pauza",
  returning: "wraca do stacji", error: "błąd", on: "tak", off: "nie", quiet: "cicha", standard: "standardowa", turbo: "turbo", max: "maksymalna", ultra: "ultra",
};
const ROBOT_STATE: Record<string, string> = {
  docked: "w stacji", mowing: "kosi", cleaning: "sprząta", paused: "pauza", returning: "wraca do stacji", error: "błąd", idle: "czeka", unavailable: "niedostępny",
};
// Nazwy czujników po kluczu tłumaczenia integracji (Dreame, Tapo i podobne); [kosiarka, odkurzacz].
const LABEL: Record<string, [string, string]> = {
  state: ["Stan szczegółowy", "Stan szczegółowy"], charging_status: ["Ładowanie", "Ładowanie"], current_zone_state: ["Bieżąca strefa", "Bieżący pokój"],
  error: ["Błąd", "Błąd"], vacuum_error: ["Błąd", "Błąd"], overheated: ["Przegrzanie", "Przegrzanie"], scheduled_clean: ["Koszenie z harmonogramu", "Sprzątanie z harmonogramu"],
  cleaning_count: ["Liczba koszeń", "Liczba sprzątań"], total_cleaned_area: ["Łącznie skoszono", "Łącznie posprzątano"], total_cleaning_time: ["Łączny czas pracy", "Łączny czas pracy"],
  first_cleaning_date: ["Pierwsze koszenie", "Pierwsze sprzątanie"], clean_area: ["Ostatnio — powierzchnia", "Ostatnio — powierzchnia"], clean_time: ["Ostatnio — czas", "Ostatnio — czas"],
  filter_remaining: ["Filtr", "Filtr"], main_brush_remaining: ["Szczotka główna", "Szczotka główna"], side_brush_remaining: ["Szczotka boczna", "Szczotka boczna"],
  sensor_remaining: ["Czujniki", "Czujniki"], charging_contacts_remaining: ["Styki ładowania", "Styki ładowania"], blade_remaining: ["Noże", "Noże"],
  firmware_version: ["Oprogramowanie", "Oprogramowanie"], rssi: ["Sygnał Wi-Fi", "Sygnał Wi-Fi"], has_saved_map: ["Zapisana mapa", "Zapisana mapa"],
};
const NOW_KEYS = ["state", "charging_status", "current_zone_state", "error", "vacuum_error", "overheated", "scheduled_clean"];
const STAT_KEYS = ["clean_area", "clean_time", "cleaning_count", "total_cleaned_area", "total_cleaning_time", "first_cleaning_date"];

function robotValue(ctx: Ctx, id: string, tk: string): string {
  const s = ctx.hass.states[id];
  if (!s || s.state === "unavailable" || s.state === "unknown") return "—";
  if (ENUM_PL[s.state]) return ENUM_PL[s.state];
  const u = s.attributes.unit_of_measurement;
  const n = num(s.state);
  if (n !== null && u === "min" && /total/.test(tk)) return `${round(n / 60)} h`;
  if (s.attributes.device_class === "timestamp" || /date/.test(tk)) {
    const t = Date.parse(s.state);
    if (Number.isFinite(t)) { const d = new Date(t); return `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`; }
  }
  return valueText(ctx.hass, id);
}

export function robotsView(ctx: Ctx, tick: number): TemplateResult {
  const h = ctx.hass;
  const skip = new Set(ctx.opts.robots_exclude ?? []);
  const robots = Object.keys(h.states).filter((e) => (e.startsWith("lawn_mower.") || e.startsWith("vacuum.")) && !skip.has(e) && !h.entities[e]?.hidden);
  if (!robots.length) return html`<div class="empty">Nie ma kosiarek ani odkurzaczy.</div>`;
  return html`<section class="sec"><div class="cards robots">${robots.map((id) => {
    const mower = id.startsWith("lawn_mower.");
    const k = mower ? 0 : 1;
    const s = h.states[id];
    const ents = deviceEntities(h, h.entities[id]?.device_id);
    const tk = (e: string) => h.entities[e]?.translation_key ?? "";
    const byKey = (key: string) => ents.find((e) => tk(e) === key);
    const battId = byKey("battery_level") ?? ents.find((e) => e.startsWith("sensor.") && h.states[e].attributes.device_class === "battery");
    const batt = num(s.attributes.battery_level) ?? num(st(ctx, battId));
    const map = ents.find((e) => e.startsWith("camera.") && tk(e) === "map") ?? ents.find((e) => e.startsWith("camera.") && /map|mapa/i.test(e) && !/data|_\d+$/.test(e));
    const busy = ["mowing", "cleaning", "returning"].includes(s.state);
    const act = (svc: string, data: Record<string, unknown> = {}) => ctx.actions.call(mower ? "lawn_mower" : "vacuum", svc, { entity_id: id, ...data });
    const src = map ? camImg(ctx, map, Math.floor(tick / 6)) : null;
    const row = (key: string) => {
      const e = byKey(key);
      if (!e) return nothing;
      const v = robotValue(ctx, e, key);
      if (v === "—" && /zone|error/.test(key)) return nothing;
      return html`<div class="row"><span>${LABEL[key]?.[k] ?? entityName(h, e)}</span><b class=${/error/.test(key) && v !== "brak" ? "alarm" : ""}>${v}</b></div>`;
    };
    // Materiały eksploatacyjne: pozostało / (pozostało + zużyte) z przyciskiem resetu.
    const wear = ents
      .filter((e) => /_remaining$/.test(tk(e)) && e.startsWith("sensor."))
      .map((e) => {
        const base = tk(e).replace(/_remaining$/, "");
        const left = num(st(ctx, e)), used = num(st(ctx, byKey(`${base}_used`)));
        const pct = left !== null && used !== null && left + used > 0 ? (left / (left + used)) * 100 : null;
        return { e, base, left, pct, reset: ents.find((b) => b.startsWith("button.") && tk(b) === `${base}_reset`) };
      });
    const zones = ents.filter((e) => e.startsWith("button.") && tk(e) === "mow_zone").sort();
    const stop = byKey("stop_mowing");
    const fan: string[] = s.attributes.fan_speed_list ?? [];
    return html`<div class="ocell robot">
      <div class="orow"><span class="hlabel">${cleanName(deviceName(h, id) ?? entityName(h, id))}</span>
        <span class="lvl" style="background:color-mix(in srgb, ${busy ? "var(--ok)" : s.state === "error" ? "var(--crit)" : "var(--muted)"} 15%, transparent)">${ROBOT_STATE[s.state] ?? s.state}</span></div>
      <div class="orow"><span class="hval big">${batt === null ? "—" : `${round(batt)}%`}</span><span class="hsub">bateria · ${sinceLabel(ctx, s.last_changed)}</span></div>
      ${src ? html`<button type="button" class="robmap" @click=${() => ctx.actions.moreInfo(map!)} aria-label="Mapa — powiększ"><img src=${src} alt="Mapa" loading="lazy" @error=${(e: Event) => ((e.target as HTMLElement).hidden = true)} /></button>` : nothing}
      <div class="acts">
        <button class="btn hot" type="button" ?disabled=${busy} @click=${() => act(mower ? "start_mowing" : "start")}>${mower ? "Koś" : "Sprzątaj"}</button>
        <button class="btn" type="button" ?disabled=${!busy} @click=${() => act("pause")}>Pauza</button>
        ${stop ? html`<button class="btn" type="button" ?disabled=${!busy} @click=${() => ctx.actions.call("button", "press", { entity_id: stop })}>Stop</button>` : nothing}
        <button class="btn" type="button" ?disabled=${s.state === "docked"} @click=${() => act(mower ? "dock" : "return_to_base")}>Do stacji</button>
      </div>
      ${zones.length ? html`<div class="acts">${zones.map((z, i) => html`<button class="btn" type="button" ?disabled=${busy}
          @click=${() => window.confirm(`Kosić strefę ${i + 1}?`) && ctx.actions.call("button", "press", { entity_id: z })}>Koś strefę ${i + 1}</button>`)}</div>` : nothing}
      ${fan.length ? html`<span class="hlabel">Moc ssania</span><div class="chips">${fan.map((f) => html`<button type="button" class="mchip ${s.attributes.fan_speed === f ? "on" : ""}"
          @click=${() => act("set_fan_speed", { fan_speed: f })}>${ENUM_PL[f] ?? f}</button>`)}</div>` : nothing}
      <span class="hlabel">Teraz</span>${NOW_KEYS.map(row)}
      <span class="hlabel">Statystyki</span>${STAT_KEYS.map(row)}
      ${wear.length ? html`<span class="hlabel">Materiały eksploatacyjne</span>${wear.map((w) => html`<div class="wear">
          <span>${LABEL[`${w.base}_remaining`]?.[k] ?? entityName(h, w.e)}<small class="sub">zostało ${w.left === null ? "—" : `${round(w.left)} h`}</small></span>
          <span class="pmbar"><i style="width:${(w.pct ?? 0).toFixed(0)}%;background:${(w.pct ?? 100) < 10 ? "var(--crit)" : (w.pct ?? 100) < 25 ? "var(--warn)" : "var(--ok)"}"></i></span>
          ${w.reset ? html`<button class="btn" type="button" @click=${() => window.confirm(`Wyzerować licznik: ${LABEL[`${w.base}_remaining`]?.[k] ?? w.base}? (po wymianie)`) && ctx.actions.call("button", "press", { entity_id: w.reset })}>Reset</button>` : nothing}
        </div>`)}` : nothing}
    </div>`;
  })}</div></section>`;
}
