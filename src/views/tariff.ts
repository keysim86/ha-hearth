// Plan stref taryfy: pasek doby z kreską „teraz”, odpowiedź „od kiedy taniej” i porównanie taryf.
// Dwa źródła (opcja „tariff” = encja strefy):
//  • integracja Taryfy prądu (taryfy_pradu): atrybuty plan_godzinowy_dzis/_jutro (id strefy na każdą
//    godzinę), ceny_dzis/_jutro {id: zł/kWh}, plan_dzis [{strefa, nazwa, …}] — dowolna taryfa (G11 … G14dynamic);
//  • stary pakiet YAML: plan_dzis/plan_jutro = 24 znaki n/p/s, ceny_dzis/ceny_jutro {n, p, s}.
// Bez atrybutów — nic (zostaje sama nazwa strefy).

import { html, nothing, type TemplateResult } from "lit";
import type { Ctx } from "./common";

type Z = "n" | "p" | "s";
const ZONE: Record<Z, [string, string]> = { n: ["noc", "var(--bath)"], p: ["poza szczytem", "var(--air)"], s: ["szczyt", "var(--ember)"] };
const ORDER: Z[] = ["n", "p", "s"];
// kolory stref od najtańszej do najdroższej (2, 3 albo 4 strefy)
const PALETA: Record<number, string[]> = {
  1: ["var(--air)"],
  2: ["var(--bath)", "var(--ember)"],
  3: ["var(--bath)", "var(--air)", "var(--ember)"],
  4: ["var(--bath)", "var(--air)", "#d08a2a", "var(--ember)"],
};

/** Strefa z nazwy źródła energii („… nocna”, „… pozaszczytowa”, „… szczytowa”, G12 „dzienna”) albo null. */
export function zoneOfName(name: string): Z | null {
  const n = name.toLowerCase();
  if (/noc|night/.test(n)) return "n";
  if (/poza|off.?peak/.test(n)) return "p";
  if (/szczyt|dzien|peak/.test(n)) return "s";
  return null;
}

/** Kolor strefy — ten sam na pasku stref i na wykresach zużycia. */
export const zoneColor = (z: Z): string => ZONE[z][1];

/** Kolejność stref na wykresach: noc, poza szczytem, szczyt (jak legenda paska), nieznane na końcu. */
export const zoneRank = (name: string): number => {
  const z = zoneOfName(name);
  return z ? ORDER.indexOf(z) : ORDER.length;
};

export interface TariffPlan {
  today: string[];
  tomorrow: string[] | null;
  prices: Record<string, number>;
  pricesTomorrow: Record<string, number> | null;
  /** Nazwy i kolory stref (id strefy -> …), kolejność od najtańszej. */
  names: Record<string, string>;
  colors: Record<string, string>;
  order: string[];
  hour: number;
  minute: number;
}

const legacyZones = (v: unknown): string[] | null => (typeof v === "string" && /^[nps]{24}$/.test(v) ? v.split("") : null);
const legacyPrices = (v: unknown): Record<string, number> | null => {
  const o = v as Record<string, unknown> | null;
  return o && ["n", "p", "s"].every((k) => typeof o[k] === "number") ? (o as Record<string, number>) : null;
};
const idList = (v: unknown): string[] | null =>
  Array.isArray(v) && v.length >= 23 && v.length <= 25 && v.every((x) => typeof x === "string") ? (v as string[]) : null;
const priceMap = (v: unknown, ids: string[]): Record<string, number> | null => {
  const o = v as Record<string, unknown> | null;
  if (!o || typeof o !== "object") return null;
  const out: Record<string, number> = {};
  for (const id of new Set(ids)) {
    if (typeof o[id] !== "number") return null;
    out[id] = o[id] as number;
  }
  return out;
};

/** Encja integracji Taryfy prądu z tego samego urządzenia (punktu poboru) co `id`, po translation_key. */
export function sibling(ctx: Ctx, id: string | null | undefined, key: string): string | undefined {
  const reg = id ? ctx.hass.entities?.[id] : undefined;
  if (!reg?.device_id || reg.platform !== "taryfy_pradu") return undefined;
  return Object.values(ctx.hass.entities).find((e) => e.device_id === reg.device_id && e.translation_key === key)?.entity_id;
}

export function tariffPlan(ctx: Ctx): TariffPlan | null {
  const a = ctx.opts.tariff ? ctx.hass.states[ctx.opts.tariff]?.attributes : undefined;
  if (!a) return null;
  const hour = Math.floor(ctx.nowMinute / 60), minute = ctx.nowMinute % 60;
  // integracja Taryfy prądu
  const today = idList(a.plan_godzinowy_dzis);
  if (today) {
    const prices = priceMap(a.ceny_dzis, today);
    if (!prices) return null;
    const tomorrow = idList(a.plan_godzinowy_jutro);
    const pricesTomorrow = tomorrow ? priceMap(a.ceny_jutro, tomorrow) : null;
    const names: Record<string, string> = {};
    for (const p of [...((a.plan_dzis as { strefa: string; nazwa: string }[]) ?? []), ...((a.plan_jutro as { strefa: string; nazwa: string }[]) ?? [])])
      if (p?.strefa && p.nazwa) names[p.strefa] = p.nazwa.toLowerCase();
    const all = { ...(pricesTomorrow ?? {}), ...prices };
    const order = Object.keys(all).sort((x, y) => all[x] - all[y]);
    const pal = PALETA[Math.min(order.length, 4)] ?? PALETA[4];
    const colors = Object.fromEntries(order.map((z, i) => [z, pal[Math.min(i, pal.length - 1)]]));
    for (const z of order) names[z] ??= z;
    return { today, tomorrow: pricesTomorrow ? tomorrow : null, prices, pricesTomorrow, names, colors, order, hour, minute };
  }
  // stary pakiet (n/p/s)
  const legacy = legacyZones(a.plan_dzis), p = legacyPrices(a.ceny_dzis);
  if (!legacy || !p) return null;
  const tomorrow = legacyZones(a.plan_jutro);
  return {
    today: legacy, tomorrow, prices: p, pricesTomorrow: legacyPrices(a.ceny_jutro),
    names: { n: ZONE.n[0], p: ZONE.p[0], s: ZONE.s[0] }, colors: { n: ZONE.n[1], p: ZONE.p[1], s: ZONE.s[1] },
    order: [...ORDER], hour, minute,
  };
}

/** Najbliższa pełna godzina (dziś albo jutro), od której prąd jest tańszy niż teraz. */
export function cheaperFrom(t: TariffPlan): { hour: number; tomorrow: boolean; zone: string; price: number } | null {
  const now = t.prices[t.today[t.hour]];
  for (let h = t.hour + 1; h < t.today.length; h++) if (t.prices[t.today[h]] < now - 1e-6) return { hour: h, tomorrow: false, zone: t.today[h], price: t.prices[t.today[h]] };
  if (t.tomorrow && t.pricesTomorrow)
    for (let h = 0; h <= Math.min(t.hour, t.tomorrow.length - 1); h++)
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
  const cur = t.today[Math.min(t.hour, t.today.length - 1)], c = cheaperFrom(t);
  const n = t.today.length;
  const pos = ((t.hour + t.minute / 60) / n) * 100;
  const legend = t.order.filter((z) => t.today.includes(z));
  return html`<div class="ocell tplan">
    <span class="hlabel">Strefy dziś</span>
    <div class="tnext">Teraz <b style="color:${t.colors[cur]}">${t.names[cur]}</b> · ${zl(t.prices[cur])} zł/kWh${c
      ? html` · <b class="cheaper">taniej ${c.tomorrow ? "jutro " : ""}od ${c.hour}:00</b> (${t.names[c.zone]}, ${zl(c.price)} zł)`
      : html` · <b class="cheaper">najtańsza strefa</b>`}</div>
    <div class="tbar" style="grid-template-columns:repeat(${n},1fr)" role="img" aria-label="Strefy taryfy godzina po godzinie: ${t.today.map((z, h) => `${h}: ${t.names[z]}`).join(", ")}">
      ${t.today.map((z, h) => html`<i class=${h < t.hour ? "past" : ""} style="--c:${t.colors[z]}" title="${h}:00–${h + 1}:00 · ${t.names[z]} · ${zl(t.prices[z])} zł/kWh"></i>`)}
      <span class="tnow" style="left:calc(${pos.toFixed(2)}% - 1.5px)"></span>
    </div>
    <div class="taxis"><span>0</span><span>6</span><span>12</span><span>18</span><span>24</span></div>
    <div class="tleg">${legend.map((z) => html`<span><i style="--c:${t.colors[z]}"></i>${t.names[z]} ${zl(t.prices[z])} zł</span>`)}</div>
  </div>`;
}

// --- porównanie taryf (integracja Taryfy prądu) ------------------------------------------------

interface Pozycja { nazwa: string; obecna: boolean; razem: number; energia: number; stale: number; kwh: number }
interface Okres { dni: number; od: string; do: string; koszty: Pozycja[]; najtanszy?: string; oszczednosc_zl?: number; oszczednosc_proc?: number; oplaca_sie?: boolean }

const okresy: [string, string][] = [["30_dni", "Ostatnie 30 dni"], ["rok", "Ostatnie 12 miesięcy"]];

/** Karta „Porównanie taryf” z encji „Najtańsza taryfa” punktu poboru (gdy strefa pochodzi z integracji). */
export function tariffCompare(ctx: Ctx): TemplateResult | typeof nothing {
  const id = sibling(ctx, ctx.opts.tariff, "najtansza_taryfa");
  const a = id ? ctx.hass.states[id]?.attributes : undefined;
  const dane = okresy.map(([k, t]) => [t, a?.[k] as Okres | undefined] as const).filter(([, o]) => o?.koszty?.length);
  if (!dane.length) return nothing;
  const rek = a?.rekomendacja as string | undefined;
  const opl = (dane[0][1] as Okres).oplaca_sie;
  return html`<div class="ocell tcomp">
    <span class="hlabel">Porównanie taryf <small>na Twoim zużyciu · bez opłaty handlowej</small></span>
    ${rek ? html`<div class="tnext">${opl ? html`<b class="cheaper">${rek}</b>` : rek}</div>` : nothing}
    <div class="cards two">
      ${dane.map(([tytul, o]) => {
        const ok = o as Okres;
        const ob = ok.koszty.find((p) => p.obecna);
        return html`<div>
          <span class="hsub">${tytul} · ${ok.dni} dni · ${Math.round(ok.koszty[0].kwh)} kWh</span>
          <table class="ttab">
            ${ok.koszty.map((p, i) => {
              const roz = ob ? p.razem - ob.razem : 0;
              return html`<tr class=${p.obecna ? "cur" : i === 0 ? "best" : ""}>
                <td>${p.nazwa}</td>
                <td class="num">${zl(p.razem)} zł</td>
                <td class="num ${roz < -0.005 ? "minus" : roz > 0.005 ? "plus" : ""}">${p.obecna ? "obecna" : `${roz > 0 ? "+" : ""}${zl(roz)}`}</td>
              </tr>`;
            })}
          </table>
        </div>`;
      })}
    </div>
  </div>`;
}
