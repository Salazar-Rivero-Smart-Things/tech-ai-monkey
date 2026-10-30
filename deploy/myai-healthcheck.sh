#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Tech AI monkey – helsesjekk for myai-web og myai-agent.
#
# Kjøres av myai-healthcheck.timer (hvert 2. minutt). Varsler på ntfy når
#   * tjenesten ikke er aktiv, eller
#   * HTTP-endepunktet ikke svarer, eller
#   * restart-telleren har økt siden forrige sjekk (krasj-løkke).
#
# Samme feil varsles bare én gang, og «alt OK igjen» sendes når den er borte.
# Uten NTFY_TOPIC skrives varslene bare til journalen.
#
# Konfigurasjon: /etc/myai-alert.env   (se deploy/myai-alert.env.example)
# Test manuelt:  sudo /bin/bash deploy/myai-healthcheck.sh
# ---------------------------------------------------------------------------
set -uo pipefail

NTFY_URL="${NTFY_URL:-https://ntfy.tech-ai.tech}"
NTFY_TOPIC="${NTFY_TOPIC:-}"
# Plassholderen fra malen skal ikke sendes til et offentlig topic.
[ "$NTFY_TOPIC" = "bytt-til-et-hemmelig-topic-navn" ] && NTFY_TOPIC=""
STATE_DIR="${MYAI_STATE_DIR:-/var/lib/myai-health}"

# Portene leses fra de installerte unit-filene, slik at de alltid følger
# PORT= i myai-web.service / myai-agent.service.
unit_port() { # <unit> <standardport>
  local port=""
  if [ -f "/etc/systemd/system/$1" ]; then
    port="$(sed -n 's|^Environment=PORT=||p' "/etc/systemd/system/$1" | head -n1)"
  fi
  printf '%s\n' "${port:-$2}"
}

WEB_PORT="${MYAI_WEB_PORT:-$(unit_port myai-web.service 3100)}"
AGENT_PORT="${MYAI_AGENT_PORT:-$(unit_port myai-agent.service 2000)}"

STATE_FILE="$STATE_DIR/state"
mkdir -p "$STATE_DIR" 2>/dev/null || {
  STATE_DIR="$(mktemp -d)"
  STATE_FILE="$STATE_DIR/state"
}

problems=()

check_unit() { # <unit>
  local state
  state="$(systemctl is-active "$1" 2>/dev/null || true)"
  [ "$state" = "active" ] || problems+=("$1 er ikke aktiv (state: ${state:-ukjent})")
}

check_http() { # <navn> <url> <krever-2xx-3xx>
  local code
  code="$(curl -s -o /dev/null -m 15 -w '%{http_code}' "$2" 2>/dev/null || true)"
  if [ "${3:-1}" = "1" ]; then
    case "$code" in
      2*|3*) return 0 ;;
    esac
    problems+=("$1 svarer ikke på $2 (HTTP ${code:-000})")
  else
    # Agenten har ingen egen helserute – ethvert HTTP-svar beviser at den lever.
    [ "$code" = "000" ] && problems+=("$1 svarer ikke på $2")
  fi
  return 0
}

check_restarts() { # <unit>
  local now prev file
  now="$(systemctl show "$1" -p NRestarts --value 2>/dev/null || true)"
  case "$now" in ''|*[!0-9]*) return 0 ;; esac
  file="$STATE_DIR/restarts-$1"
  prev="$(cat "$file" 2>/dev/null || true)"
  printf '%s\n' "$now" > "$file" 2>/dev/null || true
  case "$prev" in ''|*[!0-9]*) return 0 ;; esac
  # Fast tekst (uten telleren) slik at gjentatte varsler dedupliseres.
  [ "$now" -gt "$prev" ] && problems+=("$1 har restartet siden forrige sjekk – mulig krasj-løkke")
  return 0
}

notify() { # <prioritet> <tags> <tittel> <melding>
  if [ -z "$NTFY_TOPIC" ]; then
    echo "[varsel] $3: $4"
    return 0
  fi
  curl -fsS -m 15 \
    -H "Title: $3" \
    -H "Priority: $1" \
    -H "Tags: $2" \
    -d "$4" \
    "${NTFY_URL%/}/$NTFY_TOPIC" >/dev/null \
    || echo "[varsel feilet] $3: $4" >&2
  return 0
}

check_unit myai-web.service
check_unit myai-agent.service
check_http "myai-web" "http://127.0.0.1:$WEB_PORT/" 1
check_http "myai-agent" "http://127.0.0.1:$AGENT_PORT/" 0
check_restarts myai-web.service
check_restarts myai-agent.service

host="$(hostname -s 2>/dev/null || echo server)"
prev_state="$(cat "$STATE_FILE" 2>/dev/null || true)"

if [ "${#problems[@]}" -eq 0 ]; then
  # Første kjøring har ingen tilstand – da er det ingenting å «bekrefte».
  if [ -n "$prev_state" ] && [ "$prev_state" != "ok" ]; then
    notify default white_check_mark \
      "MyAI er OK igjen på $host" \
      "myai-web (:$WEB_PORT) og myai-agent (:$AGENT_PORT) svarer normalt."
  fi
  printf 'ok\n' >"$STATE_FILE" 2>/dev/null || true
  exit 0
fi

signature="$(printf '%s;' "${problems[@]}")"
if [ "$prev_state" = "$signature" ]; then
  exit 0 # samme feil som forrige sjekk – allerede varslet
fi

notify high rotating_light \
  "MyAI-feil på $host" \
  "$(printf '• %s\n' "${problems[@]}")

Sjekk: journalctl -u myai-web -n 50 --no-pager"
printf '%s\n' "$signature" >"$STATE_FILE" 2>/dev/null || true
exit 0
