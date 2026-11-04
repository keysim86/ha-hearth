// Zakupy → Kupony i Zakupy → Paragony: widoki zamiast okien nad kartami. Konto wybierane przełącznikiem
// (wybór pamiętany na urządzeniu); kod karty i historia punktów zostają w oknie („Pokaż kartę” w nagłówku).

import { html, nothing, type TemplateResult } from "lit";
import type { Ctx } from "./common";
import { lidlCoupons, loyaltySources, paybackCoupons, receiptsView } from "./home";

export function loyaltyPage(ctx: Ctx, what: "kupony" | "paragony"): TemplateResult {
  const src = loyaltySources(ctx.hass, what);
  if (!src.length) return html`<div class="empty">${what === "kupony" ? "Brak kuponów — pojawią się po przebiegu automatu PAYBACK albo Lidl Plus." : "Brak e-paragonów."}</div>`;
  const key = `zakupy.${what}`;
  const cur = src.find((s) => `${s.kind}:${s.konto}` === ctx.ui[key]) ?? src[0];
  const body = what === "paragony" ? receiptsView(ctx, cur.kind, cur.konto) : cur.kind === "lidl" ? lidlCoupons(ctx, cur.konto) : paybackCoupons(ctx, cur.konto);
  return html`<section class="sec lpage"><h2>${what === "kupony" ? "Kupony" : "E-paragony"} <small>${cur.label}</small></h2>
    ${src.length > 1
      ? html`<div class="seg2" role="tablist" aria-label="Konto">${src.map((s) => {
          const on = s === cur;
          return html`<button type="button" role="tab" aria-selected=${on ? "true" : "false"} class=${on ? "on" : ""}
            @click=${() => ctx.actions.setUi(key, `${s.kind}:${s.konto}`)}>${s.label}</button>`;
        })}</div>`
      : nothing}
    <div class="lbody">${body}</div></section>`;
}
