#!/usr/bin/env python3
"""
kābalsosaeima.lv — Roll-Call Bundle Splitter (Case 10)
------------------------------------------------------
Splits large 100-MP roll-call decision arrays into on-demand static JSON files
(public/data/rollcalls/[voteId].json) and compacts public/data/votes.json.
Reduces initial frontend payload by ~86%.
"""

import os
import json
import sys

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, 'public', 'data')
VOTES_FILE = os.path.join(DATA_DIR, 'votes.json')
ROLLCALLS_DIR = os.path.join(DATA_DIR, 'rollcalls')

def main():
    if not os.path.exists(VOTES_FILE):
        print(f"[!] File not found: {VOTES_FILE}")
        sys.exit(1)

    os.makedirs(ROLLCALLS_DIR, exist_ok=True)

    with open(VOTES_FILE, 'r', encoding='utf-8') as f:
        votes = json.load(f)

    orig_size = os.path.getsize(VOTES_FILE)
    split_count = 0
    compact_votes = []

    for v in votes:
        vid = v.get('id')
        mp_votes = v.get('mpVotes')

        if mp_votes and len(mp_votes) > 0:
            rc_file = os.path.join(ROLLCALLS_DIR, f"{vid}.json")
            with open(rc_file, 'w', encoding='utf-8') as f:
                json.dump(mp_votes, f, ensure_ascii=False)
            split_count += 1

        v_copy = {k: val for k, val in v.items() if k != 'mpVotes'}
        compact_votes.append(v_copy)

    with open(VOTES_FILE, 'w', encoding='utf-8') as f:
        json.dump(compact_votes, f, ensure_ascii=False, indent=2)

    new_size = os.path.getsize(VOTES_FILE)
    savings = (1 - (new_size / orig_size)) * 100

    print("=== Roll-Call Splitting Complete ===")
    print(f"[*] Processed {len(votes)} votes.")
    print(f"[*] Generated {split_count} individual roll-call files in public/data/rollcalls/")
    print(f"[*] Original votes.json: {orig_size / 1024 / 1024:.2f} MB")
    print(f"[*] Compact votes.json:  {new_size / 1024:.1f} KB")
    print(f"[*] Initial payload savings: {savings:.1f}%")

if __name__ == '__main__':
    main()
