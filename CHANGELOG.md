# Changelog

Wszystkie istotne zmiany w tym projekcie są opisywane w tym pliku.

Format oparty na [Keep a Changelog](https://keepachangelog.com/pl/1.1.0/),
projekt stosuje [wersjonowanie semantyczne](https://semver.org/lang/pl/).

## [Unreleased]

### Added
- **Integracja `hearth` z panelem w menu bocznym** — jeden wpis na instalację; panel rejestrowany przez `panel_custom`,
  pliki panelu serwowane z integracji (`/hearth_files`), wersja w adresie wymusza świeży plik po aktualizacji
- **Pokoje z obszarów HA** — pokój to obszar z termostatem; termometr, wilgotność, okna i drzwi (tylko kontaktrony),
  zawór w %, bateria głowicy, osuszacze (z mocą i energią z gniazdka) i wentylatory dobierane same po obszarze i klasie
- **Zakładka Klimat w trzech stylach** — Kafelki (łuk 16–28 °C, wykres 24 h, oś dnia), Lista (wiersz na pokój, skala
  z celem i pomiarem) i Pokrętła (karta w kolorze temperatury, pierścień, − / + na karcie)
- **Na zewnątrz** — temperatura i wilgotność z wykresem, ciśnienie z trendem 3 h, światło i słońce, CAQI z poziomem
  oraz PM2,5 / PM10 według indeksu GIOŚ
- **Pasek domu** — kocioł, ile pokoi grzeje, okna, tryb domu, ciepła woda, wentylacja i osuszanie z taryfą
- **Ustawienia pokoju po kliknięciu** — dlaczego taki cel, temperatury profili −/+ (zapis do pomocników, seria kliknięć
  = jeden zapis), plan dnia, przełącznik automatyki, dane głowicy, wilgotność wobec celu osuszacza z −/+, praca
  urządzeń w 24 h, energia osuszacza, włączanie wentylatora; bez pomocników −/+ zmienia nastawę termostatu
- **Ustawienia panelu na urządzeniu** — własny styl kart dla telefonu, tabletu czy komputera (pamięć przeglądarki),
  skrót do opcji integracji dla administratora
- **Opcje integracji w sekcjach** — Wygląd, Na zewnątrz, Dom, Pokoje (obszary i kolejność, prefiks pomocników
  ogrzewania, wentylatory, pominięte encje); podpowiedź czujników zewnętrznych przy dodawaniu integracji
- **Logo i ikona** w katalogu `brand/` integracji (HA pokazuje je bez wpisu w repozytorium brands)
- Jasny i ciemny motyw z motywu HA, układ na telefon, baner wersji w konsoli przeglądarki
- Testy (konfiguracja, opcje, rejestracja panelu), CI: typy i budowanie panelu, pytest, hassfest, HACS; wydania
  z opisem z CHANGELOG
