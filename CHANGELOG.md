# Changelog

Wszystkie istotne zmiany w tym projekcie są opisywane w tym pliku.

Format oparty na [Keep a Changelog](https://keepachangelog.com/pl/1.1.0/),
projekt stosuje [wersjonowanie semantyczne](https://semver.org/lang/pl/).

## [Unreleased]

### Dodano
- **PAYBACK: lista kuponów** — okno z aktywnymi kuponami konta (atrybut `kupony` encji `sensor.payback_<konto>_kupony`):
  logo, sklep, korzyść („7x więcej °P”), warunek, ważność (kończące się dziś/jutro wyróżnione), online / w sklepie;
  filtr Wszystkie / Online / W sklepie z licznikami i wyszukiwanie po sklepie; przy kuponach online przycisk
  „Do sklepu ↗” z linkiem takim jak przycisk „Użyj online” na payback.pl (z naliczaniem punktów), bez linku —
  odnośnik do strony PAYBACK; przy kuponach stacjonarnych „pokaż kartę przy kasie”

### Zmieniono
- **Dom: kafelek PAYBACK wygląda jak karta PAYBACK** — granatowo-niebieska karta z napisem PAYBACK i dużą liczbą
  punktów, przyciski „Kupony” (okno z listą) i „Aktywuj”; kliknięcie karty otwiera listę kuponów (bez encji listy —
  historię punktów); stan wymagający uwagi jako żółta plakietka i obwódka

## [0.9.0] - 2026-10-24

### Dodano
- **Dom: kafelek PAYBACK** obok skrzynki pocztowej i odpadów — dla każdego konta z encjami
  `sensor.payback_<konto>_stan` (automat aktywujący kupony payback.pl, encje z autodiscovery MQTT): punkty °P,
  liczba aktywnych kuponów i kuponów do aktywacji, kiedy automat ostatnio sprawdzał konto, przycisk „Aktywuj”
  (`button.payback_<konto>_aktywuj_kupony`). Stan wymagający uwagi (wygasła sesja, blokada strony, brak ciasteczek,
  błąd, nie wszystkie kupony) wyróżniony ramką i opisem; w trakcie aktywacji ikona pulsuje, a przycisk jest
  nieaktywny. Kliknięcie ikony otwiera historię punktów. Bez encji PAYBACK kafelka nie ma

## [0.8.0] - 2026-10-16

### Dodano
- **Klimat: konfiguracja pokoju w panelu** — w ustawieniach pokoju blok *Czujniki*: termometr pokoju do wyboru
  z listy (pogrupowanej według obszarów, z bieżącą temperaturą; „Pomiar głowicy” = bez czujnika) i informacja,
  skąd głowica naprawdę bierze temperaturę (czujnik / własny pomiar / czujnik przestał nadawać); okna i drzwi
  wyłączające grzanie ze stanem, do usunięcia (×) i dodania z listy. Zapis do pomocników
  `input_text.<prefiks>_<obszar>_czujnik` i `_okna`
- **Klimat: obecność pokoju** — blok *Obecność*: przełącznik „Uwzględniaj obecność”
  (`input_boolean.<prefiks>_<obszar>_obecnosc`), osoby do zaznaczenia (`input_text.<prefiks>_<obszar>_osoby`)
  z informacją, kto jest w domu, i opis, co teraz z tego wynika
- **Klimat: blokada rodzicielska głowicy** — przełącznik w bloku *Głowica* (encja `switch` / `lock` z „child_lock”
  na urządzeniu termostatu)
- **Klimat: godziny nocy i wieczoru do zmiany** w bloku *Plan dnia* (format 24 h, co 5 minut)

### Zmieniono
- Termometr i okna pokoju z pomocników (gdy są) zamiast wykrywania z obszaru — także czujniki spoza obszaru
- Opisy profili i „dlaczego taki cel” bez obecności, gdy obecność w pokoju jest wyłączona

## [0.7.1] - 2026-10-16

### Zmieniono
- **Klimat: pokoje alfabetycznie** — bez ręcznie wybranych obszarów (opcja *Pokoje (obszary)*) kafelki pokoi
  idą według nazwy obszaru, a nie kolejności dodania obszarów w HA; ręczny wybór nadal ustala kolejność

## [0.7.0] - 2026-10-15

### Dodano
- **AGD: pralki, suszarki i inny sprzęt z gniazdka** — nowa opcja *AGD → Pralki, suszarki i inne z gniazdka*
  (lista: nazwa, rodzaj, czujnik mocy, opcjonalnie energia, flaga „cykl w toku” i licznik energii na starcie
  cyklu); karta na maszynę: pracuje / wolna, w trakcie pracy czas od startu, pobór teraz i energia bieżącego
  cyklu, poza pracą godzina końca ostatniej pracy, pasek pracy z ostatnich 24 h z podziałką; czasy liczone
  z historii mocy, a nie z flagi cyklu (flaga dostaje nowy czas zmiany przy restarcie HA)

## [0.6.0] - 2026-10-15

### Dodano
- **AGD: frytkownica (Tuya Local)** — karta wykrywana po przełącznikach `…_power` i `…_cooking` oraz czujniku
  `…_time_remaining`: w trakcie pracy czas do końca i przybliżona godzina zakończenia, poza pracą stan
  (czuwanie, gotowe…), temperatura i czas gotowania z − / +, przyciski Start / Zatrzymaj i Włącz / Wyłącz
  (wyłączenie w trakcie pracy z potwierdzeniem), usterka
- Opcja **AGD → Pominięte urządzenia** obejmuje też urządzenia z Tuya Local

## [0.5.0] - 2026-10-14

### Dodano
- **Proxmox: realny RAM maszyn wirtualnych** — gdy istnieje czujnik `sensor.<maszyna>_ram_zajeta` (pamięć z wnętrza
  systemu, bez pamięci podręcznej), panel bierze go zamiast wartości z Proxmoxa, która dla VM oznacza pamięć
  przydzieloną procesowi QEMU (98–101% niezależnie od obciążenia); maszyny bez takiego odczytu mają przy „RAM”
  gwiazdkę i podpowiedź, kontenery LXC bez zmian (Proxmox liczy je dobrze)

### Zmieniono
- **Alerty: progi stopniowane na jednej encji** (np. dysk > 80% „uwaga” i > 90% „pilne”) pokazują tylko
  najpoważniejszy aktywny alert zamiast dwóch

## [0.4.0] - 2026-10-14

### Dodano
- **Zakładka AGD** (adres `/hearth/agd`) — karta na urządzenie, wykrywana po integracji, bez list encji:
  - **lodówka (Home Connect)**: temperatury chłodziarki i zamrażarki z − / + (nastawa urządzenia), stan drzwi
    od kiedy, aktywne alarmy (za ciepło w zamrażarce, drzwi otwarte za długo), tryby jako przełączniki (super
    chłodzenie i zamrażanie, eco, świeżość; urlopowy i szabatowy z potwierdzeniem), światło; zasilanie tylko
    do podglądu — lodówki nie da się stąd wyłączyć
  - **zmywarka (hOn)**: w trakcie pracy czas do końca, godzina zakończenia, program i bieżące zużycie wody
    i prądu; poza pracą ostatni program i opóźniony start; sól, nabłyszczacz, kod błędu, drzwi, licznik programów
  - **uzdatniacz wody (EcoWater)**: sól w % z paskiem, na ile dni i do kiedy, rodzaj soli; woda dziś i średnio
    na dzień, przepływ teraz, zapas miękkiej wody do regeneracji; ostatnia regeneracja, wyłączona regeneracja
    jako ostrzeżenie, usunięty kamień
  - pozostałe urządzenia tych integracji: prosta karta z odczytami
- **Opcja AGD → Pominięte urządzenia** — wybór całych urządzeń z Home Connect, hOn i EcoWater do ukrycia

## [0.3.0] - 2026-10-14

### Dodano
- **Automatyka urządzeń w szczegółach pokoju** (zakładka Klimat) — pomocniki `input_number` i `input_boolean`
  przypisane do obszaru pokoju (poza profilami ogrzewania) jako − / + i przełączniki, np. progi wentylatora
  łazienki (włącz / wyłącz przy wilgotności, różnica z zewnątrz, dopracowanie) i „wymuś pracę” osuszacza;
  nazwa pokoju w nawiasie na końcu nazwy pomocnika jest pomijana

## [0.2.0] - 2026-10-14

### Dodano
- **Kolor wiodący** — siedem gotowych kolorów (Żar, Niebieski, Morski, Zielony, Fioletowy, Malinowy, Grafitowy),
  kolor motywu HA albo własny `#rrggbb`; obejmuje przyciski, zaznaczenia, zakładki, przełączniki, wybór osoby
  i obwódki fokusu; kolory stanów (grzanie, otwarta brama, alarmy, serie wykresów) zostają bez zmian; tekst na
  kolorze wiodącym dobierany do jego jasności (biały albo ciemny)
- **Kolor domyślny w opcjach integracji** (Wygląd → Kolor wiodący, lista albo wpisany `#rrggbb`) i **własny wybór
  urządzenia** w Ustawieniach panelu („Jak w integracji”, gotowe kolory, próbnik) — jak przy stylu kart
- **Kolor wiodący także w Agencie** — panel przekazuje stronie w ramce `--accent`, `--accent-soft` i `--on-accent`
  razem z motywem; zmiana koloru albo motywu działa od razu, bez przeładowania rozmowy

## [0.1.0] - 2026-10-14

Pierwsze wydanie: integracja `hearth` z własnym panelem w menu bocznym HA, 14 zakładek.

### Dodano

#### Integracja i opcje
- **Integracja `hearth` z panelem w menu bocznym** — jeden wpis na instalację; panel rejestrowany przez `panel_custom`,
  pliki panelu serwowane z integracji (`/hearth_files`); w adresie pliku wersja i skrót zawartości, więc przeglądarka
  nie weźmie starej wersji z pamięci; po aktualizacji w otwartej karcie bez błędu podwójnej rejestracji `hearth-panel`
- **Opcje w zwijanych sekcjach** — Wygląd, Na zewnątrz, Pasek domu, Dom, Energia, Kocioł, Liczniki, Przełączniki,
  Kamery, Auta i roboty, Proxmox, Sieć, Alerty i Agent, Pokoje; puste pole albo lista = panel wykrywa sam; podpowiedź
  czujników zewnętrznych przy dodawaniu integracji
- **Wybór zakładek i ich kolejności** — kolejność wyboru w polu Zakładki = kolejność w panelu; pierwsza otwiera się
  domyślnie; każda zakładka pod własnym adresem (`/hearth/dom`, `/hearth/klimat`, `/hearth/zdrowie`…)
- **Dowolny czujnik w opcjach** — bez filtra klasy urządzenia, bo czujniki z MQTT (np. ebusd) często jej nie mają
- **Osoby zakładki Zdrowie jako podwpisy integracji** — „Dodaj osobę” / „Zmień dane osoby”, każda z własnymi encjami
  w 7 sekcjach (osoba, skład ciała, aktywność, ciśnienie, pomiary, wpis danych, cele i siatki)
- **Ustawienia panelu na urządzeniu** — własny styl kart pokoi dla telefonu, tabletu czy komputera, przełączniki
  frakcji odpadów, skrót do opcji integracji dla administratora
- **Logo i ikona** w katalogu `brand/` integracji (HA pokazuje je bez wpisu w repozytorium brands)
- Jasny i ciemny motyw z motywu HA, układ na telefon, baner wersji w konsoli przeglądarki

#### Dom
- **Domownicy** — zdjęcie, gdzie i od kiedy, odległość od domu, bateria telefonu z ładowaniem, kroki dziś (najpierw
  `sensor.kroki_<osoba>`); kliknięcie otwiera okno z mapą HA, miejscem, czasem, dokładnością GPS i linkiem do Map Google
- **Bramy i garaże** — Otwórz / Zamknij / Zatrzymaj, czas otwarcia; światło przy bramie, gdy obszar ma dokładnie jedną
  bramę i 1–2 światła
- **Skrzynka pocztowa** z baterią czujnika
- **Odpady** — z kalendarza Waste Collection Schedule albo czujników, kolory pojemników, najbliższe na górze; frakcja
  bez terminu ukryta; przełączniki frakcji (`input_boolean`) działają też w automatyzacjach
- **Pogoda** — prognoza ECMWF na 14 dni z Open-Meteo, radar opadów RainViewer i Windy dla lokalizacji domu

#### Klimat
- **Pokoje z obszarów HA** — pokój to obszar z termostatem; termometr, wilgotność, okna i drzwi (kontaktrony), zawór
  w %, bateria głowicy, osuszacze (moc i energia z gniazdka) i wentylatory dobierane same po obszarze i klasie
- **Trzy style kart** — Kafelki (łuk 16–28 °C, wykres 24 h, oś dnia), Lista (wiersz na pokój, skala z celem
  i pomiarem), Pokrętła (karta w kolorze temperatury, pierścień, − / + na karcie)
- **Na zewnątrz** — temperatura i wilgotność z wykresem, ciśnienie z trendem 3 h, światło i słońce, CAQI z poziomem,
  PM2,5 / PM10 według indeksu GIOŚ
- **Pasek domu** — kocioł, ile pokoi grzeje, okna, tryb domu, ciepła woda, wentylacja, osuszanie, taryfa
- **Ustawienia pokoju po kliknięciu** — dlaczego taki cel, profile −/+ (zapis do pomocników, seria kliknięć = jeden
  zapis), plan dnia, automatyka, dane głowicy, wilgotność wobec celu osuszacza, praca urządzeń w 24 h, energia
  osuszacza, wentylator; bez pomocników −/+ zmienia nastawę termostatu

#### Energia
- Moc całkowita z wykresem 24 h, fazy L1–L3 z kontrolą napięcia (207–253 V)
- Zużycie i koszt dziś i w miesiącu ze źródeł panelu Energia z podziałem na strefy taryfy; 30 dni i 12 miesięcy
  na słupkach (strefy warstwowo)
- Ranking odbiorników (moc teraz, kWh dziś) z panelu Energia albo z opcji; lista pomijanych odbiorników (np. zasilanych
  z UPS-a)

#### Kocioł
- **Prosto z ebusd** — stan z płomienia i zapotrzebowania na ciepłą wodę („Grzeje”, „Grzeje wodę”, „Czuwa”), moc
  palnika, wentylator, ciśnienie z oceną, krzywa; zasilanie, powrót, zewnątrz i ciepła woda z wykresem 24 h
  i podpowiedzią; albo gotowa encja stanu z integracji producenta
- **Termostaty ogrzewania i ciepłej wody** — tryby, presety, −/+; **Quick Veto przez ebusd** (QuickVetoTemp, potem
  SFMode), status „Veto do …” i Zakończ Veto
- **Harmonogramy sterownika (ebusd)** — tydzień ogrzewania, ciepłej wody i cyrkulacji z edycją dnia (do 3 przedziałów,
  temperatura) i zapisem dla dnia, dni roboczych, weekendu albo tygodnia, z odczytem kontrolnym
- **Gaz** — dziś, miesiąc, 30 dni, 12 miesięcy i lata (CO i CWU warstwowo); suwaki ustawień

#### Liczniki
- Dowolne encje pogrupowane według urządzeń; liczniki narastające z zużyciem dziś i w miesiącu ze statystyk, pomiary
  z wykresem 24 h, stany i daty po polsku; bez wyboru: woda i gaz z panelu Energia

#### Przełączniki, Sieć, Kamery, Auta, Roboty, Proxmox
- **Przełączniki** — światła, gniazdka i wentylatory według pokoi, czas włączenia, pobór mocy, wyszukiwarka;
  przełącznik zamieniony na światło (switch_as_x) pokazany raz
- **Sieć** — prędkość internetu z wykresem 24 h, łącza z dostępnością i przerwami, aktualizacje z instalacją, porty
  i PoE według urządzeń
- **Kamery** — podglądy co 5 s, kliknięcie = obraz na żywo, stan rejestratora (dostępność, wersja, kanały, magazyn)
- **Auta** — paliwo, zasięg, przebieg, akumulator, zamek, otwarte drzwi, wiek danych, mapa
- **Roboty** — kosiarki i odkurzacze po polsku: stan, bateria, duża mapa, Teraz / Statystyki, koszenie stref, Stop, moc
  ssania, materiały eksploatacyjne z resetem (z potwierdzeniem)
- **Proxmox** — węzeł, magazyny, maszyny i kontenery z paskami CPU / RAM / dysku, Uruchom / Restart / Wyłącz
  (z potwierdzeniem); dyski maszyn, których Proxmox nie zna, z własnych czujników

#### Zdrowie (przeniesiona karta zdrowia)
- **Przełącznik osób** ze zdjęciem i wagą; podstrona pokazuje się tylko, gdy osoba ma jej encje
- **Waga** — start, aktualnie, łączna zmiana i %, tempo na tydzień, do normy BMI 25 z prognozą, następny cel, spalony
  tłuszcz; bilans miesiąca i tygodnia, średnie z miesiąca; BMI na starcie i teraz na pasku kategorii; postęp celów
  z terminem, potrzebnym tempem i prognozą (osiągnięte zwinięte); bilanse miesięczne i tygodniowe, średnie miesięczne
  wagi i BMI; historia z trendem 7 dni i kreskami celów (od początku, 6 i 3 miesiące, 30, 14, 7 dni)
- **Skład ciała** — tkanka tłuszczowa z kategorią ACE, masy tłuszczu i beztłuszczowa, mięśnie szkieletowe, tkanka
  beztłuszczowa, kości, woda (także % masy ciała), przemiana podstawowa; wykres składu w czasie
- **Aktywność** — kroki i kalorie dziś z paskiem celu (bez wczorajszego wyniku po północy), średnia i maksimum,
  słupki 7 / 14 / 30 / 90 dni w kolorach realizacji celu
- **Ciśnienie** — alert z kategorii albo z wartości, bieżące wartości, czas ostatniego pomiaru, średnie i min/max
  z 30 dni liczone z pomiarów, historia 90 dni z kreskami 120/80, raport do druku / PDF (7–90 dni, kategorie ESH,
  pominięte pomiary)
- **Pomiary** — obwody ze zmianą od poprzedniej sesji mierzenia i od pierwszego pomiaru, sumy, profil na
  „pajęczynie”, bilans miesięczny, historia (kliknięcie kafelka = jeden obwód)
- **Siatki** — wiek, BMI i wzrost dziecka na tle siatek centylowych WHO 2007
- **Wprowadź dane** — obwody ciała do pomocników `input_number`; reszta danych przychodzi z telefonów i wagi (wzrost
  z telefonu w metrach przeliczany na centymetry)

#### Alerty i Agent
- **Alerty** — reguły w opcjach (`< 20`, `== open`, `!= on`…) z licznikiem na zakładce
- **Agent** — dowolna strona w ramce; panel przekazuje jej motyw (jasny / ciemny i kolory HA), więc strona, która go
  odbiera, wygląda jak reszta panelu

#### Wspólne
- **Wykresy słupkowe z osią i podpowiedzią** — podziałka, etykiety nad słupkami (gęste chowane na wąskim ekranie),
  data, suma i rozbicie po najechaniu albo dotknięciu
- **Wykresy liniowe z dowolną osią** — pasma, kreski progów z podpisami bez nachodzenia, podpowiedź
- **Sumy ze statystyk bez ujemnych skoków** — zerowanie licznika (dobowego albo kosztu przy zmianie taryfy) nie
  zaniża zużycia ani kosztu
- **Czytelne nazwy** — bez numerów seryjnych, PPE i identyfikatorów (słowa z 6+ cyframi) oraz prefiksów węzłów
  ESPHome; nazwa urządzenia nie powtarza się w nazwie encji
- Testy (konfiguracja, opcje, osoby, rejestracja panelu); CI: typy i budowanie panelu, pytest, hassfest, HACS;
  wydania z opisem z CHANGELOG

[Unreleased]: https://github.com/keysim86/ha-hearth/compare/v0.7.0...HEAD
[0.7.0]: https://github.com/keysim86/ha-hearth/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/keysim86/ha-hearth/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/keysim86/ha-hearth/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/keysim86/ha-hearth/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/keysim86/ha-hearth/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/keysim86/ha-hearth/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/keysim86/ha-hearth/releases/tag/v0.1.0
