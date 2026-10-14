// Raport ciśnienia do druku / PDF (jak w starej karcie zdrowia): pomiary z okresu, podsumowanie, dane osoby.

import { bmi, bmiCat, bpClass, bpReadings, fetchRows } from "../data/health";
import { num } from "../format";
import type { Hass, HealthProfile } from "../types";

const pl = (v: number, d: number) => v.toLocaleString("pl-PL", { maximumFractionDigits: d });
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function partOfDay(t: number): string {
  const h = new Date(t).getHours();
  if (h >= 5 && h < 12) return "Rano";
  if (h >= 12 && h < 17) return "Południe";
  if (h >= 17 && h < 21) return "Wieczór";
  return "Noc";
}

/** Okno otwieramy od razu (w obsłudze kliknięcia, inaczej zablokuje je przeglądarka), treść wpisujemy po pobraniu. */
export async function openReport(hass: Hass, p: HealthProfile, heightCm: number | null, days: number): Promise<void> {
  const win = window.open("", "_blank");
  if (!win) throw new Error("przeglądarka zablokowała nowe okno");
  win.document.write('<!doctype html><meta charset="utf-8"><title>Raport ciśnienia</title><p style="font-family:sans-serif">Przygotowuję raport…</p>');
  const now = new Date(), start = new Date(now.getTime() - days * 864e5);
  const ids = [p.bp_systolic, p.bp_diastolic, p.bp_pulse].filter((x): x is string => Boolean(x));
  let rows;
  try {
    rows = await fetchRows(hass, ids, "hour", start, now);
  } catch (err) {
    win.document.body.textContent = `Nie udało się pobrać pomiarów: ${(err as Error)?.message ?? err}`;
    return;
  }
  const list = bpReadings(rows[p.bp_systolic ?? ""] ?? [], rows[p.bp_diastolic ?? ""] ?? [], rows[p.bp_pulse ?? ""] ?? [], p.bp_exclude ?? []);
  const sys = list.map((m) => m.sys), dia = list.map((m) => m.dia), pul = list.flatMap((m) => (m.pul === null ? [] : [m.pul]));
  const avg = (a: number[]) => (a.length ? Math.round((a.reduce((x, y) => x + y, 0) / a.length) * 10) / 10 : null);
  const show = (v: number | null) => (v === null ? "—" : v.toLocaleString("pl-PL"));
  const min = (a: number[]) => (a.length ? Math.min(...a) : null), max = (a: number[]) => (a.length ? Math.max(...a) : null);
  const sA = avg(sys), dA = avg(dia), pA = avg(pul);
  const overall = sA !== null && dA !== null ? bpClass(sA, dA) : "—";
  const pulse = pA === null ? "—" : pA >= 60 && pA <= 100 ? "Prawidłowy" : "Nieprawidłowy";
  const date = (t: number | Date) => new Date(t).toLocaleDateString("pl-PL");
  const time = (t: number) => new Date(t).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
  let age = "";
  if (p.birthdate) {
    const b = new Date(`${p.birthdate}T00:00:00`);
    age = `${date(b)}&nbsp;&nbsp;(wiek: ${Math.floor((now.getTime() - b.getTime()) / (365.25 * 864e5))} lat)`;
  }
  const w = num(hass.states[p.weight]?.state);
  const b = w !== null && heightCm ? bmi(w, heightCm) : null;
  const rowsHtml = list
    .map((m) => `<tr><td>${date(m.t)}</td><td>${time(m.t)}</td><td>${partOfDay(m.t)}</td><td>${m.sys}</td><td>${m.dia}</td><td>${m.pul ?? "—"}</td><td>${bpClass(m.sys, m.dia)}</td></tr>`)
    .join("");
  const doc = `<!doctype html><html lang="pl"><head><meta charset="utf-8"><title>Raport ciśnienia — ${esc(p.report_name || p.name)}</title>
<style>
body{font-family:Arial,sans-serif;font-size:13px;color:#333;margin:0;padding:24px 32px}
h1{text-align:center;font-size:15px;text-transform:uppercase;letter-spacing:1px;margin-bottom:22px}
.info{width:100%;border-collapse:collapse;margin-bottom:24px}.info td{padding:4px 8px}.info td:first-child{font-weight:700;width:170px}
h2{font-size:13px;text-transform:uppercase;letter-spacing:.5px;color:#1a5276;border-bottom:2px solid #1a5276;padding-bottom:3px;margin:20px 0 10px}
.data{width:100%;border-collapse:collapse;margin-bottom:20px;font-size:12px}
.data th{padding:8px 6px;font-size:11px;font-weight:600;color:#555;background:#f0f0f0;border:1px solid #ddd}
.data td{padding:6px 8px;text-align:center;border:1px solid #e0e0e0}.data tbody tr:nth-child(even){background:#f7f7f7}
.stat{width:100%;border-collapse:collapse;margin-bottom:20px;font-size:12px}
.stat th{padding:8px 10px;background:#2e86c1;color:#fff}.stat td{padding:6px 10px;text-align:center;border-bottom:1px solid #dce9f5}
.stat tbody tr:nth-child(odd){background:#eaf4fb}
.foot{font-size:10px;color:#888;text-align:center;margin-top:30px;border-top:1px solid #eee;padding-top:8px;font-style:italic}
@media print{body{padding:10px}}
</style></head><body>
<h1>Raport pomiarów ciśnienia tętniczego</h1>
<table class="info"><tbody>
<tr><td>Imię i nazwisko:</td><td>${esc(p.report_name || p.name)}</td></tr>
${age ? `<tr><td>Data urodzenia:</td><td>${age}</td></tr>` : ""}
<tr><td>Wzrost / Waga:</td><td>${heightCm ? `${pl(heightCm, 0)} cm` : "—"} / ${w === null ? "—" : `${pl(w, 1)} kg`}</td></tr>
<tr><td>BMI:</td><td>${b === null ? "—" : `${pl(b, 1)} (${bmiCat(b).label})`}</td></tr>
<tr><td>Okres pomiarów:</td><td>${date(start)} — ${date(now)}</td></tr>
${p.report_device ? `<tr><td>Urządzenie:</td><td>${esc(p.report_device)}</td></tr>` : ""}
</tbody></table>
<h2>Wyniki pomiarów</h2>
<table class="data"><thead><tr><th>Data</th><th>Czas</th><th>Pora</th><th>Skurczowe<br>(mmHg)</th><th>Rozkurczowe<br>(mmHg)</th><th>Puls<br>(bpm)</th><th>Kategoria</th></tr></thead>
<tbody>${rowsHtml || '<tr><td colspan="7">Brak pomiarów w tym okresie.</td></tr>'}</tbody></table>
<h2>Podsumowanie statystyczne</h2>
<table class="stat"><thead><tr><th>Parametr</th><th>Średnia</th><th>Min</th><th>Max</th><th>Ocena</th></tr></thead><tbody>
<tr><td>Skurczowe (mmHg)</td><td>${show(sA)}</td><td>${show(min(sys))}</td><td>${show(max(sys))}</td><td rowspan="2">${overall}</td></tr>
<tr><td>Rozkurczowe (mmHg)</td><td>${show(dA)}</td><td>${show(min(dia))}</td><td>${show(max(dia))}</td></tr>
<tr><td>Puls (bpm)</td><td>${show(pA)}</td><td>${show(min(pul))}</td><td>${show(max(pul))}</td><td>${pulse}</td></tr>
</tbody></table>
<div class="foot">Data wygenerowania: ${date(now)} ${now.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })} | Dane z Home Assistant | Liczba pomiarów: ${list.length}</div>
</body></html>`;
  win.document.open();
  win.document.write(doc);
  win.document.close();
  win.focus();
  win.setTimeout(() => win.print(), 300);
}
