// Neon — pokój jako świecący pierścień (Ciepło → Pokoje): łuk 14–28 °C w kolorze temperatury, kropka = cel,
// stan, − / + celu (jak w pokrętłach), wilgotność i urządzenia. Kliknięcie otwiera pełne ustawienia pokoju.

import { html, nothing, svg } from "lit";
import { f1, num, round } from "../format";
import type { Room } from "../model";
import { icon } from "../svg";
import { chip, deviceIcon, devices, isChild, profileLabel, roomTemp, st, targetNow, type Ctx } from "./common";
import { tcol } from "./livehouse";

const LO = 14, HI = 28, R = 40, C = 2 * Math.PI * R, L = C * 0.75;
const frac = (v: number) => (Math.max(LO, Math.min(HI, v)) - LO) / (HI - LO);

export function neonRoom(ctx: Ctx, r: Room) {
  const t = roomTemp(ctx.hass, r);
  const { z, p, until } = targetNow(ctx, r);
  const heating = ctx.hass.states[r.climate]?.attributes.hvac_action === "heating";
  const col = t === null ? "rgba(150,180,255,.45)" : tcol(t, 1);
  const d = t !== null && z !== null ? t - z : null;
  const label = p === "okno" ? "okno otwarte" : d === null ? "" : d >= 0 ? `${f1(d)}° ponad celem` : `brakuje ${f1(-d)}°`;
  const step = (delta: number) => ctx.actions.stepNow(r, delta);
  let dot: unknown = nothing;
  if (z !== null) {
    const a = ((135 + 270 * frac(z)) * Math.PI) / 180;
    dot = svg`<circle class="tgt" cx=${50 + R * Math.cos(a)} cy=${52 + R * Math.sin(a)} r="3.6"></circle>`;
  }
  const hum = num(st(ctx, r.humidity));
  return html`<article class="nroom ${heating ? "heating" : ""} ${ctx.open === r.areaId ? "sel" : ""}" style="--tc:${col}">
    <button class="nr-open" type="button" aria-expanded=${ctx.open === r.areaId} aria-controls="szczegoly" @click=${() => ctx.actions.toggleRoom(r.areaId)}
      aria-label="${r.name}: ${t === null ? "brak pomiaru" : `${f1(t)}°`}${z !== null ? `, cel ${f1(z)}°` : ""}${label ? `, ${label}` : ""}">
      <span class="nr-top"><b>${r.name}</b>${chip(ctx, r)}</span>
      <svg class="nr-ring" viewBox="0 0 100 92" aria-hidden="true">
        <g transform="rotate(135 50 52)">
          <circle cx="50" cy="52" r=${R} class="trk" stroke-dasharray="${L} ${C}"></circle>
          ${t !== null ? svg`<circle cx="50" cy="52" r=${R} class="val" stroke-dasharray="${L * frac(t)} ${C}"></circle>` : nothing}
        </g>
        ${dot}
        <text class="tv" x="50" y="56">${t === null ? "—" : `${f1(t)}°`}</text>
        <text class="tl" x="50" y="68">${label}</text>
      </svg>
    </button>
    <div class="nr-ctl">
      <button type="button" aria-label="${r.name}: cel niżej" ?disabled=${p === "okno"} @click=${() => step(-0.5)}>−</button>
      <span>cel <b>${f1(z)}°</b><small>${p === "okno" ? "grzanie wstrzymane" : until ? `chwilowo do ${ctx.clock.hm(until)}` : profileLabel(ctx, r, p)}</small></span>
      <button type="button" aria-label="${r.name}: cel wyżej" ?disabled=${p === "okno"} @click=${() => step(0.5)}>+</button>
    </div>
    ${until
      ? html`<div class="nr-tmp">${isChild(ctx) ? nothing : html`<button type="button" @click=${() => ctx.actions.endOverride(r, true)}>na stałe</button>`}
          <button type="button" @click=${() => ctx.actions.endOverride(r, false)}>wróć do programu</button></div>`
      : nothing}
    <div class="nr-pills">
      ${hum === null ? nothing : html`<span class="pill">${icon("drop")}${round(hum)}%</span>`}
      ${devices(ctx, r).map((dv) => html`<span class="pill ${dv.on ? "on air" : ""}">${deviceIcon(dv)}${dv.name.toLowerCase()} ${dv.state}</span>`)}
    </div>
  </article>`;
}
