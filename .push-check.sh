#!/usr/bin/env bash
cd "$(git rev-parse --show-toplevel)"
echo "=== remotes ==="
git remote -v
echo
echo "=== branch ==="
git branch --show-current
echo
echo "=== status (kort) ==="
git status -sb | head -5
echo
echo "=== siste commit ==="
git --no-pager log --oneline -3
echo
echo "=== gh auth ==="
if command -v gh >/dev/null; then gh auth status 2>&1 | head -10; else echo "gh ikke installert"; fi
echo
echo "=== git credential helper ==="
git config --get credential.helper || echo "(ingen)"
