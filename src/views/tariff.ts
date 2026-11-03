// Plan stref taryfy (atrybuty sensora strefy: plan_dzis / plan_jutro = 24 znaki n/p/s, ceny_dzis / ceny_jutro):
// pasek 24 h z kreską „teraz” i odpowiedź „od kiedy taniej”. Bez atrybutów — nic (zostaje sama nazwa strefy).

import { html, nothing, type TemplateResult } from "lit";
import type { Ctx } from "./common";

type Z = "n" | "p" | "s";
const ZONE: Record<Z, [string, string]> = { n: ["noc", "var(--bath)"], p: ["poza szczytem", "var(--air)"], s: ["szczyt", "var(--ember)"] };

export interface TariffPlan { today: Z[]; tomorrow: Z[] | null; prices: Record<Z, number>; pricesTomorrow: Record<Z, number> | null; hour: number; minute: number }

const zones = (v: unknown): Z[] | null => (typeof v === "string" && /^[nps]{24}$/.test(v) ? (v.split("") as Z[]) : null);
const prices = (v: unknown): Record<Z, number> | null => {
  const o = v as Record<string, unknown> | null;
  return o && ["n", "p", "s"].every((k) => typeof o[k] === "number") ? (o as Record<Z, number>) : null;
};

export function tariffPlan(ctx: Ctx): TariffPlan | null {
  const a = ctx.opts.tariff ? ctx.hass.states[ctx.opts.tariff]?.attributes : undefined;
  const today = zones(a?.plan_dzis), p = prices(a?.ceny_dzis);
  if (!today || !p) return null;
  return { today, tomorrow: zones(a?.plan_jutro), prices: p, pricesTomorrow: prices(a?.ceny_jutro), hour: Math.floor(ctx.nowMinute / 60), minute: ctx.nowMinute % 60 };
}

/** Najbliższa pełna godzina (dziś albo jutro), od której prąd jest tańszy niż teraz. */
export function cheaperFrom(t: TariffPlan): { hour: number; tomorrow: boolean; zone: Z; price: number } | null {
  const now = t.prices[t.today[t.hour]];
  for (let h = t.hour + 1; h < 24; h++) if (t.prices[t.today[h]] < now - 1e-6) return { hour: h, tomorrow: false, zone: t.today[h], price: t.prices[t.today[h]] };
  if (t.tomorrow && t.pricesTomorrow)
    for (let h = 0; h <= t.hour; h++)
      if (t.pricesTomorrow[t.tomorrow[h]] < now - 1e-6) return { hour: h, tomorrow: true, zone: t.tomorrow[h], price: t.pricesTomorrow[t.tomorrow[h]] };
  return null;
}

const zl = (v: number) => v.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function cheaperText(t: TariffPlan): string {
  const c = cheaperFrom(t);
  return c ? `taniej ${c.tomorrow ? "jutro " : ""}od ${c.hour}:00` : "najtańsza strefa";
}

export function tariffStrip(ctx: Ctx): TemplateResult | typeof nothing {
  const t = tariffPlan(ctx);
  if (!t) return nothing;
  const cur = t.today[t.hour], c = cheaperFrom(t);
  const pos = ((t.hour + t.minute / 60) / 24) * 100;
  return html`<div class="ocell tplan">
    <span class="hlabel">Strefy dziś</span>
    <div class="tnext">Teraz <b style="color:${ZONE[cur][1]}">${ZONE[cur][0]}</b> · ${zl(t.prices[cur])} zł/kWh${c
      ? html` · <b class="cheaper">taniej ${c.tomorrow ? "jutro " : ""}od ${c.hour}:00</b> (${ZONE[c.zone][0]}, ${zl(c.price)} zł)`
      : html` · <b class="cheaper">najtańsza strefa</b>`}</div>
    <div class="tbar" role="img" aria-label="Strefy taryfy godzina po godzinie: ${t.today.map((z, h) => `${h}: ${ZONE[z][0]}`).join(", ")}">
      ${t.today.map((z, h) => html`<i class=${h < t.hour ? "past" : ""} style="--c:${ZONE[z][1]}" title="${h}:00–${h + 1}:00 · ${ZONE[z][0]} · ${zl(t.prices[z])} zł/kWh"></i>`)}
      <span class="tnow" style="left:calc(${pos.toFixed(2)}% - 1.5px)"></span>
    </div>
    <div class="taxis"><span>0</span><span>6</span><span>12</span><span>18</span><span>24</span></div>
    <div class="tleg">${(["n", "p", "s"] as Z[]).map((z) => html`<span><i style="--c:${ZONE[z][1]}"></i>${ZONE[z][0]} ${zl(t.prices[z])} zł</span>`)}</div>
  </div>`;
}
