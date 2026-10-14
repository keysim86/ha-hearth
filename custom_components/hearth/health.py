"""Zdrowie: osoba jako podwpis integracji (waga, skład ciała, aktywność, ciśnienie, pomiary, cele)."""

from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant.config_entries import ConfigSubentryFlow, SubentryFlowResult
from homeassistant.data_entry_flow import section
from homeassistant.helpers import selector

from .const import H_NAME, HEALTH_DEFAULTS, HEALTH_SECTIONS, MEASUREMENTS


def _entity(domain: str | list[str]) -> selector.EntitySelector:
    return selector.EntitySelector(selector.EntitySelectorConfig(domain=domain))


def _number(lo: float, hi: float, step: float, unit: str | None = None) -> selector.NumberSelector:
    cfg = selector.NumberSelectorConfig(min=lo, max=hi, step=step, mode=selector.NumberSelectorMode.BOX)
    if unit:
        cfg["unit_of_measurement"] = unit
    return selector.NumberSelector(cfg)


_SENSOR = _entity("sensor")
_INPUT = _entity("input_number")

_FIELDS: dict[str, Any] = {
    H_NAME: selector.TextSelector(),
    "person": _entity("person"),
    "gender": selector.SelectSelector(
        selector.SelectSelectorConfig(options=["male", "female"], translation_key="gender", mode=selector.SelectSelectorMode.LIST)
    ),
    "birthdate": selector.DateSelector(),
    "weight": _SENSOR,
    # Wzrost z encji (telefon w metrach albo szablon / pomocnik w centymetrach — panel przelicza).
    "height": _entity(["sensor", "input_number"]),
    "height_cm": _number(50, 250, 1, "cm"),
    "start_weight": _number(1, 400, 0.1, "kg"),
    "start_date": selector.DateSelector(),
    "history_days": _number(30, 3650, 1),
    **{k: _SENSOR for k in HEALTH_SECTIONS["body"]},
    "steps": _SENSOR,
    "calories": _SENSOR,
    "steps_goal": _number(100, 100000, 100),
    "calories_goal": _number(10, 10000, 10, "kcal"),
    "bp_systolic": _SENSOR,
    "bp_diastolic": _SENSOR,
    "bp_pulse": _SENSOR,
    "bp_category": _SENSOR,
    "report_name": selector.TextSelector(),
    "report_device": selector.TextSelector(),
    # Pomiary pominięte w raporcie (błędny odczyt): „RRRR-MM-DD GG:MM”.
    "bp_exclude": selector.TextSelector(selector.TextSelectorConfig(multiple=True)),
    **{f"meas_{m}": _entity(["sensor", "input_number"]) for m in MEASUREMENTS},
    "data_entry": selector.BooleanSelector(),
    **{f"input_{m}": _INPUT for m in MEASUREMENTS},
    "goals": selector.ObjectSelector(
        selector.ObjectSelectorConfig(
            multiple=True,
            label_field="label",
            translation_key="goal",
            fields={
                "label": {"selector": {"text": {}}, "required": True},
                "weight": {"selector": {"number": {"min": 1, "max": 400, "step": 0.1, "unit_of_measurement": "kg", "mode": "box"}}, "required": True},
                "date": {"selector": {"date": {}}},
                "color": {"selector": {"text": {}}},
            },
        )
    ),
    "centiles": selector.BooleanSelector(),
}
_REQUIRED = {H_NAME, "gender", "weight"}


def health_schema(current: dict[str, Any]) -> vol.Schema:
    """Formularz osoby: dane podstawowe rozwinięte, reszta w zwijanych sekcjach."""
    schema: dict[Any, Any] = {}
    for name, keys in HEALTH_SECTIONS.items():
        fields: dict[Any, Any] = {}
        for key in keys:
            value = current.get(key)
            if key in _REQUIRED:
                fields[vol.Required(key, description={"suggested_value": value} if value is not None else None)] = _FIELDS[key]
            elif key in HEALTH_DEFAULTS and not isinstance(HEALTH_DEFAULTS[key], list):
                fields[vol.Required(key, default=value if value is not None else HEALTH_DEFAULTS[key])] = _FIELDS[key]
            else:
                fields[vol.Optional(key, description={"suggested_value": value})] = _FIELDS[key]
        schema[vol.Required(name)] = section(vol.Schema(fields), {"collapsed": name != "person"})
    return vol.Schema(schema)


def flatten_health(user_input: dict[str, Any]) -> dict[str, Any]:
    """Sekcje -> płaskie dane osoby; puste pola znikają (panel traktuje brak jak „nie skonfigurowano”)."""
    out: dict[str, Any] = {}
    for name, keys in HEALTH_SECTIONS.items():
        values = user_input.get(name, {})
        for key in keys:
            v = values.get(key)
            if v in ("", None, []):
                continue
            out[key] = v
    out[H_NAME] = str(out.get(H_NAME, "")).strip()
    return out


class HealthSubentryFlow(ConfigSubentryFlow):
    """Dodanie i zmiana osoby w zakładce Zdrowie."""

    async def async_step_user(self, user_input: dict[str, Any] | None = None) -> SubentryFlowResult:
        if user_input is not None:
            data = flatten_health(user_input)
            return self.async_create_entry(title=data[H_NAME], data=data)
        return self.async_show_form(step_id="user", data_schema=health_schema(dict(HEALTH_DEFAULTS)))

    async def async_step_reconfigure(self, user_input: dict[str, Any] | None = None) -> SubentryFlowResult:
        subentry = self._get_reconfigure_subentry()
        if user_input is not None:
            data = flatten_health(user_input)
            # Bez przeładowania tutaj: zmiana podwpisu i tak budzi nasłuch zmian wpisu, który przeładowuje panel.
            return self.async_update_and_abort(self._get_entry(), subentry, title=data[H_NAME], data=data)
        return self.async_show_form(step_id="reconfigure", data_schema=health_schema({**HEALTH_DEFAULTS, **subentry.data}))
