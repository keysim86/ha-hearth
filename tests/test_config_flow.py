"""Konfiguracja i opcje."""

from __future__ import annotations

from homeassistant import config_entries
from homeassistant.core import HomeAssistant
from homeassistant.data_entry_flow import FlowResultType
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.hearth.const import DEFAULTS, DOMAIN


async def test_user_flow_creates_entry_with_outdoor_guess(hass: HomeAssistant, panel_mocks) -> None:
    hass.states.async_set("sensor.nettigo_air_monitor_bme280_temperatura", "6.2", {"device_class": "temperature"})
    hass.states.async_set("sensor.nettigo_air_monitor_heca_temperatura", "5.9", {"device_class": "temperature"})
    hass.states.async_set("sensor.nettigo_air_monitor_bme280_cisnienie", "996", {"device_class": "pressure"})
    hass.states.async_set("sensor.nettigo_air_monitor_sds011_caqi", "33", {})
    hass.states.async_set("sensor.nettigo_air_monitor_sds011_poziom_caqi", "low", {"device_class": "enum"})
    hass.states.async_set("sensor.salon_temperature", "23.1", {"device_class": "temperature"})

    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": config_entries.SOURCE_USER})
    assert result["type"] is FlowResultType.FORM
    result = await hass.config_entries.flow.async_configure(result["flow_id"], {})
    assert result["type"] is FlowResultType.CREATE_ENTRY
    options = result["options"]
    assert options["style"] == "tiles"
    # Czujnik powietrza, nie podgrzewanej komory HECA ani termometr w salonie.
    assert options["outdoor_temperature"] == "sensor.nettigo_air_monitor_bme280_temperatura"
    assert options["outdoor_pressure"] == "sensor.nettigo_air_monitor_bme280_cisnienie"
    assert options["outdoor_aqi"] == "sensor.nettigo_air_monitor_sds011_caqi"
    assert options["outdoor_aqi_level"] == "sensor.nettigo_air_monitor_sds011_poziom_caqi"


async def test_single_instance(hass: HomeAssistant, panel_mocks) -> None:
    MockConfigEntry(domain=DOMAIN, options=dict(DEFAULTS)).add_to_hass(hass)
    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": config_entries.SOURCE_USER})
    assert result["type"] is FlowResultType.ABORT
    assert result["reason"] == "single_instance_allowed"


async def test_options_flow_flattens_sections_and_clears_fields(hass: HomeAssistant, panel_mocks) -> None:
    entry = MockConfigEntry(domain=DOMAIN, options={**DEFAULTS, "outdoor_temperature": "sensor.old"})
    entry.add_to_hass(hass)
    await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()

    result = await hass.config_entries.options.async_init(entry.entry_id)
    assert result["type"] is FlowResultType.FORM
    assert set(result["data_schema"].schema) >= {"appearance", "outdoor", "house", "home", "energy", "boiler", "meters", "switches", "cameras", "vehicles", "proxmox", "network", "extras", "rooms"}

    result = await hass.config_entries.options.async_configure(
        result["flow_id"],
        {
            "appearance": {"style": "dials", "tabs": ["home", "climate", "energy", "boiler", "meters"], "sidebar_title": "Dom", "sidebar_icon": "mdi:home", "require_admin": False},
            "outdoor": {},  # pole temperatury wyczyszczone
            "house": {"presence": "binary_sensor.domownicy"},
            # Czujniki z MQTT (ebusd) bez klasy urządzenia muszą przejść.
            "boiler": {
                "boiler_flame": "binary_sensor.ogrzewanie_plomien",
                "boiler_dhw_demand": "binary_sensor.ciepla_woda",
                "boiler_modulation": "sensor.ogrzewanie_aktualna_moc",
                "boiler_flow_temperature": "sensor.ogrzewanie_temperatura_zasilania",
                "boiler_return_temperature": "sensor.ogrzewanie_temperatura_powrotu",
                "boiler_pressure": "sensor.ogrzewanie_cisnienie",
                "dhw_temperature": "sensor.ciepla_woda_aktualnie",
                "dhw_target": "sensor.ciepla_woda_docelowo",
                "gas": ["sensor.gaz_co", "sensor.gaz_cwu"],
            },
            "home": {"persons": ["person.a", "person.b"], "mailbox": "binary_sensor.poczta"},
            "energy": {},
            "switches": {},
            "cameras": {},
            "vehicles": {},
            "proxmox": {},
            "network": {},
            "extras": {"alerts": [{"entity": "sensor.cisnienie", "condition": "< 1.2", "message": "Ciśnienie za niskie", "severity": "error"}], "agent_url": "/agent/"},
            "meters": {"meters": ["sensor.licznik_wody"]},
            "rooms": {"areas": ["salon", "lazienka"], "helper_prefix": "ogrzewanie", "fans": ["switch.wentylator"]},
        },
    )
    assert result["type"] is FlowResultType.CREATE_ENTRY
    await hass.async_block_till_done()
    o = entry.options
    assert o["style"] == "dials"
    assert o["sidebar_title"] == "Dom"
    assert o["outdoor_temperature"] is None
    assert o["presence"] == "binary_sensor.domownicy"
    assert o["boiler_flame"] == "binary_sensor.ogrzewanie_plomien"
    assert o["boiler_pressure"] == "sensor.ogrzewanie_cisnienie"
    assert o["dhw_target"] == "sensor.ciepla_woda_docelowo"
    assert o["boiler_state"] is None
    assert o["gas"] == ["sensor.gaz_co", "sensor.gaz_cwu"]
    assert o["persons"] == ["person.a", "person.b"]
    assert o["gates"] == []  # nie podane = wykrywanie automatyczne
    assert o["meters"] == ["sensor.licznik_wody"]
    assert o["tabs"] == ["home", "climate", "energy", "boiler", "meters"]
    assert o["alerts"][0]["condition"] == "< 1.2"
    assert o["agent_url"] == "/agent/"
    assert o["cameras"] == []
    assert o["areas"] == ["salon", "lazienka"]
    assert o["helper_prefix"] == "ogrzewanie"
    assert o["fans"] == ["switch.wentylator"]
    assert o["exclude_entities"] == []


async def test_health_person_subentry_add_and_reconfigure(hass: HomeAssistant, panel_mocks) -> None:
    register, _ = panel_mocks
    entry = MockConfigEntry(domain=DOMAIN, options=dict(DEFAULTS))
    entry.add_to_hass(hass)
    await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()

    result = await hass.config_entries.subentries.async_init((entry.entry_id, "health"), context={"source": config_entries.SOURCE_USER})
    assert result["type"] is FlowResultType.FORM
    assert set(result["data_schema"].schema) == {"person", "body", "activity", "pressure", "measurements", "entry", "goals"}
    result = await hass.config_entries.subentries.async_configure(
        result["flow_id"],
        {
            "person": {"name": " Ala ", "gender": "female", "weight": "sensor.waga_ala", "height": "input_number.wzrost_ala", "history_days": 365},
            "body": {"body_fat": "sensor.tluszcz_ala"},
            "activity": {"steps": "sensor.kroki_ala"},
            "pressure": {},
            "measurements": {"meas_waist": "sensor.pomiar_talia_ala"},
            "entry": {"data_entry": True, "input_waist": "input_number.pomiar_talia_ala"},
            "goals": {"goals": [{"label": "Lato", "weight": 60}], "centiles": False},
        },
    )
    assert result["type"] is FlowResultType.CREATE_ENTRY
    await hass.async_block_till_done()

    (sub_id, sub), = entry.subentries.items()
    assert sub.title == "Ala"
    assert sub.data["weight"] == "sensor.waga_ala"
    assert sub.data["steps_goal"] == 10000  # wartość domyślna z formularza
    assert "bp_systolic" not in sub.data  # puste pola nie trafiają do danych
    # Nowa osoba = przeładowanie wpisu, panel dostaje profil.
    health = register.await_args.kwargs["config"]["health"]
    assert [p["name"] for p in health] == ["Ala"]
    assert health[0]["id"] == sub_id
    assert health[0]["goals"] == [{"label": "Lato", "weight": 60}]

    result = await hass.config_entries.subentries.async_init(
        (entry.entry_id, "health"), context={"source": config_entries.SOURCE_RECONFIGURE, "subentry_id": sub_id}
    )
    assert result["type"] is FlowResultType.FORM
    result = await hass.config_entries.subentries.async_configure(
        result["flow_id"],
        {
            "person": {"name": "Alicja", "gender": "female", "weight": "sensor.waga_ala", "history_days": 180},
            "body": {}, "activity": {}, "pressure": {"bp_systolic": "sensor.bp_ala_skurczowe"}, "measurements": {}, "entry": {}, "goals": {},
        },
    )
    assert result["type"] is FlowResultType.ABORT
    assert result["reason"] == "reconfigure_successful"
    await hass.async_block_till_done()
    sub = entry.subentries[sub_id]
    assert sub.title == "Alicja"
    assert sub.data["history_days"] == 180
    assert "body_fat" not in sub.data  # wyczyszczone pole znika
    assert register.await_args.kwargs["config"]["health"][0]["bp_systolic"] == "sensor.bp_ala_skurczowe"
