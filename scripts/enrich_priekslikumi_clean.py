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

stenograms = {}
for fname in os.listdir(RAW_DIR):
    if fname.endswith('.html'):
        tid = fname[:-5]
        with open(os.path.join(RAW_DIR, fname), 'r', encoding='utf-8') as f:
            stenograms[tid] = f.read()

# Build bill to law map
bill_to_law = {}
for v in votes:
    b = v.get('billNumber')
    t = v.get('officialTitle')
    if b and t and not re.search(r'^\d+\.\s*priekšlikums', t) and not re.search(r'^Par\s+\d+\.\s*priekšlikumu', t):
        clean_t = re.sub(r'^\s*Par\s+likumprojekta\s+', '', t, flags=re.I)
        clean_t = re.sub(r'^\s*Likumprojekts\s+', '', clean_t, flags=re.I)
        clean_t = re.sub(r'\s*\([^)]*L[pm]\d+[^)]*\).*$', '', clean_t)
        clean_t = re.sub(r',\s*\d+\.\s*lasījums.*$', '', clean_t)
        clean_t = clean_t.strip()
        if clean_t and (b not in bill_to_law or len(clean_t) > len(bill_to_law[b])):
            bill_to_law[b] = clean_t

# Enhance each vote that is a priekšlikums
updated_titles = 0
updated_purposes = 0
cleaned_debaters_count = 0

for v in votes:
    t = v.get('officialTitle', '')
    m_num = re.search(r'(\d+)\.\s*priekšlikum', t)
    if not m_num:
        continue
    num = m_num.group(1)
    
    # 1. Update Title with Parent Law
    bill_nr = v.get('billNumber')
    parent_law = bill_to_law.get(bill_nr, '')
    if parent_law:
        v['simplifiedTitle'] = f"{num}. priekšlikums: {parent_law}"
        updated_titles += 1
    else:
        v['simplifiedTitle'] = f"{num}. priekšlikums"
        
    # Mark stage clearly as Priekšlikums
    v['readingStage'] = 'Priekšlikums'
    v['voteType'] = 'priekslikums'
    
    # 2. Extract verbatim proposal purpose from stenogram
    sten_url = v.get('stenogramUrl') or ''
    m_sten = re.search(r'/view/(\d+)#vote_(\d+)', sten_url)
    proposal_text = None
    
    if m_sten:
        tid = m_sten.group(1)
        v_num = int(m_sten.group(2))
        t_html = stenograms.get(tid)
        if t_html:
            anchor = f'name="vote_{v_num}"'
            idx = t_html.find(anchor)
            if idx != -1:
                chunk = t_html[max(0, idx - 8000):idx]
                chunk_un = html.unescape(chunk)
                
                # Match proposal intro: e.g. "7. – arī deputāta Artūra Butāna priekšlikums. Rosina..."
                # Look for the last occurrence of "{num}. –" or "{num}. -"
                pat = rf'(?:[A-ZĀČĒĢĪĶĻŅŠŪŽ]\.\s*(?:&nbsp;|\s)*[A-ZĀČĒĢĪĶĻŅŠŪŽ][a-zāčēģīķļņšūž]+\.\s*)?({num}\.\s*[–\-]\s*[^<]+)'
                matches = list(re.finditer(pat, chunk_un))
                if matches:
                    raw_p = matches[-1].group(1)
                    # Clean text
                    cp = re.sub(r'<[^>]+>', ' ', raw_p)
                    cp = ' '.join(cp.split())
                    # Clean leading "7. – " or "7. - "
                    cp = re.sub(rf'^{num}\.\s*[–\-]\s*', '', cp).strip()
                    if cp:
                        # Capitalize first letter
                        cp = cp[0].toUpperCase() if hasattr(cp[0], 'toUpperCase') else cp[0].upper() + cp[1:]
                        proposal_text = cp
    
    if proposal_text:
        v['purpose'] = proposal_text
        updated_purposes += 1
    elif parent_law:
        v['purpose'] = f"Priekšlikums likumprojektam „{parent_law}” (Nr. {bill_nr})."
        updated_purposes += 1
        
    # 3. Clean debaters for priekšlikumi: exclude rapporteur!
    # Rapporteurs are those whose speech contains 'komisijas vārdā', 'komisijā atbalstīts', 'komisijā nav atbalstīts', or who introduce proposals
    deb_args = v.get('debateArguments')
    if deb_args and deb_args.get('hasDebates') and deb_args.get('debaters'):
        real_debaters = []
        for d in deb_args['debaters']:
            speech = d.get('fullSpeech', '')
            # If the speech is clearly the rapporteur reporting committee review:
            is_rapporteur = any(k in speech.lower() for k in [
                'komisijas vārdā', 'atbildīgās komisijas priekšlikums', 'komisijā atbalstīts',
                'komisijā nav atbalstīts', 'komisija diskutēja', 'komisija lēma', 'priekšlikums ir noraidīts',
                'priekšlikums nav atbalstīts', 'priekšlikums komisijā', 'tika saņemti', 'tagad par visiem priekšlikumiem'
            ]) and ('uzsākam debates' not in speech.lower())
            
            if not is_rapporteur:
                real_debaters.append(d)
                
        if len(real_debaters) != len(deb_args['debaters']):
            cleaned_debaters_count += 1
            if real_debaters:
                deb_args['debaters'] = real_debaters
            else:
                deb_args['hasDebates'] = False
                deb_args.pop('debaters', None)
                deb_args['noDebateReason'] = "Debates plenārsēdē nenotika — saskaņā ar sēdes stenogrammu neviens deputāts debatēm nebija pieteicies."

print(f"Total votes updated with enhanced title: {updated_titles}")
print(f"Total votes updated with enhanced purpose: {updated_purposes}")
print(f"Total priekšlikumi where rapporteurs were separated from debaters: {cleaned_debaters_count}")

with open(VOTES_FILE, 'w', encoding='utf-8') as f:
    json.dump(votes, f, indent=2, ensure_ascii=False)

print("Saved enriched votes.json!")
