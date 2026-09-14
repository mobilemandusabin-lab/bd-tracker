#!/bin/bash
# ponytail: external pinger loop. Usage: pump-sync.sh <apiBase> <key> [maxTicks]
API="${1:-http://localhost:5000/api}"
KEY="$2"
MAX="${3:-120}"
for ((i=1; i<=MAX; i++)); do
  OUT=$(curl -s -m 150 "$API/sync/kick?key=$KEY&type=full")
  echo "tick=$i $OUT" | head -c 600; echo
  echo "$OUT" | grep -q '"status":"completed"' && { echo PUMP_DONE; break; }
  echo "$OUT" | grep -q '"status":"idle"' && { echo PUMP_IDLE; break; }
  echo "$OUT" | grep -q '"success":false' && { echo PUMP_ERROR; break; }
  sleep 3
done
