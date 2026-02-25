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
