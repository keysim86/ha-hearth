// Zakładka Liczniki: dowolne encje pogrupowane według urządzeń; liczniki narastające z zużyciem dziś / w miesiącu.

import { html, nothing, type TemplateResult } from "lit";
import { energyPrefs, sourcesOf } from "../data/energy";
import { startOfDay, startOfMonth, sumSince } from "../data/stats";
import { num } from "../format";
import { line } from "../svg";
import { cleanName, deviceName, entityName, since, unitOf, type Ctx } from "./common";

const BIN: Record<string, [string, string, boolean?]> = {
  door: ["Otwarte", "Zamknięte"], window: ["Otwarte", "Zamknięte"], opening: ["Otwarte", "Zamknięte"],
  problem: ["Problem", "OK", true], battery: ["Niski", "OK", true], running: ["Pracuje", "Stoi"],
  moisture: ["Mokro", "Sucho", true], connectivity: ["Połączone", "Rozłączone"], power: ["Włączone", "Wyłączone"],
};
const TEXT: Record<string, string> = { on: "Wł.", off: "Wył.", unavailable: "niedostępne", unknown: "brak danych", true: "tak", false: "nie" };

function fmtNumber(ctx: Ctx, id: string, v: number): string {
  const p = (ctx.hass.entities[id] as { display_precision?: number } | undefined)?.display_precision;
  const digits = p ?? (Math.abs(v) >= 1000 ? 0 : Math.abs(v) >= 100 ? 1 : Math.abs(v) >= 1 ? 2 : 3);
  return v.toLocaleString("pl-PL", { maximumFractionDigits: digits, minimumFractionDigits: p ?? 0 });
}

function value(ctx: Ctx, id: string): TemplateResult {
  const s = ctx.hass.states[id];
  const a = s.attributes;
  const unit = unitOf(ctx.hass, id);
  if (id.startsWith("binary_sensor.")) {
    const [on, off, alarm] = BIN[a.device_class] ?? ["Wł.", "Wył."];
    return html`<b class=${s.state === "on" && alarm ? "alarm" : s.state === "on" ? "onv" : ""}>${s.state === "on" ? on : s.state === "off" ? off : (TEXT[s.state] ?? s.state)}</b>`;
  }
  if (a.device_class === "timestamp" || a.device_class === "date") {
    const t = Date.parse(s.state);
    if (Number.isFinite(t)) {
      const d = new Date(t);
      const rel = t > Date.now() ? `za ${since(2 * Date.now() - t)}` : `${since(t)} temu`;
      return html`<b>${d.getDate()}.${String(d.getMonth() + 1).padStart(2, "0")}${a.device_class === "timestamp" ? ` ${ctx.clock.hm(d)}` : ""}</b><small>${rel}</small>`;
    }
  }
  const v = num(s.state);
  if (v !== null && /^-?[\d.]+(e[-+]?\d+)?$/i.test(s.state.trim())) return html`<b>${fmtNumber(ctx, id, v)}${unit ? html`<span class="u"> ${unit}</span>` : nothing}</b>`;
  return html`<b>${TEXT[s.state] ?? s.state}</b>`;
}

export function metersView(ctx: Ctx): TemplateResult {
  const h = ctx.hass;
  let ids = ctx.opts.meters?.length ? ctx.opts.meters : [];
  if (!ids.length) {
    const prefs = energyPrefs(h, ctx.refresh);
    ids = [...sourcesOf(prefs, "water"), ...sourcesOf(prefs, "gas")];
  }
  ids = ids.filter((id) => h.states[id]);
  if (!ids.length) return html`<div class="empty">Wskaż encje liczników w opcjach Hearth (sekcja Liczniki) albo dodaj wodę i gaz w panelu Energia.</div>`;
  const cumulative = ids.filter((id) => ["total", "total_increasing"].includes(h.states[id].attributes.state_class) && num(h.states[id].state) !== null);
  const from = Math.min(startOfDay().getTime(), startOfMonth().getTime());
  const stats = ctx.stats.get(h, cumulative, "day", new Date(from), ctx.refresh);
  const groups = new Map<string, string[]>();
  for (const id of ids) {
    const g = cleanName(deviceName(h, id) ?? "Inne");
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(id);
  }
  const t0 = startOfDay().getTime(), m0 = startOfMonth().getTime();
  return html`<section class="sec"><div class="cards meters">
    ${[...groups].map(([name, list]) => html`<div class="ocell mgroup"><span class="hlabel">${name}</span>
      ${list.map((id) => {
        const a = h.states[id].attributes;
        const unit = unitOf(h, id);
        const isCum = cumulative.includes(id);
        const measurement = a.state_class === "measurement" && !isCum;
        return html`<div class="mrow">
          <span class="mname">${entityName(h, id)}${isCum && stats[id]
            ? html`<small>dziś +${fmtNumber(ctx, id, sumSince(stats[id], t0))} ${unit} · miesiąc +${fmtNumber(ctx, id, sumSince(stats[id], m0))} ${unit}</small>`
            : nothing}</span>
          <span class="mval">${value(ctx, id)}</span>
          ${measurement ? html`<span class="mspark">${line(ctx.hist.series(h, id), "var(--frost)")}</span>` : nothing}
        </div>`;
      })}
    </div>`)}
  </div></section>`;
}
