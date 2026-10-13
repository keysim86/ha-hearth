# Changelog

Wszystkie istotne zmiany w tym projekcie są opisywane w tym pliku.

Format oparty na [Keep a Changelog](https://keepachangelog.com/pl/1.1.0/),
projekt stosuje [wersjonowanie semantyczne](https://semver.org/lang/pl/).

## [Unreleased]

### Added
- **Zakładki Dom, Energia, Kocioł i Liczniki** obok Klimatu — przełączane w nagłówku, każda pod własnym adresem
  (`/hearth/dom`, `/hearth/energia`…); w opcjach wybór, które pokazać
- **Dom** — domownicy (zdjęcie, gdzie i od kiedy, odległość od domu, bateria telefonu z ładowaniem, kroki dziś), bramy
  i garaże z przyciskiem Otwórz / Zamknij / Zatrzymaj i czasem otwarcia, skrzynka pocztowa, odpady z kolorami
  pojemników (najbliższe na górze), prognoza ECMWF na 14 dni z Open-Meteo dla lokalizacji domu
- **Energia** — moc całkowita z wykresem 24 h, fazy L1–L3 z kontrolą napięcia (207–253 V), zużycie i koszt dziś
  i w miesiącu ze źródeł panelu Energia z podziałem na strefy taryfy, 30 dni i 12 miesięcy na słupkach, ranking
  odbiorników (moc teraz i kWh dziś; moc z urządzenia z panelu Energia)
- **Kocioł** — stan z płomienia, zapłonu, pompy i zapotrzebowania na CWU, moc palnika, wentylator, ciśnienie
  z oceną, krzywa; zasilanie, powrót, zewnątrz i ciepła woda z wykresem 24 h; termostaty ogrzewania i ciepłej wody
  (tryby, presety, −/+); gaz dziś, w miesiącu, 30 dni i 12 miesięcy (CO i CWU warstwowo); suwaki ustawień
- **Liczniki** — dowolne encje pogrupowane według urządzeń; liczniki narastające z zużyciem dziś i w miesiącu ze
  statystyk, pomiary z wykresem 24 h, stany i daty po polsku
- **Czytelne nazwy** — bez numerów seryjnych, PPE i identyfikatorów (słowa z 6+ cyframi) oraz prefiksów węzłów
  ESPHome; nazwa urządzenia nie powtarza się w nazwie encji
- **Integracja `hearth` z panelem w menu bocznym** — jeden wpis na instalację; panel rejestrowany przez `panel_custom`,
  pliki panelu serwowane z integracji (`/hearth_files`), wersja w adresie wymusza świeży plik po aktualizacji
- **Pokoje z obszarów HA** — pokój to obszar z termostatem; termometr, wilgotność, okna i drzwi (tylko kontaktrony),
  zawór w %, bateria głowicy, osuszacze (z mocą i energią z gniazdka) i wentylatory dobierane same po obszarze i klasie
- **Zakładka Klimat w trzech stylach** — Kafelki (łuk 16–28 °C, wykres 24 h, oś dnia), Lista (wiersz na pokój, skala
  z celem i pomiarem) i Pokrętła (karta w kolorze temperatury, pierścień, − / + na karcie)
- **Na zewnątrz** — temperatura i wilgotność z wykresem, ciśnienie z trendem 3 h, światło i słońce, CAQI z poziomem
  oraz PM2,5 / PM10 według indeksu GIOŚ
- **Pasek domu** — kocioł, ile pokoi grzeje, okna, tryb domu, ciepła woda, wentylacja i osuszanie z taryfą
- **Sumy ze statystyk bez ujemnych skoków** — zerowanie licznika (dobowego albo kosztu przy zmianie taryfy) nie
  zaniża zużycia ani kosztu
- **Kocioł prosto z ebusd** — stan wyliczany z płomienia i zapotrzebowania na ciepłą wodę („Grzeje”, „Grzeje wodę”,
  „Czuwa”) z mocą palnika w %; zasilanie, powrót, ciśnienie, temperatura i cel ciepłej wody; dalej można podać gotową
  encję stanu z integracji producenta
- **Ustawienia pokoju po kliknięciu** — dlaczego taki cel, temperatury profili −/+ (zapis do pomocników, seria kliknięć
  = jeden zapis), plan dnia, przełącznik automatyki, dane głowicy, wilgotność wobec celu osuszacza z −/+, praca
  urządzeń w 24 h, energia osuszacza, włączanie wentylatora; bez pomocników −/+ zmienia nastawę termostatu
- **Ustawienia panelu na urządzeniu** — własny styl kart dla telefonu, tabletu czy komputera (pamięć przeglądarki),
  skrót do opcji integracji dla administratora
- **Wybór dowolnego czujnika w opcjach** — bez filtra klasy urządzenia, bo czujniki z MQTT (np. ebusd) często jej
  nie mają; klasy używa tylko podpowiedź przy dodawaniu integracji
- **Świeży plik panelu po aktualizacji** — w adresie pliku jest skrót jego zawartości, więc przeglądarka nie weźmie
  starej wersji z pamięci
- **Opcje integracji w sekcjach** — Wygląd, Na zewnątrz, Dom, Pokoje (obszary i kolejność, prefiks pomocników
  ogrzewania, wentylatory, pominięte encje); podpowiedź czujników zewnętrznych przy dodawaniu integracji
- **Logo i ikona** w katalogu `brand/` integracji (HA pokazuje je bez wpisu w repozytorium brands)
- **Bez błędu po aktualizacji w otwartej karcie** — panel nie rejestruje drugi raz elementu `hearth-panel`; nowa
  wersja działa po odświeżeniu strony
- Jasny i ciemny motyw z motywu HA, układ na telefon, baner wersji w konsoli przeglądarki
- Testy (konfiguracja, opcje, rejestracja panelu), CI: typy i budowanie panelu, pytest, hassfest, HACS; wydania
  z opisem z CHANGELOG
