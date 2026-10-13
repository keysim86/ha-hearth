// Styl A — Kafelki: łuk 16–28 °C, wykres 24 h, oś dnia, urządzenia, stopka.

import { html, nothing } from "lit";
import { f1, num, round, tempColor } from "../format";
import { windowOpen, type Room } from "../model";
import { gauge, icon, spark } from "../svg";
import { chip, dayline, delta, deviceRow, devices, profileLabel, roomTemp, st, targetNow, type Ctx } from "./common";

export function tile(ctx: Ctx, r: Room) {
  const t = roomTemp(ctx.hass, r);
  const { z, p } = targetNow(ctx, r);
  const devs = devices(ctx, r);
  const hum = num(st(ctx, r.humidity));
  const bat = num(st(ctx, r.battery));
  return html`<button class="room" type="button" aria-expanded=${ctx.open === r.areaId} aria-controls="szczegoly"
      @click=${() => ctx.actions.toggleRoom(r.areaId)}>
    <div class="rhead"><span class="rname">${r.name}</span>${chip(ctx, r)}</div>
    <div class="rmain">${gauge(t, z)}
      <div class="now">
        <span class="tbig" style="color:${tempColor(t)}">${f1(t)}<span class="u">°</span></span>
        <span class="target">cel <b>${f1(z)}°</b> · ${p === "okno" ? "okno otwarte" : profileLabel(ctx, r, p)}</span>
        ${delta(t, z)}
      </div>
    </div>
    ${spark(ctx.hist.series(ctx.hass, r.temp), z)}
    ${dayline(ctx, r)}
    ${devs.length ? html`<div class="rdev">${devs.map(deviceRow)}</div>` : nothing}
    <div class="rfoot">
      ${hum === null ? nothing : html`<span title="Wilgotność">${icon("drop")}${round(hum)}%</span>`}
      ${r.valve ? html`<span title="Ile w ostatniej godzinie zawór był otwarty">${icon("valve")}zawór ${round(num(st(ctx, r.valve)) ?? 0)}%/h</span>` : nothing}
      ${r.battery ? html`<span title="Bateria głowicy">${icon("batt")}${bat === null ? "bateria —" : `${round(bat)}%`}</span>` : nothing}
      ${r.windows.length ? html`<span title="Okna i drzwi">${icon("win")}${windowOpen(ctx.hass, r) ? "otwarte" : "zamknięte"}</span>` : nothing}
    </div>
  </button>`;
}
