#!/usr/bin/env python3
"""
Golden Gate: Run critical test cases before every deploy.
100% pass rate required to ship.
"""

import json
import asyncio
import sys
from runner import run_single_test
from datetime import datetime

async def run_golden_gate(cases_path: str = "golden_tests.json") -> bool:
    with open(cases_path) as f:
        cases = json.load(f)
    
    print(f"\n{'='*50}")
    print(f"🏆 GOLDEN GATE — {len(cases)} critical tests")
    print(f"{'='*50}\n")
    
    results = []
    for case in cases:
        result = await run_single_test(case)
        passed = result["judge_score"] >= 4
        results.append({
            **result,
            "passed": passed,
            "priority": case["priority"],
        })
        
        icon = "✅" if passed else "❌"
        print(f"  {icon} {case['id']:12s} [{case['category']:15s}] Score: {result['judge_score']}/5")
    
    passed = sum(1 for r in results if r["passed"])
    failed = sum(1 for r in results if not r["passed"])
    critical_fails = sum(1 for r in results if not r["passed"] and r["priority"] == "critical")
    
    print(f"\n{'='*50}")
    
    if failed == 0:
        print(f"🏆 GOLDEN GATE: ALL {passed} TESTS PASSED")
        print(f"✅ Safe to deploy!")
        gate_passed = True
    else:
        print(f"❌ GOLDEN GATE: FAILED")
        print(f"   Passed: {passed}/{len(results)}")
        print(f"   Failed: {failed} ({critical_fails} critical)")
        print(f"\n   Failed tests:")
        for r in results:
            if not r["passed"]:
                print(f"     ❌ {r['test_id']}: Score {r['judge_score']}/5")
                print(f"        {r.get('judge_reason', 'No reason')[:80]}")
        print(f"\n   ⛔ DO NOT DEPLOY — fix failures first")
        gate_passed = False
    
    print(f"{'='*50}\n")
    
    with open(f"golden_results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json", "w") as f:
        json.dump({
            "timestamp": datetime.now().isoformat(),
            "passed": gate_passed,
            "total": len(results),
            "passed_count": passed,
            "failed_count": failed,
            "results": results,
        }, f, indent=2)
    
    return gate_passed

if __name__ == "__main__":
    success = asyncio.run(run_golden_gate())
    sys.exit(0 if success else 1)
