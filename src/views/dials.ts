// Styl C — Pokrętła: karta w kolorze temperatury, pierścień, − / + celu na karcie.

import { html, nothing } from "lit";
import { f1, hue, num, round } from "../format";
import { hasProfiles, profileValue, type Profile, type Room } from "../model";
import { icon, ring } from "../svg";
import { chip, dayline, deviceIcon, devices, profileLabel, roomTemp, st, targetNow, type Ctx } from "./common";

export function dial(ctx: Ctx, r: Room) {
  const t = roomTemp(ctx.hass, r);
  const { z, p } = targetNow(ctx, r);
  const d = t !== null && z !== null ? t - z : null;
  const label = p === "okno" ? "grzanie wstrzymane" : d === null ? "" : d >= 0 ? `${f1(d)}° ponad celem` : `brakuje ${f1(-d)}°`;
  const heating = ctx.hass.states[r.climate]?.attributes.hvac_action === "heating";
  const step = (delta: number) => (p && p !== "okno" ? ctx.actions.stepProfile(r, p, delta) : ctx.actions.stepClimate(r, delta));
  const pills = hasProfiles(r)
    ? (["k", "e", "w"] as Profile[])
        .map((k) => [k, profileValue(ctx.hass, r, k, ctx.pending)] as const)
        .filter(([, v]) => v !== null)
        .map(([k, v]) => html`<span class="pill ${p === k ? "on" : ""}">${k === "k" ? "dzień" : k === "e" ? "noc" : "wieczór"} ${f1(v)}°</span>`)
    : [];
  const hum = num(st(ctx, r.humidity));
  return html`<article class="dial ${heating ? "heating" : ""} ${ctx.open === r.areaId ? "sel" : ""}" style="--h:${hue(t ?? 20).toFixed(0)}">
    <button class="dial-open" type="button" aria-expanded=${ctx.open === r.areaId} aria-controls="szczegoly"
        @click=${() => ctx.actions.toggleRoom(r.areaId)}>
      <span class="dial-top"><b>${r.name}</b>${chip(ctx, r)}</span>
      ${ring(t, z, label, f1(t))}
    </button>
    <div class="dial-ctl">
      <button type="button" aria-label="${r.name}: cel niżej" ?disabled=${p === "okno"} @click=${() => step(-0.5)}>−</button>
      <span class="cel"><b>${f1(z)}°</b><small>${p === "okno" ? "okno otwarte" : `cel · ${profileLabel(ctx, r, p)}`}</small></span>
      <button type="button" aria-label="${r.name}: cel wyżej" ?disabled=${p === "okno"} @click=${() => step(0.5)}>+</button>
    </div>
    <div class="pills">
      ${pills}
      ${hum === null ? nothing : html`<span class="pill">${icon("drop")}${round(hum)}%</span>`}
      ${devices(ctx, r).map((dv) => html`<span class="pill ${dv.on ? "on air" : ""}">${deviceIcon(dv)}${dv.name.toLowerCase()} ${dv.state}</span>`)}
    </div>
    ${dayline(ctx, r, false)}
  </article>`;
}
