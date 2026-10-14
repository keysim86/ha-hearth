// Zakładka Zdrowie: osoby z podwpisów integracji. Podstrony Waga, Skład ciała, Aktywność, Ciśnienie, Pomiary,
// Siatki centylowe i Wprowadź dane — obliczenia przeniesione ze starej karty zdrowia.

import { html, nothing, type TemplateResult } from "lit";
import {
  ageYears,
  bmi,
  BMI_CATS,
  bmiCat,
  bpLevel,
  centiles,
  childBmiCat,
  childHeightCat,
  counterToday,
  dailyAvg,
  dailyCounter,
  dailyLast,
  dayKey,
  dayStart,
  fatCat,
  lastChangeAt,
  lastChangeDay,
  mergeDaily,
  MEASUREMENTS,
  monthlyAvg,
  monthlyBalances,
  readings,
  weekKey,
  weeklyBalances,
  withToday,
  type Balance,
  type Daily,
} from "../data/health";
import { daysAgo, startOfDay } from "../data/stats";
import { num } from "../format";
import { bars, radar, xyChart, type Bar, type XYBand, type XYLine, type XYMark } from "../svg";
import type { HealthProfile } from "../types";
import type { Ctx } from "./common";
import { MONTH_NAMES } from "./energy";
import { openReport } from "./health-report";

type Page = "weight" | "body" | "activity" | "pressure" | "measurements" | "centiles" | "entry";
const PAGES: Array<[Page, string]> = [
  ["weight", "Waga"],
  ["body", "Skład ciała"],
  ["activity", "Aktywność"],
  ["pressure", "Ciśnienie"],
  ["measurements", "Pomiary"],
  ["centiles", "Siatki"],
  ["entry", "Wprowadź dane"],
];
const BODY = ["body_fat", "fat_mass", "lean_mass", "muscle_mass", "skeletal_muscle", "bone_mass", "body_water", "bmr"] as const;
const DAYS_PL = ["nd", "pn", "wt", "śr", "cz", "pt", "sb"];
const HALF_DAY = 12 * 3600e3;

// ---- formatowanie ----

const nf = (v: number, d: number) => v.toLocaleString("pl-PL", { minimumFractionDigits: d, maximumFractionDigits: d });
const fmt = (v: number | null | undefined, d = 1, unit = "") => (v === null || v === undefined ? "—" : `${nf(v, d)}${unit ? ` ${unit}` : ""}`);
const dmy = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}`;
const dm = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}`;
const monthName = (k: string) => MONTH_NAMES[Number(k.slice(5, 7)) - 1];
/** Zmiana wagi: spadek zielony ze znakiem „−”, przyrost czerwony z „+”. `loss` > 0 = spadek. */
const lossText = (loss: number, d: number, unit: string) => `${loss >= 0 ? "−" : "+"}${nf(Math.abs(loss), d)} ${unit}`;
const lossColor = (loss: number | null) => (loss === null ? "" : loss >= 0 ? "var(--ok)" : "var(--crit)");
const diffText = (v: number | null, d = 2, unit = "kg") => (v === null ? "—" : `${v > 0 ? "+" : v < 0 ? "−" : "±"}${nf(Math.abs(v), d)} ${unit}`);
const diffColor = (v: number | null) => (v === null ? "" : v <= 0 ? "var(--ok)" : "var(--crit)");
const dateFmt = (t: number) => new Date(t).toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" });
const inDays = (n: number) => dateFmt(Date.now() + n * 864e5);
const xDay = (d: string) => dayStart(d) + HALF_DAY;
const dayLabel = (x: number) => {
  const d = new Date(x);
  return `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const dayTip = (x: number) => {
  const d = new Date(x);
  return `${DAYS_PL[d.getDay()]} ${d.getDate()}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
};
const monthLabel = (x: number) => MONTH_NAMES[new Date(x).getMonth()].slice(0, 3);
const monthTip = (x: number) => `${MONTH_NAMES[new Date(x).getMonth()]} ${new Date(x).getFullYear()}`;

const cell = (label: string, value: unknown, sub: unknown = "", color = "") =>
  html`<div class="hcell"><span class="hlabel">${label}</span><span class="hval" style=${color ? `color:${color}` : ""}>${value}</span><span class="hsub">${sub}</span></div>`;

// ---- dane wspólne ----

function stateNum(ctx: Ctx, id?: string): number | null {
  if (!id) return null;
  const s = ctx.hass.states[id];
  return s && s.state !== "unknown" && s.state !== "unavailable" ? num(s.state) : null;
}

export function heightCm(ctx: Ctx, p: HealthProfile): number | null {
  const v = stateNum(ctx, p.height);
  return v !== null && v > 30 ? v : p.height_cm ?? null;
}

function historyStart(p: HealthProfile): Date {
  return new Date(startOfDay().getTime() - (p.history_days || 365) * 864e5);
}

/** Waga dzień po dniu: statystyki godzinowe z całej historii + 5-minutowe z ostatnich 48 h + stan bieżący. */
function weightDaily(ctx: Ctx, p: HealthProfile): { daily: Daily; loading: boolean } {
  const start = historyStart(p);
  const lt = ctx.rows!.get(ctx.hass, [p.weight], "hour", start, ctx.refresh);
  const st = ctx.rows!.get(ctx.hass, [p.weight], "5minute", new Date(Math.floor((Date.now() - 48 * 3600e3) / 3600e3) * 3600e3), ctx.refresh);
  const cur = stateNum(ctx, p.weight);
  const today: Daily = cur !== null && cur > 0 && cur <= 400 ? [[dayKey(Date.now()), Math.round(cur * 100) / 100]] : [];
  return { daily: mergeDaily(dailyLast(lt[p.weight]), dailyLast(st[p.weight]), today), loading: !ctx.rows!.has([p.weight], "hour", start) };
}

interface BodySeries {
  fat: Daily;
  lean: Daily;
  smm: Daily;
  water: Daily;
}

/** Serie składu ciała (średnie dobowe; odczyty > 300 kg to chwilowe gramy zamiast kilogramów). */
function bodySeries(ctx: Ctx, p: HealthProfile): BodySeries {
  const rows = ctx.rows!.get(ctx.hass, [p.fat_mass, p.lean_mass, p.skeletal_muscle, p.body_water], "day", historyStart(p), ctx.refresh);
  const s = (id?: string) => (id ? dailyAvg(rows[id], 300) : []);
  return { fat: s(p.fat_mass), lean: s(p.lean_mass), smm: s(p.skeletal_muscle), water: s(p.body_water) };
}

/** Ile tłuszczu ubyło naprawdę (pierwszy i ostatni dzień z pomiarem tłuszczu) i ile reszty w tym samym oknie. */
function fatBurned(w: Daily, b: BodySeries): { burned: number; from: string; rest: number | null } | null {
  if (b.fat.length < 2) return null;
  const [d0, f0] = b.fat[0], [d1, f1] = b.fat[b.fat.length - 1];
  const burned = Math.round((f0 - f1) * 100) / 100;
  const w0 = w.find(([d]) => d === d0)?.[1], w1 = w.find(([d]) => d === d1)?.[1];
  return { burned, from: d0, rest: w0 !== undefined && w1 !== undefined ? Math.round((w0 - w1 - burned) * 100) / 100 : null };
}

const rolling = (v: number[], n = 7) => v.map((_, i) => {
  const s = v.slice(Math.max(0, i - n + 1), i + 1);
  return Math.round((s.reduce((a, b) => a + b, 0) / s.length) * 10) / 10;
});

// ---- Waga ----

function bmiScale(value: number, title: string, sub: TemplateResult | string = "") {
  const c = bmiCat(value);
  const pos = Math.min(100, Math.max(0, ((value - 15) / 30) * 100));
  return html`<div class="ocell"><span class="hlabel">${title}</span>
    <div class="orow"><span class="hval" style="color:${c.color}">${nf(value, 1)}</span><b style="color:${c.color}">${c.label}</b></div>
    <div class="bmibar"><i style="left:${pos.toFixed(1)}%"></i></div>
    <div class="bmilegend">${BMI_CATS.map(([lim, cat], i) => {
      const a = i ? nf(BMI_CATS[i - 1][0], BMI_CATS[i - 1][0] % 1 ? 1 : 0) : "", b = lim === Infinity ? "" : nf(lim, lim % 1 ? 1 : 0);
      return html`<span style="color:${cat.color}">${!a ? `<${b}` : !b ? `≥${a}` : `${a}–${b}`}</span>`;
    })}</div>
    ${sub ? html`<span class="hsub">${sub}</span>` : nothing}
  </div>`;
}

function balanceRows(list: Balance[], name: (k: string) => string, unit = "kg", d = 2): TemplateResult {
  if (!list.length) return html`<div class="hsub">Za mało pomiarów na bilans.</div>`;
  const top = Math.max(1, ...list.map((b) => Math.abs(b.diff)));
  return html`<div class="bal">${list.map((b) => html`<div class="balrow">
      <span class="bname">${name(b.key)}${b.partial ? "*" : ""}</span>
      <span class="bbar"><i style="width:${((Math.abs(b.diff) / top) * 100).toFixed(1)}%;background:${diffColor(b.diff)}"></i></span>
      <span class="bnum"><b style="color:${diffColor(b.diff)}">${diffText(b.diff, d, unit)}</b><small>${nf(b.from, d === 0 ? 0 : 1)} → ${nf(b.to, d === 0 ? 0 : 1)}</small></span>
    </div>`)}</div>`;
}

function weightPage(ctx: Ctx, p: HealthProfile, w: Daily, body: BodySeries | null): TemplateResult {
  const cur = w[w.length - 1][1];
  const curDay = lastChangeDay(w) ?? w[w.length - 1][0];
  const startDay = p.start_date ?? w[0][0];
  const startW = p.start_weight ?? w.find(([d]) => d >= startDay)?.[1] ?? w[0][1];
  const loss = Math.round((startW - cur) * 100) / 100;
  const days = Math.max(0, Math.round((dayStart(curDay) - dayStart(startDay)) / 864e5));
  const weekly = days >= 7 ? Math.round((loss / (days / 7)) * 100) / 100 : null;
  const h = heightCm(ctx, p);
  const goals = [...(p.goals ?? [])].filter((g) => num(g.weight) !== null);
  const next = goals.filter((g) => cur > g.weight).sort((a, b) => b.weight - a.weight)[0];
  const month = curDay.slice(0, 7);
  const monthBal = monthlyBalances(w).find((b) => b.key === month)?.diff ?? null;
  const weekStart = weekKey(curDay);
  const weekBal = weeklyBalances(w).find((b) => b.key === weekStart)?.diff ?? null;
  const monthDays = w.filter(([d]) => d.startsWith(month));
  const mAvg = monthDays.length ? monthDays.reduce((s, [, v]) => s + v, 0) / monthDays.length : null;
  const mBmi = mAvg !== null && h ? bmi(mAvg, h) : null;
  const fat = body ? fatBurned(w, body) : null;

  const tiles: TemplateResult[] = [
    cell(`Start (${dm(startDay)})`, fmt(startW, 2, "kg"), "punkt wyjścia"),
    cell(`Aktualnie (${dm(curDay)})`, fmt(cur, 2, "kg"), "ostatni pomiar", "var(--frost)"),
    cell("Łączna zmiana", lossText(loss, 2, "kg"), `przez ${days} dni`, lossColor(loss)),
    cell("Zmiana %", lossText(Math.round((loss / startW) * 1000) / 10, 1, "%"), "masy startowej", lossColor(loss)),
    cell("Średnie tempo", weekly === null ? "—" : lossText(weekly, 2, "kg"), "na tydzień", lossColor(weekly)),
  ];
  if (h) {
    const normKg = 25 * (h / 100) ** 2;
    const toNorm = Math.max(0, Math.round((cur - normKg) * 10) / 10);
    tiles.push(cell("Do normy BMI 25", toNorm > 0 ? `−${nf(toNorm, 1)} kg` : "✓ w normie",
      toNorm > 0 && weekly && weekly > 0 ? `prognoza: ${inDays(Math.round((toNorm / weekly) * 7))}` : `norma ≤ ${nf(normKg, 1)} kg`, toNorm > 0 ? "var(--warn)" : "var(--ok)"));
  }
  if (goals.length)
    tiles.push(next
      ? cell("Następny cel", `${nf(next.weight, 1)} kg`, `${next.label} · brakuje ${nf(cur - next.weight, 2)} kg`, next.color || "var(--ok)")
      : cell("Następny cel", "✓ wszystkie", "cele osiągnięte", "var(--ok)"));
  if (fat)
    tiles.push(cell("Spalono tłuszczu", lossText(fat.burned, 2, "kg"),
      `od ${dm(fat.from)}${fat.rest !== null ? ` · reszta ${lossText(fat.rest, 2, "kg")}` : ""}`, lossColor(fat.burned)));
  else if (loss > 0) tiles.push(cell("Spalono tłuszczu", `≈ ${lossText(Math.round(loss * 0.75 * 10) / 10, 1, "kg")}`, "szacunek (~75% utraty)", "var(--ok)"));

  const tab = ctx.ui["health.bal"] ?? "month";
  const monthly = monthlyAvg(w);
  const balance = {
    month: () => balanceRows(monthlyBalances(w), (k) => monthName(k)),
    week: () => balanceRows(weeklyBalances(w), (k) => `od ${dm(k)}`),
    weight: () => xyChart({
      lines: [{ name: "Średnia waga", color: "var(--frost)", dots: true, pts: monthly.map(([k, v]) => [dayStart(`${k}-15`), v]) }],
      unit: "kg", digits: 2, height: 160, xfmt: monthLabel, tipfmt: monthTip, xticks: monthly.map(([k]) => dayStart(`${k}-15`)),
    }),
    bmi: () => (h
      ? xyChart({
          lines: [{ name: "Średnie BMI", color: "var(--ember)", dots: true, pts: monthly.map(([k, v]) => [dayStart(`${k}-15`), bmi(v, h)]) }],
          marks: [18.5, 25, 30, 35, 40].map((v) => ({ v, color: bmiCat(v + 0.01).color, label: String(v), fit: false })),
          minSpan: 2, height: 160, xfmt: monthLabel, tipfmt: monthTip, xticks: monthly.map(([k]) => dayStart(`${k}-15`)),
        })
      : html`<div class="hsub">Ustaw wzrost osoby, żeby liczyć BMI.</div>`),
  } as Record<string, () => unknown>;

  const range = ctx.ui["health.range"] ?? "all";
  const RANGES: Array<[string, string, number]> = [["all", "Od początku", 0], ["6m", "6 mies.", 182], ["3m", "3 mies.", 91], ["30d", "30 dni", 30], ["14d", "14 dni", 14], ["7d", "7 dni", 7]];
  const cut = RANGES.find(([k]) => k === range)?.[2] ?? 0;
  const from = cut ? dayKey(Date.now() - cut * 864e5) : p.start_date && p.start_date > w[0][0] ? p.start_date : w[0][0];
  const shown = w.filter(([d]) => d >= from);
  const trend = rolling(w.map(([, v]) => v));
  const trendShown = w.map(([d], i) => [d, trend[i]] as [string, number]).filter(([d]) => d >= from);
  const marks: XYMark[] = goals.map((g) => ({ v: g.weight, color: g.color || "var(--ok)", label: `${g.label} ${nf(g.weight, 1)}`, fit: g === next }));

  return html`
    <div class="house">${tiles}</div>
    <div class="house">
      ${cell("Bilans miesiąca", diffText(monthBal), monthName(month), diffColor(monthBal))}
      ${cell("Bilans tygodnia", diffText(weekBal), `od ${dm(weekStart)}`, diffColor(weekBal))}
      ${cell("Śr. waga (mies.)", fmt(mAvg, 2, "kg"), `${monthDays.length} dni`)}
      ${cell("Śr. BMI (mies.)", fmt(mBmi, 1), mBmi === null ? "" : bmiCat(mBmi).label, mBmi === null ? "" : bmiCat(mBmi).color)}
    </div>
    ${h
      ? html`<div class="cards two">
          ${bmiScale(bmi(startW, h), "BMI na starcie", `zmiana BMI: ${diffText(Math.round((bmi(cur, h) - bmi(startW, h)) * 10) / 10, 1, "")}`)}
          ${bmiScale(bmi(cur, h), `BMI teraz (wzrost ${nf(h, 0)} cm)`, `norma (BMI 25) = ${nf(25 * (h / 100) ** 2, 1)} kg`)}
        </div>`
      : html`<div class="empty">Ustaw wzrost osoby (encja albo wartość stała), żeby liczyć BMI.</div>`}
    ${goals.length
      ? html`<div class="ocell"><span class="hlabel">Postęp do celów</span><div class="goals">${goals.map((g) => {
          const pct = startW === g.weight ? 100 : Math.max(0, Math.min(100, Math.round(((startW - cur) / (startW - g.weight)) * 100)));
          const done = cur <= g.weight;
          const left = Math.max(0, Math.round((cur - g.weight) * 100) / 100);
          const dLeft = g.date ? Math.round((dayStart(g.date) - startOfDay().getTime()) / 864e5) : null;
          const reached = done ? w.find(([, v]) => v <= g.weight)?.[0] : undefined;
          return html`<div class="goal">
            <div class="glab"><span>${done ? "✓ " : ""}${g.label} — ${nf(g.weight, 1)} kg</span><b>${pct}%</b></div>
            <div class="gbar"><i style="width:${pct}%;background:${g.color || "var(--ok)"}"></i></div>
            <span class="hsub">${done
              ? `Cel osiągnięty${reached ? ` (${dmy(reached)})` : ""}`
              : `Brakuje ${nf(left, 2)} kg${dLeft !== null ? ` · ${dLeft} dni · ${dLeft > 0 ? `${nf(left / (dLeft / 7), 2)} kg/tydz.` : "termin minął"}` : ""}${weekly && weekly > 0 ? ` · prognoza: ${inDays(Math.round((left / weekly) * 7))}` : ""}`}</span>
          </div>`;
        })}</div></div>`
      : nothing}
    <div class="ocell"><div class="orow"><span class="hlabel">Bilanse</span>
      <div class="seg2">${[["month", "Miesięczne"], ["week", "Tygodniowe"], ["weight", "Waga"], ["bmi", "BMI"]].map(([k, l]) =>
        html`<button type="button" class=${tab === k ? "on" : ""} @click=${() => ctx.actions.setUi("health.bal", k)}>${l}</button>`)}</div></div>
      ${(balance[tab] ?? balance.month)()}
      ${tab === "month" ? html`<span class="hsub">* miesiąc niepełny · ostatni pomiar poprzedniego miesiąca → ostatni w miesiącu</span>`
        : tab === "week" ? html`<span class="hsub">* tydzień niepełny · ostatnie 16 tygodni</span>` : nothing}
    </div>
    <div class="ocell"><div class="orow"><span class="hlabel">Historia wagi</span>
      <div class="seg2">${RANGES.map(([k, l]) => html`<button type="button" class=${range === k ? "on" : ""} @click=${() => ctx.actions.setUi("health.range", k)}>${l}</button>`)}</div></div>
      ${xyChart({
        lines: [
          { name: "Waga", color: "var(--frost)", fill: true, pts: shown.map(([d, v]) => [xDay(d), v]) },
          { name: "Trend 7 dni", color: "var(--ember)", dashed: true, pts: trendShown.map(([d, v]) => [xDay(d), v]) },
        ],
        marks, unit: "kg", digits: 2, height: 220, xfmt: dayLabel, tipfmt: dayTip,
      })}
      <div class="mlegend"><span><i style="background:var(--frost)"></i>Waga dzienna</span><span><i style="background:var(--ember)"></i>Trend 7 dni</span>
        ${goals.map((g) => html`<span><i style="background:${g.color || "var(--ok)"}"></i>${g.label}</span>`)}</div>
    </div>`;
}

// ---- Skład ciała ----

function bodyPage(ctx: Ctx, p: HealthProfile, w: Daily, b: BodySeries): TemplateResult {
  const v = (id?: string) => stateNum(ctx, id);
  const pct = v(p.body_fat), fatM = v(p.fat_mass), lean = v(p.lean_mass), water = v(p.body_water);
  const muscle = v(p.muscle_mass), bone = v(p.bone_mass), smm = v(p.skeletal_muscle), bmr = v(p.bmr);
  const cat = pct !== null ? fatCat(pct, p.gender) : null;
  const total = fatM !== null && lean !== null ? fatM + lean : stateNum(ctx, p.weight);
  const fat = fatBurned(w, b);
  const tiles = [
    pct !== null ? cell("Tkanka tłuszczowa", fmt(pct, 1, "%"), cat!.label, cat!.color) : nothing,
    fatM !== null ? cell("Masa tłuszczu", fmt(fatM, 2, "kg"), "do zredukowania") : nothing,
    lean !== null ? cell("Masa beztłuszczowa", fmt(lean, 2, "kg"), "mięśnie, kości, woda", "var(--ok)") : nothing,
    smm !== null ? cell("Mięśnie szkieletowe", fmt(smm, 2, "kg"), "szacunek z masy beztłuszczowej", "var(--bath)") : nothing,
    muscle !== null ? cell("Tkanka beztłuszczowa", fmt(muscle, 2, "kg"), "bez kości · to nie mięśnie") : nothing,
    bone !== null ? cell("Masa kostna", fmt(bone, 2, "kg"), "zmienia się bardzo wolno") : nothing,
    water !== null ? cell("Woda", fmt(water, 2, "kg"), total ? `${nf((water / total) * 100, 1)}% masy ciała` : "", "var(--frost)") : nothing,
    bmr !== null ? cell("Przemiana podstawowa", `${Math.round(bmr).toLocaleString("pl-PL")} kcal`, "spoczynkowe zapotrzebowanie") : nothing,
    fat ? cell("Spalono tłuszczu", lossText(fat.burned, 2, "kg"), `od ${dm(fat.from)}${fat.rest !== null ? ` · reszta ${lossText(fat.rest, 2, "kg")}` : ""}`, lossColor(fat.burned)) : nothing,
  ];
  const lines: XYLine[] = [
    { name: "Masa tłuszczu", color: "var(--crit)", fill: true, pts: b.fat.map(([d, x]) => [xDay(d), x]) },
    { name: "Masa beztłuszczowa", color: "var(--ok)", pts: b.lean.map(([d, x]) => [xDay(d), x]) },
    { name: "Mięśnie szkieletowe", color: "var(--bath)", dashed: true, pts: b.smm.map(([d, x]) => [xDay(d), x]) },
    { name: "Woda", color: "var(--frost)", dashed: true, pts: b.water.map(([d, x]) => [xDay(d), x]) },
  ].filter((l) => l.pts.length) as XYLine[];
  const enough = lines.some((l) => l.pts.length >= 2);
  return html`<div class="house">${tiles}</div>
    <div class="ocell"><span class="hlabel">Skład ciała w czasie</span>
      ${enough
        ? html`${xyChart({ lines, unit: "kg", digits: 2, height: 220, xfmt: dayLabel, tipfmt: dayTip })}
            <div class="mlegend">${lines.map((l) => html`<span><i style="background:${l.color}"></i>${l.name}</span>`)}</div>
            <span class="hsub">Czerwona linia ma opadać, zielona trzymać poziom. Gdy schodzą razem, z tłuszczem znika też masa mięśniowa — tego sama waga nie pokaże. Woda tłumaczy dobowe skoki wagi.</span>`
        : html`<span class="hsub">Wykres pojawi się, gdy uzbierają się co najmniej dwa dni pomiarów składu ciała.</span>`}
    </div>`;
}

// ---- Aktywność ----

function activityPage(ctx: Ctx, p: HealthProfile): TemplateResult {
  const days = Number(ctx.ui["health.act"]) || 30;
  const rows = ctx.rows!.get(ctx.hass, [p.steps, p.calories], "hour", daysAgo(days), ctx.refresh);
  const first = dayKey(daysAgo(days - 1).getTime());
  const series = (id: string | undefined) => (id ? withToday(dailyCounter(rows[id]), counterToday(ctx.hass.states[id])).filter(([d]) => d >= first) : []);
  const steps = series(p.steps), cal = series(p.calories);
  const sNow = p.steps ? counterToday(ctx.hass.states[p.steps]) : null;
  const cNow = p.calories ? counterToday(ctx.hass.states[p.calories]) : null;
  const sg = p.steps_goal || 10000, cg = p.calories_goal || 800;
  const level = (v: number, g: number) => (v >= g ? 0 : v >= g * 0.5 ? 1 : 2);
  const COLORS = ["var(--ok)", "var(--warn)", "var(--crit)"];
  const avg = (d: Daily) => (d.length ? Math.round(d.reduce((s, [, v]) => s + v, 0) / d.length) : null);
  const maxOf = (d: Daily) => (d.length ? Math.max(...d.map(([, v]) => v)) : null);
  const today = (label: string, v: number | null, g: number, unit: string) => {
    if (v === null) return nothing;
    const pct = Math.min(100, Math.round((v / g) * 100));
    return html`<div class="hcell"><span class="hlabel">${label}</span>
      <span class="hval" style="color:${COLORS[level(v, g)]}">${v.toLocaleString("pl-PL")}${unit ? html`<span class="u"> ${unit}</span>` : nothing}</span>
      <span class="gbar"><i style="width:${pct}%;background:${COLORS[level(v, g)]}"></i></span>
      <span class="hsub">${pct}% celu (${g.toLocaleString("pl-PL")}${unit ? ` ${unit}` : ""})</span></div>`;
  };
  const chart = (d: Daily, g: number, unit: string) => {
    const map = new Map(d);
    const data: Bar[] = [...Array(days).keys()].reverse().map((k) => {
      const t = daysAgo(k);
      const v = map.get(dayKey(t.getTime())) ?? 0;
      const vals = [0, 0, 0];
      vals[level(v, g)] = v;
      return { label: `${t.getDate()}`, title: `${DAYS_PL[t.getDay()]} ${t.getDate()}.${String(t.getMonth() + 1).padStart(2, "0")}${k === 0 ? " (dziś)" : ""}`, values: vals, now: k === 0 };
    });
    return bars(data, COLORS, { unit, digits: 0, every: Math.ceil(days / 15), height: 150, valueLabels: days <= 14 ? true : "dense" });
  };
  const sAvg = avg(steps), cAvg = avg(cal);
  return html`
    <div class="house">
      ${today("Kroki dziś", sNow, sg, "")}
      ${today("Kalorie dziś", cNow, cg, "kcal")}
      ${p.steps ? cell(`Ø kroki (${days} dni)`, sAvg === null ? "—" : sAvg.toLocaleString("pl-PL"), `max ${maxOf(steps)?.toLocaleString("pl-PL") ?? "—"}`) : nothing}
      ${p.calories ? cell(`Ø kalorie (${days} dni)`, cAvg === null ? "—" : `${cAvg.toLocaleString("pl-PL")} kcal`, `max ${maxOf(cal)?.toLocaleString("pl-PL") ?? "—"} kcal`) : nothing}
    </div>
    <div class="orow">
      <div class="seg2">${[7, 14, 30, 90].map((d) => html`<button type="button" class=${days === d ? "on" : ""} @click=${() => ctx.actions.setUi("health.act", String(d))}>${d} dni</button>`)}</div>
      <div class="legend"><span><i style="background:var(--ok)"></i>≥ cel</span><span><i style="background:var(--warn)"></i>≥ 50% celu</span><span><i style="background:var(--crit)"></i>&lt; 50% celu</span></div>
    </div>
    ${p.steps ? html`<div class="ocell"><span class="hlabel">Kroki dzienne</span>${chart(steps, sg, "kroków")}</div>` : nothing}
    ${p.calories ? html`<div class="ocell"><span class="hlabel">Kalorie dzienne</span>${chart(cal, cg, "kcal")}</div>` : nothing}`;
}

// ---- Ciśnienie ----

function pressurePage(ctx: Ctx, p: HealthProfile): TemplateResult {
  const ids = [p.bp_systolic, p.bp_diastolic, p.bp_pulse];
  const rows = ctx.rows!.get(ctx.hass, ids, "hour", daysAgo(90), ctx.refresh);
  const short = ctx.rows!.get(ctx.hass, ids, "5minute", new Date(Math.floor((Date.now() - 48 * 3600e3) / 3600e3) * 3600e3), ctx.refresh);
  const s = stateNum(ctx, p.bp_systolic), d = stateNum(ctx, p.bp_diastolic), pu = stateNum(ctx, p.bp_pulse);
  const cat = p.bp_category ? ctx.hass.states[p.bp_category]?.state : undefined;
  const catText = cat && cat !== "unknown" && cat !== "unavailable" ? cat : null;
  const lvl = bpLevel(catText, s, d);
  const alert = catText ?? (lvl === "crit" ? "Nadciśnienie — skonsultuj się z lekarzem" : lvl === "warn" ? "Podwyższone ciśnienie" : "Ciśnienie w normie");
  let last: number | null = null;
  for (const id of ids) {
    if (!id) continue;
    const t = lastChangeAt(short[id], true) ?? lastChangeAt(rows[id]);
    if (t !== null && (last === null || t > last)) last = t;
  }
  const from = dayKey(daysAgo(30).getTime());
  const stat = (id?: string) => {
    const r = id ? readings(rows[id], from) : [];
    return r.length ? { avg: Math.round(r.reduce((a, b) => a + b, 0) / r.length), min: Math.round(Math.min(...r)), max: Math.round(Math.max(...r)) } : null;
  };
  const S = stat(p.bp_systolic), D = stat(p.bp_diastolic), P = stat(p.bp_pulse);
  const sCol = s === null ? "" : s >= 140 ? "var(--crit)" : s >= 130 ? "var(--warn)" : "var(--ok)";
  const dCol = d === null ? "" : d >= 90 ? "var(--crit)" : d >= 80 ? "var(--warn)" : "var(--ok)";
  const pCol = pu === null ? "" : pu > 100 || pu < 50 ? "var(--warn)" : "var(--frost)";
  const daily = (id?: string) => (id ? dailyAvg(rows[id], 300).map(([k, v]) => [xDay(k), v] as [number, number]) : []);
  const rep = Number(ctx.ui["health.rep"]) || 30;
  const big = (label: string, v: number | null, unit: string, color: string) =>
    html`<div class="hcell bpbig"><span class="hlabel">${label}</span><span class="hval" style="color:${color}">${v === null ? "—" : Math.round(v)}<span class="u"> ${unit}</span></span></div>`;
  const statCell = (label: string, x: ReturnType<typeof stat>, unit: string) =>
    cell(`Ø ${label} (30 dni)`, x ? `${x.avg} ${unit}` : "—", x ? `min ${x.min} · max ${x.max}` : "brak pomiarów");
  return html`
    <div class="alertbox ${lvl}">${lvl === "ok" ? "✓" : "⚠"} ${alert}</div>
    <div class="house">
      ${big("Skurczowe", s, "mmHg", sCol)}${big("Rozkurczowe", d, "mmHg", dCol)}${p.bp_pulse ? big("Tętno", pu, "bpm", pCol) : nothing}
    </div>
    <span class="hsub">Ostatni pomiar: <b>${last === null ? "—" : new Date(last).toLocaleString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</b></span>
    <div class="house">${statCell("skurczowe", S, "mmHg")}${statCell("rozkurczowe", D, "mmHg")}${p.bp_pulse ? statCell("tętno", P, "bpm") : nothing}</div>
    <div class="ocell"><div class="orow"><span class="hlabel">Raport do druku (PDF)</span>
      <div class="seg2">${[7, 14, 30, 90].map((n) => html`<button type="button" class=${rep === n ? "on" : ""} @click=${() => ctx.actions.setUi("health.rep", String(n))}>${n} dni</button>`)}</div></div>
      <div class="orow"><span class="hsub">Tabela pomiarów, średnie i ocena wg ESH — w oknie wydruku wybierz „Zapisz jako PDF”.</span>
        <button class="btn hot" type="button" @click=${() => openReport(ctx.hass, p, heightCm(ctx, p), rep).catch((e) => ctx.actions.toast(`Raport: ${(e as Error)?.message ?? e}`))}>Generuj raport</button></div>
    </div>
    <div class="ocell"><span class="hlabel">Historia (90 dni, średnie dobowe)</span>
      ${xyChart({
        lines: [
          { name: "Skurczowe", color: "var(--crit)", dots: true, pts: daily(p.bp_systolic), unit: "mmHg" },
          { name: "Rozkurczowe", color: "var(--frost)", dots: true, pts: daily(p.bp_diastolic), unit: "mmHg" },
          { name: "Tętno", color: "var(--ok)", dashed: true, pts: daily(p.bp_pulse), unit: "bpm" },
        ],
        marks: [{ v: 120, color: "var(--crit)", label: "120" }, { v: 80, color: "var(--frost)", label: "80" }],
        digits: 0, minSpan: 40, height: 220, xfmt: dayLabel, tipfmt: dayTip,
      })}
      <div class="mlegend"><span><i style="background:var(--crit)"></i>Skurczowe</span><span><i style="background:var(--frost)"></i>Rozkurczowe</span><span><i style="background:var(--ok)"></i>Tętno</span><span class="tt">kreski: norma 120 / 80</span></div>
    </div>`;
}

// ---- Pomiary ciała ----

function measurementsPage(ctx: Ctx, p: HealthProfile): TemplateResult {
  const list = MEASUREMENTS.filter((m) => p[`meas_${m.key}`]);
  const start = startOfDay();
  start.setFullYear(start.getFullYear() - 2);
  const ids = list.map((m) => p[`meas_${m.key}`]!).filter((id) => id.startsWith("sensor."));
  const rows = ctx.rows!.get(ctx.hass, ids, "day", start, ctx.refresh);
  const data = list.map((m) => {
    const id = p[`meas_${m.key}`]!;
    const series = dailyLast(rows[id], 1000).map(([d, v]) => [d, Math.round(v)] as [string, number]);
    const cur = stateNum(ctx, id) ?? stateNum(ctx, p[`input_${m.key}`]);
    return { ...m, id, series, cur: cur === null ? null : Math.round(cur), last: lastChangeDay(series), first: series[0] ?? null };
  });
  // Wspólny punkt odniesienia: najnowszy dzień (z dowolnego obwodu) z wartością inną niż obecna — żeby „od poprzedniego
  // pomiaru” porównywało całą sesję mierzenia, a nie każdy obwód z innym dniem.
  let ref: string | null = null;
  for (const m of data) {
    if (!m.last || m.cur === null) continue;
    const prev = [...m.series].reverse().find(([d, v]) => d < m.last! && v !== m.cur);
    if (prev && (!ref || prev[0] > ref)) ref = prev[0];
  }
  const prevOf = (m: (typeof data)[number]) => (ref ? [...m.series].reverse().find(([d]) => d <= ref!)?.[1] ?? null : null);
  const sel = ctx.ui["health.meas"] ?? "";
  const delta = (v: number | null, label: string) =>
    v === null ? nothing : html`<span class="hsub" style="color:${diffColor(v)};font-weight:700">${diffText(v, 0, "cm")} ${label}</span>`;
  let sumPrev = 0, nPrev = 0, sumFirst = 0, nFirst = 0;
  for (const m of data) {
    const pv = prevOf(m);
    if (m.cur !== null && pv !== null) { sumPrev += m.cur - pv; nPrev++; }
    if (m.cur !== null && m.first) { sumFirst += m.cur - m.first[1]; nFirst++; }
  }
  const firstDay = data.find((m) => m.first)?.first?.[0];
  // Bilans miesięczny: suma wszystkich obwodów w dniach, gdy są wszystkie.
  const days = [...new Set(data.flatMap((m) => m.series.map(([d]) => d)))].sort();
  const maps = data.map((m) => new Map(m.series));
  const totals: Daily = days.filter((d) => maps.every((mp) => mp.has(d))).map((d) => [d, maps.reduce((s, mp) => s + mp.get(d)!, 0)]);
  const monthBal = monthlyBalances(totals);
  const shown = sel ? data.filter((m) => m.key === sel) : data;
  return html`
    <div class="house">${data.map((m) => html`<button type="button" class="hcell mtile ${sel === m.key ? "on" : ""}" style="--mc:${m.color}"
        aria-pressed=${sel === m.key ? "true" : "false"} @click=${() => ctx.actions.setUi("health.meas", sel === m.key ? "" : m.key)}>
      <span class="hlabel"><i></i>${m.label}</span>
      <span class="hval">${m.cur === null ? "—" : html`${m.cur}<span class="u"> cm</span>`}</span>
      <span class="hsub">${m.last ? dmy(m.last) : ""}</span>
      ${delta(m.cur !== null && prevOf(m) !== null ? m.cur - prevOf(m)! : null, ref ? `od ${dm(ref)}` : "")}
      ${delta(m.cur !== null && m.first ? m.cur - m.first[1] : null, m.first ? `od ${dm(m.first[0])}` : "")}
    </button>`)}</div>
    ${nPrev || nFirst
      ? html`<div class="house">
          ${nPrev ? cell(`Łącznie od ${ref ? dmy(ref) : "poprzedniego"}`, diffText(sumPrev, 0, "cm"), "suma obwodów", diffColor(sumPrev)) : nothing}
          ${nFirst && firstDay ? cell(`Łącznie od ${dmy(firstDay)}`, diffText(sumFirst, 0, "cm"), "od pierwszego pomiaru", diffColor(sumFirst)) : nothing}
        </div>`
      : nothing}
    <div class="cards two top">
      <div class="ocell"><span class="hlabel">Aktualny profil</span>
        ${radar(data.map((m) => ({ label: m.label, color: m.color, text: m.cur === null ? "—" : `${m.cur} cm`, pct: m.cur === null ? null : Math.max(0, Math.min(100, ((m.cur - m.min) / (m.max - m.min)) * 100)) })))}
        <span class="hsub">Każda oś to pozycja w typowym zakresie obwodu (np. talia 40–180 cm).</span></div>
      <div class="ocell"><span class="hlabel">Bilans miesięczny (suma cm)</span>${balanceRows(monthBal, (k) => monthName(k), "cm", 0)}</div>
    </div>
    <div class="ocell"><span class="hlabel">Historia pomiarów${sel ? ` — ${shown[0]?.label}` : ""}</span>
      ${xyChart({ lines: shown.map((m) => ({ name: m.label, color: m.color, dots: shown.length === 1, pts: m.series.map(([d, v]) => [xDay(d), v]) })), unit: "cm", digits: 0, minSpan: 4, height: 220, xfmt: dayLabel, tipfmt: dayTip })}
      <div class="mlegend">${shown.map((m) => html`<span><i style="background:${m.color}"></i>${m.label}</span>`)}<span class="tt">kliknij kafelek, żeby zobaczyć jeden obwód</span></div>
    </div>`;
}

// ---- Siatki centylowe ----

function centilesPage(ctx: Ctx, p: HealthProfile, w: Daily): TemplateResult {
  const h = heightCm(ctx, p);
  if (!p.birthdate || !h) return html`<div class="empty">Siatki wymagają daty urodzenia i wzrostu osoby (ustawienia osoby w integracji).</div>`;
  const pts = w.map(([d, kg]) => ({ x: xDay(d), age: ageYears(p.birthdate!, xDay(d)), kg, b: bmi(kg, h) })).filter((x) => x.age >= 2 && x.age <= 20);
  if (!pts.length) return html`<div class="empty">Brak pomiarów wagi w wieku 2–20 lat.</div>`;
  const cur = pts[pts.length - 1];
  const c = centiles(cur.age, p.gender);
  const bc = childBmiCat(cur.b, c), hc = childHeightCat(h, c);
  const y = Math.floor(cur.age), mo = Math.floor((cur.age - y) * 12);
  const cb = pts.map((x) => ({ x: x.x, c: centiles(x.age, p.gender) }));
  const band = (color: string, lo: (k: (typeof cb)[number]) => number, hi: (k: (typeof cb)[number]) => number, fit = true): XYBand =>
    ({ color, lo: cb.map((k) => [k.x, lo(k)]), hi: cb.map((k) => [k.x, hi(k)]), fit });
  const ages = [...Array(33).keys()].map((i) => 2 + i * 0.5);
  const ac = ages.map((a) => ({ a, c: centiles(a, p.gender) }));
  const hband = (color: string, lo: (k: (typeof ac)[number]) => number, hi: (k: (typeof ac)[number]) => number, fit = true): XYBand =>
    ({ color, lo: ac.map((k) => [k.a, lo(k)]), hi: ac.map((k) => [k.a, hi(k)]), fit });
  return html`
    <div class="house">
      ${cell("Wiek", `${y} lat${mo ? ` ${mo} mies.` : ""}`, p.gender === "male" ? "chłopiec" : "dziewczynka")}
      ${cell("BMI", nf(cur.b, 1), bc.label, bc.color)}
      ${cell("Wzrost", `${nf(h, 0)} cm`, hc.label, hc.color)}
      ${cell("Waga", fmt(cur.kg, 1, "kg"), dmy(dayKey(cur.x)))}
    </div>
    <div class="ocell"><span class="hlabel">BMI na tle siatki centylowej (WHO 2007)</span>
      ${xyChart({
        lines: [
          { name: "BMI", color: "var(--fg)", pts: pts.map((x) => [x.x, x.b]), dots: pts.length < 60 },
          { name: "P85", color: "var(--warn)", hidden: true, pts: cb.map((k) => [k.x, k.c.bP85]) },
          { name: "P95", color: "var(--crit)", hidden: true, pts: cb.map((k) => [k.x, k.c.bP95]) },
        ],
        bands: [
          band("var(--bath)", (k) => k.c.bP5 - 3, (k) => k.c.bP5, false),
          band("var(--ok)", (k) => k.c.bP5, (k) => k.c.bP85),
          band("var(--warn)", (k) => k.c.bP85, (k) => k.c.bP95),
          band("var(--crit)", (k) => k.c.bP95, (k) => k.c.bP95 + 5, false),
        ],
        digits: 1, minSpan: 3, height: 240, xfmt: dayLabel, tipfmt: dayTip,
      })}
      <div class="legend"><span><i style="background:var(--bath)"></i>niedowaga (&lt; P5)</span><span><i style="background:var(--ok)"></i>norma (P5–P85)</span><span><i style="background:var(--warn)"></i>nadwaga (P85–P95)</span><span><i style="background:var(--crit)"></i>otyłość (&gt; P95)</span></div>
    </div>
    <div class="ocell"><span class="hlabel">Wzrost — pozycja centylowa</span>
      ${xyChart({
        lines: [
          { name: "P90", color: "var(--frost)", hidden: true, pts: ac.map((k) => [k.a, k.c.hP90]) },
          { name: "P50", color: "var(--muted)", dashed: true, pts: ac.map((k) => [k.a, k.c.hP50]) },
          { name: "P10", color: "var(--crit)", hidden: true, pts: ac.map((k) => [k.a, k.c.hP10]) },
        ],
        bands: [
          hband("var(--crit)", (k) => k.c.hP10 - 15, (k) => k.c.hP10, false),
          hband("var(--ok)", (k) => k.c.hP10, (k) => k.c.hP90),
          hband("var(--frost)", (k) => k.c.hP90, (k) => k.c.hP90 + 15, false),
        ],
        points: [{ x: Math.max(2, Math.min(18, cur.age)), y: h, color: "var(--warn)", label: `${nf(h, 0)} cm — ${hc.label}` }],
        unit: "cm", digits: 0, height: 220, x0: 2, x1: 18, xfmt: (a) => `${a} l.`, tipfmt: (a) => `${a} lat`, xticks: [2, 4, 6, 8, 10, 12, 14, 16, 18],
      })}
      <div class="legend"><span><i style="background:var(--crit)"></i>niski (&lt; P10)</span><span><i style="background:var(--ok)"></i>średnio-wysoki (P10–P90)</span><span><i style="background:var(--frost)"></i>bardzo wysoki (&gt; P90)</span><span><i style="background:var(--warn)"></i>teraz</span></div>
    </div>`;
}

// ---- Wprowadź dane ----

function entryPage(ctx: Ctx, p: HealthProfile): TemplateResult {
  // Krok „any”: przeglądarka nie odrzuci 79,3 cm; zakres i tak sprawdza zapis (i pomocnik w HA).
  const field = (name: string, label: string, unit: string, entity: string | undefined, min: number, max: number, step: number | "any" = "any") => html`<label class="defield">
      <span>${label}<small>${unit}</small></span>
      <input name=${name} type="number" inputmode="decimal" min=${min} max=${max} step=${step} .value=${String(stateNum(ctx, entity) ?? "")} placeholder="—" ?disabled=${!entity} />
    </label>`;
  const submit = (e: SubmitEvent, spec: Array<[string, string | undefined, string, number, number]>, all: boolean, done: (v: Record<string, number>) => string) => {
    e.preventDefault();
    const fd = new FormData(e.target as HTMLFormElement);
    const out: Array<[string, number]> = [], vals: Record<string, number> = {};
    for (const [name, entity, label, min, max] of spec) {
      if (!entity) continue;
      const raw = String(fd.get(name) ?? "").replace(",", ".").trim();
      if (!raw) {
        if (all) return ctx.actions.toast(`Wypełnij: ${label}.`);
        continue;
      }
      const v = Number(raw);
      if (!Number.isFinite(v) || v < min || v > max) return ctx.actions.toast(`${label}: podaj wartość ${min}–${max}.`);
      out.push([entity, v]);
      vals[name] = v;
    }
    if (!out.length) return ctx.actions.toast("Nie podano żadnej wartości.");
    ctx.actions.saveNumbers(out, done(vals));
  };
  const bp: Array<[string, string | undefined, string, number, number]> = [
    ["sys", p.bp_systolic_input, "skurczowe", 60, 250], ["dia", p.bp_diastolic_input, "rozkurczowe", 40, 150], ["pul", p.bp_pulse_input, "tętno", 30, 200],
  ];
  const heightInput = p.height?.startsWith("input_number.") ? p.height : undefined;
  const meas = MEASUREMENTS.filter((m) => p[`input_${m.key}`]);
  const measSpec = meas.map((m) => [m.key, p[`input_${m.key}`], m.label.toLowerCase(), m.min, m.max] as [string, string | undefined, string, number, number]);
  const anyBp = bp.some(([, e]) => e);
  if (!anyBp && !heightInput && !meas.length)
    return html`<div class="empty">Wskaż pomocniki input_number w ustawieniach osoby (sekcja Wprowadź dane), a wzrost jako input_number, żeby wpisywać dane tutaj.</div>`;
  return html`
    ${anyBp
      ? html`<form class="ocell" @submit=${(e: SubmitEvent) => submit(e, bp, true, (v) => `Zapisano ciśnienie ${v.sys}/${v.dia} mmHg${v.pul ? `, tętno ${v.pul}` : ""}.`)}>
          <span class="hlabel">Ciśnienie krwi</span>
          <div class="deform">${field("sys", "Skurczowe", "mmHg", p.bp_systolic_input, 60, 250, 1)}${field("dia", "Rozkurczowe", "mmHg", p.bp_diastolic_input, 40, 150, 1)}${field("pul", "Tętno", "bpm", p.bp_pulse_input, 30, 200, 1)}</div>
          <div class="orow"><span class="hsub">Wszystkie trzy wartości z jednego pomiaru.</span><button class="btn hot" type="submit">Zapisz ciśnienie</button></div>
        </form>`
      : nothing}
    ${heightInput
      ? html`<form class="ocell" @submit=${(e: SubmitEvent) => submit(e, [["h", heightInput, "wzrost", 50, 250]], true, (v) => `Zapisano wzrost ${v.h} cm.`)}>
          <span class="hlabel">Wzrost</span>
          <div class="deform">${field("h", "Wzrost", "cm", heightInput, 50, 250)}</div>
          <div class="orow"><span class="hsub">Do BMI, raportu i siatek centylowych.</span><button class="btn hot" type="submit">Zapisz wzrost</button></div>
        </form>`
      : nothing}
    ${meas.length
      ? html`<form class="ocell" @submit=${(e: SubmitEvent) => submit(e, measSpec, false, () => "Zapisano pomiary.")}>
          <span class="hlabel">Pomiary ciała</span>
          <div class="deform">${meas.map((m) => field(m.key, m.label, "cm", p[`input_${m.key}`], m.min, m.max))}</div>
          <div class="orow"><span class="hsub">Puste pola zostają bez zmian.</span><button class="btn hot" type="submit">Zapisz pomiary</button></div>
        </form>`
      : nothing}`;
}

// ---- zakładka ----

function availablePages(p: HealthProfile): Page[] {
  return PAGES.map(([k]) => k).filter((k) =>
    k === "weight" ||
    (k === "body" && BODY.some((b) => p[b])) ||
    (k === "activity" && Boolean(p.steps || p.calories)) ||
    (k === "pressure" && Boolean(p.bp_systolic)) ||
    (k === "measurements" && MEASUREMENTS.some((m) => p[`meas_${m.key}`])) ||
    (k === "centiles" && p.centiles && Boolean(p.birthdate)) ||
    (k === "entry" && p.data_entry));
}

export function healthView(ctx: Ctx): TemplateResult {
  const list = ctx.health ?? [];
  if (!list.length)
    return html`<div class="empty">Brak osób. Dodaj je w ustawieniach integracji: Urządzenia i usługi → Hearth → „Dodaj osobę”. Wystarczy imię, płeć i czujnik wagi; reszta sekcji włącza kolejne podstrony.</div>`;
  const p = list.find((x) => x.id === ctx.ui["health.p"]) ?? list[0];
  const pages = availablePages(p);
  const page = (pages.find((k) => k === ctx.ui["health.page"]) ?? "weight") as Page;
  const people = html`<div class="hpeople" role="tablist" aria-label="Osoba">${list.map((x) => {
    const s = x.person ? ctx.hass.states[x.person] : undefined;
    const pic = s?.attributes.entity_picture as string | undefined;
    const kg = stateNum(ctx, x.weight);
    return html`<button type="button" role="tab" class="hperson ${x.id === p.id ? "on" : ""}" aria-selected=${x.id === p.id ? "true" : "false"}
        @click=${() => ctx.actions.setUi("health.p", x.id)}>
      <span class="avatar sm"><span>${x.name.slice(0, 1)}</span>${pic ? html`<img src=${pic} alt="" loading="lazy" @error=${(e: Event) => ((e.target as HTMLElement).hidden = true)} />` : nothing}</span>
      <span><b>${x.name}</b><small>${kg === null ? "—" : `${nf(kg, 1)} kg`}</small></span>
    </button>`;
  })}</div>`;
  const nav = pages.length > 1
    ? html`<div class="seg2" role="tablist" aria-label="Podstrona">${pages.map((k) =>
        html`<button type="button" role="tab" class=${k === page ? "on" : ""} aria-selected=${k === page ? "true" : "false"} @click=${() => ctx.actions.setUi("health.page", k)}>${PAGES.find(([x]) => x === k)![1]}</button>`)}</div>`
    : nothing;
  let body: unknown;
  if (page === "activity") body = activityPage(ctx, p);
  else if (page === "pressure") body = pressurePage(ctx, p);
  else if (page === "measurements") body = measurementsPage(ctx, p);
  else if (page === "entry") body = entryPage(ctx, p);
  else {
    const { daily, loading } = weightDaily(ctx, p);
    if (!daily.length)
      body = html`<div class="empty">${loading ? "Wczytuję historię wagi…" : html`Brak danych w statystykach dla <code>${p.weight}</code> — czujnik musi mieć klasę stanu „measurement”.`}</div>`;
    else if (page === "body") body = bodyPage(ctx, p, daily, bodySeries(ctx, p));
    else if (page === "centiles") body = centilesPage(ctx, p, daily);
    else body = weightPage(ctx, p, daily, BODY.some((b) => p[b]) && p.fat_mass ? bodySeries(ctx, p) : null);
  }
  return html`<section class="sec health">${people}${nav}${body}</section>`;
}
