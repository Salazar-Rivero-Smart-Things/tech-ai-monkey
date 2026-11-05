#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Tech AI monkey – installer nattlig PostgreSQL-backup (systemd timer).
#
# Kjør selv (spør om sudo-passord):
#     bash deploy/install-backup.sh
#
# Etterpå:
#     systemctl list-timers myai-backup.timer      # neste kjøring
#     journalctl -u myai-backup.service -n 50      # logg
#     sudo systemctl start myai-backup.service     # kjør nå
# ---------------------------------------------------------------------------
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
echo "Prosjektmappe: $REPO_DIR"
echo

chmod +x "$REPO_DIR/deploy/backup-db.sh" "$REPO_DIR/deploy/restore-db.sh"

echo "→ Installerer /etc/systemd/system/myai-backup.service"
sed "s|@@REPO@@|$REPO_DIR|g" "$REPO_DIR/deploy/myai-backup.service" \
  | sudo tee /etc/systemd/system/myai-backup.service >/dev/null

echo "→ Installerer /etc/systemd/system/myai-backup.timer"
sed "s|@@REPO@@|$REPO_DIR|g" "$REPO_DIR/deploy/myai-backup.timer" \
  | sudo tee /etc/systemd/system/myai-backup.timer >/dev/null

echo "→ systemctl daemon-reload"
sudo systemctl daemon-reload

echo "→ Kjører en første backup nå (verifiserer at det virker) …"
if sudo systemctl start myai-backup.service; then
  echo "✓ Første backup kjørte OK."
else
  echo "✗ Første backup feilet. Se loggen:"
  sudo journalctl -u myai-backup.service -n 40 --no-pager || true
  exit 1
fi

echo "→ Aktiverer timeren (kjører hver natt kl. 03:30)"
sudo systemctl enable --now myai-backup.timer

echo
echo "==================== neste kjøringer ===================="
systemctl --no-pager list-timers myai-backup.timer || true
echo "=========================================================="
echo
echo "Backuper lagres i:  /home/$(id -un)/backups/tech-ai-monkey"
echo "Manuell backup:     bash deploy/backup-db.sh"
echo "Gjenoppretting:     bash deploy/restore-db.sh <fil.sql.gz>"
