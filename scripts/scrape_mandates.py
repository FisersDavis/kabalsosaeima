#!/usr/bin/env python3
"""
scripts/scrape_mandates.py

Multi-term official deputy & mandate scraper for kabalsosaeima.lv.
Scrapes official Latvian Saeima deputy registries directly from saeima.lv:
  https://www.saeima.lv/lv/sasaukumi/{term}-saeima/deputati/

Features:
- Supports 14. Saeima, 15. Saeima, and future Saeima terms (--term 15, --term 14, --all)
- Polite rate-limited fetching with exponential backoff retries (never silently drops pages)
- Parses structured `Mandāta vēsture` rows into exact [from, to) active mandate intervals
- Fails loudly on unknown Latvian mandate status strings so no interval is ever misparsed
- Preserves stable mpIds across re-runs and writes full source provenance (saeima.lv URL + fetchedAt)
- Audits active chamber size (<= 100) on every sitting date in votes.json (if present)
"""

import argparse
import html as html_lib
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
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

# Official term metadata
TERM_CONFIG = {
    14: {
        "term": 14,
        "label": "14. Saeima",
        "years": "2022–2026",
        "isActive": False,
        "basePath": "/14-saeima",
        "startDate": "2022-11-01",
        "endDate": "2026-11-03",
        "description": "14. Saeimas sasaukums (01.11.2022.–03.11.2026.)",
        "factions": [
            {"id": "jv", "name": "Jaunā VIENOTĪBA", "shortName": "JV", "color": "#00529B"},
            {"id": "zzs", "name": "Zaļo un Zemnieku savienība", "shortName": "ZZS", "color": "#1B5E20"},
            {"id": "pro", "name": "PROGRESĪVIE", "shortName": "PRO", "color": "#EA580C"},
            {"id": "as", "name": "APVIENOTAIS SARAKSTS", "shortName": "AS", "color": "#EAB308", "textColor": "#713F12"},
            {"id": "na", "name": "Nacionālā apvienība", "shortName": "NA", "color": "#831843"},
            {"id": "lpv", "name": "LATVIJA PIRMAJĀ VIETĀ", "shortName": "LPV", "color": "#E11D48"},
            {"id": "st", "name": "Stabilitātei!", "shortName": "S!", "color": "#475569"},
            {"id": "ind", "name": "Pie frakcijām nepiederošie", "shortName": "PIEFR", "color": "#94A3B8"},
        ],
    },
    15: {
        "term": 15,
        "label": "15. Saeima",
        "years": "2026–2030",
        "isActive": True,
        "basePath": "",
        "startDate": "2026-11-03",
        "endDate": None,
        "description": "15. Saeimas sasaukums (ievēlēta 2026. gada oktobrī)",
        "factions": [
            {"id": "jv", "name": "Jaunā Vienotība", "shortName": "JV", "color": "#00529B"},
            {"id": "as", "name": "APVIENOTAIS SARAKSTS", "shortName": "AS", "color": "#EAB308", "textColor": "#713F12"},
            {"id": "na", "name": "Nacionālā apvienība", "shortName": "NA", "color": "#831843"},
            {"id": "pro", "name": "PROGRESĪVIE", "shortName": "PRO", "color": "#EA580C"},
            {"id": "lpv", "name": "LATVIJA PIRMAJĀ VIETĀ", "shortName": "LPV", "color": "#E11D48"},
            {"id": "sv_aj", "name": "SUVERĒNĀ VARA / APVIENĪBA JAUNLATVIEŠI", "shortName": "SV/AJ", "color": "#4C1D95"},
            {"id": "ind", "name": "Pie frakcijām nepiederošie", "shortName": "PIEFR", "color": "#94A3B8"},
        ],
    },
}


def slugify_name(name: str) -> str:
    s = name.strip().lower()
    replacements = {
        "ā": "a", "č": "c", "ē": "e", "ģ": "g", "ī": "i",
        "ķ": "k", "ļ": "l", "ņ": "n", "š": "s", "ū": "u", "ž": "z",
    }
    for k, v in replacements.items():
        s = s.replace(k, v)
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def parse_latvian_date(d_str: str):
    if not d_str:
        return None
    m = re.search(r"(\d{2})\.(\d{2})\.(\d{4})", d_str.strip())
    if not m:
        return None
    return f"{m.group(3)}-{m.group(2)}-{m.group(1)}"


def map_faction_label(raw_label: str) -> str:
    low = (raw_label or "").strip().lower()
    if not low or "nepiederoš" in low or "piefr" in low:
        return "ind"
    if "vienotīb" in low or low == "jv":
        return "jv"
    if "zaļo un zemnieku" in low or low == "zzs":
        return "zzs"
    if "progresīv" in low or low == "pro":
        return "pro"
    if "apvienotais saraksts" in low or low == "as":
        return "as"
    if "nacionālā apvienība" in low or low == "na":
        return "na"
    if "latvija pirmajā vietā" in low or low == "lpv":
        return "lpv"
    if "stabilitāt" in low or low in ("st!", "s!"):
        return "st"
    if "suverēn" in low or "jaunlatvieš" in low or low == "sv/aj":
        return "sv_aj"
    raise ValueError(f"Unknown Saeima faction label on saeima.lv: {raw_label!r}")


def fetch_url(url: str, retries: int = 5, timeout: int = 25) -> str:
    last_err = None
    for attempt in range(1, retries + 1):
        try:
            req = urllib.request.Request(
                url,
                headers={
                    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) kabalsosaeima.lv/2.0",
                    "Accept": "text/html,application/xhtml+xml",
                    "Accept-Language": "lv,en;q=0.5",
                },
            )
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return resp.read().decode("utf-8", errors="replace")
        except Exception as e:
            last_err = e
            wait = min(16, 1.5 * (2 ** (attempt - 1)))
            if attempt < retries:
                time.sleep(wait)
    raise RuntimeError(f"Failed to fetch {url} after {retries} retries: {last_err}")


def classify_mandate_event(status_text: str) -> str:
    """Classify a Latvian mandate history status as 'START' or 'END'. Fails loudly if unknown."""
    low = status_text.strip().lower()
    start_markers = (
        "apstiprināts",
        "apstiprinātas",
        "atjaunots",
        "atjaunotas",
        "ievēlēts",
        "ievēlēta",
        "stājies",
        "stājusies",
    )
    end_markers = (
        "nolicis",
        "nolikusi",
        "izbeigušās",
        "izbeidzies",
        "apturēts",
        "apturētas",
        "zaudējis",
        "zaudējusi",
        "atsaukts",
        "atsaukta",
        "izslēgts",
        "izslēgta",
        "miris",
        "mirusi",
        "beigušās",
        "anulēts",
    )
    is_start = any(m in low for m in start_markers)
    is_end = any(m in low for m in end_markers)
    if is_start and not is_end:
        return "START"
    if is_end and not is_start:
        return "END"
    raise ValueError(f"Unrecognized Latvian mandate status text: {status_text!r}")


def parse_mandate_history(page_html: str, dep_url: str):
    """Extract ordered mandate intervals and latest note from a saeima.lv deputy profile page."""
    events = []
    for m in re.finditer(r'class="mand-hist-row__body">(.*?)</div>', page_html, re.S):
        body = m.group(1)
        d_m = re.search(r'field--datums.*?__value">([^<]+)', body, re.S)
        s_m = re.search(r'field--status.*?__value">([^<]+)', body, re.S)
        p_m = re.search(r'field--piezimes.*?__value">([^<]+)', body, re.S)
        date_iso = parse_latvian_date(html_lib.unescape(d_m.group(1))) if d_m else None
        status = html_lib.unescape(s_m.group(1)).strip() if s_m else ""
        note = html_lib.unescape(p_m.group(1)).strip() if p_m else ""
        if date_iso and status:
            kind = classify_mandate_event(status)
            events.append((date_iso, kind, status, note))

    if not events:
        raise ValueError(f"No mand-hist-row entries found on deputy page: {dep_url}")

    # Pages display newest-first. Reverse to process oldest-first, preserving page order on ties.
    # On same-date ties, START before END unless page explicitly ordered otherwise; reversing
    # newest-first order preserves exact chronological sequence of events!
    events_chrono = list(reversed(events))
    # Ensure monotonic by date while keeping intra-day reversed page order
    events_chrono.sort(key=lambda e: e[0])

    intervals = []
    current_from = None
    latest_note = ""

    for date_iso, kind, status, note in events_chrono:
        if note:
            latest_note = note
        elif status:
            latest_note = status

        if kind == "START":
            if current_from is None:
                current_from = date_iso
            # If already active (e.g. "pagaidu -> pastāvīgais" confirmation without gap), keep continuous interval
        elif kind == "END":
            if current_from is not None:
                intervals.append({"from": current_from, "to": date_iso})
                current_from = None

    if current_from is not None:
        intervals.append({"from": current_from, "to": None})

    # Deduplicate / merge contiguous intervals where prev.to == next.from
    merged = []
    for iv in intervals:
        if merged and merged[-1]["to"] == iv["from"]:
            merged[-1]["to"] = iv["to"]
        elif merged and merged[-1]["from"] == iv["from"] and merged[-1]["to"] == iv["to"]:
            continue
        else:
            merged.append(iv)

    return merged, latest_note


def parse_directory_page(list_html: str, term: int):
    """Parse all deputies from https://www.saeima.lv/lv/sasaukumi/{term}-saeima/deputati/."""
    deputies = []
    # Each deputy card is inside an <li ... data-name="..." data-status="..." ...>...</li>
    li_pattern = re.compile(
        r'<li\s+([^>]*data-name="[^"]*"[^>]*)>(.*?)</li>',
        re.S,
    )
    for m in li_pattern.finditer(list_html):
        attrs = m.group(1)
        inner = m.group(2)

        link_m = re.search(
            rf'<a[^>]+class="dep-card__name"[^>]+href="(/lv/sasaukumi/{term}-saeima/deputati/([^/"]+)/?)"[^>]*>([^<]+)</a>',
            inner,
            re.S,
        )
        if not link_m:
            continue

        rel_path = link_m.group(1)
        saeima_slug = link_m.group(2).strip()
        full_name = " ".join(html_lib.unescape(link_m.group(3)).split())

        fac_m = re.search(r'class="dep-card__faction">([^<]*)<', inner, re.S)
        faction_raw = html_lib.unescape(fac_m.group(1)).strip() if fac_m else ""
        faction_id = map_faction_label(faction_raw)

        status_m = re.search(r'data-status="([^"]*)"', attrs)
        mandats_m = re.search(r'data-mandats="([^"]*)"', attrs)
        data_status = status_m.group(1).strip() if status_m else ""
        data_mandats = mandats_m.group(1).strip() if mandats_m else ""

        deputies.append({
            "saeimaId": saeima_slug,
            "name": full_name,
            "slug": slugify_name(full_name),
            "factionId": faction_id,
            "factionRaw": faction_raw,
            "dataStatus": data_status,
            "dataMandats": data_mandats,
            "source": "https://www.saeima.lv" + (rel_path if rel_path.endswith("/") else rel_path + "/"),
        })

    if not deputies:
        raise RuntimeError(f"Parsed 0 deputies from saeima.lv directory for {term}. Saeima — HTML structure may have changed!")
    return deputies


def is_mandate_active(intervals, iso_date: str) -> bool:
    for iv in intervals:
        f_dt = iv["from"]
        t_dt = iv.get("to")
        if f_dt <= iso_date and (t_dt is None or iso_date < t_dt):
            return True
    return False


def scrape_term(term: int, max_workers: int = 3):
    if term not in TERM_CONFIG:
        raise ValueError(f"Unsupported Saeima term: {term}")

    cfg = TERM_CONFIG[term]
    term_dir = os.path.join(TERMS_DIR, str(term))
    os.makedirs(term_dir, exist_ok=True)

    mps_file = os.path.join(term_dir, "mps.json")
    mandates_file = os.path.join(term_dir, "mandates.json")
    factions_file = os.path.join(term_dir, "factions.json")
    votes_file = os.path.join(term_dir, "votes.json")

    print("=" * 70)
    print(f"SCRAPING OFFICIAL MANDATES FOR {term}. SAEIMA (saeima.lv)")
    print("=" * 70)

    list_url = f"https://www.saeima.lv/lv/sasaukumi/{term}-saeima/deputati/"
    list_html = fetch_url(list_url)
    deputies = parse_directory_page(list_html, term)
    print(f"[1/4] Discovered {len(deputies)} deputies on {list_url}")

    # Load existing mps.json from THIS term only (never cross-contaminate across terms)
    existing_mps = []
    if os.path.exists(mps_file):
        with open(mps_file, "r", encoding="utf-8") as f:
            existing_mps = json.load(f)

    existing_by_saeima_id = {}
    existing_by_name = {}
    used_existing_ids = set()
    for m in existing_mps:
        mid = m.get("id")
        if not mid or mid in used_existing_ids:
            continue
        used_existing_ids.add(mid)
        if m.get("saeimaId"):
            existing_by_saeima_id[m["saeimaId"]] = m
        if m.get("name"):
            existing_by_name[" ".join(m["name"].lower().split())] = m

    SPECIAL_NAME_ALIASES = {
        "arturs krišjānis kariņš": "krišjānis kariņš",
    }

    max_mp_num = 0
    for mid in used_existing_ids:
        mm = re.match(r"^mp-(\d+)$", mid)
        if mm:
            max_mp_num = max(max_mp_num, int(mm.group(1)))

    # Fetch individual profile pages politely with small concurrency
    print(f"[2/4] Fetching {len(deputies)} official deputy dossiers (workers={max_workers})...", flush=True)
    fetched_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    mandate_results = {}

    def worker(dep):
        time.sleep(0.08)  # gentle pacing
        page_html = fetch_url(dep["source"])
        intervals, note = parse_mandate_history(page_html, dep["source"])
        return dep["saeimaId"], intervals, note

    completed = 0
    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        futures = {pool.submit(worker, d): d for d in deputies}
        for fut in as_completed(futures):
            sid, intervals, note = fut.result()  # raises loudly on any error
            mandate_results[sid] = (intervals, note)
            completed += 1
            if completed % 25 == 0 or completed == len(deputies):
                print(f"      [{completed}/{len(deputies)}] fetched & parsed cleanly", flush=True)

    # Build clean mps.json and mandates.json
    print("[3/4] Reconciling MP registry and mandate intervals...", flush=True)
    mps_out = []
    mandates_out = []
    used_slugs = set()
    assigned_mp_ids = set()

    # Determine reference date for isActive flag:
    # - Active term: open-ended interval (to is None)
    # - Concluded term (e.g. 14. Saeima ended 2026-11-03): held mandate on day before term end
    term_end = cfg.get("endDate")
    active_ref_date = None
    if term_end:
        dt_end = datetime.strptime(term_end, "%Y-%m-%d")
        active_ref_date = datetime.fromordinal(dt_end.toordinal() - 1).strftime("%Y-%m-%d")

    # Sort deputies deterministically by name for clean diffs
    deputies.sort(key=lambda d: (d["slug"], d["saeimaId"]))

    for idx, dep in enumerate(deputies):
        sid = dep["saeimaId"]
        norm_name = " ".join(dep["name"].lower().split())
        alias_name = SPECIAL_NAME_ALIASES.get(norm_name, norm_name)

        prev = existing_by_saeima_id.get(sid) or existing_by_name.get(norm_name) or existing_by_name.get(alias_name)
        if prev and prev["id"] not in assigned_mp_ids:
            mp_id = prev["id"]
        else:
            max_mp_num += 1
            while f"mp-{max_mp_num}" in assigned_mp_ids or f"mp-{max_mp_num}" in used_existing_ids:
                max_mp_num += 1
            mp_id = f"mp-{max_mp_num}"
        assigned_mp_ids.add(mp_id)

        slug = dep["slug"]
        if slug in used_slugs:
            slug = f"{slug}-{mp_id}"
        used_slugs.add(slug)

        intervals, note = mandate_results[sid]
        if active_ref_date:
            is_active = is_mandate_active(intervals, active_ref_date)
        else:
            is_active = any(iv.get("to") is None for iv in intervals)

        seat_num = prev.get("seatNumber", idx + 1) if prev else (idx + 1)
        row = prev.get("row", (idx % 4) + 1) if prev else ((idx % 4) + 1)
        col = prev.get("col", (idx % 25) + 1) if prev else ((idx % 25) + 1)

        mps_out.append({
            "id": mp_id,
            "name": dep["name"],
            "factionId": dep["factionId"],
            "seatNumber": seat_num,
            "row": row,
            "col": col,
            "isActive": is_active,
            "saeimaId": sid,
            "slug": slug,
        })

        mandates_out.append({
            "mpId": mp_id,
            "saeimaId": sid,
            "name": dep["name"],
            "slug": slug,
            "active": intervals,
            "note": note,
            "source": dep["source"],
            "fetchedAt": fetched_at,
        })

    # Sort both files numerically by mpId
    def mp_sort_key(item):
        id_val = item.get("id") or item.get("mpId") or ""
        mm = re.match(r"^mp-(\d+)$", id_val)
        return (int(mm.group(1)) if mm else 999999, id_val)

    mps_out.sort(key=mp_sort_key)
    mandates_out.sort(key=mp_sort_key)

    # Audit chamber size right now!
    today_iso = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    check_date = active_ref_date or today_iso
    active_count = sum(1 for m in mandates_out if is_mandate_active(m["active"], check_date))
    print(f"      Active mandates on {check_date}: {active_count} (total deputies in term: {len(mps_out)})")
    if active_count > 100:
        raise RuntimeError(f"FATAL CEILING VIOLATION: {active_count} active mandates (>100) on {check_date} for {term}. Saeima!")

    # Write factions.json, mps.json, mandates.json
    with open(factions_file, "w", encoding="utf-8") as f:
        json.dump(cfg["factions"], f, ensure_ascii=False, indent=2)
    with open(mps_file, "w", encoding="utf-8") as f:
        json.dump(mps_out, f, ensure_ascii=False, indent=2)
    with open(mandates_file, "w", encoding="utf-8") as f:
        json.dump(mandates_out, f, ensure_ascii=False, indent=2)

    print(f"[4/4] Saved {len(mps_out)} MPs and {len(mandates_out)} mandates to {term_dir}")

    # Optional: audit against existing votes.json in this term
    if os.path.exists(votes_file):
        with open(votes_file, "r", encoding="utf-8") as f:
            votes = json.load(f)
        dates = sorted({parse_latvian_date(v.get("sittingDate", "")) for v in votes if v.get("sittingDate")})
        anomalies = []
        for d in dates:
            if not d:
                continue
            cnt = sum(1 for m in mandates_out if is_mandate_active(m["active"], d))
            if cnt > 100:
                raise RuntimeError(f"FATAL CEILING VIOLATION: {cnt} active mandates on sitting date {d}!")
            if cnt < 100:
                anomalies.append((d, cnt))
        if anomalies:
            print(f"      Notice: {len(anomalies)} sitting dates had <100 active mandates (temporary vacancies).")

    # Update public/data/terms.json
    terms_json_path = os.path.join(PUBLIC_DATA_DIR, "terms.json")
    terms_list = [
        {
            "term": TERM_CONFIG[t]["term"],
            "label": TERM_CONFIG[t]["label"],
            "years": TERM_CONFIG[t]["years"],
            "isActive": TERM_CONFIG[t]["isActive"],
            "basePath": TERM_CONFIG[t]["basePath"],
            "description": TERM_CONFIG[t]["description"],
        }
        for t in sorted(TERM_CONFIG.keys(), reverse=True)
    ]
    with open(terms_json_path, "w", encoding="utf-8") as f:
        json.dump(terms_list, f, ensure_ascii=False, indent=2)


def main():
    parser = argparse.ArgumentParser(description="Scrape official Saeima deputy mandates from saeima.lv")
    parser.add_argument("--term", type=int, choices=[14, 15], help="Specific Saeima term to scrape (14 or 15)")
    parser.add_argument("--all", action="store_true", help="Scrape both 14. and 15. Saeima")
    parser.add_argument("--workers", type=int, default=3, help="Concurrent HTTP workers (default: 3)")
    args = parser.parse_args()

    if args.all:
        terms = [15, 14]
    elif args.term:
        terms = [args.term]
    else:
        # Default: active term (15. Saeima)
        terms = [15]

    for t in terms:
        scrape_term(t, max_workers=args.workers)


if __name__ == "__main__":
    main()
