"""Konfiguracja i opcje integracji Hearth."""

from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant.config_entries import ConfigEntry, ConfigFlow, ConfigFlowResult, ConfigSubentryFlow, OptionsFlow
from homeassistant.core import callback
from homeassistant.data_entry_flow import section
from homeassistant.helpers import selector

from . import const as c
from .const import ACCENTS, DEFAULTS, DOMAIN, SECTIONS, STYLES, SUBENTRY_HEALTH, TABS
from .discovery import guess_outdoor
from .health import HealthSubentryFlow


# Bez filtra klasy urządzenia: czujniki z MQTT (np. ebusd) czy szablonów często jej nie mają,
# a filtr odrzuciłby poprawny wybór. Klasy używa tylko podpowiedź przy pierwszej konfiguracji.
def _entity(domain: str | list[str] | None = None, many: bool = False) -> selector.EntitySelector:
    cfg = selector.EntitySelectorConfig(multiple=many, reorder=many)
    if domain:
        cfg["domain"] = domain
    return selector.EntitySelector(cfg)


_SENSOR = _entity("sensor")
_BINARY = _entity("binary_sensor")
_ANY = _entity()

# Pole -> selektor. Kolejność w sekcjach bierze się z SECTIONS.
_FIELDS: dict[str, Any] = {
    c.CONF_STYLE: selector.SelectSelector(
        selector.SelectSelectorConfig(options=STYLES, translation_key="style", mode=selector.SelectSelectorMode.LIST)
    ),
    # Gotowe kolory albo własny wpisany jako „#rrggbb” (panel sprawdza format, zły = domyślny).
    c.CONF_ACCENT: selector.SelectSelector(
        selector.SelectSelectorConfig(options=ACCENTS, translation_key="accent", custom_value=True, mode=selector.SelectSelectorMode.DROPDOWN)
    ),
    # Lista rozwijana z „pastylkami” zachowuje kolejność wyboru = kolejność zakładek w panelu.
    c.CONF_TABS: selector.SelectSelector(
        selector.SelectSelectorConfig(options=TABS, translation_key="tabs", multiple=True, mode=selector.SelectSelectorMode.DROPDOWN)
    ),
    c.CONF_TITLE: selector.TextSelector(),
    c.CONF_ICON: selector.IconSelector(),
    c.CONF_ADMIN_ONLY: selector.BooleanSelector(),
    **{k: _SENSOR for k in (c.CONF_OUT_TEMP, c.CONF_OUT_HUMIDITY, c.CONF_OUT_PRESSURE, c.CONF_OUT_ILLUMINANCE,
                            c.CONF_OUT_PM25, c.CONF_OUT_PM10, c.CONF_OUT_AQI, c.CONF_OUT_AQI_LEVEL)},
    c.CONF_PRESENCE: _ANY,
    c.CONF_TARIFF: _SENSOR,
    c.CONF_PERSONS: _entity("person", many=True),
    c.CONF_GATES: _entity("cover", many=True),
    c.CONF_MAILBOX: _BINARY,
    c.CONF_MAILBOX_BATTERY: _SENSOR,
    c.CONF_WASTE_CALENDAR: _entity("calendar"),
    c.CONF_WASTE: _entity("sensor", many=True),
    c.CONF_WASTE_TOGGLES: _entity("input_boolean", many=True),
    c.CONF_WEATHER: _entity("weather"),
    c.CONF_POWER_TOTAL: _SENSOR,
    c.CONF_PHASE_POWER: _entity("sensor", many=True),
    c.CONF_PHASE_VOLTAGE: _entity("sensor", many=True),
    c.CONF_CONSUMERS: _entity("sensor", many=True),
    c.CONF_CONSUMERS_EXCLUDE: _entity("sensor", many=True),
    c.CONF_CLIMATE_HEATING: _entity("climate"),
    c.CONF_CLIMATE_DHW: _entity(["climate", "water_heater"]),
    c.CONF_BOILER_STATE: _ANY,
    c.CONF_BOILER_FLAME: _BINARY,
    c.CONF_BOILER_DHW_DEMAND: _BINARY,
    c.CONF_BOILER_IGNITION: _BINARY,
    c.CONF_BOILER_PUMP: _BINARY,
    **{k: _SENSOR for k in (c.CONF_BOILER_MODULATION, c.CONF_BOILER_FAN, c.CONF_BOILER_FLOW, c.CONF_BOILER_FLOW_TARGET,
                            c.CONF_BOILER_RETURN, c.CONF_BOILER_PRESSURE, c.CONF_BOILER_CURVE, c.CONF_BOILER_OUTDOOR,
                            c.CONF_BOILER_OUTDOOR_AVG, c.CONF_DHW_TEMP, c.CONF_DHW_TARGET)},
    c.CONF_GAS: _entity("sensor", many=True),
    c.CONF_BOILER_SETTINGS: _entity(["number", "input_number"], many=True),
    c.CONF_EBUSD_ZONE: selector.TextSelector(),
    c.CONF_SF_MODE: _SENSOR,
    c.CONF_VETO_END_DATE: _SENSOR,
    c.CONF_VETO_END_TIME: _SENSOR,
    c.CONF_METERS: _entity(many=True),
    c.CONF_SWITCH_EXCLUDE: _entity(["light", "switch", "fan"], many=True),
    c.CONF_CAMERAS: _entity("camera", many=True),
    c.CONF_NVR_STATUS: _BINARY,
    c.CONF_NVR_VERSION: _SENSOR,
    c.CONF_NVR_CHANNELS: _SENSOR,
    c.CONF_NVR_USED: _SENSOR,
    c.CONF_NVR_TOTAL: _SENSOR,
    c.CONF_VEHICLES: _entity("device_tracker", many=True),
    c.CONF_ROBOTS_EXCLUDE: _entity(["lawn_mower", "vacuum"], many=True),
    c.CONF_PROXMOX_EXCLUDE: _entity("binary_sensor", many=True),
    # Dyski maszyn, których Proxmox nie zna (VM bez agenta gościa): {guest, label?, used, total}.
    c.CONF_PROXMOX_DISKS: selector.ObjectSelector(),
    c.CONF_NET_SPEED: _entity("sensor", many=True),
    c.CONF_NET_STATUS: _entity("binary_sensor", many=True),
    c.CONF_NET_UPDATES: _entity("update", many=True),
    c.CONF_NET_PORTS: _entity(["binary_sensor", "switch"], many=True),
    # Reguły alertów: lista {entity, condition („< 20”, „== open”, „!= on”), message, severity (error|warn|info)}.
    c.CONF_ALERTS: selector.ObjectSelector(),
    c.CONF_AGENT_URL: selector.TextSelector(selector.TextSelectorConfig(type=selector.TextSelectorType.URL)),
    c.CONF_AREAS: selector.AreaSelector(selector.AreaSelectorConfig(multiple=True, reorder=True)),
    c.CONF_HELPER_PREFIX: selector.TextSelector(),
    c.CONF_FANS: _entity(["fan", "switch"], many=True),
    c.CONF_EXCLUDE: _entity(many=True),
}
# Pola z wartością domyślną są wymagane (zawsze coś wybrane); reszta może zostać pusta.
_REQUIRED = {c.CONF_STYLE, c.CONF_ACCENT, c.CONF_TABS, c.CONF_TITLE, c.CONF_ICON, c.CONF_ADMIN_ONLY}


def options_schema(current: dict[str, Any]) -> vol.Schema:
    """Formularz opcji podzielony na zwijane sekcje."""
    schema: dict[Any, Any] = {}
    for name, keys in SECTIONS.items():
        fields: dict[Any, Any] = {}
        for key in keys:
            value = current.get(key, DEFAULTS.get(key))
            if key in _REQUIRED:
                fields[vol.Required(key, default=value)] = _FIELDS[key]
            else:
                # suggested_value zamiast default: wyczyszczone pole naprawdę zostaje puste.
                fields[vol.Optional(key, description={"suggested_value": value})] = _FIELDS[key]
        schema[vol.Required(name)] = section(vol.Schema(fields), {"collapsed": name != "appearance"})
    return vol.Schema(schema)


def flatten(user_input: dict[str, Any]) -> dict[str, Any]:
    """Sekcje formularza -> płaskie opcje; brak pola = wyczyszczone (None / pusta lista)."""
    out: dict[str, Any] = {}
    for name, keys in SECTIONS.items():
        values = user_input.get(name, {})
        for key in keys:
            if key in values and values[key] not in ("", None):
                out[key] = values[key]
            else:
                out[key] = [] if isinstance(DEFAULTS.get(key), list) else DEFAULTS.get(key) if key in _REQUIRED else None
    if out.get(c.CONF_HELPER_PREFIX) is None:
        out[c.CONF_HELPER_PREFIX] = ""
    return out


class HearthConfigFlow(ConfigFlow, domain=DOMAIN):
    """Jeden wpis na instalację HA."""

    VERSION = 1

    async def async_step_user(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        if user_input is not None:
            options = {**DEFAULTS, **guess_outdoor(self.hass)}
            return self.async_create_entry(title="Hearth", data={}, options=options)
        return self.async_show_form(step_id="user", data_schema=vol.Schema({}))

    @staticmethod
    @callback
    def async_get_options_flow(config_entry: ConfigEntry) -> OptionsFlow:
        return HearthOptionsFlow()

    @classmethod
    @callback
    def async_get_supported_subentry_types(cls, config_entry: ConfigEntry) -> dict[str, type[ConfigSubentryFlow]]:
        # Osoby w zakładce Zdrowie: „Dodaj osobę” pod wpisem integracji.
        return {SUBENTRY_HEALTH: HealthSubentryFlow}


class HearthOptionsFlow(OptionsFlow):
    """Ustawienia panelu: wygląd, czujniki zewnętrzne, dom, pokoje."""

    async def async_step_init(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        if user_input is not None:
            return self.async_create_entry(data=flatten(user_input))
        current = {**DEFAULTS, **self.config_entry.options}
        return self.async_show_form(step_id="init", data_schema=options_schema(current))
