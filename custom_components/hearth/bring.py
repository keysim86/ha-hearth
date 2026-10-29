"""Katalog produktów Bring! dla karty Zakupy.

Panel pokazuje listy z integracji Bring! (encje todo) z ikonami i działami jak w aplikacji. Działy i klucze ikon są
w publicznym katalogu Bring! (web.getbring.com), ale ten serwer nie wpuszcza zapytań z innej strony (CORS) — więc
panel pyta Hearth, a Hearth pobiera katalog po stronie HA i trzyma go dobę w pamięci.
"""

from __future__ import annotations

import re
import time
from http import HTTPStatus
from typing import Any

from aiohttp import ClientError, ClientTimeout, web

from homeassistant.components.http import KEY_HASS, HomeAssistantView
from homeassistant.helpers.aiohttp_client import async_get_clientsession

CATALOG_URL = "https://web.getbring.com/locale/catalog.{locale}.json"
CACHE_SECONDS = 24 * 3600
_LOCALE = re.compile(r"^[a-z]{2}-[A-Z]{2}$")


def simplify(raw: dict[str, Any]) -> dict[str, Any]:
    """Z katalogu Bring! tylko to, czego potrzebuje karta: działy z produktami (klucz ikony i nazwa)."""
    return {
        "sections": [
            {
                "name": str(section["name"]),
                "items": [{"key": str(item["itemId"]), "name": str(item["name"])} for item in section.get("items", [])],
            }
            for section in raw["catalog"]["sections"]
        ]
    }


class BringCatalogView(HomeAssistantView):
    """GET /api/hearth/bring_catalog/<język>, np. pl-PL — tylko dla zalogowanych."""

    url = "/api/hearth/bring_catalog/{locale}"
    name = "api:hearth:bring_catalog"

    def __init__(self) -> None:
        self._cache: dict[str, tuple[float, dict[str, Any]]] = {}

    async def get(self, request: web.Request, locale: str) -> web.Response:
        if not _LOCALE.match(locale):
            return self.json_message("Nieznany język katalogu", HTTPStatus.BAD_REQUEST)
        cached = self._cache.get(locale)
        if cached and time.monotonic() - cached[0] < CACHE_SECONDS:
            return self.json(cached[1])
        session = async_get_clientsession(request.app[KEY_HASS])
        try:
            async with session.get(CATALOG_URL.format(locale=locale), timeout=ClientTimeout(total=15)) as resp:
                resp.raise_for_status()
                data = simplify(await resp.json(content_type=None))
        except (ClientError, TimeoutError, ValueError, KeyError, TypeError):
            # Bring! nie odpowiada: starszy katalog lepszy niż żaden; bez niego karta działa bez ikon i działów.
            if cached:
                return self.json(cached[1])
            return self.json_message("Katalog Bring! jest niedostępny", HTTPStatus.BAD_GATEWAY)
        self._cache[locale] = (time.monotonic(), data)
        return self.json(data)
