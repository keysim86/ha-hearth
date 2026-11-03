"""Kto co widzi w Hearth: rola konta HA, Asystent i osoby zakładki Zdrowie.

Konfigurację panelu (``get_panels``) dostaje każdy zalogowany, a proxy Asystenta wpuszcza po sekrecie w adresie.
Dlatego adres Asystenta i profile Zdrowia nie idą w konfiguracji panelu — panel pobiera je z ``/api/hearth/me``,
a serwer sprawdza konto:

- administrator HA: Asystent, wszystkie osoby Zdrowia;
- dorosły (każde inne konto): Asystent, w Zdrowiu swoja osoba, dzieci i osoby bez przypisanej encji osoby;
- dziecko (osoba z opcji „Dzieci”): bez Asystenta, w Zdrowiu tylko swoja osoba;
- bez dostępu (login z „Użytkownicy bez dostępu”): nic.
"""

from __future__ import annotations

from http import HTTPStatus
from typing import Any

from aiohttp import web
from homeassistant.auth.models import User
from homeassistant.components.http import KEY_HASS, HomeAssistantView
from homeassistant.config_entries import ConfigEntry, ConfigEntryState
from homeassistant.core import HomeAssistant

from .const import (
    CONF_AGENT_URL,
    CONF_CHILDREN,
    CONF_DENY_USERS,
    DEFAULTS,
    DOMAIN,
    H_NAME,
    HEALTH_DEFAULTS,
    SUBENTRY_HEALTH,
)

ROLE_ADMIN = "admin"
ROLE_ADULT = "adult"
ROLE_CHILD = "child"
ROLE_DENIED = "denied"


def panel_options(entry: ConfigEntry) -> dict:
    """Opcje wpisu uzupełnione wartościami domyślnymi."""
    return {**DEFAULTS, **entry.options}


def public_options(options: dict) -> dict:
    """Opcje dla przeglądarki każdego konta: bez adresu Asystenta (sekret proxy w adresie)."""
    return {k: v for k, v in options.items() if k != CONF_AGENT_URL}


def health_profiles(entry: ConfigEntry) -> list[dict]:
    """Osoby zakładki Zdrowie (podwpisy) w kolejności dodania."""
    return [
        {**HEALTH_DEFAULTS, **sub.data, "id": sub_id, H_NAME: sub.title}
        for sub_id, sub in entry.subentries.items()
        if sub.subentry_type == SUBENTRY_HEALTH
    ]


def person_of(hass: HomeAssistant, user_id: str) -> str | None:
    """Encja osoby przypisana do konta HA (atrybut user_id osoby)."""
    for state in hass.states.async_all("person"):
        if state.attributes.get("user_id") == user_id:
            return state.entity_id
    return None


def user_role(hass: HomeAssistant, options: dict, user: User | None) -> str:
    """Rola konta: bez dostępu > administrator > dziecko > dorosły."""
    if user is None or not user.is_active:
        return ROLE_DENIED
    deny = {str(name).strip().lower() for name in options.get(CONF_DENY_USERS) or []}
    if (user.name or "").strip().lower() in deny:
        return ROLE_DENIED
    if user.is_admin:
        return ROLE_ADMIN
    if person_of(hass, user.id) in set(options.get(CONF_CHILDREN) or []):
        return ROLE_CHILD
    return ROLE_ADULT


def visible_health(hass: HomeAssistant, options: dict, profiles: list[dict], user: User | None, role: str) -> list[dict]:
    """Osoby Zdrowia, które to konto może oglądać."""
    if role == ROLE_ADMIN:
        return profiles
    if role == ROLE_DENIED or user is None:
        return []
    own = person_of(hass, user.id)
    if role == ROLE_CHILD:
        return [p for p in profiles if own and p.get("person") == own]
    children = set(options.get(CONF_CHILDREN) or [])
    return [p for p in profiles if not p.get("person") or p.get("person") == own or p.get("person") in children]


def about_user(hass: HomeAssistant, entry: ConfigEntry, user: User | None) -> dict[str, Any]:
    """Odpowiedź /api/hearth/me: rola, adres Asystenta (gdy wolno) i widoczne osoby Zdrowia."""
    options = panel_options(entry)
    role = user_role(hass, options, user)
    agent = options.get(CONF_AGENT_URL) if role in (ROLE_ADMIN, ROLE_ADULT) else None
    return {
        "role": role,
        "agent_url": agent or None,
        "health": visible_health(hass, options, health_profiles(entry), user, role),
    }


class HearthMeView(HomeAssistantView):
    """GET /api/hearth/me — tylko dla zalogowanych; odpowiedź zależy od konta."""

    url = "/api/hearth/me"
    name = "api:hearth:me"

    async def get(self, request: web.Request) -> web.Response:
        hass: HomeAssistant = request.app[KEY_HASS]
        entry = next((e for e in hass.config_entries.async_entries(DOMAIN) if e.state is ConfigEntryState.LOADED), None)
        if entry is None:
            return self.json_message("Hearth nie jest skonfigurowany", HTTPStatus.NOT_FOUND)
        return self.json(about_user(hass, entry, request.get("hass_user")))
