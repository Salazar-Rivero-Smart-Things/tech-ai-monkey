#!/usr/bin/env bash
# Engangs: gjør .vscode/tasks.json sti-uavhengig (bruk ${workspaceFolder}).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
F="$ROOT/.vscode/tasks.json"

cp "$F" "$F.bak"

# Lengste/nyeste sti først.
sed -i 's#/home/hesriverp7/Dokumenter/MyGits/Tech-ai-monkey/tech-ai-monkey#${workspaceFolder}#g' "$F"
sed -i 's#/home/hesriverp7/Dokumenter/MyGits/MyAI#${workspaceFolder}#g' "$F"
sed -i 's#~/Dokumenter/MyGits/MyAI#${workspaceFolder}#g' "$F"

echo "=== gjenvaerende treff paa gamle stier (skal vaere tomt) ==="
grep -n "Dokumenter/MyGits" "$F" || echo "INGEN ✓"
echo
echo "=== antall \${workspaceFolder} i tasks.json ==="
grep -c 'workspaceFolder' "$F"
echo
echo "=== JSON gyldig? ==="
node -e "JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')); console.log('JSON OK ✓')" "$F"
