# Hearth

<p align="center">
  <img src="https://raw.githubusercontent.com/keysim86/ha-hearth/main/custom_components/hearth/brand/icon@2x.png" alt="Hearth" width="110"/>
</p>

[![Release](https://img.shields.io/github/v/release/keysim86/ha-hearth?style=flat-square&include_prereleases)](https://github.com/keysim86/ha-hearth/releases/latest)
[![HACS](https://img.shields.io/badge/HACS-Custom-orange.svg?style=flat-square)](https://github.com/keysim86/ha-hearth)
[![HA](https://img.shields.io/badge/Home%20Assistant-2026.10%2B-blue?style=flat-square)](https://www.home-assistant.io/)
[![License](https://img.shields.io/github/license/keysim86/ha-hearth.svg?style=flat-square)](LICENSE)

> Panel Home Assistant dla całego domu. Pokoje budują się same z **obszarów HA** — bez list encji w YAML-u.
> Pierwsza zakładka to **Klimat**: temperatura i cel każdego pokoju, plan dnia, wilgotność, wentylatory i osuszacze,
> a nad pokojami pogoda i jakość powietrza za oknem.

![Klimat — styl Kafelki](assets/kafelki.png)

## Co jest w panelu

| Część | Zawartość |
|-------|-----------|
| 🌤️ **Na zewnątrz** | Temperatura i wilgotność z wykresem 24 h · ciśnienie z trendem z 3 godzin · światło (lx), wschód i zachód słońca · jakość powietrza: CAQI z poziomem, PM2,5 i PM10 według indeksu GIOŚ |
| 🏠 **Dom** | Stan kotła i temperatura zasilania · ile pokoi grzeje · otwarte okna i drzwi · tryb domu (noc / w domu / pusty dom) · ciepła woda · wentylacja i osuszanie z taryfą prądu |
| 🌡️ **Pokoje** | Temperatura i cel, różnica do celu · wykres z 24 h · oś dnia (w domu / noc / wieczór) z kreską „teraz” · wentylatory i osuszacze (pracuje / czuwa, ostatnia praca) · wilgotność, zawór, bateria głowicy, okna |
| ⚙️ **Ustawienia pokoju** | Po kliknięciu: dlaczego taki cel · temperatury profili −/+ · plan dnia i automatyka · dane głowicy · wilgotność wobec celu osuszacza, praca urządzeń w 24 h, energia osuszacza, przycisk wentylatora |

### Trzy style kart pokoi

Styl domyślny wybierasz w opcjach integracji, a każde urządzenie (telefon, tablet, komputer) może mieć własny —
**Ustawienia panelu** (koło zębate w prawym górnym rogu).

| Kafelki (domyślny) | Lista | Pokrętła |
|---|---|---|
| Łuk 16–28 °C, wykres 24 h, oś dnia, urządzenia | Wiersz na pokój, skala z celem i pomiarem — najgęstszy, na komputer | Kolorowe karty jak termostat, − / + na karcie — na telefon i tablet |

![Lista](assets/lista.png)

<p align="center"><img src="assets/pokretla.png" alt="Pokrętła" width="330"/></p>

## Instalacja

1. HACS → ⋮ → **Niestandardowe repozytoria** → `https://github.com/keysim86/ha-hearth`, typ **Integracja**.
2. Znajdź **Hearth** w HACS i pobierz.
3. Uruchom ponownie Home Assistanta.
4. **Ustawienia → Urządzenia i usługi → Dodaj integrację → Hearth.** Panel pojawi się w menu bocznym.

Przy dodawaniu Hearth sam podpowiada czujniki „na zewnątrz” (po nazwach typu *outdoor*, *zewn*, *air monitor*).
Resztę ustawiasz w **Konfiguruj** przy integracji.

## Jak powstają pokoje

Pokój to **obszar HA z termostatem** (encja `climate.*`). Do pokoju trafiają encje z tego obszaru — przypisane
wprost albo przez urządzenie:

| Element | Reguła |
|---|---|
| Termometr | czujnik temperatury z osobnego urządzenia, najlepiej tego z wilgotnością; bez niego — czujnik głowicy |
| Wilgotność | czujnik wilgotności z tego samego urządzenia co termometr |
| Okna i drzwi | `binary_sensor` klasy *window / door / opening* z małego urządzenia (kontaktron), więc drzwi zmywarki się nie liczą |
| Zawór, bateria | czujniki urządzenia głowicy (zawór tylko w %) |
| Osuszacz | `humidifier` klasy *dehumidifier*; moc i energia z tego samego urządzenia (np. gniazdka) |
| Wentylator | encje `fan.*`, przełączniki z „wentylator” / „fan” w nazwie albo wskazane w opcjach |

Coś trafiło nie tam? **Pomiń encje** w opcjach. Chcesz inne pokoje albo inną kolejność? **Pokoje (obszary)**.

## Opcje

| Sekcja | Pola |
|---|---|
| **Wygląd** | styl kart (kafelki / lista / pokrętła), nazwa i ikona w menu, tylko dla administratorów |
| **Na zewnątrz** | temperatura, wilgotność, ciśnienie, natężenie światła, PM2,5, PM10, indeks jakości powietrza i jego poziom |
| **Dom** | kocioł: stan albo płomień + zapotrzebowanie na CWU + moc palnika (np. z ebusd), zasilanie, powrót, ciśnienie wody · ciepła woda: temperatura i cel · obecność domowników · strefa taryfy |
| **Pokoje** | obszary i ich kolejność · prefiks pomocników ogrzewania · wentylatory · pominięte encje |

Każde pole jest opcjonalne — brak czujnika to po prostu brak kafelka.

### Profile ogrzewania (opcjonalnie)

Gdy ogrzewanie pokoi prowadzą pomocniki, panel pokazuje profile, plan dnia i „dlaczego taki cel”. Wystarczy
**prefiks** w opcjach (np. `ogrzewanie`) i pomocniki nazwane według obszaru:

| Pomocnik | Znaczenie |
|---|---|
| `input_number.<prefiks>_<obszar>_komfort` / `_eko` / `_wieczor` | temperatury: w domu, noc i poza domem, wieczór |
| `input_datetime.<prefiks>_<obszar>_noc_od` / `_noc_do` | godziny nocy |
| `input_datetime.<prefiks>_<obszar>_wieczor_od` / `_wieczor_do` | godziny wieczoru (np. łazienka) |
| `binary_sensor.<prefiks>_<obszar>_komfort` / `_wieczor` | który profil działa teraz |
| `input_boolean.<prefiks>_<obszar>_automatyka` | przełącznik automatyki |

Bez pomocników panel steruje samym termostatem (−/+ zmienia nastawę głowicy).

## Rozwój

```bash
npm ci
npm run typecheck
npm run build          # wynik: custom_components/hearth/www/hearth-panel.js (commitowany — HACS go instaluje)
pip install -r requirements_test.txt && pytest   # Python 3.14
```

**Podgląd bez Home Assistanta:** `dev/index.html` ładuje zbudowany panel z atrapą `hass` z migawki
`dev/snapshot.json` (stany, rejestry, historia) i opcji `dev/options.json` — oba pliki poza repozytorium.
`python3 -m http.server` w katalogu repo, potem `/dev/?style=tiles|list|dials&dark=0|1`.

**Wersje:** [SemVer](https://semver.org/lang/pl/), tagi `vX.Y.Z`. Zmiany trafiają na bieżąco do `CHANGELOG.md`
w sekcji `[Unreleased]`; przy wydaniu wersja zmienia się w `manifest.json` i `package.json`, a opis wydania powstaje
z CHANGELOG. Panel wypisuje swoją wersję w konsoli przeglądarki (`HEARTH vX.Y.Z`).

## Licencja

[MIT](LICENSE)
