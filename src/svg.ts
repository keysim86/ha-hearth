// Wykresy SVG: łuk (kafelki), skala (lista), pierścień (pokrętła), linie 24 h i paski pracy.

import { html, svg, nothing, type TemplateResult } from "lit";
import { num, tempColor } from "./format";
import type { Point } from "./history";

const DAY = 24 * 3600e3;

export function gauge(t: number | null, z: number | null): TemplateResult {
  const W = 112, H = 72, cx = 56, cy = 62, r = 48, min = 16, max = 28;
  const ang = (v: number) => Math.PI * (1 - (Math.max(min, Math.min(max, v)) - min) / (max - min));
  const pt = (a: number, rr: number) => [cx + rr * Math.cos(a), cy - rr * Math.sin(a)];
  const arc = (a0: number, a1: number) => {
    const [x0, y0] = pt(a0, r), [x1, y1] = pt(a1, r);
    return `M${x0.toFixed(1)} ${y0.toFixed(1)} A${r} ${r} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  };
  const mark = z === null ? null : [pt(ang(z), r - 9), pt(ang(z), r + 9)];
  return html`<svg class="gauge" viewBox="0 0 ${W} ${H}" aria-hidden="true">
    <path d=${arc(Math.PI, 0)} fill="none" stroke="var(--surface-2)" stroke-width="9" stroke-linecap="round"></path>
    ${t === null ? nothing : svg`<path d=${arc(Math.PI, ang(t))} fill="none" stroke=${tempColor(t)} stroke-width="9" stroke-linecap="round"></path>`}
    ${mark === null ? nothing : svg`<line x1=${mark[0][0]} y1=${mark[0][1]} x2=${mark[1][0]} y2=${mark[1][1]} stroke="var(--fg)" stroke-width="2.5" stroke-linecap="round"></line>`}
    <text x=${cx - r} y=${H - 1} font-size="9" fill="var(--faint)" text-anchor="middle">${min}</text>
    <text x=${cx + r} y=${H - 1} font-size="9" fill="var(--faint)" text-anchor="middle">${max}</text>
  </svg>`;
}

/** Punkty liczbowe na odcinku [teraz − 24 h, teraz], z wartością sprzed okna na początku. */
function numeric(points: Point[], t0: number, t1: number): Array<[number, number]> {
  const all = points.map(([t, v]) => [t, num(v)] as [number, number | null]).filter((x): x is [number, number] => x[1] !== null);
  if (all.length < 1) return [];
  let last = all[0][1];
  const pts: Array<[number, number]> = [];
  for (const [t, v] of all) {
    if (t < t0) {
      last = v;
      continue;
    }
    pts.push([t, v]);
  }
  pts.unshift([t0, last]);
  pts.push([t1, pts[pts.length - 1][1]]);
  return pts;
}

/** Wykres temperatury pokoju (schodki) z przerywaną linią celu. */
export function spark(points: Point[], z: number | null, cls = "spark"): TemplateResult | typeof nothing {
  const t1 = Date.now(), t0 = t1 - DAY;
  const pts = numeric(points, t0, t1);
  if (pts.length < 3) return nothing;
  const vals = pts.map((x) => x[1]).concat(z !== null ? [z] : []);
  const lo = Math.min(...vals) - 0.3, hi = Math.max(...vals) + 0.3;
  const W = 300, H = 46;
  const X = (t: number) => ((t - t0) / (t1 - t0)) * W;
  const Y = (v: number) => H - 3 - ((v - lo) / (hi - lo)) * (H - 8);
  let d = "";
  pts.forEach(([t, v], i) => (d += i ? `H${X(t).toFixed(1)}V${Y(v).toFixed(1)}` : `M0 ${Y(v).toFixed(1)}`));
  const last = pts[pts.length - 1][1];
  const col = tempColor(last);
  return html`<svg class=${cls} viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-label="Temperatura w ostatnich 24 godzinach" role="img">
    <path d="${d}V${H}H0Z" fill=${col} opacity=".12"></path>
    ${z === null ? nothing : svg`<line x1="0" x2=${W} y1=${Y(z)} y2=${Y(z)} stroke="var(--faint)" stroke-dasharray="3 4" stroke-width="1" vector-effect="non-scaling-stroke"></line>`}
    <path d=${d} fill="none" stroke=${col} stroke-width="2" vector-effect="non-scaling-stroke"></path>
  </svg>`;
}

/** Linia 24 h dla czujników zewnętrznych (ciśnienie, PM, temperatura). */
export function line(
  points: Point[],
  color: string,
  o: { lo?: number; hi?: number; min?: number; marks?: Array<[number, string]> } = {},
): TemplateResult | typeof nothing {
  const t1 = Date.now(), t0 = t1 - DAY;
  const pts = numeric(points, t0, t1);
  if (pts.length < 3) return nothing;
  const vals = pts.map((x) => x[1]);
  let lo = o.lo ?? Math.min(...vals), hi = Math.max(...vals, o.hi ?? -Infinity);
  const span = o.min ?? 1;
  if (hi - lo < span) {
    const c = (hi + lo) / 2;
    lo = c - span / 2;
    hi = c + span / 2;
  }
  const W = 300, H = 34;
  const X = (t: number) => ((t - t0) / DAY) * W;
  const Y = (v: number) => H - 2 - ((v - lo) / (hi - lo)) * (H - 6);
  let d = "";
  pts.forEach(([t, v], i) => (d += i ? `L${X(t).toFixed(1)} ${Y(v).toFixed(1)}` : `M0 ${Y(v).toFixed(1)}`));
  return html`<svg class="ospark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
    <path d="${d}V${H}H0Z" fill=${color} opacity=".13"></path>
    ${(o.marks ?? []).filter(([v]) => v > lo && v < hi).map(
      ([v, k]) => svg`<line x1="0" x2=${W} y1=${Y(v)} y2=${Y(v)} stroke=${k} stroke-dasharray="3 4" vector-effect="non-scaling-stroke"></line>`,
    )}
    <path d=${d} fill="none" stroke=${color} stroke-width="1.8" vector-effect="non-scaling-stroke"></path>
  </svg>`;
}

export interface Segment {
  k: "k" | "e" | "w";
  minutes: number;
}

/** Oś dnia: komfort / noc / wieczór z kreską „teraz”. */
export function timeline(segs: Segment[], nowMinute: number, ticks = true): TemplateResult {
  return html`<div class="timeline">
    <div class="tbar">
      ${segs.map((s) => html`<span class=${s.k} style="width:${((s.minutes / 1440) * 100).toFixed(2)}%"></span>`)}
      <i class="tnow" style="left:calc(${((nowMinute / 1440) * 100).toFixed(2)}% - 1px)"></i>
    </div>
    ${ticks ? html`<div class="tticks"><span>0</span><span>6</span><span>12</span><span>18</span><span>24</span></div>` : nothing}
  </div>`;
}

/** Skala 16–28 °C (styl Lista): kreska = cel, kropka = pomiar, odcinek = różnica. */
export function scale(t: number | null, z: number | null): TemplateResult {
  const W = 300, lo = 16, hi = 28, y = 18;
  const X = (v: number) => 6 + ((Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo)) * (W - 12);
  const ticks = [];
  for (let v = lo; v <= hi; v += 2) ticks.push(v);
  const brak = t !== null && z !== null && t < z;
  return html`<div class="lscale">
    <svg class="scale" viewBox="0 0 ${W} 38" preserveAspectRatio="none" aria-hidden="true">
      <line x1="6" x2=${W - 6} y1=${y} y2=${y} stroke="var(--line)" stroke-width="4" stroke-linecap="round" vector-effect="non-scaling-stroke"></line>
      ${ticks.map((v) => svg`<line x1=${X(v)} x2=${X(v)} y1=${y + 5} y2=${y + 8} stroke="var(--faint)" vector-effect="non-scaling-stroke"></line>`)}
      ${t !== null && z !== null
        ? svg`<line x1=${X(Math.min(t, z))} x2=${X(Math.max(t, z))} y1=${y} y2=${y} stroke=${brak ? "var(--ember)" : tempColor(t)} stroke-width="4" stroke-linecap="round" opacity=${brak ? 1 : 0.55} vector-effect="non-scaling-stroke"></line>`
        : nothing}
      ${z !== null ? svg`<line x1=${X(z)} x2=${X(z)} y1=${y - 9} y2=${y + 9} stroke="var(--fg)" stroke-width="2" vector-effect="non-scaling-stroke"></line>` : nothing}
      ${t !== null ? svg`<circle cx=${X(t)} cy=${y} r="5.5" fill=${tempColor(t)} stroke="var(--surface)" stroke-width="2" vector-effect="non-scaling-stroke"></circle>` : nothing}
    </svg>
    <div class="tticks"><span>16</span><span>20</span><span>24</span><span>28</span></div>
  </div>`;
}

/** Pierścień 270° (styl Pokrętła), zakres 14–30 °C, białe kółko = cel. */
export function ring(t: number | null, z: number | null, label: string, tText: string): TemplateResult {
  const cx = 100, cy = 100, r = 78, a0 = 135, span = 270, lo = 14, hi = 30;
  const fr = (v: number) => (Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo);
  const pt = (deg: number, rr: number) => {
    const a = (deg * Math.PI) / 180;
    return [cx + rr * Math.cos(a), cy + rr * Math.sin(a)];
  };
  const arc = (d0: number, d1: number) => {
    const [x0, y0] = pt(d0, r), [x1, y1] = pt(d1, r);
    return `M${x0.toFixed(1)} ${y0.toFixed(1)} A${r} ${r} 0 ${d1 - d0 > 180 ? 1 : 0} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  };
  const ticks = [];
  for (let v = lo; v <= hi; v++) {
    const d = a0 + span * fr(v), [x0, y0] = pt(d, r + 13), [x1, y1] = pt(d, r + (v % 2 ? 16 : 19));
    ticks.push(svg`<line x1=${x0} y1=${y0} x2=${x1} y2=${y1} stroke="var(--faint)" stroke-width=${v % 2 ? 1 : 1.6} stroke-linecap="round" opacity=".7"></line>`);
  }
  const knob = z === null ? null : pt(a0 + span * fr(z), r);
  return html`<svg class="ring" viewBox="0 0 200 200" aria-hidden="true">
    ${ticks}
    <path d=${arc(a0, a0 + span)} fill="none" stroke="var(--ring-track)" stroke-width="14" stroke-linecap="round"></path>
    ${t === null ? nothing : svg`<path d=${arc(a0, a0 + Math.max(1, span * fr(t)))} fill="none" stroke=${tempColor(t)} stroke-width="14" stroke-linecap="round"></path>`}
    ${knob === null ? nothing : svg`<circle cx=${knob[0]} cy=${knob[1]} r="9" fill="var(--surface)" stroke="var(--fg)" stroke-width="2.5"></circle>`}
    <text x=${cx} y=${cy + 8} text-anchor="middle" fill=${tempColor(t)}><tspan class="tv">${tText}</tspan><tspan class="tu" dy="-18">°</tspan></text>
    <text class="tl" x=${cx} y=${cy + 32} text-anchor="middle" fill="var(--muted)">${label}</text>
  </svg>`;
}

/** Pasek pracy urządzenia w ostatnich 24 h. */
export function activity(periods: Array<[number, number]>): TemplateResult {
  const t0 = Date.now() - DAY;
  return html`<div class="hbar">
    ${periods.map(([a, b]) => html`<i style="left:${(((a - t0) / DAY) * 100).toFixed(2)}%;width:${(((b - a) / DAY) * 100).toFixed(2)}%"></i>`)}
  </div>`;
}

/** Łuk słońca od wschodu do zachodu; kropka tylko w dzień. */
export function sunArc(fraction: number | null): TemplateResult {
  const f = fraction;
  return html`<svg class="sunarc" viewBox="0 0 300 56" preserveAspectRatio="none" aria-hidden="true">
    <line x1="0" x2="300" y1="50" y2="50" stroke="var(--line)" vector-effect="non-scaling-stroke"></line>
    <path d="M10 50 Q150 -30 290 50" fill="none" stroke="var(--warn)" stroke-dasharray="3 4" opacity=".7" vector-effect="non-scaling-stroke"></path>
    ${f === null ? nothing : svg`<circle cx=${10 + f * 280} cy=${50 - Math.sin(Math.PI * f) * 40} r="6" fill="var(--warn)"></circle>`}
  </svg>`;
}

export const ICONS = {
  drop: svg`<path d="M8 1.5C6 4.5 3.5 7 3.5 9.8A4.5 4.5 0 0 0 12.5 9.8C12.5 7 10 4.5 8 1.5Z" fill="currentColor"></path>`,
  valve: svg`<circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.6"></circle><path d="M8 4v4l2.5 2" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"></path>`,
  batt: svg`<rect x="1.5" y="4.5" width="11" height="7" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.4"></rect><rect x="13" y="6.5" width="1.6" height="3" rx=".5" fill="currentColor"></rect><rect x="3" y="6" width="8" height="4" rx=".6" fill="currentColor"></rect>`,
  win: svg`<rect x="2.5" y="1.5" width="11" height="13" rx="1" fill="none" stroke="currentColor" stroke-width="1.4"></rect><path d="M8 1.5v13M2.5 8h11" stroke="currentColor" stroke-width="1.4"></path>`,
};

export const icon = (name: keyof typeof ICONS) => html`<svg viewBox="0 0 16 16" aria-hidden="true">${ICONS[name]}</svg>`;

export const flame = html`<svg class="flame" viewBox="0 0 10 12" aria-hidden="true"><path d="M5 0C5.6 2.6 9 4.2 9 7.6A4 4 0 0 1 1 7.6C1 5.8 2.2 4.6 3 3.6 3.2 5 4 5.6 4.6 5.6 4.6 3.8 4.2 1.8 5 0Z" fill="currentColor"></path></svg>`;

export const fanIcon = html`<svg viewBox="0 0 24 24" aria-hidden="true" class="fanico"><path fill="currentColor" d="M12 10.6a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8Zm.6-1.5c.3-2.6 1-5.7 3.6-6.1 2.4-.4 3.6 2.4 1.9 4.2-1.4 1.4-3.4 2-5.5 1.9Zm2.3 4.2c2.4 1 5.3 2.5 5 5.1-.3 2.4-3.3 2.8-4.3.6-.8-1.8-.9-3.9-.7-5.7Zm-4.2 1.9c-2 1.6-4.7 3.4-6.9 2-2-1.4-.9-4.2 1.5-4.3 2-.1 3.9.9 5.4 2.3Z"></path></svg>`;

export const dryIcon = html`<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" d="M12 3c-2.6 3.8-6 7.2-6 10.8a6 6 0 0 0 12 0C18 10.2 14.6 6.8 12 3Z"></path><path d="M9 14h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path></svg>`;

export const gearIcon = html`<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 8.6a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8Zm8.4 4.9-.1-1.5 2-1.6-2-3.4-2.4.8a8 8 0 0 0-2.6-1.5L14.8 4h-3.9l-.5 2.4a8 8 0 0 0-2.6 1.5l-2.4-.8-2 3.4 2 1.6-.1 1.5.1 1.5-2 1.6 2 3.4 2.4-.8a8 8 0 0 0 2.6 1.5l.5 2.4h3.9l.5-2.4a8 8 0 0 0 2.6-1.5l2.4.8 2-3.4-2-1.6.1-1.5Z"></path></svg>`;

export const menuIcon = html`<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3 6h18v2H3zm0 5h18v2H3zm0 5h18v2H3z"></path></svg>`;

// ---- wykresy zakładek Energia / Kocioł / Liczniki ----

export interface Bar {
  /** Podpis pod słupkiem (krótki: dzień miesiąca, skrót miesiąca). */
  label: string;
  /** Pełny opis w podpowiedzi („pon 13.10”, „październik 2026”). */
  title?: string;
  values: number[];
  now?: boolean;
}

/** Zaokrąglenie maksimum osi w górę do „ładnej” liczby (1, 2, 2,5, 5 × 10^n). */
function niceMax(v: number): number {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  return ([1, 2, 2.5, 5, 10].find((m) => m * p >= v) ?? 10) * p;
}

/** Słupki (warstwowe, gdy w `values` jest kilka serii) z osią wartości, podpisami i podpowiedzią po najechaniu
 *  albo dotknięciu (kolumna dostaje fokus). `names` = nazwy serii do rozbicia w podpowiedzi. */
export function bars(
  data: Bar[],
  colors: string[],
  o: { unit?: string; every?: number; height?: number; digits?: number; names?: string[]; valueLabels?: boolean | "dense" } = {},
): TemplateResult {
  const total = (d: Bar) => d.values.reduce((a, b) => a + Math.max(0, b), 0);
  const top = niceMax(Math.max(...data.map(total), 0));
  const ticks = [top, top / 2, 0];
  const every = o.every ?? Math.ceil(data.length / 12);
  const fmt = (v: number) => v.toLocaleString("pl-PL", { maximumFractionDigits: o.digits ?? 1 });
  const unit = o.unit ? ` ${o.unit}` : "";
  const edge = (i: number) => (i < 3 ? "l" : i > data.length - 4 ? "r" : "");
  // Gęste etykiety (np. 30 dni): bez części dziesiętnych od 10 w górę, żeby się mieściły nad wąskim słupkiem.
  const label = (v: number) => (o.valueLabels === "dense" && v >= 10 ? Math.round(v).toLocaleString("pl-PL") : fmt(v));
  return html`<div class="bwrap"><div class="bchart ${o.valueLabels === "dense" ? "dense" : ""}" style="--bh:${o.height ?? 140}px">
    <div class="byaxis" aria-hidden="true">${ticks.map((t) => html`<span style="bottom:${(t / top) * 100}%">${fmt(t)}</span>`)}</div>
    <div class="bplot">
      ${ticks.map((t) => html`<i class="bgrid" style="bottom:${(t / top) * 100}%"></i>`)}
      ${data.map((d, i) => {
        const sum = total(d);
        return html`<div class="bcol ${d.now ? "now" : ""} ${edge(i)}" tabindex="0" aria-label="${d.title ?? d.label}: ${fmt(sum)}${unit}">
          <div class="bstack" style="height:${((sum / top) * 100).toFixed(2)}%">
            ${d.values.map((v, k) => (v > 0 ? html`<span style="flex:${v};background:${colors[k % colors.length]}"></span>` : nothing))}
            ${o.valueLabels && sum > 0 ? html`<em class="bval">${label(sum)}</em>` : nothing}
          </div>
          <span class="blab">${i % every === 0 || d.now ? d.label : ""}</span>
          <div class="btip" role="tooltip">
            <b>${d.title ?? d.label}</b>
            <span class="btot">${fmt(sum)}${unit}</span>
            ${o.names && o.names.length > 1
              ? d.values.map((v, k) => (v > 0 ? html`<span class="bser"><i style="background:${colors[k % colors.length]}"></i>${o.names![k]} <b>${fmt(v)}</b></span>` : nothing))
              : nothing}
          </div>
        </div>`;
      })}
    </div>
  </div></div>`;
}

export interface Series {
  name: string;
  color: string;
  points: Point[];
  dashed?: boolean;
}

/** Kilka linii z ostatnich 24 h na wspólnej skali (np. zasilanie, powrót, zewnątrz). Po najechaniu / dotknięciu
 *  przedziału (pół godziny) podpowiedź z godziną i wartościami; w legendzie wartości bieżące. */
export function multiLine(series: Series[], o: { unit?: string; height?: number } = {}): TemplateResult | typeof nothing {
  const t1 = Date.now(), t0 = t1 - DAY;
  const lines = series.map((s) => ({ ...s, pts: numeric(s.points, t0, t1) })).filter((s) => s.pts.length > 2);
  if (!lines.length) return nothing;
  const vals = lines.flatMap((s) => s.pts.map((p) => p[1]));
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (hi - lo < 2) { lo -= 1; hi += 1; }
  const W = 600, H = o.height ?? 150, pad = 6;
  const X = (t: number) => ((t - t0) / DAY) * W;
  const Y = (v: number) => H - pad - ((v - lo) / (hi - lo)) * (H - 2 * pad);
  const path = (pts: Array<[number, number]>) => pts.map(([t, v], i) => `${i ? "L" : "M"}${X(t).toFixed(1)} ${Y(v).toFixed(1)}`).join("");
  const at = (pts: Array<[number, number]>, t: number) => {
    let v = pts[0][1];
    for (const [pt, pv] of pts) { if (pt > t) break; v = pv; }
    return v;
  };
  const f = (v: number) => v.toLocaleString("pl-PL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const u = o.unit ?? "";
  const hm = new Intl.DateTimeFormat("pl-PL", { hour: "2-digit", minute: "2-digit" });
  const SLOTS = 48;
  return html`<div class="mline">
    <div class="mplot">
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Wykres z ostatnich 24 godzin">
        ${[0.25, 0.5, 0.75].map((fr) => svg`<line x1=${W * fr} x2=${W * fr} y1="0" y2=${H} stroke="var(--line)" stroke-dasharray="2 5" vector-effect="non-scaling-stroke"></line>`)}
        ${lines.map((s) => svg`<path d=${path(s.pts)} fill="none" stroke=${s.color} stroke-width="2" stroke-dasharray=${s.dashed ? "5 4" : "none"} vector-effect="non-scaling-stroke"></path>`)}
      </svg>
      ${[...Array(SLOTS).keys()].map((i) => {
        const t = t0 + ((i + 0.5) / SLOTS) * DAY;
        const edge = i < 6 ? "l" : i > SLOTS - 7 ? "r" : "";
        return html`<div class="mslot ${edge}" tabindex="0" style="left:${(i / SLOTS) * 100}%;width:${100 / SLOTS}%">
          <i class="mcross"></i>
          <div class="btip" role="tooltip"><b>${hm.format(t)}</b>
            ${lines.map((s) => html`<span class="bser"><i style="background:${s.color}"></i>${s.name} <b>${f(at(s.pts, t))}${u}</b></span>`)}</div>
        </div>`;
      })}
    </div>
    <div class="mlabels"><span>${f(hi)}${u}</span><span>${f(lo)}${u}</span></div>
    <div class="mlegend">${lines.map((s) => html`<span><i style="background:${s.color}"></i>${s.name} <b>${f(s.pts[s.pts.length - 1][1])}${u}</b></span>`)}<span class="tt">−24 h … teraz</span></div>
  </div>`;
}

/** Ikony pogody (proste, w kolorach motywu). */
export function weatherIcon(kind: string): TemplateResult {
  const sun = svg`<circle cx="12" cy="12" r="4.2" fill="var(--warn)"></circle>${[0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
    const r = (a * Math.PI) / 180;
    return svg`<line x1=${12 + Math.cos(r) * 6.5} y1=${12 + Math.sin(r) * 6.5} x2=${12 + Math.cos(r) * 9} y2=${12 + Math.sin(r) * 9} stroke="var(--warn)" stroke-width="1.8" stroke-linecap="round"></line>`;
  })}`;
  const cloud = (dx = 0, dy = 0, fill = "var(--faint)") =>
    svg`<path transform="translate(${dx} ${dy})" d="M7 18h10a4 4 0 0 0 .4-8A5.5 5.5 0 0 0 6.8 11 3.5 3.5 0 0 0 7 18Z" fill=${fill}></path>`;
  const drops = svg`${[8, 12, 16].map((x) => svg`<line x1=${x} y1="19.5" x2=${x - 1.2} y2="22.5" stroke="var(--frost)" stroke-width="1.8" stroke-linecap="round"></line>`)}`;
  const flakes = svg`${[8, 12, 16].map((x) => svg`<circle cx=${x} cy="21" r="1.3" fill="var(--frost)"></circle>`)}`;
  const parts: Record<string, unknown> = {
    sun,
    partly: svg`<g transform="translate(-3 -3) scale(.8)">${sun}</g>${cloud(2, 1)}`,
    cloud: cloud(0, 0),
    fog: svg`${cloud(0, -2)}${[18, 21].map((y) => svg`<line x1="5" x2="19" y1=${y} y2=${y} stroke="var(--faint)" stroke-width="1.6" stroke-linecap="round"></line>`)}`,
    rain: svg`${cloud(0, -2)}${drops}`,
    snow: svg`${cloud(0, -2)}${flakes}`,
    storm: svg`${cloud(0, -2, "var(--muted)")}<path d="M12 15l-2.5 4.5h3L11 23.5l4.5-6h-3l1.5-2.5Z" fill="var(--warn)"></path>`,
  };
  return html`<svg class="wico" viewBox="0 0 24 24" aria-hidden="true">${parts[kind] ?? parts.cloud}</svg>`;
}

export const gateIcon = html`<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" d="M3 21V8l9-5 9 5v13M7 21v-9h10v9M7 15h10M7 18h10"></path></svg>`;
export const doorIcon = html`<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" d="M6 21V4h12v17M3 21h18M14.5 12.5h.01"></path></svg>`;
export const mailIcon = html`<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" d="M4 7h16v11H4zM4 7l8 6 8-6"></path></svg>`;
export const boltIcon = html`<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z"></path></svg>`;
export const steps = html`<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M5 1.5c1.3 0 2 1.5 2 3.2 0 1.5-.6 2.6-1.8 2.6S3.4 6.2 3.4 4.7C3.4 3 4 1.5 5 1.5Zm-1.4 7h3l-.3 2.3c-.2 1-.9 1.6-1.6 1.6-.8 0-1.4-.7-1.3-1.6Zm7.4-4c1 0 1.6 1.5 1.6 3.2 0 1.5-.8 2.6-1.8 2.6S9 9.2 9 7.7C9 6 9.9 4.5 11 4.5Zm-1.4 7h3l-.2 2.3c-.1 1-.8 1.6-1.6 1.6s-1.3-.7-1.2-1.6Z"></path></svg>`;

// ---- wykresy zakładki Zdrowie: dowolna oś X (czas albo wiek), pasma, kreski progów, punkty ----

export interface XYLine {
  name: string;
  color: string;
  pts: Array<[number, number | null]>;
  dashed?: boolean;
  fill?: boolean;
  dots?: boolean;
  /** Tylko w podpowiedzi (np. kategoria), bez linii. */
  hidden?: boolean;
  unit?: string;
}
export interface XYBand {
  color: string;
  lo: Array<[number, number]>;
  hi: Array<[number, number]>;
  /** false = pasmo nie rozciąga osi (skrajne pasma siatek sięgają do krawędzi wykresu). */
  fit?: boolean;
}
export interface XYMark {
  v: number;
  color: string;
  label?: string;
  /** false = kreska tylko gdy mieści się w zakresie danych (nie rozciąga osi). */
  fit?: boolean;
}

function niceStep(span: number, n = 4): number {
  const raw = span / n;
  const p = 10 ** Math.floor(Math.log10(raw));
  return ([1, 2, 2.5, 5, 10].find((m) => m * p >= raw) ?? 10) * p;
}

/** Wykres liniowy z osią wartości, podpisami osi X, pasmami (siatki centylowe), kreskami progów i podpowiedzią po
 *  najechaniu / dotknięciu. `xfmt` podpisuje oś X, `tipfmt` nagłówek podpowiedzi. */
export function xyChart(o: {
  lines: XYLine[];
  bands?: XYBand[];
  marks?: XYMark[];
  points?: Array<{ x: number; y: number; color: string; label: string }>;
  x0?: number;
  x1?: number;
  minSpan?: number;
  unit?: string;
  digits?: number;
  height?: number;
  xfmt: (x: number) => string;
  tipfmt?: (x: number) => string;
  xticks?: number[];
}): TemplateResult | typeof nothing {
  const lines = o.lines.filter((l) => l.pts.some(([, v]) => v !== null));
  if (!lines.length && !o.bands?.length) return nothing;
  const xs = lines.flatMap((l) => l.pts.filter(([, v]) => v !== null).map(([x]) => x));
  const x0 = o.x0 ?? Math.min(...xs), x1 = Math.max(o.x1 ?? Math.max(...xs), x0 + 1);
  const vals = [
    ...lines.filter((l) => !l.hidden).flatMap((l) => l.pts.map(([, v]) => v).filter((v): v is number => v !== null)),
    ...(o.bands ?? []).filter((b) => b.fit !== false).flatMap((b) => [...b.lo, ...b.hi].filter(([x]) => x >= x0 && x <= x1).map(([, v]) => v)),
    ...(o.marks ?? []).filter((m) => m.fit !== false).map((m) => m.v),
    ...(o.points ?? []).map((p) => p.y),
  ];
  let lo = Math.min(...vals), hi = Math.max(...vals);
  const minSpan = o.minSpan ?? 1;
  if (hi - lo < minSpan) {
    const c = (hi + lo) / 2;
    lo = c - minSpan / 2;
    hi = c + minSpan / 2;
  }
  const step = niceStep(hi - lo);
  lo = Math.floor(lo / step) * step;
  hi = Math.ceil(hi / step) * step;
  if (hi === lo) hi = lo + step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 1e6; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  const W = 600, H = o.height ?? 180;
  const X = (x: number) => ((x - x0) / (x1 - x0)) * W;
  const Y = (v: number) => H - ((v - lo) / (hi - lo)) * H;
  const pct = (x: number) => `${((X(x) / W) * 100).toFixed(2)}%`;
  const fmt = (v: number, unit = o.unit) => `${v.toLocaleString("pl-PL", { maximumFractionDigits: o.digits ?? 1 })}${unit ? ` ${unit}` : ""}`;
  const path = (pts: Array<[number, number | null]>) => {
    let d = "", pen = false;
    for (const [x, v] of pts) {
      if (v === null) { pen = false; continue; }
      d += `${pen ? "L" : "M"}${X(x).toFixed(1)} ${Y(v).toFixed(1)}`;
      pen = true;
    }
    return d;
  };
  const band = (b: XYBand) => {
    const top = b.hi.map(([x, v]) => `${X(x).toFixed(1)} ${Y(Math.min(hi, Math.max(lo, v))).toFixed(1)}`);
    const bottom = [...b.lo].reverse().map(([x, v]) => `${X(x).toFixed(1)} ${Y(Math.min(hi, Math.max(lo, v))).toFixed(1)}`);
    return `M${[...top, ...bottom].join("L")}Z`;
  };
  const marks = (o.marks ?? []).filter((m) => m.v >= lo && m.v <= hi);
  // Podpisy kresek bez nachodzenia: najpierw te, które rozciągają oś (np. najbliższy cel), potem reszta z góry na dół.
  // Podpis po tej stronie wykresu, gdzie linia danych jest dalej od kreski (nie zasłania końca serii).
  const main = lines.find((l) => !l.hidden);
  const clearance = (v: number, from: number, to: number) =>
    Math.min(Infinity, ...(main?.pts ?? []).filter(([x, y]) => y !== null && x >= from && x <= to).map(([, y]) => Math.abs(Y(y!) - Y(v))));
  const side = (v: number) => (clearance(v, x0, x0 + (x1 - x0) * 0.3) > clearance(v, x1 - (x1 - x0) * 0.3, x1) ? "left" : "");
  const labeled: XYMark[] = [];
  for (const m of [...marks].filter((x) => x.label).sort((a, b) => Number(b.fit !== false) - Number(a.fit !== false) || b.v - a.v))
    if (labeled.every((k) => Math.abs(Y(k.v) - Y(m.v)) >= 13)) labeled.push(m);
  // Przedziały podpowiedzi: jeden na punkt (do 60), gęstsze serie grupowane w 60 okien.
  const uniq = [...new Set(xs)].sort((a, b) => a - b);
  const SL = Math.min(60, uniq.length);
  const slotXs = uniq.length <= 60 ? uniq : [...Array(SL).keys()].map((i) => {
    const a = x0 + ((x1 - x0) * i) / SL, b = x0 + ((x1 - x0) * (i + 1)) / SL;
    return [...uniq].reverse().find((x) => x >= a && x < b) ?? null;
  }).filter((x): x is number => x !== null);
  const bounds = slotXs.map((x, i) => [i ? (x + slotXs[i - 1]) / 2 : x0, i < slotXs.length - 1 ? (x + slotXs[i + 1]) / 2 : x1]);
  const at = (l: XYLine, x: number) => {
    let v: number | null = null;
    for (const [px, pv] of l.pts) { if (px > x) break; if (pv !== null) v = pv; }
    return v;
  };
  const xt = o.xticks ?? [0, 0.25, 0.5, 0.75, 1].map((f) => x0 + (x1 - x0) * f);
  return html`<div class="xy" style="--xh:${H}px">
    <div class="xyaxis" aria-hidden="true">${ticks.map((t) => html`<span style="bottom:${(((t - lo) / (hi - lo)) * 100).toFixed(2)}%">${fmt(t, "")}</span>`)}</div>
    <div class="xyplot">
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label=${lines.map((l) => l.name).join(", ")}>
        ${ticks.map((t) => svg`<line x1="0" x2=${W} y1=${Y(t)} y2=${Y(t)} stroke="var(--line)" stroke-dasharray=${t === lo ? "none" : "2 5"} vector-effect="non-scaling-stroke"></line>`)}
        ${(o.bands ?? []).map((b) => svg`<path d=${band(b)} fill=${b.color} opacity=".2"></path>`)}
        ${marks.map((m) => svg`<line x1="0" x2=${W} y1=${Y(m.v)} y2=${Y(m.v)} stroke=${m.color} stroke-dasharray="5 4" stroke-width="1.2" vector-effect="non-scaling-stroke"></line>`)}
        ${lines.filter((l) => l.fill && !l.hidden).map((l) => {
          const d = path(l.pts);
          const first = l.pts.find(([, v]) => v !== null)!, last = [...l.pts].reverse().find(([, v]) => v !== null)!;
          return svg`<path d="${d}L${X(last[0]).toFixed(1)} ${H}L${X(first[0]).toFixed(1)} ${H}Z" fill=${l.color} opacity=".1"></path>`;
        })}
        ${lines.filter((l) => !l.hidden).map((l) => svg`<path d=${path(l.pts)} fill="none" stroke=${l.color} stroke-width="2" stroke-linejoin="round" stroke-dasharray=${l.dashed ? "5 4" : "none"} vector-effect="non-scaling-stroke"></path>`)}
      </svg>
      ${labeled.map((m) => html`<em class="xymark ${side(m.v)}" style="bottom:${(((m.v - lo) / (hi - lo)) * 100).toFixed(2)}%;color:${m.color}">${m.label}</em>`)}
      ${lines.filter((l) => l.dots && !l.hidden).flatMap((l) => l.pts.filter(([, v]) => v !== null).map(([x, v]) =>
        html`<i class="xydot" style="left:${pct(x)};bottom:${(((v! - lo) / (hi - lo)) * 100).toFixed(2)}%;background:${l.color}"></i>`))}
      ${(o.points ?? []).map((p) => html`<i class="xypt" title=${p.label} style="left:${pct(p.x)};bottom:${(((p.y - lo) / (hi - lo)) * 100).toFixed(2)}%;--pc:${p.color}"></i>`)}
      ${slotXs.map((x, i) => {
        const [a, b] = bounds[i];
        const edge = X(x) / W < 0.2 ? "l" : X(x) / W > 0.8 ? "r" : "";
        return html`<div class="mslot ${edge}" tabindex="0" style="left:${pct(a)};width:${(((X(b) - X(a)) / W) * 100).toFixed(2)}%">
          <i class="mcross" style="left:${(((x - a) / Math.max(1e-9, b - a)) * 100).toFixed(1)}%"></i>
          <div class="btip" role="tooltip"><b>${(o.tipfmt ?? o.xfmt)(x)}</b>
            ${lines.map((l) => {
              const v = at(l, x);
              return v === null ? nothing : html`<span class="bser"><i style="background:${l.color}"></i>${l.name} <b>${fmt(v, l.unit ?? o.unit)}</b></span>`;
            })}</div>
        </div>`;
      })}
    </div>
    <div class="xyx" aria-hidden="true">${xt.map((x) => html`<span style="left:${pct(x)}">${o.xfmt(x)}</span>`)}</div>
  </div>`;
}

/** Profil pomiarów na „pajęczynie”: każda oś to pozycja wartości w typowym zakresie (0–100%). */
export function radar(axes: Array<{ label: string; pct: number | null; color: string; text: string }>): TemplateResult | typeof nothing {
  const pts = axes.filter((a) => a.pct !== null);
  if (pts.length < 3) return nothing;
  const S = 300, c = S / 2, R = 108;
  const ang = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / axes.length;
  const P = (i: number, f: number) => [c + Math.cos(ang(i)) * R * f, c + Math.sin(ang(i)) * R * f];
  const ring = (f: number) => axes.map((_, i) => P(i, f).map((v) => v.toFixed(1)).join(" ")).join("L");
  const shape = axes.map((a, i) => P(i, Math.max(0.02, (a.pct ?? 0) / 100)).map((v) => v.toFixed(1)).join(" ")).join("L");
  // Margines na podpisy osi (dłuższe nazwy po bokach).
  return html`<svg class="radar" viewBox="-60 -10 ${S + 120} ${S + 20}" role="img" aria-label="Profil pomiarów">
    ${[0.25, 0.5, 0.75, 1].map((f) => svg`<path d="M${ring(f)}Z" fill="none" stroke="var(--line)"></path>`)}
    ${axes.map((_, i) => svg`<line x1=${c} y1=${c} x2=${P(i, 1)[0]} y2=${P(i, 1)[1]} stroke="var(--line)"></line>`)}
    <path d="M${shape}Z" fill="var(--frost)" fill-opacity=".18" stroke="var(--frost)" stroke-width="2"></path>
    ${axes.map((a, i) => (a.pct === null ? nothing : svg`<circle cx=${P(i, a.pct / 100)[0]} cy=${P(i, a.pct / 100)[1]} r="4.5" fill=${a.color}><title>${a.label}: ${a.text}</title></circle>`))}
    ${axes.map((a, i) => {
      const [x, y] = P(i, 1.2);
      return svg`<text x=${x} y=${y} font-size="11" fill="var(--muted)" text-anchor=${Math.abs(x - c) < 8 ? "middle" : x > c ? "start" : "end"} dominant-baseline="middle">${a.label}</text>`;
    })}
  </svg>`;
}
