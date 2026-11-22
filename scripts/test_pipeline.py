#!/usr/bin/env python3
"""
Unit tests for kabalsosaeima.lv scraping, mandate parsing, and constitutional tally logic.
Run with: python3 -m unittest scripts/test_pipeline.py
"""

import unittest
import xml.etree.ElementTree as ET
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import scrape_mandates
import ingest_real_saeima


class TestMandateParsing(unittest.TestCase):
    def test_multi_interval_minister_return(self):
        sample_html = """
        <div class="mand-hist-row__body">
            <span class="mand-hist-row__field--datums"><span class="mand-hist-row__value">03.11.2026.</span></span>
            <span class="mand-hist-row__field--status"><span class="mand-hist-row__value">Izbeigušās Saeimas deputātes pilnvaras</span></span>
            <span class="mand-hist-row__field--piezimes"><span class="mand-hist-row__value">Līdz ar 14. Saeimas pilnvaru beigām</span></span>
        </div>
        <div class="mand-hist-row__body">
            <span class="mand-hist-row__field--datums"><span class="mand-hist-row__value">11.06.2026.</span></span>
            <span class="mand-hist-row__field--status"><span class="mand-hist-row__value">Atjaunots Saeimas deputātes mandāts</span></span>
            <span class="mand-hist-row__field--piezimes"><span class="mand-hist-row__value">Beidz pildīt Ministru prezidentes pienākumus</span></span>
        </div>
        <div class="mand-hist-row__body">
            <span class="mand-hist-row__field--datums"><span class="mand-hist-row__value">14.12.2022.</span></span>
            <span class="mand-hist-row__field--status"><span class="mand-hist-row__value">Nolikusi Saeimas deputātes mandātu</span></span>
            <span class="mand-hist-row__field--piezimes"><span class="mand-hist-row__value">Uz ministres amata pildīšanas laiku</span></span>
        </div>
        <div class="mand-hist-row__body">
            <span class="mand-hist-row__field--datums"><span class="mand-hist-row__value">01.11.2022.</span></span>
            <span class="mand-hist-row__field--status"><span class="mand-hist-row__value">Apstiprināts Saeimas deputātes mandāts</span></span>
            <span class="mand-hist-row__field--piezimes"><span class="mand-hist-row__value">Ievēlēta par Saeimas deputāti</span></span>
        </div>
        """
        intervals, note = scrape_mandates.parse_mandate_history(sample_html, "https://example.test/mp")
        self.assertEqual(
            intervals,
            [
                {"from": "2022-11-01", "to": "2022-12-14"},
                {"from": "2026-06-11", "to": "2026-11-03"},
            ],
        )
        self.assertIn("14. Saeimas pilnvaru beigām", note)

    def test_unknown_status_fails_loudly(self):
        with self.assertRaises(ValueError):
            scrape_mandates.classify_mandate_event("Nezināms jauns statuss")


class TestIngestionRules(unittest.TestCase):
    def test_zero_par_vote_is_not_dropped(self):
        xml = ET.fromstring(
            """
            <VOTES>
                <VOTEMOTIVE>Par priekšlikumu Nr. 5</VOTEMOTIVE>
                <VOTEISHIDDEN>0</VOTEISHIDDEN>
                <RESULT>Pret#Pret#Atturas#Nebalsoja</RESULT>
            </VOTES>
            """
        )
        self.assertFalse(ingest_real_saeima.is_attendance_registration(xml))

    def test_attendance_check_is_skipped(self):
        xml = ET.fromstring(
            """
            <VOTES>
                <VOTEMOTIVE>Deputātu klātbūtnes reģistrācija</VOTEMOTIVE>
                <VOTEISHIDDEN>0</VOTEISHIDDEN>
                <RESULT>Reģistrējies#Nereģistrējies</RESULT>
            </VOTES>
            """
        )
        self.assertTrue(ingest_real_saeima.is_attendance_registration(xml))

    def test_constitutional_outcomes(self):
        # Regular vote: 50 present, 26 Par -> PIENEMTS
        v_ok = {
            "officialTitle": "Grozījumi Nodokļu likumā",
            "voteType": "likums",
            "reading": 3,
            "readingStage": "3. lasījums (galīgais)",
            "counts": {"par": 26, "pret": 24, "atturas": 0},
        }
        self.assertEqual(ingest_real_saeima.compute_constitutional_outcome(v_ok), "PIENEMTS")

        # Regular vote: 49 present -> NAV_KVORUMA
        v_noq = dict(v_ok, counts={"par": 48, "pret": 1, "atturas": 0})
        self.assertEqual(ingest_real_saeima.compute_constitutional_outcome(v_noq), "NAV_KVORUMA")

        # Constitutional amendment 3rd reading: 66 present -> NAV_KVORUMA (needs 67)
        v_satv_noq = {
            "officialTitle": "Grozījumi Latvijas Republikas Satversmē",
            "voteType": "likums",
            "reading": 3,
            "readingStage": "3. lasījums (galīgais)",
            "counts": {"par": 66, "pret": 0, "atturas": 0},
        }
        self.assertEqual(ingest_real_saeima.compute_constitutional_outcome(v_satv_noq), "NAV_KVORUMA")

        # Constitutional amendment 3rd reading: 75 present, 50 Par (2/3) -> PIENEMTS
        v_satv_pass = dict(v_satv_noq, counts={"par": 50, "pret": 25, "atturas": 0})
        self.assertEqual(ingest_real_saeima.compute_constitutional_outcome(v_satv_pass), "PIENEMTS")

        # Constitutional amendment 3rd reading: 75 present, 49 Par (< 2/3) -> NORAIDITS
        v_satv_fail = dict(v_satv_noq, counts={"par": 49, "pret": 26, "atturas": 0})
        self.assertEqual(ingest_real_saeima.compute_constitutional_outcome(v_satv_fail), "NORAIDITS")

    def test_honest_faction_breakdown_never_exceeds_active_mandates(self):
        mps = [
            {"id": "mp-1", "name": "A B", "factionId": "jv"},
            {"id": "mp-2", "name": "C D", "factionId": "na"},
            {"id": "mp-3", "name": "E F", "factionId": "ind"},
        ]
        mandates = [
            {"mpId": "mp-1", "active": [{"from": "2026-11-03", "to": None}]},
            {"mpId": "mp-2", "active": [{"from": "2026-11-03", "to": None}]},
            {"mpId": "mp-3", "active": [{"from": "2026-11-03", "to": "2026-11-10"}]},  # inactive on 17.11!
        ]
        factions = [
            {"id": "jv", "name": "JV", "shortName": "JV", "color": "#00529B"},
            {"id": "na", "name": "NA", "shortName": "NA", "color": "#831843"},
            {"id": "st", "name": "ST", "shortName": "S!", "color": "#475569"},  # 0 active seats!
            {"id": "ind", "name": "PIEFR", "shortName": "PIEFR", "color": "#94A3B8"},
        ]
        votes = [
            {
                "id": "v1",
                "sittingDate": "17.11.2026",
                "officialTitle": "Test",
                "voteType": "likums",
                "isSecret": False,
                "counts": {"par": 1, "pret": 0, "atturas": 0, "nebalso": 0, "totalPresent": 1},
            }
        ]
        # Only mp-1 is in rollcall; mp-2 is active & absent; mp-3 is inactive
        rollcalls = {"v1": [{"mpId": "mp-1", "name": "A B", "factionId": "jv", "decision": "PAR"}]}

        ingest_real_saeima.build_honest_faction_breakdowns(votes, rollcalls, mps, mandates, factions)
        v = votes[0]
        # Active mandates = 2 (mp-1, mp-2). Total seats across breakdown MUST be 2, NOT padded for ST!
        total_seats = sum(sum(fb["votes"].values()) for fb in v["factionBreakdown"])
        self.assertEqual(total_seats, 2)
        self.assertEqual(v["counts"]["nebalso"], 1)
        self.assertEqual(sum(fb["votes"]["nebalso"] for fb in v["factionBreakdown"]), 1)
        # Dissolved 0-seat ST! faction is omitted
        self.assertNotIn("st", [fb["factionId"] for fb in v["factionBreakdown"]])


if __name__ == "__main__":
    unittest.main()
