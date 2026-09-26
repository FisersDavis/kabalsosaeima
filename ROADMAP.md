# kābalsosaeima.lv — Nākotnes Funkciju un Uzlabojumu Ceļvedis (Roadmap)

Šajā dokumentā apkopoti plānotie un potenciālie uzlabojumi vietnei **kabalsosaeima.lv**, kas izstrādāti, lai padarītu Saeimas balsojumu datus vēl pieejamākus, saprotamākus un noderīgākus sabiedrībai, medijiem un pētniekiem.

---

## 🏛️ 1. Deputāta profils & Personīgā statistika (*MP Profile View*)
Katram no 100 deputātiem pieejama detalizēta individuālā lapa / modālais logs:
- **Apmeklējuma un aktivitātes rādītājs**: Cik % sēžu un balsojumu deputāts ir piedalījies (*Par, Pret, Atturas*) vs *Nebalsoja / Nav reģistrēts*.
- **Frakcijas lojalitātes indekss**: Cik % gadījumu deputāts balsojis saskaņā ar savas frakcijas vairākumu vs balsojis pretēji partijas disciplīnai (*rebel votes*).
- **Zīmīgākie balsojumi**: Saraksts ar svarīgākajiem 1. līmeņa (*Tier 1*) balsojumiem, kuros deputāta balss izšķīra rezultātu vai novirzījās no koalīcijas/opozīcijas līnijas.
- **Mīkstā mandāta vēsture**: Skaidra norāde par mandāta statusu (piem., *"Aizvieto ministri Eviku Siliņu no 15.09.2023"*).

---

## 📊 2. Frakciju salīdzinājums & Disciplīnas radars (*Faction Cohesion*)
Salīdzinošs analītisks rīks par parlamenta politiskajiem spēkiem:
- **Frakciju vienotības rādītājs (*Party Whip Discipline*)**: Kuras frakcijas balso kā monolīts bloks un kurās visbiežāk vērojams deputātu brīvais balsojums.
- **Koalīcijas vs Opozīcijas balsojumu korelācija**: Cik bieži koalīcijas frakcijas (JV, ZZS, PRO) balso vienoti, un kādos tematos opozīcijas frakcijas (AS, NA, LPV, S!) tām pievienojas.
- **Balsojumu dinamika pa nozarēm**: Kā frakcijas balso specifiskās jomās (drošība, nodokļi, sociālie jautājumi).

---

## 🔗 3. URL Maršrutēšana & Dziļās saites (*Deep Linking*)
- **Tiešās saites uz balsojumiem un deputātiem**: Iespēja dalīties ar konkrētu balsojumu (`/#balsojums-482`) vai deputāta kartīti (`/#deputats-janis-rozenbergs`), atverot to tieši.
- **Filtru saglabāšana URL parametros**: Piemēram, `/?kategorija=nodokli&rezultats=PIENEMTS`, ļaujot žurnālistiem un sociālo tīklu lietotājiem dalīties ar filtrētiem meklēšanas rezultātiem.

---

## 📰 4. Pilsoniskie iegulšanas logrīki & Datu eksports (*Embed Widgets & CSV*)
- **Iegulšanas kods medijiem (*Embed Widget*)**: Žurnālistiem un emuāru autoriem iespēja ar vienu klikšķi iegūt `<iframe>` vai tīru komponenti, lai ievietotu konkrēta likuma balsojuma vizualizāciju vai sēžu zāles karti savā rakstā.
- **Atvērto datu CSV/JSON eksports**: Pētniekiem un sabiedriskajām organizācijām iespēja lejupielādēt filtrētos datus analīzei Excel vai Python vidē.

---

## 🗳️ 5. Vēlētāja salīdzināšanas rīks ("Mans deputāts")
- **Interaktīvs 5-10 svarīgāko balsojumu tests**: Lietotājs izvēlas savu nostāju (Par / Pret) galvenajos sabiedrības lēmumos (piem., Stambulas konvencija, Partnerības regulējums, Aizsardzības dienests).
- **Saderības aprēķins**: Algoritms aprēķina, kura frakcija un kuri 5 deputāti visprecīzāk atbilst vēlētāja personīgajām vērtībām.

---

## 🛡️ 6. Zero-Maintenance Automātiskā pašpārbaude & Brīdinājumu sistēma
- Skatīt aktīvo izstrādes posmu attiecībā uz automātisko integritātes pārbaudi un paziņojumiem.
