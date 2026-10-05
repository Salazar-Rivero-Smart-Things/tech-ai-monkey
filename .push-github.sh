#!/usr/bin/env bash
set -e
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=== Remote ==="
git remote -v
echo
echo "=== Status ==="
git status --short
echo
echo "=== Logg (siste 3) ==="
git log --oneline -3
echo

# Stage eventuelle rester (tasks.json, hjelpescript osv.)
git add -A
if ! git diff --cached --quiet; then
  git commit -m "Sync helper scripts and VS Code tasks" || true
fi

echo "=== Pusher til GitHub (vanlig git) ==="
git push origin main

echo
echo "=== Etter push ==="
git fetch origin >/dev/null 2>&1 || true
git log --oneline -1
git log --oneline -1 origin/main
echo
git status -sb
