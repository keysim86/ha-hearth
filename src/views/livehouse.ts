// Żywy dom (wygląd Neon, zakładka Dom): przekrój domu z pięter i obszarów HA.
// Pokój świeci kolorem temperatury, okno — gdy pali się światło, grzejnik — gdy pokój grzeje; dym z komina = pali się w kotle,
// kropki na przyłączu = pobór prądu, bursztynowy garaż = otwarty. Bez pięter w HA: ogrzewane pokoje na jednej kondygnacji.
// Ruch (dym, przepływy, migotanie) tylko z atrybutem fx hosta — styl w styles.ts (.lh).

import { html, nothing, svg, type SVGTemplateResult, type TemplateResult } from "lit";
import { f1, num } from "../format";
import { windowOpen, type Room } from "../model";
import type { Hass } from "../types";
import { entityName, silentHours, since, st, type Ctx } from "./common";
import { gateIds, gateLights, personIds } from "./home";
import { boilerState } from "./house";

type Kind = "heat" | "ok" | "win" | "lost" | "meas";
interface Spot { id: string; name: string; t: number | null; kind: Kind; lit: boolean; here: boolean; room?: Room }
/** attic = najwyższy poziom to strych / poddasze — rysowany w dachu, nie jako kondygnacja. */
interface Band { level: number; spots: Spot[]; attic?: boolean }

const RW = 92, FH = 120, BH = 96, GW = 112, TOP = 44, GAP = 64;
const ATTIC = /strych|poddasz|attic|loft/i;
const KIND_TEXT: Record<Kind, string> = { heat: "grzeje", ok: "ciepło", win: "otwarte okno", lost: "głowica nie odpowiada", meas: "pomiar" };
// Czujniki temperatury, które nie mierzą pomieszczenia (kocioł, woda, sprzęt).
const NOT_ROOM = /kocio|piec|boiler|cwu|zasob|zasil|powr|wod[ay]|water|flow|return|cpu|procesor|dysk|disk|nvme|bater|lod[oó]w|zamra|fridge|freezer|zewn|outdoor/i;
// Lampki w sprzętach AGD — nie oświetlają pokoju.
const APPLIANCE = /lod[oó]w|fridge|freezer|zamra[zż]|ch[lł]odziar|piekarnik|oven|okap|hood|zmywar|dishwash|pralk|washer|suszar|dryer|akwari|aquari|mikrofal|microwave/i;
const PEOPLE = ["#4f9dff", "#ff4fd8", "#ffc53d", "#45f5a1", "#a77dff", "#19d3b6"];

// Temperatura → kolor: 14° cyjan, 18° niebieski, 20° fiolet, 21,5° róż, 23° żar.
const STOPS: [number, number[]][] = [[14, [38, 224, 255]], [18, [79, 157, 255]], [20, [167, 125, 255]], [21.5, [255, 79, 216]], [23, [255, 109, 46]]];
function tcol(t: number, a: number): string {
  const v = Math.max(STOPS[0][0], Math.min(STOPS[STOPS.length - 1][0], t));
  let i = 0;
  while (i < STOPS.length - 2 && v > STOPS[i + 1][0]) i++;
  const [t0, c0] = STOPS[i], [t1, c1] = STOPS[i + 1], k = (v - t0) / (t1 - t0);
  const c = c0.map((x, j) => Math.round(x + (c1[j] - x) * k));
  return `rgba(${c[0]},${c[1]},${c[2]},${a})`;
}

const areaOf = (h: Hass, e: string): string | null => {
  const r = h.entities[e];
  return r?.area_id ?? (r?.device_id ? h.devices[r.device_id]?.area_id : null) ?? null;
};

/** Widoczne encje pogrupowane po obszarach (jeden przebieg po stanach). */
function byArea(h: Hass): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const e of Object.keys(h.states)) {
    if (h.entities[e]?.hidden) continue;
    const a = areaOf(h, e);
    if (!a) continue;
    const list = m.get(a);
    if (list) list.push(e);
    else m.set(a, [e]);
  }
  return m;
}

function roomKind(ctx: Ctx, r: Room, t: number | null): Kind {
  const h = ctx.hass;
  if (windowOpen(h, r)) return "win";
  if (silentHours(ctx, r) !== null) return "lost";
  const c = h.states[r.climate], target = num(c?.attributes.temperature);
  if (c?.attributes.hvac_action === "heating") return "heat";
  if (c?.attributes.hvac_action === undefined && c?.state === "heat" && t !== null && target !== null && target - t >= 0.3) return "heat";
  return "ok";
}

/** Kondygnacje od najwyższej: piętra HA (te same poziomy obok siebie) albo — bez pięter — ogrzewane pokoje Hearth. */
function bands(ctx: Ctx, rooms: Room[]): { bands: Band[]; floors: boolean } {
  const h = ctx.hass, ents = byArea(h);
  // Okno świeci od lamp pokoju, nie od lampek w sprzętach (lodówka, piekarnik, okap…).
  const lit = (a: string) => (ents.get(a) ?? []).some((e) => e.startsWith("light.") && h.states[e].state === "on"
    && h.entities[e]?.platform !== "home_connect" && !APPLIANCE.test(`${e} ${h.states[e].attributes.friendly_name ?? ""}`));
  const fromRoom = (r: Room): Spot => {
    const t = num(st(ctx, r.temp)) ?? num(h.states[r.climate]?.attributes.current_temperature);
    const here = [r.helpers.obecnosc, r.helpers.ktos].some((x) => x && st(ctx, x) === "on");
    return { id: r.areaId, name: r.name, t, kind: roomKind(ctx, r, t), lit: lit(r.areaId), here, room: r };
  };
  const floors = h.floors ?? {};
  if (!Object.keys(floors).length) return { bands: rooms.length ? [{ level: 0, spots: rooms.map(fromRoom) }] : [], floors: false };
  const byRoom = new Map(rooms.map((r) => [r.areaId, r]));
  const levels = new Map<number, Spot[]>();
  const names = new Map<number, Set<string>>();
  for (const a of Object.values(h.areas)) {
    const f = a.floor_id ? floors[a.floor_id] : undefined;
    if (!f || /^gara[żz]/i.test(a.name)) continue; // garaże rysujemy z bram, obok domu
    const r = byRoom.get(a.area_id);
    let s: Spot;
    if (r) s = fromRoom(r);
    else {
      const ids = ents.get(a.area_id) ?? [];
      const ts = ids.find((e) => {
        const s = h.states[e], v = num(s.state);
        return e.startsWith("sensor.") && s.attributes.device_class === "temperature" && v !== null && v > -5 && v < 35
          && !NOT_ROOM.test(`${e} ${s.attributes.friendly_name ?? ""}`);
      });
      const open = ids.some((e) => e.startsWith("binary_sensor.") && h.states[e].state === "on" && h.states[e].attributes.device_class === "window");
      s = { id: a.area_id, name: a.name, t: ts ? num(h.states[ts].state) : null, kind: open ? "win" : "meas", lit: lit(a.area_id), here: false };
    }
    const lv = f.level ?? 0;
    names.set(lv, (names.get(lv) ?? new Set()).add(f.name));
    const list = levels.get(lv);
    if (list) list.push(s);
    else levels.set(lv, [s]);
  }
  const sorted = [...levels].sort((a, b) => b[0] - a[0]).map(([level, spots]): Band => ({ level, spots }));
  if (sorted.length > 1 && sorted[0].level > 0 && [...(names.get(sorted[0].level) ?? [])].every((n) => ATTIC.test(n))) sorted[0].attic = true;
  return { bands: sorted, floors: true };
}

/** Szerokość napisu w SVG (szacunek) → rozmiar czcionki, który mieści się w pokoju. */
const fit = (text: string, width: number, base: number) => Math.max(8, Math.min(base, (width - 8) / (text.length * 0.6)));

function roomSvg(ctx: Ctx, s: Spot, x: number, y: number, w: number, hgt: number, i: number): SVGTemplateResult {
  const cx = x + w / 2, ww = Math.round(Math.max(24, Math.min(44, w * 0.42))), wh = hgt < FH ? 28 : 34, wx = cx - ww / 2, wy = y + 16;
  const label = `${s.name}${s.t !== null ? `, ${f1(s.t)}°` : ""}, ${KIND_TEXT[s.kind]}${s.lit ? ", światło" : ""}`;
  const radiator = s.kind === "meas" ? nothing : svg`<rect class=${s.kind === "heat" ? "rad hot" : "rad"} x=${wx} y=${y + hgt - 12} width=${ww} height="5" rx="2"
      fill=${{ heat: "#ff6d2e", ok: "rgba(255,109,46,.35)", win: "rgba(38,224,255,.4)", lost: "none", meas: "none" }[s.kind]}
      stroke=${s.kind === "lost" ? "#ffc53d" : "none"} stroke-dasharray=${s.kind === "lost" ? "2 2" : "0"} filter=${s.kind === "heat" ? "url(#lh-gl2)" : "none"}></rect>
    ${s.kind === "heat"
      ? [0, 1, 2].map((k) => svg`<path class="shimmer" d="M${wx + (ww * (k + 0.5)) / 3},${y + hgt - 14}q2.5,-3 0,-6t0,-6" fill="none" stroke="rgba(255,140,80,.6)" stroke-width="1.2"></path>`)
      : nothing}`;
  const open = () => s.room && ctx.actions.openRoom(s.id);
  return svg`<g class="room" role=${s.room ? "button" : "img"} tabindex=${s.room ? "0" : "-1"} aria-label=${label} @click=${open}
      @keydown=${(e: KeyboardEvent) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), open())}>
    <title>${label}</title>
    <rect x=${x} y=${y} width=${w} height=${hgt} fill="#0a1030" opacity=".94"></rect>
    <rect class="frame" x=${x} y=${y} width=${w} height=${hgt} fill=${`url(#lh-t${i})`} stroke="rgba(130,165,255,.32)" stroke-width="1.2"></rect>
    ${s.lit
      ? svg`<rect x=${wx} y=${wy} width=${ww} height=${wh} rx="3" fill="url(#lh-lit)" filter="url(#lh-gl2)" opacity=".95"></rect>`
      : svg`<rect x=${wx} y=${wy} width=${ww} height=${wh} rx="3" fill="rgba(80,110,200,.10)" stroke="rgba(150,180,255,.35)"></rect>`}
    <path d="M${cx},${wy}V${wy + wh}M${wx},${wy + wh / 2}H${wx + ww}" stroke=${s.lit ? "rgba(130,60,10,.5)" : "rgba(150,180,255,.25)"} stroke-width="1.4"></path>
    ${s.here ? svg`<circle cx=${cx} cy=${wy + wh / 2 - 4} r="5" fill="#0a0f20"></circle><path d="M${cx - 9},${wy + wh}q9,-14 18,0z" fill="#0a0f20"></path>` : nothing}
    ${s.kind === "win"
      ? svg`<polygon points="${wx + ww},${wy} ${wx + ww + 12},${wy + 5} ${wx + ww + 12},${wy + wh + 5} ${wx + ww},${wy + wh}" fill="rgba(38,224,255,.16)" stroke="#26e0ff" stroke-width="1.4" filter="url(#lh-gl)"></polygon>
        <g class="wisp" fill="none" stroke="#26e0ff" stroke-width="1.5" stroke-linecap="round" filter="url(#lh-gl)">
          <path d="M${wx - 2},${wy + 9}q6,-4 12,0t12,0t12,0"></path><path d="M${wx + 2},${wy + 21}q6,-4 12,0t12,0t12,0"></path></g>`
      : nothing}
    ${radiator}
    ${s.kind === "lost"
      ? svg`<circle cx=${x + w - 12} cy=${y + 12} r="8" fill="#ffc53d" filter="url(#lh-gl)"></circle><text x=${x + w - 12} y=${y + 16} text-anchor="middle" font-size="12" font-weight="900" fill="#050814">!</text>`
      : nothing}
    ${s.t !== null ? svg`<text class="rt" x=${cx} y=${y + hgt - 42} font-size=${hgt < FH ? 18 : 21} fill=${s.kind === "meas" ? "#aab5d1" : "#fff"}>${f1(s.t)}°</text>` : nothing}
    <text class="rn" x=${cx} y=${y + hgt - 27} font-size=${fit(s.name, w, 11)}>${s.name}</text>
  </g>`;
}

/** compact (telefon): bez słupa i garaży — dom od lewej krawędzi, garaże są niżej w „Bramach i garażach”. */
export function liveHouse(ctx: Ctx, rooms: Room[], compact = false): TemplateResult | typeof nothing {
  const h = ctx.hass;
  const { bands: all, floors } = bands(ctx, rooms);
  if (!all.length) return nothing;
  const up = all.filter((b) => b.level >= 0), down = all.filter((b) => b.level < 0);
  const attic = up.length > 1 && up[0].attic ? up.shift()!.spots : [];
  if (!up.length) up.push({ level: 0, spots: [] });
  const bw = (b: Band) => Math.max(2, b.spots.length) * RW;
  const garages = compact ? [] : gateIds(ctx).filter((id) => h.states[id]?.attributes.device_class === "garage").slice(0, 3);
  const power = !compact && ctx.opts.power_total ? num(st(ctx, ctx.opts.power_total)) : null;
  const burning = Boolean(boilerState(ctx)?.burning);
  const { ids } = personIds(ctx);
  const people = ids.filter((id) => h.states[id]).map((id, i) => ({
    id, name: String(h.states[id].attributes.friendly_name ?? id.split(".")[1]), home: h.states[id].state === "home", color: PEOPLE[i % PEOPLE.length],
  }));

  const left = power !== null ? 70 : 20;
  // garaże to osobny budynek: blok bram, przerwa (podjazd), potem dom
  const gEnd = left + garages.length * (GW + 8) - 8;
  const x0 = garages.length ? gEnd + GAP : left;
  const wTop = bw(up[0]), roofH = Math.min(attic.length ? 124 : 110, wTop * (attic.length ? 0.3 : 0.27));
  const GY = TOP + roofH + up.length * FH;
  const wMax = Math.max(...all.map(bw));
  const home = people.filter((p) => p.home), away = people.filter((p) => !p.home);
  const W = x0 + wMax + 40 + home.length * 26 + (away.length ? 30 + away.length * 26 : 0) + 50;
  const H = GY + down.length * BH + 52;
  const defs: SVGTemplateResult[] = [];
  const parts: SVGTemplateResult[] = [];
  let idx = 0;

  // niebo: księżyc nocą
  if (st(ctx, "sun.sun") === "below_horizon")
    parts.push(svg`<circle cx=${W - 90} cy="50" r="70" fill="url(#lh-halo)"></circle><circle cx=${W - 90} cy="50" r="19" fill="url(#lh-moon)"></circle>`);
  // ziemia
  parts.push(svg`<rect x="0" y=${GY} width=${W} height=${H - GY} fill="url(#lh-gnd)"></rect>
    <line x1="0" y1=${GY} x2=${W} y2=${GY} stroke="#4f9dff" stroke-width="1.6" opacity=".75" filter="url(#lh-gl)"></line>`);
  // przyłącze prądu
  if (power !== null) {
    const top = Math.max(26, GY - 230), path = `M48,${top + 8} Q${(48 + x0) / 2},${top + 70} ${x0},${GY - FH + 14}`;
    const dur = Math.max(0.5, Math.min(2.4, 2.4 - power / 2000));
    parts.push(svg`<line x1="34" y1=${GY} x2="34" y2=${top} stroke="#5d6b96" stroke-width="4"></line><line x1="20" y1=${top + 6} x2="48" y2=${top + 6} stroke="#5d6b96" stroke-width="3"></line>
      <path d=${path} fill="none" stroke="rgba(167,125,255,.35)" stroke-width="2"></path>
      <path class="flow" d=${path} fill="none" stroke="#c4a6ff" stroke-width="2.8" stroke-linecap="round" stroke-dasharray="1.5 8" filter="url(#lh-gl)" style="animation-duration:${dur}s"></path>
      <text class="lbl" x="34" y=${top - 8} fill="#c4a6ff">${(power / 1000).toFixed(2).replace(".", ",")} kW</text>`);
  }
  // garaże (z bram): osobny budynek ze wspólnym dachem
  if (garages.length)
    parts.push(svg`<polygon points="${left - 10},${GY - 88} ${(left + gEnd) / 2},${GY - 116} ${gEnd + 10},${GY - 88}" fill="#070c22" stroke="url(#lh-edge)" stroke-width="2.5" stroke-linejoin="round" filter="url(#lh-gl)"></polygon>`);
  const allGates = gateIds(ctx);
  garages.forEach((id, i) => {
    const c = h.states[id], gx = left + i * (GW + 8), gy = GY - 90, opened = c.state !== "closed";
    const lit = gateLights(ctx, id, allGates).some((l) => st(ctx, l) === "on");
    const full = entityName(h, id), name = full.length > 18 ? `${full.slice(0, 17)}…` : full;
    parts.push(svg`<g role="img" aria-label=${`${full}: ${opened ? "otwarty" : "zamknięty"}${lit ? ", światło włączone" : ""}`}>
      <rect x=${gx} y=${gy} width=${GW} height="90" fill="#090f2a" stroke="url(#lh-edge)" stroke-width="2.5" filter="url(#lh-gl)"></rect>
      <rect x=${gx + 10} y=${gy + 16} width=${GW - 20} height="74" fill=${opened ? "#02040b" : "#121a3c"}></rect>
      ${lit && opened ? svg`<rect x=${gx + 12} y=${gy + 26} width=${GW - 24} height="62" fill="url(#lh-lit)" opacity=".55" filter="url(#lh-gl2)"></rect>` : nothing}
      ${opened
        ? svg`<rect x=${gx + 10} y=${gy + 16} width=${GW - 20} height="10" fill="#1a2452" stroke="#ffc53d"></rect>
          <rect class="open-garage" x=${gx + 8} y=${gy + 14} width=${GW - 16} height="76" fill="none" stroke="#ffc53d" stroke-width="2" stroke-dasharray="6 5" filter="url(#lh-gl)"></rect>`
        : svg`${[1, 2, 3, 4].map((k) => svg`<line x1=${gx + 10} x2=${gx + GW - 10} y1=${gy + 16 + k * 15} y2=${gy + 16 + k * 15} stroke="rgba(150,180,255,.25)"></line>`)}
          ${[0, 1, 2, 3].map((k) => svg`<rect x=${gx + 16 + k * ((GW - 32) / 4)} y=${gy + 20} width=${(GW - 32) / 4 - 6} height="8" rx="1.5"
            fill=${lit ? "url(#lh-lit)" : "rgba(80,110,200,.14)"} filter=${lit ? "url(#lh-gl)" : "none"}></rect>`)}`}
      <text class="lbl" x=${gx + GW / 2} y=${GY + 17} fill=${opened ? "#ffc53d" : "#aab5d1"} font-size=${fit(name, GW + 6, 11)}>${name}</text>
      ${opened ? svg`<text class="lbl" x=${gx + GW / 2} y=${GY + 31} fill="#ffc53d" font-size="10">otwarty od ${since(c.last_changed)}</text>` : nothing}
    </g>`);
  });

  // kondygnacje nad ziemią (od góry), dachy, komin
  const tops: number[] = [];
  up.forEach((b, k) => {
    const y = TOP + roofH + k * FH, w = bw(b), rw = b.spots.length ? w / b.spots.length : w;
    tops.push(y);
    b.spots.forEach((s, j) => {
      defs.push(svg`<linearGradient id=${`lh-t${idx}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color=${tcol(s.t ?? 19, 0.04)}></stop>
        <stop offset="1" stop-color=${s.t === null ? "rgba(80,110,200,.12)" : tcol(s.t, s.kind === "meas" ? 0.25 : 0.5)}></stop></linearGradient>`);
      parts.push(roomSvg(ctx, s, x0 + j * rw, y, rw, FH, idx++));
    });
    if (k > 0) {
      const wa = bw(up[k - 1]);
      if (w > wa) { // niższa, szersza kondygnacja: daszek nad wystającą częścią
        const sx = x0 + wa, sw = w - wa, rh = Math.min(48, sw * 0.18);
        parts.push(svg`<polygon points="${sx},${y} ${sx + sw / 2},${y - rh} ${sx + sw + 12},${y}" fill="#070c22" stroke="url(#lh-edge)" stroke-width="2.5" stroke-linejoin="round" filter="url(#lh-gl)"></polygon>`);
      }
    }
    parts.push(svg`<rect x=${x0} y=${y} width=${w} height=${FH} fill="none" stroke="url(#lh-edge)" stroke-width="3" filter="url(#lh-gl)"></rect>`);
  });
  // komin (przed dachem — dach zasłania dół) i dach nad najwyższą kondygnacją
  const yT = tops[0], peak = x0 + wTop / 2, chx = x0 + wTop * 0.7;
  const roofY = (x: number) => yT - roofH + ((x - peak) * roofH) / (wTop / 2 + 14);
  const chTop = roofY(chx) - 30;
  parts.push(svg`<rect x=${chx - 12} y=${chTop} width="24" height="56" fill="#0a1030" stroke="url(#lh-edge)" stroke-width="2"></rect>
    ${burning
      ? svg`<ellipse cx=${chx} cy=${chTop} rx="10" ry="3" fill="rgba(255,109,46,.65)" filter="url(#lh-gl2)"></ellipse>
        <g class="smoke" filter="url(#lh-soft)" fill="rgba(195,208,240,.17)"><circle cx=${chx + 2} cy=${chTop - 13} r="7"></circle>
          <circle cx=${chx + 10} cy=${chTop - 31} r="10"></circle><circle cx=${chx + 4} cy=${chTop - 53} r="13"></circle><circle cx=${chx + 17} cy=${chTop - 78} r="16"></circle></g>`
      : nothing}
    <polygon points="${x0 - 14},${yT + 2} ${peak},${yT - roofH} ${x0 + wTop + 14},${yT + 2}" fill="#070c22" stroke="url(#lh-edge)" stroke-width="3" stroke-linejoin="round" filter="url(#lh-gl)"></polygon>`);
  // strych w dachu: okienko w szczycie, pod nim nazwy i temperatury
  if (attic.length) {
    const lit = attic.some((s) => s.lit), ly = yT - roofH * 0.26, span = (wTop + 28) * 0.7, step = Math.min(120, span / attic.length);
    parts.push(svg`<circle cx=${peak} cy=${yT - roofH * 0.62} r="9" fill=${lit ? "url(#lh-lit)" : "rgba(80,110,200,.12)"} stroke=${lit ? "none" : "rgba(150,180,255,.4)"}
      filter=${lit ? "url(#lh-gl2)" : "none"}></circle>`);
    attic.forEach((s, j) => {
      const ax = peak + (j - (attic.length - 1) / 2) * step;
      parts.push(svg`<g role="img" aria-label=${`${s.name}${s.t !== null ? `, ${f1(s.t)}°` : ""}`}><title>${s.name}</title>
        ${s.t !== null ? svg`<text class="rt" x=${ax} y=${ly} font-size="17" fill="#aab5d1">${f1(s.t)}°</text>` : nothing}
        <text class="rn" x=${ax} y=${ly + 15} font-size=${fit(s.name, step, 11)}>${s.name}</text></g>`);
    });
  }
  // woda grzewcza, gdy pali się w kotle
  if (burning)
    parts.push(svg`<g class="pipes" fill="none" stroke="#ff6d2e" stroke-width="1.8" stroke-dasharray="5 6" opacity=".9" filter="url(#lh-gl)">
      ${up.map((b, k) => svg`<path class="pipe" d="M${x0 + 6},${tops[k] + FH - 4}H${x0 + bw(b) - 6}"></path>`)}
      ${up.length > 1 ? svg`<path class="pipe" d="M${x0 + 10},${GY - 4}V${tops[0] + FH - 4}"></path>` : nothing}</g>`);
  // piwnica pod ziemią
  down.forEach((b, k) => {
    const y = GY + k * BH, w = bw(b), rw = b.spots.length ? w / b.spots.length : w;
    b.spots.forEach((s, j) => {
      defs.push(svg`<linearGradient id=${`lh-t${idx}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color=${tcol(s.t ?? 12, 0.04)}></stop>
        <stop offset="1" stop-color=${s.t === null ? "rgba(80,110,200,.12)" : tcol(s.t, 0.4)}></stop></linearGradient>`);
      parts.push(roomSvg(ctx, s, x0 + j * rw, y, rw, BH, idx++));
    });
    parts.push(svg`<rect x=${x0} y=${y} width=${w} height=${BH} fill="none" stroke="rgba(150,180,255,.45)" stroke-width="2" stroke-dasharray="6 4"></rect>`);
  });
  // domownicy: w domu przy domu, poza domem na drodze (przerywane)
  const px0 = x0 + bw(up[up.length - 1]) + 30;
  home.forEach((p, i) => parts.push(person(p.name, p.color, px0 + i * 26, GY - 14, false)));
  const ax0 = px0 + home.length * 26 + 30;
  away.forEach((p, i) => parts.push(person(p.name, p.color, ax0 + i * 26, GY + 22, true)));

  return html`<section class="lh" aria-label="Dom na żywo">
    <svg viewBox="0 0 ${W} ${H}" style="width:max(100%, ${Math.round(W * (compact ? 0.8 : 0.82))}px)" role="group" aria-label="Przekrój domu: pokoje, światło, grzanie, kocioł i prąd">
      <defs>
        <linearGradient id="lh-edge" x1="0" x2="1"><stop offset="0" stop-color="#26e0ff"></stop><stop offset=".5" stop-color="#a77dff"></stop><stop offset="1" stop-color="#ff4fd8"></stop></linearGradient>
        <linearGradient id="lh-lit" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe6ad"></stop><stop offset="1" stop-color="#ff9a4a"></stop></linearGradient>
        <linearGradient id="lh-gnd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d1a48"></stop><stop offset="1" stop-color="rgba(4,6,13,0)"></stop></linearGradient>
        <radialGradient id="lh-moon" cx=".38" cy=".36" r=".72"><stop offset="0" stop-color="#fffdf2"></stop><stop offset=".62" stop-color="#ebe6cf"></stop><stop offset="1" stop-color="#c8c1a2"></stop></radialGradient>
        <radialGradient id="lh-halo"><stop offset="0" stop-color="rgba(200,220,255,.3)"></stop><stop offset="1" stop-color="rgba(200,220,255,0)"></stop></radialGradient>
        <filter id="lh-gl" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="2.6" result="b"></feGaussianBlur><feMerge><feMergeNode in="b"></feMergeNode><feMergeNode in="SourceGraphic"></feMergeNode></feMerge></filter>
        <filter id="lh-gl2" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="6" result="b"></feGaussianBlur><feMerge><feMergeNode in="b"></feMergeNode><feMergeNode in="b"></feMergeNode><feMergeNode in="SourceGraphic"></feMergeNode></feMerge></filter>
        <filter id="lh-soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4"></feGaussianBlur></filter>
        ${defs}
      </defs>
      ${parts}
    </svg>
    ${!floors && h.user?.is_admin
      ? html`<p class="lh-hint">Dom pokazuje pokoje z ogrzewaniem na jednej kondygnacji. Przypisz obszary do pięter w HA (Ustawienia → Obszary, etykiety i strefy), a narysuje wszystkie piętra.</p>`
      : nothing}
  </section>`;
}

function person(name: string, color: string, x: number, y: number, away: boolean): SVGTemplateResult {
  const ini = name.trim().charAt(0).toUpperCase();
  return away
    ? svg`<g><title>${name}: poza domem</title><circle cx=${x} cy=${y} r="10" fill="rgba(5,8,20,.6)" stroke="#8a95b2" stroke-width="1.6" stroke-dasharray="3 3"></circle>
        <text x=${x} y=${y + 4} text-anchor="middle" font-size="11" font-weight="800" fill="#aab5d1">${ini}</text></g>`
    : svg`<g><title>${name}: w domu</title><circle cx=${x} cy=${y} r="10.5" fill=${color} stroke="#0a0f20" stroke-width="2" filter="url(#lh-gl)"></circle>
        <text x=${x} y=${y + 4} text-anchor="middle" font-size="11" font-weight="800" fill="#050814">${ini}</text></g>`;
}
