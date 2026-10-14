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
  no_error: "brak", none: "brak", ok: "OK", idle: "czeka", docked: "w stacji", mowing: "kosi", cleaning: "sprząta", paused: "pauza", returning: "wraca",
};
const ROBOT_STATE: Record<string, string> = {
  docked: "w stacji", mowing: "kosi", cleaning: "sprząta", paused: "pauza", returning: "wraca do stacji", error: "błąd", idle: "czeka", unavailable: "niedostępny",
};

export function robotsView(ctx: Ctx, tick: number): TemplateResult {
  const h = ctx.hass;
  const skip = new Set(ctx.opts.robots_exclude ?? []);
  const robots = Object.keys(h.states).filter((e) => (e.startsWith("lawn_mower.") || e.startsWith("vacuum.")) && !skip.has(e) && !h.entities[e]?.hidden);
  if (!robots.length) return html`<div class="empty">Nie ma kosiarek ani odkurzaczy.</div>`;
  return html`<section class="sec"><div class="cards two">${robots.map((id) => {
    const mower = id.startsWith("lawn_mower.");
    const s = h.states[id];
    const ents = deviceEntities(h, h.entities[id]?.device_id);
    const battId = ents.find((e) => e.startsWith("sensor.") && h.states[e].attributes.device_class === "battery");
    const batt = num(s.attributes.battery_level) ?? num(st(ctx, battId));
    const map = ents.find((e) => e.startsWith("camera.") && /map|mapa/i.test(e) && !/data/.test(e));
    const seen = new Set<string>();
    const info = ents
      .filter((e) => e.startsWith("sensor.") && !h.entities[e]?.entity_category && e !== battId && !["unknown", "unavailable", ""].includes(h.states[e].state))
      .filter((e) => !seen.has(entityName(h, e)) && Boolean(seen.add(entityName(h, e))))
      .slice(0, 6);
    const busy = ["mowing", "cleaning", "returning"].includes(s.state);
    const act = (svc: string) => ctx.actions.call(mower ? "lawn_mower" : "vacuum", svc, { entity_id: id });
    const src = map ? camImg(ctx, map, Math.floor(tick / 6)) : null;
    return html`<div class="ocell robot">
      <div class="orow"><span class="hlabel">${cleanName(deviceName(h, id) ?? entityName(h, id))}</span>
        <span class="lvl" style="background:color-mix(in srgb, ${busy ? "var(--ok)" : s.state === "error" ? "var(--crit)" : "var(--muted)"} 15%, transparent)">${ROBOT_STATE[s.state] ?? s.state}</span></div>
      <div class="orow"><span class="hval big">${batt === null ? "—" : `${round(batt)}%`}</span><span class="hsub">bateria · ${sinceLabel(ctx, s.last_changed)}</span></div>
      ${src ? html`<button type="button" class="robmap" @click=${() => ctx.actions.moreInfo(map!)} aria-label="Mapa"><img src=${src} alt="Mapa" loading="lazy" @error=${(e: Event) => ((e.target as HTMLElement).hidden = true)} /></button>` : nothing}
      ${info.map((e) => html`<div class="row"><span>${entityName(h, e)}</span><b>${ENUM_PL[h.states[e].state] ?? valueText(h, e)}</b></div>`)}
      <div class="acts">
        <button class="btn hot" type="button" ?disabled=${busy} @click=${() => act(mower ? "start_mowing" : "start")}>${mower ? "Koś" : "Sprzątaj"}</button>
        <button class="btn" type="button" ?disabled=${!busy} @click=${() => act("pause")}>Pauza</button>
        <button class="btn" type="button" ?disabled=${s.state === "docked"} @click=${() => act(mower ? "dock" : "return_to_base")}>Do stacji</button>
      </div>
    </div>`;
  })}</div></section>`;
}
