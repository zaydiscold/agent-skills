#!/usr/bin/env python3
"""Thin launcher for the shared last30days research engine.

last365days is the persistence wrapper. The recency engine lives in the
installed last30days skill and should not diverge here.
"""

import os
import sys
from pathlib import Path


def resolve_shared_engine() -> Path:
    here = Path(__file__).resolve()
    candidates = [
        Path.home() / ".agents" / "skills" / "last30days" / "scripts" / "last30days.py",
        Path.home() / ".codex" / "skills" / "last30days" / "scripts" / "last30days.py",
        Path.home() / ".claude" / "skills" / "last30days" / "scripts" / "last30days.py",
        Path.home() / ".gemini" / "extensions" / "last30days" / "scripts" / "last30days.py",
        Path.home() / ".gemini" / "extensions" / "last30days-skill" / "scripts" / "last30days.py",
    ]
    for candidate in candidates:
        if candidate.exists() and candidate.resolve() != here:
            return candidate
    raise FileNotFoundError("Could not find the shared last30days engine installation.")


def main() -> None:
    engine = resolve_shared_engine()
    os.execv(sys.executable, [sys.executable, str(engine), *sys.argv[1:]])


if __name__ == "__main__":
    main()
