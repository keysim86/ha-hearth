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
CONF_ACCENT = "accent_color"
# Kolory wiodące (klucze jak w panelu); w opcjach można też wpisać własny „#rrggbb”.
ACCENTS = ["ember", "frost", "air", "ok", "bath", "rose", "slate", "theme"]
STYLES = ["tiles", "list", "dials"]
TABS = ["home", "climate", "switches", "energy", "boiler", "meters", "network", "cameras", "cars", "robots", "proxmox", "health", "appliances", "agent", "alerts"]

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
CONF_CONSUMERS_EXCLUDE = "consumers_exclude"

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

# Przełączniki, kamery, auta, roboty, Proxmox, sieć, alerty, agent
CONF_SWITCH_EXCLUDE = "switch_exclude"
CONF_CAMERAS = "cameras"
CONF_NVR_STATUS = "nvr_status"
CONF_NVR_VERSION = "nvr_version"
CONF_NVR_CHANNELS = "nvr_channels"
CONF_NVR_USED = "nvr_storage_used"
CONF_NVR_TOTAL = "nvr_storage_total"
CONF_VEHICLES = "vehicles"
CONF_ROBOTS_EXCLUDE = "robots_exclude"
CONF_APPLIANCES_EXCLUDE = "appliances_exclude"
CONF_APPLIANCE_PLUGS = "appliance_plugs"
CONF_PROXMOX_EXCLUDE = "proxmox_exclude"
CONF_PROXMOX_DISKS = "proxmox_disks"
CONF_NET_SPEED = "net_speed"
CONF_NET_STATUS = "net_status"
CONF_NET_UPDATES = "net_updates"
CONF_NET_PORTS = "net_ports"
CONF_ALERTS = "alerts"
CONF_AGENT_URL = "agent_url"

# Pokoje
CONF_AREAS = "areas"
CONF_HELPER_PREFIX = "helper_prefix"
CONF_FANS = "fans"
CONF_EXCLUDE = "exclude_entities"

SECTIONS: dict[str, list[str]] = {
    "appearance": [CONF_STYLE, CONF_ACCENT, CONF_TABS, CONF_TITLE, CONF_ICON, CONF_ADMIN_ONLY],
    "outdoor": [CONF_OUT_TEMP, CONF_OUT_HUMIDITY, CONF_OUT_PRESSURE, CONF_OUT_ILLUMINANCE,
                CONF_OUT_PM25, CONF_OUT_PM10, CONF_OUT_AQI, CONF_OUT_AQI_LEVEL],
    "house": [CONF_PRESENCE, CONF_TARIFF],
    "home": [CONF_PERSONS, CONF_GATES, CONF_MAILBOX, CONF_MAILBOX_BATTERY, CONF_WASTE_CALENDAR, CONF_WASTE, CONF_WASTE_TOGGLES, CONF_WEATHER],
    "energy": [CONF_POWER_TOTAL, CONF_PHASE_POWER, CONF_PHASE_VOLTAGE, CONF_CONSUMERS, CONF_CONSUMERS_EXCLUDE],
    "boiler": [CONF_CLIMATE_HEATING, CONF_CLIMATE_DHW, CONF_BOILER_STATE, CONF_BOILER_FLAME, CONF_BOILER_DHW_DEMAND,
               CONF_BOILER_IGNITION, CONF_BOILER_PUMP, CONF_BOILER_MODULATION, CONF_BOILER_FAN, CONF_BOILER_FLOW,
               CONF_BOILER_FLOW_TARGET, CONF_BOILER_RETURN, CONF_BOILER_PRESSURE, CONF_BOILER_CURVE, CONF_BOILER_OUTDOOR,
               CONF_BOILER_OUTDOOR_AVG, CONF_DHW_TEMP, CONF_DHW_TARGET, CONF_GAS, CONF_BOILER_SETTINGS,
               CONF_EBUSD_ZONE, CONF_SF_MODE, CONF_VETO_END_DATE, CONF_VETO_END_TIME],
    "meters": [CONF_METERS],
    "switches": [CONF_SWITCH_EXCLUDE],
    "cameras": [CONF_CAMERAS, CONF_NVR_STATUS, CONF_NVR_VERSION, CONF_NVR_CHANNELS, CONF_NVR_USED, CONF_NVR_TOTAL],
    "vehicles": [CONF_VEHICLES, CONF_ROBOTS_EXCLUDE],
    "appliances": [CONF_APPLIANCES_EXCLUDE, CONF_APPLIANCE_PLUGS],
    "proxmox": [CONF_PROXMOX_EXCLUDE, CONF_PROXMOX_DISKS],
    "network": [CONF_NET_SPEED, CONF_NET_STATUS, CONF_NET_UPDATES, CONF_NET_PORTS],
    "extras": [CONF_ALERTS, CONF_AGENT_URL],
    "rooms": [CONF_AREAS, CONF_HELPER_PREFIX, CONF_FANS, CONF_EXCLUDE],
}

# Listy puste = wykrywanie automatyczne w panelu (osoby, bramy, odpady, odbiorniki i gaz z panelu Energia).
DEFAULTS: dict[str, object] = {
    CONF_STYLE: "tiles",
    CONF_ACCENT: "ember",
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
    CONF_CONSUMERS_EXCLUDE: [],
    CONF_GAS: [],
    CONF_BOILER_SETTINGS: [],
    CONF_METERS: [],
    CONF_SWITCH_EXCLUDE: [],
    CONF_CAMERAS: [],
    CONF_VEHICLES: [],
    CONF_ROBOTS_EXCLUDE: [],
    CONF_APPLIANCES_EXCLUDE: [],
    CONF_APPLIANCE_PLUGS: [],
    CONF_PROXMOX_EXCLUDE: [],
    CONF_PROXMOX_DISKS: [],
    CONF_NET_SPEED: [],
    CONF_NET_STATUS: [],
    CONF_NET_UPDATES: [],
    CONF_NET_PORTS: [],
    CONF_ALERTS: [],
    CONF_AREAS: [],
    CONF_HELPER_PREFIX: "",
    CONF_FANS: [],
    CONF_EXCLUDE: [],
}

# Zdrowie: każda osoba to podwpis (config subentry) z własnymi encjami — dodawany przyciskiem „Dodaj osobę”.
SUBENTRY_HEALTH = "health"
H_NAME = "name"
MEASUREMENTS = ["neck", "chest", "abdomen", "waist", "hips", "thigh", "calf", "biceps"]

HEALTH_SECTIONS: dict[str, list[str]] = {
    "person": [H_NAME, "person", "gender", "birthdate", "weight", "height", "height_cm", "start_weight", "start_date", "history_days"],
    "body": ["body_fat", "fat_mass", "lean_mass", "muscle_mass", "skeletal_muscle", "bone_mass", "body_water", "bmr"],
    "activity": ["steps", "calories", "steps_goal", "calories_goal"],
    "pressure": ["bp_systolic", "bp_diastolic", "bp_pulse", "bp_category", "report_name", "report_device", "bp_exclude"],
    "measurements": [f"meas_{m}" for m in MEASUREMENTS],
    # Ręczny wpis tylko obwodów — reszta danych przychodzi z telefonów i wagi.
    "entry": ["data_entry", *[f"input_{m}" for m in MEASUREMENTS]],
    "goals": ["goals", "centiles"],
}

HEALTH_DEFAULTS: dict[str, object] = {
    "gender": "male",
    "history_days": 365,
    "steps_goal": 10000,
    "calories_goal": 800,
    "bp_exclude": [],
    "data_entry": False,
    "goals": [],
    "centiles": False,
}
