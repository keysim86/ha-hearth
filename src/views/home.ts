// Zakładka Dom: osoby, bramy i garaże, skrzynka pocztowa, odpady, prognoza pogody.

import { html, nothing, type TemplateResult } from "lit";
import { forecast, wmo } from "../data/weather";
import { f1, num, round } from "../format";
import { doorIcon, gateIcon, icon, mailIcon, steps as stepsIcon, weatherIcon } from "../svg";
import { entityName, since, sinceLabel, st, type Ctx } from "./common";

const COLORS = ["#38bdf8", "#f472b6", "#a78bfa", "#fbbf24", "#34d399", "#fb7185", "#60a5fa", "#f59e0b"];
const DAY_NAMES = ["nd", "pn", "wt", "śr", "cz", "pt", "sb"];

function km(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lon2 - lon1) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function persons(ctx: Ctx): TemplateResult | typeof nothing {
  const h = ctx.hass;
  const ids = ctx.opts.persons?.length
    ? ctx.opts.persons
    : Object.keys(h.states).filter((e) => e.startsWith("person.") && (h.states[e].attributes.device_trackers ?? []).length && !h.entities[e]?.hidden);
  if (!ids.length) return nothing;
  const cards = ids.filter((id) => h.states[id]).map((id, i) => {
    const p = h.states[id];
    const tracker = (p.attributes.device_trackers ?? [])[0] as string | undefined;
    const dev = tracker ? h.entities[tracker]?.device_id : undefined;
    const onDev = (test: (e: string) => boolean) =>
      dev ? Object.values(h.entities).find((e) => e.device_id === dev && e.entity_id.startsWith("sensor.") && test(e.entity_id))?.entity_id : undefined;
    const battery = onDev((e) => h.states[e]?.attributes.device_class === "battery" && /battery_level|bateria/.test(e)) ?? onDev((e) => h.states[e]?.attributes.device_class === "battery");
    const charging = onDev((e) => /battery_state/.test(e));
    const stepsId = onDev((e) => h.states[e]?.attributes.unit_of_measurement === "steps" && /daily/.test(e)) ?? onDev((e) => h.states[e]?.attributes.unit_of_measurement === "steps");
    const lat = num(p.attributes.latitude), lon = num(p.attributes.longitude);
    const homeLat = h.config?.latitude, homeLon = h.config?.longitude;
    const dist = p.state !== "home" && lat !== null && lon !== null && homeLat !== undefined && homeLon !== undefined ? km(homeLat, homeLon, lat, lon) : null;
    const where = p.state === "home" ? "w domu" : p.state === "not_home" ? "poza domem" : p.state === "unknown" ? "nie wiadomo gdzie" : p.state;
    const bat = num(st(ctx, battery));
    const chg = /charging|full/.test(st(ctx, charging) ?? "") && st(ctx, charging) !== "not_charging" && st(ctx, charging) !== "discharging";
    const color = COLORS[i % COLORS.length];
    const pic = p.attributes.entity_picture as string | undefined;
    return html`<div class="person ${p.state === "home" ? "home" : ""}" style="--pc:${color}">
      <div class="avatar"><span>${String(p.attributes.friendly_name ?? id).slice(0, 1)}</span>${pic
        ? html`<img src=${pic} alt="" loading="lazy" @error=${(e: Event) => ((e.target as HTMLElement).hidden = true)} />`
        : nothing}</div>
      <div class="pmain">
        <b>${p.attributes.friendly_name ?? id}</b>
        <span class="where"><span class="dot ${p.state === "home" ? "ok" : ""}"></span>${where}${dist !== null ? ` · ${dist < 10 ? f1(dist) : round(dist)} km` : ""} · ${sinceLabel(ctx, p.last_changed)}</span>
        <span class="pchips">
          ${battery ? html`<span class=${bat !== null && bat <= 15 && !chg ? "low" : ""}>${icon("batt")}${bat === null ? "—" : `${round(bat)}%`}${chg ? " ⚡" : ""}</span>` : nothing}
          ${stepsId ? html`<span>${stepsIcon}${round(num(st(ctx, stepsId)))} kroków</span>` : nothing}
        </span>
      </div>
    </div>`;
  });
  return html`<section class="sec"><h2>Domownicy</h2><div class="cards persons">${cards}</div></section>`;
}

const GATE_STATE: Record<string, string> = { open: "Otwarta", closed: "Zamknięta", opening: "Otwiera się…", closing: "Zamyka się…", unavailable: "Niedostępna", unknown: "Nie wiadomo" };

function gates(ctx: Ctx): TemplateResult | typeof nothing {
  const h = ctx.hass;
  const ids = ctx.opts.gates?.length
    ? ctx.opts.gates
    : Object.keys(h.states).filter((e) => e.startsWith("cover.") && ["gate", "garage", "door"].includes(h.states[e].attributes.device_class) && !h.entities[e]?.hidden);
  if (!ids.length) return nothing;
  const tiles = ids.filter((id) => h.states[id]).map((id) => {
    const c = h.states[id];
    const moving = c.state === "opening" || c.state === "closing";
    const open = c.state === "open";
    const canStop = (Number(c.attributes.supported_features) & 8) === 8;
    const action = moving ? (canStop ? ["stop_cover", "Zatrzymaj"] : null) : open ? ["close_cover", "Zamknij"] : ["open_cover", "Otwórz"];
    const garage = c.attributes.device_class === "garage";
    return html`<div class="gate ${open ? "open" : ""} ${moving ? "moving" : ""}">
      <span class="gico">${garage ? gateIcon : doorIcon}</span>
      <span class="gtxt"><b>${entityName(h, id)}</b>
        <small>${GATE_STATE[c.state] ?? c.state}${open ? ` · ${since(c.last_changed)}` : moving ? "" : ` · ${sinceLabel(ctx, c.last_changed)}`}</small></span>
      ${action
        ? html`<button class="btn ${open ? "hot" : ""}" type="button" @click=${() => ctx.actions.call("cover", action[0], { entity_id: id })}>${action[1]}</button>`
        : nothing}
    </div>`;
  });
  return html`<section class="sec"><h2>Bramy i garaże</h2><div class="cards gates">${tiles}</div></section>`;
}

function mailbox(ctx: Ctx): TemplateResult | typeof nothing {
  const id = ctx.opts.mailbox;
  if (!id || !ctx.hass.states[id]) return nothing;
  const m = ctx.hass.states[id];
  const full = m.state === "on";
  const bat = num(st(ctx, ctx.opts.mailbox_battery));
  return html`<div class="box2 mail ${full ? "full" : ""}">
    <span class="gico">${mailIcon}</span>
    <span class="gtxt"><b>${full ? "Jest poczta!" : "Skrzynka pusta"}</b>
      <small>${full ? sinceLabel(ctx, m.last_changed) : `ostatnio ${since(m.last_changed)} temu`}${bat !== null ? ` · bateria ${round(bat)}%` : ""}</small></span>
  </div>`;
}

// Kolory pojemników jak w polskiej segregacji (bio brązowy, szkło zielony, papier niebieski, metale i tworzywa żółty).
const WASTE_COLOR: Array<[RegExp, string]> = [[/bio/i, "#8b5a2b"], [/szk|glass/i, "#2e9e4f"], [/papier|paper/i, "#2f6fb3"], [/metal|plast|tworzyw/i, "#e0b000"], [/zmiesz|mixed|resz/i, "#4b5563"]];
const WASTE_NAME: Array<[RegExp, string]> = [[/^bio/i, "Biodegradowalne"], [/^szk/i, "Szkło"], [/^papier/i, "Papier i tektura"],
  [/^(metal|plastik|tworzyw)/i, "Metale i tworzywa sztuczne"], [/^zmiesz/i, "Zmieszane"]];
const bin = (color: string) => html`<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 6h10l-1 11H6Z" fill=${color}></path><rect x="4" y="3.5" width="12" height="2" rx="1" fill=${color}></rect><rect x="8" y="2" width="4" height="1.6" rx=".8" fill=${color}></rect></svg>`;

function waste(ctx: Ctx): TemplateResult | typeof nothing {
  const h = ctx.hass;
  const ids = ctx.opts.waste?.length ? ctx.opts.waste : Object.values(h.entities).filter((e) => e.platform === "waste_collection_schedule").map((e) => e.entity_id);
  const rows = ids
    .filter((id) => h.states[id])
    .map((id) => {
      const s = h.states[id];
      let days = num(s.attributes.daysTo);
      const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(s.state);
      const date = m ? new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])) : null;
      if (days === null && date) days = Math.round((date.getTime() - new Date().setHours(0, 0, 0, 0)) / 864e5);
      const raw = String(s.attributes.friendly_name ?? id).replace(/^odpady[_ ]?/i, "").replace(/_/g, " ");
      // Encje z harmonogramu mają często nazwy bez polskich znaków („odpady_szklo”) — dla znanych frakcji pełna nazwa.
      const name = WASTE_NAME.find(([re]) => re.test(raw))?.[1] ?? raw.charAt(0).toUpperCase() + raw.slice(1);
      return { id, name, days, date };
    })
    // Bez wybranych encji: tylko czujniki z datą (bez zbiorczych „Wszystkie” itp.).
    .filter((r) => ctx.opts.waste?.length || r.date)
    .sort((a, b) => (a.days ?? 999) - (b.days ?? 999));
  if (!rows.length) return nothing;
  const when = (d: number | null) => (d === null ? "—" : d <= 0 ? "dziś" : d === 1 ? "jutro" : `za ${d} dni`);
  return html`<div class="box2 waste"><h3>Odpady</h3>
    ${rows.map((r) => html`<div class="wrow ${r.days !== null && r.days <= 1 ? "soon" : ""}">
      <span class="wico2">${bin(WASTE_COLOR.find(([re]) => re.test(r.id + r.name))?.[1] ?? "#6b7280")}</span>
      <span class="wname">${r.name}</span>
      <span class="wdate">${r.date ? `${DAY_NAMES[r.date.getDay()]} ${r.date.getDate()}.${String(r.date.getMonth() + 1).padStart(2, "0")}` : ""}</span>
      <b>${when(r.days)}</b>
    </div>`)}
  </div>`;
}

function weather(ctx: Ctx): TemplateResult | typeof nothing {
  const days = forecast(ctx.hass.config?.latitude, ctx.hass.config?.longitude, ctx.refresh);
  if (days === null) return nothing;
  if (!days.length) return html`<section class="sec"><h2>Pogoda</h2><div class="empty">Prognoza się ładuje…</div></section>`;
  const lo = Math.min(...days.map((d) => d.tmin)), hi = Math.max(...days.map((d) => d.tmax));
  const pos = (v: number) => ((v - lo) / Math.max(1, hi - lo)) * 100;
  return html`<section class="sec"><h2>Pogoda <small>ECMWF · 14 dni</small></h2>
    <div class="fc">
      ${days.map((d, i) => {
        const date = new Date(`${d.date}T12:00:00`);
        const [desc, kind] = wmo(d.code);
        return html`<div class="fday ${i === 0 ? "today" : ""}" title=${desc}>
          <span class="fdn">${i === 0 ? "dziś" : DAY_NAMES[date.getDay()]}</span>
          <span class="fdd">${date.getDate()}.${String(date.getMonth() + 1).padStart(2, "0")}</span>
          ${weatherIcon(kind)}
          <span class="ftmax">${Math.round(d.tmax)}°</span>
          <span class="frange"><i style="bottom:${pos(d.tmin).toFixed(0)}%;height:${Math.max(4, pos(d.tmax) - pos(d.tmin)).toFixed(0)}%"></i></span>
          <span class="ftmin">${Math.round(d.tmin)}°</span>
          <span class="frain ${d.rain >= 1 ? "wet" : ""}">${d.rain >= 0.1 ? `${f1(d.rain)} mm` : "—"}</span>
          <span class="fwind">${Math.round(d.wind)} km/h</span>
        </div>`;
      })}
    </div>
  </section>`;
}

export function homeView(ctx: Ctx): TemplateResult {
  const mail = mailbox(ctx), bins = waste(ctx);
  return html`${persons(ctx)} ${gates(ctx)}
    ${mail !== nothing || bins !== nothing ? html`<section class="sec"><div class="cards two top">${mail}${bins}</div></section>` : nothing}
    ${weather(ctx)}`;
}
