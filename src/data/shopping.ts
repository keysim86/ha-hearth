// Lista zakupów z Bring! (integracja HA „bring”, encje todo.*): pozycje na żywo z subskrypcji
// todo/item/subscribe, katalog produktów (działy, ikony) przez Hearth (/api/hearth/bring_catalog/<język>),
// bo serwer Bring! nie wpuszcza zapytań z innej strony (CORS).

import type { Hass } from "../types";

export interface ShopItem {
  uid: string;
  summary: string;
  description?: string | null;
  /** needs_action = do kupienia, completed = w Bring! „ostatnio używane”. */
  status: "needs_action" | "completed";
}

export interface CatalogItem {
  /** Klucz produktu w Bring! (niemiecka nazwa) — z niego nazwa pliku ikony. */
  key: string;
  name: string;
  section: string;
}

export interface Catalog {
  sections: string[];
  items: CatalogItem[];
  byName: Map<string, CatalogItem>;
}

interface Conn {
  subscribeMessage<T>(cb: (msg: T) => void, msg: Record<string, unknown>): Promise<() => void>;
}
type HassLive = Hass & {
  connection?: Conn;
  callApi?<T>(method: "GET" | "POST", path: string): Promise<T>;
};

interface ListState {
  items: ShopItem[] | null;
  /** Pozycje kliknięte, a jeszcze niepotwierdzone przez Bring! (wygaszone na kafelku). */
  pending: Set<string>;
  started: boolean;
}

const lists = new Map<string, ListState>();

function listState(entity: string): ListState {
  let s = lists.get(entity);
  if (!s) lists.set(entity, (s = { items: null, pending: new Set(), started: false }));
  return s;
}

/** Pozycje listy (null = jeszcze się ładują). Pierwsze wywołanie zakłada subskrypcję na cały czas życia panelu
 *  (biblioteka WebSocket HA sama odnawia ją po zerwaniu połączenia). */
export function shopItems(hass: Hass, entity: string, changed: () => void): ShopItem[] | null {
  const s = listState(entity);
  if (!s.started) {
    s.started = true;
    const live = hass as HassLive;
    const apply = (items: ShopItem[]) => {
      s.items = items;
      s.pending.clear();
      changed();
    };
    if (live.connection)
      live.connection
        .subscribeMessage<{ items: ShopItem[] }>((m) => apply(m.items ?? []), { type: "todo/item/subscribe", entity_id: entity })
        .catch(() => (s.started = false));
    else
      hass
        .callWS<{ items: ShopItem[] }>({ type: "todo/item/list", entity_id: entity })
        .then((r) => apply(r.items ?? []))
        .catch(() => (s.started = false));
  }
  return s.items;
}

export const isPending = (entity: string, uid: string) => listState(entity).pending.has(uid);
export const markPending = (entity: string, uid: string) => listState(entity).pending.add(uid);

// ---- katalog Bring! ----

let catalog: Catalog | null = null;
let catalogLocale = "";

/** Nazwa pliku ikony z klucza produktu: „Äpfel” → aepfel, „Crème fraîche” → creme_fraiche, „Pop Corn” → pop_corn. */
export function iconKey(key: string): string {
  return key
    .toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

export const iconUrl = (key: string) => `https://web.getbring.com/assets/images/items/${iconKey(key)}.png`;

const norm = (s: string) => s.trim().toLocaleLowerCase("pl-PL");

/** Katalog produktów w języku listy (null = ładuje się albo niedostępny — karta działa wtedy bez ikon i działów). */
export function bringCatalog(hass: Hass, locale: string, changed: () => void): Catalog | null {
  if (catalogLocale === locale) return catalog;
  catalogLocale = locale;
  catalog = null;
  const live = hass as HassLive;
  live
    .callApi?.<{ sections: Array<{ name: string; items: Array<{ key: string; name: string }> }> }>("GET", `hearth/bring_catalog/${locale}`)
    .then((raw) => {
      const items = raw.sections.flatMap((s) => s.items.map((i) => ({ ...i, section: s.name })));
      const byName = new Map<string, CatalogItem>();
      for (const i of items) {
        byName.set(norm(i.name), i);
        if (!byName.has(norm(i.key))) byName.set(norm(i.key), i);
      }
      if (catalogLocale === locale) catalog = { sections: raw.sections.map((s) => s.name), items, byName };
      changed();
    })
    .catch(() => undefined);
  return null;
}

export const catalogItem = (cat: Catalog | null, name: string) => cat?.byName.get(norm(name)) ?? null;

/** „Mleko, 2 l” → nazwa „Mleko”, opis „2 l”. */
export function parseEntry(text: string): { name: string; spec: string } {
  const i = text.indexOf(",");
  const name = (i < 0 ? text : text.slice(0, i)).trim();
  return { name: name.charAt(0).toLocaleUpperCase("pl-PL") + name.slice(1), spec: i < 0 ? "" : text.slice(i + 1).trim() };
}

export const sameName = (a: string, b: string) => norm(a) === norm(b);
