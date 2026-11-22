#!/usr/bin/env python3
"""
kābalsosaeima.lv — Dependable Official Saeima Context & Stenogramma Enrichment Engine
--------------------------------------------------------------------------------------
Enriches ingested Saeima votes using ONLY official, zero-dependency public endpoints:
  1. titania.saeima.lv LIVS Domino JSON catalogs (saeimalivs_lmp.nsf, saeimalivs{term}.nsf)
     -> Direct permanent billUrl, submitters (Iesniedzēji), committee, & official HTML text
  2. titania.saeima.lv LIVS DK pages (saeimalivs2_dk.nsf/DK?ReadForm&nr={dkId})
     -> Exact per-vote official protocolUrl (0/{vote_unid}?OpenDocument), with guaranteed
        non-dead-end fallback to the sitting's DK page
  3. www.saeima.lv sitting pages (/lv/sasaukumi/{term}-saeima/saeimas-sedes/)
     -> Deterministic 1-to-1 match by dkId UUID to either:
        (a) Edited official stenogramma (/lv/sasaukumi/{term}-saeima/stenogrammas/...)
            with #vote_N anchors, direct protocolUrls, and verbatim speeches
        (b) Live unedited transcript (/lv/neredigeta-stenogramma/.../ -> JSON parts)
            available immediately after a sitting, upgraded to edited once published

Reliability Guarantees:
  - Pure Python 3 standard library (zero pip dependencies — works in GitHub Actions out of the box).
  - Exponential-backoff retries + polite concurrency to avoid overloading Titania/Saeima servers.
  - Graceful per-item degradation: a transient timeout on Titania or an unpublished transcript
    NEVER fails the sync pipeline; missing items are automatically retried on the next run.
  - Incremental disk cache (enrichment_cache.json) avoids re-fetching finalized sittings & docs.
"""

import argparse
import html
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

if sys.stdout.encoding != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC_DATA_DIR = os.path.join(BASE_DIR, "public", "data")
TERMS_DIR = os.path.join(PUBLIC_DATA_DIR, "terms")
RIGA_TZ = ZoneInfo("Europe/Riga")

USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) kabalsosaeima.lv/2.1"

KNOWN_FACTIONS = {"JV", "ZZS", "PRO", "AS", "NA", "LPV", "ST!", "S!", "SV/AJ", "PIEFR"}

# Formal parliamentary greetings skipped ONLY for short card previews (never removed from fullSpeech)
SALUTATION_RE = re.compile(
    r"^(?:"
    r"(?:augsti\s+|ļoti\s+)?(?:godāt(?:ais|ā|ie|ās)|cienījam(?:ais|ā|ie|ās))\b|"
    r"(?:saeimas\s+)?priekšsēdētāj[aā]?\b|"
    r"(?:sēdes\s+)?vadītāj[aā]?\b|"
    r"dārg(?:ie|ās)\s+kolēģ|"
    r"kolēģ(?:i|es)\b|"
    r"deputāt(?:i|es)\b|"
    r"dāmas\s+un\s+kungi|"
    r"latvijas\s+(?:cilvēki|iedzīvotāji|tauta)|"
    r"visi\s+klātesošie|"
    r"klātesošie|"
    r"labdien|labrīt|labvakar|"
    r"paldies(?:\s+par\s+vārdu)?|"
    r"[A-ZĀČĒĢĪĶĻŅŠŪŽ][a-zāčēģīķļņšūž]+(?:-[A-ZĀČĒĢĪĶĻŅŠŪŽ][a-zāčēģīķļņšūž]+)?\s+(?:kungs|kundze)"
    r")",
    re.IGNORECASE,
)


def dk_db_name(term: int) -> str:
    return "saeimalivs2_dk.nsf" if term >= 15 else "SaeimaLIVS2_DK.nsf"


def sitting_protocol_fallback_url(term: int, dk_id: str) -> str:
    db = dk_db_name(term)
    if dk_id:
        return f"https://titania.saeima.lv/LIVS{term}/{db}/DK?ReadForm&nr={dk_id}"
    return f"https://titania.saeima.lv/LIVS{term}/{db}/DK?ReadForm&calendar=1"


def fetch_soft(url: str, is_json: bool = False, retries: int = 3, timeout: int = 20):
    """Fetch URL with exponential backoff; returns None on failure (never crashes sync)."""
    last_err = None
    for attempt in range(1, retries + 1):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                raw = resp.read().decode("utf-8", errors="replace")
                return json.loads(raw) if is_json else raw
        except urllib.error.HTTPError as e:
            last_err = e
            if e.code in (400, 404, 410):
                return None
            if attempt < retries:
                time.sleep(min(8.0, 1.2 * (2 ** (attempt - 1))))
        except Exception as e:
            last_err = e
            if attempt < retries:
                time.sleep(min(8.0, 1.2 * (2 ** (attempt - 1))))
    print(f"      [WARN] Soft fetch failed for {url}: {last_err}", flush=True)
    return None


def strip_html_tags(raw_html: str) -> str:
    s = re.sub(r"<script\b[^>]*>.*?</script>", " ", raw_html, flags=re.S | re.I)
    s = re.sub(r"<style\b[^>]*>.*?</style>", " ", s, flags=re.S | re.I)
    s = re.sub(r"<!--.*?-->", " ", s, flags=re.S)
    s = re.sub(r"<[^>]+>", " ", s)
    s = html.unescape(s).replace("\xa0", " ")
    return " ".join(s.split())


def clean_bill_nr(raw: str) -> str:
    s = (raw or "").strip()
    s = re.sub(r"^(?:Nr\.|#)\s*", "", s, flags=re.I)
    return s.strip()


def format_submitters(submitters: str) -> str:
    """Shorten long lists of MP submitters so the actual decision substance gets room."""
    s = " ".join((submitters or "").split()).strip(" .;")
    if not s:
        return ""
    parts = [p.strip() for p in s.split(",") if p.strip()]
    if len(parts) > 3:
        return f"{', '.join(parts[:3])} u.c. ({len(parts)} iesniedzēji)"
    return s


def truncate_clean(text: str, max_len: int = 320) -> str:
    text = " ".join((text or "").split()).strip()
    if len(text) <= max_len:
        return text
    cut = text[: max_len - 1]
    # Prefer ending at a true sentence boundary (never after Latvian ordinals like "3. novembra" or "u.c." or "Nr.")
    for m in reversed(list(re.finditer(r"([.!?])\s+", cut))):
        idx = m.start()
        if idx < int(max_len * 0.58):
            break
        before = cut[max(0, idx - 6) : idx + 1]
        if m.group(1) == "." and (
            re.search(r"\d\.$", before)
            or re.search(r"(?:u\.c|nr|p|plkst|g|s|st)\.$", before, re.I)
        ):
            continue
        return cut[: idx + 1].strip()
    # Otherwise cut at last word boundary
    sp = cut.rfind(" ")
    if sp > 0:
        cut = cut[:sp]
    return cut.rstrip(" ,;:-–—") + "…"


# ---------------------------------------------------------------------------
# 1. Titania Bill & Decision Catalog + Official Document Context
# ---------------------------------------------------------------------------

def fetch_bill_catalog(term: int) -> dict:
    """
    Fetch official LIVS Domino JSON indexes for both decisions (saeimalivs_lmp.nsf)
    and bills (saeimalivs{term}.nsf). Returns map: lowercase billNumber -> metadata dict.
    """
    catalog = {}
    dbs = [
        ("lm", f"https://titania.saeima.lv/LIVS{term}/saeimalivs_lmp.nsf"),
        ("lp", f"https://titania.saeima.lv/LIVS{term}/saeimalivs{term}.nsf"),
    ]
    row_re = re.compile(
        r'dvRow_LPView\(\s*"([^"]*)"\s*,\s*"((?:[^"\\]|\\.)*)"\s*,\s*"([^"]*)"\s*,\s*"([0-9A-Fa-f]{32})"'
    )
    for kind, base_url in dbs:
        start = 1
        page_size = 500
        while True:
            url = f"{base_url}/webAll?ReadViewEntries&OutputFormat=JSON&Start={start}&Count={page_size}"
            data = fetch_soft(url, is_json=True, retries=3, timeout=25)
            if not isinstance(data, dict):
                break
            entries = data.get("viewentry") or []
            if not entries:
                break
            for e in entries:
                unid = e.get("@unid") or ""
                ed = e.get("entrydata") or []
                txt = ""
                if ed and isinstance(ed[0].get("text"), dict):
                    txt = ed[0]["text"].get("0") or ""
                m = row_re.search(txt)
                if m:
                    status, raw_title, bill_nr, row_unid = m.groups()
                    unid = row_unid or unid
                    title = raw_title.replace('\\"', '"').strip()
                    bn = clean_bill_nr(bill_nr)
                    if bn and unid:
                        catalog[bn.lower()] = {
                            "billNumber": bn,
                            "kind": kind,
                            "status": status.strip(),
                            "title": title,
                            "unid": unid,
                            "baseUrl": base_url,
                            "url": f"{base_url}/0/{unid}?OpenDocument",
                        }
            if len(entries) < page_size:
                break
            start += len(entries)
    return catalog


def clean_titania_word_html(raw_html: str) -> str:
    """Clean Titania Word-exported HTML document text (Lēmumprojekta / Paziņojuma teksts)."""
    s = re.sub(r"<head\b[^>]*>.*?</head>", " ", raw_html, flags=re.S | re.I)
    s = re.sub(r"<title\b[^>]*>.*?</title>", " ", s, flags=re.S | re.I)
    s = re.sub(r"<script\b[^>]*>.*?</script>", " ", s, flags=re.S | re.I)
    s = re.sub(r"<style\b[^>]*>.*?</style>", " ", s, flags=re.S | re.I)
    s = re.sub(r"<xml\b[^>]*>.*?</xml>", " ", s, flags=re.S | re.I)
    s = re.sub(r"<!--.*?-->", " ", s, flags=re.S)
    s = re.sub(r"<[^>]+>", " ", s)
    s = html.unescape(s).replace("\xa0", " ")
    # Fix Windows-1257 leader dots / replacement glyphs in Word tables
    s = re.sub(r"[\ufffd…\.]{3,}\s*", " ", s)
    s = re.sub(r"\ufffd+", " ", s)
    s = " ".join(s.split())

    # Strip Domino page chrome and Word metadata boilerplate
    s = re.sub(r"^.*?MicrosoftInternetExplorer\d*\s*", "", s, flags=re.I)
    s = re.sub(r"^(?:Paziņojuma|Lēmumprojekta|Likumprojekta)\s+teksts\s*(?:Drukāt\s*)?(?:Aizvērt\s*)?", "", s, flags=re.I)
    s = re.sub(r"^(?:Drukāt\s*)?(?:Aizvērt\s*)?", "", s, flags=re.I)
    # Strip stray leading Word template year like "2002 Paziņojums ..."
    s = re.sub(r"^\d{4}\s+(?=(?:Latvijas|Saeimas|Paziņojums|Lēmums|Daru))", "", s, flags=re.I)
    # Strip trailing Domino diagnostic footer ("Start time: ...")
    s = re.sub(r"\s*Start time:\s*\d{2}\.\d{2}\.\d{4}.*$", "", s, flags=re.I)
    # Normalize dashes (keep hyphenated surnames/words intact!)
    s = re.sub(r"\s+[—–-]\s+", " — ", s)
    s = re.sub(r"\s+([,.;:!?])", r"\1", s)
    s = " ".join(s.split()).strip()
    return s


def summarize_official_decision_text(clean_text: str, title: str, submitters: str) -> str:
    """Turn cleaned official Saeima decision/announcement text into a concise, viewer-friendly context."""
    t = clean_text.strip()
    if not t or len(t) < 25:
        return ""

    # Skip PDF-only stub pages
    if "Oriģinālais dokumenta saturs" in t and len(t) < 220:
        return ""

    sub_short = format_submitters(submitters)
    sub_prefix = f"Iesniedzējs: {sub_short}. " if sub_short else ""

    # Remove redundant heading words
    t = re.sub(r"^(?:Latvijas\s+Republikas\s+)?(?:Saeimas\s+)?(?:Paziņojums|Lēmums|Lēmuma\s+projekts)\s*", "", t, flags=re.I)
    t = re.sub(r"^Rīgā\s+\d{4}\.\s*gada\s+\d+\.\s*\w+\s*", "", t, flags=re.I)
    t = re.sub(r"\s*Saeimas\s+priekšsēdētāj[sa]\s+.*$", "", t, flags=re.I)
    t = re.sub(r"\s*Rīgā\s+\d{4}\.\s*gada\s+\d+\.\s*\w+\.?\s*$", "", t, flags=re.I)

    # Smooth bureaucratic opening "Daru zināmu, ka Saeima šā gada 17. novembra sēdē ..." -> "Saeima 17. novembra sēdē ..."
    t = re.sub(r"^Daru\s+zināmu,\s*ka\s+", "", t, flags=re.I)
    t = re.sub(r"^(Saeima)\s+šā\s+gada\s+", r"\1 ", t, flags=re.I)

    # For committee membership list (15/Lm15), summarize cleanly with committee names
    if re.search(r"ievēlējusi\s+Saeimas\s+komisijas\s+šādā\s+sastāvā", t, re.I):
        comms = re.findall(r"\d+\.\s+([A-ZĀČĒĢĪĶĻŅŠŪŽ][^0-9—]+?komisija)", t)
        if comms:
            shown = ", ".join(comms[:6])
            more = f" un vēl {len(comms) - 6} komisijām" if len(comms) > 6 else ""
            return truncate_clean(
                f"Apstiprināts visu {len(comms)} Saeimas pastāvīgo komisiju deputātu sastāvs ({shown}{more}).",
                320,
            )

    # For Cabinet confidence vote (14/Lm15), format minister roles cleanly
    if "uzticību Ministru kabinetam šādā sastāvā:" in t:
        m = re.search(r"uzticību\s+Ministru\s+kabinetam\s+šādā\s+sastāvā:\s*(.+)$", t, re.I)
        if m:
            body = m.group(1).strip()
            body = re.sub(
                r"([A-ZĀČĒĢĪĶĻŅŠŪŽ][a-zāčēģīķļņšūž]+(?:\s+[A-ZĀČĒĢĪĶĻŅŠŪŽ][a-zāčēģīķļņšūž-]+)+)\s+(?=[a-zāčēģīķļņšūž]+\s+(?:un\s+[a-zāčēģīķļņšūž]+\s+)?ministr)",
                r"\1; ",
                body,
            )
            return truncate_clean(
                f"{sub_prefix}Balsojums par uzticības izteikšanu Ministru kabinetam šādā sastāvā: {body}",
                360,
            )

    # For standing committee formation rules (11/Lm15), lead directly with the substantive rule
    if "pastāvīgo komisiju izveidošanas noteikumus:" in t.lower():
        m_rule = re.search(r"2\.\s*(Katrs\s+Saeimas\s+deputāts.+)$", t, re.I)
        if m_rule:
            return truncate_clean(
                f"{sub_prefix}Noteikumi Saeimas pastāvīgo komisiju izveidošanai: {m_rule.group(1)}",
                340,
            )

    # For temporary deputy mandates (16/Lm15 - 24/Lm15), keep crisp and factual
    if "apstiprinājusi" in t.lower() and "pilnvaras uz laiku" in t.lower():
        return truncate_clean(f"{sub_prefix}{t}", 320)

    # For long recitals ("ņemot vērā ..., nolemj / paziņo / atsakās ..."), highlight the operative clause
    if len(t) > 360:
        for marker in ("nolemj", "paziņo", "atsakās", "apstiprina", "uzdod", "aicina"):
            idx = t.lower().find(marker)
            if 120 < idx < len(t) - 40:
                op = t[idx:].strip()
                op = op[0].upper() + op[1:]
                return truncate_clean(f"{sub_prefix}Saeima {op[0].lower()}{op[1:]}", 340)

    return truncate_clean(f"{sub_prefix}{t}", 340)


def fetch_bill_document_context(entry: dict) -> dict:
    """Fetch Titania bill/decision card + official HTML text when available."""
    doc_html = fetch_soft(entry["url"], is_json=False, retries=3, timeout=20)
    if not doc_html:
        return {}

    res = {
        "billUrl": entry["url"],
        "billTitle": entry.get("title", ""),
        "status": entry.get("status", ""),
        "submitters": "",
        "committee": "",
        "purposeText": "",
    }

    # Extract submitters ("Iesniedzēji: ...")
    m_sub = re.search(r"Iesniedzēji:\s*</font>\s*([^<]+)", doc_html, re.I)
    if not m_sub:
        m_sub = re.search(r"Iesniedzēji:\s*([^<\n]+)", strip_html_tags(doc_html), re.I)
    if m_sub:
        sub = html.unescape(m_sub.group(1)).replace("\xa0", " ").strip()
        sub = re.sub(r"\s*Dokumenti:.*$", "", sub).strip(" .;")
        res["submitters"] = " ".join(sub.split())

    # Extract responsible committee ("Atbildīgā komisija: ...")
    m_com = re.search(r"Atbildīgā\s+komisija:\s*</font>\s*([^<]+)", doc_html, re.I)
    if m_com:
        res["committee"] = " ".join(html.unescape(m_com.group(1)).replace("\xa0", " ").split()).strip(" .;")

    # For decisions (saeimalivs_lmp.nsf), fetch the official HTML sub-document text
    if entry.get("kind") == "lm":
        sub_links = re.findall(r"""href=["'](\./0/[0-9A-Fa-f]{32}\?OpenDocument|/LIVS\d+/[^"']+?/0/[0-9A-Fa-f]{32}\?OpenDocument)["']""", doc_html)
        if sub_links:
            sub_href = sub_links[0]
            if sub_href.startswith("./"):
                sub_url = f"{entry['baseUrl']}/{sub_href[2:]}"
            elif sub_href.startswith("/"):
                sub_url = f"https://titania.saeima.lv{sub_href}"
            else:
                sub_url = sub_href
            sub_html = fetch_soft(sub_url, is_json=False, retries=3, timeout=20)
            if sub_html:
                clean_doc = clean_titania_word_html(sub_html)
                summary = summarize_official_decision_text(clean_doc, res["billTitle"], res["submitters"])
                if summary:
                    res["purposeText"] = summary

    return res


# ---------------------------------------------------------------------------
# 2. Saeima.lv Sittings & Stenogrammas Discovery (Matched by exact dkId UUID!)
# ---------------------------------------------------------------------------

def discover_saeima_sittings_for_dk_ids(term: int, needed_dk_ids: set, cache: dict) -> dict:
    """
    Map dkId -> {sittingUrl, stenogramUrl, stenogramType ("edited"|"live")} using
    https://www.saeima.lv/lv/sasaukumi/{term}-saeima/saeimas-sedes/.
    Only visits sitting pages whose dkId isn't already finalized ("edited") in cache.
    """
    sittings_cache = cache.setdefault("sittings_by_dk", {})
    slug_to_dk = cache.setdefault("slug_to_dk", {})

    # Check which dkIds still need discovery or live->edited upgrade check
    missing_or_live = {
        dk for dk in needed_dk_ids
        if dk and (dk not in sittings_cache or sittings_cache[dk].get("stenogramType") != "edited")
    }
    if not missing_or_live:
        return sittings_cache

    index_url = f"https://www.saeima.lv/lv/sasaukumi/{term}-saeima/saeimas-sedes/"
    idx_html = fetch_soft(index_url, retries=3, timeout=25)
    if not idx_html:
        return sittings_cache

    all_slugs = sorted(
        set(re.findall(rf"/lv/sasaukumi/{term}-saeima/saeimas-sedes/([^/\"#?]+)/", idx_html))
    )
    # Prioritize plenary sittings (skip Q&A "atbilzu-sniegsana")
    plenary_slugs = [s for s in all_slugs if not s.startswith("atbilzu-sniegsana")]

    # Only fetch slugs that are either unseen OR mapped to a currently-live dkId
    slugs_to_check = []
    for slug in plenary_slugs:
        known_dk = slug_to_dk.get(slug)
        if known_dk is None:
            slugs_to_check.append(slug)
        elif known_dk in missing_or_live:
            slugs_to_check.append(slug)

    if not slugs_to_check:
        return sittings_cache

    def check_slug(slug):
        url = f"https://www.saeima.lv/lv/sasaukumi/{term}-saeima/saeimas-sedes/{slug}/"
        sh = fetch_soft(url, retries=2, timeout=20)
        if not sh:
            return slug, None
        m_dk = re.search(r"saeimalivs2_dk\.nsf/DK\?ReadForm(?:&amp;|&)nr=([0-9a-f-]+)", sh, re.I)
        if not m_dk:
            return slug, {"dkId": ""}
        dk_id = m_dk.group(1).lower()
        m_ed = re.search(rf'href="(/lv/sasaukumi/{term}-saeima/stenogrammas/[^"]+)"', sh)
        m_lv = re.search(r'href="(/lv/neredigeta-stenogramma/[^"]+)"', sh)
        steno_url = ""
        steno_type = ""
        if m_ed:
            steno_url = "https://www.saeima.lv" + m_ed.group(1)
            steno_type = "edited"
        elif m_lv:
            steno_url = "https://www.saeima.lv" + m_lv.group(1)
            steno_type = "live"
        return slug, {
            "dkId": dk_id,
            "sittingUrl": url,
            "stenogramUrl": steno_url,
            "stenogramType": steno_type,
        }

    with ThreadPoolExecutor(max_workers=3) as pool:
        futs = [pool.submit(check_slug, s) for s in slugs_to_check]
        for fut in as_completed(futs):
            slug, info = fut.result()
            if info is None:
                continue
            dk_id = info["dkId"]
            slug_to_dk[slug] = dk_id
            if dk_id:
                sittings_cache[dk_id] = {
                    "sittingUrl": info["sittingUrl"],
                    "stenogramUrl": info["stenogramUrl"],
                    "stenogramType": info["stenogramType"],
                }

    return sittings_cache


# ---------------------------------------------------------------------------
# 3. Protocol Matching (Edited Stenogramma + Titania DK addVotesLink)
# ---------------------------------------------------------------------------

def parse_edited_stenogram_votes(steno_html: str) -> list:
    """
    Parse the 'Balsojumi' index embedded in edited saeima.lv stenogrammas.
    Each item has: anchor ('vote_0'), hhmm ('19:18'), par, pret, atturas, protocolUrl, motive.
    """
    votes_meta = []
    idx = steno_html.find('id="votes"')
    if idx == -1:
        return votes_meta
    section = steno_html[idx:]
    pat = re.compile(
        r"Datums:\s*(\d{2}\.\d{2}\.\d{2,4})\s+(\d{2}:\d{2})\s*"
        r'<a\s+href="#(vote_\d+)"[^>]*>.*?</a>\s*<br\s*/?>\s*'
        r"(.*?)"
        r"Balsošanas\s+motīvs:\s*<a\s+href=\"([^\"]+)\"[^>]*>(.*?)</a>",
        re.S | re.I,
    )
    for m in pat.finditer(section):
        raw_date, hhmm, anchor, tally_raw, proto_url, raw_motive = m.groups()
        tally_txt = strip_html_tags(tally_raw)
        m_t = re.search(r"Par\s*[–-]\s*(\d+),\s*pret\s*[–-]\s*(\d+),\s*atturas\s*[–-]\s*(\d+)", tally_txt, re.I)
        par = int(m_t.group(1)) if m_t else None
        pret = int(m_t.group(2)) if m_t else None
        atturas = int(m_t.group(3)) if m_t else None
        motive = strip_html_tags(re.sub(r"<span[^>]*visually-hidden[^>]*>.*?</span>", "", raw_motive, flags=re.S | re.I))
        votes_meta.append({
            "date": raw_date,
            "hhmm": hhmm,
            "anchor": anchor,
            "par": par,
            "pret": pret,
            "atturas": atturas,
            "protocolUrl": html.unescape(proto_url).strip(),
            "motive": motive,
        })
    return votes_meta


def fetch_titania_sitting_protocols(term: int, dk_id: str) -> list:
    """
    Fetch official per-vote protocol URLs directly from Titania DK?ReadForm&nr={dk_id}
    via addVotesLink(..., vote_unid, ...). Used when edited stenogramma is not yet published.
    """
    db = dk_db_name(term)
    dk_url = f"https://titania.saeima.lv/LIVS{term}/{db}/DK?ReadForm&nr={dk_id}"
    dk_html = fetch_soft(dk_url, retries=3, timeout=20)
    if not dk_html:
        return []

    pairs = re.findall(r'addVotesLink\("([0-9A-Fa-f]{32})","([0-9A-Fa-f]{32})"', dk_html)
    # Deduplicate vote_unids preserving order
    seen = set()
    vote_unids = []
    for _, v_unid in pairs:
        if v_unid not in seen:
            seen.add(v_unid)
            vote_unids.append(v_unid)

    if not vote_unids:
        return []

    def fetch_one_proto(v_unid):
        u = f"https://titania.saeima.lv/LIVS{term}/{db}/0/{v_unid}?OpenDocument"
        vh = fetch_soft(u, retries=3, timeout=20)
        if not vh:
            return None
        txt = strip_html_tags(vh)
        m_dt = re.search(r"Datums:\s*(\d{2}\.\d{2}\.\d{4})\s+(\d{2}:\d{2})(?::(\d{2}))?", txt)
        m_res = re.search(r"par\s+(\d+),\s*pret\s+(\d+),\s*atturas\s+(\d+)", txt, re.I)
        m_mot = re.search(r"Balsošanas\s+motīvs:\s*(.+?)(?:Grupēt:|$)", txt)
        if not m_dt:
            return None
        return {
            "date": m_dt.group(1),
            "hhmm": m_dt.group(2),
            "timestamp": f"{m_dt.group(1)} {m_dt.group(2)}:{m_dt.group(3) or '00'}",
            "par": int(m_res.group(1)) if m_res else None,
            "pret": int(m_res.group(2)) if m_res else None,
            "atturas": int(m_res.group(3)) if m_res else None,
            "protocolUrl": u,
            "motive": m_mot.group(1).strip() if m_mot else "",
            "anchor": "",
        }

    results = []
    # Polite concurrency=2 to keep Titania happy
    with ThreadPoolExecutor(max_workers=2) as pool:
        futs = [pool.submit(fetch_one_proto, vu) for vu in vote_unids]
        for fut in as_completed(futs):
            item = fut.result()
            if item:
                results.append(item)
    return results


def match_vote_to_protocol(vote: dict, proto_entries: list, used_urls: set) -> dict | None:
    """Match a vote record to its exact official protocol entry by time, tally, and motive."""
    v_time = (vote.get("sittingTime") or "")[:5]
    c = vote.get("counts") or {}
    v_par, v_pret, v_att = c.get("par"), c.get("pret"), c.get("atturas")
    v_title_low = (vote.get("officialTitle") or "").lower()
    v_bn_low = clean_bill_nr(vote.get("billNumber") or "").lower()

    best = None
    best_score = -1

    for p in proto_entries:
        if p["protocolUrl"] in used_urls:
            continue
        score = 0
        # Tally match
        if p["par"] is not None:
            if (p["par"], p["pret"], p["atturas"]) == (v_par, v_pret, v_att):
                score += 10
            else:
                continue  # Non-matching tally on a non-secret vote cannot be the same vote
        elif not vote.get("isSecret"):
            continue

        # Minute match (exact or +/- 1 min for rounding differences)
        if p["hhmm"] == v_time:
            score += 8
        else:
            try:
                p_m = int(p["hhmm"][:2]) * 60 + int(p["hhmm"][3:5])
                v_m = int(v_time[:2]) * 60 + int(v_time[3:5])
                if abs(p_m - v_m) <= 1:
                    score += 5
                elif abs(p_m - v_m) <= 3:
                    score += 2
                else:
                    continue
            except Exception:
                continue

        # Motive / bill number match bonus
        p_mot_low = (p.get("motive") or "").lower()
        if v_bn_low and v_bn_low in p_mot_low:
            score += 5
        if v_title_low and (v_title_low[:30] in p_mot_low or p_mot_low[:30] in v_title_low):
            score += 4

        if score > best_score:
            best_score = score
            best = p

    if best and best_score >= 12:
        used_urls.add(best["protocolUrl"])
        return best
    return None


# ---------------------------------------------------------------------------
# 4. Verbatim Debate Speech Extraction (Edited HTML + Live-Transcript JSON)
# ---------------------------------------------------------------------------

SPEAKER_HEADER_RE = re.compile(
    r"^\s*([A-ZĀČĒĢĪĶĻŅŠŪŽ]\.(?:\s*[A-ZĀČĒĢĪĶĻŅŠŪŽ]\.)?\s*"
    r"[A-ZĀČĒĢĪĶĻŅŠŪŽ][a-zāčēģīķļņšūž]+(?:-[A-ZĀČĒĢĪĶĻŅŠŪŽ][a-zāčēģīķļņšūž]+)?)"
    r"(?:\s*\(([^)]+)\))?\.\s*(.*)$",
    re.S,
)

CHAIR_RE = re.compile(r"^\s*Sēdes\s+vadītāj[sa]\.\s*(.*)$", re.S)


def extract_speaker_turns(segment_html: str) -> list:
    """
    Parse official Saeima stenogramma HTML (works identically for edited HTML and live-transcript JSON!)
    into chronological speaker turns:
      [{initialName, surname, initial, paren, opinionHint, paragraphs, fullSpeech}]
    """
    raw_ps = re.findall(r"<p\b[^>]*>(.*?)</p>", segment_html, flags=re.S | re.I)
    if not raw_ps:
        return []

    turns = []
    current = None
    last_chair_text = ""

    def flush():
        nonlocal current
        if current and current["paragraphs"]:
            full = "\n\n".join(current["paragraphs"]).strip()
            if len(full) >= 20:
                current["fullSpeech"] = full
                turns.append(current)
        current = None

    for raw_p in raw_ps:
        txt = strip_html_tags(raw_p).strip()
        if not txt:
            continue

        # Stop markers inside a segment (vote call, section divider)
        if txt in ("___", "---") or txt.startswith("Lūdzu zvanu! Balsosim"):
            flush()
            last_chair_text = txt
            continue

        # Chair speaking
        m_chair = CHAIR_RE.match(txt)
        if m_chair:
            flush()
            last_chair_text = txt
            continue

        # Check for speaker header: e.g. "A. Kulbergs (Ministru prezidenta amata kandidāts)." or "I. Mūrniece."
        m_sp = SPEAKER_HEADER_RE.match(txt)
        if m_sp:
            init_name = " ".join(m_sp.group(1).split())
            paren = " ".join((m_sp.group(2) or "").split())
            trailing = m_sp.group(3).strip()

            # Without parentheses, require a standalone header paragraph (avoid false matches inside body sentences)
            if not paren and trailing:
                if current is not None:
                    current["paragraphs"].append(txt)
                continue

            flush()

            # Extract initial and surname
            tokens = init_name.split()
            initial = tokens[0][0].lower() if tokens else ""
            surname = tokens[-1].lower() if tokens else ""

            # Check Chair lead-in for explicit "par" / "pret"
            lead_low = last_chair_text.lower()
            op_hint = ""
            if any(k in lead_low for k in ('runāt “pret”', 'runāt "pret"', 'runāt „pret”', '“pret” pieteic')):
                op_hint = "Pret"
            elif any(k in lead_low for k in ('runāt “par”', 'runāt "par"', 'runāt „par”', '“par” pieteic')):
                op_hint = "Par"

            # Exclude Saeima secretary reading attendance registrations
            if "sekretār" in paren.lower() and ("reģistrējušies" in trailing.lower() or "reģistrācijas" in last_chair_text.lower()):
                continue

            current = {
                "initialName": init_name,
                "initial": initial,
                "surname": surname,
                "paren": paren,
                "opinionHint": op_hint,
                "paragraphs": [trailing] if trailing else [],
                "fullSpeech": "",
            }
            continue

        # Continuation paragraph of active speaker
        if current is not None:
            # Guard against unprefixed Chair transitions ("Debates slēdzu", "Lūdzu balsošanas režīmu", "Vārds deputātam ...")
            if re.match(r"^(?:Debates\s+slēdzu|Lūdzu\s+(?:zvanu|balsošanas|reģistrācijas)|Balsosim\s+par|Vārds\s+(?:deputāt|ministru|komisijas)|Iesniedzēju\s+vārdā\s*[–—-])", txt):
                flush()
                last_chair_text = txt
                continue
            current["paragraphs"].append(txt)
        else:
            last_chair_text = (last_chair_text + " " + txt)[-400:]

    flush()
    return turns


def build_speech_preview(full_speech: str, max_len: int = 235) -> str:
    """
    Build a concise, substantive card preview from a verbatim speech.
    Skips formal opening greetings ("Godātais Saeimas priekšsēdētāj! Cienījamās deputātes!")
    so the card immediately shows what the speaker actually argued.
    """
    paragraphs = [p.strip() for p in (full_speech or "").split("\n\n") if p.strip()]
    if not paragraphs:
        return ""

    # If the first paragraph is purely opening salutations / brief aside followed by substantive paragraphs, start at paragraph 2
    def is_salutation_sentence(sent: str) -> bool:
        s = sent.strip()
        return len(s) <= 85 and bool(SALUTATION_RE.match(s))

    def is_salutation_paragraph(para: str) -> bool:
        sents = [s.strip() for s in re.split(r"(?<=[.!?])\s+", para) if s.strip()]
        if not sents or len(para) > 220:
            return False
        sal_cnt = sum(1 for s in sents if is_salutation_sentence(s))
        return sal_cnt >= max(1, len(sents) - 1) and is_salutation_sentence(sents[0])

    p_idx = 0
    while p_idx < len(paragraphs) - 1 and p_idx < 2 and is_salutation_paragraph(paragraphs[p_idx]):
        p_idx += 1

    flat = " ".join(paragraphs[p_idx:]).strip()
    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", flat) if s.strip()]
    if not sentences:
        return truncate_clean(flat, max_len)

    # Also skip leading pure salutation sentences within the chosen paragraph
    start_idx = 0
    while start_idx < len(sentences) - 1 and start_idx < 6:
        if is_salutation_sentence(sentences[start_idx]):
            start_idx += 1
            continue
        break

    candidate = sentences[start_idx:]
    if len(" ".join(candidate)) < 45:
        candidate = sentences

    chosen = []
    for s in candidate:
        chosen.append(s)
        joined = " ".join(chosen)
        if len(joined) >= 145 or len(chosen) >= 3:
            break

    preview = " ".join(chosen)
    if len(preview) > max_len:
        preview = truncate_clean(preview, max_len)
    return preview


def extract_live_transcript_html(live_page_url: str) -> list:
    """
    Given https://www.saeima.lv/lv/neredigeta-stenogramma/{slug}/,
    find data-lt-src="/wp-content/uploads/live-transcripts/{id}.json" and return its parts list.
    """
    page_html = fetch_soft(live_page_url, retries=3, timeout=20)
    if not page_html:
        return []
    m = re.search(r'data-lt-src="([^"]+\.json)"', page_html)
    if not m:
        return []
    src = m.group(1)
    json_url = f"https://www.saeima.lv{src}" if src.startswith("/") else src
    data = fetch_soft(json_url, is_json=True, retries=3, timeout=25)
    if isinstance(data, dict) and isinstance(data.get("parts"), list):
        return data["parts"]
    return []


def slice_live_parts_for_vote(
    parts: list, sitting_date: str, start_hhmm: str, end_hhmm: str, vote_hhmm: str, prev_vote_hhmm: str = ""
) -> str:
    """Select HTML parts from live-transcript JSON covering this vote's agenda time window."""
    if not parts:
        return ""

    # Parse target Riga window -> UTC timestamps
    m_d = re.match(r"(\d{2})\.(\d{2})\.(\d{4})", sitting_date or "")
    if m_d and (start_hhmm or vote_hhmm):
        dd, mm, yyyy = int(m_d.group(1)), int(m_d.group(2)), int(m_d.group(3))

        def to_utc_epoch(hhmm: str):
            m_t = re.match(r"(\d{2}):(\d{2})", hhmm or "")
            if not m_t:
                return None
            dt_local = datetime(yyyy, mm, dd, int(m_t.group(1)), int(m_t.group(2)), tzinfo=RIGA_TZ)
            return dt_local.astimezone(timezone.utc).timestamp()

        win_start = to_utc_epoch(start_hhmm) if start_hhmm else (to_utc_epoch(prev_vote_hhmm) if prev_vote_hhmm else None)
        win_end = to_utc_epoch(end_hhmm or vote_hhmm)

        if win_end is not None:
            # 3-minute safety margin around boundaries; if first vote & no explicit start, include from sitting start
            lo = (win_start - 180) if win_start is not None else 0
            hi = win_end + 180
            selected = []
            for p in parts:
                try:
                    ps = datetime.fromisoformat(p["start"].replace("Z", "+00:00")).timestamp()
                    pe = datetime.fromisoformat(p["end"].replace("Z", "+00:00")).timestamp()
                except Exception:
                    continue
                if pe >= lo and ps <= hi:
                    selected.append(p.get("html") or "")
            if selected:
                return "\n".join(selected)

    return "\n".join(p.get("html") or "" for p in parts)


def slice_edited_stenogram_for_vote(steno_html: str, anchor: str) -> str:
    """Extract the HTML segment immediately preceding id='vote_N' in an edited stenogramma."""
    if not steno_html or not anchor:
        return ""
    idx = steno_html.find(f'id="{anchor}"')
    if idx == -1:
        idx = steno_html.find(f'name="{anchor}"')
    if idx == -1:
        return ""

    prev_idx = max(
        steno_html.rfind('id="vote_', 0, idx),
        steno_html.rfind('name="vote_', 0, idx),
        steno_html.rfind('class="stenogramma__sep"', 0, idx),
        steno_html.rfind('class="toc-adds"', 0, idx),
    )
    if prev_idx == -1:
        prev_idx = max(0, idx - 30000)
    return steno_html[prev_idx:idx]


def clean_debater_role(raw_op: str, raw_info: str, paren: str) -> str:
    """Produce a short, clean Latvian role label (e.g. 'MP kandidāts', 'Frakc. viedoklis', 'Referents')."""
    op = (raw_op or "").strip()
    info = (raw_info or "").strip()

    if "mp kandidāts" in info.lower() or "ministru prezidenta amata kandidāts" in (paren or "").lower():
        return "Ministru prezidenta amata kandidāts"
    if "referents" in op.lower():
        return op
    if "frakc. viedoklis" in op.lower():
        return "Frakcijas viedoklis"
    if "no vietas" in op.lower():
        return "No vietas"
    if op and op.lower() not in ("par", "pret", "debates"):
        return op
    # Clean noisy "1x, Dep." or "Dep."
    cleaned_info = re.sub(r"(?<!\w)(?:1x|2x|3x|Dep\.?)(?!\w)", "", info, flags=re.I).strip(" .,·;")
    if cleaned_info:
        return cleaned_info
    if paren and paren.upper() not in KNOWN_FACTIONS and "pie frakcij" not in paren.lower():
        return paren
    return ""


def normalize_debater_opinion(raw_op: str, hint: str) -> str:
    """Return strictly 'Par', 'Pret', or 'Debates' — never falsely label neutral debates as 'Pret'."""
    for src in (raw_op or "", hint or ""):
        low = src.lower().strip()
        if low == "pret" or "runāt pret" in low or "“pret”" in low or '"pret"' in low:
            return "Pret"
        if low == "par" or "runāt par" in low or "“par”" in low or '"par"' in low:
            return "Par"
    return "Debates"


def extract_proposal_purpose_from_segment(segment_html: str, official_title: str) -> str:
    """For amendments (priekšlikumi), extract the rapporteur's verbatim introduction of the proposal."""
    m_num = re.search(r"(\d+)\.\s*priekšlikum", official_title or "", re.I)
    if not m_num or not segment_html:
        return ""
    num = m_num.group(1)
    chunk_un = html.unescape(segment_html[-12000:])
    pat = rf"({num}\.\s*[–\-—]\s*[^<]+)"
    matches = list(re.finditer(pat, chunk_un))
    if not matches:
        return ""
    raw_p = strip_html_tags(matches[-1].group(1))
    cp = re.sub(rf"^{num}\.\s*[–\-—]\s*", "", raw_p).strip()
    if len(cp) >= 15:
        cp = cp[0].upper() + cp[1:]
        return truncate_clean(cp, 320)
    return ""


def extract_rapporteur_intro(turns: list) -> str:
    """Extract a brief factual summary from a committee rapporteur's introduction in a stenogramma."""
    for t in turns[:2]:
        speech = t.get("fullSpeech") or ""
        low = speech.lower()
        if any(
            k in low
            for k in (
                "komisijas vārdā",
                "komisija izskatīja",
                "likumprojekts paredz",
                "lēmuma projekts paredz",
                "lēmumprojekts paredz",
                "iesniedzēju vārdā",
                "atbildīgā komisija",
            )
        ):
            return build_speech_preview(speech, max_len=300)
    return ""


# ---------------------------------------------------------------------------
# 5. Main Term Enrichment Orchestrator
# ---------------------------------------------------------------------------

def enrich_term_votes(
    term: int,
    votes: list,
    rollcalls_by_vote: dict,
    mps: list,
    factions: list,
    term_dir: str,
    max_sittings: int = 0,
    force_refresh: bool = False,
) -> dict:
    """
    Enrich a term's votes in-place with:
      - Exact official protocolUrl (zero dead ends)
      - Direct official billUrl (saeimalivs_lmp.nsf / saeimalivs{term}.nsf)
      - Official stenogramUrl (edited #vote_N or live transcript)
      - Verbatim debate speeches (preview + fullSpeech) + honest opinion/faction/role/duration/voteDecision
      - Meaningful factual civic context (purpose)

    Never raises on transient upstream timeouts — returns summary stats dict.
    """
    cache_path = os.path.join(term_dir, "enrichment_cache.json")
    cache = {}
    if os.path.exists(cache_path) and not force_refresh:
        try:
            with open(cache_path, "r", encoding="utf-8") as f:
                cache = json.load(f)
        except Exception:
            cache = {}

    factions_by_id = {f["id"]: f for f in factions}
    mp_by_norm = {" ".join(m["name"].strip().lower().split()): m for m in mps}

    # Build quick lookup of MP rollcall record per vote
    def lookup_mp_vote(vote_id: str, full_name: str):
        rc = rollcalls_by_vote.get(vote_id) or []
        norm = " ".join(full_name.strip().lower().split())
        for rec in rc:
            if " ".join((rec.get("name") or "").strip().lower().split()) == norm:
                return rec
        return None

    # 1. Fetch Titania bill & decision catalog (just 2 fast JSON API calls per term!)
    print(f"[Enrich {term}. Saeima] Fetching official Titania LIVS bill/decision catalog...", flush=True)
    catalog = fetch_bill_catalog(term)
    print(f"      Catalog loaded: {len(catalog)} bills & decisions", flush=True)

    # Set billUrl on all votes matching catalog
    bills_cache = cache.setdefault("bills", {})
    needed_bill_keys = set()
    for v in votes:
        bn = clean_bill_nr(v.get("billNumber") or "").lower()
        if bn and bn in catalog:
            v["billUrl"] = catalog[bn]["url"]
            if bn not in bills_cache or force_refresh:
                needed_bill_keys.add(bn)

    # Fetch document context for needed bills/decisions (only those actually referenced by votes)
    # Cap per run on huge historical archives if max_sittings is set
    if max_sittings > 0:
        recent_dk_ids = []
        for v in votes:
            dk = (v.get("dkId") or "").lower()
            if dk and dk not in recent_dk_ids:
                recent_dk_ids.append(dk)
            if len(recent_dk_ids) >= max_sittings:
                break
        target_dk_set = set(recent_dk_ids)
        needed_bill_keys = {
            clean_bill_nr(v.get("billNumber") or "").lower()
            for v in votes
            if (v.get("dkId") or "").lower() in target_dk_set
            and clean_bill_nr(v.get("billNumber") or "").lower() in needed_bill_keys
        }
    else:
        target_dk_set = {(v.get("dkId") or "").lower() for v in votes if v.get("dkId")}

    if needed_bill_keys:
        print(f"      Fetching Titania document context for {len(needed_bill_keys)} bill(s)/decision(s)...", flush=True)
        with ThreadPoolExecutor(max_workers=2) as pool:
            futs = {pool.submit(fetch_bill_document_context, catalog[k]): k for k in sorted(needed_bill_keys)}
            for fut in as_completed(futs):
                k = futs[fut]
                ctx = fut.result()
                if ctx:
                    bills_cache[k] = ctx

    # 2. Discover Saeima.lv sittings & stenogrammas for target dkIds
    print(f"      Matching {len(target_dk_set)} sitting(s) on saeima.lv...", flush=True)
    sittings_by_dk = discover_saeima_sittings_for_dk_ids(term, target_dk_set, cache)

    # Group votes by dkId
    votes_by_dk = {}
    for v in votes:
        dk = (v.get("dkId") or "").lower()
        if dk:
            votes_by_dk.setdefault(dk, []).append(v)

    stats = {
        "protocols_enriched": 0,
        "stenograms_enriched": 0,
        "speeches_enriched": 0,
        "purposes_enriched": 0,
    }

    # 3. Process each target sitting
    for dk_id in sorted(target_dk_set):
        s_votes = votes_by_dk.get(dk_id) or []
        if not s_votes:
            continue

        s_info = sittings_by_dk.get(dk_id) or {}
        steno_url = s_info.get("stenogramUrl") or ""
        steno_type = s_info.get("stenogramType") or ""

        # Check if this sitting needs transcript/protocol enrichment
        needs_proto = any(not v.get("protocolUrl") or "DK?ReadForm" in (v.get("protocolUrl") or "") for v in s_votes)
        needs_steno = bool(steno_url) and any(
            not v.get("stenogramUrl")
            or (steno_type == "edited" and "neredigeta-stenogramma" in (v.get("stenogramUrl") or ""))
            for v in s_votes
        )
        needs_speeches = any(
            (v.get("debateArguments") or {}).get("hasDebates")
            and any(not (d.get("fullSpeech") or "").strip() for d in ((v.get("debateArguments") or {}).get("debaters") or []))
            for v in s_votes
        )

        steno_html = ""
        live_parts = []
        proto_entries = []

        if (needs_proto or needs_steno or needs_speeches or force_refresh) and steno_url:
            if steno_type == "edited":
                steno_html = fetch_soft(steno_url, retries=3, timeout=25) or ""
                if steno_html:
                    proto_entries = parse_edited_stenogram_votes(steno_html)
            elif steno_type == "live":
                live_parts = extract_live_transcript_html(steno_url)

        # If edited stenogramma didn't supply protocol URLs (e.g., live sitting), fetch from Titania DK
        if (needs_proto or force_refresh) and not proto_entries:
            proto_entries = fetch_titania_sitting_protocols(term, dk_id)

        used_proto_urls = set()
        # Sort sitting votes chronologically ascending so live-transcript slicing knows previous vote boundary
        s_votes_chrono = sorted(s_votes, key=lambda x: (x.get("sittingTime") or "", x.get("id") or ""))
        prev_vote_hhmm = ""

        for v in s_votes_chrono:
            # --- A. Match Protocol URL & Stenogram Anchor ---
            matched_p = match_vote_to_protocol(v, proto_entries, used_proto_urls) if proto_entries else None
            if matched_p:
                v["protocolUrl"] = matched_p["protocolUrl"]
                stats["protocols_enriched"] += 1
            elif not v.get("protocolUrl"):
                # Guaranteed non-dead-end fallback: official Titania sitting DK page
                v["protocolUrl"] = sitting_protocol_fallback_url(term, dk_id)

            anchor = matched_p.get("anchor", "") if matched_p else ""
            if steno_url:
                if anchor:
                    v["stenogramUrl"] = f"{steno_url}#{anchor}"
                else:
                    v["stenogramUrl"] = steno_url
                stats["stenograms_enriched"] += 1

            # --- B. Extract Segment HTML & Speaker Turns ---
            seg_html = ""
            if steno_html and anchor:
                seg_html = slice_edited_stenogram_for_vote(steno_html, anchor)
            elif live_parts:
                seg_html = slice_live_parts_for_vote(
                    live_parts,
                    v.get("sittingDate", ""),
                    v.get("_dkpStartTime", ""),
                    v.get("_dkpEndTime", ""),
                    v.get("sittingTime", ""),
                    prev_vote_hhmm=prev_vote_hhmm,
                )
            prev_vote_hhmm = v.get("sittingTime") or prev_vote_hhmm

            turns = extract_speaker_turns(seg_html) if seg_html else []

            # --- C. Enrich Debate Arguments with Real Verbatim Speeches & Honest Metadata ---
            deb_args = v.get("debateArguments")
            if isinstance(deb_args, dict) and deb_args.get("hasDebates") and deb_args.get("debaters"):
                # Index turns by (surname, initial) and surname for ordered matching
                turns_by_si = {}
                turns_by_s = {}
                for ti, t in enumerate(turns):
                    turns_by_si.setdefault((t["surname"], t["initial"]), []).append(ti)
                    turns_by_s.setdefault(t["surname"], []).append(ti)
                used_turn_idx = set()

                for deb in deb_args["debaters"]:
                    full_name = (deb.get("name") or "").strip()
                    parts_n = full_name.split()
                    initial = parts_n[0][0].lower() if parts_n else ""
                    surname = parts_n[-1].lower() if parts_n else ""

                    # Look up actual MP vote & faction in this vote's rollcall
                    rc_rec = lookup_mp_vote(v["id"], full_name)
                    if rc_rec:
                        deb["voteDecision"] = rc_rec.get("decision", "")

                    # Match to verbatim speech turn if not already populated or force_refresh
                    matched_turn = None
                    if not (deb.get("fullSpeech") or "").strip() or force_refresh:
                        for cand_list in (turns_by_si.get((surname, initial), []), turns_by_s.get(surname, [])):
                            for ti in cand_list:
                                if ti not in used_turn_idx:
                                    used_turn_idx.add(ti)
                                    matched_turn = turns[ti]
                                    break
                            if matched_turn:
                                break

                    paren = matched_turn["paren"] if matched_turn else ""
                    op_hint = matched_turn["opinionHint"] if matched_turn else ""

                    # Resolve accurate faction (never falsely default Kulbergs/Mūrniece to PIEFR!)
                    raw_frac = (deb.get("fraction") or "").strip()
                    if not raw_frac or raw_frac == "PIEFR":
                        if rc_rec and rc_rec.get("factionId"):
                            fmeta = factions_by_id.get(rc_rec["factionId"])
                            if fmeta and fmeta.get("shortName"):
                                raw_frac = fmeta["shortName"]
                        elif " ".join(full_name.lower().split()) in mp_by_norm:
                            mp_m = mp_by_norm[" ".join(full_name.lower().split())]
                            fmeta = factions_by_id.get(mp_m.get("factionId", ""))
                            if fmeta and fmeta.get("shortName"):
                                raw_frac = fmeta["shortName"]
                        elif paren and paren.upper() in KNOWN_FACTIONS:
                            raw_frac = paren.upper()
                        elif "kandidāts" in (deb.get("role") or deb.get("preview") or paren).lower():
                            raw_frac = ""

                    deb["fraction"] = raw_frac

                    # Parse duration/role from existing metadata preview if not set yet
                    prev_txt = deb.get("preview") or ""
                    if not deb.get("duration"):
                        m_dur = re.search(r"uzstāšanās\s+ilgums\s+(\d{1,2}:\d{2})", prev_txt)
                        if m_dur:
                            deb["duration"] = m_dur.group(1)

                    raw_op_orig = deb.get("_rawOpinion") or deb.get("opinion") or ""
                    raw_info_orig = deb.get("_rawInfo") or ""
                    if not raw_info_orig and "uzstāšanās ilgums" in prev_txt:
                        # Recover metadata tokens from previous preview
                        meta_toks = [x.strip() for x in prev_txt.split("·") if "uzstāšanās ilgums" not in x]
                        if meta_toks:
                            raw_info_orig = " · ".join(meta_toks)

                    existing_role = (deb.get("role") or "").strip(" .,·;")
                    role = existing_role or clean_debater_role(raw_op_orig, raw_info_orig, paren)
                    if role:
                        deb["role"] = role
                    else:
                        deb.pop("role", None)

                    deb["opinion"] = normalize_debater_opinion(raw_op_orig, op_hint)

                    if matched_turn and matched_turn["fullSpeech"]:
                        deb["fullSpeech"] = matched_turn["fullSpeech"]
                        deb["preview"] = build_speech_preview(matched_turn["fullSpeech"])
                        stats["speeches_enriched"] += 1
                    elif not (deb.get("fullSpeech") or "").strip():
                        # Never keep robotic duration string pretending to be a quoted speech
                        if "uzstāšanās ilgums" in (deb.get("preview") or ""):
                            deb["preview"] = ""

                    # Clean internal helper fields if present
                    deb.pop("_rawOpinion", None)
                    deb.pop("_rawInfo", None)

            # --- D. Build Meaningful Factual Civic Context (purpose) ---
            existing_purpose = (v.get("purpose") or "").strip()
            has_good_purpose = bool(existing_purpose) and not existing_purpose.startswith(
                ("Saeimas izskatīts likumprojekts", "Procedūras lēmums Saeimas sēdes gaitā", "Priekšlikums likumprojektam")
            )
            if not has_good_purpose or force_refresh:
                bn_key = clean_bill_nr(v.get("billNumber") or "").lower()
                b_ctx = bills_cache.get(bn_key) or {}
                vtype = v.get("voteType") or ""
                purpose = ""

                # Priority 1: Amendment (priekšlikums) verbatim intro from stenogramma
                if vtype == "priekslikums":
                    purpose = extract_proposal_purpose_from_segment(seg_html, v.get("officialTitle") or "")

                # Priority 2: Procedural vote — explain what document/bill the procedural motion is about
                if not purpose and vtype == "procedura":
                    bill_title = b_ctx.get("billTitle") or ""
                    submitters = format_submitters(b_ctx.get("submitters") or "")
                    stage = v.get("readingStage") or "Procedūra"
                    parts_ctx = []
                    doc_word = "lēmuma projektu" if "/lm" in bn_key else "likumprojektu"
                    if bill_title:
                        parts_ctx.append(
                            f"Procedūras balsojums ({stage.lower()}) par {doc_word} Nr. {clean_bill_nr(v.get('billNumber') or '')} „{bill_title}”."
                        )
                    if submitters:
                        parts_ctx.append(f"Iesniedzējs: {submitters}.")
                    if b_ctx.get("purposeText"):
                        pt = re.sub(
                            r"^Iesniedzēj[si]:\s*(?:.*?\(\d+\s+iesniedzēji\)|[^.]+)\.\s*",
                            "",
                            b_ctx["purposeText"],
                        )
                        if pt:
                            parts_ctx.append(pt)
                    purpose = truncate_clean(" ".join(parts_ctx), 340)

                # Priority 3: Official Titania HTML document text (all Lm decisions!)
                if not purpose and b_ctx.get("purposeText"):
                    purpose = b_ctx["purposeText"]

                # Priority 4: Rapporteur's introduction from stenogramma (great for Lp bills!)
                if not purpose and turns:
                    rap = extract_rapporteur_intro(turns)
                    if rap:
                        sub = format_submitters(b_ctx.get("submitters") or "")
                        prefix = f"Iesniedzējs: {sub}. " if sub else ""
                        purpose = truncate_clean(f"{prefix}{rap}", 340)

                # Priority 5: Honest structured metadata fallback (submitters + committee + status/comment)
                if not purpose:
                    meta_bits = []
                    sub = format_submitters(b_ctx.get("submitters") or "")
                    if sub:
                        meta_bits.append(f"Iesniedzējs: {sub}.")
                    if b_ctx.get("committee"):
                        meta_bits.append(f"Atbildīgā komisija: {b_ctx['committee']}.")
                    elif v.get("summary"):
                        m_c = re.search(r"Iesniedzējs / atbildīgā komisija:\s*([^.]+)", v["summary"])
                        if m_c:
                            meta_bits.append(f"Iesniedzējs / atbildīgā komisija: {m_c.group(1).strip()}.")
                    if b_ctx.get("status"):
                        meta_bits.append(f"Statuss Saeimā: {b_ctx['status']}.")
                    if meta_bits:
                        purpose = truncate_clean(" ".join(meta_bits), 320)

                if purpose:
                    v["purpose"] = purpose
                    stats["purposes_enriched"] += 1

            # Clean any temporary ingestion keys
            v.pop("_dkpStartTime", None)
            v.pop("_dkpEndTime", None)
            v.pop("_voteMotive", None)

    # Save updated cache
    try:
        with open(cache_path, "w", encoding="utf-8") as f:
            json.dump(cache, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"      [WARN] Could not write enrichment cache: {e}", flush=True)

    print(
        f"[Enrich {term}. Saeima] Done: protocols={stats['protocols_enriched']}, "
        f"stenograms={stats['stenograms_enriched']}, speeches={stats['speeches_enriched']}, "
        f"purposes={stats['purposes_enriched']}",
        flush=True,
    )
    return stats


def main():
    parser = argparse.ArgumentParser(description="Enrich Saeima votes with official protocols, stenogrammas, speeches & context")
    parser.add_argument("--term", type=int, choices=[14, 15], default=15)
    parser.add_argument("--max-sittings", type=int, default=0, help="Limit enrichment to N most recent sittings (0 = all)")
    parser.add_argument("--force", action="store_true", help="Ignore enrichment cache and re-fetch")
    args = parser.parse_args()

    term_dir = os.path.join(TERMS_DIR, str(args.term))
    votes_path = os.path.join(term_dir, "votes.json")
    mps_path = os.path.join(term_dir, "mps.json")
    factions_path = os.path.join(term_dir, "factions.json")
    rc_dir = os.path.join(term_dir, "rollcalls")

    with open(votes_path, "r", encoding="utf-8") as f:
        votes = json.load(f)
    with open(mps_path, "r", encoding="utf-8") as f:
        mps = json.load(f)
    with open(factions_path, "r", encoding="utf-8") as f:
        factions = json.load(f)

    rollcalls_by_vote = {}
    for v in votes:
        if not v.get("isSecret"):
            p = os.path.join(rc_dir, f"{v['id']}.json")
            if os.path.exists(p):
                with open(p, "r", encoding="utf-8") as f:
                    rollcalls_by_vote[v["id"]] = json.load(f)

    enrich_term_votes(
        args.term,
        votes,
        rollcalls_by_vote,
        mps,
        factions,
        term_dir,
        max_sittings=args.max_sittings,
        force_refresh=args.force,
    )

    with open(votes_path, "w", encoding="utf-8") as f:
        if len(votes) > 1000:
            json.dump(votes, f, ensure_ascii=False, separators=(",", ":"))
        else:
            json.dump(votes, f, ensure_ascii=False, indent=2)

    if args.term == 15:
        import shutil
        shutil.copy2(votes_path, os.path.join(PUBLIC_DATA_DIR, "votes.json"))
        print("Mirrored enriched 15. Saeima votes.json to public/data/votes.json")


if __name__ == "__main__":
    main()
