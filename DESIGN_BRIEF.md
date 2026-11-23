# Design Brief & Council Goal: The "LSM × NYTimes" Standard

## North Star
Match or exceed the editorial clarity, authority, and effortless readability of **The New York Times** (section feed) and **BBC News** (serif typography), adapted for the median Latvian reader who reads **LSM.lv** every day.

A visitor opening any page on `kābalsosaeima.lv` should feel like they are reading a trusted, non-partisan **national newspaper of record** — **never** a data dashboard, an academic/BI report, a dated government form, or a designer's after-work side project.

---

## Reference Anchors (`docs/references/`)

| Reference | File / Source | What to Take From It |
|---|---|---|
| **The New York Times** *(World section)* | [`docs/references/nytimes-section-feed.png`](docs/references/nytimes-section-feed.png) | Clean white editorial canvas, crisp hairline dividers, `Latest \| Search` tabs, date on the left, category eyebrow + authoritative serif headline + 2-line summary in the center, and one clean visual anchor on the right. |
| **BBC News** *(Latest News)* | [`docs/references/bbc-serif-typography.png`](docs/references/bbc-serif-typography.png) | Authoritative **serif headlines** paired with clean sans-serif metadata (`time \| category`) and calm hairline separation that immediately communicates reputation and trust. |
| **LSM.lv** *(Latest News)* | [`docs/references/lsm-latest-news.png`](docs/references/lsm-latest-news.png) | Fast, zero-friction chronological scanning (`timestamp + headline`)—the exact mental model the median Latvian already uses every day to consume news. |
| **Datan.fr** *(Homepage vote cards)* | [`docs/references/datan-vote-cards.png`](docs/references/datan-vote-cards.png) | Dead-simple vote previews: **only** Date, Outcome badge (`PIEŅEMTS` / `NORAIDĪTS`), clean Title, and 1 Topic tag. Easy to digest with zero information overload. |
| **abgeordnetenwatch.de** *(Bundestag vote detail)* | [Example vote page](https://www.abgeordnetenwatch.de/bundestag/21/abstimmungen/neue-befugnisse-des-verfassungsschutzes-begrenzen-aenderungsantrag) | **Article-first vote pages** that read naturally top-to-bottom like a news story/blog rather than a dashboard, with **inline links in the text** pointing directly to official source documents (e.g., Saeima *darba kārtība*, bill PDFs, annotations, stenograms). |

---

## Hard Anti-Goals (Instant Score Deductions)
- **No dashboard overload:** Never crowd a page with competing KPI cards, dense badge grids, heavy borders, or controls the reader has to "learn" before understanding what happened.
- **No academic / BI report vibe** *(e.g., Our World in Data)*: Avoid scientific or corporate-report framing that intimidates the median Latvian reader.
- **No artsy side-project gimmicks** *(e.g., The Pudding)*: Avoid flashy micro-interactions, decorative gradients, or clever visual tricks that undermine institutional trust.
- **No dated government-portal styling** *(e.g., GOV.UK / bureaucratic portals)*: Avoid heavy blue boxes, stiff form aesthetics, or cluttered administrative tables.

---

## Council Scoring Rubric (0–10)
**Target:** Loop until **Average ≥ 9.0 / 10** and **no single criterion < 8 / 10**.

1. **Newspaper Trust & Typography (0–10)**  
   Does the page immediately feel as authoritative and calm as NYTimes/BBC? Are serif headlines, whitespace, and hairline dividers doing the heavy lifting instead of heavy boxes and shadows?
2. **Median-Latvian Scannability (0–10)**  
   Can a non-technical Latvian understand what was voted on and the outcome in under 3 seconds (like scanning LSM.lv or a Datan card), with zero cognitive overload?
3. **Article-First Reading Flow (0–10)**  
   Does the vote or bill page read naturally top-to-bottom like a short news article (like abgeordnetenwatch.de / LSM.lv) rather than a dashboard?
4. **Organic Transparency (0–10)**  
   Are official Saeima sources (*darba kārtība*, likumprojekta PDF, sēdes protokols, anotācija) linked naturally inline where a reader expects to verify a fact?
5. **Visual Restraint & Polish (0–10)**  
   Zero clutter, zero gimmicks, crisp alignment on both desktop and mobile. Would a journalist screenshot this page and drop it straight into an article?
