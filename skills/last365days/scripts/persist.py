#!/usr/bin/env python3
"""Persistence layer for last365days.

Manages per-person/topic MD files in ~/Desktop/last365days/.
Each file accumulates dated research sections over time.

Subcommands:
    list                List existing profile files with metadata
    match <topic>       Suggest matching profiles for a topic
    append <slug>       Read report.json + synthesis from stdin, append section
    history <slug>      Show dates and previews of existing entries
    read <slug>         Output full file contents (for LLM context)
    search <query>      Search synthesis content across all profiles
    slugify <topic>     Convert topic string to filename slug
"""

import argparse
import csv
import difflib
import hashlib
import io
import json
import os
import re
import shutil
import sys
import unicodedata
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

DEFAULT_RESEARCH_DIR = Path(os.environ.get("LAST365DAYS_DIR", str(Path.home() / "Desktop" / "last365days")))
DEFAULT_REPORT_OUT = Path(
    os.environ.get(
        "LAST365DAYS_OUTPUT_DIR"
    ) or os.environ.get(
        "LAST365DAYS_OUT"
    ) or os.environ.get(
        "LAST30DAYS_OUTPUT_DIR"
    ) or os.environ.get(
        "LAST30DAYS_OUT"
    ) or str(Path.home() / ".local" / "share" / "last365days" / "out")
)


def resolve_research_engine_path() -> Path:
    candidates = [
        Path.home() / ".agents" / "skills" / "last30days" / "scripts" / "last30days.py",
        Path.home() / ".codex" / "skills" / "last30days" / "scripts" / "last30days.py",
        Path.home() / ".claude" / "skills" / "last30days" / "scripts" / "last30days.py",
        Path.home() / ".gemini" / "extensions" / "last30days" / "scripts" / "last30days.py",
        Path.home() / ".gemini" / "extensions" / "last30days-skill" / "scripts" / "last30days.py",
        Path(__file__).resolve().with_name("last30days.py"),
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate
    return candidates[-1]

RESEARCH_DIR = DEFAULT_RESEARCH_DIR
REPORT_OUT = DEFAULT_REPORT_OUT


def slugify(text: str) -> str:
    text = text.lower().strip()
    normalized = unicodedata.normalize('NFKD', text)
    ascii_text = normalized.encode('ascii', 'ignore').decode()
    if not ascii_text.strip():
        ascii_text = text.encode('ascii', 'replace').decode()
    ascii_text = re.sub(r'[^\w\s-]', '', ascii_text)
    ascii_text = re.sub(r'[\s_]+', '-', ascii_text)
    ascii_text = re.sub(r'-+', '-', ascii_text)
    result = ascii_text.strip('-')
    if not result:
        stable_hash = hashlib.sha256(text.encode('utf-8', 'replace')).hexdigest()[:8]
        result = f"topic-{stable_hash}"
    return result


def list_profiles() -> List[Dict[str, Any]]:
    RESEARCH_DIR.mkdir(parents=True, exist_ok=True)
    profiles = []
    for f in sorted(RESEARCH_DIR.glob("*.md")):
        try:
            content = f.read_text(encoding='utf-8', errors='replace')
        except (OSError, IOError) as e:
            sys.stderr.write(f"[persist] Warning: could not read {f}: {e}\n")
            continue
        title = ""
        dates = []
        entry_count = 0
        for line in content.split('\n'):
            if line.startswith('# ') and not title:
                title = line[2:].strip()
            if re.match(r'^## \d{4}-\d{2}-\d{2}', line):
                dates.append(line[3:13])
                entry_count += 1
        profiles.append({
            "slug": f.stem,
            "title": title or f.stem,
            "file": str(f),
            "entries": entry_count,
            "dates": dates,
            "last_updated": dates[-1] if dates else None,
            "size_kb": round(f.stat().st_size / 1024, 1),
        })
    return profiles


_CONFIDENCE_ORDER = {"exact": 0, "high": 1, "medium": 2}
_STATUS_ORDER = {"ok": 0, "warn": 1, "error": 2}
_EXPORT_CSV_FIELDS = [
    "slug",
    "title",
    "date",
    "update_time",
    "label",
    "synthesis",
    "sources",
    "notable_items",
    "research_window",
    "file",
]


def suggest_matches(topic: str, profiles: list) -> list:
    topic = topic.strip()
    if not topic:
        return []
    topic_lower = topic.lower()
    topic_slug = slugify(topic)
    topic_tokens = set(topic_lower.split())
    matches = []
    for p in profiles:
        title_lower = p["title"].lower()
        title_tokens = set(title_lower.split())
        if topic_slug == p["slug"]:
            matches.append({**p, "confidence": "exact"})
        elif topic_lower in title_lower or title_lower in topic_lower:
            matches.append({**p, "confidence": "high"})
        elif topic_tokens & title_tokens:
            overlap = len(topic_tokens & title_tokens) / max(len(topic_tokens), len(title_tokens))
            if overlap >= 0.5:
                matches.append({**p, "confidence": "medium"})
    matches.sort(key=lambda m: _CONFIDENCE_ORDER.get(m["confidence"], 99))
    return matches


def _safe_eng(item: dict, key: str, default=0):
    eng = item.get("engagement") or {}
    val = eng.get(key)
    return val if val is not None else default


def resolve_profile_path(slug: str) -> Path:
    cleaned = slug.strip()
    if not cleaned:
        raise ValueError("Profile slug cannot be blank.")
    if any(sep in cleaned for sep in ("/", "\\")) or ".." in cleaned:
        raise ValueError("Profile slug cannot contain path traversal segments.")

    base = RESEARCH_DIR.resolve()
    candidate = (RESEARCH_DIR / f"{cleaned}.md").resolve()
    if candidate != base and base not in candidate.parents:
        raise ValueError("Profile slug resolves outside the research directory.")
    return candidate


def _pick_status(*statuses: str) -> str:
    chosen = "ok"
    for status in statuses:
        if _STATUS_ORDER.get(status, -1) > _STATUS_ORDER.get(chosen, -1):
            chosen = status
    return chosen


def _first_existing_parent(path: Path) -> Optional[Path]:
    current = path
    while True:
        if current.exists():
            return current
        if current.parent == current:
            return None
        current = current.parent


def _check_directory(path: Path, *, create_on_write: bool = False) -> Dict[str, Any]:
    path = path.expanduser()
    if path.exists():
        if not path.is_dir():
            return {
                "status": "error",
                "path": str(path),
                "message": "Path exists, but it is not a directory.",
            }
        if not os.access(path, os.W_OK):
            return {
                "status": "error",
                "path": str(path),
                "message": "Directory exists, but it is not writable.",
            }
        return {
            "status": "ok",
            "path": str(path),
            "message": "Directory exists and is writable.",
        }

    parent = _first_existing_parent(path.parent)
    if parent and parent.is_dir() and os.access(parent, os.W_OK):
        message = "Directory does not exist yet, but it can be created."
        if create_on_write:
            message = "Directory does not exist yet; it will be created on first write."
        return {
            "status": "warn",
            "path": str(path),
            "message": message,
            "parent": str(parent),
        }

    return {
        "status": "error",
        "path": str(path),
        "message": "Directory does not exist and cannot be created from the current parent path.",
        "parent": str(parent) if parent else None,
    }


def find_shared_research_engine() -> Dict[str, Any]:
    engine_path = resolve_research_engine_path()
    if engine_path.exists():
        return {
            "status": "ok",
            "path": str(engine_path),
            "message": "Shared research engine is available.",
        }
    return {
        "status": "error",
        "path": str(engine_path),
        "message": "Shared research engine could not be found.",
    }


def read_report() -> dict:
    report_path = REPORT_OUT / "report.json"
    if not report_path.exists():
        return {}
    try:
        with open(report_path, encoding='utf-8') as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError) as e:
        sys.stderr.write(f"[persist] Warning: could not read {report_path}: {e}\n")
        return {}


def _report_topic_matches(report: dict, slug: str, title: str) -> bool:
    """Check if report.json topic plausibly matches the slug/title being saved."""
    report_topic = (report.get("topic") or "").lower()
    if not report_topic:
        return False
    slug_lower = slug.replace("-", " ")
    title_lower = title.lower()
    if slug_lower in report_topic or report_topic in slug_lower:
        return True
    if title_lower in report_topic or report_topic in title_lower:
        return True
    report_tokens = set(report_topic.split())
    title_tokens = set(title_lower.split())
    if report_tokens and title_tokens:
        overlap = len(report_tokens & title_tokens) / max(len(report_tokens), len(title_tokens))
        if overlap >= 0.4:
            return True
    return False


def _validate_report_shape(report: Any) -> Dict[str, Any]:
    source_keys = [
        "reddit",
        "x",
        "youtube",
        "tiktok",
        "instagram",
        "hackernews",
        "polymarket",
        "web",
    ]
    if not isinstance(report, dict):
        return {
            "status": "error",
            "message": "report.json must contain a top-level JSON object.",
        }

    issues = []
    topic = report.get("topic")
    if topic is not None and not isinstance(topic, str):
        issues.append("topic must be a string when present")

    range_obj = report.get("range")
    has_range = (
        isinstance(range_obj, dict)
        and isinstance(range_obj.get("from"), str)
        and isinstance(range_obj.get("to"), str)
    ) or (
        isinstance(report.get("range_from"), str)
        and isinstance(report.get("range_to"), str)
    )
    if not has_range:
        issues.append("missing range metadata")

    bad_sources = [key for key in source_keys if key in report and not isinstance(report[key], list)]
    if bad_sources:
        issues.append(f"source buckets must be lists: {', '.join(sorted(bad_sources))}")

    present_sources = [key for key in source_keys if isinstance(report.get(key), list)]
    status = "ok" if not issues else "warn"
    return {
        "status": status,
        "message": "report.json is readable and has the expected top-level shape." if not issues else "; ".join(issues),
        "topic": topic,
        "sources_present": present_sources,
    }


def run_doctor() -> Dict[str, Any]:
    research_dir = _check_directory(RESEARCH_DIR, create_on_write=True)
    output_dir = _check_directory(REPORT_OUT)
    report_path = REPORT_OUT / "report.json"
    research_engine_dep = find_shared_research_engine()

    qmd_path = shutil.which("qmd")
    qmd_dep = {
        "status": "ok" if qmd_path else "warn",
        "path": qmd_path,
        "message": "Found qmd executable." if qmd_path else "qmd not found. Index refresh hook will be skipped.",
    }

    if not report_path.exists():
        report_json = {
            "status": "warn",
            "path": str(report_path),
            "message": "report.json not found. Run last365days research first if you want source stats.",
        }
    else:
        try:
            with open(report_path, encoding="utf-8") as handle:
                report = json.load(handle)
        except (json.JSONDecodeError, OSError) as exc:
            report_json = {
                "status": "error",
                "path": str(report_path),
                "message": f"Could not read report.json: {exc}",
            }
        else:
            report_json = {
                "path": str(report_path),
                **_validate_report_shape(report),
            }

    status = _pick_status(
        research_dir["status"],
        output_dir["status"],
        report_json["status"],
        research_engine_dep["status"],
        qmd_dep["status"],
    )
    return {
        "status": status,
        "research_dir": research_dir,
        "research_output_dir": output_dir,
        "report_json": report_json,
        "dependencies": {
            "research_engine": research_engine_dep,
            "qmd": qmd_dep,
        },
    }


def format_stats_block(report: dict) -> str:
    lines = []
    sections = {
        "reddit": ("threads", lambda items: f"{sum(_safe_eng(i, 'score') for i in items)} upvotes | {sum(_safe_eng(i, 'num_comments') for i in items)} comments"),
        "x": ("posts", lambda items: f"{sum(_safe_eng(i, 'likes') for i in items)} likes | {sum(_safe_eng(i, 'reposts') for i in items)} reposts"),
        "youtube": ("videos", lambda items: f"{sum(_safe_eng(i, 'views') for i in items):,} views"),
        "tiktok": ("videos", lambda items: f"{sum(_safe_eng(i, 'views') for i in items):,} views | {sum(_safe_eng(i, 'likes') for i in items):,} likes"),
        "instagram": ("reels", lambda items: f"{sum(_safe_eng(i, 'views') for i in items):,} views | {sum(_safe_eng(i, 'likes') for i in items):,} likes"),
        "hackernews": ("stories", lambda items: f"{sum(_safe_eng(i, 'score') for i in items)} points | {sum(_safe_eng(i, 'num_comments') for i in items)} comments"),
        "polymarket": ("markets", lambda items: ""),
        "web": ("pages", lambda items: ""),
    }
    labels = {
        "reddit": "Reddit", "x": "X", "youtube": "YouTube", "tiktok": "TikTok",
        "instagram": "Instagram", "hackernews": "HN", "polymarket": "Polymarket", "web": "Web",
    }

    for key, (unit, detail_fn) in sections.items():
        items = report.get(key) or []
        if not items:
            continue
        detail = detail_fn(items)
        suffix = f" | {detail}" if detail else ""
        lines.append(f"- {labels[key]}: {len(items)} {unit}{suffix}")

    return "\n".join(lines) if lines else "- No sources returned data"


def format_top_sources(report: dict, max_per: int = 3) -> str:
    lines = []

    for item in sorted(report.get("x") or [], key=lambda i: _safe_eng(i, 'likes'), reverse=True)[:max_per]:
        handle = item.get("author_handle", "?")
        text = (item.get("text") or "")[:140].replace('\n', ' ')
        likes = _safe_eng(item, 'likes')
        lines.append(f"- @{handle} ({likes} likes): {text}")

    for item in sorted(report.get("reddit") or [], key=lambda i: _safe_eng(i, 'score'), reverse=True)[:max_per]:
        sub = item.get("subreddit", "?")
        title = (item.get("title") or "")[:140]
        pts = _safe_eng(item, 'score')
        lines.append(f"- r/{sub} ({pts} pts): {title}")

    for item in sorted(report.get("youtube") or [], key=lambda i: _safe_eng(i, 'views'), reverse=True)[:max_per]:
        channel = item.get("channel_name", "?")
        title = (item.get("title") or "")[:140]
        views = _safe_eng(item, 'views')
        lines.append(f"- {channel} ({views:,} views): {title}")

    for item in sorted(report.get("tiktok") or [], key=lambda i: _safe_eng(i, 'views'), reverse=True)[:max_per]:
        creator = item.get("author_name", "?")
        text = (item.get("text") or "")[:140].replace('\n', ' ')
        views = _safe_eng(item, 'views')
        lines.append(f"- @{creator} on TikTok ({views:,} views): {text}")

    return "\n".join(lines) if lines else ""


def _find_same_day_section(content: str, today: str) -> bool:
    """Check if a section for today's date already exists."""
    return bool(re.search(rf'^## {re.escape(today)}', content, re.MULTILINE))


def append_entry(slug: str, title: str, synthesis: str = "") -> dict:
    RESEARCH_DIR.mkdir(parents=True, exist_ok=True)
    try:
        filepath = resolve_profile_path(slug)
    except ValueError as exc:
        return {"error": str(exc)}
    today = datetime.now().strftime("%Y-%m-%d")
    now_time = datetime.now().strftime("%H:%M")
    report = read_report()
    is_new_file = not filepath.exists()

    # Validate report.json matches this topic
    stats_valid = _report_topic_matches(report, slug, title) if report else False
    if report and not stats_valid:
        report_topic = report.get("topic", "unknown")
        sys.stderr.write(f"[persist] Warning: report.json topic '{report_topic}' doesn't match '{title}'. Saving synthesis without stats.\n")

    section_lines = []

    # Handle same-day entries
    if not is_new_file:
        existing_content = filepath.read_text()
        if _find_same_day_section(existing_content, today):
            section_lines.append(f"\n#### Update at {now_time}\n")
        else:
            section_lines.append(f"\n## {today}\n")
    else:
        section_lines.append(f"\n## {today}\n")

    if synthesis.strip():
        section_lines.append("### Synthesis\n")
        section_lines.append(synthesis.strip())
        section_lines.append("")

    if stats_valid:
        section_lines.append("\n### Sources\n")
        section_lines.append(format_stats_block(report))
        section_lines.append("")

        top = format_top_sources(report)
        if top.strip():
            section_lines.append("\n### Notable Items\n")
            section_lines.append(top)
            section_lines.append("")

        range_obj = report.get('range') or {}
        range_from = range_obj.get('from', report.get('range_from', '?'))
        range_to = range_obj.get('to', report.get('range_to', '?'))
        date_range = f"{range_from} to {range_to}"
        section_lines.append(f"\n*Research window: {date_range}*")

    section_lines.append("\n---\n")

    section = "\n".join(section_lines)

    if filepath.exists():
        with open(filepath, 'a') as f:
            f.write(section)
    else:
        with open(filepath, 'w') as f:
            f.write(f"# {title}\n")
            f.write(section)

    content = filepath.read_text()
    entry_count = len(re.findall(r'^## \d{4}-\d{2}-\d{2}', content, re.MULTILINE))

    return {
        "file": str(filepath),
        "slug": slug,
        "title": title,
        "date": today,
        "is_new": is_new_file,
        "total_entries": entry_count,
        "stats_included": stats_valid,
    }


def show_history(slug: str) -> dict:
    try:
        filepath = resolve_profile_path(slug)
    except ValueError as exc:
        return {"error": str(exc)}
    if not filepath.exists():
        return {"error": f"No profile found: {slug}"}

    try:
        content = filepath.read_text(encoding='utf-8', errors='replace')
    except (OSError, IOError) as e:
        return {"error": f"Could not read {slug}: {e}"}

    entries = []
    current_date = None
    current_time = None
    current_synthesis_lines: List[str] = []
    in_synthesis = False

    def _flush_entry():
        if current_date:
            preview = ' '.join(current_synthesis_lines)[:200] if current_synthesis_lines else "(no synthesis)"
            label = current_date
            if current_time:
                label = f"{current_date} (update at {current_time})"
            entries.append({"date": label, "preview": preview})

    for line in content.split('\n'):
        date_match = re.match(r'^## (\d{4}-\d{2}-\d{2})', line)
        update_match = re.match(r'^#### Update at (\d{2}:\d{2})', line)
        if date_match:
            _flush_entry()
            current_date = date_match.group(1)
            current_time = None
            current_synthesis_lines = []
            in_synthesis = False
        elif update_match:
            _flush_entry()
            current_time = update_match.group(1)
            current_synthesis_lines = []
            in_synthesis = False
        elif line.strip() == "### Synthesis":
            in_synthesis = True
        elif line.startswith("### ") and in_synthesis:
            in_synthesis = False
        elif in_synthesis and line.strip():
            current_synthesis_lines.append(line.strip())

    _flush_entry()

    return {"slug": slug, "file": str(filepath), "entries": entries}


def search_profiles(query: str, slug_filter: Optional[str] = None) -> List[Dict[str, Any]]:
    """Search synthesis content across all profiles (or a single one)."""
    RESEARCH_DIR.mkdir(parents=True, exist_ok=True)
    query_lower = query.lower()
    results = []
    if slug_filter:
        try:
            files = [resolve_profile_path(slug_filter)]
        except ValueError:
            return []
    else:
        files = sorted(RESEARCH_DIR.glob("*.md"))
    for f in files:
        if not f.exists():
            continue
        try:
            content = f.read_text(encoding='utf-8', errors='replace')
        except (OSError, IOError):
            continue
        title = ""
        current_date = None
        for line in content.split('\n'):
            if line.startswith('# ') and not title:
                title = line[2:].strip()
            date_match = re.match(r'^## (\d{4}-\d{2}-\d{2})', line)
            if date_match:
                current_date = date_match.group(1)
            if query_lower in line.lower():
                snippet = line.strip()[:200]
                results.append({
                    "slug": f.stem,
                    "title": title or f.stem,
                    "date": current_date,
                    "snippet": snippet,
                })
    return results


def _normalize_block_text(lines: List[str]) -> str:
    return "\n".join(lines).strip()


def parse_profile_content(content: str, slug: str, filepath: Path) -> Dict[str, Any]:
    title = ""
    entries: List[Dict[str, Any]] = []
    current_date: Optional[str] = None
    current_time: Optional[str] = None
    current_section: Optional[str] = None
    current_lines: List[str] = []
    current_synthesis: List[str] = []
    current_sources: List[str] = []
    current_notable_items: List[str] = []
    current_research_window: Optional[str] = None

    def _reset_entry() -> None:
        nonlocal current_section, current_lines, current_synthesis
        nonlocal current_sources, current_notable_items, current_research_window
        current_section = None
        current_lines = []
        current_synthesis = []
        current_sources = []
        current_notable_items = []
        current_research_window = None

    def _flush_entry() -> None:
        if current_date is None:
            return
        label = current_date if not current_time else f"{current_date} (update at {current_time})"
        entries.append(
            {
                "date": current_date,
                "update_time": current_time,
                "label": label,
                "synthesis": _normalize_block_text(current_synthesis),
                "sources": _normalize_block_text(current_sources),
                "notable_items": _normalize_block_text(current_notable_items),
                "research_window": current_research_window,
                "raw_markdown": _normalize_block_text(current_lines),
            }
        )

    for line in content.split("\n"):
        if line.startswith("# ") and not title:
            title = line[2:].strip()
            continue

        date_match = re.match(r"^## (\d{4}-\d{2}-\d{2})\s*$", line)
        update_match = re.match(r"^#### Update at (\d{2}:\d{2})\s*$", line)
        if date_match:
            _flush_entry()
            current_date = date_match.group(1)
            current_time = None
            _reset_entry()
            current_lines.append(line)
            continue
        if update_match and current_date is not None:
            _flush_entry()
            current_time = update_match.group(1)
            _reset_entry()
            current_lines.append(line)
            continue

        if current_date is None:
            continue

        current_lines.append(line)
        heading_match = re.match(r"^### (.+)$", line)
        if heading_match:
            heading = heading_match.group(1).strip().lower()
            if heading == "notable items":
                current_section = "notable_items"
            elif heading in {"synthesis", "sources"}:
                current_section = heading
            else:
                current_section = None
            continue

        if line.strip() == "---":
            current_section = None
            continue

        research_window_match = re.match(r"^\*Research window: (.+)\*$", line.strip())
        if research_window_match:
            current_research_window = research_window_match.group(1)
            continue

        if not line.strip():
            continue

        if current_section == "synthesis":
            current_synthesis.append(line.strip())
        elif current_section == "sources":
            current_sources.append(line.strip())
        elif current_section == "notable_items":
            current_notable_items.append(line.strip())

    _flush_entry()
    return {
        "slug": slug,
        "title": title or slug,
        "file": str(filepath),
        "entry_count": len(entries),
        "entries": entries,
    }


def export_profile_data(slug: str) -> Dict[str, Any]:
    try:
        filepath = resolve_profile_path(slug)
    except ValueError as exc:
        return {"error": str(exc)}
    if not filepath.exists():
        return {"error": f"No profile found: {slug}"}
    content = filepath.read_text(encoding="utf-8", errors="replace")
    return parse_profile_content(content, slug, filepath)


def export_all_profile_data() -> Dict[str, Any]:
    profiles = []
    for filepath in sorted(RESEARCH_DIR.glob("*.md")):
        content = filepath.read_text(encoding="utf-8", errors="replace")
        profiles.append(parse_profile_content(content, filepath.stem, filepath))
    return {
        "profiles": profiles,
        "total_profiles": len(profiles),
        "total_entries": sum(profile["entry_count"] for profile in profiles),
    }


def _profiles_to_csv_rows(profiles: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    rows = []
    for profile in profiles:
        for entry in profile["entries"]:
            rows.append(
                {
                    "slug": profile["slug"],
                    "title": profile["title"],
                    "date": entry["date"],
                    "update_time": entry["update_time"] or "",
                    "label": entry["label"],
                    "synthesis": entry["synthesis"],
                    "sources": entry["sources"],
                    "notable_items": entry["notable_items"],
                    "research_window": entry["research_window"] or "",
                    "file": profile["file"],
                }
            )
    return rows


def render_csv(rows: List[Dict[str, Any]]) -> str:
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=_EXPORT_CSV_FIELDS)
    writer.writeheader()
    for row in rows:
        writer.writerow(row)
    return buffer.getvalue()


def extract_date_blocks(content: str) -> Dict[str, str]:
    blocks: Dict[str, str] = {}
    current_date: Optional[str] = None
    current_lines: List[str] = []
    for line in content.split("\n"):
        date_match = re.match(r"^## (\d{4}-\d{2}-\d{2})\s*$", line)
        if date_match:
            if current_date is not None:
                blocks[current_date] = _normalize_block_text(current_lines)
            current_date = date_match.group(1)
            current_lines = [line]
            continue
        if current_date is not None:
            current_lines.append(line)
    if current_date is not None:
        blocks[current_date] = _normalize_block_text(current_lines)
    return blocks


def diff_profile_dates(slug: str, date1: str, date2: str) -> Dict[str, Any]:
    profile = export_profile_data(slug)
    if "error" in profile:
        return profile

    content = Path(profile["file"]).read_text(encoding="utf-8", errors="replace")
    blocks = extract_date_blocks(content)
    if date1 not in blocks or date2 not in blocks:
        return {
            "error": f"Could not diff {slug}. Available dates: {', '.join(sorted(blocks))}",
            "available_dates": sorted(blocks),
        }

    diff_lines = difflib.unified_diff(
        blocks[date1].splitlines(),
        blocks[date2].splitlines(),
        fromfile=f"{slug}:{date1}",
        tofile=f"{slug}:{date2}",
        lineterm="",
    )
    return {
        "slug": slug,
        "title": profile["title"],
        "from_date": date1,
        "to_date": date2,
        "diff": "\n".join(diff_lines),
    }


def read_profile(slug: str) -> dict:
    try:
        filepath = resolve_profile_path(slug)
    except ValueError as exc:
        return {"error": str(exc)}
    if not filepath.exists():
        return {"error": f"No profile found: {slug}"}
    content = filepath.read_text()
    return {"slug": slug, "file": str(filepath), "content": content}


def main():
    parser = argparse.ArgumentParser(description="Persistence layer for last365days research")
    parser.add_argument("--research-dir", help="Override research directory (default: ~/Desktop/last365days/ or LAST365DAYS_DIR)")
    parser.add_argument("--report-path", help="Override report output directory (default: ~/.local/share/last365days/out or LAST365DAYS_OUTPUT_DIR)")
    sub = parser.add_subparsers(dest="command")

    sub.add_parser("list", help="List existing profiles")
    sub.add_parser("doctor", help="Validate paths, report.json, and dependencies")

    m = sub.add_parser("match", help="Suggest matching profiles for a topic")
    m.add_argument("topic", nargs="+", help="Topic to match")

    a = sub.add_parser("append", help="Append a new entry (reads synthesis from stdin)")
    a.add_argument("slug", help="Profile slug (e.g. saba-nafees)")
    a.add_argument("--title", required=True, help="Display name (e.g. 'Saba Nafees')")

    h = sub.add_parser("history", help="Show entry history for a profile")
    h.add_argument("slug", help="Profile slug")

    r = sub.add_parser("read", help="Output full profile contents")
    r.add_argument("slug", help="Profile slug")

    se = sub.add_parser("search", help="Search synthesis content across profiles")
    se.add_argument("query", nargs="+", help="Search query")
    se.add_argument("--slug", help="Limit search to a single profile")

    d = sub.add_parser("diff", help="Diff two dated entries from the same profile")
    d.add_argument("slug", help="Profile slug")
    d.add_argument("date1", help="Earlier date in YYYY-MM-DD format")
    d.add_argument("date2", help="Later date in YYYY-MM-DD format")

    ex = sub.add_parser("export", help="Export one profile or all profiles")
    ex.add_argument("slug", nargs="?", help="Profile slug")
    ex.add_argument("--all", action="store_true", help="Export all profiles")
    ex.add_argument("--format", choices=["md", "json", "csv"], required=True, help="Output format")

    s = sub.add_parser("slugify", help="Convert topic to slug")
    s.add_argument("topic", nargs="+", help="Topic to slugify")

    args = parser.parse_args()

    global RESEARCH_DIR, REPORT_OUT
    if args.research_dir:
        RESEARCH_DIR = Path(args.research_dir)
    if args.report_path:
        REPORT_OUT = Path(args.report_path)

    if args.command == "list":
        print(json.dumps(list_profiles(), indent=2))

    elif args.command == "doctor":
        result = run_doctor()
        print(json.dumps(result, indent=2))
        sys.exit(0 if result["status"] != "error" else 1)

    elif args.command == "match":
        topic = " ".join(args.topic)
        if not topic.strip():
            print(json.dumps({
                "topic": "",
                "suggested_slug": None,
                "matches": [],
                "total_profiles": len(list_profiles()),
            }, indent=2))
            return
        profiles = list_profiles()
        matches = suggest_matches(topic, profiles)
        print(json.dumps({
            "topic": topic,
            "suggested_slug": slugify(topic),
            "matches": matches,
            "total_profiles": len(profiles),
        }, indent=2))

    elif args.command == "append":
        synthesis = ""
        if not sys.stdin.isatty():
            synthesis = sys.stdin.read()
        result = append_entry(args.slug, args.title, synthesis)
        print(json.dumps(result, indent=2))
        if "error" in result:
            sys.exit(1)

    elif args.command == "history":
        print(json.dumps(show_history(args.slug), indent=2))

    elif args.command == "read":
        result = read_profile(args.slug)
        if "error" in result:
            print(json.dumps(result))
        else:
            print(result["content"])

    elif args.command == "search":
        query = " ".join(args.query)
        results = search_profiles(query, slug_filter=args.slug)
        print(json.dumps({"query": query, "results": results, "total": len(results)}, indent=2))

    elif args.command == "diff":
        result = diff_profile_dates(args.slug, args.date1, args.date2)
        print(json.dumps(result, indent=2))
        if "error" in result:
            sys.exit(1)

    elif args.command == "export":
        if args.all and args.slug:
            print(json.dumps({"error": "Use either a slug or --all, not both."}, indent=2))
            sys.exit(1)
        if not args.all and not args.slug:
            print(json.dumps({"error": "Provide a slug or use --all."}, indent=2))
            sys.exit(1)
        if args.all and args.format == "md":
            print(json.dumps({"error": "Markdown export is only available for a single profile."}, indent=2))
            sys.exit(1)

        if args.all:
            payload = export_all_profile_data()
            if args.format == "json":
                print(json.dumps(payload, indent=2))
            else:
                sys.stdout.write(render_csv(_profiles_to_csv_rows(payload["profiles"])))
        else:
            profile = export_profile_data(args.slug)
            if "error" in profile:
                print(json.dumps(profile, indent=2))
                sys.exit(1)
            if args.format == "md":
                sys.stdout.write(Path(profile["file"]).read_text(encoding="utf-8", errors="replace"))
            elif args.format == "json":
                print(json.dumps(profile, indent=2))
            else:
                sys.stdout.write(render_csv(_profiles_to_csv_rows([profile])))

    elif args.command == "slugify":
        print(slugify(" ".join(args.topic)))

    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
