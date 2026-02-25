#!/bin/bash
# Health check script for all Lunar services
# Usage: ./scripts/healthcheck.sh

set -e

GATEWAY_URL="${GATEWAY_URL:-http://localhost:3100}"
EVAL_URL="${EVAL_URL:-http://localhost:8000}"
OLLAMA_URL="${OLLAMA_URL:-http://localhost:11434}"

echo "🌙 Lunar Health Check"
echo "====================="

check_service() {
    local name="$1"
    local url="$2"
    local response
    
    if response=$(curl -sf --max-time 5 "$url" 2>/dev/null); then
        echo "  ✅ ${name}: OK"
        echo "     ${response}" | head -c 200
        echo ""
        return 0
    else
        echo "  ❌ ${name}: FAILED (${url})"
        return 1
    fi
}

FAILED=0

check_service "Gateway" "${GATEWAY_URL}/api/health" || FAILED=$((FAILED+1))
check_service "Eval"    "${EVAL_URL}/health" || FAILED=$((FAILED+1))
check_service "Ollama"  "${OLLAMA_URL}/api/version" || FAILED=$((FAILED+1))

echo "====================="
if [ $FAILED -eq 0 ]; then
    echo "✅ All services healthy"
    exit 0
else
    echo "❌ ${FAILED} service(s) unhealthy"
    exit 1
fi
