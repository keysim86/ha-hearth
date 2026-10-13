// Panel Hearth — zakładka Klimat. Pokoje z obszarów HA, trzy style kart, ustawienia na urządzeniu.

import { LitElement, html, nothing, type PropertyValues } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import { clock, num } from "./format";
import { HistoryStore } from "./history";
import { climateTarget, discoverRooms, hasProfiles, profileValue, PROFILE_HELPER, type Profile, type Room } from "./model";
import { styles } from "./styles";
import { gearIcon, menuIcon } from "./svg";
import type { Hass, Options, PanelInfo, Style } from "./types";
import type { Actions, Ctx } from "./views/common";
import { devices } from "./views/common";
import { detail } from "./views/detail";
import { dial } from "./views/dials";
import { house } from "./views/house";
import { listHeader, row } from "./views/list";
import { outdoor } from "./views/outdoor";
import { tile } from "./views/tiles";

const STYLES: Style[] = ["tiles", "list", "dials"];
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
const FONTS_ID = "hearth-fonts";
const FONTS_URL =
  "https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..800&family=Atkinson+Hyperlegible:wght@400;700" +
  "&family=JetBrains+Mono:wght@400;600;800&family=Bricolage+Grotesque:opsz,wght@12..96,400..800&display=swap";

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

@customElement("hearth-panel")
export class HearthPanel extends LitElement {
  static styles = styles;

  @property({ attribute: false }) hass?: Hass;
  @property({ type: Boolean, reflect: true }) narrow = false;
  @property({ attribute: false }) panel?: PanelInfo;

  @state() private open: string | null = null;
  @state() private cols = 1;
  @state() private localStyle: Style | null = readStyle();
  @state() private toastText = "";

  @query("dialog") private dialog?: HTMLDialogElement;

  private hist = new HistoryStore();
  private pending = new Map<string, number>();
  private timers = new Map<string, number>();
  private roomsCache?: { key: unknown[]; rooms: Room[] };
  private tick?: number;
  private toastTimer?: number;
  private resize?: ResizeObserver;

  private get options(): Options {
    return { style: "tiles", ...(this.panel?.config?.options ?? {}) } as Options;
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
    this.tick = window.setInterval(() => this.requestUpdate(), 60e3);
    this.resize = new ResizeObserver(() => this.measure());
    this.resize.observe(this);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
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

  protected updated() {
    this.measure();
    if (!this.hass) return;
    const o = this.options;
    const ids = [
      ...this.rooms().flatMap((r) => [r.temp, ...r.fans, ...r.dehumidifiers.flatMap((d) => [d.entity, d.power, d.energy])]),
      o.outdoor_temperature, o.outdoor_pressure, o.outdoor_illuminance, o.outdoor_pm25,
    ].filter((x): x is string => Boolean(x));
    this.hist
      .ensure(this.hass, ids)
      .then((fresh) => fresh && this.requestUpdate())
      .catch(() => undefined);
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

  private settings() {
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
        <div class="set-foot">
          ${this.hass?.user?.is_admin
            ? html`<button class="btn" type="button" @click=${() => { this.dialog?.close(); this.navigate("/config/integrations/integration/hearth"); }}>Ustawienia integracji</button>`
            : nothing}
          <button class="btn hot" type="button" @click=${() => this.dialog?.close()}>Gotowe</button>
        </div>
      </div>
    </dialog>`;
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
    };
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
    return html`<div class="wrap s-${style}">
        <header class="top">
          <div class="top-l">
            ${this.narrow
              ? html`<button class="menu" type="button" aria-label="Menu" @click=${() => this.dispatchEvent(new Event("hass-toggle-menu", { bubbles: true, composed: true }))}>${menuIcon}</button>`
              : nothing}
            <h1>Klimat <small>${this.options.sidebar_title || "Hearth"}</small></h1>
          </div>
          <button class="gear" type="button" @click=${() => this.dialog?.showModal()}>${gearIcon}Ustawienia panelu</button>
        </header>
        ${outdoor(ctx)} ${house(ctx, rooms)}
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
      </div>
      ${this.settings()}
      <div class="toast" role="status" ?hidden=${!this.toastText}>${this.toastText}</div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "hearth-panel": HearthPanel;
  }
}
