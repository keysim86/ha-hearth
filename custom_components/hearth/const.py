"""Stałe integracji Hearth."""

from __future__ import annotations

DOMAIN = "hearth"

PANEL_URL_PATH = "hearth"
PANEL_COMPONENT = "hearth-panel"
STATIC_URL = "/hearth_files"
DATA_STATIC_REGISTERED = f"{DOMAIN}_static_registered"

# Wygląd
CONF_STYLE = "style"
CONF_TABS = "tabs"
CONF_TITLE = "sidebar_title"
CONF_ICON = "sidebar_icon"
CONF_ADMIN_ONLY = "require_admin"
STYLES = ["tiles", "list", "dials"]
TABS = ["home", "climate", "energy", "boiler", "meters"]

# Na zewnątrz
CONF_OUT_TEMP = "outdoor_temperature"
CONF_OUT_HUMIDITY = "outdoor_humidity"
CONF_OUT_PRESSURE = "outdoor_pressure"
CONF_OUT_ILLUMINANCE = "outdoor_illuminance"
CONF_OUT_PM25 = "outdoor_pm25"
CONF_OUT_PM10 = "outdoor_pm10"
CONF_OUT_AQI = "outdoor_aqi"
CONF_OUT_AQI_LEVEL = "outdoor_aqi_level"

# Pasek domu
CONF_PRESENCE = "presence"
CONF_TARIFF = "tariff"

# Zakładka Dom
CONF_PERSONS = "persons"
CONF_GATES = "gates"
CONF_MAILBOX = "mailbox"
CONF_MAILBOX_BATTERY = "mailbox_battery"
CONF_WASTE = "waste"
CONF_WASTE_CALENDAR = "waste_calendar"
CONF_WASTE_TOGGLES = "waste_toggles"
CONF_WEATHER = "weather"

# Zakładka Energia
CONF_POWER_TOTAL = "power_total"
CONF_PHASE_POWER = "phase_power"
CONF_PHASE_VOLTAGE = "phase_voltage"
CONF_CONSUMERS = "consumers"

# Kocioł (pasek domu + zakładka Kocioł)
CONF_CLIMATE_HEATING = "climate_heating"
CONF_CLIMATE_DHW = "climate_dhw"
CONF_BOILER_STATE = "boiler_state"
CONF_BOILER_FLAME = "boiler_flame"
CONF_BOILER_DHW_DEMAND = "boiler_dhw_demand"
CONF_BOILER_IGNITION = "boiler_ignition"
CONF_BOILER_PUMP = "boiler_pump"
CONF_BOILER_MODULATION = "boiler_modulation"
CONF_BOILER_FAN = "boiler_fan_speed"
CONF_BOILER_FLOW = "boiler_flow_temperature"
CONF_BOILER_FLOW_TARGET = "boiler_flow_target"
CONF_BOILER_RETURN = "boiler_return_temperature"
CONF_BOILER_PRESSURE = "boiler_pressure"
CONF_BOILER_CURVE = "boiler_heat_curve"
CONF_BOILER_OUTDOOR = "boiler_outdoor"
CONF_BOILER_OUTDOOR_AVG = "boiler_outdoor_avg"
CONF_DHW_TEMP = "dhw_temperature"
CONF_DHW_TARGET = "dhw_target"
CONF_GAS = "gas"
CONF_SF_MODE = "boiler_sf_mode"
CONF_VETO_END_DATE = "veto_end_date"
CONF_VETO_END_TIME = "veto_end_time"
CONF_EBUSD_ZONE = "ebusd_zone_topic"
CONF_BOILER_SETTINGS = "boiler_settings"

# Liczniki
CONF_METERS = "meters"

# Pokoje
CONF_AREAS = "areas"
CONF_HELPER_PREFIX = "helper_prefix"
CONF_FANS = "fans"
CONF_EXCLUDE = "exclude_entities"

SECTIONS: dict[str, list[str]] = {
    "appearance": [CONF_STYLE, CONF_TABS, CONF_TITLE, CONF_ICON, CONF_ADMIN_ONLY],
    "outdoor": [CONF_OUT_TEMP, CONF_OUT_HUMIDITY, CONF_OUT_PRESSURE, CONF_OUT_ILLUMINANCE,
                CONF_OUT_PM25, CONF_OUT_PM10, CONF_OUT_AQI, CONF_OUT_AQI_LEVEL],
    "house": [CONF_PRESENCE, CONF_TARIFF],
    "home": [CONF_PERSONS, CONF_GATES, CONF_MAILBOX, CONF_MAILBOX_BATTERY, CONF_WASTE_CALENDAR, CONF_WASTE, CONF_WASTE_TOGGLES, CONF_WEATHER],
    "energy": [CONF_POWER_TOTAL, CONF_PHASE_POWER, CONF_PHASE_VOLTAGE, CONF_CONSUMERS],
    "boiler": [CONF_CLIMATE_HEATING, CONF_CLIMATE_DHW, CONF_BOILER_STATE, CONF_BOILER_FLAME, CONF_BOILER_DHW_DEMAND,
               CONF_BOILER_IGNITION, CONF_BOILER_PUMP, CONF_BOILER_MODULATION, CONF_BOILER_FAN, CONF_BOILER_FLOW,
               CONF_BOILER_FLOW_TARGET, CONF_BOILER_RETURN, CONF_BOILER_PRESSURE, CONF_BOILER_CURVE, CONF_BOILER_OUTDOOR,
               CONF_BOILER_OUTDOOR_AVG, CONF_DHW_TEMP, CONF_DHW_TARGET, CONF_GAS, CONF_BOILER_SETTINGS,
               CONF_EBUSD_ZONE, CONF_SF_MODE, CONF_VETO_END_DATE, CONF_VETO_END_TIME],
    "meters": [CONF_METERS],
    "rooms": [CONF_AREAS, CONF_HELPER_PREFIX, CONF_FANS, CONF_EXCLUDE],
}

# Listy puste = wykrywanie automatyczne w panelu (osoby, bramy, odpady, odbiorniki i gaz z panelu Energia).
DEFAULTS: dict[str, object] = {
    CONF_STYLE: "tiles",
    CONF_TABS: list(TABS),
    CONF_TITLE: "Hearth",
    CONF_ICON: "mdi:home-thermometer",
    CONF_ADMIN_ONLY: False,
    CONF_PERSONS: [],
    CONF_GATES: [],
    CONF_WASTE: [],
    CONF_WASTE_TOGGLES: [],
    CONF_PHASE_POWER: [],
    CONF_PHASE_VOLTAGE: [],
    CONF_CONSUMERS: [],
    CONF_GAS: [],
    CONF_BOILER_SETTINGS: [],
    CONF_METERS: [],
    CONF_AREAS: [],
    CONF_HELPER_PREFIX: "",
    CONF_FANS: [],
    CONF_EXCLUDE: [],
}
