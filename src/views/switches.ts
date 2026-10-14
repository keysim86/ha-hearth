// Zakładka Przełączniki: światła, gniazdka i wentylatory z obszarów HA, pogrupowane według pokoi.

import { html, nothing, type TemplateResult } from "lit";
import { num, round } from "../format";
import { areaOf } from "../model";
import { deviceEntities, entityName, sinceLabel, type Ctx } from "./common";

const DOMAINS = ["light", "switch", "fan"];
const bulb = html`<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a7 7 0 0 0-4 12.7V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.3A7 7 0 0 0 12 2Zm-3 18h6v1a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1Z"></path></svg>`;
const plug = html`<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M8 2v5H6v4a6 6 0 0 0 5 5.9V22h2v-5.1A6 6 0 0 0 18 11V7h-2V2h-2v5h-4V2Z"></path></svg>`;
const fanI = html`<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 10.6a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8Zm.6-1.5c.3-2.6 1-5.7 3.6-6.1 2.4-.4 3.6 2.4 1.9 4.2-1.4 1.4-3.4 2-5.5 1.9Zm2.3 4.2c2.4 1 5.3 2.5 5 5.1-.3 2.4-3.3 2.8-4.3.6-.8-1.8-.9-3.9-.7-5.7Zm-4.2 1.9c-2 1.6-4.7 3.4-6.9 2-2-1.4-.9-4.2 1.5-4.3 2-.1 3.9.9 5.4 2.3Z"></path></svg>`;

export function switchesList(ctx: Ctx): Map<string, string[]> {
  const h = ctx.hass;
  const skip = new Set(ctx.opts.switch_exclude ?? []);
  // Przełącznik zamieniony na światło (switch_as_x) pokazujemy raz — jako światło.
  const wrapped = new Set(
    Object.values(h.entities).filter((e) => e.platform === "switch_as_x" && e.device_id).map((e) => e.device_id as string),
  );
  const out = new Map<string, string[]>();
  for (const a of Object.values(h.areas)) out.set(a.area_id, []);
  for (const e of Object.values(h.entities)) {
    const id = e.entity_id, d = id.split(".")[0];
    if (!DOMAINS.includes(d) || e.hidden || e.entity_category || skip.has(id) || !h.states[id]) continue;
    if (d === "switch" && e.device_id && wrapped.has(e.device_id) && e.platform !== "switch_as_x") continue;
    const area = areaOf(h, id);
    if (!area || !out.has(area)) continue;
    out.get(area)!.push(id);
  }
  for (const [k, v] of out) if (!v.length) out.delete(k);
  return out;
}

export function switchesView(ctx: Ctx): TemplateResult {
  const h = ctx.hass;
  const groups = switchesList(ctx);
  const query = (ctx.ui.swq ?? "").trim().toLowerCase();
  const on = [...groups.values()].flat().filter((e) => h.states[e].state === "on");
  const cards = [...groups].map(([area, ids]) => {
    const areaName = h.areas[area]?.name ?? area;
    const list = ids
      .filter((id) => !query || `${entityName(h, id)} ${areaName}`.toLowerCase().includes(query))
      .sort((a, b) => a.split(".")[0].localeCompare(b.split(".")[0]) || entityName(h, a).localeCompare(entityName(h, b), "pl"));
    if (!list.length) return nothing;
    return html`<div class="ocell swgroup"><span class="hlabel">${areaName} <small>${list.filter((e) => h.states[e].state === "on").length} wł.</small></span>
      <div class="swgrid">${list.map((id) => {
        const s = h.states[id];
        const d = id.split(".")[0];
        const isOn = s.state === "on";
        const power = deviceEntities(h, h.entities[id]?.device_id, ["sensor"]).find((x) => h.states[x].attributes.device_class === "power");
        const w = power ? num(h.states[power].state) : null;
        return html`<button type="button" class="sw ${isOn ? "on" : ""} d-${d}" ?disabled=${s.state === "unavailable"}
            aria-pressed=${isOn ? "true" : "false"} @click=${() => ctx.actions.call(d, "toggle", { entity_id: id })}>
          <span class="swico">${d === "light" ? bulb : d === "fan" ? fanI : plug}</span>
          <span class="swtxt"><b>${entityName(h, id)}</b>
            <small>${s.state === "unavailable" ? "niedostępne" : isOn ? sinceLabel(ctx, s.last_changed) : "wył."}${w !== null && w > 0.5 ? ` · ${round(w)} W` : ""}</small></span>
        </button>`;
      })}</div></div>`;
  });
  return html`<section class="sec">
    <div class="swhead">
      <input class="search" type="search" placeholder="Szukaj (nazwa albo pokój)…" aria-label="Szukaj przełącznika" .value=${ctx.ui.swq ?? ""}
        @input=${(e: Event) => ctx.actions.setUi("swq", (e.target as HTMLInputElement).value)} />
      <span class="hsub">${on.length ? `Włączone: ${on.length}` : "Wszystko wyłączone"}</span>
    </div>
    <div class="cards meters">${cards}</div>
  </section>`;
}
