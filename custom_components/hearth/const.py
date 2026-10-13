"""Stałe integracji Hearth."""

from __future__ import annotations

DOMAIN = "hearth"

PANEL_URL_PATH = "hearth"
PANEL_COMPONENT = "hearth-panel"
STATIC_URL = "/hearth_files"
DATA_STATIC_REGISTERED = f"{DOMAIN}_static_registered"

# Wygląd
CONF_STYLE = "style"
CONF_TITLE = "sidebar_title"
CONF_ICON = "sidebar_icon"
CONF_ADMIN_ONLY = "require_admin"
STYLES = ["tiles", "list", "dials"]

# Na zewnątrz
CONF_OUT_TEMP = "outdoor_temperature"
CONF_OUT_HUMIDITY = "outdoor_humidity"
CONF_OUT_PRESSURE = "outdoor_pressure"
CONF_OUT_ILLUMINANCE = "outdoor_illuminance"
CONF_OUT_PM25 = "outdoor_pm25"
CONF_OUT_PM10 = "outdoor_pm10"
CONF_OUT_AQI = "outdoor_aqi"
CONF_OUT_AQI_LEVEL = "outdoor_aqi_level"

# Dom
CONF_BOILER_STATE = "boiler_state"
CONF_BOILER_FLAME = "boiler_flame"
CONF_BOILER_DHW_DEMAND = "boiler_dhw_demand"
CONF_BOILER_MODULATION = "boiler_modulation"
CONF_BOILER_FLOW = "boiler_flow_temperature"
CONF_BOILER_RETURN = "boiler_return_temperature"
CONF_BOILER_PRESSURE = "boiler_pressure"
CONF_DHW_TEMP = "dhw_temperature"
CONF_DHW_TARGET = "dhw_target"
CONF_PRESENCE = "presence"
CONF_TARIFF = "tariff"

# Pokoje
CONF_HELPER_PREFIX = "helper_prefix"
CONF_AREAS = "areas"
CONF_FANS = "fans"
CONF_EXCLUDE = "exclude_entities"

SECTIONS: dict[str, list[str]] = {
    "appearance": [CONF_STYLE, CONF_TITLE, CONF_ICON, CONF_ADMIN_ONLY],
    "outdoor": [CONF_OUT_TEMP, CONF_OUT_HUMIDITY, CONF_OUT_PRESSURE, CONF_OUT_ILLUMINANCE,
                CONF_OUT_PM25, CONF_OUT_PM10, CONF_OUT_AQI, CONF_OUT_AQI_LEVEL],
    "house": [CONF_BOILER_STATE, CONF_BOILER_FLAME, CONF_BOILER_DHW_DEMAND, CONF_BOILER_MODULATION, CONF_BOILER_FLOW,
              CONF_BOILER_RETURN, CONF_BOILER_PRESSURE, CONF_DHW_TEMP, CONF_DHW_TARGET, CONF_PRESENCE, CONF_TARIFF],
    "rooms": [CONF_AREAS, CONF_HELPER_PREFIX, CONF_FANS, CONF_EXCLUDE],
}

DEFAULTS: dict[str, object] = {
    CONF_STYLE: "tiles",
    CONF_TITLE: "Hearth",
    CONF_ICON: "mdi:home-thermometer",
    CONF_ADMIN_ONLY: False,
    CONF_HELPER_PREFIX: "",
    CONF_AREAS: [],
    CONF_FANS: [],
    CONF_EXCLUDE: [],
}
