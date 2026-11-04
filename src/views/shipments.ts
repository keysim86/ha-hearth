// Zakupy → Przesyłki: paczki z integracji Polish Shipment Tracking w jednej siatce od najpilniejszych (do odbioru,
// kurier w drodze, problem, w drodze, nadane), z kodem odbioru, odświeżaniem, ukrywaniem i śledzeniem po numerze;
// kafelek na Teraz.
// Dziecko nie widzi przesyłek ani kodów (strona tylko dla dorosłych, kafelek i sprawy też).

import { html, nothing, svg, type TemplateResult } from "lit";
import { DELIVERY, SHIP_DOMAIN, SHIP_STATUS, courierName, hasShipments, ignoredShipments, refreshAllButtons, shipments, type Shipment } from "../data/shipments";
import { isChild, since, type Ctx } from "./common";

export const parcelIcon = html`<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${svg`<path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5z"></path><path d="m3.5 7.5 8.5 4.5 8.5-4.5M12 12v9"></path><path d="m7.8 5.2 8.5 4.6"></path>`}</svg>`;

const KIND: Partial<Record<Shipment["status"], string>> = { waiting_for_pickup: "ready", handed_out_for_delivery: "out", exception: "bad" };

/** Kod przy paczce czekającej w punkcie albo wydanej kurierowi (PIN do przekazania) — tylko dla dorosłych. */
const codeFor = (ctx: Ctx, s: Shipment) =>
  s.code && !isChild(ctx) && (s.status === "waiting_for_pickup" || s.status === "handed_out_for_delivery") ? s.code : "";

function card(ctx: Ctx, s: Shipment): TemplateResult {
  const code = codeFor(ctx, s);
  const where = [DELIVERY[s.delivery], s.location].filter(Boolean).join(" · ");
  return html`<article class="ship ${KIND[s.status] ?? ""}">
    <div class="ship-h"><span class="ship-c">${courierName(s.courier)}</span><span class="ship-st">${SHIP_STATUS[s.status][0]}</span><small>${since(s.since)} temu</small></div>
    <b class="ship-from">${s.sender || "Nadawca nieznany"}</b>
    ${where ? html`<span class="ship-loc">${where}</span>` : nothing}
    ${code
      ? html`<div class="ship-code"><span>${s.status === "waiting_for_pickup" ? "kod odbioru" : "PIN dla kuriera"}</span><b>${code}</b></div>`
      : nothing}
    <span class="ship-no">${s.number}</span>
    <div class="acts">
      ${s.refresh ? html`<button class="btn" type="button" @click=${() => ctx.actions.call("button", "press", { entity_id: s.refresh })}>Odśwież</button>` : nothing}
      <button class="btn" type="button" @click=${() =>
        window.confirm(`Ukryć przesyłkę ${s.number}? Wróci przyciskiem „Przywróć” na dole listy.`) &&
        ctx.actions.call(SHIP_DOMAIN, "ignore_shipment", { tracking_number: s.number })}>Ukryj</button>
    </div>
  </article>`;
}

export function shipmentsView(ctx: Ctx): TemplateResult {
  const list = shipments(ctx.hass);
  const all = refreshAllButtons(ctx.hass);
  const ignored = ignoredShipments(ctx.hass);
  return html`<section class="sec">
    <div class="ship-top"><h2>Przesyłki <small>${list.length ? `${list.length} w drodze` : "nic w drodze"}</small></h2>
      ${all.length
        ? html`<button class="btn" type="button" @click=${() => { all.forEach((b) => ctx.actions.call("button", "press", { entity_id: b })); ctx.actions.toast("Odświeżam przesyłki u kurierów…"); }}>Odśwież wszystkie</button>`
        : nothing}</div>
    ${list.length
      ? html`<div class="ships">${list.map((s) => card(ctx, s))}</div>`
      : html`<div class="empty">Żadna przesyłka nie jest w drodze. Nowe paczki z kont kurierów pojawią się tu same.</div>`}
    <form class="ship-track" @submit=${(e: Event) => {
      e.preventDefault();
      const input = (e.currentTarget as HTMLFormElement).querySelector("input")!;
      const v = input.value.replace(/\s+/g, "");
      if (!v) return;
      ctx.actions.call(SHIP_DOMAIN, "track_shipment", { tracking_number: v });
      ctx.actions.toast(`Śledzę przesyłkę ${v} — pojawi się po odświeżeniu konta`);
      input.value = "";
    }}>
      <label>Śledź przesyłkę InPost po numerze <small>np. przekierowaną na inny adres</small>
        <input type="text" inputmode="numeric" autocomplete="off" placeholder="numer przesyłki" aria-label="Numer przesyłki InPost" /></label>
      <button class="btn" type="submit">Śledź</button>
    </form>
    ${ignored.length
      ? html`<details class="ship-ign"><summary>Ukryte (${ignored.length})</summary>
          ${ignored.map((n) => html`<div class="row"><span class="ship-no">${n}</span>
            <button class="btn" type="button" @click=${() => ctx.actions.call(SHIP_DOMAIN, "unignore_shipment", { tracking_number: n })}>Przywróć</button></div>`)}</details>`
      : nothing}
  </section>`;
}

/** Kafelek na Teraz (obok skrzynki pocztowej): co czeka na odbiór, co jest u kuriera; klik = Zakupy → Przesyłki. */
export function shipmentsBox(ctx: Ctx): TemplateResult | typeof nothing {
  if (isChild(ctx) || !hasShipments(ctx.hass)) return nothing;
  const list = shipments(ctx.hass);
  const count = (st: Shipment["status"]) => list.filter((s) => s.status === st).length;
  const ready = count("waiting_for_pickup"), out = count("handed_out_for_delivery"), bad = count("exception");
  const title = ready ? `${ready} do odbioru` : out ? `${out} u kuriera` : list.length ? `${list.length} w drodze` : "Nic w drodze";
  const sub = [ready && out ? `${out} u kuriera` : "", bad ? `${bad} z problemem` : "", list.length && (ready || out) ? `razem ${list.length} w drodze` : ""]
    .filter(Boolean).join(" · ") || (list.length ? "Przesyłki — szczegóły" : "przesyłki z kont kurierów");
  const body = html`<span class="gico">${parcelIcon}</span><span class="gtxt"><b>Przesyłki: ${title}</b><small>${sub}</small></span>`;
  // Bez zakładki Zakupy (wyłączonej w opcjach) kafelek tylko informuje — nie udaje przycisku.
  return ctx.tabs && !ctx.tabs.includes("shopping")
    ? html`<div class="box2 shipbox ro ${ready ? "full" : ""} ${bad ? "bad" : ""}">${body}</div>`
    : html`<button class="box2 shipbox ${ready ? "full" : ""} ${bad ? "bad" : ""}" type="button" @click=${() => ctx.actions.goTo("shopping", "przesylki")}>${body}</button>`;
}
