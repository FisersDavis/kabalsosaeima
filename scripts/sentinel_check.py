#!/usr/bin/env python3
"""
kābalsosaeima.lv — Automated Sentinel & Integrity Guardian
-----------------------------------------------------------
Zero-maintenance self-checking engine:
1. Validates parliamentary data integrity against Satversme Art. 24 & parliamentary rules.
2. Performs live endpoint health checks (smoke tests).
3. Updates public/data/metadata.json with sync timestamps and latest dates.
4. Generates structured diagnostic markdown reports on failure for GitHub Automated Issues.
"""

import sys
import os
import json
import argparse
import urllib.request
import urllib.error
from datetime import datetime, timezone

# Ensure utf-8 output on Windows consoles
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, 'public', 'data')
VOTES_FILE = os.path.join(DATA_DIR, 'votes.json')
MPS_FILE = os.path.join(DATA_DIR, 'mps.json')
FACTIONS_FILE = os.path.join(DATA_DIR, 'factions.json')
TERMS_FILE = os.path.join(DATA_DIR, 'terms.json')
METADATA_FILE = os.path.join(DATA_DIR, 'metadata.json')
ROLLCALLS_DIR = os.path.join(DATA_DIR, 'rollcalls')
REPORT_FILE = os.path.join(BASE_DIR, 'alert_report.md')

def load_json(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_json(filepath, data):
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def parse_latvian_date(date_str):
    """Parses 'DD.MM.YYYY' into datetime object for chronological sorting."""
    try:
        parts = date_str.strip().split('.')
        if len(parts) == 3:
            return datetime(int(parts[2]), int(parts[1]), int(parts[0]))
    except Exception:
        pass
    return datetime.min

def is_parliament_in_recess(dt=None):
    """
    Edge Case 8: Checks whether Saeima is in scheduled seasonal recess:
    - Winter recess: Dec 22 - Jan 10
    - Summer recess: Jun 20 - Sep 1
    """
    if dt is None:
        dt = datetime.now()
    m, d = dt.month, dt.day
    if (m == 12 and d >= 22) or (m == 1 and d <= 10):
        return True, "Ziemas sesiju starplaiks"
    if (m == 6 and d >= 20) or m in (7, 8) or (m == 9 and d <= 1):
        return True, "Vasaras sesiju starplaiks"
    return False, ""

def check_local_integrity(update_metadata=False):
    errors = []
    warnings = []

    in_recess, recess_name = is_parliament_in_recess()
    if in_recess:
        print(f"[*] Piezīme: Saeima atrodas sesiju starplaikā ({recess_name}). Jaunu sēžu trūkums ir normāls.")

    print("[*] Running local dataset integrity audit...")

    # 1. File existence
    for fname, fpath in [('votes.json', VOTES_FILE), ('mps.json', MPS_FILE), ('factions.json', FACTIONS_FILE)]:
        if not os.path.exists(fpath):
            errors.append(f"Kritisks datu fails trūkst: `{fname}`")
            return errors, warnings

    votes = load_json(VOTES_FILE)
    mps = load_json(MPS_FILE)
    factions = load_json(FACTIONS_FILE)

    if len(votes) == 0:
        errors.append("`votes.json` ir tukšs (0 balsojumi).")
        return errors, warnings

    # 2. Check MPs
    active_mps = [m for m in mps if m.get('isActive') is not False]
    if len(active_mps) < 100:
        warnings.append(f"Atrasti tikai {len(active_mps)} aktīvi deputāti mps.json failā (paredzēti 100).")

    faction_ids = {f['id'] for f in factions}

    # 3. Check all votes
    seen_vote_ids = set()
    latest_dt = datetime.min
    latest_date_str = ""

    for idx, v in enumerate(votes):
        vid = v.get('id', f'index-{idx}')
        if vid in seen_vote_ids:
            errors.append(f"Dublējošs balsojuma ID: `{vid}` (pozīcija {idx})")
        seen_vote_ids.add(vid)

        counts = v.get('counts', {})
        par = counts.get('par', 0)
        pret = counts.get('pret', 0)
        atturas = counts.get('atturas', 0)
        nebalso = counts.get('nebalso', 0)
        total_present = par + pret + atturas
        total_recorded = total_present + nebalso

        # Secret ballots don't require full MP roll-call validation
        if not v.get('isSecret'):
            # Edge Case 3: Temporary mandate vacancies (tolerates 98-100 recorded MPs)
            if total_recorded < 98 or total_recorded > 100:
                errors.append(
                    f"Balsojumā `{vid}` ({v.get('officialTitle', '')[:40]}...) kopējais deputātu skaits ir {total_recorded}, nevis 98-100."
                )
            elif total_recorded < 100:
                warnings.append(
                    f"Balsojumā `{vid}` kopējais deputātu skaits ir {total_recorded} (īslaicīga vakance starp mandātu maiņām)."
                )

            # Check individual mpVotes if present (inlined or lazy-loaded rollcall)
            mp_votes = v.get('mpVotes')
            if not mp_votes:
                rc_path = os.path.join(ROLLCALLS_DIR, f"{vid}.json")
                if os.path.exists(rc_path):
                    mp_votes = load_json(rc_path)

            if mp_votes:
                par_mps = sum(1 for m in mp_votes if m.get('decision') == 'PAR')
                pret_mps = sum(1 for m in mp_votes if m.get('decision') == 'PRET')
                atturas_mps = sum(1 for m in mp_votes if m.get('decision') == 'ATTURAS')
                if par_mps != par:
                    errors.append(f"Balsojumā `{vid}` mpVotes PAR skaits ({par_mps}) nesakrīt ar counts.par ({par}).")
                if pret_mps != pret:
                    errors.append(f"Balsojumā `{vid}` mpVotes PRET skaits ({pret_mps}) nesakrīt ar counts.pret ({pret}).")
                if atturas_mps != atturas:
                    errors.append(f"Balsojumā `{vid}` mpVotes ATTURAS skaits ({atturas_mps}) nesakrīt ar counts.atturas ({atturas}).")

        # Edge Case 9: Constitutional Amendments Check (Satversmes 76. pants: 2/3 majority with >= 67 present)
        is_const_amendment = (
            "satversm" in v.get('officialTitle', '').lower() and 
            ("grozījum" in v.get('officialTitle', '').lower() or "likumprojekts" in v.get('officialTitle', '').lower())
        )
        result = v.get('result')

        if is_const_amendment:
            # Satversmes 76.p.: vismaz divas trešdaļas no visiem deputātiem (vismaz 67)
            if total_present < 67:
                if result != 'NAV_KVORUMA':
                    errors.append(
                        f"Satversmes grozījumu balsojumā `{vid}` kvorumam nepieciešami vismaz 67 deputāti (bija {total_present}), bet rezultāts ir `{result}`."
                    )
            elif par >= (2 * total_present / 3.0):
                if result != 'PIENEMTS':
                    errors.append(
                        f"Satversmes grozījumu balsojumā `{vid}` sasniegts 2/3 vairākums (Par {par}/{total_present}), bet rezultāts ir `{result}`."
                    )
            else:
                if result != 'NORAIDITS':
                    errors.append(
                        f"Satversmes grozījumu balsojumā `{vid}` nav sasniegts 2/3 vairākums (Par {par}/{total_present}), bet rezultāts ir `{result}`."
                    )
        else:
            # Regular Votes (Satversmes 24. pants: Par > Pret + Atturas, kvorums >= 50)
            if total_present < 50:
                if result != 'NAV_KVORUMA':
                    errors.append(
                        f"Balsojumā `{vid}` piedalījās tikai {total_present} deputāti (< 50), bet rezultāts ir `{result}`, nevis `NAV_KVORUMA`."
                    )
            elif par > (pret + atturas):
                if result != 'PIENEMTS':
                    errors.append(
                        f"Balsojumā `{vid}` Par ({par}) > Pret+Atturas ({pret + atturas}), bet rezultāts ir `{result}`, nevis `PIENEMTS`."
                    )
            else:
                if result != 'NORAIDITS':
                    errors.append(
                        f"Balsojumā `{vid}` Par ({par}) <= Pret+Atturas ({pret + atturas}), bet rezultāts ir `{result}`, nevis `NORAIDITS`."
                    )

        # Date tracking
        s_date = v.get('sittingDate')
        if s_date:
            dt = parse_latvian_date(s_date)
            if dt > latest_dt:
                latest_dt = dt
                latest_date_str = s_date

    print(f"[OK] Pārbaudīti {len(votes)} balsojumi.")
    print(f"[OK] Jaunākais konstatētais sēdes datums: {latest_date_str}")

    # 4. Update metadata.json if requested
    if update_metadata and len(errors) == 0:
        now_utc = datetime.now(timezone.utc)
        meta = {
            "lastSync": now_utc.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "formattedSyncDate": now_utc.strftime("%d.%m.%Y"),
            "totalVotes": len(votes),
            "latestSittingDate": latest_date_str or "12.02.2026",
            "saeimaTerm": 14,
            "status": "healthy"
        }
        save_json(METADATA_FILE, meta)
        print(f"[OK] Atjaunots metadata.json (Sinhronizēts: {meta['formattedSyncDate']})")

    return errors, warnings

def check_live_site(live_url):
    errors = []
    warnings = []
    print(f"[*] Veic tiešsaistes pārbaudi: {live_url}")

    # Remove trailing slash
    base_url = live_url.rstrip('/')

    # Test main page
    try:
        req = urllib.request.Request(
            base_url + '/',
            headers={'User-Agent': 'kabalsosaeima-sentinel/1.0'}
        )
        with urllib.request.urlopen(req, timeout=15) as res:
            if res.status != 200:
                errors.append(f"Mājaslapa `{base_url}` atgrieza HTTP kodu {res.status}")
            else:
                html = res.read().decode('utf-8', errors='ignore')
                if 'Kā Balso Saeima' not in html and 'root' not in html:
                    warnings.append("Mājaslapas HTML nesatur paredzētos elementus.")
    except Exception as e:
        errors.append(f"Neizdevās sasniegt mājaslapu `{base_url}`: {e}")

    # Test votes.json endpoint
    data_url = base_url + '/data/votes.json'
    try:
        req = urllib.request.Request(
            data_url,
            headers={'User-Agent': 'kabalsosaeima-sentinel/1.0'}
        )
        with urllib.request.urlopen(req, timeout=15) as res:
            if res.status != 200:
                errors.append(f"Datu galapunkts `{data_url}` atgrieza HTTP kodu {res.status}")
            else:
                data = json.loads(res.read().decode('utf-8'))
                if not isinstance(data, list) or len(data) == 0:
                    errors.append(f"Datu galapunkts `{data_url}` atgrieza tukšu sarakstu.")
                else:
                    print(f"[OK] Tiešsaistē pieejami {len(data)} balsojumi.")
    except Exception as e:
        errors.append(f"Neizdevās ielādēt datus no `{data_url}`: {e}")

    # Test metadata.json endpoint
    meta_url = base_url + '/data/metadata.json'
    try:
        req = urllib.request.Request(
            meta_url,
            headers={'User-Agent': 'kabalsosaeima-sentinel/1.0'}
        )
        with urllib.request.urlopen(req, timeout=15) as res:
            if res.status == 200:
                meta = json.loads(res.read().decode('utf-8'))
                print(f"[OK] Tiešsaistes metadati: Pēdējā sēde: {meta.get('latestSittingDate')}, Sinhr: {meta.get('formattedSyncDate')}")
    except Exception:
        warnings.append(f"Neizdevās nolasīt `{meta_url}` (var būt vēl neizvietots).")

    return errors, warnings

def write_alert_report(errors, warnings, context_label="Automātiskā pārbaude"):
    now_str = datetime.now(timezone.utc).strftime("%d.%m.%Y %H:%M:%S UTC")
    lines = [
        f"## 🚨 Brīdinājums: kabalsosaeima.lv {context_label} konstatēja kļūdas",
        "",
        f"**Laiks:** {now_str}",
        f"**Statuss:** Kritiskas kļūdas ({len(errors)}) | Brīdinājumi ({len(warnings)})",
        "",
        "### Konstatētās kļūdas:",
    ]
    for err in errors:
        lines.append(f"- ❌ {err}")

    if warnings:
        lines.append("")
        lines.append("### Brīdinājumi:")
        for w in warnings:
            lines.append(f"- ⚠️ {w}")

    lines.extend([
        "",
        "---",
        "*Šis paziņojums ir automātiski ģenerēts no `scripts/sentinel_check.py`. Izvietošana ir apturēta, lai saglabātu iepriekšējo stabilo versiju.*"
    ])

    report_content = "\n".join(lines)
    with open(REPORT_FILE, 'w', encoding='utf-8') as f:
        f.write(report_content)
    print(f"[!] Izveidots avārijas ziņojums failā: {REPORT_FILE}")

def main():
    parser = argparse.ArgumentParser(description="kabalsosaeima.lv Sentinel & Integrity Guardian")
    parser.add_argument('--mode', choices=['integrity', 'live', 'all'], default='integrity',
                        help="Pārbaudes režīms: 'integrity' (vietējie dati), 'live' (tiešsaistes URL), vai 'all'")
    parser.add_argument('--url', default='https://kabalsosaeima.lv',
                        help="Tiešsaistes vietnes URL (tikai mode=live vai mode=all)")
    parser.add_argument('--update-metadata', action='store_true',
                        help="Automātiski atjaunot metadata.json ar šī brīža laiku un jaunāko sēdes datumu")

    args = parser.parse_args()

    all_errors = []
    all_warnings = []

    if args.mode in ['integrity', 'all']:
        errs, warns = check_local_integrity(update_metadata=args.update_metadata)
        all_errors.extend(errs)
        all_warnings.extend(warns)

    if args.mode in ['live', 'all']:
        errs, warns = check_live_site(args.url)
        all_errors.extend(errs)
        all_warnings.extend(warns)

    if all_errors:
        print("\n" + "="*50)
        print(f"❌ INTEGRITĀTES PĀRBAUDE NEIZDEVĀS: {len(all_errors)} kļūdas!")
        for e in all_errors:
            print(f"  - {e}")
        print("="*50)
        write_alert_report(all_errors, all_warnings, context_label=args.mode.upper())
        sys.exit(1)
    else:
        print("\n✅ Visi integritātes testi veiksmīgi nokārtoti (0 kļūdas).")
        # Remove report file if previously existed and now clean
        if os.path.exists(REPORT_FILE):
            try:
                os.remove(REPORT_FILE)
            except Exception:
                pass
        sys.exit(0)

if __name__ == '__main__':
    main()
