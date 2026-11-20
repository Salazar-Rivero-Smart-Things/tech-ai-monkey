#!/usr/bin/env python3
"""
Tech AI Monkey — "What Did He Learn Today?" Report & Project Library Advisor
============================================================================
Displays everything Tech AI Monkey studied and memorized today (or over the
last N days), plus searches the live trending/new libraries JSON catalog to
recommend the best libraries for whatever project you are building right now!

Usage:
  python scripts/training/what_learned_today.py
  python scripts/training/what_learned_today.py --days 7
  python scripts/training/what_learned_today.py --search video
  python scripts/training/what_learned_today.py --json
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List

REPO_ROOT = Path(__file__).resolve().parents[2]
SKILLS_DIR = REPO_ROOT / "skills"
LOG_FILE = SKILLS_DIR / "daily_learning_log.json"
TRENDING_FILE = SKILLS_DIR / "trending_libraries.json"
READING_LIST_FILE = SKILLS_DIR / "supervisor_reading_list.json"


def load_json(path: Path, default: Any) -> Any:
    if path.exists():
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            pass
    return default


def search_libraries(trending: Dict[str, Any], keyword: str) -> List[Dict[str, str]]:
    kw = keyword.strip().lower()
    hits: List[Dict[str, str]] = []
    for p in trending.get("pypi_in_libraries", []):
        blob = f"{p.get('name', '')} {p.get('summary', '')} {p.get('when_to_recommend', '')}".lower()
        if kw in blob:
            hits.append(
                {
                    "source": "PyPI (IN)",
                    "name": f"{p['name']} v{p.get('version', '')}",
                    "install": p.get("install", ""),
                    "tip": p.get("when_to_recommend") or p.get("summary", ""),
                }
            )
    for bucket, label in [("brand_new_github", "GitHub NEW (90d)"), ("popular_github", "GitHub Popular")]:
        for r in trending.get(bucket, []):
            blob = f"{r.get('name', '')} {r.get('language', '')} {r.get('description', '')} {' '.join(r.get('topics', []))}".lower()
            if kw in blob:
                hits.append(
                    {
                        "source": label,
                        "name": f"{r['name']} (stars: {r.get('stars', 0):,})",
                        "install": r.get("url", ""),
                        "tip": r.get("description", ""),
                    }
                )
    for p in trending.get("npm_trending", []):
        blob = f"{p.get('name', '')} {p.get('category', '')} {p.get('description', '')}".lower()
        if kw in blob:
            hits.append(
                {
                    "source": "npm (IN)",
                    "name": f"{p['name']} v{p.get('version', '')}",
                    "install": p.get("install", ""),
                    "tip": p.get("description", ""),
                }
            )
    return hits


def main() -> int:
    parser = argparse.ArgumentParser(description="Show what Tech AI Monkey learned today & recommend trending libraries.")
    parser.add_argument("--days", type=int, default=1, help="Number of days back to include (default: 1 = today)")
    parser.add_argument("--search", type=str, default="", help="Search memorized trending/new libraries for your current project")
    parser.add_argument("--json", action="store_true", help="Output machine-readable JSON")
    args = parser.parse_args()

    log_data = load_json(LOG_FILE, {"sessions": []})
    trending = load_json(TRENDING_FILE, {})
    reading_list = load_json(READING_LIST_FILE, {"topics": []})

    if args.search:
        hits = search_libraries(trending, args.search)
        if args.json:
            print(json.dumps({"query": args.search, "matches": hits}, indent=2, ensure_ascii=False))
            return 0
        print(f"=== Library Recommendations for '{args.search}' ({len(hits)} match(es)) ===")
        if not hits:
            print("No matches yet. Run `python scripts/training/fetch_trending_libraries.py` to refresh the JSON radar.")
        for h in hits[:12]:
            print(f"  [{h['source']}] {h['name']}")
            print(f"     Install/URL : {h['install']}")
            print(f"     Why use it  : {h['tip']}")
        return 0

    cutoff = (datetime.now() - timedelta(days=max(0, args.days - 1))).strftime("%Y-%m-%d")
    sessions = [s for s in log_data.get("sessions", []) if s.get("date", "") >= cutoff]

    topics_learned: List[Dict[str, Any]] = []
    total_minutes = 0.0
    for s in sessions:
        total_minutes += float(s.get("elapsed_minutes", 0.0))
        topics_learned.extend(s.get("topics_learned", []))

    pending = [t["title"] for t in reading_list.get("topics", []) if t.get("status") != "learned"]

    report = {
        "period_since": cutoff,
        "sessions_count": len(sessions),
        "total_study_minutes": round(total_minutes, 2),
        "topics_learned": topics_learned,
        "trending_radar_updated_at": trending.get("fetchedAt"),
        "top_brand_new_libraries": trending.get("brand_new_github", [])[:5],
        "pending_supervisor_topics": pending,
    }

    if args.json:
        print(json.dumps(report, indent=2, ensure_ascii=False))
        return 0

    label = "TODAY" if args.days == 1 else f"LAST {args.days} DAYS (since {cutoff})"
    print("====================================================================")
    print(f"  TECH AI MONKEY — WHAT HE LEARNED ({label})")
    print("====================================================================")
    print(f"  Study Sessions   : {len(sessions)} ({round(total_minutes, 1)} min total)")
    print(f"  Topics Mastered  : {len(topics_learned)}")
    print(f"  Library Radar    : {trending.get('fetchedAt') or 'Not fetched yet'}")
    print("--------------------------------------------------------------------")

    if not topics_learned:
        print("  He has not run a study session yet in this period.")
        print("  Start one right now:  python scripts/training/study_now_1h.py --minutes 60")
    else:
        for i, t in enumerate(topics_learned, start=1):
            libs = ", ".join(t.get("libraries", []))
            print(f"  {i}. {t['title']} [{t.get('category', 'General')}]")
            if libs:
                print(f"     Libraries : {libs}")
            print(f"     Summary   : {t.get('summary', '')}")
            print(f"     Skill File: {t.get('skill_file', '')}")

    new_libs = trending.get("brand_new_github", [])[:5]
    if new_libs:
        print("\n  Top Brand-New Libraries on His Radar (last 90 days):")
        for r in new_libs:
            print(f"   - {r['name']} ({r['language']}, {r['stars']:,} stars): {r['description'][:110]}")

    if pending:
        print(f"\n  Next Up on Supervisor Reading List ({len(pending)} remaining):")
        for title in pending[:4]:
            print(f"   - {title}")
    print("====================================================================")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
