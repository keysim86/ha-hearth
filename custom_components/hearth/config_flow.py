"""Konfiguracja i opcje integracji Hearth."""

from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant.config_entries import ConfigEntry, ConfigFlow, ConfigFlowResult, OptionsFlow
from homeassistant.core import callback
from homeassistant.data_entry_flow import section
from homeassistant.helpers import selector

from .const import (
    CONF_ADMIN_ONLY,
    CONF_BOILER_FLOW,
    CONF_BOILER_PRESSURE,
    CONF_BOILER_STATE,
    CONF_DHW_TEMP,
    CONF_EXCLUDE,
    CONF_FANS,
    CONF_HELPER_PREFIX,
    CONF_ICON,
    CONF_OUT_AQI,
    CONF_OUT_AQI_LEVEL,
    CONF_OUT_HUMIDITY,
    CONF_OUT_ILLUMINANCE,
    CONF_OUT_PM10,
    CONF_OUT_PM25,
    CONF_OUT_PRESSURE,
    CONF_OUT_TEMP,
    CONF_PRESENCE,
    CONF_STYLE,
    CONF_TARIFF,
    CONF_TITLE,
    DEFAULTS,
    DOMAIN,
    SECTIONS,
    STYLES,
)
from .discovery import guess_outdoor


def _sensor(device_class: str | list[str] | None = None) -> selector.EntitySelector:
    return selector.EntitySelector(selector.EntitySelectorConfig(domain="sensor", device_class=device_class))


_ANY_STATE = selector.EntitySelector(selector.EntitySelectorConfig())

# Pole -> selektor. Kolejność w sekcjach bierze się z SECTIONS.
_FIELDS: dict[str, Any] = {
    CONF_STYLE: selector.SelectSelector(
        selector.SelectSelectorConfig(options=STYLES, translation_key="style", mode=selector.SelectSelectorMode.LIST)
    ),
    CONF_TITLE: selector.TextSelector(),
    CONF_ICON: selector.IconSelector(),
    CONF_ADMIN_ONLY: selector.BooleanSelector(),
    CONF_OUT_TEMP: _sensor("temperature"),
    CONF_OUT_HUMIDITY: _sensor("humidity"),
    CONF_OUT_PRESSURE: _sensor(["pressure", "atmospheric_pressure"]),
    CONF_OUT_ILLUMINANCE: _sensor("illuminance"),
    CONF_OUT_PM25: _sensor("pm25"),
    CONF_OUT_PM10: _sensor("pm10"),
    CONF_OUT_AQI: _sensor(),
    CONF_OUT_AQI_LEVEL: _sensor(),
    CONF_BOILER_STATE: _ANY_STATE,
    CONF_BOILER_FLOW: _sensor("temperature"),
    CONF_BOILER_PRESSURE: _sensor(["pressure"]),
    CONF_DHW_TEMP: _sensor("temperature"),
    CONF_PRESENCE: _ANY_STATE,
    CONF_TARIFF: _sensor(),
    CONF_HELPER_PREFIX: selector.TextSelector(),
    CONF_FANS: selector.EntitySelector(selector.EntitySelectorConfig(domain=["fan", "switch"], multiple=True)),
    CONF_EXCLUDE: selector.EntitySelector(selector.EntitySelectorConfig(multiple=True)),
}
# Pola z wartością domyślną są wymagane (zawsze coś wybrane); reszta może zostać pusta.
_REQUIRED = {CONF_STYLE, CONF_TITLE, CONF_ICON, CONF_ADMIN_ONLY}


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
    if out.get(CONF_HELPER_PREFIX) is None:
        out[CONF_HELPER_PREFIX] = ""
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


class HearthOptionsFlow(OptionsFlow):
    """Ustawienia panelu: wygląd, czujniki zewnętrzne, dom, pokoje."""

    async def async_step_init(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        if user_input is not None:
            return self.async_create_entry(data=flatten(user_input))
        current = {**DEFAULTS, **self.config_entry.options}
        return self.async_show_form(step_id="init", data_schema=options_schema(current))
