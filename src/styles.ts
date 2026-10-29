// Style panelu: tokeny z motywu HA + akcenty z makiety, trzy style kart (.s-tiles, .s-list, .s-dials).

import { css } from "lit";

export const styles = css`
:host {
  display: block;
  min-height: 100%;
  --bg: var(--primary-background-color, #e9edf1);
  --surface: var(--card-background-color, #ffffff);
  --surface-2: var(--secondary-background-color, #f3f5f8);
  --line: var(--divider-color, #d6dce3);
  --fg: var(--primary-text-color, #16202b);
  --muted: var(--secondary-text-color, #5a6776);
  --faint: var(--disabled-text-color, #8794a2);
  --ember: #cf5a1e; --ember-soft: #fbe6da;
  /* Kolor wiodący (przyciski, zaznaczenia, zakładki, fokus) — wybierany w ustawieniach; stany (grzanie itd.) zostają w --ember. */
  --accent: var(--ember); --on-accent: #fff;
  --accent-soft: color-mix(in srgb, var(--accent) 14%, var(--surface));
  --frost: #2f6fb3; --frost-soft: #e0ecf8;
  --bath: #8a4fb8; --bath-soft: #efe4f8;
  --air: #0e7c84; --air-soft: #d9f0f1;
  --ok: #2f8a4f; --warn: #b7791f; --crit: #c2382f;
  --temp-l: 40%;
  --shadow: 0 1px 2px rgba(22, 32, 43, .06), 0 4px 16px rgba(22, 32, 43, .06);
  --f-num: "Archivo", "Arial Narrow", var(--ha-font-family-body, Roboto), sans-serif;
  --f-body: "Atkinson Hyperlegible", var(--ha-font-family-body, Roboto), system-ui, sans-serif;
  --f-mono: "JetBrains Mono", ui-monospace, monospace;
  --f-dial: "Bricolage Grotesque", "Archivo", system-ui, sans-serif;
  --c-l1: 96%; --c-l2: 87%; --c-sat: 80%;
  --ring-track: rgba(22, 32, 43, .09); --glass: rgba(255, 255, 255, .62);
  background: var(--bg); color: var(--fg); font-family: var(--f-body); font-size: 15px; line-height: 1.45;
}
:host([dark]) {
  --ember: #ff8a4c; --ember-soft: #3a2116; --frost: #74aef0; --frost-soft: #17283b;
  --bath: #c393ec; --bath-soft: #2b1f38; --air: #55d0d8; --air-soft: #0f2a2c;
  --ok: #5cc982; --warn: #e3b04b; --crit: #f0706a;
  --temp-l: 68%; --shadow: 0 1px 0 rgba(255, 255, 255, .03), 0 6px 20px rgba(0, 0, 0, .35);
  --c-l1: 20%; --c-l2: 10%; --c-sat: 45%; --ring-track: rgba(255, 255, 255, .1); --glass: rgba(255, 255, 255, .07);
}
* { box-sizing: border-box; }
.wrap { max-width: 1320px; margin: 0 auto; padding-inline: 20px; padding-block: 18px 40px; display: grid; gap: 18px; }

/* nagłówek */
.top { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 10px 20px; }
.top h1 { margin: 0; font-family: var(--f-num); font-stretch: 85%; font-weight: 800; font-size: 32px; letter-spacing: -.01em; text-wrap: balance; }
.top h1 small { font-weight: 500; font-stretch: 100%; color: var(--muted); font-size: 15px; margin-left: 8px; letter-spacing: 0; }

/* pasek domu */
.house { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1px; background: var(--line);
  border: 1px solid var(--line); border-radius: 14px; overflow: hidden; }
.hcell { background: var(--surface); padding: 12px 16px; display: grid; gap: 2px; min-width: 0; }
.hlabel { font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: var(--muted); }
.hval { font-family: var(--f-num); font-weight: 700; font-size: 24px; font-variant-numeric: tabular-nums; line-height: 1.15; }
.hval .u { font-size: 15px; font-weight: 500; color: var(--muted); margin-left: 1px; }
.hsub { font-size: 12.5px; color: var(--muted); }
.dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; vertical-align: 1px; background: var(--faint); }
.dot.ok { background: var(--ok); } .dot.heat { background: var(--ember); } .dot.warn { background: var(--warn); }

/* legenda osi dnia */

/* siatka pokoi */
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)); gap: 14px; }
.room { background: var(--surface); border: 1px solid var(--line); border-radius: 16px; box-shadow: var(--shadow);
  padding: 14px 16px 12px; display: grid; gap: 10px; cursor: pointer; text-align: left; font: inherit; color: inherit;
  position: relative; transition: border-color .15s, transform .15s; min-width: 0; }
.room:hover { border-color: var(--faint); }
.room:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.room[aria-expanded="true"] { border-color: var(--accent); }
.rhead { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.rname { font-family: var(--f-num); font-stretch: 90%; font-weight: 700; font-size: 18px; }
.chip { font-size: 11.5px; font-weight: 700; border-radius: 999px; padding: 3px 9px; white-space: nowrap; display: inline-flex; align-items: center; gap: 5px; }
.chip.idle { background: var(--surface-2); color: var(--muted); }
.chip.heat { background: var(--ember-soft); color: var(--ember); }
.chip.window { background: var(--frost-soft); color: var(--frost); }
.chip.off { background: var(--surface-2); color: var(--faint); }
.flame { width: 10px; height: 12px; }
@media (prefers-reduced-motion: no-preference) {
  .chip.heat .flame { animation: flick 1.4s ease-in-out infinite; transform-origin: 50% 100%; }
  @keyframes flick { 0%,100% { transform: scaleY(1); } 50% { transform: scaleY(.82) skewX(-4deg); } }
}

.rmain { display: grid; grid-template-columns: auto 1fr; gap: 14px; align-items: center; }
.gauge { width: 112px; height: 72px; display: block; }
.now { display: grid; gap: 2px; min-width: 0; }
.tbig { font-family: var(--f-num); font-weight: 800; font-size: 46px; line-height: 1; font-variant-numeric: tabular-nums; letter-spacing: -.02em; }
.tbig .u { font-size: 22px; font-weight: 600; margin-left: 1px; }
.target { font-size: 13.5px; color: var(--muted); }
.target b { color: var(--fg); font-family: var(--f-num); font-size: 15px; }
.delta { font-size: 12.5px; font-weight: 700; }

.spark { width: 100%; height: 46px; display: block; }
.timeline { display: grid; gap: 3px; }
.tbar { position: relative; height: 10px; border-radius: 5px; overflow: hidden; background: var(--surface-2); display: flex; }
.tbar span { height: 100%; }
.tbar .k { background: color-mix(in srgb, var(--ember) 55%, transparent); }
.tbar .e { background: color-mix(in srgb, var(--frost) 45%, transparent); }
.tbar .w { background: color-mix(in srgb, var(--bath) 65%, transparent); }
.tnow { position: absolute; top: -3px; bottom: -3px; width: 2px; background: var(--fg); border-radius: 1px; }
.tticks { display: flex; justify-content: space-between; font-size: 10.5px; color: var(--faint); font-variant-numeric: tabular-nums; }
.tcap { font-size: 12.5px; color: var(--muted); }

.rfoot { display: flex; flex-wrap: wrap; gap: 6px 14px; font-size: 12.5px; color: var(--muted); border-top: 1px solid var(--line); padding-top: 8px; }
.rfoot span { display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; }
.rfoot svg { width: 13px; height: 13px; }

/* panel ustawień pokoju */
.detail { grid-column: 1 / -1; background: var(--surface); border: 1px solid var(--accent); border-radius: 16px; padding: 16px 18px;
  display: grid; gap: 16px; box-shadow: var(--shadow); }
.dhead { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; }
.dhead h2 { margin: 0; font-family: var(--f-num); font-stretch: 90%; font-size: 22px; }
.dcols { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 14px; }
.box { background: var(--surface-2); border-radius: 12px; padding: 12px 14px; display: grid; gap: 10px; min-width: 0; align-content: start; }
.box.air { grid-column: 1 / -1; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 10px 22px; }
.box.air > h3 { grid-column: 1 / -1; }
.airc { display: grid; gap: 10px; align-content: start; min-width: 0; }
.btn svg { width: 16px; height: 16px; }
.box h3 { margin: 0; font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: var(--muted); font-weight: 700; }
.prof { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 10px; border: 1px solid transparent; }
.prof.on { border-color: currentColor; background: var(--surface); }
.prof.k { color: var(--ember); } .prof.e { color: var(--frost); } .prof.w { color: var(--bath); }
.prof .pl { color: var(--fg); font-weight: 700; font-size: 14px; display: grid; }
.prof .pl small { color: var(--muted); font-weight: 400; font-size: 12px; }
.step { display: inline-flex; align-items: center; gap: 6px; }
.step button, .btn { font: inherit; font-weight: 700; color: var(--fg); background: var(--surface); border: 1px solid var(--line); border-radius: 9px; cursor: pointer; }
.step button { width: 30px; height: 30px; font-size: 17px; line-height: 1; }
.step button:hover, .btn:hover { border-color: var(--faint); }
.step button:focus-visible, .btn:focus-visible, .switch:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.step output { font-family: var(--f-num); font-weight: 700; font-size: 19px; min-width: 52px; text-align: center; font-variant-numeric: tabular-nums; color: var(--fg); }
.acts { display: flex; flex-wrap: wrap; gap: 8px; }
.btn { padding: 8px 12px; font-size: 13.5px; display: inline-flex; align-items: center; gap: 6px; }
.btn.hot { color: var(--accent); border-color: color-mix(in srgb, var(--accent) 50%, var(--line)); }
.row { display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: 14px; }
.switch { width: 44px; height: 24px; border-radius: 12px; background: var(--line); border: 0; position: relative; cursor: pointer; flex: none; }
.switch::after { content: ""; position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 50%; background: var(--surface); transition: left .15s; }
.switch[aria-checked="true"] { background: var(--accent); }
.switch[aria-checked="true"]::after { left: 23px; }
.why { font-size: 13.5px; color: var(--fg); background: var(--surface); border-radius: 10px; padding: 10px 12px; border: 1px solid var(--line); }
.why b { font-family: var(--f-num); }
.row > span > small { display: block; color: var(--muted); font-size: 12px; }
.trange { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.fld { display: grid; gap: 6px; font-size: 14px; min-width: 0; }
.fld select { font: inherit; font-size: 13.5px; color: var(--fg); background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 7px 8px; width: 100%; min-width: 0; }
.tags { display: flex; flex-wrap: wrap; gap: 6px; }
.tag { display: inline-flex; align-items: center; gap: 4px; font: inherit; font-size: 12.5px; padding: 3px 4px 3px 10px; border-radius: 999px; background: var(--surface); border: 1px solid var(--line); color: var(--fg); }
.tag.open { border-color: var(--frost); color: var(--frost); }
.tag button { font: inherit; font-size: 15px; line-height: 1; border: 0; background: none; color: var(--muted); cursor: pointer; width: 24px; height: 24px; border-radius: 50%; }
.tag button:hover { background: var(--surface-2); color: var(--fg); }
.tag.pick { cursor: pointer; padding: 6px 12px; font-weight: 600; }
.tag.pick small { color: var(--muted); font-weight: 400; }
.tag.pick.on { border-color: var(--accent); background: var(--accent-soft); }
.tag.pick:hover { border-color: var(--faint); }
.tag.pick.on:hover { border-color: var(--accent); }
.tag button:focus-visible, .tag.pick:focus-visible, .fld select:focus-visible, .tsel select:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.toast { position: fixed; left: 50%; bottom: calc(18px + env(safe-area-inset-bottom, 0px)); transform: translateX(-50%); background: var(--fg); color: var(--bg);
  padding: 9px 14px; border-radius: 10px; font-size: 13.5px; box-shadow: var(--shadow); max-width: calc(100% - 32px); }
@media (max-width: 420px) { .wrap { padding-inline: 16px; } .tbig { font-size: 40px; } .gauge { width: 96px; height: 62px; } }

/* na zewnątrz */
.outdoor { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 14px; }
.ocell { background: var(--surface); border: 1px solid var(--line); border-radius: 16px; box-shadow: var(--shadow); padding: 12px 16px; display: grid; gap: 4px; align-content: start; min-width: 0; }
.ocell .hval { font-size: 28px; }
.orow { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
.ospark { width: 100%; height: 34px; display: block; margin-top: 4px; }
.trend { font-size: 12.5px; font-weight: 700; }
.lvl { font-size: 11.5px; font-weight: 700; border-radius: 999px; padding: 2px 8px; white-space: nowrap; }
.pmrow { display: grid; grid-template-columns: 52px 1fr auto; gap: 8px; align-items: center; font-size: 12.5px; color: var(--muted); }
.pmrow b { color: var(--fg); font-family: var(--f-num); font-size: 15px; font-variant-numeric: tabular-nums; }
.pmbar { height: 6px; border-radius: 3px; background: var(--surface-2); position: relative; overflow: hidden; }
.pmbar i { position: absolute; inset: 0 auto 0 0; border-radius: 3px; }
.sunarc { width: 100%; height: 56px; display: block; }

/* urządzenia w pokoju (wentylator, osuszacz) */
.rdev { display: grid; gap: 6px; }
.dev { display: grid; grid-template-columns: 30px 1fr auto; gap: 10px; align-items: center; background: var(--surface-2); border-radius: 10px; padding: 6px 10px 6px 6px; }
.dico { width: 30px; height: 30px; border-radius: 8px; display: grid; place-items: center; color: var(--faint); background: var(--surface); }
.dico svg { width: 18px; height: 18px; }
.dev.on .dico { color: var(--air); background: var(--air-soft); }
.dtxt { display: grid; min-width: 0; font-size: 13px; line-height: 1.3; }
.dtxt small { color: var(--muted); font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dstate { font-size: 11.5px; font-weight: 700; border-radius: 999px; padding: 3px 9px; background: var(--surface); color: var(--muted); white-space: nowrap; }
.dev.on .dstate { background: var(--air-soft); color: var(--air); }
.hbar { position: relative; height: 8px; border-radius: 4px; background: var(--surface); overflow: hidden; }
.hbar i { position: absolute; top: 0; bottom: 0; background: var(--air); border-radius: 2px; min-width: 2px; }
.lane { display: grid; grid-template-columns: 150px 1fr; gap: 8px; align-items: center; font-size: 12.5px; color: var(--muted); }
.rule { font-size: 12.5px; color: var(--muted); line-height: 1.45; }
.humbar { position: relative; height: 10px; border-radius: 5px; background: linear-gradient(90deg, color-mix(in srgb, var(--warn) 40%, transparent), color-mix(in srgb, var(--ok) 35%, transparent) 35% 65%, color-mix(in srgb, var(--air) 55%, transparent)); }
.humbar .cel { position: absolute; top: -4px; bottom: -4px; width: 2px; background: var(--fg); }
.humbar .now { position: absolute; top: 50%; width: 12px; height: 12px; border-radius: 50%; background: var(--surface); border: 2.5px solid var(--air); transform: translate(-50%, -50%); }
@media (prefers-reduced-motion: no-preference) {
  .dev.on .fanico { animation: spin 1.1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
}

/* ustawienia panelu */
.gear { font: inherit; font-size: 13.5px; font-weight: 700; color: var(--fg); background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 8px 12px; cursor: pointer; display: inline-flex; gap: 6px; align-items: center; }
.gear:hover { border-color: var(--faint); }
.gear svg { width: 16px; height: 16px; }
dialog.set { border: 1px solid var(--line); border-radius: 18px; background: var(--surface); color: var(--fg); padding: 0; width: min(560px, calc(100% - 32px)); box-shadow: var(--shadow); }
dialog.set::backdrop { background: rgba(10, 14, 18, .45); }
.set-in { padding: 18px 20px; display: grid; gap: 14px; }
.set-in h2 { margin: 0; font-family: var(--f-num); font-stretch: 90%; font-size: 21px; }
.set-in h3 { margin: 0; font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: var(--muted); }
.opt { display: grid; grid-template-columns: 22px 1fr; gap: 10px; align-items: start; padding: 10px 12px; border: 1px solid var(--line); border-radius: 12px; cursor: pointer; }
.opt:has(input:checked) { border-color: var(--accent); background: var(--accent-soft); }
.opt input { margin: 3px 0 0; accent-color: var(--accent); width: 16px; height: 16px; }
.opt b { display: block; }
.opt small { color: var(--muted); font-size: 12.5px; }
.cfg { font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 12.5px; background: var(--surface-2); border-radius: 10px; padding: 10px 12px; white-space: pre; overflow-x: auto; margin: 0; }
.set-foot { display: flex; justify-content: flex-end; }

/* ===== Styl B: lista — tablica przyrządów ===== */
.s-list { --f-mono: "JetBrains Mono", ui-monospace, monospace; }
.s-list .house { border-radius: 4px; }
.s-list .hval { font-family: var(--f-mono); font-weight: 600; font-size: 21px; letter-spacing: -.02em; }
.s-list .grid { grid-template-columns: 1fr; gap: 0; background: var(--surface); border: 1px solid var(--line); border-radius: 4px; overflow: hidden; }
.lhead, .lrow { display: grid; grid-template-columns: minmax(150px, 1.1fr) 112px minmax(170px, 1.5fr) minmax(170px, 2fr) 110px; gap: 20px; align-items: center; padding: 0 18px; }
.lhead { font-size: 10.5px; text-transform: uppercase; letter-spacing: .1em; color: var(--faint); padding-block: 9px; border-bottom: 1px solid var(--line); background: var(--surface-2); }
.lrow { padding-block: 12px; border: 0; border-bottom: 1px solid var(--line); background: var(--surface); font: inherit; color: inherit; text-align: left; cursor: pointer; width: 100%; position: relative; }
.lrow:hover { background: var(--surface-2); }
.lrow:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.lrow[aria-expanded="true"] { background: var(--surface-2); box-shadow: inset 4px 0 0 var(--accent); }
.lname { display: grid; gap: 3px; min-width: 0; }
.lname b { font-size: 16px; }
.lstat { font-size: 12px; color: var(--muted); display: flex; align-items: center; gap: 6px; }
.lstat.heat { color: var(--ember); } .lstat.window { color: var(--frost); }
.ltemp { font-family: var(--f-mono); display: grid; line-height: 1.1; }
.ltemp .v { font-size: 30px; font-weight: 800; letter-spacing: -.04em; }
.ltemp .z { font-size: 12px; color: var(--muted); }
.scale { width: 100%; height: 38px; display: block; overflow: visible; }
.lspark { display: grid; gap: 4px; min-width: 0; }
.lspark .spark { height: 30px; }
.lspark .tbar { height: 5px; border-radius: 2px; }
.lspark .tnow { top: -2px; bottom: -2px; }
.lmeta { font-family: var(--f-mono); font-size: 12px; color: var(--muted); display: grid; gap: 2px; text-align: right; }
.s-list .detail { border-radius: 0; border: 0; border-bottom: 1px solid var(--line); box-shadow: inset 4px 0 0 var(--accent); background: var(--surface-2); }
.s-list .box { background: var(--surface); border-radius: 4px; border: 1px solid var(--line); }
.s-list .step output, .s-list .row b { font-family: var(--f-mono); }
@media (max-width: 760px) {
  .lhead { display: none; }
  .lrow { grid-template-columns: 1fr auto; grid-template-areas: "n t" "s s" "p p"; gap: 8px 14px; padding-inline: 16px; }
  .lrow .lname { grid-area: n; } .lrow .ltemp { grid-area: t; text-align: right; } .lrow .lscale { grid-area: s; } .lrow .lspark { grid-area: p; } .lrow .lmeta { display: none; }
}

/* ===== Styl C: pokrętła — kolorowe karty jak termostat ===== */
.s-dials { --f-dial: "Bricolage Grotesque", "Archivo", system-ui, sans-serif; --c-l1: 96%; --c-l2: 87%; --c-sat: 80%; --ring-track: rgba(22, 32, 43, .09); --glass: rgba(255, 255, 255, .62); }
:host([dark]) .s-dials { --c-l1: 20%; --c-l2: 10%; --c-sat: 45%; --ring-track: rgba(255, 255, 255, .1); --glass: rgba(255, 255, 255, .07); }
.s-dials .top h1 { font-family: var(--f-dial); font-stretch: 100%; }
.s-dials .house { background: none; border: 0; gap: 10px; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); }
.s-dials .hcell { border-radius: 20px; border: 1px solid var(--line); }
.s-dials .hval { font-family: var(--f-dial); }
.s-dials .grid { grid-template-columns: repeat(auto-fill, minmax(255px, 1fr)); gap: 16px; }
.dial { --h: 200; border-radius: 28px; padding: 14px 14px 12px; display: grid; gap: 6px; position: relative; isolation: isolate; overflow: hidden;
  background: linear-gradient(160deg, hsl(var(--h) var(--c-sat) var(--c-l1)), hsl(var(--h) var(--c-sat) var(--c-l2)));
  border: 1px solid color-mix(in srgb, hsl(var(--h) 60% 50%) 22%, transparent); box-shadow: var(--shadow); transition: transform .2s, box-shadow .2s; }
.dial.sel { outline: 3px solid hsl(var(--h) 70% var(--temp-l)); outline-offset: 2px; }
.dial-open { all: unset; cursor: pointer; display: grid; gap: 2px; border-radius: 20px; }
.dial-open:focus-visible { outline: 2px solid var(--fg); outline-offset: 2px; }
.dial-top { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 0 4px; }
.dial-top b { font-family: var(--f-dial); font-size: 19px; font-weight: 700; }
.dial .chip { background: var(--glass); backdrop-filter: blur(6px); }
.dial .chip.heat { color: var(--ember); }
.ring { width: 100%; max-width: 220px; aspect-ratio: 1; margin: 0 auto -18px; display: block; }
.ring .tv { font-family: var(--f-dial); font-weight: 800; font-size: 46px; letter-spacing: -.03em; }
.ring .tu { font-family: var(--f-dial); font-weight: 600; font-size: 20px; }
.ring .tl { font-family: var(--f-body); font-size: 12.5px; }
.dial-ctl { display: grid; grid-template-columns: 44px 1fr 44px; align-items: center; gap: 8px; }
.dial-ctl button { width: 44px; height: 44px; border-radius: 50%; border: 0; background: var(--glass); backdrop-filter: blur(6px); font: inherit; font-size: 22px; font-weight: 700; color: var(--fg); cursor: pointer; }
.dial-ctl button:hover { background: var(--surface); }
.dial-ctl button:focus-visible { outline: 2px solid var(--fg); outline-offset: 2px; }
.dial-ctl button:disabled { opacity: .4; cursor: not-allowed; }
.dial-ctl .cel { text-align: center; display: grid; line-height: 1.2; }
.dial-ctl .cel b { font-family: var(--f-dial); font-size: 22px; }
.dial-ctl .cel small { font-size: 12px; color: var(--muted); }
.pills { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; }
.pill { font-size: 12px; background: var(--glass); border-radius: 999px; padding: 4px 9px; display: inline-flex; gap: 5px; align-items: center; color: var(--muted); }
.pill svg { width: 12px; height: 12px; }
.pill.on { color: var(--fg); font-weight: 700; }
.dial .timeline { padding: 2px 6px 0; }
.dial .tbar { background: var(--glass); height: 6px; }
@media (prefers-reduced-motion: no-preference) {
  .dial:hover { transform: translateY(-3px); }
  .dial.heating::before { content: ""; position: absolute; inset: -40%; z-index: -1; background: radial-gradient(circle at 50% 40%, color-mix(in srgb, var(--ember) 35%, transparent), transparent 55%); animation: breathe 3.2s ease-in-out infinite; }
  @keyframes breathe { 0%, 100% { opacity: .35; transform: scale(.92); } 50% { opacity: .9; transform: scale(1.04); } }
}
.s-dials .detail { border-radius: 28px; border-color: var(--line); }
.s-dials .box { border-radius: 20px; }
.s-dials .detail h2 { font-family: var(--f-dial); font-stretch: 100%; }

/* nagłówek panelu */
.top { align-items: center; }
.top-l { display: flex; align-items: center; gap: 6px; min-width: 0; }
.menu { width: 40px; height: 40px; border: 0; border-radius: 50%; background: none; color: var(--fg); cursor: pointer; display: grid; place-items: center; margin-left: -8px; }
.menu svg { width: 24px; height: 24px; }
.menu:hover { background: var(--surface-2); }
.legend { display: flex; flex-wrap: wrap; gap: 6px 16px; font-size: 12.5px; color: var(--muted); align-items: center; }
.legend i { display: inline-block; width: 22px; height: 8px; border-radius: 3px; margin-right: 6px; vertical-align: 1px; }
.foot { font-size: 12.5px; color: var(--faint); margin: 0; }
.empty { background: var(--surface); border: 1px dashed var(--line); border-radius: 16px; padding: 24px; color: var(--muted); }
.pill.air { color: var(--air); }
.prof.airp { color: var(--air); }
.toast[hidden] { display: none; }
/* zakładki */
.tabs { display: flex; gap: 2px; overflow-x: auto; scrollbar-width: none; border-bottom: 1px solid var(--line); margin-top: -6px; }
/* Zakładki, które się nie mieszczą: wygaszona krawędź po tej stronie, gdzie coś jest schowane (klasy z tabsEdge). */
.tabs.more { mask-image: linear-gradient(to right, #000 calc(100% - 48px), transparent); }
.tabs.less { mask-image: linear-gradient(to left, #000 calc(100% - 48px), transparent); }
.tabs.more.less { mask-image: linear-gradient(to right, transparent, #000 48px, #000 calc(100% - 48px), transparent); }
.tabs::-webkit-scrollbar { display: none; }
.tabs a { color: var(--muted); text-decoration: none; font-weight: 700; font-size: 14.5px; padding: 10px 11px; flex: none; border-bottom: 3px solid transparent; white-space: nowrap; border-radius: 8px 8px 0 0; }
.tabs a:hover { color: var(--fg); background: var(--surface-2); }
.tabs a.on { color: var(--fg); border-bottom-color: var(--accent); }
.tabs a:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
@media (max-width: 600px) { .gear span { display: none; } }

/* sekcje zakładek */
.sec { display: grid; gap: 12px; }
.sec h2 { margin: 6px 0 0; font-family: var(--f-num); font-stretch: 92%; font-size: 19px; font-weight: 800; }
.sec h2 small { font-family: var(--f-body); font-weight: 400; font-size: 13px; color: var(--muted); margin-left: 6px; }
.cards { display: grid; gap: 14px; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); }
.cards.two { grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 1fr)); }
.cards.persons { grid-template-columns: repeat(auto-fill, minmax(min(100%, 250px), 1fr)); }
.cards.gates { grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr)); }
.cards.meters { grid-template-columns: repeat(auto-fill, minmax(min(100%, 330px), 1fr)); align-items: start; }
.hval.big { font-size: 34px; }
.ocell.list { gap: 2px; }
.swatch { display: inline-block; width: 9px; height: 9px; border-radius: 2px; margin-right: 6px; }

/* osoby */
.person { --pc: var(--frost); background: var(--surface); border: 1px solid var(--line); border-radius: 16px; box-shadow: var(--shadow); padding: 12px 14px; display: grid; grid-template-columns: 52px 1fr; gap: 12px; align-items: center; }
.avatar { width: 52px; height: 52px; border-radius: 50%; display: grid; place-items: center; overflow: hidden; font-family: var(--f-num); font-weight: 800; font-size: 22px; color: #fff; background: var(--pc); box-shadow: 0 0 0 3px var(--surface), 0 0 0 5px color-mix(in srgb, var(--pc) 70%, transparent); }
.person:not(.home) .avatar { filter: saturate(.55); opacity: .85; }
.avatar { position: relative; }
.avatar img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.wico2 svg { width: 20px; height: 20px; display: block; }
.cards.two.top { align-items: start; }
/* Karty lojalnościowe (PAYBACK, Lidl Plus): w rzędzie obok siebie, z proporcjami karty; na telefonie jedna pod drugą. */
.cards.loyal { grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr)); }
button.person { font: inherit; color: inherit; text-align: left; cursor: pointer; width: 100%; }
button.person:hover { border-color: var(--faint); }
button.person:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.seg2 { display: inline-flex; flex-wrap: wrap; gap: 4px; background: var(--surface-2); border-radius: 12px; padding: 3px; justify-self: start; }
.seg2 button { font: inherit; font-size: 13px; font-weight: 700; color: var(--muted); background: none; border: 0; border-radius: 9px; padding: 6px 12px; cursor: pointer; }
.seg2 button.on { background: var(--surface); color: var(--fg); box-shadow: var(--shadow); }
.seg2 button:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.wxframe { width: 100%; height: min(70vh, 560px); border: 1px solid var(--line); border-radius: 16px; background: var(--surface-2); display: block; }
dialog.pdlg { width: min(720px, calc(100% - 24px)); }
.pinfo { display: flex; flex-wrap: wrap; gap: 4px 16px; font-size: 13.5px; color: var(--muted); }
.pinfo b { color: var(--fg); }
.pinfo a { color: var(--accent); font-weight: 700; text-decoration: none; }
.pmap { height: min(60vh, 440px); border-radius: 14px; overflow: hidden; border: 1px solid var(--line); }
.tmap { position: relative; height: min(60vh, 440px); border-radius: 14px; overflow: hidden; border: 1px solid var(--line); background: var(--surface-2); }
.tmap img { position: absolute; width: 256px; height: 256px; user-select: none; }
.tmap.dark img { filter: invert(1) hue-rotate(180deg) brightness(.85) contrast(.9); }
.tpin { position: absolute; left: 50%; top: 50%; width: 18px; height: 18px; margin: -9px 0 0 -9px; border-radius: 50%; background: var(--accent); border: 3px solid #fff; box-shadow: 0 0 0 6px color-mix(in srgb, var(--accent) 30%, transparent); }
.tattr { position: absolute; right: 6px; bottom: 4px; font-size: 10.5px; background: rgba(255, 255, 255, .8); color: #333; padding: 1px 6px; border-radius: 4px; }
.row .sub { display: block; font-size: 11.5px; color: var(--muted); }
.pmain { display: grid; gap: 2px; min-width: 0; }
.pmain b { font-size: 16px; }
.where { font-size: 12.5px; color: var(--muted); }
.pchips { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 12.5px; color: var(--muted); }
.pchips span { display: inline-flex; gap: 4px; align-items: center; }
.pchips svg { width: 13px; height: 13px; }
.pchips .low { color: var(--crit); font-weight: 700; }

/* bramy, skrzynka, odpady */
.gate, .box2 { background: var(--surface); border: 1px solid var(--line); border-radius: 16px; box-shadow: var(--shadow); padding: 12px 14px; display: grid; grid-template-columns: 40px 1fr auto; gap: 12px; align-items: center; }
.gico { width: 40px; height: 40px; border-radius: 12px; display: grid; place-items: center; background: var(--surface-2); color: var(--muted); }
.gico svg { width: 22px; height: 22px; }
.gtxt { display: grid; min-width: 0; }
.gtxt b { font-size: 15px; }
.gtxt small { font-size: 12.5px; color: var(--muted); }
.gate.open { border-color: var(--ember); }
.gacts { display: flex; gap: 6px; align-items: center; }
.bulb { width: 38px; height: 38px; border-radius: 10px; border: 1px solid var(--line); background: var(--surface); color: var(--faint); cursor: pointer; display: grid; place-items: center; }
.bulb svg { width: 20px; height: 20px; }
.bulb.on { color: var(--warn); background: color-mix(in srgb, var(--warn) 15%, var(--surface)); border-color: color-mix(in srgb, var(--warn) 50%, var(--line)); }
.bulb:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.gate.open .gico { background: var(--ember-soft); color: var(--ember); }
.gate.moving .gico { color: var(--warn); }
@media (prefers-reduced-motion: no-preference) { .gate.moving .gico { animation: pulse 1.2s ease-in-out infinite; } @keyframes pulse { 50% { opacity: .45; } } }
.box2.mail.full { border-color: var(--air); }
.box2.mail.full .gico { background: var(--air-soft); color: var(--air); }
.box2.waste { grid-template-columns: 1fr; gap: 4px; }
/* PAYBACK: karta jak karta lojalnościowa (granatowo-niebieska, biały napis) + okno kuponów */
.pbcard { position: relative; overflow: hidden; isolation: isolate; border-radius: 16px; padding: 14px 16px; color: #fff; cursor: pointer;
  background: radial-gradient(120% 140% at 100% 0%, #2a7bea 0%, transparent 55%), linear-gradient(135deg, #00318f 0%, #0049c6 55%, #0b62e6 100%);
  box-shadow: var(--shadow); display: grid; gap: 4px; align-content: start; min-height: 158px; }
.pbcard::before, .pbcard::after { content: ""; position: absolute; z-index: -1; border-radius: 50%; background: rgba(255, 255, 255, .07); }
.pbcard::before { width: 220px; height: 220px; right: -70px; bottom: -110px; }
.pbcard::after { width: 120px; height: 120px; right: 60px; top: -70px; }
.pbcard.warn { box-shadow: 0 0 0 2px var(--warn), var(--shadow); }
.pbcard:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
.pbtop { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.pbmark { font-weight: 900; font-style: italic; letter-spacing: .03em; font-size: 19px; }
.pbwho { font-size: 12.5px; opacity: .85; }
.pbpts { display: flex; align-items: baseline; gap: 6px; margin-top: 6px; white-space: nowrap; }
.pbpts b { font-family: var(--f-num); font-size: 34px; line-height: 1; letter-spacing: -.01em; }
.pbpts span { font-size: 16px; font-weight: 700; opacity: .9; }
.pbinfo { font-size: 12.5px; opacity: .88; }
.pbsplit { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 12.5px; }
.pbsplit b { font-family: var(--f-num); font-size: 14px; }
.pbhsum { display: flex; flex-wrap: wrap; gap: 6px 18px; font-size: 13.5px; color: var(--muted); margin-bottom: 4px; }
.pbhsum b { color: var(--fg); font-family: var(--f-num); font-size: 16px; }
.pbh { display: grid; grid-template-columns: auto 1fr auto; gap: 10px; align-items: center; padding: 8px 12px; border: 1px solid var(--line); border-radius: 12px; background: var(--surface); }
.pbhtxt { display: grid; min-width: 0; }
.pbhtxt b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pbhtxt small { color: var(--muted); font-size: 12px; }
.pbhp { font-family: var(--f-num); font-size: 15px; white-space: nowrap; }
.pbhp.plus { color: var(--ok); }
.pbhp.minus { color: var(--crit); }
.pbh.lock .pbhp { color: var(--muted); }
.pbstan { justify-self: start; font-size: 12.5px; font-weight: 700; background: #ffd34d; color: #3a2a00; border-radius: 8px; padding: 3px 8px; }
.pbacts { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
.pbbtn { font: inherit; font-size: 13px; font-weight: 700; border-radius: 10px; padding: 7px 12px; border: 1px solid rgba(255, 255, 255, .55); background: rgba(255, 255, 255, .12); color: #fff; cursor: pointer; }
.pbbtn:hover { background: rgba(255, 255, 255, .22); }
.pbbtn:disabled { opacity: .5; cursor: default; }
.pbbtn:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
@media (prefers-reduced-motion: no-preference) { .pbcard.busy .pbpts b { animation: pulse 1.2s ease-in-out infinite; } }
.pbbar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; justify-content: space-between; }
.pbsearch { font: inherit; font-size: 14px; color: var(--fg); background: var(--surface-2); border: 1px solid var(--line); border-radius: 10px; padding: 7px 10px; min-width: 0; flex: 1 1 160px; max-width: 260px; }
.pbsearch:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.pbmeta { color: var(--muted); font-size: 12.5px; }
.pblist { display: grid; gap: 8px; max-height: min(64vh, 640px); overflow-y: auto; overscroll-behavior: contain; padding-right: 2px; }
.pbk { display: grid; grid-template-columns: 52px 1fr auto; gap: 12px; align-items: center; padding: 10px 12px; border: 1px solid var(--line); border-radius: 12px; background: var(--surface); }
.pblogo { position: relative; width: 52px; height: 52px; border-radius: 10px; background: #fff; border: 1px solid var(--line); display: grid; place-items: center; overflow: hidden; }
.pblogo img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; padding: 4px; box-sizing: border-box; background: #fff; }
.pblogo i { font-style: normal; font-weight: 800; color: #0049c6; font-size: 20px; }
.pbktxt { display: grid; gap: 1px; min-width: 0; }
.pbktxt b { font-size: 14.5px; }
.pbben { font-weight: 800; color: #0049c6; font-size: 14px; }
.pbktxt small { font-size: 12.5px; color: var(--muted); }
.pbdo.soon { color: var(--warn); font-weight: 700; }
.pbsklep { font-size: 12px; color: var(--muted); text-align: right; line-height: 1.25; }
.pbk .btn { white-space: nowrap; text-decoration: none; }
@media (max-width: 480px) { .pbk { grid-template-columns: 44px 1fr; } .pblogo { width: 44px; height: 44px; } .pbk > :last-child { grid-column: 1 / -1; justify-self: end; } }
/* Lidl Plus: ta sama karta w barwach Lidla (niebieska, żółte koło z czerwoną obwódką) + okno kuponów */
.lpcard { background: radial-gradient(120% 140% at 100% 0%, #2f7fd6 0%, transparent 55%), linear-gradient(135deg, #003b82 0%, #0050aa 55%, #0a64c2 100%); }
.lpmark { display: inline-flex; align-items: center; gap: 8px; font-weight: 800; font-size: 18px; letter-spacing: .01em; }
.lpmark i { width: 22px; height: 22px; border-radius: 50%; background: #fff000; box-shadow: inset 0 0 0 2.5px #e60a14; }
a.pbbtn { text-decoration: none; display: inline-flex; align-items: center; }
/* okrągłe przyciski „uruchom teraz” i panel z prawej strony rzędu przycisków karty */
.pbside { display: inline-flex; gap: 6px; margin-left: auto; }
.pbbtn.pbico { width: 33px; height: 33px; padding: 0; border-radius: 50%; display: inline-grid; place-items: center; }
.pbbtn.pbico svg { width: 17px; height: 17px; }
.lpk .pbben { color: #c8102e; }
:host([dark]) .lpk .pbben { color: #ff7a7a; }
.lpk .pblogo i { color: #0050aa; }
.lpile { font-weight: 600; font-size: 12px; color: var(--muted); white-space: nowrap; }
.lpchip { font-size: 12px; font-weight: 700; border-radius: 999px; padding: 3px 9px; white-space: nowrap; color: var(--muted); background: var(--surface-2); }
.lpchip.ok { color: var(--ok); background: color-mix(in srgb, var(--ok) 12%, var(--surface)); }
.lpchip.warn { color: var(--warn); background: color-mix(in srgb, var(--warn) 14%, var(--surface)); }
/* okno karty: kod zawsze na białym tle */
.lkod { background: #fff; color: #111; border-radius: 14px; padding: 18px 16px 14px; display: grid; justify-items: center; gap: 10px; }
.lkod svg { display: block; height: auto; }
.lkod svg.qr { width: min(100%, 300px); }
.lkod svg.ean { width: min(100%, 440px); }
.lkod svg.pdf { width: min(100%, 460px); }
.lnum { font-family: var(--f-num); font-size: 20px; letter-spacing: .08em; }
.lnum.big { font-size: 26px; padding: 18px 0; }
/* logotypy kart (encje image automatów) */
.lpbrand { display: inline-flex; align-items: center; }
.lplogo { display: block; height: 24px; width: auto; border-radius: 4px; }
.lplogo.pbl { height: 28px; border-radius: 6px; }
.lpbrand .lplogo:not([hidden]) + .pbmark { display: none; }
.bdmark .lplogo { height: 30px; border-radius: 0; }
/* przełącznik kont na karcie (Moja Biedronka) */
.lpkonta { display: inline-flex; gap: 2px; padding: 2px; border-radius: 999px; background: rgba(255, 255, 255, .16); }
.lpkonta button { font: inherit; font-size: 12.5px; font-weight: 700; color: #fff; background: none; border: 0; border-radius: 999px; padding: 4px 11px; cursor: pointer; }
.lpkonta button.on { background: #fff; color: #c8000e; }
.lpkonta button:focus-visible { outline: 2px solid #fff; outline-offset: 1px; }
/* Moja Biedronka: czerwona karta z kropkami jak na biedronce */
/* Zakupy (lista Bring!): kafelki w barwach aplikacji — do kupienia koralowe, ostatnio kupione morskie, katalog szary. */
.shop { background: var(--surface); border: 1px solid var(--line); border-radius: 16px; box-shadow: var(--shadow); padding: 14px 16px; display: grid; gap: 12px; min-width: 0; }
.shophead { display: flex; align-items: center; gap: 8px 12px; flex-wrap: wrap; }
.shopmark { display: inline-flex; align-items: center; gap: 9px; font-weight: 800; font-size: 18px; }
.shopmark i { width: 30px; height: 30px; border-radius: 9px; background: #ee524f; color: #fff; display: grid; place-items: center; }
.shopmark svg { width: 19px; height: 19px; }
.shopsw { display: inline-flex; gap: 2px; padding: 2px; border-radius: 999px; background: var(--surface-2); border: 1px solid var(--line); }
.shopsw button { font: inherit; font-size: 12.5px; font-weight: 700; color: var(--muted); background: none; border: 0; border-radius: 999px; padding: 4px 12px; cursor: pointer; }
.shopsw button.on { background: #ee524f; color: #fff; }
.shopsw button:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.shopmeta { margin-left: auto; font-size: 12.5px; color: var(--muted); }
.shopadd { display: flex; gap: 8px; flex-wrap: wrap; }
.shopadd input { flex: 1 1 140px; min-width: 0; font: inherit; color: var(--fg); background: var(--surface-2); border: 1px solid var(--line); border-radius: 10px; padding: 9px 12px; }
.shopadd input:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.shopadd .btn { padding: 8px 14px; }
.shopsec { display: grid; gap: 7px; }
.shopsec h4 { margin: 0; font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: var(--muted); font-weight: 700; }
.stiles { display: grid; gap: 8px; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); }
.stiles.small { grid-template-columns: repeat(auto-fill, minmax(84px, 1fr)); }
.stile { aspect-ratio: 1; min-width: 0; border: 0; border-radius: 10px; background: #ee524f; color: #fff; cursor: pointer; font: inherit; text-align: center;
  display: grid; grid-template-rows: minmax(0, 1fr) auto auto; justify-items: center; align-items: center; gap: 1px; padding: 8px 5px 7px; }
.stile img { width: 52%; max-height: 100%; object-fit: contain; }
.stile .sl { font-size: 30px; font-weight: 800; line-height: 1; }
.stile b { font-size: 12.5px; line-height: 1.15; font-weight: 700; overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.stile small { font-size: 11px; line-height: 1.2; opacity: .88; max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.stile.done { background: #4faba2; }
.stiles.small .stile b { font-size: 11.5px; }
.stile.cat.off { background: #5f6f7a; }
.stile.pend { opacity: .45; }
.stile:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
@media (hover: hover) { .stile:hover { filter: brightness(1.07); } }
.shopchips { display: flex; flex-wrap: wrap; gap: 6px; }
.shopcat { display: grid; gap: 10px; padding: 10px; border-radius: 12px; background: var(--surface-2); }
.shopmore { justify-self: start; padding: 6px 12px; font-size: 13px; }
.bdcard { background: radial-gradient(120% 140% at 100% 0%, #ff4b4b 0%, transparent 55%), linear-gradient(135deg, #a8000b 0%, #d9000f 55%, #ef1c24 100%); }
.bdcard::before, .bdcard::after { background: rgba(0, 0, 0, .16); }
.bdcard::before { width: 120px; height: 120px; right: -30px; bottom: -40px; }
.bdcard::after { width: 58px; height: 58px; right: 108px; top: -18px; }
/* e-paragony */
.rcplist { gap: 6px; }
.rcpmon { position: sticky; top: 0; z-index: 1; display: flex; justify-content: space-between; gap: 8px; flex-wrap: wrap; align-items: baseline;
  background: var(--surface); padding: 8px 2px 4px; font-size: 13px; color: var(--muted); }
.rcpmon b { color: var(--fg); font-size: 14px; text-transform: capitalize; }
.rcp { border: 1px solid var(--line); border-radius: 12px; background: var(--surface); }
.rcp > summary { list-style: none; cursor: pointer; display: grid; grid-template-columns: auto 1fr auto auto; gap: 10px; align-items: center; padding: 9px 12px; }
.rcp > summary::-webkit-details-marker { display: none; }
.rcp > summary:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; border-radius: 12px; }
.rcp[open] > summary { border-bottom: 1px solid var(--line); }
.rcpd { font-size: 13.5px; white-space: nowrap; color: var(--muted); }
.rcpd b { color: var(--fg); }
.rcps { font-size: 12.5px; color: var(--muted); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rcpt { font-family: var(--f-num); font-size: 15px; white-space: nowrap; }
.rcpr { color: var(--ok); font-weight: 700; font-size: 12px; white-space: nowrap; }
.rcpi { display: grid; padding: 4px 12px 8px; }
.rcpp { display: grid; grid-template-columns: 1fr auto auto; gap: 10px; align-items: baseline; padding: 4px 0; border-top: 1px solid var(--line); font-size: 13.5px; }
.rcpp:first-child { border-top: 0; }
.rcpp > span { display: grid; min-width: 0; }
.rcpp > small { color: var(--muted); font-size: 12px; white-space: nowrap; }
.rcpp > b { font-family: var(--f-num); white-space: nowrap; }
.rcp > .pbmeta { display: block; padding: 0 12px 10px; }
.rcphit { font-size: 13.5px; background: var(--accent-soft, var(--surface-2)); border-radius: 10px; padding: 8px 12px; }
@media (max-width: 480px) { .rcp > summary { grid-template-columns: 1fr auto auto; } .rcp > summary .rcps { grid-column: 1 / -1; grid-row: 2; } }
.box2.waste h3 { margin: 0 0 4px; font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: var(--muted); }
.wrow { display: grid; grid-template-columns: 26px 1fr auto 74px; gap: 8px; align-items: center; font-size: 14px; padding: 4px 0; border-top: 1px solid var(--line); }
.wrow:first-of-type { border-top: 0; }
.wrow .wdate { color: var(--muted); font-size: 12.5px; }
.wrow b { text-align: right; font-size: 13px; }
.wrow.soon b { color: var(--ember); }
.wrow.soon .wname { font-weight: 700; }

/* prognoza */
.fc { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(66px, 1fr); gap: 6px; overflow-x: auto; padding-bottom: 4px; }
.fday { background: var(--surface); border: 1px solid var(--line); border-radius: 14px; padding: 8px 6px; display: grid; justify-items: center; gap: 2px; font-size: 12px; color: var(--muted); }
.fday.today { border-color: var(--accent); }
.fdn { font-weight: 700; color: var(--fg); text-transform: uppercase; font-size: 11.5px; }
.wico { width: 30px; height: 30px; margin: 2px 0; }
.ftmax { font-family: var(--f-num); font-weight: 800; font-size: 17px; color: var(--fg); }
.ftmin { font-family: var(--f-num); font-weight: 600; font-size: 13px; }
.frange { position: relative; width: 6px; height: 42px; border-radius: 3px; background: var(--surface-2); }
.frange i { position: absolute; left: 0; right: 0; border-radius: 3px; background: linear-gradient(to top, var(--frost), var(--ember)); }
.frain.wet { color: var(--frost); font-weight: 700; }
.fwind { font-size: 11px; }

/* energia */
.hsub svg { width: 20px; height: 20px; color: var(--ember); }
.phase { display: grid; grid-template-columns: 26px 1fr 68px 58px; gap: 10px; align-items: center; font-size: 13.5px; }
.phase b { font-family: var(--f-num); }
.volt { font-family: var(--f-num); font-weight: 700; text-align: right; }
.volt.ok { color: var(--ok); } .volt.warn { color: var(--warn); } .volt.crit { color: var(--crit); }
.zchips { display: flex; flex-wrap: wrap; gap: 6px; }
.zchip { font-size: 12px; background: var(--surface-2); border-radius: 999px; padding: 3px 9px; color: var(--muted); }
.zchip b { color: var(--fg); margin-left: 3px; }
/* słupki: oś wartości, podpisy, podpowiedź po najechaniu / dotknięciu */
.bwrap { container-type: inline-size; }
.bchart.dense .bval { font-size: 9px; font-weight: 600; }
@container (max-width: 560px) { .bchart.dense .bval { display: none; } }
.bchart { display: grid; grid-template-columns: auto 1fr; gap: 6px; margin-top: 4px; }
.byaxis { position: relative; height: var(--bh); min-width: 28px; font-size: 10.5px; color: var(--faint); font-variant-numeric: tabular-nums; }
.byaxis span { position: absolute; right: 0; transform: translateY(50%); line-height: 1; }
.bplot { position: relative; height: var(--bh); display: flex; align-items: flex-end; gap: 2px; padding-bottom: 18px; box-sizing: content-box; }
.bgrid { position: absolute; left: 0; right: 0; height: 0; border-top: 1px dashed var(--line); margin-bottom: 18px; pointer-events: none; }
.bgrid:last-of-type { border-top-style: solid; }
.bcol { position: relative; flex: 1; height: 100%; display: flex; flex-direction: column; justify-content: flex-end; align-items: stretch; cursor: default; outline: none; min-width: 0; }
.bstack { position: relative; display: flex; flex-direction: column-reverse; border-radius: 3px 3px 1px 1px; overflow: visible; min-height: 0; }
.bstack span { display: block; min-height: 1px; opacity: .82; }
.bstack span:last-of-type { border-radius: 3px 3px 0 0; }
.bcol.now .bstack span { opacity: 1; }
.bcol:hover .bstack span, .bcol:focus .bstack span { opacity: 1; filter: brightness(1.12); }
.bval { position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%); font-style: normal; font-size: 10.5px; font-weight: 700; color: var(--muted); white-space: nowrap; padding-bottom: 2px; }
.blab { position: absolute; bottom: -18px; left: 50%; transform: translateX(-50%); font-size: 10.5px; color: var(--faint); white-space: nowrap; }
.bcol.now .blab { color: var(--fg); font-weight: 700; }
.btip { display: none; position: absolute; bottom: calc(100% + 6px); left: 50%; transform: translateX(-50%); z-index: 5; min-width: 130px; background: var(--fg); color: var(--bg); border-radius: 10px; padding: 7px 10px; font-size: 12px; line-height: 1.4; box-shadow: var(--shadow); pointer-events: none; white-space: nowrap; }
.bcol.l .btip { left: 0; transform: none; }
.bcol.r .btip { left: auto; right: 0; transform: none; }
.bcol:hover .btip, .bcol:focus .btip { display: grid; }
.btip .btot { font-family: var(--f-num); font-size: 16px; font-weight: 800; }
.btip .bser { display: flex; align-items: center; gap: 6px; }
.btip .bser i { width: 9px; height: 9px; border-radius: 2px; }
.btip .bser b { margin-left: auto; padding-left: 10px; }
.crow { display: grid; grid-template-columns: minmax(110px, 1.3fr) 2fr 70px 96px; gap: 10px; align-items: center; font-size: 13.5px; padding: 5px 0; border-top: 1px solid var(--line); }
.crow:first-child { border-top: 0; }
.crow b { font-family: var(--f-num); text-align: right; }
.ckwh { color: var(--muted); font-size: 12px; text-align: right; }
.cname { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
details summary { cursor: pointer; color: var(--muted); font-size: 13px; padding: 8px 0 4px; }
@media (max-width: 600px) { .crow { grid-template-columns: 1fr 64px; } .crow .pmbar, .crow .ckwh { display: none; } }

/* kocioł */
.mline { position: relative; background: var(--surface); border: 1px solid var(--line); border-radius: 16px; padding: 12px 14px 8px; box-shadow: var(--shadow); }
.mplot { position: relative; }
.mline svg { width: 100%; height: 150px; display: block; }
.mslot { position: absolute; top: 0; bottom: 0; outline: none; }
.mcross { position: absolute; top: 0; bottom: 0; left: 50%; width: 0; border-left: 1px dashed var(--muted); display: none; }
.mslot:hover .mcross, .mslot:focus .mcross { display: block; }
.mslot .btip { bottom: auto; top: 6px; }
.mslot.l .btip { left: 0; transform: none; }
.mslot.r .btip { left: auto; right: 0; transform: none; }
.mslot:hover .btip, .mslot:focus .btip { display: grid; }
.mlegend b { color: var(--fg); margin-left: 3px; }
.thermo.veto { border-color: var(--ember); }
.vetobar .lock { width: 14px; height: 14px; vertical-align: -2px; margin-right: 6px; }
.vetobar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; background: var(--ember-soft); color: var(--ember); border-radius: 10px; padding: 6px 10px; font-size: 13.5px; }
.mlabels { position: absolute; top: 10px; bottom: 34px; left: 16px; display: flex; flex-direction: column; justify-content: space-between; font-size: 10.5px; color: var(--faint); pointer-events: none; }
.mlegend { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 12px; color: var(--muted); margin-top: 6px; }
.mlegend i { display: inline-block; width: 14px; height: 3px; border-radius: 2px; margin-right: 5px; vertical-align: 3px; }
.mlegend .tt { margin-left: auto; color: var(--faint); }
.boilerhero.burn { border-color: color-mix(in srgb, var(--ember) 60%, var(--line)); background: linear-gradient(160deg, var(--surface), color-mix(in srgb, var(--ember) 10%, var(--surface))); }
.inds { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 4px; }
.ind { display: inline-flex; align-items: center; gap: 6px; background: var(--surface-2); border-radius: 999px; padding: 4px 10px; font-size: 12.5px; font-weight: 700; }
.ind small { font-weight: 400; color: var(--muted); }
.ind i { width: 8px; height: 8px; border-radius: 50%; background: var(--faint); }
.ind.on i { background: var(--ember); box-shadow: 0 0 0 3px color-mix(in srgb, var(--ember) 25%, transparent); }
.thermo .chips { display: flex; flex-wrap: wrap; gap: 6px; }
.mchip { font: inherit; font-size: 12.5px; font-weight: 700; border: 1px solid var(--line); background: var(--surface); color: var(--muted); border-radius: 999px; padding: 5px 11px; cursor: pointer; }
.mchip:hover { border-color: var(--faint); color: var(--fg); }
.mchip.on { background: var(--accent-soft); border-color: var(--accent); color: var(--accent); }
.mchip:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.week { gap: 4px; }
.wday { font: inherit; color: inherit; background: none; border: 0; border-radius: 10px; padding: 5px 6px; display: grid; grid-template-columns: 30px minmax(120px, 2fr) minmax(0, 1.4fr); gap: 10px; align-items: center; cursor: pointer; text-align: left; }
.wday:hover { background: var(--surface-2); }
.wday.sel { background: var(--accent-soft); }
.wday:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.wday b { font-size: 13px; text-transform: uppercase; }
.wbar { position: relative; height: 14px; border-radius: 7px; background: var(--surface-2); overflow: hidden; }
.wbar i { position: absolute; top: 0; bottom: 0; background: var(--ember); border-radius: 3px; opacity: .85; }
.wbar em { position: absolute; top: 0; bottom: 0; width: 1px; background: color-mix(in srgb, var(--fg) 15%, transparent); }
.wtxt { font-size: 12.5px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wscale { cursor: default; padding-top: 0; padding-bottom: 0; }
.wscale:hover { background: none; }
.wticks { position: relative; height: 14px; }
.wticks em { position: absolute; transform: translateX(-50%); font-style: normal; font-size: 10.5px; color: var(--faint); }
.wticks em:first-child { transform: none; }
.wticks em:last-child { transform: translateX(-100%); }
.tsel { display: inline-flex; align-items: center; gap: 2px; color: var(--fg); }
.tsel select { font: inherit; color: var(--fg); background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 5px 4px; }
.sched { gap: 10px; }
.sched h3 { margin: 0; font-size: 15px; }
.srow { display: flex; flex-wrap: wrap; gap: 8px 14px; align-items: center; font-size: 14px; }
.srow label { display: inline-flex; gap: 6px; align-items: center; color: var(--muted); }
.srow input { font: inherit; color: var(--fg); background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 5px 8px; }
.srow input[type=number] { width: 72px; }
.snum { font-weight: 700; width: 18px; }
.serr { background: color-mix(in srgb, var(--crit) 12%, var(--surface)); color: var(--crit); border-radius: 10px; padding: 8px 10px; font-size: 13.5px; }
@media (max-width: 600px) { .wday { grid-template-columns: 28px 1fr; } .wtxt { grid-column: 2; } .wscale { display: none; } }
.setrow { color: var(--fg); padding: 6px 4px; border-top: 1px solid var(--line); border-radius: 0; }
.setrow:first-child { border-top: 0; }

/* przełączniki */
.swhead { display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: center; }
.search { font: inherit; color: var(--fg); background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 8px 12px; min-width: min(100%, 320px); }
.search:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.swgroup .hlabel small { text-transform: none; letter-spacing: 0; margin-left: 6px; color: var(--faint); }
.swgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; margin-top: 6px; }
.sw { font: inherit; color: var(--fg); background: var(--surface-2); border: 1px solid transparent; border-radius: 12px; padding: 8px 10px; display: grid; grid-template-columns: 30px 1fr; gap: 8px; align-items: center; text-align: left; cursor: pointer; min-width: 0; }
.sw:hover { border-color: var(--line); }
.sw:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.sw:disabled { opacity: .5; cursor: not-allowed; }
.swico { width: 30px; height: 30px; border-radius: 9px; display: grid; place-items: center; color: var(--faint); background: var(--surface); }
.swico svg { width: 18px; height: 18px; }
.sw.on .swico { color: var(--warn); background: color-mix(in srgb, var(--warn) 16%, var(--surface)); }
.sw.on.d-switch .swico { color: var(--ember); background: var(--ember-soft); }
.sw.on.d-fan .swico { color: var(--air); background: var(--air-soft); }
.swtxt { display: grid; min-width: 0; }
.swtxt b { font-size: 13.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.swtxt small { font-size: 11.5px; color: var(--muted); }

/* kamery */
.cams { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr)); gap: 12px; }
.cam { font: inherit; color: inherit; padding: 0; border: 1px solid var(--line); border-radius: 14px; overflow: hidden; background: var(--surface); cursor: pointer; text-align: left; box-shadow: var(--shadow); }
.cam:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.camimg { display: block; aspect-ratio: 16 / 9; background: #0b0f14; }
.camimg img { width: 100%; height: 100%; object-fit: cover; display: block; }
.camcap { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 8px 12px; font-size: 13.5px; }
.camcap small { color: var(--muted); }

/* auta, roboty */
.cards.robots { grid-template-columns: repeat(auto-fit, minmax(min(100%, 420px), 1fr)); align-items: start; }
.robmap { padding: 0; border: 1px solid var(--line); border-radius: 12px; overflow: hidden; background: var(--surface-2); cursor: zoom-in; }
.robmap img { width: 100%; max-height: 520px; object-fit: contain; display: block; }
.robot .hlabel { margin-top: 6px; }
.robot b.alarm { color: var(--crit); }
.wear .sub { display: block; font-size: 11.5px; color: var(--muted); }
.wear { display: grid; grid-template-columns: minmax(140px, 1fr) 1.2fr auto; gap: 10px; align-items: center; font-size: 13.5px; }

/* proxmox */
.pxrow { display: grid; grid-template-columns: minmax(170px, 1.4fr) repeat(3, minmax(90px, 1fr)) 190px; gap: 12px; align-items: center; padding: 8px 0; border-top: 1px solid var(--line); }
.pxrow .acts { justify-content: flex-end; }
.pxrow:first-child { border-top: 0; }
.pxrow.off { opacity: .7; }
.pxname { display: grid; grid-template-columns: auto 1fr; column-gap: 6px; align-items: center; }
.pxname small { grid-column: 2; color: var(--muted); font-size: 12px; }
.pxm { display: grid; gap: 2px; font-size: 12px; color: var(--muted); }
.pxbar { display: grid; grid-template-columns: 1fr 40px; gap: 6px; align-items: center; }
.pxbar b { font-family: var(--f-num); text-align: right; color: var(--fg); font-size: 13px; }
@media (max-width: 760px) { .pxrow { grid-template-columns: 1fr 1fr; } .pxname { grid-column: 1 / -1; } .pxrow .acts { grid-column: 1 / -1; } }

/* sieć */
.netlane { grid-template-columns: minmax(200px, 1fr) 2fr; padding: 6px 0; }
.netlane .down .hbar i { background: var(--crit); }
.upd { padding: 6px 0; border-top: 1px solid var(--line); }
.upd:first-child { border-top: 0; }
.ports { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
.port { font: inherit; min-width: 48px; display: grid; justify-items: center; gap: 0; padding: 5px 8px; border-radius: 9px; border: 1px solid var(--line); background: var(--surface-2); color: var(--muted); font-weight: 700; font-size: 13px; }
.port small { font-weight: 400; font-size: 10.5px; }
.port.on { color: var(--ok); border-color: color-mix(in srgb, var(--ok) 45%, var(--line)); background: color-mix(in srgb, var(--ok) 10%, var(--surface)); }
.port.poe { cursor: pointer; }
.port.poe.on { color: var(--ember); border-color: color-mix(in srgb, var(--ember) 45%, var(--line)); background: var(--ember-soft); }

/* alerty, agent */
.alert { font: inherit; color: inherit; background: none; border: 0; border-top: 1px solid var(--line); padding: 10px 4px; display: grid; grid-template-columns: 96px 1fr; gap: 12px; align-items: center; text-align: left; cursor: pointer; }
.alert:first-child { border-top: 0; }
.asev { font-size: 12px; font-weight: 800; border-radius: 999px; padding: 3px 10px; text-align: center; }
.alert.error .asev { background: color-mix(in srgb, var(--crit) 15%, transparent); color: var(--crit); }
.alert.warn .asev { background: color-mix(in srgb, var(--warn) 18%, transparent); color: var(--warn); }
.alert.info .asev { background: var(--frost-soft); color: var(--frost); }
.atxt { display: grid; }
.atxt small { color: var(--muted); font-size: 12.5px; }
.tbadge { display: inline-grid; place-items: center; min-width: 16px; height: 16px; padding: 0 4px; margin-left: 4px; border-radius: 8px; background: var(--crit); color: #fff; font-size: 10.5px; vertical-align: 1px; }
.tbadge.info { background: #ee524f; }
.agent { width: 100%; height: calc(100vh - 170px); min-height: 480px; border: 1px solid var(--line); border-radius: 16px; background: var(--surface); }

/* liczniki */
.mgroup { gap: 0; }
.mgroup .hlabel { margin-bottom: 6px; }
.mrow { display: grid; grid-template-columns: 1fr auto; gap: 2px 12px; align-items: center; padding: 6px 0; border-top: 1px solid var(--line); font-size: 14px; }
.mrow:first-of-type { border-top: 0; }
.mname { display: grid; min-width: 0; }
.mname small { color: var(--muted); font-size: 12px; }
.mval { text-align: right; display: grid; justify-items: end; }
.mval b { font-family: var(--f-num); font-size: 15.5px; font-variant-numeric: tabular-nums; }
.mval small { font-size: 11.5px; color: var(--muted); }
.mval .u { font-size: 12px; color: var(--muted); font-weight: 500; }
.mval b.alarm { color: var(--crit); }
.mval b.onv { color: var(--ember); }
.mspark { grid-column: 1 / -1; }
.mspark .ospark { height: 26px; }

/* zdrowie */
.health .house .hval { font-size: 22px; }
.health .hcell .hsub { overflow: hidden; text-overflow: ellipsis; }
.hpeople { display: flex; flex-wrap: wrap; gap: 8px; }
.hperson { font: inherit; color: var(--fg); display: inline-flex; align-items: center; gap: 10px; padding: 6px 14px 6px 6px; border-radius: 999px;
  background: var(--surface); border: 1px solid var(--line); cursor: pointer; text-align: left; }
.hperson span:last-child { display: grid; line-height: 1.2; }
.hperson small { color: var(--muted); font-size: 12px; font-variant-numeric: tabular-nums; }
.hperson.on { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
.hperson:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.avatar.sm { --pc: var(--frost); width: 34px; height: 34px; font-size: 15px; box-shadow: none; }
.health .orow { align-items: center; }
.bmibar { position: relative; height: 8px; border-radius: 4px; margin: 6px 0 2px;
  background: linear-gradient(90deg, var(--frost) 0 11.7%, var(--ok) 11.7% 33.3%, var(--warn) 33.3% 50%, var(--crit) 50% 66.7%, #a32d2d 66.7% 83.3%, #701515 83.3%); }
.bmibar i { position: absolute; top: -4px; bottom: -4px; width: 3px; margin-left: -1.5px; border-radius: 2px; background: var(--fg); box-shadow: 0 0 0 2px var(--surface); }
/* kolumny legendy = szerokości odcinków paska (skala BMI 15–45) */
.bmilegend { display: grid; grid-template-columns: 11.67fr 21.67fr 16.67fr 16.67fr 16.67fr 16.65fr; font-size: 10.5px; font-weight: 700; font-variant-numeric: tabular-nums; text-align: center; white-space: nowrap; }
.goals { display: grid; gap: 12px 24px; grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr)); }
.goal { display: grid; gap: 4px; }
.glab { display: flex; justify-content: space-between; gap: 8px; font-size: 13.5px; }
.gbar { display: block; height: 8px; border-radius: 4px; background: var(--surface-2); overflow: hidden; }
.gbar i { display: block; height: 100%; border-radius: 4px; }
.bal { display: grid; gap: 2px; }
.balrow { display: grid; grid-template-columns: 110px 1fr 120px; gap: 10px; align-items: center; font-size: 13px; padding: 3px 0; }
.bname { color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bbar { height: 8px; border-radius: 4px; background: var(--surface-2); overflow: hidden; }
.bbar i { display: block; height: 100%; border-radius: 4px; }
.bnum { display: grid; justify-items: end; line-height: 1.2; }
.bnum b { font-family: var(--f-num); font-variant-numeric: tabular-nums; }
.bnum small { font-size: 11px; color: var(--muted); font-variant-numeric: tabular-nums; }
.alertbox { border-radius: 12px; padding: 10px 14px; font-weight: 700; font-size: 14px; border: 1px solid; }
.alertbox.ok { color: var(--ok); border-color: color-mix(in srgb, var(--ok) 45%, transparent); background: color-mix(in srgb, var(--ok) 10%, var(--surface)); }
.alertbox.warn { color: var(--warn); border-color: color-mix(in srgb, var(--warn) 45%, transparent); background: color-mix(in srgb, var(--warn) 10%, var(--surface)); }
.alertbox.crit { color: var(--crit); border-color: color-mix(in srgb, var(--crit) 45%, transparent); background: color-mix(in srgb, var(--crit) 10%, var(--surface)); }
.health .bpbig { text-align: center; justify-items: center; }
.health .bpbig .hval { font-size: 34px; }
.mtile { font: inherit; color: inherit; text-align: left; border: 0; cursor: pointer; }
.mtile .hlabel i { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--mc); margin-right: 6px; }
.mtile.on { box-shadow: inset 0 -3px 0 var(--mc); }
.mtile:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.deform { display: grid; gap: 10px; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); }
.defield { display: grid; gap: 6px; background: var(--surface-2); border-radius: 12px; padding: 10px 12px; }
.defield span { font-size: 12.5px; color: var(--muted); display: flex; justify-content: space-between; gap: 6px; }
.defield small { color: var(--faint); }
.defield input { font: inherit; font-family: var(--f-num); font-size: 24px; font-weight: 700; color: var(--fg); background: transparent; border: 0;
  border-bottom: 2px solid var(--line); padding: 2px 0; width: 100%; min-width: 0; -moz-appearance: textfield; }
.defield input:focus { outline: none; border-bottom-color: var(--accent); }
.defield input:invalid { border-bottom-color: var(--crit); }
.defield input:disabled { opacity: .4; }
.defield input::-webkit-outer-spin-button, .defield input::-webkit-inner-spin-button { -webkit-appearance: none; }
form.ocell .orow { margin-top: 6px; }
.radar { width: 100%; max-width: 420px; justify-self: center; display: block; }
/* wykres liniowy z dowolną osią X */
.xy { display: grid; grid-template-columns: auto 1fr; grid-template-rows: var(--xh) 18px; gap: 4px 6px; margin-top: 6px; }
.xyaxis { position: relative; min-width: 30px; font-size: 10.5px; color: var(--faint); font-variant-numeric: tabular-nums; }
.xyaxis span { position: absolute; right: 0; transform: translateY(50%); line-height: 1; white-space: nowrap; }
.xyplot { position: relative; }
.xyplot svg { width: 100%; height: 100%; display: block; overflow: visible; }
.xyx { grid-column: 2; position: relative; font-size: 10.5px; color: var(--faint); font-variant-numeric: tabular-nums; }
.xyx span { position: absolute; top: 2px; transform: translateX(-50%); white-space: nowrap; }
.xyx span:first-child { transform: none; }
.xyx span:last-child { transform: translateX(-100%); }
.xymark.left { right: auto; left: 2px; }
.xymark { position: absolute; right: 2px; transform: translateY(-2px); font-style: normal; font-size: 10.5px; font-weight: 700; pointer-events: none;
  background: color-mix(in srgb, var(--surface) 80%, transparent); padding: 0 3px; border-radius: 3px; }
.xydot { position: absolute; width: 6px; height: 6px; margin: 0 0 -3px -3px; border-radius: 50%; pointer-events: none; box-shadow: 0 0 0 1.5px var(--surface); }
.xypt { position: absolute; width: 0; height: 0; margin-left: -8px; margin-bottom: -6px; border: 8px solid transparent; border-bottom: 13px solid var(--pc); border-top: 0; pointer-events: none; }
@media (max-width: 600px) { .balrow { grid-template-columns: 84px 1fr 96px; } .health .bpbig .hval { font-size: 26px; } }

/* kolor wiodący w ustawieniach panelu */
.accs { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 6px; }
.acc { display: flex; align-items: center; gap: 8px; padding: 7px 10px; border: 1px solid var(--line); border-radius: 10px; cursor: pointer; font-size: 13.5px; }
.acc:has(input[type="radio"]:checked) { border-color: var(--accent); background: var(--accent-soft); }
.acc input[type="radio"] { position: absolute; opacity: 0; pointer-events: none; }
.acc:has(input[type="radio"]:focus-visible) { outline: 2px solid var(--accent); outline-offset: 2px; }
.acc i { width: 18px; height: 18px; border-radius: 50%; flex: none; box-shadow: inset 0 0 0 1px rgba(0, 0, 0, .15); }
.acc input[type="color"] { width: 22px; height: 22px; padding: 0; border: 0; border-radius: 50%; background: none; cursor: pointer; flex: none; }
.acc input[type="color"]::-webkit-color-swatch-wrapper { padding: 0; }
.acc input[type="color"]::-webkit-color-swatch { border: 0; border-radius: 50%; }
/* AGD: lodówka, zmywarka, uzdatniacz */
.cards.agds { grid-template-columns: repeat(auto-fit, minmax(min(100%, 380px), 1fr)); align-items: start; }
.agd { gap: 8px; }
.agd .hlabel small { text-transform: none; letter-spacing: 0; font-weight: 400; }
.agd .hlabel:not(:first-child) { margin-top: 6px; }
.agd .chips { display: flex; flex-wrap: wrap; gap: 6px; }
.agd b.alarm, .agd .alarm { color: var(--crit); }
.agd .mchip { display: inline-flex; align-items: center; gap: 5px; }
.agd .chipico { width: 14px; height: 14px; }
.agd .hbar { background: var(--surface-2); height: 12px; border-radius: 6px; }
.agd .hbar i { background: var(--ok); }
.agd .alarmchip { border-color: color-mix(in srgb, var(--crit) 55%, var(--line)); color: var(--crit); }
.agdtemps { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; }
.agdtemp { display: grid; gap: 6px; justify-items: start; background: var(--surface-2); border-radius: 12px; padding: 10px 12px; }
.agdcare { display: grid; gap: 5px; }
.agdcare.row, .agdcare .row { display: flex; }
.agdcare.row > span, .agdcare .row > span { flex: 1; min-width: 0; }
.agdcare .btn { padding: 5px 10px; font-size: 12.5px; }
.agdcare small.alarm { color: var(--crit); }
`;
