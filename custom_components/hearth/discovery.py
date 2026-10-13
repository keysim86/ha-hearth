"""Podpowiedzi czujników „na zewnątrz” przy pierwszej konfiguracji.

Pokoje panel buduje sam z obszarów HA (w przeglądarce). Tutaj zgadujemy tylko
to, czego obszary nie mówią: które czujniki są za oknem. Wynik trafia do opcji
jako wartości startowe, użytkownik może je zmienić w ustawieniach integracji.
"""

from __future__ import annotations

import re

from homeassistant.core import HomeAssistant
from homeassistant.helpers import entity_registry as er

from .const import (
    CONF_OUT_AQI,
    CONF_OUT_HUMIDITY,
    CONF_OUT_ILLUMINANCE,
    CONF_OUT_PM10,
    CONF_OUT_PM25,
    CONF_OUT_PRESSURE,
    CONF_OUT_TEMP,
)

_OUTDOOR = re.compile(r"outdoor|outside|zewn|na_zewnatrz|air_monitor|nettigo|airly|weather", re.I)
_SKIP_PLATFORMS = {"mobile_app"}

_WANTED = {
    CONF_OUT_TEMP: "temperature",
    CONF_OUT_HUMIDITY: "humidity",
    CONF_OUT_PRESSURE: ("pressure", "atmospheric_pressure"),
    CONF_OUT_ILLUMINANCE: "illuminance",
    CONF_OUT_PM25: "pm25",
    CONF_OUT_PM10: "pm10",
    CONF_OUT_AQI: "aqi",
}


def guess_outdoor(hass: HomeAssistant) -> dict[str, str]:
    """Najlepszy kandydat na każdy czujnik zewnętrzny (tylko z wyraźną nazwą)."""
    reg = er.async_get(hass)
    best: dict[str, tuple[int, str]] = {}
    for state in hass.states.async_all("sensor"):
        entry = reg.async_get(state.entity_id)
        if entry is not None and (entry.platform in _SKIP_PLATFORMS or entry.entity_category is not None):
            continue
        name = f"{state.entity_id} {state.attributes.get('friendly_name', '')}"
        if not _OUTDOOR.search(name):
            continue
        device_class = state.attributes.get("device_class")
        for key, wanted in _WANTED.items():
            classes = wanted if isinstance(wanted, tuple) else (wanted,)
            caqi = key == CONF_OUT_AQI and re.search(r"caqi|aqi", state.entity_id) and state.state.replace(".", "", 1).isdigit()
            if device_class not in classes and not caqi:
                continue
            # Czujnik z większą liczbą słów „zewnętrznych” wygrywa; przy remisie pierwszy.
            score = len(_OUTDOOR.findall(name))
            if key not in best or score > best[key][0]:
                best[key] = (score, state.entity_id)
    return {key: entity_id for key, (_, entity_id) in best.items()}
