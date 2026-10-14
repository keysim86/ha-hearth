// Zakładka Alerty: reguły z opcji („< 20”, „== open”, „!= on”…) sprawdzane na bieżąco; licznik na zakładce.

import { html, type TemplateResult } from "lit";
import { num } from "../format";
import { entityName, sinceLabel, valueText, type Ctx } from "./common";

export interface ActiveAlert {
  entity: string;
  message: string;
  severity: "error" | "warn" | "info";
}

export function activeAlerts(ctx: Ctx): ActiveAlert[] {
  const out: ActiveAlert[] = [];
  for (const r of ctx.opts.alerts ?? []) {
    const s = ctx.hass.states[r.entity];
    if (!s || s.state === "unavailable" || s.state === "unknown") continue;
    const m = /^\s*(==|!=|<=|>=|<|>)\s*(.+?)\s*$/.exec(r.condition ?? "");
    if (!m) continue;
    const [, op, raw] = m;
    const a = num(s.state), b = num(raw);
    const numeric = a !== null && b !== null;
    const L: number | string = numeric ? a! : s.state, R: number | string = numeric ? b! : raw.replace(/^["']|["']$/g, "");
    const hit = op === "==" ? L === R : op === "!=" ? L !== R : op === "<" ? L < R : op === ">" ? L > R : op === "<=" ? L <= R : L >= R;
    if (hit) out.push({ entity: r.entity, message: r.message || entityName(ctx.hass, r.entity), severity: (["error", "warn", "info"].includes(r.severity ?? "") ? r.severity : "warn") as ActiveAlert["severity"] });
  }
  const rank = { error: 0, warn: 1, info: 2 };
  out.sort((x, y) => rank[x.severity] - rank[y.severity]);
  // Progi stopniowane na jednej encji (np. dysk > 80% uwaga, > 90% pilne): zostaje tylko najpoważniejszy.
  const seen = new Set<string>();
  return out.filter((a) => !seen.has(a.entity) && seen.add(a.entity));
}

export function alertsView(ctx: Ctx): TemplateResult {
  const rules = ctx.opts.alerts ?? [];
  if (!rules.length) return html`<div class="empty">Brak reguł alertów. Dodaj je w opcjach Hearth (sekcja Alerty i Agent).</div>`;
  const active = activeAlerts(ctx);
  const LABEL = { error: "Pilne", warn: "Uwaga", info: "Informacja" };
  return html`<section class="sec">
    <h2>${active.length ? `Aktywne: ${active.length}` : "Wszystko w porządku"} <small>${rules.length} reguł</small></h2>
    ${active.length
      ? html`<div class="ocell list">${active.map((a) => html`<button type="button" class="alert ${a.severity}" @click=${() => ctx.actions.moreInfo(a.entity)}>
          <span class="asev">${LABEL[a.severity]}</span>
          <span class="atxt"><b>${a.message}</b><small>${entityName(ctx.hass, a.entity)}: ${valueText(ctx.hass, a.entity)} · ${sinceLabel(ctx, ctx.hass.states[a.entity].last_changed)}</small></span>
        </button>`)}</div>`
      : html`<div class="ocell"><span class="hsub">Żadna z reguł nie jest teraz spełniona.</span></div>`}
  </section>`;
}
