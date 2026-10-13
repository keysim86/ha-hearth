// Panel ustawień pokoju (wspólny dla wszystkich stylów): dlaczego taki cel, profile, plan, głowica, powietrze.

import { html, nothing, type TemplateResult } from "lit";
import { f1, hhmm, num, round } from "../format";
import { hasProfiles, profileValue, PROFILE_HELPER, type Profile, type Room } from "../model";
import { activity, fanIcon } from "../svg";
import { dayline, devices, nightNow, roomTemp, st, targetNow, workTime, type Ctx } from "./common";

function stepper(label: string, value: string, minus: () => void, plus: () => void) {
  return html`<span class="step">
    <button type="button" aria-label="${label}: mniej" @click=${minus}>−</button>
    <output>${value}</output>
    <button type="button" aria-label="${label}: więcej" @click=${plus}>+</button>
  </span>`;
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
        : html`Nikogo nie ma w domu, więc cel to <b>${f1(z)}°</b>.`;
    case "k":
      return html`Ktoś jest w domu i jest dzień, więc cel to <b>${f1(z)}°</b>.`;
    default:
      return html`Głowica trzyma nastawę <b>${f1(z)}°</b>.`;
  }
}

function profiles(ctx: Ctx, r: Room, p: ReturnType<typeof targetNow>["p"]) {
  const h = r.helpers;
  const rows: Array<[Profile, string, string]> = [
    ["k", "W domu", "dzień, ktoś jest"],
    ["e", "Noc i poza domem", `${hhmm(st(ctx, h.nocOd))}–${hhmm(st(ctx, h.nocDo))} albo pusty dom`],
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

export function detail(ctx: Ctx, r: Room) {
  const { z, p } = targetNow(ctx, r);
  const c = ctx.hass.states[r.climate];
  const auto = r.helpers.auto;
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
      ${hasProfiles(r)
        ? html`<div class="box"><h3>Plan dnia</h3>${dayline(ctx, r)}
            <div class="tcap">Noc ${hhmm(st(ctx, r.helpers.nocOd))}–${hhmm(st(ctx, r.helpers.nocDo))}${r.helpers.wieczor ? ` · wieczór ${hhmm(st(ctx, r.helpers.wieczorOd))}–${hhmm(st(ctx, r.helpers.wieczorDo))}` : ""}. Pokój grzeje według ${r.temp && ctx.hass.entities[r.temp]?.device_id !== ctx.hass.entities[r.climate]?.device_id ? "czujnika w pokoju" : "pomiaru głowicy"}.</div>
            ${auto ? html`<div class="row"><span>Automatyka ogrzewania</span>
              <button class="switch" type="button" role="switch" aria-checked=${st(ctx, auto) === "on" ? "true" : "false"} aria-label="Automatyka ogrzewania"
                @click=${() => ctx.actions.toggleEntity(auto)}></button></div>` : nothing}
          </div>`
        : nothing}
      <div class="box"><h3>Głowica</h3>
        <div class="row"><span>Pomiar głowicy</span><b>${f1(num(c?.attributes.current_temperature))} °C</b></div>
        <div class="row"><span>Pomiar w pokoju</span><b>${f1(roomTemp(ctx.hass, r))} °C</b></div>
        ${r.valve ? html`<div class="row"><span>Zawór w ostatniej godzinie</span><b>${round(num(st(ctx, r.valve)) ?? 0)}%</b></div>` : nothing}
        ${r.battery ? html`<div class="row"><span>Bateria</span><b>${num(st(ctx, r.battery)) === null ? "brak odczytu" : `${round(num(st(ctx, r.battery)))}%`}</b></div>` : nothing}
      </div>
      ${air(ctx, r)}
    </div>
  </section>`;
}
