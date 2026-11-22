#!/usr/bin/env python3
"""
kābalsosaeima.lv — Automated Sentinel & Integrity Guardian (v2)
----------------------------------------------------------------
Zero-tolerance self-checking engine:
1. Validates multi-term parliamentary data integrity (15. Saeima active + 14. Saeima archive).
2. Enforces Satversme Art. 24 (50-MP quorum) & Art. 76 (67-MP 2/3 constitutional quorum).
3. Enforces 100-seat chamber ceiling on mandates.json AND factionBreakdown sums (never 113!).
4. Enforces data freshness on the active term (fails if sync or sitting data goes stale outside recess).
5. Performs live endpoint smoke & freshness checks.
6. Generates structured diagnostic markdown reports on failure for GitHub Automated Issues.
"""

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone

if sys.stdout.encoding != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC_DATA_DIR = os.path.join(BASE_DIR, "public", "data")
TERMS_DIR = os.path.join(PUBLIC_DATA_DIR, "terms")
REPORT_FILE = os.path.join(BASE_DIR, "alert_report.md")
ACTIVE_TERM = 15


def load_json(filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        return json.load(f)


def save_json(filepath, data):
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def parse_latvian_date(date_str):
    try:
        parts = (date_str or "").strip().split(".")
        if len(parts) == 3:
            return datetime(int(parts[2]), int(parts[1]), int(parts[0]))
    except Exception:
        pass
    return None


def parse_latvian_iso(date_str):
    dt = parse_latvian_date(date_str)
    return dt.strftime("%Y-%m-%d") if dt else None


def is_parliament_in_recess(dt=None):
    """Checks whether Saeima is in scheduled seasonal recess."""
    if dt is None:
        dt = datetime.now(timezone.utc)
    m, d = dt.month, dt.day
    if (m == 12 and d >= 22) or (m == 1 and d <= 10):
        return True, "Ziemas sesiju starplaiks"
    if (m == 6 and d >= 20) or m in (7, 8) or (m == 9 and d <= 1):
        return True, "Vasaras sesiju starplaiks"
    return False, ""


def is_mandate_active(intervals, iso_date):
    for iv in intervals:
        f_dt = iv["from"]
        t_dt = iv.get("to")
        if f_dt <= iso_date and (t_dt is None or iso_date < t_dt):
            return True
    return False


def audit_term_dir(term_label, data_dir, is_active_term=False, update_metadata=False):
    errors = []
    warnings = []

    votes_file = os.path.join(data_dir, "votes.json")
    mps_file = os.path.join(data_dir, "mps.json")
    mandates_file = os.path.join(data_dir, "mandates.json")
    factions_file = os.path.join(data_dir, "factions.json")
    metadata_file = os.path.join(data_dir, "metadata.json")
    rollcalls_dir = os.path.join(data_dir, "rollcalls")

    print(f"[*] Auditing {term_label} ({data_dir})...")

    for fname, fpath in [
        ("votes.json", votes_file),
        ("mps.json", mps_file),
        ("mandates.json", mandates_file),
        ("factions.json", factions_file),
    ]:
        if not os.path.exists(fpath):
            errors.append(f"[{term_label}] Kritisks datu fails trūkst: `{fname}`")
            return errors, warnings

    votes = load_json(votes_file)
    mps = load_json(mps_file)
    mandates = load_json(mandates_file)
    factions = load_json(factions_file)

    if len(votes) == 0:
        errors.append(f"[{term_label}] `votes.json` ir tukšs (0 balsojumi).")
        return errors, warnings

    if len(mps) != len(mandates):
        errors.append(f"[{term_label}] `mps.json` ({len(mps)}) nesakrīt ar `mandates.json` ({len(mandates)}).")
    if len({m.get("id") for m in mps}) != len(mps):
        errors.append(f"[{term_label}] Atrasti dublējoši deputātu ID failā `mps.json`.")
    if len({m.get("mpId") for m in mandates}) != len(mandates):
        errors.append(f"[{term_label}] Atrasti dublējoši deputātu ID failā `mandates.json`.")

    mandates_by_mp = {m["mpId"]: m["active"] for m in mandates}
    seen_vote_ids = set()
    latest_dt = None
    latest_date_str = ""
    checked_dates = set()

    for idx, v in enumerate(votes):
        vid = v.get("id", f"index-{idx}")
        if vid in seen_vote_ids:
            errors.append(f"[{term_label}] Dublējošs balsojuma ID: `{vid}`")
        seen_vote_ids.add(vid)

        s_date = v.get("sittingDate", "")
        dt = parse_latvian_date(s_date)
        iso_date = dt.strftime("%Y-%m-%d") if dt else None
        if not iso_date:
            errors.append(f"[{term_label}] Balsojumam `{vid}` nederīgs datums: `{s_date}`")
            continue

        if latest_dt is None or dt > latest_dt:
            latest_dt = dt
            latest_date_str = s_date

        # Check chamber ceiling invariant once per sitting date
        if iso_date not in checked_dates:
            checked_dates.add(iso_date)
            active_on_date = sum(1 for ivs in mandates_by_mp.values() if is_mandate_active(ivs, iso_date))
            if active_on_date > 100:
                errors.append(f"[{term_label}] CEILING VIOLATION: {active_on_date} aktīvi mandāti datumā {iso_date} (>100).")
            elif active_on_date < 95:
                warnings.append(f"[{term_label}] Neparasti maz aktīvu mandātu datumā {iso_date}: {active_on_date}.")

        counts = v.get("counts", {})
        par = counts.get("par", 0)
        pret = counts.get("pret", 0)
        atturas = counts.get("atturas", 0)
        nebalso = counts.get("nebalso", 0)
        total_present = par + pret + atturas
        total_recorded = total_present + nebalso

        if not v.get("isSecret"):
            if total_recorded < 95 or total_recorded > 100:
                errors.append(
                    f"[{term_label}] Balsojumā `{vid}` kopējais deputātu skaits ir {total_recorded}, nevis 95–100."
                )

            rc_path = os.path.join(rollcalls_dir, f"{vid}.json")
            if not os.path.exists(rc_path):
                errors.append(f"[{term_label}] Balsojumam `{vid}` trūkst rollcall fails: `{rc_path}`")
            else:
                mp_votes = load_json(rc_path)
                par_mps = sum(1 for m in mp_votes if m.get("decision") == "PAR")
                pret_mps = sum(1 for m in mp_votes if m.get("decision") == "PRET")
                atturas_mps = sum(1 for m in mp_votes if m.get("decision") == "ATTURAS")
                if par_mps != par or pret_mps != pret or atturas_mps != atturas:
                    errors.append(
                        f"[{term_label}] Balsojumā `{vid}` rollcall ({par_mps}/{pret_mps}/{atturas_mps}) nesakrīt ar counts ({par}/{pret}/{atturas})."
                    )

            # Enforce truthful factionBreakdown sums (never 113-seat phantom padding!)
            fb = v.get("factionBreakdown", [])
            fb_par = sum(f.get("votes", {}).get("par", 0) for f in fb)
            fb_pret = sum(f.get("votes", {}).get("pret", 0) for f in fb)
            fb_att = sum(f.get("votes", {}).get("atturas", 0) for f in fb)
            fb_neb = sum(f.get("votes", {}).get("nebalso", 0) for f in fb)
            fb_tot = fb_par + fb_pret + fb_att + fb_neb
            if (fb_par, fb_pret, fb_att, fb_neb) != (par, pret, atturas, nebalso):
                errors.append(
                    f"[{term_label}] Balsojumā `{vid}` factionBreakdown ({fb_par}/{fb_pret}/{fb_att}/neb={fb_neb}, tot={fb_tot}) nesakrīt ar counts ({par}/{pret}/{atturas}/neb={nebalso})."
                )
            if fb_tot > 100:
                errors.append(f"[{term_label}] Balsojumā `{vid}` factionBreakdown summa pārsniedz 100 vietas ({fb_tot}).")

        # Constitutional outcome verification
        title_low = (v.get("officialTitle") or "").lower()
        is_const_amendment = (
            "satversm" in title_low
            and ("grozījum" in title_low or "likumprojekts" in title_low)
            and v.get("voteType") == "likums"
            and (v.get("reading") == 3 or "3. las" in (v.get("readingStage") or "").lower() or "galīg" in (v.get("readingStage") or "").lower())
        )
        result = v.get("result")
        if is_const_amendment:
            expected = "NAV_KVORUMA" if total_present < 67 else ("PIENEMTS" if par >= (2 * total_present / 3.0) else "NORAIDITS")
        else:
            expected = "NAV_KVORUMA" if total_present < 50 else ("PIENEMTS" if par > (pret + atturas) else "NORAIDITS")
        if result != expected:
            errors.append(f"[{term_label}] Balsojumā `{vid}` rezultāts `{result}` nesakrīt ar Satversmes aprēķinu `{expected}`.")

    # Check for orphan rollcall files
    if os.path.isdir(rollcalls_dir):
        rc_files = [f for f in os.listdir(rollcalls_dir) if f.endswith(".json")]
        non_secret_ids = {v["id"] for v in votes if not v.get("isSecret")}
        orphans = [f for f in rc_files if f[:-5] not in non_secret_ids]
        if orphans:
            warnings.append(f"[{term_label}] Atrasti {len(orphans)} lieki rollcall faili bez atbilstoša balsojuma.")

    # Freshness / Staleness Check for the active parliamentary term!
    if is_active_term:
        now_utc = datetime.now(timezone.utc)
        in_recess, recess_name = is_parliament_in_recess(now_utc)

        if latest_dt and not in_recess:
            age_days = (now_utc.replace(tzinfo=None) - latest_dt).days
            if age_days > 28:
                errors.append(
                    f"[{term_label}] DATI IR NOVECOJUŠI: jaunākā sēde ir `{latest_date_str}` (pirms {age_days} dienām; ārpus sesiju starplaika)."
                )
            elif age_days > 14:
                warnings.append(
                    f"[{term_label}] Brīdinājums: jaunākā sēde `{latest_date_str}` bija pirms {age_days} dienām."
                )

        if os.path.exists(metadata_file) and not update_metadata:
            meta = load_json(metadata_file)
            last_sync_str = meta.get("lastSync", "")
            try:
                sync_dt = datetime.strptime(last_sync_str, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
                sync_age = (now_utc - sync_dt).days
                if sync_age > 10:
                    errors.append(
                        f"[{term_label}] Pēdējā sinhronizācija (`lastSync`: {last_sync_str}) bija pirms {sync_age} dienām (>10 dienu limits)."
                    )
            except Exception:
                warnings.append(f"[{term_label}] Neizdevās nolasīt `lastSync` no metadata.json: {last_sync_str!r}")

    print(f"      [OK] {term_label}: {len(votes)} balsojumi, {len(mps)} deputāti, jaunākā sēde: {latest_date_str}")

    if update_metadata and len(errors) == 0:
        now_utc = datetime.now(timezone.utc)
        term_num = votes[0].get("saeimaTerm", ACTIVE_TERM)
        meta = {
            "lastSync": now_utc.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "formattedSyncDate": now_utc.strftime("%d.%m.%Y"),
            "totalVotes": len(votes),
            "latestSittingDate": latest_date_str,
            "saeimaTerm": term_num,
            "status": "healthy",
        }
        save_json(metadata_file, meta)
        if is_active_term:
            save_json(os.path.join(PUBLIC_DATA_DIR, "metadata.json"), meta)
        print(f"      [OK] Atjaunots metadata.json ({meta['formattedSyncDate']})")

    return errors, warnings


def check_local_integrity(update_metadata=False):
    all_errors = []
    all_warnings = []

    in_recess, recess_name = is_parliament_in_recess()
    if in_recess:
        print(f"[*] Piezīme: Saeima atrodas sesiju starplaikā ({recess_name}).")

    # Audit multi-term directories if present, else fallback to public/data
    if os.path.isdir(TERMS_DIR):
        term_dirs = sorted(
            [d for d in os.listdir(TERMS_DIR) if d.isdigit() and os.path.isdir(os.path.join(TERMS_DIR, d))],
            key=int,
            reverse=True,
        )
        if not term_dirs:
            all_errors.append("`public/data/terms/` nesatur neviena sasaukuma datus.")
            return all_errors, all_warnings

        for t_str in term_dirs:
            t_num = int(t_str)
            errs, warns = audit_term_dir(
                f"{t_num}. Saeima",
                os.path.join(TERMS_DIR, t_str),
                is_active_term=(t_num == ACTIVE_TERM),
                update_metadata=update_metadata,
            )
            all_errors.extend(errs)
            all_warnings.extend(warns)
    else:
        errs, warns = audit_term_dir("Aktīvais sasaukums", PUBLIC_DATA_DIR, is_active_term=True, update_metadata=update_metadata)
        all_errors.extend(errs)
        all_warnings.extend(warns)

    return all_errors, all_warnings


def check_live_site(live_url):
    errors = []
    warnings = []
    base_url = live_url.rstrip("/")
    print(f"[*] Veic tiešsaistes pārbaudi: {base_url}")

    # 1. Main page
    try:
        req = urllib.request.Request(base_url + "/", headers={"User-Agent": "kabalsosaeima-sentinel/2.0"})
        with urllib.request.urlopen(req, timeout=15) as res:
            if res.status != 200:
                errors.append(f"Mājaslapa `{base_url}` atgrieza HTTP kodu {res.status}")
            else:
                html = res.read().decode("utf-8", errors="ignore")
                if "Kā Balso Saeima" not in html:
                    warnings.append("Mājaslapas HTML nesatur virsrakstu 'Kā Balso Saeima'.")
    except Exception as e:
        errors.append(f"Neizdevās sasniegt mājaslapu `{base_url}`: {e}")

    # 2. votes.json endpoint
    data_url = base_url + "/data/votes.json"
    try:
        req = urllib.request.Request(data_url, headers={"User-Agent": "kabalsosaeima-sentinel/2.0"})
        with urllib.request.urlopen(req, timeout=15) as res:
            if res.status != 200:
                errors.append(f"Datu galapunkts `{data_url}` atgrieza HTTP kodu {res.status}")
            else:
                data = json.loads(res.read().decode("utf-8"))
                if not isinstance(data, list) or len(data) == 0:
                    errors.append(f"Datu galapunkts `{data_url}` atgrieza tukšu sarakstu.")
                else:
                    print(f"[OK] Tiešsaistē pieejami {len(data)} aktīvā sasaukuma balsojumi.")
    except Exception as e:
        errors.append(f"Neizdevās ielādēt datus no `{data_url}`: {e}")

    # 3. metadata.json freshness endpoint
    meta_url = base_url + "/data/metadata.json"
    try:
        req = urllib.request.Request(meta_url, headers={"User-Agent": "kabalsosaeima-sentinel/2.0"})
        with urllib.request.urlopen(req, timeout=15) as res:
            if res.status == 200:
                meta = json.loads(res.read().decode("utf-8"))
                print(
                    f"[OK] Tiešsaistes metadati: {meta.get('saeimaTerm')}. Saeima | "
                    f"Pēdējā sēde: {meta.get('latestSittingDate')} | Sinhr: {meta.get('formattedSyncDate')}"
                )
                now_utc = datetime.now(timezone.utc)
                in_recess, _ = is_parliament_in_recess(now_utc)
                if not in_recess and meta.get("latestSittingDate"):
                    dt = parse_latvian_date(meta["latestSittingDate"])
                    if dt and (now_utc.replace(tzinfo=None) - dt).days > 28:
                        errors.append(
                            f"Tiešsaistes vietnes dati ir novecojuši! Pēdējā sēde: {meta['latestSittingDate']}."
                        )
    except Exception as e:
        warnings.append(f"Neizdevās nolasīt `{meta_url}`: {e}")

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
    for err in errors[:50]:
        lines.append(f"- ❌ {err}")
    if len(errors) > 50:
        lines.append(f"- ... un vēl {len(errors) - 50} kļūdas")

    if warnings:
        lines.append("")
        lines.append("### Brīdinājumi:")
        for w in warnings[:20]:
            lines.append(f"- ⚠️ {w}")

    lines.extend([
        "",
        "---",
        "*Automātiski ģenerēts no `scripts/sentinel_check.py`. Izvietošana apturēta, līdz datu integritāte ir atjaunota.*",
    ])

    with open(REPORT_FILE, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    print(f"[!] Izveidots avārijas ziņojums failā: {REPORT_FILE}")


def main():
    parser = argparse.ArgumentParser(description="kabalsosaeima.lv Sentinel & Integrity Guardian v2")
    parser.add_argument("--mode", choices=["integrity", "live", "all"], default="integrity")
    parser.add_argument("--url", default="https://kabalsosaeima.lv")
    parser.add_argument("--update-metadata", action="store_true")
    args = parser.parse_args()

    all_errors = []
    all_warnings = []

    if args.mode in ("integrity", "all"):
        errs, warns = check_local_integrity(update_metadata=args.update_metadata)
        all_errors.extend(errs)
        all_warnings.extend(warns)

    if args.mode in ("live", "all"):
        errs, warns = check_live_site(args.url)
        all_errors.extend(errs)
        all_warnings.extend(warns)

    if all_warnings:
        print(f"\n⚠️ Brīdinājumi ({len(all_warnings)}):")
        for w in all_warnings[:15]:
            print(f"  - {w}")

    if all_errors:
        print("\n" + "=" * 60)
        print(f"❌ INTEGRITĀTES PĀRBAUDE NEIZDEVĀS: {len(all_errors)} kļūdas!")
        for e in all_errors[:30]:
            print(f"  - {e}")
        if len(all_errors) > 30:
            print(f"  ... un vēl {len(all_errors) - 30} kļūdas")
        print("=" * 60)
        write_alert_report(all_errors, all_warnings, context_label=args.mode.upper())
        sys.exit(1)

    print("\n✅ Visi integritātes un aktualitātes testi veiksmīgi nokārtoti (0 kļūdas).")
    if os.path.exists(REPORT_FILE):
        try:
            os.remove(REPORT_FILE)
        except Exception:
            pass
    sys.exit(0)


if __name__ == "__main__":
    main()
