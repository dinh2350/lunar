#!/bin/bash
# Run eval pipeline locally — same as CI but on your machine
set -e

echo "🌙 Lunar Eval Pipeline"
echo "======================"

# Check prerequisites
echo "Checking prerequisites..."
command -v ollama >/dev/null 2>&1 || { echo "❌ Ollama not found"; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo "❌ Python not found"; exit 1; }

# Start services (if not already running)
echo "Starting services..."

# Check if Lunar is running
if ! curl -s http://localhost:3100/api/health > /dev/null 2>&1; then
    echo "  Starting Lunar gateway..."
    pnpm dev &
    LUNAR_PID=$!
    sleep 10
fi

# Check if eval service is running
if ! curl -s http://localhost:8000/health > /dev/null 2>&1; then
    echo "  Starting eval service..."
    cd services/eval
    source .venv/bin/activate
    uvicorn main:app --port 8000 &
    EVAL_PID=$!
    cd ../..
    sleep 5
fi

# Run eval
echo "Running evaluation..."
cd services/eval
source .venv/bin/activate
python runner.py

# Quality gate
echo "Checking quality gate..."
python gate.py
EXIT_CODE=$?

# Cleanup background processes
[ -n "$LUNAR_PID" ] && kill $LUNAR_PID 2>/dev/null
[ -n "$EVAL_PID" ] && kill $EVAL_PID 2>/dev/null

exit $EXIT_CODE
