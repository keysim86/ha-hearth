// Panel Hearth — zakładka Klimat. Pokoje z obszarów HA, trzy style kart, ustawienia na urządzeniu.

import { LitElement, html, nothing, type PropertyValues } from "lit";
import { property, query, state } from "lit/decorators.js";
import { clock, num } from "./format";
import { StatsStore } from "./data/stats";
import { RowsStore } from "./data/health";
import { DAYS, EbusdTimers, circuits, validate, writes, type Circuit, type Slot } from "./data/ebusd";
import type { SchedEdit } from "./views/boiler";
import { HistoryStore } from "./history";
import { climateTarget, discoverRooms, hasProfiles, profileValue, PROFILE_HELPER, type Profile, type Room } from "./model";
import { styles } from "./styles";
import { gearIcon, menuIcon } from "./svg";
import type { Hass, Options, PanelInfo, Route, Style, Tab } from "./types";
import type { Actions, Ctx } from "./views/common";
import { devices } from "./views/common";
import { detail } from "./views/detail";
import { dial } from "./views/dials";
import { house } from "./views/house";
import { listHeader, row } from "./views/list";
import { outdoor } from "./views/outdoor";
import { tile } from "./views/tiles";
import { boilerView } from "./views/boiler";
import { energyView } from "./views/energy";
import { homeView, personInfo, tileMap, toggleFor, wasteToggles } from "./views/home";
import { metersView } from "./views/meters";
import { activeAlerts, alertsView } from "./views/alerts";
import { camerasView } from "./views/cameras";
import { networkView, speedIds } from "./views/network";
import { proxmoxView } from "./views/proxmox";
import { switchesView } from "./views/switches";
import { carsView, robotsView } from "./views/vehicles";
import { healthView } from "./views/health";

const STYLES: Style[] = ["tiles", "list", "dials"];
const TABS: Tab[] = ["home", "climate", "switches", "energy", "boiler", "meters", "network", "cameras", "cars", "robots", "proxmox", "health", "agent", "alerts"];
const TAB_INFO: Record<Tab, [slug: string, label: string]> = {
  home: ["dom", "Dom"],
  climate: ["klimat", "Klimat"],
  switches: ["przelaczniki", "Przełączniki"],
  energy: ["energia", "Energia"],
  boiler: ["kociol", "Kocioł"],
  meters: ["liczniki", "Liczniki"],
  network: ["siec", "Sieć"],
  cameras: ["kamery", "Kamery"],
  cars: ["auta", "Auta"],
  robots: ["roboty", "Roboty"],
  proxmox: ["proxmox", "Proxmox"],
  health: ["zdrowie", "Zdrowie"],
  agent: ["agent", "Agent"],
  alerts: ["alerty", "Alerty"],
};
const STYLE_INFO: Record<Style, [string, string]> = {
  tiles: ["Kafelki", "Łuk, wykres 24 h, oś dnia i urządzenia; ustawienia po kliknięciu."],
  list: ["Lista", "Wiersz na pokój, skala 16–28 °C. Najgęstszy, dobry na komputer."],
  dials: ["Pokrętła", "Kolorowe karty jak termostat, − / + na karcie. Dobry na telefon i tablet."],
};
const FOOT: Record<Style, string> = {
  tiles: "Kolor liczby to temperatura: im cieplej, tym bardziej pomarańczowo. Łuk pokazuje 16–28 °C, kreska na łuku to cel. Wykres to ostatnie 24 godziny. Turkusowe urządzenie właśnie pracuje.",
  list: "Na skali kreska to cel, kropka to pomiar; pomarańczowy odcinek to brakujące stopnie. Wykres to ostatnie 24 godziny, pod nim plan dnia z kreską „teraz”.",
  dials: "Pierścień pokazuje 14–30 °C, białe kółko to cel. Tło karty ma kolor temperatury w pokoju. − / + zmienia cel profilu, który teraz działa.",
};
const STYLE_KEY = "hearth.style";
const UI_KEY = "hearth.ui";
const FONTS_ID = "hearth-fonts";
const FONTS_URL =
  "https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..800&family=Atkinson+Hyperlegible:wght@400;700" +
  "&family=JetBrains+Mono:wght@400;600;800&family=Bricolage+Grotesque:opsz,wght@12..96,400..800&display=swap";

function readUi(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(UI_KEY) ?? "{}") ?? {};
  } catch {
    return {};
  }
}

function readStyle(): Style | null {
  try {
    const s = localStorage.getItem(STYLE_KEY) as Style | null;
    return s && STYLES.includes(s) ? s : null;
  } catch {
    return null;
  }
}

let announced = false;

const roundStep = (v: number, step: number) => Math.round(v / step) * step;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export class HearthPanel extends LitElement {
  static styles = styles;

  @property({ attribute: false }) hass?: Hass;
  @property({ type: Boolean, reflect: true }) narrow = false;
  @property({ attribute: false }) panel?: PanelInfo;
  @property({ attribute: false }) route?: Route;

  @state() private open: string | null = null;
  @state() private cols = 1;
  @state() private localStyle: Style | null = readStyle();
  @state() private toastText = "";
  @state() private ui: Record<string, string> = readUi();
  @state() private person: string | null = null;
  @state() private sched: SchedEdit | null = null;
  private ebusd = new EbusdTimers();

  @query("dialog.set") private dialog?: HTMLDialogElement;
  @query("dialog.pdlg") private personDialog?: HTMLDialogElement;
  private mapCard?: HTMLElement & { hass?: Hass };
  private mapFor: string | null = null;

  private hist = new HistoryStore();
  private stats = new StatsStore();
  private rows = new RowsStore();
  private pending = new Map<string, number>();
  private timers = new Map<string, number>();
  private roomsCache?: { key: unknown[]; rooms: Room[] };
  private tick?: number;
  private lastTick = 0;
  private lastDark?: boolean;
  private toastTimer?: number;
  private resize?: ResizeObserver;

  private get options(): Options {
    return { style: "tiles", ...(this.panel?.config?.options ?? {}) } as Options;
  }

  private get tabs(): Tab[] {
    // Kolejność z opcji (kolejność wyboru); nieznane pomijamy. Bez wyboru: wszystkie, poza Agentem bez adresu
    // i Zdrowiem bez osób.
    const chosen = (this.options.tabs ?? []).filter((t, i, a) => TABS.includes(t) && a.indexOf(t) === i);
    return chosen.length
      ? chosen
      : TABS.filter((t) => (t !== "agent" || this.options.agent_url) && (t !== "health" || this.panel?.config?.health?.length));
  }

  private get tab(): Tab {
    const slug = (this.route?.path ?? "").split("/").filter(Boolean)[0];
    const found = this.tabs.find((t) => TAB_INFO[t][0] === slug);
    return found ?? this.tabs[0];
  }

  private get cardStyle(): Style {
    const s = this.localStyle ?? this.options.style;
    return STYLES.includes(s) ? s : "tiles";
  }

  connectedCallback() {
    super.connectedCallback();
    if (!announced) {
      announced = true;
      // Wersja z manifest.json (przychodzi w konfiguracji panelu) — jak baner w naszych kartach.
      console.info(
        `%c HEARTH %c v${this.panel?.config?.version ?? "?"} `,
        "color:#fff;background:#cf5a1e;font-weight:700;border-radius:3px 0 0 3px",
        "color:#cf5a1e;background:#fff3ea;font-weight:700;border-radius:0 3px 3px 0",
      );
    }
    if (!document.getElementById(FONTS_ID)) {
      const link = Object.assign(document.createElement("link"), { id: FONTS_ID, rel: "stylesheet", href: FONTS_URL });
      document.head.append(link);
    }
    // Co minutę przerysowanie (czas, oś dnia); na zakładkach z obrazem z kamer co 5 s (nowy podgląd).
    this.tick = window.setInterval(() => {
      if (["cameras", "robots"].includes(this.tab) || Date.now() - this.lastTick > 60e3) {
        this.lastTick = Date.now();
        this.requestUpdate();
      }
    }, 5000);
    this.resize = new ResizeObserver(() => this.measure());
    this.resize.observe(this);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.ebusd.disconnect();
    window.clearInterval(this.tick);
    this.resize?.disconnect();
  }

  private rooms(): Room[] {
    const h = this.hass!;
    const key = [h.entities, h.devices, h.areas, this.panel];
    if (this.roomsCache && this.roomsCache.key.every((k, i) => k === key[i])) return this.roomsCache.rooms;
    const rooms = discoverRooms(h, this.options);
    this.roomsCache = { key, rooms };
    return rooms;
  }

  protected willUpdate(changed: PropertyValues<this>) {
    if (changed.has("hass") && this.hass) {
      // Zmiana zapisana w HA = koniec wartości „w locie”.
      for (const [key, value] of this.pending) {
        const [id, kind] = key.split("#");
        const s = this.hass.states[id];
        const actual = kind === "t" ? num(s?.attributes.temperature) : kind === "h" ? num(s?.attributes.humidity) : num(s?.state);
        if (actual !== null && Math.abs(actual - value) < 1e-6) this.pending.delete(key);
      }
      this.toggleAttribute("dark", Boolean(this.hass.themes?.darkMode));
    }
  }

  protected updated(changed: PropertyValues<this>) {
    if ((changed as Map<string, unknown>).has("person") && this.person && !this.personDialog?.open) this.personDialog?.showModal();
    const dark = Boolean(this.hass?.themes?.darkMode);
    if (dark !== this.lastDark) {
      this.lastDark = dark;
      this.postTheme();
    }
    this.syncPersonMap();
    this.measure();
    if (!this.hass) return;
    const o = this.options;
    const tab = this.tab;
    const byTab: Record<Tab, Array<string | null | undefined>> = {
      climate: [
        ...this.rooms().flatMap((r) => [r.temp, ...r.fans, ...r.dehumidifiers.flatMap((d) => [d.entity, d.power, d.energy])]),
        o.outdoor_temperature, o.outdoor_pressure, o.outdoor_illuminance, o.outdoor_pm25,
      ],
      home: [],
      energy: [o.power_total, ...(o.phase_power ?? [])],
      boiler: [o.boiler_flow_temperature, o.boiler_flow_target, o.boiler_return_temperature, o.boiler_outdoor, o.dhw_temperature],
      network: [...(this.hass ? speedIds({ hass: this.hass, opts: o } as Ctx) : []), ...(o.net_status ?? [])],
      switches: [], cameras: [], cars: [], robots: [], proxmox: [], health: [], agent: [], alerts: [],
      meters: (o.meters ?? []).filter((id) => this.hass!.states[id]?.attributes.state_class === "measurement"),
    };
    const ids = byTab[tab].filter((x): x is string => Boolean(x));
    this.hist
      .ensure(this.hass, ids)
      .then((fresh) => fresh && this.requestUpdate())
      .catch(() => undefined);
  }

  /** Motyw panelu (jasny / ciemny i kolory z motywu HA) do strony agenta w ramce — wygląda wtedy jak reszta panelu.
   *  Same kolory, nic poufnego, więc dowolny odbiorca. */
  private postTheme(frame?: HTMLIFrameElement | null) {
    const target = frame ?? this.renderRoot.querySelector<HTMLIFrameElement>("iframe.agent");
    if (!target?.contentWindow) return;
    const cs = getComputedStyle(this.renderRoot.querySelector(".wrap") ?? this);
    const vars = Object.fromEntries(
      ["--bg", "--surface", "--surface-2", "--line", "--fg", "--muted", "--faint", "--ember", "--ember-soft", "--ok", "--crit", "--shadow"]
        .map((v) => [v, cs.getPropertyValue(v).trim()]),
    );
    target.contentWindow.postMessage({ type: "hearth-theme", dark: Boolean(this.hass?.themes?.darkMode), vars }, "*");
  }

  private measure() {
    const grid = this.renderRoot.querySelector<HTMLElement>(".grid");
    if (!grid) return;
    const n = getComputedStyle(grid).gridTemplateColumns.split(" ").filter(Boolean).length || 1;
    if (n !== this.cols) this.cols = n;
  }

  private toast(text: string) {
    this.toastText = text;
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => (this.toastText = ""), 4000);
  }

  /** Wartość od razu na ekranie, zapis do HA po chwili (seria kliknięć = jedno wywołanie). */
  private setPending(key: string, value: number, send: () => Promise<unknown>) {
    this.pending.set(key, value);
    this.requestUpdate();
    window.clearTimeout(this.timers.get(key));
    this.timers.set(
      key,
      window.setTimeout(async () => {
        try {
          await send();
        } catch (err) {
          this.pending.delete(key);
          this.toast(`Nie udało się zapisać: ${(err as Error)?.message ?? err}`);
        }
        window.setTimeout(() => {
          if (this.pending.get(key) === value) {
            this.pending.delete(key);
            this.requestUpdate();
          }
        }, 15000);
      }, 700),
    );
  }

  private actions: Actions = {
    toggleRoom: (areaId) => {
      this.open = this.open === areaId ? null : areaId;
    },
    setUi: (key: string, value: string) => {
      this.ui = { ...this.ui, [key]: value };
      try {
        localStorage.setItem(UI_KEY, JSON.stringify(this.ui));
      } catch {
        /* bez pamięci przeglądarki */
      }
    },
    openPerson: (entity: string) => {
      this.person = entity;
    },
    moreInfo: (entity: string) => {
      this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId: entity }, bubbles: true, composed: true }));
    },
    stepProfile: (r: Room, p: Profile, delta: number) => {
      const id = r.helpers[PROFILE_HELPER[p]];
      const cur = profileValue(this.hass!, r, p, this.pending);
      if (!id || cur === null) return;
      const a = this.hass!.states[id].attributes;
      const v = clamp(roundStep(cur + delta, num(a.step) ?? 0.5), num(a.min) ?? 5, num(a.max) ?? 30);
      this.setPending(id, v, () => this.hass!.callService("input_number", "set_value", { entity_id: id, value: v }));
    },
    stepClimate: (r: Room, delta: number) => {
      const key = `${r.climate}#t`;
      const cur = this.pending.get(key) ?? climateTarget(this.hass!, r);
      if (cur === null) return;
      const a = this.hass!.states[r.climate].attributes;
      const v = clamp(roundStep(cur + delta, num(a.target_temp_step) ?? 0.5), num(a.min_temp) ?? 5, num(a.max_temp) ?? 30);
      this.setPending(key, v, () => this.hass!.callService("climate", "set_temperature", { entity_id: r.climate, temperature: v }));
    },
    stepHumidity: (entity: string, delta: number) => {
      const key = `${entity}#h`;
      const a = this.hass!.states[entity]?.attributes ?? {};
      const cur = this.pending.get(key) ?? num(a.humidity);
      if (cur === null) return;
      const v = clamp(cur + delta, Math.max(30, num(a.min_humidity) ?? 0), Math.min(90, num(a.max_humidity) ?? 100));
      this.setPending(key, v, () => this.hass!.callService("humidifier", "set_humidity", { entity_id: entity, humidity: v }));
    },
    call: (domain: string, service: string, data: Record<string, unknown>) => {
      this.hass!.callService(domain, service, data).catch((err) => this.toast(`Nie udało się: ${(err as Error)?.message ?? err}`));
    },
    stepNumber: (entity: string, delta: number) => {
      const a = this.hass!.states[entity]?.attributes ?? {};
      const cur = this.pending.get(entity) ?? num(this.hass!.states[entity]?.state);
      if (cur === null) return;
      const step = num(a.step) ?? Math.abs(delta);
      const v = clamp(Number((roundStep(cur + delta, step)).toFixed(6)), num(a.min) ?? -Infinity, num(a.max) ?? Infinity);
      const domain = entity.split(".")[0];
      this.setPending(entity, v, () => this.hass!.callService(domain, "set_value", { entity_id: entity, value: v }));
    },
    stepTarget: (entity: string, delta: number) => {
      const key = `${entity}#t`;
      const a = this.hass!.states[entity]?.attributes ?? {};
      const cur = this.pending.get(key) ?? num(a.temperature);
      if (cur === null) return;
      const v = clamp(roundStep(cur + delta, Math.abs(delta) || 0.5), num(a.min_temp) ?? 5, num(a.max_temp) ?? 80);
      const domain = entity.split(".")[0];
      const zone = this.options.ebusd_zone_topic?.replace(/\/+$/, "");
      if (zone && entity === this.options.climate_heating) {
        // Jak w starej karcie: w trybie ręcznym (heat_cool) zmiana temperatury dziennej, w Auto — Quick Veto,
        // bo zwykła nastawa wraca do harmonogramu przy najbliższym kroku sterownika.
        const pub = (topic: string, payload: string) => this.hass!.callService("mqtt", "publish", { topic: `${zone}${topic}/set`, payload });
        this.setPending(key, v, async () => {
          const t = String(v);
          if (this.hass!.states[entity]?.state === "heat_cool") return pub("ActualRoomTempDesired", t);
          // Kolejność jak w ebusd dla VRC720: najpierw temperatura Veto, potem włączenie trybu. Bez zapisu
          // ActualRoomTempDesired — sterownik ustawia go sam, a zapis z zewnątrz potrafi zakończyć Veto.
          await pub("QuickVetoTemp", t);
          return pub("SFMode", "veto");
        });
        return;
      }
      this.setPending(key, v, () => this.hass!.callService(domain, "set_temperature", { entity_id: entity, temperature: v }));
    },
    setHvac: (entity: string, mode: string) => {
      const domain = entity.split(".")[0];
      const water = domain === "water_heater";
      this.actions.call(domain, water ? "set_operation_mode" : "set_hvac_mode", water ? { entity_id: entity, operation_mode: mode } : { entity_id: entity, hvac_mode: mode });
      const zone = this.options.ebusd_zone_topic?.replace(/\/+$/, "");
      if (zone && entity === this.options.climate_heating && mode !== "off") this.actions.endVeto();
    },
    schedOpen: (c: Circuit, day: number, slots: Slot[]) => {
      this.sched = { circuit: c, day, slots: slots.length ? slots.map((s) => ({ ...s })) : [{ from: "06:00", to: "22:00", temp: c === "hwc" ? 45 : c === "zone" ? 21 : null }] };
    },
    schedEdit: (slots: Slot[]) => {
      if (this.sched) this.sched = { ...this.sched, slots, error: undefined };
    },
    schedClose: () => {
      this.sched = null;
    },
    schedSave: async (days: number[]) => {
      const e = this.sched, cfg = circuits(this.options.ebusd_zone_topic ?? "");
      if (!e || !cfg) return;
      const withTemp = e.circuit !== "cc";
      const slots = [...e.slots].sort((a, b) => a.from.localeCompare(b.from));
      const err = validate(slots, withTemp);
      if (err) {
        this.sched = { ...e, slots, error: err };
        return;
      }
      const prefix = cfg.prefix[e.circuit];
      try {
        for (const d of days)
          for (const w of writes(cfg.base, prefix, DAYS[d], slots, withTemp))
            await this.hass!.callService("mqtt", "publish", { topic: w.topic, payload: w.payload });
        // Odczyt kontrolny: ebusd odpowie bieżącymi wartościami ze sterownika (zachowane tematy się zaktualizują).
        await this.hass!.callService("mqtt", "publish", { topic: `${cfg.base}${prefix}Timer_Timeframes/get`, payload: "" });
        for (const d of days)
          for (let i = 0; i < slots.length; i++)
            await this.hass!.callService("mqtt", "publish", { topic: `${cfg.base}${prefix}Timer_${DAYS[d]}${i}/get`, payload: "" });
        this.sched = null;
        this.toast(`Zapisano harmonogram (${days.length === 1 ? "1 dzień" : `${days.length} dni`}) — sterownik potwierdzi za kilka sekund.`);
      } catch (err) {
        this.sched = { ...e, error: `Nie udało się zapisać: ${(err as Error)?.message ?? err}` };
      }
    },
    endVeto: () => {
      const zone = this.options.ebusd_zone_topic?.replace(/\/+$/, "");
      if (zone) this.actions.call("mqtt", "publish", { topic: `${zone}SFMode/set`, payload: "auto" });
    },
    toast: (text: string) => this.toast(text),
    saveNumbers: (values: Array<[string, number]>, done: string) => {
      Promise.all(values.map(([entity_id, value]) => this.hass!.callService(entity_id.split(".")[0], "set_value", { entity_id, value })))
        .then(() => this.toast(done))
        .catch((err) => this.toast(`Nie udało się zapisać: ${(err as Error)?.message ?? err}`));
    },
    toggleEntity: (entity: string) => {
      this.hass!.callService(entity.split(".")[0], "toggle", { entity_id: entity }).catch((err) =>
        this.toast(`Nie udało się przełączyć: ${(err as Error)?.message ?? err}`),
      );
    },
  };

  private setStyle(s: Style | null) {
    this.localStyle = s;
    try {
      if (s) localStorage.setItem(STYLE_KEY, s);
      else localStorage.removeItem(STYLE_KEY);
    } catch {
      /* pamięć przeglądarki niedostępna — wybór działa do odświeżenia */
    }
  }

  private navigate(path: string) {
    history.pushState(null, "", path);
    window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
  }

  private personDialogTpl(ctx: Ctx) {
    const id = this.person;
    const p = id ? ctx.hass.states[id] : undefined;
    const lat = num(p?.attributes.latitude), lon = num(p?.attributes.longitude);
    const helpers = typeof (window as unknown as { loadCardHelpers?: unknown }).loadCardHelpers === "function";
    return html`<dialog class="set pdlg" aria-labelledby="osoba-tytul" @close=${() => (this.person = null)}
        @click=${(e: Event) => e.target === this.personDialog && this.personDialog?.close()}>
      ${id && p
        ? html`<div class="set-in">
            <div class="dhead"><h2 id="osoba-tytul">${p.attributes.friendly_name ?? id}</h2>
              <button class="btn" type="button" @click=${() => this.personDialog?.close()}>Zamknij</button></div>
            ${personInfo(ctx, id)}
            ${lat === null || lon === null
              ? nothing
              : helpers
                ? html`<div class="pmap" id="pmap"></div>`
                : tileMap(lat, lon, 15, Boolean(ctx.hass.themes?.darkMode))}
          </div>`
        : nothing}
    </dialog>`;
  }

  /** Mapa HA (ta sama co karta „Mapa”) w oknie osoby; tworzona raz na otwarcie, potem dostaje świeży `hass`. */
  private syncPersonMap() {
    const host = this.renderRoot.querySelector<HTMLElement>("#pmap");
    if (!this.person || !host) {
      this.mapFor = null;
      this.mapCard = undefined;
      return;
    }
    if (this.mapCard && this.mapFor === this.person) {
      this.mapCard.hass = this.hass;
      return;
    }
    const person = this.person;
    this.mapFor = person;
    const loader = (window as unknown as { loadCardHelpers?: () => Promise<{ createCardElement(c: object): HTMLElement & { hass?: Hass } }> }).loadCardHelpers;
    loader?.().then((h) => {
      if (this.person !== person) return;
      const card = h.createCardElement({ type: "map", entities: [{ entity: person }], default_zoom: 15, auto_fit: true, theme_mode: "auto" });
      card.hass = this.hass;
      card.style.cssText = "display:block;height:100%";
      host.replaceChildren(card);
      this.mapCard = card;
    });
  }

  private settings(ctx: Ctx) {
    const def = STYLES.includes(this.options.style) ? this.options.style : "tiles";
    const opt = (value: Style | null, title: string, sub: string) => html`<label class="opt">
      <input type="radio" name="styl" .checked=${this.localStyle === value} @change=${() => this.setStyle(value)} />
      <span><b>${title}</b><small>${sub}</small></span>
    </label>`;
    return html`<dialog class="set" aria-labelledby="ust-tytul" @click=${(e: Event) => e.target === this.dialog && this.dialog?.close()}>
      <div class="set-in">
        <h2 id="ust-tytul">Ustawienia panelu</h2>
        <h3>Wygląd kart pokoi na tym urządzeniu</h3>
        <div role="radiogroup" style="display:grid;gap:8px">
          ${opt(null, "Jak w ustawieniach integracji", `teraz: ${STYLE_INFO[def][0]}`)}
          ${STYLES.map((s) => opt(s, STYLE_INFO[s][0], STYLE_INFO[s][1]))}
        </div>
        <div class="rule">Wybór zapamiętuje tylko to urządzenie (przeglądarka albo aplikacja). Styl domyślny dla wszystkich, czujniki na zewnątrz, kocioł i pomocniki ogrzewania ustawisz w ustawieniach integracji.</div>
        ${this.wasteSwitches(ctx)}
        <div class="set-foot">
          ${this.hass?.user?.is_admin
            ? html`<button class="btn" type="button" @click=${() => { this.dialog?.close(); this.navigate("/config/integrations/integration/hearth"); }}>Ustawienia integracji</button>`
            : nothing}
          <button class="btn hot" type="button" @click=${() => this.dialog?.close()}>Gotowe</button>
        </div>
      </div>
    </dialog>`;
  }

  /** Przełączniki frakcji odpadów (pomocniki input_boolean) — wspólne dla wszystkich, działają też w automatyzacjach. */
  private wasteSwitches(ctx: Ctx) {
    const toggles = wasteToggles(ctx);
    if (!toggles.length) return nothing;
    const label = (e: string) => {
      const name = String(ctx.hass.states[e].attributes.friendly_name ?? e);
      for (const cat of ["Biodegradowalne", "Szkło", "Papier i tektura", "Metale i tworzywa sztuczne", "Zmieszane", "Wielkogabarytowe"])
        if (toggleFor(ctx, cat) === e) return cat;
      return name;
    };
    return html`<h3>Odpady</h3>
      ${toggles.map((e) => html`<div class="row">
        <span>${label(e)}<small class="sub">${e} — wyłączony ukrywa frakcję w zakładce Dom i w automatyzacjach, które go sprawdzają</small></span>
        <button class="switch" type="button" role="switch" aria-checked=${ctx.hass.states[e].state === "on" ? "true" : "false"} aria-label="Pokazuj: ${label(e)}"
          @click=${() => ctx.actions.call("input_boolean", "toggle", { entity_id: e })}></button>
      </div>`)}`;
  }

  render() {
    if (!this.hass) return nothing;
    const hass = this.hass;
    const c = clock(hass.config?.time_zone);
    const ctx: Ctx = {
      hass,
      opts: this.options,
      hist: this.hist,
      clock: c,
      nowMinute: c.minuteOfDay(Date.now()),
      pending: this.pending,
      open: this.open,
      actions: this.actions,
      stats: this.stats,
      refresh: () => this.requestUpdate(),
      ui: { ...this.ui, dark: hass.themes?.darkMode ? "1" : "0" },
      sched: this.sched,
      rows: this.rows,
      health: this.panel?.config?.health ?? [],
    };
    const cfg = circuits(this.options.ebusd_zone_topic ?? "");
    if (cfg && this.tab === "boiler") {
      this.ebusd.connect(hass as never, cfg.base, () => this.requestUpdate());
      ctx.timers = {
        week: (c) => this.ebusd.week(cfg.base, cfg.prefix[c]),
        value: (name) => this.ebusd.values.get(`${cfg.base}${cfg.prefix.zone}${name}`),
        connected: this.ebusd.connected,
      };
    }
    const tab = this.tab;
    const alertCount = this.tabs.includes("alerts") ? activeAlerts(ctx).length : 0;
    const nav = html`<nav class="tabs" aria-label="Zakładki">
      ${this.tabs.map((t) => html`<a href="${this.route?.prefix ?? "/hearth"}/${TAB_INFO[t][0]}" class=${t === tab ? "on" : ""} aria-current=${t === tab ? "page" : "false"}
        @click=${(e: MouseEvent) => {
          if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
          e.preventDefault();
          this.navigate(`${this.route?.prefix ?? "/hearth"}/${TAB_INFO[t][0]}`);
        }}>${TAB_INFO[t][1]}${t === "alerts" && alertCount ? html`<span class="tbadge">${alertCount}</span>` : nothing}</a>`)}
    </nav>`;
    const camTick = Math.floor(Date.now() / 5000);
    const views: Record<Tab, () => unknown> = {
      climate: () => this.climate(ctx),
      home: () => homeView(ctx),
      switches: () => switchesView(ctx),
      energy: () => energyView(ctx),
      boiler: () => boilerView(ctx),
      meters: () => metersView(ctx),
      network: () => networkView(ctx),
      cameras: () => camerasView(ctx, camTick),
      cars: () => carsView(ctx),
      robots: () => robotsView(ctx, camTick),
      proxmox: () => proxmoxView(ctx),
      health: () => healthView(ctx),
      agent: () => this.options.agent_url
        ? html`<iframe class="agent" title="Agent" src=${this.options.agent_url} @load=${(e: Event) => this.postTheme(e.target as HTMLIFrameElement)}></iframe>`
        : html`<div class="empty">Podaj adres strony w opcjach Hearth (sekcja Alerty i Agent).</div>`,
      alerts: () => alertsView(ctx),
    };
    const body = views[tab]();

    return html`<div class="wrap s-${this.cardStyle}">
        <header class="top">
          <div class="top-l">
            ${this.narrow
              ? html`<button class="menu" type="button" aria-label="Menu" @click=${() => this.dispatchEvent(new Event("hass-toggle-menu", { bubbles: true, composed: true }))}>${menuIcon}</button>`
              : nothing}
            <h1>${TAB_INFO[tab][1]} <small>${this.options.sidebar_title || "Hearth"}</small></h1>
          </div>
          <button class="gear" type="button" @click=${() => this.dialog?.showModal()}>${gearIcon}<span>Ustawienia panelu</span></button>
        </header>
        ${this.tabs.length > 1 ? nav : nothing}
        ${body}
      </div>
      ${this.settings(ctx)}
      ${this.personDialogTpl(ctx)}
      <div class="toast" role="status" ?hidden=${!this.toastText}>${this.toastText}</div>`;
  }

  private climate(ctx: Ctx) {
    const rooms = this.rooms();
    const style = this.cardStyle;
    const card = style === "list" ? row : style === "dials" ? dial : tile;
    const cols = style === "list" ? 1 : Math.max(1, this.cols);
    const openIdx = rooms.findIndex((r) => r.areaId === this.open);
    const items: unknown[] = style === "list" ? [listHeader] : [];
    rooms.forEach((r, i) => {
      items.push(card(ctx, r));
      const endOfRow = (i + 1) % cols === 0 || i === rooms.length - 1;
      if (openIdx >= 0 && endOfRow && Math.floor(openIdx / cols) === Math.floor(i / cols)) items.push(detail(ctx, rooms[openIdx]));
    });
    const profiles = rooms.some(hasProfiles);
    const anyDevices = rooms.some((r) => devices(ctx, r).length);
    return html`${outdoor(ctx)} ${house(ctx, rooms)}
        ${profiles || anyDevices
          ? html`<div class="legend" aria-label="Legenda">
              ${profiles
                ? html`<span><i style="background:color-mix(in srgb, var(--ember) 55%, transparent)"></i>w domu</span>
                    <span><i style="background:color-mix(in srgb, var(--frost) 45%, transparent)"></i>noc / poza domem</span>
                    <span><i style="background:color-mix(in srgb, var(--bath) 65%, transparent)"></i>wieczór</span>`
                : nothing}
              ${anyDevices ? html`<span><i style="background:var(--air)"></i>praca wentylatora / osuszacza</span>` : nothing}
              <span>Kliknij pokój, żeby zobaczyć ustawienia.</span>
            </div>`
          : nothing}
        ${rooms.length
          ? html`<main class="grid">${items}</main>`
          : html`<div class="empty">Nie znalazłem pokoi. Pokój to obszar Home Assistant z termostatem (encja climate.*) — przypisz głowice do obszarów w ustawieniach urządzeń.</div>`}
        <p class="foot">${FOOT[style]}</p>
    `;
  }
}

// Po aktualizacji HA podaje nowy adres pliku, a w otwartej karcie stara klasa już jest zarejestrowana —
// drugie define() rzuciłoby błąd. Nowa wersja zadziała po odświeżeniu strony.
if (!customElements.get("hearth-panel")) customElements.define("hearth-panel", HearthPanel);

declare global {
  interface HTMLElementTagNameMap {
    "hearth-panel": HearthPanel;
  }
}
