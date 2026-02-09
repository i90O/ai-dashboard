#!/bin/bash
# Setup crontab for heartbeat
# Run: chmod +x workers/setup-cron.sh && ./workers/setup-cron.sh

DASHBOARD_URL="${DASHBOARD_URL:-https://ai-dashboard-phi-three.vercel.app}"
CRON_SECRET="${CRON_SECRET:-xiaobei-mc-2026}"

echo "Setting up crontab for heartbeat..."
echo "Dashboard URL: $DASHBOARD_URL"

# Create crontab entry
CRON_LINE="*/5 * * * * curl -s -H 'Authorization: Bearer $CRON_SECRET' '$DASHBOARD_URL/api/ops/heartbeat' >> /var/log/heartbeat.log 2>&1"

# Check if already exists
if crontab -l 2>/dev/null | grep -q "api/ops/heartbeat"; then
    echo "Heartbeat cron already exists. Updating..."
    crontab -l 2>/dev/null | grep -v "api/ops/heartbeat" | { cat; echo "$CRON_LINE"; } | crontab -
else
    echo "Adding heartbeat cron..."
    (crontab -l 2>/dev/null; echo "$CRON_LINE") | crontab -
fi

echo "Current crontab:"
crontab -l

echo ""
echo "✅ Crontab configured!"
echo ""
echo "To test heartbeat manually:"
echo "curl -s -H 'Authorization: Bearer $CRON_SECRET' '$DASHBOARD_URL/api/ops/heartbeat'"
