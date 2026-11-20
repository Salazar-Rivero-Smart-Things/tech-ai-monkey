#!/usr/bin/env python3
"""
Tech AI Monkey — Daily Training Scheduler (Python)
==================================================
Configures WHEN during the day Tech AI Monkey should read and study the
supervisor's reading list + trending libraries JSON, and optionally runs
a lightweight background daemon that triggers daily training on time.

Usage examples:
  python scripts/training/schedule_daily_training.py --show
  python scripts/training/schedule_daily_training.py --time 03:30 --duration 60 --enable
  python scripts/training/schedule_daily_training.py --disable
  python scripts/training/schedule_daily_training.py --run-daemon
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict

REPO_ROOT = Path(__file__).resolve().parents[2]
SCHEDULE_FILE = REPO_ROOT / "skills" / "study-schedule.json"
STUDY_SCRIPT = Path(__file__).resolve().parent / "study_now_1h.py"


def load_schedule() -> Dict[str, Any]:
    if SCHEDULE_FILE.exists():
        try:
            return json.loads(SCHEDULE_FILE.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {
        "name": "Daily Tech & Software Engineering Study (1h)",
        "enabled": True,
        "frequency": "daily",
        "time": "06:00",
        "durationMinutes": 60,
        "autoFetchTrendingLibraries": True,
        "supervisors": ["Gemini", "DeepSeek"],
        "updatedAt": datetime.now(timezone.utc).isoformat(),
    }


def save_schedule(cfg: Dict[str, Any]) -> None:
    cfg["updatedAt"] = datetime.now(timezone.utc).isoformat()
    SCHEDULE_FILE.parent.mkdir(parents=True, exist_ok=True)
    SCHEDULE_FILE.write_text(json.dumps(cfg, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def validate_hhmm(value: str) -> str:
    parts = value.strip().split(":")
    if len(parts) != 2:
        raise argparse.ArgumentTypeError("Time must be in HH:MM 24-hour format (e.g. 06:00 or 22:30).")
    h, m = int(parts[0]), int(parts[1])
    if not (0 <= h <= 23 and 0 <= m <= 59):
        raise argparse.ArgumentTypeError("Hours must be 00-23 and minutes 00-59.")
    return f"{h:02d}:{m:02d}"


def next_run_datetime(hhmm: str) -> datetime:
    now = datetime.now()
    h, m = map(int, hhmm.split(":"))
    candidate = now.replace(hour=h, minute=m, second=0, microsecond=0)
    if candidate <= now:
        candidate += timedelta(days=1)
    return candidate


def print_schedule(cfg: Dict[str, Any]) -> None:
    state = "ENABLED" if cfg.get("enabled", True) else "DISABLED"
    hhmm = cfg.get("time", "06:00")
    mins = cfg.get("durationMinutes", 60)
    nxt = next_run_datetime(hhmm)
    print("============================================================")
    print("  Tech AI Monkey — Daily Supervisor Study Schedule")
    print("============================================================")
    print(f"  Status           : {state}")
    print(f"  Daily Study Time : {hhmm} (local time)")
    print(f"  Duration         : {mins} minute(s)")
    print(f"  Trending Libs    : {'Auto-fetch JSON before study' if cfg.get('autoFetchTrendingLibraries', True) else 'Manual'}")
    print(f"  Supervisors      : {', '.join(cfg.get('supervisors', ['Gemini', 'DeepSeek']))}")
    print(f"  Next Scheduled   : {nxt.strftime('%Y-%m-%d %H:%M')}")
    print(f"  Schedule File    : {SCHEDULE_FILE}")
    print("============================================================")


def run_daemon(git_push: bool = False) -> None:
    print("[scheduler] Starting Tech AI Monkey daily training daemon (Ctrl+C to stop)...")
    last_ran_date = ""
    while True:
        cfg = load_schedule()
        if cfg.get("enabled", True):
            now = datetime.now()
            today = now.strftime("%Y-%m-%d")
            now_hhmm = now.strftime("%H:%M")
            target_hhmm = cfg.get("time", "06:00")
            if now_hhmm == target_hhmm and last_ran_date != today:
                last_ran_date = today
                mins = int(cfg.get("durationMinutes", 60))
                print(f"[scheduler] {now.isoformat()} — Starting {mins}-minute supervisor study session!")
                cmd = [sys.executable, str(STUDY_SCRIPT), "--minutes", str(mins)]
                if not cfg.get("autoFetchTrendingLibraries", True):
                    cmd.append("--skip-fetch")
                if git_push:
                    cmd.append("--git-push")
                subprocess.run(cmd, check=False)
        time.sleep(20)


def main() -> int:
    parser = argparse.ArgumentParser(description="Configure or run Tech AI Monkey's daily reading schedule.")
    parser.add_argument("--show", action="store_true", help="Display the current daily study schedule")
    parser.add_argument("--time", type=validate_hhmm, help="Set daily study time in 24h HH:MM format (e.g. 03:00)")
    parser.add_argument("--duration", type=int, help="Set daily study duration in minutes (e.g. 60)")
    parser.add_argument("--enable", action="store_true", help="Enable daily scheduled study")
    parser.add_argument("--disable", action="store_true", help="Pause daily scheduled study")
    parser.add_argument("--run-daemon", action="store_true", help="Keep running and auto-trigger study at scheduled time")
    parser.add_argument("--git-push", action="store_true", help="With --run-daemon: auto commit & push newly learned skills")
    args = parser.parse_args()

    cfg = load_schedule()
    changed = False

    if args.time:
        cfg["time"] = args.time
        changed = True
    if args.duration is not None:
        cfg["durationMinutes"] = max(5, min(360, args.duration))
        changed = True
    if args.enable:
        cfg["enabled"] = True
        changed = True
    if args.disable:
        cfg["enabled"] = False
        changed = True

    if changed:
        save_schedule(cfg)
        print("[OK] Updated daily training schedule!")

    print_schedule(cfg)

    if args.run_daemon:
        run_daemon(git_push=args.git_push)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
