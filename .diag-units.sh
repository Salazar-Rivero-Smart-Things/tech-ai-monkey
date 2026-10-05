#!/usr/bin/env bash
# Temporary: which systemd units still reference the old project path?
echo "=== units som nevner Dokumenter / MyGits / run-media ==="
grep -rIn -e 'Dokumenter' -e 'MyGits' -e '/run/media' \
  /etc/systemd/system /etc/systemd/user "$HOME/.config/systemd" 2>/dev/null | head -80
echo
echo "=== relevante unit-filer ==="
systemctl list-unit-files --no-pager 2>/dev/null | grep -iE 'myai|monkey|tech|caddy|servidor|apache|nginx'
echo
echo "=== kjorende tjenester (utvalg) ==="
systemctl list-units --type=service --state=running --no-pager 2>/dev/null \
  | grep -iE 'myai|monkey|tech|caddy|servidor|apache|nginx|postgres|ollama'
