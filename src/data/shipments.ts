// Przesyłki z integracji Polish Shipment Tracking (domena polish_shipment_tracking): jeden sensor na paczkę
// (stan = znormalizowany status), atrybuty kuriera (nadawca, punkt, kod odbioru), przyciski odświeżania,
// sensor zbiorczy z listą ignorowanych i usługi ignore_shipment / unignore_shipment / track_shipment.
// Doręczone, zwrócone i anulowane integracja usuwa — sensory to paczki w drodze.

import type { Hass } from "../types";

export const SHIP_DOMAIN = "polish_shipment_tracking";

export type ShipStatus =
  | "waiting_for_pickup" | "handed_out_for_delivery" | "exception" | "in_transport" | "created" | "unknown"
  | "delivered" | "returned" | "cancelled";

/** Status → [nazwa jak w aplikacjach kurierów, kolejność na liście (najpilniejsze najpierw)]. */
export const SHIP_STATUS: Record<ShipStatus, [string, number]> = {
  waiting_for_pickup: ["Gotowa do odbioru", 0],
  handed_out_for_delivery: ["Wydana do doręczenia", 1],
  exception: ["Problem z doręczeniem", 2],
  in_transport: ["W transporcie", 3],
  created: ["Nadana", 4],
  unknown: ["Status nieznany", 5],
  delivered: ["Doręczona", 6],
  returned: ["Zwrócona do nadawcy", 7],
  cancelled: ["Anulowana", 8],
};

export const COURIER: Record<string, string> = {
  inpost: "InPost", dpd: "DPD", gls: "GLS", dhl: "DHL", orlen: "ORLEN Paczka", pocztex: "Pocztex", allegro: "Allegro", ups: "UPS",
};

export const DELIVERY: Record<string, string> = { parcel_locker: "paczkomat", pickup_point: "punkt odbioru", home: "do domu" };

export interface Shipment {
  entity: string;
  number: string;
  courier: string;
  status: ShipStatus;
  sender: string;
  delivery: string;
  location: string;
  /** Kod otwarcia skrytki (InPost, gdy paczka czeka) albo PIN odbioru (GLS) — tylko dla dorosłych. */
  code: string;
  since: number;
  /** Przycisk odświeżenia tej przesyłki. */
  refresh?: string;
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "");

/** Czy integracja jest zainstalowana (są jej encje), nawet gdy nic nie jest w drodze. */
export const hasShipments = (hass: Hass) => Object.values(hass.entities).some((e) => e.platform === SHIP_DOMAIN);

export function shipments(hass: Hass): Shipment[] {
  const refresh = new Map<string, string>();
  for (const e of Object.values(hass.entities)) {
    if (e.platform !== SHIP_DOMAIN || !e.entity_id.startsWith("button.")) continue;
    const n = str(hass.states[e.entity_id]?.attributes.tracking_number);
    if (n) refresh.set(n, e.entity_id);
  }
  const out: Shipment[] = [];
  for (const e of Object.values(hass.entities)) {
    if (e.platform !== SHIP_DOMAIN || !e.entity_id.startsWith("sensor.")) continue;
    const s = hass.states[e.entity_id];
    const a = s?.attributes;
    const number = str(a?.tracking_number);
    if (!s || !number) continue; // sensor zbiorczy (liczba aktywnych) nie ma numeru
    const status = (s.state in SHIP_STATUS ? s.state : "unknown") as ShipStatus;
    const at = Date.parse(str(a.state_date)) || Date.parse(s.last_changed);
    out.push({
      entity: e.entity_id,
      number,
      courier: str(a.courier),
      status,
      sender: str(a.sender) || str(a.sender_name),
      delivery: str(a.delivery_type),
      location: str(a.location),
      code: str(a.open_code) || str(a.pin),
      since: Number.isFinite(at) ? at : Date.now(),
      refresh: refresh.get(number),
    });
  }
  return out.sort((x, y) => SHIP_STATUS[x.status][1] - SHIP_STATUS[y.status][1] || y.since - x.since);
}

/** Przyciski „odśwież wszystkie przesyłki” kont (refresh_scope inny niż jedna przesyłka). */
export function refreshAllButtons(hass: Hass): string[] {
  return Object.values(hass.entities)
    .filter((e) => e.platform === SHIP_DOMAIN && e.entity_id.startsWith("button.") && !str(hass.states[e.entity_id]?.attributes.tracking_number))
    .map((e) => e.entity_id);
}

/** Numery ukryte (atrybut ignored_shipments sensora zbiorczego). */
export function ignoredShipments(hass: Hass): string[] {
  for (const e of Object.values(hass.entities)) {
    if (e.platform !== SHIP_DOMAIN || !e.entity_id.startsWith("sensor.")) continue;
    const list = hass.states[e.entity_id]?.attributes.ignored_shipments;
    if (Array.isArray(list)) return list.map((x) => str(typeof x === "object" && x ? (x as Record<string, unknown>).tracking_number : x)).filter(Boolean);
  }
  return [];
}

export const courierName = (c: string) => COURIER[c] ?? (c ? c.charAt(0).toUpperCase() + c.slice(1) : "Przesyłka");
