# Day 25 — CI Eval Pipeline + Quality Gates

> 🎯 **DAY GOAL:** Automate evaluation so every code change gets tested — like CI/CD but for AI quality

---

## 📚 CONCEPT 1: CI for AI — Why It's Different

### WHAT — Simple Definition

**Continuous Integration (CI) for AI adds evaluation scoring on top of normal tests.** Instead of just "does it compile?", you also check "is the AI still good?"

```
TRADITIONAL CI:                    AI CI:
  ┌──────────┐                     ┌──────────┐
  │ git push │                     │ git push │
  └────┬─────┘                     └────┬─────┘
       │                                │
  ┌────▼─────┐                     ┌────▼─────┐
  │ lint     │                     │ lint     │
  │ typecheck│                     │ typecheck│
  │ unit test│                     │ unit test│
  └────┬─────┘                     └────┬─────┘
       │                                │
       ✅ Done                     ┌────▼──────┐
                                   │ EVAL RUN  │  ← NEW
                                   │ 6 tests   │
                                   │ score>0.7 │
                                   └────┬──────┘
                                        │
                                   ┌────▼──────┐
                                   │ QUALITY   │  ← NEW
                                   │ GATE      │
                                   │ pass/fail │
                                   └───────────┘
```

### WHY — Why Automate Evals?

```
Manual testing:
  ❌ "I'll just try a few questions manually"
  ❌ Forget to test after every change
  ❌ Can't compare results consistently
  ❌ No proof of quality for job interviews

Automated eval CI:
  ✅ Runs on every push automatically
  ✅ Blocks merges if quality drops
  ✅ Historical quality tracking
  ✅ "Show me your CI pipeline" → impressive in interviews
```

### 🔗 NODE.JS ANALOGY

```
Quality Gate = test coverage threshold

// jest.config.js
coverageThreshold: {
  global: { branches: 80, functions: 80 }
}
// CI fails if coverage drops below 80%

// eval_config
qualityThreshold: {
  overall: 0.7,
  rag: 0.75,
  safety: 0.9
}
// CI fails if eval score drops below threshold
```

---

## 📚 CONCEPT 2: GitHub Actions for AI Projects

### WHAT — Simple Definition

**A workflow file that runs your eval suite on every push, and blocks the PR if scores drop below thresholds.**

### HOW — The Pipeline Steps

```
Trigger: push to main or PR
  │
  ├── Job 1: Standard checks (parallel)
  │   ├── pnpm lint
  │   ├── pnpm typecheck
  │   └── pnpm test
  │
  └── Job 2: AI Eval (after Job 1 passes)
      ├── Start Ollama
      ├── Pull model (qwen2.5:7b)
      ├── Start Lunar gateway
      ├── Start eval service
      ├── Run eval dataset
      ├── Check quality gate
      └── Upload report as artifact
```

---

## 🔨 HANDS-ON: Build the CI Pipeline

### Step 1: Quality Gate Script (20 minutes)

Create `services/eval/gate.py`:

```python
"""Quality gate — checks if eval results meet thresholds."""
import json
import sys
from pathlib import Path

# Thresholds per category
THRESHOLDS = {
    "overall": 0.70,
    "knowledge": 0.70,
    "rag": 0.75,
    "reasoning": 0.60,
    "safety": 0.90,
}

def check_gate(report_path: str) -> bool:
    """Check if eval results pass quality gate."""
    with open(report_path) as f:
        results = json.load(f)
    
    if not results:
        print("❌ No results found!")
        return False
    
    # Overall score
    overall = sum(r["overall_score"] for r in results) / len(results)
    print(f"\n📊 Quality Gate Check")
    print(f"{'='*50}")
    
    passed = True
    
    # Check overall
    status = "✅" if overall >= THRESHOLDS["overall"] else "❌"
    if overall < THRESHOLDS["overall"]:
        passed = False
    print(f"  {status} Overall: {overall:.3f} (min: {THRESHOLDS['overall']})")
    
    # Check per category
    categories = set(r["category"] for r in results)
    for cat in sorted(categories):
        cat_results = [r for r in results if r["category"] == cat]
        cat_score = sum(r["overall_score"] for r in cat_results) / len(cat_results)
        threshold = THRESHOLDS.get(cat, THRESHOLDS["overall"])
        status = "✅" if cat_score >= threshold else "❌"
        if cat_score < threshold:
            passed = False
        print(f"  {status} {cat:15s}: {cat_score:.3f} (min: {threshold})")
    
    print(f"{'='*50}")
    
    if passed:
        print("✅ QUALITY GATE PASSED\n")
    else:
        print("❌ QUALITY GATE FAILED\n")
    
    return passed


if __name__ == "__main__":
    if len(sys.argv) < 2:
        # Find most recent report
        reports = sorted(Path("reports").glob("eval_*.json"))
        if not reports:
            print("No reports found! Run eval first.")
            sys.exit(1)
        report_path = str(reports[-1])
    else:
        report_path = sys.argv[1]
    
    print(f"Checking: {report_path}")
    ok = check_gate(report_path)
    sys.exit(0 if ok else 1)
```

### Step 2: GitHub Actions Workflow (20 minutes)

Create `.github/workflows/eval.yml`:

```yaml
name: AI Eval Pipeline

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  # Job 1: Standard checks
  checks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test

  # Job 2: AI Evaluation
  eval:
    runs-on: ubuntu-latest
    needs: checks  # only run if checks pass
    steps:
      - uses: actions/checkout@v4

      # Node.js setup
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      # Python setup
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      
      # Install Ollama
      - name: Install Ollama
        run: |
          curl -fsSL https://ollama.com/install.sh | sh
          ollama serve &
          sleep 5
          ollama pull qwen2.5:7b

      # Install dependencies
      - name: Install Node dependencies
        run: pnpm install

      - name: Install Python dependencies
        run: |
          cd services/eval
          python -m venv .venv
          source .venv/bin/activate
          pip install -r requirements.txt

      # Start services
      - name: Start services
        run: |
          # Start Lunar gateway
          pnpm dev &
          sleep 10
          
          # Start eval service
          cd services/eval
          source .venv/bin/activate
          uvicorn main:app --port 8000 &
          sleep 5

      # Run evaluation
      - name: Run eval suite
        run: |
          cd services/eval
          source .venv/bin/activate
          python runner.py

      # Quality gate
      - name: Check quality gate
        run: |
          cd services/eval
          source .venv/bin/activate
          python gate.py

      # Save report
      - name: Upload eval report
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: eval-report
          path: services/eval/reports/
```

### Step 3: Local CI Script (10 minutes)

Create `scripts/eval.sh`:

```bash
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
```

```bash
chmod +x scripts/eval.sh
```

### Step 4: Add to package.json (5 minutes)

```json
{
  "scripts": {
    "dev": "pnpm --filter @lunar/gateway dev",
    "eval": "./scripts/eval.sh",
    "eval:quick": "cd services/eval && source .venv/bin/activate && python runner.py"
  }
}
```

---

## 📚 CONCEPT 3: Tracking Quality Over Time

### WHAT — Simple Definition

**Save every eval report with a timestamp. Compare reports to see if quality improves or degrades over time.**

```
reports/
├── eval_20260225_143000.json   ← score: 0.78
├── eval_20260226_093000.json   ← score: 0.82  ↑ improved!
├── eval_20260227_161500.json   ← score: 0.71  ↓ regression!
└── eval_20260228_110000.json   ← score: 0.85  ↑ fixed!
```

### WHY — What This Proves in Interviews

```
Interviewer: "How do you ensure AI quality?"
You: "I built an automated eval pipeline:
  1. Eval dataset with 20+ test cases across 5 categories
  2. LLM-as-Judge scoring with rubrics
  3. Quality gates — PR blocked if score < 0.7
  4. Trend tracking — I can show quality improving over time
  5. Runs in GitHub Actions on every push"

This answer demonstrates:
  ✅ Production AI engineering practices
  ✅ Testing methodology
  ✅ CI/CD experience
  ✅ Quality-first mindset
```

---

## ✅ CHECKLIST

- [ ] Quality gate script checks thresholds per category
- [ ] GitHub Actions workflow file created
- [ ] Local eval script (`scripts/eval.sh`) works
- [ ] Reports saved with timestamps
- [ ] Quality gate exits with code 0 (pass) or 1 (fail)
- [ ] Can run `pnpm eval` to trigger full pipeline

---

## 💡 KEY TAKEAWAY

**Automated AI evaluation is your most impressive engineering asset. It's CI/CD for intelligence — every push gets tested not just for bugs but for quality. Quality gates prevent regressions. This is what separates hobby projects from production AI systems.**

---

## 🏆 WEEK 5 COMPLETE!

**What you built this week:**
- ✅ Python basics (enough to read AI code)
- ✅ FastAPI eval microservice
- ✅ LLM-as-Judge evaluation
- ✅ Automated eval dataset + runner
- ✅ CI pipeline with quality gates

**Next → [Day 26: Docker Fundamentals](../../phase-2-production/week-06-docker/day-26.md)**
