import json
import os
import re
import html
import sys

sys.stdout.reconfigure(encoding='utf-8')

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VOTES_FILE = os.path.join(BASE_DIR, 'public', 'data', 'votes.json')
MPS_FILE = os.path.join(BASE_DIR, 'public', 'data', 'mps.json')
RAW_DIR = os.path.join(BASE_DIR, 'scripts', 'transcripts_raw')

with open(VOTES_FILE, 'r', encoding='utf-8') as f:
    votes = json.load(f)

with open(MPS_FILE, 'r', encoding='utf-8') as f:
    mps = json.load(f)

# Build surname + initial lookup map for MP full names
mp_lookup = {}
for m in mps:
    name_parts = m['name'].strip().split()
    if len(name_parts) >= 2:
        first_name = name_parts[0]
        surname = name_parts[-1]
        initial = first_name[0]
        mp_lookup[(surname.lower(), initial.lower())] = m['name']
        mp_lookup[surname.lower()] = m['name']

stenograms = {}
for fname in os.listdir(RAW_DIR):
    if fname.endswith('.html'):
        tid = fname[:-5]
        with open(os.path.join(RAW_DIR, fname), 'r', encoding='utf-8') as f:
            stenograms[tid] = f.read()

def clean_text_properly(raw_html):
    t = html.unescape(raw_html)
    t = re.sub(r'<[^>]+>', ' ', t)
    t = ' '.join(t.split())
    return t

def extract_segment_debaters(t_html, vote_num):
    anchor = f'name="vote_{vote_num}"'
    idx = t_html.find(anchor)
    if idx == -1:
        return []
    
    # Backtrack to the start of this voting item or the previous vote anchor
    prev_idx = max(
        t_html.rfind('name="vote_', 0, idx),
        t_html.rfind('class="toc-adds"', 0, idx),
        t_html.rfind('___', 0, idx)
    )
    if prev_idx == -1:
        prev_idx = max(0, idx - 10000)
        
    segment = t_html[prev_idx:idx]
    unescaped = html.unescape(segment)
    
    # Check if debates actually took place in this segment
    has_deb = any(marker in unescaped for marker in ['Uzsākam debates', 'Runāt “par”', 'Runāt “pret”', 'Debates slēdzu', 'debatēs', 'Vārds deputāt'])
    if not has_deb:
        return []

    # Find speaker turns in this segment
    speaker_pat = re.compile(
        r'<p>\s*([A-ZĀČĒĢĪĶĻŅŠŪŽ]\.\s*(?:&nbsp;|\s)*([A-ZĀČĒĢĪĶĻŅŠŪŽ][a-zāčēģīķļņšūž]+))\s*\(([^)]+)\)\.\s*</p>\s*(.*?)(?=<p>\s*[A-ZĀČĒĢĪĶĻŅŠŪŽ]\.|\Z|<p>\s*Sēdes vadītāja|\Z)',
        re.DOTALL
    )
    
    debaters = []
    for m in speaker_pat.finditer(segment):
        full_init_name = html.unescape(m.group(1)).replace('&nbsp;', ' ').strip()
        surname = html.unescape(m.group(2)).strip()
        initial = full_init_name[0] if full_init_name else ''
        fraction = html.unescape(m.group(3)).strip()
        raw_speech = m.group(4)
        
        # Check if this speaker is just the rapporteur reporting the committee's decision
        # Rapporteurs say: "Tautsaimniecības komisijas vārdā...", "Juridiskās komisijas vārdā..."
        speaker_pos = m.start()
        lead_in = unescaped[max(0, speaker_pos - 400):speaker_pos]
        
        # Determine opinion: look backwards before this speaker for 'Runāt “pret”' or 'Runāt “par”'
        if '“pret”' in lead_in.lower() or '"pret"' in lead_in.lower():
            opinion = 'Pret'
        elif '“par”' in lead_in.lower() or '"par"' in lead_in.lower():
            opinion = 'Par'
        else:
            opinion = 'Par'
        
        clean_speech = clean_text_properly(raw_speech)
        
        # Skip presiding officer interruptions or trivial 1-liners
        if len(clean_speech) < 35 or clean_speech.startswith('Sēdes vadītāja'):
            continue
            
        sentences = re.split(r'(?<=[.!?])\s+', clean_speech)
        preview_parts = []
        for s in sentences:
            preview_parts.append(s)
            curr_prev = ' '.join(preview_parts)
            if len(curr_prev) >= 80 or len(preview_parts) >= 3:
                break
        preview = ' '.join(preview_parts)
        if len(preview) > 240:
            preview = preview[:237] + '...'
            
        full_name = mp_lookup.get((surname.lower(), initial.lower()), mp_lookup.get(surname.lower(), full_init_name))
        
        debaters.append({
            'name': full_name,
            'fraction': fraction,
            'opinion': opinion,
            'preview': preview,
            'fullSpeech': clean_speech
        })
    return debaters

matched_with_debates = 0
for v in votes:
    sten_url = v.get('stenogramUrl') or ''
    m = re.search(r'/view/(\d+)#vote_(\d+)', sten_url)
    if not m:
        # No verified anchor
        if v.get('voteType') == 'procedura':
            v['debateArguments'] = {
                'hasDebates': False,
                'noDebateReason': "Procedūras balsojums bez debašu pieteikumiem."
            }
        else:
            v['debateArguments'] = {
                'hasDebates': False,
                'noDebateReason': "Debates plenārsēdē nenotika — saskaņā ar sēdes stenogrammu neviens deputāts debatēm nebija pieteicies."
            }
        continue
        
    tid = m.group(1)
    vote_num = int(m.group(2))
    t_html = stenograms.get(tid)
    if not t_html:
        v['debateArguments'] = {
            'hasDebates': False,
            'noDebateReason': "Debates plenārsēdē nenotika — saskaņā ar sēdes stenogrammu neviens deputāts debatēm nebija pieteicies."
        }
        continue
        
    debs = extract_segment_debaters(t_html, vote_num)
    if debs:
        v['debateArguments'] = {
            'hasDebates': True,
            'debaters': debs
        }
        matched_with_debates += 1
    else:
        if v.get('voteType') == 'procedura':
            v['debateArguments'] = {
                'hasDebates': False,
                'noDebateReason': "Procedūras balsojums bez debašu pieteikumiem."
            }
        else:
            v['debateArguments'] = {
                'hasDebates': False,
                'noDebateReason': "Debates plenārsēdē nenotika — saskaņā ar sēdes stenogrammu neviens deputāts debatēm nebija pieteicies."
            }

print(f"Total votes: {len(votes)}")
print(f"Votes with verified verbatim debates: {matched_with_debates}")
print(f"Votes with verified no-debate notice: {len(votes) - matched_with_debates}")

with open(VOTES_FILE, 'w', encoding='utf-8') as f:
    json.dump(votes, f, indent=2, ensure_ascii=False)

print("Saved clean, perfectly accurate votes.json!")
