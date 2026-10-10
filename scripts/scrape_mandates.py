#!/usr/bin/env python3
"""
scripts/scrape_mandates.py

Scrapes official deputy dossiers from Latvia Saeima's Titania system:
- Discovers all 14. Saeima deputies and their unique Titania UNIDs
- Fetches official mandate intervals (drawMand) with exact dates and reasons
- Maps UNIDs to public/data/mps.json
- Generates public/data/mandates.json with full provenance (source URL + fetchedAt)
- Performs an audit against all rollcall vote files
- Checks chamber size on EVERY sitting date in votes.json
"""

import urllib.request
import re
import json
import os
import sys
from datetime import datetime, timezone
from collections import defaultdict

sys.stdout.reconfigure(encoding='utf-8')

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "public", "data")
MPS_FILE = os.path.join(DATA_DIR, "mps.json")
VOTES_FILE = os.path.join(DATA_DIR, "votes.json")
ROLLCALLS_DIR = os.path.join(DATA_DIR, "rollcalls")
MANDATES_FILE = os.path.join(DATA_DIR, "mandates.json")

TITANIA_VIEWS = [
    "https://titania.saeima.lv/Personal/Deputati/Saeima14_DepWeb_Public.nsf/deputies?OpenView&lang=LV&count=1000",
    "https://titania.saeima.lv/Personal/Deputati/Saeima14_DepWeb_Public.nsf/deputiesByMandate?OpenView&restricttocategory=1&lang=LV&count=1000",
    "https://titania.saeima.lv/Personal/Deputati/Saeima14_DepWeb_Public.nsf/deputiesByMandate?OpenView&restricttocategory=2&lang=LV&count=1000",
    "https://titania.saeima.lv/Personal/Deputati/Saeima14_DepWeb_Public.nsf/deputiesByMandateStart?OpenView&restricttocategory=1&lang=LV&count=1000",
]

def parse_latvian_date(d_str):
    if not d_str or not d_str.strip():
        return None
    try:
        dt = datetime.strptime(d_str.strip(), "%d.%m.%Y")
        return dt.strftime("%Y-%m-%d")
    except Exception:
        return None

def fetch_url(url):
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) kabalsosaeima/1.0"}
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        return resp.read().decode('utf-8', errors='ignore')

def main():
    print("=" * 70)
    print("1. DISCOVERING ALL 14. SAEIMA DEPUTIES FROM TITANIA...")
    print("=" * 70)
    
    discovered_deps = {} # unid -> props
    for u in TITANIA_VIEWS:
        try:
            html = fetch_url(u)
            for m in re.finditer(r'(?:drawDep|drawMand)\(\{([^}]+)\}\)', html):
                props = dict(re.findall(r'(\w+):"([^"]*)"', m.group(1)))
                unid = props.get('unid')
                if unid and unid not in discovered_deps:
                    discovered_deps[unid] = props
        except Exception as e:
            print(f"[!] Error fetching view {u}: {e}")

    print(f"[*] Discovered {len(discovered_deps)} unique deputies in Titania database.")

    # 2. Fetch dossier and mandate history for each deputy
    print("\n" + "=" * 70)
    print("2. FETCHING OFFICIAL DOSSIERS & MANDATE INTERVALS...")
    print("=" * 70)

    fetched_at = datetime.now(timezone.utc).isoformat()
    deputy_mandates = {} # unid -> {name, intervals: [{"from", "to", "reason"}], note, source}

    count = 0
    total = len(discovered_deps)
    for unid, info in discovered_deps.items():
        count += 1
        dossier_url = f"https://titania.saeima.lv/Personal/Deputati/Saeima14_DepWeb_Public.nsf/0/{unid}?OpenDocument"
        if count % 25 == 0 or count == total:
            print(f"[{count}/{total}] Fetching dossiers...")
        
        try:
            html = fetch_url(dossier_url)
            mands = re.findall(r'drawMand\(\{([^}]+)\}\)', html)
            
            raw_intervals = []
            notes = []
            for mand in mands:
                props = dict(re.findall(r'(\w+):"([^"]*)"', mand))
                dt_from = parse_latvian_date(props.get('dtF'))
                dt_to = parse_latvian_date(props.get('dtT'))
                reason = props.get('mrreason') or props.get('mfreason') or ''
                if dt_from:
                    raw_intervals.append((dt_from, dt_to, reason))
                if props.get('mfreason'):
                    notes.append(props.get('mfreason'))
                elif props.get('mrreason'):
                    notes.append(props.get('mrreason'))

            # Deduplicate intervals
            unique_intervals = []
            seen_pairs = set()
            for f_dt, t_dt, r in raw_intervals:
                pair = (f_dt, t_dt)
                if pair not in seen_pairs:
                    seen_pairs.add(pair)
                    unique_intervals.append({
                        "from": f_dt,
                        "to": t_dt,
                        "reason": r
                    })

            # Sort by from date
            unique_intervals.sort(key=lambda x: x["from"])

            latest_note = notes[-1] if notes else ""
            deputy_mandates[unid] = {
                "sname": info.get('sname', ''),
                "name": info.get('name', ''),
                "fullName": f"{info.get('name', '')} {info.get('sname', '')}".strip(),
                "faction": info.get('shortStr', ''),
                "intervals": unique_intervals,
                "note": latest_note,
                "source": dossier_url,
                "fetchedAt": fetched_at
            }
        except Exception as e:
            print(f"[!] Error fetching dossier for {unid}: {e}")

    # 3. Match against local mps.json
    print("\n" + "=" * 70)
    print("3. RECONCILING WITH public/data/mps.json...")
    print("=" * 70)

    with open(MPS_FILE, "r", encoding="utf-8") as f:
        local_mps = json.load(f)

    # Name normalization mapping
    SPECIAL_NAME_FIXES = {
        "krišjānis kariņš": "arturs krišjānis kariņš",
    }

    titania_by_norm = {}
    for unid, d in deputy_mandates.items():
        norm = " ".join(d["fullName"].lower().split())
        titania_by_norm[norm] = unid

    matched_mps = 0
    unmatched_local_mps = []
    mandates_output = []

    for mp in local_mps:
        # Check by saeimaId first if already set
        unid = mp.get("saeimaId")
        if not unid:
            norm_name = " ".join(mp["name"].lower().split())
            if norm_name in SPECIAL_NAME_FIXES:
                norm_name = SPECIAL_NAME_FIXES[norm_name]
            unid = titania_by_norm.get(norm_name)

        if unid and unid in deputy_mandates:
            matched_mps += 1
            mp["saeimaId"] = unid
            m_data = deputy_mandates[unid]
            
            clean_active = [
                {"from": item["from"], "to": item["to"]}
                for item in m_data["intervals"]
            ]
            mandates_output.append({
                "mpId": mp["id"],
                "saeimaId": unid,
                "name": mp["name"],
                "slug": mp.get("slug", ""),
                "active": clean_active,
                "note": m_data["note"],
                "source": m_data["source"],
                "fetchedAt": m_data["fetchedAt"]
            })
        else:
            unmatched_local_mps.append(mp)

    print(f"[*] Successfully matched: {matched_mps} / {len(local_mps)} MPs.")
    if unmatched_local_mps:
        print(f"[!] Unmatched local MPs ({len(unmatched_local_mps)}):")
        for u in unmatched_local_mps:
            print(f"    - {u['id']}: {u['name']}")

    # Save updated mps.json
    with open(MPS_FILE, "w", encoding="utf-8") as f:
        json.dump(local_mps, f, ensure_ascii=False, indent=2)
    print(f"[OK] Updated {MPS_FILE} with saeimaId.")

    # Save mandates.json
    mandates_output.sort(key=lambda x: int(x["mpId"].split("-")[1]) if "-" in x["mpId"] else 0)
    with open(MANDATES_FILE, "w", encoding="utf-8") as f:
        json.dump(mandates_output, f, ensure_ascii=False, indent=2)
    print(f"[OK] Written {len(mandates_output)} records to {MANDATES_FILE}.")

    # 4. AUDIT & CONFLICT REPORT
    print("\n" + "=" * 70)
    print("4. RUNNING AUDIT & CONFLICT REPORT AGAINST ALL VOTES & ROLLCALLS...")
    print("=" * 70)

    with open(VOTES_FILE, "r", encoding="utf-8") as f:
        votes = json.load(f)

    # Index mandate intervals by mpId
    intervals_by_mp = {}
    for m in mandates_output:
        intervals_by_mp[m["mpId"]] = m["active"]

    def is_mandate_active(mp_id, date_str):
        intervals = intervals_by_mp.get(mp_id, [])
        for iv in intervals:
            f_dt = iv["from"]
            t_dt = iv.get("to")
            if f_dt <= date_str:
                if t_dt is None or date_str < t_dt:
                    return True
        return False

    rollcall_conflicts = []
    total_rollcall_votes_audited = 0
    votes_by_id = {v["id"]: v for v in votes}

    rc_files = [f for f in os.listdir(ROLLCALLS_DIR) if f.endswith(".json")]
    print(f"[*] Auditing {len(rc_files)} rollcall files against {len(votes)} votes...")

    for rf in rc_files:
        vid = rf[:-5]
        v_meta = votes_by_id.get(vid)
        if not v_meta:
            continue
        
        sitting_date_raw = v_meta.get("sittingDate") or v_meta.get("sessionDate")
        iso_date = parse_latvian_date(sitting_date_raw)
        if not iso_date:
            continue

        rc_path = os.path.join(ROLLCALLS_DIR, rf)
        with open(rc_path, "r", encoding="utf-8") as f:
            records = json.load(f)

        for rec in records:
            mp_id = rec.get("mpId")
            decision = rec.get("decision")
            total_rollcall_votes_audited += 1

            if decision in ["PAR", "PRET", "ATTURAS", "NEBALSO"]:
                if not is_mandate_active(mp_id, iso_date):
                    rollcall_conflicts.append({
                        "voteId": vid,
                        "date": iso_date,
                        "mpId": mp_id,
                        "name": rec.get("name"),
                        "decision": decision,
                        "title": v_meta.get("simplifiedTitle") or v_meta.get("officialTitle")
                    })

    # Count active mandates on EVERY sitting date in votes.json (rollcall or not)
    all_sitting_dates = sorted(list({
        parse_latvian_date(v.get("sittingDate") or v.get("sessionDate"))
        for v in votes
        if v.get("sittingDate") or v.get("sessionDate")
    }))

    chamber_anomalies = []
    for d in all_sitting_dates:
        active_on_date = [m["mpId"] for m in mandates_output if is_mandate_active(m["mpId"], d)]
        count_active = len(active_on_date)
        if count_active != 100:
            chamber_anomalies.append((d, count_active))

    print("\n" + "#" * 70)
    print("                    CONFLICT REPORT SUMMARY")
    print("#" * 70)
    print(f"Total Rollcall Votes Audited: {total_rollcall_votes_audited}")
    print(f"Total Unique Sitting Dates (Every Vote): {len(all_sitting_dates)}")
    print(f"Rollcall Participation Conflicts: {len(rollcall_conflicts)}")
    print(f"Dates with != 100 active mandates: {len(chamber_anomalies)}")

    if rollcall_conflicts:
        print("\n--- ROLLCALL PARTICIPATION CONFLICTS ---")
        for c in rollcall_conflicts:
            print(f"  • {c['name']} ({c['mpId']}) on {c['date']} in vote {c['voteId']}")

    if chamber_anomalies:
        print("\n--- CHAMBER SIZE AUDIT (Dates where active mandates != 100) ---")
        for d, cnt in chamber_anomalies:
            status = "EXCEEDS 100 (FATAL)" if cnt > 100 else "VACANCY (< 100)"
            print(f"  • Date: {d} -> {cnt} active mandates ({status})")

    print("\n" + "#" * 70)
    print("Step 0 finished.")

if __name__ == "__main__":
    main()
