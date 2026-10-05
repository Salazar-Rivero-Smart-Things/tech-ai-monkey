#!/usr/bin/env bash
# Sjekk: passordfri sudo + hva som finnes på gamle stier etter diskytting.
echo "=== sudo -n (passordfri?) ==="
sudo -n true 2>&1
echo "sudo_exit=$?"
echo
echo "=== /etc/sudoers.d ==="
ls -la /etc/sudoers.d/ 2>&1
echo
echo "=== /home/hesriverp7/Dokumenter/MyGits ==="
ls -la /home/hesriverp7/Dokumenter/MyGits/ 2>&1 | head -20
echo
echo "=== gammel prosjektsti finnes? ==="
if [ -e /home/hesriverp7/Dokumenter/MyGits/Tech-ai-monkey/tech-ai-monkey ]; then
  echo "FINNES"
  ls -la /home/hesriverp7/Dokumenter/MyGits/Tech-ai-monkey/ 2>&1
else
  echo "MANGLER"
fi
echo
echo "=== /home mount / disk ==="
df -h /home/hesriverp7 /run/media/hesriverp7/1CF66753F6672C68 2>&1
echo
echo "=== blkid for disk med label ==="
lsblk -o NAME,LABEL,UUID,MOUNTPOINT 2>&1 | head -30
