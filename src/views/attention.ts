// „Wymaga uwagi” (zakładka Dom, oba wyglądy): jedno miejsce na sprawy do załatwienia, od najpilniejszych.
// Źródła: reguły z zakładki Alerty, bramy/garaże/drzwi otwarte za długo, otwarte okno przy grzaniu, głowica bez kontaktu,
// jutrzejszy wywóz odpadów, poczta w skrzynce, koniec prania / suszenia / zmywania,
// przesyłki (do odbioru, u kuriera, problem — Polish Shipment Tracking). Kupony tu nie trafiają (decyzja użytkownika
// 2026-11-05 — są na stronach Zakupy → Kupony).
// Każda sprawa ma akcję w jednym dotknięciu; „Jutro” odkłada ją do 6:00,
// „Zrobione” (przesunięcie w prawo) chowa ją do następnego razu — wybór pamięta to urządzenie (ctx.ui.attn).

import { html, nothing, svg, type TemplateResult } from "lit";
import { windowOpen, type Room } from "../model";
import { mailIcon } from "../svg";
import { activeAlerts } from "./alerts";
import { entityName, isChild, lostAdvice, roll, silentHours, since, st, valueText, type Ctx } from "./common";
import { gateIds, toggleFor, wasteRows } from "./home";
import { cycleSources } from "./appliances";
import { DELIVERY, courierName, shipments } from "../data/shipments";
import { parcelIcon } from "./shipments";

type Kind = "crit" | "warn" | "cold" | "info";
/** action.dismiss = przycisk tylko potwierdza (np. „Wystawione”) i chowa sprawę do następnego razu. */
interface Item { key: string; kind: Kind; icon: TemplateResult; title: string; sub: string; at: number; action?: { label: string; run?: () => void; dismiss?: boolean } }

const RANK: Record<Kind, number> = { crit: 0, warn: 1, cold: 2, info: 3 };
const GATE_MIN = 10, WINDOW_MIN = 3;
const NEVER = 9e15;

const ico = (d: TemplateResult) => html`<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const I = {
  garage: ico(svg`<path d="M3 21V9l9-5 9 5v12"></path><path d="M6.5 21v-9h11v9"></path><path d="M6.5 14.5h11M6.5 17.5h11"></path>`),
  window: ico(svg`<rect x="4" y="3" width="16" height="18" rx="1.5"></rect><path d="M12 3v18M4 12h8"></path><path d="m14 9 4-2v12l-4-2z"></path>`),
  radiator: ico(svg`<path d="M5 6v13M9.5 6v13M14 6v13M18.5 6v13M3 9h18M3 16h18"></path><path d="m3 3 18 18"></path>`),
  bell: ico(svg`<path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z"></path><path d="M10 21h4"></path>`),
  bin: ico(svg`<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14"></path><path d="M10 11v6M14 11v6"></path>`),
  check: ico(svg`<path d="m5 12.5 4.5 4.5L19 7.5"></path>`),
  washer: ico(svg`<rect x="4" y="3" width="16" height="18" rx="2"></rect><circle cx="12" cy="13" r="4.5"></circle><path d="M7.5 6.5h1.5M11.5 6.5h1"></path>`),
};

const ms = (t: string | undefined) => (t ? Date.parse(t) : NaN);
const ago = (t: string | undefined) => (t && Number.isFinite(Date.parse(t)) ? (Date.now() - Date.parse(t) < 60_000 ? "chwili" : since(t)) : "niedawna");
const age = (t: string | undefined) => (Date.now() - ms(t)) / 60000;

/** Wszystkie bieżące sprawy (bez filtra odłożonych), posortowane: pilność, potem najstarsze. */
export function attentionItems(ctx: Ctx, rooms: Room[]): Item[] {
  const h = ctx.hass, items: Item[] = [], seen = new Set<string>();
  // Profil Dziecko: swój pokój, poczta i odpady — bez bram i alertów.
  const child = isChild(ctx), mine = new Set(ctx.myAreas ?? []);
  // bramy, garaże, drzwi
  for (const id of child ? [] : gateIds(ctx)) {
    const c = h.states[id];
    if (!c || c.state !== "open" || age(c.last_changed) < GATE_MIN) continue;
    seen.add(id);
    items.push({ key: `cover:${id}:${c.last_changed}`, kind: "warn", icon: I.garage, title: entityName(h, id), sub: `otwarte od ${ago(c.last_changed)}`,
      at: ms(c.last_changed), action: { label: "Zamknij", run: () => ctx.actions.call("cover", "close_cover", { entity_id: id }) } });
  }
  // pokoje: otwarte okno przy grzaniu, głowica bez kontaktu
  for (const r of child ? rooms.filter((x) => mine.has(x.areaId)) : rooms) {
    const c = h.states[r.climate];
    if (windowOpen(h, r) && c && c.state !== "off") {
      const open = r.windows.filter((w) => st(ctx, w) === "on").map((w) => h.states[w]?.last_changed).sort()[0];
      if (age(open) >= WINDOW_MIN) {
        r.windows.forEach((w) => seen.add(w));
        items.push({ key: `win:${r.areaId}:${open}`, kind: "cold", icon: I.window, title: `${r.name}: otwarte okno`, sub: `od ${ago(open)} · grzanie wstrzymane`,
          at: ms(open), action: { label: "Pokój", run: () => ctx.actions.openRoom(r.areaId) } });
      }
    }
    const silent = silentHours(ctx, r);
    if (silent !== null)
      items.push({ key: `lost:${r.areaId}`, kind: "warn", icon: I.radiator, title: `${r.name}: głowica nie odpowiada`, sub: `brak kontaktu od ${Math.floor(silent)} h · ${lostAdvice(ctx, r)}`,
        at: Date.now() - silent * 3_600_000, action: { label: "Pokój", run: () => ctx.actions.openRoom(r.areaId) } });
  }
  // reguły z zakładki Alerty (bez encji już pokazanych wyżej)
  for (const a of child ? [] : activeAlerts(ctx)) {
    if (seen.has(a.entity)) continue;
    const s = h.states[a.entity];
    items.push({ key: `alert:${a.entity}:${a.message}`, kind: a.severity === "error" ? "crit" : a.severity === "warn" ? "warn" : "info", icon: I.bell,
      title: a.message, sub: `${valueText(h, a.entity)} · od ${ago(s?.last_changed)}`, at: ms(s?.last_changed),
      action: { label: "Szczegóły", run: () => ctx.actions.moreInfo(a.entity) } });
  }
  // odpady: wywóz dziś albo jutro
  for (const w of wasteRows(ctx)) {
    const t = toggleFor(ctx, w.name);
    if ((t && st(ctx, t) !== "on") || w.days === null || w.days > 1 || w.days < 0 || !w.date) continue;
    items.push({ key: `waste:${w.name}:${w.date.toDateString()}`, kind: "info", icon: I.bin, title: `Odpady: ${w.name} ${w.days === 1 ? "jutro" : "dziś"}`,
      sub: w.days === 1 ? "wystaw dziś wieczorem" : "wystaw rano", at: Date.now(), action: { label: "Wystawione", dismiss: true } });
  }
  // poczta
  const mail = ctx.opts.mailbox ? h.states[ctx.opts.mailbox] : undefined;
  if (mail?.state === "on")
    items.push({ key: `mail:${mail.last_changed}`, kind: "info", icon: mailIcon, title: "Poczta w skrzynce", sub: `od ${ago(mail.last_changed)}`, at: ms(mail.last_changed),
      action: { label: "Odebrane", dismiss: true } });
  // pranie / suszenie / zmywanie skończone: z historii — praca ≥ 10 min, koniec w ostatnich 6 h (stan po restarcie HA nie myli)
  for (const c of child ? [] : cycleSources(h, ctx.opts)) {
    const periods = ctx.hist.periods(h, c.id, (v) => c.running(String(v)));
    const last = periods[periods.length - 1];
    if (!last || c.running(st(ctx, c.id) ?? "")) continue;
    const [t0, t1] = last;
    if (Date.now() - t1 < 90_000 || t1 - t0 < 10 * 60_000 || Date.now() - t1 > 6 * 3_600_000) continue;
    items.push({ key: `agd:${c.id}:${Math.round(t1 / 60_000)}`, kind: "info", icon: I.washer, title: `${c.name}: ${c.what.toLowerCase()} skończone`,
      sub: `o ${ctx.clock.hm(t1)}${c.what === "Zmywanie" ? " · rozładuj" : c.what === "Pranie" || c.what === "Suszenie" ? " · wyjmij" : ""}`, at: t1,
      action: { label: "Wyjęte", dismiss: true } });
  }
  // przesyłki (dorośli — kody odbioru): czeka w punkcie, kurier wiezie dziś, problem z doręczeniem
  for (const s of child ? [] : shipments(h)) {
    const who = courierName(s.courier);
    const when = Date.now() - s.since < 60_000 ? "chwili" : since(s.since);
    // „Szczegóły” tylko gdy zakładka Zakupy jest dostępna (strona Przesyłki).
    const go = !ctx.tabs || ctx.tabs.includes("shopping") ? { label: "Szczegóły", run: () => ctx.actions.goTo("shopping", "przesylki") } : undefined;
    if (s.status === "waiting_for_pickup")
      items.push({ key: `ship:${s.number}:ready`, kind: "info", icon: parcelIcon, title: `Paczka do odbioru — ${who}`,
        sub: [s.location || DELIVERY[s.delivery] || "", s.code ? `kod ${s.code}` : "", `od ${when}`].filter(Boolean).join(" · "), at: s.since, action: go });
    else if (s.status === "handed_out_for_delivery")
      items.push({ key: `ship:${s.number}:out`, kind: "info", icon: parcelIcon, title: `Kurier w drodze — ${who}`,
        sub: [s.sender, s.code ? `PIN ${s.code}` : "", `wydana ${when === "chwili" ? "przed chwilą" : `${when} temu`}`].filter(Boolean).join(" · "), at: s.since, action: go });
    else if (s.status === "exception")
      items.push({ key: `ship:${s.number}:bad`, kind: "warn", icon: parcelIcon, title: `Problem z przesyłką — ${who}`,
        sub: [s.sender, `od ${when}`].filter(Boolean).join(" · "), at: s.since, action: go });
  }
  return items.sort((a, b) => RANK[a.kind] - RANK[b.kind] || (a.at || 0) - (b.at || 0));
}

function hidden(ctx: Ctx): Record<string, number> {
  try {
    return JSON.parse(ctx.ui.attn ?? "{}") ?? {};
  } catch {
    return {};
  }
}

/** Sprawy widoczne teraz (bez odłożonych i zrobionych) — też licznik na zakładce. */
export function visibleAttention(ctx: Ctx, rooms: Room[]): Item[] {
  const hide = hidden(ctx), now = Date.now();
  return attentionItems(ctx, rooms).filter((i) => !(hide[i.key] > now));
}

/** Odłóż albo schowaj sprawę; przy okazji czyści wpisy spraw, których już nie ma. */
function hide(ctx: Ctx, items: Item[], key: string, until: number) {
  const live = new Set(items.map((i) => i.key)), cur = hidden(ctx), next: Record<string, number> = {};
  for (const [k, v] of Object.entries(cur)) if (live.has(k) && v > Date.now()) next[k] = v;
  next[key] = until;
  ctx.actions.setUi("attn", JSON.stringify(next));
}

function tomorrow6(): number {
  const d = new Date();
  d.setDate(d.getDate() + (d.getHours() < 6 ? 0 : 1));
  d.setHours(6, 0, 0, 0);
  return d.getTime();
}

/** Przesunięcie palcem: w prawo = zrobione, w lewo = jutro (próg 90 px); przyciski w wierszu nie zaczynają gestu. */
function swipe(done: () => void, later: () => void) {
  let x0: number | null = null, dx = 0;
  const row = (e: Event) => e.currentTarget as HTMLElement;
  return {
    down: (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest("button")) return;
      x0 = e.clientX; dx = 0;
      row(e).setPointerCapture(e.pointerId);
    },
    move: (e: PointerEvent) => {
      if (x0 === null) return;
      dx = e.clientX - x0;
      const el = row(e);
      el.style.transform = `translateX(${dx}px)`;
      el.classList.toggle("go-done", dx > 90);
      el.classList.toggle("go-later", dx < -90);
    },
    up: (e: PointerEvent) => {
      if (x0 === null) return;
      const el = row(e);
      el.style.transform = "";
      el.classList.remove("go-done", "go-later");
      x0 = null;
      if (dx > 90) done();
      else if (dx < -90) later();
    },
  };
}

// „Wszystko ogarnięte”: lista właśnie opustoszała (ostatnia sprawa zamknięta) — iskra przez 1,5 s, nie przy zwykłym wejściu.
let lastCount = -1, clearedAt = 0;

export function attentionView(ctx: Ctx, rooms: Room[]): TemplateResult {
  const all = attentionItems(ctx, rooms), hide_ = hidden(ctx), now = Date.now();
  const items = all.filter((i) => !(hide_[i.key] > now));
  const snoozed = all.length - items.length;
  if (lastCount > 0 && items.length === 0) clearedAt = now;
  lastCount = items.length;
  const spark = now - clearedAt < 1500;
  return html`<section class="attn" aria-labelledby="attn-h">
    <div class="attn-h"><h2 id="attn-h">Wymaga uwagi</h2>${items.length ? html`<span class="n">${roll(String(items.length))}</span>` : nothing}
      ${items.length ? html`<span class="hint">przesuń: ← jutro · zrobione →</span>` : nothing}</div>
    ${items.length
      ? items.map((i) => {
          const done = () => hide(ctx, all, i.key, NEVER);
          const later = () => hide(ctx, all, i.key, tomorrow6());
          const g = swipe(done, later);
          return html`<div class="arow ${i.kind}" @pointerdown=${g.down} @pointermove=${g.move} @pointerup=${g.up} @pointercancel=${g.up}>
            <span class="aico">${i.icon}</span>
            <div><b>${i.title}</b><small>${i.sub}</small></div>
            <div class="aact">
              ${i.action ? html`<button class="btn hot" type="button" @click=${i.action.dismiss ? done : () => i.action?.run?.()}>${i.action.label}</button>` : nothing}
              <button class="btn later" type="button" title="Odłóż do jutra, 6:00" aria-label="Odłóż do jutra: ${i.title}" @click=${later}>Jutro</button>
            </div>
          </div>`;
        })
      : html`<div class="arow ok ${spark ? "cleared" : ""}"><span class="aico">${I.check}</span><div><b>${spark ? "Wszystko ogarnięte!" : "Wszystko w porządku"}</b><small>nic nie czeka na reakcję</small></div></div>`}
    ${snoozed
      ? html`<div class="attn-f">${snoozed === 1 ? "1 sprawa odłożona" : [2, 3, 4].includes(snoozed % 10) && ![12, 13, 14].includes(snoozed % 100) ? `${snoozed} sprawy odłożone` : `${snoozed} spraw odłożonych`}
          <button class="btn later" type="button" @click=${() => ctx.actions.setUi("attn", "{}")}>Pokaż</button></div>`
      : nothing}
  </section>`;
}
