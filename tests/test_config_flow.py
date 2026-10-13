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
    assert set(result["data_schema"].schema) >= {"appearance", "outdoor", "house", "rooms"}

    result = await hass.config_entries.options.async_configure(
        result["flow_id"],
        {
            "appearance": {"style": "dials", "sidebar_title": "Dom", "sidebar_icon": "mdi:home", "require_admin": False},
            "outdoor": {},  # pole temperatury wyczyszczone
            "house": {"presence": "binary_sensor.domownicy"},
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
    assert o["areas"] == ["salon", "lazienka"]
    assert o["helper_prefix"] == "ogrzewanie"
    assert o["fans"] == ["switch.wentylator"]
    assert o["exclude_entities"] == []
