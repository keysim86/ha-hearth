// Panel ustawień pokoju (wspólny dla wszystkich stylów): dlaczego taki cel, profile, plan, czujniki, obecność, głowica, powietrze.

import { html, nothing, type TemplateResult } from "lit";
import { f1, hhmm, num, round } from "../format";
import { areaOf, entityList, hasProfiles, OPENINGS, presenceUsed, profileValue, PROFILE_HELPER, type Profile, type Room } from "../model";
import { activity, fanIcon } from "../svg";
import { dayline, devices, nightNow, roomTemp, st, targetNow, timeSel, workTime, type Ctx } from "./common";

/** Pomocnik input_text mieści 255 znaków — dłuższej listy nie zapisujemy (HA by ją odrzucił). */
const MAX_TEXT = 255;

function stepper(label: string, value: string, minus: () => void, plus: () => void) {
  return html`<span class="step">
    <button type="button" aria-label="${label}: mniej" @click=${minus}>−</button>
    <output>${value}</output>
    <button type="button" aria-label="${label}: więcej" @click=${plus}>+</button>
  </span>`;
}

function toggle(label: string, on: boolean, click: () => void) {
  return html`<button class="switch" type="button" role="switch" aria-checked=${on ? "true" : "false"} aria-label=${label} @click=${click}></button>`;
}

const nameOf = (ctx: Ctx, id: string) => String(ctx.hass.states[id]?.attributes.friendly_name ?? id);

/** Zapis listy encji do pomocnika input_text (po przecinku). */
function saveList(ctx: Ctx, helper: string, ids: string[]) {
  const value = ids.join(",");
  if (value.length > MAX_TEXT) {
    ctx.actions.toast("Za dużo pozycji — lista nie mieści się w pomocniku (255 znaków).");
    return;
  }
  ctx.actions.call("input_text", "set_value", { entity_id: helper, value });
}

/** Kandydaci pogrupowani po obszarach: najpierw obszar pokoju, potem alfabetycznie, na końcu bez obszaru. */
function grouped(ctx: Ctx, r: Room, ids: string[]): Array<[string, string[]]> {
  const groups = new Map<string, string[]>();
  for (const id of ids) {
    const a = areaOf(ctx.hass, id) ?? "";
    groups.set(a, [...(groups.get(a) ?? []), id]);
  }
  const label = (a: string) => (a ? ctx.hass.areas[a]?.name ?? a : "Bez obszaru");
  const rank = (a: string) => (a === r.areaId ? 0 : a ? 1 : 2);
  return [...groups.entries()]
    .sort(([a], [b]) => rank(a) - rank(b) || label(a).localeCompare(label(b), "pl"))
    .map(([a, list]) => [label(a), list.sort((x, y) => nameOf(ctx, x).localeCompare(nameOf(ctx, y), "pl"))]);
}

/** Termometry do wyboru: czujniki temperatury poza diagnostycznymi, ukrytymi i tymi z samych głowic. */
function tempCandidates(ctx: Ctx): string[] {
  const reg = ctx.hass.entities;
  const climateDevs = new Set(Object.values(reg).filter((e) => e.entity_id.startsWith("climate.") && e.device_id).map((e) => e.device_id));
  const own = ctx.opts.helper_prefix ? `sensor.${ctx.opts.helper_prefix}_` : null;
  return Object.keys(ctx.hass.states).filter((id) => {
    const e = reg[id];
    if (!id.startsWith("sensor.") || ctx.hass.states[id].attributes.device_class !== "temperature") return false;
    if (e?.entity_category || e?.hidden || (own && id.startsWith(own))) return false;
    return !(e?.device_id && climateDevs.has(e.device_id));
  });
}

/** Kontaktrony okien i drzwi: małe urządzenia (nie drzwi auta, lodówki czy pralki). */
function windowCandidates(ctx: Ctx): string[] {
  const reg = ctx.hass.entities;
  const perDevice = new Map<string, number>();
  for (const e of Object.values(reg)) if (e.device_id && !e.entity_category) perDevice.set(e.device_id, (perDevice.get(e.device_id) ?? 0) + 1);
  const own = ctx.opts.helper_prefix ? `binary_sensor.${ctx.opts.helper_prefix}_` : null;
  return Object.keys(ctx.hass.states).filter((id) => {
    const e = reg[id];
    if (!id.startsWith("binary_sensor.") || !OPENINGS.includes(String(ctx.hass.states[id].attributes.device_class ?? ""))) return false;
    if (e?.entity_category || e?.hidden || (own && id.startsWith(own))) return false;
    return !e?.device_id || (perDevice.get(e.device_id) ?? 0) <= 6;
  });
}

function why(ctx: Ctx, r: Room, z: number | null, p: ReturnType<typeof targetNow>["p"]): TemplateResult {
  const h = r.helpers;
  if (h.auto && st(ctx, h.auto) === "off") return html`Automatyka jest wyłączona, głowica trzyma ręczną nastawę <b>${f1(z)}°</b>.`;
  switch (p) {
    case "okno":
      return html`Okno albo drzwi są otwarte, więc ogrzewanie jest wstrzymane.`;
    case "w":
      return html`Trwa wieczór (${hhmm(st(ctx, h.wieczorOd))}–${hhmm(st(ctx, h.wieczorDo))}), więc cel to <b>${f1(z)}°</b>.`;
    case "e":
      return nightNow(ctx, r)
        ? html`Jest noc (${hhmm(st(ctx, h.nocOd))}–${hhmm(st(ctx, h.nocDo))}), więc cel to <b>${f1(z)}°</b>.`
        : html`Nikogo z wybranych osób nie ma w domu, więc cel to <b>${f1(z)}°</b>.`;
    case "k":
      return presenceUsed(ctx.hass, r)
        ? html`Ktoś jest w domu i jest dzień, więc cel to <b>${f1(z)}°</b>.`
        : html`Jest dzień (obecność nie ma tu znaczenia), więc cel to <b>${f1(z)}°</b>.`;
    default:
      return html`Głowica trzyma nastawę <b>${f1(z)}°</b>.`;
  }
}

function profiles(ctx: Ctx, r: Room, p: ReturnType<typeof targetNow>["p"]) {
  const h = r.helpers;
  const pres = presenceUsed(ctx.hass, r);
  const rows: Array<[Profile, string, string]> = [
    ["k", "W domu", pres ? "dzień, ktoś jest" : "dzień"],
    ["e", pres ? "Noc i poza domem" : "Noc", `${hhmm(st(ctx, h.nocOd))}–${hhmm(st(ctx, h.nocDo))}${pres ? " albo pusty dom" : ""}`],
    ["w", "Wieczór", `${hhmm(st(ctx, h.wieczorOd))}–${hhmm(st(ctx, h.wieczorDo))}, zawsze`],
  ];
  return html`<div class="box"><h3>Temperatury</h3>
    ${rows
      .filter(([k]) => r.helpers[PROFILE_HELPER[k]])
      .map(([k, label, sub]) => {
        const v = profileValue(ctx.hass, r, k, ctx.pending);
        return html`<div class="prof ${k} ${p === k ? "on" : ""}">
          <span class="pl">${label}<small>${sub}${p === k ? " · teraz" : ""}</small></span>
          ${stepper(label, `${f1(v)}°`, () => ctx.actions.stepProfile(r, k, -0.5), () => ctx.actions.stepProfile(r, k, 0.5))}
        </div>`;
      })}
  </div>`;
}

/** Godzina z pomocnika input_datetime do zmiany w miejscu (bez pomocnika — sam tekst). */
function hour(ctx: Ctx, id: string | undefined, label: string) {
  if (!id) return html`<b>—</b>`;
  return timeSel(hhmm(st(ctx, id)), label, (v) => ctx.actions.call("input_datetime", "set_datetime", { entity_id: id, time: `${v}:00` }), 5);
}

function plan(ctx: Ctx, r: Room) {
  const h = r.helpers;
  return html`<div class="box"><h3>Plan dnia</h3>${dayline(ctx, r)}
    <div class="fld"><span>Noc</span><span class="trange">${hour(ctx, h.nocOd, "Noc od")} – ${hour(ctx, h.nocDo, "Noc do")}</span></div>
    ${h.wieczor
      ? html`<div class="fld"><span>Wieczór</span><span class="trange">${hour(ctx, h.wieczorOd, "Wieczór od")} – ${hour(ctx, h.wieczorDo, "Wieczór do")}</span></div>`
      : nothing}
    ${h.auto ? html`<div class="row"><span>Automatyka ogrzewania</span>${toggle("Automatyka ogrzewania", st(ctx, h.auto) === "on", () => ctx.actions.toggleEntity(h.auto!))}</div>` : nothing}
  </div>`;
}

/** Skąd pokój bierze temperaturę i które okna albo drzwi wyłączają grzanie — z wyborem w miejscu. */
function sensors(ctx: Ctx, r: Room) {
  const h = r.helpers;
  if (!h.czujnik && !h.okna) return nothing;
  const chosen = entityList(st(ctx, h.czujnik))[0] ?? "";
  const tv = (id: string) => num(st(ctx, id));
  const trv = num(ctx.hass.states[r.climate]?.attributes.current_temperature);
  const src = st(ctx, r.sensorSelect);
  const source =
    !chosen
      ? "Głowica mierzy temperaturę sama."
      : src === "remote_temperature"
        ? "Głowica reguluje według tego czujnika."
        : src === "remote_source_offline"
          ? "Czujnik przestał nadawać — głowica mierzy sama, wróci do czujnika przy kolejnym odczycie."
          : r.sensorSelect
            ? "Głowica mierzy sama — czujnik milczy albo jest niedostępny; wróci do niego przy kolejnym odczycie."
            : "Pomiar w pokoju z tego czujnika.";
  const temps = tempCandidates(ctx);
  if (chosen && !temps.includes(chosen)) temps.push(chosen);
  const okna = entityList(st(ctx, h.okna));
  const free = windowCandidates(ctx).filter((id) => !okna.includes(id));
  const state = (id: string) => ({ on: "otwarte", off: "zamknięte" })[st(ctx, id) ?? ""] ?? "brak danych";
  return html`<div class="box"><h3>Czujniki</h3>
    ${h.czujnik
      ? html`<label class="fld"><span>Temperatura pokoju według</span>
          <select @change=${(ev: Event) => ctx.actions.call("input_text", "set_value", { entity_id: h.czujnik, value: (ev.target as HTMLSelectElement).value })}>
            <option value="" ?selected=${!chosen}>Pomiar głowicy${trv === null ? "" : ` · ${f1(trv)} °C`}</option>
            ${grouped(ctx, r, temps).map(
              ([area, ids]) => html`<optgroup label=${area}>
                ${ids.map((id) => html`<option value=${id} ?selected=${id === chosen}>${nameOf(ctx, id)}${tv(id) === null ? "" : ` · ${f1(tv(id))} °C`}</option>`)}
              </optgroup>`,
            )}
          </select></label>
        <div class="rule">${source}</div>`
      : nothing}
    ${h.okna
      ? html`<div class="fld"><span>Okna i drzwi wyłączające grzanie</span>
          ${okna.length
            ? html`<div class="tags">
                ${okna.map(
                  (id) => html`<span class="tag ${st(ctx, id) === "on" ? "open" : ""}">${nameOf(ctx, id)} · ${state(id)}
                    <button type="button" aria-label="Usuń: ${nameOf(ctx, id)}" @click=${() => saveList(ctx, h.okna!, okna.filter((x) => x !== id))}>×</button></span>`,
                )}
              </div>`
            : html`<div class="rule">Żadne — głowica nie reaguje na otwarcie okna.</div>`}
          <select aria-label="Dodaj czujnik okna albo drzwi" @change=${(ev: Event) => {
            const sel = ev.target as HTMLSelectElement;
            const v = sel.value;
            sel.value = "";
            if (v) saveList(ctx, h.okna!, [...okna, v]);
          }}>
            <option value="" selected>+ Dodaj czujnik okna albo drzwi…</option>
            ${grouped(ctx, r, free).map(
              ([area, ids]) => html`<optgroup label=${area}>${ids.map((id) => html`<option value=${id}>${nameOf(ctx, id)} · ${state(id)}</option>`)}</optgroup>`,
            )}
          </select></div>`
      : nothing}
  </div>`;
}

/** Czy obecność wpływa na temperaturę i czyja: przełącznik i osoby do zaznaczenia. */
function presence(ctx: Ctx, r: Room) {
  const h = r.helpers;
  if (!h.obecnosc) return nothing;
  const on = st(ctx, h.obecnosc) === "on";
  const chosen = entityList(st(ctx, h.osoby));
  const people = Object.keys(ctx.hass.states)
    .filter((id) => id.startsWith("person."))
    .sort((a, b) => nameOf(ctx, a).localeCompare(nameOf(ctx, b), "pl"));
  const status = !on
    ? "Wyłączona — w dzień zawsze temperatura „W domu”, w nocy „Noc”."
    : !chosen.length
      ? "Nie wybrano nikogo — działa jak wyłączona."
      : st(ctx, h.ktos) === "off"
        ? "Nikogo z wybranych nie ma w domu — temperatura „poza domem”."
        : "Ktoś z wybranych jest w domu (po wyjściu ostatniej osoby temperatura spada po 10 minutach).";
  return html`<div class="box"><h3>Obecność</h3>
    <div class="row"><span>Uwzględniaj obecność</span>${toggle("Uwzględniaj obecność", on, () => ctx.actions.toggleEntity(h.obecnosc!))}</div>
    ${h.osoby
      ? html`<div class="tags" role="group" aria-label="Osoby sprawdzane przy obecności">
          ${people.map((id) => {
            const sel = chosen.includes(id);
            return html`<button type="button" class="tag pick ${sel ? "on" : ""}" aria-pressed=${sel ? "true" : "false"}
              @click=${() => saveList(ctx, h.osoby!, sel ? chosen.filter((x) => x !== id) : [...chosen, id])}>
              ${nameOf(ctx, id)} <small>${st(ctx, id) === "home" ? "w domu" : "poza domem"}</small></button>`;
          })}
        </div>`
      : nothing}
    <div class="rule">${status}</div>
  </div>`;
}

function head(ctx: Ctx, r: Room) {
  const c = ctx.hass.states[r.climate];
  const lock = r.childLock;
  const locked = lock ? ["on", "locked"].includes(st(ctx, lock) ?? "") : false;
  const flipLock = () => {
    if (!lock) return;
    if (lock.startsWith("lock.")) ctx.actions.call("lock", locked ? "unlock" : "lock", { entity_id: lock });
    else ctx.actions.toggleEntity(lock);
  };
  return html`<div class="box"><h3>Głowica</h3>
    <div class="row"><span>Pomiar głowicy</span><b>${f1(num(c?.attributes.current_temperature))} °C</b></div>
    <div class="row"><span>Pomiar w pokoju</span><b>${f1(roomTemp(ctx.hass, r))} °C</b></div>
    ${r.valve ? html`<div class="row"><span>Zawór w ostatniej godzinie</span><b>${round(num(st(ctx, r.valve)) ?? 0)}%</b></div>` : nothing}
    ${r.battery ? html`<div class="row"><span>Bateria</span><b>${num(st(ctx, r.battery)) === null ? "brak odczytu" : `${round(num(st(ctx, r.battery)))}%`}</b></div>` : nothing}
    ${lock ? html`<div class="row"><span>Blokada rodzicielska<small>przyciski i pokrętło na głowicy</small></span>${toggle("Blokada rodzicielska", locked, flipLock)}</div>` : nothing}
  </div>`;
}

function air(ctx: Ctx, r: Room) {
  const devs = devices(ctx, r);
  if (!devs.length) return nothing;
  const wp = num(st(ctx, r.humidity)), wz = num(st(ctx, ctx.opts.outdoor_humidity));
  const X = (v: number) => Math.max(0, Math.min(100, ((v - 30) / 60) * 100));
  const dehums = devs.filter((d) => d.kind === "dehumidifier");
  const fans = devs.filter((d) => d.kind === "fan");
  const target = (e: string) => ctx.pending.get(`${e}#h`) ?? num(ctx.hass.states[e]?.attributes.humidity);
  const energy = (id?: string) => {
    const v = ctx.hist.series(ctx.hass, id).filter(([t]) => t >= Date.now() - 864e5).map(([, s]) => num(s)).filter((x): x is number => x !== null);
    return v.length > 1 ? v[v.length - 1] - v[0] : null;
  };
  return html`<div class="box air"><h3>Powietrze i wilgoć</h3>
    <div class="airc">
      <div class="row"><span>Wilgotność w pokoju${wz === null ? "" : " / na zewnątrz"}</span><b>${round(wp)}%${wz === null ? "" : ` / ${round(wz)}%`}</b></div>
      ${wp === null ? nothing : html`<div class="humbar" title="30–90%">
        ${dehums.map((d) => { const t = target(d.entity); return t === null ? nothing : html`<span class="cel" style="left:${X(t)}%"></span>`; })}
        <span class="now" style="left:${X(wp)}%"></span></div>
        <div class="tticks"><span>30%</span><span>50%</span><span>70%</span><span>90%</span></div>`}
      ${dehums.map((d) => html`<div class="prof on airp">
        <span class="pl">Osuszacz: cel wilgotności<small>${d.sub}</small></span>
        ${stepper("Cel osuszacza", `${target(d.entity) ?? "—"}%`, () => ctx.actions.stepHumidity(d.entity, -5), () => ctx.actions.stepHumidity(d.entity, 5))}
      </div>`)}
    </div>
    <div class="airc"><h3>Praca w ostatnich 24 h</h3>
      ${devs.map((d) => html`<div class="lane"><span>${d.name} · ${workTime(d)}</span>${activity(d.periods)}</div>`)}
      ${dehums.map((d) => { const e = energy(d.energy); return e === null ? nothing : html`<div class="row"><span>Energia osuszacza (24 h)</span><b>${f1(e)} kWh</b></div>`; })}
    </div>
    <div class="airc">
      ${wp !== null && wz !== null ? html`<div class="row"><span>Różnica z zewnętrzną</span><b>${wp - wz >= 0 ? "+" : ""}${round(wp - wz)} pp</b></div>` : nothing}
      ${fans.map((f) => html`<div class="acts"><button class="btn" type="button" @click=${() => ctx.actions.toggleEntity(f.entity)}>${fanIcon} ${f.on ? "Wyłącz wentylator" : "Włącz wentylator"}</button></div>`)}
      <div class="rule">Osuszacze i wentylator działają według Twoich automatyzacji; tu widać ich stan i możesz zmienić cel albo włączyć wentylator ręcznie.</div>
    </div>
  </div>`;
}

/** Pomocniki przypisane do obszaru pokoju: przełączniki (np. wymuszenie osuszacza) i progi automatyzacji z − / +. */
function automation(ctx: Ctx, r: Room) {
  if (!r.settings.length && !r.toggles.length) return nothing;
  // „Osuszacz – wymuś pracę (Łazienka)” → bez nazwy pokoju, w którym właśnie jesteśmy.
  const label = (id: string) => String(ctx.hass.states[id]?.attributes.friendly_name ?? id).replace(` (${r.name})`, "");
  return html`<div class="box"><h3>Automatyka urządzeń</h3>
    ${r.toggles.map((id) => html`<div class="row"><span>${label(id)}</span>${toggle(label(id), st(ctx, id) === "on", () => ctx.actions.toggleEntity(id))}</div>`)}
    ${r.settings.map((id) => {
      const a = ctx.hass.states[id]?.attributes ?? {};
      const step = num(a.step) ?? 1;
      const v = ctx.pending.get(id) ?? num(st(ctx, id));
      const unit = a.unit_of_measurement ? ` ${a.unit_of_measurement}` : "";
      const text = v === null ? "—" : `${v.toLocaleString("pl-PL", { maximumFractionDigits: step < 1 ? 1 : 0 })}${unit}`;
      return html`<div class="prof on airp"><span class="pl">${label(id)}</span>
        ${stepper(label(id), text, () => ctx.actions.stepNumber(id, -step), () => ctx.actions.stepNumber(id, step))}</div>`;
    })}
    <div class="rule">Pomocniki przypisane do tego pokoju (obszaru) w Home Assistant — zmiana działa od razu w automatyzacjach.</div>
  </div>`;
}

export function detail(ctx: Ctx, r: Room) {
  const { z, p } = targetNow(ctx, r);
  return html`<section class="detail" id="szczegoly" aria-label="Ustawienia: ${r.name}">
    <div class="dhead"><h2>${r.name}</h2>
      <div class="acts"><button class="btn" type="button" @click=${() => ctx.actions.toggleRoom(r.areaId)}>Zamknij</button></div>
    </div>
    <div class="why">${why(ctx, r, z, p)}</div>
    <div class="dcols">
      ${hasProfiles(r)
        ? profiles(ctx, r, p)
        : html`<div class="box"><h3>Temperatura zadana</h3>
            <div class="prof k on"><span class="pl">Nastawa głowicy<small>bez profili — zmienia termostat</small></span>
            ${stepper("Nastawa", `${f1(z)}°`, () => ctx.actions.stepClimate(r, -0.5), () => ctx.actions.stepClimate(r, 0.5))}</div>
          </div>`}
      ${hasProfiles(r) ? plan(ctx, r) : nothing}
      ${sensors(ctx, r)}
      ${presence(ctx, r)}
      ${head(ctx, r)}
      ${air(ctx, r)}
      ${automation(ctx, r)}
    </div>
  </section>`;
}
