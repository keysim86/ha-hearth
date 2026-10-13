// Styl B — Lista: wiersz na pokój, skala 16–28 °C, wykres i plan dnia, dane głowicy.

import { html, nothing } from "lit";
import { f1, num, round, tempColor } from "../format";
import { type Room } from "../model";
import { flame, icon, scale, spark } from "../svg";
import { dayline, devices, profileLabel, roomTemp, st, targetNow, type Ctx } from "./common";

export const listHeader = html`<div class="lhead" aria-hidden="true">
  <span>Pokój</span><span>Teraz</span><span>Skala 16–28 °C</span><span>Ostatnie 24 h · plan dnia</span><span style="text-align:right">Głowica</span>
</div>`;

export function row(ctx: Ctx, r: Room) {
  const t = roomTemp(ctx.hass, r);
  const { z, p } = targetNow(ctx, r);
  const c = ctx.hass.states[r.climate];
  const status = p === "okno" ? html`<span class="lstat window">${icon("win")} okno otwarte</span>`
    : !c || c.state === "off" ? html`<span class="lstat">wyłączona</span>`
    : c.attributes.hvac_action === "heating" ? html`<span class="lstat heat">${flame} grzeje</span>`
    : html`<span class="lstat">ciepło, czeka</span>`;
  const hum = num(st(ctx, r.humidity));
  const bat = num(st(ctx, r.battery));
  return html`<button class="lrow" type="button" aria-expanded=${ctx.open === r.areaId} aria-controls="szczegoly"
      @click=${() => ctx.actions.toggleRoom(r.areaId)}>
    <span class="lname"><b>${r.name}</b>${status}</span>
    <span class="ltemp"><span class="v" style="color:${tempColor(t)}">${f1(t)}°</span><span class="z">cel ${f1(z)}° · ${p === "okno" ? "okno" : profileLabel(ctx, r, p)}</span></span>
    ${scale(t, z)}
    <span class="lspark">${spark(ctx.hist.series(ctx.hass, r.temp), z)}${dayline(ctx, r, false)}</span>
    <span class="lmeta">
      ${hum === null ? nothing : html`<span>wilg ${round(hum)}%</span>`}
      ${r.valve ? html`<span>zawór ${round(num(st(ctx, r.valve)) ?? 0)}%</span>` : nothing}
      ${r.battery ? html`<span>bat ${bat === null ? "—" : `${round(bat)}%`}</span>` : nothing}
      ${devices(ctx, r).map((d) => html`<span style=${d.on ? "color:var(--air)" : ""}>${d.kind === "fan" ? "went." : "osusz."} ${d.state}</span>`)}
    </span>
  </button>`;
}
