# kābalsosaeima.lv — Saeimas Balsojumu Radars

> **Objektīvi dati par katru balsojumu Saeimā · Atvērts & Neitrāls**

Neitrāls, atvērts un zemas uzturēšanas pilsonisko tehnoloģiju rīks, kas pārvērš Latvijas Republikas Saeimas sēžu balsojumus, likumprojektu gaitu un deputātu mandātu vēsturi pārskatāmā, faktos balstītā formātā — **15. Saeimai (2026–2030)** un pilnam **14. Saeimas (2022–2026)** arhīvam.

---

## 🏛️ Funkcionalitāte

- **Sasaukumu pārslēgs (15. Saeima / 14. Saeima)**: Ērta pārslēgšanās starp aktuālo 15. Saeimu un pilnu 14. Saeimas balsojumu arhīvu.
- **Likumprojektu gaitas hronoloģija**: Pilns ceļš cauri 1., 2. un 3. lasījumam un priekšlikumu balsojumiem.
- **100% godīga frakciju un mandātu statistika**: Deputātu apmeklētība tiek rēķināta tikai par viņu aktīvā mandāta periodiem (no `saeima.lv`), un frakciju sadalījums atbilst faktiskajai piederībai balsojuma dienā (summa vienmēr ≤ 100 vietas).
- **Interaktīvā 100 deputātu sēžu zāles karte (Hemicycle)**: Piekļūstams SVG ar katra deputāta balsojumu un pilnu meklējamu tabulu.
- **Oficiālie datu avoti**: Tieša datu sasaiste ar `data.gov.lv` (`saeimas-sedes` XML: `-vote`, `-dkp`, `-deb`) un `saeima.lv` deputātu reģistru.

---

## ⚡ Arhitektūra: Go Static Site Generator + Git-as-a-Database

- **Go + Templ + Tailwind v4 SSG (`cmd/build`)**: Ģenerē ātru, statisku HTML/CSS/JS vietni mapē `dist/` bez ārējas datubāzes.
- **Daudz-sasaukumu datu kopas (`public/data/terms/{15,14}/`)**: Inkrementāla sinhronizācija ar `sync_state.json`, XML balsu skaita krustpārbaude (`<VOTERESULT_*>`) un automātiskas integritātes + aktualitātes pārbaudes.
- **Automātiskā sinhronizācija (`.github/workflows/thursday_sync.yml`)**: Katru ceturtdienas vakaru sinhronizē aktuālos 15. Saeimas mandātus un balsojumus, veic validāciju un publicē GitHub Pages.

---

## 🚀 Kā palaist lokāli

```bash
# 1. Sinhronizēt oficiālos mandātus un balsojumus (15. Saeima vai --all abiem sasaukumiem)
python3 scripts/scrape_mandates.py --term 15
python3 scripts/ingest_real_saeima.py --term 15

# 2. Pārbaudīt datu integritāti un aktualitāti
python3 scripts/sentinel_check.py --mode integrity
go run ./cmd/build --validate-only

# 3. Ģenerēt Templ komponentus, pārbaudīt testus un uzbūvēt statisko vietni
go generate ./...
go vet ./...
go test -v ./...
go run ./cmd/build

# 4. Palaist lokālo serveri
go run ./cmd/serve
```
