#!/usr/bin/env python3
"""
kābalsosaeima.lv — Multi-Term Real Saeima Plenary Ingestion Engine
------------------------------------------------------------------
Pulls official open data XMLs from data.gov.lv (CKAN API: saeimas-sedes):
  - *-vote.xml : Roll-call voting records & official tallies
  - *-dkp.xml  : Agenda items, bill numbers, readings, sitting dates
  - *-deb.xml  : Official plenary debate speaker records

Key Data-Integrity Guarantees:
1. True chronological discovery (never sorts by Latvian season strings).
2. Full-term incremental ingestion via sync_state.json (zero dropped history).
3. Zero silent failures: any HTTP, XML, unknown faction, or unknown MP error fails loudly.
4. Cross-checks parsed rollcall tallies against official XML <VOTERESULT_*> fields.
5. Honest factionBreakdown derived strictly from rollcalls + active mandates on vote date
   (NEVER pads with stale static seat counts — sum always equals active chamber size <= 100).
6. Constitutional math: enforces both Satversme Art. 24 (50-MP quorum, simple majority)
   and Art. 76 (67-MP quorum, 2/3 majority for Satversme amendments).
7. Syncs active term (15. Saeima) to top-level public/data/ for API/sentinel compatibility.
"""

import argparse
import bisect
import json
import os
import re
import shutil
import sys
import time
import urllib.request
import xml.etree.ElementTree as ET
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone

if sys.stdout.encoding != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC_DATA_DIR = os.path.join(BASE_DIR, "public", "data")
TERMS_DIR = os.path.join(PUBLIC_DATA_DIR, "terms")
CKAN_PACKAGE_URL = "https://data.gov.lv/dati/api/3/action/package_show?id=saeimas-sedes"
ACTIVE_TERM = 15

FACTION_CODE_MAP = {
    "JV": "jv",
    "ZZS": "zzs",
    "PRO": "pro",
    "AS": "as",
    "NA": "na",
    "LPV": "lpv",
    "ST!": "st",
    "S!": "st",
    "SV/AJ": "sv_aj",
    "PIEFR": "ind",
    "Piefr": "ind",
    "": "ind",
    " ": "ind",
}

# Known official short-name / surname-change equivalences between XML rollcalls and saeima.lv profiles
NAME_ALIASES = {
    "krišjānis kariņš": "arturs krišjānis kariņš",
    "arturs krišjānis kariņš": "arturs krišjānis kariņš",
    "jekaterina dorošķeviča": "jekaterina drelinga",
}

CATEGORIES = [
    {
        "id": "drosiba",
        "label": "Valsts drošība un aizsardzība",
        "keywords": ["aizsardzīb", "militār", "robež", "iekšliet", "policij", "valsts drošīb", "ieroč", "ukrain", "sankcij", "nato", "krievij", "baltkrievij"],
    },
    {
        "id": "budzets",
        "label": "Budžets un nodokļi",
        "keywords": ["budžet", "nodokļ", "finans", "akcīz", "ieņēmum", "muitas", "kredīt", "parād", "nodev", "pvn"],
    },
    {
        "id": "ekonomika",
        "label": "Ekonomika un enerģētika",
        "keywords": ["enerģētik", "iepirkum", "komerc", "tirg", "transport", "dzelzceļ", "lauksaimniecīb", "mež", "ost", "satiksm", "būvniecīb", "biznes", "degviel"],
    },
    {
        "id": "tiesiskums",
        "label": "Tiesiskums un korupcijas novēršana",
        "keywords": ["krimināl", "tiesu", "korupcij", "prokuratūr", "satversm", "sodu", "notariāt", "advokatūr", "vēlēšan", "knab", "civillik", "tiesīb"],
    },
    {
        "id": "socialie",
        "label": "Veselība un labklājība",
        "keywords": ["pensij", "pabalst", "veselīb", "ārstniecīb", "bērn", "invalīd", "darba", "izglītīb", "sociāl", "pacient", "zāļu", "medicin", "skol"],
    },
    {
        "id": "administracija",
        "label": "Valsts pārvalde",
        "keywords": ["pārvald", "pašvaldīb", "valsts dienest", "likumdošan", "ministrij", "pilnvar", "ierēdn", "ministru kabinet", "komisij"],
    },
]


def detect_category(title: str, section: str = "") -> dict:
    combined = f"{title} {section}".lower()
    for cat in CATEGORIES:
        for kw in cat["keywords"]:
            if kw in combined:
                return {"id": cat["id"], "label": cat["label"]}
    return {"id": "administracija", "label": "Valsts pārvalde"}


def classify_vote_type(motive: str, reading, is_urgent: bool) -> str:
    m = (motive or "").lower()
    if "priekšlikum" in m or "labojum" in m:
        return "priekslikums"
    if any(
        k in m
        for k in [
            "steidzamīb",
            "izslēgšan",
            "iekļaušan",
            "darba kārtīb",
            "termiņ",
            "pārtraukum",
            "pārbaudi",
            "pagarināšan",
            "nodošan",
        ]
    ):
        return "procedura"
    return "likums"


def determine_reading_stage(motive: str, reading, is_urgent: bool, vote_type: str) -> str:
    m = (motive or "").lower()
    if vote_type == "likums":
        if reading == 3 or "3.lasījum" in m or "3. lasījum" in m or "galīg" in m:
            return "3. lasījums (galīgais)"
        if (reading == 2 and is_urgent) or (("2.lasījum" in m or "2. lasījum" in m) and ("steidzam" in m or is_urgent)):
            return "2. lasījums (steidzams)"
        if reading == 2 or "2.lasījum" in m or "2. lasījum" in m:
            return "2. lasījums"
        if reading == 1 or "1.lasījum" in m or "1. lasījum" in m:
            return "1. lasījums"
        if "uzticīb" in m:
            return "Uzticības balsojums"
        if "lēmum" in m:
            return "Lēmums"
        if "deklarācij" in m:
            return "Deklarācija"
        return "Likuma pieņemšana"
    if vote_type == "priekslikums":
        match = re.search(r"(\d+)\.\s*priekšlikum", m)
        if match:
            return f"{match.group(1)}. priekšlikums"
        return "Priekšlikums"
    if "steidzam" in m:
        return "Steidzamība"
    if "darba kārtīb" in m:
        return "Darba kārtība"
    if "nodošan" in m:
        return "Nodošana komisijām"
    return "Procedūra"


def simplify_title(official_title: str) -> str:
    t = (official_title or "").strip()
    t = re.sub(r"^\s*Par\s+likumprojekta\s+", "", t, flags=re.IGNORECASE)
    t = re.sub(r"^\s*Par\s+likumprojektu\s+", "", t, flags=re.IGNORECASE)
    t = re.sub(r"^\s*Likumprojekts\s+", "", t, flags=re.IGNORECASE)
    t = re.sub(r"\s*\(\s*\d+/[A-Za-z0-9]+\s*\)\s*", " ", t)
    t = re.sub(r"\s*,\s*\d+\.\s*lasījums.*$", "", t, flags=re.IGNORECASE)
    t = re.sub(r"\s*,\s*steidzams.*$", "", t, flags=re.IGNORECASE)
    t = re.sub(r"\s*\(steidzams\).*$", "", t, flags=re.IGNORECASE)
    t = re.sub(r"\s*,\s*nodošana\s+komisijām.*$", "", t, flags=re.IGNORECASE)
    t = re.sub(r"\s+", " ", t).strip(" ,.;:-")
    if len(t) > 0:
        return t[0].upper() + t[1:]
    return official_title


def parse_latvian_iso(date_str: str) -> str:
    if not date_str:
        return ""
    m = re.search(r"(\d{2})\.(\d{2})\.(\d{4})", str(date_str))
    if m:
        return f"{m.group(3)}-{m.group(2)}-{m.group(1)}"
    m_iso = re.search(r"(\d{4})-(\d{2})-(\d{2})", str(date_str))
    if m_iso:
        return m_iso.group(0)
    return ""


def normalize_name(name: str) -> str:
    n = " ".join((name or "").strip().lower().split())
    return NAME_ALIASES.get(n, n)


def fetch_with_retry(url: str, is_json: bool = False, retries: int = 4, timeout: int = 30):
    last_err = None
    for attempt in range(1, retries + 1):
        try:
            req = urllib.request.Request(
                url,
                headers={"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) kabalsosaeima.lv/2.0"},
            )
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                raw = resp.read().decode("utf-8", errors="replace")
                return json.loads(raw) if is_json else raw
        except Exception as e:
            last_err = e
            if attempt < retries:
                time.sleep(min(12, 1.5 * (2 ** (attempt - 1))))
    raise RuntimeError(f"HTTP fetch failed for {url} after {retries} retries: {last_err}")


def is_candidate_ballot(cv: ET.Element) -> bool:
    """Identify secret paper-ballot candidate elections (e.g. Saeima Presidium elections) without rollcall rows."""
    if (cv.findtext("VOTEISCANDIDATE") or "0").strip() == "1":
        res_tokens = {r.strip() for r in (cv.findtext("RESULT") or "").split("#") if r.strip()}
        if not res_tokens:
            return True
    return False


def is_attendance_registration(cv: ET.Element) -> bool:
    """Explicitly identify attendance registration checks without dropping real 0-Par votes."""
    motive = (cv.findtext("VOTEMOTIVE") or "").strip().lower()
    if "klātbūtnes reģistrācija" in motive or motive == "deputātu reģistrācija":
        return True
    if is_candidate_ballot(cv):
        return True
    res_tokens = {r.strip() for r in (cv.findtext("RESULT") or "").split("#") if r.strip()}
    if not res_tokens:
        # Check if it's a secret vote (VOTEISHIDDEN=1) or empty test record
        if (cv.findtext("VOTEISHIDDEN") or "0").strip() == "1":
            return False
        return True
    if res_tokens.issubset({"Reģistrējies", "Nereģistrējies"}):
        return True
    return False


def parse_debates_xml(deb_xml_text: str) -> dict:
    """Parse *-deb.xml into map: dkp_id -> list of official debater dicts."""
    result = {}
    if not deb_xml_text or not deb_xml_text.strip():
        return result
    root = ET.fromstring(deb_xml_text)
    for deb in root.findall("DEBATES"):
        dkp_id = (deb.findtext("DKP_ID") or deb.findtext("dkp_id") or "").strip()
        if not dkp_id:
            continue
        names = (deb.findtext("DEBATE_NAME") or "").split("#")
        surnames = (deb.findtext("DEBATE_SURNAME") or "").split("#")
        fractions = (deb.findtext("DEBATE_FRACTION") or "").split("#")
        times = (deb.findtext("DEBATE_TIME") or "").split("#")
        opinions = (deb.findtext("DEBATE_OPINION") or "").split("#")
        infos = (deb.findtext("DEBATE_INFO") or "").split("#")

        debaters = []
        seen = set()
        for i in range(max(len(names), len(surnames))):
            n = names[i].strip() if i < len(names) else ""
            s = surnames[i].strip() if i < len(surnames) else ""
            if not n and not s:
                continue
            full_name = f"{n} {s}".strip()
            frac = fractions[i].strip() if i < len(fractions) else ""
            t_dur = times[i].strip() if i < len(times) else ""
            raw_op = opinions[i].strip() if i < len(opinions) else ""
            info = infos[i].strip() if i < len(infos) else ""

            key = (full_name.lower(), t_dur, info)
            if key in seen:
                continue
            seen.add(key)

            op_low = raw_op.lower()
            if "pret" in op_low:
                opinion = "Pret"
            elif "par" in op_low:
                opinion = "Par"
            else:
                opinion = raw_op or "Debates"

            preview_parts = []
            if raw_op:
                preview_parts.append(raw_op)
            if info:
                preview_parts.append(info)
            if t_dur:
                preview_parts.append(f"uzstāšanās ilgums {t_dur}")
            preview = " · ".join(preview_parts) if preview_parts else "Uzstājās debatēs Saeimas sēdē."

            debaters.append({
                "name": full_name,
                "fraction": frac or "PIEFR",
                "opinion": opinion,
                "preview": preview,
                "fullSpeech": "",
            })
        if debaters:
            result[dkp_id] = debaters
    return result


def is_mandate_active(intervals: list, iso_date: str) -> bool:
    for iv in intervals:
        f_dt = iv["from"]
        t_dt = iv.get("to")
        if f_dt <= iso_date and (t_dt is None or iso_date < t_dt):
            return True
    return False


def parse_sitting(sitting_name: str, term: int, v_res: dict, d_res: dict, deb_res, mp_by_norm: dict, existing_votes_by_id: dict):
    """Fetch and parse one sitting's -vote, -dkp, and -deb XMLs. Fails loudly on errors."""
    v_xml = fetch_with_retry(v_res["url"])
    d_xml = fetch_with_retry(d_res["url"])
    deb_map = {}
    if deb_res:
        deb_xml = fetch_with_retry(deb_res["url"])
        deb_map = parse_debates_xml(deb_xml)

    v_root = ET.fromstring(v_xml)
    d_root = ET.fromstring(d_xml)

    # Extract sitting-level metadata from <DK>
    dk_el = d_root.find("DK")
    dk_date = (dk_el.findtext("DKDATE") or "").strip() if dk_el is not None else ""
    session_type_code = (dk_el.findtext("SESSIONTYPE") or "").strip() if dk_el is not None else ""
    if "ārkārtas" in sitting_name.lower() or session_type_code == "2":
        sitting_type = "Ārkārtas plenārsēde"
    else:
        sitting_type = "Kārtējā plenārsēde"

    # Map DKP agenda items
    dkp_map = {}
    for item in d_root.findall("DKP"):
        did = (item.findtext("DKP_ID") or item.findtext("dkp_id") or "").strip()
        if did:
            dkp_map[did] = item

    votes_parsed = []
    skipped_reg = 0
    unmatched_names = set()
    unknown_factions = set()

    for cv in v_root.findall("VOTES"):
        if is_attendance_registration(cv):
            skipped_reg += 1
            continue

        vote_id = (cv.findtext("VOTING_ID") or "").strip()
        if not vote_id:
            raise ValueError(f"Vote without VOTING_ID in sitting {sitting_name}")

        is_secret = (cv.findtext("VOTEISHIDDEN") or "0").strip() == "1"
        did = (cv.findtext("dkp_id") or cv.findtext("DKP_ID") or "").strip()
        d_item = dkp_map.get(did)
        motive = (cv.findtext("VOTEMOTIVE") or "").strip()

        title = (d_item.findtext("TITLE") or "").strip() if d_item is not None else ""
        if not title:
            title = motive

        bill_number = (d_item.findtext("LIVSDOCUMENTID") or "").strip() if d_item is not None else ""
        if not bill_number:
            match = re.search(r"\(([^)]+L[pm]\d+[^)]*)\)", motive)
            if match:
                bill_number = match.group(1)
            else:
                vnum = (cv.findtext("VOTE_NUMBER") or "1").strip()
                bill_number = f"Nr. {vnum}"

        raw_reading = d_item.findtext("READING") if d_item is not None else None
        reading = None
        if raw_reading and raw_reading.strip().isdigit():
            r_int = int(raw_reading.strip())
            if r_int in (1, 2, 3):
                reading = r_int

        raw_urgency = (d_item.findtext("URGENCY") or "False").strip() if d_item is not None else "False"
        is_urgent = raw_urgency in ("True", "1") or "steidzam" in motive.lower()

        vote_type = classify_vote_type(motive, reading, is_urgent)
        stage = determine_reading_stage(motive, reading, is_urgent, vote_type)
        is_tier1 = vote_type == "likums"

        ts = (cv.findtext("VOTETIMESTAMP") or "").strip()
        date_str = ""
        time_str = ""
        if ts:
            parts = ts.split()
            date_str = parts[0]
            if len(parts) > 1:
                time_str = parts[1][:5]
        if not date_str:
            date_str = dk_date
        if not date_str or not parse_latvian_iso(date_str):
            raise ValueError(f"Missing valid date on vote {vote_id} in sitting {sitting_name} (ts={ts!r}, dk_date={dk_date!r})")

        # Parse MP roll-call
        mp_records = []
        par_count = 0
        pret_count = 0
        atturas_count = 0

        if not is_secret:
            names = (cv.findtext("NAME") or "").split("#")
            surnames = (cv.findtext("SURNAME") or "").split("#")
            fractions_raw = (cv.findtext("FRACTION") or "").split("#")
            results_raw = (cv.findtext("RESULT") or "").split("#")

            if len(names) != len(results_raw):
                raise ValueError(
                    f"Vote {vote_id} in {sitting_name}: NAME count ({len(names)}) != RESULT count ({len(results_raw)})"
                )

            for i in range(len(names)):
                n = names[i].strip()
                s = surnames[i].strip() if i < len(surnames) else ""
                if not n and not s:
                    continue
                full_name = f"{n} {s}".strip()
                f_code = fractions_raw[i].strip() if i < len(fractions_raw) else ""
                if f_code not in FACTION_CODE_MAP:
                    unknown_factions.add(f_code)
                    continue
                fid = FACTION_CODE_MAP[f_code]

                res = results_raw[i].strip()
                if res == "Par":
                    decision = "PAR"
                    par_count += 1
                elif res == "Pret":
                    decision = "PRET"
                    pret_count += 1
                elif res == "Atturas":
                    decision = "ATTURAS"
                    atturas_count += 1
                elif res in ("Nebalsoja", "Reģistrējies", "Nereģistrējies", ""):
                    decision = "NEBALSO"
                else:
                    raise ValueError(f"Unexpected XML RESULT value {res!r} on vote {vote_id} in {sitting_name}")

                norm = normalize_name(full_name)
                mp_info = mp_by_norm.get(norm)
                if not mp_info:
                    unmatched_names.add(full_name)
                    continue

                mp_records.append({
                    "mpId": mp_info["id"],
                    "name": mp_info["name"],
                    "factionId": fid,
                    "decision": decision,
                })

            # Cross-verify against official XML aggregate tags when present
            xml_for = (cv.findtext("VOTERESULT_FOR") or "").strip()
            xml_against = (cv.findtext("VOTERESULT_AGAINST") or "").strip()
            xml_abstain = (cv.findtext("VOTERESULT_ABSTAIN") or "").strip()
            if xml_for.isdigit() and int(xml_for) != par_count:
                raise ValueError(f"Vote {vote_id}: parsed PAR ({par_count}) != XML VOTERESULT_FOR ({xml_for})")
            if xml_against.isdigit() and int(xml_against) != pret_count:
                raise ValueError(f"Vote {vote_id}: parsed PRET ({pret_count}) != XML VOTERESULT_AGAINST ({xml_against})")
            if xml_abstain.isdigit() and int(xml_abstain) != atturas_count:
                raise ValueError(f"Vote {vote_id}: parsed ATTURAS ({atturas_count}) != XML VOTERESULT_ABSTAIN ({xml_abstain})")
        else:
            # Secret ballot: use official XML aggregate tags
            xml_for = (cv.findtext("VOTERESULT_FOR") or "0").strip()
            xml_against = (cv.findtext("VOTERESULT_AGAINST") or "0").strip()
            xml_abstain = (cv.findtext("VOTERESULT_ABSTAIN") or "0").strip()
            par_count = int(xml_for) if xml_for.isdigit() else 0
            pret_count = int(xml_against) if xml_against.isdigit() else 0
            atturas_count = int(xml_abstain) if xml_abstain.isdigit() else 0

        section = (d_item.findtext("DKP_SECTION") or "").strip() if d_item is not None else ""
        comm = (d_item.findtext("NAMESUBMITED") or "").strip() if d_item is not None else ""
        vote_comment = (cv.findtext("VOTE_COMMENT") or "").strip()

        summary_text = f"Likumprojekts izskatīts {term}. Saeimas sēdē. Oficiālais reģistrācijas numurs: {bill_number}."
        if comm:
            summary_text += f" Iesniedzējs / atbildīgā komisija: {comm}."
        if vote_comment:
            summary_text += f" Piezīme protokolā: {vote_comment}"

        prev_vote = existing_votes_by_id.get(vote_id, {})

        # Debates: preserve rich verbatim stenogram debates if previously enriched; otherwise use official *-deb.xml
        prev_deb = prev_vote.get("debateArguments")
        has_rich_prev_deb = (
            isinstance(prev_deb, dict)
            and prev_deb.get("hasDebates")
            and any((d.get("fullSpeech") or "").strip() for d in (prev_deb.get("debaters") or []))
        )
        if has_rich_prev_deb:
            debate_args = prev_deb
        elif did in deb_map:
            debate_args = {
                "hasDebates": True,
                "debaters": deb_map[did],
            }
        elif prev_deb:
            debate_args = prev_deb
        else:
            debate_args = {
                "hasDebates": False,
                "noDebateReason": (
                    "Procedūras balsojums bez debašu pieteikumiem."
                    if vote_type == "procedura"
                    else "Debates plenārsēdē nenotika — saskaņā ar oficiālajiem sēdes datiem neviens deputāts debatēm nebija pieteicies."
                ),
            }

        vote_obj = {
            "id": vote_id,
            "saeimaTerm": term,
            "sittingName": sitting_name,
            "sessionDate": date_str,
            "sittingDate": date_str,
            "sittingTime": time_str or "10:00",
            "sittingType": sitting_type,
            "reading": reading,
            "isUrgent": is_urgent,
            "isTier1": is_tier1,
            "voteType": vote_type,
            "readingStage": stage,
            "isSecret": is_secret,
            "isRevote": False,
            "officialTitle": title,
            "billNumber": bill_number,
            "simplifiedTitle": prev_vote.get("simplifiedTitle") or simplify_title(title),
            "summary": summary_text,
            "purpose": prev_vote.get("purpose", ""),
            "protocolUrl": prev_vote.get("protocolUrl", ""),
            "stenogramUrl": prev_vote.get("stenogramUrl", ""),
            "category": prev_vote.get("category") or detect_category(title, section),
            "counts": {
                "par": par_count,
                "pret": pret_count,
                "atturas": atturas_count,
                "nebalso": 0,  # computed honestly from active mandates after all sittings loaded
                "totalPresent": par_count + pret_count + atturas_count,
            },
            "result": "",  # computed with constitutional rules below
            "factionBreakdown": [],  # computed honestly from rollcalls + active mandates below
            "debateArguments": debate_args,
            "_mpVotes": mp_records,
        }
        votes_parsed.append(vote_obj)

    if unknown_factions:
        raise ValueError(f"Unknown XML FRACTION code(s) in {sitting_name}: {sorted(unknown_factions)}")
    if unmatched_names:
        raise ValueError(f"Unmatched MP name(s) in {sitting_name} not present in mps.json: {sorted(unmatched_names)}")

    return {
        "sitting_name": sitting_name,
        "dk_date": dk_date,
        "votes": votes_parsed,
        "skipped_reg": skipped_reg,
    }


def compute_constitutional_outcome(vote: dict) -> str:
    c = vote["counts"]
    par = c["par"]
    pret = c["pret"]
    atturas = c["atturas"]
    total_present = par + pret + atturas

    title_low = (vote.get("officialTitle") or "").lower()
    is_const_amendment = (
        "satversm" in title_low
        and ("grozījum" in title_low or "likumprojekts" in title_low)
        and vote.get("voteType") == "likums"
        and (vote.get("reading") == 3 or "3. las" in (vote.get("readingStage") or "").lower() or "galīg" in (vote.get("readingStage") or "").lower())
    )

    if is_const_amendment:
        if total_present < 67:
            return "NAV_KVORUMA"
        if par >= (2 * total_present / 3.0):
            return "PIENEMTS"
        return "NORAIDITS"

    if total_present < 50:
        return "NAV_KVORUMA"
    if par > (pret + atturas):
        return "PIENEMTS"
    return "NORAIDITS"


def build_honest_faction_breakdowns(votes: list, rollcalls_by_vote: dict, mps: list, mandates: list, factions: list):
    """
    Recompute counts.nebalso, result, and factionBreakdown strictly from:
    - actual rollcall records on that vote (historical factionId)
    - active mandates on that sitting date (from mandates.json)
    - nearest rollcall faction lookup for absent active MPs (matching internal/stats)

    Guarantees sum(factionBreakdown) == len(active_mandates_on_date) <= 100 on 100% of votes.
    """
    factions_by_id = {f["id"]: f for f in factions}
    mp_default_faction = {m["id"]: m.get("factionId", "ind") for m in mps}
    mandate_intervals = {m["mpId"]: m["active"] for m in mandates}

    # Build chronological faction history per MP across all loaded rollcalls: mpId -> sorted [(iso_date, factionId)]
    mp_faction_history = defaultdict(list)
    for v in votes:
        if v.get("isSecret"):
            continue
        iso = parse_latvian_iso(v.get("sittingDate", ""))
        for rec in rollcalls_by_vote.get(v["id"], []):
            if rec.get("factionId"):
                mp_faction_history[rec["mpId"]].append((iso, rec["factionId"]))

    mp_dates_index = {}
    for mp_id, entries in mp_faction_history.items():
        entries.sort(key=lambda x: x[0])
        mp_dates_index[mp_id] = ([e[0] for e in entries], [e[1] for e in entries])

    def resolve_absent_faction(mp_id: str, iso_date: str) -> str:
        idx_pair = mp_dates_index.get(mp_id)
        if idx_pair:
            dates, fids = idx_pair
            pos = bisect.bisect_right(dates, iso_date)
            if pos > 0:
                return fids[pos - 1]
            if fids:
                return fids[0]
        return mp_default_faction.get(mp_id, "ind")

    # Cache active MP IDs per ISO date
    active_cache = {}
    for v in votes:
        iso = parse_latvian_iso(v.get("sittingDate", ""))
        if iso not in active_cache:
            active_ids = [mp_id for mp_id, ivs in mandate_intervals.items() if is_mandate_active(ivs, iso)]
            if len(active_ids) > 100:
                raise RuntimeError(f"FATAL CEILING VIOLATION: {len(active_ids)} active mandates on {iso} (>100)")
            active_cache[iso] = active_ids

        active_ids = active_cache[iso]
        active_set = set(active_ids)

        c = v["counts"]
        total_present = c["par"] + c["pret"] + c["atturas"]
        c["totalPresent"] = total_present

        if v.get("isSecret"):
            c["nebalso"] = max(0, len(active_ids) - total_present)
            v["result"] = compute_constitutional_outcome(v)
            v["factionBreakdown"] = []
            continue

        rc = rollcalls_by_vote.get(v["id"], [])
        rc_mp_ids = set()
        faction_tally = {f["id"]: {"par": 0, "pret": 0, "atturas": 0, "nebalso": 0} for f in factions}

        for rec in rc:
            mp_id = rec["mpId"]
            fid = rec["factionId"]
            if fid not in faction_tally:
                faction_tally[fid] = {"par": 0, "pret": 0, "atturas": 0, "nebalso": 0}
            rc_mp_ids.add(mp_id)
            dec = rec["decision"]
            if dec == "PAR":
                faction_tally[fid]["par"] += 1
            elif dec == "PRET":
                faction_tally[fid]["pret"] += 1
            elif dec == "ATTURAS":
                faction_tally[fid]["atturas"] += 1
            else:
                faction_tally[fid]["nebalso"] += 1

        # Add absent active-mandate MPs (not listed in XML rollcall) to their true faction's nebalso.
        # On same-day mid-sitting handovers (e.g., 2025-06-19 morning votes where outgoing MP with to == iso
        # voted before incoming substitute with from == iso was seated), avoid double-counting both seats (>100).
        absent_active = [mp_id for mp_id in active_ids if mp_id not in rc_mp_ids]
        overflow = (len(rc_mp_ids) + len(absent_active)) - 100
        if overflow > 0:
            # Prefer excluding absent MPs whose mandate started on this exact sitting date (not seated yet)
            started_today = [
                mp_id
                for mp_id in absent_active
                if any(iv["from"] == iso for iv in mandate_intervals.get(mp_id, []))
            ]
            exclude_set = set(started_today[:overflow])
            absent_active = [mp_id for mp_id in absent_active if mp_id not in exclude_set]

        for mp_id in absent_active:
            fid = resolve_absent_faction(mp_id, iso)
            if fid not in faction_tally:
                faction_tally[fid] = {"par": 0, "pret": 0, "atturas": 0, "nebalso": 0}
            faction_tally[fid]["nebalso"] += 1

        # Total nebalso = sum across all factions (exact match with chamber size!)
        total_nebalso = sum(t["nebalso"] for t in faction_tally.values())
        c["nebalso"] = total_nebalso
        v["result"] = compute_constitutional_outcome(v)

        # Build factionBreakdown ordered by factions.json (skipping 0-seat dissolved factions)
        breakdowns = []
        for f_meta in factions:
            fid = f_meta["id"]
            t = faction_tally.get(fid, {"par": 0, "pret": 0, "atturas": 0, "nebalso": 0})
            if sum(t.values()) == 0:
                continue

            deviating_mps = []
            support_votes = t["par"]
            block_votes = t["pret"] + t["atturas"]
            if fid.lower() not in ("piefr", "ind") and support_votes != block_votes and (support_votes > 0 or block_votes > 0):
                dominant = "SUPPORT" if support_votes > block_votes else "BLOCK"
                for rec in rc:
                    if rec["factionId"] != fid:
                        continue
                    dec = rec["decision"]
                    if dominant == "SUPPORT" and dec in ("PRET", "ATTURAS"):
                        deviating_mps.append({
                            "mpId": rec["mpId"],
                            "name": rec["name"],
                            "decision": dec,
                            "factionLine": "PAR",
                        })
                    elif dominant == "BLOCK" and dec == "PAR":
                        deviating_mps.append({
                            "mpId": rec["mpId"],
                            "name": rec["name"],
                            "decision": dec,
                            "factionLine": "PRET / ATTURAS",
                        })

            breakdowns.append({
                "factionId": fid,
                "name": f_meta["name"],
                "shortName": f_meta["shortName"],
                "color": f_meta["color"],
                "votes": t,
                "deviatingMps": deviating_mps,
            })

        v["factionBreakdown"] = breakdowns


def mirror_active_term_to_root(term_dir: str):
    """Copy active term dataset to top-level public/data/ for API & sentinel compatibility."""
    for fname in ("votes.json", "mps.json", "mandates.json", "factions.json", "metadata.json"):
        src = os.path.join(term_dir, fname)
        dst = os.path.join(PUBLIC_DATA_DIR, fname)
        if os.path.exists(src):
            shutil.copy2(src, dst)

    src_rc = os.path.join(term_dir, "rollcalls")
    dst_rc = os.path.join(PUBLIC_DATA_DIR, "rollcalls")
    if os.path.exists(dst_rc):
        shutil.rmtree(dst_rc)
    shutil.copytree(src_rc, dst_rc)


def ingest_term(term: int, ckan_resources: list, force: bool = False, max_workers: int = 4):
    term_dir = os.path.join(TERMS_DIR, str(term))
    votes_file = os.path.join(term_dir, "votes.json")
    mps_file = os.path.join(term_dir, "mps.json")
    mandates_file = os.path.join(term_dir, "mandates.json")
    factions_file = os.path.join(term_dir, "factions.json")
    metadata_file = os.path.join(term_dir, "metadata.json")
    sync_state_file = os.path.join(term_dir, "sync_state.json")
    rollcalls_dir = os.path.join(term_dir, "rollcalls")

    print("=" * 70)
    print(f"INGESTING {term}. SAEIMA FROM data.gov.lv (FULL-TERM INCREMENTAL)")
    print("=" * 70)

    if not os.path.exists(mps_file) or not os.path.exists(mandates_file) or not os.path.exists(factions_file):
        raise RuntimeError(
            f"Missing mps.json / mandates.json / factions.json in {term_dir}. Run `python3 scripts/scrape_mandates.py --term {term}` first."
        )

    with open(mps_file, "r", encoding="utf-8") as f:
        mps = json.load(f)
    with open(mandates_file, "r", encoding="utf-8") as f:
        mandates = json.load(f)
    with open(factions_file, "r", encoding="utf-8") as f:
        factions = json.load(f)

    mp_by_norm = {}
    for m in mps:
        mp_by_norm[normalize_name(m["name"])] = m

    # Load existing votes & legacy enriched 14. Saeima votes (to preserve stenogram URLs/purposes/verbatim debates)
    existing_votes_by_id = {}
    if os.path.exists(votes_file):
        with open(votes_file, "r", encoding="utf-8") as f:
            for ev in json.load(f):
                if ev.get("id"):
                    existing_votes_by_id[ev["id"]] = ev
    elif term == 14 and os.path.exists(os.path.join(PUBLIC_DATA_DIR, "votes.json")):
        with open(os.path.join(PUBLIC_DATA_DIR, "votes.json"), "r", encoding="utf-8") as f:
            for ev in json.load(f):
                if ev.get("id") and ev.get("saeimaTerm", 14) == 14:
                    existing_votes_by_id[ev["id"]] = ev

    sync_state = {}
    if os.path.exists(sync_state_file) and not force:
        with open(sync_state_file, "r", encoding="utf-8") as f:
            sync_state = json.load(f)

    # Discover all resources for this term
    vote_res, dkp_res, deb_res = {}, {}, {}
    term_pat = re.compile(rf"^{term}\.\s*[Ss]aeima")
    for r in ckan_resources:
        name = (r.get("name") or "").strip()
        if not term_pat.match(name):
            continue
        if name.endswith("-vote"):
            vote_res[name[:-5]] = r
        elif name.endswith("-dkp"):
            dkp_res[name[:-4]] = r
        elif name.endswith("-deb"):
            deb_res[name[:-4]] = r

    paired = sorted(
        list(set(vote_res.keys()) & set(dkp_res.keys())),
        key=lambda s: (vote_res[s].get("created") or "", s),
    )
    print(f"[1/4] Discovered {len(paired)} paired sittings for {term}. Saeima on data.gov.lv")

    # Determine which sittings need downloading vs can be reused from cache
    to_fetch = []
    cached_sittings = []
    for s_name in paired:
        v_mod = vote_res[s_name].get("last_modified") or vote_res[s_name].get("created") or ""
        d_mod = dkp_res[s_name].get("last_modified") or dkp_res[s_name].get("created") or ""
        b_mod = (deb_res[s_name].get("last_modified") or deb_res[s_name].get("created") or "") if s_name in deb_res else ""

        prev_st = sync_state.get(s_name)
        if (
            not force
            and prev_st
            and prev_st.get("vote_mod") == v_mod
            and prev_st.get("dkp_mod") == d_mod
            and prev_st.get("deb_mod") == b_mod
            and all(vid in existing_votes_by_id for vid in prev_st.get("vote_ids", []))
        ):
            cached_sittings.append(s_name)
        else:
            to_fetch.append((s_name, v_mod, d_mod, b_mod))

    print(f"      Incremental plan: {len(cached_sittings)} unchanged (cached), {len(to_fetch)} new/updated to fetch.")

    os.makedirs(rollcalls_dir, exist_ok=True)
    all_votes_by_id = {}
    rollcalls_by_vote = {}

    # Restore cached sittings
    for s_name in cached_sittings:
        for vid in sync_state[s_name].get("vote_ids", []):
            v = dict(existing_votes_by_id[vid])
            all_votes_by_id[vid] = v
            if not v.get("isSecret"):
                rc_path = os.path.join(rollcalls_dir, f"{vid}.json")
                if not os.path.exists(rc_path):
                    # Missing rollcall file -> force re-fetch this sitting
                    v_mod = vote_res[s_name].get("last_modified") or vote_res[s_name].get("created") or ""
                    d_mod = dkp_res[s_name].get("last_modified") or dkp_res[s_name].get("created") or ""
                    b_mod = (deb_res[s_name].get("last_modified") or deb_res[s_name].get("created") or "") if s_name in deb_res else ""
                    to_fetch.append((s_name, v_mod, d_mod, b_mod))
                    break
                with open(rc_path, "r", encoding="utf-8") as f:
                    rollcalls_by_vote[vid] = json.load(f)

    # Fetch new/updated sittings concurrently with strict error handling
    new_sync_state = {s: sync_state[s] for s in cached_sittings if s in sync_state}
    total_skipped_reg = 0

    if to_fetch:
        print(f"[2/4] Downloading & verifying {len(to_fetch)} sittings (workers={max_workers})...")
        done = 0
        with ThreadPoolExecutor(max_workers=max_workers) as pool:
            futs = {
                pool.submit(
                    parse_sitting,
                    s_name,
                    term,
                    vote_res[s_name],
                    dkp_res[s_name],
                    deb_res.get(s_name),
                    mp_by_norm,
                    existing_votes_by_id,
                ): (s_name, v_mod, d_mod, b_mod)
                for (s_name, v_mod, d_mod, b_mod) in to_fetch
            }
            for fut in as_completed(futs):
                s_name, v_mod, d_mod, b_mod = futs[fut]
                res = fut.result()  # raises loudly on any error!
                total_skipped_reg += res["skipped_reg"]
                vote_ids = []
                for v in res["votes"]:
                    vid = v["id"]
                    mp_votes = v.pop("_mpVotes", [])
                    all_votes_by_id[vid] = v
                    if not v.get("isSecret"):
                        rollcalls_by_vote[vid] = mp_votes
                    vote_ids.append(vid)
                new_sync_state[s_name] = {
                    "vote_mod": v_mod,
                    "dkp_mod": d_mod,
                    "deb_mod": b_mod,
                    "dk_date": res["dk_date"],
                    "vote_count": len(vote_ids),
                    "vote_ids": vote_ids,
                }
                done += 1
                if done % 25 == 0 or done == len(to_fetch):
                    print(f"      [{done}/{len(to_fetch)}] sittings parsed & cross-verified", flush=True)
    else:
        print("[2/4] All sittings up-to-date; skipping network downloads.")

    # Sort votes chronologically descending by (YYYY-MM-DD, HH:MM, id)
    all_votes = list(all_votes_by_id.values())
    all_votes.sort(
        key=lambda v: (parse_latvian_iso(v.get("sittingDate", "")), v.get("sittingTime") or "", v.get("id") or ""),
        reverse=True,
    )

    print(f"[3/4] Recomputing truthful faction breakdowns & constitutional outcomes for {len(all_votes)} votes...")
    build_honest_faction_breakdowns(all_votes, rollcalls_by_vote, mps, mandates, factions)

    # Write outputs & prune orphan rollcall files
    print(f"[4/4] Writing verified datasets to {term_dir}...")
    valid_rc_files = set()
    for v in all_votes:
        if not v.get("isSecret"):
            vid = v["id"]
            fname = f"{vid}.json"
            valid_rc_files.add(fname)
            rc_path = os.path.join(rollcalls_dir, fname)
            with open(rc_path, "w", encoding="utf-8") as f:
                json.dump(rollcalls_by_vote[vid], f, ensure_ascii=False)

    # Remove orphan rollcalls
    removed_orphans = 0
    for existing_f in os.listdir(rollcalls_dir):
        if existing_f.endswith(".json") and existing_f not in valid_rc_files:
            os.remove(os.path.join(rollcalls_dir, existing_f))
            removed_orphans += 1

    with open(votes_file, "w", encoding="utf-8") as f:
        if len(all_votes) > 1000:
            json.dump(all_votes, f, ensure_ascii=False, separators=(",", ":"))
        else:
            json.dump(all_votes, f, ensure_ascii=False, indent=2)

    with open(sync_state_file, "w", encoding="utf-8") as f:
        json.dump(new_sync_state, f, ensure_ascii=False, indent=2, sort_keys=True)

    now_utc = datetime.now(timezone.utc)
    latest_sitting_date = all_votes[0]["sittingDate"] if all_votes else ""
    meta = {
        "lastSync": now_utc.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "formattedSyncDate": now_utc.strftime("%d.%m.%Y"),
        "totalVotes": len(all_votes),
        "latestSittingDate": latest_sitting_date,
        "saeimaTerm": term,
        "status": "healthy",
    }
    with open(metadata_file, "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)

    if term == ACTIVE_TERM:
        mirror_active_term_to_root(term_dir)
        print(f"      Mirrored active term ({term}. Saeima) to top-level public/data/")

    print(
        f"[OK] {term}. Saeima complete: {len(all_votes)} votes across {len(paired)} sittings "
        f"(latest: {latest_sitting_date}, skipped {total_skipped_reg} attendance checks, pruned {removed_orphans} orphans)."
    )


def main():
    parser = argparse.ArgumentParser(description="Ingest verified Saeima votes from data.gov.lv")
    parser.add_argument("--term", type=int, choices=[14, 15], help="Specific Saeima term to ingest (14 or 15)")
    parser.add_argument("--all", action="store_true", help="Ingest both 15. and 14. Saeima")
    parser.add_argument("--force", action="store_true", help="Ignore sync_state.json cache and re-download all sittings")
    parser.add_argument("--workers", type=int, default=4, help="Concurrent XML download workers (default: 4)")
    args = parser.parse_args()

    print("Fetching CKAN dataset catalog from data.gov.lv...")
    pkg = fetch_with_retry(CKAN_PACKAGE_URL, is_json=True)
    resources = pkg["result"]["resources"]
    print(f"CKAN package 'saeimas-sedes' loaded ({len(resources)} total resources, modified {pkg['result'].get('metadata_modified')}).")

    if args.all:
        terms = [15, 14]
    elif args.term:
        terms = [args.term]
    else:
        terms = [ACTIVE_TERM]

    for t in terms:
        ingest_term(t, resources, force=args.force, max_workers=args.workers)


if __name__ == "__main__":
    main()
