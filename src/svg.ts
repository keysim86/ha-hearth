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
