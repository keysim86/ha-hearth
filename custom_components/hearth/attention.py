"""„Wymaga uwagi”: odłożone i zrobione sprawy wspólne dla całego domu.

Kliknięcie „Jutro” albo „Zrobione” (np. „Wyjęte” przy zmywarce) w dowolnej przeglądarce, przez dowolne konto,
chowa sprawę we wszystkich otwartych panelach — do jej następnego wystąpienia:
- sprawy z czasem w kluczu (koniec cyklu AGD, otwarcie bramy / okna, poczta, wywóz) przy następnym razie mają
  nowy klucz, więc pojawiają się same;
- sprawy bez czasu w kluczu (reguły alertów, głowica bez kontaktu) panel dorosłego każe zapomnieć, gdy przez
  5 min nie ma ich na liście — wtedy wpis wypada i przy następnym razie sprawa znów jest widoczna.
Wpis starszy niż 14 dni wypada sam (także „zrobione” sprawy, które wciąż trwają — wrócą jako przypomnienie).

Stan żyje w Store (``.storage/hearth.attention``) i rozchodzi się subskrypcją WebSocket do każdego panelu.
"""

from __future__ import annotations

import time
from collections.abc import Callable
from typing import Any

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.config_entries import ConfigEntryState
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.storage import Store

from .access import ROLE_DENIED, panel_options, user_role
from .const import DOMAIN

DATA_ATTENTION = "hearth_attention"
STORE_KEY = "hearth.attention"
STORE_VERSION = 1
SAVE_DELAY = 2

MAX_ENTRIES = 300
MAX_KEY = 300
MAX_FORGET = 300
# „Na zawsze” w panelu (NEVER = 9e15 ms); wyżej nie przyjmujemy.
MAX_UNTIL = 10**16
# Wpisy starsze niż 14 dni wypadają same (ich sprawy mają zwykle już inne klucze albo dawno zniknęły).
MAX_AGE_MS = 14 * 24 * 3_600_000

Listener = Callable[[dict[str, int]], None]


def _now_ms() -> int:
    return int(time.time() * 1000)


class AttentionStore:
    """Klucz sprawy -> do kiedy schowana (ms od epoki) i kiedy zapisano."""

    def __init__(self, hass: HomeAssistant) -> None:
        self._store: Store[dict[str, Any]] = Store(hass, STORE_VERSION, STORE_KEY)
        self._hidden: dict[str, dict[str, int]] = {}
        self._listeners: set[Listener] = set()

    async def async_load(self) -> None:
        data = await self._store.async_load()
        hidden = data.get("hidden") if isinstance(data, dict) else None
        if not isinstance(hidden, dict):
            return
        for key, entry in hidden.items():
            if isinstance(key, str) and isinstance(entry, dict) and isinstance(entry.get("until"), (int, float)):
                at = entry.get("at")
                self._hidden[key] = {"until": int(entry["until"]), "at": int(at) if isinstance(at, (int, float)) else 0}

    @callback
    def snapshot(self) -> dict[str, int]:
        """Aktualne wpisy (wygasłe i przeterminowane usuwa przy okazji)."""
        now = _now_ms()
        old = [k for k, e in self._hidden.items() if e["until"] <= now or now - e["at"] > MAX_AGE_MS]
        for key in old:
            del self._hidden[key]
        if old:
            self._save()
        return {k: e["until"] for k, e in self._hidden.items()}

    @callback
    def hide(self, key: str, until: int) -> None:
        self._hidden[key] = {"until": int(until), "at": _now_ms()}
        if len(self._hidden) > MAX_ENTRIES:
            for old in sorted(self._hidden, key=lambda k: self._hidden[k]["at"])[: len(self._hidden) - MAX_ENTRIES]:
                del self._hidden[old]
        self._changed()

    @callback
    def forget(self, keys: list[str]) -> int:
        """Usuwa wpisy spraw, które zniknęły z listy (przy następnym wystąpieniu znów będą widoczne)."""
        gone = [k for k in dict.fromkeys(keys) if k in self._hidden]
        for key in gone:
            del self._hidden[key]
        if gone:
            self._changed()
        return len(gone)

    @callback
    def reset(self) -> None:
        if self._hidden:
            self._hidden.clear()
            self._changed()

    @callback
    def subscribe(self, listener: Listener) -> Callable[[], None]:
        self._listeners.add(listener)
        return lambda: self._listeners.discard(listener)

    @callback
    def _changed(self) -> None:
        self._save()
        snap = self.snapshot()
        for listener in list(self._listeners):
            listener(snap)

    @callback
    def _save(self) -> None:
        self._store.async_delay_save(lambda: {"hidden": self._hidden}, SAVE_DELAY)


async def async_setup_attention(hass: HomeAssistant) -> None:
    """Raz na życie HA: wczytuje stan i rejestruje komendy WebSocket."""
    if DATA_ATTENTION in hass.data:
        return
    store = AttentionStore(hass)
    await store.async_load()
    hass.data[DATA_ATTENTION] = store
    websocket_api.async_register_command(hass, ws_subscribe)
    websocket_api.async_register_command(hass, ws_hide)
    websocket_api.async_register_command(hass, ws_forget)
    websocket_api.async_register_command(hass, ws_reset)


def _store(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> AttentionStore | None:
    """Stan spraw dla konta z dostępem do panelu; konto z „Bez dostępu” (albo Hearth wyłączony) dostaje błąd."""
    entry = next((e for e in hass.config_entries.async_entries(DOMAIN) if e.state is ConfigEntryState.LOADED), None)
    if entry is None or user_role(hass, panel_options(entry), connection.user) == ROLE_DENIED:
        connection.send_error(msg["id"], websocket_api.ERR_UNAUTHORIZED, "Brak dostępu do panelu Hearth")
        return None
    return hass.data[DATA_ATTENTION]


@websocket_api.websocket_command({vol.Required("type"): "hearth/attention/subscribe"})
@callback
def ws_subscribe(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Bieżący stan od razu, potem każda zmiana: {"hidden": {klucz: do_kiedy_ms}}."""
    if (store := _store(hass, connection, msg)) is None:
        return

    @callback
    def forward(snapshot: dict[str, int]) -> None:
        connection.send_event(msg["id"], {"hidden": snapshot})

    connection.subscriptions[msg["id"]] = store.subscribe(forward)
    connection.send_result(msg["id"])
    forward(store.snapshot())


@websocket_api.websocket_command(
    {
        vol.Required("type"): "hearth/attention/hide",
        vol.Required("key"): vol.All(str, vol.Length(min=1, max=MAX_KEY)),
        vol.Required("until"): vol.All(vol.Coerce(int), vol.Range(min=0, max=MAX_UNTIL)),
    }
)
@callback
def ws_hide(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    if (store := _store(hass, connection, msg)) is None:
        return
    store.hide(msg["key"], msg["until"])
    connection.send_result(msg["id"])


@websocket_api.websocket_command(
    {
        vol.Required("type"): "hearth/attention/forget",
        vol.Required("keys"): vol.All([vol.All(str, vol.Length(min=1, max=MAX_KEY))], vol.Length(max=MAX_FORGET)),
    }
)
@callback
def ws_forget(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    if (store := _store(hass, connection, msg)) is None:
        return
    connection.send_result(msg["id"], {"removed": store.forget(msg["keys"])})


@websocket_api.websocket_command({vol.Required("type"): "hearth/attention/reset"})
@callback
def ws_reset(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    if (store := _store(hass, connection, msg)) is None:
        return
    store.reset()
    connection.send_result(msg["id"])
