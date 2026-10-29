// Karta „Zakupy” na zakładce Dom: lista z Bring! (encje todo.* integracji bring) w wyglądzie aplikacji Bring! —
// kafelki z ikonami produktów pogrupowane działami, kliknięcie = kupione, „ostatnio kupione” wracają jednym kliknięciem,
// pole „Dodaj” („Mleko, 2 l” = nazwa i opis) i katalog działów Bring!.

import { html, nothing, type TemplateResult } from "lit";
import {
  bringCatalog, catalogItem, iconUrl, isPending, markPending, parseEntry, sameName, shopItems,
  type Catalog, type ShopItem,
} from "../data/shopping";
import { since, st, type Ctx } from "./common";

const OWN = "Własne produkty";
const RECENT_LIMIT = 12;

/** Listy Bring! w HA: encje todo.* z platformy „bring”, alfabetycznie. */
function bringLists(ctx: Ctx): string[] {
  return Object.values(ctx.hass.entities)
    .filter((e) => e.platform === "bring" && e.entity_id.startsWith("todo.") && !e.hidden && ctx.hass.states[e.entity_id])
    .map((e) => e.entity_id)
    .sort((a, b) => listName(ctx, a).localeCompare(listName(ctx, b), "pl"));
}

const listName = (ctx: Ctx, id: string) => String(ctx.hass.states[id]?.attributes.friendly_name ?? id.slice(5));

/** Encja z tego samego urządzenia listy (np. aktywności, język listy). */
function sibling(ctx: Ctx, list: string, key: string): string | undefined {
  const dev = ctx.hass.entities[list]?.device_id;
  return dev ? Object.values(ctx.hass.entities).find((e) => e.device_id === dev && e.translation_key === key)?.entity_id : undefined;
}

/** Język katalogu z czujnika języka listy („pl-pl” → „pl-PL”), domyślnie polski. */
function locale(ctx: Ctx, list: string): string {
  const v = st(ctx, sibling(ctx, list, "list_language")) ?? "";
  const m = /^([a-z]{2})-([a-z]{2})$/i.exec(v);
  return m ? `${m[1].toLowerCase()}-${m[2].toUpperCase()}` : "pl-PL";
}

const bagIcon = html`<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"
  d="M5 8h14l-1.2 12.2a1 1 0 0 1-1 .8H7.2a1 1 0 0 1-1-.8L5 8Zm4 0V6.5a3 3 0 0 1 6 0V8"></path></svg>`;

function tile(ctx: Ctx, list: string, cat: Catalog | null, it: ShopItem): TemplateResult {
  const c = catalogItem(cat, it.summary);
  const done = it.status === "completed";
  const go = () => {
    markPending(list, it.uid);
    ctx.refresh();
    ctx.actions.call("todo", "update_item", { entity_id: list, item: it.uid, status: done ? "needs_action" : "completed" });
  };
  return html`<button type="button" class="stile ${done ? "done" : ""} ${isPending(list, it.uid) ? "pend" : ""}"
      aria-label="${it.summary}${it.description ? `, ${it.description}` : ""}: ${done ? "wróć na listę" : "kupione"}" @click=${go}>
    ${c ? html`<img alt="" src=${iconUrl(c.key)} @error=${(e: Event) => ((e.target as HTMLElement).hidden = true)} />`
      : html`<span class="sl" aria-hidden="true">${it.summary.charAt(0).toLocaleUpperCase("pl-PL")}</span>`}
    <b>${it.summary}</b>
    ${it.description ? html`<small>${it.description}</small>` : nothing}
  </button>`;
}

/** Pozycje do kupienia w działach katalogu (kolejność działów jak w Bring!), na końcu własne produkty. */
function bySection(cat: Catalog | null, items: ShopItem[]): Array<[string, ShopItem[]]> {
  const groups = new Map<string, ShopItem[]>();
  for (const s of cat?.sections ?? []) groups.set(s, []);
  for (const it of items) {
    const s = catalogItem(cat, it.summary)?.section ?? OWN;
    if (!groups.has(s)) groups.set(s, []);
    groups.get(s)!.push(it);
  }
  return [...groups].filter(([, v]) => v.length);
}

function add(ctx: Ctx, list: string, items: ShopItem[], text: string) {
  const { name, spec } = parseEntry(text);
  if (!name) return;
  const open = items.find((i) => i.status === "needs_action" && sameName(i.summary, name));
  if (open && !spec) return ctx.actions.toast(`${open.summary} już jest na liście`);
  const known = open ?? items.find((i) => sameName(i.summary, name));
  if (known)
    ctx.actions.call("todo", "update_item", {
      entity_id: list, item: known.uid, status: "needs_action", ...(spec ? { description: spec } : {}),
    });
  else ctx.actions.call("todo", "add_item", { entity_id: list, item: name, ...(spec ? { description: spec } : {}) });
}

function catalogBrowser(ctx: Ctx, list: string, cat: Catalog, items: ShopItem[]): TemplateResult {
  const dzial = cat.sections.includes(ctx.ui["zakupy.dzial"]) ? ctx.ui["zakupy.dzial"] : cat.sections[0];
  const onList = (name: string) => items.find((i) => i.status === "needs_action" && sameName(i.summary, name));
  return html`<div class="shopcat">
    <div class="shopchips" role="group" aria-label="Dział katalogu">${cat.sections.map((s) => html`<button type="button"
      class="tag pick ${s === dzial ? "on" : ""}" aria-pressed=${s === dzial ? "true" : "false"}
      @click=${() => ctx.actions.setUi("zakupy.dzial", s)}>${s}</button>`)}</div>
    <div class="stiles">${cat.items.filter((i) => i.section === dzial).map((i) => {
      const it = onList(i.name);
      return html`<button type="button" class="stile cat ${it ? "" : "off"}" aria-pressed=${it ? "true" : "false"}
          aria-label="${i.name}: ${it ? "usuń z listy" : "dodaj do listy"}"
          @click=${() => (it ? ctx.actions.call("todo", "update_item", { entity_id: list, item: it.uid, status: "completed" }) : add(ctx, list, items, i.name))}>
        <img alt="" loading="lazy" src=${iconUrl(i.key)} @error=${(e: Event) => ((e.target as HTMLElement).hidden = true)} />
        <b>${i.name}</b>
      </button>`;
    })}</div>
  </div>`;
}

export function shopping(ctx: Ctx): TemplateResult | typeof nothing {
  const lists = bringLists(ctx);
  if (!lists.length) return nothing;
  const list = lists.includes(ctx.ui["zakupy.lista"]) ? ctx.ui["zakupy.lista"] : lists[0];
  const items = shopItems(ctx.hass, list, ctx.refresh);
  const cat = bringCatalog(ctx.hass, locale(ctx, list), ctx.refresh);
  const todo = (items ?? []).filter((i) => i.status === "needs_action");
  const done = (items ?? []).filter((i) => i.status === "completed");
  const all = ctx.ui["zakupy.wszystkie"] === "1";
  const akt = sibling(ctx, list, "activities");
  const kto = akt ? ctx.hass.states[akt]?.attributes.last_activity_by : undefined;
  const kiedy = akt ? st(ctx, akt) : undefined;
  const katalog = ctx.ui["zakupy.katalog"] === "1" && cat;
  const podpowiedzi = [...new Set([...done.map((i) => i.summary), ...(cat?.items.map((i) => i.name) ?? [])])];
  return html`<section class="sec">
    <div class="shop">
      <div class="shophead">
        <span class="shopmark"><i>${bagIcon}</i>Zakupy</span>
        ${lists.length > 1 ? html`<span class="shopsw" role="group" aria-label="Lista Bring!">${lists.map((x) => html`<button type="button"
          class=${x === list ? "on" : ""} aria-pressed=${x === list ? "true" : "false"}
          @click=${() => ctx.actions.setUi("zakupy.lista", x)}>${listName(ctx, x)}</button>`)}</span>` : nothing}
        <span class="shopmeta">${items === null ? "wczytuję…" : todo.length ? `${todo.length} do kupienia` : "lista pusta"}${
          kto && kiedy && Date.parse(kiedy) ? ` · ostatnia zmiana: ${kto}, ${since(kiedy)} temu` : ""}</span>
      </div>
      <form class="shopadd" @submit=${(e: Event) => {
        e.preventDefault();
        const inp = (e.target as HTMLFormElement).elements.namedItem("produkt") as HTMLInputElement;
        add(ctx, list, items ?? [], inp.value);
        inp.value = "";
      }}>
        <input name="produkt" type="text" autocomplete="off" enterkeyhint="done" list="zakupy-podpowiedzi"
          placeholder="Dodaj produkt…" title="Po przecinku opis, np. Mleko, 2 l" aria-label="Dodaj produkt (po przecinku opis, np. Mleko, 2 l)" />
        <datalist id="zakupy-podpowiedzi">${podpowiedzi.map((p) => html`<option value=${p}></option>`)}</datalist>
        <button class="btn hot" type="submit">Dodaj</button>
        ${cat ? html`<button class="btn ${katalog ? "hot" : ""}" type="button" aria-expanded=${katalog ? "true" : "false"}
          @click=${() => ctx.actions.setUi("zakupy.katalog", katalog ? "" : "1")}>Katalog</button>` : nothing}
      </form>
      ${todo.length
        ? bySection(cat, todo).map(([s, its]) => html`<div class="shopsec">
            ${cat ? html`<h4>${s}</h4>` : nothing}
            <div class="stiles">${its.map((it) => tile(ctx, list, cat, it))}</div>
          </div>`)
        : items !== null ? html`<div class="empty">Nic do kupienia — dodaj produkt albo wybierz z ostatnio kupionych.</div>` : nothing}
      ${done.length ? html`<div class="shopsec">
          <h4>Ostatnio kupione</h4>
          <div class="stiles small">${(all ? done : done.slice(0, RECENT_LIMIT)).map((it) => tile(ctx, list, cat, it))}</div>
          ${done.length > RECENT_LIMIT ? html`<button class="btn shopmore" type="button"
            @click=${() => ctx.actions.setUi("zakupy.wszystkie", all ? "" : "1")}>${all ? "Pokaż mniej" : `Pokaż wszystkie (${done.length})`}</button>` : nothing}
        </div>` : nothing}
      ${katalog ? catalogBrowser(ctx, list, cat, items ?? []) : nothing}
    </div>
  </section>`;
}
