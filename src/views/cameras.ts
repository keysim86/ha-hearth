// Zakładka Kamery: podglądy odświeżane co kilka sekund, kliknięcie = okno kamery HA (obraz na żywo), stan rejestratora.

import { html, nothing, type TemplateResult } from "lit";
import { num } from "../format";
import { entityName, st, valueText, type Ctx } from "./common";

const CAM_STATE: Record<string, string> = { recording: "nagrywa", streaming: "na żywo", idle: "czuwa", unavailable: "niedostępna" };

export function cameraList(ctx: Ctx): string[] {
  const h = ctx.hass;
  if (ctx.opts.cameras?.length) return ctx.opts.cameras.filter((c) => h.states[c]);
  const all = Object.keys(h.states).filter((e) => e.startsWith("camera.") && !h.entities[e]?.hidden && !h.entities[e]?.entity_category);
  const frigate = all.filter((e) => h.entities[e]?.platform === "frigate");
  return frigate.length ? frigate : all.filter((e) => h.states[e].state !== "unavailable");
}

export function camImg(ctx: Ctx, id: string, tick: number): string | null {
  const token = ctx.hass.states[id]?.attributes.access_token;
  return token ? `/api/camera_proxy/${id}?token=${token}&t=${tick}` : null;
}

export function camerasView(ctx: Ctx, tick: number): TemplateResult {
  const h = ctx.hass, o = ctx.opts;
  const cams = cameraList(ctx);
  const used = num(st(ctx, o.nvr_storage_used)), total = num(st(ctx, o.nvr_storage_total));
  const pct = used !== null && total ? Math.min(100, (used / total) * 100) : null;
  const nvr = o.nvr_status || o.nvr_version || o.nvr_storage_used;
  return html`
    ${nvr
      ? html`<section class="house">
          ${o.nvr_status ? html`<div class="hcell"><span class="hlabel">Rejestrator</span><span class="hval">${st(ctx, o.nvr_status) === "on" ? "Działa" : "Niedostępny"}</span>
            <span class="hsub"><span class="dot ${st(ctx, o.nvr_status) === "on" ? "ok" : "warn"}"></span>${o.nvr_version ? `wersja ${st(ctx, o.nvr_version)}` : ""}</span></div>` : nothing}
          ${o.nvr_channels ? html`<div class="hcell"><span class="hlabel">Kanały</span><span class="hval">${st(ctx, o.nvr_channels)}</span><span class="hsub">kamer w rejestratorze</span></div>` : nothing}
          ${pct !== null ? html`<div class="hcell"><span class="hlabel">Magazyn</span><span class="hval">${Math.round(pct)}<span class="u">%</span></span>
            <span class="hsub">${valueText(h, o.nvr_storage_used ?? undefined)} z ${valueText(h, o.nvr_storage_total ?? undefined)}</span>
            <div class="pmbar"><i style="width:${pct.toFixed(0)}%;background:${pct > 90 ? "var(--crit)" : pct > 80 ? "var(--warn)" : "var(--ok)"}"></i></div></div>` : nothing}
        </section>`
      : nothing}
    ${cams.length
      ? html`<section class="sec"><div class="cams">${cams.map((id) => {
          const s = h.states[id];
          const src = camImg(ctx, id, tick);
          return html`<button type="button" class="cam" @click=${() => ctx.actions.moreInfo(id)} aria-label="${entityName(h, id)}: podgląd na żywo">
            <span class="camimg">${src ? html`<img src=${src} alt="" loading="lazy" @error=${(e: Event) => ((e.target as HTMLElement).hidden = true)} />` : nothing}</span>
            <span class="camcap"><b>${entityName(h, id)}</b><small><span class="dot ${s.state === "recording" ? "heat" : s.state === "unavailable" ? "warn" : "ok"}"></span>${CAM_STATE[s.state] ?? s.state}</small></span>
          </button>`;
        })}</div><span class="hsub">Podgląd odświeża się co 5 s. Kliknij kamerę, żeby zobaczyć obraz na żywo.</span></section>`
      : html`<div class="empty">Nie ma kamer. Wskaż je w opcjach Hearth (sekcja Kamery).</div>`}`;
}
