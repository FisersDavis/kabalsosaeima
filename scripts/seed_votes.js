import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mpsPath = path.join(__dirname, '../public/data/mps.json');
const factionsPath = path.join(__dirname, '../public/data/factions.json');
const outputPath = path.join(__dirname, '../public/data/votes.json');

const mps = JSON.parse(fs.readFileSync(mpsPath, 'utf8'));
const factions = JSON.parse(fs.readFileSync(factionsPath, 'utf8'));

const factionCoalitionMap = {};
factions.forEach(f => {
  factionCoalitionMap[f.id] = f.isCoalition;
});

// Helper to assign decisions by faction rules
function generateVote({
  id,
  saeimaTerm,
  sessionId = "14-sede-24",
  sessionDate,
  sittingDate,
  sittingTime,
  sittingType,
  reading,
  isUrgent = false,
  isTier1 = true,
  isSecret = false,
  isRevote = false,
  revoteReason = null,
  protocolUrl = "https://www.saeima.lv/lv/likumdosana/balsojumi",
  officialTitle,
  billNumber,
  simplifiedTitle,
  summary,
  debateArguments = null,
  category,
  factionRules
}) {
  const mpVotes = [];
  const factionMap = {};

  factions.forEach(f => {
    factionMap[f.id] = {
      factionId: f.id,
      name: f.name,
      shortName: f.shortName,
      color: f.color,
      isCoalition: f.isCoalition,
      votes: { par: 0, pret: 0, atturas: 0, nebalso: 0 },
      deviatingMps: []
    };
  });

  let parCount = 0;
  let pretCount = 0;
  let atturasCount = 0;
  let nebalsoCount = 0;

  const coalitionSplit = {
    coalition: { par: 0, pret: 0, atturas: 0, nebalso: 0, total: 52 },
    opposition: { par: 0, pret: 0, atturas: 0, nebalso: 0, total: 48 },
  };

  if (isSecret) {
    parCount = 62;
    pretCount = 28;
    atturasCount = 4;
    nebalsoCount = 6;
  } else {
    const mpsByFaction = {};
    mps.forEach(mp => {
      if (!mpsByFaction[mp.factionId]) mpsByFaction[mp.factionId] = [];
      mpsByFaction[mp.factionId].push(mp);
    });

    for (const [fId, fMps] of Object.entries(mpsByFaction)) {
      const rule = factionRules[fId] || { par: 0, pret: 0, atturas: 0, nebalso: fMps.length };
      const isCoal = factionCoalitionMap[fId] ?? false;
      const targetBloc = isCoal ? coalitionSplit.coalition : coalitionSplit.opposition;

      const decisions = [];
      for (let i = 0; i < (rule.par || 0); i++) decisions.push('PAR');
      for (let i = 0; i < (rule.pret || 0); i++) decisions.push('PRET');
      for (let i = 0; i < (rule.atturas || 0); i++) decisions.push('ATTURAS');
      for (let i = 0; i < (rule.nebalso || 0); i++) decisions.push('NEBALSO');
      
      while (decisions.length < fMps.length) {
        decisions.push('NEBALSO');
      }

      // Determine faction line (>60% majority)
      let factionLine = null;
      if ((rule.par || 0) > fMps.length * 0.6) factionLine = 'PAR';
      else if ((rule.pret || 0) > fMps.length * 0.6) factionLine = 'PRET';

      fMps.forEach((mp, idx) => {
        const decision = decisions[idx] || 'NEBALSO';
        mpVotes.push({
          mpId: mp.id,
          name: mp.name,
          factionId: mp.factionId,
          decision,
          isSubstitute: mp.isSubstitute,
          replacesMpName: mp.replacesMpName
        });

        if (decision === 'PAR') {
          factionMap[fId].votes.par++;
          targetBloc.par++;
          parCount++;
        } else if (decision === 'PRET') {
          factionMap[fId].votes.pret++;
          targetBloc.pret++;
          pretCount++;
        } else if (decision === 'ATTURAS') {
          factionMap[fId].votes.atturas++;
          targetBloc.atturas++;
          atturasCount++;
        } else {
          factionMap[fId].votes.nebalso++;
          targetBloc.nebalso++;
          nebalsoCount++;
        }

        // Detect MP deviation from faction line (e.g. faction voted PAR, MP voted PRET)
        if (factionLine && (decision === 'PAR' || decision === 'PRET') && decision !== factionLine) {
          factionMap[fId].deviatingMps.push({
            mpId: mp.id,
            name: mp.name,
            decision,
            factionLine
          });
        }
      });
    }
  }

  const totalPresent = parCount + pretCount + atturasCount;
  
  let result;
  if (totalPresent < 50) {
    result = 'NAV_KVORUMA';
  } else if (parCount > (pretCount + atturasCount)) {
    result = 'PIENEMTS';
  } else {
    result = 'NORAIDITS';
  }

  return {
    id,
    saeimaTerm,
    sessionId,
    sessionDate: sessionDate || sittingDate,
    sittingDate,
    sittingTime,
    sittingType,
    reading,
    isUrgent,
    isTier1,
    isSecret,
    isRevote,
    revoteReason,
    protocolUrl,
    officialTitle,
    billNumber,
    simplifiedTitle,
    summary,
    debateArguments,
    category,
    result,
    counts: {
      par: parCount,
      pret: pretCount,
      atturas: atturasCount,
      nebalso: nebalsoCount,
      totalPresent
    },
    coalitionSplit: isSecret ? undefined : coalitionSplit,
    factionBreakdown: isSecret ? [] : Object.values(factionMap),
    mpVotes
  };
}

const votes = [
  generateVote({
    id: "14-2026-09-24-v1",
    saeimaTerm: 14,
    sessionId: "14-sede-24",
    sittingDate: "2026-09-24",
    sittingTime: "11:42",
    sittingType: "Kārtējā",
    reading: 3,
    isUrgent: false,
    isTier1: true,
    protocolUrl: "https://www.saeima.lv/lv/likumdosana/balsojumi",
    officialTitle: "Grozījumi Pievienotās vērtības nodokļa likumā (Nr. 482/Lp14), 3. lasījums",
    billNumber: "Nr. 482/Lp14",
    simplifiedTitle: "PVN reģistrācijas sliekšņa celšana līdz 50 000 EUR un 12% likme augļiem",
    summary: "Likums nosaka PVN reģistrācijas sliekšņa paaugstināšanu mazajiem uzņēmējiem no 40 000 līdz 50 000 eiro gadā, kā arī pagarina samazināto PVN likmi Latvijai raksturīgiem augļiem, ogām un dārzeņiem.",
    debateArguments: {
      rapporteur: "Budžeta un finanšu (nodokļu) komisija",
      proponents: "Samazinātais PVN atbalsta vietējos lauksaimniekus un samazina ēnu ekonomiku augļu un dārzeņu tirdzniecībā, vienlaikus atslogojot mazos uzņēmējus no liekas grāmatvedības.",
      opponents: "Opozīcijas pārstāvji uzsvēra, ka inflācijas apstākļos likme bija jāsamazina līdz 5% un jāattiecina uz visiem pārtikas pamatproduktiem (maizei, pienam, gaļai), lai reāli palīdzētu iedzīvotājiem."
    },
    category: { id: "taxes", label: "Nodokļi & Finanses" },
    factionRules: {
      jv: { par: 25, nebalso: 1 },
      zzs: { par: 16 },
      pro: { par: 10 },
      as: { pret: 13, par: 1, nebalso: 1 }, // 1 deviation!
      na: { pret: 10, atturas: 2 },
      lpv: { pret: 9 },
      st: { nebalso: 8 },
      ind: { par: 2, pret: 2 }
    }
  }),
  generateVote({
    id: "14-2026-09-24-v2",
    saeimaTerm: 14,
    sessionId: "14-sede-24",
    sittingDate: "2026-09-24",
    sittingTime: "12:15",
    sittingType: "Kārtējā",
    reading: 2,
    isUrgent: true,
    isTier1: true,
    protocolUrl: "https://www.saeima.lv/lv/likumdosana/balsojumi",
    officialTitle: "Grozījumi Valsts aizsardzības finansēšanas likumā (Nr. 512/Lp14), 2. lasījums (Steidzams)",
    billNumber: "Nr. 512/Lp14",
    simplifiedTitle: "Valsts aizsardzības finansējuma palielināšana līdz 3.5% no IKP (Steidzamības kārtā pieņemts galīgajā lasījumā)",
    summary: "Nostiprina valsts budžeta saistības palielināt militāro un iekšējās drošības finansējumu līdz 3.5% no IKP līdz 2028. gadam. Tā kā likums atzīts par steidzamu, 2. lasījums ir tā galīgā pieņemšana.",
    debateArguments: {
      rapporteur: "Aizsardzības, iekšlietu un korupcijas novēršanas komisija",
      proponents: "Finansējuma kāpums līdz 3.5% IKP ir vitāli svarīgs NBS pretgaisa aizsardzības sistēmu iegādei un Sēlijas poligona infrastruktūras pabeigšanai NATO spēku uzņemšanai.",
      opponents: "Daļa opozīcijas pauda bažas par straujā pieauguma ietekmi uz valsts parāda apkalpošanas izmaksām un pieprasīja skaidrāku auditu par jau piešķirto līdzekļu izlietojumu."
    },
    category: { id: "defense", label: "Aizsardzība & Drošība" },
    factionRules: {
      jv: { par: 26 },
      zzs: { par: 16 },
      pro: { par: 10 },
      as: { par: 15 },
      na: { par: 12 },
      lpv: { atturas: 7, nebalso: 2 },
      st: { pret: 6, nebalso: 2 },
      ind: { par: 4 }
    }
  }),
  generateVote({
    id: "14-2026-09-24-v3",
    saeimaTerm: 14,
    sessionId: "14-sede-24",
    sittingDate: "2026-09-24",
    sittingTime: "13:05",
    sittingType: "Kārtējā",
    reading: 1,
    isUrgent: false,
    isTier1: false,
    protocolUrl: "https://www.saeima.lv/lv/likumdosana/balsojumi",
    officialTitle: "Likumprojekts 'Par nekustamā īpašuma nodokļa pārdali pašvaldībām' (Nr. 556/Lp14)",
    billNumber: "Nr. 556/Lp14",
    simplifiedTitle: "Nekustamā īpašuma nodokļa pārdale — Kvoruma noraušana ar Nebalso taktiku",
    summary: "Opozīcijas frakcijas izmantoja Satversmes 24. pantā paredzēto kvoruma taktiku: zālē bija reģistrēti 85 deputāti, taču 53 deputāti apzināti nepiespieda nevienu pogu (Nebalsoja). Piedaloties tikai 47 deputātiem, balsojums atzīts par nenotikušu kvoruma trūkuma dēļ.",
    debateArguments: {
      rapporteur: "Valsts pārvaldes un pašvaldības komisija",
      proponents: "Likumprojekts paredzēja taisnīgāku nodokļu ieņēmumu proporciju Pierīgas un reģionu pašvaldībām skolu tīkla uzturēšanai.",
      opponents: "Opozīcija atteicās piedalīties balsojumā un norāva kvorumu, norādot, ka likumprojekts tika sasteigts bez Pašvaldību savienības saskaņojuma."
    },
    category: { id: "housing", label: "Mājoklis & Labklājība" },
    factionRules: {
      jv: { par: 25, nebalso: 1 },
      zzs: { par: 16 },
      pro: { par: 6, nebalso: 4 },
      as: { nebalso: 15 },
      na: { nebalso: 12 },
      lpv: { nebalso: 9 },
      st: { nebalso: 8 },
      ind: { nebalso: 4 }
    }
  }),
  generateVote({
    id: "14-2026-09-17-v3",
    saeimaTerm: 14,
    sessionId: "14-sede-23",
    sittingDate: "2026-09-17",
    sittingTime: "11:00",
    sittingType: "Kārtējā",
    reading: null,
    isUrgent: false,
    isTier1: true,
    isSecret: true,
    protocolUrl: "https://www.saeima.lv/lv/likumdosana/balsojumi",
    officialTitle: "Satversmes tiesas tiesneša apstiprināšana amatā (Aizklāts balsojums)",
    billNumber: "Lēmums Nr. 129/Lp14",
    simplifiedTitle: "Satversmes tiesas tiesneša apstiprināšana amatā uz 10 gadiem",
    summary: "Saskaņā ar Satversmi un Tiesu varas likumu tiesnešu apstiprināšana amatā notiek ar aizklātu vēlēšanu zīmju balsojumu. Individuālie deputātu balsojumi nav publiski fiksēti.",
    category: { id: "justice", label: "Tiesiskums & Valsts" },
    factionRules: {}
  }),
  generateVote({
    id: "14-2026-09-17-v4",
    saeimaTerm: 14,
    sessionId: "14-sede-23",
    sittingDate: "2026-09-17",
    sittingTime: "14:22",
    sittingType: "Kārtējā",
    reading: 3,
    isUrgent: false,
    isTier1: true,
    isRevote: true,
    revoteReason: "Deputāta balsošanas pults tehniskas kļūmes dēļ atkārtots 2 minūtes pēc iepriekšējā balsojuma",
    protocolUrl: "https://www.saeima.lv/lv/likumdosana/balsojumi",
    officialTitle: "Grozījumi Meža likumā un Enerģētikas likumā (Nr. 389/Lp14), 3. lasījums (Pārbalsojums)",
    billNumber: "Nr. 389/Lp14",
    simplifiedTitle: "Atjaunīgās enerģijas un vēja parku attīstības paātrināšana meža zemēs (Atkārtots)",
    summary: "Pēc frakcijas pieprasījuma tika veikts atkārtots balsojums, kurā tika apstiprināti atvieglojumi vēja parku attīstībai Latvijas valsts mežos.",
    debateArguments: {
      rapporteur: "Tautsaimniecības, agrārās, vides un reģionālās politikas komisija",
      proponents: "Enerģētiskā neatkarība un vietējās zaļās enerģijas ražošanas jaudu dubultošana prasa noņemt nesamērīgus birokrātiskos šķēršļus vēja stacijām.",
      opponents: "Opozīcijas deputāti argumentēja par mežu ekosistēmu aizsardzību un aicināja noteikt stingrākus attāluma ierobežojumus no apdzīvotām viensētām."
    },
    category: { id: "energy", label: "Vide & Enerģētika" },
    factionRules: {
      jv: { par: 26 },
      zzs: { par: 16 },
      pro: { par: 10 },
      as: { par: 11, pret: 4 },
      na: { pret: 8, atturas: 4 },
      lpv: { pret: 9 },
      st: { pret: 8 },
      ind: { par: 2, pret: 2 }
    }
  }),
  generateVote({
    id: "14-2026-09-10-v2",
    saeimaTerm: 14,
    sessionId: "14-sede-22",
    sittingDate: "2026-09-10",
    sittingTime: "17:30",
    sittingType: "Kārtējā",
    reading: 3,
    isUrgent: false,
    isTier1: true,
    protocolUrl: "https://www.saeima.lv/lv/likumdosana/balsojumi",
    officialTitle: "Grozījumi Pilsonības likumā (Nr. 201/Lp14), 3. lasījums",
    billNumber: "Nr. 201/Lp14",
    simplifiedTitle: "Pilsonības atņemšanas kārtība personām, kas atbalsta agresorvalsts kara noziegumus",
    summary: "Paredz skaidru tiesisku mehānismu Latvijas Republikas pilsonības atņemšanai dubultpilsoņiem, kuri snieguši būtisku finansiālu, materiālu vai propagandas atbalstu starptautisko mieru un teritoriālo neaizskaramību apdraudošām valstīm.",
    debateArguments: {
      rapporteur: "Juridiskā komisija",
      proponents: "Valsts drošības un Satversmes aizsardzības pamatprincipi nosaka, ka Latvijas pilsonība ir lojalitātes saikne; atbalsts genocīdam un kara noziegumiem ir pamats šīs saiknes pārtraukšanai.",
      opponents: "Debatēs tika uzdots jautājums par tiesu varas kontroli pār lēmumu pieņemšanu un pārsūdzības mehānismiem, lai novērstu patvaļīgu lēmumu risku."
    },
    category: { id: "justice", label: "Tiesiskums & Valsts" },
    factionRules: {
      jv: { par: 26 },
      zzs: { par: 16 },
      pro: { par: 10 },
      as: { par: 15 },
      na: { par: 12 },
      lpv: { par: 4, atturas: 3, nebalso: 2 },
      st: { pret: 8 },
      ind: { par: 3, nebalso: 1 }
    }
  })
];

fs.writeFileSync(outputPath, JSON.stringify(votes, null, 2), 'utf8');
console.log(`Updated ${votes.length} votes with debate arguments and faction deviations into ${outputPath}`);
