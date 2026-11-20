#!/usr/bin/env python3
"""
Tech AI Monkey — Trending & Brand-New Libraries Radar (JSON Fetcher)
====================================================================
Fetches live JSON from official public registries (GitHub Search JSON API,
PyPI JSON API, and npm Registry JSON API) to track:
  1. Popular / "IN" libraries in Python, TypeScript/JS, and AI/Agents
  2. Brand-new rising libraries released in the last 90 days

Saves:
  - skills/trending_libraries.json                 (machine-readable JSON catalog)
  - skills/global/trending-libraries-radar.md      (Tech AI Monkey auto-loaded skill!)

Zero external dependencies — uses Python 3 standard library only.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List

REPO_ROOT = Path(__file__).resolve().parents[2]
SKILLS_DIR = REPO_ROOT / "skills"
GLOBAL_SKILLS_DIR = SKILLS_DIR / "global"
OUT_JSON = SKILLS_DIR / "trending_libraries.json"
OUT_MD = GLOBAL_SKILLS_DIR / "trending-libraries-radar.md"

CURATED_PYPI_WATCHLIST = [
    ("uv", "Ultra-fast Rust-based Python package & venv manager (10-100x faster than pip)"),
    ("ruff", "Ultra-fast Python linter & formatter replacing flake8/black/isort"),
    ("fastapi", "Modern async Python web & REST API framework"),
    ("pydantic", "Fast data validation & settings management using Python type hints"),
    ("pydantic-ai", "Type-safe Python AI Agent framework by the Pydantic team"),
    ("mcp", "Official Model Context Protocol Python SDK for AI tools & servers"),
    ("polars", "Blazing-fast Rust-powered DataFrame library (alternative to pandas)"),
    ("duckdb", "In-process analytical SQL database for Parquet/CSV/JSON"),
    ("httpx", "Modern async/sync HTTP client with HTTP/2 support"),
    ("typer", "Ergonomic CLI builder using Python type hints"),
    ("rich", "Beautiful terminal formatting, tables, and progress bars"),
    ("textual", "Modern Python TUI (Terminal User Interface) framework"),
    ("playwright", "Reliable cross-browser automation & E2E testing"),
    ("crawl4ai", "LLM-friendly async web crawler & markdown extractor"),
    ("litellm", "Unified OpenAI-compatible interface for 100+ LLMs"),
    ("sqlmodel", "SQL databases in Python combining SQLAlchemy + Pydantic"),
]

CURATED_NPM_QUERIES = [
    ("ai-agents-sdk", "ai sdk mcp agent"),
    ("modern-web-ts", "nextjs drizzle tailwind zod"),
    ("cli-and-tools", "typescript cli bundler vite"),
]


def _http_get_json(url: str, extra_headers: Dict[str, str] | None = None, timeout: int = 15) -> Any:
    headers = {
        "User-Agent": "TechAIMonkey-LibraryRadar/1.0 (https://tech-ai.tech)",
        "Accept": "application/json",
    }
    gh_token = os.getenv("GITHUB_TOKEN", "").strip()
    if gh_token and "api.github.com" in url:
        headers["Authorization"] = f"Bearer {gh_token}"
    if extra_headers:
        headers.update(extra_headers)
    req = urllib.request.Request(url, headers=headers, method="GET")
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def fetch_github_repos(query: str, per_page: int = 8) -> List[Dict[str, Any]]:
    params = urllib.parse.urlencode({"q": query, "sort": "stars", "order": "desc", "per_page": per_page})
    url = f"https://api.github.com/search/repositories?{params}"
    try:
        data = _http_get_json(url, {"Accept": "application/vnd.github+json"})
        out = []
        for item in data.get("items", []):
            out.append(
                {
                    "name": item.get("full_name", ""),
                    "short_name": item.get("name", ""),
                    "language": item.get("language") or "Multi",
                    "stars": int(item.get("stargazers_count", 0)),
                    "description": (item.get("description") or "").strip()[:220],
                    "topics": item.get("topics", [])[:6],
                    "url": item.get("html_url", ""),
                    "created_at": (item.get("created_at") or "")[:10],
                    "updated_at": (item.get("pushed_at") or "")[:10],
                }
            )
        return out
    except Exception as exc:
        print(f"[warn] GitHub query '{query}' failed: {exc}", file=sys.stderr)
        return []


def fetch_pypi_watchlist() -> List[Dict[str, Any]]:
    results = []
    for pkg, tip in CURATED_PYPI_WATCHLIST:
        url = f"https://pypi.org/pypi/{urllib.parse.quote(pkg)}/json"
        try:
            data = _http_get_json(url, timeout=10)
            info = data.get("info", {})
            results.append(
                {
                    "name": info.get("name", pkg),
                    "version": info.get("version", "latest"),
                    "summary": (info.get("summary") or tip).strip()[:200],
                    "when_to_recommend": tip,
                    "install": f"pip install {pkg}",
                    "url": info.get("project_url") or f"https://pypi.org/project/{pkg}/",
                }
            )
        except Exception as exc:
            results.append(
                {
                    "name": pkg,
                    "version": "unknown",
                    "summary": tip,
                    "when_to_recommend": tip,
                    "install": f"pip install {pkg}",
                    "url": f"https://pypi.org/project/{pkg}/",
                    "error": str(exc),
                }
            )
    return results


def fetch_npm_trending() -> List[Dict[str, Any]]:
    seen = set()
    results = []
    for category, q in CURATED_NPM_QUERIES:
        params = urllib.parse.urlencode({"text": q, "size": 5})
        url = f"https://registry.npmjs.org/-/v1/search?{params}"
        try:
            data = _http_get_json(url, timeout=12)
            for obj in data.get("objects", []):
                pkg = obj.get("package", {})
                name = pkg.get("name", "")
                if not name or name in seen:
                    continue
                seen.add(name)
                results.append(
                    {
                        "name": name,
                        "version": pkg.get("version", ""),
                        "category": category,
                        "description": (pkg.get("description") or "").strip()[:200],
                        "install": f"npm install {name}",
                        "url": (pkg.get("links") or {}).get("npm", f"https://www.npmjs.com/package/{name}"),
                    }
                )
        except Exception as exc:
            print(f"[warn] npm query '{q}' failed: {exc}", file=sys.stderr)
    return results


def write_skill_markdown(catalog: Dict[str, Any]) -> None:
    GLOBAL_SKILLS_DIR.mkdir(parents=True, exist_ok=True)
    now_iso = catalog["fetchedAt"]
    lines = [
        "---",
        "name: Trending & Brand-New Libraries Radar",
        "description: Live catalog of popular (IN) and newly released Python, TypeScript, and AI libraries so Tech AI Monkey can proactively recommend the best modern library during any user project.",
        "triggers: library, libraries, bibliotek, biblioteker, package, pakke, trending, popular, populære, nytt bibliotek, recommend, anbefal, hvilket bibliotek, framework, sdk",
        "scope: global",
        "createdBy: supervisor",
        f"updatedAt: {now_iso}",
        "---",
        "",
        "# Trending & Brand-New Libraries Radar",
        "",
        f"*Last updated from live JSON APIs (GitHub, PyPI, npm): `{now_iso}`*",
        "",
        "Whenever the user is building a project, proactively check if one of these modern, high-velocity libraries saves time or gives cleaner architecture — and include the exact install command!",
        "",
        "## 1. Brand-New Rising Libraries (Created in the Last 90 Days)",
    ]

    for repo in catalog.get("brand_new_github", [])[:12]:
        lines.append(
            f"- **{repo['name']}** (`{repo['language']}`, ⭐ {repo['stars']:,}, created `{repo['created_at']}`): "
            f"{repo['description']} — {repo['url']}"
        )

    lines.extend(["", "## 2. Popular & 'IN' Python Libraries (Live PyPI Versions)"])
    for pkg in catalog.get("pypi_in_libraries", []):
        lines.append(
            f"- **{pkg['name']}** `v{pkg['version']}` (`{pkg['install']}`): {pkg['when_to_recommend']}"
        )

    lines.extend(["", "## 3. Popular & 'IN' GitHub Repositories (Python / TypeScript / AI)"])
    for repo in catalog.get("popular_github", [])[:15]:
        lines.append(
            f"- **{repo['name']}** (`{repo['language']}`, ⭐ {repo['stars']:,}): {repo['description']}"
        )

    lines.extend(["", "## 4. Popular npm / TypeScript Packages"])
    for pkg in catalog.get("npm_trending", [])[:12]:
        lines.append(f"- **{pkg['name']}** `v{pkg['version']}` (`{pkg['install']}`): {pkg['description']}")

    OUT_MD.write_text("\n".join(lines) + "\n", encoding="utf-8")


def run_fetch(quiet: bool = False) -> Dict[str, Any]:
    now = datetime.now(timezone.utc)
    since_90d = (now - timedelta(days=90)).strftime("%Y-%m-%d")
    since_30d = (now - timedelta(days=30)).strftime("%Y-%m-%d")

    if not quiet:
        print("Fetching live JSON from GitHub (brand-new + popular), PyPI, and npm...")

    brand_new = (
        fetch_github_repos(f"language:Python created:>{since_90d} stars:>200", per_page=6)
        + fetch_github_repos(f"language:TypeScript created:>{since_90d} stars:>200", per_page=6)
        + fetch_github_repos(f"(mcp OR ai-agent OR llm) created:>{since_90d} stars:>150", per_page=6)
    )
    # Deduplicate by repo full_name and sort by stars desc
    seen_new = {}
    for r in brand_new:
        seen_new[r["name"]] = r
    brand_new_sorted = sorted(seen_new.values(), key=lambda x: x["stars"], reverse=True)

    popular = (
        fetch_github_repos(f"language:Python stars:>15000 pushed:>{since_30d}", per_page=6)
        + fetch_github_repos(f"language:TypeScript stars:>15000 pushed:>{since_30d}", per_page=6)
        + fetch_github_repos(f"(mcp OR agent) stars:>3000 pushed:>{since_30d}", per_page=6)
    )
    seen_pop = {}
    for r in popular:
        seen_pop[r["name"]] = r
    popular_sorted = sorted(seen_pop.values(), key=lambda x: x["stars"], reverse=True)

    pypi_list = fetch_pypi_watchlist()
    npm_list = fetch_npm_trending()

    catalog = {
        "fetchedAt": now.isoformat(),
        "window_brand_new_since": since_90d,
        "counts": {
            "brand_new_github": len(brand_new_sorted),
            "popular_github": len(popular_sorted),
            "pypi_in_libraries": len(pypi_list),
            "npm_trending": len(npm_list),
        },
        "brand_new_github": brand_new_sorted,
        "popular_github": popular_sorted,
        "pypi_in_libraries": pypi_list,
        "npm_trending": npm_list,
    }

    SKILLS_DIR.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(catalog, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    write_skill_markdown(catalog)

    if not quiet:
        c = catalog["counts"]
        print(
            f"[OK] Saved {OUT_JSON.name} & {OUT_MD.name} | "
            f"Brand-new: {c['brand_new_github']}, Popular GitHub: {c['popular_github']}, "
            f"PyPI IN: {c['pypi_in_libraries']}, npm: {c['npm_trending']}"
        )
    return catalog


def main() -> int:
    parser = argparse.ArgumentParser(description="Fetch trending & brand-new libraries JSON for Tech AI Monkey.")
    parser.add_argument("--quiet", action="store_true", help="Suppress stdout summary")
    args = parser.parse_args()
    run_fetch(quiet=args.quiet)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
