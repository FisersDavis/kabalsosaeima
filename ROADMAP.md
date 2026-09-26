# kābalsosaeima.lv — Nākotnes Funkciju un Uzlabojumu Ceļvedis (Roadmap)

> **Projekta pamatprincips:** *"Objektīvi dati par katru balsojumu Saeimā · Atvērtā parlamenta reģistrs"*  
> Mēs nepievienojam viedokļus, vērtējumus vai politiskus epitetus — mēs parādām precīzus, matemātiski un konstitucionāli pamatotus datus no Saeimas oficiālajiem protokoliem.

---

## 🏛️ Informācijas arhitektūra (Hibrīda modelis)
Lietotāja saskarne tiek organizēta trīs skaidrās galvenajās sadaļās:
1. **[Balsojumi]** — Galvenā likumprojektu plūsma, meklēšana, filtri un 100 deputātu sēžu zāles interaktīvā karte (*Hemicycle*).
2. **[Partijas & Deputāti]** — Frakciju profili, deputātu kartotēka un partiju balsojumu korelācijas matrica.
3. **[Tematiskais radars]** — Sabiedriski nozīmīgāko lēmumu kartotēka pa jomām (*Landmark Decision Dossiers*).

Papildus jebkurš deputāts, frakcija vai tēmas birka ir klikšķināma tieši no balsojumu kartītēm un sēžu zāles punktiem, atverot profilu ar tiešo URL saiti.

---

## 👤 B. Deputāta & Frakcijas profils (*The Party & MP Profile*)

### 1. Frakcijas vienotības rādītājs (*Cohesion Score*)
- **Aprēķina metodoloģija:** Salīdzina tikai tos balsojumus, kuros deputāts ir **aktīvi piedalījies** (*Par* vs *Pret / Atturas*).
- Deputāts tiek uzskatīts par balsojušu pretēji frakcijai tikai tad, ja viņa izvēle ir pretrunā ar frakcijas absolūtā vairākuma nostāju (saskaņā ar Satversmes 24. panta materiālo iznākumu).
- Prombūtne vai kvoruma ieturēšana netiek mākslīgi pieskaitīta pie "partijas nodevības", bet tiek uzskaitīta atsevišķā klātbūtnes rādītājā.
- Neatkarīgajiem deputātiem (*PIEFR / IND*) frakcijas disciplīnas rādītājs netiek piemērots.

### 2. Apmeklējums un kvoruma taktikas (*Attendance & Quorum Tactics*)
Izglīto vēlētāju par parlamentārajām procedūrām, atmaskojot mītu, ka *"Nebalsoja"* vienmēr nozīmē slinkošanu:
- **3 daļu vizuālā josla katram deputātam:**
  1. **Aktīvi balsoja (zaļš, %)** — Balsojis *Par*, *Pret* vai *Atturas*.
  2. **Zālē, bet nebalsoja (dzeltens/pelēks, %)** — Reģistrēts sēžu zālē, bet apzināti atturējies spiest pogu kvoruma bloķēšanas nolūkā (*Satversmes 24. pants*).
  3. **Nav reģistrēts (gaišpelēks, %)** — Attaisnota vai neattaisnota prombūtne sēdē (komandējums, slimība, atvaļinājums).
- Katram deputātam pieejams saraksts ar konkrētajiem balsojumiem, kuros izmantots kvoruma manevrs.

### 3. Frakciju korelācijas matrica (*Faction Alignment Heatmap Grid*)
- $8 \times 8$ simetrisks siltumkartes režģis, kas parāda, cik % balsojumu jebkuras divas frakcijas (piemēram, `JV` un `NA`, vai `PRO` un `ZZS`) balsojušas vienādi.
- **Filtri pa nozarēm:** Lietotājs var redzēt korelāciju kopumā vs tikai aizsardzībā vs tikai nodokļu un budžeta jautājumos.
- Klikšķis uz šūnas atver konkrēto balsojumu sarakstu, kuros frakcijas bija vienotas vai šķēlās.

### 4. Deputāta profila 4 karšu struktūra
1. **Identitāte & Mandāts:** Vārds, frakcija, apgabals, komisijas, oficiālais e-pasts, kā arī "mīkstā mandāta" statuss (piemēram, *"Aizvieto ministri Eviku Siliņu no 15.09.2023"*).
2. **Klātbūtnes un kvoruma josla:** 3 segmentu aktivitātes pārskats.
3. **Frakcijas disciplīna & Novirzes:** Vienotības % un tiešais saraksts ar visiem gadījumiem, kad balsots pretēji partijas vairākumam.
4. **Balsojumu vēsture:** Pilns hronoloģisks balsojumu arhīvs ar meklētāju un rezultātu birkām.

---

## 🎯 C. Tematiskais balsojumu radars (*The Issue Tracker*)

### 1. Zīmīgāko lēmumu kartotēkas (*Landmark Decision Dossiers*)
Tā vietā, lai piešķirtu subjektīvus partiju "zaļuma" vai "uzņēmējdraudzīguma" reitingus, sistēma apkopo **10–15 nozīmīgākos likumus katrā nozarē**:
- **Cilvēktiesības & Sabiedrība:** Partnerības regulējums, Stambulas konvencija, Valsts valodas prasības u.c.
- **Valsts drošība & Aizsardzība:** Valsts aizsardzības dienests, Krievijas/Baltkrievijas lauksaimniecības preču embargo, robežas izbūve u.c.
- **Nodokļi & Finanses:** Valsts budžeti, Mikrouzņēmumu nodokļa izmaiņas, Banku solidaritātes iemaksa u.c.
- **Ekonomika & Enerģētika:** Atjaunīgā enerģija, mežu apsaimniekošana, dzelzceļa infrastruktūra u.c.
- **Tiesiskums:** Krimināllikuma sodu bardzība, vēlēšanu likuma izmaiņas, KNAB pilnvaras.

### 2. Skaidra partiju nostāju salīdzināšanas tabula
Katrai nozīmīgajai tēmai tiek renderēta pārskatāma matrica:
| Likumprojekts | Datums | JV | ZZS | PRO | AS | NA | LPV | S! | Iznākums |
|---|---|---|---|---|---|---|---|---|---|
| Valsts aizsardzības dienests | 05.04.2023 | **PAR** | **PAR** | **PAR** | **PAR** | **PAR** | PRET | PRET | **Pieņemts** |
| Partnerības regulējums | 09.11.2023 | **PAR** | **PAR** | **PAR** | PRET | PRET | PRET | NEBALSO | **Pieņemts** |

### 3. Argumentācija bez subjektīvisma: Stenogrammu tiešie citāti
Katram kartotēkas likumam tiek pievienots objektīvs debašu kopsavilkums:
- **Likumprojekta anotācijas būtība:** Oficiālais juridiskais mērķis no Saeimas Juridiskā biroja.
- **Atbildīgā ziņotāja / virzītāja tēze:** 1–2 teikumu tiešs citāts no Saeimas plenārsēdes oficiālās stenogrammas (ar runātāja vārdu, frakciju un laika zīmogu).
- **Vadošā opozīcijas runātāja tēze:** 1–2 teikumu tiešs citāts no tribīnes pret šo likumu (ar runātāja vārdu, frakciju un laika zīmogu).

---

## 🚀 Nākamie soļi
Kad lietotājs vēlēsies uzsākt šo posmu realizāciju, darbs tiks sadalīts 2 izolētos etapos:
- **1. solis:** `[Partijas & Deputāti]` skats + 4 karšu Deputāta profils un frakciju korelācijas matrica.
- **2. solis:** `[Tematiskais radars]` skats + Zīmīgāko lēmumu kartotēka ar oficiālajiem stenogrammu citātiem.
