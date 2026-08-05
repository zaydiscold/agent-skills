---
name: free-book-download
description: Download free books from OceanofPDF, Libgen, and Z-Library.
version: 1.1.0
platforms: [windows, macos, linux]
metadata:
  hermes:
    tags: [books, download, pdf, epub, oceanofpdf, duckduckgo, library-genesis, gutenberg, standardebooks]
---

# Free Book Download — OceanofPDF & Alternatives

Practical workflow for downloading books for personal use from free book sites, using DuckDuckGo search because Google actively removes/blocks free-book results.

**Tested 2026-08-04 against real books from to-read shelf.** Verified: DuckDuckGo search, Gutenberg, Standard Ebooks, Scrapling HTTP fetcher. Known gap: OceanofPDF's managed Cloudflare Turnstile is too aggressive for headless Scrapling — requires real browser + CUA.

## When to use
- User wants to download a book (PDF/EPUB) for free
- OceanofPDF, PDFRoom, Lien.IS, Library Genesis, Z-Library, PDFDrive, Standard Ebooks, Project Gutenberg
- Google search returns nothing / blocked results for a book + "pdf download"

## Core principle: DuckDuckGo first

Google removes free-book piracy results and shows "results removed" notices. **DuckDuckGo does not.** Use DuckDuckGo HTML search for reliable book lookup.

### Search via DuckDuckGo (curl/Python)
```bash
# Direct HTML search (no API key needed)
curl -s "https://html.duckduckgo.com/html/?q=site%3Aoceanofpdf.com+%22BOOK+TITLE%22" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
```

In Python, parse the HTML for `uddg=` params:
```python
import re, urllib.parse, urllib.request

def ddg_search(query):
    """DuckDuckGo HTML search. Returns list of result URLs."""
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

## Source priority order (tested reliability)

### 1. Project Gutenberg — fastest, most reliable
No bot protection, no Cloudflare. Public domain only. Use for any classic work.

```bash
# Search
curl -s "https://www.gutenberg.org/ebooks/search/?query=AUTHOR+TITLE" \
  -H "User-Agent: Mozilla/5.0"

# Download plain text UTF-8
curl -sL "https://www.gutenberg.org/cache/epub/60333/pg60333.txt" -o book.txt

# Download EPUB
curl -sL "https://www.gutenberg.org/ebooks/60333.epub.images" -o book.epub
```

Gutenberg book IDs are numeric. Find them from search results or the book page URL (`/ebooks/ID`). The `.txt.utf-8` and `.epub.images` download patterns are consistent. **Verified 2026-08-04:** 507KB download of real Kierkegaard text.

### 2. Standard Ebooks — high quality, public domain
Professionally formatted EPUBs. No bot protection. Titles are slugified: `author/book-title`.

```bash
# Download EPUB directly (slug may need subtitle appended)
curl -sL "https://standardebooks.org/ebooks/AUTHOR/BOOK-TITLE/downloads/BOOK-TITLE.epub" \
  -o book.epub

# If 404, check the page for the actual filename
curl -s "https://standardebooks.org/ebooks/AUTHOR/BOOK-TITLE" \
  | grep -oP 'href="[^"]*\.epub"'
```

**Tested:** `/soren-kierkegaard/fear-and-trembling` exists (200) but the direct download URL may vary if the title has a subtitle. Always scrape the page for `.epub` links if the direct URL 404s.

### 3. DuckDuckGo + Scrapling HTTP fetcher — for most modern books
**Tested 2026-08-04:** DuckDuckGo HTML search returns ~40 results per query. For books not in Gutenberg/Standard Ebooks, use the search to find a source, then use Scrapling's HTTP fetcher (lightweight, no browser).

```python
# Requires: pip install scrapling
from scrapling.fetchers import Fetcher

# Scrapling's HTTP fetcher handles redirects, cookies, and headers
page = Fetcher.get('https://example.com/book', timeout=30)
body = page.body  # raw bytes
# Or use the response for further scraping
links = page.css('a::attr(href)').getall()
```

**Cloudflare note:** Scrapling's `StealthyFetcher` with `solve_cloudflare=True` works for most Cloudflare sites, but **OceanofPDF uses managed Turnstile** which requires a real browser + CUA to click the checkbox.

### 4. Library Genesis — largest catalog, intermittent downtime
Search via HTTP. The `.is`, `.rs`, `.st`, `.li`, `.gs`, `.lc` mirrors rotate — try another if one is down.

```bash
# Search
curl -s "https://libgen.is/index.php?req=BOOK+TITLE&columns%5B%5D=t&objects%5B%5D=f&topics%5B%5D=l"

# Download
curl -sL "https://library.lol/main/MD5_HASH" -o book.pdf
```

Note: LibGen is frequently rate-limited or down from US IPs. Try `.gs` or `.li` if `.is` fails.

### 5. Anna's Archive — aggregator, last resort
Aggregates LibGen + Z-Library + Sci-Hub. Works when individual mirrors are down.

```bash
curl -s "https://annas-archive.org/search?q=BOOK+TITLE+PDF" \
  -H "User-Agent: Mozilla/5.0"
```

### 6. OceanofPDF — requires browser (Cloudflare Turnstile)
Behind managed Cloudflare Turnstile. Headless tools (curl, Scrapling stealth) will fail after multiple retry attempts. **Must use real browser + CUA to click the checkbox.**

**Tested 2026-08-04 with Scrapling StealthyFetcher:**
```
[WARNING] Cloudflare page didn't disappear after 10s, continuing...
[WARNING] Looks like Cloudflare captcha is still present, solving again
[ERROR] Page crashed after 3 retry attempts
```

**Working approach:** Navigate in browser, wait for Turnstile auto-solve, click checkbox if needed, then download.

### 7. Full LibGen mirror set (from zaydiscold/book-review-tracker)
The tracker's `LIBGEN_API.md` has the full mirror list. Use these as fallback for any book not found elsewhere:

- `libgen.li` — primary catalog
- `libgen.rs` / `libgen.st` / `libgen.gs` / `libgen.lc` — alternate catalogs
- `libgen.bz` / `libgen.vg` — README routes
- `library.lol` — download host
- `en.annas-archive.org` — aggregated search

## File verification (MANDATORY)
```bash
# PDF
file book.pdf          # must say "PDF document"  
xxd book.pdf | head -1 # must start with %PDF-
ls -la book.pdf        # 1-50 MB = real; <50 KB = fake

# EPUB
file book.epub         # must say "EPUB document" / "Zip archive"

# Text (Gutenberg)
file book.txt          # must say "UTF-8 Unicode text" or "ASCII text"
wc -l book.txt         # should be 1000+ lines for a real book
```

## Pitfalls
- **Google blocks free-book results** — always DuckDuckGo first (verified: DDG returns 40+ results where Google returns 0)
- **OceanofPDF Cloudflare** — requires real browser + CUA to click Turnstile. Headless tools fail
- **LibGen downtime** — try `.gs`, `.li`, `.st` if `.is` is down
- **Small file = not the book** — always verify size + magic bytes. Real PDFs are 1-50MB, real EPUBs are 200KB-5MB
- **Smart quotes break search** — replace "fancy quotes" with regular quotes in query strings
- **Scrapling lxml issue on Windows** — if you get `cannot import name 'etree' from 'lxml'`, run: `/c/Python310/Scripts/pip install --force-reinstall lxml`
- **Personal-use note** — these sources distribute copyrighted works. Use responsibly

## Related tools
- **Scrapling (https://github.com/D4Vinci/Scrapling)** — HTTP fetcher + stealth browser for Cloudflare bypass (tested: HTTP works, OceanofPDF Turnstile needs real browser)
- **book-review-tracker (https://github.com/zaydiscold/book-review-tracker)** — full LibGen engine with mirror probing and md5 URL generation
- **Browser CUA tools** — for clicking Cloudflare Turnstile on OceanofPDF