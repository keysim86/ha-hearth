"""Kto co widzi: sekret Asystenta poza konfiguracją panelu, role kont i osoby Zdrowia (access.py)."""

from __future__ import annotations

import json
from types import SimpleNamespace

from homeassistant.components.http import KEY_HASS
from homeassistant.config_entries import ConfigSubentryData
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.hearth.access import (
    ROLE_ADMIN,
    ROLE_ADULT,
    ROLE_CHILD,
    ROLE_DENIED,
    HearthMeView,
    about_user,
    health_profiles,
    user_role,
    visible_health,
)
from custom_components.hearth.const import DEFAULTS, DOMAIN, SUBENTRY_HEALTH

AGENT = "/mirdom/?secret=tajne"


def _profile(name: str, person: str | None) -> ConfigSubentryData:
    data = {"weight": f"sensor.{name.lower()}_waga"}
    if person:
        data["person"] = person
    return ConfigSubentryData(data=data, subentry_type=SUBENTRY_HEALTH, title=name, unique_id=None)


async def _family(hass: HomeAssistant):
    """Konta jak w domu: administrator, dorosły, dwoje dzieci, babcia bez dostępu; osoby wskazują konta."""
    users = {}
    for name, admin in (("Piotr", True), ("Ewa", False), ("Ania", False), ("Kuba", False), ("Babcia", False)):
        user = await hass.auth.async_create_user(name, group_ids=["system-admin" if admin else "system-users"])
        users[name] = user
        hass.states.async_set(f"person.{name.lower()}", "home", {"user_id": user.id})
    options = {**DEFAULTS, "agent_url": AGENT, "children": ["person.ania", "person.kuba"], "deny_users": ["babcia"]}
    entry = MockConfigEntry(
        domain=DOMAIN,
        options=options,
        subentries_data=[
            _profile("Piotr", "person.piotr"),
            _profile("Ewa", "person.ewa"),
            _profile("Ania", "person.ania"),
            _profile("Kuba", "person.kuba"),
            _profile("Gość", None),
        ],
    )
    entry.add_to_hass(hass)
    return users, options, entry


async def test_panel_config_has_no_agent_secret_nor_health(hass: HomeAssistant, panel_mocks) -> None:
    register, _ = panel_mocks
    _, _, entry = await _family(hass)

    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()

    config = register.await_args.kwargs["config"]
    assert "agent_url" not in config["options"]
    assert config["agent"] is True
    assert "health" not in config
    assert "tajne" not in json.dumps(config)
    # Widok /api/hearth/me zarejestrowany obok katalogu Bring!.
    views = [type(c.args[0]).__name__ for c in hass.http.register_view.call_args_list]
    assert views == ["BringCatalogView", "HearthMeView"]


async def test_roles(hass: HomeAssistant) -> None:
    users, options, _ = await _family(hass)

    assert user_role(hass, options, users["Piotr"]) == ROLE_ADMIN
    assert user_role(hass, options, users["Ewa"]) == ROLE_ADULT
    assert user_role(hass, options, users["Ania"]) == ROLE_CHILD
    assert user_role(hass, options, users["Kuba"]) == ROLE_CHILD
    # Login z listy bez dostępu — bez względu na wielkość liter.
    assert user_role(hass, options, users["Babcia"]) == ROLE_DENIED
    assert user_role(hass, options, None) == ROLE_DENIED


async def test_health_visibility(hass: HomeAssistant) -> None:
    users, options, entry = await _family(hass)
    profiles = health_profiles(entry)

    def names(user: str) -> list[str]:
        role = user_role(hass, options, users[user])
        return [p["name"] for p in visible_health(hass, options, profiles, users[user], role)]

    # Administrator widzi wszystkich.
    assert names("Piotr") == ["Piotr", "Ewa", "Ania", "Kuba", "Gość"]
    # Dorosły: siebie, dzieci i osobę bez przypisanej encji osoby.
    assert names("Ewa") == ["Ewa", "Ania", "Kuba", "Gość"]
    # Dziecko tylko siebie.
    assert names("Ania") == ["Ania"]
    assert names("Babcia") == []


async def test_about_user_gives_agent_only_to_adults(hass: HomeAssistant) -> None:
    users, _, entry = await _family(hass)

    assert about_user(hass, entry, users["Piotr"])["agent_url"] == AGENT
    assert about_user(hass, entry, users["Ewa"])["agent_url"] == AGENT
    child = about_user(hass, entry, users["Kuba"])
    assert child["role"] == ROLE_CHILD and child["agent_url"] is None
    denied = about_user(hass, entry, users["Babcia"])
    assert denied == {"role": ROLE_DENIED, "agent_url": None, "health": []}


async def test_me_view_answers_per_user(hass: HomeAssistant, panel_mocks) -> None:
    users, _, entry = await _family(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()

    def request(user):
        return SimpleNamespace(app={KEY_HASS: hass}, get=lambda key, default=None: user if key == "hass_user" else default)

    body = json.loads((await HearthMeView().get(request(users["Ania"]))).body)
    assert body["role"] == ROLE_CHILD
    assert body["agent_url"] is None
    assert [p["name"] for p in body["health"]] == ["Ania"]

    body = json.loads((await HearthMeView().get(request(users["Piotr"]))).body)
    assert body["agent_url"] == AGENT
