---
name: free-book-download
description: Download free books from OceanofPDF, Libgen, and Z-Library.
version: 1.2.0
platforms: [windows, macos, linux]
metadata:
  hermes:
    tags: [books, download, pdf, epub, oceanofpdf, duckduckgo, library-genesis, gutenberg, standardebooks]
---

# Free Book Download — OceanofPDF & Alternatives

DuckDuckGo-first search for free ebooks. Google actively blocks free-book results; DuckDuckGo does not.

**Source priority (reliability order, tested 2026-08-04):** Gutenberg > Standard Ebooks > DuckDuckGo → Scrapling HTTP > LibGen mirrors > Anna's Archive > OceanofPDF (needs browser).

## When to use
- User wants to download a PDF/EPUB book for free
- DuckDuckGo HTML search → resolves real download URLs
- Sources: OceanofPDF, PDFRoom, LibGen, Z-Library, PDFDrive, Standard Ebooks, Gutenberg, Anna's Archive

## DuckDuckGo search (always first, never Google)

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

Query patterns: `site:oceanofpdf.com "TITLE"` | `"TITLE" AUTHOR pdf download` | `"TITLE" epub` | `"TITLE" filetype:pdf`

## Download sources (priority order)

### 1. Project Gutenberg (fastest, no bot protection)
Public domain only. Download URL: `https://www.gutenberg.org/cache/epub/{ID}/pg{ID}.txt` (text) or `https://www.gutenberg.org/ebooks/{ID}.epub.images` (EPUB). Find book IDs from search at `https://www.gutenberg.org/ebooks/search/?query=AUTHOR+TITLE`. **Verified 2026-08-04:** 507KB real text download.

### 2. Standard Ebooks (high quality EPUBs)
URL pattern: `https://standardebooks.org/ebooks/AUTHOR/BOOK-TITLE/`. Scrape page for `.epub` links — direct download URL may vary if title has a subtitle. 404 means wrong slug, not missing page.

### 3. Scrapling HTTP fetcher (for non-Cloudflare book sites)
```python
from scrapling.fetchers import Fetcher
page = Fetcher.get(url, timeout=30)
body = page.body   # raw bytes
links = page.css('a::attr(href)').getall()
```

Scrapling's `StealthyFetcher(solve_cloudflare=True)` works for basic Cloudflare but **fails on OceanofPDF's managed Turnstile** (tested 2026-08-04, retries → page crash). Patch needed if `lxml` errors: `pip install --force-reinstall lxml`.

### 4. Library Genesis (largest catalog, intermittent)
Search: `https://libgen.is/index.php?req=QUERY&columns[]=t&objects[]=f&topics[]=l` (replace with `.gs`/`.li`/`.st` if `.is` down). Download: `https://library.lol/main/{MD5}`. Full mirror list from `zaydiscold/book-review-tracker`: `libgen.li` (primary), `libgen.rs`/`.st`/`.gs`/`.lc` (catalog), `libgen.bz`/`.vg` (routes), `library.lol` (download).

### 5. Anna's Archive (aggregator, last resort)
`https://annas-archive.org/search?q=QUERY`. JSON mode: `&output=json`.

### 6. OceanofPDF (requires browser for Cloudflare Turnstile)
URL: `https://oceanofpdf.com/?s=QUERY`. Browser must click Turnstile checkbox manually or via CUA. Headless tools fail on managed Turnstile.

## File verification (mandatory)
| Check | Command | Valid result |
|-------|---------|-------------|
| Format | `file book.pdf` | "PDF document" |
| Magic bytes | `xxd \| head -1` | Starts with `%PDF-` |
| Size | `ls -la book.pdf` | 1-50 MB (real); <50 KB (fake) |
| EPUB | `file book.epub` | "EPUB document" / "Zip archive" |
| Text | `wc -l book.txt` | 1000+ lines (real book) |

## Pitfalls
- **DuckDuckGo, not Google** — Google blocks free-book results. Always use DDG first.
- **Smart quotes break search** — replace curly quotes with straight quotes in queries.
- **OceanofPDF Turnstile** — managed version requires real browser. LibGen or Gutenberg are faster.
- **LibGen downtime** — mirrors rotate. Try `.gs`, `.li`, `.st` if `.is` is down.
- **Small files** — <50 KB PDF or <100 KB EPUB is almost certainly a fake/malware.

## Related tools
- **Scrapling** (https://github.com/D4Vinci/Scrapling) — HTTP fetcher for non-Cloudflare sites
- **book-review-tracker** (https://github.com/zaydiscold/book-review-tracker) — LibGen engine with mirror probing
- **Browser CUA** — for OceanofPDF Turnstile