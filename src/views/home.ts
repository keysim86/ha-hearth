// Zakładka Dom: osoby, bramy i garaże, skrzynka pocztowa, odpady, PAYBACK, Lidl Plus, Moja Biedronka, prognoza pogody.

import { html, nothing, type TemplateResult } from "lit";
import { stem, wasteEvents } from "../data/waste";
import { forecast, wmo } from "../data/weather";
import { f1, num, round, zl } from "../format";
import { doorIcon, gateIcon, icon, mailIcon, steps as stepsIcon, weatherIcon } from "../svg";
import { areaOf } from "../model";
import { code128, ean13, pdf417, qr } from "../barcode";
import { entityName, since, sinceLabel, st, type CouponKind, type Ctx } from "./common";
const bulbIcon = html`<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a7 7 0 0 0-4 12.7V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.3A7 7 0 0 0 12 2Zm-3 18h6v1a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1Z"></path></svg>`;


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

// ---- karty lojalnościowe: kod do zeskanowania przy kasie (sensor.<automat>_<konto>_karta) ----

/** Stan encji karty = treść kodu, atrybuty `format` (ean13 / qr / pdf417 / code128 / gs1-128 / tekst = sam numer) i `numer`. */
function cardCode(ctx: Ctx, kind: CouponKind, konto: string): { kod: string; format: string; numer: string } | null {
  const s = ctx.hass.states[`sensor.${kind}_${konto}_karta`];
  if (!s || ["unknown", "unavailable", ""].includes(s.state)) return null;
  return { kod: s.state, format: String(s.attributes.format ?? ""), numer: String(s.attributes.numer ?? s.state) };
}

function cardButton(ctx: Ctx, kind: CouponKind, konto: string): TemplateResult | typeof nothing {
  if (!cardCode(ctx, kind, konto)) return nothing;
  return html`<button class="pbbtn" type="button"
    @click=${(e: Event) => { e.stopPropagation(); ctx.actions.openCoupons(kind, konto, "karta"); }}>Karta</button>`;
}

function qrSvg(text: string): TemplateResult | null {
  const m = qr(text);
  if (!m) return null;
  const q = 4, n = m.length + 2 * q;
  const d = m.flatMap((row, y) => row.map((v, x) => (v ? `M${x + q} ${y + q}h1v1h-1z` : ""))).join("");
  return html`<svg class="qr" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges" role="img" aria-label="Kod QR karty">
    <rect width=${n} height=${n} fill="#fff"></rect><path d=${d} fill="#000"></path></svg>`;
}

function eanSvg(code: string): TemplateResult | null {
  const bits = ean13(code);
  if (!bits) return null;
  // Margines ciszy wg standardu: 11 modułów z lewej, 7 z prawej; kreski straży (początek, środek, koniec) dłuższe.
  const ql = 11, w = ql + bits.length + 7, guard = new Set([0, 1, 2, 45, 46, 47, 48, 49, 92, 93, 94]);
  const d = [...bits].map((b, i) => (b === "1" ? `M${ql + i} 2h1v${guard.has(i) ? 48 : 43}h-1z` : "")).join("");
  return html`<svg class="ean" viewBox="0 0 ${w} 52" shape-rendering="crispEdges" role="img" aria-label="Kod kreskowy EAN-13 karty">
    <rect width=${w} height="52" fill="#fff"></rect><path d=${d} fill="#000"></path></svg>`;
}

function c128Svg(code: string, gs1: boolean): TemplateResult | null {
  const bits = code128(code, gs1);
  if (!bits) return null;
  const q = 10, w = q + bits.length + q; // margines ciszy Code 128: min. 10 modułów z każdej strony
  const d = [...bits].map((b, i) => (b === "1" ? `M${q + i} 2h1v46h-1z` : "")).join("");
  return html`<svg class="ean" viewBox="0 0 ${w} 50" shape-rendering="crispEdges" role="img" aria-label="Kod kreskowy ${gs1 ? "GS1-128" : "Code 128"} karty">
    <rect width=${w} height="50" fill="#fff"></rect><path d=${d} fill="#000"></path></svg>`;
}

function pdfSvg(text: string): TemplateResult | null {
  const rows = pdf417(text);
  if (!rows) return null;
  const q = 2, h = 4, w = rows[0].length + 2 * q, H = rows.length * h + 2 * q; // wiersz = 4 moduły (min. 3) — łatwiej z ekranu
  const d = rows.flatMap((row, y) => [...row.matchAll(/1+/g)].map((m) => `M${q + m.index!} ${q + y * h}h${m[0].length}v${h}h-${m[0].length}z`)).join("");
  return html`<svg class="pdf" viewBox="0 0 ${w} ${H}" shape-rendering="crispEdges" role="img" aria-label="Kod PDF417 karty">
    <rect width=${w} height=${H} fill="#fff"></rect><path d=${d} fill="#000"></path></svg>`;
}

/** Treść okna karty: kod na białym tle (także w ciemnym motywie, bo czytnik przy kasie potrzebuje kontrastu) i numer. */
export function loyaltyCard(ctx: Ctx, kind: CouponKind, konto: string): TemplateResult {
  const c = cardCode(ctx, kind, konto);
  const rysunek = !c ? null : c.format === "qr" ? qrSvg(c.kod) : c.format === "ean13" ? eanSvg(c.kod)
    : c.format === "code128" || c.format === "gs1-128" ? c128Svg(c.kod, c.format === "gs1-128") : c.format === "pdf417" ? pdfSvg(c.kod) : null;
  const numer = c && c.numer && c.numer !== "null" ? c.numer.replace(/(\d{4})(?=\d)/g, "$1 ") : "";
  return html`${rysunek
      ? html`<div class="lkod">${rysunek}<b class="lnum">${numer}</b></div>`
      : numer
        ? html`<div class="lkod"><b class="lnum big">${numer}</b></div>
          <small class="pbmeta">${c!.format === "tekst" ? "Automat nie zna jeszcze formatu kodu z aplikacji — przy kasie podaj numer karty." : `Kodu w formacie „${c!.format}” panel jeszcze nie rysuje — przy kasie podaj numer karty.`}</small>`
        : html`<div class="empty">Automat nie podał jeszcze numeru karty.</div>`}
    ${rysunek ? html`<small class="pbmeta">Przy kasie podkręć jasność ekranu i trzymaj telefon kilkanaście centymetrów od czytnika.</small>` : nothing}`;
}

/** Oficjalne logo z encji image.<automat>_<konto>_logo (automat pobiera je z serwera marki, HA je serwuje). */
function logoImg(ctx: Ctx, kind: CouponKind, konto: string, cls = ""): TemplateResult | null {
  const src = ctx.hass.states[`image.${kind}_${konto}_logo`]?.attributes.entity_picture as string | undefined;
  return src ? html`<img class="lplogo ${cls}" src=${src} alt="" @error=${(e: Event) => ((e.target as HTMLElement).hidden = true)} />` : null;
}

const MIESIACE = ["styczeń", "luty", "marzec", "kwiecień", "maj", "czerwiec", "lipiec", "sierpień", "wrzesień", "październik", "listopad", "grudzień"];
const MIESIACE_W = ["styczniu", "lutym", "marcu", "kwietniu", "maju", "czerwcu", "lipcu", "sierpniu", "wrześniu", "październiku", "listopadzie", "grudniu"];

/** „523,40 zł w październiku” z sensor.<automat>_<konto>_wydatki_w_miesiacu (atrybut `miesiac` = RRRR-MM); pusto bez zakupów. */
function monthSpend(ctx: Ctx, kind: CouponKind, konto: string): string {
  const s = ctx.hass.states[`sensor.${kind}_${konto}_wydatki_w_miesiacu`];
  const v = num(s?.state), m = Number(String(s?.attributes.miesiac ?? "").slice(5, 7));
  return !v ? "" : `${zl(v)} w ${MIESIACE_W[m - 1] ?? "tym miesiącu"}`; // 0 = bez zakupów w tym miesiącu
}

const RUN_ICON = html`<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M17.65 6.35A7.96 7.96 0 0 0 12 4a8 8 0 1 0 7.73 10h-2.08A6 6 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35Z"></path></svg>`;
const OPEN_ICON = html`<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7Zm5 16H5V5h7V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7h-2v7Z"></path></svg>`;

/** Okrągłe przyciski z prawej strony rzędu (żeby przyciski karty mieściły się w jednym wierszu): „uruchom automat teraz”
 *  (button.press) i panel automatu; gdy trzeba się zalogować — zamiast ikony wyraźne „Zaloguj ↗”. */
function sideButtons(ctx: Ctx, run: { entity: string; opis: string; zajety: boolean } | null, panel?: string, stan?: string): TemplateResult {
  const stop = (e: Event) => e.stopPropagation();
  return html`<span class="pbside">
    ${run && ctx.hass.states[run.entity] ? html`<button class="pbbtn pbico" type="button" title=${run.opis} aria-label=${run.opis} ?disabled=${run.zajety}
      @click=${(e: Event) => { stop(e); ctx.actions.call("button", "press", { entity_id: run.entity }); }}>${RUN_ICON}</button>` : nothing}
    ${!panel ? nothing : stan === "wymaga_logowania"
      ? html`<a class="pbbtn" href=${panel} target="_blank" rel="noopener noreferrer" @click=${stop}>Zaloguj ↗</a>`
      : html`<a class="pbbtn pbico" href=${panel} target="_blank" rel="noopener noreferrer" title="Panel automatu" aria-label="Panel automatu" @click=${stop}>${OPEN_ICON}</a>`}
  </span>`;
}

function receiptsButton(ctx: Ctx, kind: CouponKind, konto: string): TemplateResult | typeof nothing {
  if (!ctx.hass.states[`sensor.${kind}_${konto}_paragony`]) return nothing;
  return html`<button class="pbbtn" type="button"
    @click=${(e: Event) => { e.stopPropagation(); ctx.actions.openCoupons(kind, konto, "paragony"); }}>Paragony</button>`;
}

interface Pozycja { nazwa: string; ilosc?: number | null; jednostka?: string | null; cena?: number | null; wartosc?: number | null; rabat?: number; rabaty?: string[] }
interface Paragon { id: string; data: string; sklep?: string; adres?: string; suma?: number | null; rabat?: number; rabat_lidl_plus?: number; pozycje?: Pozycja[] }

const liczba = (v: number) => v.toLocaleString("pl-PL", { maximumFractionDigits: 3 });

function receiptRow(ctx: Ctx, r: Paragon, filtr: ((p: Pozycja) => boolean) | null): TemplateResult {
  const t = Date.parse(r.data), d = new Date(t);
  const pozycje = (r.pozycje ?? []).filter((p) => !filtr || filtr(p));
  return html`<details class="rcp" ?open=${Boolean(filtr)}>
    <summary><span class="rcpd"><b>${DAY_NAMES[d.getDay()]} ${dm(t)}</b> ${ctx.clock.hm(t)}</span>
      <span class="rcps">${r.adres || r.sklep || ""}</span>
      <b class="rcpt">${zl(r.suma)}</b>${r.rabat ? html`<span class="rcpr">−${zl(r.rabat)}</span>` : nothing}</summary>
    ${pozycje.length
      ? html`<div class="rcpi">${pozycje.map((p) => html`<div class="rcpp">
          <span>${p.nazwa}${p.rabat ? html`<small class="rcpr">${(p.rabaty ?? ["rabat"]).join(", ")} ${zl(p.rabat)}</small>` : nothing}</span>
          <small>${p.ilosc !== null && p.ilosc !== undefined && !(p.ilosc === 1 && !p.jednostka) ? `${liczba(p.ilosc)}${p.jednostka ? ` ${p.jednostka}` : ""} × ${zl(p.cena)}` : ""}</small>
          <b>${zl(p.wartosc)}</b></div>`)}</div>`
      : html`<small class="pbmeta">Ten paragon nie ma listy produktów w aplikacji.</small>`}
    ${r.rabat && !filtr ? html`<small class="pbmeta">Rabaty razem ${zl(r.rabat)}${r.rabat_lidl_plus ? ` (Lidl Plus ${zl(r.rabat_lidl_plus)})` : ""}</small>` : nothing}
  </details>`;
}

/** Okno e-paragonów (sensor.<automat>_<konto>_paragony, atrybut `paragony`): miesiące z sumą i rabatami, paragony do
 *  rozwinięcia z pozycjami; wyszukiwanie po produkcie pokazuje tylko pasujące pozycje i ich sumę. */
export function receiptsView(ctx: Ctx, kind: CouponKind, konto: string): TemplateResult {
  const s = ctx.hass.states[`sensor.${kind}_${konto}_paragony`];
  const wszystkie = ((s?.attributes.paragony ?? []) as Paragon[]).filter((r) => r && r.id && Date.parse(r.data))
    .sort((a, b) => Date.parse(b.data) - Date.parse(a.data));
  const klucz = `${kind}.paragony.szukaj`;
  const szukaj = (ctx.ui[klucz] ?? "").trim().toLowerCase();
  const pasuje = (p: Pozycja) => (p.nazwa ?? "").toLowerCase().includes(szukaj);
  const widoczne = szukaj ? wszystkie.filter((r) => (r.pozycje ?? []).some(pasuje)) : wszystkie;
  const trafienia = szukaj ? widoczne.flatMap((r) => (r.pozycje ?? []).filter(pasuje)) : [];
  const grupy = new Map<string, Paragon[]>();
  for (const r of widoczne) {
    const d = new Date(Date.parse(r.data)), m = `${d.getFullYear()}-${d.getMonth()}`;
    grupy.set(m, [...(grupy.get(m) ?? []), r]);
  }
  const zakt = s?.attributes.zaktualizowano as string | undefined, ile = num(s?.attributes.wszystkich);
  const suma = (l: Array<{ suma?: number | null; wartosc?: number | null; rabat?: number }>, f: "suma" | "wartosc") =>
    l.reduce((a, x) => a + (x[f] ?? 0) + (f === "wartosc" ? x.rabat ?? 0 : 0), 0);
  return html`<div class="pbbar">
      <input class="pbsearch" type="search" placeholder="Szukaj produktu…" aria-label="Szukaj produktu" .value=${ctx.ui[klucz] ?? ""}
        @input=${(e: Event) => ctx.actions.setUi(klucz, (e.target as HTMLInputElement).value)} />
    </div>
    <small class="pbmeta">${zakt && Date.parse(zakt) ? `Stan z ${sinceLabel(ctx, zakt).replace(/^od /, "")}. ` : ""}${ile !== null && ile > wszystkie.length ? `Ostatnie ${wszystkie.length} z ${ile} paragonów.` : ""}</small>
    ${szukaj && widoczne.length ? html`<div class="rcphit">„${ctx.ui[klucz]?.trim()}”: ${trafienia.length} ${odmiana(trafienia.length, "pozycja", "pozycje", "pozycji")} w ${widoczne.length} ${odmiana(widoczne.length, "paragonie", "paragonach", "paragonach")}, razem <b>${zl(suma(trafienia, "wartosc"))}</b></div>` : nothing}
    ${widoczne.length
      ? html`<div class="pblist rcplist">${[...grupy.values()].map((lista) => {
          const d = new Date(Date.parse(lista[0].data)), rabat = lista.reduce((a, r) => a + (r.rabat ?? 0), 0);
          return html`<div class="rcpmon"><b>${MIESIACE[d.getMonth()]} ${d.getFullYear()}</b>
              <span>${zl(suma(lista, "suma"))} · ${lista.length} ${odmiana(lista.length, "paragon", "paragony", "paragonów")}${rabat > 0 ? ` · rabaty ${zl(rabat)}` : ""}</span></div>
            ${lista.map((r) => receiptRow(ctx, r, szukaj ? pasuje : null))}`;
        })}</div>`
      : html`<div class="empty">${wszystkie.length ? "Nie ma tego produktu na ostatnich paragonach." : "E-paragony pojawią się po najbliższym przebiegu automatu."}</div>`}`;
}

// ---- Moja Biedronka: automat e-paragonów (stack biedronka, encje z autodiscovery MQTT) ----

const BIEDRONKA_STATE: Record<string, [string, boolean]> = {
  ok: ["", false],
  w_toku: ["pobieram paragony…", false],
  logowanie: ["logowanie w toku…", false],
  wymaga_logowania: ["trzeba zalogować się w panelu automatu", true],
  blad: ["błąd ostatniego przebiegu", true],
};

/** Jedna karta w barwach Moja Biedronka: wydatki w miesiącu (…_wydatki_w_miesiacu), ostatni paragon (…_paragony),
 *  stan automatu (…_stan, atrybut `panel`), przyciski Karta i Paragony. Kilka kont = przełącznik w rogu karty
 *  (domyślnie pierwsze alfabetycznie, wybór pamiętany na urządzeniu w `biedronka.konto`). */
function biedronka(ctx: Ctx): TemplateResult[] {
  const h = ctx.hass;
  const konta = Object.keys(h.states)
    .filter((e) => /^sensor\.biedronka_[a-z0-9_]+_stan$/.test(e) && !h.entities[e]?.hidden)
    .map((e) => e.slice("sensor.biedronka_".length, -"_stan".length))
    .sort();
  if (!konta.length) return [];
  const wybrane = konta.includes(ctx.ui["biedronka.konto"]) ? ctx.ui["biedronka.konto"] : konta[0];
  const imie = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);
  return [wybrane].map((k) => {
    const id = (s: string) => `sensor.biedronka_${k}_${s}`;
    const stan = st(ctx, id("stan")) ?? "unknown";
    const [opis, uwaga] = BIEDRONKA_STATE[stan] ?? (stan === "unavailable" ? ["automat nie odpowiada", true] : ["", false]);
    const wyd = h.states[id("wydatki_w_miesiacu")], kwota = num(wyd?.state);
    const m = Number(String(wyd?.attributes.miesiac ?? "").slice(5, 7));
    const ostatni = ((h.states[id("paragony")]?.attributes.paragony ?? []) as Paragon[])
      .filter((r) => r && Date.parse(r.data)).sort((a, b) => Date.parse(b.data) - Date.parse(a.data))[0];
    const kiedy = st(ctx, id("ostatnie_uruchomienie"));
    const panel = h.states[id("stan")]?.attributes.panel as string | undefined;
    const lista = Boolean(h.states[id("paragony")]);
    const otworz = () => (lista ? ctx.actions.openCoupons("biedronka", k, "paragony") : ctx.actions.moreInfo(id("stan")));
    const info = [
      ostatni ? `ostatni paragon ${dm(Date.parse(ostatni.data))} · ${zl(ostatni.suma)}` : "",
      kiedy && Date.parse(kiedy) ? `sprawdzone ${since(kiedy)} temu` : "",
    ].filter(Boolean);
    return html`<div class="pbcard bdcard ${uwaga ? "warn" : ""} ${stan === "w_toku" || stan === "logowanie" ? "busy" : ""}" role="button" tabindex="0"
        aria-label="Moja Biedronka (${imie(k)}): e-paragony" @click=${otworz}
        @keydown=${(e: KeyboardEvent) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), otworz())}>
      <div class="pbtop"><span class="lpmark bdmark">${logoImg(ctx, "biedronka", k)}Moja Biedronka</span>
        ${konta.length > 1 ? html`<span class="lpkonta" role="group" aria-label="Konto Moja Biedronka">${konta.map((x) => html`<button type="button"
          class=${x === k ? "on" : ""} aria-pressed=${x === k ? "true" : "false"} @keydown=${(e: Event) => e.stopPropagation()}
          @click=${(e: Event) => { e.stopPropagation(); ctx.actions.setUi("biedronka.konto", x); }}>${imie(x)}</button>`)}</span>` : nothing}</div>
      <div class="pbpts"><b>${kwota === null ? "—" : kwota.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b><span>zł w ${MIESIACE_W[m - 1] ?? "tym miesiącu"}</span></div>
      <div class="pbinfo">${info.length ? info.join(" · ") : "paragony: brak danych"}</div>
      ${opis ? html`<div class="pbstan">${opis}</div>` : nothing}
      <div class="pbacts">
        ${cardButton(ctx, "biedronka", k)}
        ${receiptsButton(ctx, "biedronka", k)}
        ${sideButtons(ctx, { entity: `button.biedronka_${k}_pobierz_paragony`, opis: "Pobierz paragony teraz", zajety: stan === "w_toku" || stan === "logowanie" }, panel, stan)}
      </div>
    </div>`;
  });
}

// ---- PAYBACK: automat aktywujący kupony (stack payback, encje z autodiscovery MQTT) ----

const PAYBACK_STATE: Record<string, [string, boolean]> = {
  ok: ["", false],
  w_toku: ["aktywuję kupony…", false],
  nie_wszystkie: ["nie wszystkie kupony udało się aktywować", true],
  sesja_wygasla: ["sesja wygasła — wgraj nowe ciasteczka", true],
  blokada: ["strona zablokowała automat", true],
  brak_ciasteczek: ["brak ciasteczek — wgraj je w kontenerze", true],
  captcha: ["logowanie zatrzymała captcha — wgraj ciasteczka", true],
  logowanie_nieudane: ["automat nie zalogował się hasłem", true],
  blad: ["błąd ostatniego przebiegu", true],
};

/** Karta na konto (wygląd karty PAYBACK): sensor.payback_<konto>_stan, _punkty, _punkty_dostepne, _punkty_oczekujace,
 *  _aktywne, _do_aktywacji, _ostatnie_uruchomienie, button …_aktywuj_kupony; kliknięcie = okno z listą kuponów (_kupony),
 *  przycisk Historia = okno operacji na punktach (_historia). */
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
    const dost = num(st(ctx, id("punkty_dostepne"))), ocz = num(st(ctx, id("punkty_oczekujace")));
    const historia = Boolean(h.states[id("historia")]);
    const btn = `button.payback_${k}_aktywuj_kupony`;
    const lista = Boolean(h.states[id("kupony")]);
    const otworz = () => (lista ? ctx.actions.openCoupons("payback", k) : ctx.actions.moreInfo(id("punkty")));
    const stop = (e: Event, f: () => void) => { e.stopPropagation(); f(); };
    return html`<div class="pbcard ${uwaga ? "warn" : ""} ${stan === "w_toku" ? "busy" : ""}" role="button" tabindex="0"
        aria-label="PAYBACK: ${lista ? "lista kuponów" : "historia punktów"}" @click=${otworz}
        @keydown=${(e: KeyboardEvent) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), otworz())}>
      <div class="pbtop"><span class="lpbrand">${logoImg(ctx, "payback", k, "pbl")}<span class="pbmark">PAYBACK</span></span>${konta.length > 1 ? html`<span class="pbwho">${k.charAt(0).toUpperCase()}${k.slice(1)}</span>` : nothing}</div>
      <div class="pbpts"><b>${round(pkt)}</b><span>°P</span></div>
      ${dost !== null && ocz !== null
        ? html`<div class="pbsplit"><span><b>${round(dost)}</b> do wykorzystania</span><span><b>${round(ocz)}</b> ${odmiana(ocz, "oczekuje", "oczekują", "oczekuje")}</span></div>`
        : nothing}
      <div class="pbinfo">${akt !== null ? `${round(akt)} aktywnych kuponów` : "kupony: brak danych"}${doAkt ? ` · ${round(doAkt)} do aktywacji` : ""}${kiedy && Date.parse(kiedy) ? ` · sprawdzone ${since(kiedy)} temu` : ""}</div>
      ${opis ? html`<div class="pbstan">${opis}</div>` : nothing}
      <div class="pbacts">
        ${cardButton(ctx, "payback", k)}
        ${lista ? html`<button class="pbbtn" type="button" @click=${(e: Event) => stop(e, otworz)}>Kupony</button>` : nothing}
        ${historia ? html`<button class="pbbtn" type="button" @click=${(e: Event) => stop(e, () => ctx.actions.openCoupons("payback", k, "historia"))}>Historia</button>` : nothing}
        ${sideButtons(ctx, { entity: btn, opis: "Aktywuj kupony teraz", zajety: stan === "w_toku" })}
      </div>
    </div>`;
  });
}

interface OperacjaPB { data: string; partner: string; punkty: number | null; zablokowane: boolean; rodzaj?: string;
  data_odblokowania?: string; data_naliczenia?: string }

const PBH_FILTRY: Array<[string, string]> = [["all", "Wszystkie"], ["oczekujace", "Oczekujące"], ["naliczone", "Naliczone"]];
const dmr = (s?: string) => { const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec((s ?? "").trim()); return m ? new Date(+m[3], +m[2] - 1, +m[1]).getTime() : NaN; };
const pktTxt = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${round(Math.abs(n))} °P`;

/** Okno historii punktów PAYBACK (sensor.payback_<konto>_historia, atrybut `historia` ze strony /moje-punkty):
 *  saldo z podziałem, filtr oczekujące/naliczone, wyszukiwanie partnera, operacje po miesiącach. Kwota w nawiasie na
 *  stronie PAYBACK = zablokowana (oczekuje do daty odblokowania, np. do końca okresu zwrotu towaru). */
export function paybackHistory(ctx: Ctx, konto: string): TemplateResult {
  const id = (x: string) => `sensor.payback_${konto}_${x}`;
  const s = ctx.hass.states[id("historia")];
  const wszystkie = ((s?.attributes.historia ?? []) as OperacjaPB[]).filter((o) => o && Number.isFinite(dmr(o.data)) && o.punkty !== null);
  const filtr = PBH_FILTRY.some(([f]) => f === ctx.ui["payback.historia.filtr"]) ? ctx.ui["payback.historia.filtr"] : "all";
  const szukaj = (ctx.ui["payback.historia.szukaj"] ?? "").trim().toLowerCase();
  const ile = { all: wszystkie.length, oczekujace: wszystkie.filter((o) => o.zablokowane).length, naliczone: wszystkie.filter((o) => !o.zablokowane).length } as Record<string, number>;
  const widoczne = wszystkie.filter((o) => (filtr === "all" || (filtr === "oczekujace") === o.zablokowane)
    && (!szukaj || `${o.partner} ${o.rodzaj ?? ""}`.toLowerCase().includes(szukaj)));
  const grupy = new Map<string, OperacjaPB[]>();
  for (const o of widoczne) {
    const d = new Date(dmr(o.data)), m = `${d.getFullYear()}-${d.getMonth()}`;
    grupy.set(m, [...(grupy.get(m) ?? []), o]);
  }
  const dost = num(st(ctx, id("punkty_dostepne"))), ocz = num(st(ctx, id("punkty_oczekujace")));
  const zakt = s?.attributes.zaktualizowano as string | undefined;
  return html`${dost !== null && ocz !== null
      ? html`<div class="pbhsum"><span><b>${round(dost)} °P</b> do wykorzystania</span><span><b>${round(ocz)} °P</b> oczekuje na odblokowanie</span></div>`
      : nothing}
    <div class="pbbar">
      <div class="seg2" role="tablist" aria-label="Rodzaj operacji">${PBH_FILTRY.map(([f, label]) => html`<button type="button" role="tab"
        aria-selected=${f === filtr ? "true" : "false"} class=${f === filtr ? "on" : ""} @click=${() => ctx.actions.setUi("payback.historia.filtr", f)}>${label} (${ile[f]})</button>`)}</div>
      <input class="pbsearch" type="search" placeholder="Szukaj sklepu…" aria-label="Szukaj sklepu" .value=${ctx.ui["payback.historia.szukaj"] ?? ""}
        @input=${(e: Event) => ctx.actions.setUi("payback.historia.szukaj", (e.target as HTMLInputElement).value)} />
    </div>
    <small class="pbmeta">${zakt && Date.parse(zakt) ? `Stan z ${sinceLabel(ctx, zakt).replace(/^od /, "")}. ` : ""}Ostatnie operacje z payback.pl (do 60). Punkty oczekujące partner odblokowuje po okresie zwrotu.</small>
    ${widoczne.length
      ? html`<div class="pblist rcplist">${[...grupy.values()].map((lista) => {
          const d = new Date(dmr(lista[0].data));
          const plus = lista.reduce((a, o) => a + Math.max(0, o.punkty ?? 0), 0), minus = lista.reduce((a, o) => a + Math.min(0, o.punkty ?? 0), 0);
          return html`<div class="rcpmon"><b>${MIESIACE[d.getMonth()]} ${d.getFullYear()}</b>
              <span>${plus ? pktTxt(plus) : ""}${plus && minus ? " · " : ""}${minus ? pktTxt(minus) : ""}</span></div>
            ${lista.map((o) => {
              const t = dmr(o.data), odbl = dmr(o.data_odblokowania);
              return html`<div class="pbh ${o.zablokowane ? "lock" : ""}">
                <span class="rcpd"><b>${DAY_NAMES[new Date(t).getDay()]} ${dm(t)}</b></span>
                <span class="pbhtxt"><b>${o.partner}</b><small>${o.rodzaj ?? ""}${o.zablokowane && Number.isFinite(odbl) ? ` · odblokowanie ${dm(odbl)}.${new Date(odbl).getFullYear()}` : ""}</small></span>
                <b class="pbhp ${(o.punkty ?? 0) < 0 ? "minus" : "plus"}">${o.zablokowane ? "🔒 " : ""}${pktTxt(o.punkty ?? 0)}</b>
              </div>`;
            })}`;
        })}</div>`
      : html`<div class="empty">${wszystkie.length ? "Brak operacji dla tego filtra." : "Historia pojawi się po najbliższym przebiegu automatu."}</div>`}`;
}

/** Dni kalendarzowe od dziś do dnia chwili `t` (0 = dziś). Od północy do północy i z zaokrągleniem, bo doba zmiany
 *  czasu ma 23 albo 25 h — dzielenie samej różnicy przez 24 h robiło z dzisiejszego 23:59 „jutro”. */
function dniOdDzis(t: number): number {
  const a = new Date(t), b = new Date();
  a.setHours(0, 0, 0, 0);
  b.setHours(0, 0, 0, 0);
  return Math.round((a.getTime() - b.getTime()) / 864e5);
}

interface Kupon { id: string; partner: string; korzysc: string; warunek: string; opis: string; do: string; online: boolean; link: string | null; logo: string }

const PB_FILTRY: Array<[string, string]> = [["all", "Wszystkie"], ["online", "Online"], ["sklep", "W sklepie"]];

/** Treść okna kuponów: filtr online/w sklepie, wyszukiwanie po sklepie, kupony od kończących się najwcześniej. */
export function paybackCoupons(ctx: Ctx, konto: string): TemplateResult {
  const s = ctx.hass.states[`sensor.payback_${konto}_kupony`];
  const wszystkie = ((s?.attributes.kupony ?? []) as Kupon[]).filter((k) => k && k.id);
  const filtr = PB_FILTRY.some(([f]) => f === ctx.ui["payback.filtr"]) ? ctx.ui["payback.filtr"] : "all";
  const szukaj = (ctx.ui["payback.szukaj"] ?? "").trim().toLowerCase();
  const ile = { all: wszystkie.length, online: wszystkie.filter((k) => k.online).length, sklep: wszystkie.filter((k) => !k.online).length } as Record<string, number>;
  const widoczne = wszystkie.filter((k) => (filtr === "all" || (filtr === "online") === k.online) && (!szukaj || `${k.partner} ${k.warunek}`.toLowerCase().includes(szukaj)));
  const zakt = s?.attributes.zaktualizowano as string | undefined;
  return html`<div class="pbbar">
      <div class="seg2" role="tablist" aria-label="Rodzaj kuponów">${PB_FILTRY.map(([f, label]) => html`<button type="button" role="tab"
        aria-selected=${f === filtr ? "true" : "false"} class=${f === filtr ? "on" : ""} @click=${() => ctx.actions.setUi("payback.filtr", f)}>${label} (${ile[f]})</button>`)}</div>
      <input class="pbsearch" type="search" placeholder="Szukaj sklepu…" aria-label="Szukaj sklepu" .value=${ctx.ui["payback.szukaj"] ?? ""}
        @input=${(e: Event) => ctx.actions.setUi("payback.szukaj", (e.target as HTMLInputElement).value)} />
    </div>
    <small class="pbmeta">${zakt && Date.parse(zakt) ? `Stan z ${sinceLabel(ctx, zakt).replace(/^od /, "")}. ` : ""}„Do sklepu” otwiera ten sam link co przycisk „Użyj online” na payback.pl — z naliczaniem punktów.</small>
    ${widoczne.length
      ? html`<div class="pblist">${widoczne.map((k) => {
          const d = Date.parse(k.do);
          const dni = Number.isNaN(d) ? null : dniOdDzis(d);
          const kiedy = dni === null ? "" : dni <= 0 ? "kończy się dziś" : dni === 1 ? "kończy się jutro" : `ważny do ${new Date(d).getDate()}.${String(new Date(d).getMonth() + 1).padStart(2, "0")}`;
          return html`<div class="pbk">
            <span class="pblogo">${k.logo ? html`<img src=${k.logo} alt="" loading="lazy" @error=${(e: Event) => ((e.target as HTMLElement).hidden = true)} />` : nothing}<i>${(k.partner || "?").slice(0, 1)}</i></span>
            <span class="pbktxt"><b>${k.partner}</b>${k.korzysc ? html`<span class="pbben">${k.korzysc}</span>` : nothing}
              ${k.warunek ? html`<small>${k.warunek}</small>` : nothing}<small class="pbdo ${dni !== null && dni <= 1 ? "soon" : ""}">${kiedy}${k.online ? " · online" : " · w sklepie"}</small></span>
            ${k.link
              ? html`<a class="btn hot" href=${k.link} target="_blank" rel="noopener noreferrer">Do sklepu ↗</a>`
              : k.online
                ? html`<a class="btn" href="https://www.payback.pl/aktywne-kupony" target="_blank" rel="noopener noreferrer">PAYBACK ↗</a>`
                : html`<span class="pbsklep">pokaż kartę<br />przy kasie</span>`}
          </div>`;
        })}</div>`
      : html`<div class="empty">${wszystkie.length ? "Brak kuponów dla tego filtra." : "Lista kuponów pojawi się po najbliższym przebiegu automatu."}</div>`}`;
}

// ---- Lidl Plus: automat aktywujący kupony (stack lidl-plus, encje z autodiscovery MQTT) ----

const LIDL_STATE: Record<string, [string, boolean]> = {
  ok: ["", false],
  w_toku: ["aktywuję kupony…", false],
  logowanie: ["logowanie w toku…", false],
  wymaga_logowania: ["trzeba zalogować się w panelu automatu", true],
  nie_wszystkie: ["nie wszystkie kupony udało się aktywować", true],
  blad: ["błąd ostatniego przebiegu", true],
};

/** Odmiana po liczbie: 1 kupon, 2–4 (22–24…) kupony, 5–21 kuponów. */
function odmiana(n: number, jeden: string, kilka: string, wiele: string): string {
  const d = n % 10, s = n % 100;
  return n === 1 ? jeden : d >= 2 && d <= 4 && (s < 12 || s > 14) ? kilka : wiele;
}

const dm = (t: number) => `${new Date(t).getDate()}.${String(new Date(t).getMonth() + 1).padStart(2, "0")}`;

/** Karta na konto w barwach Lidla: sensor.lidl_<konto>_stan (atrybut `panel` = strona logowania automatu), _aktywne,
 *  _czekajace, _do_aktywacji, _ostatnie_uruchomienie, button …_aktywuj_kupony; kliknięcie = okno z listą (_kupony). */
function lidl(ctx: Ctx): TemplateResult[] {
  const h = ctx.hass;
  const konta = Object.keys(h.states)
    .filter((e) => /^sensor\.lidl_[a-z0-9_]+_stan$/.test(e) && !h.entities[e]?.hidden)
    .map((e) => e.slice("sensor.lidl_".length, -"_stan".length))
    .sort();
  return konta.map((k) => {
    const id = (s: string) => `sensor.lidl_${k}_${s}`;
    const stan = st(ctx, id("stan")) ?? "unknown";
    const [opis, uwaga] = LIDL_STATE[stan] ?? (stan === "unavailable" ? ["automat nie odpowiada", true] : ["", false]);
    const akt = num(st(ctx, id("aktywne"))), doAkt = num(st(ctx, id("do_aktywacji"))), czeka = num(st(ctx, id("czekajace")));
    const kiedy = st(ctx, id("ostatnie_uruchomienie"));
    const panel = h.states[id("stan")]?.attributes.panel as string | undefined;
    const btn = `button.lidl_${k}_aktywuj_kupony`;
    const lista = Boolean(h.states[id("kupony")]);
    const zajety = stan === "w_toku" || stan === "logowanie";
    const otworz = () => (lista ? ctx.actions.openCoupons("lidl", k) : ctx.actions.moreInfo(id("aktywne")));
    const stop = (e: Event, f: () => void) => { e.stopPropagation(); f(); };
    const info = [
      czeka ? `${round(czeka)} ${odmiana(czeka, "czeka", "czekają", "czeka")} na start` : "",
      doAkt ? `${round(doAkt)} do aktywacji` : "",
      kiedy && Date.parse(kiedy) ? `sprawdzone ${since(kiedy)} temu` : "",
      monthSpend(ctx, "lidl", k),
    ].filter(Boolean);
    return html`<div class="pbcard lpcard ${uwaga ? "warn" : ""} ${zajety ? "busy" : ""}" role="button" tabindex="0"
        aria-label="Lidl Plus: ${lista ? "lista kuponów" : "historia kuponów"}" @click=${otworz}
        @keydown=${(e: KeyboardEvent) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), otworz())}>
      <div class="pbtop"><span class="lpmark">${logoImg(ctx, "lidl", k) ?? html`<i aria-hidden="true"></i>`}Lidl Plus</span>${konta.length > 1 ? html`<span class="pbwho">${k.charAt(0).toUpperCase()}${k.slice(1)}</span>` : nothing}</div>
      <div class="pbpts"><b>${round(akt)}</b><span>${akt === null ? "kupony" : odmiana(akt, "aktywny kupon", "aktywne kupony", "aktywnych kuponów")}</span></div>
      <div class="pbinfo">${info.length ? info.join(" · ") : "kupony: brak danych"}</div>
      ${opis ? html`<div class="pbstan">${opis}</div>` : nothing}
      <div class="pbacts">
        ${cardButton(ctx, "lidl", k)}
        ${lista ? html`<button class="pbbtn" type="button" @click=${(e: Event) => stop(e, otworz)}>Kupony</button>` : nothing}
        ${receiptsButton(ctx, "lidl", k)}
        ${sideButtons(ctx, { entity: btn, opis: "Aktywuj kupony teraz", zajety }, panel, stan)}
      </div>
    </div>`;
  });
}

interface LidlKupon { id: string; tytul: string; rabat: string; opis: string; obraz: string | null; od: string | null; do: string | null; aktywny: boolean; sekcja: string; link: string | null; wykluczony?: boolean }

/** Sekcje aplikacji (nazwy od automatu) w kolejności filtra; nieznane dochodzą na końcu. */
const LP_SEKCJE: Array<[string, string]> = [["wszystkie sklepy", "W sklepach"], ["inne sklepy", "Inne sklepy"], ["sklep internetowy", "Online"]];

// Lidl przeplata teksty znakiem U+200E: sam w opisie znaczy „brak opisu”, w rabacie oddziela cenę od warunku.
const lpCzesci = (t: string | null | undefined) => (t ?? "").split("‎").map((s) => s.trim()).filter((s) => s && !/^[–—-]$/.test(s));

/** Treść okna kuponów Lidl Plus: filtr po sekcji, wyszukiwanie po produkcie, najpierw ważne (od kończących się
 *  najwcześniej), potem czekające na start; identyczne kupony (np. ten sam rabat w wielu sklepach) jako jeden wiersz. */
export function lidlCoupons(ctx: Ctx, konto: string): TemplateResult {
  const s = ctx.hass.states[`sensor.lidl_${konto}_kupony`];
  const wszystkie = ((s?.attributes.kupony ?? []) as LidlKupon[]).filter((k) => k && k.id);
  const nazwy = [...new Set(wszystkie.map((k) => k.sekcja).filter(Boolean))];
  const filtry: Array<[string, string]> = [["all", "Wszystkie"],
    ...LP_SEKCJE.filter(([n]) => nazwy.includes(n)),
    ...nazwy.filter((n) => !LP_SEKCJE.some(([x]) => x === n)).map((n): [string, string] => [n, n.charAt(0).toUpperCase() + n.slice(1)])];
  const filtr = filtry.some(([f]) => f === ctx.ui["lidl.filtr"]) ? ctx.ui["lidl.filtr"] : "all";
  const szukaj = (ctx.ui["lidl.szukaj"] ?? "").trim().toLowerCase();
  const ile = (f: string) => (f === "all" ? wszystkie.length : wszystkie.filter((k) => k.sekcja === f).length);
  const teraz = Date.now();
  const start = (k: LidlKupon) => Date.parse(k.od ?? "") || 0;
  const koniec = (k: LidlKupon) => Date.parse(k.do ?? "") || Number.MAX_SAFE_INTEGER;
  const grupy = new Map<string, { k: LidlKupon; n: number }>();
  for (const k of wszystkie) {
    if (filtr !== "all" && k.sekcja !== filtr) continue;
    if (szukaj && !`${k.tytul} ${k.rabat} ${k.opis}`.toLowerCase().includes(szukaj)) continue;
    const klucz = [k.sekcja, k.tytul, k.rabat, k.opis, k.od, k.do, k.aktywny, k.wykluczony, k.link].join("|");
    const g = grupy.get(klucz);
    if (g) g.n++;
    else grupy.set(klucz, { k, n: 1 });
  }
  const czeka = (k: LidlKupon) => start(k) > teraz;
  const widoczne = [...grupy.values()].sort(({ k: a }, { k: b }) =>
    Number(czeka(a)) - Number(czeka(b)) || (czeka(a) ? start(a) - start(b) : 0) || koniec(a) - koniec(b));
  const zakt = s?.attributes.zaktualizowano as string | undefined;
  return html`<div class="pbbar">
      <div class="seg2" role="tablist" aria-label="Sekcja kuponów">${filtry.map(([f, label]) => html`<button type="button" role="tab"
        aria-selected=${f === filtr ? "true" : "false"} class=${f === filtr ? "on" : ""} @click=${() => ctx.actions.setUi("lidl.filtr", f)}>${label} (${ile(f)})</button>`)}</div>
      <input class="pbsearch" type="search" placeholder="Szukaj produktu…" aria-label="Szukaj produktu" .value=${ctx.ui["lidl.szukaj"] ?? ""}
        @input=${(e: Event) => ctx.actions.setUi("lidl.szukaj", (e.target as HTMLInputElement).value)} />
    </div>
    <small class="pbmeta">${zakt && Date.parse(zakt) ? `Stan z ${sinceLabel(ctx, zakt).replace(/^od /, "")}. ` : ""}W sklepie aktywne kupony naliczają się po zeskanowaniu aplikacji Lidl Plus przy kasie.</small>
    ${widoczne.length
      ? html`<div class="pblist">${widoczne.map(({ k, n }) => {
          const [cena, ...reszta] = lpCzesci(k.rabat);
          const opis = [...reszta, ...lpCzesci(k.opis)].join(" · ");
          const od = start(k), d = Date.parse(k.do ?? "");
          const ileDni = Number.isNaN(d) ? null : dniOdDzis(d);
          const kiedy = czeka(k)
            ? `${dniOdDzis(od) <= 0 ? "od dziś" : dniOdDzis(od) === 1 ? "od jutra" : `od ${dm(od)}`}${ileDni === null ? "" : ` do ${dm(d)}`}`
            : ileDni === null ? "" : ileDni <= 0 ? "kończy się dziś" : ileDni === 1 ? "kończy się jutro" : `ważny do ${dm(d)}`;
          // „wyklucza się”: Lidl odrzucił aktywację, bo aktywny jest inny kupon z tej samej grupy (jeden z grupy naraz).
          const status = k.aktywny ? "aktywny" : czeka(k) ? "czeka na start" : k.wykluczony ? "wyklucza się" : "nieaktywny";
          return html`<div class="pbk lpk">
            <span class="pblogo">${k.obraz ? html`<img src=${k.obraz} alt="" loading="lazy" @error=${(e: Event) => ((e.target as HTMLElement).hidden = true)} />` : nothing}<i>${((k.tytul || "").replace(/^[^\p{L}\p{N}]+/u, "") || "?").slice(0, 1)}</i></span>
            <span class="pbktxt"><b>${k.tytul}${n > 1 ? html` <span class="lpile">· ${n} ${odmiana(n, "kupon", "kupony", "kuponów")}</span>` : nothing}</b>
              ${cena ? html`<span class="pbben">${cena}</span>` : nothing}
              ${opis ? html`<small>${opis}</small>` : nothing}<small class="pbdo ${!czeka(k) && ileDni !== null && ileDni <= 1 ? "soon" : ""}">${kiedy}${k.link ? ` · online${k.aktywny ? "" : ` · ${status}`}` : ""}</small></span>
            ${k.link
              ? html`<a class="btn hot" href=${k.link} target="_blank" rel="noopener noreferrer">Do sklepu ↗</a>`
              : html`<span class="lpchip ${k.aktywny ? "ok" : czeka(k) || k.wykluczony ? "" : "warn"}">${status}</span>`}
          </div>`;
        })}</div>`
      : html`<div class="empty">${wszystkie.length ? "Brak kuponów dla tego filtra." : "Lista kuponów pojawi się po najbliższym przebiegu automatu."}</div>`}`;
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
  const mail = mailbox(ctx), bins = waste(ctx);
  const top = mail !== nothing || bins !== nothing ? html`<div class="cards two top">${mail}${bins}</div>` : nothing;
  return html`${persons(ctx)} ${gates(ctx)}
    ${top !== nothing ? html`<section class="sec">${top}</section>` : nothing}
    ${weather(ctx)}`;
}

/** Karty lojalnościowe (PAYBACK, Lidl Plus, Moja Biedronka) — na zakładce Zakupy, nad listą. */
export const loyaltyCards = (ctx: Ctx): TemplateResult[] => [...payback(ctx), ...lidl(ctx), ...biedronka(ctx)];

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
