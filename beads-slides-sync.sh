#!/bin/bash
# beads-slides-sync.sh
# Syncs beads triage data to the workflow slides using bv --robot-triage
#
# Usage:
#   ./beads-slides-sync.sh          # One-time sync
#   ./beads-slides-sync.sh --watch  # Watch mode (re-syncs every 30s)
#   ./beads-slides-sync.sh --server # Start a tiny HTTP server for live updates

set -e

# Output file for the slides to read
OUTPUT_FILE="$HOME/.beads-slides-data.json"
GRAPH_FILE="beads-graph.html"

sync_tasks() {
    echo "Syncing beads triage data..."

    # Get full triage data from bv --robot-triage
    TRIAGE=$(bv --robot-triage 2>/dev/null || echo '{"triage":{"quick_ref":{},"recommendations":[]}}')

    # Extract the key data we need
    TOP_PICKS=$(echo "$TRIAGE" | jq '.triage.quick_ref.top_picks // []')
    RECOMMENDATIONS=$(echo "$TRIAGE" | jq '.triage.recommendations[:10] // []')
    QUICK_WINS=$(echo "$TRIAGE" | jq '.triage.quick_wins // []')
    BLOCKERS=$(echo "$TRIAGE" | jq '.triage.blockers_to_clear // []')
    HEALTH=$(echo "$TRIAGE" | jq '.triage.project_health // {}')

    # Get counts from health
    OPEN_COUNT=$(echo "$HEALTH" | jq '.counts.open // 0')
    ACTIONABLE_COUNT=$(echo "$TRIAGE" | jq '.triage.quick_ref.actionable_count // 0')
    BLOCKED_COUNT=$(echo "$TRIAGE" | jq '.triage.quick_ref.blocked_count // 0')
    IN_PROGRESS_COUNT=$(echo "$TRIAGE" | jq '.triage.quick_ref.in_progress_count // 0')

    # Velocity stats
    CLOSED_7D=$(echo "$HEALTH" | jq '.velocity.closed_last_7_days // 0')
    AVG_DAYS=$(echo "$HEALTH" | jq '.velocity.avg_days_to_close // 0')

    # Also regenerate the graph
    bv --export-graph "$GRAPH_FILE" 2>/dev/null || true

    # Create the JSON structure with rich triage data
    cat > "$OUTPUT_FILE" << EOF
{
  "topPicks": $TOP_PICKS,
  "recommendations": $RECOMMENDATIONS,
  "quickWins": $QUICK_WINS,
  "blockers": $BLOCKERS,
  "stats": {
    "open": $OPEN_COUNT,
    "actionable": $ACTIONABLE_COUNT,
    "blocked": $BLOCKED_COUNT,
    "inProgress": $IN_PROGRESS_COUNT,
    "closed7d": $CLOSED_7D,
    "avgDaysToClose": $AVG_DAYS
  },
  "health": $HEALTH,
  "updated": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF

    echo "Synced: $ACTIONABLE_COUNT actionable, $IN_PROGRESS_COUNT in progress, $BLOCKED_COUNT blocked"
    echo "Velocity: $CLOSED_7D closed in last 7 days"
    echo "Data written to: $OUTPUT_FILE"
    echo "Graph updated: $GRAPH_FILE"
}

start_server() {
    PORT=${1:-3847}
    echo "Starting beads sync server on http://localhost:$PORT"
    echo "The slides will auto-refresh from this endpoint"
    echo "Press Ctrl+C to stop"
    echo ""

    # Sync once at start
    sync_tasks

    # Simple HTTP server using Python
    python3 << 'PYEOF'
import http.server
import json
import os
import subprocess
import time
from threading import Thread

PORT = int(os.environ.get('BV_PORT', 3847))
DATA_FILE = os.path.expanduser("~/.beads-slides-data.json")

class BeadsHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/beads-tasks' or self.path == '/beads-triage':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()

            try:
                with open(DATA_FILE, 'r') as f:
                    self.wfile.write(f.read().encode())
            except:
                self.wfile.write(b'{"topPicks":[],"stats":{}}')
        else:
            self.send_response(404)
            self.end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.end_headers()

    def log_message(self, format, *args):
        pass  # Suppress logs

def sync_periodically():
    while True:
        time.sleep(30)
        try:
            subprocess.run(['bash', '-c', '''
                TRIAGE=$(bv --robot-triage 2>/dev/null || echo '{"triage":{"quick_ref":{},"recommendations":[]}}')
                TOP_PICKS=$(echo "$TRIAGE" | jq '.triage.quick_ref.top_picks // []')
                RECOMMENDATIONS=$(echo "$TRIAGE" | jq '.triage.recommendations[:10] // []')
                QUICK_WINS=$(echo "$TRIAGE" | jq '.triage.quick_wins // []')
                BLOCKERS=$(echo "$TRIAGE" | jq '.triage.blockers_to_clear // []')
                HEALTH=$(echo "$TRIAGE" | jq '.triage.project_health // {}')
                OPEN_COUNT=$(echo "$HEALTH" | jq '.counts.open // 0')
                ACTIONABLE_COUNT=$(echo "$TRIAGE" | jq '.triage.quick_ref.actionable_count // 0')
                BLOCKED_COUNT=$(echo "$TRIAGE" | jq '.triage.quick_ref.blocked_count // 0')
                IN_PROGRESS_COUNT=$(echo "$TRIAGE" | jq '.triage.quick_ref.in_progress_count // 0')
                CLOSED_7D=$(echo "$HEALTH" | jq '.velocity.closed_last_7_days // 0')
                AVG_DAYS=$(echo "$HEALTH" | jq '.velocity.avg_days_to_close // 0')
                bv --export-graph beads-graph.html 2>/dev/null || true
                cat > ~/.beads-slides-data.json << EOFINNER
{
  "topPicks": $TOP_PICKS,
  "recommendations": $RECOMMENDATIONS,
  "quickWins": $QUICK_WINS,
  "blockers": $BLOCKERS,
  "stats": {
    "open": $OPEN_COUNT,
    "actionable": $ACTIONABLE_COUNT,
    "blocked": $BLOCKED_COUNT,
    "inProgress": $IN_PROGRESS_COUNT,
    "closed7d": $CLOSED_7D,
    "avgDaysToClose": $AVG_DAYS
  },
  "health": $HEALTH,
  "updated": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOFINNER
            '''], capture_output=True)
            print(f"[{time.strftime('%H:%M:%S')}] Triage synced")
        except Exception as e:
            print(f"Sync error: {e}")

# Start background sync thread
sync_thread = Thread(target=sync_periodically, daemon=True)
sync_thread.start()

print(f"Server running at http://localhost:{PORT}/beads-triage")
print("Triage will auto-sync every 30 seconds")

with http.server.HTTPServer(('', PORT), BeadsHandler) as httpd:
    httpd.serve_forever()
PYEOF
}

watch_mode() {
    echo "Watch mode: syncing every 30 seconds"
    echo "Press Ctrl+C to stop"
    echo ""

    while true; do
        sync_tasks
        echo "---"
        sleep 30
    done
}

# Main
case "${1:-}" in
    --watch|-w)
        watch_mode
        ;;
    --server|-s)
        BV_PORT="${2:-3847}" start_server "${2:-3847}"
        ;;
    --help|-h)
        echo "Usage: $0 [--watch|--server [port]]"
        echo ""
        echo "Options:"
        echo "  (none)          One-time sync using bv --robot-triage"
        echo "  --watch, -w     Sync every 30 seconds"
        echo "  --server, -s    Start HTTP server for live slide updates (default port: 3847)"
        echo ""
        echo "Data synced:"
        echo "  - Top picks with reasons and scores"
        echo "  - Recommendations ranked by impact"
        echo "  - Quick wins (low effort, high impact)"
        echo "  - Blockers to clear"
        echo "  - Project health metrics"
        echo "  - Velocity stats"
        echo ""
        echo "Also regenerates: beads-graph.html (interactive dependency graph)"
        ;;
    *)
        sync_tasks
        echo ""
        echo "To enable live updates in slides, run:"
        echo "  $0 --server"
        ;;
esac
