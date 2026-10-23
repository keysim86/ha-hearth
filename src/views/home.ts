// Zakładka Dom: osoby, bramy i garaże, skrzynka pocztowa, odpady, PAYBACK, prognoza pogody.

import { html, nothing, type TemplateResult } from "lit";
import { stem, wasteEvents } from "../data/waste";
import { forecast, wmo } from "../data/weather";
import { f1, num, round } from "../format";
import { doorIcon, gateIcon, icon, mailIcon, steps as stepsIcon, weatherIcon } from "../svg";
import { areaOf } from "../model";
import { entityName, since, sinceLabel, st, type Ctx } from "./common";
const bulbIcon = html`<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a7 7 0 0 0-4 12.7V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.3A7 7 0 0 0 12 2Zm-3 18h6v1a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1Z"></path></svg>`;

const ticketIcon = html`<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 5h16a1 1 0 0 1 1 1v3a2.5 2.5 0 0 0 0 5v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-3a2.5 2.5 0 0 0 0-5V6a1 1 0 0 1 1-1Zm10 2v2h2V7Zm0 4v2h2v-2Zm0 4v2h2v-2Z"></path></svg>`;

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
    // Kroki: najpierw własny czujnik osoby (np. sensor.kroki_<osoba> z szablonu), potem dzienne kroki z telefonu.
    const pid = id.split(".")[1];
    const stepsId =
      [`sensor.kroki_${pid}`, `sensor.steps_${pid}`, `sensor.${pid}_kroki`, `sensor.${pid}_steps`].find((e) => h.states[e]) ??
      onDev((e) => h.states[e]?.attributes.unit_of_measurement === "steps" && /daily/.test(e)) ??
      onDev((e) => h.states[e]?.attributes.unit_of_measurement === "steps");
    const lat = num(p.attributes.latitude), lon = num(p.attributes.longitude);
    const homeLat = h.config?.latitude, homeLon = h.config?.longitude;
    const dist = p.state !== "home" && lat !== null && lon !== null && homeLat !== undefined && homeLon !== undefined ? km(homeLat, homeLon, lat, lon) : null;
    const where = p.state === "home" ? "w domu" : p.state === "not_home" ? "poza domem" : p.state === "unknown" ? "nie wiadomo gdzie" : p.state;
    const bat = num(st(ctx, battery));
    const chg = /charging|full/.test(st(ctx, charging) ?? "") && st(ctx, charging) !== "not_charging" && st(ctx, charging) !== "discharging";
    const color = COLORS[i % COLORS.length];
    const pic = p.attributes.entity_picture as string | undefined;
    return html`<button type="button" class="person ${p.state === "home" ? "home" : ""}" style="--pc:${color}"
      aria-label="${p.attributes.friendly_name ?? id}: pokaż na mapie" @click=${() => ctx.actions.openPerson(id)}>
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
    </button>`;
  });
  return html`<section class="sec"><h2>Domownicy</h2><div class="cards persons">${cards}</div></section>`;
}

const GATE_STATE: Record<string, string> = { open: "Otwarta", closed: "Zamknięta", opening: "Otwiera się…", closing: "Zamyka się…", unavailable: "Niedostępna", unknown: "Nie wiadomo" };

/** Światło przy bramie: obszar z dokładnie jedną bramą i 1–2 światłami (np. osobny obszar jednego garażu). */
function gateLights(ctx: Ctx, cover: string, gateIds: string[]): string[] {
  const h = ctx.hass;
  const area = areaOf(h, cover);
  if (!area) return [];
  // Wszystkie bramy w obszarze (także niepokazane w panelu) — przy kilku nie wiadomo, czyje to światło.
  const covers = new Set([...gateIds, ...Object.keys(h.states).filter((e) => e.startsWith("cover.") && ["gate", "garage", "door"].includes(h.states[e].attributes.device_class))]);
  if ([...covers].filter((g) => areaOf(h, g) === area).length !== 1) return [];
  const lights = Object.keys(h.states).filter((e) => e.startsWith("light.") && areaOf(h, e) === area && !h.entities[e]?.hidden);
  return lights.length >= 1 && lights.length <= 2 ? lights : [];
}

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
    const lights = gateLights(ctx, id, ids);
    return html`<div class="gate ${open ? "open" : ""} ${moving ? "moving" : ""}">
      <span class="gico">${garage ? gateIcon : doorIcon}</span>
      <span class="gtxt"><b>${entityName(h, id)}</b>
        <small>${GATE_STATE[c.state] ?? c.state}${open ? ` · ${since(c.last_changed)}` : moving ? "" : ` · ${sinceLabel(ctx, c.last_changed)}`}</small></span>
      <span class="gacts">
        ${lights.map((l) => html`<button class="bulb ${st(ctx, l) === "on" ? "on" : ""}" type="button" title="Światło: ${entityName(h, l)}"
          aria-label="Światło ${entityName(h, l)}: ${st(ctx, l) === "on" ? "wyłącz" : "włącz"}" aria-pressed=${st(ctx, l) === "on" ? "true" : "false"}
          @click=${() => ctx.actions.call("light", "toggle", { entity_id: l })}>${bulbIcon}</button>`)}
        ${action
          ? html`<button class="btn ${open ? "hot" : ""}" type="button" @click=${() => ctx.actions.call("cover", action[0], { entity_id: id })}>${action[1]}</button>`
          : nothing}
      </span>
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

// ---- PAYBACK: automat aktywujący kupony (stack payback, encje z autodiscovery MQTT) ----

const PAYBACK_STATE: Record<string, [string, boolean]> = {
  ok: ["", false],
  w_toku: ["aktywuję kupony…", false],
  nie_wszystkie: ["nie wszystkie kupony udało się aktywować", true],
  sesja_wygasla: ["sesja wygasła — wgraj nowe ciasteczka", true],
  blokada: ["strona zablokowała automat", true],
  brak_ciasteczek: ["brak ciasteczek — wgraj je w kontenerze", true],
  blad: ["błąd ostatniego przebiegu", true],
};

/** Kafelek na konto: sensor.payback_<konto>_stan (+ _punkty, _aktywne, _do_aktywacji, button …_aktywuj_kupony). */
function payback(ctx: Ctx): TemplateResult[] {
  const h = ctx.hass;
  const konta = Object.keys(h.states)
    .filter((e) => /^sensor\.payback_[a-z0-9_]+_stan$/.test(e) && !h.entities[e]?.hidden)
    .map((e) => e.slice("sensor.payback_".length, -"_stan".length))
    .sort();
  return konta.map((k) => {
    const id = (s: string) => `sensor.payback_${k}_${s}`;
    const stan = st(ctx, id("stan")) ?? "unknown";
    const [opis, uwaga] = PAYBACK_STATE[stan] ?? (stan === "unavailable" ? ["automat nie odpowiada", true] : ["", false]);
    const pkt = num(st(ctx, id("punkty"))), akt = num(st(ctx, id("aktywne"))), doAkt = num(st(ctx, id("do_aktywacji")));
    const kiedy = st(ctx, id("ostatnie_uruchomienie"));
    const btn = `button.payback_${k}_aktywuj_kupony`;
    const imie = konta.length > 1 ? ` · ${k.charAt(0).toUpperCase()}${k.slice(1)}` : "";
    return html`<div class="box2 payback ${uwaga ? "warn" : ""} ${stan === "w_toku" ? "busy" : ""}">
      <button type="button" class="gico" aria-label="PAYBACK: historia punktów" @click=${() => ctx.actions.moreInfo(id("punkty"))}>${ticketIcon}</button>
      <span class="gtxt"><b>PAYBACK${imie} · ${round(pkt)} °P</b>
        <small>${akt !== null ? `${round(akt)} aktywnych kuponów` : "kupony: brak danych"}${doAkt ? ` · ${round(doAkt)} do aktywacji` : ""}${kiedy && Date.parse(kiedy) ? ` · sprawdzone ${since(kiedy)} temu` : ""}</small>
        ${opis ? html`<small class="pbstan">${opis}</small>` : nothing}</span>
      ${h.states[btn] ? html`<button class="btn" type="button" ?disabled=${stan === "w_toku"}
        @click=${() => ctx.actions.call("button", "press", { entity_id: btn })}>Aktywuj</button>` : nothing}
    </div>`;
  });
}

// Kolory pojemników jak w polskiej segregacji (bio brązowy, szkło zielony, papier niebieski, metale i tworzywa żółty).
const WASTE_COLOR: Array<[RegExp, string]> = [[/bio|zielon/i, "#8b5a2b"], [/szk|glass/i, "#2e9e4f"], [/papier|paper/i, "#2f6fb3"],
  [/metal|plast|tworzyw/i, "#e0b000"], [/zmiesz|mixed|resz/i, "#4b5563"], [/gabaryt|bulky/i, "#7c3aed"], [/elektr|zuzyt/i, "#dc2626"], [/popi[oó]ł|ash/i, "#9ca3af"]];
const WASTE_NAME: Array<[RegExp, string]> = [[/^bio/i, "Biodegradowalne"], [/^szk/i, "Szkło"], [/^papier/i, "Papier i tektura"],
  [/^(metal|plastik|tworzyw)/i, "Metale i tworzywa sztuczne"], [/^zmiesz/i, "Zmieszane"], [/^wielko/i, "Wielkogabarytowe"]];
const bin = (color: string) => html`<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 6h10l-1 11H6Z" fill=${color}></path><rect x="4" y="3.5" width="12" height="2" rx="1" fill=${color}></rect><rect x="8" y="2" width="4" height="1.6" rx=".8" fill=${color}></rect></svg>`;
const prettyWaste = (raw: string) => WASTE_NAME.find(([re]) => re.test(raw))?.[1] ?? raw.charAt(0).toUpperCase() + raw.slice(1);

interface WasteRow {
  name: string;
  date: Date | null;
  days: number | null;
}

/** Przełączniki frakcji: z opcji albo pomocniki input_boolean z „odpad/waste” w nazwie. */
export function wasteToggles(ctx: Ctx): string[] {
  const h = ctx.hass;
  if (ctx.opts.waste_toggles?.length) return ctx.opts.waste_toggles.filter((e) => h.states[e]);
  return Object.keys(h.states).filter((e) => e.startsWith("input_boolean.") && /odpad|waste|smieci|śmieci/i.test(`${e} ${h.states[e].attributes.friendly_name ?? ""}`));
}

/** Przełącznik pasujący do frakcji (po pierwszych literach nazwy, bez polskich znaków). */
export function toggleFor(ctx: Ctx, name: string): string | undefined {
  const s = stem(name);
  if (s.length < 3) return undefined;
  return wasteToggles(ctx).find((e) => {
    const words = `${e.split(".")[1]} ${ctx.hass.states[e].attributes.friendly_name ?? ""}`.replace(/[_]/g, " ").split(/\s+/);
    return words.some((w) => w.length >= 3 && stem(w) === s && !/^(odp|was|akt|act|sm[ie])$/.test(stem(w)));
  });
}

function wasteRows(ctx: Ctx): WasteRow[] {
  const h = ctx.hass;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysTo = (d: Date) => Math.round((d.getTime() - today.getTime()) / 864e5);
  // 1) wybrane czujniki, 2) kalendarz (z opcji albo Waste Collection Schedule), 3) czujniki integracji z datą
  if (!ctx.opts.waste?.length) {
    const cals = ctx.opts.waste_calendar
      ? [ctx.opts.waste_calendar]
      : Object.values(h.entities).filter((e) => e.platform === "waste_collection_schedule" && e.entity_id.startsWith("calendar.")).map((e) => e.entity_id);
    if (cals.length) {
      const events = wasteEvents(h, cals, ctx.refresh);
      if (events === null) return [];
      const next = new Map<string, Date>();
      for (const e of events) {
        if (e.date < today) continue;
        const prev = next.get(e.name);
        if (!prev || e.date < prev) next.set(e.name, e.date);
      }
      return [...next].map(([raw, date]) => ({ name: prettyWaste(raw), date, days: daysTo(date) }));
    }
  }
  const ids = ctx.opts.waste?.length ? ctx.opts.waste : Object.values(h.entities).filter((e) => e.platform === "waste_collection_schedule" && e.entity_id.startsWith("sensor.")).map((e) => e.entity_id);
  return ids
    .filter((id) => h.states[id])
    .map((id) => {
      const s = h.states[id];
      const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(s.state) ?? /^(\d{4})-(\d{2})-(\d{2})/.exec(s.state);
      const date = m ? (m[1].length === 4 ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(+m[3], +m[2] - 1, +m[1])) : null;
      const raw = String(s.attributes.friendly_name ?? id).replace(/^odpady[_ ]?/i, "").replace(/_/g, " ");
      return { name: prettyWaste(raw), date, days: num(s.attributes.daysTo) ?? (date ? daysTo(date) : null) };
    })
    // Frakcja bez terminu znika (np. wielkogabarytowe poza zbiórką, zbiorcze „Wszystkie”).
    .filter((r) => r.date !== null);
}

function waste(ctx: Ctx): TemplateResult | typeof nothing {
  const rows = wasteRows(ctx)
    .filter((r) => {
      const t = toggleFor(ctx, r.name);
      return !t || st(ctx, t) === "on";
    })
    .sort((a, b) => (a.days ?? 999) - (b.days ?? 999));
  if (!rows.length) return nothing;
  const when = (d: number | null) => (d === null ? "—" : d <= 0 ? "dziś" : d === 1 ? "jutro" : `za ${d} dni`);
  return html`<div class="box2 waste"><h3>Odpady</h3>
    ${rows.map((r) => html`<div class="wrow ${r.days !== null && r.days <= 1 ? "soon" : ""}">
      <span class="wico2">${bin(WASTE_COLOR.find(([re]) => re.test(r.name))?.[1] ?? "#6b7280")}</span>
      <span class="wname">${r.name}</span>
      <span class="wdate">${r.date ? `${DAY_NAMES[r.date.getDay()]} ${r.date.getDate()}.${String(r.date.getMonth() + 1).padStart(2, "0")}` : ""}</span>
      <b>${when(r.days)}</b>
    </div>`)}
  </div>`;
}

const WEATHER_VIEWS: Array<[string, string]> = [["prognoza", "Prognoza 14 dni"], ["radar", "Radar opadów"], ["windy", "Windy"]];

function weather(ctx: Ctx): TemplateResult | typeof nothing {
  const lat = ctx.hass.config?.latitude, lon = ctx.hass.config?.longitude;
  if (lat === undefined || lon === undefined) return nothing;
  const view = WEATHER_VIEWS.some(([k]) => k === ctx.ui.weather) ? ctx.ui.weather : "prognoza";
  const tabs = html`<div class="seg2" role="tablist" aria-label="Widok pogody">${WEATHER_VIEWS.map(
    ([k, label]) => html`<button type="button" role="tab" aria-selected=${k === view ? "true" : "false"} class=${k === view ? "on" : ""} @click=${() => ctx.actions.setUi("weather", k)}>${label}</button>`,
  )}</div>`;
  const head = html`<h2>Pogoda ${view === "prognoza" ? html`<small>ECMWF · Open-Meteo</small>` : view === "radar" ? html`<small>RainViewer</small>` : html`<small>model ECMWF</small>`}</h2>`;
  if (view === "radar")
    return html`<section class="sec">${head}${tabs}<iframe class="wxframe" title="Radar opadów RainViewer" loading="lazy"
      src="https://www.rainviewer.com/map.html?loc=${lat},${lon},8&oFa=0&oC=1&oU=0&oCS=1&oF=0&oAP=1&rmt=4&c=1&o=83&lm=${ctx.ui.dark === "1" ? 1 : 0}&layer=radar&sm=1&sn=1"></iframe></section>`;
  if (view === "windy")
    return html`<section class="sec">${head}${tabs}<iframe class="wxframe" title="Mapa Windy" loading="lazy" allowfullscreen
      src="https://embed.windy.com/embed.html?type=map&location=coordinates&metricRain=mm&metricTemp=%C2%B0C&metricWind=km%2Fh&zoom=9&overlay=wind&product=ecmwf&level=surface&lat=${lat}&lon=${lon}&detailLat=${lat}&detailLon=${lon}&detail=true"></iframe></section>`;
  const days = forecast(lat, lon, ctx.refresh);
  if (days === null) return nothing;
  if (!days.length) return html`<section class="sec">${head}${tabs}<div class="empty">Prognoza się ładuje…</div></section>`;
  const lo = Math.min(...days.map((d) => d.tmin)), hi = Math.max(...days.map((d) => d.tmax));
  const pos = (v: number) => ((v - lo) / Math.max(1, hi - lo)) * 100;
  return html`<section class="sec">${head}${tabs}
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
  const mail = mailbox(ctx), bins = waste(ctx), pb = payback(ctx);
  return html`${persons(ctx)} ${gates(ctx)}
    ${mail !== nothing || bins !== nothing || pb.length ? html`<section class="sec"><div class="cards two top">${mail}${bins}${pb}</div></section>` : nothing}
    ${weather(ctx)}`;
}

// ---- okno osoby: dane + mapa ----

/** Prosta mapa z kafelków (gdy w przeglądarce nie ma karty mapy HA, np. w podglądzie bez HA). */
export function tileMap(lat: number, lon: number, zoom: number, dark: boolean): TemplateResult {
  const n = 2 ** zoom;
  const px = ((lon + 180) / 360) * n * 256;
  const r = (lat * Math.PI) / 180;
  const py = ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n * 256;
  const tx = Math.floor(px / 256), ty = Math.floor(py / 256);
  const tiles = [];
  for (let dx = -2; dx <= 2; dx++)
    for (let dy = -2; dy <= 2; dy++)
      tiles.push(html`<img alt="" draggable="false" src="https://tile.openstreetmap.org/${zoom}/${(tx + dx + n) % n}/${ty + dy}.png"
        style="left:calc(50% + ${((tx + dx) * 256 - px).toFixed(0)}px);top:calc(50% + ${((ty + dy) * 256 - py).toFixed(0)}px)" />`);
  return html`<div class="tmap ${dark ? "dark" : ""}">${tiles}<span class="tpin"></span><span class="tattr">© OpenStreetMap</span></div>`;
}

export function personInfo(ctx: Ctx, id: string): TemplateResult | typeof nothing {
  const h = ctx.hass, p = h.states[id];
  if (!p) return nothing;
  const lat = num(p.attributes.latitude), lon = num(p.attributes.longitude);
  const homeLat = h.config?.latitude, homeLon = h.config?.longitude;
  const dist = lat !== null && lon !== null && homeLat !== undefined && homeLon !== undefined ? km(homeLat, homeLon, lat, lon) : null;
  const where = p.state === "home" ? "w domu" : p.state === "not_home" ? "poza domem" : p.state;
  const acc = num(p.attributes.gps_accuracy);
  return html`<div class="pinfo">
    <span><b>${where}</b> · ${sinceLabel(ctx, p.last_changed)}</span>
    ${dist !== null && p.state !== "home" ? html`<span>${dist < 10 ? f1(dist) : round(dist)} km od domu</span>` : nothing}
    ${acc !== null ? html`<span>dokładność GPS ±${round(acc)} m</span>` : nothing}
    ${lat !== null && lon !== null
      ? html`<a href="https://www.google.com/maps?q=${lat},${lon}" target="_blank" rel="noopener noreferrer">Otwórz w Mapach Google ↗</a>`
      : html`<span>brak współrzędnych z telefonu</span>`}
  </div>`;
}
