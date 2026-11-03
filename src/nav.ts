// Nawigacja w sekcjach: 16 dawnych zakładek w 8 sekcjach (adresy /hearth/<zakładka> bez zmian — dawna zakładka
// to podzakładka sekcji). Desktop: kolumna sekcji po lewej; telefon: dolny pasek (4 sekcje + Więcej).
// Zakładka może mieć strony (/hearth/<zakładka>/<strona>) — kolejne podzakładki bez nowej opcji w integracji.

import { html, svg, type TemplateResult } from "lit";
import type { Tab } from "./types";

/** Strona wewnątrz zakładki: admin = tylko administrator HA, needs = pokazywana, gdy są dane (sprawdza panel). */
export interface Page {
  id: string;
  label: string;
  admin?: boolean;
  needs?: "ebusd" | "gas";
}

export interface Section {
  id: string;
  label: string;
  icon: TemplateResult;
  tabs: Tab[];
  /** Nazwy podzakładek (gdy sekcja ma więcej niż jedną). */
  sub: Partial<Record<Tab, string>>;
  /** Strony zakładek, w pasku podzakładek zaraz po swojej zakładce. */
  pages?: Partial<Record<Tab, Page[]>>;
}

const ico = (d: ReturnType<typeof svg>) => html`<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8"
  stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;

export const NAV_ICONS = {
  home: ico(svg`<path d="M3 11 12 4l9 7"></path><path d="M5.5 9.5V20h13V9.5"></path><path d="M10 20v-5h4v5"></path>`),
  cart: ico(svg`<path d="M3 4h2.5l2.2 11h10.6L21 7.5H6.4"></path><circle cx="9.5" cy="19" r="1.4"></circle><circle cx="17" cy="19" r="1.4"></circle>`),
  flame: ico(svg`<path d="M12 21c-3.9 0-6.5-2.6-6.5-6.2 0-3.4 2.6-5.4 3.8-8.8.9 1.6 1.4 2.8 1.4 4.3 1.5-.9 2.4-2.6 2.4-5.3 2.9 2.4 5.4 5.8 5.4 9.8 0 3.6-2.6 6.2-6.5 6.2Z"></path>`),
  plug: ico(svg`<rect x="4.5" y="3" width="15" height="18" rx="2.5"></rect><circle cx="12" cy="13" r="4.2"></circle><path d="M8 6.5h1.5M12 6.5h1"></path>`),
  camera: ico(svg`<rect x="3" y="7" width="12" height="10" rx="2"></rect><path d="m15 10.5 6-3.5v10l-6-3.5z"></path>`),
  bolt: ico(svg`<path d="M13 2.5 5 13.5h6l-1 8 8-11h-6z"></path>`),
  heart: ico(svg`<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.2C19.5 15.4 12 20 12 20Z"></path><path d="M6.5 12.5h3l1.5-2.5 2 4 1.5-1.5h3"></path>`),
  server: ico(svg`<rect x="4" y="4" width="16" height="7" rx="1.5"></rect><rect x="4" y="13" width="16" height="7" rx="1.5"></rect><path d="M7.5 7.5h.01M7.5 16.5h.01M11 7.5h5M11 16.5h5"></path>`),
  more: ico(svg`<circle cx="5.5" cy="12" r="1.3"></circle><circle cx="12" cy="12" r="1.3"></circle><circle cx="18.5" cy="12" r="1.3"></circle>`),
  chat: ico(svg`<path d="M5 5h14a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 19 16h-7l-4.5 3.5V16H5a1.5 1.5 0 0 1-1.5-1.5v-8A1.5 1.5 0 0 1 5 5Z"></path><path d="M8 10.5h8"></path>`),
};

export const SECTIONS: Section[] = [
  { id: "teraz", label: "Teraz", icon: NAV_ICONS.home, tabs: ["home", "alerts"], sub: { home: "Teraz", alerts: "Alerty" } },
  { id: "zakupy", label: "Zakupy", icon: NAV_ICONS.cart, tabs: ["shopping"], sub: {} },
  { id: "cieplo", label: "Ciepło", icon: NAV_ICONS.flame, tabs: ["climate", "boiler"], sub: { climate: "Pokoje", boiler: "Kocioł i ciepła woda" },
    pages: { boiler: [{ id: "program", label: "Program tygodnia", admin: true, needs: "ebusd" }, { id: "serwis", label: "Serwis", admin: true }] } },
  { id: "urzadzenia", label: "Urządzenia", icon: NAV_ICONS.plug, tabs: ["appliances", "switches", "cars", "robots"],
    sub: { appliances: "AGD", switches: "Światła i gniazdka", cars: "Auta", robots: "Roboty" } },
  { id: "kamery", label: "Kamery", icon: NAV_ICONS.camera, tabs: ["cameras"], sub: {} },
  { id: "zuzycie", label: "Zużycie", icon: NAV_ICONS.bolt, tabs: ["energy", "meters"], sub: { energy: "Prąd", meters: "Liczniki" },
    pages: { energy: [{ id: "gaz", label: "Gaz", needs: "gas" }] } },
  { id: "zdrowie", label: "Moje zdrowie", icon: NAV_ICONS.heart, tabs: ["health"], sub: {} },
  { id: "technika", label: "Technika", icon: NAV_ICONS.server, tabs: ["proxmox", "network"], sub: { proxmox: "Serwer", network: "Sieć" } },
];

/** Zakładki tylko dla administratora HA (sekcja Technika) — ukryte także pod starym adresem. */
export const ADMIN_TABS: Tab[] = ["proxmox", "network"];

/** Sekcje w dolnym pasku telefonu (reszta pod „Więcej”). */
export const PHONE_BAR = ["teraz", "zakupy", "cieplo", "urzadzenia"];

/** Sekcje z włączonymi zakładkami (kolejność sekcji stała, zakładki w kolejności sekcji). */
export function sectionsFor(tabs: Tab[]): Section[] {
  return SECTIONS.map((s) => ({ ...s, tabs: s.tabs.filter((t) => tabs.includes(t)) })).filter((s) => s.tabs.length);
}

/** Pozycje paska podzakładek: zakładka, po niej jej strony (page = undefined to strona główna zakładki). */
export function subLinks(s: Section, ok: (t: Tab, p: Page) => boolean): Array<{ tab: Tab; page?: Page }> {
  return s.tabs.flatMap((tab) => [{ tab }, ...(s.pages?.[tab] ?? []).filter((p) => ok(tab, p)).map((page) => ({ tab, page }))]);
}
