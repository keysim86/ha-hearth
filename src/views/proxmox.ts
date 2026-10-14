// Zakładka Proxmox: węzeł, maszyny wirtualne, kontenery i magazyny z wbudowanej integracji Proxmox VE.

import { html, nothing, type TemplateResult } from "lit";
import { duration, num, round } from "../format";
import { cleanName, deviceEntities, valueText, type Ctx } from "./common";

interface Guest {
  device: string;
  name: string;
  kind: string;
  ents: string[];
}

const pick = (ctx: Ctx, ents: string[], test: (tk: string, id: string) => boolean) =>
  ents.find((e) => test(ctx.hass.entities[e]?.translation_key ?? "", e));

function bar(pct: number | null) {
  if (pct === null) return html`<span class="hsub">—</span>`;
  const col = pct > 90 ? "var(--crit)" : pct > 75 ? "var(--warn)" : "var(--ok)";
  return html`<span class="pxbar"><span class="pmbar"><i style="width:${Math.min(100, pct).toFixed(0)}%;background:${col}"></i></span><b>${round(pct)}%</b></span>`;
}

function uptimeText(ctx: Ctx, id?: string): string {
  if (!id) return "—";
  const s = ctx.hass.states[id]?.state;
  const t = Date.parse(s ?? "");
  if (Number.isFinite(t) && /T/.test(s ?? "")) return duration(Date.now() - t);
  const n = num(s);
  const u = ctx.hass.states[id]?.attributes.unit_of_measurement;
  if (n === null) return s ?? "—";
  const ms = u === "s" ? n * 1000 : u === "min" ? n * 60e3 : u === "h" ? n * 3600e3 : u === "d" ? n * 864e5 : n * 1000;
  return duration(ms);
}

export function proxmoxView(ctx: Ctx): TemplateResult {
  const h = ctx.hass;
  const skip = new Set(ctx.opts.proxmox_exclude ?? []);
  const devs = new Map<string, Guest>();
  for (const e of Object.values(h.entities)) {
    if (e.platform !== "proxmoxve" || !e.device_id || devs.has(e.device_id)) continue;
    const d = h.devices[e.device_id];
    devs.set(e.device_id, { device: e.device_id, name: cleanName(d?.name_by_user || d?.name || e.device_id), kind: d?.model ?? "", ents: deviceEntities(h, e.device_id) });
  }
  const all = [...devs.values()].filter((g) => !g.ents.some((e) => skip.has(e)));
  if (!all.length) return html`<div class="empty">Brak danych z integracji Proxmox VE.</div>`;
  const nodes = all.filter((g) => /node|węzeł/i.test(g.kind) || g.ents.some((e) => /^node_/.test(h.entities[e]?.translation_key ?? "")));
  const storage = all.filter((g) => /storage/i.test(g.kind));
  const guests = all.filter((g) => !nodes.includes(g) && !storage.includes(g)).sort((a, b) => a.name.localeCompare(b.name, "pl"));
  const status = (g: Guest) => pick(ctx, g.ents, (tk, id) => tk === "status" && id.startsWith("binary_sensor."));
  const running = (g: Guest) => h.states[status(g) ?? ""]?.state === "on";

  const nodeCards = nodes.map((n) => {
    const cpu = num(h.states[pick(ctx, n.ents, (tk, id) => /cpu/.test(tk) || /_cpu_usage$/.test(id)) ?? ""]?.state);
    const mem = num(h.states[pick(ctx, n.ents, (tk) => /memory_percentage|memory_used_percentage/.test(tk)) ?? ""]?.state);
    const disk = num(h.states[pick(ctx, n.ents, (tk, id) => /disk.*percentage|zajetosc_dysku/.test(`${tk} ${id}`)) ?? ""]?.state);
    const up = pick(ctx, n.ents, (tk) => /uptime/.test(tk));
    const vms = guests.filter((g) => /vm/i.test(g.kind)), lxcs = guests.filter((g) => /container|lxc/i.test(g.kind));
    return html`<div class="ocell"><span class="hlabel">Węzeł ${n.name}</span>
      <div class="row"><span>Procesor</span>${bar(cpu)}</div>
      <div class="row"><span>Pamięć</span>${bar(mem)}</div>
      ${disk !== null ? html`<div class="row"><span>Dysk</span>${bar(disk)}</div>` : nothing}
      <div class="row"><span>Działa</span><b>${uptimeText(ctx, up)}</b></div>
      <div class="row"><span>Maszyny / kontenery</span><b>${vms.filter(running).length}/${vms.length} · ${lxcs.filter(running).length}/${lxcs.length}</b></div>
    </div>`;
  });

  const press = (g: Guest, what: string, label: string, ask: boolean) => {
    const btn = pick(ctx, g.ents, (tk, id) => id.startsWith("button.") && (what === "reboot" ? h.states[id]?.attributes.device_class === "restart" : tk === what));
    if (!btn) return nothing;
    return html`<button class="btn ${what === "start" ? "hot" : ""}" type="button"
      @click=${() => (!ask || window.confirm(`${label}: ${g.name}?`)) && ctx.actions.call("button", "press", { entity_id: btn })}>${label}</button>`;
  };

  const rows = guests.map((g) => {
    const on = running(g);
    const cpu = num(h.states[pick(ctx, g.ents, (tk) => /_cpu$/.test(tk)) ?? ""]?.state);
    const mem = num(h.states[pick(ctx, g.ents, (tk) => /memory_percentage$/.test(tk)) ?? ""]?.state);
    const dUsed = num(h.states[pick(ctx, g.ents, (tk) => /_disk$/.test(tk) && !/max/.test(tk)) ?? ""]?.state);
    const dMax = num(h.states[pick(ctx, g.ents, (tk) => /_max_disk$/.test(tk)) ?? ""]?.state);
    const up = pick(ctx, g.ents, (tk) => /uptime/.test(tk));
    return html`<div class="pxrow ${on ? "" : "off"}">
      <span class="pxname"><span class="dot ${on ? "ok" : "warn"}"></span><b>${g.name}</b><small>${/container|lxc/i.test(g.kind) ? "kontener" : "maszyna"} · ${on ? `działa ${uptimeText(ctx, up)}` : "zatrzymana"}</small></span>
      <span class="pxm"><small>CPU</small>${on ? bar(cpu) : html`<span class="hsub">—</span>`}</span>
      <span class="pxm"><small>RAM</small>${on ? bar(mem) : html`<span class="hsub">—</span>`}</span>
      <span class="pxm"><small>Dysk</small>${dUsed && dMax ? bar((dUsed / dMax) * 100) : html`<span class="hsub" title="Proxmox nie zna zajętości dysku maszyny bez agenta gościa">—</span>`}</span>
      <span class="acts">${on ? html`${press(g, "reboot", "Restart", true)}${press(g, "shutdown", "Wyłącz", true)}` : press(g, "start", "Uruchom", false)}</span>
    </div>`;
  });

  const stor = storage.map((sg) => {
    const pct = num(h.states[pick(ctx, sg.ents, (tk) => tk === "storage_used_percentage") ?? ""]?.state);
    const used = pick(ctx, sg.ents, (tk) => tk === "storage_used"), total = pick(ctx, sg.ents, (tk) => tk === "storage_total");
    return html`<div class="row"><span>${sg.name.replace(/^Storage\s*\((.*)\)$/, "$1")}<small class="sub">${valueText(h, used)} z ${valueText(h, total)}</small></span>${bar(pct)}</div>`;
  });

  return html`${nodeCards.length ? html`<section class="sec"><div class="cards two">${nodeCards}
      ${stor.length ? html`<div class="ocell"><span class="hlabel">Magazyny</span>${stor}</div>` : nothing}</div></section>` : nothing}
    <section class="sec"><h2>Maszyny i kontenery <small>${guests.filter(running).length} z ${guests.length} działa</small></h2>
      <div class="ocell list">${rows}</div></section>`;
}
