// Zakładka Sieć: prędkość internetu, stan łączy (z przerwami z 24 h), aktualizacje oprogramowania, porty i PoE.

import { html, type TemplateResult } from "lit";
import { duration, f1, num, round } from "../format";
import { sumPeriods } from "../history";
import { activity, multiLine } from "../svg";
import { cleanName, deviceName, entityName, sinceLabel, st, unitOf, type Ctx } from "./common";

export function speedIds(ctx: Ctx): string[] {
  if (ctx.opts.net_speed?.length) return ctx.opts.net_speed;
  const ids = Object.keys(ctx.hass.states).filter((e) => e.startsWith("sensor.") && /speed/i.test(e));
  return [ids.find((e) => /download/i.test(e)), ids.find((e) => /upload/i.test(e)), ids.find((e) => /ping/i.test(e))].filter((x): x is string => Boolean(x));
}

export function networkView(ctx: Ctx): TemplateResult {
  const h = ctx.hass, o = ctx.opts;
  const [down, up, ping] = speedIds(ctx);
  const status = (o.net_status ?? []).filter((e) => h.states[e]);
  const updates = (o.net_updates?.length ? o.net_updates : Object.keys(h.states).filter((e) => e.startsWith("update.") && h.states[e].state === "on")).filter((e) => h.states[e]);
  const ports = (o.net_ports ?? []).filter((e) => h.states[e]);
  const parts: unknown[] = [];

  if (down || up) {
    parts.push(html`<section class="sec"><h2>Internet</h2>
      <div class="house">
        ${[[down, "Pobieranie"], [up, "Wysyłanie"], [ping, "Ping"]].filter(([id]) => id).map(([id, label]) => html`<div class="hcell"><span class="hlabel">${label}</span>
          <span class="hval">${round(num(st(ctx, id)))}<span class="u"> ${unitOf(h, id)}</span></span><span class="hsub">${sinceLabel(ctx, h.states[id!].last_changed)}</span></div>`)}
      </div>
      ${multiLine([down && { name: "pobieranie", color: "var(--frost)", points: ctx.hist.series(h, down) }, up && { name: "wysyłanie", color: "var(--ember)", points: ctx.hist.series(h, up) }].filter(Boolean) as never, { unit: "" })}
    </section>`);
  }
  if (status.length) {
    parts.push(html`<section class="sec"><h2>Łącza <small>przerwy w ostatnich 24 h</small></h2><div class="ocell list">${status.map((id) => {
      const on = st(ctx, id) === "on";
      const down24 = ctx.hist.periods(h, id, (v) => v === "off");
      const lost = sumPeriods(down24);
      return html`<div class="lane netlane"><span><span class="dot ${on ? "ok" : "warn"}"></span><b>${entityName(h, id)}</b>
          <small class="sub">${on ? "działa" : "brak połączenia"} · dostępność ${f1(100 - (lost / 864e5) * 100)}%${lost ? ` · przerwy ${duration(lost)}` : ""}</small></span>
        <span class="down">${activity(down24)}</span></div>`;
    })}</div></section>`);
  }
  if (updates.length) {
    parts.push(html`<section class="sec"><h2>Oprogramowanie <small>${updates.filter((e) => st(ctx, e) === "on").length} do aktualizacji</small></h2><div class="ocell list">${updates.map((id) => {
      const a = h.states[id].attributes, avail = st(ctx, id) === "on";
      const canInstall = avail && (Number(a.supported_features) & 1) === 1;
      return html`<div class="row upd"><span><b>${cleanName(deviceName(h, id) ?? entityName(h, id))}</b><small class="sub">${a.installed_version ?? "—"}${avail ? ` → ${a.latest_version}` : ""}</small></span>
        ${avail
          ? canInstall
            ? html`<button class="btn hot" type="button" @click=${() => window.confirm(`Zainstalować aktualizację: ${entityName(h, id)}?`) && ctx.actions.call("update", "install", { entity_id: id })}>Zainstaluj</button>`
            : html`<b style="color:var(--warn)">dostępna</b>`
          : html`<span class="hsub">aktualne</span>`}</div>`;
    })}</div></section>`);
  }
  if (ports.length) {
    const byDev = new Map<string, string[]>();
    for (const p of ports) {
      const d = cleanName(deviceName(h, p) ?? "Inne");
      if (!byDev.has(d)) byDev.set(d, []);
      byDev.get(d)!.push(p);
    }
    parts.push(html`<section class="sec"><h2>Porty i PoE</h2><div class="cards meters">${[...byDev].map(([dev, list]) => html`<div class="ocell"><span class="hlabel">${dev}</span>
      <div class="ports">${list.map((p) => {
        const on = st(ctx, p) === "on";
        const label = entityName(h, p).replace(/^(port\s*)/i, "").replace(/\s*(lan status|poe|link|internet link)$/i, "");
        return p.startsWith("switch.")
          ? html`<button type="button" class="port poe ${on ? "on" : ""}" title="PoE ${entityName(h, p)}" aria-pressed=${on ? "true" : "false"}
              @click=${() => window.confirm(`${on ? "Wyłączyć" : "Włączyć"} PoE: ${entityName(h, p)}?`) && ctx.actions.call("switch", "toggle", { entity_id: p })}>${label}<small>PoE</small></button>`
          : html`<span class="port ${on ? "on" : ""}" title=${entityName(h, p)}>${label}<small>${on ? "link" : "—"}</small></span>`;
      })}</div></div>`)}</div></section>`);
  }
  return parts.length ? html`${parts}` : html`<div class="empty">Wskaż w opcjach Hearth (sekcja Sieć) czujniki prędkości, łącza, aktualizacje i porty.</div>`;
}
