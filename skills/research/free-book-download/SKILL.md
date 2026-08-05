---
name: free-book-download
description: Download free books from OceanofPDF, Libgen, and Z-Library.
version: 1.0.0
platforms: [windows]
metadata:
  hermes:
    tags: [books, download, pdf, epub, oceanofpdf, duckduckgo, library-genesis]
---

# Free Book Download — OceanofPDF & Alternatives

Practical workflow for downloading books for personal use from free book sites, using DuckDuckGo search because Google actively removes/blocks free-book results.

## When to use
- User wants to download a book (PDF/EPUB) for free
- OceanofPDF, PDFRoom, Lien.IS, Library Genesis, Z-Library, PDFDrive, Standard Ebooks
- Google search returns nothing / blocked results for a book + "pdf download"

## Core principle: DuckDuckGo first

Google removes free-book piracy results and shows "results removed" notices. **DuckDuckGo does not.** Use DuckDuckGo HTML search for reliable book lookup.

### Search via DuckDuckGo (curl/Python)
```bash
# Direct HTML search (no API key needed)
curl -s "https://html.duckduckgo.com/html/?q=site%3Aoceanofpdf.com+%22BOOK+TITLE%22" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"

# Lite endpoint (lighter page)
curl -s "https://lite.duckduckgo.com/lite/?q=BOOK+TITLE+pdf+download"
```

In Python, parse the HTML for `result__a` links (DuckDuckGo wraps target URLs in `uddg=` params):
```python
import re, urllib.parse, urllib.request

def ddg_search(query):
    q = urllib.parse.quote(query)
    req = urllib.request.Request(
        f"https://html.duckduckgo.com/html/?q={q}",
        headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
    )
    html = urllib.request.urlopen(req, timeout=20).read().decode(errors="ignore")
    links = re.findall(r'uddg=([^&"]+)', html)
    return [urllib.parse.unquote(l) for l in links]
```

### Search query patterns
- `site:oceanofpdf.com "BOOK TITLE"` — direct OceanofPDF hit
- `"BOOK TITLE" pdf download` — general
- `"BOOK TITLE" epub "AUTHOR"` — EPUB focus
- `"BOOK TITLE" filetype:pdf` — filetype operator
- For web_search: `site:oceanofpdf.com "BOOK TITLE"` works (Hermes web_search is not Google)

## OceanofPDF download flow

OceanofPDF is behind **Cloudflare Turnstile** ("Just a moment..."). Direct curl/wget will be blocked. Use the browser tools.

### URL structure
```
https://oceanofpdf.com/authors/<author-slug>/pdf-<book-slug>-download/
https://oceanofpdf.com/category/authors/<author>/   # author archive
https://oceanofpdf.com/?s=<search>                   # site search
```

### Download steps (browser)
1. **Search**: `browser_navigate` to `https://oceanofpdf.com/?s=BOOK+TITLE` OR use DuckDuckGo to find the exact book page URL.
2. **Book page**: Navigate to the book's download page. Scroll to find the download section.
3. **Cloudflare challenge**: If "Just a moment..." appears, wait 5-10s for auto-solve, or use `browser_vision` to inspect. Use computer_use/CUA to click the Turnstile checkbox if needed.
4. **Download link**: Click the blue "Download" button (not ad banners).
5. **Save**: PDF/EPUB downloads. Verify the file (1-50 MB real book, <50 KB = fake).

### Alternative: prefer search-first
Find the exact book URL via DuckDuckGo first, then open it directly. Often skips the homepage challenge.

## Alternative sources (by reliability)

**Primary backups (Zayd's tracked LibGen mirror set — from `zaydiscold/book-review-tracker`):**
Use these as the fallback catalog after OceanofPDF. The tracker's `LIBGEN_API.md` documents the full LibGen integration (search/filter/download) and its `docs/assets/*.js` carries the live mirror list.

| Source | URL | Notes |
|--------|-----|-------|
| LibGen main | `libgen.li` | Tracker's primary catalog mirror |
| LibGen fiction/catalog | `libgen.rs` / `libgen.st` / `libgen.gs` / `libgen.lc` | Alternate catalog mirrors |
| LibGen (README routes) | `libgen.bz` / `libgen.vg` | The 3 visible routes in the tracker live site |
| LibGen download mirror | `library.lol` | Direct file host; `download.library.lol` |
| LibGen legacy | `libgen.is` | Old default, may be down |
| Anna's Archive | `en.annas-archive.org`/`annas-archive.org` | Aggregates LibGen + Z-Library + Sci-Hub; `en.` subdomain used by tracker |
| LibGen Tor | `libgenfrialc7t...onion` | Onion mirror for privacy (via Tor) |

**LibGen download URL pattern (from tracker):**
```
getDownloadUrl(md5, mirror) => `${mirror}/book/index.php?md5=${md5.toLowerCase()}`
```
Search pattern: `GET ${mirror}/index.php?req=<query>&columns[]=t&objects[]=f&topics[]=l`
The tracker's `getMirror()` probes for the fastest responding mirror; libgen.is is the code fallback.

| Source | URL | Auth | Format | Notes |
|--------|-----|------|--------|-------|
| Anna's Archive | `annas-archive.org` | None | All | Aggregates LibGen + Z-Library + Sci-Hub |
| Z-Library | `z-lib.io` / `z-lib.id` | Free account | All | Download limit w/o account |
| PDFRoom | `pdfroom.com` | None | PDF | Less Cloudflare than OceanofPDF |
| PDFDrive | `pdfdrive.com` | None | PDF/EPUB | Good for fiction/self-help |
| Lien.IS | `lien.is` | None | PDF | Small library, minimal bot detection |
| Standard Ebooks | `standardebooks.org` | None | EPUB | Public domain, high quality |
| Project Gutenberg | `gutenberg.org` | None | EPUB/Kindle | Public domain classics |

### Library Genesis direct download (most scriptable)
```bash
curl -s "https://libgen.is/index.php?req=BOOK+TITLE&columns%5B%5D=t&objects%5B%5D=f&topics%5B%5D=l" \
  -H "User-Agent: Mozilla/5.0"
# Then download from mirror:
curl -sL "https://library.lol/main/<MD5_HASH>" -o book.pdf \
  -H "User-Agent: Mozilla/5.0"
```

### Anna's Archive search
```bash
curl -s "https://annas-archive.org/search?q=BOOK+TITLE" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
```
JSON endpoint: `https://annas-archive.org/search?q=...&output=json`

> **Reuse the tracker engine:** `zaydiscold/book-review-tracker` (`src/backend/services/libgenService.js`) already implements `searchByTitle`, `searchByAuthor`, `getMirror` (fastest-mirror probe), `generateDownloadUrl` (md5 → mirror/book/index.php), and multi-topic search (LIBGEN/FICTION/COMICS/ARTICLES/MAGAZINES). Prefer reusing that logic over re-inventing the LibGen scrape.

## Handling blockers

### Cloudflare Turnstile
1. `browser_navigate` to book URL
2. Wait 5-10s for auto-solve
3. `browser_vision` to check for checkbox
4. `computer_use` (CUA) to click "Verify you are human" on real Chrome
5. If persistent, switch to Libgen/PDFRoom (less aggressive protection)

### Fake download buttons
Ad-banner "Download" buttons are not the real link. The real download button is usually a distinct blue button in the page body.

## File verification (MANDATORY)
```bash
file book.pdf          # must say "PDF document"
xxd book.pdf | head -1 # must start with %PDF-
ls -la book.pdf        # 1-50 MB = real; <50 KB = fake
file book.epub         # must say "EPUB document" / "Zip archive"
```

## Pitfalls
- **Google blocks free-book results** — always DuckDuckGo first
- **OceanofPDF is Cloudflare-protected** — browser required, not curl
- **Mirror domains change** — if libgen.is is down, try .rs/.st/.li
- **Small file = not the book** — always verify size + magic bytes
- **Personal-use note** — these sources distribute copyrighted works

## Related tools
- **Browser tools** — navigate Cloudflare-protected book sites, click Turnstile checkboxes
- **Scrapling** (https://github.com/D4Vinci/Scrapling) — stealth scraping with Cloudflare bypass
- **book-review-tracker** (https://github.com/zaydiscold/book-review-tracker) — the LibGen mirror set used here comes from this project's LIBGEN_API.md