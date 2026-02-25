# Day 48 — Regression Detection

> 🎯 **DAY GOAL:** Build automated regression detection — catch when changes break previously working test cases

---

## 📚 CONCEPT 1: What Is a Regression?

### WHAT — Simple Definition

**A regression is when something that USED TO WORK stops working after a change. In AI: a test case that passed on the last eval run now fails.**

```
REGRESSION EXAMPLE:

Run #46 (before prompt change):
  ✅ test_03: "What's the weather?" → Calls weather tool → PASS
  ✅ test_07: "Remember my name is John" → Writes memory → PASS
  ✅ test_12: "What's my name?" → Searches memory → PASS

Run #47 (after prompt change):
  ✅ test_03: "What's the weather?" → Calls weather tool → PASS
  ❌ test_07: "Remember my name is John" → No memory write → FAIL ← REGRESSION!
  ❌ test_12: "What's my name?" → "I don't know" → FAIL ← REGRESSION!

NEW FAILURES = REGRESSIONS
The prompt change broke memory writing!
```

### WHY — Regressions Are Silent Killers

```
WITHOUT REGRESSION DETECTION:
  → Change prompt to improve tool usage
  → Tool usage score goes up 5% 🎉
  → Memory score drops 8% 😱 (unnoticed)
  → Ship it → users lose memory features
  → Find out weeks later from user complaints

WITH REGRESSION DETECTION:
  → Change prompt to improve tool usage
  → ⚠️ ALERT: 3 memory tests regressed!
  → See exactly which tests broke and why
  → Fix prompt before shipping
  → Both tool usage AND memory work ✅
```

### 🔗 NODE.JS ANALOGY

```
// Regression detection = Jest snapshot testing

// Jest snapshots:
//   → Record expected output
//   → On next run, compare with snapshot
//   → If different → FAIL (regression!)
//   → Developer reviews: intentional change or bug?

// Eval regression:
//   → Record which tests passed last run
//   → On next run, compare with baseline
//   → If previously-passing test fails → REGRESSION!
//   → Developer reviews: expected or bug?
```

---

## 🔨 HANDS-ON: Build Regression Detector

### Step 1: Regression Analyzer (30 minutes)

Create `services/eval/regression.py`:

```python
import json
from dataclasses import dataclass
from pathlib import Path
from datetime import datetime

@dataclass
class Regression:
    test_id: str
    category: str
    input_text: str
    baseline_score: int     # Score in baseline run
    current_score: int      # Score in current run
    baseline_output: str
    current_output: str
    severity: str           # "critical" | "major" | "minor"

@dataclass  
class RegressionReport:
    baseline_run: str
    current_run: str
    timestamp: str
    regressions: list[Regression]
    improvements: list[dict]   # Tests that got BETTER
    unchanged: int
    regression_rate: float     # % of tests that regressed
    verdict: str               # "pass" | "warn" | "fail"

def load_run(run_path: str) -> dict:
    """Load an eval run result"""
    with open(run_path) as f:
        return json.load(f)

def detect_regressions(
    baseline_path: str,
    current_path: str,
    threshold: int = 1,  # Score drop of >= threshold = regression
) -> RegressionReport:
    """Compare two eval runs and detect regressions"""
    
    baseline = load_run(baseline_path)
    current = load_run(current_path)
    
    # Build lookup: test_id → result
    baseline_map = {r["test_id"]: r for r in baseline["results"]}
    current_map = {r["test_id"]: r for r in current["results"]}
    
    regressions = []
    improvements = []
    unchanged = 0
    
    for test_id, base_result in baseline_map.items():
        if test_id not in current_map:
            continue  # Test removed, skip
            
        curr_result = current_map[test_id]
        base_score = base_result["judge_score"]
        curr_score = curr_result["judge_score"]
        delta = curr_score - base_score
        
        if delta <= -threshold:
            # REGRESSION: score dropped
            severity = classify_severity(base_score, curr_score)
            regressions.append(Regression(
                test_id=test_id,
                category=base_result.get("category", "general"),
                input_text=base_result["input"],
                baseline_score=base_score,
                current_score=curr_score,
                baseline_output=base_result["output"],
                current_output=curr_result["output"],
                severity=severity,
            ))
        elif delta >= threshold:
            # IMPROVEMENT: score increased
            improvements.append({
                "test_id": test_id,
                "category": base_result.get("category", "general"),
                "baseline_score": base_score,
                "current_score": curr_score,
                "delta": delta,
            })
        else:
            unchanged += 1
    
    total = len(baseline_map)
    regression_rate = len(regressions) / total * 100 if total > 0 else 0
    
    # Verdict
    critical_count = sum(1 for r in regressions if r.severity == "critical")
    if critical_count > 0:
        verdict = "fail"
    elif regression_rate > 10:
        verdict = "fail"
    elif regression_rate > 5:
        verdict = "warn"
    else:
        verdict = "pass"
    
    return RegressionReport(
        baseline_run=baseline.get("run_id", baseline_path),
        current_run=current.get("run_id", current_path),
        timestamp=datetime.now().isoformat(),
        regressions=regressions,
        improvements=improvements,
        unchanged=unchanged,
        regression_rate=round(regression_rate, 1),
        verdict=verdict,
    )

def classify_severity(baseline: int, current: int) -> str:
    """Classify regression severity"""
    drop = baseline - current
    if baseline >= 4 and current <= 2:
        return "critical"  # Was good, now bad
    if drop >= 3:
        return "critical"
    if drop >= 2:
        return "major"
    return "minor"

def print_regression_report(report: RegressionReport):
    """Pretty-print regression report"""
    icon = {"pass": "✅", "warn": "⚠️", "fail": "❌"}[report.verdict]
    
    print(f"\n{'='*60}")
    print(f"REGRESSION REPORT {icon}")
    print(f"{'='*60}")
    print(f"  Baseline: {report.baseline_run}")
    print(f"  Current:  {report.current_run}")
    print(f"  Verdict:  {report.verdict.upper()}")
    print(f"  Regression Rate: {report.regression_rate}%")
    print()
    
    if report.regressions:
        print(f"  ❌ REGRESSIONS ({len(report.regressions)}):")
        for r in sorted(report.regressions, key=lambda x: x.severity):
            sev_icon = {"critical": "🔴", "major": "🟡", "minor": "🟢"}[r.severity]
            print(f"    {sev_icon} [{r.severity}] {r.test_id} ({r.category})")
            print(f"       Score: {r.baseline_score} → {r.current_score}")
            print(f"       Input: {r.input_text[:60]}...")
            print(f"       Was: {r.baseline_output[:60]}...")
            print(f"       Now: {r.current_output[:60]}...")
            print()
    
    if report.improvements:
        print(f"  ✅ IMPROVEMENTS ({len(report.improvements)}):")
        for imp in report.improvements:
            print(f"    ↑ {imp['test_id']}: {imp['baseline_score']} → {imp['current_score']} (+{imp['delta']})")
    
    print(f"\n  📊 Summary: {len(report.regressions)} regressions, "
          f"{len(report.improvements)} improvements, {report.unchanged} unchanged")

# Quality gate for CI
def check_regression_gate(report: RegressionReport) -> bool:
    """Returns True if regressions are acceptable"""
    if report.verdict == "fail":
        print("❌ REGRESSION GATE: FAILED")
        print("  Fix regressions before merging.")
        return False
    if report.verdict == "warn":
        print("⚠️ REGRESSION GATE: WARNING")
        print("  Some regressions detected. Review before merging.")
        return True  # Allow with warning
    print("✅ REGRESSION GATE: PASSED")
    return True
```

### Step 2: CI Integration (15 minutes)

Add to `.github/workflows/eval.yml`:

```yaml
  regression-check:
    runs-on: ubuntu-latest
    needs: eval
    steps:
      - uses: actions/checkout@v4
      
      - name: Download baseline
        uses: actions/download-artifact@v4
        with:
          name: eval-baseline
          path: eval-baseline/
        continue-on-error: true  # First run has no baseline
      
      - name: Download current results
        uses: actions/download-artifact@v4
        with:
          name: eval-results
          path: eval-results/
      
      - name: Check for regressions
        run: |
          cd services/eval
          python -c "
          from regression import detect_regressions, print_regression_report, check_regression_gate
          import sys
          
          try:
              report = detect_regressions(
                  '../../eval-baseline/results.json',
                  '../../eval-results/results.json'
              )
              print_regression_report(report)
              if not check_regression_gate(report):
                  sys.exit(1)
          except FileNotFoundError:
              print('No baseline found. This is the first run.')
          "
      
      - name: Save as new baseline
        if: github.ref == 'refs/heads/main'
        uses: actions/upload-artifact@v4
        with:
          name: eval-baseline
          path: eval-results/results.json
```

### Step 3: Regression Viewer in Dashboard (15 minutes)

Add to eval dashboard — a "Regressions" section:

```tsx
// Add to eval-dashboard.tsx

interface RegressionInfo {
  test_id: string;
  category: string;
  severity: 'critical' | 'major' | 'minor';
  baseline_score: number;
  current_score: number;
  input_text: string;
}

function RegressionList({ regressions }: { regressions: RegressionInfo[] }) {
  const sevIcon = { critical: '🔴', major: '🟡', minor: '🟢' };
  const sevOrder = { critical: 0, major: 1, minor: 2 };

  const sorted = [...regressions].sort(
    (a, b) => sevOrder[a.severity] - sevOrder[b.severity]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>⚠️ Regressions ({regressions.length})</CardTitle>
      </CardHeader>
      <CardContent>
        {sorted.map(r => (
          <div key={r.test_id} className="flex items-center gap-3 py-2 border-b last:border-0">
            <span>{sevIcon[r.severity]}</span>
            <div className="flex-1">
              <span className="font-medium text-sm">{r.test_id}</span>
              <Badge variant="outline" className="ml-2 text-xs">{r.category}</Badge>
            </div>
            <div className="text-sm">
              <span className="text-green-600">{r.baseline_score}</span>
              <span className="mx-1">→</span>
              <span className="text-red-600">{r.current_score}</span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
```

---

## ✅ CHECKLIST

- [ ] Regression detector compares two eval runs
- [ ] Severity classification (critical/major/minor)
- [ ] Pretty-print regression report
- [ ] Quality gate for CI (blocks if critical regressions)
- [ ] Baseline auto-saved on main branch
- [ ] Regression viewer in dashboard
- [ ] Improvements also tracked

---

## 💡 KEY TAKEAWAY

**Regression detection is your safety net — it catches when improvements in one area break another. The key insight: ALWAYS compare against a baseline, not just look at absolute scores. A 90% score means nothing if last run was 95%. This is standard practice at AI companies: no merge without regression check.**

---

**Next → [Day 49: Custom Evaluation Metrics](day-49.md)**
