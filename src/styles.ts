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
.room:focus-visible { outline: 2px solid var(--ember); outline-offset: 2px; }
.room[aria-expanded="true"] { border-color: var(--ember); }
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
.detail { grid-column: 1 / -1; background: var(--surface); border: 1px solid var(--ember); border-radius: 16px; padding: 16px 18px;
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
.step button:focus-visible, .btn:focus-visible, .switch:focus-visible { outline: 2px solid var(--ember); outline-offset: 2px; }
.step output { font-family: var(--f-num); font-weight: 700; font-size: 19px; min-width: 52px; text-align: center; font-variant-numeric: tabular-nums; color: var(--fg); }
.acts { display: flex; flex-wrap: wrap; gap: 8px; }
.btn { padding: 8px 12px; font-size: 13.5px; display: inline-flex; align-items: center; gap: 6px; }
.btn.hot { color: var(--ember); border-color: color-mix(in srgb, var(--ember) 50%, var(--line)); }
.row { display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: 14px; }
.switch { width: 44px; height: 24px; border-radius: 12px; background: var(--line); border: 0; position: relative; cursor: pointer; flex: none; }
.switch::after { content: ""; position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 50%; background: var(--surface); transition: left .15s; }
.switch[aria-checked="true"] { background: var(--ember); }
.switch[aria-checked="true"]::after { left: 23px; }
.why { font-size: 13.5px; color: var(--fg); background: var(--surface); border-radius: 10px; padding: 10px 12px; border: 1px solid var(--line); }
.why b { font-family: var(--f-num); }
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
.opt:has(input:checked) { border-color: var(--ember); background: var(--ember-soft); }
.opt input { margin: 3px 0 0; accent-color: var(--ember); width: 16px; height: 16px; }
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
.lrow:focus-visible { outline: 2px solid var(--ember); outline-offset: -2px; }
.lrow[aria-expanded="true"] { background: var(--surface-2); box-shadow: inset 4px 0 0 var(--ember); }
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
.s-list .detail { border-radius: 0; border: 0; border-bottom: 1px solid var(--line); box-shadow: inset 4px 0 0 var(--ember); background: var(--surface-2); }
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
.tabs { display: flex; gap: 4px; overflow-x: auto; scrollbar-width: none; border-bottom: 1px solid var(--line); margin-top: -6px; }
.tabs::-webkit-scrollbar { display: none; }
.tabs a { color: var(--muted); text-decoration: none; font-weight: 700; font-size: 14.5px; padding: 10px 14px; border-bottom: 3px solid transparent; white-space: nowrap; border-radius: 8px 8px 0 0; }
.tabs a:hover { color: var(--fg); background: var(--surface-2); }
.tabs a.on { color: var(--fg); border-bottom-color: var(--ember); }
.tabs a:focus-visible { outline: 2px solid var(--ember); outline-offset: -2px; }
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
.sw { display: inline-block; width: 9px; height: 9px; border-radius: 2px; margin-right: 6px; }

/* osoby */
.person { --pc: var(--frost); background: var(--surface); border: 1px solid var(--line); border-radius: 16px; box-shadow: var(--shadow); padding: 12px 14px; display: grid; grid-template-columns: 52px 1fr; gap: 12px; align-items: center; }
.avatar { width: 52px; height: 52px; border-radius: 50%; display: grid; place-items: center; overflow: hidden; font-family: var(--f-num); font-weight: 800; font-size: 22px; color: #fff; background: var(--pc); box-shadow: 0 0 0 3px var(--surface), 0 0 0 5px color-mix(in srgb, var(--pc) 70%, transparent); }
.person:not(.home) .avatar { filter: saturate(.55); opacity: .85; }
.avatar { position: relative; }
.avatar img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.wico2 svg { width: 20px; height: 20px; display: block; }
.cards.two.top { align-items: start; }
button.person { font: inherit; color: inherit; text-align: left; cursor: pointer; width: 100%; }
button.person:hover { border-color: var(--faint); }
button.person:focus-visible { outline: 2px solid var(--ember); outline-offset: 2px; }
.seg2 { display: inline-flex; flex-wrap: wrap; gap: 4px; background: var(--surface-2); border-radius: 12px; padding: 3px; justify-self: start; }
.seg2 button { font: inherit; font-size: 13px; font-weight: 700; color: var(--muted); background: none; border: 0; border-radius: 9px; padding: 6px 12px; cursor: pointer; }
.seg2 button.on { background: var(--surface); color: var(--fg); box-shadow: var(--shadow); }
.seg2 button:focus-visible { outline: 2px solid var(--ember); outline-offset: 1px; }
.wxframe { width: 100%; height: min(70vh, 560px); border: 1px solid var(--line); border-radius: 16px; background: var(--surface-2); display: block; }
dialog.pdlg { width: min(720px, calc(100% - 24px)); }
.pinfo { display: flex; flex-wrap: wrap; gap: 4px 16px; font-size: 13.5px; color: var(--muted); }
.pinfo b { color: var(--fg); }
.pinfo a { color: var(--ember); font-weight: 700; text-decoration: none; }
.pmap { height: min(60vh, 440px); border-radius: 14px; overflow: hidden; border: 1px solid var(--line); }
.tmap { position: relative; height: min(60vh, 440px); border-radius: 14px; overflow: hidden; border: 1px solid var(--line); background: var(--surface-2); }
.tmap img { position: absolute; width: 256px; height: 256px; user-select: none; }
.tmap.dark img { filter: invert(1) hue-rotate(180deg) brightness(.85) contrast(.9); }
.tpin { position: absolute; left: 50%; top: 50%; width: 18px; height: 18px; margin: -9px 0 0 -9px; border-radius: 50%; background: var(--ember); border: 3px solid #fff; box-shadow: 0 0 0 6px color-mix(in srgb, var(--ember) 30%, transparent); }
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
.bulb:focus-visible { outline: 2px solid var(--ember); outline-offset: 2px; }
.gate.open .gico { background: var(--ember-soft); color: var(--ember); }
.gate.moving .gico { color: var(--warn); }
@media (prefers-reduced-motion: no-preference) { .gate.moving .gico { animation: pulse 1.2s ease-in-out infinite; } @keyframes pulse { 50% { opacity: .45; } } }
.box2.mail.full { border-color: var(--air); }
.box2.mail.full .gico { background: var(--air-soft); color: var(--air); }
.box2.waste { grid-template-columns: 1fr; gap: 4px; }
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
.fday.today { border-color: var(--ember); }
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
.mchip.on { background: var(--ember-soft); border-color: var(--ember); color: var(--ember); }
.mchip:focus-visible { outline: 2px solid var(--ember); outline-offset: 2px; }
.setrow { color: var(--fg); padding: 6px 4px; border-top: 1px solid var(--line); border-radius: 0; }
.setrow:first-child { border-top: 0; }

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
`;
