import json
from dataclasses import dataclass
from pathlib import Path
from datetime import datetime

@dataclass
class Regression:
    test_id: str
    category: str
    input_text: str
    baseline_score: int
    current_score: int
    baseline_output: str
    current_output: str
    severity: str

@dataclass  
class RegressionReport:
    baseline_run: str
    current_run: str
    timestamp: str
    regressions: list[Regression]
    improvements: list[dict]
    unchanged: int
    regression_rate: float
    verdict: str

def load_run(run_path: str) -> dict:
    with open(run_path) as f:
        return json.load(f)

def detect_regressions(
    baseline_path: str,
    current_path: str,
    threshold: int = 1,
) -> RegressionReport:
    baseline = load_run(baseline_path)
    current = load_run(current_path)
    
    baseline_map = {r["test_id"]: r for r in baseline["results"]}
    current_map = {r["test_id"]: r for r in current["results"]}
    
    regressions = []
    improvements = []
    unchanged = 0
    
    for test_id, base_result in baseline_map.items():
        if test_id not in current_map:
            continue
            
        curr_result = current_map[test_id]
        base_score = base_result["judge_score"]
        curr_score = curr_result["judge_score"]
        delta = curr_score - base_score
        
        if delta <= -threshold:
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
    drop = baseline - current
    if baseline >= 4 and current <= 2:
        return "critical"
    if drop >= 3:
        return "critical"
    if drop >= 2:
        return "major"
    return "minor"

def print_regression_report(report: RegressionReport):
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

def check_regression_gate(report: RegressionReport) -> bool:
    if report.verdict == "fail":
        print("❌ REGRESSION GATE: FAILED")
        print("  Fix regressions before merging.")
        return False
    if report.verdict == "warn":
        print("⚠️ REGRESSION GATE: WARNING")
        print("  Some regressions detected. Review before merging.")
        return True
    print("✅ REGRESSION GATE: PASSED")
    return True
