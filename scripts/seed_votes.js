import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mpsPath = path.join(__dirname, '../public/data/mps.json');
const factionsPath = path.join(__dirname, '../public/data/factions.json');
const outputPath = path.join(__dirname, '../public/data/votes.json');

const mps = JSON.parse(fs.readFileSync(mpsPath, 'utf8'));
const factions = JSON.parse(fs.readFileSync(factionsPath, 'utf8'));

// Helper to assign decisions by faction rules
function generateVote({
  id,
  saeimaTerm,
  sittingDate,
  sittingTime,
  sittingType,
  reading,
  isUrgent,
  isTier1,
  officialTitle,
  billNumber,
  simplifiedTitle,
  summary,
  category,
  factionRules // { jv: { par: 26 }, zzs: { par: 16 }, ... }
}) {
  const mpVotes = [];
  const factionMap = {};

  factions.forEach(f => {
    factionMap[f.id] = {
      factionId: f.id,
      name: f.name,
      shortName: f.shortName,
      color: f.color,
      votes: { par: 0, pret: 0, atturas: 0, nebalso: 0 }
    };
  });

  // Group MPs by faction
  const mpsByFaction = {};
  mps.forEach(mp => {
    if (!mpsByFaction[mp.factionId]) mpsByFaction[mp.factionId] = [];
    mpsByFaction[mp.factionId].push(mp);
  });

  let parCount = 0;
  let pretCount = 0;
  let atturasCount = 0;
  let nebalsoCount = 0;

  for (const [fId, fMps] of Object.entries(mpsByFaction)) {
    const rule = factionRules[fId] || { par: 0, pret: 0, atturas: 0, nebalso: fMps.length };
    let assigned = 0;
    
    const decisions = [];
    for (let i = 0; i < (rule.par || 0); i++) decisions.push('PAR');
    for (let i = 0; i < (rule.pret || 0); i++) decisions.push('PRET');
    for (let i = 0; i < (rule.atturas || 0); i++) decisions.push('ATTURAS');
    for (let i = 0; i < (rule.nebalso || 0); i++) decisions.push('NEBALSO');
    
    // Fill remainder with NEBALSO if unspecified
    while (decisions.length < fMps.length) {
      decisions.push('NEBALSO');
    }

    fMps.forEach((mp, idx) => {
      const decision = decisions[idx] || 'NEBALSO';
      mpVotes.push({
        mpId: mp.id,
        name: mp.name,
        factionId: mp.factionId,
        decision
      });

      if (decision === 'PAR') {
        factionMap[fId].votes.par++;
        parCount++;
      } else if (decision === 'PRET') {
        factionMap[fId].votes.pret++;
        pretCount++;
      } else if (decision === 'ATTURAS') {
        factionMap[fId].votes.atturas++;
        atturasCount++;
      } else {
        factionMap[fId].votes.nebalso++;
        nebalsoCount++;
      }
    });
  }

  const result = parCount > (pretCount + atturasCount) ? 'PIENEMTS' : 'NORAIDITS';

  return {
    id,
    saeimaTerm,
    sittingDate,
    sittingTime,
    sittingType,
    reading,
    isUrgent,
    isTier1,
    officialTitle,
    billNumber,
    simplifiedTitle,
    summary,
    category,
    result,
    counts: {
      par: parCount,
      pret: pretCount,
      atturas: atturasCount,
      nebalso: nebalsoCount,
      totalPresent: parCount + pretCount + atturasCount
    },
    factionBreakdown: Object.values(factionMap),
    mpVotes
  };
}

const votes = [
  generateVote({
    id: "14-2026-09-24-v1",
    saeimaTerm: 14,
    sittingDate: "2026-09-24",
    sittingTime: "11:42",
    sittingType: "Kārtējā",
    reading: 3,
    isUrgent: false,
    isTier1: true,
    officialTitle: "Grozījumi Pievienotās vērtības nodokļa likumā (Nr. 482/Lp14), 3. lasījums",
    billNumber: "Nr. 482/Lp14",
    simplifiedTitle: "PVN reģistrācijas sliekšņa celšana līdz 50 000 EUR un 12% likme augļiem",
    summary: "Likums nosaka PVN reģistrācijas sliekšņa paaugstināšanu mazajiem uzņēmējiem no 40 000 līdz 50 000 eiro gadā, kā arī pagarina samazināto PVN likmi Latvijai raksturīgiem augļiem, ogām un dārzeņiem.",
    category: { id: "taxes", label: "Nodokļi & Finanses" },
    factionRules: {
      jv: { par: 25, nebalso: 1 },
      zzs: { par: 16 },
      pro: { par: 10 },
      as: { pret: 13, atturas: 1, nebalso: 1 },
      na: { pret: 10, atturas: 2 },
      lpv: { pret: 9 },
      st: { nebalso: 8 },
      ind: { par: 2, pret: 2 }
    }
  }),
  generateVote({
    id: "14-2026-09-24-v2",
    saeimaTerm: 14,
    sittingDate: "2026-09-24",
    sittingTime: "12:15",
    sittingType: "Kārtējā",
    reading: 2,
    isUrgent: true,
    isTier1: true,
    officialTitle: "Grozījumi Valsts aizsardzības finansēšanas likumā (Nr. 512/Lp14), 2. lasījums",
    billNumber: "Nr. 512/Lp14",
    simplifiedTitle: "Valsts aizsardzības finansējuma pakāpeniska palielināšana līdz 3.5% no IKP",
    summary: "Nostiprina valsts budžeta saistības palielināt militāro un iekšējās drošības finansējumu līdz 3.5% no IKP līdz 2028. gadam, novirzot papildu līdzekļus pretgaisa aizsardzības un austrumu robežas stiprināšanai.",
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
    id: "14-2026-09-17-v1",
    saeimaTerm: 14,
    sittingDate: "2026-09-17",
    sittingTime: "10:30",
    sittingType: "Kārtējā",
    reading: 1,
    isUrgent: false,
    isTier1: true,
    officialTitle: "Likumprojekts 'Par nekustamā īpašuma nodokļa atcelšanu vienīgajam mājoklim' (Nr. 534/Lp14), nodošana komisijām",
    billNumber: "Nr. 534/Lp14",
    simplifiedTitle: "Nekustamā īpašuma nodokļa atcelšana iedzīvotāju primārajam mājoklim",
    summary: "Opozīcijas deputātu virzīts likumprojekts, kas paredzēja atbrīvot no NĪN maksājuma fizisko personu vienīgo reģistrēto dzīvesvietu kadastrālajā vērtībā līdz 100 000 EUR. Noraidīts, nododot negatīvu atzinumu Budžeta komisijai.",
    category: { id: "housing", label: "Mājoklis & Labklājība" },
    factionRules: {
      jv: { pret: 24, atturas: 2 },
      zzs: { pret: 15, atturas: 1 },
      pro: { pret: 10 },
      as: { par: 15 },
      na: { par: 11, nebalso: 1 },
      lpv: { par: 9 },
      st: { par: 8 },
      ind: { par: 3, nebalso: 1 }
    }
  }),
  generateVote({
    id: "14-2026-09-17-v2",
    saeimaTerm: 14,
    sittingDate: "2026-09-17",
    sittingTime: "14:20",
    sittingType: "Kārtējā",
    reading: 3,
    isUrgent: false,
    isTier1: true,
    officialTitle: "Grozījumi Meža likumā un Enerģētikas likumā (Nr. 389/Lp14), 3. lasījums",
    billNumber: "Nr. 389/Lp14",
    simplifiedTitle: "Atjaunīgās enerģijas un vēja parku attīstības paātrināšana valsts meža zemēs",
    summary: "Atvieglo birokrātiskās saskaņošanas procedūras un ietekmes uz vidi novērtējuma termiņus stratēģiskas nozīmes vēja elektrostaciju un akumulācijas iekārtu būvniecībai valsts mežu teritorijās.",
    category: { id: "energy", label: "Vide & Enerģētika" },
    factionRules: {
      jv: { par: 26 },
      zzs: { par: 16 },
      pro: { par: 9, atturas: 1 },
      as: { par: 10, pret: 4, nebalso: 1 },
      na: { pret: 8, atturas: 4 },
      lpv: { pret: 9 },
      st: { pret: 8 },
      ind: { par: 2, pret: 2 }
    }
  }),
  generateVote({
    id: "14-2026-09-10-v1",
    saeimaTerm: 14,
    sittingDate: "2026-09-10",
    sittingTime: "16:05",
    sittingType: "Kārtējā",
    reading: 2,
    isUrgent: false,
    isTier1: true,
    officialTitle: "Grozījumi Izglītības likumā un Vispārējās izglītības likumā (Nr. 467/Lp14), 2. lasījums",
    billNumber: "Nr. 467/Lp14",
    simplifiedTitle: "Kvalitatīva skolu tīkla reforma un minimālā skolēnu skaita kritēriji vidusskolās",
    summary: "Nosaka jaunas kvantitatīvās un kvalitatīvās prasības vidusskolu posmam no 2027. gada, deleģējot Ministru kabinetam tiesības lemt par valsts pedagogu darba samaksas mērķdotāciju sadali atkarībā no klases piepildījuma.",
    category: { id: "education", label: "Izglītība & Zinātne" },
    factionRules: {
      jv: { par: 26 },
      zzs: { par: 14, atturas: 2 },
      pro: { par: 10 },
      as: { pret: 12, atturas: 3 },
      na: { pret: 11, nebalso: 1 },
      lpv: { pret: 9 },
      st: { pret: 8 },
      ind: { pret: 3, nebalso: 1 }
    }
  }),
  generateVote({
    id: "14-2026-09-10-v2",
    saeimaTerm: 14,
    sittingDate: "2026-09-10",
    sittingTime: "17:30",
    sittingType: "Kārtējā",
    reading: 3,
    isUrgent: false,
    isTier1: true,
    officialTitle: "Grozījumi Pilsonības likumā (Nr. 201/Lp14), 3. lasījums",
    billNumber: "Nr. 201/Lp14",
    simplifiedTitle: "Pilsonības atņemšanas kārtība personām, kas atbalsta agresorvalsts kara noziegumus",
    summary: "Paredz skaidru tiesisku mehānismu Latvijas Republikas pilsonības atņemšanai dubultpilsoņiem, kuri snieguši būtisku finansiālu, materiālu vai propagandas atbalstu starptautisko mieru un teritoriālo neaizskaramību apdraudošām valstīm.",
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
console.log(`Generated ${votes.length} votes with 100 MPs each into ${outputPath}`);
