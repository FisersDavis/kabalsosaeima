#!/usr/bin/env python3
"""
Saeima MP Analytics & Dossier Generator (kābalsosaeima.lv)
Precomputes authentic 4-card MP analytics:
1. Mandate & Identity
2. 3-Segment Attendance & Quorum Tactics (Satversme Art. 24)
3. Faction Cohesion Score & Specific Vote Deviations
4. Chronological Vote History
"""

import os
import json
from collections import defaultdict

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "public", "data")
ROLLCALLS_DIR = os.path.join(DATA_DIR, "rollcalls")
DOSSIERS_DIR = os.path.join(DATA_DIR, "mp_dossiers")

def build_analytics():
    os.makedirs(DOSSIERS_DIR, exist_ok=True)

    with open(os.path.join(DATA_DIR, "votes.json"), "r", encoding="utf-8") as f:
        votes = json.load(f)

    with open(os.path.join(DATA_DIR, "mps.json"), "r", encoding="utf-8") as f:
        mps = json.load(f)

    with open(os.path.join(DATA_DIR, "factions.json"), "r", encoding="utf-8") as f:
        factions = json.load(f)

    mp_map = {m["id"]: m for m in mps}
    faction_map = {f["id"]: f for f in factions}

    # Pre-index votes and determine faction majority lines
    # For each vote: faction_id -> majority active decision ('PAR' | 'PRET' | 'ATTURAS')
    vote_faction_lines = {}
    vote_records = {}

    for v in votes:
        vid = v["id"]
        vote_records[vid] = v
        vote_faction_lines[vid] = {}

        # If factionBreakdown exists in vote, determine majority
        fb_list = v.get("factionBreakdown", [])
        for fb in fb_list:
            fid = fb["factionId"]
            votes_counts = fb.get("votes", {})
            par_c = votes_counts.get("par", 0)
            pret_c = votes_counts.get("pret", 0)
            att_c = votes_counts.get("atturas", 0)

            # Majority of active voters
            decisions = [("PAR", par_c), ("PRET", pret_c), ("ATTURAS", att_c)]
            decisions.sort(key=lambda x: x[1], reverse=True)
            if decisions[0][1] > 0:
                vote_faction_lines[vid][fid] = decisions[0][0]
            else:
                vote_faction_lines[vid][fid] = None

    # Load all rollcalls into a fast lookup: mpId -> list of { voteId, decision }
    mp_votes_log = defaultdict(dict)

    # Build parent bill titles lookup for bare proposals (e.g., "1. priekšlikums")
    bill_parent_titles = {}
    for v in votes:
        b = v.get("billNumber")
        t = v.get("simplifiedTitle") or v.get("officialTitle", "")
        if b and not ("priekšlikums" in t.lower() or t.startswith("Par priekšlikumu")):
            clean = t.replace("Par likumprojekta ", "").replace("Par likumprojektu ", "").replace("Likumprojekts ", "").strip()
            if b not in bill_parent_titles or len(clean) > len(bill_parent_titles[b]):
                bill_parent_titles[b] = clean

    rollcall_files = os.listdir(ROLLCALLS_DIR)
    for rf in rollcall_files:
        if not rf.endswith(".json"):
            continue
        vid = rf[:-5]
        rc_path = os.path.join(ROLLCALLS_DIR, rf)
        try:
            with open(rc_path, "r", encoding="utf-8") as f:
                records = json.load(f)
                for r in records:
                    mp_id = r.get("mpId")
                    if mp_id:
                        mp_votes_log[mp_id][vid] = r.get("decision", "NAV_REGISTRETS")
        except Exception as e:
            print(f"Warning: could not read rollcall {rf}: {e}")

    # Build analytics for each MP
    summaries = {}
    total_votes_count = len(votes)

    for mp in mps:
        mp_id = mp["id"]
        fid = mp.get("factionId", "ind")
        is_independent = (fid == "ind")

        # Counts
        present_count = 0  # PAR, PRET, ATTURAS
        withheld_count = 0 # NEBALSO (in chamber, quorum maneuver)
        absent_count = 0   # NAV_REGISTRETS or missing

        par_count = 0
        pret_count = 0
        atturas_count = 0

        # Cohesion
        active_aligned_count = 0
        active_total_count = 0
        deviations = []

        history = []

        for v in votes:
            vid = v["id"]
            decision = mp_votes_log[mp_id].get(vid, "NAV_REGISTRETS")

            if decision == "PAR":
                present_count += 1
                par_count += 1
            elif decision == "PRET":
                present_count += 1
                pret_count += 1
            elif decision == "ATTURAS":
                present_count += 1
                atturas_count += 1
            elif decision == "NEBALSO":
                withheld_count += 1
            else:
                absent_count += 1

            # Check deviation if MP was active and not independent
            if not is_independent and decision in ("PAR", "PRET", "ATTURAS"):
                faction_line = vote_faction_lines[vid].get(fid)
                if faction_line:
                    active_total_count += 1
                    if decision == faction_line:
                        active_aligned_count += 1
                    else:
                        is_opposite = (decision == "PAR" and faction_line in ("PRET", "ATTURAS")) or \
                                      (faction_line == "PAR" and decision in ("PRET", "ATTURAS"))
                        dev_type = "OPPOSITE" if is_opposite else "NUANCE"
                        b_num = v.get("billNumber")
                        parent_title = bill_parent_titles.get(b_num) if b_num else None
                        deviations.append({
                            "voteId": vid,
                            "title": v.get("simplifiedTitle") or v.get("officialTitle"),
                            "sittingDate": v.get("sittingDate", ""),
                            "decision": decision,
                            "factionLine": faction_line,
                            "result": v.get("result", "PIENEMTS"),
                            "category": v.get("category", {}).get("label", "Valsts pārvalde"),
                            "deviationType": dev_type,
                            "parentBillTitle": parent_title
                        })

            b_num = v.get("billNumber")
            parent_title = bill_parent_titles.get(b_num) if b_num else None
            history.append({
                "voteId": vid,
                "title": v.get("simplifiedTitle") or v.get("officialTitle"),
                "sittingDate": v.get("sittingDate", ""),
                "decision": decision,
                "result": v.get("result", "PIENEMTS"),
                "category": v.get("category", {}).get("label", "Valsts pārvalde"),
                "categoryId": v.get("category", {}).get("id", "administracija"),
                "parentBillTitle": parent_title
            })

        # Calculate percentages
        present_pct = round((present_count / total_votes_count) * 100, 1) if total_votes_count > 0 else 0.0
        withheld_pct = round((withheld_count / total_votes_count) * 100, 1) if total_votes_count > 0 else 0.0
        absent_pct = round((absent_count / total_votes_count) * 100, 1) if total_votes_count > 0 else 0.0

        if not is_independent and active_total_count > 0:
            cohesion_pct = round((active_aligned_count / active_total_count) * 100, 1)
        elif is_independent:
            cohesion_pct = None
        else:
            cohesion_pct = 100.0

        opposite_count = sum(1 for d in deviations if d["deviationType"] == "OPPOSITE")
        nuance_count = sum(1 for d in deviations if d["deviationType"] == "NUANCE")

        # Dossier payload
        dossier = {
            "mp": mp,
            "faction": faction_map.get(fid, {"id": fid, "name": "Pie frakcijām nepiederošie", "shortName": "PIEFR", "color": "#64748b"}),
            "totalVotes": total_votes_count,
            "attendance": {
                "presentCount": present_count,
                "presentPct": present_pct,
                "withheldCount": withheld_count,
                "withheldPct": withheld_pct,
                "absentCount": absent_count,
                "absentPct": absent_pct
            },
            "votesBreakdown": {
                "par": par_count,
                "pret": pret_count,
                "atturas": atturas_count,
                "nebalso": withheld_count,
                "navRegistrets": absent_count
            },
            "cohesion": {
                "isIndependent": is_independent,
                "cohesionPct": cohesion_pct,
                "activeTotalCount": active_total_count,
                "activeAlignedCount": active_aligned_count,
                "deviationsCount": len(deviations),
                "oppositeCount": opposite_count,
                "nuanceCount": nuance_count,
                "deviations": deviations
            },
            "votingHistory": history
        }

        # Save individual dossier
        dossier_path = os.path.join(DOSSIERS_DIR, f"{mp_id}.json")
        with open(dossier_path, "w", encoding="utf-8") as f:
            json.dump(dossier, f, ensure_ascii=False, indent=2)

        # Summary entry for fast lookup in MpDirectoryView
        summaries[mp_id] = {
            "presentPct": present_pct,
            "withheldPct": withheld_pct,
            "absentPct": absent_pct,
            "cohesionPct": cohesion_pct,
            "deviationsCount": len(deviations),
            "oppositeCount": opposite_count,
            "nuanceCount": nuance_count,
            "isIndependent": is_independent
        }

    # Save summaries
    summary_path = os.path.join(DATA_DIR, "mp_summaries.json")
    with open(summary_path, "w", encoding="utf-8") as f:
        json.dump(summaries, f, ensure_ascii=False, indent=2)

    print(f"[OK] Generated {len(mps)} MP dossiers in {DOSSIERS_DIR}")
    print(f"[OK] Generated summary index in {summary_path}")

if __name__ == "__main__":
    build_analytics()
