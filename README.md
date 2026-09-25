# kābalsosaeima.lv — Saeimas Balsojumu Radars

> **Objektīvi dati par katru balsojumu Saeimā · Atvērts & Neitrāls**

Neitrāls, atvērts un zemas uzturēšanas (zero-maintenance) pilsonisko tehnoloģiju rīks, kas pārvērš Latvijas Republikas Saeimas sēžu balsojumus un likumprojektus saprotamā, pārskatāmā formātā ikvienam vēlētājam.

---

## 🏛️ Funkcionalitāte

- **Likumprojektu lēmumu plūsma**: Pārskati pieņemtos un noraidītos likumus ar oficiālajiem numuriem (piem. `Nr. 482/Lp14`) un lasījumu stadijām.
- **Saeimas anotāciju kopsavilkumi**: Objektīvs, neitrāls likuma būtības skaidrojums, balstīts uz Saeimas oficiālajām juridiskajām anotācijām (bez LLM halucinācijām).
- **Proporcionālā balsojuma josla**: Skaidrs vizuāls sadalījums starp *Par* (zaļš), *Pret* (sarkans), *Atturas* (dzeltens) un *Nebalsoja* (pelēks).
- **Frakciju disciplīnas spektrs**: Tūlītējs pārskats par katras frakcijas (JV, ZZS, AS, NA, PRO, LPV, S!, Piefr.) vienotību un nostāju.
- **Interaktīvā 100 deputātu sēžu zāles karte (Hemicycle)**: Semicirkls ar visām 100 vietām Saeimas zālē, kur katra deputāta krēsls iekrāsojas atbilstoši balsojumam, ar peles uzvednes (hover) detaļām un frakciju filtriem.
- **Ātra meklēšana un filtrēšana**: Pēc likuma nosaukuma, kategorijām (Nodokļi, Drošība, Mājoklis, Enerģētika u.c.), kā arī gala lēmumu / procedūras nošķiršana.

---

## ⚡ Arhitektūra: Git-as-a-Database

Šī sistēma veidota tā, lai prasītu **0€ uzturēšanas izmaksu** un **0 ikmēneša uzturēšanas laika**:

1. **Nav ārējas datubāzes, kas iemigtu**: Dati glabājas strukturētos JSON failos repozitorijā (`public/data/votes.json`, `public/data/mps.json`, `public/data/factions.json`).
2. **Statiskā izvietošana (Static Hosting)**: Vite + React nokomplektējas uz tīru statisku HTML/JS/CSS mapi (`dist/`), ko bez maksas uztur GitHub Pages, Cloudflare Pages vai Vercel ar 99.99% pieejamību.
3. **Automātiska sinhronizācija ceturtdienās**: GitHub Actions darbplūsma (`.github/workflows/thursday_sync.yml`) katru ceturtdienas vakaru pēc Saeimas plenārsēdes pārbauda jaunus balsojumus, pārbauda datu integritāti un automātiski atjauno vietni.

---

## 🚀 Kā palaist lokāli

```bash
# 1. Doties uz projekta mapi
cd kabalsosaeima

# 2. Instalēt atkarības
npm install

# 3. Palaist lokālo izstrādes serveri
npm run dev
```

Vietne būs pieejama pārlūkā: `http://localhost:5173/`

### Datu pārbaudes / ielādes skripts

```bash
# Pārbaudīt 100 deputātu datu integritāti
py scripts/fetch_saeima_votes.py
```

### Statiskā būvēšana (Production build)

```bash
npm run build
```

---

## 📦 Izvietošana GitHub Pages

1. Izveidojiet jaunu publisku repozitoriju vietnē GitHub (piemēram, `kabalsosaeima`).
2. Piesaistiet lokālo mapi:
   ```bash
   git init
   git add .
   git commit -m "feat: initial kabalsosaeima.lv release"
   git branch -M main
   git remote add origin https://github.com/TAVS-LIETOTAJS/kabalsosaeima.git
   git push -u origin main
   ```
3. GitHub repozitorija iestatījumos (**Settings** -> **Pages**) sadaļā **Build and deployment** izvēlieties **Source: GitHub Actions**.
4. Turpmāk vietne būs pieejama tiešsaistē bez maksas un automātiski atjaunosies katru ceturtdienu.
