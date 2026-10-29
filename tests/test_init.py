"""Rejestracja panelu."""

from __future__ import annotations

from homeassistant.config_entries import ConfigEntryState
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.hearth.const import DEFAULTS, DOMAIN


async def test_setup_registers_panel_and_unload_removes_it(hass: HomeAssistant, panel_mocks) -> None:
    register, remove = panel_mocks
    entry = MockConfigEntry(domain=DOMAIN, options={**DEFAULTS, "style": "list", "sidebar_title": "Dom"})
    entry.add_to_hass(hass)

    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    assert entry.state is ConfigEntryState.LOADED

    hass.http.async_register_static_paths.assert_awaited_once()
    # Katalog Bring! dla karty Zakupy.
    assert type(hass.http.register_view.call_args.args[0]).__name__ == "BringCatalogView"
    kwargs = register.await_args.kwargs
    assert kwargs["frontend_url_path"] == "hearth"
    assert kwargs["webcomponent_name"] == "hearth-panel"
    assert kwargs["sidebar_title"] == "Dom"
    assert kwargs["module_url"].startswith("/hearth_files/hearth-panel.js?v=")
    assert kwargs["config"]["options"]["style"] == "list"
    assert kwargs["require_admin"] is False

    assert await hass.config_entries.async_unload(entry.entry_id)
    remove.assert_called_once_with(hass, "hearth")


async def test_options_change_reloads_with_new_config(hass: HomeAssistant, panel_mocks) -> None:
    register, _ = panel_mocks
    entry = MockConfigEntry(domain=DOMAIN, options=dict(DEFAULTS))
    entry.add_to_hass(hass)
    await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()

    hass.config_entries.async_update_entry(entry, options={**DEFAULTS, "style": "dials"})
    await hass.async_block_till_done()

    assert register.await_count == 2
    assert register.await_args.kwargs["config"]["options"]["style"] == "dials"
    # Ścieżka plików i widok katalogu rejestrowane tylko raz na uruchomienie HA.
    hass.http.async_register_static_paths.assert_awaited_once()
    hass.http.register_view.assert_called_once()
