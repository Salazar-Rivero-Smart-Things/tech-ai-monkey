#!/usr/bin/env python3
"""
Tech AI Monkey — Study NOW (1-Hour Supervisor Skill & Library Training)
=======================================================================
Commands Tech AI Monkey (Qwen2.5-Coder-7B on Railway or local llama-server)
to immediately study skills from the Supervisor's reading list PLUS brand-new
and popular ("IN") libraries fetched from live JSON APIs.

For every topic studied:
  1. Sends a focused deep-study prompt to Qwen2.5-Coder-7B.
  2. Distills a practical cheatsheet (when to use, install commands, code patterns,
     project tips) and saves it as `skills/global/learned-<id>.md` with proper
     Tech AI Monkey YAML frontmatter so the agent knows it by heart!
  3. Logs everything learned into `skills/daily_learning_log.json` so
     `what_learned_today.py` can report it cleanly.

Usage:
  python scripts/training/study_now_1h.py                       # Study for 60 minutes
  python scripts/training/study_now_1h.py --minutes 60 --git-push
  python scripts/training/study_now_1h.py --minutes 5 --max-topics 2
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Tuple

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parents[1]
SKILLS_DIR = REPO_ROOT / "skills"
GLOBAL_SKILLS_DIR = SKILLS_DIR / "global"
READING_LIST_FILE = SKILLS_DIR / "supervisor_reading_list.json"
TRENDING_FILE = SKILLS_DIR / "trending_libraries.json"
LOG_FILE = SKILLS_DIR / "daily_learning_log.json"

sys.path.insert(0, str(SCRIPT_DIR))
import fetch_trending_libraries  # noqa: E402

DEFAULT_AI_URLS = [
    os.getenv("TECH_AI_ENGINE_URL", "").strip(),
    "https://qwen-mcp-server-production.up.railway.app/v1/chat/completions",
    "http://127.0.0.1:8080/v1/chat/completions",
]


def slugify(text: str) -> str:
    s = re.sub(r"[^a-zA-Z0-9]+", "-", text.lower()).strip("-")
    return s[:48] or "topic"


def load_json(path: Path, default: Any) -> Any:
    if path.exists():
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            pass
    return default


def save_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def call_qwen(prompt: str, endpoint: str | None = None, timeout: int = 180) -> Tuple[bool, str, str]:
    urls = [endpoint] if endpoint else [u for u in DEFAULT_AI_URLS if u]
    model_id = os.getenv("LOCAL_AI_MODEL", "qwen2.5-coder-7b-instruct-q4_k_m.gguf")
    payload = json.dumps(
        {
            "model": model_id,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "You are Tech AI Monkey (Qwen2.5-Coder-7B) during your daily supervisor study hour. "
                        "Write a concise, practical engineering cheatsheet in Markdown with:\n"
                        "1. Summary (2-3 bullets)\n"
                        "2. When to recommend this in a user's project\n"
                        "3. Exact install commands & minimal production code example\n"
                        "4. Common pitfalls to avoid."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.25,
            "max_tokens": 900,
            "stream": False,
        }
    ).encode("utf-8")

    last_err = "no endpoint configured"
    for url in urls:
        try:
            req = urllib.request.Request(
                url,
                data=payload,
                headers={"Content-Type": "application/json", "User-Agent": "TechAIMonkey-Trainer/1.0"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                content = (data.get("choices") or [{}])[0].get("message", {}).get("content", "").strip()
                if content:
                    return True, content, url
        except Exception as exc:
            last_err = f"{url} -> {exc}"
    return False, last_err, ""


def build_offline_cheatsheet(topic: Dict[str, Any], libs_context: List[Dict[str, Any]]) -> str:
    libs = ", ".join(topic.get("libraries", [])) or "modern open-source libraries"
    lines = [
        f"# {topic['title']}",
        "",
        f"**Category:** {topic.get('category', 'General')} | **Focus Libraries:** `{libs}`",
        "",
        "## Core Study Goal",
        f"- {topic.get('goal', 'Master practical production patterns and recommend the best modern libraries.')}",
        "",
        "## Key Libraries & Quick Reference",
    ]
    for item in libs_context[:6]:
        name = item.get("name", "")
        desc = item.get("when_to_recommend") or item.get("description") or item.get("summary") or ""
        inst = item.get("install") or item.get("url") or ""
        lines.append(f"- **{name}** (`{inst}`): {desc}")
    lines.extend(
        [
            "",
            "## Project Recommendation Rule",
            "- Whenever a user starts or upgrades a project in this category, proactively suggest the most relevant library above with its exact install command and a clean starter snippet.",
        ]
    )
    return "\n".join(lines)


def write_learned_skill_md(topic: Dict[str, Any], body: str, now_iso: str) -> Path:
    GLOBAL_SKILLS_DIR.mkdir(parents=True, exist_ok=True)
    slug = slugify(topic.get("id") or topic.get("title", "skill"))
    path = GLOBAL_SKILLS_DIR / f"learned-{slug}.md"
    libs = [str(x).lower() for x in topic.get("libraries", [])]
    triggers = ", ".join(dict.fromkeys([slug.replace("-", " "), topic.get("category", "").lower(), *libs]))
    frontmatter = "\n".join(
        [
            "---",
            f"name: {topic['title']}",
            f"description: Memorized engineering cheatsheet & library recommendations for {topic['title']}.",
            f"triggers: {triggers}",
            "scope: global",
            "createdBy: supervisor",
            f"updatedAt: {now_iso}",
            "---",
            "",
        ]
    )
    path.write_text(frontmatter + body.strip() + "\n", encoding="utf-8")
    return path


def pick_study_queue(reading_list: Dict[str, Any], trending: Dict[str, Any]) -> List[Dict[str, Any]]:
    topics = list(reading_list.get("topics", []))
    # Pending first, then oldest studied, ordered by priority
    topics.sort(key=lambda t: (0 if t.get("status") != "learned" else 1, int(t.get("priority", 5)), t.get("lastStudied") or ""))

    # Also add a dynamic "Brand-New Trending Libraries Spotlight" topic from live JSON!
    brand_new = trending.get("brand_new_github", [])[:5]
    if brand_new:
        today_tag = datetime.now().strftime("%Y-%m-%d")
        topics.insert(
            0,
            {
                "id": f"new-libs-{today_tag}",
                "title": f"Brand-New & Trending Libraries Spotlight ({today_tag})",
                "category": "New & IN Libraries",
                "priority": 0,
                "libraries": [r["short_name"] for r in brand_new],
                "goal": "Memorize the hottest newly released GitHub/PyPI/npm libraries so Tech AI Monkey can suggest them during projects.",
                "dynamic_repos": brand_new,
                "status": "pending",
            },
        )
    return topics


def git_commit_and_push(learned_count: int) -> None:
    print("[git] Committing & pushing newly learned skills to GitHub (auto-deploys to Railway)...")
    subprocess.run(["git", "add", "skills/"], cwd=str(REPO_ROOT), check=False)
    msg = f"Daily AI Training: memorized {learned_count} skill(s) & refreshed trending libraries radar"
    res = subprocess.run(["git", "commit", "-m", msg], cwd=str(REPO_ROOT), capture_output=True, text=True)
    if res.returncode == 0:
        subprocess.run(["git", "push", "origin", "main"], cwd=str(REPO_ROOT), check=False)
        print("[git] Pushed newly learned skills to origin/main!")
    else:
        print(f"[git] Nothing new to commit: {res.stdout.strip() or res.stderr.strip()}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Make Tech AI Monkey study supervisor skills & trending libraries NOW.")
    parser.add_argument("--minutes", type=float, default=60.0, help="Study duration in minutes (default: 60 = 1 hour)")
    parser.add_argument("--max-topics", type=int, default=8, help="Maximum number of topics to study in one session")
    parser.add_argument("--endpoint", type=str, default=None, help="Override OpenAI-compatible /v1/chat/completions URL")
    parser.add_argument("--skip-fetch", action="store_true", help="Skip refreshing trending_libraries.json before studying")
    parser.add_argument("--offline-only", action="store_true", help="Build structured cheatsheets without calling remote LLM")
    parser.add_argument("--git-push", action="store_true", help="Auto git commit & push skills/ to GitHub when done")
    args = parser.parse_args()

    started_at = datetime.now(timezone.utc)
    deadline = time.monotonic() + (args.minutes * 60.0)

    print("============================================================")
    print(f"  Tech AI Monkey — Supervisor Study Session ({args.minutes:g} min)")
    print("============================================================")

    if not args.skip_fetch:
        trending = fetch_trending_libraries.run_fetch(quiet=False)
    else:
        trending = load_json(TRENDING_FILE, {})

    reading_list = load_json(READING_LIST_FILE, {"topics": []})
    queue = pick_study_queue(reading_list, trending)
    pypi_lookup = {p["name"].lower(): p for p in trending.get("pypi_in_libraries", [])}

    studied_entries: List[Dict[str, Any]] = []
    for idx, topic in enumerate(queue[: args.max_topics], start=1):
        if idx > 1 and time.monotonic() >= deadline:
            print(f"[study] Time budget ({args.minutes:g} min) reached — wrapping up cleanly.")
            break

        print(f"\n[{idx}/{min(len(queue), args.max_topics)}] Studying: {topic['title']} ...")
        libs_ctx: List[Dict[str, Any]] = []
        if topic.get("dynamic_repos"):
            libs_ctx.extend(topic["dynamic_repos"])
        for lib in topic.get("libraries", []):
            if lib.lower() in pypi_lookup:
                libs_ctx.append(pypi_lookup[lib.lower()])

        prompt = (
            f"Study Topic: {topic['title']}\n"
            f"Category: {topic.get('category', 'Software Engineering')}\n"
            f"Goal: {topic.get('goal', '')}\n"
            f"Libraries to memorize: {', '.join(topic.get('libraries', []))}\n"
        )
        if libs_ctx:
            prompt += "\nLive Registry Data (JSON):\n" + json.dumps(libs_ctx[:6], indent=2, ensure_ascii=False)

        used_engine = "offline-structured"
        if args.offline_only:
            content = build_offline_cheatsheet(topic, libs_ctx)
        else:
            ok, result, url = call_qwen(prompt, endpoint=args.endpoint)
            if ok:
                content = result
                used_engine = url
                print(f"   [OK] Synthesized by Qwen2.5-Coder-7B ({url})")
            else:
                print(f"   [INFO] AI engine busy/unreachable ({result}); saving structured supervisor cheatsheet.")
                content = build_offline_cheatsheet(topic, libs_ctx)

        now_iso = datetime.now(timezone.utc).isoformat()
        skill_path = write_learned_skill_md(topic, content, now_iso)

        # Mark learned in supervisor_reading_list.json (for persistent syllabus items)
        for item in reading_list.get("topics", []):
            if item.get("id") == topic.get("id"):
                item["status"] = "learned"
                item["lastStudied"] = now_iso

        first_summary_line = next(
            (ln.strip(" #-*") for ln in content.splitlines() if ln.strip() and not ln.strip().startswith("#")),
            topic.get("goal", ""),
        )[:180]

        studied_entries.append(
            {
                "id": topic.get("id"),
                "title": topic["title"],
                "category": topic.get("category", "General"),
                "libraries": topic.get("libraries", []),
                "summary": first_summary_line,
                "skill_file": str(skill_path.relative_to(REPO_ROOT)).replace("\\", "/"),
                "engine": used_engine,
                "completed_at": now_iso,
            }
        )
        print(f"   [SAVED] {skill_path.relative_to(REPO_ROOT)}")

    save_json(READING_LIST_FILE, reading_list)

    finished_at = datetime.now(timezone.utc)
    elapsed_min = round((finished_at - started_at).total_seconds() / 60.0, 2)

    log_data = load_json(LOG_FILE, {"sessions": []})
    log_data.setdefault("sessions", []).append(
        {
            "date": datetime.now().strftime("%Y-%m-%d"),
            "started_at": started_at.isoformat(),
            "finished_at": finished_at.isoformat(),
            "elapsed_minutes": elapsed_min,
            "topics_learned": studied_entries,
            "trending_counts": trending.get("counts", {}),
        }
    )
    save_json(LOG_FILE, log_data)

    print("\n============================================================")
    print(f"  DONE! Learned {len(studied_entries)} topic(s) in {elapsed_min} min.")
    print("  Run `python scripts/training/what_learned_today.py` to see today's report!")
    print("============================================================")

    if args.git_push and studied_entries:
        git_commit_and_push(len(studied_entries))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
