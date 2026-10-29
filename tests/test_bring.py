"""Katalog Bring! dla karty Zakupy (/api/hearth/bring_catalog/<język>)."""

from __future__ import annotations

import json
from http import HTTPStatus
from unittest.mock import MagicMock, patch

from homeassistant.components.http import KEY_HASS
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.test_util.aiohttp import AiohttpClientMocker

from custom_components.hearth.bring import CACHE_SECONDS, CATALOG_URL, BringCatalogView, simplify

RAW = {
    "language": "pl-PL",
    "catalog": {
        "sections": [
            {"sectionId": "Milch & Käse", "name": "Mleko i ser", "items": [{"itemId": "Milch", "name": "Mleko"}, {"itemId": "Käse", "name": "Ser"}]},
            {"sectionId": "Brot & Gebäck", "name": "Chleb i inne wypieki", "items": [{"itemId": "Brot", "name": "Chleb"}]},
        ]
    },
}
URL = CATALOG_URL.format(locale="pl-PL")


def _request(hass: HomeAssistant) -> MagicMock:
    return MagicMock(app={KEY_HASS: hass})


def test_simplify_keeps_sections_keys_and_names() -> None:
    assert simplify(RAW) == {
        "sections": [
            {"name": "Mleko i ser", "items": [{"key": "Milch", "name": "Mleko"}, {"key": "Käse", "name": "Ser"}]},
            {"name": "Chleb i inne wypieki", "items": [{"key": "Brot", "name": "Chleb"}]},
        ]
    }


async def test_catalog_fetched_once_and_cached(hass: HomeAssistant, aioclient_mock: AiohttpClientMocker) -> None:
    aioclient_mock.get(URL, json=RAW)
    view = BringCatalogView()

    first = await view.get(_request(hass), "pl-PL")
    second = await view.get(_request(hass), "pl-PL")

    assert first.status == HTTPStatus.OK
    assert json.loads(first.body)["sections"][0]["items"][1] == {"key": "Käse", "name": "Ser"}
    assert second.body == first.body
    assert aioclient_mock.call_count == 1


async def test_bad_locale_is_rejected_without_a_request(hass: HomeAssistant, aioclient_mock: AiohttpClientMocker) -> None:
    resp = await BringCatalogView().get(_request(hass), "../etc")
    assert resp.status == HTTPStatus.BAD_REQUEST
    assert aioclient_mock.call_count == 0


async def test_bring_down_without_cache_is_bad_gateway(hass: HomeAssistant, aioclient_mock: AiohttpClientMocker) -> None:
    aioclient_mock.get(URL, status=HTTPStatus.SERVICE_UNAVAILABLE)
    resp = await BringCatalogView().get(_request(hass), "pl-PL")
    assert resp.status == HTTPStatus.BAD_GATEWAY


async def test_bring_down_serves_stale_cache(hass: HomeAssistant, aioclient_mock: AiohttpClientMocker) -> None:
    aioclient_mock.get(URL, json=RAW)
    view = BringCatalogView()
    with patch("custom_components.hearth.bring.time.monotonic", return_value=1000.0):
        await view.get(_request(hass), "pl-PL")

    aioclient_mock.clear_requests()
    aioclient_mock.get(URL, status=HTTPStatus.SERVICE_UNAVAILABLE)
    with patch("custom_components.hearth.bring.time.monotonic", return_value=1000.0 + CACHE_SECONDS + 1):
        resp = await view.get(_request(hass), "pl-PL")

    assert resp.status == HTTPStatus.OK
    assert json.loads(resp.body) == simplify(RAW)
    assert aioclient_mock.call_count == 1
