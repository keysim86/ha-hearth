"""Hearth — panel Home Assistant budowany z obszarów."""

from __future__ import annotations

import hashlib
from pathlib import Path

from homeassistant.components import frontend, panel_custom
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.loader import async_get_integration

from .bring import BringCatalogView
from .const import (
    CONF_ADMIN_ONLY,
    CONF_ICON,
    CONF_TITLE,
    DATA_STATIC_REGISTERED,
    DEFAULTS,
    DOMAIN,
    H_NAME,
    HEALTH_DEFAULTS,
    PANEL_COMPONENT,
    PANEL_URL_PATH,
    STATIC_URL,
    SUBENTRY_HEALTH,
)

FRONTEND_DIR = Path(__file__).parent / "www"


def _file_digest(path: Path) -> str:
    """Krótki skrót pliku panelu — nowy plik po aktualizacji = nowy adres, przeglądarka nie weźmie starego z pamięci."""
    try:
        return hashlib.sha256(path.read_bytes()).hexdigest()[:8]
    except OSError:
        return "0"


def panel_options(entry: ConfigEntry) -> dict:
    """Opcje wpisu uzupełnione wartościami domyślnymi."""
    return {**DEFAULTS, **entry.options}


def health_profiles(entry: ConfigEntry) -> list[dict]:
    """Osoby zakładki Zdrowie (podwpisy) w kolejności dodania."""
    return [
        {**HEALTH_DEFAULTS, **sub.data, "id": sub_id, H_NAME: sub.title}
        for sub_id, sub in entry.subentries.items()
        if sub.subentry_type == SUBENTRY_HEALTH
    ]


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Rejestruje pliki panelu i sam panel w menu bocznym."""
    version = (await async_get_integration(hass, DOMAIN)).version
    if not hass.data.get(DATA_STATIC_REGISTERED):
        # Ścieżka statyczna żyje do restartu HA — rejestrujemy ją raz, nawet gdy wpis jest przeładowywany.
        await hass.http.async_register_static_paths(
            [StaticPathConfig(STATIC_URL, str(FRONTEND_DIR), cache_headers=False)]
        )
        # Katalog Bring! dla karty Zakupy — też raz na życie HA.
        hass.http.register_view(BringCatalogView())
        hass.data[DATA_STATIC_REGISTERED] = True

    options = panel_options(entry)
    digest = await hass.async_add_executor_job(_file_digest, FRONTEND_DIR / "hearth-panel.js")
    await panel_custom.async_register_panel(
        hass,
        frontend_url_path=PANEL_URL_PATH,
        webcomponent_name=PANEL_COMPONENT,
        sidebar_title=options[CONF_TITLE] or DEFAULTS[CONF_TITLE],
        sidebar_icon=options[CONF_ICON] or DEFAULTS[CONF_ICON],
        # Wersja i skrót pliku w adresie wymuszają pobranie nowego pliku po aktualizacji.
        module_url=f"{STATIC_URL}/hearth-panel.js?v={version}-{digest}",
        embed_iframe=False,
        require_admin=bool(options[CONF_ADMIN_ONLY]),
        config={"options": options, "health": health_profiles(entry), "version": str(version)},
    )
    entry.async_on_unload(entry.add_update_listener(_options_updated))
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Zdejmuje panel z menu."""
    frontend.async_remove_panel(hass, PANEL_URL_PATH)
    return True


async def _options_updated(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Nowe opcje albo zmiana osób (podwpisów) = przeładowanie wpisu, żeby panel dostał świeżą konfigurację."""
    await hass.config_entries.async_reload(entry.entry_id)
