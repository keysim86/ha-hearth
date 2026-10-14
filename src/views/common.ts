// Wspólne kawałki widoków: kontekst, stan pokoju, urządzenia, oś dnia.

import { html, nothing, type TemplateResult } from "lit";
import { clock, duration, f1, num } from "../format";
import { HistoryStore, sumPeriods } from "../history";
import type { StatsStore } from "../data/stats";
import {
  climateTarget,
  hasProfiles,
  PROFILE_NAME,
  profileAt,
  profileNow,
  profileValue,
  roomTemp,
  type Profile,
  type ProfileNow,
  type Room,
} from "../model";
import { dryIcon, fanIcon, flame, icon, timeline, type Segment } from "../svg";
import type { Hass, Options } from "../types";

export interface Actions {
  toggleRoom(areaId: string): void;
  setUi(key: string, value: string): void;
  /** Okno z mapą lokalizacji osoby. */
  openPerson(entity: string): void;
  /** Dowolna usługa HA (bramy, termostaty kotła). */
  call(domain: string, service: string, data: Record<string, unknown>): void;
  /** Suwak number / input_number z opóźnionym zapisem. */
  stepNumber(entity: string, delta: number): void;
  /** Nastawa dowolnego termostatu (climate / water_heater) z opóźnionym zapisem; ogrzewanie z ebusd — przez Veto. */
  stepTarget(entity: string, delta: number): void;
  /** Tryb pracy termostatu; przy ebusd zmiana trybu (poza „wyłączony”) kończy Veto. */
  setHvac(entity: string, mode: string): void;
  /** Koniec Quick Veto (ebusd: tryb specjalny z powrotem na auto). */
  endVeto(): void;
  schedOpen(c: import("../data/ebusd").Circuit, day: number, slots: import("../data/ebusd").Slot[]): void;
  schedEdit(slots: import("../data/ebusd").Slot[]): void;
  schedSave(days: number[]): void;
  schedClose(): void;
  stepProfile(room: Room, p: Profile, delta: number): void;
  stepClimate(room: Room, delta: number): void;
  stepHumidity(entity: string, delta: number): void;
  toggleEntity(entity: string): void;
}

export interface Ctx {
  hass: Hass;
  opts: Options;
  hist: HistoryStore;
  stats: StatsStore;
  /** Przerysowanie po dociągnięciu danych w tle (statystyki, prognoza). */
  refresh: () => void;
  /** Drobny stan widoku (np. wybrany widok pogody), pamiętany na urządzeniu. */
  ui: Record<string, string>;
  /** Programy czasowe sterownika (ebusd) — gdy skonfigurowany temat strefy. */
  timers?: { week(c: import("../data/ebusd").Circuit): import("../data/ebusd").Slot[][] | null; value(name: string): string | undefined; connected: boolean };
  sched?: import("./boiler").SchedEdit | null;
  clock: ReturnType<typeof clock>;
  nowMinute: number;
  pending: Map<string, number>;
  open: string | null;
  actions: Actions;
}

export const st = (ctx: Ctx, id?: string | null) => (id ? ctx.hass.states[id]?.state : undefined);

/** Bieżący cel pokoju: wartość profilu, który teraz działa, albo nastawa termostatu. */
export function targetNow(ctx: Ctx, r: Room): { z: number | null; p: ProfileNow } {
  const p = profileNow(ctx.hass, r);
  if (p && p !== "okno") return { z: profileValue(ctx.hass, r, p, ctx.pending), p };
  const pendingClimate = ctx.pending.get(`${r.climate}#t`);
  return { z: pendingClimate ?? climateTarget(ctx.hass, r), p };
}

export function nightNow(ctx: Ctx, r: Room): boolean {
  return hasProfiles(r) && profileAt(ctx.hass, r, ctx.nowMinute) === "e";
}

export const profileLabel = (ctx: Ctx, r: Room, p: ProfileNow): string =>
  p === null ? "termostat" : p === "e" ? (nightNow(ctx, r) ? "noc" : "poza domem") : PROFILE_NAME[p];

export function segments(ctx: Ctx, r: Room): Segment[] {
  const out: Segment[] = [];
  for (let m = 0; m < 1440; m += 10) {
    const k = profileAt(ctx.hass, r, m);
    if (out.length && out[out.length - 1].k === k) out[out.length - 1].minutes += 10;
    else out.push({ k, minutes: 10 });
  }
  return out;
}

export const dayline = (ctx: Ctx, r: Room, ticks = true) =>
  hasProfiles(r) ? timeline(segments(ctx, r), ctx.nowMinute, ticks) : nothing;

export function chip(ctx: Ctx, r: Room): TemplateResult {
  const c = ctx.hass.states[r.climate];
  if (r.windows.some((w) => st(ctx, w) === "on")) return html`<span class="chip window">${icon("win")} okno otwarte</span>`;
  if (!c || c.state === "off") return html`<span class="chip off">wyłączona</span>`;
  if (c.attributes.hvac_action === "heating") return html`<span class="chip heat">${flame} grzeje</span>`;
  return html`<span class="chip idle">ciepło, czeka</span>`;
}

export function delta(t: number | null, z: number | null): TemplateResult | typeof nothing {
  if (t === null || z === null) return nothing;
  const d = t - z;
  return d >= 0
    ? html`<span class="delta" style="color:var(--muted)">${f1(d)}° ponad celem</span>`
    : html`<span class="delta" style="color:var(--ember)">brakuje ${f1(-d)}°</span>`;
}

export { roomTemp };

// ---- urządzenia: wentylatory i osuszacze ----

export interface Device {
  kind: "fan" | "dehumidifier";
  entity: string;
  name: string;
  on: boolean;
  sub: string;
  state: string;
  periods: Array<[number, number]>;
  power?: string;
  energy?: string;
}

export function devices(ctx: Ctx, r: Room): Device[] {
  const out: Device[] = [];
  const hm = (t: number) => ctx.clock.hm(t);
  for (const f of r.fans) {
    const on = st(ctx, f) === "on";
    const periods = ctx.hist.periods(ctx.hass, f, (v) => v === "on");
    const last = periods[periods.length - 1];
    const sub = on
      ? `pracuje od ${hm(last ? last[0] : Date.parse(ctx.hass.states[f].last_changed))}`
      : last
        ? `ostatnio ${hm(last[0])}–${hm(last[1])}`
        : "nie pracował od doby";
    out.push({ kind: "fan", entity: f, name: "Wentylator", on, sub, state: on ? "pracuje" : "wył.", periods });
  }
  for (const d of r.dehumidifiers) {
    const h = ctx.hass.states[d.entity];
    if (!h) continue;
    const power = num(st(ctx, d.power));
    const working = h.attributes.action === "drying" || (power !== null && power > 5);
    const target = ctx.pending.get(`${d.entity}#h`) ?? num(h.attributes.humidity);
    const cur = num(h.attributes.current_humidity);
    const periods = d.power
      ? ctx.hist.periods(ctx.hass, d.power, (v) => (num(v) ?? 0) > 5)
      : ctx.hist.periods(ctx.hass, d.entity, (v) => v === "on");
    const tariff = ctx.opts.tariff ? st(ctx, ctx.opts.tariff) : undefined;
    const sub =
      h.state === "off"
        ? `wyłączony${tariff ? ` · taryfa ${tariff.toLowerCase()}` : ""}`
        : working
          ? `osusza do ${target ?? "—"}%${power !== null ? ` · ${Math.round(power)} W` : ""}`
          : `${cur === null ? "—" : Math.round(cur)}% przy celu ${target ?? "—"}%, czeka`;
    out.push({
      kind: "dehumidifier",
      entity: d.entity,
      name: "Osuszacz",
      on: working,
      sub,
      state: h.state === "off" ? "wył." : working ? "osusza" : "czuwa",
      periods,
      power: d.power,
      energy: d.energy,
    });
  }
  return out;
}

export const deviceRow = (d: Device) => html`<div class="dev ${d.on ? "on" : ""}">
  <span class="dico">${d.kind === "fan" ? fanIcon : dryIcon}</span>
  <span class="dtxt"><b>${d.name}</b><small>${d.sub}</small></span>
  <span class="dstate">${d.state}</span>
</div>`;

export const deviceIcon = (d: Device) => (d.kind === "fan" ? fanIcon : dryIcon);

export const workTime = (d: Device) => duration(sumPeriods(d.periods));

// ---- nazwy i formatowanie dla zakładek ----

export function deviceName(hass: Hass, id: string): string | undefined {
  const d = hass.entities[id]?.device_id;
  const dev = d ? hass.devices[d] : undefined;
  return dev ? (dev.name_by_user || dev.name || undefined) : undefined;
}

/** Nazwa do pokazania: bez numerów seryjnych, PPE czy identyfikatorów licznika (dłuższe ciągi cyfr) i bez prefiksu
 *  węzła ESPHome („miresphome16 - Plug UPS” → „UPS”). */
export function cleanName(name: string): string {
  const out = name
    .replace(/^[\w-]*\d+\s+[-–]\s+/, "")
    .split(/\s+/)
    .filter((word) => (word.match(/\d/g)?.length ?? 0) < 6)
    .join(" ")
    .replace(/^Plug\s+/i, "")
    .replace(/\s+(ID|nr|no\.?)\s*$/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return out || name;
}

/** Nazwa encji bez nazwy urządzenia na początku (jak w nowych kartach HA). */
export function entityName(hass: Hass, id: string): string {
  const friendly = String(hass.states[id]?.attributes.friendly_name ?? id);
  const dev = deviceName(hass, id);
  const strip = (n: string) =>
    dev && n.toLowerCase().startsWith(dev.toLowerCase()) && n.length > dev.length + 1 ? n.slice(dev.length).replace(/^[\s\-–:]+/, "") : n;
  const reg = hass.entities[id]?.name;
  return cleanName(strip(reg || friendly));
}

/** „od 14:05”, „od wczoraj 18:30”, „od 12.10” — kiedy zaczął się obecny stan. */
export function sinceLabel(ctx: Ctx, t: number | string): string {
  const ms = typeof t === "number" ? t : Date.parse(t);
  const d = new Date(ms), today = new Date();
  today.setHours(0, 0, 0, 0);
  if (ms >= today.getTime()) return `od ${ctx.clock.hm(ms)}`;
  if (ms >= today.getTime() - 864e5) return `od wczoraj ${ctx.clock.hm(ms)}`;
  return `od ${d.getDate()}.${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export const unitOf = (hass: Hass, id?: string | null): string => (id ? hass.states[id]?.attributes.unit_of_measurement ?? "" : "");

/** „5 min”, „2 h 10 min”, „3 dni” od chwili. */
export function since(t: number | string): string {
  const ms = Date.now() - (typeof t === "number" ? t : Date.parse(t));
  const m = Math.max(0, Math.round(ms / 60000));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h} h${m % 60 ? ` ${m % 60} min` : ""}`;
  return `${Math.floor(h / 24)} dni`;
}
