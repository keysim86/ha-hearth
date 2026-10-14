// Pokoje z obszarów HA: każdy obszar z termostatem (climate.*) to pokój.
// Reszta (termometr, wilgotność, okna, osuszacze, wentylatory) jest dobierana po obszarze i klasie urządzenia.

import { minutes, num } from "./format";
import type { Hass, Options } from "./types";

export interface Helpers {
  komfort?: string;
  eko?: string;
  wieczor?: string;
  nocOd?: string;
  nocDo?: string;
  wieczorOd?: string;
  wieczorDo?: string;
  komfortOn?: string;
  wieczorOn?: string;
  auto?: string;
}

export interface Dehumidifier {
  entity: string;
  power?: string;
  energy?: string;
}

export interface Room {
  areaId: string;
  name: string;
  climate: string;
  temp?: string;
  humidity?: string;
  windows: string[];
  battery?: string;
  valve?: string;
  fans: string[];
  dehumidifiers: Dehumidifier[];
  helpers: Helpers;
  /** Pozostałe pomocniki przypisane do obszaru (progi automatyzacji, wymuszenia) — do zmiany w szczegółach pokoju. */
  settings: string[];
  toggles: string[];
}

const OPENINGS = ["window", "door", "opening", "garage_door"];
// „wentylator” albo samodzielne słowo „fan” (nie „ventilation_boost” kotła ani „fan_mode”).
const FAN_NAME = /wentylator|(^|[._\s])fan($|[._\s])(?!mode)/i;

export function areaOf(hass: Hass, entityId: string): string | undefined {
  const reg = hass.entities[entityId];
  if (!reg) return undefined;
  if (reg.area_id) return reg.area_id;
  return reg.device_id ? hass.devices[reg.device_id]?.area_id ?? undefined : undefined;
}

function helpersFor(hass: Hass, prefix: string | undefined, areaId: string): Helpers {
  if (!prefix) return {};
  const p = `${prefix}_${areaId}`;
  const has = (id: string) => (hass.states[id] ? id : undefined);
  return {
    komfort: has(`input_number.${p}_komfort`),
    eko: has(`input_number.${p}_eko`),
    wieczor: has(`input_number.${p}_wieczor`),
    nocOd: has(`input_datetime.${p}_noc_od`),
    nocDo: has(`input_datetime.${p}_noc_do`),
    wieczorOd: has(`input_datetime.${p}_wieczor_od`),
    wieczorDo: has(`input_datetime.${p}_wieczor_do`),
    komfortOn: has(`binary_sensor.${p}_komfort`),
    wieczorOn: has(`binary_sensor.${p}_wieczor`),
    auto: has(`input_boolean.${p}_automatyka`),
  };
}

export function discoverRooms(hass: Hass, opts: Options): Room[] {
  const exclude = new Set(opts.exclude_entities ?? []);
  const fanOpt = new Set(opts.fans ?? []);
  const byArea = new Map<string, string[]>();
  const primaryPerDevice = new Map<string, number>();
  for (const reg of Object.values(hass.entities)) {
    if (reg.device_id && !reg.entity_category) primaryPerDevice.set(reg.device_id, (primaryPerDevice.get(reg.device_id) ?? 0) + 1);
    if (reg.hidden || exclude.has(reg.entity_id) || !hass.states[reg.entity_id]) continue;
    const area = areaOf(hass, reg.entity_id);
    if (!area) continue;
    if (!byArea.has(area)) byArea.set(area, []);
    byArea.get(area)!.push(reg.entity_id);
  }

  const dc = (id: string) => hass.states[id]?.attributes.device_class as string | undefined;
  const dev = (id: string) => hass.entities[id]?.device_id ?? undefined;
  const primary = (id: string) => !hass.entities[id]?.entity_category;
  const sensor = (id: string) => id.startsWith("sensor.");

  // Wybrane obszary w wybranej kolejności; bez wyboru — wszystkie z termostatem.
  const chosen = (opts.areas ?? []).map((a) => hass.areas[a]).filter(Boolean);
  const rooms: Room[] = [];
  for (const area of chosen.length ? chosen : Object.values(hass.areas)) {
    const ids = byArea.get(area.area_id) ?? [];
    const climate = ids.find((i) => i.startsWith("climate."));
    if (!climate) continue;
    const climateDev = dev(climate);
    const temps = ids.filter((i) => sensor(i) && primary(i) && dc(i) === "temperature");
    const hums = ids.filter((i) => sensor(i) && primary(i) && dc(i) === "humidity");
    // Termometr pokoju: osobne urządzenie z wilgotnością > inne poza głowicą > czujnik samej głowicy.
    const temp =
      temps.find((t) => dev(t) !== climateDev && hums.some((h) => dev(h) === dev(t))) ??
      temps.find((t) => dev(t) !== climateDev) ??
      temps.find((t) => dev(t) === climateDev);
    const humidity = (temp && hums.find((h) => dev(h) === dev(temp))) ?? hums[0];
    // Okna i drzwi: tylko z małych urządzeń (kontaktron), nie drzwi zmywarki czy pralki.
    const windows = ids.filter((i) => {
      const d = dev(i);
      return i.startsWith("binary_sensor.") && primary(i) && OPENINGS.includes(dc(i) ?? "") && (!d || (primaryPerDevice.get(d) ?? 0) <= 3);
    });
    const onClimate = (i: string) => climateDev !== undefined && dev(i) === climateDev && sensor(i);
    const battery = ids.find((i) => onClimate(i) && dc(i) === "battery");
    // Otwarcie zaworu w %; napięcia silnika zaworu (mV) i podobne odpadają po jednostce.
    const valve = ids.find((i) => onClimate(i) && /heat_percentage|valve|position/.test(i) && hass.states[i]?.attributes.unit_of_measurement === "%");
    const fans = ids.filter(
      (i) =>
        fanOpt.has(i) ||
        i.startsWith("fan.") ||
        (i.startsWith("switch.") && primary(i) && FAN_NAME.test(`${i} ${hass.states[i]?.attributes.friendly_name ?? ""}`)),
    );
    const dehumidifiers = ids
      .filter((i) => i.startsWith("humidifier.") && dc(i) === "dehumidifier")
      .map((entity) => {
        const d = dev(entity);
        const same = (cls: string) => (d ? ids.find((i) => sensor(i) && dev(i) === d && dc(i) === cls) : undefined);
        return { entity, power: same("power"), energy: same("energy") };
      });
    // Pomocniki obszaru poza profilami ogrzewania (te mają własną sekcję), np. progi wentylatora, „wymuś osuszacz”.
    const heating = opts.helper_prefix ? `${opts.helper_prefix}_${area.area_id}_` : null;
    const own = (i: string) => !heating || !i.split(".")[1].startsWith(heating);
    const settings = ids.filter((i) => i.startsWith("input_number.") && own(i));
    const toggles = ids.filter((i) => i.startsWith("input_boolean.") && own(i));
    rooms.push({
      areaId: area.area_id,
      name: area.name,
      climate,
      temp,
      humidity,
      windows,
      battery,
      valve,
      fans,
      dehumidifiers,
      helpers: helpersFor(hass, opts.helper_prefix, area.area_id),
      settings,
      toggles,
    });
  }
  return rooms;
}

// ---- profile ogrzewania (k = w domu, e = noc / poza domem, w = wieczór) ----

export type Profile = "k" | "e" | "w";
export type ProfileNow = Profile | "okno" | null;

export const PROFILE_NAME: Record<Profile | "okno", string> = {
  k: "w domu",
  e: "noc / poza domem",
  w: "wieczór",
  okno: "okno otwarte",
};

const st = (hass: Hass, id?: string) => (id ? hass.states[id]?.state : undefined);

export const hasProfiles = (r: Room) => Boolean(r.helpers.komfort && r.helpers.eko);

export function nightWindow(hass: Hass, r: Room): [number, number] {
  return [minutes(st(hass, r.helpers.nocOd)) ?? 22 * 60, minutes(st(hass, r.helpers.nocDo)) ?? 5 * 60];
}

export function eveningWindow(hass: Hass, r: Room): [number, number] | null {
  const od = minutes(st(hass, r.helpers.wieczorOd));
  const doo = minutes(st(hass, r.helpers.wieczorDo));
  return r.helpers.wieczor && od !== null && doo !== null ? [od, doo] : null;
}

/** Profil w danej minucie doby, jak w automatyzacjach (bez obecności — plan dnia). */
export function profileAt(hass: Hass, r: Room, m: number): Profile {
  const ev = eveningWindow(hass, r);
  if (ev && m >= ev[0] && m < ev[1]) return "w";
  const [od, doo] = nightWindow(hass, r);
  const noc = od > doo ? m >= od || m < doo : m >= od && m < doo;
  return noc ? "e" : "k";
}

export function windowOpen(hass: Hass, r: Room): boolean {
  return r.windows.some((w) => st(hass, w) === "on");
}

export function profileNow(hass: Hass, r: Room): ProfileNow {
  if (windowOpen(hass, r)) return "okno";
  if (!hasProfiles(r)) return null;
  if (st(hass, r.helpers.wieczorOn) === "on") return "w";
  if (r.helpers.komfortOn) return st(hass, r.helpers.komfortOn) === "on" ? "k" : "e";
  return null;
}

export const PROFILE_HELPER: Record<Profile, keyof Helpers> = { k: "komfort", e: "eko", w: "wieczor" };

export function profileValue(hass: Hass, r: Room, p: Profile, pending: Map<string, number>): number | null {
  const id = r.helpers[PROFILE_HELPER[p]];
  if (!id) return null;
  return pending.get(id) ?? num(st(hass, id));
}

export const climateTarget = (hass: Hass, r: Room): number | null => num(hass.states[r.climate]?.attributes.temperature);
export const roomTemp = (hass: Hass, r: Room): number | null =>
  num(r.temp ? st(hass, r.temp) : hass.states[r.climate]?.attributes.current_temperature);
