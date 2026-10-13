// Pasek stanu domu: kocioł, ile pokoi grzeje, okna, tryb domu, ciepła woda, wentylacja i osuszanie.

import { html, nothing, type TemplateResult } from "lit";
import { f1, num } from "../format";
import { hasProfiles, nightWindow, profileValue, windowOpen, type Room } from "../model";
import { devices, nightNow, st, type Ctx } from "./common";

const BOILER: Record<string, string> = {
  STANDBY: "Czuwa", HEATING: "Grzeje", DOMESTIC_HOT_WATER: "Grzeje wodę", heating: "Grzeje", idle: "Czuwa", off: "Wyłączony",
};

/** Stan kotła: z encji tekstowej albo (np. ebusd) z płomienia, zapotrzebowania CWU i modulacji. */
export function boilerState(ctx: Ctx): { text: string; burning: boolean; sub: string } | null {
  const o = ctx.opts;
  if (o.boiler_flame) {
    const flame = st(ctx, o.boiler_flame);
    if (flame === undefined || flame === "unavailable" || flame === "unknown") return { text: "—", burning: false, sub: "brak odczytu" };
    const burning = flame === "on";
    const dhw = st(ctx, o.boiler_dhw_demand) === "on";
    const mod = num(st(ctx, o.boiler_modulation));
    const word = burning ? (dhw ? "Grzeje wodę" : "Grzeje") : dhw ? "Czeka na CWU" : "Czuwa";
    return { text: word, burning, sub: burning ? `palnik ${mod !== null ? `${Math.round(mod)}%` : "pracuje"}` : "palnik wyłączony" };
  }
  if (o.boiler_state) {
    const s = st(ctx, o.boiler_state) ?? "—";
    return { text: BOILER[s] ?? s, burning: /HEAT|heat|DOMESTIC|on/.test(s), sub: "" };
  }
  return null;
}

const cell = (label: string, value: TemplateResult | string, sub: TemplateResult | string) =>
  html`<div class="hcell"><span class="hlabel">${label}</span><span class="hval">${value}</span><span class="hsub">${sub}</span></div>`;

export function house(ctx: Ctx, rooms: Room[]): TemplateResult | typeof nothing {
  const o = ctx.opts, cells: TemplateResult[] = [];
  const boiler = boilerState(ctx);
  if (boiler !== null) {
    const temp = (id?: string | null) => f1(num(st(ctx, id)));
    const parts = [
      o.boiler_flow_temperature ? `zasilanie ${temp(o.boiler_flow_temperature)} °C` : "",
      o.boiler_return_temperature ? `powrót ${temp(o.boiler_return_temperature)} °C` : "",
      o.boiler_pressure ? `${f1(num(st(ctx, o.boiler_pressure)))} bar` : "",
    ].filter(Boolean);
    // Przy ebusd: „palnik 44%” na początku podpisu, potem temperatury i ciśnienie.
    const sub = [ctx.opts.boiler_flame && boiler.burning ? boiler.sub : "", ...parts].filter(Boolean).join(" · ") || boiler.sub;
    cells.push(cell("Kocioł", boiler.text, html`<span class="dot ${boiler.burning ? "heat" : "ok"}"></span>${sub}`));
  }
  if (rooms.length) {
    const heating = rooms.filter((r) => ctx.hass.states[r.climate]?.attributes.hvac_action === "heating").length;
    cells.push(cell("Grzeje teraz", html`${heating}<span class="u"> z ${rooms.length}</span>`,
      html`<span class="dot ${heating ? "heat" : "ok"}"></span>${heating ? "pokoje dogrzewają się" : "wszystkie pokoje ciepłe"}`));
    const open = rooms.filter((r) => windowOpen(ctx.hass, r));
    cells.push(cell("Okna i drzwi", open.length ? `${open.length} otwarte` : "zamknięte",
      html`<span class="dot ${open.length ? "warn" : "ok"}"></span>${open.length ? open.map((r) => r.name).join(", ") : "grzanie bez przerw"}`));
  }
  const withProfiles = rooms.find(hasProfiles);
  const presence = o.presence ? st(ctx, o.presence) : undefined;
  if (withProfiles) {
    const [od, doo] = nightWindow(ctx.hass, withProfiles);
    const hm = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
    const eko = profileValue(ctx.hass, withProfiles, "e", ctx.pending);
    const kom = profileValue(ctx.hass, withProfiles, "k", ctx.pending);
    cells.push(nightNow(ctx, withProfiles)
      ? cell("Tryb domu", "Noc", `${hm(od)}–${hm(doo)} · ${f1(eko)} °C`)
      : presence === "off" ? cell("Tryb domu", "Pusty dom", `${f1(eko)} °C`)
      : cell("Tryb domu", "W domu", `komfort ${f1(kom)} °C`));
  } else if (presence) {
    cells.push(cell("Domownicy", presence === "on" ? "W domu" : "Nikogo", ""));
  }
  if (o.dhw_temperature) {
    const target = num(st(ctx, o.dhw_target));
    const dhw = o.boiler_dhw_demand && st(ctx, o.boiler_dhw_demand) === "on";
    cells.push(cell("Ciepła woda", html`${f1(num(st(ctx, o.dhw_temperature)))}<span class="u">°C</span>`,
      `zasobnik${target !== null ? ` · cel ${f1(target)} °C` : ""}${dhw ? " · dogrzewanie" : ""}`));
  }
  const devs = rooms.flatMap((r) => devices(ctx, r));
  if (devs.length) {
    const working = devs.filter((d) => d.on).length;
    const dehum = devs.filter((d) => d.kind === "dehumidifier");
    const enabled = dehum.filter((d) => st(ctx, d.entity) === "on").length;
    const tariff = o.tariff ? st(ctx, o.tariff) : undefined;
    const sub = [tariff ? `taryfa ${tariff.toLowerCase()}` : "", dehum.length ? `osuszacze ${enabled ? "włączone" : "wyłączone"}` : ""].filter(Boolean).join(", ");
    cells.push(cell("Wentylacja i osuszanie", working ? `${working} pracuje` : "czuwa",
      html`<span class="dot ${enabled || !dehum.length ? "ok" : "warn"}"></span>${sub || `${devs.length} urządzeń`}`));
  }
  return cells.length ? html`<section class="house" aria-label="Stan domu">${cells}</section>` : nothing;
}

