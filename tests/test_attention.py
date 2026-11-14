"""„Wymaga uwagi”: odłożone i zrobione sprawy wspólne dla wszystkich przeglądarek i kont (attention.py)."""

from __future__ import annotations

import json
import logging
from typing import Any
from unittest.mock import patch

from homeassistant.components.websocket_api.connection import ActiveConnection
from homeassistant.config_entries import ConfigEntryState
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry, flush_store

from custom_components.hearth import attention
from custom_components.hearth.attention import DATA_ATTENTION, MAX_AGE_MS, MAX_ENTRIES, async_setup_attention
from custom_components.hearth.const import DEFAULTS, DOMAIN

NOW = 1_800_000_000_000
NEVER = 9 * 10**15


class Client:
    """Połączenie WebSocket jednej przeglądarki: wysyła komendy, zbiera odpowiedzi i zdarzenia."""

    def __init__(self, hass: HomeAssistant, user) -> None:
        self.out: list[dict[str, Any]] = []
        self.conn = ActiveConnection(logging.getLogger(__name__), hass, self._send, user, None, None)
        self.last_id = 0

    def _send(self, message) -> None:
        self.out.append(json.loads(message) if isinstance(message, (bytes, str)) else message)

    def send(self, type_: str, **data) -> dict[str, Any]:
        self.last_id += 1
        self.conn.async_handle({"id": self.last_id, "type": type_, **data})
        return next(m for m in self.out if m["id"] == self.last_id and m["type"] == "result")

    def events(self, sub_id: int) -> list[dict[str, int]]:
        return [m["event"]["hidden"] for m in self.out if m["id"] == sub_id and m["type"] == "event"]


async def _setup(hass: HomeAssistant, **options) -> None:
    MockConfigEntry(domain=DOMAIN, options={**DEFAULTS, **options}, state=ConfigEntryState.LOADED).add_to_hass(hass)
    await async_setup_attention(hass)


async def test_hide_reaches_every_open_panel(hass: HomeAssistant, hass_admin_user, hass_read_only_user) -> None:
    await _setup(hass)
    kitchen, phone = Client(hass, hass_admin_user), Client(hass, hass_read_only_user)
    with patch.object(attention, "_now_ms", return_value=NOW):
        assert kitchen.send("hearth/attention/subscribe")["success"]
        assert phone.send("hearth/attention/subscribe")["success"]
        assert kitchen.events(1) == [{}]

        # „Wyjęte” na telefonie innego konta — tablet w kuchni chowa zmywarkę od razu.
        assert phone.send("hearth/attention/hide", key="agd:sensor.zmywarka:29999999", until=NEVER)["success"]
        assert kitchen.events(1)[-1] == {"agd:sensor.zmywarka:29999999": NEVER}
        assert phone.events(1)[-1] == {"agd:sensor.zmywarka:29999999": NEVER}

        # „Jutro” przychodzi jako liczba z JavaScriptu (może być float) — zapisujemy całkowitą.
        assert kitchen.send("hearth/attention/hide", key="mail:2026-11-14T08:00:00", until=float(NOW + 3_600_000))["success"]
        assert phone.events(1)[-1]["mail:2026-11-14T08:00:00"] == NOW + 3_600_000

    # Odłożenie mija: przy następnym odczycie wpisu już nie ma.
    with patch.object(attention, "_now_ms", return_value=NOW + 3_600_001):
        assert hass.data[DATA_ATTENTION].snapshot() == {"agd:sensor.zmywarka:29999999": NEVER}

    # Zamknięte połączenie przestaje dostawać zdarzenia.
    phone.conn.async_handle_close()
    count = len(phone.out)
    kitchen.send("hearth/attention/reset")
    assert len(phone.out) == count
    assert kitchen.events(1)[-1] == {}


async def test_forget_and_limits(hass: HomeAssistant, hass_admin_user) -> None:
    await _setup(hass)
    c = Client(hass, hass_admin_user)
    store = hass.data[DATA_ATTENTION]
    with patch.object(attention, "_now_ms", return_value=NOW):
        c.send("hearth/attention/hide", key="alert:sensor.co2:Wysokie CO₂", until=NEVER)
        c.send("hearth/attention/hide", key="lost:salon", until=NEVER)
        res = c.send("hearth/attention/forget", keys=["alert:sensor.co2:Wysokie CO₂", "alert:sensor.co2:Wysokie CO₂", "nie-ma"])
        assert res["result"] == {"removed": 1}
        assert store.snapshot() == {"lost:salon": NEVER}

        # Błędne wartości odrzuca schemat.
        assert not c.send("hearth/attention/hide", key="", until=NEVER)["success"]
        assert not c.send("hearth/attention/hide", key="x", until=-1)["success"]
        assert not c.send("hearth/attention/hide", key="x" * 301, until=NEVER)["success"]
        assert not c.send("hearth/attention/forget", keys="lost:salon")["success"]

        for i in range(MAX_ENTRIES + 5):
            store.hide(f"waste:{i}", NEVER)
    assert len(store.snapshot()) == MAX_ENTRIES

    # Wpis sprzed ponad 14 dni wypada sam, nawet „na zawsze”.
    with patch.object(attention, "_now_ms", return_value=NOW + MAX_AGE_MS + 1):
        assert store.snapshot() == {}


async def test_denied_account_gets_error(hass: HomeAssistant, hass_admin_user) -> None:
    await _setup(hass, deny_users=[hass_admin_user.name])
    c = Client(hass, hass_admin_user)
    for type_, data in (
        ("hearth/attention/subscribe", {}),
        ("hearth/attention/hide", {"key": "lost:salon", "until": NEVER}),
        ("hearth/attention/forget", {"keys": ["lost:salon"]}),
        ("hearth/attention/reset", {}),
    ):
        res = c.send(type_, **data)
        assert not res["success"] and res["error"]["code"] == "unauthorized"
    assert hass.data[DATA_ATTENTION].snapshot() == {}


async def test_state_survives_restart(hass: HomeAssistant, hass_storage, hass_admin_user) -> None:
    hass_storage["hearth.attention"] = {
        "version": 1,
        "key": "hearth.attention",
        "data": {"hidden": {"lost:salon": {"until": NEVER, "at": NOW}, "zly": "wpis"}},
    }
    with patch.object(attention, "_now_ms", return_value=NOW + 1000):
        await _setup(hass)
        store = hass.data[DATA_ATTENTION]
        assert store.snapshot() == {"lost:salon": NEVER}
        store.hide("mail:x", NOW + 5000)
    await flush_store(store._store)
    assert hass_storage["hearth.attention"]["data"]["hidden"]["mail:x"] == {"until": NOW + 5000, "at": NOW + 1000}
