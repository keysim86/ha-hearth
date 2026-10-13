"""Wspólne przygotowanie testów."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest


@pytest.fixture(autouse=True)
def auto_enable_custom_integrations(enable_custom_integrations):
    """Pozwala HA ładować integracje z custom_components."""
    yield


@pytest.fixture
def panel_mocks(hass):
    """Zastępuje frontend HA (w testach nie ma pakietu home-assistant-frontend).

    Zależności oznaczamy jako już załadowane, a `hass.http` i rejestrację panelu podmieniamy.
    """
    hass.config.components.update({"http", "frontend", "panel_custom"})
    hass.http = MagicMock()
    hass.http.async_register_static_paths = AsyncMock()
    with (
        patch("custom_components.hearth.panel_custom.async_register_panel", new=AsyncMock()) as register,
        patch("custom_components.hearth.frontend.async_remove_panel") as remove,
    ):
        yield register, remove
