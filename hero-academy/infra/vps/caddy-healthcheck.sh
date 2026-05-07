#!/bin/bash
# /usr/local/bin/caddy-healthcheck.sh
# Cron: * * * * * root /usr/local/bin/caddy-healthcheck.sh
# Если Caddy висит (timeout 8с), делаем systemctl restart caddy.
set -u
CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 8 \
  --resolve db2.hero-academy.ru:443:127.0.0.1 \
  https://db2.hero-academy.ru/auth/v1/health 2>/dev/null || echo "000")

if [ "$CODE" = "200" ] || [ "$CODE" = "401" ]; then
  exit 0
fi

logger -t caddy-healthcheck "Caddy hang detected (code=$CODE), restarting"
systemctl restart caddy
